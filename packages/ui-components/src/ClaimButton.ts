import { LitElement, html, css } from "lit"
import { customElement, property, state } from "lit/decorators.js"
import { createAppKit } from "@reown/appkit"
import type { AppKit, AppKitOptions } from "@reown/appkit"
import {
  celo as reownCelo,
  fuse as reownFuse,
  type AppKitNetwork,
} from "@reown/appkit/networks"
import { EthersAdapter } from "@reown/appkit-adapter-ethers"
import type { PublicClient, WalletClient } from "viem"
import { celo, fuse } from "viem/chains"
import {
  createPublicClient,
  createWalletClient,
  custom,
  http,
  formatUnits,
} from "viem"

import { ClaimSDK, IdentitySDK } from "@goodsdks/citizen-sdk"
import {
  G$TokenAddresses,
  goodDollarABI,
  rpcUrls,
  SupportedChains,
} from "./constants"

@customElement("claim-button")
export class ClaimButton extends LitElement {
  @property({ type: String })
  environment: "production" | "development" | "staging" = "development"
  @property({ type: Array })
  supportedChains: SupportedChains[] | number[] = [122, 42220]
  @property({ type: Object })
  appkitConfig = {
    projectId: null,
    metadata: null, // { name: string, description: string, url: string, icons: string[] }
  }

  @state()
  private error: string | null = null
  @state() private txHash: string | null = null
  @state() private claimAmount: number | null = null
  @state() private chain: SupportedChains | null = null
  @state() private walletAddress: string | null = null
  @state() private tokenBalance: string | null = null
  @state() private timeLeft: number | null = null
  @state() private decimals: number | null = null
  @state() private claimOnAlt: boolean = false
  @state() private claimState:
    | "idle"
    | "claiming"
    | "success"
    | "timer"
    | "switching"
    | "loading" = "idle"

  private countdownTimer: number | null = null
  private confettiCanvas: HTMLCanvasElement | null = null
  private confettiCtx: CanvasRenderingContext2D | null = null
  private particles: any[] = []
  private clientsInitialized: boolean = false

  private appKit: AppKit | null = null
  private publicClient: PublicClient | null = null
  private walletClient: WalletClient | null = null
  private claimSdk: ClaimSDK | null = null

  static styles = css`
    .claim-container {
      background: white;
      border-radius: 10px;
      box-shadow: 0 6px 12px rgba(0, 0, 0, 0.15);
      padding: 20px;
      text-align: center;
      max-width: 400px;
      margin: 0 auto;
    }
    .button {
      background-color: #3498db;
      color: white;
      border: none;
      padding: 10px 20px;
      border-radius: 5px;
      cursor: pointer;
      font-size: 16px;
      transition: background-color 0.3s;
    }
    .button:hover:not(:disabled) {
      background-color: #2980b9;
    }
    .button:disabled {
      background-color: #bdc3c7;
      cursor: not-allowed;
    }
    .connected-widget {
      display: flex;
      flex-direction: column;
      align-items: center;
    }
    .wallet-details {
      display: flex;
      justify-content: space-between;
      padding: 10px;
      background-color: #f8f9fa;
      border-bottom: 1px solid #e0e0e0;
      margin-bottom: 15px;
      font-size: 14px;
      font-family: Roboto;
      width: 100%;
    }
    .detail-item {
      display: flex;
      align-items: center;
    }
    .detail-item:hover {
      cursor: pointer;
      background-color: rgba(248, 249, 250, 0.38);
    }
    .label {
      font-weight: bold;
      color: #2c3e50;
      margin-right: 5px;
    }
    .value {
      color: #34495e;
    }
    .message {
      margin-top: 10px;
      font-size: 14px;
    }
    .error {
      color: #dc3545;
    }
    .success {
      color: #28a745;
    }
    .tx-link {
      color: #007bff;
      text-decoration: underline;
      cursor: pointer;
    }
    h2 {
      color: #2c3e50;
      margin-bottom: 10px;
    }
    p {
      color: #7f8c8d;
      margin-bottom: 15px;
    }
    .loader {
      border: 5px solid #ecf0f1;
      border-top: 5px solid #3498db;
      border-radius: 50%;
      width: 50px;
      height: 50px;
      animation: spin 1.5s linear infinite;
      margin: 20px auto;
    }
    .loader2 {
      border: 5px solid #ecf0f1;
      border-top: 5px solid #3498db;
      border-radius: 50%;
      width: 50px;
      height: 50px;
      animation: spin 1.5s linear infinite;
    }
    @keyframes spin {
      0% {
        transform: rotate(0deg);
      }
      100% {
        transform: rotate(360deg);
      }
    }
    #confetti-canvas {
      width: 100%;
      height: 200px;
      margin-top: 10px;
    }
    .countdown {
      font-size: 24px;
      font-weight: bold;
      color: #2c3e50;
      margin-bottom: 12px;
    }
    .footer {
      margin-top: 20px;
      padding-top: 10px;
      border-top: 1px solid #e0e0e0;
      font-size: 12px;
      color: #7f8c8d;
      display: flex;
      justify-content: space-between;
      align-items: center;
      flex-direction: column;
    }
    .powered-by {
      display: flex;
      align-items: center;
      margin-bottom: 8px;
    }
    .gd-link {
      display: flex;
      align-items: center;
      color: #3498db;
      text-decoration: none;
      font-weight: bold;
    }
    .gd-icon {
      width: 24px;
      height: 24px;
      margin-right: 5px;
      margin-left: 5px;
    }
    .footer-links {
      display: flex;
      gap: 10px;
    }
    .footer-links a {
      color: #007bff;
      text-decoration: underline;
      cursor: pointer;
    }
    .chain-suggestion {
      cursor: pointer;
      padding: 8px;
      border-radius: 6px;
      background-color: #3498db;
      color: white;
      font-weight: bold;
      box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
    }
    .chain-suggestion:hover {
      background-color: #2980b9;
      cursor: pointer;
    }
  `

