import { LitElement, html, css } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import {
  createWalletClient,
  createPublicClient,
  custom,
  type PublicClient,
  type WalletClient,
  http,
  formatEther,
  parseEther,
} from 'viem'
import {
  GooddollarSavingsSDK,
  SUPPORTED_CHAIN_IDS,
  SupportedChainId,
  getSavingsChainConfig,
  isSupportedChainId,
} from '@goodsdks/savings-sdk';

const DEFAULT_SUPPORTED_CHAIN_IDS = SUPPORTED_CHAIN_IDS.slice();
const DEFAULT_CHAIN_ID: number = DEFAULT_SUPPORTED_CHAIN_IDS[0] ?? SupportedChainId.CELO;

@customElement('gooddollar-savings-widget')
export class GooddollarSavingsWidget extends LitElement {
  static styles = css`
    :host {
      display: block;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
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

    .header-text {
      flex: 1;
      display: flex;
      align-items: center;
      gap: 8px;
      flex-wrap: wrap;
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

    .chain-pill {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      padding: 4px 10px;
      border-radius: 999px;
      font-size: 12px;
      font-weight: 600;
      color: #0369a1;
      background: #e0f2fe;
      border: 1px solid #bae6fd;
      line-height: 1;
      white-space: nowrap;
      margin-left: auto;
    }

    .chain-pill::before {
      content: '';
      width: 6px;
      height: 6px;
      border-radius: 50%;
      background: #0ea5e9;
    }

    .network-alert {
      display: flex;
      align-items: flex-start;
      justify-content: space-between;
      gap: 12px;
      background: #fef3c7;
      border: 1px solid #f59e0b;
      color: #92400e;
      border-radius: 12px;
      padding: 12px 14px;
      margin-bottom: 16px;
      font-size: 14px;
    }

    .network-alert-text {
      flex: 1;
      line-height: 1.4;
    }

    .network-alert-action {
      background: #f59e0b;
      color: #ffffff;
      border: none;
      border-radius: 8px;
      padding: 6px 10px;
      font-size: 12px;
      font-weight: 600;
      cursor: pointer;
      white-space: nowrap;
    }

    .network-alert-action:hover {
      background: #d97706;
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

    .main-button.primary {
      background: #00b0ff;
      color: white;
    }

    .main-button.primary:hover {
      background: #0387c3;
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
  `
  @property({ type: Object })
  web3Provider: any = null;

  @property({ type: Function })
  connectWallet: (() => void) | undefined = undefined;

  @property({ type: Array, attribute: 'supported-chains' })
  supportedChains: number[] = DEFAULT_SUPPORTED_CHAIN_IDS;

  @property({ type: Number, attribute: 'default-chain-id' })
  defaultChainId: number = DEFAULT_CHAIN_ID;

  @state()
  activeTab: string = 'stake';

  @state()
  inputAmount: string = '0.0';

  @state()
  walletBalance: bigint = BigInt(0);

  @state()
  currentStake: bigint = BigInt(0);

  @state()
  unclaimedRewards: bigint = BigInt(0);

  @state()
  streamedRewards: bigint = BigInt(0);

  @state()
  totalStaked: bigint = BigInt(0);

  @state()
  userDailyRewards: bigint = BigInt(0);

  @state()
  annualAPR: number = 0;

  @state()
  isStreaming: boolean = false;

  @state()
  interval: ReturnType<typeof setInterval> | null = null

  @state()
  isLoading: boolean = false;

  @state()
  txLoading: boolean = false;

  @state()
  isClaiming: boolean = false;

  @state()
  inputError: string = '';

  @state()
  transactionError: string = '';

  @state()
  activeChainId: number = DEFAULT_CHAIN_ID;

  @state()
  walletChainId: number | null = null;

  private walletClient: WalletClient | null = null;
  private publicClients: Map<number, PublicClient> = new Map();
  private sdk: GooddollarSavingsSDK | null = null;
  private userAddress: string | null = null;
  private providerListenersAttachedTo: any = null;
  private chainChangedHandler: ((chainIdHex: string) => void) | null = null;
  private accountsChangedHandler: ((accounts: string[]) => void) | null = null;

