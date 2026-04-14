import { tickToSqrtPrice } from './constants';

/**
 * Approximate token amounts held by a Uniswap V3 position.
 *
 * This is a UI-grade approximation: liquidity (uint128) may exceed
 * `Number.MAX_SAFE_INTEGER`, so we scale it down before converting to float
 * and multiply the result back up to avoid silent overflow/precision loss.
 */
export function getAmountsForPositionApprox(
  liquidity: bigint,
  tickLower: number,
  tickUpper: number,
  currentTick: number,
): { amount0: bigint; amount1: bigint } {
  if (liquidity === 0n) return { amount0: 0n, amount1: 0n };

  let scaleFactor = 1n;
  let scaled = liquidity;
  while (scaled > BigInt(Number.MAX_SAFE_INTEGER)) {
    scaled /= 10n;
    scaleFactor *= 10n;
  }
  const L = Number(scaled);

  const sqrtPriceLower = tickToSqrtPrice(tickLower);
  const sqrtPriceUpper = tickToSqrtPrice(tickUpper);
  const sqrtPriceCurrent = tickToSqrtPrice(currentTick);

  let amount0 = 0;
  let amount1 = 0;

  if (currentTick < tickLower) {
    amount0 =
      (L * (sqrtPriceUpper - sqrtPriceLower)) /
      (sqrtPriceLower * sqrtPriceUpper);
  } else if (currentTick >= tickUpper) {
    amount1 = L * (sqrtPriceUpper - sqrtPriceLower);
  } else {
    amount0 =
      (L * (sqrtPriceUpper - sqrtPriceCurrent)) /
      (sqrtPriceCurrent * sqrtPriceUpper);
    amount1 = L * (sqrtPriceCurrent - sqrtPriceLower);
  }

  return {
    amount0: BigInt(Math.max(0, Math.floor(amount0))) * scaleFactor,
    amount1: BigInt(Math.max(0, Math.floor(amount1))) * scaleFactor,
  };
}
