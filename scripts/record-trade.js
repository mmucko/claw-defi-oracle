const hre = require("hardhat");
require("dotenv").config();

const TRADER_ADDRESS = process.env.TRADER_ADDRESS;

async function recordTrade(tradeData) {
  const [signer] = await hre.ethers.getSigners();
  const trader = await hre.ethers.getContractAt("ClawTrader", TRADER_ADDRESS, signer);
  
  const tx = await trader.recordTrade(
    tradeData.direction,
    tradeData.asset,
    hre.ethers.parseEther(tradeData.amountIn),
    hre.ethers.parseUnits(tradeData.amountOut, tradeData.outDecimals || 6),
    Math.round(tradeData.priceUsd * 100), // USD cents
    tradeData.reasoningHash,
    tradeData.sentiment,
    tradeData.confidence
  );
  
  const receipt = await tx.wait();
  const count = await trader.tradeCount();
  console.log(`Trade #${count - 1n} recorded | tx: ${receipt.hash}`);
  return receipt.hash;
}

async function main() {
  // Record our first sentiment trade (cycle 1)
  await recordTrade({
    direction: "BUY",
    asset: "ETH",
    amountIn: "0.0014",      // ETH spent to get USDC (then back)
    amountOut: "2.997194",    // USDC received
    outDecimals: 6,
    priceUsd: 2140.43,
    reasoningHash: "QmYdap611unmsaN6uiDg2USo6hL9MsjEPCHb6XyxWqzzmc",
    sentiment: "BULLISH",
    confidence: 65
  });
}

main().catch(console.error);
module.exports = { recordTrade };
