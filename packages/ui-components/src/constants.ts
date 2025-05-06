import { parseAbi } from "viem"

export type SupportedChains = 42220 | 122
export const G$TokenAddresses = {
  122: {
    production: "0x495d133B938596C9984d462F007B676bDc57eCEC",
    staging: "0xe39236a9Cf13f65DB8adD06BD4b834C65c523d2b",
    development: "0x79BeecC4b165Ccf547662cB4f7C0e83b3796E5b3",
  },
  42220: {
    production: "0x62B8B11039FcfE5aB0C56E502b1C372A3d2a9c7A",
    staging: "0x61FA0fB802fd8345C06da558240E0651886fec69",
    development: "0xFa51eFDc0910CCdA91732e6806912Fa12e2FD475",
  },
}

export const rpcUrls = {
  42220: "https://forno.celo.org",
  122: "https://rpc.fuse.io",
}

export const goodDollarABI = parseAbi([
  "function balanceOf(address account) view returns (uint256)",
])