  firstUpdated() {
    this.initializeAppKit()
  }

  async initializeAppKit() {
    if (!this.appkitConfig.projectId || !this.appkitConfig.metadata) return

    const networks: [AppKitNetwork, ...AppKitNetwork[]] = [reownCelo, reownFuse]

    this.appKit = createAppKit({
      adapters: [new EthersAdapter()],
      basic: true,
      networks,
      projectId: this.appkitConfig?.projectId,
      metadata: this.appkitConfig?.metadata,
    } as AppKitOptions)

    this.appKit.subscribeState((state) => {
      if (state.loading) {
        this.claimState = "loading"
      } else if (state.initialized) {
        this.claimState = "idle"
      }
    })

    this.appKit.subscribeAccount(async (account) => {
      if (account?.address && !this.clientsInitialized) {
        await this.initializeClients()
      }
    })
  }

  async initializeClients() {
    const provider = (await this.appKit?.getProvider("eip155")) as any
    const account = this.appKit?.getAccount()

    let chainId: number | undefined

    // for providers other then injected, we need to use eth_chainId
    if (provider && typeof provider.request === "function") {
      const chainIdHex = await provider.request({ method: "eth_chainId" })
      chainId = Number(chainIdHex)
    } else if (provider?.chainId) {
      chainId = Number(provider.chainId)
    }

    if (
      !chainId ||
      !this.supportedChains.includes(chainId as SupportedChains)
    ) {
      this.error = `Unsupported chain ID: ${chainId}. Supported chains are: ${this.supportedChains.join(", ")}`
      return
    }

    if (!provider || !account) return

    const isCelo = chainId === 42220
    const chain = isCelo ? celo : fuse
    this.chain = chainId as SupportedChains
    this.decimals = isCelo ? 18 : 2

    const pClient = createPublicClient({
      chain: chain,
      transport: custom(provider),
    }) as unknown as PublicClient

    const wClient = createWalletClient({
      account: account?.address as `0x${string}`,
      chain: chain,
      transport: custom(provider),
    })

    this.publicClient = pClient
    this.walletClient = wClient
    this.walletAddress = account.address as string | null

    this.clientsInitialized = true

    this.initializeSDK()
  }

  async initializeSDK() {
    if (!this.walletAddress || !this.publicClient || !this.walletClient) {
      this.error = "SDK initialization failed due to missing clients."
      return
    }

    try {
      const identitySDK = new IdentitySDK(
        this.publicClient,
        this.walletClient,
        this.environment,
      )
      const sdk = await ClaimSDK.init({
        publicClient: this.publicClient,
        walletClient: this.walletClient,
        identitySDK: identitySDK,
        env: this.environment,
      })

      this.claimSdk = sdk
      await this.fetchTokenBalance()
      this.fetchEntitlement(sdk)
    } catch (err: any) {
      this.error = err.message || "Failed to initialize ClaimSDK."
    }
  }

