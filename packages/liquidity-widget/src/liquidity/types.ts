export type StepStatus = 'pending' | 'active' | 'completed' | 'skipped';

export interface TxStepInfo {
  label: string;
  status: StepStatus;
  txHash?: string;
}

export type TxFlowPhase =
  | 'idle'
  | 'approving-gd'
  | 'approving-usdglo'
  | 'minting'
  | 'success'
  | 'error';

export interface RangePreset {
  id: 'full' | 'wide' | 'narrow';
  label: string;
  description: string;
  tooltip: string;
  getTickRange: (currentTick: number, tickSpacing: number) => { tickLower: number; tickUpper: number };
  concentrationMultiplier: number;
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

export interface WidgetTheme {
  primaryColor: string;
  borderRadius: string;
  fontFamily: string;
}

export interface PoolData {
  sqrtPriceX96: bigint;
  currentTick: number;
  gdPriceInUsdglo: number;
  sqrtPriceFloat: number;
}
