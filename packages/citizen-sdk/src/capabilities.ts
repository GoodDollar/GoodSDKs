import { SupportedChains } from "./constants"

export type SdkRuntimeNeed =
  | "connectedWallet"
  | "readClient"
  | "walletClient"
  | "chainSwitching"

export type SdkEffect =
  | "signature"
  | "externalFlow"
  | "transaction"

export interface SdkCapabilityOperation {
  id: string
  method: string
  needs: readonly SdkRuntimeNeed[]
  effects?: readonly SdkEffect[]
}

export interface SdkCapabilitySummary {
  sdk: string
  environments: readonly string[]
  chains: readonly SupportedChains[]
  needs: readonly SdkRuntimeNeed[]
  reads: readonly SdkCapabilityOperation[]
  writes: readonly SdkCapabilityOperation[]
}

/**
 * Canonical citizen-sdk runtime environments for capability consumers.
 * Adapters/widgets should consume this via citizenSdkCapabilities to avoid
 * duplicating environment lists.
 */
export const CITIZEN_SDK_ENVIRONMENTS = [
  "production",
  "staging",
  "development",
] as const

/**
 * Canonical citizen-sdk supported chains for capability consumers.
 * Adapters/widgets should consume this via citizenSdkCapabilities to avoid
 * duplicating supported-chain lists.
 */
export const CITIZEN_SDK_SUPPORTED_CHAINS = [
  SupportedChains.FUSE,
  SupportedChains.CELO,
  SupportedChains.XDC,
] as const

// UI-agnostic summary for integrators building widgets or other frontends on
// top of citizen-sdk. It documents runtime requirements without prescribing a
// GoodWidget UI structure.
export const citizenSdkCapabilities = {
  sdk: "@goodsdks/citizen-sdk",
  environments: CITIZEN_SDK_ENVIRONMENTS,
  chains: CITIZEN_SDK_SUPPORTED_CHAINS,
  needs: [
    "connectedWallet",
    "readClient",
    "walletClient",
    "chainSwitching",
  ],
  reads: [
    {
      id: "whitelistStatus",
      method: "IdentitySDK.getWhitelistedRoot",
      needs: ["readClient"],
    },
    {
      id: "identityExpiry",
      method: "IdentitySDK.getIdentityExpiryData",
      needs: ["readClient"],
    },
    {
      id: "claimStatus",
      method: "ClaimSDK.getWalletClaimStatus",
      needs: ["readClient", "walletClient", "connectedWallet"],
    },
    {
      id: "claimEntitlement",
      method: "ClaimSDK.checkEntitlement",
      needs: ["readClient", "walletClient", "connectedWallet"],
    },
    {
      id: "genericClaimEntitlement",
      method: "checkGenericEntitlement",
      needs: ["readClient"],
    },
    {
      id: "dailyStats",
      method: "checkGenericDailyStats",
      needs: ["readClient"],
    },
  ],
  writes: [
    {
      id: "startVerification",
      method: "IdentitySDK.generateFVLink",
      needs: ["walletClient", "connectedWallet"],
      effects: ["signature", "externalFlow"],
    },
    {
      id: "claim",
      method: "ClaimSDK.claim",
      needs: ["walletClient", "connectedWallet"],
      effects: ["transaction", "signature", "externalFlow"],
    },
  ],
} as const satisfies SdkCapabilitySummary