  connectedCallback(): void {
    super.connectedCallback();
    this.activeChainId = this.resolveActiveChainId();
    this.interval = setInterval(
      () => this.refreshData(),
      30_000
    );
    this.refreshData();
  }
  disconnectedCallback() {
    if (this.interval) {
      clearInterval(this.interval);
    }
    this.detachProviderListeners();
    super.disconnectedCallback();
  }
  updated(changedProperties: Map<string, any>) {
    if (changedProperties.has('web3Provider')) {
      this.detachProviderListeners();
      this.attachProviderListeners();
      this.refreshData();
    }
    if (
      changedProperties.has('supportedChains') ||
      changedProperties.has('defaultChainId')
    ) {
      const next = this.resolveActiveChainId();
      if (next !== this.activeChainId) {
        this.activeChainId = next;
        this.sdk = null;
        this.refreshData();
      }
    }
    if (changedProperties.has('walletBalance') || changedProperties.has('currentStake')) {
      this.validateInput();
    }
  }

  render() {
    const isWalletPresent = !!(this.web3Provider && this.web3Provider.isConnected);
    const isConnected = !!(isWalletPresent && this.userAddress);
    const activeChainName = this.getChainName(this.activeChainId);
    const showWrongNetworkAlert =
      isWalletPresent &&
      this.walletChainId !== null &&
      this.walletChainId !== this.activeChainId;
    const wrongNetworkMessage = this.buildWrongNetworkMessage();

    return html`
      <div class="container">
        <div class="header">
          <div class="logo">
            <img alt="G$ logo" src="https://raw.githubusercontent.com/GoodDollar/GoodDAPP/master/src/assets/Splash/logo.svg" >
          </div>
          <div class="header-text">
            <h1 class="title">Gooddollar Savings</h1>
            <span class="chain-pill" title="Active network">${activeChainName}</span>
          </div>
        </div>

        ${showWrongNetworkAlert
        ? html`
          <div class="network-alert" role="alert">
            <span class="network-alert-text">${wrongNetworkMessage}</span>
            <button class="network-alert-action" @click=${this.handleSwitchNetwork}>
              Switch to ${activeChainName}
            </button>
          </div>
        `
        : ''
      }

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
        ? `Wallet Balance: ${this.isLoading ? 'Loading...' : this.formatBigInt(this.walletBalance)}`
        : `Current Stake: ${this.isLoading ? 'Loading...' : this.formatBigInt(this.currentStake)}`
      }
            </span>
          </div>
          <div class="input-container">
            <input
              type="text"
              class="amount-input"
              .value=${this.inputAmount}
              @input=${this.handleInputChange}
              placeholder="0.0"
            />
            <button class="max-button" @click=${this.handleMaxClick}>Max</button>
          </div>
          ${this.inputError ? html`<div class="error-message">${this.inputError}</div>` : ''}
        </div>

        <div class="rewards-section ${!isConnected ? "hidden" : ""}">
          ${this.isStreaming
          ? ''
          : html`
            <span class="rewards-label">Unclaimed Rewards</span>
            <div class="rewards-value">
              <button class="claim-button" @click=${this.handleClaim} ?disabled=${this.isClaiming}>
                ${this.isClaiming ? 'Claiming...' : 'Claim'}
              </button>
              <span>${this.isLoading ? 'Loading...' : this.formatBigInt(this.unclaimedRewards)}</span>
            </div>
          `
      }
        </div>

        ${this.transactionError ? html`<div class="error-message" style="margin-bottom: 16px; text-align: center;">${this.transactionError}</div>` : ''}

        ${!isConnected
        ? html`
          <button class="main-button primary" @click=${this.handleConnectWallet}>
            Connect Wallet
          </button>
        `
        : html`
          <button
            class="main-button"
            @click=${this.activeTab === "stake" ? this.handleStake : this.handleUnstake}
            ?disabled=${this.txLoading}
          >
            ${this.txLoading ? 'Processing...' : (this.activeTab === "stake" ? "Stake" : "Unstake")}
          </button>
        `
      }

        <div class="stats-section">
          <h3 class="stats-title">Staking Statistics (${activeChainName})</h3>

          <div class="stat-row">
            <span class="stat-label">Total G$ Staked</span>
            <span class="stat-value">${this.isLoading ? 'Loading...' : this.formatBigInt(this.totalStaked)}</span>
          </div>

          ${isConnected
        ? html`
            <div class="stat-row">
              <span class="stat-label">Your G$ Stake Pool Share</span>
              <span class="stat-value">${this.isLoading ? 'Loading...' : this.formatBigInt(this.currentStake)}</span>
            </div>

            <div class="stat-row">
              <span class="stat-label">Your Daily Rewards</span>
              <span class="stat-value">${this.isLoading ? 'Loading...' : this.formatBigInt(this.userDailyRewards)}</span>
            </div>
            <div class="stat-row">
              <span class="stat-label">Your Total Rewards So Far</span>
              <span class="stat-value">${this.isLoading ? 'Loading...' : this.formatBigInt(this.streamedRewards)}</span>
            </div>
          `
        : ""
      }

          <div class="stat-row">
            <span class="stat-label">Annual Stake APR</span>
            <span class="stat-value">${this.isLoading ? 'Loading...' : this.formatPercent(this.annualAPR)}</span>
          </div>
        </div>
        ${this.txLoading || this.isClaiming ? html`<div class="overlay"></div>` : ''}
      </div>
    `;
  }

