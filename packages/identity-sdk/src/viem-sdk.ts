import {
  Address,
  PublicClient,
  WalletClient,
  SimulateContractParameters,
  WalletActions,
} from "viem";
import { waitForTransactionReceipt } from "viem/actions";
import { z } from "zod";
import { compressToEncodedURIComponent } from "lz-string";

import { Envs, FV_IDENTIFIER_MSG2, identityV2ABI } from "./constants";

import type {
  IdentityContract,
  IdentityExpiryData,
  IdentityExpiry,
} from "./types";

const addressSchema = z
  .string()
  .regex(/^0x[a-fA-F0-9]{40}$/, "Invalid Ethereum address");

export const initializeIdentityContract = (
  publicClient: PublicClient,
  contractAddress: Address,
): IdentityContract => ({
  publicClient,
  contractAddress,
});

export const submitAndWait = async (
  params: SimulateContractParameters,
  publicClient: PublicClient,
  walletClient: WalletClient & WalletActions,
  onHash?: (hash: `0x${string}`) => void,
) => {
  try {
    const [account] = await walletClient.getAddresses();
    if (!account) throw new Error("No active wallet address found.");

    const { request } = await publicClient.simulateContract({
      account,
      ...params,
    });

    const hash = await walletClient.writeContract(request);
    onHash?.(hash);

    return waitForTransactionReceipt(publicClient, { hash });
  } catch (error: any) {
    console.error("submitAndWait Error:", error);
    throw new Error(`Failed to submit transaction: ${error.message}`);
  }
};
/* 
Returns whitelist status of main account or any connected account
see: https://docs.gooddollar.org/user-guides/connect-another-wallet-address-to-identity
**/
export const getWhitelistedRoot = async (
  contract: IdentityContract,
  account: Address,
): Promise<{ isWhitelisted: boolean; root: Address }> => {
  try {
    const root = await contract.publicClient.readContract({
      address: contract.contractAddress,
      abi: identityV2ABI,
      functionName: "getWhitelistedRoot",
      args: [account],
    });

    return {
      isWhitelisted: root !== "0x0000000000000000000000000000000000000000",
      root,
    };
  } catch (error: any) {
    console.error("getWhitelistedRoot Error:", error);
    throw new Error(`Failed to get whitelisted root: ${error.message}`);
  }
};

export const getIdentityExpiryData = async (
  contract: IdentityContract,
  account: Address,
): Promise<IdentityExpiryData> => {
  try {
    const [lastAuthenticated, authPeriod] = await Promise.all([
      contract.publicClient.readContract({
        address: contract.contractAddress,
        abi: identityV2ABI,
        functionName: "lastAuthenticated",
        args: [account],
      }),
      contract.publicClient.readContract({
        address: contract.contractAddress,
        abi: identityV2ABI,
        functionName: "authenticationPeriod",
        args: [],
      }),
    ]);

    if (
      typeof lastAuthenticated !== "bigint" ||
      typeof authPeriod !== "bigint"
    ) {
      throw new Error("Invalid data types returned from contract.");
    }

    return { lastAuthenticated, authPeriod };
  } catch (error: any) {
    console.error("getIdentityExpiryData Error:", error);
    throw new Error(
      `Failed to retrieve identity expiry data: ${error.message}`,
    );
  }
};

/**
 * Generates a Face Verification Link.
 */
export const generateFVLink = async (
  contract: IdentityContract,
  walletClient: WalletClient & WalletActions,
  popupMode: boolean = false,
  callbackUrl?: string,
  chainId?: number,
): Promise<string> => {
  try {
    const [address] = await walletClient.getAddresses();
    if (!address) throw new Error("No wallet address found.");

    const nonce = Math.floor(Date.now() / 1000).toString();

    const fvSigMessage = FV_IDENTIFIER_MSG2.replace("<account>", address);
    const fvSig = await walletClient.signMessage({
      account: address,
      message: fvSigMessage,
    });

    const { identityUrl } = Envs.development;
    if (!identityUrl) {
      throw new Error("identityUrl is not defined in environment settings.");
    }

    if (!fvSig) {
      throw new Error("Missing signature for Face Verification.");
    }

    if (!popupMode && !callbackUrl) {
      throw new Error("Callback URL is required for redirect mode.");
    }

    const url = new URL(identityUrl);
    const params: Record<string, string | number> = {
      account: address,
      nonce,
      fvsig: fvSig,
      chain: chainId || (await contract.publicClient.getChainId()),
    };

    if (callbackUrl) {
      params[popupMode ? "cbu" : "rdu"] = callbackUrl;
    }

    url.searchParams.append(
      "lz",
      compressToEncodedURIComponent(JSON.stringify(params)),
    );
    return url.toString();
  } catch (error: any) {
    console.error("generateFVLink Error:", error);
    throw new Error(
      `Failed to generate Face Verification link: ${error.message}`,
    );
  }
};

export const calculateIdentityExpiry = (
  lastAuthenticated: bigint,
  authPeriod: bigint,
): IdentityExpiry => {
  const MS_IN_A_SECOND = 1000;
  const MS_IN_A_DAY = 24 * 60 * 60 * MS_IN_A_SECOND;

  const periodInMs = authPeriod * BigInt(MS_IN_A_DAY);
  const expiryTimestamp =
    lastAuthenticated * BigInt(MS_IN_A_SECOND) + periodInMs;

  return {
    authPeriod,
    expiryTimestamp,
    lastAuthenticated,
  };
};
