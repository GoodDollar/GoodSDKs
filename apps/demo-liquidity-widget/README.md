## Getting Started

This demo shows how to integrate the `@goodsdks/liquidity-widget` web component
into a React app using [Reown AppKit](https://reown.com/) + [wagmi](https://wagmi.sh).

1. **Clone the Repository**

   ```bash
   git clone https://github.com/GoodDollar/GoodSdks
   ```

2. **Install & Build**

   From the monorepo root:

   ```bash
   yarn install --immutable && yarn build
   ```

3. **Start the Development Server**

   ```bash
   cd apps/demo-liquidity-widget
   yarn dev
   ```

4. **Open the App**

   Visit `http://localhost:3000`.

## Usage

The liquidity widget is a Lit-based web component registered as
`<gooddollar-liquidity-widget>`. See
[packages/liquidity-widget/REACT_DOCUMENT.md](../../packages/liquidity-widget/REACT_DOCUMENT.md)
for the full React integration guide.

This demo uses:

- `src/config.tsx` — Reown AppKit + wagmi setup (Celo only; the pool is on Celo).
- `src/components/LiquidityWidget.tsx` — Thin React wrapper around the web
  component that sets the `web3Provider` and `connectWallet` JS properties via
  `ref` (non-serializable props can't go through JSX attributes in React <19).
- `src/App.tsx` — Page layout + wagmi plumbing to pull the EIP-1193 provider
  off the active connector and pass it to the widget.
