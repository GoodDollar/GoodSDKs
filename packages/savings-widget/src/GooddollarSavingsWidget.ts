import { LitElement, html, css } from "lit"
import { customElement, property, state } from "lit/decorators.js"
import {
  createWalletClient,
  createPublicClient,
  custom,
  PublicClient,
  WalletClient,
  http,
  formatEther,
  parseEther,
} from "viem"
import { celo, xdc, type Chain } from "viem/chains"
import {
  GooddollarSavingsSDK,
  SUPPORTED_CHAIN_IDS,
  SupportedChainId,
  formatSupportedNetworkList,
  isSupportedChainId,
} from "@goodsdks/savings-sdk"

type AnyEip1193Provider = {
  isConnected?: () => boolean
  request: (args: { method: string; params?: unknown[] }) => Promise<unknown>
  on?: (event: string, handler: (...args: unknown[]) => void) => void
  removeListener?: (
    event: string,
    handler: (...args: unknown[]) => void,
  ) => void
}

const CHAIN_BY_ID: Record<SupportedChainId, Chain> = {
  [SupportedChainId.CELO]: celo,
  [SupportedChainId.XDC]: xdc,
}

const CHAIN_LABEL: Record<SupportedChainId, string> = {
  [SupportedChainId.CELO]: "Celo",
  [SupportedChainId.XDC]: "XDC Network",
}

