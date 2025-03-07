# Identity SDK

`identity-sdk` is a comprehensive library designed to interact seamlessly with GoodDollar's Identity smart contracts. It leverages both **Viem** and **Wagmi** SDKs to provide robust functionalities for managing a users G$ identity on the blockchain. Whether you're building a frontend application or integrating backend services, `identity-sdk` offers the tools you need to handle identity verification, whitelist management, and more.

## Table of Contents

- [Installation](#installation)
- [Getting Started](#getting-started)
  - [Using the Wagmi SDK](#using-the-wagmi-sdk)
  - [Using the Viem SDK](#using-the-viem-sdk)
- [API Reference](#api-reference)
  - [Wagmi SDK](#wagmi-sdk)
  - [Viem SDK](#viem-sdk)
- [Example Usage](#example-usage)
  - [Wagmi SDK Example](#wagmi-sdk-example)
- [References](#references)
- [Contributing](#contributing)
- [License](#license)

## Installation

To integrate `identity-sdk` into your project, you can easily install it from npm:

```bash
npm install identity-sdk
```

or if you prefer using Yarn:

```bash
yarn add identity-sdk
```

## Getting Started

### Using the Wagmi SDK hooks

The Identity SDK is built on top of `Wagmi` and provides React hooks for interacting with the Identity smart contracts. It abstracts the complexity of blockchain interactions, making it easier to integrate identity functionalities into your React applications.

#### Initialization

First, ensure that you have set up `Wagmi` in your React application. Then, import and use the `useIdentitySDK` hook as shown below.

```typescript file.tsx
import React from 'react';
import { WagmiProvider } from 'wagmi';
import { useIdentitySDK } from './packages/identity-sdk/src/wagmi-sdk';

const IdentityComponent = () => {
  const identitySDK = useIdentitySDK('production');

  const checkWhitelist = async (account: string) => {
    try {
      const { isWhitelisted, root } = await identitySDK.checkIsWhitelisted(account);
      console.log(`Is Whitelisted: ${isWhitelisted}, Root: ${root}`);
    } catch (error) {
      console.error(error);
    }
  };

  return (
    <div>
      <button onClick={() => checkWhitelist('0xYourEthereumAddress')}>
        Check Whitelist Status
      </button>
    </div>
  );
};

const App = () => (
  <WagmiProvider>
    <IdentityComponent />
  </WagmiProvider>
);

export default App;
```

### Using the Viem SDK

The Viem SDK provides a set of utility functions to interact directly with the Identity smart contracts. It is suitable for backend services or environments where React is not used.

#### Initialization

```typescript src/viem-sdk.ts
import { PublicClient, WalletClient } from "viem";
import { initializeIdentityContract } from "./viem-sdk";

const publicClient = new PublicClient({
  /* config */
});
const walletClient = new WalletClient({
  /* config */
});
const contractAddress = "0xYourContractAddress";

const identityContract = initializeIdentityContract(
  publicClient,
  contractAddress,
);
```

## API Reference

### Wagmi SDK

#### `useIdentitySDK`

A React hook that provides various identity-related functionalities.

**Usage:**

```typescript
const identitySDK = useIdentitySDK(env?: contractEnv);
```

**Parameters:**

- `env` _(optional)_: The environment to use (`'production'` by default).

**Returns:**

An object containing the following methods:

- `checkIsWhitelisted(account: Address): Promise<{ isWhitelisted: boolean; root: Address }>`
- `generateFVLink(callbackUrl?: string, popupMode?: boolean, chainId?: number): Promise<string>`
- `getIdentityExpiry(account: Address): Promise<IdentityExpiryData | undefined>`

### Viem SDK

#### `initializeIdentityContract`

Initializes the Identity contract instance.

**Usage:**

```typescript
const identityContract = initializeIdentityContract(
  publicClient,
  contractAddress,
);
```

**Parameters:**

- `publicClient`: An instance of `PublicClient` from Viem.
- `contractAddress`: The address of the Identity contract.

**Returns:**

An `IdentityContract` object encapsulating the contract address and client.

#### `submitAndWait`

Submits a transaction and waits for its receipt.

**Usage:**

```typescript
const receipt = await submitAndWait(params, publicClient, walletClient, onHash);
```

**Parameters:**

- `params`: Parameters for simulating the contract.
- `publicClient`: An instance of `PublicClient` from Viem.
- `walletClient`: An instance of `WalletClient` with wallet actions.
- `onHash` _(optional)_: A callback function that receives the transaction hash.

**Returns:**

A transaction receipt upon successful submission.

## Example Usage

### Wagmi SDK Example

Below is a practical example demonstrating how to use the Wagmi SDK to check if a user is whitelisted and generate a Face Verification link.

```typescript file.tsx
import React, { useState } from 'react';
import { WagmiProvider } from 'wagmi';
import { useIdentitySDK } from './packages/identity-sdk/src/wagmi-sdk';

const IdentityExample = () => {
  const identitySDK = useIdentitySDK('production');
  const [account, setAccount] = useState<string>('');
  const [isWhitelisted, setIsWhitelisted] = useState<boolean | null>(null);
  const [fvLink, setFvLink] = useState<string>('');

  const handleCheckWhitelist = async () => {
    try {
      const result = await identitySDK.checkIsWhitelisted(account);
      setIsWhitelisted(result.isWhitelisted);
      console.log(`Whitelisted: ${result.isWhitelisted}, Root: ${result.root}`);
    } catch (error) {
      console.error(error);
    }
  };

  const handleGenerateFVLink = async () => {
    try {
      const link = await identitySDK.generateFVLink('https://yourapp.com/callback');
      setFvLink(link);
      console.log(`Face Verification Link: ${link}`);
    } catch (error) {
      console.error(error);
    }
  };

  return (
    <div>
      <h1>Identity SDK Example</h1>
      <input
        type="text"
        placeholder="Enter Ethereum Address"
        value={account}
        onChange={(e) => setAccount(e.target.value)}
      />
      <button onClick={handleCheckWhitelist}>Check Whitelist Status</button>
      {isWhitelisted !== null && (
        <p>{isWhitelisted ? 'User is whitelisted.' : 'User is not whitelisted.'}</p>
      )}
      <button onClick={handleGenerateFVLink}>Generate Face Verification Link</button>
      {fvLink && (
        <p>
          <a href={fvLink} target="_blank" rel="noopener noreferrer">
            Verify Your Identity
          </a>
        </p>
      )}
    </div>
  );
};

const App = () => (
  <WagmiProvider>
    <IdentityExample />
  </WagmiProvider>
);

export default App;
```

#### `getIdentityExpiry`

The `getIdentityExpiry` method available in the identity SDK provides a way to fetch the expiration data for a user's identity on the blockchain. It leverages the smart contract's `lastAuthenticated` and `authenticationPeriod` data to give an overview of when the user's identity will expire.

**Parameters:**

- `account`: The Ethereum address for which the identity expiry is being queried.

**Returns:**

- An `IdentityExpiryData` object containing:
  - `lastAuthenticated`: The last time the account was authenticated.
  - `authPeriod`: The period in days for which the identity is valid.

**Usage Example:**

This method can be used in your React application to inform users about their identity status and when they need to authenticate again to maintain their identity validation on the blockchain.Parameters:

## References

- [Viem Documentation](https://viem.sh/)
- [Wagmi Documentation](https://wagmi.sh/)
- [OpenZeppelin Contracts](https://docs.openzeppelin.com/contracts/)
- [IdentityV2 Smart Contract](./contracts/identity/IdentityV2.sol)
- [Live demo identity app](https://demo-identity-app.vercel.app/)
