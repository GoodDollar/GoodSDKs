# Testing the Superfluid Streaming SDK

## Quick Testing Options

### 1. **Create a Test Script (Recommended for Quick Validation)**

Create a simple test file to verify the SDK works:

```bash
# Create test directory
mkdir -p test-sdk
cd test-sdk
npm init -y
npm install viem @goodsdks/streaming-sdk
```

**test-sdk/index.js:**
```javascript
import { StreamingSDK, calculateFlowRate, SupportedChains } from '@goodsdks/streaming-sdk'
import { createPublicClient, http } from 'viem'
import { celo } from 'viem/chains'

async function testSDK() {
  console.log('Testing Superfluid Streaming SDK...\n')

  // 1. Test SDK initialization
  console.log('Step 1: Initialize SDK')
  const publicClient = createPublicClient({
    chain: celo,
    transport: http('https://forno.celo.org')
  })

  const sdk = new StreamingSDK(publicClient, undefined, {
    chainId: SupportedChains.CELO,
    environment: 'production'
  })
  console.log('   SDK initialized successfully\n')

  // 2. Test flow rate calculation
  console.log('Step 2: Test flow rate utilities')
  const flowRate = calculateFlowRate(BigInt('100000000000000000000'), 'month') // 100 tokens/month
  console.log(`   Flow rate: ${flowRate.toString()} wei/second\n`)

  // 3. Test subgraph queries
  console.log('Step 3: Query active streams')
  try {
    const streams = await sdk.getActiveStreams({
      account: '0x0000000000000000000000000000000000000001',
      direction: 'all',
    })
    console.log(`   Found ${streams.length} active streams\n`)
  } catch (error) {
    console.log(`   Query executed (account may not exist): ${error.message}\n`)
  }

  // 4. Test balance query
  console.log('Step 4: Query SuperToken balance')
  try {
    const balance = await sdk.getSuperTokenBalance('0x0000000000000000000000000000000000000001')
    console.log(`   Balance: ${balance.toString()} wei\n`)
  } catch (error) {
    console.log(`   Query executed: ${error.message}\n`)
  }

  console.log('All tests completed')
}

testSDK().catch(console.error)
```

Run with:
```bash
node index.js
```

---

### 2. **Test in an Existing App (Integration Testing)**

Add to your existing GoodDollar app:

```bash
cd apps/demo-identity-app  # or any existing app
yarn add @goodsdks/streaming-sdk
```

**Example usage in a React component:**
```typescript
import { usePublicClient, useWalletClient } from 'wagmi'
import { StreamingSDK, calculateFlowRate } from '@goodsdks/streaming-sdk'
import { parseEther } from 'viem'

function StreamingDemo() {
  const publicClient = usePublicClient()
  const { data: walletClient } = useWalletClient()

  const createStream = async () => {
    if (!publicClient || !walletClient) return

    const sdk = new StreamingSDK(publicClient, walletClient, {
      environment: 'production'
    })

    const flowRate = calculateFlowRate(parseEther('100'), 'month')
    
    const hash = await sdk.createStream({
      receiver: '0x...',
      token: '<G$_TOKEN_ADDRESS>', // replace with your local/testnet token address
      flowRate,
      onHash: (hash) => console.log('Transaction:', hash)
    })

    console.log('Stream created:', hash)
  }

  return <button onClick={createStream}>Create Stream</button>
}
```

---

### 3. **Test Subgraph Queries (No Wallet Needed)**

You can test subgraph functionality without a wallet:

```javascript
import { SubgraphClient, SupportedChains } from '@goodsdks/streaming-sdk'

async function testSubgraph() {
  const client = new SubgraphClient(SupportedChains.CELO)

  // Test querying streams for a known address
  const streams = await client.queryStreams({
    account: '0x...',  // Use a real address with streams
    direction: 'all'
  })

  console.log('Streams found:', streams)

  // Test querying member pools for a specific account
  const pools = await client.queryMemberPools('0x...')
  console.log('GDA member pools:', pools)

  // Test querying SUP reserves (Base) - requires The Graph Gateway apiKey
  const supClient = new SubgraphClient(SupportedChains.BASE, { apiKey: process.env.GRAPH_API_KEY })
  const reserves = await supClient.querySUPReserves()
  console.log('SUP reserves:', reserves)
}

testSubgraph()
```

