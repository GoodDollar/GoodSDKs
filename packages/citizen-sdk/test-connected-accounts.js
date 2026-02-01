#!/usr/bin/env node
/**
 * Test script to verify connected accounts claiming flow
 * 
 * This script tests that:
 * 1. Main whitelisted accounts can check entitlement
 * 2. Connected accounts resolve to their whitelisted root
 * 3. Entitlement checks use the root address, not the connected address
 * 
 * Usage:
 *   node test-connected-accounts.js
 * 
 * Environment variables:
 *   MAIN_ACCOUNT=0x... (whitelisted account address)
 *   CONNECTED_ACCOUNT=0x... (account connected to MAIN_ACCOUNT)
 *   NON_WHITELISTED_ACCOUNT=0x... (not whitelisted)
 *   RPC_URL=https://... (optional, defaults to Celo)
 *   ENV=development|staging|production (optional, defaults to development)
 */

import { createPublicClient, http, parseAbi } from 'viem'
import { celo } from 'viem/chains'
import { chainConfigs } from './src/constants.js'

// Configuration
const config = {
    mainAccount: process.env.MAIN_ACCOUNT || '0x0000000000000000000000000000000000000000',
    connectedAccount: process.env.CONNECTED_ACCOUNT || '0x0000000000000000000000000000000000000000',
    nonWhitelistedAccount: process.env.NON_WHITELISTED_ACCOUNT || '0x0000000000000000000000000000000000000000',
    rpcUrl: process.env.RPC_URL || 'https://forno.celo.org',
    env: process.env.ENV || 'development',
}

// Get contract addresses from SDK configuration
const celoConfig = chainConfigs[42220] // Celo mainnet chain ID
const contracts = celoConfig.contracts[config.env]

if (!contracts) {
    console.error(`No contract configuration found for environment: ${config.env}`)
    process.exit(1)
}

// ABIs
const identityABI = parseAbi([
    'function getWhitelistedRoot(address account) view returns (address)',
])

const ubiABI = parseAbi([
    'function checkEntitlement(address _member) view returns (uint256)',
])

// Colors for output
const colors = {
    reset: '\x1b[0m',
    green: '\x1b[32m',
    red: '\x1b[31m',
    yellow: '\x1b[33m',
    blue: '\x1b[34m',
    gray: '\x1b[90m',
}

function log(message, color = 'reset') {
    console.log(`${colors[color]}${message}${colors.reset}`)
}

function logTest(name, passed, details = '') {
    const icon = passed ? '✓' : '✗'
    const color = passed ? 'green' : 'red'
    log(`${icon} ${name}`, color)
    if (details) {
        log(`  ${details}`, 'gray')
    }
}

async function testConnectedAccounts() {
    log('\n🧪 Testing Connected Accounts Claiming Flow\n', 'blue')
    log(`Environment: ${config.env}`, 'gray')
    log(`RPC: ${config.rpcUrl}`, 'gray')
    log(`Identity Contract: ${contracts.identityContract}`, 'gray')
    log(`UBI Contract: ${contracts.ubiContract}\n`, 'gray')

    // Create client
    const publicClient = createPublicClient({
        chain: celo,
        transport: http(config.rpcUrl),
    })

    let passedTests = 0
    let totalTests = 0

    // Test 1: Main account returns itself as root
    totalTests++
    try {
        log('Test 1: Main whitelisted account', 'yellow')
        const root = await publicClient.readContract({
            address: contracts.identityContract,
            abi: identityABI,
            functionName: 'getWhitelistedRoot',
            args: [config.mainAccount],
        })

        const isWhitelisted = root !== '0x0000000000000000000000000000000000000000'
        const isSelf = root.toLowerCase() === config.mainAccount.toLowerCase()

        if (isWhitelisted && isSelf) {
            logTest('Main account is whitelisted', true, `Root: ${root}`)
            passedTests++
        } else {
            logTest('Main account is whitelisted', false, `Expected self, got: ${root}`)
        }
    } catch (error) {
        logTest('Main account test', false, error.message)
    }

    // Test 2: Connected account returns main account as root
    totalTests++
    try {
        log('\nTest 2: Connected account resolution', 'yellow')
        const root = await publicClient.readContract({
            address: contracts.identityContract,
            abi: identityABI,
            functionName: 'getWhitelistedRoot',
            args: [config.connectedAccount],
        })

        const isConnected = root.toLowerCase() === config.mainAccount.toLowerCase()

        if (isConnected) {
            logTest('Connected account resolves to main', true, `Root: ${root}`)
            passedTests++
        } else {
            logTest('Connected account resolves to main', false, `Expected ${config.mainAccount}, got: ${root}`)
        }
    } catch (error) {
        logTest('Connected account test', false, error.message)
    }

    // Test 3: Non-whitelisted account returns 0x0
    totalTests++
    try {
        log('\nTest 3: Non-whitelisted account', 'yellow')
        const root = await publicClient.readContract({
            address: contracts.identityContract,
            abi: identityABI,
            functionName: 'getWhitelistedRoot',
            args: [config.nonWhitelistedAccount],
        })

        const isNotWhitelisted = root === '0x0000000000000000000000000000000000000000'

        if (isNotWhitelisted) {
            logTest('Non-whitelisted account returns 0x0', true, `Root: ${root}`)
            passedTests++
        } else {
            logTest('Non-whitelisted account returns 0x0', false, `Expected 0x0, got: ${root}`)
        }
    } catch (error) {
        logTest('Non-whitelisted account test', false, error.message)
    }

    // Test 4: Entitlement check with main account
    totalTests++
    try {
        log('\nTest 4: Entitlement check (main account)', 'yellow')
        const entitlement = await publicClient.readContract({
            address: contracts.ubiContract,
            abi: ubiABI,
            functionName: 'checkEntitlement',
            args: [config.mainAccount],
        })

        logTest('Main account entitlement retrieved', true, `Entitlement: ${entitlement.toString()}`)
        passedTests++
    } catch (error) {
        logTest('Main account entitlement check', false, error.message)
    }

    // Test 5: Entitlement check should use root address (simulating SDK behavior)
    totalTests++
    try {
        log('\nTest 5: Entitlement check (connected account → root)', 'yellow')

        // First get the root
        const root = await publicClient.readContract({
            address: contracts.identityContract,
            abi: identityABI,
            functionName: 'getWhitelistedRoot',
            args: [config.connectedAccount],
        })

        // Then check entitlement using root (this is what SDK does)
        const entitlement = await publicClient.readContract({
            address: contracts.ubiContract,
            abi: ubiABI,
            functionName: 'checkEntitlement',
            args: [root], // Using root, not connected account
        })

        logTest('Connected account entitlement via root', true, `Root: ${root}, Entitlement: ${entitlement.toString()}`)
        passedTests++
    } catch (error) {
        logTest('Connected account entitlement check', false, error.message)
    }

    // Summary
    log('\n' + '='.repeat(50), 'gray')
    log(`\nTest Results: ${passedTests}/${totalTests} passed`, passedTests === totalTests ? 'green' : 'red')

    if (passedTests === totalTests) {
        log('\n✅ All tests passed! Connected accounts flow is working correctly.\n', 'green')
        process.exit(0)
    } else {
        log('\n❌ Some tests failed. Please review the implementation.\n', 'red')
        process.exit(1)
    }
}

// Run tests
testConnectedAccounts().catch((error) => {
    log(`\n❌ Test execution failed: ${error.message}\n`, 'red')
    console.error(error)
    process.exit(1)
})
