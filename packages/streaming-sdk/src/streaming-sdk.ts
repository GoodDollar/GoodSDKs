import {
    Address,
    Hash,
    PublicClient,
    WalletClient,
    type SimulateContractParameters,
} from "viem"
import { cfaForwarderAbi } from "@sfpro/sdk/abi"
import {
    StreamingSDKOptions,
    CreateStreamParams,
    UpdateStreamParams,
    DeleteStreamParams,
    StreamInfo,
    GetStreamsOptions,
    GetBalanceHistoryOptions,
    Environment,
    TokenSymbol,
} from "./types"
import { validateChain } from "./utils"
import { SupportedChains, CFA_FORWARDER_ADDRESSES, getG$Token, getSUPToken } from "./constants"
import { SubgraphClient } from "./subgraph/client"

export class StreamingSDK {
    private publicClient: PublicClient
    private walletClient: WalletClient | null = null
    private chainId: SupportedChains
    private environment: Environment
    private subgraphClient: SubgraphClient
    private cfaForwarder: Address
    private defaultToken: Address | undefined

    constructor(
        publicClient: PublicClient,
        walletClient?: WalletClient,
        options?: StreamingSDKOptions,
    ) {
        if (!publicClient) {
            throw new Error("Public client is required")
        }

        this.publicClient = publicClient
        this.chainId = validateChain(
            options?.chainId ?? publicClient.chain?.id,
        )
        this.environment = options?.environment ?? "production"

        // Protocol addresses from sfpro maps
        this.cfaForwarder = (CFA_FORWARDER_ADDRESSES as Record<number, Address>)[this.chainId]

        if (!this.cfaForwarder || this.cfaForwarder === "0x0000000000000000000000000000000000000000") {
            throw new Error(`CFA Forwarder address not found or invalid for chain ID: ${this.chainId}`)
        }

        this.defaultToken = this.resolveTokenSymbol(options?.defaultToken)

        if (walletClient) {
            this.setWalletClient(walletClient)
        }

        this.subgraphClient = new SubgraphClient(this.chainId, {
            apiKey: options?.apiKey,
        })
    }

    // Resolves symbol or address to concrete token address
    private resolveTokenSymbol(token?: TokenSymbol | Address): Address | undefined {
        if (!token) {
            return this.chainId === SupportedChains.BASE
                ? getSUPToken(this.chainId, this.environment)
                : getG$Token(this.chainId, this.environment)
        }
        if (token === "G$") return getG$Token(this.chainId, this.environment)
        if (token === "SUP") return getSUPToken(this.chainId, this.environment)
        return token as Address
    }

    setWalletClient(walletClient: WalletClient) {
        const chainId = validateChain(walletClient.chain?.id)
        if (chainId !== this.chainId) {
            throw new Error(
                `Wallet client chain (${chainId}) does not match SDK chain (${this.chainId})`,
            )
        }
        this.walletClient = walletClient
    }

    async createStream(params: CreateStreamParams): Promise<Hash> {
        const { receiver, token, flowRate, userData = "0x", onHash } = params

        if (!receiver) throw new Error("Receiver address is required")
        if (flowRate <= BigInt(0)) {
            throw new Error("Flow rate must be greater than zero")
        }

        // resolve token
        const resolvedToken = this.resolveTokenSymbol(token ?? this.defaultToken)
        if (!resolvedToken) {
            throw new Error(
                `Token address not available for chain ${this.chainId} in ${this.environment} environment. ` +
                `Please provide an address explicitly or set a defaultToken symbol.`
            )
        }

        const account = await this.getAccount()

        return this.submitAndWait(
            {
                address: this.cfaForwarder,
                abi: cfaForwarderAbi,
                functionName: "createFlow",
                args: [resolvedToken, account, receiver, flowRate, userData],
            },
            onHash,
        )
    }