@customElement("gooddollar-savings-widget")
export class GooddollarSavingsWidget extends LitElement {
  static styles = css`
    :host {
      display: block;
      font-family:
        -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
      max-width: 480px;
      margin: 0 auto;
    }

    .container {
      background: white;
      border-radius: 16px;
      padding: 24px;
      box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
      border: 1px solid #e5e7eb;
      position: relative;
    }

    .header {
      display: flex;
      align-items: center;
      gap: 12px;
      margin-bottom: 24px;
    }

    .logo {
      width: 48px;
      height: 48px;
      background-color: white;
      display: flex;
      align-items: center;
      justify-content: center;
    }
    .logo img {
      width: 44px;
      height: 44px;
      box-shadow: rgba(0, 0, 0, 0.075) 0px 6px 10px;
      border-radius: 50%;
      background-color: white;
    }

    .title {
      font-size: 24px;
      font-weight: 600;
      color: #111827;
      margin: 0;
    }

    .tab-container {
      display: flex;
      background: #f9fafb;
      border-radius: 12px;
      padding: 4px;
      margin-bottom: 16px;
      border: 1px solid #e5e7eb;
    }

    .tab {
      flex: 1;
      padding: 10px 16px;
      border: none;
      background: transparent;
      border-radius: 8px;
      font-size: 16px;
      font-weight: 500;
      cursor: pointer;
      transition: all 0.2s ease;
      color: #6b7280;
    }

    .tab.active {
      background: #00b0ff;
      color: #ffffff;
      box-shadow: 0 2px 4px rgba(0, 0, 0, 0.2);
    }

    .input-section {
      background: #f9fafb;
      border-radius: 12px;
      padding: 16px;
      margin-bottom: 16px;
      border: 1px solid #e5e7eb;
    }

    .balance-info {
      display: flex;
      justify-content: flex-end;
      align-items: center;
      margin-bottom: 12px;
      font-size: 14px;
      color: #6b7280;
    }

    .input-container {
      display: flex;
      align-items: center;
      gap: 12px;
    }

    .amount-input {
      flex: 1;
      border: none;
      background: transparent;
      font-size: 24px;
      font-weight: 600;
      color: #111827;
      outline: none;
    }

    .max-button {
      background: #ffffff;
      border-radius: 8px;
      padding: 6px 12px;
      font-size: 12px;
      font-weight: 400;
      color: #374151;
      border: 1px solid #374151;
      cursor: pointer;
      transition: background-color 0.2s ease;
    }

    .max-button:hover {
      border: 1px solid #00b0ff;
      color: #00b0ff;
    }

    .rewards-section {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 16px;
      padding: 0 4px;
    }

    .rewards-label {
      font-size: 16px;
      color: #374151;
    }

    .rewards-value {
      display: flex;
      align-items: center;
      gap: 8px;
    }

    .claim-button {
      background: none;
      border: none;
      color: #0387c3;
      font-size: 16px;
      font-weight: 600;
      text-decoration: underline;
      cursor: pointer;
      padding: 0;
    }

    .main-button {
      width: 100%;
      background: #00b0ff;
      border: none;
      border-radius: 12px;
      padding: 16px;
      font-size: 18px;
      font-weight: 600;
      color: #ffffff;
      cursor: pointer;
      margin-bottom: 24px;
      transition: background-color 0.2s ease;
      box-shadow: rgba(11, 27, 102, 0.306) 3px 3px 10px -1px;
    }

    .main-button:hover {
      background: #0387c3;
    }

    .main-button:disabled {
      cursor: not-allowed;
      opacity: 0.7;
    }

    .main-button.primary {
      background: #00b0ff;
      color: white;
    }

    .main-button.primary:hover {
      background: #0387c3;
    }

    .main-button.warning {
      background: #f59e0b;
    }

    .main-button.warning:hover {
      background: #d97706;
    }

    .stats-section {
      background: #f9fafb;
      border-radius: 12px;
      padding: 20px;
      border: 1px solid #e5e7eb;
    }

    .stats-title {
      font-size: 18px;
      font-weight: 600;
      color: #111827;
      margin: 0 0 16px 0;
    }

    .stat-row {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 8px 0;
      border-bottom: 1px solid #e5e7eb;
    }

    .stat-row:last-child {
      border-bottom: none;
    }

    .stat-label {
      font-size: 14px;
      color: #6b7280;
    }

    .stat-value {
      font-size: 14px;
      font-weight: 600;
      color: #111827;
    }

    .hidden {
      display: none;
    }

    .overlay {
      position: absolute;
      top: 0;
      left: 0;
      right: 0;
      bottom: 0;
      background: rgba(255, 255, 255, 0.2);
      border-radius: 16px;
      z-index: 10;
      display: flex;
      align-items: center;
      justify-content: center;
      pointer-events: none;
    }

    .error-message {
      color: #dc2626;
      font-size: 12px;
      margin-top: 4px;
      padding-left: 4px;
    }

    .network-banner {
      display: flex;
      align-items: center;
      gap: 8px;
      padding: 10px 12px;
      border-radius: 10px;
      margin-bottom: 16px;
      background: #fef3c7;
      border: 1px solid #fbbf24;
      color: #92400e;
      font-size: 13px;
      line-height: 1.4;
    }

    .network-banner strong {
      font-weight: 600;
    }

    .chain-pill {
      font-size: 12px;
      font-weight: 600;
      color: #0369a1;
      background: #e0f2fe;
      border: 1px solid #bae6fd;
      border-radius: 999px;
      padding: 2px 10px;
      margin-left: auto;
    }
  `

  @property({ type: Object })
  web3Provider: AnyEip1193Provider | null = null

  @property({ type: Function })
  connectWallet: (() => void) | undefined = undefined

  /**
   * Chain id used to display global stats when no wallet is connected.
   * Defaults to Celo. Must be one of the supported chains.
   */
  @property({ type: Number, attribute: "default-chain-id" })
  defaultChainId: SupportedChainId = SupportedChainId.CELO

  @state()
  activeTab: string = "stake"

  @state()
  inputAmount: string = "0.0"

  @state()
  walletBalance: bigint = BigInt(0)

  @state()
  currentStake: bigint = BigInt(0)

  @state()
  unclaimedRewards: bigint = BigInt(0)

  @state()
  totalStaked: bigint = BigInt(0)

  @state()
  userWeeklyRewards: bigint = BigInt(0)

  @state()
  annualAPR: number = 0

  @state()
  interval: ReturnType<typeof setInterval> | null = null

  @state()
  isLoading: boolean = false

  @state()
  txLoading: boolean = false

  @state()
  isClaiming: boolean = false

  @state()
  inputError: string = ""

  @state()
  transactionError: string = ""

