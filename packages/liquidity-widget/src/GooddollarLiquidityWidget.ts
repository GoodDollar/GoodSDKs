import { LitElement, html, css, nothing } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import { createWalletClient, createPublicClient, custom, http, formatEther } from 'viem';
import type { PublicClient, WalletClient } from 'viem';
import { celo } from 'viem/chains';

import {
  GD_TOKEN, USDGLO_TOKEN,
  TICK_SPACING, DEFAULT_EXPLORER_URL, DEFAULT_APPROVAL_BUFFER,
  FULL_RANGE_TICK_LOWER, FULL_RANGE_TICK_UPPER,
  calcUsdgloFromGd, calcGdFromUsdglo,
  GooddollarLiquiditySDK,
} from '@goodsdks/liquidity-sdk';
import type { PoolData, PositionData } from '@goodsdks/liquidity-sdk';

import type { TxFlowPhase, TxStepInfo, WidgetTheme } from './liquidity/types';
import { safeParseEther, validateInputs } from './liquidity/validation';
import { buildTxSteps, updateStep } from './liquidity/tx-steps';
import { RANGE_PRESETS } from './liquidity/components/lw-range-presets';

import './liquidity/components/lw-stepper';
import './liquidity/components/lw-tooltip';
import './liquidity/components/lw-range-presets';
import './liquidity/components/lw-pool-info';
import './liquidity/components/lw-tx-status';
import './liquidity/components/lw-position-card';
import './liquidity/components/lw-positions-panel';

type WidgetTab = 'add' | 'positions';

@customElement('gooddollar-liquidity-widget')
export class GooddollarLiquidityWidget extends LitElement {

  // ── Integrator Properties ──────────────────────────────────────────

  @property({ type: Object })
  web3Provider: any = null;

  @property({ type: Function })
  connectWallet: (() => void) | undefined = undefined;

  @property({ type: String })
  explorerBaseUrl: string = DEFAULT_EXPLORER_URL;

  @property({ type: Number })
  approvalBuffer: number = DEFAULT_APPROVAL_BUFFER;

  @property({ type: String })
  defaultRange: 'full' | 'wide' | 'narrow' = 'full';

  @property({ type: Boolean })
  showPositions: boolean = true;

  @property({ type: Object })
  theme: Partial<WidgetTheme> | undefined = undefined;

  @property({ type: Number })
  refreshInterval: number = 30_000;

  // ── Internal State ─────────────────────────────────────────────────

  @state() private activeTab: WidgetTab = 'add';
  @state() private gdInput = '';
  @state() private usdgloInput = '';
  @state() private gdBalance = 0n;
  @state() private usdgloBalance = 0n;
  @state() private gdAllowance = 0n;
  @state() private usdgloAllowance = 0n;
  @state() private poolData: PoolData | null = null;
  @state() private currentTick = 0;
  @state() private isLoading = false;
  @state() private inputError = '';

  @state() private selectedRange: 'full' | 'wide' | 'narrow' = 'full';
  @state() private tickLower = FULL_RANGE_TICK_LOWER;
  @state() private tickUpper = FULL_RANGE_TICK_UPPER;

  @state() private txPhase: TxFlowPhase = 'idle';
  @state() private txHash = '';
  @state() private txError = '';
  @state() private txSteps: TxStepInfo[] = [];

  @state() private positions: PositionData[] = [];
  @state() private positionsLoading = false;

  private walletClient: WalletClient | null = null;
  private publicClient: PublicClient | null = null;
  private sdk: GooddollarLiquiditySDK | null = null;
  private userAddress: string | null = null;
  private _refreshTimer: ReturnType<typeof setInterval> | null = null;

  // ── Styles ─────────────────────────────────────────────────────────

