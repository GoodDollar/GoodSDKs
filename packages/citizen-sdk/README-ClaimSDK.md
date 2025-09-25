# Claim SDK

The `ClaimSDK` facilitates claiming Universal Basic Income (UBI) through the GoodDollar Protocol. It's part of the `@goodsdks/citizen-sdk` package and works in conjunction with the Identity SDK to ensure only verified users can claim their daily UBI.

## 🔄 Claim Flow Overview

The GoodDollar SDK implements a sophisticated claim flow that ensures fair and secure UBI distribution:

### **Flow States:**

1. **🔍 Verify State** - User needs identity verification
2. **⏰ Timer State** - User is verified but already claimed
3. **💰 Claim State** - User is verified and can claim

### **Flow Diagram:**

```
User Connects Wallet
        ↓
    Check Whitelist Status
        ↓
    ┌─────────────────┐
    │   Whitelisted?  │
    └─────────────────┘
        ↓ No
    🔍 Verify Button
        ↓
    Face Verification
        ↓
    ┌─────────────────┐
    │   Whitelisted?  │
    └─────────────────┘
        ↓ Yes
    Check Entitlement
        ↓
    ┌─────────────────┐
    │ Can Claim?      │
    └─────────────────┘
        ↓ No
    ⏰ Timer State
        ↓
    ┌─────────────────┐
    │ Can Claim?      │
    └─────────────────┘
        ↓ Yes
    💰 Claim Button
        ↓
    Claim UBI
```

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

- **`checkEntitlement(options?: CheckEntitlementOptions): Promise<ClaimEntitlementResult>`**

  Checks the user's eligibility to claim UBI for the current period, automatically probing configured fallback chains (e.g., Fuse ⇄ Celo ⇄ XDC) when the primary chain has no allocation.

  **Parameters (`options`):**

  - `publicClient` _(optional)_: Provide a pre-configured `PublicClient` when manually querying a specific chain.
  - `chainOverride` _(optional)_: Force the entitlement lookup to run against a particular `SupportedChains` value.

  **Returns:**

  An object with:

  - `amount`: Claimable amount on the active chain (in the smallest unit, e.g., wei).
  - `altClaimAvailable`: `true` when another configured chain currently exposes claimable UBI.
  - `altChainId`: Suggested fallback chain to switch to (or `null` when none detected).
  - `altAmount`: Claimable amount on the suggested fallback chain (or `null`).

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

## 🎯 State Details

### 1. 🔍 Verify State

**Trigger:** User is NOT whitelisted

**User Experience:**

- User sees "Verify Me" button
- Button redirects to face verification process
- User completes identity verification
- Returns to app after verification

**Implementation:**

```typescript
import { useIdentitySDK } from '@goodsdks/citizen-sdk';

const VerifyButton = () => {
  const identitySDK = useIdentitySDK('production');

  const handleVerify = async () => {
    const fvLink = await identitySDK.generateFVLink(
      false, // redirect mode
      window.location.href, // return URL
      42220 // chain ID
    );
    window.location.href = fvLink;
  };

  return (
    <Button onClick={handleVerify}>
      Verify Me
    </Button>
  );
};
```

### 2. ⏰ Timer State

**Trigger:** User is whitelisted but has already claimed UBI for the current period

**User Experience:**

- Shows countdown to next claim time
- Displays "Come back tomorrow to claim your UBI!"
- Button is disabled
- Shows when next claim will be available

**Implementation:**

```typescript
import { useClaimSDK } from '@goodsdks/citizen-sdk';

const ClaimTimer = () => {
  const claimSDK = useClaimSDK('production');
  const [nextClaimTime, setNextClaimTime] = useState<Date | null>(null);

  useEffect(() => {
    const getNextClaimTime = async () => {
      const nextTime = await claimSDK.nextClaimTime();
      setNextClaimTime(nextTime);
    };
    getNextClaimTime();
  }, []);

  return (
    <div>
      <Button disabled>
        Come back tomorrow to claim your UBI!
      </Button>
      {nextClaimTime && (
        <Text>Next claim available: {nextClaimTime.toLocaleString()}</Text>
      )}
    </div>
  );
};
```

### 3. 💰 Claim State

**Trigger:** User is whitelisted and can claim UBI

**User Experience:**

- Shows claimable amount
- Displays "Claim UBI [amount]" button
- Button is enabled and functional
- Shows transaction status after claiming

**Implementation:**

