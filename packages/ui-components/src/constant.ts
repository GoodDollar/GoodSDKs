import { parseAbi } from "viem"

export const G$TokenAddresses = {
  production: "0x62B8B11039FcfE5aB0C56E502b1C372A3d2a9c7A",
  staging: "0x61FA0fB802fd8345C06da558240E0651886fec69",
  development: "0xFa51eFDc0910CCdA91732e6806912Fa12e2FD475",
}

export const goodDollarABI = parseAbi([
  "function balanceOf(address account) view returns (uint256)",
])
