import {
  PublicClient,
  WalletClient,
  parseAbi,
  formatEther,
  type SimulateContractParameters,
} from "viem"

const STAKING_CONTRACT_ABI = parseAbi([
  "function balanceOf(address account) view returns (uint256)",
  "function earned(address account) view returns (uint256)",
  "function totalSupply() view returns (uint256)",
  "function periodFinish() view returns (uint256)",
  "function getEffectiveRewardRate() view returns (uint256)",
  "function stake(uint256 amount)",
  "function withdraw(uint256 amount)",
  "function getReward()",
])

const G$__ABI = parseAbi([
  "function balanceOf(address account) view returns (uint256)",
  "function transferAndCall(address to, uint256 amount, bytes data) returns (bool)",
  "function approve(address spender, uint256 amount) returns (bool)",
  "function allowance(address owner, address spender) view returns (uint256)",
])

const STAKING_CONTRACT_ADDRESS =
  "0x799a23dA264A157Db6F9c02BE62F82CE8d602A45" as const
const GDOLLAR_CONTRACT_ADDRESS =
  "0x62B8B11039FcfE5aB0C56E502b1C372A3d2a9c7A" as const


const stakingContract = {
  address: STAKING_CONTRACT_ADDRESS,
  abi: STAKING_CONTRACT_ABI,
} as const

const gdollarContract = {
  address: GDOLLAR_CONTRACT_ADDRESS,
  abi: G$__ABI,
} as const

export interface GlobalStats {
  totalStaked: bigint // in GDollars wei
  annualAPR: number // in percentage
}

export interface UserStats {
  walletBalance: bigint // in GDollars wei
  currentStake: bigint // in GDollars wei
  unclaimedRewards: bigint // in GDollars wei
  userWeeklyRewards: bigint // in GDollars wei
}

export class GooddollarSavingsSDK {
  private publicClient: PublicClient
  private walletClient: WalletClient | null = null
  private totalStaked: bigint = BigInt(0)
  private cachedRewardRate: bigint = BigInt(0)

  constructor(
    publicClient: PublicClient,
    walletClient?: WalletClient,
  ) {
    if (!publicClient) throw new Error("Public client is required")
    if (!(publicClient.chain?.id === 42220)) {
      throw new Error("Public client must be connected to Celo mainnet")
    }
    this.publicClient = publicClient
    this.walletClient = null
    if (walletClient) {
      this.setWalletClient(walletClient)
    }
  }

  setWalletClient(walletClient: WalletClient) {
    if (!(walletClient.chain?.id === 42220)) {
      throw new Error("Wallet client must be connected to Celo mainnet")
    }
    this.walletClient = walletClient
  }

  async getGlobalStats(): Promise<GlobalStats> {
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

    let annualAPR = 0
    if (isFinished == false && totalSupply > BigInt(0)) {
      const secondsInYear = BigInt(365 * 24 * 60 * 60)
      annualAPR =
        (this.toEtherNumber(this.cachedRewardRate * secondsInYear) * 100) /
        this.toEtherNumber(totalSupply)
    }

    return {
      totalStaked: totalSupply,
      annualAPR: annualAPR,
    }
  }

  async getUserStats(): Promise<UserStats> {
    const account = await this.getAccount()

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

    let userWeeklyRewards = BigInt(0)
    if (staked > BigInt(0) && this.totalStaked == BigInt(0)) {
      await this.getGlobalStats()
      const oneWeekSeconds = BigInt(7 * 24 * 60 * 60)
      userWeeklyRewards =
        (this.cachedRewardRate * oneWeekSeconds * staked) / this.totalStaked
    }

    return {
      walletBalance: balance,
      currentStake: staked,
      unclaimedRewards: earned,
      userWeeklyRewards: userWeeklyRewards,
    }
  }

  async stake(amount: bigint, onHash?: (hash: `0x${string}`) => void) {
    if (amount <= BigInt(0)) throw new Error("Amount must be greater than zero")

    const account = await this.getAccount()

    const balance = await this.publicClient.readContract({
      ...gdollarContract,
      functionName: "balanceOf",
      args: [account],
    })

    if (balance < amount) {
      throw new Error("Insufficient G$ balance for staking")
    }

    await this.ensureAllowance(amount, onHash)

    return this.submitAndWait(
      {
        ...stakingContract,
        functionName: "stake",
        args: [amount],
      },
      onHash,
    )
  }

  async unstake(amount: bigint, onHash?: (hash: `0x${string}`) => void) {
    if (amount <= BigInt(0)) throw new Error("Amount must be greater than zero")

    return this.submitAndWait(
      {
        ...stakingContract,
        functionName: "withdraw",
        args: [amount],
      },
      onHash,
    )
  }

  async claimReward(onHash?: (hash: `0x${string}`) => void) {
    return this.submitAndWait(
      {
        ...stakingContract,
        functionName: "getReward",
        args: [],
      },
      onHash,
    )
  }

  private async submitAndWait(
    simulateParams: SimulateContractParameters,
    onHash?: (hash: `0x${string}`) => void,
  ) {
    if (!this.walletClient) throw new Error("Wallet client not initialized")

    const account = await this.getAccount()

    const { request } = await this.publicClient.simulateContract({
      account,
      ...simulateParams,
    })

    const hash = await this.walletClient.writeContract(request)
    if (onHash) onHash(hash)

    const receipt = await this.publicClient.waitForTransactionReceipt({ hash })

    return receipt
  }

  /**
   * Helper method to get the current account address from wallet client
   */
  private async getAccount(): Promise<`0x${string}`> {
    if (!this.walletClient) throw new Error("Wallet client not initialized")
    const [account] = await this.walletClient.getAddresses()
    if (!account) throw new Error("No account found in wallet client")
    return account
  }

  /**
   * Helper method to ensure the staking contract has sufficient allowance to spend G$ tokens
   * If allowance is insufficient, it will request approval from the user
   */
  private async ensureAllowance(
    amount: bigint,
    onHash?: (hash: `0x${string}`) => void,
  ) {
    const account = await this.getAccount()
    const allowance = await this.publicClient.readContract({
      ...gdollarContract,
      functionName: "allowance",
      args: [account, STAKING_CONTRACT_ADDRESS],
    })

    if (allowance < amount) {
      await this.submitAndWait(
        {
          ...gdollarContract,
          functionName: "approve",
          args: [STAKING_CONTRACT_ADDRESS, amount],
        },
        onHash,
      )
    }
  }

  private toEtherNumber(num: bigint) {
    return Number(formatEther(num))
  }
}
