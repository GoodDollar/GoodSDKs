import type { TxStepInfo } from './types';

export function buildTxSteps(params: {
  gdWei: bigint;
  usdgloWei: bigint;
  gdAllowance: bigint;
  usdgloAllowance: bigint;
}): {
  steps: TxStepInfo[];
  needGdApproval: boolean;
  needUsdgloApproval: boolean;
} {
  const { gdWei, usdgloWei, gdAllowance, usdgloAllowance } = params;
  const needGdApproval = gdWei > 0n && gdAllowance < gdWei;
  const needUsdgloApproval = usdgloWei > 0n && usdgloAllowance < usdgloWei;

  const steps: TxStepInfo[] = [
    { label: 'Approve G$', status: needGdApproval ? 'pending' : 'skipped' },
    {
      label: 'Approve USDGLO',
      status: needUsdgloApproval ? 'pending' : 'skipped',
    },
    { label: 'Add Liquidity', status: 'pending' },
  ];

  return { steps, needGdApproval, needUsdgloApproval };
}
