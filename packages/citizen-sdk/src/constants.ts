import { parseAbi } from "viem"

export const FV_IDENTIFIER_MSG2 = `Sign this message to request verifying your account <account> and to create your own secret unique identifier for your anonymized record.
You can use this identifier in the future to delete this anonymized record.
WARNING: do not sign this message unless you trust the website/application requesting this signature.`

export type contractEnv = "production" | "staging" | "development"

export const Envs: Record<string, Record<string, string>> = {
  production: {
    dappUrl: "https://wallet.gooddollar.org",
    identityUrl: "https://goodid.gooddollar.org",
    backend: "https://goodserver.gooddollar.org",
    goodCollectiveUrl: "https://goodcollective.vercel.app/",
  },
  staging: {
    dappUrl: "https://qa.gooddollar.org",
    identityUrl: "https://goodid-qa.vercel.app",
    backend: "https://goodserver-qa.herokuapp.com",
    goodCollectiveUrl: "https://dev-goodcollective.vercel.app/",
  },
  development: {
    dappUrl: "https://dev.gooddollar.org",
    identityUrl: "https://goodid-dev.vercel.app",
    backend: "https://good-server.herokuapp.com",
    goodCollectiveUrl: "https://dev-goodcollective.vercel.app/",
  },
}

/**
 * Farcaster Mini App configurations for different environments
 * You need to replace these with your actual Farcaster app IDs and slugs from the Farcaster Developer Portal
 */
export const FarcasterAppConfigs: Record<string, { appId: string; appSlug: string }> = {
  production: {
    appId: "your-production-app-id", // Replace with actual app ID from Farcaster Developer Portal
    appSlug: "gooddollar-identity", // Replace with actual app slug
  },
  staging: {
    appId: "your-staging-app-id", // Replace with actual app ID from Farcaster Developer Portal
    appSlug: "gooddollar-identity-staging", // Replace with actual app slug
  },
  development: {
    appId: "your-development-app-id", // Replace with actual app ID from Farcaster Developer Portal
    appSlug: "gooddollar-identity-dev", // Replace with actual app slug
  },
}

export interface ContractAddresses {
  identityContract: `0x${string}`
  ubiContract: `0x${string}`
  faucetContract: `0x${string}`
  g$Contract: `0x${string}`
}

export enum SupportedChains {
  "FUSE" = 122,
  "CELO" = 42220,
  "XDC" = 50,
}

export type SupportedChainId = `${SupportedChains}` extends infer _
  ? SupportedChains
  : SupportedChains

export interface ChainConfig {
  id: SupportedChains
  key: keyof typeof SupportedChains
  label: string
  shortName: string
  explorer: {
    address: (address: string) => string
    tx: (hash: string) => string
  }
  rpcUrls: string[]
  defaultGasPrice?: bigint
  claimGasBuffer: bigint
  fvDefaultChain?: SupportedChains
  contracts: Partial<Record<contractEnv, ContractAddresses>>
}

export const FALLBACK_CHAIN_PRIORITY: readonly SupportedChains[] = [
  SupportedChains.CELO,
  SupportedChains.XDC,
  SupportedChains.FUSE,
]

export const CHAIN_DECIMALS: Record<SupportedChains, number> = {
  [SupportedChains.FUSE]: 2,
  [SupportedChains.CELO]: 18,
  [SupportedChains.XDC]: 18,
}

const makeExplorer = (baseUrl: string) => ({
  address: (address: string) => `${baseUrl}/address/${address}`,
  tx: (hash: string) => `${baseUrl}/tx/${hash}`,
})

