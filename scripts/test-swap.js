// Quick test: swap ~$3 worth of ETH for USDC
const { swapExactETHForUSDC } = require("./swap-uniswap");

async function main() {
  // $3 worth of ETH at ~$2137 = 0.0014 ETH
  const amountETH = "0.0014";
  console.log(`Test swap: ${amountETH} ETH → USDC`);
  console.log(`Expected: ~$3 USDC`);
  console.log("---");
  
  const result = await swapExactETHForUSDC(amountETH);
  console.log("\nResult:", JSON.stringify(result, null, 2));
}

main().catch(e => {
  console.error("Swap failed:", e.message);
  process.exit(1);
});
