import {
  PublicClient,
  WalletClient,
  parseAbi,
  formatEther,
  encodeAbiParameters,
  encodeFunctionData,
  type SimulateContractParameters,
} from "viem"

import {
  SAVINGS_CHAIN_CONFIG,
  SavingsChainConfig,
  SavingsContracts,
  SupportedChainId,
  UnsupportedChainError,
  isSupportedChainId,
} from "./constants"

// Classic staking contract: rewards accrue inside the contract and the user
// claims them with `getReward()` (XDC).
const CLASSIC_STAKING_ABI = parseAbi([
  "function balanceOf(address account) view returns (uint256)",
  "function earned(address account) view returns (uint256)",
  "function totalSupply() view returns (uint256)",
  "function periodFinish() view returns (uint256)",
  "function getEffectiveRewardRate() view returns (uint256)",
  "function stake(uint256 amount)",
  "function withdraw(uint256 amount)",
  "function getReward()",
])

// Streaming staking contract: rewards are streamed via a Superfluid GDA pool
// (Celo). There is no `getReward`; the pool delivers tokens directly to the
// staker's wallet.
const STREAMING_STAKING_ABI = parseAbi([
  "function balanceOf(address account) view returns (uint256)",
  "function totalSupply() view returns (uint256)",
  "function getEffectiveFlowRate() view returns (int96)",
  "function pool() view returns (address)",
  "function superToken() view returns (address)",
  "function stake(uint256 amount)",
  "function withdraw(uint256 amount)",
])

const POOL_ABI = parseAbi([
  "function getMemberFlowRate(address account) view returns (int96)",
  "function getTotalAmountReceivedByMember(address account) view returns (uint256)",
])

const GDA_FORWARDER_ABI = parseAbi([
  "function connectPool(address pool, bytes userData) returns (bool)",
  "function isMemberConnected(address pool, address member) view returns (bool)",
])

const SUPERFLUID_HOST_ABI = parseAbi([
  "struct Operation { uint32 operationType; address target; bytes data; }",
  "function batchCall(Operation[] operations)",
])

const G$__ABI = parseAbi([
  "function balanceOf(address account) view returns (uint256)",
  "function approve(address spender, uint256 amount) returns (bool)",
  "function allowance(address owner, address spender) view returns (uint256)",
])

// Superfluid host batch operation types.
const OP_TYPE_ERC20_APPROVE = 1
const OP_TYPE_SUPERFLUID_CALL_AGREEMENT = 201
const OP_TYPE_ERC2771_FORWARD_CALL = 302

const MAX_UINT256 = (1n << 256n) - 1n
const SECONDS_PER_YEAR = BigInt(365 * 24 * 60 * 60)
const SECONDS_PER_DAY = BigInt(24 * 60 * 60)

export interface GlobalStats {
  totalStaked: bigint // in GDollars wei
  annualAPR: number // in percentage
  isStreaming: boolean // whether this chain uses Superfluid streaming rewards
}

export interface UserStats {
  walletBalance: bigint // in GDollars wei
  currentStake: bigint // in GDollars wei
  userDailyRewards: bigint // in GDollars wei
  unclaimedRewards?: bigint // in GDollars wei (only for non-streaming contracts)
  flowRate?: bigint // in GDollars wei per second (only for streaming contracts)
  streamedRewards?: bigint // in GDollars wei (only for streaming contracts)
}

export class GooddollarSavingsSDK {
  private publicClient: PublicClient
  private walletClient: WalletClient | null = null
  private totalStaked: bigint = BigInt(0)
  private cachedRewardRate: bigint = BigInt(0)
  private cachedPoolAddress: `0x${string}` | null = null
  private readonly _chainId: SupportedChainId
  private readonly chainConfig: SavingsChainConfig
  private readonly contracts: SavingsContracts

  constructor(
    publicClient: PublicClient,
    walletClient?: WalletClient,
  ) {
    if (!publicClient) throw new Error("Public client is required")

    const publicChainId = publicClient.chain?.id
    if (!isSupportedChainId(publicChainId)) {
      throw new UnsupportedChainError(publicChainId)
    }

    this._chainId = publicChainId
    this.chainConfig = SAVINGS_CHAIN_CONFIG[publicChainId]
    this.contracts = this.chainConfig.contracts 

    this.publicClient = publicClient
    this.walletClient = null
    if (walletClient) {
      this.setWalletClient(walletClient)
    }
  }

