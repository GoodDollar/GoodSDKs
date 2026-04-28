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
}

export interface SavingsChainConfig {
  id: SupportedChainId
  label: string
  chain: Chain
  contracts: SavingsContracts
}

/**
 * Default contract addresses per supported chain.
 *
 * NOTE: the XDC staking contract has not been deployed at the time of writing.
 * Integrators that want to enable XDC staking before the official deployment
 * can override this address through the SDK / widget `contracts` option.
 */
const ZERO_ADDRESS = "0x0000000000000000000000000000000000000000" as const

export const DEFAULT_SAVINGS_CHAIN_CONFIG: Record<
  SupportedChainId,
  SavingsChainConfig
> = {
  [SupportedChainId.CELO]: {
    id: SupportedChainId.CELO,
    label: "Celo",
    chain: celo,
    contracts: {
      staking: "0x799a23dA264A157Db6F9c02BE62F82CE8d602A45",
      gdollar: "0x62B8B11039FcfE5aB0C56E502b1C372A3d2a9c7A",
    },
  },
  [SupportedChainId.XDC]: {
    id: SupportedChainId.XDC,
    label: "XDC Network",
    chain: xdc,
    contracts: {
      staking: "0xeecce52295e907d3A7Da92d69EFF9a2B3f04700B",
      gdollar: "0xEC2136843a983885AebF2feB3931F73A8eBEe50c",
    },
  },
}

export const getSavingsChainConfig = (
  chainId: number | undefined,
): SavingsChainConfig | undefined => {
  if (!isSupportedChainId(chainId)) return undefined
  return DEFAULT_SAVINGS_CHAIN_CONFIG[chainId]
}

export const formatSupportedNetworkList = (): string =>
  SUPPORTED_CHAIN_IDS.map((id) => DEFAULT_SAVINGS_CHAIN_CONFIG[id].label).join(
    " or ",
  )

/**
 * Error thrown when the SDK is initialised with a client connected to a chain
 * that is not in {@link SUPPORTED_CHAIN_IDS}.
 */
export class UnsupportedChainError extends Error {
  readonly chainId: number | undefined
  constructor(chainId: number | undefined) {
    super(
      `Unsupported chain ${chainId ?? "<unknown>"}. Connect to ${formatSupportedNetworkList()}.`,
    )
    this.name = "UnsupportedChainError"
    this.chainId = chainId
  }
}
