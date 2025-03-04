import {
  Address,
  PublicClient,
  WalletClient,
  parseAbi,
  SimulateContractParameters,
  WalletActions,
} from "viem";
import { waitForTransactionReceipt } from "viem/actions";
import { z } from "zod";
import { compressToEncodedURIComponent } from "lz-string";

import { Envs, FV_IDENTIFIER_MSG2 } from "./constants";

const identityV2ABI = parseAbi([
  "function addWhitelisted(address account)",
  "function removeWhitelisted(address account)",
  "function isWhitelisted(address account) view returns (bool)",
  "function lastAuthenticated(address account) view returns (uint256)",
  "function authenticationPeriod() view returns (uint256)",
]);

const addressSchema = z
  .string()
  .regex(/^0x[a-fA-F0-9]{40}$/, "Invalid Ethereum address");

interface IdentityContract {
  publicClient: PublicClient;
  contractAddress: Address;
  abi: any;
}

interface IdentityExpiryData {
  lastAuthenticated: bigint;
  authPeriod: bigint;
}

export const initializeIdentityContract = (
  publicClient: PublicClient,
  contractAddress: Address,
): IdentityContract => ({
  publicClient,
  contractAddress,
  abi: identityV2ABI,
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

    const receipt = await waitForTransactionReceipt(publicClient, { hash });

    if (!receipt) {
      throw new Error(`Transaction receipt not found for hash ${hash}`);
    }

    if (receipt.status !== "success") {
      throw new Error(`Transaction failed with status ${receipt.status}`);
    }

    return receipt;
  } catch (error: any) {
    console.error("submitAndWait Error:", error);
    throw new Error(`Failed to submit transaction: ${error.message}`);
  }
};

export const isWhitelisted = async (
  contract: IdentityContract,
  accountToCheck: Address,
): Promise<boolean> => {
  const validation = addressSchema.safeParse(accountToCheck);
  if (!validation.success) {
    throw new Error(
      `isWhitelisted Error: ${validation.error.issues.map((issue) => issue.message).join(", ")}`,
    );
  }

  try {
    const result = await contract.publicClient.readContract({
      address: contract.contractAddress,
      abi: contract.abi,
      functionName: "isWhitelisted",
      args: [accountToCheck],
    });

    if (typeof result !== "boolean") {
      throw new Error(
        `isWhitelisted Error: Expected boolean, received ${typeof result}`,
      );
    }

    return result;
  } catch (error: any) {
    console.error("isWhitelisted Error:", error);
    throw new Error(`Failed to check whitelist status: ${error.message}`);
  }
};

export const getIdentityExpiryData = async (
  contract: IdentityContract,
  account: Address,
): Promise<IdentityExpiryData> => {
  const validation = addressSchema.safeParse(account);
  if (!validation.success) {
    throw new Error(
      `getIdentityExpiryData Error: ${validation.error.issues.map((issue) => issue.message).join(", ")}`,
    );
  }

  try {
    const [lastAuthenticated, authPeriod] = await Promise.all([
      contract.publicClient.readContract({
        address: contract.contractAddress,
        abi: contract.abi,
        functionName: "lastAuthenticated",
        args: [account],
      }),
      contract.publicClient.readContract({
        address: contract.contractAddress,
        abi: contract.abi,
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
  callbackUrl?: string,
  popupMode: boolean = false,
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

    const {identityUrl} = Envs.development;
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
