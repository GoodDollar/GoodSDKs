import { type Address } from "viem"
import { type contractEnv, SupportedChains } from "@goodsdks/citizen-sdk"

/**
 * InvitesV2 contract addresses keyed by environment, then by chain ID.
 * Sourced from GoodProtocol deployment.json.
 *
 * @see https://github.com/GoodDollar/GoodProtocol/blob/master/releases/deployment.json
 */
export const INVITES_V2_ADDRESSES: Record<
  contractEnv,
  Partial<Record<SupportedChains, Address>>
> = {
  production: {
    [SupportedChains.FUSE]: "0xCa2F09c3ccFD7aD5cB9276918Bd1868f2b922ea0",
    [SupportedChains.CELO]: "0x36829D1Cda92FFF5782d5d48991620664FC857d3",
  },
  staging: {
    [SupportedChains.FUSE]: "0x763b49F901DC894F2dEc1c7d19e46250B4452679",
    [SupportedChains.CELO]: "0x06EE642b036f05aA97c8d346Deb8A7E78385e0a9",
  },
  development: {
    [SupportedChains.FUSE]: "0x187fc9fB37DF0fbf75149913a97B17c968Fc90d0",
    [SupportedChains.CELO]: "0x25E6E3Be62c62e2eba673426fD39Ab0209bedbfB",
    [SupportedChains.XDC]: "0xE376DAd6FAe634332B514cE8fF2aD23FBB5d82EF",
  },
}

/**
 * Resolves the InvitesV2 contract address for the given environment and chain.
 * @throws If no address is configured for the combination.
 */
export const resolveInvitesAddress = (
  env: contractEnv,
  chainId: SupportedChains,
): Address => {
  const address = INVITES_V2_ADDRESSES[env]?.[chainId]
  if (!address) {
    throw new Error(
      `InvitesV2 address not configured for env="${env}" chainId=${chainId}`,
    )
  }
  return address
}
