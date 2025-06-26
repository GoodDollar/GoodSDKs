# GoodSdks Monorepo

Welcome to the **GoodSdks Monorepo**, a unified repository housing multiple packages and applications designed to streamline integrating and working with the GoodDollar Protocol and G$ token. This monorepo leverages modern tools and libraries such as **React**, **Wagmi**, and **Viem SDK** to deliver robust and scalable solutions for both frontend and backend environments.

## Table of Contents

- [Overview](#overview)
- [Packages](#packages)
  - [citizen-sdk](packages/citizen-sdk/README.md)
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

### [citizen-sdk](packages/citizen-sdk/README.md)

The `citizen-sdk` is a comprehensive library designed to interact seamlessly with GoodDollar's Identity smart contracts. It leverages both **Viem** and **Wagmi** SDKs to provide robust functionalities for managing a user's G$ identity on the blockchain. Whether you're building a frontend application or integrating backend services, `citizen-sdk` offers the tools you need to handle identity verification, whitelist management, and more.

#### Features

- **Wagmi SDK Integration**: Simplifies blockchain interactions within React applications using hooks.
- **Viem SDK Integration**: Provides utility functions for backend services or non-React environments.
- **Identity Management**: Functions to verify identities, manage whitelists, and handle authentication periods.

For detailed information, refer to the [citizen-sdk README](packages/citizen-sdk/README.md).

## Applications

### [demo-identity-app](apps/demo-identity-app/README.md)

The `demo-identity-app` is a React-based application that demonstrates the capabilities of the `citizen-sdk`. It showcases how to integrate identity verification features into a frontend application, providing a practical example for developers to follow.

#### Features

- **Identity Card Component**: Displays wallet address and identity expiry information.
- **Whitelist Status Checker**: Allows users to check their whitelist status through a simple interface.
- **Responsive Design**: Built with Tamagui for a consistent and adaptable UI across devices.

For more details, please see the [demo-identity-app README](apps/demo-identity-app/README.md).

## Contributing

Contributions are welcome! Please open an issue or submit a pull request for any improvements or bug fixes.
See our main contribution Guidelines: https://github.com/GoodDollar/.github/blob/master/CONTRIBUTING.md

There will also be tickets available with a 'scoutgame' label. see our rewards page for more information: https://scoutgame.xyz/info/partner-rewards/good-dollar

You can also join our developer community on Discord: https://ubi.gd/GoodBuildersDiscord

## License

This project is licensed under the MIT License. See the [LICENSE](LICENSE) file for details.
