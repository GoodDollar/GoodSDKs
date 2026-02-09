#!/usr/bin/env npx tsx
/**
 * Test script to verify connected accounts claiming flow using SDK classes
 */
import {
  createPublicClient,
  createWalletClient,
  http,
  zeroAddress,
  type Address,
} from "viem"
import { celo } from "viem/chains"
import { ClaimSDK } from "../../packages/citizen-sdk/src/sdks/viem-claim-sdk"
import { IdentitySDK } from "../../packages/citizen-sdk/src/sdks/viem-identity-sdk"
import {
  chainConfigs,
  SupportedChains,
  type contractEnv,
} from "../../packages/citizen-sdk/src/constants"

// Configuration
const config = {
  mainAccount: (process.env.MAIN_ACCOUNT as Address) || zeroAddress,
  connectedAccount: (process.env.CONNECTED_ACCOUNT as Address) || zeroAddress,
  nonWhitelistedAccount:
    (process.env.NON_WHITELISTED_ACCOUNT as Address) || zeroAddress,
  rpcUrl: process.env.RPC_URL || "https://forno.celo.org",
  env: (process.env.ENV as contractEnv) || "development",
}

// Validate required env vars
if (
  config.mainAccount === zeroAddress ||
  config.connectedAccount === zeroAddress ||
  config.nonWhitelistedAccount === zeroAddress
) {
  console.error("❌ Error: Required environment variables missing")
  console.error(
    "Please set: MAIN_ACCOUNT, CONNECTED_ACCOUNT, NON_WHITELISTED_ACCOUNT",
  )
  console.error(
    "Example: MAIN_ACCOUNT=0x... CONNECTED_ACCOUNT=0x... NON_WHITELISTED_ACCOUNT=0x... npm run test:connected",
  )
  process.exit(1)
}

// Colors for output
const colors = {
  reset: "\x1b[0m",
  green: "\x1b[32m",
  red: "\x1b[31m",
  yellow: "\x1b[33m",
  blue: "\x1b[34m",
  gray: "\x1b[90m",
}

function log(message: string, color: keyof typeof colors = "reset") {
  console.log(`${colors[color]}${message}${colors.reset}`)
}

function logTest(name: string, passed: boolean, details: string = "") {
  const icon = passed ? "✓" : "✗"
  const color = passed ? "green" : "red"
  log(`${icon} ${name}`, color)
  if (details) {
    log(`  ${details}`, "gray")
  }
}

async function runTests() {
  log("\n🧪 Testing Connected Accounts Flow (SDK-Native)\n", "blue")
  log(`Environment: ${config.env}`, "gray")
  log(`RPC: ${config.rpcUrl}\n`, "gray")

  // 1. Setup Clients
  const publicClient = createPublicClient({
    chain: celo,
    transport: http(config.rpcUrl),
  })

  // Create a mock wallet client to satisfy SDK requirements
  const walletClient = createWalletClient({
    account: config.mainAccount,
    chain: celo,
    transport: http(config.rpcUrl),
  })

  // 2. Initialize SDKs
  const identitySDK = new IdentitySDK({
    publicClient: publicClient as any,
    walletClient: walletClient as any,
    env: config.env,
  })

  let passedTests = 0
  let totalTests = 0

  // Test 1: Whitelisted Root Resolution (Main Account)
  totalTests++
  try {
    log("Test 1: Main whitelisted account resolution", "yellow")
    const { isWhitelisted, root } = await identitySDK.getWhitelistedRoot(
      config.mainAccount,
    )

    const isSelf = root.toLowerCase() === config.mainAccount.toLowerCase()
    if (isWhitelisted && isSelf) {
      logTest(
        "Main account correctly resolves to itself",
        true,
        `Root: ${root}`,
      )
      passedTests++
    } else {
      logTest(
        "Main account resolution failed",
        false,
        `Whitelisted: ${isWhitelisted}, Root: ${root}`,
      )
    }
  } catch (error: any) {
    logTest("Main account test error", false, error.message)
  }

  // Test 2: Whitelisted Root Resolution (Connected Account)
  totalTests++
  try {
    log("\nTest 2: Connected account resolution", "yellow")
    const { isWhitelisted, root } = await identitySDK.getWhitelistedRoot(
      config.connectedAccount,
    )

    const isConnected = root.toLowerCase() === config.mainAccount.toLowerCase()
    if (isWhitelisted && isConnected) {
      logTest("Connected account resolves to main", true, `Root: ${root}`)
      passedTests++
    } else {
      logTest(
        "Connected account resolution failed",
        false,
        `Whitelisted: ${isWhitelisted}, Root: ${root}`,
      )
    }
  } catch (error: any) {
    logTest("Connected account test error", false, error.message)
  }

  // Test 3: Verify SDK throws correct error for non-whitelisted accounts
  totalTests++
  try {
    log("\nTest 3: SDK check for non-whitelisted account", "yellow")

    // Use ClaimSDK with non-whitelisted account
    const nonWhitelistedWallet = createWalletClient({
      account: config.nonWhitelistedAccount,
      chain: celo,
      transport: http(config.rpcUrl),
    })

    const claimSDK = new ClaimSDK({
      account: config.nonWhitelistedAccount,
      publicClient: publicClient as any,
      walletClient: nonWhitelistedWallet as any,
      identitySDK,
      env: config.env,
    })

    await claimSDK.checkEntitlement()
    logTest(
      "Non-whitelisted check did not throw",
      false,
      "Expected error was not thrown",
    )
  } catch (error: any) {
    const match = error.message.includes("No whitelisted root address found")

    if (match) {
      logTest(
        "ClaimSDK correctly throws descriptive error for non-whitelisted",
        true,
        `Caught: ${error.message}`,
      )
      passedTests++
    } else {
      logTest(
        "ClaimSDK threw unexpected error",
        false,
        `Expected descriptive error, got: ${error.message}`,
      )
    }
  }

  // Test 4: Wallet Claim Status
  totalTests++
  try {
    log("\nTest 4: Wallet Claim Status resolution", "yellow")
    const claimSDK = new ClaimSDK({
      account: config.mainAccount,
      publicClient: publicClient as any,
      walletClient: walletClient as any,
      identitySDK,
      env: config.env,
    })

    const status = await claimSDK.getWalletClaimStatus()
    logTest(
      `Status successfully retrieved: ${status.status}`,
      true,
      `Entitlement: ${status.entitlement}`,
    )
    passedTests++
  } catch (error: any) {
    logTest("Wallet status check error", false, error.message)
  }

  // Summary
  log("\n" + "=".repeat(50), "gray")
  log(
    `\nTest Results: ${passedTests}/${totalTests} passed`,
    passedTests === totalTests ? "green" : "red",
  )

  if (passedTests === totalTests) {
    log(
      "\n✅ All SDK-native tests passed! The implementation is robust.\n",
      "green",
    )
    process.exit(0)
  } else {
    log(
      "\n❌ Some tests failed. Please review the SDK implementation.\n",
      "red",
    )
    process.exit(1)
  }
}

runTests().catch((error) => {
  log(`\nCritical Failure: ${error.message}`, "red")
  process.exit(1)
})