  /** Active chain id (from wallet when connected, otherwise the default). */
  @state()
  activeChainId: SupportedChainId = SupportedChainId.CELO

  /** Wallet chain id, even when unsupported. `undefined` means not connected. */
  @state()
  walletChainId: number | undefined = undefined

  private walletClient: WalletClient | null = null
  private publicClients: Partial<Record<SupportedChainId, PublicClient>> = {}
  private sdk: GooddollarSavingsSDK | null = null
  private userAddress: string | null = null
  private chainChangedHandler: ((chainIdHex: unknown) => void) | null = null
  private accountsChangedHandler:
    | ((accounts: unknown) => void)
    | null = null
  private trackedProvider: AnyEip1193Provider | null = null

  connectedCallback(): void {
    super.connectedCallback()
    this.activeChainId = isSupportedChainId(this.defaultChainId)
      ? this.defaultChainId
      : SupportedChainId.CELO
    this.interval = setInterval(() => this.refreshData(), 30_000)
    this.refreshData()
  }
  disconnectedCallback() {
    if (this.interval) {
      clearInterval(this.interval)
    }
    this.unsubscribeProvider()
    super.disconnectedCallback()
  }
  updated(changedProperties: Map<string, unknown>) {
    if (changedProperties.has("web3Provider")) {
      this.subscribeProvider()
      this.refreshData()
    }
    if (changedProperties.has("defaultChainId") && !this.web3Provider) {
      this.activeChainId = isSupportedChainId(this.defaultChainId)
        ? this.defaultChainId
        : SupportedChainId.CELO
      this.refreshData()
    }
    if (
      changedProperties.has("walletBalance") ||
      changedProperties.has("currentStake")
    ) {
      this.validateInput()
    }
  }

