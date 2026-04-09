import { parseAbi } from 'viem';

export const GD_TOKEN = '0x62B8B11039FcfE5aB0C56E502b1C372A3d2a9c7A' as const;
export const USDGLO_TOKEN = '0x4F604735c1cF31399C6E711D5962b2B3E0225AD3' as const;
export const POSITION_MANAGER = '0x897387c7B996485c3AAa85c94272Cd6C506f8c8F' as const;
export const POOL_ADDRESS = '0x3D9e27C04076288eBfdC4815b4f6d81b0ED1b341' as const;
export const POOL_FEE = 10_000;
export const TICK_SPACING = 200;
export const DEFAULT_EXPLORER_URL = 'https://celoscan.io';
export const DEFAULT_APPROVAL_BUFFER = 5;

export const IS_GD_TOKEN0 = GD_TOKEN.toLowerCase() < USDGLO_TOKEN.toLowerCase();
export const TOKEN0 = IS_GD_TOKEN0 ? GD_TOKEN : USDGLO_TOKEN;
export const TOKEN1 = IS_GD_TOKEN0 ? USDGLO_TOKEN : GD_TOKEN;

export const FULL_RANGE_TICK_LOWER = -887_200;
export const FULL_RANGE_TICK_UPPER = 887_200;

export const ERC20_ABI = parseAbi([
  'function balanceOf(address account) view returns (uint256)',
  'function allowance(address owner, address spender) view returns (uint256)',
  'function approve(address spender, uint256 amount) returns (bool)',
]);

export const POOL_ABI = parseAbi([
  'function slot0() view returns (uint160 sqrtPriceX96, int24 tick, uint16 observationIndex, uint16 observationCardinality, uint16 observationCardinalityNext, uint8 feeProtocol, bool unlocked)',
]);

export const POSITION_MANAGER_ABI = parseAbi([
  'function mint((address token0, address token1, uint24 fee, int24 tickLower, int24 tickUpper, uint256 amount0Desired, uint256 amount1Desired, uint256 amount0Min, uint256 amount1Min, address recipient, uint256 deadline) params) payable returns (uint256 tokenId, uint128 liquidity, uint256 amount0, uint256 amount1)',
  'function balanceOf(address owner) view returns (uint256)',
  'function tokenOfOwnerByIndex(address owner, uint256 index) view returns (uint256)',
  'function positions(uint256 tokenId) view returns (uint96 nonce, address operator, address token0, address token1, uint24 fee, int24 tickLower, int24 tickUpper, uint128 liquidity, uint256 feeGrowthInside0LastX128, uint256 feeGrowthInside1LastX128, uint128 tokensOwed0, uint128 tokensOwed1)',
  'function decreaseLiquidity((uint256 tokenId, uint128 liquidity, uint256 amount0Min, uint256 amount1Min, uint256 deadline) params) payable returns (uint256 amount0, uint256 amount1)',
  'function collect((uint256 tokenId, address recipient, uint128 amount0Max, uint128 amount1Max) params) payable returns (uint256 amount0, uint256 amount1)',
]);

export function tickToSqrtPrice(tick: number): number {
  return Math.sqrt(1.0001 ** tick);
}

export function nearestUsableTick(tick: number, spacing: number): number {
  const rounded = Math.round(tick / spacing) * spacing;
  return rounded;
}
