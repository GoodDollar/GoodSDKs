# Savings SDK

`@goodsdks/savings-sdk` provides the Savings SDK for interacting seamlessly with GoodDollar's savings smart contracts on Celo. It leverages both **Viem** and **Wagmi** SDKs to provide functionalities for managing user staking, and rewards.

## Table of Contents

- [Savings SDK](#savings-sdk)
  - [Table of Contents](#table-of-contents)
  - [Installation](#installation)
  - [Getting Started](#getting-started)
    - [Using the Wagmi SDK](#using-the-wagmi-sdk)
      - [Initialization](#initialization)
    - [Using the Viem SDK](#using-the-viem-sdk)
      - [Initialization](#initialization-1)
  - [API Reference](#api-reference)
    - [Wagmi SDK](#wagmi-sdk)
      - [`useGooddollarSavings`](#usegooddollarsavings)
    - [Viem SDK](#viem-sdk)
      - [`GooddollarSavingsSDK` Class](#gooddollarsavingssdk-class)
  - [References](#references)

## Installation

To integrate the Savings SDK into your project, you can easily install it from npm:

```bash file.sh
npm install @goodsdks/savings-sdk
```

or if you prefer using Yarn:

```bash file.sh
yarn add @goodsdks/savings-sdk
```

## Getting Started

### Using the Wagmi SDK

The Savings SDK is built on top of `Wagmi` and provides a React hook for interacting with the savings smart contracts. It abstracts the complexity of blockchain interactions, making it easier to integrate savings functionalities into your React applications.

#### Initialization

First, ensure that you have set up `Wagmi` in your React application. Then, import and use the `useGooddollarSavings` hook as shown below.

```typescript
import React from 'react';
import { WagmiProvider } from 'wagmi';
import { useGooddollarSavings } from './wagmi-sdk';

const SavingsComponent = () => {
  const { sdk, loading, error } = useGooddollarSavings();

  const getGlobalStats = async () => {
    if (!sdk) return;
    try {
      const stats = await sdk.getGlobalStats();
      console.log(`Total Staked: ${stats.totalStaked}, APR: ${stats.annualAPR}%`);
    } catch (error) {
      console.error(error);
    }
  };

  if (loading) return <div>Loading...</div>;
  if (error) return <div>Error: {error}</div>;
  if (!sdk) return <div>SDK not available</div>;

  return (
    <div>
      <button onClick={getGlobalStats}>
        Get Global Stats
      </button>
    </div>
  );
};

const App = () => (
  <WagmiProvider>
    <SavingsComponent />
  </WagmiProvider>
);

export default App;
```

### Using the Viem SDK

The Viem SDK provides a set of utility functions to interact directly with the savings smart contracts. 

WalletClient is optional. If there is no wallet connected, you don't have to provide. After wallet connection 
you can set walletClient by using `setWalletClient` function or you can create a new SDK instance.

#### Initialization

```typescript
import { PublicClient, WalletClient } from "viem"
import { GooddollarSavingsSDK } from "./viem-sdk"

const publicClient = new PublicClient({
  /* configuration for Celo mainnet */
})
const walletClient = new WalletClient({
  /* configuration for Celo mainnet */
})

const savingsSDK = new GooddollarSavingsSDK(publicClient, walletClient)
```

## API Reference

### Wagmi SDK

#### `useGooddollarSavings`

A React hook that provides access to the savings SDK functionality.

**Usage:**

```typescript
const { sdk, loading, error } = useGooddollarSavings();
```

**Returns:**

An object containing:
- `sdk`: A `GooddollarSavingsSDK` instance or `null` if not available
- `loading`: `boolean` indicating if the SDK is being initialized
- `error`: `string | null` containing any error message

**Available Methods in the Savings SDK:**

- `getGlobalStats(): Promise<GlobalStats>`
- `getUserStats(): Promise<UserStats>`
- `stake(amount: bigint, onHash?: (hash: `0x${string}`) => void): Promise<any>`
- `unstake(amount: bigint, onHash?: (hash: `0x${string}`) => void): Promise<any>`
- `claimReward(onHash?: (hash: `0x${string}`) => void): Promise<any>`

### Viem SDK

#### `GooddollarSavingsSDK` Class

Handles interactions with the Savings Contract on Celo.

**Constructor:**

```typescript
new GooddollarSavingsSDK(publicClient: PublicClient, walletClient?: WalletClient)
```

**Parameters:**

- `publicClient`: The `PublicClient` instance (must be connected to Celo mainnet).
- `walletClient` _(optional)_: The `WalletClient` with wallet actions (must be connected to Celo mainnet).

**Methods:**

- **`getGlobalStats`**

  Retrieves global statistics about the savings pool.

  **Usage:**

  ```typescript
  const stats = await savingsSDK.getGlobalStats()
  ```

  **Returns:**

  A `GlobalStats` object containing:
  - `totalStaked`: Total amount staked in the pool (`bigint`)
  - `annualAPR`: Annual percentage rate as a number

- **`getUserStats`**

  Retrieves user-specific statistics and balances.

  **Usage:**

  ```typescript
  const userStats = await savingsSDK.getUserStats()
  ```

  **Returns:**

  A `UserStats` object containing:
  - `walletBalance`: User's wallet balance (`bigint`)
  - `currentStake`: User's current stake amount (`bigint`)
  - `unclaimedRewards`: User's unclaimed rewards (`bigint`)
  - `userWeeklyRewards`: User's estimated weekly rewards (`bigint`)

- **`stake`**

  Stakes a specified amount of G$ tokens.

  **Usage:**

  ```typescript
  const receipt = await savingsSDK.stake(amount, onHashCallback)
  ```

  **Parameters:**

  - `amount`: The amount to stake (`bigint`)
  - `onHash` _(optional)_: A callback function that receives the transaction hash

  **Returns:**

  A transaction receipt upon successful staking

- **`unstake`**

  Unstakes a specified amount of G$ tokens.

  **Usage:**

  ```typescript
  const receipt = await savingsSDK.unstake(amount, onHashCallback)
  ```

  **Parameters:**

  - `amount`: The amount to unstake (`bigint`)
  - `onHash` _(optional)_: A callback function that receives the transaction hash

  **Returns:**

  A transaction receipt upon successful unstaking

- **`claimReward`**

  Claims accumulated rewards.

  **Usage:**

  ```typescript
  const receipt = await savingsSDK.claimReward(onHashCallback)
  ```

  **Parameters:**

  - `onHash` _(optional)_: A callback function that receives the transaction hash

  **Returns:**

  A transaction receipt upon successful reward claiming

## References

- Savings contract address on Celo: [0x799a23dA264A157Db6F9c02BE62F82CE8d602A45](https://celoscan.io/address/0x799a23dA264A157Db6F9c02BE62F82CE8d602A45)


