import type { PublicClient } from 'viem';
import { formatEther } from 'viem';
import {
  POOL_ADDRESS, POOL_ABI, POSITION_MANAGER, POSITION_MANAGER_ABI,
  GD_TOKEN, USDGLO_TOKEN, POOL_FEE, IS_GD_TOKEN0, TOKEN0, TOKEN1,
  tickToSqrtPrice, ERC20_ABI
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
  const results = await publicClient.multicall({
    contracts: [
      {
        address: GD_TOKEN, abi: ERC20_ABI,
        functionName: 'balanceOf' as const, args: [userAddress],
      },
      {
        address: USDGLO_TOKEN, abi: ERC20_ABI,
        functionName: 'balanceOf' as const, args: [userAddress],
      },
      {
        address: GD_TOKEN, abi: ERC20_ABI,
        functionName: 'allowance' as const, args: [userAddress, POSITION_MANAGER],
      },
      {
        address: USDGLO_TOKEN, abi: ERC20_ABI,
        functionName: 'allowance' as const, args: [userAddress, POSITION_MANAGER],
      },
    ],
  });

  const gdBalance = results[0].status === 'success' ? results[0].result as bigint : 0n;
  const usdgloBalance = results[1].status === 'success' ? results[1].result as bigint : 0n;
  const gdAllowance = results[2].status === 'success' ? results[2].result as bigint : 0n;
  const usdgloAllowance = results[3].status === 'success' ? results[3].result as bigint : 0n;

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

  const tokenIdResults = await publicClient.multicall({
    contracts: Array.from({ length: Number(positionCount) }, (_, i) => ({
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

  const positionResults = await publicClient.multicall({
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

    const pos = res.result as readonly [bigint, string, string, string, number, number, number, bigint, bigint, bigint, bigint, bigint];
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
