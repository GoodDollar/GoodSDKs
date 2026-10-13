import { createAppKit } from "@reown/appkit/react"
import {
  WagmiProvider as WagmiProviderOriginal,
  createConfig,
  http,
} from "wagmi"
import { injected } from "wagmi/connectors"
import { createPublicClient, http as viemHttp } from "viem"
import { celo, mainnet, fuse, xdc } from "viem/chains"
import type { BridgingSDK, BridgingSDKOptions } from "@goodsdks/bridging-sdk"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { WagmiAdapter } from "@reown/appkit-adapter-wagmi"
import { ReactNode } from "react"

const queryClient = new QueryClient()
export const bridgingOptions: BridgingSDKOptions = {
  corsProxyApiKey: import.meta.env.VITE_CORSPROXY_API_KEY,
}

// Optional: injected wallets and read-only previews work without a Reown project.
const projectId = import.meta.env.VITE_REOWN_PROJECT_ID?.trim()
export const appKitEnabled = Boolean(projectId)
const rpcUrls = {
  [celo.id]: import.meta.env.VITE_CELO_RPC_URL || "https://forno.celo.org",
  [mainnet.id]:
    import.meta.env.VITE_ETHEREUM_RPC_URL ||
    "https://ethereum-rpc.publicnode.com",
  [fuse.id]: import.meta.env.VITE_FUSE_RPC_URL || "https://rpc.fuse.io",
  [xdc.id]: import.meta.env.VITE_XDC_RPC_URL || "https://rpc.xdcrpc.com",
}

// 2. Create a metadata object - optional
const metadata = {
  name: "GoodDollar Bridge Demo",
  description: "Demo app for GoodDollar cross-chain bridging",
  url: window.location.origin,
  icons: [],
}

// 3. Set the networks
const networks = [celo, mainnet, fuse, xdc] as const
const appKitNetworks = [...networks] as unknown as Parameters<
  typeof createAppKit
>[0]["networks"]
const transports = {
  [celo.id]: http(rpcUrls[celo.id]),
  [mainnet.id]: http(rpcUrls[mainnet.id]),
  [fuse.id]: http(rpcUrls[fuse.id]),
  [xdc.id]: http(rpcUrls[xdc.id]),
}

// 4. Create Wagmi Adapter
const wagmiAdapter = projectId
  ? new WagmiAdapter({
      networks: appKitNetworks,
      projectId,
      ssr: true,
      transports,
    })
  : null
const wagmiConfig =
  wagmiAdapter?.wagmiConfig ??
  createConfig({
    chains: networks,
    connectors: [injected()],
    transports,
  })

// 5. Create modal
if (wagmiAdapter && projectId)
  createAppKit({
    adapters: [wagmiAdapter],
    networks: appKitNetworks,
    metadata,
    projectId,
    features: {
      analytics: false,
      email: false,
      socials: [],
      emailShowWallets: false,
    },
  })

type ComponentProps = {
  children: ReactNode
}

export function WagmiProvider({ children }: ComponentProps) {
  return (
    <WagmiProviderOriginal config={wagmiConfig}>
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    </WagmiProviderOriginal>
  )
}

export { wagmiAdapter }

type SDKPublicClient = ConstructorParameters<typeof BridgingSDK>[0]
export const publicClients: Record<number, SDKPublicClient> = {
  [celo.id]: createPublicClient({
    chain: celo,
    transport: viemHttp(rpcUrls[celo.id]),
  }) as unknown as SDKPublicClient,
  [mainnet.id]: createPublicClient({
    chain: mainnet,
    transport: viemHttp(rpcUrls[mainnet.id]),
  }) as unknown as SDKPublicClient,
  [fuse.id]: createPublicClient({
    chain: fuse,
    transport: viemHttp(rpcUrls[fuse.id]),
  }) as unknown as SDKPublicClient,
  [xdc.id]: createPublicClient({
    chain: xdc,
    transport: viemHttp(rpcUrls[xdc.id]),
  }) as unknown as SDKPublicClient,
}
