import { createAppKit } from "@reown/appkit/react"
import { WagmiProvider as WagmiProviderOriginal, http } from "wagmi"
import { celo, mainnet, fuse, xdc } from "@reown/appkit/networks"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { WagmiAdapter } from "@reown/appkit-adapter-wagmi"
import { ReactNode } from "react"

const queryClient = new QueryClient()

// 1. Get projectId from https://cloud.reown.com
const projectId = "71dd03d057d89d0af68a4c627ec59694"

// 2. Create a metadata object - optional
const metadata = {
  name: "GoodDollar Bridge Demo",
  description: "Demo app for GoodDollar cross-chain bridging",
  url: "https://demo-bridging-app.vercel.app",
  icons: ["https://demo-bridging-app.vercel.app/icon.png"],
}

// 3. Set the networks
const networks = [celo, mainnet, fuse, xdc] as any

// 4. Create Wagmi Adapter
const wagmiAdapter = new WagmiAdapter({
  networks,
  projectId,
  ssr: true,
  transports: {
    [celo.id]: http("https://forno.celo.org"),
    [mainnet.id]: http("https://eth.llamarpc.com"),
    [fuse.id]: http("https://rpc.fuse.io"),
    [xdc.id]: http("https://rpc.xdcrpc.com"),
  },
})

// 5. Create modal
createAppKit({
  adapters: [wagmiAdapter],
  networks: networks as any,
  metadata,
  projectId,
  features: {
    analytics: true, // Optional - defaults to your Cloud configuration
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
    <WagmiProviderOriginal config={wagmiAdapter.wagmiConfig}>
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    </WagmiProviderOriginal>
  )
}

export { wagmiAdapter }
