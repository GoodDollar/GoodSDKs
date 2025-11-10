import {
  DEV_REWARDS_CONTRACT,
  REWARDS_CONTRACT,
} from "@goodsdks/engagement-sdk"

export default {
  devRewards: DEV_REWARDS_CONTRACT,
  prodRewards: REWARDS_CONTRACT,
  rewardsContract: (import.meta.env.DEV || import.meta.env.VITE_DEV
    ? DEV_REWARDS_CONTRACT
    : REWARDS_CONTRACT) as `0x${string}`,
  demoApp: (import.meta.env.VITE_DEMOAPP ||
    "0x247B6C81a453FCDbdC02A4B5fbC69Bd7C78D436D") as `0x${string}`,
}
