import { useCallback } from "react";
import { usePublicClient, useWalletClient } from "wagmi";
import { Address, PublicClient } from "viem";
import {
  initializeIdentityContract,
  isWhitelisted,
  generateFVLink,
  getIdentityExpiryData,
} from "./viem-sdk";

interface IdentitySDK {
  checkIsWhitelisted: (account: Address) => Promise<boolean>;
  generateFVLink: (
    callbackUrl?: string,
    popupMode?: boolean,
    chainId?: number,
  ) => Promise<string>;
  getIdentityExpiry: (account: Address) => Promise<IdentityExpiry | undefined>;
}

interface IdentityExpiry {
  authPeriod: bigint;
  expiryTimestamp: bigint;
  formattedExpiryTimestamp?: string;
  lastAuthenticated: bigint;
}

export const useIdentitySDK = (contractAddress: Address): IdentitySDK => {
  const publicClient = usePublicClient() as PublicClient;
  const { data: walletClient } = useWalletClient();

  const contract = walletClient
    ? initializeIdentityContract(publicClient, contractAddress)
    : null;

  const checkIsWhitelisted = useCallback(
    async (account: Address): Promise<boolean> => {
      if (!publicClient || !contract) {
        throw new Error("Public client or contract not initialized.");
      }
      return await isWhitelisted(contract, account);
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
        callbackUrl,
        popupMode,
        chainId,
      );
    },
    [contract, walletClient],
  );

  const getIdentityExpiry = useCallback(
    async (account: Address): Promise<IdentityExpiry | undefined> => {
      if (!publicClient || !contract) {
        throw new Error("Public client or contract not initialized.");
      }

      try {
        const expiryData = await getIdentityExpiryData(contract, account);
        if (!expiryData) return undefined;

        const { lastAuthenticated, authPeriod } = expiryData;
        const expiryTimestamp = lastAuthenticated + authPeriod;

        const date = new Date(Number(expiryTimestamp) * 1000);
        const formattedExpiryTimestamp = date.toLocaleDateString("en-US", {
          year: "numeric",
          month: "long",
          day: "2-digit",
        });

        return {
          authPeriod,
          expiryTimestamp,
          formattedExpiryTimestamp,
          lastAuthenticated,
        };
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
