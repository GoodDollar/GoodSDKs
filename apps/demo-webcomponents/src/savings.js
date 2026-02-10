import '@goodsdks/savings-widget'
import { createAppKit } from '@reown/appkit'
import { WagmiAdapter } from '@reown/appkit-adapter-wagmi'
import { celo, celoAlfajores } from '@reown/appkit/networks'

console.log('Initializing AppKit for Savings Widget...')

const wagmiAdapter = new WagmiAdapter({
    networks: [celo, celoAlfajores],
    projectId: '71dd03d057d89d0af68a4c627ec59694'
})

const appKit = createAppKit({
    adapters: [wagmiAdapter],
    networks: [celo, celoAlfajores],
    defaultNetwork: celo,
    projectId: '71dd03d057d89d0af68a4c627ec59694',
    metadata: {
        name: 'GoodDollar Savings Test',
        description: 'Testing savings widget allowance bug',
        url: 'https://gooddollar.org',
        icons: ['https://avatars.githubusercontent.com/u/179229932']
    },
    features: {
        analytics: false
    }
})

console.log('AppKit created:', appKit)

customElements.whenDefined('gooddollar-savings-widget').then(() => {
    const savingsWidget = document.getElementById('savingsWidget')

    if (!savingsWidget) {
        console.error('Savings widget element not found in DOM!')
        return
    }

    savingsWidget.connectWallet = () => {
        appKit.open()
    }

    appKit.subscribeAccount((accountState) => {
        const isConnected = !!accountState?.isConnected
        console.log('Account state changed:', { isConnected, accountState })

        if (isConnected) {
            const provider = appKit.getProvider?.('eip155') || appKit.getWalletProvider?.()
            console.log('Setting provider:', provider)

            // The widget expects the provider to have an 'isConnected' property
            // We wrap it to ensure compatibility
            const compatibleProvider = new Proxy(provider, {
                get(target, prop) {
                    if (prop === 'isConnected') return true
                    const value = target[prop]
                    return typeof value === 'function' ? value.bind(target) : value
                }
            })

            savingsWidget.web3Provider = compatibleProvider
        } else {
            console.log('Disconnected, clearing provider')
            savingsWidget.web3Provider = null
        }
    }, 'eip155')

    console.log('Savings widget configured successfully')
}).catch(err => {
    console.error('Error with savings widget custom element:', err)
})
