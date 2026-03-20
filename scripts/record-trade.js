const hre = require("hardhat");
require("dotenv").config();

async function main() {
  const TRADER_ADDRESS = process.env.TRADER_ADDRESS;
  const [signer] = await hre.ethers.getSigners();
  const trader = await hre.ethers.getContractAt("ClawTrader", TRADER_ADDRESS, signer);

  // Record our first sentiment trade
  const tx = await trader.recordTrade(
    "BUY",                    // direction
    "ETH",                    // asset
    hre.ethers.parseUnits("5.5", 6),  // amountIn (5.5 USDC)
    hre.ethers.parseEther("0.00257"),  // amountOut (~0.00257 ETH)
    214043,                   // priceAtExecution (USD cents)
    "QmYdap611unmsaN6uiDg2USo6hL9MsjEPCHb6XyxWqzzmc", // IPFS reasoning
    "BULLISH",                // sentiment
    65                        // confidence
  );

  const receipt = await tx.wait();
  console.log("Trade recorded on-chain! Tx:", receipt.hash);
  
  const count = await trader.tradeCount();
  console.log("Total trades recorded:", count.toString());
}

main().catch(console.error);
