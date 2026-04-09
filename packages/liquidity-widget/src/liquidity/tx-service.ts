import type { PublicClient, WalletClient } from 'viem';
import {
  POSITION_MANAGER, POSITION_MANAGER_ABI, ERC20_ABI,
  TOKEN0, TOKEN1, POOL_FEE, IS_GD_TOKEN0,
} from './constants';

const MAX_UINT128 = 2n ** 128n - 1n;

export interface TxCallbacks {
  onHash?: (hash: `0x${string}`) => void;
  onConfirmed?: (hash: `0x${string}`) => void;
}

export async function approveToken(
  publicClient: PublicClient,
  walletClient: WalletClient,
  account: `0x${string}`,
  tokenAddress: `0x${string}`,
  amount: bigint,
  bufferPercent: number = 5,
  callbacks?: TxCallbacks,
): Promise<`0x${string}`> {
  const bufferedAmount = amount + (amount * BigInt(Math.round(bufferPercent * 100)) / 10000n);

  const { request } = await publicClient.simulateContract({
    account,
    address: tokenAddress,
    abi: ERC20_ABI,
    functionName: 'approve',
    args: [POSITION_MANAGER, bufferedAmount],
  });

  const hash = await walletClient.writeContract(request);
  callbacks?.onHash?.(hash);

  await publicClient.waitForTransactionReceipt({ hash });
  callbacks?.onConfirmed?.(hash);

  await new Promise((resolve) => setTimeout(resolve, 2000));
  return hash;
}

export async function addLiquidity(
  publicClient: PublicClient,
  walletClient: WalletClient,
  account: `0x${string}`,
  gdAmountWei: bigint,
  usdgloAmountWei: bigint,
  tickLower: number,
  tickUpper: number,
  callbacks?: TxCallbacks,
): Promise<`0x${string}`> {
  const amount0Desired = IS_GD_TOKEN0 ? gdAmountWei : usdgloAmountWei;
  const amount1Desired = IS_GD_TOKEN0 ? usdgloAmountWei : gdAmountWei;
  const deadline = BigInt(Math.floor(Date.now() / 1000) + 1200);

  const { request } = await publicClient.simulateContract({
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

  await publicClient.waitForTransactionReceipt({ hash });
  callbacks?.onConfirmed?.(hash);

  await new Promise((resolve) => setTimeout(resolve, 2000));
  return hash;
}

export async function removeLiquidity(
  publicClient: PublicClient,
  walletClient: WalletClient,
  account: `0x${string}`,
  tokenId: bigint,
  liquidity: bigint,
  callbacks?: TxCallbacks,
): Promise<`0x${string}`> {
  if (liquidity > MAX_UINT128) {
    throw new Error('Liquidity value exceeds uint128 maximum');
  }

  const deadline = BigInt(Math.floor(Date.now() / 1000) + 1200);

  const { request: decreaseReq } = await publicClient.simulateContract({
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

  const hash = await walletClient.writeContract(decreaseReq);
  callbacks?.onHash?.(hash);
  await publicClient.waitForTransactionReceipt({ hash });
  callbacks?.onConfirmed?.(hash);

  await new Promise((resolve) => setTimeout(resolve, 2000));
  return hash;
}

export async function collectFees(
  publicClient: PublicClient,
  walletClient: WalletClient,
  account: `0x${string}`,
  tokenId: bigint,
  callbacks?: TxCallbacks,
): Promise<`0x${string}`> {
  const { request } = await publicClient.simulateContract({
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

  await publicClient.waitForTransactionReceipt({ hash });
  callbacks?.onConfirmed?.(hash);

  await new Promise((resolve) => setTimeout(resolve, 2000));
  return hash;
}

export function parseTxError(error: any): string {
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
