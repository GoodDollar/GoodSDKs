import { createAppKit } from "@reown/appkit/react"
import { WagmiProvider } from "wagmi"
import { celo, xdc, type AppKitNetwork } from "@reown/appkit/networks"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { WagmiAdapter } from "@reown/appkit-adapter-wagmi"
import { ReserveSwap } from "./components/ReserveSwap"

const queryClient = new QueryClient()

// Prefer configuring via env (Vite exposes VITE_* vars). Keep a fallback so the
// demo works out-of-the-box in local dev.
const projectId =
  (import.meta.env.VITE_APPKIT_PROJECT_ID as string | undefined) ??
  "15372338f22e84803d4a413143c7b822" // GoodDollar public project ID

const networks: [AppKitNetwork, ...AppKitNetwork[]] = [celo, xdc]

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
        <div className="app-container">
          <div className="header">
            <h1>GoodDollar Reserve Swap</h1>
            <p>Connect a wallet on Celo or XDC to interact with the reserve.</p>
          </div>

          <div className="connect-wrapper">
            <appkit-button />
          </div>

          <ReserveSwap />
        </div>
      </QueryClientProvider>
    </WagmiProvider>
  )
}
