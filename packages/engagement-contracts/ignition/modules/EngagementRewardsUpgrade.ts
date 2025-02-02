import { buildModule } from "@nomicfoundation/hardhat-ignition/modules";
import EngagementRewards from "./EngagementRewards";
import hre from "hardhat";
export default buildModule("EngagementRewardsUpgrade", (m) => {
  const param = process.env.PROXY_ADDRESS;

  const newimpl = m.useModule(EngagementRewards).implementation;

  const existingProxy = m.contractAt("EngagementRewards", param as string);

  m.call(existingProxy, "upgradeToAndCall", [newimpl, "0x"]);

  return { existingProxy };
});
