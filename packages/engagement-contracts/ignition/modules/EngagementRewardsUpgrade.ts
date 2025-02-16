import { buildModule } from "@nomicfoundation/hardhat-ignition/modules";
import EngagementRewards from "./EngagementRewards";
import DEV_ENV from "../deployments/development-celo/deployed_addresses.json";
import PROD_ENV from "../deployments/production-celo/deployed_addresses.json";
import hre from "hardhat";
export default buildModule("EngagementRewardsUpgrade", (m) => {
  const proxy =
    (hre.network.name.includes("development")
      ? DEV_ENV["EngagementRewardsProxy#ERC1967Proxy"]
      : PROD_ENV["EngagementRewardsProxy#ERC1967Proxy"]) ||
    process.env.PROXY_ADDRESS;

  const newimpl = m.useModule(EngagementRewards).implementation;

  const existingProxy = m.contractAt("EngagementRewards", proxy as string);

  m.call(existingProxy, "upgradeToAndCall", [newimpl, "0x"]);

  return { existingProxy };
});
