# Streaming SDK Test UI Guide

This guide explains how to use the interactive test page for the Superfluid Streaming SDK within the `demo-identity-app`.

## 📍 Location
The test page is implemented as a standalone component:
`src/components/StreamingTestPage.tsx`

## 🚀 How to Run
From the repository root, run the **fast-path** command (recommended):
```bash
yarn turbo dev --filter=demo-identity-app...
```
*Note: This builds the app and SDKs. When you see **"Found 0 errors. Watching for file changes"** in the terminal, the system is ready!*

### ⚡ Direct URL 
Navigate to: **[http://localhost:3000/streaming](http://localhost:3000/streaming)**
1. `cd apps/demo-identity-app`
2. `yarn dev`

## 🛠️ Features to Test

### 1. Money Streaming (CFA)
- **Create**: enter a receiver address, amount, and time unit (hour/day/month). The SDK calculates the flow rate automatically.
- **Update**: update the amount for a receiver you are already streaming to.
- **Delete**: stop an active stream.

### 2. Distribution Pools (GDA)
- **Connect**: enter a pool address and click "Connect" (requires on-chain transaction).
- **Disconnect**: remove yourself from a pool to stop receiving distributions.
- **Visibility**: view available pools, see your connection status (badge), and current "Units".

### 3. Network & Environment
- **Chain Switcher**: easily toggle between Celo, Base, and their testnets.
- **SDK Env**: switch between `production`, `staging`, and `development` to test against different G$ SuperToken deployments.

### 4. Developer Tools
- **Code Examples**: view copy-pasteable snippets for hooks like `useCreateStream`, `usePoolMemberships`, and `useSupReserves`.
- **Tx History**: view transaction hashes with direct links to Block Explorers (CeloScan/BaseScan).

## 💡 Developer Notes
- **SUP Reserve**: the SUP Reserve Holdings section only displays data when connected to **Base Mainnet**.
- **Transactions**: all write operations (Create, Connect, etc.) will trigger a wallet signature request.
- **Subgraph**: data updates may take a few seconds to appear after a transaction is confirmed due to subgraph indexing latency.