  static styles = css`
    :host {
      display: block;
      font-family: var(--lw-font, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif);
      max-width: 480px;
      margin: 0 auto;
    }

    .container {
      background: white;
      border-radius: var(--lw-radius, 16px);
      padding: 24px;
      box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
      border: 1px solid #e5e7eb;
      position: relative;
    }

    .header {
      display: flex;
      align-items: center;
      gap: 12px;
      margin-bottom: 8px;
    }

    .logo { width: 48px; height: 48px; display: flex; align-items: center; justify-content: center; }
    .logo img { width: 44px; height: 44px; box-shadow: rgba(0,0,0,0.075) 0px 6px 10px; border-radius: 50%; background: white; }

    .title { font-size: 20px; font-weight: 600; color: #111827; margin: 0; flex: 1; }
    .title-row { display: flex; align-items: center; gap: 4px; }

    /* Tabs */
    .tabs {
      display: flex;
      background: #f3f4f6;
      border-radius: 10px;
      padding: 3px;
      margin-bottom: 16px;
    }
    .tab {
      flex: 1;
      text-align: center;
      padding: 8px 0;
      font-size: 14px;
      font-weight: 600;
      color: #6b7280;
      border-radius: 8px;
      border: none;
      background: transparent;
      cursor: pointer;
      transition: all 0.15s;
    }
    .tab.active { background: white; color: #111827; box-shadow: 0 1px 2px rgba(0,0,0,0.06); }
    .tab:hover:not(.active) { color: #374151; }

    /* Input sections */
    .input-section {
      background: #f9fafb;
      border-radius: 12px;
      padding: 16px;
      margin-bottom: 12px;
      border: 1px solid #e5e7eb;
    }
    .input-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px; }
    .token-name { font-size: 15px; font-weight: 600; color: #111827; display: flex; align-items: center; }
    .balance-info { font-size: 13px; color: #6b7280; }
    .input-container { display: flex; align-items: center; gap: 12px; }
    .amount-input {
      flex: 1; border: none; background: transparent;
      font-size: 22px; font-weight: 600; color: #111827; outline: none;
      min-width: 0;
    }
    .max-button {
      background: #fff; border-radius: 8px; padding: 5px 10px;
      font-size: 12px; font-weight: 500; color: #374151;
      border: 1px solid #d1d5db; cursor: pointer; transition: all 0.15s;
    }
    .max-button:hover { border-color: var(--lw-primary, #00b0ff); color: var(--lw-primary, #00b0ff); }

    /* Buttons */
    .main-button {
      width: 100%;
      background: var(--lw-primary, #00b0ff);
      border: none;
      border-radius: 12px;
      padding: 14px;
      font-size: 16px;
      font-weight: 600;
      color: #fff;
      cursor: pointer;
      transition: background 0.15s;
      box-shadow: rgba(11,27,102,0.2) 2px 2px 8px -1px;
    }
    .main-button:hover { filter: brightness(0.92); }
    .main-button:disabled { opacity: 0.55; cursor: not-allowed; filter: none; }

    .error-message { color: #dc2626; font-size: 12px; margin-bottom: 12px; text-align: center; }
    .hidden { display: none; }

    .overlay {
      position: absolute; inset: 0;
      background: rgba(255,255,255,0.3);
      border-radius: var(--lw-radius, 16px);
      z-index: 10;
      pointer-events: none;
    }
  `;

  // ── Lifecycle ──────────────────────────────────────────────────────

  connectedCallback(): void {
    super.connectedCallback();
    this.selectedRange = this.defaultRange;
    this.refreshData();
  }

  disconnectedCallback() {
    super.disconnectedCallback();
    this._stopRefreshTimer();
  }

  updated(changed: Map<string, unknown>) {
    if (changed.has('web3Provider')) this.refreshData();
    if (changed.has('refreshInterval')) this._syncRefreshTimer();
    if (changed.has('theme')) this._applyTheme();
  }

  private get _isConnected(): boolean {
    return !!(this.web3Provider && this.web3Provider.isConnected && this.userAddress);
  }

  private _syncRefreshTimer() {
    this._stopRefreshTimer();
    if (this._isConnected && this.refreshInterval > 0) {
      this._refreshTimer = setInterval(() => this.refreshData(), this.refreshInterval);
    }
  }

  private _stopRefreshTimer() {
    if (this._refreshTimer) {
      clearInterval(this._refreshTimer);
      this._refreshTimer = null;
    }
  }

  // ── Render ─────────────────────────────────────────────────────────

  private _fmt(num: bigint): string {
    if (num === 0n) return '0';
    return Number(formatEther(num)).toLocaleString('en-US', { maximumFractionDigits: 2 });
  }

