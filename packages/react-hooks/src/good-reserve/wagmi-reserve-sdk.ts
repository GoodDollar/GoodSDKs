import { useMemo } from "react"
import { usePublicClient, useWalletClient } from "wagmi"
import { type PublicClient } from "viem"
import { GoodReserveSDK, type ReserveEnv, type GoodReserveSDKOptions } from "@goodsdks/good-reserve"

/**
 * Gives you a ready-to-use `GoodReserveSDK` tied to the currently connected
 * wallet and chain. The SDK is only re-created when the client, wallet, env,
 * or exactApproval flag actually change — so you can safely pass an options
 * object literal on every render without blowing away the memo.
 *
 * If the connected chain doesn't have reserve endpoints for the chosen env
 * (e.g. XDC on production) the SDK will be null and `error` will tell you why.
 * Use `GoodReserveSDK.isChainEnvSupported(chainId, env)` to gate your UI
 * before the hook even tries to build the SDK.
 *
 * @example
 * const { sdk, error } = useGoodReserve("production")
 * if (error) return <p>{error}</p>
 * const quote = await sdk.getBuyQuote(cUSD, parseUnits("10", 18))
 */
export function useGoodReserve(env: ReserveEnv = "production", options?: GoodReserveSDKOptions) {
  const publicClient = usePublicClient() as PublicClient | undefined
  const { data: walletClient } = useWalletClient()

  // Pull out the primitive value so useMemo tracks it directly instead of
  // comparing the options object reference (which changes every render).
  const exactApproval = options?.exactApproval

  return useMemo(() => {
    if (!publicClient) {
      return { sdk: null, loading: true, error: null }
    }

    try {
      const sdk = new GoodReserveSDK(publicClient, walletClient ?? undefined, env, { exactApproval })
      return { sdk, loading: false, error: null }
    } catch (err) {
      return {
        sdk: null,
        loading: false,
        error: err instanceof Error ? err.message : String(err),
      }
    }
  }, [publicClient, walletClient, env, exactApproval])
}
