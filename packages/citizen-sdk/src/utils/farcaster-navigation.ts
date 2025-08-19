import { isInFarcasterMiniApp, createUniversalLinkCallback } from "./auth";
import { sdk } from '@farcaster/miniapp-sdk';

/**
 * Shared navigation utility for Farcaster miniapp integration
 * Combines universal link generation and smart navigation logic
 */
export class FarcasterNavigationHelper {


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
    // Force popup mode for Farcaster since it always opens in new tab/window
    const shouldUseFarcaster = forceFarcasterNavigation ?? await isInFarcasterMiniApp();
    const effectivePopupMode = shouldUseFarcaster ? true : popupMode;
    
    // Enhance the link with universal link callback if provided
    let enhancedLink = fvLink;
    if (callbackUrl) {
      const universalCallbackUrl = createUniversalLinkCallback(callbackUrl, {
        source: "gooddollar_identity_verification"
      });
      
      const url = new URL(fvLink);
      url.searchParams.set(effectivePopupMode ? "cbu" : "rdu", universalCallbackUrl);
      enhancedLink = url.toString();
    }

    // Use smart navigation based on environment
    if (shouldUseFarcaster) {
      await this.openUrlInFarcaster(enhancedLink);
    } else {
      // Standard navigation
      if (effectivePopupMode) {
        window.open(enhancedLink, "_blank");
      } else {
        window.location.href = enhancedLink;
      }
    }
  }

  /**
   * Open URL using Farcaster SDK with fallback
   */
  private async openUrlInFarcaster(url: string): Promise<void> {
    try {
      await sdk.actions.ready();
      await sdk.actions.openUrl(url);
    } catch (error) {
      console.warn("Failed to use Farcaster SDK openUrl, falling back:", error);
      // Fallback to popup since Farcaster context expects new window
      window.open(url, "_blank");
    }
  }
}

// Export a singleton instance for convenience
export const farcasterNavigation = new FarcasterNavigationHelper();

