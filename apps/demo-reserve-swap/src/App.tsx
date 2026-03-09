import { createAppKit } from "@reown/appkit/react"
import { WagmiProvider } from "wagmi"
import { celo, type AppKitNetwork } from "@reown/appkit/networks"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { WagmiAdapter } from "@reown/appkit-adapter-wagmi"
import { ReserveSwap } from "./components/ReserveSwap"

const queryClient = new QueryClient()

const projectId = "15372338f22e84803d4a413143c7b822" // GoodDollar public project ID

const networks: [AppKitNetwork, ...AppKitNetwork[]] = [celo]

const wagmiAdapter = new WagmiAdapter({
  networks,
  projectId,
})

createAppKit({
  adapters: [wagmiAdapter],
  networks,
  projectId,
  metadata: {
    name: "GoodDollar Reserve Demo",
    description: "GoodDollar Reserve Swap Integration",
    url: "https://gooddollar.org",
    icons: ["https://gooddollar.org/favicon.ico"],
  },
  features: {
    analytics: false,
  },
})

export function App() {
  return (
    <WagmiProvider config={wagmiAdapter.wagmiConfig}>
      <QueryClientProvider client={queryClient}>
        <div style={{ padding: "40px", fontFamily: "sans-serif", maxWidth: "600px", margin: "0 auto" }}>
          <h1>GoodDollar Reserve Swap</h1>
          <p style={{ marginBottom: "24px", color: "#666" }}>
            Connect a wallet on Celo mainnet to interact with the reserve.
          </p>

          <div style={{ marginBottom: "32px" }}>
            <appkit-button />
          </div>

          <ReserveSwap />
        </div>
      </QueryClientProvider>
    </WagmiProvider>
  )
}
