# Connected Accounts Test Script

This directory contains a standalone test script to verify the connected accounts claiming flow works correctly.

## Usage

### Basic Usage

```bash
node test-connected-accounts.js
```

### With Environment Variables

```bash
MAIN_ACCOUNT=0x1234... \
CONNECTED_ACCOUNT=0x5678... \
NON_WHITELISTED_ACCOUNT=0x9abc... \
ENV=development \
node test-connected-accounts.js
```

## Environment Variables

| Variable | Description | Required | Default |
|----------|-------------|----------|---------|
| `MAIN_ACCOUNT` | Main whitelisted account address | No | 0x0...0 |
| `CONNECTED_ACCOUNT` | Account connected to main account | No | 0x0...0 |
| `NON_WHITELISTED_ACCOUNT` | Non-whitelisted account | No | 0x0...0 |
| `ENV` | Environment (development/staging/production) | No | development |
| `RPC_URL` | Custom RPC URL | No | https://forno.celo.org |

## What It Tests

1. **Main Account Resolution** - Verifies main whitelisted account returns itself as root
2. **Connected Account Resolution** - Verifies connected account returns main account as root
3. **Non-Whitelisted Account** - Verifies non-whitelisted account returns 0x0
4. **Main Account Entitlement** - Verifies entitlement check works for main account
5. **Connected Account Entitlement** - Verifies entitlement check uses root address (simulating SDK behavior)

## Example Output

```
🧪 Testing Connected Accounts Claiming Flow

Environment: development
RPC: https://forno.celo.org
Identity Contract: 0xF25fA0D4896271228193E782831F6f3CFCcF169C
UBI Contract: 0x6B86F82293552C3B9FE380FC038A89e0328C7C5f

Test 1: Main whitelisted account
✓ Main account is whitelisted
  Root: 0x1234...

Test 2: Connected account resolution
✓ Connected account resolves to main
  Root: 0x1234...

Test 3: Non-whitelisted account
✓ Non-whitelisted account returns 0x0
  Root: 0x0000000000000000000000000000000000000000

Test 4: Entitlement check (main account)
✓ Main account entitlement retrieved
  Entitlement: 1000000000000000000

Test 5: Entitlement check (connected account → root)
✓ Connected account entitlement via root
  Root: 0x1234..., Entitlement: 1000000000000000000

==================================================

Test Results: 5/5 passed

✅ All tests passed! Connected accounts flow is working correctly.
```

## Integration with CI/CD

Add to your CI pipeline:

```yaml
# .github/workflows/test.yml
- name: Test Connected Accounts
  run: |
    cd packages/citizen-sdk
    MAIN_ACCOUNT=${{ secrets.TEST_MAIN_ACCOUNT }} \
    CONNECTED_ACCOUNT=${{ secrets.TEST_CONNECTED_ACCOUNT }} \
    NON_WHITELISTED_ACCOUNT=${{ secrets.TEST_NON_WHITELISTED }} \
    ENV=development \
    node test-connected-accounts.js
```

## Notes

- This script only tests contract interactions, not the full SDK
- Requires valid test accounts to be set via environment variables
- Uses read-only contract calls (no transactions)
- No private key needed (read-only operations)
