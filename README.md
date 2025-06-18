# GoodSdks Monorepo

Welcome to the **GoodSdks Monorepo**, a unified repository housing multiple packages and applications designed to streamline integrating and working with the GoodDollar Protocol and G$ token. This monorepo leverages modern tools and libraries such as **React**, **Wagmi**, and **Viem SDK** to deliver robust and scalable solutions for both frontend and backend environments.

## Table of Contents

- [Overview](#overview)
- [Packages](#packages)
  - [identity-sdk](packages/citizen-sdk/README.md)
- [Applications](#applications)
  - [demo-identity-app](apps/demo-identity-app/README.md)
- [Getting Started](#getting-started)
- [Usage](#usage)
- [Contributing](#contributing)
- [License](#license)

## Overview

The GoodSDK's Monorepo is structured to facilitate seamless development, testing, and deployment of identity-related functionalities across various applications. By centralizing shared packages and utilities, it ensures consistency and reusability, reducing redundancy and enhancing maintainability.

### Key Components

- **Packages**: Reusable libraries and SDKs that provide core functionalities.
- **Applications**: Frontend and backend applications that utilize the packages to deliver complete solutions.

## Packages

### [identity-sdk](packages/citizen-sdk/README.md)

The `identity-sdk` is a comprehensive library designed to interact seamlessly with GoodDollar's Identity smart contracts. It leverages both **Viem** and **Wagmi** SDKs to provide robust functionalities for managing a user's G$ identity on the blockchain. Whether you're building a frontend application or integrating backend services, `identity-sdk` offers the tools you need to handle identity verification, whitelist management, and more.

#### Features

- **Wagmi SDK Integration**: Simplifies blockchain interactions within React applications using hooks.
- **Viem SDK Integration**: Provides utility functions for backend services or non-React environments.
- **Identity Management**: Functions to verify identities, manage whitelists, and handle authentication periods.

For detailed information, refer to the [identity-sdk README](packages/citizen-sdk/README.md).

## Applications

### [demo-identity-app](apps/demo-identity-app/README.md)

The `demo-identity-app` is a React-based application that demonstrates the capabilities of the `identity-sdk`. It showcases how to integrate identity verification features into a frontend application, providing a practical example for developers to follow.

#### Features

- **Identity Card Component**: Displays wallet address and identity expiry information.
- **Whitelist Status Checker**: Allows users to check their whitelist status through a simple interface.
- **Responsive Design**: Built with Tamagui for a consistent and adaptable UI across devices.

For more details, please see the [demo-identity-app README](apps/demo-identity-app/README.md).

## Getting Started

To get started with the Identity Monorepo, follow these steps:

1. **Clone the Repository**

   ```bash
   git clone https://github.com/GoodDollar/GoodSdks
   ```

2. **Navigate to the Project Directory**

   ```bash
   cd identity-monorepo
   ```

3. **Install Dependencies**

   The monorepo uses [Yarn Workspaces](https://yarnpkg.com/features/workspaces) for dependency management.
   Make sure to run yarn build, as the demo apps are not pulling in the goodsdk packages from npm, but rely on the locally build versions

   ```bash
   yarn install && yarn build
   ```

4. **Start the Development Server**

   Navigate to the desired application and start the development server.

   ```bash
   cd apps/demo-identity-app
   yarn dev
   ```

## Usage

### Developing with `identity-sdk`

To utilize the `identity-sdk` within your application:

1. **Import the SDK**

   ```typescript file.tsx
   import { useIdentitySDK } from "identity-sdk"
   ```

2. **Initialize the SDK**

   ```typescript file.tsx
   const identitySDK = useIdentitySDK("development")
   ```

3. **Use SDK Functions**

   ```typescript file.tsx
   const checkWhitelist = async (account: string) => {
     try {
       const { isWhitelisted, root } =
         await identitySDK.checkIsWhitelisted(account)
       console.log(`Is Whitelisted: ${isWhitelisted}, Root: ${root}`)
     } catch (error) {
       console.error(error)
     }
   }
   ```

For more examples and detailed usage, refer to the [identity-sdk README](packages/citizen-sdk/README.md).

### Running the Demo Application

The `demo-identity-app` provides a practical example of how to integrate the `identity-sdk` into a React application.

1. **Navigate to the Application Directory**

   ```bash
   cd apps/demo-identity-app
   ```

2. **Start the Application**

   ```bash
   yarn dev
   ```

3. **Access the Application**

   Open your browser and navigate to `http://localhost:3000` to view the demo.

## Contributing

Contributions are welcome! Please open an issue or submit a pull request for any improvements or bug fixes.
See our main contribution Guidelines: https://github.com/GoodDollar/.github/blob/master/CONTRIBUTING.md

There will also be tickets available with a 'scoutgame' label. see our rewards page for more information: https://scoutgame.xyz/info/partner-rewards/good-dollar

You can also join our developer community on Discord: https://ubi.gd/GoodBuildersDiscord

## License

This project is licensed under the MIT License. See the [LICENSE](LICENSE) file for details.