  render() {
    const isProviderConnected = !!(
      this.web3Provider &&
      (this.web3Provider.isConnected
        ? this.web3Provider.isConnected()
        : true) &&
      this.userAddress
    )
    const isWrongNetwork =
      isProviderConnected && !isSupportedChainId(this.walletChainId)
    const isConnected = isProviderConnected && !isWrongNetwork
    return html`
      <div class="container">
        <div class="header">
          <div class="logo">
            <img
              alt="G$ logo"
              src="https://raw.githubusercontent.com/GoodDollar/GoodDAPP/master/src/assets/Splash/logo.svg"
            />
          </div>
          <h1 class="title">Gooddollar Savings</h1>
          <span class="chain-pill">${this.activeChainLabel()}</span>
        </div>

        ${isWrongNetwork
          ? html`
              <div class="network-banner" role="alert">
                <strong>Wrong network.</strong>
                <span>
                  Please switch your wallet to
                  ${formatSupportedNetworkList()} to use Gooddollar Savings.
                </span>
              </div>
            `
          : ""}

        <div class="tab-container">
          <button
            class="tab ${this.activeTab === "stake" ? "active" : ""}"
            @click=${() => this.handleTabClick("stake")}
          >
            Stake
          </button>
          <button
            class="tab ${this.activeTab === "unstake" ? "active" : ""}"
            @click=${() => this.handleTabClick("unstake")}
          >
            Unstake
          </button>
        </div>

        <div class="input-section">
          <div class="balance-info ${!isConnected ? "hidden" : ""}">
            <span>
              ${this.activeTab === "stake"
                ? `Wallet Balance: ${
                    this.isLoading
                      ? "Loading..."
                      : this.formatBigInt(this.walletBalance)
                  }`
                : `Current Stake: ${
                    this.isLoading
                      ? "Loading..."
                      : this.formatBigInt(this.currentStake)
                  }`}
            </span>
          </div>
          <div class="input-container">
            <input
              type="text"
              class="amount-input"
              .value=${this.inputAmount}
              @input=${this.handleInputChange}
              placeholder="0.0"
              ?disabled=${isWrongNetwork}
            />
            <button
              class="max-button"
              @click=${this.handleMaxClick}
              ?disabled=${isWrongNetwork}
            >
              Max
            </button>
          </div>
          ${this.inputError
            ? html`<div class="error-message">${this.inputError}</div>`
            : ""}
        </div>

        <div class="rewards-section ${!isConnected ? "hidden" : ""}">
          <span class="rewards-label">Unclaimed Rewards</span>
          <div class="rewards-value">
            <button
              class="claim-button"
              @click=${this.handleClaim}
              ?disabled=${this.isClaiming || isWrongNetwork}
            >
              ${this.isClaiming ? "Claiming..." : "Claim"}
            </button>
            <span
              >${this.isLoading
                ? "Loading..."
                : this.formatBigInt(this.unclaimedRewards)}</span
            >
          </div>
        </div>

        ${this.transactionError
          ? html`<div
              class="error-message"
              style="margin-bottom: 16px; text-align: center;"
            >
              ${this.transactionError}
            </div>`
          : ""}
        ${!isProviderConnected
          ? html`
              <button
                class="main-button primary"
                @click=${this.handleConnectWallet}
              >
                Connect Wallet
              </button>
            `
          : isWrongNetwork
            ? html`
                <button class="main-button warning" disabled>
                  Wrong Network
                </button>
              `
            : html`
                <button
                  class="main-button"
                  @click=${this.activeTab === "stake"
                    ? this.handleStake
                    : this.handleUnstake}
                  ?disabled=${this.txLoading}
                >
                  ${this.txLoading
                    ? "Processing..."
                    : this.activeTab === "stake"
                      ? "Stake"
                      : "Unstake"}
                </button>
              `}

        <div class="stats-section">
          <h3 class="stats-title">Staking Statistics</h3>

          <div class="stat-row">
            <span class="stat-label">Total G$ Staked</span>
            <span class="stat-value"
              >${this.isLoading
                ? "Loading..."
                : this.formatBigInt(this.totalStaked)}</span
            >
          </div>

          ${isConnected
            ? html`
                <div class="stat-row">
                  <span class="stat-label">Your G$ Stake Pool Share</span>
                  <span class="stat-value"
                    >${this.isLoading
                      ? "Loading..."
                      : this.formatBigInt(this.currentStake)}</span
                  >
                </div>

                <div class="stat-row">
                  <span class="stat-label">Your Weekly Rewards</span>
                  <span class="stat-value"
                    >${this.isLoading
                      ? "Loading..."
                      : this.formatBigInt(this.userWeeklyRewards)}</span
                  >
                </div>
              `
            : ""}

          <div class="stat-row">
            <span class="stat-label">Annual Stake APR</span>
            <span class="stat-value"
              >${this.isLoading
                ? "Loading..."
                : this.formatPercent(this.annualAPR)}</span
            >
          </div>
        </div>
        ${this.txLoading || this.isClaiming
          ? html`<div class="overlay"></div>`
          : ""}
      </div>
    `
  }

  private activeChainLabel(): string {
    return CHAIN_LABEL[this.activeChainId] ?? "Unknown"
  }

  private getPublicClient(chainId: SupportedChainId): PublicClient {
    let client = this.publicClients[chainId]
    if (!client) {
      client = createPublicClient({
        chain: CHAIN_BY_ID[chainId],
        transport: http(),
      }) as unknown as PublicClient
      this.publicClients[chainId] = client
    }
    return client
  }

  private subscribeProvider() {
    this.unsubscribeProvider()
    const provider = this.web3Provider
    if (!provider || typeof provider.on !== "function") return

    this.chainChangedHandler = () => {
      void this.refreshData()
    }
    this.accountsChangedHandler = () => {
      void this.refreshData()
    }

    provider.on("chainChanged", this.chainChangedHandler)
    provider.on("accountsChanged", this.accountsChangedHandler)
    this.trackedProvider = provider
  }

  private unsubscribeProvider() {
    const provider = this.trackedProvider
    if (!provider || typeof provider.removeListener !== "function") {
      this.trackedProvider = null
      this.chainChangedHandler = null
      this.accountsChangedHandler = null
      return
    }
    if (this.chainChangedHandler) {
      provider.removeListener("chainChanged", this.chainChangedHandler)
    }
    if (this.accountsChangedHandler) {
      provider.removeListener("accountsChanged", this.accountsChangedHandler)
    }
    this.chainChangedHandler = null
    this.accountsChangedHandler = null
    this.trackedProvider = null
  }

