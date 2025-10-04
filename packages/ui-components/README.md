# Claim Button Web Component

The `claim-button` web component provides a simple and interactive way for users to claim Universal Basic Income (UBI) in the form of GoodDollars (G$) on supported blockchain networks (Celo, Fuse, and XDC). It integrates with the GoodDollar ecosystem to manage wallet connections, eligibility checks, and token claims, offering a seamless experience for users within any web application.

## What It Does

The `claim-button` enables users to:

- Connect their cryptocurrency wallet (via Reown AppKit).
- Check their eligibility to claim G$ tokens based on the GoodDollar protocol.
- If this is a new user, they will be guided through our [Face-Verification flow](https://docs.gooddollar.org/about-the-protocol/sybil-resistance)
- Claim their UBI with a single click, handling all blockchain transactions.
- View their G$ token balance.
- See a countdown timer until their next claim if they’ve already claimed for the current period.
- Switch between supported chains (Celo, Fuse, and XDC) if entitlements are available on another network.

## How to Use It

You can integrate the `claim-button` into your project in two ways:

### Option 1: Using the Standalone Script

Can be used in any website, for a quick setup:

1. **Download the Script**: Download the `claim-button.global.js` file from the project releases or build it from the source.
2. **Include in HTML**: Add the script to your HTML file.
3. **Add the Component**: Use the `<claim-button>` tag where you want it to appear.

```html
<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Claim Button Example</title>
  </head>
  <body>
    <claim-button id="claimBtn" environment="production"></claim-button>
    <script src="path/to/claim-button.global.js"></script>
    <script type="module">
      // Wait for the component to be defined
      customElements.whenDefined("claim-button").then(() => {
        const claimBtn = document.getElementById("claimBtn")
        claimBtn.appkitConfig = {
          projectId: "71dd03d057d89d0af68a4c627ec59694",
          metadata: {
            name: "AppKit",
            description: "AppKit Example",
            url: "https://example.com",
            icons: ["https://avatars.githubusercontent.com/u/179229932"],
          },
        }
      })
    </script>
  </body>
</html>
```

### Option 2: Using ESM Modules

**Note:**: see above example for the metadata configuration, for simplicity removed from
below examples.

For projects with a modern JavaScript setup:

1. **Install the Package**: Add the `@goodsdks/ui-components` package to your project.
   ```bash
   npm install @goodsdks/ui-components
   ```
2. **Import the Component**: Import it in your JavaScript or TypeScript file.
   ```javascript
   import "@goodsdks/ui-components"
   ```
3. **For use in HTML**: Place the `<claim-button>` tag in your template.
   ```html
   <claim-button environment="production"></claim-button>
   ```
4. **For use in React**": Place the `<claim-button>` tag in your render method.
   ```javascript
   render(<claim-button environment="production"></claim-button>)
   ```

## Configurable Options

Customize the `claim-button` using these properties:

- **`environment`**: Defines the environment for contract interactions.
  - Values: `"production"`, `"staging"`, or `"development"`.
  - Default: `"development"`.
  - Example:
    ```html
    <claim-button environment="production"></claim-button>
    ```
- **`appkitConfig`**: _(Set via JavaScript property)_  
  Provides configuration for wallet connection and custom branding in wallet dialogs.
  - Expected to be an object with at least `projectId` and a `metadata` object containing your app's details.
  - Example:
    ```js
    // In your JavaScript, after the component is defined:
    customElements.whenDefined("claim-button").then(() => {
      document.querySelector("claim-button").appkitConfig = {
        projectId: "YOUR_PROJECT_ID",
        metadata: {
          name: "YourAppName",
          description: "A short app description",
          url: "https://yourapp.example.com",
          icons: ["https://yourapp.example.com/icon.png"],
        },
      }
    })
    ```
  - **Note:** `appkitConfig` cannot be set as an HTML attribute; it must be set on the element as a property from JavaScript.
- **`supportedChains`**: _(Optional property)_
  Restricts the networks presented in the wallet modal and entitlement checks. Provide an array of chain IDs (e.g. `[122, 42220, 50]`). By default the component enables Fuse, Celo, and XDC.

## Additional Notes

- **Dependencies**: The component uses `@reown/appkit` for wallet connections, `@goodsdks/citizen-sdk` for claim logic, `viem` for blockchain interactions, and `lit` for the reactive UI.
- **Supported Chains**: Works on Celo, Fuse, and XDC networks. The component automatically rotates between multiple RPC endpoints per chain to mitigate rate limits.
- **Feedback**: Displays loading states, success messages, errors, and a countdown timer as needed.

This README provides all you need to get started with the `claim-button` web component in your web projects!
