// scripts/trade-cycle.js
// Autonomous trading cycle: GATHER -> ANALYZE -> DECIDE -> EXECUTE -> RECORD

const { ethers } = require("hardhat");
const path = require("path");
const fs = require("fs");
require("dotenv").config();

// Load Pinata JWT
function getPinataJWT() {
  const credPath = path.join(process.env.HOME || "~", ".openclaw", "credentials", "pinata.json");
  try {
    const creds = JSON.parse(fs.readFileSync(credPath, "utf-8"));
    return creds.jwt || creds.JWT || creds.pinata_jwt;
  } catch (e) {
    console.warn("[RECORD] Could not load Pinata credentials:", e.message);
    return null;
  }
}

// ClawTrader ABI (minimal for recording)
const TRADER_ABI = [
  "function recordTrade(string direction, string asset, uint256 amountIn, uint256 amountOut, uint256 priceAtExecution, string reasoningHash, string sentiment, uint8 confidence) external",
  "function tradeCount() external view returns (uint256)",
  "function getLatestTrades(uint256 n) external view returns (tuple(string direction, string asset, uint256 amountIn, uint256 amountOut, uint256 priceAtExecution, string reasoningHash, string sentiment, uint8 confidence, uint256 timestamp)[])",
  "function getPnL() external view returns (uint256 pnl, bool isPositive)"
];

// ============================================================
// PHASE 1: GATHER
// ============================================================
async function gatherMarketData() {
  console.log("\n=== PHASE 1: GATHER ===");

  // Fetch ETH price data from CoinGecko
  let ethData = {};
  try {
    const ethRes = await fetch(
      "https://api.coingecko.com/api/v3/coins/ethereum?localization=false&tickers=false&community_data=false&developer_data=false&sparkline=false"
    );
    const eth = await ethRes.json();
    ethData = {
      price: eth.market_data?.current_price?.usd || 0,
      change24h: eth.market_data?.price_change_percentage_24h || 0,
      volume24h: eth.market_data?.total_volume?.usd || 0,
      marketCap: eth.market_data?.market_cap?.usd || 0,
      high24h: eth.market_data?.high_24h?.usd || 0,
      low24h: eth.market_data?.low_24h?.usd || 0
    };
    console.log(`[GATHER] ETH Price: $${ethData.price} | 24h: ${ethData.change24h?.toFixed(2)}%`);
  } catch (e) {
    console.error("[GATHER] CoinGecko ETH fetch failed:", e.message);
    ethData = { price: 0, change24h: 0, volume24h: 0, marketCap: 0, high24h: 0, low24h: 0 };
  }

  // Fetch Base chain TVL from DeFiLlama
  let baseTVL = 0;
  try {
    const tvlRes = await fetch("https://api.llama.fi/v2/chains");
    const chains = await tvlRes.json();
    const base = chains.find(c => c.name === "Base" || c.gecko_id === "base");
    baseTVL = base?.tvl || 0;
    console.log(`[GATHER] Base TVL: $${(baseTVL / 1e9).toFixed(2)}B`);
  } catch (e) {
    console.error("[GATHER] DeFiLlama fetch failed:", e.message);
  }

  return {
    timestamp: new Date().toISOString(),
    eth: ethData,
    baseTVL,
  };
}

// ============================================================
// PHASE 2: ANALYZE
// ============================================================
function analyzeMarketData(data) {
  console.log("\n=== PHASE 2: ANALYZE ===");

  const summary = [
    `Market Analysis - ${data.timestamp}`,
    `────────────────────────────────`,
    `ETH Price:     $${data.eth.price?.toLocaleString()}`,
    `24h Change:    ${data.eth.change24h?.toFixed(2)}%`,
    `24h High/Low:  $${data.eth.high24h?.toLocaleString()} / $${data.eth.low24h?.toLocaleString()}`,
    `24h Volume:    $${(data.eth.volume24h / 1e9)?.toFixed(2)}B`,
    `Market Cap:    $${(data.eth.marketCap / 1e9)?.toFixed(2)}B`,
    `Base TVL:      $${(data.baseTVL / 1e9)?.toFixed(2)}B`,
    `────────────────────────────────`,
  ].join("\n");

  console.log(summary);
  return summary;
}

// ============================================================
// PHASE 3: DECIDE
// ============================================================

/**
 * Make a trading decision based on market data.
 * Placeholder: returns HOLD. The actual AI decision is injected by the orchestrator.
 * @param {object} marketData - Output from gatherMarketData()
 * @returns {{ action: string, amount: number, reasoning: string, sentiment: string, confidence: number }}
 */
function makeDecision(marketData) {
  console.log("\n=== PHASE 3: DECIDE ===");

  const summary = analyzeMarketData(marketData);

  // Placeholder decision - always HOLD
  // The orchestrator (Claw/OpenClaw) will replace this with AI-driven decisions
  const decision = {
    action: "HOLD",
    amount: 0,
    reasoning: `Placeholder decision. Market summary:\n${summary}`,
    sentiment: "NEUTRAL",
    confidence: 50
  };

  console.log(`[DECIDE] Action: ${decision.action} | Sentiment: ${decision.sentiment} | Confidence: ${decision.confidence}%`);
  return decision;
}