    async updateStream(params: UpdateStreamParams): Promise<Hash> {
        const { receiver, token, newFlowRate, userData = "0x", onHash } = params

        if (newFlowRate <= BigInt(0)) {
            throw new Error("newFlowRate must be a positive non-zero value")
        }

        // resolve token
        const resolvedToken = this.resolveTokenSymbol(token ?? this.defaultToken)
        if (!resolvedToken) {
            throw new Error(
                `Token address not available for chain ${this.chainId} in ${this.environment} environment. ` +
                `Please provide an address explicitly or set a defaultToken symbol.`
            )
        }

        const account = await this.getAccount()

        return this.submitAndWait(
            {
                address: this.cfaForwarder,
                abi: cfaForwarderAbi,
                functionName: "updateFlow",
                args: [resolvedToken, account, receiver, newFlowRate, userData],
            },
            onHash,
        )
    }

    async deleteStream(params: DeleteStreamParams): Promise<Hash> {
        const { receiver, token, userData = "0x", onHash } = params

        // resolve token
        const resolvedToken = this.resolveTokenSymbol(token ?? this.defaultToken)
        if (!resolvedToken) {
            throw new Error(
                `Token address not available for chain ${this.chainId} in ${this.environment} environment. ` +
                `Please provide an address explicitly or set a defaultToken symbol.`
            )
        }

        const account = await this.getAccount()

        return this.submitAndWait(
            {
                address: this.cfaForwarder,
                abi: cfaForwarderAbi,
                functionName: "deleteFlow",
                args: [resolvedToken, account, receiver, userData],
            },
            onHash,
        )
    }

    async getActiveStreams(
        options: GetStreamsOptions,
    ): Promise<StreamInfo[]> {
        const streams = await this.subgraphClient.queryStreams(options)

        return streams.map((stream) => ({
            sender: stream.sender,
            receiver: stream.receiver,
            token: stream.token,
            flowRate: stream.currentFlowRate,
            timestamp: BigInt(stream.createdAtTimestamp),
            streamedSoFar: stream.streamedUntilUpdatedAt,
        }))
    }

    /**
     * Get the balance of a SuperToken for an account.
     * If no token is provided, uses the SDK's defaultToken.
     */
    async getSuperTokenBalance(account: Address, token?: TokenSymbol | Address): Promise<bigint> {
        const resolvedToken = this.resolveTokenSymbol(token ?? this.defaultToken)

        if (!resolvedToken) return BigInt(0)

        const balances = await this.subgraphClient.queryBalances(account)
        const tokenBalance = balances.find(
            (b) => b.token.toLowerCase() === resolvedToken.toLowerCase(),
        )

        return tokenBalance?.balance ?? BigInt(0)
    }

    /**
     * Retrieve balance history for an account
     */
    async getBalanceHistory(
        options: GetBalanceHistoryOptions,
    ) {
        return this.subgraphClient.queryBalanceHistory(options)
    }

    getSubgraphClient(): SubgraphClient {
        return this.subgraphClient
    }

    /**
     * Submit transaction and wait for transaction receipt
     */
    private async submitAndWait(
        simulateParams: SimulateContractParameters,
        onHash?: (hash: Hash) => void,
    ): Promise<Hash> {
        if (!this.walletClient) {
            throw new Error("Wallet client not initialized")
        }

        const account = await this.getAccount()

        const { request } = await this.publicClient.simulateContract({
            account,
            ...simulateParams,
        })

        const hash = await this.walletClient.writeContract(request)

        if (onHash) {
            onHash(hash)
        }

        await this.publicClient.waitForTransactionReceipt({ hash })

        return hash
    }

    /**
     * Resolve current account address from wallet client
     */
    private async getAccount(): Promise<Address> {
        if (!this.walletClient) {
            throw new Error("Wallet client not initialized")
        }

        const [account] = await this.walletClient.getAddresses()

        if (!account) {
            throw new Error("No account found in wallet client")
        }

        return account
    }
}
