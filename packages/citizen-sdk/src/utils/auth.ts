import { Account, createWalletClient, http, PublicClient, Address } from "viem";
import { Envs, FV_IDENTIFIER_MSG2, identityV2ABI, contractAddresses, contractEnv } from "../constants";
import { sdk } from "@farcaster/miniapp-sdk";

// new helper for the fallback context check
async function fallbackDetect(): Promise<boolean> {
  try {
    const ctx = await sdk.context;
    return !!(ctx.location && ctx.location.type != null);
  } catch {
    return false;
  }
}

export async function isInFarcasterMiniApp(timeoutMs = 100): Promise<boolean> {
  if (typeof window === 'undefined') return false;
  try {
    return await sdk.isInMiniApp();
  } catch {
    console.warn('SDK failed, trying context fallback…');
    return fallbackDetect();
  }
}

/**
 * Gets Farcaster SDK capabilities for the current miniapp
 * @returns Promise<string[] | null> - Available capabilities or null if not in miniapp
 */
export async function getFarcasterCapabilities(): Promise<string[] | null> {
  if (!await isInFarcasterMiniApp()) return null;
  try {
    return await sdk.getCapabilities();
  } catch (error) {
    console.warn('Failed to get Farcaster capabilities:', error);
    return null;
  }
}

/**
 * Checks if Farcaster navigation is available
 * @returns Promise<boolean> - true if openUrl action is supported
 */
export async function canUseFarcasterNavigation(): Promise<boolean> {
  const capabilities = await getFarcasterCapabilities();
  return capabilities?.includes('actions.openUrl') ?? false;
}

/**
 * Synchronous version for backwards compatibility
 * Note: This uses basic detection and should be replaced with async version when possible
 */
export function isInFarcasterMiniAppSync(): boolean {
  if (typeof window === "undefined") return false;
  
  try {
    // Basic detection without the async SDK call
    // Only check if we're in an iframe which is common for miniapps
    return window.self !== window.top;
  } catch (error) {
    return false;
  }
}

/**
 * Farcaster-aware URL navigation with capability detection
 * @param url - The URL to navigate to
 * @param fallbackToNewTab - Whether to open in new tab as fallback
 */
export async function navigateToUrl(url: string, fallbackToNewTab = true): Promise<void> {
  if (typeof window === 'undefined') {
    throw new Error('Navigation not supported in this environment');
  }

  // Try Farcaster navigation first if available
  if (await isInFarcasterMiniApp() && await canUseFarcasterNavigation()) {
    try {
      await sdk.actions.ready();
      await sdk.actions.openUrl(url);
      return;
    } catch (error) {
      console.warn('Farcaster navigation failed, falling back to browser:', error);
    }
  }

  // Fallback to standard browser navigation
  if (fallbackToNewTab) {
    window.open(url, '_blank');
  } else {
    window.location.href = url;
  }
}

export async function openUrlInFarcaster(
  url: string,
  fallbackToNewTab = true
): Promise<void> {
  return navigateToUrl(url, fallbackToNewTab);
}

/**
 * Checks if a wallet address is whitelisted on-chain
 * @param address - The wallet address to check
 * @param publicClient - The viem public client for blockchain queries
 * @param chainId - Optional chain ID (defaults to client's chain)
 * @param env - Environment to determine contract address
 * @returns Promise<boolean> - true if address is whitelisted
 */
export async function isAddressWhitelisted(
  address: Address,
  publicClient: PublicClient,
  chainId?: number,
  env: contractEnv = "production"
): Promise<boolean> {
  try {
    const targetChainId = chainId || await publicClient.getChainId();
    const identityContract = contractAddresses[targetChainId as keyof typeof contractAddresses]?.[env]?.identityContract;
    
    if (!identityContract) {
      console.warn('Identity contract not found for chain:', targetChainId, 'env:', env);
      return false;
    }
    
    const result = await publicClient.readContract({
      address: identityContract as Address,
      abi: identityV2ABI,
      functionName: "lastAuthenticated",
      args: [address],
    });
    
    // If lastAuthenticated returns a timestamp > 0, the address is whitelisted
    return result ? BigInt(result) > 0n : false;
  } catch (error) {
    console.warn('Failed to check address whitelist status:', error);
    return false;
  }
}

/**
 * Enhanced verification response handler that supports both URL params and on-chain verification
 * @param url - The current URL or callback URL to parse
 * @param address - Optional wallet address to check on-chain verification
 * @param publicClient - Optional viem public client for on-chain checks
 * @param chainId - Optional chain ID for on-chain checks
 * @param env - Environment for contract resolution
 * @returns Object containing verification status and any additional parameters
 */
