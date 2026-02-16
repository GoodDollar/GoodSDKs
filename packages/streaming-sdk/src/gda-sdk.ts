import {
    Address,
    Hash,
    PublicClient,
    WalletClient,
    type SimulateContractParameters,
} from "viem"
import { Environment } from "./types"
import { gdaForwarderAbi } from "@sfpro/sdk/abi"
import {
    GDAPool,
    PoolMembership,
    ConnectToPoolParams,
    DisconnectFromPoolParams,
    StreamingSDKOptions,
} from "./types"
import { validateChain } from "./utils"
import { SupportedChains, GDA_FORWARDER_ADDRESSES } from "./constants"
import { SubgraphClient } from "./subgraph/client"

export class GdaSDK {
    private publicClient: PublicClient
    private walletClient: WalletClient | null = null
    private chainId: SupportedChains
    private subgraphClient: SubgraphClient
    private gdaForwarder: Address

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

        // Retrieve protocol address directly from official map
        this.gdaForwarder = (GDA_FORWARDER_ADDRESSES as Record<number, Address>)[this.chainId]

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

    async getDistributionPools(): Promise<GDAPool[]> {
        return this.subgraphClient.queryPools()
    }

    async getPoolMemberships(account: Address): Promise<PoolMembership[]> {
        return this.subgraphClient.queryPoolMemberships(account)
    }

    async getPoolDetails(poolId: Address): Promise<GDAPool | null> {
        const pools = await this.getDistributionPools()
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
