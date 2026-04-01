import { useState } from "react"
import { useAccount } from "wagmi"
import { WagmiProvider } from "./config"
import { BridgeForm } from "./components/BridgeForm"
import { TransactionHistory } from "./components/TransactionHistory"
import type { BridgeProtocol } from "@goodsdks/bridging-sdk"

function AppContent() {
  const { isConnected } = useAccount()
  const [selectedProtocol, setSelectedProtocol] =
    useState<BridgeProtocol>("LAYERZERO")

  return (
    <div className="min-h-screen bg-slate-50 pb-20">
      {/* Premium Header */}
      <header className="pt-16 pb-12 text-center px-4">
        <h1 className="text-5xl font-extrabold text-slate-900 mb-4 tracking-tight">
          Main Bridge
        </h1>
        <p className="text-slate-500 max-w-2xl mx-auto text-lg leading-relaxed">
          Seamlessly convert between Fuse G$ tokens to Celo and vice versa,
          enabling versatile use of G$ tokens across various platforms and
          ecosystems.
        </p>
      </header>

      {/* Main Content Area */}
      <main className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
        {!isConnected ? (
          <div className="premium-card text-center p-12">
            <div className="w-20 h-20 bg-blue-50 rounded-3xl flex items-center justify-center mx-auto mb-8">
              <svg
                className="w-10 h-10 text-blue-600"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"
                />
              </svg>
            </div>
            <h2 className="text-2xl font-bold mb-4 text-slate-900">
              Connect Your Wallet
            </h2>
            <p className="text-slate-500 mb-10 text-lg">
              To start bridging G$ tokens across chains, please connect your
              wallet first.
            </p>
            <div className="flex justify-center">
              <w3m-button />
            </div>
          </div>
        ) : (
          <div className="space-y-12">
            {/* Integrated Bridge Section */}
            <div className="premium-card">
              <div className="mb-10 text-center">
                <h2 className="text-slate-600 font-semibold mb-6 flex items-center justify-center gap-2">
                  Select Bridge Provider
                </h2>
                <div className="flex p-1.5 bg-slate-50 rounded-2xl border border-slate-100 max-w-sm mx-auto">
                  <button
                    onClick={() => setSelectedProtocol("AXELAR")}
                    className={`flex-1 py-3 px-6 rounded-xl font-bold transition-all duration-300 ${
                      selectedProtocol === "AXELAR"
                        ? "bg-white text-blue-600 shadow-md"
                        : "text-slate-400 hover:text-slate-600"
                    }`}
                  >
                    Axelar
                  </button>
                  <button
                    onClick={() => setSelectedProtocol("LAYERZERO")}
                    className={`flex-1 py-3 px-6 rounded-xl font-bold transition-all duration-300 ${
                      selectedProtocol === "LAYERZERO"
                        ? "bg-white text-blue-600 shadow-md"
                        : "text-slate-400 hover:text-slate-600"
                    }`}
                  >
                    LayerZero
                  </button>
                </div>
              </div>

              {/* Enhanced Bridge Form */}
              <BridgeForm defaultProtocol={selectedProtocol} />
            </div>

            {/* Recent Transactions Section */}
            <div>
              <h2 className="text-3xl font-bold text-slate-900 mb-8 px-2">
                Recent Transactions
              </h2>
              <TransactionHistory />
            </div>
          </div>
        )}
      </main>

      {/* Simple Premium Footer */}
      <footer className="mt-24 py-12 border-t border-slate-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col md:flex-row justify-between items-center gap-8">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 bg-blue-600 rounded-lg"></div>
              <span className="font-bold text-slate-900">
                GoodDollar Bridge
              </span>
            </div>
            <div className="flex gap-10">
              <a
                href="https://docs.gooddollar.org"
                target="_blank"
                rel="noopener"
                className="text-slate-500 hover:text-blue-600 transition-colors font-medium"
              >
                Docs
              </a>
              <a
                href="https://github.com/GoodDollar"
                target="_blank"
                rel="noopener"
                className="text-slate-500 hover:text-blue-600 transition-colors font-medium"
              >
                GitHub
              </a>
              <a
                href="#"
                className="text-slate-500 hover:text-blue-600 transition-colors font-medium"
              >
                Terms
              </a>
            </div>
            <p className="text-slate-400 text-sm">© 2024 GoodDollar SDKs</p>
          </div>
        </div>
      </footer>
    </div>
  )
}

function App() {
  return (
    <WagmiProvider>
      <AppContent />
    </WagmiProvider>
  )
}

export default App
