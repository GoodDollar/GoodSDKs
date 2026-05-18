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

export interface ChainConfig {
  chainId: number
  name: string
  stakingAddress: `0x${string}`
  gdollarAddress: `0x${string}`
}

const CELO_MAINNET_CHAIN_ID = 42220
const XDC_MAINNET_CHAIN_ID = 50

const CHAIN_CONFIGS: Record<number, ChainConfig> = {
  [CELO_MAINNET_CHAIN_ID]: {
    chainId: CELO_MAINNET_CHAIN_ID,
    name: "Celo",
    stakingAddress: "0x799a23dA264A157Db6F9c02BE62F82CE8d602A45",
    gdollarAddress: "0x62B8B11039FcfE5aB0C56E502b1C372A3d2a9c7A",
  },
  [XDC_MAINNET_CHAIN_ID]: {
    chainId: XDC_MAINNET_CHAIN_ID,
    name: "XDC",
    stakingAddress: "0x61a1Da2a81FbaE6b1B3A45D94355A6A5c5973A52",
    gdollarAddress: "0xEC2136843a983885AebF2feB3931F73A8eBEe50c",
  },
}

export const SUPPORTED_CHAIN_IDS: number[] = [CELO_MAINNET_CHAIN_ID, XDC_MAINNET_CHAIN_ID]

export function isSupportedChain(chainId: number | undefined): boolean {
  return typeof chainId === "number" && chainId in CHAIN_CONFIGS
}

export function getChainConfig(chainId: number): ChainConfig | undefined {
  return CHAIN_CONFIGS[chainId]
}

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
  private chainConfig: ChainConfig
  private stakingContract: {
    address: `0x${string}`
    abi: typeof STAKING_CONTRACT_ABI
  }
  private gdollarContract: {
    address: `0x${string}`
    abi: typeof G$__ABI
  }
  private totalStaked: bigint = BigInt(0)
  private cachedRewardRate: bigint = BigInt(0)

  constructor(publicClient: PublicClient, walletClient?: WalletClient) {
    if (!publicClient) throw new Error("Public client is required")
    const chainId = publicClient.chain?.id
    const config = chainId !== undefined ? CHAIN_CONFIGS[chainId] : undefined
    if (!config) {
      throw new Error(
        `Unsupported chain id ${chainId}. Supported chains: ${SUPPORTED_CHAIN_IDS.join(", ")}`,
      )
    }
    this.publicClient = publicClient
    this.chainConfig = config
    this.stakingContract = {
      address: config.stakingAddress,
      abi: STAKING_CONTRACT_ABI,
    }
    this.gdollarContract = {
      address: config.gdollarAddress,
      abi: G$__ABI,
    }
    this.walletClient = null
    if (walletClient) {
      this.setWalletClient(walletClient)
    }
  }

  get chainId(): number {
    return this.chainConfig.chainId
  }

  get chainName(): string {
    return this.chainConfig.name
  }

  setWalletClient(walletClient: WalletClient) {
    if (walletClient.chain?.id !== this.chainConfig.chainId) {
      throw new Error(
        `Wallet client must be connected to ${this.chainConfig.name} (chain id ${this.chainConfig.chainId})`,
      )
    }
    this.walletClient = walletClient
  }

  async getGlobalStats(): Promise<GlobalStats> {
    const [totalSupply, periodFinish, effectiveRewardRate] = await Promise.all([
      this.publicClient.readContract({
        ...this.stakingContract,
        functionName: "totalSupply",
      }),
      this.publicClient.readContract({
        ...this.stakingContract,
        functionName: "periodFinish",
      }),
      this.publicClient.readContract({
        ...this.stakingContract,
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
        ...this.gdollarContract,
        functionName: "balanceOf",
        args: [account],
      }),
      this.publicClient.readContract({
        ...this.stakingContract,
        functionName: "balanceOf",
        args: [account],
      }),
      this.publicClient.readContract({
        ...this.stakingContract,
        functionName: "earned",
        args: [account],
      }),
    ])

    let userWeeklyRewards = BigInt(0)
    if (this.totalStaked === BigInt(0)) {
      await this.getGlobalStats()
    }

    if (
      staked > BigInt(0) &&
      this.totalStaked > BigInt(0) &&
      this.cachedRewardRate > BigInt(0)
    ) {
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
      ...this.gdollarContract,
      functionName: "balanceOf",
      args: [account],
    })

    if (balance < amount) {
      throw new Error("Insufficient G$ balance for staking")
    }

    await this.ensureAllowance(amount, onHash)

    return this.submitAndWait(
      {
        ...this.stakingContract,
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
        ...this.stakingContract,
        functionName: "withdraw",
        args: [amount],
      },
      onHash,
    )
  }

  async claimReward(onHash?: (hash: `0x${string}`) => void) {
    return this.submitAndWait(
      {
        ...this.stakingContract,
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
    const allowance = await this.publicClient.readContract({
      ...this.gdollarContract,
      functionName: "allowance",
      args: [account, this.chainConfig.stakingAddress],
    })

    if (allowance < amount) {
      const approvalReceipt = await this.submitAndWait(
        {
          ...this.gdollarContract,
          functionName: "approve",
          args: [this.chainConfig.stakingAddress, amount],
        },
        onHash,
      )

      if (approvalReceipt.status !== "success") {
        throw new Error("Approval transaction failed")
      }

      const updatedAllowance = await this.publicClient.readContract({
        ...this.gdollarContract,
        functionName: "allowance",
        args: [account, this.chainConfig.stakingAddress],
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
    if (walletChainId !== this.chainConfig.chainId) {
      throw new Error(
        `Wrong network. Please switch your wallet to ${this.chainConfig.name}.`,
      )
    }
  }

  private toEtherNumber(num: bigint) {
    return Number(formatEther(num))
  }
}