  get chainId(): SupportedChainId {
    return this._chainId
  }

  get chainName(): string {
    return this.chainConfig.label
  }

  /** Resolved contract addresses for the active chain. */
  getContracts(): SavingsContracts {
    return this.contracts
  }

  /**
   * Whether the active chain uses Superfluid streaming rewards. Consumers
   * should hide the "claim" UI on streaming chains since rewards are
   * delivered continuously to the wallet.
   */
  isStreaming(): boolean {
    return this.chainConfig.isStreaming
  }

  setWalletClient(walletClient: WalletClient) {
    const walletChainId = walletClient.chain?.id
    if (!isSupportedChainId(walletChainId)) {
      throw new UnsupportedChainError(walletChainId)
    }
    if (walletChainId !== this._chainId) {
      throw new Error(
        `Wallet client chain ${walletChainId} does not match public client chain ${this._chainId}.`,
      )
    }
    this.walletClient = walletClient
  }

  async getGlobalStats(): Promise<GlobalStats> {
    return this.chainConfig.isStreaming
      ? this.getStreamingGlobalStats()
      : this.getClassicGlobalStats()
  }

  async getUserStats(): Promise<UserStats> {
    return this.chainConfig.isStreaming
      ? this.getStreamingUserStats()
      : this.getClassicUserStats()
  }

  async stake(amount: bigint, onHash?: (hash: `0x${string}`) => void) {
    if (amount <= BigInt(0)) throw new Error("Amount must be greater than zero")

    const account = await this.getAccount()
    const balance = await this.publicClient.readContract({
      ...this.gdollarContract(),
      functionName: "balanceOf",
      args: [account],
    })

    if (balance < amount) {
      throw new Error("Insufficient G$ balance for staking")
    }

    return this.chainConfig.isStreaming
      ? this.stakeStreaming(amount, onHash)
      : this.stakeClassic(amount, onHash)
  }

  async unstake(amount: bigint, onHash?: (hash: `0x${string}`) => void) {
    if (amount <= BigInt(0)) throw new Error("Amount must be greater than zero")

    return this.submitAndWait(
      {
        ...this.stakingContract(),
        functionName: "withdraw",
        args: [amount],
      },
      onHash,
    )
  }

  async claimReward(onHash?: (hash: `0x${string}`) => void) {
    if (this.chainConfig.isStreaming) {
      throw new Error(
        `Chain ${this.chainConfig.label} distributes rewards via Superfluid streaming; there is nothing to claim.`,
      )
    }

    return this.submitAndWait(
      {
        ...this.stakingContract(),
        functionName: "getReward",
        args: [],
      },
      onHash,
    )
  }

  private async getClassicGlobalStats(): Promise<GlobalStats> {
    const stakingContract = this.stakingContract()
    const [totalSupply, periodFinish, effectiveRewardRate] = await Promise.all([
      this.publicClient.readContract({
        ...stakingContract,
        functionName: "totalSupply",
      }),
      this.publicClient.readContract({
        ...stakingContract,
        functionName: "periodFinish",
      }),
      this.publicClient.readContract({
        ...stakingContract,
        functionName: "getEffectiveRewardRate",
      }),
    ])

    const currentTime = Math.floor(Date.now() / 1000)
    const isFinished = periodFinish > 0 && periodFinish < currentTime
    this.totalStaked = totalSupply
    this.cachedRewardRate = isFinished ? BigInt(0) : effectiveRewardRate

    return {
      totalStaked: totalSupply,
      annualAPR: this.computeAnnualAPR(this.cachedRewardRate, totalSupply),
      isStreaming: false,
    }
  }

