import {
    Address,
    Hash,
    PublicClient,
    WalletClient,
    type SimulateContractParameters,
} from "viem"
import { gdaForwarderAbi } from "@sfpro/sdk/abi"
import {
    GDAPool,
    PoolMembership,
    ConnectToPoolParams,
    DisconnectFromPoolParams,
    TokenSymbol,
    Environment,
    StreamingSDKOptions,
} from "./types"
import { validateChain } from "./utils"
import { SupportedChains, GDA_FORWARDER_ADDRESSES, getG$Token, getSUPToken } from "./constants"
import { SubgraphClient } from "./subgraph/client"

export class GdaSDK {
    private publicClient: PublicClient
    private walletClient: WalletClient | null = null
    private chainId: SupportedChains
    private subgraphClient: SubgraphClient
    private gdaForwarder: Address
    private defaultToken: Address | undefined
    private environment: Environment

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

        // Protocol address from sfpro map
        this.gdaForwarder = (GDA_FORWARDER_ADDRESSES as Record<number, Address>)[this.chainId]

        if (!this.gdaForwarder || this.gdaForwarder === "0x0000000000000000000000000000000000000000") {
            throw new Error(`GDA Forwarder address not found or invalid for chain ID: ${this.chainId}`)
        }

        this.defaultToken = this.resolveTokenSymbol(options?.defaultToken)

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

    async connectToPool(params: ConnectToPoolParams): Promise<Hash> {
        const { poolAddress, userData = "0x", onHash } = params

        return this.submitAndWait(
            {
                address: this.gdaForwarder,
                abi: gdaForwarderAbi,
                functionName: "connectPool",
                args: [poolAddress, userData],
            },
            onHash,
        )
    }

    async disconnectFromPool(params: DisconnectFromPoolParams): Promise<Hash> {
        const { poolAddress, userData = "0x", onHash } = params

        return this.submitAndWait(
            {
                address: this.gdaForwarder,
                abi: gdaForwarderAbi,
                functionName: "disconnectPool",
                args: [poolAddress, userData],
            },
            onHash,
        )
    }

    /**
     * Fetch GDA pools that the given account is a member of.
     * Only returns pools relevant to this wallet, together with the
     * connected/disconnected status for that account.
     */
    async getDistributionPools(account: Address, options: { first?: number; skip?: number } = {}): Promise<GDAPool[]> {
        return this.subgraphClient.queryMemberPools(account, options)
    }

    async getPoolMemberships(account: Address): Promise<PoolMembership[]> {
        return this.subgraphClient.queryPoolMemberships(account)
    }

    /**
     * Look up a specific pool by ID, scoped to the given account's memberships.
     */
    async getPoolDetails(poolId: Address, account: Address): Promise<GDAPool | null> {
        const pools = await this.getDistributionPools(account)
        return pools.find((p) => p.id.toLowerCase() === poolId.toLowerCase()) ?? null
    }

    async querySUPReserves() {
        return this.subgraphClient.querySUPReserves()
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
