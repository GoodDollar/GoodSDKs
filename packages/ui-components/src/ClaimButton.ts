import { LitElement, html, css } from "lit"
import { customElement, property, state } from "lit/decorators.js"
import { createAppKit } from "@reown/appkit"
import type { AppKit, AppKitOptions } from "@reown/appkit"
import { celo as reownCelo, type AppKitNetwork } from "@reown/appkit/networks"
import { EthersAdapter } from "@reown/appkit-adapter-ethers"
import type { PublicClient, WalletClient } from "viem"
import { celo } from "viem/chains"
import {
  createPublicClient,
  createWalletClient,
  custom,
  formatUnits,
  parseAbi,
} from "viem"

import { ClaimSDK, IdentitySDK } from "@goodsdks/citizen-sdk"
import { G$TokenAddresses, goodDollarABI } from "./constant"

@customElement("claim-button")
export class ClaimButton extends LitElement {
  @property({ type: String })
  environment: "production" | "development" | "staging" = "development"

  @state() private isLoading = false
  @state() private error: string | null = null
  @state() private txHash: string | null = null
  @state() private claimAmount: number | null = null
  @state() private walletAddress: string | null = null
  @state() private tokenBalance: string | null = null

  private appKit: AppKit | null = null
  private publicClient: PublicClient | null = null
  private walletClient: WalletClient | null = null
  private claimSdk: ClaimSDK | null = null

  static styles = css`
    .button {
      background-color: var(--button-bg, #28a745);
      color: white;
      border: none;
      padding: 10px 20px;
      font-size: 16px;
      border-radius: 5px;
      cursor: pointer;
      transition: background-color 0.3s ease;
    }
    .button:disabled {
      background-color: #6c757d;
      cursor: not-allowed;
    }
    .button:hover:not(:disabled) {
      background-color: #218838;
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
    .connected-widget {
      display: flex;
      flex-direction: column;
      align-items: center;
    }
    .wallet-details {
      margin-bottom: 10px;
      font-size: 14px;
      color: white;
      font-family: Roboto;
      display: flex;
      justify-content: center;
      align-items: center;
      flex-direction: column;
    }
  `

  firstUpdated() {
    this.initializeAppKit()
  }

  updated(changedProperties: any) {
    console.log("Updated properties:", { changedProperties })
    console.log("appkit:", {
      appkit: this.appKit,
      publicClient: this.publicClient,
    })
  }

  async initializeAppKit() {
    const projectId = "71dd03d057d89d0af68a4c627ec59694"
    const metadata = {
      name: "AppKit",
      description: "AppKit Example",
      url: "https://example.com",
      icons: ["https://avatars.githubusercontent.com/u/179229932"],
    }
    const networks: [AppKitNetwork, ...AppKitNetwork[]] = [reownCelo]

    this.appKit = createAppKit({
      adapters: [new EthersAdapter()],
      basic: true,
      networks,
      projectId,
      metadata,
    } as AppKitOptions)

    this.appKit.subscribeEvents((event) =>
      console.log("appKit events", { data: event.data }),
    )

    this.appKit.subscribeAccount(async (account) => {
      if (account?.address) {
        await this.initializeClients()
      }
    })
  }

  async initializeClients() {
    const provider = (await this.appKit?.getProvider("eip155")) as any
    const account = this.appKit?.getAccount()
    if (!provider || !account) return

    const pClient = createPublicClient({
      chain: celo,
      transport: custom(provider),
    }) as unknown as PublicClient

    const wClient = createWalletClient({
      account: account?.address as `0x${string}`,
      chain: celo,
      transport: custom(provider),
    })

    this.publicClient = pClient
    this.walletClient = wClient
    this.walletAddress = account.address as string | null

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
      this.claimAmount = Number(amount) / 1e18
    } catch (err: any) {
      this.error = err.message || "Failed to fetch entitlement."
    }
  }

  async handleClaim() {
    if (!this.walletAddress) {
      this.error = "Wallet is not connected."
      return
    }

    this.isLoading = true
    this.error = null
    this.txHash = null

    try {
      if (!this.claimSdk) {
        throw new Error("ClaimSDK is not initialized.")
      }

      const tx = await this.claimSdk.claim()
      if (tx) {
        this.txHash = tx.transactionHash
      }
    } catch (err: any) {
      this.error = err.message || "An unexpected error occurred."
    } finally {
      this.isLoading = false
    }
  }

  async fetchTokenBalance() {
    if (!this.publicClient || !this.walletAddress || !G$TokenAddresses) {
      console.warn(
        "Cannot fetch token balance: Missing public client, wallet address, or token address.",
      )
      return
    }

    try {
      const decimals = 18

      const balanceResult = await this.publicClient.readContract({
        address: G$TokenAddresses[this.environment] as `0x${string}`,
        abi: goodDollarABI,
        functionName: "balanceOf",
        args: [this.walletAddress as `0x${string}`],
      })

      this.tokenBalance = Number(formatUnits(balanceResult, decimals)).toFixed(
        2,
      )

      this.error = null
    } catch (err: any) {
      console.error("Failed to fetch token balance:", err)
      this.error = `Failed to fetch token balance: ${err.shortMessage || err.message}`
      this.tokenBalance = null
    }
  }

  handleWalletDisconnect() {
    this.walletAddress = null
    this.claimAmount = null
    this.txHash = null
    this.error = null
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

  render() {
    return html`
      ${!this.walletAddress
        ? html`<button class="button" @click="${this.openWalletModal}">
            Connect Wallet
          </button>`
        : html`
            <div class="connected-widget">
              ${this.walletAddress
                ? html`<div class="wallet-details">
                    <span>Connected: ${this.walletAddress}</span>
                    <span>G$ Balance: ${this.tokenBalance}</span>
                  </div>`
                : ""}
              <button
                class="button"
                @click="${this.handleClaim}"
                ?disabled="${this.isLoading || this.claimAmount === 0}"
              >
                ${this.isLoading
                  ? "Claiming..."
                  : this.claimAmount === 0
                    ? "Come back tomorrow!"
                    : `Claim UBI ${this.claimAmount}`}
              </button>
            </div>
          `}
      ${this.txHash
        ? html`
            <div class="message success">
              Transaction sent:
              <a
                href="https://celoscan.io/tx/${this.txHash}"
                target="_blank"
                class="tx-link"
                >${this.txHash.slice(0, 6)}...${this.txHash.slice(-4)}</a
              >
            </div>
          `
        : ""}
      ${this.error
        ? html`<div class="message error">Error: ${this.error}</div>`
        : ""}
    `
  }
}

declare global {
  interface HTMLElementTagNameMap {
    "claim-button": ClaimButton
  }
}