  async fetchEntitlement(sdk: ClaimSDK) {
    try {
      const amount = await sdk.checkEntitlement()
      this.claimAmount = Number(amount) / 10 ** this.decimals!

      if (this.claimAmount === 0) {
        const altChainId = this.chain === 122 ? 42220 : 122
        const altChain = altChainId === 122 ? fuse : celo

        const tempPublicClient = createPublicClient({
          chain: altChain,
          transport: http(rpcUrls[altChainId]),
        }) as PublicClient

        const claimOnAlt = await sdk.checkEntitlement(tempPublicClient)
        this.claimOnAlt = Number(claimOnAlt) > 0

        const nextTime = await sdk.nextClaimTime()
        this.startCountdownTimer(nextTime)
        this.claimState = "timer"
      } else {
        this.claimState = "idle"
      }
    } catch (err: any) {
      this.error = err.message || "Failed to fetch entitlement."
    }
  }

  async handleClaim() {
    if (!this.walletAddress) {
      this.error = "Wallet is not connected."
      return
    }

    this.claimState = "claiming"
    this.error = null
    this.txHash = null

    try {
      if (!this.claimSdk) {
        throw new Error("ClaimSDK is not initialized.")
      }

      const tx = await this.claimSdk.claim()

      if (tx) {
        this.txHash = tx.transactionHash
        this.claimState = "success"
        setTimeout(() => {
          this.claimState = "timer"
          this.fetchEntitlement(this.claimSdk!)
        }, 5000)
      }
    } catch (err: any) {
      this.error = err.message || "An unexpected error occurred."
      this.claimState = "idle"
    }
  }

  async fetchTokenBalance() {
    if (
      !this.publicClient ||
      !this.walletAddress ||
      !G$TokenAddresses ||
      !this.chain ||
      !this.decimals
    ) {
      console.warn(
        "Cannot fetch token balance: Missing public client, wallet/token address, or chain.",
      )
      return
    }

    try {
      const balanceResult = await this.publicClient.readContract({
        address: G$TokenAddresses[this.chain][
          this.environment
        ] as `0x${string}`,
        abi: goodDollarABI,
        functionName: "balanceOf",
        args: [this.walletAddress as `0x${string}`],
      })

      this.tokenBalance = Number(
        formatUnits(balanceResult, this.decimals),
      ).toFixed(2)

      this.error = null
    } catch (err: any) {
      console.error("Failed to fetch token balance:", err)
      this.error = `Failed to fetch token balance: ${err.shortMessage || err.message}`
      this.tokenBalance = null
    }
  }

  async switchChain() {
    try {
      this.claimState = "switching"
      const targetChain = this.chain === 122 ? celo : fuse
      await this.walletClient?.switchChain(targetChain)

      setTimeout(async () => {
        await this.initializeClients()
      }, 2000)
    } catch (err: any) {
      console.error("Failed to switch chain:", err)
      this.error = `Failed to switch chain: ${err.message}`
    }
  }

  openWalletModal() {
    if (this.appKit) {
      this.appKit
        .open()
        .then(async (data) => {
          await this.initializeClients()
        })
        .catch((error) => {
          console.error("Error opening appkit:", { error })
        })
    }
  }

  handleWalletDisconnect() {
    this.walletAddress = null
    this.claimAmount = null
    this.txHash = null
    this.error = null
    this.clearCountdownTimer()
  }

  private clearCountdownTimer() {
    if (this.countdownTimer) {
      clearInterval(this.countdownTimer)
      this.countdownTimer = null
    }
  }

  private startCountdownTimer(targetDate: Date) {
    this.clearCountdownTimer()
    const updateTimeLeft = () => {
      const diff = Math.floor((targetDate.getTime() - Date.now()) / 1000)
      this.timeLeft = diff > 0 ? diff : 0
      if (this.timeLeft === 0) {
        this.clearCountdownTimer()
        this.fetchEntitlement(this.claimSdk!)
      }
    }
    updateTimeLeft()
    this.countdownTimer = window.setInterval(updateTimeLeft, 1000)
  }

  private formatTimeLeft(seconds: number | null): string {
    if (seconds == null || seconds <= 0) return "00:00:00"
    const days = Math.floor(seconds / (60 * 60 * 24))
    const hours = Math.floor((seconds % (60 * 60 * 24)) / 3600)
    const mins = Math.floor((seconds % 3600) / 60)
    const secs = seconds % 60
    let parts = []
    if (days > 0) parts.push(String(days).padStart(2, "0"))
    parts.push(String(hours).padStart(2, "0"))
    parts.push(String(mins).padStart(2, "0"))
    parts.push(String(secs).padStart(2, "0"))
    return parts.join(":")
  }

