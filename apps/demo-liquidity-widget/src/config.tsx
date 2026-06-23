import { createAppKit } from "@reown/appkit/react"
import { http, WagmiProvider } from "wagmi"
import { celo, type AppKitNetwork } from "@reown/appkit/networks"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { WagmiAdapter } from "@reown/appkit-adapter-wagmi"
import React, { ReactNode } from "react"

const queryClient = new QueryClient()

const projectId = "71dd03d057d89d0af68a4c627ec59694"

const metadata = {
  name: "GoodDollar Liquidity Demo",
  description: "Demo for the @goodsdks/liquidity-widget web component",
  url: "https://example.com",
  icons: ["https://avatars.githubusercontent.com/u/179229932"],
}

// The G$/USDGLO pool lives on Celo, so we restrict the demo to that network.
const networks: [AppKitNetwork, ...AppKitNetwork[]] = [celo]

const wagmiAdapter = new WagmiAdapter({
  networks,
  projectId,
  ssr: true,
  transports: {
    [celo.id]: http("https://forno.celo.org"),
  },
})

createAppKit({
  adapters: [wagmiAdapter],
  networks,
  projectId,
  metadata,
  features: {
    analytics: true,
  },
  themeMode: "light",
  themeVariables: {
    "--w3m-color-mix": "#00BB7F",
    "--w3m-color-mix-strength": 40,
    "--w3m-accent": "#00BB7F",
  },
})

type ComponentProps = {
  children: ReactNode
}

export const AppKitProvider: React.FC<ComponentProps> = ({ children }) => {
  return (
    <WagmiProvider config={wagmiAdapter.wagmiConfig}>
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    </WagmiProvider>
  )
}
