export interface PoolData {
  sqrtPriceX96: bigint;
  currentTick: number;
  gdPriceInUsdglo: number;
  sqrtPriceFloat: number;
}

export interface PositionData {
  tokenId: bigint;
  token0: string;
  token1: string;
  fee: number;
  tickLower: number;
  tickUpper: number;
  liquidity: bigint;
  tokensOwed0: bigint;
  tokensOwed1: bigint;
  amount0: bigint;
  amount1: bigint;
  inRange: boolean;
}

export interface UserBalancesAndAllowances {
  gdBalance: bigint;
  usdgloBalance: bigint;
  gdAllowance: bigint;
  usdgloAllowance: bigint;
}

export interface TxCallbacks {
  onHash?: (hash: `0x${string}`) => void;
  onConfirmed?: (hash: `0x${string}`) => void;
}
