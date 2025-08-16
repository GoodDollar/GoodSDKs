import { loadFarcasterSdk, isInFarcasterMiniApp } from "./auth";

/**
 * Shared navigation utility for Farcaster miniapp integration
 * Combines universal link generation and smart navigation logic
 */
export class FarcasterNavigationHelper {
  /**
   * Create a universal link compatible callback URL
   */
  private createUniversalLinkCallback(
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

  /**
   * Navigate to face verification with automatic Farcaster detection
   * @param fvLink - The face verification link to navigate to
   * @param popupMode - Whether to use popup mode
   * @param callbackUrl - Optional callback URL for universal link support
   */
  async navigateToFaceVerification(
    fvLink: string,
    popupMode: boolean = false,
    callbackUrl?: string,
    forceFarcasterNavigation?: boolean
  ): Promise<void> {
    // Enhance the link with universal link callback if provided
    let enhancedLink = fvLink;
    if (callbackUrl) {
      const universalCallbackUrl = this.createUniversalLinkCallback(callbackUrl, {
        source: "gooddollar_identity_verification"
      });
      
      const url = new URL(fvLink);
      url.searchParams.set(popupMode ? "cbu" : "rdu", universalCallbackUrl);
      enhancedLink = url.toString();
    }

    // Use smart navigation based on environment
    const shouldUseFarcaster = forceFarcasterNavigation ?? await isInFarcasterMiniApp();
    
    if (shouldUseFarcaster) {
      await this.openUrlInFarcaster(enhancedLink, !popupMode);
    } else {
      // Standard navigation
      if (typeof window !== "undefined") {
        if (popupMode) {
          window.open(enhancedLink, "_blank");
        } else {
          window.location.href = enhancedLink;
        }
      } else {
        throw new Error(
          "Face verification navigation is only supported in browser environments."
        );
      }
    }
  }

  /**
   * Open URL using Farcaster SDK with fallback
   */
  private async openUrlInFarcaster(
    url: string, 
    fallbackToNewTab: boolean = true
  ): Promise<void> {
    if (typeof window === "undefined") {
      throw new Error("URL opening is only supported in browser environments.");
    }

    try {
      const sdk = await loadFarcasterSdk();
      await sdk.actions.ready();
      await sdk.actions.openUrl(url);
    } catch (error) {
      console.warn("Failed to use Farcaster SDK openUrl, falling back:", error);
      // Fallback to standard navigation
      fallbackToNewTab ? window.open(url, "_blank") : (window.location.href = url);
    }
  }
}

// Export a singleton instance for convenience
export const farcasterNavigation = new FarcasterNavigationHelper();

