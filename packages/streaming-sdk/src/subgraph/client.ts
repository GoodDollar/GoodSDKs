import { GraphQLClient, gql } from "graphql-request"
import { Address } from "viem"
import { SUBGRAPH_URLS, SupportedChains } from "../constants"
import {
  StreamQueryResult,
  SuperTokenBalance,
  GDAPool,
  PoolMembership,
  SUPReserveLocker,
  GetStreamsOptions,
  GetBalanceHistoryOptions,
} from "../types"

/**
 * GraphQL query definitions
 */
const GET_STREAMS = gql`
  query GetStreams($account: String!, $skip: Int = 0, $first: Int = 100) {
    outgoingStreams: streams(
      where: { sender: $account, currentFlowRate_gt: "0" }
      first: $first
      skip: $skip
      orderBy: createdAtTimestamp
      orderDirection: desc
    ) {
      id
      sender { id }
      receiver { id }
      token { id, symbol }
      currentFlowRate
      streamedUntilUpdatedAt
      updatedAtTimestamp
      createdAtTimestamp
    }
    incomingStreams: streams(
      where: { receiver: $account, currentFlowRate_gt: "0" }
      first: $first
      skip: $skip
      orderBy: createdAtTimestamp
      orderDirection: desc
    ) {
      id
      sender { id }
      receiver { id }
      token { id, symbol }
      currentFlowRate
      streamedUntilUpdatedAt
      updatedAtTimestamp
      createdAtTimestamp
    }
  }
`

const GET_TOKEN_BALANCE = gql`
  query GetTokenBalance($account: String!) {
    account(id: $account) {
      id
      accountTokenSnapshots {
        token { id, name, symbol }
        balanceUntilUpdatedAt
        updatedAtTimestamp
        totalNetFlowRate
      }
    }
  }
`

const GET_BALANCE_HISTORY = gql`
  query GetBalanceHistory(
    $account: String!, 
    $fromTimestamp: Int, 
    $toTimestamp: Int,
    $first: Int = 100,
    $skip: Int = 0
  ) {
    accountTokenSnapshotLogs(
      where: {
        account: $account
        timestamp_gte: $fromTimestamp
        timestamp_lte: $toTimestamp
      }
      first: $first
      skip: $skip
      orderBy: timestamp
      orderDirection: asc
    ) {
      id
      timestamp
      token { id, symbol }
      balance
      totalNetFlowRate
    }
  }
`

const GET_POOL_MEMBERSHIPS = gql`
  query GetPoolMemberships($account: String!) {
    account(id: $account) {
      poolMemberships {
        pool {
          id
          token { id, symbol }
          totalUnits
          totalAmountDistributedUntilUpdatedAt
          flowRate
          admin { id }
        }
        units
        isConnected
        totalAmountClaimed
      }
    }
  }
`

const GET_MEMBER_POOLS = gql`
  query GetMemberPools($account: String!, $first: Int = 100, $skip: Int = 0) {
    pools(
      where: { poolMembers_: { account: $account } }
      first: $first
      skip: $skip
      orderBy: createdAtTimestamp
      orderDirection: desc
    ) {
      id
      token { id, symbol }
      totalUnits
      totalAmountDistributedUntilUpdatedAt
      flowRate
      admin { id }
      createdAtTimestamp
      poolMembers(where: { account: $account }) {
        isConnected
        units
        totalAmountClaimed
      }
    }
  }
`

const GET_SUP_RESERVES = gql`
  query GetSUPReserves($account: String!, $first: Int = 10, $skip: Int = 0) {
    lockers(
      where: { lockerOwner: $account }
      first: $first
      skip: $skip
      orderBy: blockTimestamp
      orderDirection: desc
    ) {
      id
      lockerOwner { id }
      blockNumber
      blockTimestamp
    }
  }
`

/**
 * Subgraph data structures
 */
