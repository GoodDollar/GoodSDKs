import { type SupportedReserveChain } from "./constants"

export type SdkRuntimeNeed =
  | "connectedWallet"
  | "readClient"
  | "walletClient"

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
  chains: readonly SupportedReserveChain[]
  needs: readonly SdkRuntimeNeed[]
  reads: readonly SdkCapabilityOperation[]
  writes: readonly SdkCapabilityOperation[]
}

/**
 * Canonical good-reserve runtime environments for capability consumers.
 * Adapters/widgets should consume this via goodReserveSdkCapabilities to avoid
 * duplicating environment lists.
 */
export const GOOD_RESERVE_SDK_ENVIRONMENTS = [
  "production",
  "staging",
  "development",
] as const

/**
 * Canonical good-reserve supported chains for capability consumers.
 * Adapters/widgets should consume this via goodReserveSdkCapabilities to avoid
 * duplicating supported-chain lists.
 */
export const GOOD_RESERVE_SDK_SUPPORTED_CHAINS = [
  "celo",
  "xdc",
] as const satisfies readonly SupportedReserveChain[]

// UI-agnostic summary for integrators building widgets or other frontends on
// top of good-reserve. It documents runtime requirements without prescribing a
// GoodWidget UI structure.
export const goodReserveSdkCapabilities = {
  sdk: "@goodsdks/good-reserve",
  environments: GOOD_RESERVE_SDK_ENVIRONMENTS,
  chains: GOOD_RESERVE_SDK_SUPPORTED_CHAINS,
  needs: [
    "connectedWallet",
    "readClient",
    "walletClient",
  ],
  reads: [
    {
      id: "buyQuote",
      method: "GoodReserveSDK.getBuyQuote",
      needs: ["readClient"],
    },
    {
      id: "sellQuote",
      method: "GoodReserveSDK.getSellQuote",
      needs: ["readClient"],
    },
    {
      id: "gdBalance",
      method: "GoodReserveSDK.getGDBalance",
      needs: ["readClient"],
    },
    {
      id: "tokenDecimals",
      method: "GoodReserveSDK.getTokenDecimals",
      needs: ["readClient"],
    },
    {
      id: "reserveStats",
      method: "GoodReserveSDK.getReserveStats",
      needs: ["readClient"],
    },
    {
      id: "transactionHistory",
      method: "GoodReserveSDK.getTransactionHistory",
      needs: ["readClient", "connectedWallet"],
    },
  ],
  writes: [
    {
      id: "buy",
      method: "GoodReserveSDK.buy",
      needs: ["walletClient", "connectedWallet"],
      effects: ["transaction"],
    },
    {
      id: "sell",
      method: "GoodReserveSDK.sell",
      needs: ["walletClient", "connectedWallet"],
      effects: ["transaction"],
    },
  ],
} as const satisfies SdkCapabilitySummary