  private async getStreamingGlobalStats(): Promise<GlobalStats> {
    const stakingContract = this.stakingContract()
    const [totalSupply, flowRateRaw] = await Promise.all([
      this.publicClient.readContract({
        ...stakingContract,
        functionName: "totalSupply",
      }),
      this.publicClient.readContract({
        ...stakingContract,
        functionName: "getEffectiveFlowRate",
      }),
    ])

    // `getEffectiveFlowRate` returns int96; clamp negatives defensively.
    const flowRate = flowRateRaw > 0n ? flowRateRaw : 0n
    this.totalStaked = totalSupply
    this.cachedRewardRate = flowRate

    return {
      totalStaked: totalSupply,
      annualAPR: this.computeAnnualAPR(flowRate, totalSupply),
      isStreaming: true,
    }
  }

  private async getClassicUserStats(): Promise<UserStats> {
    const account = await this.getAccount()
    const stakingContract = this.stakingContract()
    const gdollarContract = this.gdollarContract()

    const [balance, staked, earned] = await Promise.all([
      this.publicClient.readContract({
        ...gdollarContract,
        functionName: "balanceOf",
        args: [account],
      }),
      this.publicClient.readContract({
        ...stakingContract,
        functionName: "balanceOf",
        args: [account],
      }),
      this.publicClient.readContract({
        ...stakingContract,
        functionName: "earned",
        args: [account],
      }),
    ])

    if (staked > BigInt(0) && this.totalStaked === BigInt(0)) {
      await this.getGlobalStats()
    }

    let userDailyRewards = BigInt(0)
    if (staked > BigInt(0) && this.totalStaked > BigInt(0)) {
      userDailyRewards =
        (this.cachedRewardRate * SECONDS_PER_DAY * staked) / this.totalStaked
    }

    return {
      walletBalance: balance,
      currentStake: staked,
      unclaimedRewards: earned,
      userDailyRewards,
    }
  }

  private async getStreamingUserStats(): Promise<UserStats> {
    const account = await this.getAccount()
    const stakingContract = this.stakingContract()
    const gdollarContract = this.gdollarContract()
    const pool = await this.getPoolAddress()

    const [balance, staked, flowRateRaw, totalReceived] = await Promise.all([
      this.publicClient.readContract({
        ...gdollarContract,
        functionName: "balanceOf",
        args: [account],
      }),
      this.publicClient.readContract({
        ...stakingContract,
        functionName: "balanceOf",
        args: [account],
      }),
      this.publicClient.readContract({
        address: pool,
        abi: POOL_ABI,
        functionName: "getMemberFlowRate",
        args: [account],
      }),
      this.publicClient.readContract({
        address: pool,
        abi: POOL_ABI,
        functionName: "getTotalAmountReceivedByMember",
        args: [account],
      }),
    ])

    const flowRate = flowRateRaw > 0n ? flowRateRaw : 0n
    const userDailyRewards = flowRate * SECONDS_PER_DAY

    return {
      walletBalance: balance,
      currentStake: staked,
      userDailyRewards,
      flowRate,
      streamedRewards: totalReceived,
    }
  }

  private async stakeClassic(
    amount: bigint,
    onHash?: (hash: `0x${string}`) => void,
  ) {
    await this.ensureAllowance(amount, onHash)

    return this.submitAndWait(
      {
        ...this.stakingContract(),
        functionName: "stake",
        args: [amount],
      },
      onHash,
    )
  }

  private async stakeStreaming(
    amount: bigint,
    onHash?: (hash: `0x${string}`) => void,
  ) {
    const account = await this.getAccount()
    const host = this.contracts.superfluidHost!
    const gdaForwarder = this.contracts.gdaForwarder!
    const pool = await this.getPoolAddress()

    const [allowance, isConnected] = await Promise.all([
      this.publicClient.readContract({
        ...this.gdollarContract(),
        functionName: "allowance",
        args: [account, this.contracts.staking],
      }),
      this.publicClient.readContract({
        address: gdaForwarder,
        abi: GDA_FORWARDER_ABI,
        functionName: "isMemberConnected",
        args: [pool, account],
      }),
    ])

    const operations: Array<{
      operationType: number
      target: `0x${string}`
      data: `0x${string}`
    }> = []

    if (allowance < amount) {
      operations.push({
        operationType: OP_TYPE_ERC20_APPROVE,
        target: this.contracts.gdollar,
        data: encodeAbiParameters(
          [{ type: "address" }, { type: "uint256" }],
          [this.contracts.staking, MAX_UINT256],
        ),
      })
    }

    if (!isConnected) {
      const connectPoolCall = encodeFunctionData({
        abi: GDA_FORWARDER_ABI,
        functionName: "connectPool",
        args: [pool, "0x"],
      })
      operations.push({
        operationType: OP_TYPE_SUPERFLUID_CALL_AGREEMENT,
        target: gdaForwarder,
        data: encodeAbiParameters(
          [{ type: "bytes" }, { type: "bytes" }],
          [connectPoolCall, "0x"],
        ),
      })
    }

    operations.push({
      operationType: OP_TYPE_ERC2771_FORWARD_CALL,
      target: this.contracts.staking,
      data: encodeFunctionData({
        abi: STREAMING_STAKING_ABI,
        functionName: "stake",
        args: [amount],
      }),
    })

    return this.submitAndWait(
      {
        address: host,
        abi: SUPERFLUID_HOST_ABI,
        functionName: "batchCall",
        args: [operations],
      },
      onHash,
    )
  }

