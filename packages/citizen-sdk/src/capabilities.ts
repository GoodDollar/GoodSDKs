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

// UI-agnostic summary for integrators building widgets or other frontends on
// top of citizen-sdk. It documents runtime requirements without prescribing a
// GoodWidget UI structure.
export const citizenSdkCapabilities = {
  sdk: "@goodsdks/citizen-sdk",
  environments: ["production", "staging", "development"],
  chains: [SupportedChains.FUSE, SupportedChains.CELO, SupportedChains.XDC],
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
      effects: ["transaction"],
    },
  ],
} as const satisfies SdkCapabilitySummary
