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
    Environment,
} from "./types"
import { validateChain } from "./utils"
import { SupportedChains, CFA_FORWARDER_ADDRESSES, getG$Token } from "./constants"
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

        // Retrieve protocol addresses directly from official maps
        this.cfaForwarder = (CFA_FORWARDER_ADDRESSES as Record<number, Address>)[this.chainId]

        if (!this.cfaForwarder) {
            throw new Error(`CFA Forwarder address not found for chain ID: ${this.chainId}`)
        }

        // resolve default token
        this.defaultToken = getG$Token(this.chainId, this.environment)

        if (walletClient) {
            this.setWalletClient(walletClient)
        }

        this.subgraphClient = new SubgraphClient(this.chainId, {
            apiKey: options?.apiKey,
        })
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
        const { receiver, token, flowRate, onHash } = params

        if (flowRate <= BigInt(0)) {
            throw new Error("Flow rate must be greater than zero")
        }

        // resolve token
        const resolvedToken = token ?? this.defaultToken
        if (!resolvedToken) {
            throw new Error(
                `G$ token not available for chain ${this.chainId} in ${this.environment} environment. ` +
                `Please provide a token address explicitly or use a supported chain/environment.`
            )
        }

        return this.submitAndWait(
            {
                address: this.cfaForwarder,
                abi: cfaForwarderAbi,
                functionName: "setFlowrate",
                args: [resolvedToken, receiver, flowRate],
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
        const resolvedToken = token ?? this.defaultToken
        if (!resolvedToken) {
            throw new Error(
                `G$ token not available for chain ${this.chainId} in ${this.environment} environment. ` +
                `Please provide a token address explicitly or use a supported chain/environment.`
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
        const { receiver, token, onHash } = params

        // Use provided token or default to auto-resolved G$ token
        const resolvedToken = token ?? this.defaultToken
        if (!resolvedToken) {
            throw new Error(
                `G$ token not available for chain ${this.chainId} in ${this.environment} environment. ` +
                `Please provide a token address explicitly or use a supported chain/environment.`
            )
        }

        const account = await this.getAccount()

        return this.submitAndWait(
            {
                address: this.cfaForwarder,
                abi: cfaForwarderAbi,
                functionName: "deleteFlow",
                args: [resolvedToken, account, receiver, "0x"],
            },
            onHash,
        )
    }

    async getActiveStreams(
        account: Address,
        direction?: "incoming" | "outgoing" | "all",
    ): Promise<StreamInfo[]> {
        const streams = await this.subgraphClient.queryStreams({
            account,
            direction: direction ?? "all",
        })

        return streams.map((stream) => ({
            sender: stream.sender,
            receiver: stream.receiver,
            token: stream.token,
            flowRate: stream.currentFlowRate,
            timestamp: BigInt(stream.createdAtTimestamp),
            streamedSoFar: stream.streamedUntilUpdatedAt,
        }))
    }

    async getSuperTokenBalance(account: Address): Promise<bigint> {
        const token = getG$Token(this.chainId, this.environment)

        if (!token) return BigInt(0)

        const balances = await this.subgraphClient.queryBalances(account)
        const tokenBalance = balances.find(
            (b) => b.token.toLowerCase() === token.toLowerCase(),
        )

        return tokenBalance?.balance ?? BigInt(0)
    }

    /**
     * Retrieve balance history for an account
     */
    async getBalanceHistory(
        account: Address,
        fromTimestamp?: number,
        toTimestamp?: number,
    ) {
        return this.subgraphClient.queryBalanceHistory({
            account,
            fromTimestamp,
            toTimestamp,
        })
    }

    async querySUPReserves() {
        return this.subgraphClient.querySUPReserves()
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
