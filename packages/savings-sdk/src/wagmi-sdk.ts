import { usePublicClient, useWalletClient } from "wagmi";
import { GooddollarSavingsSDK } from "./viem-sdk";

export function useGooddollarSavings() {
  const publicClient = usePublicClient();
  const { data: walletClient } = useWalletClient();

  if (!walletClient || !publicClient) {
    return;
  }

  const sdk = new GooddollarSavingsSDK(
    publicClient,
    walletClient,
  );

  return sdk;
}