  private async readProviderChainId(
    provider: AnyEip1193Provider,
  ): Promise<number | undefined> {
    try {
      const chainIdHex = (await provider.request({
        method: "eth_chainId",
      })) as string
      if (typeof chainIdHex === "string") {
        return parseInt(chainIdHex, 16)
      }
      if (typeof chainIdHex === "number") {
        return chainIdHex
      }
    } catch (error) {
      console.warn("Failed to read provider chainId:", error)
    }
    return undefined
  }

  private async refreshData() {
    const provider = this.web3Provider
    const isProviderConnected = !!(
      provider && (provider.isConnected ? provider.isConnected() : true)
    )

    if (!isProviderConnected) {
      this.walletChainId = undefined
      this.userAddress = null
      this.walletClient = null
      this.activeChainId = isSupportedChainId(this.defaultChainId)
        ? this.defaultChainId
        : SupportedChainId.CELO
      this.resetUserStats()
      this.sdk = new GooddollarSavingsSDK(
        this.getPublicClient(this.activeChainId),
      )
      await this.loadStats()
      return
    }

    const walletChainId = await this.readProviderChainId(provider!)
    this.walletChainId = walletChainId

    const accounts = (await provider!.request({
      method: "eth_accounts",
    })) as string[]
    this.userAddress = accounts && accounts.length > 0 ? accounts[0] : null

    if (!isSupportedChainId(walletChainId)) {
      // Wrong network: keep showing global stats from the configured default
      // chain so the widget remains informative, but don't try to read user
      // balances from an incompatible chain.
      this.walletClient = null
      this.activeChainId = isSupportedChainId(this.defaultChainId)
        ? this.defaultChainId
        : SupportedChainId.CELO
      this.resetUserStats()
      try {
        this.sdk = new GooddollarSavingsSDK(
          this.getPublicClient(this.activeChainId),
        )
        await this.loadStats()
      } catch (error) {
        console.error("Error initialising SDK on default chain:", error)
      }
      return
    }

    this.activeChainId = walletChainId
    const chain = CHAIN_BY_ID[walletChainId]
    this.walletClient = createWalletClient({
      chain,
      transport: custom(provider as unknown as Parameters<typeof custom>[0]),
    })

    try {
      this.sdk = new GooddollarSavingsSDK(
        this.getPublicClient(this.activeChainId),
        this.walletClient,
      )
    } catch (error) {
      console.error("Failed to initialise savings SDK:", error)
      this.sdk = null
      return
    }

    await this.loadStats()
    if (this.userAddress) {
      await this.loadUserStats()
    } else {
      this.resetUserStats()
    }
  }

  private async loadStats() {
    if (!this.sdk) return
    try {
      const globalStats = await this.sdk.getGlobalStats()
      this.totalStaked = globalStats.totalStaked
      this.annualAPR = globalStats.annualAPR
    } catch (error) {
      console.error("Error loading global stats:", error)
    }
  }

  private async loadUserStats() {
    if (!this.sdk || !this.userAddress) return
    try {
      const userStats = await this.sdk.getUserStats()
      this.walletBalance = userStats.walletBalance
      this.currentStake = userStats.currentStake
      this.unclaimedRewards = userStats.unclaimedRewards
      this.userWeeklyRewards = userStats.userWeeklyRewards
    } catch (error) {
      console.error("Error loading user stats:", error)
    }
  }
  private resetUserStats() {
    this.walletBalance = 0n
    this.currentStake = 0n
    this.unclaimedRewards = 0n
    this.userWeeklyRewards = 0n
  }

  formatBigInt(num: bigint) {
    return Intl.NumberFormat().format(this.toEtherNumber(num))
  }
  toEtherNumber(num: bigint) {
    return Number(formatEther(num))
  }
  formatPercent(num: number) {
    return `${num.toFixed(2)}%`
  }

  handleTabClick(tab: string) {
    this.activeTab = tab
    this.inputError = ""
    this.transactionError = ""
  }

