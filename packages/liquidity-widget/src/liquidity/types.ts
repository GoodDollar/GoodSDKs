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

export interface WidgetTheme {
  primaryColor: string;
  borderRadius: string;
  fontFamily: string;
}
