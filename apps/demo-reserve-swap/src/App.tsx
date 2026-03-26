import { createAppKit } from "@reown/appkit/react"
import { WagmiProvider, http } from "wagmi"
import { celo, xdc, type AppKitNetwork } from "@reown/appkit/networks"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { WagmiAdapter } from "@reown/appkit-adapter-wagmi"
import { ReserveSwap } from "./components/ReserveSwap"
import { TransactionHistory } from "./components/TransactionHistory"

const queryClient = new QueryClient()

// Prefer configuring via env (Vite exposes VITE_* vars). Keep a fallback so the
// demo works out-of-the-box in local dev.
const projectId =
  (import.meta.env.VITE_APPKIT_PROJECT_ID as string | undefined) ??
  "15372338f22e84803d4a413143c7b822" // GoodDollar public project ID

const networks: [AppKitNetwork, ...AppKitNetwork[]] = [celo, xdc]

// Override the default WalletConnect RCPs with native public endpoints
// to dramatically improve quote reliability in the demo.
const wagmiAdapter = new WagmiAdapter({
  networks,
  projectId,
  transports: {
    [celo.id]: http("https://forno.celo.org"),
    [xdc.id]: http("https://rpc.ankr.com/xdc"),
  },
})

createAppKit({
  adapters: [wagmiAdapter],
  networks,
  projectId,
  metadata: {
    name: "GoodDollar Reserve Demo",
    description: "GoodDollar Reserve Swap Integration",
    // AppKit relay strictly enforces origin matching. While testing locally, it requires
    // either the exact local origin or a valid https domain.
    url: window.location.hostname === "localhost" ? "http://localhost:5173" : "https://gooddollar.org",
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
          <TransactionHistory />
        </div>
      </QueryClientProvider>
    </WagmiProvider>
  )
}
