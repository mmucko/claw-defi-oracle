const hre = require("hardhat");

async function main() {
  const oracle = await hre.ethers.getContractAt("ClawOracle", "0x5D93B6c50e1625478561308D25CaB9d89a3a6A77");
  const count = await oracle.count();
  console.log("Total attestations:", count.toString());
  
  for (let i = 0; i < Math.min(Number(count), 25); i++) {
    try {
      const a = await oracle.get(i);
      console.log(`${i}: ${a.protocol} | ${a.asset} | ${a.decision} | IPFS: ${a.reasoningHash.slice(0,20)}...`);
    } catch(e) {
      console.log(`${i}: ERROR - ${e.message.slice(0,100)}`);
    }
  }
}

main().catch(console.error);