  updated(changedProperties: any) {
    if (changedProperties.has("appkitConfig") && this.appkitConfig) {
      this.initializeAppKit()
    }

    if (changedProperties.has("claimState") && this.claimState === "success") {
      this.startConfetti()
    }
  }

  startConfetti() {
    this.confettiCanvas = this.shadowRoot!.querySelector(
      "#confetti-canvas",
    ) as HTMLCanvasElement
    if (!this.confettiCanvas) return
    this.confettiCtx = this.confettiCanvas.getContext("2d")
    if (!this.confettiCtx) return

    this.confettiCanvas.width = this.confettiCanvas.offsetWidth
    this.confettiCanvas.height = this.confettiCanvas.offsetHeight

    this.particles = []
    for (let i = 0; i < 20; i++) {
      this.particles.push({
        x: Math.random() * this.confettiCanvas.width,
        y: -Math.random() * this.confettiCanvas.height,
        vx: (Math.random() - 0.5) * 0.3,
        vy: Math.random() * 0.7 + 0.2,
        color: `hsla(${Math.random() * 360}, 60%, 85%, 0.5)`,
        size: Math.random() * 10 + 5,
        phase: Math.random() * Math.PI * 2,
        rotation: 0,
        rotationSpeed: (Math.random() - 0.5) * 0.05,
      })
    }

    let startTime = performance.now()
    const duration = 5000

    const animate = (currentTime: number) => {
      if (!this.confettiCanvas) return
      if (
        !this.confettiCtx ||
        this.claimState !== "success" ||
        !this.confettiCanvas ||
        currentTime - startTime > duration
      ) {
        this.confettiCtx?.clearRect(
          0,
          0,
          this.confettiCanvas.width,
          this.confettiCanvas.height,
        )
        return
      }

      this.confettiCtx.clearRect(
        0,
        0,
        this.confettiCanvas.width,
        this.confettiCanvas.height,
      )

      this.particles.forEach((p) => {
        if (!this.confettiCanvas || !this.confettiCtx) return
        p.y += p.vy
        p.rotation += p.rotationSpeed
        p.vy += 0.0008
        p.phase += 0.05
        p.vx = (Math.random() - 0.5) * 0.3 + Math.sin(p.phase) * 0.1
        p.x += p.vx
        if (p.y > this.confettiCanvas.height) {
          p.y = -p.size
          p.x = Math.random() * this.confettiCanvas.width
        }

        this.confettiCtx.save()
        this.confettiCtx.translate(p.x + p.size / 2, p.y + p.size / 2)
        this.confettiCtx.rotate(p.rotation)
        this.confettiCtx.fillStyle = p.color
        this.confettiCtx.beginPath()
        this.confettiCtx.rect(-p.size / 2, -p.size / 2, p.size, p.size)
        this.confettiCtx.fill()
        this.confettiCtx.restore()
      })

      requestAnimationFrame(animate)
    }

    requestAnimationFrame(animate)
  }