  render() {
    const isConnected = !!(this.web3Provider && this.web3Provider.isConnected && this.userAddress);
    const gdPrice = this.poolData?.gdPriceInUsdglo ?? 0;

    return html`
      <div class="container">
        <!-- Header -->
        <div class="header">
          <div class="logo">
            <img alt="G$ logo" src="https://raw.githubusercontent.com/GoodDollar/GoodDAPP/master/src/assets/Splash/logo.svg">
          </div>
          <div class="title-row">
            <h1 class="title">G$ / USDGLO Liquidity</h1>
            <lw-tooltip text="Provide liquidity to the G$/USDGLO pool to earn trading fees. You deposit both tokens and receive an NFT position."></lw-tooltip>
          </div>
        </div>

        <!-- Pool Info -->
        <lw-pool-info
          .gdPrice=${gdPrice}
          .loading=${this.isLoading}
          .explorerUrl=${this.explorerBaseUrl}
        ></lw-pool-info>

        <!-- Tabs -->
        ${this.showPositions && isConnected ? html`
          <div class="tabs">
            <button class="tab ${this.activeTab === 'add' ? 'active' : ''}"
              @click=${() => this.activeTab = 'add'}>Add Liquidity</button>
            <button class="tab ${this.activeTab === 'positions' ? 'active' : ''}"
              @click=${() => { this.activeTab = 'positions'; this._loadPositions(); }}>
              My Positions${this.positions.length > 0 ? ` (${this.positions.length})` : ''}
            </button>
          </div>
        ` : nothing}

        <!-- Tab Content -->
        ${this.activeTab === 'add' ? this._renderAddTab(isConnected) : this._renderPositionsTab()}

        ${this.txPhase !== 'idle' && this.txPhase !== 'success' && this.txPhase !== 'error'
          ? html`<div class="overlay"></div>` : nothing}
      </div>
    `;
  }

  private _renderAddTab(isConnected: boolean) {
    const showStepper = this.txPhase !== 'idle' && this.txSteps.length > 0;

    return html`
      <!-- Range Presets -->
      <lw-range-presets
        .selected=${this.selectedRange}
        .baseApr=${0}
        @range-change=${this._onRangeChange}
      ></lw-range-presets>

      <!-- G$ Input -->
      <div class="input-section">
        <div class="input-header">
          <span class="token-name">
            G$
            <lw-tooltip text="Your G$ tokens will be paired with USDGLO in the pool. The ratio is determined by the current pool price."></lw-tooltip>
          </span>
          <span class="balance-info ${!isConnected ? 'hidden' : ''}">
            Balance: ${this.isLoading ? 'Loading...' : this._fmt(this.gdBalance)}
          </span>
        </div>
        <div class="input-container">
          <input type="text" class="amount-input"
            .value=${this.gdInput}
            @input=${this._handleGdInput}
            placeholder="0.0" />
          <button class="max-button ${!isConnected ? 'hidden' : ''}" @click=${this._handleGdMax}>Max</button>
        </div>
      </div>

      <!-- USDGLO Input -->
      <div class="input-section">
        <div class="input-header">
          <span class="token-name">
            USDGLO
            <lw-tooltip text="The required counterpart token. Amount is calculated based on the pool ratio."></lw-tooltip>
          </span>
          <span class="balance-info ${!isConnected ? 'hidden' : ''}">
            Balance: ${this.isLoading ? 'Loading...' : this._fmt(this.usdgloBalance)}
          </span>
        </div>
        <div class="input-container">
          <input type="text" class="amount-input"
            .value=${this.usdgloInput}
            @input=${this._handleUsdgloInput}
            placeholder="0.0" />
          <button class="max-button ${!isConnected ? 'hidden' : ''}" @click=${this._handleUsdgloMax}>Max</button>
        </div>
      </div>

      ${this.inputError ? html`<div class="error-message">${this.inputError}</div>` : nothing}

      <!-- Transaction Status -->
      <lw-tx-status
        .phase=${this.txPhase}
        .txHash=${this.txHash}
        .errorMessage=${this.txError}
        .explorerUrl=${this.explorerBaseUrl}
        @retry=${this._handleRetry}
      ></lw-tx-status>

      <!-- Stepper -->
      ${showStepper ? html`<lw-stepper .steps=${this.txSteps}></lw-stepper>` : nothing}

      <!-- Action Button -->
      ${!isConnected
        ? html`<button class="main-button" @click=${this._handleConnect}>Connect Wallet</button>`
        : html`
          <button class="main-button"
            @click=${this._handleMainAction}
            ?disabled=${this.txPhase !== 'idle' && this.txPhase !== 'success' && this.txPhase !== 'error'}>
            ${this._getButtonLabel()}
          </button>
        `
      }
    `;
  }

  private _renderPositionsTab() {
    return html`
      <lw-positions-panel
        .positions=${this.positions}
        .loading=${this.positionsLoading}
        .explorerUrl=${this.explorerBaseUrl}
      ></lw-positions-panel>
    `;
  }

  // ── Theme ──────────────────────────────────────────────────────────

  private _applyTheme() {
    if (!this.theme) return;
    if (this.theme.primaryColor)
      this.style.setProperty('--lw-primary', this.theme.primaryColor);
    if (this.theme.borderRadius)
      this.style.setProperty('--lw-radius', this.theme.borderRadius);
    if (this.theme.fontFamily)
      this.style.setProperty('--lw-font', this.theme.fontFamily);
  }

