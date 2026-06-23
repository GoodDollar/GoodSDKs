import { formatEther } from 'viem';
import { IS_GD_TOKEN0, tickToSqrtPrice } from './constants';

const MAX_TICK = 887272n;
const MAX_UINT256 = (1n << 256n) - 1n;
const Q96 = 2n ** 96n;
const Q192 = 2n ** 192n;
const SCALE = 10n ** 18n;

/**
 * Port of Uniswap V3 `TickMath.getSqrtRatioAtTick`. Returns the sqrtPriceX96
 * (Q64.96) for a given tick using pure bigint arithmetic, matching the
 * on-chain result exactly.
 */
function getSqrtRatioAtTick(tick: number): bigint {
  const tickBig = BigInt(tick);
  const absTick = tickBig < 0n ? -tickBig : tickBig;
  if (absTick > MAX_TICK) throw new Error(`Tick out of bounds: ${tick}`);

  let ratio =
    (absTick & 0x1n) !== 0n
      ? 0xfffcb933bd6fad37aa2d162d1a594001n
      : 0x100000000000000000000000000000000n;
  if ((absTick & 0x2n) !== 0n) ratio = (ratio * 0xfff97272373d413259a46990580e213an) >> 128n;
  if ((absTick & 0x4n) !== 0n) ratio = (ratio * 0xfff2e50f5f656932ef12357cf3c7fdccn) >> 128n;
  if ((absTick & 0x8n) !== 0n) ratio = (ratio * 0xffe5caca7e10e4e61c3624eaa0941cd0n) >> 128n;
  if ((absTick & 0x10n) !== 0n) ratio = (ratio * 0xffcb9843d60f6159c9db58835c926644n) >> 128n;
  if ((absTick & 0x20n) !== 0n) ratio = (ratio * 0xff973b41fa98c081472e6896dfb254c0n) >> 128n;
  if ((absTick & 0x40n) !== 0n) ratio = (ratio * 0xff2ea16466c96a3843ec78b326b52861n) >> 128n;
  if ((absTick & 0x80n) !== 0n) ratio = (ratio * 0xfe5dee046a99a2a811c461f1969c3053n) >> 128n;
  if ((absTick & 0x100n) !== 0n) ratio = (ratio * 0xfcbe86c7900a88aedcffc83b479aa3a4n) >> 128n;
  if ((absTick & 0x200n) !== 0n) ratio = (ratio * 0xf987a7253ac413176f2b074cf7815e54n) >> 128n;
  if ((absTick & 0x400n) !== 0n) ratio = (ratio * 0xf3392b0822b70005940c7a398e4b70f3n) >> 128n;
  if ((absTick & 0x800n) !== 0n) ratio = (ratio * 0xe7159475a2c29b7443b29c7fa6e889d9n) >> 128n;
  if ((absTick & 0x1000n) !== 0n) ratio = (ratio * 0xd097f3bdfd2022b8845ad8f792aa5825n) >> 128n;
  if ((absTick & 0x2000n) !== 0n) ratio = (ratio * 0xa9f746462d870fdf8a65dc1f90e061e5n) >> 128n;
  if ((absTick & 0x4000n) !== 0n) ratio = (ratio * 0x70d869a156d2a1b890bb3df62baf32f7n) >> 128n;
  if ((absTick & 0x8000n) !== 0n) ratio = (ratio * 0x31be135f97d08fd981231505542fcfa6n) >> 128n;
  if ((absTick & 0x10000n) !== 0n) ratio = (ratio * 0x9aa508b5b7a84e1c677de54f3e99bc9n) >> 128n;
  if ((absTick & 0x20000n) !== 0n) ratio = (ratio * 0x5d6af8dedb81196699c329225ee604n) >> 128n;
  if ((absTick & 0x40000n) !== 0n) ratio = (ratio * 0x2216e584f5fa1ea926041bedfe98n) >> 128n;
  if ((absTick & 0x80000n) !== 0n) ratio = (ratio * 0x48a170391f7dc42444e8fa2n) >> 128n;

  if (tickBig > 0n) ratio = MAX_UINT256 / ratio;

  // Convert from Q128.128 to Q128.96, rounding up so the inverse maps cleanly.
  return (ratio >> 32n) + (ratio % (1n << 32n) === 0n ? 0n : 1n);
}

/**
 * Approximate token amounts held by a Uniswap V3 position, computed entirely
 * with bigint arithmetic against sqrtPriceX96 values so there is no float
 * rounding or uint128 scaling hack.
 */