  private resolveActiveChainId(): number {
    const supported = this.getSupportedChainsSafe();
    if (
      this.walletChainId !== null &&
      supported.includes(this.walletChainId)
    ) {
      return this.walletChainId;
    }
    if (supported.includes(this.defaultChainId)) {
      return this.defaultChainId;
    }
    return supported[0] ?? DEFAULT_CHAIN_ID;
  }

  private getSupportedChainsSafe(): number[] {
    const list = (this.supportedChains ?? []).filter((id) =>
      isSupportedChainId(Number(id)),
    );
    return list.length > 0 ? list.map(Number) : DEFAULT_SUPPORTED_CHAIN_IDS;
  }

  private getPublicClient(chainId: number): PublicClient {
    const cached = this.publicClients.get(chainId);
    if (cached) return cached;
    const config = getSavingsChainConfig(chainId);
    if (!config) {
      throw new Error(`Unsupported chain id ${chainId}`);
    }
    const client = createPublicClient({
      chain: config.chain,
      transport: http(),
    }) as unknown as PublicClient;
    this.publicClients.set(chainId, client);
    return client;
  }

  private getChainName(chainId: number): string {
    return getSavingsChainConfig(chainId)?.label ?? `Chain ${chainId}`;
  }

  private buildWrongNetworkMessage(): string {
    const supported = this.getSupportedChainsSafe();
    if (
      this.walletChainId !== null &&
      !supported.includes(this.walletChainId)
    ) {
      const supportedNames = supported.map((id) => this.getChainName(id)).join(' or ');
      return `Your wallet is on an unsupported network. Please switch to ${supportedNames}.`;
    }
    return `Your wallet network does not match the selected network (${this.getChainName(this.activeChainId)}).`;
  }

  private async refreshData() {
    const supported = this.getSupportedChainsSafe();
    let walletChainId: number | null = null;
    if (this.web3Provider?.request) {
      try {
        const chainIdHex = await this.web3Provider.request({ method: 'eth_chainId' });
        walletChainId = parseInt(chainIdHex, 16);
      } catch (error) {
        console.error('Failed to read wallet chain id:', error);
        walletChainId = null;
      }
    }
    this.walletChainId = walletChainId;

    const previousActive = this.activeChainId;
    let nextActive: number;
    if (walletChainId !== null && supported.includes(walletChainId)) {
      nextActive = walletChainId;
    } else if (supported.includes(this.defaultChainId)) {
      nextActive = this.defaultChainId;
    } else {
      nextActive = supported[0] ?? DEFAULT_CHAIN_ID;
    }

    if (nextActive !== previousActive) {
      this.activeChainId = nextActive;
      this.sdk = null;
      this.resetUserStats();
    }

    const activeConfig = getSavingsChainConfig(this.activeChainId);
    if (!activeConfig) {
      console.error(`No viem chain config for chain id ${this.activeChainId}`);
      return;
    }
    const activeChain = activeConfig.chain;

    const publicClient = this.getPublicClient(this.activeChainId);

    const walletOnActiveChain =
      !!this.web3Provider &&
      this.web3Provider.isConnected &&
      walletChainId === this.activeChainId;

    if (walletOnActiveChain) {
      this.walletClient = createWalletClient({
        chain: activeChain,
        transport: custom(this.web3Provider),
      });
      try {
        this.sdk = new GooddollarSavingsSDK(publicClient, this.walletClient);
      } catch (error) {
        console.error('Failed to initialize SDK with wallet:', error);
        this.sdk = new GooddollarSavingsSDK(publicClient);
      }

      try {
        const accounts = await this.web3Provider.request({ method: 'eth_accounts' });
        if (accounts.length > 0) {
          this.userAddress = accounts[0];
        } else {
          this.userAddress = null;
        }
      } catch (error) {
        console.error('Failed to read accounts:', error);
        this.userAddress = null;
      }
    } else {
      this.walletClient = null;
      this.userAddress = null;
      try {
        this.sdk = new GooddollarSavingsSDK(publicClient);
      } catch (error) {
        console.error('Failed to initialize SDK:', error);
        this.sdk = null;
        return;
      }
    }

    await this.loadStats();
    if (this.userAddress) {
      await this.loadUserStats();
    } else {
      this.resetUserStats();
    }
  }