  // ── Data Loading ───────────────────────────────────────────────────

  private _ensureSDK(): GooddollarLiquiditySDK | null {
    if (!this.publicClient) {
      this.publicClient = createPublicClient({
        chain: celo,
        transport: http(),
      }) as unknown as PublicClient;
    }
    if (!this.sdk) {
      this.sdk = new GooddollarLiquiditySDK(this.publicClient);
    }
    if (this.walletClient) {
      this.sdk.setWalletClient(this.walletClient);
    }
    return this.sdk;
  }

  private async refreshData() {
    const sdk = this._ensureSDK();
    if (!sdk) return;

    this.isLoading = true;

    try {
      const pool = await sdk.loadPoolData();
      this.poolData = pool;
      this.currentTick = pool.currentTick;
    } catch (e) {
      console.error('Error loading pool data:', e);
    }

    try {
      if (this.web3Provider && this.web3Provider.isConnected) {
        this.walletClient = createWalletClient({ chain: celo, transport: custom(this.web3Provider) });
        sdk.setWalletClient(this.walletClient);
        const accounts = await this.web3Provider.request({ method: 'eth_accounts' });
        if (accounts.length > 0) {
          this.userAddress = accounts[0];
          const data = await sdk.loadUserBalancesAndAllowances(this.userAddress as `0x${string}`);
          this.gdBalance = data.gdBalance;
          this.usdgloBalance = data.usdgloBalance;
          this.gdAllowance = data.gdAllowance;
          this.usdgloAllowance = data.usdgloAllowance;
        } else {
          this._resetUserData();
        }
      } else {
        this._resetUserData();
      }
    } catch (e) {
      console.error('Error loading user data:', e);
    }

    this.isLoading = false;
    this._syncRefreshTimer();
  }

  private _resetUserData() {
    this.userAddress = null;
    this.gdBalance = 0n;
    this.usdgloBalance = 0n;
    this.gdAllowance = 0n;
    this.usdgloAllowance = 0n;
    this.positions = [];
  }

  private async _loadPositions() {
    const sdk = this.sdk;
    if (!sdk || !this.userAddress) return;
    this.positionsLoading = true;
    try {
      this.positions = await sdk.getUserPositions(
        this.userAddress as `0x${string}`,
        this.currentTick,
      );
    } catch (e) {
      console.error('Error loading positions:', e);
    }
    this.positionsLoading = false;
  }

  // ── Validation ─────────────────────────────────────────────────────

  private _validateInputs(force = false) {
    this.inputError = validateInputs({
      gdInput: this.gdInput,
      usdgloInput: this.usdgloInput,
      gdBalance: this.gdBalance,
      usdgloBalance: this.usdgloBalance,
      force,
    }) ?? '';
  }

  private _getButtonLabel(): string {
    if (this.txPhase === 'success') return 'Add More Liquidity';

    const gdWei = safeParseEther(this.gdInput);
    const usdgloWei = safeParseEther(this.usdgloInput);

    if (gdWei > 0n && this.gdAllowance < gdWei) return 'Approve & Add Liquidity';
    if (usdgloWei > 0n && this.usdgloAllowance < usdgloWei) return 'Approve & Add Liquidity';
    return 'Add Liquidity';
  }

  // ── Event Handlers ─────────────────────────────────────────────────

  private _handleConnect() { this.connectWallet?.(); }

  private get _sqrtPriceFloat(): number {
    return this.poolData?.sqrtPriceFloat ?? 0;
  }

  private _syncUsdgloFromGd() {
    this.usdgloInput = calcUsdgloFromGd(
      this.gdInput, this._sqrtPriceFloat, this.tickLower, this.tickUpper,
    );
  }

  private _syncGdFromUsdglo() {
    this.gdInput = calcGdFromUsdglo(
      this.usdgloInput, this._sqrtPriceFloat, this.tickLower, this.tickUpper,
    );
  }

  private _handleGdInput(e: Event) {
    this.gdInput = (e.target as HTMLInputElement).value;
    this._syncUsdgloFromGd();
    this._validateInputs();
  }

  private _handleUsdgloInput(e: Event) {
    this.usdgloInput = (e.target as HTMLInputElement).value;
    this._syncGdFromUsdglo();
    this._validateInputs();
  }

  private _handleGdMax() {
    this.gdInput = formatEther(this.gdBalance);
    this._syncUsdgloFromGd();
    this.inputError = '';
  }

