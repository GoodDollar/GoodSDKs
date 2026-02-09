# Connected Accounts Test Script

Tests that connected accounts can claim UBI via their whitelisted root address.

## Setup

1. **Copy the example configuration:**
   ```bash
   cd test/citizen-sdk
   cp .env.example .env
   ```

2. **Edit `.env` with your test addresses:**
   ```bash
   MAIN_ACCOUNT=0xYourWhitelistedAddress
   CONNECTED_ACCOUNT=0xYourConnectedAddress
   NON_WHITELISTED_ACCOUNT=0xYourNonWhitelistedAddress
   ENV=development
   ```

3. **Run the test:**
   ```bash
   ./run-test.sh
   ```

## Run Commands

```bash
# From test directory (recommended)
cd test/citizen-sdk
./run-test.sh
```

```bash
# From mono-repo root
bash test/citizen-sdk/run-test.sh
```

```bash
# Using npm script from packages/citizen-sdk
cd packages/citizen-sdk
npm run test:connected
```

## Configuration

### Required Environment Variables

- `MAIN_ACCOUNT` - Whitelisted account address
- `CONNECTED_ACCOUNT` - Account connected to main account
- `NON_WHITELISTED_ACCOUNT` - Non-whitelisted account for error testing

### Optional Environment Variables

- `ENV` - Environment: `development`, `staging`, or `production` (default: `development`)
- `RPC_URL` - Custom RPC endpoint (default: `https://forno.celo.org`)

## Pass/Fail Criteria

**Pass**: All 4 tests pass
- ✅ Main account resolves to itself
- ✅ Connected account resolves to main account
- ✅ Non-whitelisted account throws descriptive error
- ✅ Wallet claim status retrieval succeeds

**Fail**: Any test fails, indicating issues with whitelisted root resolution or entitlement checks.
