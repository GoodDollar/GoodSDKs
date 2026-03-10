import { buildModule } from "@nomicfoundation/hardhat-ignition/modules";
import { hardhatArguments } from "hardhat";

export default buildModule("EngagementRewards", (builder) => {
  // Deploy the implementation contract
  const implementation = builder.contract("EngagementRewards", [
    (hardhatArguments.network || "").includes("development"),
  ]);

  return { implementation };
});