  private async submitAndWait(
    simulateParams: SimulateContractParameters,
    onHash?: (hash: `0x${string}`) => void,
  ) {
    if (!this.walletClient) throw new Error("Wallet client not initialized")
    await this.assertWalletOnActiveChain()

    const account = await this.getAccount()

    const { request } = await this.publicClient.simulateContract({
      account,
      ...simulateParams,
    })

    const hash = await this.walletClient.writeContract(request)
    if (onHash) onHash(hash)

    const receipt = await this.publicClient.waitForTransactionReceipt({
      hash,
      confirmations: 2,
    })

    return receipt
  }

  private async getAccount(): Promise<`0x${string}`> {
    if (!this.walletClient) throw new Error("Wallet client not initialized")
    const [account] = await this.walletClient.getAddresses()
    if (!account) throw new Error("No account found in wallet client")
    return account
  }

  private async ensureAllowance(
    amount: bigint,
    onHash?: (hash: `0x${string}`) => void,
  ) {
    const account = await this.getAccount()
    const gdollarContract = this.gdollarContract()
    const allowance = await this.publicClient.readContract({
      ...gdollarContract,
      functionName: "allowance",
      args: [account, this.contracts.staking],
    })

    if (allowance < amount) {
      const approvalReceipt = await this.submitAndWait(
        {
          ...gdollarContract,
          functionName: "approve",
          args: [this.contracts.staking, amount],
        },
        onHash,
      )

      if (approvalReceipt.status !== "success") {
        throw new Error("Approval transaction failed")
      }

      const updatedAllowance = await this.publicClient.readContract({
        ...gdollarContract,
        functionName: "allowance",
        args: [account, this.contracts.staking],
      })

      if (updatedAllowance < amount) {
        throw new Error(
          "Approval is still insufficient. Please wait for confirmation and try staking again.",
        )
      }
    }
  }

  private async assertWalletOnActiveChain() {
    if (!this.walletClient) return
    const walletChainId = await this.walletClient.getChainId()
    if (walletChainId !== this._chainId) {
      throw new Error(
        `Wrong network. Please switch your wallet to ${this.chainConfig.label}.`,
      )
    }
  }

  private async getPoolAddress(): Promise<`0x${string}`> {
    if (this.cachedPoolAddress) return this.cachedPoolAddress
    const pool = await this.publicClient.readContract({
      ...this.stakingContract(),
      functionName: "pool",
    })
    this.cachedPoolAddress = pool as `0x${string}`
    return this.cachedPoolAddress
  }

  private stakingContract() {
    return {
      address: this.contracts.staking,
      abi: this.chainConfig.isStreaming
        ? STREAMING_STAKING_ABI
        : CLASSIC_STAKING_ABI,
    } as const
  }

  private gdollarContract() {
    return {
      address: this.contracts.gdollar,
      abi: G$__ABI,
    } as const
  }

  private computeAnnualAPR(ratePerSecond: bigint, totalSupply: bigint): number {
    if (ratePerSecond <= 0n || totalSupply <= 0n) return 0
    return (
      (this.toEtherNumber(ratePerSecond * SECONDS_PER_YEAR) * 100) /
      this.toEtherNumber(totalSupply)
    )
  }

  private toEtherNumber(num: bigint) {
    return Number(formatEther(num))
  }
}
