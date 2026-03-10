import {
    Address,
    PublicClient,
    WalletClient,
    SimulateContractParameters,
    WalletActions,
    LocalAccount,
} from "viem"
import { waitForTransactionReceipt } from "viem/actions"
import { compressToEncodedURIComponent } from "lz-string"

import { IdentitySDK } from "./viem-identity-sdk" // Import the base IdentitySDK
import { Envs, FV_IDENTIFIER_MSG2 } from "../constants"

/**
 * Custodial version of IdentitySDK that handles LocalAccount signing for Celo RPC compatibility
 */
export class IdentityCustodialSDK extends IdentitySDK {
    /**
     * Override submitAndWait to handle account retrieval differently for custodial wallets
     * @param params - Parameters for simulating the contract call.
     * @param onHash - Optional callback to receive the transaction hash.
     * @returns The transaction receipt.
     * @throws If submission fails or no active wallet address is found.
     */
    async submitAndWait(
        params: SimulateContractParameters,
        onHash?: (hash: `0x${string}`) => void,
    ): Promise<any> {
        try {
            const account = this.walletClient.account?.address

            if (!account) throw new Error("No active wallet address found.")

            const { request } = await this.publicClient.simulateContract({
                account,
                ...params,
            })

            const hash = await this.walletClient.writeContract(request)
            onHash?.(hash)

            return waitForTransactionReceipt(this.publicClient as any, { hash })
        } catch (error: any) {
            console.error("submitAndWait Error:", error)
            throw new Error(`Failed to submit transaction: ${error.message}`)
        }
    }

    /**
     * Override generateFVLink to handle LocalAccount message signing for Celo RPC compatibility
     * @param popupMode - Whether to generate a popup link.
     * @param callbackUrl - The URL to callback after verification.
     * @param chainId - The blockchain network ID.
     * @returns The generated Face Verification link.
     */
    async generateFVLink(
        popupMode: boolean = false,
        callbackUrl?: string,
        chainId?: number,
    ): Promise<string> {
        try {
            const account = this.walletClient.account
            if (!account?.address) throw new Error("No wallet address found.")

            const nonce = Math.floor(Date.now() / 1000).toString()
            const fvSigMessage = FV_IDENTIFIER_MSG2.replace("<account>", account.address)

            // For self-provisioned wallets, sign locally to avoid Celo RPC limitations
            let fvSig: string;

            if ('signMessage' in account) {
                // Local account - sign directly
                fvSig = await (account as LocalAccount).signMessage({
                    message: fvSigMessage,
                })
            } else {
                // Fallback to wallet client signing (might fail on Celo RPC)
                try {
                    fvSig = await this.walletClient.signMessage({
                        account: account.address,
                        message: fvSigMessage,
                    })
                } catch (rpcError: any) {
                    throw new Error(`Message signing failed: Celo RPC doesn't support personal_sign. Use a local account instead. ${rpcError.message}`)
                }
            }

            const { identityUrl } = Envs[this.env]
            if (!identityUrl) {
                throw new Error("identityUrl is not defined in environment settings.")
            }

            if (!fvSig) {
                throw new Error("Missing signature for Face Verification.")
            }

            if (!popupMode && !callbackUrl) {
                throw new Error("Callback URL is required for redirect mode.")
            }

            const url = new URL(identityUrl)
            const params: Record<string, string | number> = {
                account: account.address,
                nonce,
                fvsig: fvSig,
                chain: chainId || (await this.publicClient.getChainId()),
            }

            if (callbackUrl) {
                params[popupMode ? "cbu" : "rdu"] = callbackUrl
            }

            url.searchParams.append(
                "lz",
                compressToEncodedURIComponent(JSON.stringify(params)),
            )
            return url.toString()
        } catch (error: any) {
            console.error("generateFVLink Error:", error)
            throw new Error(
                `Failed to generate Face Verification link: ${error.message}`,
            )
        }
    }
}