import type { PublicClient } from 'viem';
import { formatEther } from 'viem';
import {
  POOL_ADDRESS, POOL_ABI, POSITION_MANAGER, POSITION_MANAGER_ABI,
  GD_TOKEN, USDGLO_TOKEN, POOL_FEE, IS_GD_TOKEN0, TOKEN0, TOKEN1,
  tickToSqrtPrice,
} from './constants';
import type { PoolData, PositionData } from './types';

export async function loadPoolData(publicClient: PublicClient): Promise<PoolData> {
  const slot0 = await publicClient.readContract({
    address: POOL_ADDRESS,
    abi: POOL_ABI,
    functionName: 'slot0',
  });

  const sqrtPriceX96 = slot0[0];
  const currentTick = slot0[1];
  const sqrtPrice = Number(sqrtPriceX96) / (2 ** 96);
  const rawPrice = sqrtPrice * sqrtPrice;
  const gdPriceInUsdglo = rawPrice === 0 ? 0 : (IS_GD_TOKEN0 ? rawPrice : 1 / rawPrice);

  return { sqrtPriceX96, currentTick, price: rawPrice, gdPriceInUsdglo };
}

export async function loadUserBalancesAndAllowances(
  publicClient: PublicClient,
  userAddress: `0x${string}`,
) {
  const [gdBalance, usdgloBalance, gdAllowance, usdgloAllowance] = await Promise.all([
    publicClient.readContract({
      address: GD_TOKEN, abi: (await import('./constants')).ERC20_ABI,
      functionName: 'balanceOf', args: [userAddress],
    }),
    publicClient.readContract({
      address: USDGLO_TOKEN, abi: (await import('./constants')).ERC20_ABI,
      functionName: 'balanceOf', args: [userAddress],
    }),
    publicClient.readContract({
      address: GD_TOKEN, abi: (await import('./constants')).ERC20_ABI,
      functionName: 'allowance', args: [userAddress, POSITION_MANAGER],
    }),
    publicClient.readContract({
      address: USDGLO_TOKEN, abi: (await import('./constants')).ERC20_ABI,
      functionName: 'allowance', args: [userAddress, POSITION_MANAGER],
    }),
  ]);

  return { gdBalance, usdgloBalance, gdAllowance, usdgloAllowance };
}

export async function getUserPositions(
  publicClient: PublicClient,
  userAddress: `0x${string}`,
  currentTick: number,
): Promise<PositionData[]> {
  let positionCount: bigint;
  try {
    positionCount = await publicClient.readContract({
      address: POSITION_MANAGER,
      abi: POSITION_MANAGER_ABI,
      functionName: 'balanceOf',
      args: [userAddress],
    }) as bigint;
  } catch {
    return [];
  }

  if (positionCount === 0n) return [];

  const tokenIds: bigint[] = [];
  for (let i = 0n; i < positionCount; i++) {
    const tokenId = await publicClient.readContract({
      address: POSITION_MANAGER,
      abi: POSITION_MANAGER_ABI,
      functionName: 'tokenOfOwnerByIndex',
      args: [userAddress, i],
    }) as bigint;
    tokenIds.push(tokenId);
  }

  const positions: PositionData[] = [];
  for (const tokenId of tokenIds) {
    const pos = await publicClient.readContract({
      address: POSITION_MANAGER,
      abi: POSITION_MANAGER_ABI,
      functionName: 'positions',
      args: [tokenId],
    }) as readonly [bigint, string, string, string, number, number, number, bigint, bigint, bigint, bigint, bigint];

    const [, , token0, token1, fee, tickLower, tickUpper, liquidity, , , tokensOwed0, tokensOwed1] = pos;

    const matchesPool =
      token0.toLowerCase() === TOKEN0.toLowerCase() &&
      token1.toLowerCase() === TOKEN1.toLowerCase() &&
      fee === POOL_FEE;

    if (!matchesPool) continue;
    if (liquidity === 0n && tokensOwed0 === 0n && tokensOwed1 === 0n) continue;

    const { amount0, amount1 } = calculatePositionAmounts(
      liquidity, tickLower, tickUpper, currentTick,
    );

    positions.push({
      tokenId,
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

function calculatePositionAmounts(
  liquidity: bigint,
  tickLower: number,
  tickUpper: number,
  currentTick: number,
): { amount0: bigint; amount1: bigint } {
  if (liquidity === 0n) return { amount0: 0n, amount1: 0n };

  const sqrtPriceLower = tickToSqrtPrice(tickLower);
  const sqrtPriceUpper = tickToSqrtPrice(tickUpper);
  const sqrtPriceCurrent = tickToSqrtPrice(currentTick);

  const L = Number(liquidity);
  let amount0 = 0;
  let amount1 = 0;

  if (currentTick < tickLower) {
    amount0 = L * (sqrtPriceUpper - sqrtPriceLower) / (sqrtPriceLower * sqrtPriceUpper);
  } else if (currentTick >= tickUpper) {
    amount1 = L * (sqrtPriceUpper - sqrtPriceLower);
  } else {
    amount0 = L * (sqrtPriceUpper - sqrtPriceCurrent) / (sqrtPriceCurrent * sqrtPriceUpper);
    amount1 = L * (sqrtPriceCurrent - sqrtPriceLower);
  }

  return {
    amount0: BigInt(Math.floor(amount0)),
    amount1: BigInt(Math.floor(amount1)),
  };
}

export function formatBigIntDisplay(num: bigint): string {
  return Intl.NumberFormat().format(Number(formatEther(num)));
}

export function formatAmount(num: number): string {
  if (num === 0) return '0';
  return num.toFixed(6).replace(/\.?0+$/, '');
}

export function getGdAndUsdgloAmounts(
  amount0: bigint,
  amount1: bigint,
): { gdAmount: bigint; usdgloAmount: bigint } {
  return {
    gdAmount: IS_GD_TOKEN0 ? amount0 : amount1,
    usdgloAmount: IS_GD_TOKEN0 ? amount1 : amount0,
  };
}
