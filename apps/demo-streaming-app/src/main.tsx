/// <reference types="vite/client" />
import React from 'react'
import ReactDOM from 'react-dom/client'
import { http, WagmiProvider } from 'wagmi'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { createAppKit } from '@reown/appkit/react'
import { WagmiAdapter } from '@reown/appkit-adapter-wagmi'
import { celo, base } from '@reown/appkit/networks'
import App from './App'

// wagmi configuration
const projectId = import.meta.env.VITE_WALLETCONNECT_PROJECT_ID || '71dd03d057d89d0af68a4c627ec59694'

const metadata = {
    name: 'GoodDollar Streaming SDK Demo',
    description: 'Demo app for GoodDollar Superfluid Streaming SDK',
    url: 'https://gooddollar.org',
    icons: ['https://avatars.githubusercontent.com/u/42399395']
}

const networks = [celo, base] as [any, ...any[]]

const wagmiAdapter = new WagmiAdapter({
    networks,
    projectId,
    ssr: true,
    transports: {
        [42220]: http('https://forno.celo.org'),
        [8453]: http('https://mainnet.base.org'),
    }
})

createAppKit({
    adapters: [wagmiAdapter],
    networks: networks as [any, ...any[]],
    projectId,
    metadata,
    allWallets: 'HIDE',
    features: {
        analytics: false,
        allWallets: false,
        onramp: false,
        swaps: false,
        email: false,
        socials: [],
    },
})

const queryClient = new QueryClient()

ReactDOM.createRoot(document.getElementById('root')!).render(
    <React.StrictMode>
        <WagmiProvider config={wagmiAdapter.wagmiConfig}>
            <QueryClientProvider client={queryClient}>
                <App />
            </QueryClientProvider>
        </WagmiProvider>
    </React.StrictMode>
)
