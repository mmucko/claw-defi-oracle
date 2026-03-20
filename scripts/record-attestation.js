const hre = require("hardhat");
const fs = require("fs");

// Load contract address from deployment
const ORACLE_ADDRESS = process.env.ORACLE_ADDRESS || "";

async function main() {
  if (!ORACLE_ADDRESS) {
    console.error("Set ORACLE_ADDRESS in .env");
    process.exit(1);
  }

  const [signer] = await hre.ethers.getSigners();
  const oracle = await hre.ethers.getContractAt("ClawOracle", ORACLE_ADDRESS, signer);

  // Load analysis results
  const resultsPath = process.argv[2] || "analysis-results.json";
  if (!fs.existsSync(resultsPath)) {
    console.error(`No results file: ${resultsPath}`);
    console.log("Run: node scripts/analyze-yields.js --output analysis-results.json");
    process.exit(1);
  }

  const results = JSON.parse(fs.readFileSync(resultsPath));
  console.log(`Recording ${results.length} attestations on-chain...`);
  console.log(`Network: ${hre.network.name}`);
  console.log(`Agent: ${signer.address}`);
  console.log("---");

  for (const r of results) {
    try {
      // TODO: Upload full reasoning to IPFS, use CID here
      const reasoningHash = `pending-ipfs-${Date.now()}`;
      
      const tx = await oracle.record(
        r.protocol,
        r.chain,
        r.asset,
        r.apyBps,
        r.riskScore,
        reasoningHash,
        r.decision,
        r.confidence
      );
      
      const receipt = await tx.wait();
      console.log(`✅ ${r.protocol} | ${r.asset} | Risk ${r.riskScore}/10 | ${r.decision} | tx: ${receipt.hash}`);
    } catch (e) {
      console.log(`❌ ${r.protocol} failed: ${e.message}`);
    }
  }

  const total = await oracle.count();
  console.log(`\n📊 Total on-chain attestations: ${total}`);
}

main().catch(console.error);
