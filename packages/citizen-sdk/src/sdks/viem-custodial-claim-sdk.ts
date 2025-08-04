import {
    type Account,
    type Address,
    type Chain,
    type PublicClient,
    type SimulateContractParameters,
    type WalletClient,
    type LocalAccount,
    ContractFunctionExecutionError,
    TransactionReceipt,
} from "viem"

import { waitForTransactionReceipt } from "viem/actions"
import { ClaimSDK, type ClaimSDKOptions } from "./viem-claim-sdk" // Import the base ClaimSDK
import type { WalletClaimStatus } from "../types"

interface ClaimCustodialSDKOptions extends Omit<ClaimSDKOptions, 'account'> {
    // Remove account from the options since we'll get it from walletClient
}

export class ClaimCustodialSDK extends ClaimSDK {
    constructor(options: ClaimCustodialSDKOptions) {
        // Get account from walletClient and pass to parent constructor
        const account = options.walletClient.account?.address
        if (!account) {
            throw new Error("ClaimCustodialSDK: WalletClient must have an account attached.")
        }
        
        super({
            ...options,
            account,
        })
    }



    /**
     * Override submitAndWait to handle LocalAccount signing for Celo RPC compatibility
     * Submits a transaction and waits for its receipt.
     * @param params - Parameters for simulating the contract call.
     * @param onHash - Optional callback to receive the transaction hash.
     * @returns The transaction receipt.
     * @throws If submission fails or no active wallet address is found.
     */
    async submitAndWait(
        params: SimulateContractParameters,
        onHash?: (hash: `0x${string}`) => void,
    ): Promise<TransactionReceipt> {
        const account = this.walletClient.account
        if (!account?.address) {
            throw new Error("No active wallet address found.")
        }

        // Simulate the contract call to get the transaction request
        const { request } = await this.publicClient.simulateContract({
            account: account.address,
            ...params,
        })

        // For LocalAccount, we need to sign locally and send raw transaction
        // to avoid Celo RPC's eth_sendTransaction restriction
        try {
            let hash: `0x${string}`

            if (account && 'signTransaction' in account) {
                // LocalAccount - sign locally and send raw transaction
                console.log('Using LocalAccount - signing transaction locally')

                // Prepare the transaction request with proper gas estimation
                const preparedRequest: any = await this.walletClient.prepareTransactionRequest({
                    account: account.address,
                    // @ts-ignore
                    to: request.to,
                    // @ts-ignore
                    data: request.data,
                    value: request.value || 0n,
                    gas: request.gas,
                    gasPrice: request.gasPrice,
                    maxFeePerGas: request.maxFeePerGas,
                    maxPriorityFeePerGas: request.maxPriorityFeePerGas,
                } as any)

                // Sign the transaction locally using the LocalAccount
                const signedTransaction = await (account as LocalAccount).signTransaction(preparedRequest)

                // Send the raw signed transaction to the network
                hash = await this.publicClient.sendRawTransaction({
                    serializedTransaction: signedTransaction
                })
            } else {
                // Fallback to regular writeContract (may fail on Celo RPC)
                console.log('Fallback to writeContract - may fail on Celo RPC')
                hash = await this.walletClient.writeContract(request)
            }

            onHash?.(hash)

            // Wait one block to prevent immediate errors
            await new Promise((res) => setTimeout(res, 5000))

            return waitForTransactionReceipt(this.publicClient as any, {
                hash,
                retryDelay: 5000,
            })
        } catch (error: any) {
            console.error('Transaction submission failed:', error)

            // Handle specific Celo RPC errors
            if (error.message?.includes('rpc method is not whitelisted') ||
                error.message?.includes('eth_sendTransaction') ||
                error.code === -32601) {
                throw new Error(
                    'Transaction failed: Celo RPC does not support eth_sendTransaction. ' +
                    'This error occurs when the LocalAccount is not properly set up. ' +
                    'Ensure you are using privateKeyToAccount() and the account is attached to walletClient.'
                )
            }

            // Handle other transaction errors
            if (error.message?.includes('insufficient funds')) {
                throw new Error('Transaction failed: Insufficient funds for gas fees.')
            }

            if (error.message?.includes('nonce')) {
                throw new Error('Transaction failed: Nonce error. Please try again.')
            }

            // Generic error
            throw new Error(`Transaction submission failed: ${error.message}`)
        }
    }

    /**
     * Override checkEntitlement to add additional error handling for missing wallet address
     */
    async checkEntitlement(pClient?: PublicClient): Promise<bigint> {
        const userAddress = this.walletClient.account?.address
        if (!userAddress) {
            throw new Error("No wallet address found for entitlement check")
        }
        return super.checkEntitlement(pClient)
    }

    /**
     * Override getWalletClaimStatus to add additional error handling for missing wallet address
     */
    async getWalletClaimStatus(): Promise<WalletClaimStatus> {
        const userAddress = this.walletClient.account?.address
        if (!userAddress) {
            throw new Error("No wallet address found for status check")
        }
        return super.getWalletClaimStatus()
    }

    /**
     * Override claim to add additional error handling for missing wallet address
     */
    async claim(): Promise<TransactionReceipt | any> {
        const userAddress = this.walletClient.account?.address
        if (!userAddress) {
            throw new Error("No wallet address found for claim")
        }
        return super.claim()
    }

    // Override these methods to add wallet address validation while maintaining visibility
    async triggerFaucet(): Promise<void> {
        const userAddress = this.walletClient.account?.address
        if (!userAddress) {
            throw new Error("No wallet address found for faucet request")
        }
        return super.triggerFaucet()
    }

    async canClaim(): Promise<boolean> {
        const userAddress = this.walletClient.account?.address
        if (!userAddress) {
            throw new Error("No wallet address found for balance check")
        }
        return super.canClaim()
    }

    async getFaucetParameters(): Promise<{
        minTopping: number
        toppingAmount: bigint
    }> {
        return super.getFaucetParameters()
    }

    async checkBalanceWithRetry(): Promise<boolean> {
        return super.checkBalanceWithRetry()
    }
}