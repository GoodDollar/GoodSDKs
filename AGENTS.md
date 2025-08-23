````markdown
AGENTS.md

# Project: GoodSDKs – GoodDollar Developer Toolkits

## Project Summary

**GoodSDKs** is a monorepo of TypeScript SDKs, web-components, and demo apps that let dApp builders integrate  
GoodDollar’s Universal Basic Income (G$ UBI) and Sybil-Resistant Identity into their own projects.  
The repo focuses on front-end / integration logic; core contracts live in **GoodProtocol**.

---

## AI Agent Instructions

### Primary Goal

Accelerate developer adoption by keeping the SDKs easy to extend, test, and ship. Priorities:

- Clear, typed APIs for identity & claim flows and other protocol related utilities
- Modern React + Web-Component examples
- Minimal external deps; share utilities across packages
- Smooth CI (type-check, lint, build) and preview deploys
- Maintain parity with GoodProtocol contract addresses / ABIs

---

### How to Use / Run the Project

1. **Install dependencies**

   ```sh
   yarn install --immutable     # Yarn Berry workspaces
   ```

2. **Build all packages**

   ```sh
   yarn build                   # Turborepo pipeline
   ```

3. **Start a demo app**

   ```sh
   cd apps/demo-identity-app && yarn dev
   # → http://localhost:3000
   ```

4. **Run tests / lints**

   ```sh
   yarn lint     # ESLint + Prettier
   yarn test     # Hardhat tests inside engagement-contracts
   ```

---

### Directory Structure

```
packages/
├─ citizen-sdk/           # Identity & Claim classes
├─ engagement-sdk/        # Engagement-Rewards helpers
├─ ui-components/         # Lit web-components (e.g., <claim-button>)
├─ react-hooks            # Identity & Claim (wagmi) hooks
├─ engagement-contracts/  # Solidity + Hardhat tests (demo only)
apps/
├─ demo-identity-app/     # React demo using citizen-sdk
├─ engagement-app/        # React demo using engagement-sdk
configs/                  # tsconfig, eslint-config shared
.turbo/                   # Turborepo pipeline configs
```

**Key points**

- SDK packages build to **ESM** + **CJS** in `dist/`.
- Demo apps consume **local** packages via workspace versions—run `yarn build` first.
- Contract addresses are auto-selected by `env` (`production` | `staging` | `development`).

---

### Code & Style Preferences

- **Language:** TypeScript 5 + ES2022 modules
- **Frameworks:** React 18 w/ Vite; Lit for web-components
- **Wallet/Chain:** Wagmi v2 & Viem; ethers v6 only inside tests
- **Lint / Format:** ESLint + Prettier (run `yarn lint` / `yarn format`)
- **Testing:** Vitest for TS utils, Hardhat for Solidity
- **Design Philosophy:** typed, composable, no inline callbacks in JSX, prefer hooks > HOCs

---

#### Web-Component Pattern

Wrap reusable claim/identity UI in **Lit** custom elements to keep React optional:

```ts
// packages/ui-components/src/claim-button.ts
@customElement('gd-claim-button')
export class ClaimButton extends LitElement { … }
```

- _Expose_ minimal attributes (`environment`, `on-claimed`) for host apps.
- _Style_ with shadow DOM + CSS custom properties; keep bundle ≤ 3 kB.

---

#### Sanity Checks for Every PR

1. No lint / type errors (`yarn lint --fix && yarn tsc --noEmit`).
2. Demo apps build **without** warnings (`yarn build` in each app).
3. Added functions are covered by unit tests _or_ exercised via a demo flow.
4. Public APIs (`*.d.ts`) documented with JSDoc.
5. If a change requires GoodProtocol upgrades, open an issue instead of altering ABI locally.

---

### Extensibility for Agents

Agents may …

- Add new hooks (e.g., `useG$Price`) under `citizen-sdk`.
- Create additional web-components in `ui-components`.
- Update `configs/` to share ESLint/TS rules across packages.
- Chose to use Tamagui for a demo-app.

Agents must **not** …

- Introduce heavy UI libs (keep bundle light).

---

## GoodProtocol Reference

Smart-contract sources → `https://github.com/GoodDollar/GoodProtocol`  
Use for **reading** ABIs & addresses; any contract change belongs there,  
_not_ in this repo.

---

Happy building! GoodDollar appreciates contributions that help spread UBI to everyone.
````
