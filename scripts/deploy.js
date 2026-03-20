const hre = require("hardhat");

async function main() {
  const [deployer] = await hre.ethers.getSigners();
  console.log("Deploying ClawOracle with agent:", deployer.address);
  console.log("Balance:", hre.ethers.formatEther(await hre.ethers.provider.getBalance(deployer.address)), "ETH");

  const ClawOracle = await hre.ethers.getContractFactory("ClawOracle");
  const oracle = await ClawOracle.deploy();
  await oracle.waitForDeployment();

  const address = await oracle.getAddress();
  console.log("ClawOracle deployed to:", address);
  console.log("Network:", hre.network.name);
  
  // Verify
  if (hre.network.name !== "hardhat" && hre.network.name !== "localhost") {
    console.log("Waiting for block confirmations...");
    await oracle.deploymentTransaction().wait(5);
    try {
      await hre.run("verify:verify", { address, constructorArguments: [] });
      console.log("Contract verified on explorer!");
    } catch (e) {
      console.log("Verification failed (can retry later):", e.message);
    }
  }
}

main().catch(console.error);