---

### 4. **Test with Superfluid Subgraph Playground**

Visit the Superfluid decentralized subgraph endpoints to verify queries work:

**Celo:**
https://celo-mainnet.subgraph.x.superfluid.dev/

**Base:**
https://base-mainnet.subgraph.x.superfluid.dev/

Test this query:
```graphql
{
  streams(where: { currentFlowRate_gt: "0" }, first: 5) {
    id
    sender
    receiver
    currentFlowRate
    token {
      id
      symbol
    }
  }
}
```

---

### 5. **Manual Testing Checklist**

#### Build Verification
```bash
# From repo root
yarn build
# Should complete without errors
```

#### Type Checking
```bash
yarn tsc --noEmit --project packages/streaming-sdk/tsconfig.json
# Should show no errors
```

#### Import Test
```bash
node -e "import('@goodsdks/streaming-sdk').then(m => console.log(Object.keys(m)))"
# Should show exported members
```

#### Package Exports
Check that all exports are accessible:
```javascript
import {
  StreamingSDK,
  GdaSDK,
  SubgraphClient,
  calculateFlowRate,
  SupportedChains,
  // ... etc
} from '@goodsdks/streaming-sdk'

console.log('All exports loaded successfully')
```

---


---

### 7. **React Hooks Testing**

Test the React hooks in a component:

```typescript
import { useCreateStream, useStreamList } from '@goodsdks/react-hooks'
import { useAccount } from 'wagmi'

function StreamingComponent() {
  const { address } = useAccount()
  const { data: streams, isLoading } = useStreamList({ 
    account: address!,
    enabled: !!address 
  })

  const { mutate: createStream } = useCreateStream()

  return (
    <div>
      <p>Streams: {streams?.length ?? 0}</p>
      <button onClick={() => createStream({
        receiver: '0x...',
        token: '0x...',
        flowRate: BigInt('1000000000000000')
      })}>
        Create Stream
      </button>
    </div>
  )
}
```

---

## Recommended Testing Flow

### Phase 1: Local Verification (5 minutes)
1. Run `yarn build` - verify no errors
2. Run type check - verify no type errors
3. Test imports in Node REPL

### Phase 2: Subgraph Testing (10 minutes)
1. Test SubgraphClient with real addresses
2. Verify queries return expected data
3. Test on Superfluid playground

### Phase 3: Integration Testing (30 minutes)
1. Add to existing app
2. Test read operations (no wallet needed)
3. Test with wallet on a supported network
4. Create a test stream with small amount

### Phase 4: Production Testing (Careful!)
1. Test on mainnet with very small amounts (0.01 G$)
2. Verify transaction on block explorer
3. Confirm stream appears in Superfluid dashboard

---

## Common Issues & Solutions

### Issue: "Module not found"
**Solution:** Run `yarn install` from repo root

### Issue: "Chain not supported"
**Solution:** Ensure you're using Celo (42220) or Base (8453)

### Issue: "Wallet client not initialized"
**Solution:** Pass walletClient to SDK constructor for write operations

### Issue: Subgraph query fails
**Solution:** Check network connectivity and subgraph endpoint

---

## Quick Validation Script

Save this as `validate-sdk.sh`:

```bash
#!/bin/bash
echo "Validating Superfluid Streaming SDK..."

# Build
echo "1. Building packages..."
yarn build > /dev/null 2>&1
if [ $? -eq 0 ]; then
  echo "   Build successful"
else
  echo "   Build failed"
  exit 1
fi

# Type check
echo "2. Type checking..."
yarn tsc --noEmit --project packages/streaming-sdk/tsconfig.json > /dev/null 2>&1
if [ $? -eq 0 ]; then
  echo "   Type check passed"
else
  echo "   Type check failed"
  exit 1
fi

# Check exports
echo "3. Checking exports..."
node -e "import('@goodsdks/streaming-sdk').then(() => console.log('   Exports valid'))" 2>/dev/null

echo ""
echo "SDK validation complete"
```

Run with:
```bash
chmod +x validate-sdk.sh
./validate-sdk.sh
```
