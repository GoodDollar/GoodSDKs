import { buildModule } from "@nomicfoundation/hardhat-ignition/modules";
import { parseEther } from "ethers";
import hre from "hardhat";
import ProxyModule from "./EngagementRewards";
export default buildModule("EngagementRewardsUpgrade", (m) => {
  const { proxy } = m.useModule(ProxyModule);

  const newimpl = m.contract("EngagementRewards", []);

  const existingProxy = m.contractAt("EngagementRewards", proxy, {
    id: "deployed",
  });

  m.call(existingProxy, "upgradeToAndCall", [newimpl, "0x"]);

  return { proxy };
});