  private async loadStats() {
    if (!this.sdk) return;
    try {
      const globalStats = await this.sdk.getGlobalStats();
      this.totalStaked = globalStats.totalStaked;
      this.annualAPR = globalStats.annualAPR;
      this.isStreaming = globalStats.isStreaming;
    } catch (error) {
      console.error('Error loading global stats:', error);
    }
  }

  private async loadUserStats() {
    if (!this.sdk || !this.userAddress) return;
    try {
      const userStats = await this.sdk.getUserStats()
      this.walletBalance = userStats.walletBalance;
      this.currentStake = userStats.currentStake;
      this.unclaimedRewards = userStats.unclaimedRewards ?? 0n;
      this.streamedRewards = userStats.streamedRewards ?? 0n;
      this.userDailyRewards = userStats.userDailyRewards;
    } catch (error) {
      console.error('Error loading user stats:', error);
    }
  }
  private resetUserStats() {
    this.walletBalance = 0n;
    this.currentStake = 0n;
    this.unclaimedRewards = 0n;
    this.streamedRewards = 0n;
    this.userDailyRewards = 0n;
  }

  private attachProviderListeners() {
    if (!this.web3Provider?.on) return;
    this.chainChangedHandler = (chainIdHex: string) => {
      try {
        this.walletChainId = parseInt(chainIdHex, 16);
      } catch {
        this.walletChainId = null;
      }
      this.refreshData().catch(console.error);
    };
    this.accountsChangedHandler = (accounts: string[]) => {
      this.userAddress = accounts && accounts[0] ? accounts[0] : null;
      this.refreshData().catch(console.error);
    };
    this.web3Provider.on('chainChanged', this.chainChangedHandler);
    this.web3Provider.on('accountsChanged', this.accountsChangedHandler);
    this.providerListenersAttachedTo = this.web3Provider;
  }

  private detachProviderListeners() {
    const target = this.providerListenersAttachedTo;
    if (!target?.removeListener) {
      this.providerListenersAttachedTo = null;
      this.chainChangedHandler = null;
      this.accountsChangedHandler = null;
      return;
    }
    if (this.chainChangedHandler) {
      target.removeListener('chainChanged', this.chainChangedHandler);
    }
    if (this.accountsChangedHandler) {
      target.removeListener('accountsChanged', this.accountsChangedHandler);
    }
    this.providerListenersAttachedTo = null;
    this.chainChangedHandler = null;
    this.accountsChangedHandler = null;
  }

  formatBigInt(num: bigint) {
    return Intl.NumberFormat().format(this.toEtherNumber(num));
  }
  toEtherNumber(num: bigint) {
    return Number(formatEther(num));
  }
  formatPercent(num: number) {
    return `${num.toFixed(2)}%`;
  }

  handleTabClick(tab: string) {
    this.activeTab = tab;
    this.inputError = '';
    this.transactionError = '';
  }

  handleMaxClick() {
    if (this.activeTab === "stake") {
      this.inputAmount = this.toEtherNumber(this.walletBalance).toString()
    } else {
      this.inputAmount = this.toEtherNumber(this.currentStake).toString()
    }
    this.inputError = '';
  }

  handleInputChange(e: Event) {
    const input = e.target as HTMLInputElement;
    this.inputAmount = input.value;
    this.validateInput();
  }

  private validateInput(force: boolean = false) {
    this.inputError = '';
    if (!this.inputAmount || this.inputAmount.trim() === '') {
      return;
    }

    const validInputRegex = /^[0-9]*\.?[0-9]*$/;
    if (!validInputRegex.test(this.inputAmount)) {
      this.inputError = 'Invalid value';
      return;
    }

    const numValue = parseFloat(this.inputAmount);
    if (isNaN(numValue) || numValue < 0) {
      this.inputError = 'Invalid value';
      return;
    }
    if (numValue === 0 && force) {
      this.inputError = 'Please enter a valid amount';
      return;
    }

    if (this.activeTab === 'stake') {
      const inputAmountWei = parseEther(this.inputAmount);
      if (inputAmountWei > this.walletBalance) {
        this.inputError = 'Insufficient balance';
        return;
      }
    }

    if (this.activeTab === 'unstake') {
      const inputAmountWei = parseEther(this.inputAmount);
      if (inputAmountWei > this.currentStake) {
        this.inputError = 'Max amount exceeded';
        return;
      }
    }
  }

