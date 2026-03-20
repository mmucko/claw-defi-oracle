const hre = require("hardhat");
const fs = require("fs");
const path = require("path");

async function main() {
  const [deployer] = await hre.ethers.getSigners();
  console.log("Deploying ClawTrader with agent:", deployer.address);
  
  const balance = await hre.ethers.provider.getBalance(deployer.address);
  console.log("Balance:", hre.ethers.formatEther(balance), "ETH");

  const ClawTrader = await hre.ethers.getContractFactory("ClawTrader");
  const trader = await ClawTrader.deploy();
  await trader.waitForDeployment();
  
  const address = await trader.getAddress();
  console.log("ClawTrader deployed to:", address);
  
  // Update .env
  const envPath = path.join(__dirname, '..', '.env');
  let env = fs.readFileSync(envPath, 'utf8');
  if (env.includes('TRADER_ADDRESS=')) {
    env = env.replace(/TRADER_ADDRESS=.*/, `TRADER_ADDRESS=${address}`);
  } else {
    env += `\nTRADER_ADDRESS=${address}`;
  }
  fs.writeFileSync(envPath, env);
  console.log("Updated .env with TRADER_ADDRESS");
}

main().catch(console.error);
