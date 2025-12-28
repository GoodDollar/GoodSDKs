import { Account, createWalletClient, http, PublicClient, Address } from "viem";
import { Envs, FV_IDENTIFIER_MSG2, identityV2ABI, contractEnv, chainConfigs, SupportedChains, isSupportedChain } from "../constants";
import { sdk } from "@farcaster/miniapp-sdk";

async function detectFarcasterContext(): Promise<boolean> {
  try {
    const ctx = await sdk.context;
    return !!(ctx.location && ctx.location.type != null);
  } catch {
    return false;
  }
}

export async function isInFarcasterMiniApp(): Promise<boolean> {
  if (typeof window === 'undefined') return false;
  try {
    return await sdk.isInMiniApp();
  } catch {
    return detectFarcasterContext();
  }
}

export async function canUseFarcasterNavigation(): Promise<boolean> {
  if (!await isInFarcasterMiniApp()) return false;
  try {
    const capabilities = await sdk.getCapabilities();
    return capabilities?.includes('actions.openUrl') ?? false;
  } catch {
    return false;
  }
}

export function isInFarcasterMiniAppSync(): boolean {
  if (typeof window === "undefined") return false;
  try {
    return window.self !== window.top;
  } catch {
    return false;
  }
}

export async function navigateToUrl(url: string, fallbackToNewTab = true): Promise<void> {
  if (typeof window === 'undefined') {
    throw new Error('Navigation not supported in this environment');
  }

  const isInFarcaster = await isInFarcasterMiniApp();

  if (isInFarcaster) {
    try {
      await sdk.actions.openUrl(url);
      return;
    } catch {
      window.open(url, '_blank');
      return;
    }
  }

  if (fallbackToNewTab) {
    window.open(url, '_blank');
  } else {
    window.location.href = url;
  }
}

export async function isAddressWhitelisted(
  address: Address,
  publicClient: PublicClient,
  chainId?: number,
  env: contractEnv = "production"
): Promise<boolean> {
  try {
    const targetChainId = chainId || await publicClient.getChainId();
    
    if (!isSupportedChain(targetChainId)) {
      return false;
    }
    
    const chainConfig = chainConfigs[targetChainId as SupportedChains];
    const identityContract = chainConfig?.contracts?.[env]?.identityContract;
    
    if (!identityContract) {
      return false;
    }
    
    const result = await publicClient.readContract({
      address: identityContract as Address,
      abi: identityV2ABI,
      functionName: "lastAuthenticated",
      args: [address],
    });
    
    return result ? BigInt(result) > 0n : false;
  } catch {
    return false;
  }
}

export interface FarcasterAppConfig {
  appId: string;
  appSlug: string;
}

export function createFarcasterUniversalLink(
  config: FarcasterAppConfig,
  subPath?: string,
  queryParams?: Record<string, string>
): string {
  let universalLink = `https://farcaster.xyz/miniapps/${config.appId}/${config.appSlug}`;
  
  if (subPath) {
    const cleanSubPath = subPath.startsWith('/') ? subPath.slice(1) : subPath;
    universalLink += `/${cleanSubPath}`;
  }
  
  if (queryParams && Object.keys(queryParams).length > 0) {
    const urlObj = new URL(universalLink);
    Object.entries(queryParams).forEach(([key, value]) => {
      urlObj.searchParams.set(key, value);
    });
    universalLink = urlObj.toString();
  }
  
  return universalLink;
}

/**
 * Creates a verification callback URL by appending a /verify sub-path and optional query parameters.
 * Used for non-Farcaster environments to construct callback URLs after face verification.
 * @param baseUrl - The base callback URL
 * @param additionalParams - Optional query parameters to include (e.g., verified=true, source)
 * @returns A callback URL with /verify sub-path and query parameters
 */
export async function createVerificationCallbackUrl(
  baseUrl: string,
  additionalParams?: Record<string, string>
): Promise<string> {
  const url = new URL(baseUrl);
  if (!url.protocol.startsWith("http")) {
    return baseUrl;
  }
  
  if (!url.pathname.includes('/verify') && !url.pathname.includes('/callback')) {
    url.pathname = url.pathname.endsWith('/')
      ? `${url.pathname}verify`
      : `${url.pathname}/verify`;
  }
  
  if (additionalParams) {
    Object.entries(additionalParams).forEach(([key, value]) => {
      url.searchParams.set(key, value);
    });
  }
  
  return url.toString();
}

export function createFarcasterCallbackUniversalLink(
  config: FarcasterAppConfig,
  callbackType: 'verify' | 'callback' | 'claim' = 'verify',
  additionalParams?: Record<string, string>
): string {
  return createFarcasterUniversalLink(config, callbackType, {
    source: "gooddollar_identity_verification",
    ...additionalParams
  });
}

async function signMessageWithViem(
  account: Account,
  message: string,
): Promise<string> {
  const walletClient = createWalletClient({
    account,
    transport: http(),
  });

  return walletClient.signMessage({ message });
}

export interface ParsedBody {
  ok?: number;
  success?: boolean;
  error?: string;
  [key: string]: any;
}

type SafeParseResult = {
  body: ParsedBody;
  error?: Error;
};

const safeParse = async (response: Response): Promise<SafeParseResult> => {
  try {
    const body = await response.json();
    return { body };
  } catch (error) {
    return { error: new Error("Failed to parse JSON response"), body: {} };
  }
};

export const g$Response = async (response: Response) => {
  const { body, error } = await safeParse(response);

  if (
    !response.ok ||
    error ||
    ("ok" in body && !body.ok) ||
    ("success" in body && !body.success)
  ) {
    throw error || new Error(body.error || "Unknown server error");
  }

  return body;
};

export const g$Request = (
  json: any,
  method: string = "POST",
  headers: Record<string, string> = {},
) => ({
  method,
  headers: { "Content-Type": "application/json", ...headers },
  body: JSON.stringify(json),
});

export const g$AuthRequest = (
  token: string,
  json: any,
  method: string = "POST",
) => g$Request(json, method, { Authorization: `Bearer ${token}` });

/**
 * Authenticates a user with the GoodDollar server.
 */
export async function fvAuth(
  env: string,
  signerOrAddress: string | Account,
  fvSig?: string,
): Promise<{ token: string; fvsig: string }> {
  const { backend } = Envs[env];
  const authEndpoint = `${backend}/auth/fv2`;

  let account: Account;
  let fvsig: string;

  if (typeof signerOrAddress === "string") {
    if (!fvSig) {
      throw new Error("fvSig is required when an address is provided.");
    }
    account = { address: signerOrAddress } as Account;
    fvsig = fvSig;
  } else {
    account = signerOrAddress;
    const message = FV_IDENTIFIER_MSG2.replace("<account>", account.address);
    fvsig = await signMessageWithViem(account, message);
  }

  const response = await fetch(
    authEndpoint,
    g$Request({ fvsig, account: account.address }),
  );
  const { token } = await g$Response(response);

  return { token, fvsig };
}
