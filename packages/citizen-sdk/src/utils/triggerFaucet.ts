// GoodSDKs/packages/citizen-sdk/src/utils/triggerFaucet.ts
import type {
    Address,
    PublicClient,
    WalletClient,
    Chain,
    Account,
  } from "viem"
  import { waitForTransactionReceipt } from "viem/actions"
  import { Envs, faucetABI } from "../constants"
  
  export type TriggerFaucetResult =
    | "skipped"               // throttled or not eligible
    | "topped_via_contract"   // success via on-chain call
    | "topped_via_api"        // success via backend fallback
    | "error"                 // tried and failed
  
  export interface TriggerFaucetParams {
    chainId: number
    account: Address
    publicClient: PublicClient
    walletClient: WalletClient<any, Chain | undefined, Account | undefined>
    faucetAddress: Address
    env: string // "production" | "staging" | etc.
    throttleMs?: number // default 1h
  }
  
  /**
   * Contract-first faucet top-up with API fallback and throttling.
   * 1) If eligible (canTop && balance < toppingAmount), try on-chain top-up (user signs).
   * 2) Guard against gas > toppingAmount and insufficient gas to publish tx.
   * 3) If on-chain path fails or cannot publish/sign, fallback to backend /verify/topWallet.
   * 4) Throttle tops to once per chain per throttleMs via localStorage.
   */
  export async function triggerFaucet({
    chainId,
    account,
    publicClient,
    walletClient,
    faucetAddress,
    env,
    throttleMs = 60 * 60 * 1000,
  }: TriggerFaucetParams): Promise<TriggerFaucetResult> {
    // Throttle via localStorage (browser env only)
    if (typeof localStorage !== "undefined") {
      const key = `goodDollarFaucetLastToppedUtcMs_${chainId}`
      const last = localStorage.getItem(key)
      if (last && Date.now() < Number(last) + throttleMs) {
        return "skipped"
      }
    }
  
    try {
      // Read wallet balance + faucet eligibility/amount
      const [balance, canTop, toppingAmount] = await Promise.all([
        publicClient.getBalance({ address: account }),
        publicClient.readContract({
          address: faucetAddress,
          abi: faucetABI,
          functionName: "canTop",
          args: [account],
          account,
        } as any) as Promise<boolean>,
        publicClient.readContract({
          address: faucetAddress,
          abi: faucetABI,
          functionName: "getToppingAmount",
          args: [],
          account,
        }) as Promise<bigint>,
      ])
  
      // Skip if faucet won't top or already above threshold
      if (!canTop || balance >= toppingAmount) {
        if (typeof localStorage !== "undefined") {
          localStorage.setItem(
            `goodDollarFaucetLastToppedUtcMs_${chainId}`,
            String(Date.now()),
          )
        }
        return "skipped"
      }
  
      // Simulate faucet call for gas estimate + revert check
      const { request } = await publicClient.simulateContract({
        address: faucetAddress,
        abi: faucetABI,
        functionName: "topWallet",
        args: [account],
        account,
        chain: walletClient.chain,
      })
  
      // Optional guards: gas should be payable and <= toppingAmount
      const gasLimit: bigint | undefined = (request as any)?.gas
      if (typeof gasLimit === "bigint") {
        if (balance < gasLimit) throw new Error("Not enough balance to pay for gas")
        if (gasLimit > toppingAmount) throw new Error("Gas limit exceeds topping amount")
      }
  
      // Send tx (user signs)
      const hash = await walletClient.writeContract(request)
  
      // Small delay before polling
      await new Promise((r) => setTimeout(r, 2000))
  
      await waitForTransactionReceipt(publicClient, {
        hash,
        retryDelay: 3000,
      })
  
      if (typeof localStorage !== "undefined") {
        localStorage.setItem(
          `goodDollarFaucetLastToppedUtcMs_${chainId}`,
          String(Date.now()),
        )
      }
      return "topped_via_contract"
    } catch {
      // Fallback to backend API
      try {
        const { backend } = Envs[env as keyof typeof Envs] || {}
        if (!backend) return "error"
  
        const response = await fetch(`${backend}/verify/topWallet`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ chainId, account }),
        })
  
        if (!response.ok) return "error"
  
        if (typeof localStorage !== "undefined") {
          localStorage.setItem(
            `goodDollarFaucetLastToppedUtcMs_${chainId}`,
            String(Date.now()),
          )
        }
        return "topped_via_api"
      } catch {
        return "error"
      }
    }
  }
  