interface SubgraphAccount { id: string }
interface SubgraphToken { id: string; symbol: string; name?: string }
interface SubgraphStream {
  id: string
  sender: SubgraphAccount
  receiver: SubgraphAccount
  token: SubgraphToken
  currentFlowRate: string
  streamedUntilUpdatedAt: string
  updatedAtTimestamp: string
  createdAtTimestamp: string
}
interface SubgraphSnapshot { token: SubgraphToken; balanceUntilUpdatedAt: string; updatedAtTimestamp: string }
interface SubgraphSnapshotLog { token: SubgraphToken; balance: string; timestamp: string }
interface SubgraphPool {
  id: string
  token: SubgraphToken
  totalUnits: string
  totalAmountDistributedUntilUpdatedAt: string
  flowRate: string
  admin: SubgraphAccount
  poolMembers?: { isConnected: boolean; units: string; totalAmountClaimed: string }[]
}
interface SubgraphPoolMembership { pool: SubgraphPool; units: string; isConnected: boolean; totalAmountClaimed: string }
interface SubgraphLocker { id: string; lockerOwner: SubgraphAccount; blockNumber: string; blockTimestamp: string }

export class SubgraphClient {
  private client: GraphQLClient
  private chainId: SupportedChains
  private apiKey?: string

  constructor(chainId: SupportedChains, options: { apiKey?: string } = {}) {
    this.chainId = chainId
    this.apiKey = options.apiKey
    const endpoint = SUBGRAPH_URLS[chainId]
    if (!endpoint) {
      throw new Error(`No subgraph endpoint configured for chain ${chainId}`)
    }

    const headers: Record<string, string> = {}
    if (options.apiKey) {
      headers["Authorization"] = `Bearer ${options.apiKey}`
    }

    this.client = new GraphQLClient(endpoint, {
      headers,
    })
  }

  async queryStreams(options: GetStreamsOptions): Promise<StreamQueryResult[]> {
    const { account, direction = "all", first: requestedFirst, skip: requestedSkip } = options

    // Internal helper for paginated request
    const fetchBatch = async (first: number, skip: number) => {
      if (!account) return { outgoingStreams: [], incomingStreams: [] }
      return this.client.request<{
        outgoingStreams: SubgraphStream[]
        incomingStreams: SubgraphStream[]
      }>(GET_STREAMS, { account: account.toLowerCase(), first, skip })
    }

    let allOutgoing: SubgraphStream[] = []
    let allIncoming: SubgraphStream[] = []

    if (requestedFirst !== undefined && requestedSkip !== undefined) {
      // User requested explicit pagination, just fetch once
      const data = await fetchBatch(requestedFirst, requestedSkip)
      allOutgoing = data.outgoingStreams
      allIncoming = data.incomingStreams
    } else {
      // Loop to fetch all records in batches of 100
      let skip = requestedSkip ?? 0
      const batchSize = 100
      let hasMore = true

      while (hasMore) {
        const data = await fetchBatch(batchSize, skip)
        allOutgoing = [...allOutgoing, ...data.outgoingStreams]
        allIncoming = [...allIncoming, ...data.incomingStreams]

        // Keep looping if either list was full
        hasMore = (data.outgoingStreams.length === batchSize || data.incomingStreams.length === batchSize)
        skip += batchSize

        // Safety break to prevent infinite loops in case of weird subgraph behavior
        if (skip > 5000) break
      }
    }

    let streams: SubgraphStream[] = []
    if (direction === "outgoing") streams = allOutgoing
    else if (direction === "incoming") streams = allIncoming
    else streams = [...allOutgoing, ...allIncoming]

    return streams.map((s) => ({
      id: s.id,
      sender: s.sender.id as Address,
      receiver: s.receiver.id as Address,
      token: s.token.id as Address,
      currentFlowRate: BigInt(s.currentFlowRate),
      streamedUntilUpdatedAt: BigInt(s.streamedUntilUpdatedAt),
      updatedAtTimestamp: Number(s.updatedAtTimestamp),
      createdAtTimestamp: Number(s.createdAtTimestamp),
    }))
  }

  async queryBalances(account: Address): Promise<SuperTokenBalance[]> {
    if (!account) return []
    const data = await this.client.request<{
      account: { accountTokenSnapshots: SubgraphSnapshot[] } | null
    }>(GET_TOKEN_BALANCE, { account: account.toLowerCase() })

    return data.account?.accountTokenSnapshots.map((s) => ({
      account,
      token: s.token.id as Address,
      balance: BigInt(s.balanceUntilUpdatedAt),
      balanceUntilUpdatedAt: BigInt(s.balanceUntilUpdatedAt),
      updatedAtTimestamp: Number(s.updatedAtTimestamp),
    })) || []
  }

