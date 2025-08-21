# Gooddollar Savings Web Component

The `gooddollar-savings-widget` web component provides a simple and interactive way for users to stake their G$ tokens and earn.

## Integratig The Component

Can be used in any website, for a quick setup:

1. **Download the Script**: Download the `gooddollar-savings-widget.global.js` file from the project releases or build it from the source.
2. **Include in HTML**: Add the script to your HTML file.
3. **Add the Component**: Use the `<gooddollar-savings-widget>` tag where you want it to appear.

```html
<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Gooddollar Savings</title>
  </head>
  <body>
    <gooddollar-savings-widget id="savingsWidget"></gooddollar-savings-widget>
    <script src="path/to/gooddollar-savings-widget.global.js"></script>
    <script type="module">
      customElements.whenDefined("gooddollar-savings-widget").then(() => {
        const savingsWidget = document.getElementById("savingsWidget")

        //action when connect wallet button is clicked
        savingsWidget.connectWallet = () => {
            //appKit.open();
        };

        //set web3Provider when it is ready
        savingsWidget.web3Provider = web3Provider;

      })
    </script>
  </body>
</html>
```


## Configurable Options

Customize the `gooddollar-savings-widget` using these properties:

- **`connectWallet`**:  _(Set via JavaScript property)_  
  Defines the function when the "Connect Wallet" button is clicked.

- **`web3Provider`**: _(Set via JavaScript property)_  
  The web3Provider object when the wallet is connected. Wallet connection logic should be handeled outside of this component.