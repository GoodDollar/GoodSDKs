# GoodDollar Streaming SDK Demo

A demonstration application showcasing the GoodDollar Superfluid Streaming SDK with the simplified API that automatically resolves G$ token addresses.

## What This Demo Shows

This app demonstrates the key improvement in the Streaming SDK: you no longer need to manually specify G$ token addresses. The SDK automatically resolves the correct token based on your selected environment.

### Before (Old API)
```typescript
await sdk.createStream({
  receiver: '0x...',
  token: '0x62B8...9c7A', // Had to manually specify G$ token address
  flowRate
})
```

### After (New Simplified API)
```typescript
const sdk = new StreamingSDK(publicClient, walletClient, {
  environment: 'production' // Auto-resolves G$ token
})

await sdk.createStream({
  receiver: '0x...',
  // No token parameter needed!
  flowRate
})
```

## Features

- **Environment Selector** - Switch between production, staging, and development
- **Wallet Connection** - Connect via WalletConnect to Celo or Base
- **Create Streams** - Create G$ streams with a simple form (no token address needed!)
- **View Active Streams** - See all your incoming and outgoing streams
- **Manage Streams** - Delete streams you've created
- **Visual API Examples** - See the actual code being used in real-time

## Setup

1. **Install Dependencies**
   ```bash
   yarn install
   ```

2. **Configure Environment**
   Create a `.env` file with your WalletConnect Project ID.

3. **Build Dependencies**
   ```bash
   yarn build
   ```

## Running the Demo

```bash
cd apps/demo-streaming-app
yarn dev
```

The app will be available at `http://localhost:3001`