  async queryBalanceHistory(options: GetBalanceHistoryOptions): Promise<SuperTokenBalance[]> {
    const { account, fromTimestamp, toTimestamp, first = 100, skip = 0 } = options
    if (!account) return []
    const data = await this.client.request<{
      accountTokenSnapshotLogs: SubgraphSnapshotLog[]
    }>(GET_BALANCE_HISTORY, {
      account: account.toLowerCase(),
      fromTimestamp: fromTimestamp ? Math.floor(fromTimestamp / 1000) : undefined,
      toTimestamp: toTimestamp ? Math.floor(toTimestamp / 1000) : undefined,
      first,
      skip,
    })

    return data.accountTokenSnapshotLogs.map((log) => ({
      account,
      token: log.token.id as Address,
      balance: BigInt(log.balance),
      balanceUntilUpdatedAt: BigInt(log.balance),
      updatedAtTimestamp: Number(log.timestamp),
    }))
  }

  async queryPoolMemberships(account: Address): Promise<PoolMembership[]> {
    if (!account) return []
    const data = await this.client.request<{
      account: { poolMemberships: SubgraphPoolMembership[] } | null
    }>(GET_POOL_MEMBERSHIPS, { account: account.toLowerCase() })

    return data.account?.poolMemberships.map((m) => ({
      pool: m.pool.id as Address,
      account,
      units: BigInt(m.units),
      isConnected: m.isConnected,
      totalAmountClaimed: BigInt(m.totalAmountClaimed),
    })) || []
  }

  /**
   * Fetch only GDA pools the given account is a member of, with their
   * connected/disconnected status for that account.
   */
  async queryMemberPools(account: Address, options: { first?: number; skip?: number } = {}): Promise<GDAPool[]> {
    if (!account) return []
    const { first = 100, skip = 0 } = options
    const data = await this.client.request<{ pools: SubgraphPool[] }>(
      GET_MEMBER_POOLS,
      { account: account.toLowerCase(), first, skip }
    )
    return data.pools.map((p) => ({
      id: p.id as Address,
      token: p.token.id as Address,
      totalUnits: BigInt(p.totalUnits),
      // Use the per-member claimed amount, not the pool-wide distributed total
      totalAmountClaimed: BigInt(p.poolMembers?.[0]?.totalAmountClaimed ?? "0"),
      flowRate: BigInt(p.flowRate),
      admin: p.admin.id as Address,
      // Surface per-member connection status returned by the filtered query
      isConnected: p.poolMembers?.[0]?.isConnected ?? false,
    }))
  }

  /**
   * Fetch SUP reserve lockers owned by the given account.
   * Requires an apiKey for The Graph Gateway endpoint.
   */
  async querySUPReserves(account: Address, options: { first?: number; skip?: number } = {}): Promise<SUPReserveLocker[]> {
    const { first = 10, skip = 0 } = options
    if (!account) {
      throw new Error("account is required to fetch SUP reserves")
    }
    if (!this.apiKey) {
      throw new Error(
        "Missing apiKey for SUP reserves subgraph (The Graph Gateway). " +
        "Provide `apiKey` when creating SubgraphClient/StreamingSDK/GdaSDK."
      )
    }
    const headers: Record<string, string> = {}
    if (this.apiKey) headers["Authorization"] = `Bearer ${this.apiKey}`
    const supClient = new GraphQLClient(SUBGRAPH_URLS.supReserve, { headers })
    const data = await supClient.request<{ lockers: SubgraphLocker[] }>(
      GET_SUP_RESERVES,
      { account: account.toLowerCase(), first, skip }
    )

    return data.lockers.map((l) => ({
      id: l.id,
      lockerOwner: l.lockerOwner.id as Address,
      blockNumber: BigInt(l.blockNumber),
      blockTimestamp: BigInt(l.blockTimestamp),
    }))
  }
}
