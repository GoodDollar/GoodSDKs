import type { PublicClient, WalletClient } from 'viem';
import {
  ERC20_ABI,
  GD_TOKEN,
  IS_GD_TOKEN0,
  POOL_ABI,
  POOL_ADDRESS,
  POOL_FEE,
  POSITION_MANAGER,
  POSITION_MANAGER_ABI,
  TOKEN0,
  TOKEN1,
  USDGLO_TOKEN,
} from './constants';
import { computeGdPriceFromSqrtPrice, computeSqrtPriceFloat, getAmountsForPositionApprox } from './liquidity-math';
import type {
  PoolData,
  PositionData,
  TxCallbacks,
  UserBalancesAndAllowances,
} from './types';

const MAX_UINT128 = 2n ** 128n - 1n;
const CELO_CHAIN_ID = 42220;

export class GooddollarLiquiditySDK {
  private publicClient: PublicClient;
  private walletClient: WalletClient | null = null;

  constructor(publicClient: PublicClient, walletClient?: WalletClient) {
    if (!publicClient) throw new Error('Public client is required');
    if (publicClient.chain?.id !== CELO_CHAIN_ID) {
      throw new Error('Public client must be connected to Celo mainnet');
    }
    this.publicClient = publicClient;
    if (walletClient) this.setWalletClient(walletClient);
  }

  setWalletClient(walletClient: WalletClient) {
    if (walletClient.chain?.id !== CELO_CHAIN_ID) {
      throw new Error('Wallet client must be connected to Celo mainnet');
    }
    this.walletClient = walletClient;
  }

  // ── Reads ────────────────────────────────────────────────────────────

  async loadPoolData(): Promise<PoolData> {
    const slot0 = await this.publicClient.readContract({
      address: POOL_ADDRESS,
      abi: POOL_ABI,
      functionName: 'slot0',
    });

    const sqrtPriceX96 = slot0[0];
    const currentTick = slot0[1];

    return {
      sqrtPriceX96,
      currentTick,
      gdPriceInUsdglo: computeGdPriceFromSqrtPrice(sqrtPriceX96),
      sqrtPriceFloat: computeSqrtPriceFloat(sqrtPriceX96),
    };
  }

  async loadUserBalancesAndAllowances(
    userAddress: `0x${string}`,
  ): Promise<UserBalancesAndAllowances> {
    const results = await this.publicClient.multicall({
      contracts: [
        {
          address: GD_TOKEN,
          abi: ERC20_ABI,
          functionName: 'balanceOf' as const,
          args: [userAddress],
        },
        {
          address: USDGLO_TOKEN,
          abi: ERC20_ABI,
          functionName: 'balanceOf' as const,
          args: [userAddress],
        },
        {
          address: GD_TOKEN,
          abi: ERC20_ABI,
          functionName: 'allowance' as const,
          args: [userAddress, POSITION_MANAGER],
        },
        {
          address: USDGLO_TOKEN,
          abi: ERC20_ABI,
          functionName: 'allowance' as const,
          args: [userAddress, POSITION_MANAGER],
        },
      ],
    });

    const gdBalance = results[0].status === 'success' ? (results[0].result as bigint) : 0n;
    const usdgloBalance = results[1].status === 'success' ? (results[1].result as bigint) : 0n;
    const gdAllowance = results[2].status === 'success' ? (results[2].result as bigint) : 0n;
    const usdgloAllowance = results[3].status === 'success' ? (results[3].result as bigint) : 0n;

    return { gdBalance, usdgloBalance, gdAllowance, usdgloAllowance };
  }

