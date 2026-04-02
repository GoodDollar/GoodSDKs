# Gooddollar Liquidity Web Component

The `gooddollar-liquidity-widget` web component provides a simple and interactive way for users to provide liquidity to the G$/USDGLO pool on Celo and earn trading fees.

## Integrating The Component

Can be used in any website, for a quick setup:

1. **Download the Script**: Download the `index.global.js` file from the project releases or build it from the source.
2. **Include in HTML**: Add the script to your HTML file.
3. **Add the Component**: Use the `<gooddollar-liquidity-widget>` tag where you want it to appear.

```html
<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Gooddollar Liquidity</title>
  </head>
  <body>
    <gooddollar-liquidity-widget id="liquidityWidget"></gooddollar-liquidity-widget>
    <script src="path/to/index.global.js"></script>
    <script type="module">
      /*
      // initialize appKit
      const appKit = createAppKit({
        ...
      });*/
      customElements.whenDefined("gooddollar-liquidity-widget").then(() => {
        const liquidityWidget = document.getElementById("liquidityWidget");

        //action when connect wallet button is clicked
        liquidityWidget.connectWallet = () => {
            //appKit.open();
        };

        // Subscribe to account changes to wire provider
        appKit.subscribeAccount((accountState) => {
            const isConnected = !!accountState?.isConnected;
            if (!liquidityWidget) return;
            if (isConnected) {
                const provider = (appKit.getProvider)('eip155') || appKit.getWalletProvider();
                liquidityWidget.web3Provider = provider;
            } else {
                liquidityWidget.web3Provider = null;
            }
        }, 'eip155');

      });
    </script>
  </body>
</html>
```

## Configurable Options

Customize the `gooddollar-liquidity-widget` using these properties:

- **`connectWallet`**: _(Set via JavaScript property)_  
  Defines the function called when the "Connect Wallet" button is clicked.

- **`web3Provider`**: _(Set via JavaScript property)_  
  The web3Provider object when the wallet is connected. Wallet connection logic should be handled outside of this component.

- **`explorerBaseUrl`**: _(String, default: `"https://celoscan.io"`)_  
  Base URL used for linking transaction hashes to a block explorer.

- **`approvalBuffer`**: _(Number, default: `5`)_  
  Percentage buffer added on top of the required amount when approving tokens, to account for minor price changes between approval and minting.

- **`defaultRange`**: _(String, default: `"full"`)_  
  The initially selected price range preset. Accepted values: `"full"`, `"wide"`, `"narrow"`.

- **`showPositions`**: _(Boolean, default: `true`)_  
  Whether to show the "My Positions" tab, which lists the user's existing liquidity positions.

- **`theme`**: _(Object, optional)_  
  Override visual styling. Accepts an object with any of the following keys:
  - `primaryColor` – accent color for buttons and highlights (CSS color string).
  - `borderRadius` – border radius of the widget container (CSS value, e.g. `"12px"`).
  - `fontFamily` – font family used by the widget (CSS font-family string).

## Events

The widget dispatches custom DOM events that integrators can listen to:

- **`lw-tx-submitted`** – Fired when a transaction hash is received from the wallet. Detail: `{ hash, step }`.
- **`lw-tx-confirmed`** – Fired when a transaction is confirmed on-chain. Detail: `{ hash, step }`.
- **`lw-tx-failed`** – Fired when a transaction fails. Detail: `{ hash, step, error }`.
- **`lw-position-added`** – Fired after a new liquidity position is successfully minted. Detail: `{ hash }`.

```js
document.getElementById("liquidityWidget").addEventListener("lw-position-added", (e) => {
  console.log("Position minted:", e.detail.hash);
});
```
