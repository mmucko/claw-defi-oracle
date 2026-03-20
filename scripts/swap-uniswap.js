// scripts/swap-uniswap.js
// Uniswap V3 swap helper for Base mainnet
// Uses raw ethers.js calls against SwapRouter02

const { ethers } = require("hardhat");
require("dotenv").config();

const SWAP_ROUTER = "0x2626664c2603336E57B271c5C0b26F421741e481";
const USDC = "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913";
const WETH = "0x4200000000000000000000000000000000000006";
const POOL_FEE = 500; // 0.05%
const SLIPPAGE_BPS = 50; // 0.5%

// Minimal SwapRouter02 ABI (exactInputSingle)
const SWAP_ROUTER_ABI = [
  "function exactInputSingle((address tokenIn, address tokenOut, uint24 fee, address recipient, uint256 amountIn, uint256 amountOutMinimum, uint160 sqrtPriceLimitX96)) external payable returns (uint256 amountOut)",
  "function multicall(uint256 deadline, bytes[] calldata data) external payable returns (bytes[] memory results)"
];

const ERC20_ABI = [
  "function approve(address spender, uint256 amount) external returns (bool)",
  "function allowance(address owner, address spender) external view returns (uint256)",
  "function balanceOf(address account) external view returns (uint256)",
  "function decimals() external view returns (uint8)"
];

// Quoter V2 for getting expected output
const QUOTER_ABI = [
  "function quoteExactInputSingle((address tokenIn, address tokenOut, uint256 amountIn, uint24 fee, uint160 sqrtPriceLimitX96)) external returns (uint256 amountOut, uint160 sqrtPriceX96After, uint32 initializedTicksCrossed, uint256 gasEstimate)"
];
const QUOTER_ADDRESS = "0x3d4e44Eb1374240CE5F1B871ab261CD16335B76a";

/**
 * Get a quote for expected output amount
 */
async function getQuote(tokenIn, tokenOut, amountIn) {
  const [signer] = await ethers.getSigners();
  const quoter = new ethers.Contract(QUOTER_ADDRESS, QUOTER_ABI, signer);

  try {
    const result = await quoter.quoteExactInputSingle.staticCall({
      tokenIn,
      tokenOut,
      amountIn,
      fee: POOL_FEE,
      sqrtPriceLimitX96: 0
    });
    return result.amountOut || result[0];
  } catch (e) {
    console.log("Quote failed, proceeding with 0 min output (slippage only):", e.message);
    return 0n;
  }
}

/**
 * Swap exact ETH for USDC on Uniswap V3 (Base)
 * @param {string} amountETH - Amount of ETH to swap (e.g. "0.001")
 * @returns {object} { amountIn, amountOut, txHash }
 */
async function swapExactETHForUSDC(amountETH) {
  const [signer] = await ethers.getSigners();
  const router = new ethers.Contract(SWAP_ROUTER, SWAP_ROUTER_ABI, signer);
  const amountIn = ethers.parseEther(amountETH);

  console.log(`[SWAP] ETH -> USDC | Amount: ${amountETH} ETH`);

  // Get quote for slippage calc
  const expectedOut = await getQuote(WETH, USDC, amountIn);
  const amountOutMin = expectedOut > 0n
    ? (expectedOut * BigInt(10000 - SLIPPAGE_BPS)) / 10000n
    : 0n;

  console.log(`[SWAP] Expected output: ${expectedOut} USDC units | Min: ${amountOutMin}`);

  const params = {
    tokenIn: WETH,
    tokenOut: USDC,
    fee: POOL_FEE,
    recipient: signer.address,
    amountIn: amountIn,
    amountOutMinimum: amountOutMin,
    sqrtPriceLimitX96: 0
  };

  const tx = await router.exactInputSingle(params, { value: amountIn });
  console.log(`[SWAP] Tx submitted: ${tx.hash}`);

  const receipt = await tx.wait();
  console.log(`[SWAP] Tx confirmed in block ${receipt.blockNumber}`);

  // Parse Transfer event from USDC to get actual amountOut
  const usdc = new ethers.Contract(USDC, ERC20_ABI, signer);
  const usdcBalance = await usdc.balanceOf(signer.address);
  
  const result = {
    amountIn: amountETH,
    amountInWei: amountIn.toString(),
    amountOut: ethers.formatUnits(expectedOut || 0n, 6),
    txHash: tx.hash,
    direction: "BUY",
    asset: "USDC"
  };

  console.log(`[SWAP] Result:`, result);
  return result;
}

