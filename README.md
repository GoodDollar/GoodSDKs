# GoodDollar SDKs Monorepo

This Turborepo hosts the GoodDollar SDKs, shared configuration, and example applications that demonstrate identity, claim, engagement, and savings flows.

Each workspace publishes its own README with implementation details; the root focuses on repository layout and contributor workflow.

## Prerequisites

- Node.js 18 or newer
- Yarn 4 (enable via `corepack enable` if needed)

## 🎮 Live Demos

- **[Identity Demo App](https://demo-identity-app.vercel.app/)** - See the SDK in action
- **[Source Code](apps/demo-identity-app/)** - Complete implementation example

## 👥 Apply your Dapp for Engagement rewards

- **[Engagement Rewards](https://engagement-rewards.vercel.app/)**

## Bootstrapping the Workspace

```bash
git clone https://github.com/GoodDollar/GoodSDKs.git
cd GoodSDKs
yarn install --immutable
yarn build
```

Common tasks:

- `yarn lint` – run ESLint across the repo
- `yarn turbo run <task> --filter=<workspace>` – target a specific package or app
- `yarn workspace <name> build` – build a single workspace with `tsup`

## Workspace Map

- `packages/citizen-sdk` – Viem-based identity and claim clients ([README](packages/citizen-sdk/README.md))
- `packages/react-hooks` – Wagmi hooks wrapping the citizen SDK ([README](packages/react-hooks/README.md))
- `packages/engagement-sdk` – engagement rewards utilities that consume exported ABIs
- `packages/ui-components` – Lit web components ([README](packages/ui-components/README.md))
- `packages/savings-sdk` – savings integrations for viem/wagmi apps
- `packages/savings-widget` – Lit widget surfacing savings flows ([README](packages/savings-widget/README.md))
- `packages/engagement-contracts` – Hardhat project exporting protocol ABIs
- `packages/eslint-config`, `packages/typescript-config` – shared tooling configuration

## Demo Applications

- `apps/demo-identity-app` – React demo covering identity + claim flows
- `apps/engagement-app` – engagement rewards showcase
- `apps/demo-webcomponents` – Vite playground for Lit components

Each app documents its development server and environment requirements inside its own README.

## Development Notes

- Run `yarn turbo run lint --filter=<workspace>` and `yarn workspace <name> build` before opening a PR.
- Contract addresses and ABIs originate from the GoodProtocol repo; regenerate via `yarn workspace @goodsdks/engagement-contracts export-abis` rather than editing by hand.

## 🤝 Contributing

**We welcome any type of technical contributions!**

Please read our [Contributing Guidelines](https://github.com/GoodDollar/.github/blob/master/CONTRIBUTING.md) for details and our different open-source contributor opportunities.

## 📄 License

This project is licensed under the MIT License. See the [LICENSE](LICENSE) file for details.