  handleConnectWallet() {
    if (this.connectWallet) {
      this.connectWallet();
    }
  }

  async handleStake() {
    if (!this.sdk || !this.userAddress) return;
    this.validateInput(true);
    if (this.inputError) {
      return;
    }

    try {
      const onActive = await this.ensureActiveNetwork();
      if (!onActive) return;

      this.txLoading = true;
      this.transactionError = '';
      const amount = parseEther(this.inputAmount);
      const receipt = await this.sdk.stake(amount);
      if (receipt.status === 'success') {
        await this.refreshData();
        this.inputAmount = '0.0';
        this.inputError = '';
        this.transactionError = '';
      }
    } catch (error: any) {
      console.error('Staking error:', error);
      this.transactionError = this.toUserErrorMessage(error, 'Staking failed');
    } finally {
      this.txLoading = false;
    }
  }

  async handleUnstake() {
    if (!this.sdk || !this.userAddress) return;
    this.validateInput(true);
    if (this.inputError) {
      return;
    }

    try {
      const onActive = await this.ensureActiveNetwork();
      if (!onActive) return;

      this.txLoading = true;
      this.transactionError = '';
      const amount = parseEther(this.inputAmount);
      const receipt = await this.sdk.unstake(amount);
      if (receipt.status === 'success') {
        await this.refreshData();
        this.inputAmount = '0.0';
        this.inputError = '';
        this.transactionError = '';
      }
    } catch (error: any) {
      console.error('Unstaking error:', error);
      this.transactionError = this.toUserErrorMessage(error, 'Unstaking failed');
    } finally {
      this.txLoading = false;
    }
  }

  async handleClaim() {
    if (!this.sdk || !this.userAddress) return;

    try {
      const onActive = await this.ensureActiveNetwork();
      if (!onActive) return;

      this.isClaiming = true;
      this.transactionError = '';
      const receipt = await this.sdk.claimReward();
      if (receipt.status === 'success') {
        await this.refreshData();
        this.transactionError = '';
      }
    } catch (error: any) {
      console.error('Claim error:', error);
      this.transactionError = this.toUserErrorMessage(error, 'Claim failed');
    } finally {
      this.isClaiming = false;
    }
  }

  private async handleSwitchNetwork() {
    const switched = await this.ensureActiveNetwork();
    if (switched) {
      await this.refreshData();
    }
  }

  private async ensureActiveNetwork(): Promise<boolean> {
    if (!this.web3Provider?.request) return true;

    const chainIdHex = await this.web3Provider.request({ method: 'eth_chainId' });
    const currentChainId = parseInt(chainIdHex, 16);
    if (currentChainId === this.activeChainId) return true;

    const targetHex = `0x${this.activeChainId.toString(16)}`;
    try {
      await this.web3Provider.request({
        method: 'wallet_switchEthereumChain',
        params: [{ chainId: targetHex }],
      });
      this.transactionError = '';
      this.walletChainId = this.activeChainId;
      return true;
    } catch (error: any) {
      this.transactionError = this.toUserErrorMessage(
        error,
        `Please switch your wallet to ${this.getChainName(this.activeChainId)}.`,
      );
      return false;
    }
  }

  private toUserErrorMessage(error: unknown, fallback: string = 'Transaction failed') {
    if (!error) return fallback;

    const maybeError = error as {
      shortMessage?: string;
      message?: string;
      cause?: { shortMessage?: string };
    };
    const shortMessage = maybeError.shortMessage || maybeError.cause?.shortMessage;
    const message = shortMessage || maybeError.message || String(error);
    const lines = message
      .split('\n')
      .map((line: string) => line.trim())
      .filter(Boolean);
    const firstLine = lines[0] || fallback;
    const cleaned = firstLine
      .split('Contract Call:')[0]
      .split('Docs:')[0]
      .split('Details:')[0]
      .trim();

    const lower = cleaned.toLowerCase();
    if (lower.includes('user rejected') || lower.includes('rejected the request')) {
      return 'Transaction rejected in wallet.';
    }
    if (lower.includes('insufficient funds')) {
      return 'Insufficient funds to pay for gas.';
    }
    if (
      lower.includes('wrong network') ||
      lower.includes('chain mismatch') ||
      lower.includes('switch your wallet') ||
      lower.includes('unsupported chain')
    ) {
      return `Please switch to ${this.getChainName(this.activeChainId)} to continue.`;
    }

    return cleaned || fallback;
  }
}