  async getUserPositions(
    userAddress: `0x${string}`,
    currentTick: number,
  ): Promise<PositionData[]> {
    let positionCount: number;
    try {
      const positionCountR = (await this.publicClient.readContract({
        address: POSITION_MANAGER,
        abi: POSITION_MANAGER_ABI,
        functionName: 'balanceOf',
        args: [userAddress],
      })) as bigint;
      // it is ok to convert to number because position count is in safe range
      positionCount = Number(positionCountR);
    } catch {
      return [];
    }

    if (positionCount === 0) return [];

    const tokenIdResults = await this.publicClient.multicall({
      contracts: Array.from({ length: positionCount }, (_, i) => ({
        address: POSITION_MANAGER,
        abi: POSITION_MANAGER_ABI,
        functionName: 'tokenOfOwnerByIndex' as const,
        args: [userAddress, BigInt(i)],
      })),
    });

    const tokenIds = tokenIdResults
      .filter((r) => r.status === 'success')
      .map((r) => r.result as bigint);

    if (tokenIds.length === 0) return [];

    const positionResults = await this.publicClient.multicall({
      contracts: tokenIds.map((tokenId) => ({
        address: POSITION_MANAGER,
        abi: POSITION_MANAGER_ABI,
        functionName: 'positions' as const,
        args: [tokenId],
      })),
    });

    const positions: PositionData[] = [];
    for (let i = 0; i < tokenIds.length; i++) {
      const res = positionResults[i];
      if (res.status !== 'success') continue;

      const pos = res.result as readonly [
        bigint, string, string, string, number, number, number,
        bigint, bigint, bigint, bigint, bigint,
      ];
      const [, , token0, token1, fee, tickLower, tickUpper, liquidity, , , tokensOwed0, tokensOwed1] = pos;

      const matchesPool =
        token0.toLowerCase() === TOKEN0.toLowerCase() &&
        token1.toLowerCase() === TOKEN1.toLowerCase() &&
        fee === POOL_FEE;

      if (!matchesPool) continue;
      if (liquidity === 0n && tokensOwed0 === 0n && tokensOwed1 === 0n) continue;

      const { amount0, amount1 } = getAmountsForPositionApprox(
        liquidity, tickLower, tickUpper, currentTick,
      );

      positions.push({
        tokenId: tokenIds[i],
        token0, token1,
        fee, tickLower, tickUpper,
        liquidity,
        tokensOwed0, tokensOwed1,
        amount0, amount1,
        inRange: currentTick >= tickLower && currentTick < tickUpper,
      });
    }

    return positions;
  }

  // ── Writes ───────────────────────────────────────────────────────────

  async approveToken(
    tokenAddress: `0x${string}`,
    amount: bigint,
    bufferPercent: number = 5,
    callbacks?: TxCallbacks,
  ): Promise<`0x${string}`> {
    const { account, walletClient } = await this.requireWallet();

    const bufferedAmount =
      amount + (amount * BigInt(Math.round(bufferPercent * 100))) / 10000n;

    const { request } = await this.publicClient.simulateContract({
      account,
      address: tokenAddress,
      abi: ERC20_ABI,
      functionName: 'approve',
      args: [POSITION_MANAGER, bufferedAmount],
    });

    const hash = await walletClient.writeContract(request);
    callbacks?.onHash?.(hash);

    await this.publicClient.waitForTransactionReceipt({ hash });
    callbacks?.onConfirmed?.(hash);

    await new Promise((resolve) => setTimeout(resolve, 2000));
    return hash;
  }

  async addLiquidity(
    gdAmountWei: bigint,
    usdgloAmountWei: bigint,
    tickLower: number,
    tickUpper: number,
    callbacks?: TxCallbacks,
  ): Promise<`0x${string}`> {
    const { account, walletClient } = await this.requireWallet();

    const amount0Desired = IS_GD_TOKEN0 ? gdAmountWei : usdgloAmountWei;
    const amount1Desired = IS_GD_TOKEN0 ? usdgloAmountWei : gdAmountWei;
    const deadline = BigInt(Math.floor(Date.now() / 1000) + 1200);

    const { request } = await this.publicClient.simulateContract({
      account,
      address: POSITION_MANAGER,
      abi: POSITION_MANAGER_ABI,
      functionName: 'mint',
      args: [{
        token0: TOKEN0,
        token1: TOKEN1,
        fee: POOL_FEE,
        tickLower,
        tickUpper,
        amount0Desired,
        amount1Desired,
        amount0Min: 0n,
        amount1Min: 0n,
        recipient: account,
        deadline,
      }],
    });

    const hash = await walletClient.writeContract(request);
    callbacks?.onHash?.(hash);

    await this.publicClient.waitForTransactionReceipt({ hash });
    callbacks?.onConfirmed?.(hash);

    await new Promise((resolve) => setTimeout(resolve, 2000));
    return hash;
  }

