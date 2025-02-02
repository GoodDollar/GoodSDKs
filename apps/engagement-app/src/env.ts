import devdeployments from "@goodsdks/engagement-contracts/ignition/deployments/development-celo/deployed_addresses.json";
// import prod from "@goodsdks/engagement-contracts/ignition/deployments/chain-42220/deployed_addresses.json";
const prod = {} as typeof devdeployments;
export default {
  devRewards: devdeployments["EngagementRewardsUpgrade#EngagementRewards"],
  prodRewards: prod?.["EngagementRewardsUpgrade#EngagementRewards"],
  rewardsContract: (import.meta.env.DEV
    ? devdeployments["EngagementRewardsUpgrade#EngagementRewards"]
    : prod["EngagementRewardsUpgrade#EngagementRewards"]) as `0x${string}`,
};
