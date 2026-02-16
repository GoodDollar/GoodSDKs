# Streaming SDK Test Guide

This page explains how to use the interactive test UI for the Superfluid Streaming SDK.

## Location
The test page is built into the demo app:
`src/components/StreamingTestPage.tsx`

## Quick Start
To start the development server, you can run the standard dev command from the root:

```bash
yarn dev
```

Alternatively, if you want to run just the demo app:

1. `cd apps/demo-identity-app`
2. `yarn dev`

Once started, open [http://localhost:3000/streaming](http://localhost:3000/streaming) in your browser.

## Features

### Money Streaming
- Create: Set up a new stream by entering a receiver address and amount. The SDK handles the flow rate math for you.
- Update: Change the flow rate for an existing recipient.
- Delete: Stop an active stream.

### Distribution Pools (GDA)
- Connect: Join a distribution pool to start receiving funds.
- Disconnect: Leave a pool when you no longer want to receive distributions.
- Visibility: Check your connection status and current units directly in the UI.

## Testing the Frontend
To properly test the data fetching:
1. Make sure your `.env` file in the app folder has a `VITE_GRAPH_API_KEY`.
2. Connect your wallet and switch to a supported network (Celo is best for G$ testing).
3. If you're on Base, you can view SUP reserve holdings to verify the subgraph integration.

## Unit Tests
If you want to run the underlying logic tests:
```bash
cd packages/streaming-sdk
npm test
```
