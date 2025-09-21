# Identity SDK

`@goodsdks/citizen-sdk` provides the Identity SDK for interacting seamlessly with GoodDollar's Identity smart contracts. It leverages both **Viem** and **Wagmi** SDKs to provide robust functionalities for managing a user's G$ identity on the blockchain. Whether you're building a frontend application or integrating backend services, the Identity SDK offers the tools you need to handle identity verification and work with uniquely identified users in your dapp or service.

[A live demo app is live here](https://demo-identity-app.vercel.app/)

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

To integrate the Identity SDK into your project, you can easily install it from npm:

```bash file.sh
npm install @goodsdks/citizen-sdk
```

or if you prefer using Yarn:

```bash file.sh
yarn add @goodsdks/citizen-sdk
```

## Getting Started

### Using the Wagmi SDK

The Identity SDK is built on top of `Wagmi` and provides a React hook for interacting with the Identity smart contracts. It abstracts the complexity of blockchain interactions, making it easier to integrate identity functionalities into your React applications.

#### Initialization

First, ensure that you have set up `Wagmi` in your React application. Then, import and use the `useIdentitySDK` hook as shown below.

```typescript packages/citizen-sdk/src/example/WagmiInitExample.tsx
import React from 'react';
import { WagmiProvider } from 'wagmi';
import { useIdentitySDK } from './wagmi-sdk';

const IdentityComponent = () => {
  const identitySDK = useIdentitySDK('production');

  const checkWhitelistedRoot = async (account: string) => {
    try {
      const { isWhitelisted, root } = await identitySDK.getWhitelistedRoot(account);
      console.log(`Is Whitelisted: ${isWhitelisted}, Root: ${root}`);
    } catch (error) {
      console.error(error);
    }
  };

  return (
    <div>
      <button onClick={() => checkWhitelistedRoot('0xYourEthereumAddress')}>
        Check Whitelisted Root
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

```typescript packages/citizen-sdk/src/example/ViemInitExample.ts
import { PublicClient, WalletClient } from "viem"
import { initializeIdentityContract, IdentitySDK } from "./viem-sdk"

const publicClient = new PublicClient({
  /* configuration */
})
const walletClient = new WalletClient({
  /* configuration */
})
const contractAddress = "0xYourContractAddress"

const identitySDK = new IdentitySDK(publicClient, walletClient, "production")
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

An `IdentitySDK` instance or `null` if the required clients are not available.

**Available Methods in the Identity SDK:**

- `getWhitelistedRoot(account: Address): Promise<{ isWhitelisted: boolean; root: Address }>`
- `getIdentityExpiryData(account: Address): Promise<IdentityExpiryData>`
- `generateFVLink(popupMode?: boolean, callbackUrl?: string, chainId?: number): Promise<string>`
- `submitAndWait(params: SimulateContractParameters, onHash?: (hash: `0x${string}`) => void): Promise<any>`
- `calculateIdentityExpiry(lastAuthenticated: bigint, authPeriod: bigint): IdentityExpiry`

### Viem SDK

#### `initializeIdentityContract`

Initializes the Identity contract instance.

**Usage:**

```typescript
const identityContract = initializeIdentityContract(
  publicClient,
  contractAddress,
)
```

**Parameters:**

- `publicClient`: An instance of `PublicClient` from Viem.
- `contractAddress`: The address of the Identity contract.

**Returns:**

An `IdentityContract` object encapsulating the contract address and client.

#### `IdentitySDK` Class

Handles interactions with the Identity Contract.

**Constructor:**

```typescript
new IdentitySDK(publicClient: PublicClient, walletClient: WalletClient & WalletActions, env?: contractEnv)
```

**Parameters:**

- `publicClient`: The `PublicClient` instance.
- `walletClient`: The `WalletClient` with wallet actions.
- `env` _(optional)_: The environment to use (`"production" | "staging" | "development"`), defaults to `"production"`.

**Methods:**

- **`submitAndWait`**

  Submits a transaction and waits for its receipt.

  **Usage:**

  ```typescript
  const receipt = await identitySDK.submitAndWait(params, onHashCallback)
  ```

  **Parameters:**

  - `params`: Parameters for simulating the contract call (`SimulateContractParameters`).
  - `onHash` _(optional)_: A callback function that receives the transaction hash.

  **Returns:**

  A transaction receipt upon successful submission.

- **`getWhitelistedRoot`**

  Returns the whitelist status of a main account or any connected account.

  **Usage:**

  ```typescript
  const { isWhitelisted, root } =
    await identitySDK.getWhitelistedRoot(accountAddress)
  ```

  **Parameters:**

  - `account`: The account address to check.

  **Returns:**

  An object containing:

  - `isWhitelisted`: `boolean` indicating if the account is whitelisted.
  - `root`: The root address associated with the account.

- **`getIdentityExpiryData`**

  Retrieves identity expiry data for a given account.

  **Usage:**

  ```typescript
  const expiryData = await identitySDK.getIdentityExpiryData(accountAddress)
  ```

  **Parameters:**

  - `account`: The account address.

  **Returns:**

  An `IdentityExpiryData` object containing:

  - `lastAuthenticated`: The timestamp of last authentication.
  - `authPeriod`: The authentication period.

- **`generateFVLink`**

  Generates a Face Verification Link.

  **Usage:**

  ```typescript
  const fvLink = await identitySDK.generateFVLink(
    popupMode,
    callbackUrl,
    chainId,
  )
  ```

  **Parameters:**

  - `popupMode` _(optional)_: `boolean` indicating whether to generate a popup link.
  - `callbackUrl` _(optional)_: The URL to callback after verification. _Required_ when using pop-up mode = `false`.
  - `chainId` _(optional)_: The blockchain network ID. When omitted, the SDK falls back to the configured face-verification chain for the active network.

  **Returns:**

  A `string` containing the generated Face Verification link.

- **`calculateIdentityExpiry`**

  Calculates the identity expiry timestamp.

  **Usage:**

  ```typescript
  const identityExpiry = identitySDK.calculateIdentityExpiry(
    lastAuthenticated,
    authPeriod,
  )
  ```

  **Parameters:**

  - `lastAuthenticated`: The timestamp of last authentication (`bigint`).
  - `authPeriod`: The authentication period (`bigint`).

  **Returns:**

  An `IdentityExpiry` object containing:

  - `expiryTimestamp`: The calculated expiry timestamp.

## Example Usage

### Wagmi SDK Example

Below is a practical example demonstrating how to use the Wagmi SDK to check if a user is whitelisted, retrieve identity expiry data, and generate a Face Verification link.

```typescript file.tsx
import React, { useState } from 'react';
import { WagmiProvider } from 'wagmi';
import { useIdentitySDK } from './wagmi-sdk';

const IdentityExample = () => {
  const identitySDK = useIdentitySDK('production');
  const [account, setAccount] = useState<string>('');
  const [whitelistStatus, setWhitelistStatus] = useState<{ isWhitelisted: boolean; root: string } | null>(null);
  const [expiryData, setExpiryData] = useState<IdentityExpiryData | null>(null);
  const [fvLink, setFvLink] = useState<string>('');

  const handleCheckWhitelist = async () => {
    try {
      const result = await identitySDK.getWhitelistedRoot(account);
      setWhitelistStatus(result);
      console.log(`Whitelisted: ${result.isWhitelisted}, Root: ${result.root}`);
    } catch (error) {
      console.error(error);
    }
  };

  const handleGetExpiryData = async () => {
    try {
      const data = await identitySDK.getIdentityExpiryData(account);
      setExpiryData(data);
      console.log(`Last Authenticated: ${data.lastAuthenticated}, Auth Period: ${data.authPeriod}`);
    } catch (error) {
      console.error(error);
    }
  };

  const handleGenerateFVLink = async () => {
    try {
      const link = await identitySDK.generateFVLink(false, 'https://yourapp.com/callback', 1);
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
      {whitelistStatus && (
        <p>
          {whitelistStatus.isWhitelisted
            ? `User is whitelisted. Root: ${whitelistStatus.root}`
            : 'User is not whitelisted.'}
        </p>
      )}
      <button onClick={handleGetExpiryData}>Get Identity Expiry Data</button>
      {expiryData && (
        <p>
          Last Authenticated: {expiryData.lastAuthenticated.toString()}, Auth Period: {expiryData.authPeriod.toString()} seconds
        </p>
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
  </WagmiProvider>- [Live Demo Identity App](https://demo-identity-app.vercel.app/)
);

export default App;
```

## References

- [Viem Documentation](https://viem.sh/)
- [Wagmi Documentation](https://wagmi.sh/)
- [OpenZeppelin Contracts](https://docs.openzeppelin.com/contracts/)
- [IdentityV2 Smart Contract](https://github.com/GoodDollar/GoodProtocol/blob/master/contracts/identity/IdentityV2.sol)
- [Live Demo Identity App](https://demo-identity-app.vercel.app/)
- Celo identity contract addresses
  [development](https://celoscan.io/address/0xF25fA0D4896271228193E782831F6f3CFCcF169C)
  [staging](https://celoscan.io/address/0x0108BBc09772973aC27983Fc17c7D82D8e87ef4D)
  [production](https://celoscan.io/address/0xC361A6E67822a0EDc17D899227dd9FC50BD62F42)
- Fuse identity contract addresses
  [development](https://explorer.fuse.io/address/0x1e006225cff7d37411db28f652e0Da9D20325eBb)
  [staging](https://explorer.fuse.io/address/0xb0cD4828Cc90C5BC28f4920Adf2Fd8F025003D7E)
  [production](https://explorer.fuse.io/address/0x2F9C28de9e6d44b71B91b8BA337A5D82e308E7BE)
