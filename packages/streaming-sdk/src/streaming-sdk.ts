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
import { validateChain, getSuperTokenAddress } from "./utils/chains"
import { SupportedChains, CFA_FORWARDER_ADDRESSES } from "./constants"
import { SubgraphClient } from "./subgraph/client"

export class StreamingSDK {
    private publicClient: PublicClient
    private walletClient: WalletClient | null = null
    private chainId: SupportedChains
    private environment: Environment
    private subgraphClient: SubgraphClient

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

        if (walletClient) {
            this.setWalletClient(walletClient)
        }

        this.subgraphClient = new SubgraphClient(this.chainId)
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

        if (flowRate <= BigInt(0)) {
            throw new Error("Flow rate must be greater than zero")
        }

        return this.submitAndWait(
            {
                address: CFA_FORWARDER_ADDRESSES[this.chainId],
                abi: cfaForwarderAbi,
                functionName: "setFlowrate",
                args: [token, receiver, flowRate],
            },
            onHash,
        )
    }

    async updateStream(params: UpdateStreamParams): Promise<Hash> {
        const { receiver, token, newFlowRate, userData = "0x", onHash } = params

        const account = await this.getAccount()

        return this.submitAndWait(
            {
                address: CFA_FORWARDER_ADDRESSES[this.chainId],
                abi: cfaForwarderAbi,
                functionName: "updateFlow",
                args: [token, account, receiver, newFlowRate, userData],
            },
            onHash,
        )
    }

    async deleteStream(params: DeleteStreamParams): Promise<Hash> {
        const { receiver, token, onHash } = params

        const account = await this.getAccount()

        return this.submitAndWait(
            {
                address: CFA_FORWARDER_ADDRESSES[this.chainId],
                abi: cfaForwarderAbi,
                functionName: "deleteFlow",
                args: [token, account, receiver, "0x"],
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
        const token = getSuperTokenAddress(this.chainId, this.environment)

        const balances = await this.subgraphClient.queryBalances(account)
        const tokenBalance = balances.find(
            (b) => b.token.toLowerCase() === token.toLowerCase(),
        )

        return tokenBalance?.balance ?? BigInt(0)
    }

    /**
     * Get balance history for an account
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

    getSubgraphClient(): SubgraphClient {
        return this.subgraphClient
    }

    /**
     * Submit transaction and wait for receipt
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
     * Get current account address from wallet client
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