  private _handleUsdgloMax() {
    this.usdgloInput = formatEther(this.usdgloBalance);
    this._syncGdFromUsdglo();
    this.inputError = '';
  }

  private _onRangeChange(e: CustomEvent) {
    const id = e.detail.id as 'full' | 'wide' | 'narrow';
    this.selectedRange = id;
    const preset = RANGE_PRESETS.find(p => p.id === id)!;
    const { tickLower, tickUpper } = preset.getTickRange(this.currentTick, TICK_SPACING);
    this.tickLower = tickLower;
    this.tickUpper = tickUpper;
    this._syncUsdgloFromGd();
  }

  private _handleRetry() {
    this.txPhase = 'idle';
    this.txHash = '';
    this.txError = '';
    this.txSteps = [];
  }

  // ── Main Transaction Flow ──────────────────────────────────────────

  async _handleMainAction() {
    const sdk = this.sdk;
    if (!sdk || !this.walletClient || !this.userAddress) return;

    if (this.txPhase === 'success') {
      this.txPhase = 'idle';
      this.txHash = '';
      this.txSteps = [];
      return;
    }

    this._validateInputs(true);
    if (this.inputError) return;

    const gdWei = safeParseEther(this.gdInput);
    const usdgloWei = safeParseEther(this.usdgloInput);

    const { steps: initialSteps, needGdApproval, needUsdgloApproval } = buildTxSteps({
      gdWei,
      usdgloWei,
      gdAllowance: this.gdAllowance,
      usdgloAllowance: this.usdgloAllowance,
    });

    let steps: TxStepInfo[] = initialSteps;
    this.txSteps = steps;
    this.txError = '';

    try {
      if (needGdApproval) {
        this.txPhase = 'approving-gd';
        this.txHash = '';
        this.txSteps = updateStep(steps, 0, { status: 'active' });

        const hash = await sdk.approveToken(
          GD_TOKEN, gdWei, this.approvalBuffer,
          {
            onHash: (h:any) => { this.txHash = h; this._emitTxEvent('lw-tx-submitted', h, 'approve-gd'); },
            onConfirmed: (h:any) => this._emitTxEvent('lw-tx-confirmed', h, 'approve-gd'),
          },
        );

        this.txSteps = steps = updateStep(steps, 0, { status: 'completed', txHash: hash });
        await this.refreshData();
      }

      if (needUsdgloApproval) {
        this.txPhase = 'approving-usdglo';
        this.txHash = '';
        this.txSteps = updateStep(steps, 1, { status: 'active' });

        const hash = await sdk.approveToken(
          USDGLO_TOKEN, usdgloWei, this.approvalBuffer,
          {
            onHash: (h:any) => { this.txHash = h; this._emitTxEvent('lw-tx-submitted', h, 'approve-usdglo'); },
            onConfirmed: (h:any) => this._emitTxEvent('lw-tx-confirmed', h, 'approve-usdglo'),
          },
        );

        this.txSteps = steps = updateStep(steps, 1, { status: 'completed', txHash: hash });
        await this.refreshData();
      }

      this.txPhase = 'minting';
      this.txHash = '';
      this.txSteps = updateStep(steps, 2, { status: 'active' });

      const hash = await sdk.addLiquidity(
        gdWei, usdgloWei, this.tickLower, this.tickUpper,
        {
          onHash: (h:any) => { this.txHash = h; this._emitTxEvent('lw-tx-submitted', h, 'mint'); },
          onConfirmed: (h:any) => this._emitTxEvent('lw-tx-confirmed', h, 'mint'),
        },
      );

      this.txSteps = updateStep(steps, 2, { status: 'completed', txHash: hash });
      this.txPhase = 'success';
      this.txHash = hash;

      this._emitEvent('lw-position-added', { hash });

      this.gdInput = '';
      this.usdgloInput = '';
      this.inputError = '';
      await this.refreshData();

    } catch (error: any) {
      this.txPhase = 'error';
      this.txError = GooddollarLiquiditySDK.parseTxError(error);
      this._emitTxEvent('lw-tx-failed', this.txHash, this.txPhase, error);
    }
  }

  // ── Custom Events for Integrators ──────────────────────────────────

  private _emitEvent(name: string, detail: Record<string, unknown>) {
    this.dispatchEvent(new CustomEvent(name, {
      detail, bubbles: true, composed: true,
    }));
  }

  private _emitTxEvent(name: string, hash: string, step: string, error?: any) {
    this._emitEvent(name, { hash, step, ...(error ? { error: GooddollarLiquiditySDK.parseTxError(error) } : {}) });
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'gooddollar-liquidity-widget': GooddollarLiquidityWidget;
  }
}