export function getAmountsForPositionApprox(
  liquidity: bigint,
  tickLower: number,
  tickUpper: number,
  currentTick: number,
): { amount0: bigint; amount1: bigint } {
  if (liquidity === 0n) return { amount0: 0n, amount1: 0n };

  const sqrtPriceLowerX96 = getSqrtRatioAtTick(tickLower);
  const sqrtPriceUpperX96 = getSqrtRatioAtTick(tickUpper);

  if (currentTick < tickLower) {
    const amount0 =
      (liquidity * (sqrtPriceUpperX96 - sqrtPriceLowerX96) * Q96) /
      (sqrtPriceLowerX96 * sqrtPriceUpperX96);
    return { amount0, amount1: 0n };
  }

  if (currentTick >= tickUpper) {
    const amount1 =
      (liquidity * (sqrtPriceUpperX96 - sqrtPriceLowerX96)) / Q96;
    return { amount0: 0n, amount1 };
  }

  const sqrtPriceCurrentX96 = getSqrtRatioAtTick(currentTick);
  const amount0 =
    (liquidity * (sqrtPriceUpperX96 - sqrtPriceCurrentX96) * Q96) /
    (sqrtPriceCurrentX96 * sqrtPriceUpperX96);
  const amount1 =
    (liquidity * (sqrtPriceCurrentX96 - sqrtPriceLowerX96)) / Q96;
  return { amount0, amount1 };
}

/**
 * Compute the G$ price in USDGLO from the on-chain sqrtPriceX96.
 * All intermediate math is done in bigint to avoid uint160 overflow;
 * only the final scaled result is converted to a JS number.
 */
export function computeGdPriceFromSqrtPrice(sqrtPriceX96: bigint): number {
  if (sqrtPriceX96 === 0n) return 0;
  const scaledPrice = (sqrtPriceX96 * sqrtPriceX96 * SCALE) / Q192;
  const rawPrice = Number(formatEther(scaledPrice));
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
  return Number(formatEther(scaled));
}

function calcAmount1From0(
  amount0: number,
  sqrtPriceFloat: number,
  tickLower: number,
  tickUpper: number,
): number {
  const sqC = sqrtPriceFloat;
  const sqL = tickToSqrtPrice(tickLower);
  const sqU = tickToSqrtPrice(tickUpper);
  if (sqU <= sqL || sqC <= sqL || sqC >= sqU) return 0;
  const L = (amount0 * sqC * sqU) / (sqU - sqC);
  return L * (sqC - sqL);
}

function calcAmount0From1(
  amount1: number,
  sqrtPriceFloat: number,
  tickLower: number,
  tickUpper: number,
): number {
  const sqC = sqrtPriceFloat;
  const sqL = tickToSqrtPrice(tickLower);
  const sqU = tickToSqrtPrice(tickUpper);
  if (sqU <= sqL || sqC >= sqU || sqC <= sqL) return 0;
  const L = amount1 / (sqC - sqL);
  return (L * (sqU - sqC)) / (sqC * sqU);
}

function formatAmount(num: number): string {
  if (num === 0) return '0';
  return num.toFixed(6).replace(/\.?0+$/, '');
}

/**
 * Compute the counterpart USDGLO amount for a given G$ input, using the current
 * pool sqrtPrice and the selected tick range. Returns an empty string when the
 * input or pool state is invalid.
 */
export function calcUsdgloFromGd(
  gd: string,
  sqrtPriceFloat: number,
  tickLower: number,
  tickUpper: number,
): string {
  const gdNum = parseFloat(gd);
  if (isNaN(gdNum) || gdNum <= 0 || sqrtPriceFloat <= 0) return '';
  const usdglo = IS_GD_TOKEN0
    ? calcAmount1From0(gdNum, sqrtPriceFloat, tickLower, tickUpper)
    : calcAmount0From1(gdNum, sqrtPriceFloat, tickLower, tickUpper);
  if (!isFinite(usdglo) || usdglo < 0) return '';
  return formatAmount(usdglo);
}

/**
 * Compute the counterpart G$ amount for a given USDGLO input, using the current
 * pool sqrtPrice and the selected tick range. Returns an empty string when the
 * input or pool state is invalid.
 */
export function calcGdFromUsdglo(
  usdglo: string,
  sqrtPriceFloat: number,
  tickLower: number,
  tickUpper: number,
): string {
  const u = parseFloat(usdglo);
  if (isNaN(u) || u <= 0 || sqrtPriceFloat <= 0) return '';
  const gd = IS_GD_TOKEN0
    ? calcAmount0From1(u, sqrtPriceFloat, tickLower, tickUpper)
    : calcAmount1From0(u, sqrtPriceFloat, tickLower, tickUpper);
  if (!isFinite(gd) || gd < 0) return '';
  return formatAmount(gd);
}