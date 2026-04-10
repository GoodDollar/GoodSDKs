import { IS_GD_TOKEN0 } from './constants';

const Q96 = 2n ** 96n;
const Q192 = 2n ** 192n;

function pow10(decimals: number): bigint {
  let x = 1n;
  for (let i = 0; i < decimals; i++) x *= 10n;
  return x;
}

function formatFixed(value: bigint, decimals: number): string {
  const negative = value < 0n;
  const v = negative ? -value : value;
  const base = pow10(decimals);
  const whole = v / base;
  const frac = v % base;
  const fracStr = frac.toString().padStart(decimals, '0');
  return `${negative ? '-' : ''}${whole.toString()}${decimals > 0 ? `.${fracStr}` : ''}`;
}

function toFiniteNumber(value: string): number {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}

/**
 * Compute the G$ price in USDGLO from the on-chain sqrtPriceX96.
 * Uses bigint fixed-point arithmetic to avoid Number overflow on uint160 values.
 */
export function computeGdPriceFromSqrtPrice(sqrtPriceX96: bigint): number {
  if (sqrtPriceX96 === 0n) return 0;
  const scale = 18;
  const scaledPrice = (sqrtPriceX96 * sqrtPriceX96 * pow10(scale)) / Q192;
  const rawPrice = toFiniteNumber(formatFixed(scaledPrice, scale));
  if (rawPrice <= 0) return 0;
  return IS_GD_TOKEN0 ? rawPrice : 1 / rawPrice;
}

/**
 * Compute the human-scale sqrtPrice float from sqrtPriceX96.
 * Result is `sqrtPriceX96 / 2^96` computed via bigint to preserve precision.
 */
export function computeSqrtPriceFloat(sqrtPriceX96: bigint): number {
  if (sqrtPriceX96 === 0n) return 0;
  const scale = 12;
  const scaledSqrt = (sqrtPriceX96 * pow10(scale)) / Q96;
  return toFiniteNumber(formatFixed(scaledSqrt, scale));
}
