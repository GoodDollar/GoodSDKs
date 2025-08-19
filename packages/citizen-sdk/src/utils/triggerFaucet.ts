// GoodSDKs/packages/citizen-sdk/src/utils/triggerFaucet.ts
import type {
  Address,
  PublicClient,
  WalletClient,
  Chain,
  Account,
} from "viem"
import { waitForTransactionReceipt } from "viem/actions"
import { Envs, faucetABI, getGasPrice } from "../constants"

export type TriggerFaucetResult =
  | "skipped"               // throttled, not eligible, or balance sufficient
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
 * Checks if the user has sufficient balance to claim UBI.
 * @param chainId - The chain ID
 * @param account - User's wallet address
 * @param publicClient - Viem public client
 * @param faucetAddress - Faucet contract address
 * @param toppingAmount - Amount the faucet tops up
 * @param minTopping - Minimum topping percentage
 * @returns True if the user can claim, false otherwise.
 * @throws If gas price cannot be determined or balance check fails.
 */
async function canClaim(
  chainId: number,
  account: Address,
  publicClient: PublicClient,
  faucetAddress: Address,
  toppingAmount: bigint,
  minTopping: number
): Promise<boolean> {
  const gasPrice = getGasPrice(chainId)
  if (!gasPrice) {
    throw new Error(
      "Cannot determine gasPrice for the current connected chain.",
    )
  }

  const minBalance = (chainId === 42220 ? 250000n : 150000n) * gasPrice
  const minThreshold =
    (toppingAmount * (100n - BigInt(minTopping))) / 100n || minBalance

  const balance = await publicClient.getBalance({
    address: account,
  })

  return balance >= minThreshold
}

/**
 * Contract-first faucet top-up with API fallback and throttling.
 * 1) Check if user already has sufficient balance to claim
 * 2) If eligible (canTop && balance < toppingAmount), try on-chain top-up (user signs).
 * 3) Guard against gas > toppingAmount and insufficient gas to publish tx.
 * 4) If on-chain path fails or cannot publish/sign, fallback to backend /verify/topWallet.
 * 5) Throttle tops to once per chain per throttleMs via localStorage.
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
    alert("TX needs to be signed in order to claim.")

    const key = `goodDollarFaucetLastToppedUtcMs_${chainId}`
    const last = localStorage.getItem(key)
    if (last && Date.now() < Number(last) + throttleMs) {
      // Still check if balance is sufficient even if throttled
      try {
        const [canTop, toppingAmount, minTopping] = await Promise.all([
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
          publicClient.readContract({
            address: faucetAddress,
            abi: faucetABI,
            functionName: "minTopping",
            args: [],
            account,
          } as any) as Promise<number>,
        ])
        
        const hasGoodBalance = await canClaim(chainId, account, publicClient, faucetAddress, toppingAmount, minTopping)
        if (hasGoodBalance) {
          return "skipped"
        }
      } catch {
        // If we can't check balance, just return skipped due to throttling
      }
      return "skipped"
    }
  }

  try {
    // Read wallet balance + faucet eligibility/amount
    const [balance, canTop, toppingAmount, minTopping] = await Promise.all([
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
      publicClient.readContract({
        address: faucetAddress,
        abi: faucetABI,
        functionName: "minTopping",
        args: [],
        account,
      } as any) as Promise<number>,
    ])

    // Check if user already has sufficient balance using the canClaim logic
    const hasGoodBalance = await canClaim(chainId, account, publicClient, faucetAddress, toppingAmount, minTopping)
    
    // Skip if faucet won't top, already above threshold, or has sufficient balance for claiming
    if (!canTop || balance >= toppingAmount || hasGoodBalance) {
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