```typescript
import { useClaimSDK } from '@goodsdks/citizen-sdk';
import { formatUnits } from "viem"

const ClaimButton = () => {
  const claimSDK = useClaimSDK('production');
  const [claimAmount, setClaimAmount] = useState<number | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    const checkEntitlement = async () => {
      const {
        amount,
        altClaimAvailable,
        altChainId,
      } = await claimSDK.checkEntitlement();

      const formattedAmount = formatUnits(amount, CHAIN_DECIMALS[chainId])
      setClaimAmount(formattedAmount);

      if (altClaimAvailable && altChainId) {
        console.info(
          `Alt claim detected on ${chainConfigs[altChainId].label}. Prompt user to switch.`,
        );
      }
    };
    checkEntitlement();
  }, []);

  const handleClaim = async () => {
    setIsLoading(true);
    try {
      const receipt = await claimSDK.claim();
      console.log('UBI claimed!', receipt);
    } catch (error) {
      console.error('Claim failed:', error);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Button
      onClick={handleClaim}
      disabled={isLoading || claimAmount === 0}
    >
      {isLoading
        ? "Claiming..."
        : `Claim UBI ${claimAmount}`
      }
    </Button>
  );
};
```

## 🔧 Complete Integration Example

Here's a complete React component that implements the full claim flow:

```typescript
import React, { useEffect, useState } from 'react';
import { useAccount } from 'wagmi';
import { useIdentitySDK, useClaimSDK } from '@goodsdks/citizen-sdk';

interface ClaimFlowState {
  type: 'verify' | 'timer' | 'claim' | 'loading';
  data?: any;
}

const GoodDollarClaimFlow = () => {
  const { address } = useAccount();
  const identitySDK = useIdentitySDK('production');
  const claimSDK = useClaimSDK('production');

  const [state, setState] = useState<ClaimFlowState>({ type: 'loading' });

  useEffect(() => {
    const determineState = async () => {
      if (!address || !identitySDK || !claimSDK) return;

      try {
        // Step 1: Check whitelist status
        const { isWhitelisted } = await identitySDK.getWhitelistedRoot(address);

        if (!isWhitelisted) {
          setState({ type: 'verify' });
          return;
        }

        // Step 2: Check claim entitlement
        const {
          amount,
          altClaimAvailable,
          altChainId,
        } = await claimSDK.checkEntitlement();

        if (amount === 0n) {
          // User has already claimed, show timer
          const nextClaimTime = await claimSDK.nextClaimTime();
          setState({
            type: 'timer',
            data: { nextClaimTime, altClaimAvailable, altChainId }
          });
        } else {
          // User can claim
          const claimAmount = Number(amount) / chainConfigs[chainId].decimals;
          setState({
            type: 'claim',
            data: { claimAmount, altClaimAvailable, altChainId }
          });
        }
      } catch (error) {
        console.error('Error determining claim state:', error);
        setState({ type: 'verify' }); // Fallback to verify
      }
    };

    determineState();
  }, [address, identitySDK, claimSDK]);

  // Render based on state
  switch (state.type) {
    case 'loading':
      return <div>Loading...</div>;

    case 'verify':
      return <VerifyButton />;

    case 'timer':
      return (
        <ClaimTimer
          nextClaimTime={state.data?.nextClaimTime}
        />
      );

    case 'claim':
      return (
        <ClaimButton
          claimAmount={state.data?.claimAmount}
        />
      );

    default:
      return <div>Unknown state</div>;
  }
};

export default GoodDollarClaimFlow;
```

## 🎨 UI Component Examples

### Verify Button Component

```typescript
const VerifyButton = () => {
  const identitySDK = useIdentitySDK('production');

  const handleVerify = async () => {
    try {
      const fvLink = await identitySDK.generateFVLink(
        false,
        window.location.href,
        42220
      );
      window.location.href = fvLink;
    } catch (error) {
      console.error('Verification failed:', error);
    }
  };

  return (
    <div className="verify-container">
      <h3>Identity Verification Required</h3>
      <p>You need to verify your identity to claim UBI</p>
      <Button onClick={handleVerify} variant="primary">
        Verify Me
      </Button>
    </div>
  );
};
```

### Timer Component

