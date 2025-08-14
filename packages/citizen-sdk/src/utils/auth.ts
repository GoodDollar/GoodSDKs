import { Account, createWalletClient, http } from "viem";
import { Envs, FV_IDENTIFIER_MSG2 } from "../constants";

/**
 * Detects if the SDK is running inside a Farcaster miniapp using the official SDK
 */
export async function isInFarcasterMiniApp(timeoutMs: number = 100): Promise<boolean> {
  if (typeof window === "undefined") return false;
  
  try {
    // Use the official Farcaster SDK for detection
    const { sdk } = await import('@farcaster/miniapp-sdk');
    return await sdk.isInMiniApp();
  } catch (error) {
    // Fallback detection if SDK fails
    console.warn('Farcaster SDK detection failed, using fallback:', error);
    
    // Fallback: Check if context exists (indicates we're in a miniapp)
    try {
      const { sdk } = await import('@farcaster/miniapp-sdk');
      const context = await sdk.context;
      const location = context.location;
      return !!(location && location.type !== undefined);
    } catch (fallbackError) {
      console.warn('Farcaster SDK context check failed:', fallbackError);
      return false;
    }
  }
}

/**
 * Synchronous version for backwards compatibility
 * Note: This uses basic detection and should be replaced with async version when possible
 */
export function isInFarcasterMiniAppSync(): boolean {
  if (typeof window === "undefined") return false;
  
  try {
    // Basic detection without the async SDK call
    return (
      window.location.href.includes("farcaster") ||
      window.location.href.includes("miniapp") ||
      // Check if we're in an iframe which is common for miniapps
      window.self !== window.top
    );
  } catch (error) {
    return false;
  }
}

/**
 * Opens a URL using Farcaster's official SDK capabilities
 * @param url - The URL to open
 * @param fallbackToNewTab - Whether to open in new tab as fallback (default: true)
 */
export async function openUrlInFarcaster(url: string, fallbackToNewTab: boolean = true): Promise<void> {
  if (typeof window === "undefined") {
    throw new Error("URL opening is only supported in browser environments.");
  }

  const isMiniApp = await isInFarcasterMiniApp();
  
  if (isMiniApp) {
    try {
      // Use the official Farcaster SDK
      const { sdk } = await import('@farcaster/miniapp-sdk');
      
      // Signal that the app is ready before any navigation
      await sdk.actions.ready();
      
      // Use the official openUrl method for external URLs
      // This handles deeplinking and proper navigation in Farcaster context
      // According to docs: can pass URL as string or object
      await sdk.actions.openUrl(url);
      return;
    } catch (error) {
      console.warn("Failed to use Farcaster SDK openUrl, falling back:", error);
    }
  }

  // Fallback to standard navigation for non-Farcaster environments
  if (fallbackToNewTab) {
    window.open(url, "_blank");
  } else {
    window.location.href = url;
  }
}

/**
 * Handles the verification response from face verification
 * @param url - The current URL or callback URL to parse
 * @returns Object containing verification status and any additional parameters
 */
export function handleVerificationResponse(url?: string): {
  isVerified: boolean;
  params: URLSearchParams;
  verified?: string;
} {
  const targetUrl = url || (typeof window !== "undefined" ? window.location.href : "");
  const urlObj = new URL(targetUrl);
  const params = urlObj.searchParams;
  const verified = params.get("verified");
  
  return {
    isVerified: verified === "true",
    verified: verified || undefined,
    params
  };
}

/**
 * Creates a universal link compatible callback URL for mobile/native app support
 * @param baseUrl - The base callback URL
 * @param additionalParams - Additional parameters to include
 * @returns A universal link compatible URL
 */
export function createUniversalLinkCallback(
  baseUrl: string, 
  additionalParams?: Record<string, string>
): string {
  const url = new URL(baseUrl);
  
  // Add universal link indicators
  if (!url.protocol.startsWith("http")) {
    // If it's already a custom scheme, return as-is
    return baseUrl;
  }
  
  // Add additional parameters if provided
  if (additionalParams) {
    Object.entries(additionalParams).forEach(([key, value]) => {
      url.searchParams.set(key, value);
    });
  }
  
  return url.toString();
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