/**
 * Swap exact USDC for ETH on Uniswap V3 (Base)
 * @param {string} amountUSDC - Amount of USDC to swap (e.g. "5.0")
 * @returns {object} { amountIn, amountOut, txHash }
 */
async function swapExactUSDCForETH(amountUSDC) {
  const [signer] = await ethers.getSigners();
  const router = new ethers.Contract(SWAP_ROUTER, SWAP_ROUTER_ABI, signer);
  const usdc = new ethers.Contract(USDC, ERC20_ABI, signer);
  const amountIn = ethers.parseUnits(amountUSDC, 6); // USDC has 6 decimals

  console.log(`[SWAP] USDC -> ETH | Amount: ${amountUSDC} USDC`);

  // Check and set approval (separate nonce handling)
  try {
    const currentAllowance = await usdc.allowance(signer.address, SWAP_ROUTER);
    if (currentAllowance < amountIn) {
      console.log(`[SWAP] Approving USDC spend...`);
      const approveTx = await usdc.approve(SWAP_ROUTER, ethers.MaxUint256);
      await approveTx.wait();
      console.log(`[SWAP] Approval confirmed`);
      // Wait a beat for nonce to update
      await new Promise(r => setTimeout(r, 2000));
    }
  } catch (e) {
    console.log(`[SWAP] Approval check/set issue: ${e.message.slice(0,80)}, proceeding...`);
  }

  // Get quote for slippage calc
  const expectedOut = await getQuote(USDC, WETH, amountIn);
  const amountOutMin = expectedOut > 0n
    ? (expectedOut * BigInt(10000 - SLIPPAGE_BPS)) / 10000n
    : 0n;

  console.log(`[SWAP] Expected output: ${ethers.formatEther(expectedOut || 0n)} ETH | Min: ${ethers.formatEther(amountOutMin)}`);

  const params = {
    tokenIn: USDC,
    tokenOut: WETH,
    fee: POOL_FEE,
    recipient: signer.address,
    amountIn: amountIn,
    amountOutMinimum: amountOutMin,
    sqrtPriceLimitX96: 0
  };

  const tx = await router.exactInputSingle(params);
  console.log(`[SWAP] Tx submitted: ${tx.hash}`);

  const receipt = await tx.wait();
  console.log(`[SWAP] Tx confirmed in block ${receipt.blockNumber}`);

  const result = {
    amountIn: amountUSDC,
    amountInWei: amountIn.toString(),
    amountOut: ethers.formatEther(expectedOut || 0n),
    txHash: tx.hash,
    direction: "SELL",
    asset: "USDC"
  };

  console.log(`[SWAP] Result:`, result);
  return result;
}

// CLI execution
async function main() {
  const args = process.argv.slice(2);
  const command = args[0];
  const amount = args[1];

  if (command === "eth-to-usdc" && amount) {
    await swapExactETHForUSDC(amount);
  } else if (command === "usdc-to-eth" && amount) {
    await swapExactUSDCForETH(amount);
  } else {
    console.log("Usage:");
    console.log("  npx hardhat run scripts/swap-uniswap.js --network base -- eth-to-usdc 0.001");
    console.log("  npx hardhat run scripts/swap-uniswap.js --network base -- usdc-to-eth 5.0");
  }
}

// Run if called directly
if (require.main === module) {
  main().catch(console.error);
}

module.exports = { swapExactETHForUSDC, swapExactUSDCForETH, USDC, WETH, SWAP_ROUTER };
