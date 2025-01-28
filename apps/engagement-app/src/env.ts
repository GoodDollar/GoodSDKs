import devdeployments from "@goodsdks/engagement-contracts/ignition/deployments/development-celo/deployed_addresses.json";
import prod from "@goodsdks/engagement-contracts/ignition/deployments/chain-42220/deployed_addresses.json";

export default {
  devRewards: devdeployments["EngagementRewards#ERC1967Proxy"],
  prodRewards: prod["EngagementRewards#ERC1967Proxy"],
  rewardsContract: (import.meta.env.DEV
    ? devdeployments["EngagementRewards#ERC1967Proxy"]
    : prod["EngagementRewards#ERC1967Proxy"]) as `0x${string}`,
};
