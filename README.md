# GoodDollar SDKs

Welcome to the **GoodDollar SDKs**, a comprehensive collection of libraries and tools designed to integrate the GoodDollar Protocol into your applications. This monorepo provides everything you need to work with GoodDollar's Identity verification and Universal Basic Income (UBI) claiming systems.

## 🎯 What is GoodDollar?

GoodDollar is a protocol that aims to reduce wealth inequality through blockchain technology by providing Universal Basic Income (UBI) to verified users. The protocol uses identity verification to ensure fair distribution of G$ tokens.

## 📋 Overview

The GoodSDK's Monorepo is structured to facilitate seamless development, testing, and deployment of identity-related functionalities across various applications. By centralizing shared packages and utilities, it ensures consistency and reusability, reducing redundancy and enhancing maintainability.

### Key Components

- **Packages**: Reusable libraries and SDKs that provide core functionalities.
- **Applications**: Frontend and backend applications that utilize the packages to deliver complete solutions.

## 📦 SDK Components

### 1. **Identity SDK** (`@goodsdks/citizen-sdk`)

The Identity SDK provides tools for managing user identity verification and whitelist status. It's the foundation for all GoodDollar integrations.

**Key Features:**
- ✅ Identity verification and whitelist management
- ✅ Face verification link generation
- ✅ Identity expiry tracking
- ✅ Support for both Wagmi (React) and Viem (backend) integrations

**Use Cases:**
- Verify user identity before allowing UBI claims
- Check whitelist status for access control
- Generate face verification links for new users

### 2. **Claim SDK** (`@goodsdks/citizen-sdk`)

The Claim SDK is part of the same `@goodsdks/citizen-sdk` package and handles Universal Basic Income (UBI) claiming functionality. It works in conjunction with the Identity SDK to ensure only verified users can claim their daily UBI.

**Key Features:**
- ✅ Daily UBI claiming with automatic balance checks
- ✅ Entitlement verification
- ✅ Next claim time tracking
- ✅ Daily statistics

**Use Cases:**
- Allow verified users to claim their daily UBI
- Show users when they can next claim
- Display claiming statistics

## 🔄 Claim Flow Logic

The GoodDollar SDK implements a sophisticated claim flow that ensures fair and secure UBI distribution:

### **Flow States:**

1. **🔍 Verify Button** - When user is **NOT whitelisted**
   - User needs to complete identity verification
   - Shows "Verify Me" button
   - Redirects to face verification process

2. **⏰ Timer State** - When user is **whitelisted but already claimed**
   - User has already claimed UBI for the current period
   - Shows countdown to next claim time
   - Displays "Come back tomorrow to claim your UBI!"

3. **💰 Claim Button** - When user is **whitelisted and can claim**
   - User is verified and eligible for UBI
   - Shows claimable amount
   - Displays "Claim UBI [amount]" button

For complete implementation details and code examples, see our **[Claim Flow Implementation Guide](packages/citizen-sdk/README-ClaimFlow.md)**.

## 🚀 Quick Start

### Installation

```bash
npm install @goodsdks/citizen-sdk
# or
yarn add @goodsdks/citizen-sdk
```

### Basic Usage

```typescript
import { useIdentitySDK, useClaimSDK } from '@goodsdks/citizen-sdk';

function App() {
  const identitySDK = useIdentitySDK('production');
  const claimSDK = useClaimSDK('production');
  
  // Check if user is whitelisted
  const checkWhitelist = async (address: string) => {
    const { isWhitelisted } = await identitySDK.getWhitelistedRoot(address);
    return isWhitelisted;
  };
  
  // Claim UBI
  const claimUBI = async () => {
    const receipt = await claimSDK.claim();
    console.log('UBI claimed!', receipt);
  };
  
  return (
    <div>
      {/* Your UI components */}
    </div>
  );
}
```

## 📚 Documentation

- **[Identity SDK Documentation](packages/citizen-sdk/README.md)** - Complete guide to identity verification
- **[Claim SDK Documentation](packages/citizen-sdk/README-ClaimSDK.md)** - UBI claiming implementation details and claim flow examples
- **[Demo Application](apps/demo-identity-app/README.md)** - Live example implementation

## 🎮 Live Demos

- **[Identity Demo App](https://demo-identity-app.vercel.app/)** - See the SDK in action
- **[Source Code](apps/demo-identity-app/)** - Complete implementation example

## 🛠️ Development

### Prerequisites

- Node.js >= 18
- Yarn package manager

### Setup

```bash
# Clone the repository
git clone https://github.com/GoodDollar/GoodSDKs.git
cd GoodSDKs

# Install dependencies
yarn install --immutable

# Build all packages
yarn build

# Start development server
cd apps/demo-identity-app
yarn dev
```

## 🤝 Contributing

We welcome contributions! Please see our [Contributing Guidelines](https://github.com/GoodDollar/.github/blob/master/CONTRIBUTING.md) for details.

### Getting Started with Contributions

1. **Fork and clone** the repository
2. **Create a feature branch** for your work
3. **Make your changes** following the existing patterns
4. **Test thoroughly** using the demo applications
5. **Submit a pull request** with clear descriptions

### Scoutgame Rewards

We offer rewards for contributions through our [Scoutgame Program](https://scoutgame.xyz/info/partner-rewards/good-dollar). Look for issues labeled with `scoutgame` to get started!

## 🌐 Community

- **[Discord](https://ubi.gd/GoodBuildersDiscord)** - Join our developer community
- **[Documentation](https://docs.gooddollar.org)** - Official GoodDollar docs
- **[GoodBuilders Program](https://gooddollar.notion.site/GoodBuilders-Program-1a6f258232f080fea8a6e3760bb8f53d)** - Build on GoodDollar

## 📄 License

This project is licensed under the MIT License. See the [LICENSE](LICENSE) file for details.
