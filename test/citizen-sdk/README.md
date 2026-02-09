# Connected Accounts Test Script

Tests that connected accounts can claim UBI via their whitelisted root.

## Run Commands

```bash
cd test/citizen-sdk
cp .env.example .env  # Edit with your test addresses
./run-test.sh
```

Alternatively from packages/citizen-sdk:
```bash
npm run test:connected
```

## Required Environment Variables

- `MAIN_ACCOUNT` - Whitelisted account address **(required)**
- `CONNECTED_ACCOUNT` - Account connected to main **(required)**
- `NON_WHITELISTED_ACCOUNT` - Non-whitelisted account for error testing **(required)**
- `ENV` - Environment: development, staging, or production (optional, default: development)
- `RPC_URL` - Custom RPC endpoint (optional, default: https://forno.celo.org)

## Pass/Fail Criteria

**Pass:** All 4 tests pass - main resolves to self, connected resolves to main, non-whitelisted throws error, status retrieval succeeds.

**Fail:** Any test fails - indicates issues with whitelisted root resolution or entitlement checks.
