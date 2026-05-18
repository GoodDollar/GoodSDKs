import { celo, xdc, type Chain } from "viem/chains"

/**
 * Chains where the GoodDollar Savings (G$ Staking) flow is supported.
 *
 * The widget and SDK validate that both the public and wallet clients are
 * connected to one of these chains. Anything else is treated as a "wrong
 * network" error so callers can prompt the user to switch.
 */
export enum SupportedChainId {
  CELO = 42220,
  XDC = 50,
}

export const SUPPORTED_CHAIN_IDS: SupportedChainId[] = [
  SupportedChainId.CELO,
  SupportedChainId.XDC,
]

export const isSupportedChainId = (
  chainId: number | undefined,
): chainId is SupportedChainId =>
  typeof chainId === "number" &&
  SUPPORTED_CHAIN_IDS.includes(chainId as SupportedChainId)

export interface SavingsContracts {
  /** GoodDollarStaking proxy used to stake G$ and claim rewards. */
  staking: `0x${string}`
  /** G$ ERC-20 (or SuperGoodDollar) token contract. */
  gdollar: `0x${string}`
  /**
   * Superfluid Host. Required on streaming chains; the SDK bundles
   * approve / pool connect / stake calls through `host.batchCall`.
   */
  superfluidHost?: `0x${string}`
  /**
   * Superfluid GDA Forwarder. Required on streaming chains to connect
   * the user to the GDA pool that distributes streaming rewards.
   */
  gdaForwarder?: `0x${string}`
}

export interface SavingsChainConfig {
  id: SupportedChainId
  label: string
  chain: Chain
  isStreaming: boolean // whether this chain uses Superfluid streaming rewards
  contracts: SavingsContracts
}

// Default contract addresses per supported chain.
export const SAVINGS_CHAIN_CONFIG: Record<
  SupportedChainId,
  SavingsChainConfig
> = {
  [SupportedChainId.CELO]: {
    id: SupportedChainId.CELO,
    label: "Celo",
    chain: celo,
    isStreaming: true,
    contracts: {
      staking: "0x059ee811414230d1Fb157878D2b491240F4D8d3B",
      gdollar: "0x62B8B11039FcfE5aB0C56E502b1C372A3d2a9c7A",
      superfluidHost: "0xA4Ff07cF81C02CFD356184879D953970cA957585",
      gdaForwarder: "0x308b7405272d11494716e30C6E972DbF6fb89555",
    },
  },
  [SupportedChainId.XDC]: {
    id: SupportedChainId.XDC,
    label: "XDC",
    chain: xdc,
    isStreaming: false,
    contracts: {
      staking: "0x61a1Da2a81FbaE6b1B3A45D94355A6A5c5973A52",
      gdollar: "0xEC2136843a983885AebF2feB3931F73A8eBEe50c",
    },
  },
}

export function getSavingsChainConfig(chainId: number): SavingsChainConfig | undefined {
  if (!isSupportedChainId(chainId)) {
    return undefined
  }
  return SAVINGS_CHAIN_CONFIG[chainId]
}

/**
 * Error thrown when the SDK is initialised with a client connected to a chain
 * that is not in {@link SUPPORTED_CHAIN_IDS}.
 */
export class UnsupportedChainError extends Error {
  readonly chainId: number | undefined
  constructor(chainId: number | undefined) {
    super(
      `Unsupported chain ${chainId ?? "<unknown>"}.`,
    )
    this.name = "UnsupportedChainError"
    this.chainId = chainId
  }
}