  handleMaxClick() {
    if (this.activeTab === "stake") {
      this.inputAmount = this.toEtherNumber(this.walletBalance).toString()
    } else {
      this.inputAmount = this.toEtherNumber(this.currentStake).toString()
    }
    this.inputError = ""
  }

  handleInputChange(e: Event) {
    const input = e.target as HTMLInputElement
    this.inputAmount = input.value
    this.validateInput()
  }

  private validateInput(force: boolean = false) {
    this.inputError = ""
    if (!this.inputAmount || this.inputAmount.trim() === "") {
      return
    }

    const validInputRegex = /^[0-9]*\.?[0-9]*$/
    if (!validInputRegex.test(this.inputAmount)) {
      this.inputError = "Invalid value"
      return
    }

    const numValue = parseFloat(this.inputAmount)
    if (isNaN(numValue) || numValue < 0) {
      this.inputError = "Invalid value"
      return
    }
    if (numValue === 0 && force) {
      this.inputError = "Please enter a valid amount"
      return
    }

    if (this.activeTab === "stake") {
      const inputAmountWei = parseEther(this.inputAmount)
      if (inputAmountWei > this.walletBalance) {
        this.inputError = "Insufficient balance"
        return
      }
    }

    if (this.activeTab === "unstake") {
      const inputAmountWei = parseEther(this.inputAmount)
      if (inputAmountWei > this.currentStake) {
        this.inputError = "Max amount exceeded"
        return
      }
    }
  }

  handleConnectWallet() {
    if (this.connectWallet) {
      this.connectWallet()
    }
  }

  private isOnSupportedChain(): boolean {
    return isSupportedChainId(this.walletChainId)
  }

  async handleStake() {
    if (!this.sdk || !this.userAddress) return
    if (!this.isOnSupportedChain()) {
      this.transactionError = `Please switch to ${formatSupportedNetworkList()}.`
      return
    }
    this.validateInput(true)
    if (this.inputError) {
      return
    }

    try {
      this.txLoading = true
      this.transactionError = ""
      const amount = parseEther(this.inputAmount)
      const receipt = await this.sdk.stake(amount)
      if (receipt.status === "success") {
        await this.refreshData()
        this.inputAmount = "0.0"
        this.inputError = ""
        this.transactionError = ""
      }
    } catch (error: unknown) {
      console.error("Staking error:", error)
      this.transactionError =
        error instanceof Error ? error.message : "Staking failed"
    } finally {
      this.txLoading = false
    }
  }

  async handleUnstake() {
    if (!this.sdk || !this.userAddress) return
    if (!this.isOnSupportedChain()) {
      this.transactionError = `Please switch to ${formatSupportedNetworkList()}.`
      return
    }
    this.validateInput(true)
    if (this.inputError) {
      return
    }

    try {
      this.txLoading = true
      this.transactionError = ""
      const amount = parseEther(this.inputAmount)
      const receipt = await this.sdk.unstake(amount)
      if (receipt.status === "success") {
        await this.refreshData()
        this.inputAmount = "0.0"
        this.inputError = ""
        this.transactionError = ""
      }
    } catch (error: unknown) {
      console.error("Unstaking error:", error)
      this.transactionError =
        error instanceof Error ? error.message : "Unstaking failed"
    } finally {
      this.txLoading = false
    }
  }

  async handleClaim() {
    if (!this.sdk || !this.userAddress) return
    if (!this.isOnSupportedChain()) {
      this.transactionError = `Please switch to ${formatSupportedNetworkList()}.`
      return
    }

    try {
      this.isClaiming = true
      this.transactionError = ""
      const receipt = await this.sdk.claimReward()
      if (receipt.status === "success") {
        await this.refreshData()
        this.transactionError = ""
      }
    } catch (error: unknown) {
      console.error("Claim error:", error)
      this.transactionError =
        error instanceof Error ? error.message : "Claim failed"
    } finally {
      this.isClaiming = false
    }
  }
}

export { SUPPORTED_CHAIN_IDS, SupportedChainId }