// ============================================================
// PHASE 4: EXECUTE
// ============================================================
async function executeSwap(decision) {
  console.log("\n=== PHASE 4: EXECUTE ===");

  if (decision.action === "HOLD") {
    console.log("[EXECUTE] Decision is HOLD. No swap needed.");
    return null;
  }

  const { swapExactETHForUSDC, swapExactUSDCForETH } = require("./swap-uniswap");

  let result;
  if (decision.action === "BUY") {
    // BUY = buy ETH exposure = swap USDC for ETH? No...
    // In context: BUY means "buy the asset" which for our portfolio means swap ETH for USDC
    // Actually: BUY means we're bullish on ETH, so we want more ETH = swap USDC -> ETH
    // SELL means we're bearish on ETH, sell ETH for USDC = swap ETH -> USDC
    console.log(`[EXECUTE] BUY signal - swapping USDC for ETH (bullish)`);
    result = await swapExactUSDCForETH(decision.amount.toString());
  } else if (decision.action === "SELL") {
    console.log(`[EXECUTE] SELL signal - swapping ETH for USDC (bearish)`);
    result = await swapExactETHForUSDC(decision.amount.toString());
  }

  return result;
}

// ============================================================
// PHASE 5: RECORD
// ============================================================
async function uploadToIPFS(reasoning) {
  const jwt = getPinataJWT();
  if (!jwt) {
    console.log("[RECORD] No Pinata JWT, skipping IPFS upload");
    return "no-ipfs-cid";
  }

  try {
    const res = await fetch("https://api.pinata.cloud/pinning/pinJSONToIPFS", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${jwt}`
      },
      body: JSON.stringify({
        pinataContent: {
          reasoning,
          timestamp: new Date().toISOString(),
          agent: "claw-defi-oracle"
        },
        pinataMetadata: {
          name: `claw-trade-reasoning-${Date.now()}`
        }
      })
    });

    const data = await res.json();
    console.log(`[RECORD] Uploaded to IPFS: ${data.IpfsHash}`);
    return data.IpfsHash || "upload-failed";
  } catch (e) {
    console.error("[RECORD] IPFS upload failed:", e.message);
    return "upload-failed";
  }
}

async function recordOnChain(decision, swapResult, ipfsCID, ethPriceCents) {
  const traderAddress = process.env.TRADER_ADDRESS;
  if (!traderAddress) {
    console.log("[RECORD] No TRADER_ADDRESS in .env, skipping on-chain record");
    return null;
  }

  const [signer] = await ethers.getSigners();
  const trader = new ethers.Contract(traderAddress, TRADER_ABI, signer);

  const direction = decision.action; // "BUY" or "SELL"
  const asset = "ETH";
  const amountIn = ethers.parseEther(swapResult?.amountIn || "0");
  const amountOut = swapResult?.amountOut
    ? (direction === "SELL"
      ? ethers.parseUnits(swapResult.amountOut, 6)  // USDC out
      : ethers.parseEther(swapResult.amountOut))     // ETH out
    : 0n;

  console.log(`[RECORD] Recording trade on-chain...`);
  const tx = await trader.recordTrade(
    direction,
    asset,
    amountIn,
    amountOut,
    ethPriceCents,
    ipfsCID,
    decision.sentiment,
    decision.confidence
  );

  const receipt = await tx.wait();
  const count = await trader.tradeCount();
  console.log(`[RECORD] Trade #${count - 1n} recorded. Tx: ${tx.hash}`);

  return { txHash: tx.hash, tradeId: (count - 1n).toString() };
}

// ============================================================
// MAIN CYCLE
// ============================================================
async function runTradeCycle(overrideDecision) {
  console.log("\n╔══════════════════════════════════════╗");
  console.log("║   CLAW TRADE CYCLE                   ║");
  console.log("║   Autonomous DeFi Trading Agent       ║");
  console.log("╚══════════════════════════════════════╝\n");

  // Phase 1: Gather
  const marketData = await gatherMarketData();

  // Phase 2 + 3: Analyze & Decide
  const decision = overrideDecision || makeDecision(marketData);

  // Phase 4: Execute
  let swapResult = null;
  if (decision.action !== "HOLD") {
    try {
      swapResult = await executeSwap(decision);
    } catch (e) {
      console.error("[EXECUTE] Swap failed:", e.message);
    }
  }

  // Phase 5: Record (only if trade was executed)
  let record = null;
  if (swapResult) {
    const ipfsCID = await uploadToIPFS(decision.reasoning);
    const ethPriceCents = Math.round((marketData.eth.price || 0) * 100);
    record = await recordOnChain(decision, swapResult, ipfsCID, ethPriceCents);
  }

  const result = {
    marketData,
    decision,
    swapResult,
    record,
    timestamp: new Date().toISOString()
  };

  console.log("\n[CYCLE COMPLETE]", JSON.stringify({
    action: decision.action,
    sentiment: decision.sentiment,
    confidence: decision.confidence,
    traded: !!swapResult,
    recorded: !!record
  }, null, 2));

  return result;
}

// CLI entry point
async function main() {
  await runTradeCycle();
}

if (require.main === module) {
  main().catch(console.error);
}

module.exports = {
  gatherMarketData,
  analyzeMarketData,
  makeDecision,
  executeSwap,
  runTradeCycle,
  uploadToIPFS
};
