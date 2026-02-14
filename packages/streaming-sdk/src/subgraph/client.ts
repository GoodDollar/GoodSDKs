import { GraphQLClient } from "graphql-request"
import { Address } from "viem"
import { SUBGRAPH_URLS, SupportedChains } from "../constants"
import {
    GET_STREAMS,
    GET_TOKEN_BALANCE,
    GET_BALANCE_HISTORY,
    GET_POOL_MEMBERSHIPS,
    GET_DISTRIBUTION_POOLS,
    GET_POOL_DETAILS,
    GET_SUP_RESERVES,
} from "./queries"
import {
    StreamQueryResult,
    SuperTokenBalance,
    GDAPool,
    PoolMembership,
    SUPReserveLocker,
    GetStreamsOptions,
    GetBalanceHistoryOptions,
} from "../types"

export class SubgraphClient {
    private client: GraphQLClient
    private chainId: SupportedChains

    constructor(chainId: SupportedChains) {
        this.chainId = chainId
        const endpoint = SUBGRAPH_URLS[chainId]

        if (!endpoint) {
            throw new Error(`No subgraph endpoint configured for chain ${chainId}`)
        }

        this.client = new GraphQLClient(endpoint)
    }

    async queryStreams(
        options: GetStreamsOptions,
    ): Promise<StreamQueryResult[]> {
        try {
            const { account, direction = "all" } = options

            const data = await this.client.request<{
                outgoingStreams: any[]
                incomingStreams: any[]
            }>(GET_STREAMS, {
                account: account.toLowerCase(),
                first: 100,
                skip: 0,
            })

            let streams: any[] = []

            if (direction === "outgoing" || direction === "all") {
                streams = [...streams, ...data.outgoingStreams]
            }

            if (direction === "incoming" || direction === "all") {
                streams = [...streams, ...data.incomingStreams]
            }

            return streams.map((stream) => ({
                id: stream.id,
                sender: stream.sender.id as Address,
                receiver: stream.receiver.id as Address,
                token: stream.token.id as Address,
                currentFlowRate: BigInt(stream.currentFlowRate),
                streamedUntilUpdatedAt: BigInt(stream.streamedUntilUpdatedAt),
                updatedAtTimestamp: Number(stream.updatedAtTimestamp),
                createdAtTimestamp: Number(stream.createdAtTimestamp),
            }))
        } catch (error) {
            console.error("Error querying streams:", error)
            throw new Error(`Failed to query streams: ${error}`)
        }
    }

    async queryBalances(account: Address): Promise<SuperTokenBalance[]> {
        try {
            const data = await this.client.request<{
                account: {
                    accountTokenSnapshots: any[]
                } | null
            }>(GET_TOKEN_BALANCE, {
                account: account.toLowerCase(),
            })

            if (!data.account) {
                return []
            }

            return data.account.accountTokenSnapshots.map((snapshot) => ({
                account,
                token: snapshot.token.id as Address,
                balance: BigInt(snapshot.balanceUntilUpdatedAt),
                balanceUntilUpdatedAt: BigInt(snapshot.balanceUntilUpdatedAt),
                updatedAtTimestamp: Number(snapshot.updatedAtTimestamp),
            }))
        } catch (error) {
            console.error("Error querying balances:", error)
            throw new Error(`Failed to query balances: ${error}`)
        }
    }

    async queryBalanceHistory(
        options: GetBalanceHistoryOptions,
    ): Promise<SuperTokenBalance[]> {
        try {
            const { account, fromTimestamp, toTimestamp } = options

            const data = await this.client.request<{
                accountTokenSnapshotLogs: any[]
            }>(GET_BALANCE_HISTORY, {
                account: account.toLowerCase(),
                fromTimestamp: fromTimestamp
                    ? Math.floor(fromTimestamp / 1000)
                    : undefined,
                toTimestamp: toTimestamp ? Math.floor(toTimestamp / 1000) : undefined,
            })

            return data.accountTokenSnapshotLogs.map((log) => ({
                account,
                token: log.token.id as Address,
                balance: BigInt(log.balance),
                balanceUntilUpdatedAt: BigInt(log.balance),
                updatedAtTimestamp: Number(log.timestamp),
            }))
        } catch (error) {
            console.error("Error querying balance history:", error)
            throw new Error(`Failed to query balance history: ${error}`)
        }
    }

    async queryPoolMemberships(account: Address): Promise<PoolMembership[]> {
        try {
            const data = await this.client.request<{
                account: {
                    poolMemberships: any[]
                } | null
            }>(GET_POOL_MEMBERSHIPS, {
                account: account.toLowerCase(),
            })

            if (!data.account) {
                return []
            }

            return data.account.poolMemberships.map((membership) => ({
                pool: membership.pool.id as Address,
                account,
                units: BigInt(membership.units),
                isConnected: membership.isConnected,
                totalAmountClaimed: BigInt(membership.totalAmountClaimed),
            }))
        } catch (error) {
            console.error("Error querying pool memberships:", error)
            throw new Error(`Failed to query pool memberships: ${error}`)
        }
    }

    async queryPools(): Promise<GDAPool[]> {
        try {
            const data = await this.client.request<{
                pools: any[]
            }>(GET_DISTRIBUTION_POOLS, {
                first: 100,
                skip: 0,
            })

            return data.pools.map((pool) => ({
                id: pool.id as Address,
                token: pool.token.id as Address,
                totalUnits: BigInt(pool.totalUnits),
                totalAmountClaimed: BigInt(pool.totalAmountDistributedUntilUpdatedAt),
                flowRate: BigInt(pool.flowRate),
                admin: pool.admin.id as Address,
            }))
        } catch (error) {
            console.error("Error querying pools:", error)
            throw new Error(`Failed to query pools: ${error}`)
        }
    }

    async querySUPReserves(): Promise<SUPReserveLocker[]> {
        try {
            // Use SUP reserve subgraph
            const supClient = new GraphQLClient(SUBGRAPH_URLS.supReserve)

            const data = await supClient.request<{
                lockers: any[]
            }>(GET_SUP_RESERVES)

            return data.lockers.map((locker) => ({
                id: locker.id,
                lockerOwner: locker.lockerOwner.id as Address,
                blockNumber: BigInt(locker.blockNumber),
                blockTimestamp: BigInt(locker.blockTimestamp),
            }))
        } catch (error) {
            console.error("Error querying SUP reserves:", error)
            throw new Error(`Failed to query SUP reserves: ${error}`)
        }
    }
}
