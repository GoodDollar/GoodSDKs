import { useCallback } from "react";
import { usePublicClient, useWalletClient } from "wagmi";
import { Address, PublicClient, WalletClient, WalletActions } from "viem";

import {
  initializeIdentityContract,
  getWhitelistedRoot,
  generateFVLink,
  getIdentityExpiryData,
} from "./viem-sdk";

import type { IdentityContract, IdentityExpiryData } from "./types";
import { identityContractAddresses, contractEnv } from "./constants";

interface IdentitySDK {
  checkIsWhitelisted: (
    account: Address,
  ) => Promise<{ isWhitelisted: boolean; root: Address }>;
  generateFVLink: (
    callbackUrl?: string,
    popupMode?: boolean,
    chainId?: number,
  ) => Promise<string>;
  getIdentityExpiry: (
    account: Address,
  ) => Promise<IdentityExpiryData | undefined>;
}

export const useIdentitySDK = (
  env: contractEnv = "production",
): IdentitySDK => {
  const publicClient = usePublicClient() as PublicClient;
  const { data: walletClient } = useWalletClient();
  const contractAddress = identityContractAddresses[env];

  const contract = walletClient
    ? initializeIdentityContract(publicClient, contractAddress)
    : null;

  const checkIsWhitelisted = useCallback(
    async (
      account: Address,
    ): Promise<{ isWhitelisted: boolean; root: Address }> => {
      if (!publicClient || !contract) {
        throw new Error("Public client or contract not initialized.");
      }
      return await getWhitelistedRoot(contract, account);
    },
    [contract, publicClient],
  );

  /**
   * Generates a Face Verification Link.
   */
  const generateFVLinkHook = useCallback(
    async (
      callbackUrl?: string,
      popupMode: boolean = false,
      chainId?: number,
    ): Promise<string> => {
      if (!walletClient || !contract) {
        throw new Error("Wallet client or contract not initialized.");
      }
      return await generateFVLink(
        contract,
        walletClient,
        popupMode,
        callbackUrl,
        chainId,
      );
    },
    [contract, walletClient],
  );

  const getIdentityExpiry = useCallback(
    async (account: Address): Promise<IdentityExpiryData | undefined> => {
      if (!publicClient || !contract) {
        throw new Error("Public client or contract not initialized.");
      }

      try {
        const expiryData = await getIdentityExpiryData(contract, account);
        if (!expiryData) return undefined;

        return expiryData;
      } catch (error: any) {
        console.error("getIdentityExpiry Error:", error);
        throw new Error(`Failed to get identity expiry: ${error.message}`);
      }
    },
    [contract, publicClient],
  );

  return {
    checkIsWhitelisted,
    generateFVLink: generateFVLinkHook,
    getIdentityExpiry,
  };
};