  render() {
    return html`
      <div class="claim-container">
        ${!this.walletAddress
          ? html`${this.claimState === "loading"
              ? html`
                  <button class="button connect-button" disabled>
                    <span>Connecting...</span>
                    <div
                      class="loader2"
                      style="display:inline-block;width:20px;height:20px;margin-left:8px;vertical-align:middle;"
                    ></div>
                  </button>
                `
              : html` <button
                  class="button connect-button"
                  @click="${this.openWalletModal}"
                >
                  Connect Wallet
                </button>`}`
          : html` <div class="connected-widget">
              <div class="wallet-details">
                <div class="detail-item" @click="${this.openWalletModal}">
                  <span class="label">Address:</span>
                  <span class="value"
                    >${this.walletAddress.slice(
                      0,
                      6,
                    )}...${this.walletAddress.slice(-4)}</span
                  >
                </div>
                <div class="detail-item">
                  <span class="label">Balance:</span>
                  <span class="value"
                    >${this.tokenBalance !== null ? this.tokenBalance : "N/A"}
                    G$</span
                  >
                </div>
              </div>
              ${this.claimState === "claiming"
                ? html` <div class="state-claiming">
                    <h2>Claiming...</h2>
                    <p>Please wait while we process your claim.</p>
                    <div class="loader"></div>
                  </div>`
                : this.claimState === "success"
                  ? html` <div class="state-success">
                      <h2>Claim Successful!</h2>
                      <p>You've claimed your GoodDollars.</p>
                      <canvas id="confetti-canvas"></canvas>
                    </div>`
                  : this.claimState === "timer"
                    ? html` <div class="state-timer">
                        <h2>Next Claim In</h2>
                        <div class="countdown">
                          ${this.formatTimeLeft(this.timeLeft)}
                        </div>
                        ${this.claimOnAlt
                          ? html`<p
                              class="chain-suggestion"
                              @click="${this.switchChain}"
                            >
                              Switch to ${this.chain === 122 ? "Celo" : "Fuse"}
                              to claim more G$</p
                            </p>`
                          : null}
                      </div>`
                    : html` <button
                        class="button claim-button"
                        @click="${this.handleClaim}"
                        ?disabled="${this.claimAmount === 0 ||
                        this.claimAmount === null}"
                      >
                        ${this.claimAmount === null
                          ? html`
                              <span>Loading...</span>
                              <div
                                class="loader2"
                                style="display:inline-block;width:20px;height:20px;margin-left:8px;vertical-align:middle;"
                              ></div>
                            `
                          : html` Claim UBI G$ ${this.claimAmount} `}
                      </button>`}
              ${this.txHash
                ? html`<div class="message success">
                    Transaction sent:
                    <a
                      href="https://celoscan.io/tx/${this.txHash}"
                      target="_blank"
                      class="tx-link"
                    >
                      ${this.txHash.slice(0, 6)}...${this.txHash.slice(-4)}
                    </a>
                  </div>`
                : ""}
              ${this.error
                ? html`<div class="message error">Error: ${this.error}</div>`
                : ""}
            </div>`}
        <div class="footer">
          <div class="powered-by">
            Powered by
            <a href="https://gooddollar.org" target="_blank" class="gd-link">
              <svg
                class="gd-icon"
                xmlns="http://www.w3.org/2000/svg"
                viewBox="0 0 1024 1024"
                preserveAspectRatio="xMidYMid meet"
              >
                <g id="surface1">
                  <path
                    style="stroke:none;fill-rule:nonzero;fill:rgb(4.705882%,14.901961%,23.921569%);fill-opacity:1;"
                    d="M 1024 512.007812 C 1024 794.777344 794.769531 1024.007812 512 1024.007812 C 229.230469 1024.007812 0 794.777344 0 512.007812 C 0 229.238281 229.230469 0.0078125 512 0.0078125 C 794.769531 0.0078125 1024 229.238281 1024 512.007812"
                  />
                  <path
                    style="stroke:none;fill-rule:nonzero;fill:rgb(100%,100%,100%);fill-opacity:1;"
                    d="M 681.605469 481.089844 L 555.796875 481.089844 L 480.960938 555.910156 L 681.605469 555.910156 C 664.546875 630.351562 599.289062 683.824219 522.945312 685.914062 C 446.605469 688.003906 378.515625 638.179688 357.410156 564.785156 C 336.304688 491.390625 367.527344 413.011719 433.320312 374.230469 C 499.109375 335.449219 582.804688 346.085938 636.800781 400.097656 L 663.75 373.121094 L 767.429688 269.433594 L 661.671875 269.433594 L 628.539062 302.601562 C 553.40625 264.363281 463.800781 267.894531 391.910156 311.933594 C 320.023438 355.96875 276.167969 434.1875 276.101562 518.492188 C 276.0625 556.769531 285.132812 594.503906 302.566406 628.578125 L 206.058594 725.039062 L 311.910156 725.039062 L 347.203125 689.742188 C 421.332031 763.863281 534.730469 781.878906 628.179688 734.382812 C 721.628906 686.886719 773.914062 584.660156 757.730469 481.089844 Z M 681.605469 481.089844"
                  />
                </g>
              </svg>
            </a>
          </div>
          <div class="footer-links">
            <a href="https://docs.goodollar.org" target="_blank">Learn More</a>
            <a href="https://www.gooddollar.org/privacy-policy" target="_blank"
              >Privacy Policy</a
            >
            <a href="https://www.gooddollar.org/terms-of-use" target="_blank"
              >Terms of Service</a
            >
          </div>
        </div>
      </div>
    `
  }
}

declare global {
  interface HTMLElementTagNameMap {
    "claim-button": ClaimButton
  }
}
