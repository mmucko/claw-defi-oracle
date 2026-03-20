const hre = require("hardhat");
require("dotenv").config();

const SWAP_ROUTER = "0x2626664c2603336E57B271c5C0b26F421741e481";
const USDC_ADDR = "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913";
const WETH_ADDR = "0x4200000000000000000000000000000000000006";

const ROUTER_ABI = [
  "function exactInputSingle((address tokenIn, address tokenOut, uint24 fee, address recipient, uint256 amountIn, uint256 amountOutMinimum, uint160 sqrtPriceLimitX96)) external payable returns (uint256 amountOut)"
];

const ERC20_ABI = [
  "function approve(address spender, uint256 amount) external returns (bool)",
  "function allowance(address owner, address spender) external view returns (uint256)",
  "function balanceOf(address account) external view returns (uint256)"
];

async function main() {
  const [signer] = await hre.ethers.getSigners();
  console.log("Signer:", signer.address);
  
  const usdc = new hre.ethers.Contract(USDC_ADDR, ERC20_ABI, signer);
  
  // Check balance
  const balance = await usdc.balanceOf(signer.address);
  console.log("USDC balance:", hre.ethers.formatUnits(balance, 6));
  
  // Check allowance (already approved max)
  const allowance = await usdc.allowance(signer.address, SWAP_ROUTER);
  console.log("Allowance:", allowance > 0n ? "OK" : "NEEDS APPROVAL");
  
  // Swap available USDC balance to ETH (leave 0.01 buffer)
  const usdcBal = await usdc.balanceOf(signer.address);
  const buffer = hre.ethers.parseUnits("0.01", 6);
  if (usdcBal <= buffer) { console.log("Not enough USDC to swap"); return; }
  const amountIn = usdcBal - buffer;
  
  const router = new hre.ethers.Contract(SWAP_ROUTER, ROUTER_ABI, signer);
  
  const params = {
    tokenIn: USDC_ADDR,
    tokenOut: WETH_ADDR,
    fee: 500,
    recipient: signer.address,
    amountIn: amountIn,
    amountOutMinimum: 0, // accepting any output for test
    sqrtPriceLimitX96: 0
  };
  
  console.log("Swapping 5.5 USDC -> ETH...");
  const tx = await router.exactInputSingle(params);
  console.log("Tx:", tx.hash);
  const receipt = await tx.wait();
  console.log("Confirmed in block:", receipt.blockNumber);
  
  // Check new balance
  const newUsdcBal = await usdc.balanceOf(signer.address);
  const ethBal = await hre.ethers.provider.getBalance(signer.address);
  console.log("New USDC balance:", hre.ethers.formatUnits(newUsdcBal, 6));
  console.log("ETH balance:", hre.ethers.formatEther(ethBal));
}

main().catch(console.error);
