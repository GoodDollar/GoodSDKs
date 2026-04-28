import { useEffect, useState } from "react";
import { usePublicClient, useWalletClient } from "wagmi";
import type { PublicClient } from "viem";
import { GooddollarLiquiditySDK } from "./viem-sdk";

export function useGooddollarLiquidity() {
  const publicClient = usePublicClient() as PublicClient;
  const { data: walletClient } = useWalletClient();

  const [sdk, setSDK] = useState<GooddollarLiquiditySDK | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState<boolean>(false);

  useEffect(() => {
    if (!publicClient) {
      setSDK(null);
      setError("Public client not initialized");
      return;
    }

    setError(null);
    setLoading(true);

    try {
      const instance = new GooddollarLiquiditySDK(
        publicClient,
        walletClient ?? undefined,
      );
      setSDK(instance);
    } catch (err: any) {
      setError(err instanceof Error ? err.message : String(err));
      setSDK(null);
    } finally {
      setLoading(false);
    }
  }, [publicClient, walletClient]);

  return { sdk, loading, error };
}
