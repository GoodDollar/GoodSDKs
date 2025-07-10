# GoodDollar Claim Flow Guide

This guide explains the sophisticated claim flow logic implemented in the GoodDollar SDK, which ensures fair and secure Universal Basic Income (UBI) distribution.

## 🔄 Overview

The GoodDollar claim flow consists of three distinct states that determine what UI components to show to users:

1. **🔍 Verify State** - User needs identity verification
2. **⏰ Timer State** - User is verified but already claimed
3. **💰 Claim State** - User is verified and can claim

## 📊 Flow Diagram

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

const ClaimButton = () => {
  const claimSDK = useClaimSDK('production');
  const [claimAmount, setClaimAmount] = useState<number | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  
  useEffect(() => {
    const checkEntitlement = async () => {
      const amount = await claimSDK.checkEntitlement();
      const formattedAmount = Number(amount) / 1e18;
      setClaimAmount(formattedAmount);
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
        const entitlement = await claimSDK.checkEntitlement();
        
        if (entitlement === 0n) {
          // User has already claimed, show timer
          const nextClaimTime = await claimSDK.nextClaimTime();
          setState({ 
            type: 'timer', 
            data: { nextClaimTime } 
          });
        } else {
          // User can claim
          const claimAmount = Number(entitlement) / 1e18;
          setState({ 
            type: 'claim', 
            data: { claimAmount } 
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
const { isWhitelisted } = await identitySDK.getWhitelistedRoot(address);
```

### 2. Entitlement Check
```typescript
const entitlement = await claimSDK.checkEntitlement();
// Returns 0n if user has already claimed or is not eligible
// Returns positive amount if user can claim
```

### 3. Next Claim Time
```typescript
const nextClaimTime = await claimSDK.nextClaimTime();
// Returns Date object of when user can next claim
```

## 🚨 Error Handling

Always implement proper error handling for each state:

```typescript
try {
  const { isWhitelisted } = await identitySDK.getWhitelistedRoot(address);
  // Handle whitelist check
} catch (error) {
  console.error('Whitelist check failed:', error);
  // Show fallback UI or error message
}

try {
  const entitlement = await claimSDK.checkEntitlement();
  // Handle entitlement check
} catch (error) {
  console.error('Entitlement check failed:', error);
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

This claim flow ensures a smooth user experience while maintaining the security and fairness of the GoodDollar protocol. 