  async removeLiquidity(
    tokenId: bigint,
    liquidity: bigint,
    callbacks?: TxCallbacks,
  ): Promise<`0x${string}`> {
    if (liquidity > MAX_UINT128) {
      throw new Error('Liquidity value exceeds uint128 maximum');
    }
    const { account, walletClient } = await this.requireWallet();

    const deadline = BigInt(Math.floor(Date.now() / 1000) + 1200);

    const { request } = await this.publicClient.simulateContract({
      account,
      address: POSITION_MANAGER,
      abi: POSITION_MANAGER_ABI,
      functionName: 'decreaseLiquidity',
      args: [{
        tokenId,
        liquidity: liquidity as unknown as bigint & { __brand: 'uint128' },
        amount0Min: 0n,
        amount1Min: 0n,
        deadline,
      }],
    });

    const hash = await walletClient.writeContract(request);
    callbacks?.onHash?.(hash);
    await this.publicClient.waitForTransactionReceipt({ hash });
    callbacks?.onConfirmed?.(hash);

    await new Promise((resolve) => setTimeout(resolve, 2000));
    return hash;
  }

  async collectFees(
    tokenId: bigint,
    callbacks?: TxCallbacks,
  ): Promise<`0x${string}`> {
    const { account, walletClient } = await this.requireWallet();

    const { request } = await this.publicClient.simulateContract({
      account,
      address: POSITION_MANAGER,
      abi: POSITION_MANAGER_ABI,
      functionName: 'collect',
      args: [{
        tokenId,
        recipient: account,
        amount0Max: MAX_UINT128,
        amount1Max: MAX_UINT128,
      }],
    });

    const hash = await walletClient.writeContract(request);
    callbacks?.onHash?.(hash);

    await this.publicClient.waitForTransactionReceipt({ hash });
    callbacks?.onConfirmed?.(hash);

    await new Promise((resolve) => setTimeout(resolve, 2000));
    return hash;
  }

  // ── Helpers ──────────────────────────────────────────────────────────

  static parseTxError(error: any): string {
    const msg = error?.message || error?.toString() || '';

    if (msg.includes('User rejected') || msg.includes('user rejected') || msg.includes('ACTION_REJECTED'))
      return 'Transaction was rejected in your wallet.';
    if (msg.includes('insufficient funds') || msg.includes('InsufficientFunds'))
      return 'Insufficient funds to cover gas fees.';
    if (msg.includes('exceeds balance'))
      return 'Token balance too low for this transaction.';
    if (msg.includes('UNPREDICTABLE_GAS') || msg.includes('execution reverted'))
      return 'Transaction would fail on-chain. Try adjusting your amounts.';
    if (msg.includes('nonce'))
      return 'Transaction nonce conflict. Please reset your wallet or wait for pending transactions.';

    if (msg.length > 120) return 'Transaction failed. Please try again.';
    return msg || 'Transaction failed. Please try again.';
  }

  private async requireWallet(): Promise<{ account: `0x${string}`; walletClient: WalletClient }> {
    if (!this.walletClient) throw new Error('Wallet client not initialized');
    const [account] = await this.walletClient.getAddresses();
    if (!account) throw new Error('No account found in wallet client');
    return { account, walletClient: this.walletClient };
  }
}
