import { gql } from "graphql-request"

export const GET_STREAMS = gql`
  query GetStreams($account: String!, $skip: Int = 0, $first: Int = 100) {
    # Outgoing streams
    outgoingStreams: streams(
      where: { sender: $account, currentFlowRate_gt: "0" }
      first: $first
      skip: $skip
      orderBy: createdAtTimestamp
      orderDirection: desc
    ) {
      id
      sender {
        id
      }
      receiver {
        id
      }
      token {
        id
        symbol
      }
      currentFlowRate
      streamedUntilUpdatedAt
      updatedAtTimestamp
      createdAtTimestamp
    }

    # Incoming streams
    incomingStreams: streams(
      where: { receiver: $account, currentFlowRate_gt: "0" }
      first: $first
      skip: $skip
      orderBy: createdAtTimestamp
      orderDirection: desc
    ) {
      id
      sender {
        id
      }
      receiver {
        id
      }
      token {
        id
        symbol
      }
      currentFlowRate
      streamedUntilUpdatedAt
      updatedAtTimestamp
      createdAtTimestamp
    }
  }
`

export const GET_TOKEN_BALANCE = gql`
  query GetTokenBalance($account: String!) {
    account(id: $account) {
      id
      accountTokenSnapshots {
        token {
          id
          name
          symbol
        }
        balanceUntilUpdatedAt
        updatedAtTimestamp
        totalNetFlowRate
      }
    }
  }
`

export const GET_BALANCE_HISTORY = gql`
  query GetBalanceHistory(
    $account: String!
    $fromTimestamp: Int
    $toTimestamp: Int
  ) {
    accountTokenSnapshotLogs(
      where: {
        account: $account
        timestamp_gte: $fromTimestamp
        timestamp_lte: $toTimestamp
      }
      orderBy: timestamp
      orderDirection: asc
    ) {
      id
      timestamp
      token {
        id
        symbol
      }
      balance
      totalNetFlowRate
    }
  }
`

export const GET_POOL_MEMBERSHIPS = gql`
  query GetPoolMemberships($account: String!) {
    account(id: $account) {
      poolMemberships {
        pool {
          id
          token {
            id
            symbol
          }
          totalUnits
          totalAmountDistributedUntilUpdatedAt
          flowRate
          admin {
            id
          }
        }
        units
        isConnected
        totalAmountClaimed
      }
    }
  }
`

export const GET_DISTRIBUTION_POOLS = gql`
  query GetDistributionPools($first: Int = 100, $skip: Int = 0) {
    pools(
      first: $first
      skip: $skip
      orderBy: createdAtTimestamp
      orderDirection: desc
    ) {
      id
      token {
        id
        symbol
      }
      totalUnits
      totalAmountDistributedUntilUpdatedAt
      flowRate
      admin {
        id
      }
      createdAtTimestamp
    }
  }
`

export const GET_POOL_DETAILS = gql`
  query GetPoolDetails($poolId: String!) {
    pool(id: $poolId) {
      id
      token {
        id
        symbol
      }
      totalUnits
      totalAmountDistributedUntilUpdatedAt
      flowRate
      admin {
        id
      }
      createdAtTimestamp
      poolMembers {
        account {
          id
        }
        units
        isConnected
        totalAmountClaimed
      }
    }
  }
`

export const GET_SUP_RESERVES = gql`
  query GetSUPReserves {
    lockers(orderBy: blockTimestamp, orderDirection: desc) {
      id
      lockerOwner {
        id
      }
      blockNumber
      blockTimestamp
    }
  }
`
