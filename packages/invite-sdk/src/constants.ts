import { type Address } from "viem"
import { type contractEnv, SupportedChains } from "@goodsdks/citizen-sdk"

/**
 * The two invite environments. `staging` and any unknown env are normalised
 * to `development` at resolution time.
 */
export type InviteEnv = "production" | "development"

/**
 * InvitesV2 contract addresses for Celo and XDC only.
 * Sourced from GoodProtocol deployment.json.
 *
 * @see https://github.com/GoodDollar/GoodProtocol/blob/master/releases/deployment.json
 */
export const INVITES_V2_ADDRESSES: Record<
  InviteEnv,
  Partial<Record<SupportedChains, Address>>
> = {
  production: {
    [SupportedChains.CELO]: "0x36829D1Cda92FFF5782d5d48991620664FC857d3",
    [SupportedChains.XDC]: "0x6bd698566632bf2e81e2278f1656CB24aAF06D2e",
  },
  development: {
    [SupportedChains.CELO]: "0x25E6E3Be62c62e2eba673426fD39Ab0209bedbfB",
    [SupportedChains.XDC]: "0xE376DAd6FAe634332B514cE8fF2aD23FBB5d82EF",
  },
}

/**
 * Normalises a `contractEnv` to the two environments supported by InvitesV2.
 * `staging` and `development` both map to `development`.
 */
export function toInviteEnv(env: contractEnv): InviteEnv {
  return env === "production" ? "production" : "development"
}

/**
 * Resolves the InvitesV2 contract address for the given environment and chain.
 *
 * `staging` is normalised to `development`. Only Celo and XDC are supported.
 *
 * @throws If no address is configured for the env/chain combination.
 */
export const resolveInvitesAddress = (
  env: contractEnv,
  chainId: SupportedChains,
): Address => {
  const effectiveEnv = toInviteEnv(env)
  const address = INVITES_V2_ADDRESSES[effectiveEnv]?.[chainId]
  if (!address) {
    throw new Error(
      `InvitesV2 address not configured for env="${env}" chainId=${chainId}. Supported chains: Celo and XDC.`,
    )
  }
  return address
}
