# Additions to README for Claim SDK

the `ClaimSDK` facilitates claiming Universal Basic Income (UBI) through the GoodDollar Protocol.

## Getting Started

### Prerequisites

Make sure you register your wallet on re-own cloud dashboard: https://cloud.reown.com/sign-in
you want to register an dapp which integrates 'appkit'

### Using the Wagmi SDK for Claim

To integrate the Claim SDK with Wagmi in a React application, you need to obtain the necessary blockchain clients and an instance of the Identity SDK, as the Claim SDK depends on it. Below is an example of how to initialize the Claim SDK within a React component.

For a full demo integration look here:
ClaimButton - [ClaimButton.tsx](/apps/demo-identity-app/src/components/ClaimButton.tsx)
Wagmi/Reown Configuration - [WagmiConfiguration.tsx](/apps/demo-identity-app/src/config.tsx)

```typescript
import { useAccount, usePublicClient, useWalletClient } from 'wagmi';
import { useIdentitySDK } from '@goodsdks/citizen-sdk/wagmi-sdk';
import { ClaimSDK } from '@goodsdks/citizen-sdk/viem-claim-sdk';

const ClaimComponent = () => {
  const { address } = useAccount();
  const publicClient = usePublicClient();
  const { data: walletClient } = useWalletClient();
  const identitySDK = useIdentitySDK('production');

  if (!address || !publicClient || !walletClient || !identitySDK) {
    return <div>Loading...</div>;
  }

  const claimSDK = new ClaimSDK({
    account: address,
    publicClient,
    walletClient,
    identitySDK,
    env: 'production',
  });

  // Use claimSDK to call methods like claim(), checkEntitlement(), etc.
  return <div>Claim SDK Initialized</div>;
};
```

### Using the Viem SDK for Claim

For non-React environments or backend services, you can initialize the Claim SDK directly using Viem's clients. The `ClaimSDK.init` method simplifies the process by fetching the account address from the wallet client.

```typescript
import { PublicClient, WalletClient } from "viem"
import { IdentitySDK } from "@goodsdks/citizen-sdk/viem-identity-sdk"
import { ClaimSDK } from "@goodsdks/citizen-sdk/viem-claim-sdk"

const publicClient = new PublicClient({
  /* configuration */
})
const walletClient = new WalletClient({
  /* configuration */
})
const identitySDK = new IdentitySDK(publicClient, walletClient, "production")

const claimSDK = await ClaimSDK.init({
  publicClient,
  walletClient,
  identitySDK,
  env: "production",
})
```

## API Reference

### Viem SDK

#### `ClaimSDK` Class

The `ClaimSDK` class manages interactions with the UBI Scheme Contract to enable users to claim UBI. It requires an instance of `IdentitySDK` for whitelisting checks.

**Constructor:**

```typescript
new ClaimSDK({
  account: Address,
  publicClient: PublicClient,
  walletClient: WalletClient<any, Chain | undefined, Account | undefined>,
  identitySDK: IdentitySDK,
  rdu?: string,
  env?: contractEnv
})
```

**Parameters:**

- `account`: The user's wallet address.
- `publicClient`: A Viem `PublicClient` instance for reading blockchain data.
- `walletClient`: A Viem `WalletClient` instance for sending transactions.
- `identitySDK`: An instance of `IdentitySDK` for identity verification.
- `rdu` _(optional)_: Redirect URL for face verification, defaults to the current window location.
- `env` _(optional)_: Environment setting (`"production" | "staging" | "development"`), defaults to `"production"`.

**Static Method:**

- **`init(props: Omit<ClaimSDKOptions, "account">): Promise<ClaimSDK>`**

  Asynchronously initializes the Claim SDK by retrieving the account from the wallet client.

  ```typescript
  const claimSDK = await ClaimSDK.init({
    publicClient,
    walletClient,
    identitySDK,
    env: "production",
  })
  ```

**Methods:**

- **`checkEntitlement(pClient?: PublicClient): Promise<bigint>`**

  Checks the user's eligibility to claim UBI for the current period.

  **Parameters:**

  - `pClient` _(optional)_: An alternative `PublicClient` to check entitlement on another chain (e.g., Celo or Fuse).

  **Returns:**

  The claimable amount in the smallest unit (e.g., wei). Returns `0` if the user is not eligible or has already claimed.

- **`claim(): Promise<TransactionReceipt | any>`**

  Attempts to claim UBI for the connected user. It verifies whitelisting via `IdentitySDK`, ensures sufficient balance (triggering a faucet if needed), and submits the claim transaction.

  **Returns:**

  A transaction receipt upon success.

  **Throws:**

  Errors if the user is not whitelisted, balance checks fail, or the transaction fails.

- **`nextClaimTime(): Promise<Date>`**

  Retrieves the timestamp when the user can next claim UBI.

  **Returns:**

  A `Date` object representing the next claim time.

- **`getDailyStats(): Promise<{ claimers: bigint; amount: bigint }>`**

  Fetches the number of claimers and total amount claimed for the current day.

  **Returns:**

  An object with `claimers` (number of claimers) and `amount` (total claimed amount).

## Example Usage

### Claim SDK Example

This example demonstrates how to use the Claim SDK in a React component to check UBI entitlement and claim it, providing user feedback throughout the process.
please reference this [config](/apps/demo-identity-app/src/config.tsx) for a full wagmi configuration

```typescript
import React, { useState } from 'react';
import { useAccount, usePublicClient, useWalletClient } from 'wagmi';
import { WagmiProvider } from 'wagmi';
import { useIdentitySDK } from '@goodsdks/citizen-sdk/wagmi-sdk';
import { ClaimSDK } from '@goodsdks/citizen-sdk/viem-claim-sdk';

const ClaimExample = () => {
  const { address } = useAccount();
  const publicClient = usePublicClient();
  const { data: walletClient } = useWalletClient();
  const identitySDK = useIdentitySDK('production');

  const [entitlement, setEntitlement] = useState<bigint | null>(null);
  const [claimStatus, setClaimStatus] = useState<string>('');

  if (!address || !publicClient || !walletClient || !identitySDK) {
    return <div>Loading...</div>;
  }

  const claimSDK = new ClaimSDK({
    account: address,
    publicClient,
    walletClient,
    identitySDK,
    env: 'production',
  });

  const handleCheckEntitlement = async () => {
    try {
      const amount = await claimSDK.checkEntitlement();
      setEntitlement(amount);
    } catch (error) {
      console.error('Entitlement check failed:', error);
    }
  };

  const handleClaim = async () => {
    try {
      await claimSDK.claim();
      setClaimStatus('Claim successful!');
    } catch (error) {
      setClaimStatus(`Claim failed: ${error.message}`);
    }
  };

  return (
    <div>
      <h1>Claim UBI</h1>
      <button onClick={handleCheckEntitlement}>Check Entitlement</button>
      {entitlement !== null && (
        <p>Entitlement: {entitlement.toString()} units</p>
      )}
      <button onClick={handleClaim}>Claim UBI</button>
      {claimStatus && <p>{claimStatus}</p>}
    </div>
  );
};

const App = () => (
  <WagmiProvider>
    <ClaimExample />
  </WagmiProvider>
);

export default App;
```

## References

- The Claim SDK interacts with the UBI Scheme and Faucet contracts. Contract addresses are automatically selected based on the chain and environment from the SDK's `contractAddresses` constant.
  Refer to the [GoodDollar Protocol repository](https://github.com/GoodDollar/GoodProtocol) for contract details.
