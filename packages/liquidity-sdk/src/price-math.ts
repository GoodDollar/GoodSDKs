import { IS_GD_TOKEN0 } from './constants';

const Q96 = 2n ** 96n;
const Q192 = 2n ** 192n;
const SCALE = 10n ** 18n;

/**
 * Compute the G$ price in USDGLO from the on-chain sqrtPriceX96.
 * All intermediate math is done in bigint to avoid uint160 overflow;
 * only the final scaled result is converted to a JS number.
 */
export function computeGdPriceFromSqrtPrice(sqrtPriceX96: bigint): number {
  if (sqrtPriceX96 === 0n) return 0;
  const scaledPrice = (sqrtPriceX96 * sqrtPriceX96 * SCALE) / Q192;
  const rawPrice = Number(scaledPrice) / 1e18;
  if (rawPrice <= 0) return 0;
  return IS_GD_TOKEN0 ? rawPrice : 1 / rawPrice;
}

/**
 * Compute the human-scale sqrtPrice float (= sqrtPriceX96 / 2^96) in bigint,
 * converting to a JS number only at the end.
 */
export function computeSqrtPriceFloat(sqrtPriceX96: bigint): number {
  if (sqrtPriceX96 === 0n) return 0;
  const scaled = (sqrtPriceX96 * SCALE) / Q96;
  return Number(scaled) / 1e18;
}