export const chainConfigs: Record<SupportedChains, ChainConfig> = {
  [SupportedChains.FUSE]: {
    id: SupportedChains.FUSE,
    key: "FUSE",
    label: "Fuse",
    shortName: "Fuse",
    explorer: makeExplorer("https://explorer.fuse.io"),
    rpcUrls: ["https://rpc.fuse.io", "https://fuse-rpc.gateway.pokt.network"],
    defaultGasPrice: BigInt(11e9),
    claimGasBuffer: 150000n,
    fvDefaultChain: SupportedChains.CELO,
    contracts: {
      production: {
        identityContract: "0x2F9C28de9e6d44b71B91b8BA337A5D82e308E7BE",
        ubiContract: "0xd253A5203817225e9768C05E5996d642fb96bA86",
        faucetContract: "0x01ab5966C1d742Ae0CFF7f14cC0F4D85156e83d9",
        g$Contract: "0x495d133B938596C9984d462F007B676bDc57eCEC",
      },
      staging: {
        identityContract: "0xb0cD4828Cc90C5BC28f4920Adf2Fd8F025003D7E",
        ubiContract: "0x54469071Ca82B46A2C01C09D38ca6Ca4347EB21d",
        faucetContract: "0x70f361EDB97B245E8A68573637A31886A427fe2a",
        g$Contract: "0xe39236a9Cf13f65DB8adD06BD4b834C65c523d2b",
      },
      development: {
        identityContract: "0x1e006225cff7d37411db28f652e0Da9D20325eBb",
        ubiContract: "0x3bdeB796950301FfC9568fAF89B7370f8B217321",
        faucetContract: "0x09Ad3430D146aa662eA8c20cBEBceBC0bbB3FB0a",
        g$Contract: "0x79BeecC4b165Ccf547662cB4f7C0e83b3796E5b3",
      },
    },
  },
  [SupportedChains.CELO]: {
    id: SupportedChains.CELO,
    key: "CELO",
    label: "Celo",
    shortName: "Celo",
    explorer: makeExplorer("https://celoscan.io"),
    rpcUrls: ["https://forno.celo.org", "https://rpc.ankr.com/celo"],
    defaultGasPrice: BigInt(25.001e9),
    claimGasBuffer: 250000n,
    fvDefaultChain: SupportedChains.CELO,
    contracts: {
      production: {
        identityContract: "0xC361A6E67822a0EDc17D899227dd9FC50BD62F42",
        ubiContract: "0x43d72Ff17701B2DA814620735C39C620Ce0ea4A1",
        faucetContract: "0x4F93Fa058b03953C851eFaA2e4FC5C34afDFAb84",
        g$Contract: "0x62B8B11039FcfE5aB0C56E502b1C372A3d2a9c7A",
      },
      staging: {
        identityContract: "0x0108BBc09772973aC27983Fc17c7D82D8e87ef4D",
        ubiContract: "0x2881d417dA066600372753E73A3570F0781f18cB",
        faucetContract: "0x9A0F8AEc626A0f493941Ceb1dA6021cFB0567293",
        g$Contract: "0x61FA0fB802fd8345C06da558240E0651886fec69",
      },
      development: {
        identityContract: "0xF25fA0D4896271228193E782831F6f3CFCcF169C",
        ubiContract: "0x6B86F82293552C3B9FE380FC038A89e0328C7C5f",
        faucetContract: "0x635b420e95b364def3A031166dA4bC4F57bf9dEB",
        g$Contract: "0xFa51eFDc0910CCdA91732e6806912Fa12e2FD475",
      },
    },
  },
  [SupportedChains.XDC]: {
    id: SupportedChains.XDC,
    key: "XDC",
    label: "XDC Network",
    shortName: "XDC",
    explorer: makeExplorer("https://xdcscan.com"),
    // rpcUrls: ["https://rpc.xdc.network", "https://rpc.ankr.com/xdc"],
    rpcUrls: ["https://rpc.ankr.com/xdc"],
    defaultGasPrice: BigInt(12.5e9),
    claimGasBuffer: 150000n,
    fvDefaultChain: SupportedChains.XDC,
    contracts: {
      development: {
        identityContract: "0xa6632e9551A340E8582cc797017fbA645695E29f",
        ubiContract: "0xA2619D468EfE2f6D8b3D915B999327C8fE13aE2c",
        faucetContract: "0x5CE5e22329914F3317B770184a405E91ef72e489",
        g$Contract: "0xA13625A72Aef90645CfCe34e25c114629d7855e7",
      },
    },
  },
}

const chainIds = Object.values(SupportedChains).filter(
  (value): value is SupportedChains => typeof value === "number",
)

const chainIdSet = new Set<SupportedChains>(chainIds)

export const SUPPORTED_CHAIN_IDS = chainIds

export const isSupportedChain = (
  chainId: number | undefined,
): chainId is SupportedChains =>
  typeof chainId === "number" && chainIdSet.has(chainId as SupportedChains)

export const createRpcUrlIterator = (chainId: SupportedChains) => {
  const urls = [...(chainConfigs[chainId]?.rpcUrls ?? [])]
  if (!urls.length) {
    throw new Error(`No RPC URLs configured for chain ${chainId}`)
  }

  let index = 0
  return () => {
    const url = urls[index]
    index = (index + 1) % urls.length
    return url
  }
}

export const identityV2ABI = parseAbi([
  "function addWhitelisted(address account)",
  "function removeWhitelisted(address account)",
  "function getWhitelistedRoot(address account) view returns (address)",
  "function lastAuthenticated(address account) view returns (uint256)",
  "function authenticationPeriod() view returns (uint256)",
])

// ABI for the UBISchemeV2 contract for essential functions and events
export const ubiSchemeV2ABI = parseAbi([
  "function claim() returns (bool)",
  "function checkEntitlement(address _member) view returns (uint256)",
  "function getDailyStats() view returns (uint256 claimers, uint256 amount)",
  "function periodStart() view returns (uint256)",
  "function currentDay() view returns (uint256)",
  "event UBIClaimed(address indexed account, uint256 amount)",
])

export const faucetABI = parseAbi([
  "function minTopping() view returns (uint8)",
  "function getToppingAmount() view returns (uint256)",
  "function canTop(address _user) view returns (bool)",
])

export const g$ABI = parseAbi([
  "function balanceOf(address account) view returns (uint256)",
])