```typescript
const ClaimTimer = ({ nextClaimTime }: { nextClaimTime: Date }) => {
  const [timeLeft, setTimeLeft] = useState<string>('');

  useEffect(() => {
    const updateTimer = () => {
      const now = new Date();
      const diff = nextClaimTime.getTime() - now.getTime();

      if (diff <= 0) {
        setTimeLeft('Ready to claim!');
        return;
      }

      const hours = Math.floor(diff / (1000 * 60 * 60));
      const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));

      setTimeLeft(`${hours}h ${minutes}m until next claim`);
    };

    updateTimer();
    const interval = setInterval(updateTimer, 60000); // Update every minute

    return () => clearInterval(interval);
  }, [nextClaimTime]);

  return (
    <div className="timer-container">
      <h3>Already Claimed Today</h3>
      <p>You've already claimed your UBI for today</p>
      <div className="timer">
        <span>⏰ {timeLeft}</span>
      </div>
      <Button disabled variant="secondary">
        Come back tomorrow to claim your UBI!
      </Button>
    </div>
  );
};
```

### Claim Button Component

```typescript
const ClaimButton = ({ claimAmount }: { claimAmount: number }) => {
  const claimSDK = useClaimSDK('production');
  const [isLoading, setIsLoading] = useState(false);
  const [txHash, setTxHash] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleClaim = async () => {
    setIsLoading(true);
    setError(null);
    setTxHash(null);

    try {
      const receipt = await claimSDK.claim();
      setTxHash(receipt.transactionHash);
    } catch (err: any) {
      setError(err.message || 'Claim failed');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="claim-container">
      <h3>Claim Your UBI</h3>
      <p>You can claim {claimAmount} G$ today</p>

      <Button
        onClick={handleClaim}
        disabled={isLoading}
        variant="primary"
      >
        {isLoading ? 'Claiming...' : `Claim UBI ${claimAmount}`}
      </Button>

      {txHash && (
        <div className="success">
          <p>✅ UBI claimed successfully!</p>
          <a
            href={`https://celoscan.io/tx/${txHash}`}
            target="_blank"
            rel="noopener noreferrer"
          >
            View Transaction
          </a>
        </div>
      )}

      {error && (
        <div className="error">
          <p>❌ {error}</p>
        </div>
      )}
    </div>
  );
};
```

## 🔍 State Detection Logic

The key to implementing the claim flow is understanding how to detect each state:

### 1. Whitelist Check

```typescript
const { isWhitelisted } = await identitySDK.getWhitelistedRoot(address)
```

### 2. Entitlement Check

```typescript
const { amount, altClaimAvailable, altChainId } =
  await claimSDK.checkEntitlement()
// `amount` is 0n if the user has already claimed or is not eligible
// `altClaimAvailable` + `altChainId` highlight another network with an active allocation
```

### 3. Next Claim Time

```typescript
const nextClaimTime = await claimSDK.nextClaimTime()
// Returns Date object of when user can next claim
```

## 🚨 Error Handling

Always implement proper error handling for each state:

```typescript
try {
  const { isWhitelisted } = await identitySDK.getWhitelistedRoot(address)
  // Handle whitelist check
} catch (error) {
  console.error("Whitelist check failed:", error)
  // Show fallback UI or error message
}

try {
  const { amount, altClaimAvailable } = await claimSDK.checkEntitlement()
  // Handle entitlement check with `amount` and fallback availability
} catch (error) {
  console.error("Entitlement check failed:", error)
  // Show fallback UI or error message
}
```

## 📱 Mobile Considerations

When implementing the claim flow on mobile:

1. **Face Verification:** Ensure the verification link works properly on mobile browsers
2. **Button Sizes:** Make buttons large enough for touch interaction
3. **Loading States:** Show clear loading indicators during async operations
4. **Error Messages:** Display user-friendly error messages
5. **Transaction Links:** Use mobile-friendly blockchain explorer links

## 🎯 Best Practices

1. **Always check whitelist first** - Identity verification is the foundation
2. **Handle loading states** - Show appropriate loading indicators
3. **Implement error boundaries** - Gracefully handle failures
4. **Cache results appropriately** - Don't make unnecessary API calls
5. **Provide clear user feedback** - Users should understand what's happening
6. **Test all states** - Ensure each flow state works correctly
7. **Monitor performance** - Track claim success rates and user experience

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
  const [altSuggestion, setAltSuggestion] = useState<string>('');
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
      const {
        amount,
        altClaimAvailable,
        altChainId,
      } = await claimSDK.checkEntitlement();

      setEntitlement(amount);
      setAltSuggestion(
        altClaimAvailable && altChainId
          ? `Consider switching to ${chainConfigs[altChainId].label}.`
          : ''
      );
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
      {altSuggestion && <p>{altSuggestion}</p>}
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
