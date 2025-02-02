import { buildModule } from "@nomicfoundation/hardhat-ignition/modules";

export default buildModule("EngagementRewards", (builder) => {
  // Deploy the implementation contract
  const implementation = builder.contract("EngagementRewards");

  return { implementation };
});
