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

const SUBGRAPH_BATCH_SIZE = 100
const MAX_SUBGRAPH_RESULTS = 5000

/**
 * GraphQL query definitions
 */
const GET_OUTGOING_STREAMS = gql`
  query GetOutgoingStreams($account: String!, $skip: Int = 0, $first: Int = 100) {
    streams(
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
  }
`

const GET_INCOMING_STREAMS = gql`
  query GetIncomingStreams($account: String!, $skip: Int = 0, $first: Int = 100) {
    streams(
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
type StreamDirection = Exclude<GetStreamsOptions["direction"], "all">

function normalizeTimestampToSubgraphSeconds(timestamp?: number): number | undefined {
  if (timestamp === undefined) return undefined
  return timestamp >= 1_000_000_000_000
    ? Math.floor(timestamp / 1000)
    : Math.floor(timestamp)
}

function mapDistributionPool(pool: SubgraphPool): GDAPool {
  return {
    id: pool.id as Address,
    token: pool.token.id as Address,
    totalUnits: BigInt(pool.totalUnits),
    totalAmountClaimed: BigInt(pool.poolMembers?.[0]?.totalAmountClaimed ?? "0"),
    flowRate: BigInt(pool.flowRate),
    admin: pool.admin.id as Address,
    isConnected: pool.poolMembers?.[0]?.isConnected ?? false,
  }
}

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
    const { account, direction = "all", first, skip = 0 } = options

    if (!account) return []

    const requestedWindow =
      first === undefined ? undefined : Math.min(skip + first, MAX_SUBGRAPH_RESULTS)

    const mapStreams = (streams: SubgraphStream[]) => streams.map((s) => ({
      id: s.id,
      sender: s.sender.id as Address,
      receiver: s.receiver.id as Address,
      token: s.token.id as Address,
      currentFlowRate: BigInt(s.currentFlowRate),
      streamedUntilUpdatedAt: BigInt(s.streamedUntilUpdatedAt),
      updatedAtTimestamp: Number(s.updatedAtTimestamp),
      createdAtTimestamp: Number(s.createdAtTimestamp),
    }))

    if (direction === "incoming" || direction === "outgoing") {
      const streams = await this.collectStreamsByDirection(
        account,
        direction,
        requestedWindow,
      )

      return mapStreams(first === undefined ? streams.slice(skip) : streams.slice(skip, skip + first))
    }

    const [outgoing, incoming] = await Promise.all([
      this.collectStreamsByDirection(account, "outgoing", requestedWindow),
      this.collectStreamsByDirection(account, "incoming", requestedWindow),
    ])

    const merged = [...outgoing, ...incoming].sort(
      (left, right) =>
        Number(right.createdAtTimestamp) - Number(left.createdAtTimestamp),
    )

    const paginated =
      first === undefined ? merged.slice(skip) : merged.slice(skip, skip + first)

    return mapStreams(paginated)
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
      fromTimestamp: normalizeTimestampToSubgraphSeconds(fromTimestamp),
      toTimestamp: normalizeTimestampToSubgraphSeconds(toTimestamp),
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
    return data.pools.map((pool) => mapDistributionPool(pool))
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

  private async fetchStreamsBatch(
    account: Address,
    direction: StreamDirection,
    first: number,
    skip: number,
  ): Promise<SubgraphStream[]> {
    const query = direction === "outgoing" ? GET_OUTGOING_STREAMS : GET_INCOMING_STREAMS
    const data = await this.client.request<{ streams: SubgraphStream[] }>(
      query,
      {
        account: account.toLowerCase(),
        first,
        skip,
      },
    )

    return data.streams
  }

  private async collectStreamsByDirection(
    account: Address,
    direction: StreamDirection,
    limit?: number,
  ): Promise<SubgraphStream[]> {
    const cappedLimit =
      limit === undefined ? MAX_SUBGRAPH_RESULTS : Math.min(limit, MAX_SUBGRAPH_RESULTS)

    const streams: SubgraphStream[] = []
    let batchSkip = 0

    while (batchSkip < MAX_SUBGRAPH_RESULTS) {
      const remaining = cappedLimit - streams.length
      if (remaining <= 0) break

      const batchFirst = Math.min(SUBGRAPH_BATCH_SIZE, remaining)
      const batch = await this.fetchStreamsBatch(account, direction, batchFirst, batchSkip)
      streams.push(...batch)

      if (batch.length < batchFirst) break

      batchSkip += batch.length
    }

    return streams
  }
}
