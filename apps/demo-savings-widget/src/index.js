import "@goodsdks/savings-widget"

const savingsWidget = document.getElementById("savingsWidget")
const walletStatus = document.getElementById("walletStatus")
const connectWalletButton = document.getElementById("connectWalletButton")

const getProvider = () => window.ethereum ?? null

const updateWalletStatus = async () => {
  const provider = getProvider()
  if (!provider?.request) {
    walletStatus.textContent = "No injected wallet found (install MetaMask or Valora extension)"
    connectWalletButton.disabled = true
    connectWalletButton.style.opacity = "0.6"
    return
  }

  const accounts = await provider.request({ method: "eth_accounts" })
  if (accounts?.length) {
    const [account] = accounts
    walletStatus.textContent = `Connected: ${account.slice(0, 6)}...${account.slice(-4)}`
    savingsWidget.web3Provider = provider
  } else {
    walletStatus.textContent = "Wallet not connected"
    savingsWidget.web3Provider = null
  }
}

const connectWallet = async () => {
  const provider = getProvider()
  if (!provider?.request) {
    walletStatus.textContent = "No injected wallet found (install MetaMask or Valora extension)"
    return
  }

  try {
    await provider.request({ method: "eth_requestAccounts" })
    await updateWalletStatus()
  } catch (error) {
    console.error("Wallet connection failed:", error)
    walletStatus.textContent = "Wallet connection was rejected"
  }
}

customElements.whenDefined("gooddollar-savings-widget").then(async () => {
  savingsWidget.connectWallet = connectWallet
  connectWalletButton.addEventListener("click", connectWallet)

  const provider = getProvider()
  provider?.on?.("accountsChanged", () => {
    updateWalletStatus().catch(console.error)
  })
  provider?.on?.("chainChanged", () => {
    updateWalletStatus().catch(console.error)
  })

  await updateWalletStatus()
})
