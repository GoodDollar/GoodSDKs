import {
  DEV_REWARDS_CONTRACT,
  REWARDS_CONTRACT,
} from "@GoodSDKs/engagement-sdk";

export default {
  devRewards: DEV_REWARDS_CONTRACT,
  prodRewards: REWARDS_CONTRACT,
  rewardsContract: (import.meta.env.DEV
    ? DEV_REWARDS_CONTRACT
    : REWARDS_CONTRACT) as `0x${string}`,
};