export async function handleVerificationResponse(
  url?: string,
  address?: Address,
  publicClient?: PublicClient,
  chainId?: number,
  env: contractEnv = "production"
): Promise<{
  isVerified: boolean;
  params: URLSearchParams;
  verified?: string;
  onChainVerified?: boolean;
}> {
  const defaultResult = {
    isVerified: false,
    params: new URLSearchParams(),
    verified: undefined,
    onChainVerified: undefined,
  };

  try {
    // Get URL from Farcaster context or provided parameter
    let targetUrl = url;
    
    if (!targetUrl) {
      if (await isInFarcasterMiniApp()) {
        // Use Farcaster SDK to get current context
        try {
          const context = await sdk.context;
          // Farcaster context doesn't have href, fallback to window
          if (typeof window !== "undefined") {
            targetUrl = window.location.href;
          }
        } catch (error) {
          console.warn('Failed to get Farcaster context:', error);
          if (typeof window !== "undefined") {
            targetUrl = window.location.href;
          }
        }
      } else if (typeof window !== "undefined") {
        targetUrl = window.location.href;
      }
    }
    
    if (!targetUrl) {
      // If no URL, check on-chain only
      if (address && publicClient) {
        const onChainVerified = await isAddressWhitelisted(address, publicClient, chainId, env);
        return {
          ...defaultResult,
          isVerified: onChainVerified,
          onChainVerified,
        };
      }
      return defaultResult;
    }

    const urlObj = new URL(targetUrl);
    const params = urlObj.searchParams;
    const verified = params.get("verified");
    const urlVerified = verified === "true";
    
    // For popup mode (cbu), check on-chain verification since no redirect occurs
    let onChainVerified: boolean | undefined;
    if (address && publicClient) {
      onChainVerified = await isAddressWhitelisted(address, publicClient, chainId, env);
    }
    
    // Verification is true if either URL param says so OR on-chain check passes
    const isVerified = urlVerified || (onChainVerified ?? false);
    
    return {
      isVerified,
      verified: verified || undefined,
      params,
      onChainVerified
    };
  } catch (error) {
    console.warn('Failed to parse verification response URL:', error);
    return defaultResult;
  }
}

/**
 * Legacy synchronous version for backwards compatibility
 * @deprecated Use the async handleVerificationResponse instead for better verification support
 */
export function handleVerificationResponseSync(url?: string): {
  isVerified: boolean;
  params: URLSearchParams;
  verified?: string;
} {
  const defaultResult = {
    isVerified: false,
    params: new URLSearchParams(),
    verified: undefined,
  };

  try {
    // For sync version, fallback to window.location.href
    const targetUrl = url || (typeof window !== "undefined" ? window.location.href : "");
    if (!targetUrl) return defaultResult;

    const urlObj = new URL(targetUrl);
    const params = urlObj.searchParams;
    const verified = params.get("verified");
    
    return {
      isVerified: verified === "true",
      verified: verified || undefined,
      params
    };
  } catch (error) {
    console.warn('Failed to parse verification response URL:', error);
    return defaultResult;
  }
}

/**
 * Creates a Farcaster-compatible callback URL
 * @param baseUrl - The base callback URL
 * @param additionalParams - Additional parameters to include
 * @returns A Farcaster-compatible callback URL
 */
export function createFarcasterCallbackUrl(
  baseUrl: string, 
  additionalParams?: Record<string, string>
): string {
  const url = new URL(baseUrl);
  
  // Add universal link indicators
  if (!url.protocol.startsWith("http")) {
    // If it's already a custom scheme, return as-is
    return baseUrl;
  }
  
  // For Farcaster miniapps, ensure the URL structure is compatible
  // Add a sub-path for verification callback if not already present
  if (!url.pathname.includes('/verify') && !url.pathname.includes('/callback')) {
    url.pathname = url.pathname.endsWith('/') 
      ? `${url.pathname}verify` 
      : `${url.pathname}/verify`;
  }
  
  // Add additional parameters if provided
  if (additionalParams) {
    Object.entries(additionalParams).forEach(([key, value]) => {
      url.searchParams.set(key, value);
    });
  }
  
  // Ensure the URL is properly formatted for Farcaster Universal Links
  return url.toString();
}

/**
 * Creates a universal link compatible callback URL for mobile/native app support
 * Enhanced for Farcaster miniapp compatibility with proper sub-path handling
 * @param baseUrl - The base callback URL
 * @param additionalParams - Additional parameters to include
 * @returns A universal link compatible URL
 */
export function createUniversalLinkCallback(
  baseUrl: string, 
  additionalParams?: Record<string, string>
): string {
  return createFarcasterCallbackUrl(baseUrl, additionalParams);
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
