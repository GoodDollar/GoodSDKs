import { parseEther } from 'viem';

export function safeParseEther(value: string): bigint {
  try {
    if (!value || value.trim() === '' || value === '.') return 0n;
    return parseEther(value);
  } catch {
    return 0n;
  }
}

const INPUT_RE = /^[0-9]*\.?[0-9]*$/;

export function validateInputs(params: {
  gdInput: string;
  usdgloInput: string;
  gdBalance: bigint;
  usdgloBalance: bigint;
  force?: boolean;
}): string | null {
  const { gdInput, usdgloInput, gdBalance, usdgloBalance, force } = params;

  if (gdInput && !INPUT_RE.test(gdInput)) return 'Invalid G$ value';
  if (usdgloInput && !INPUT_RE.test(usdgloInput)) return 'Invalid USDGLO value';

  const gdNum = parseFloat(gdInput || '0');
  const usdgloNum = parseFloat(usdgloInput || '0');

  if (force && (isNaN(gdNum) || gdNum <= 0 || isNaN(usdgloNum) || usdgloNum <= 0)) {
    return 'Please enter valid amounts';
  }
  if (gdNum > 0 && safeParseEther(gdInput) > gdBalance) return 'Insufficient G$ balance';
  if (usdgloNum > 0 && safeParseEther(usdgloInput) > usdgloBalance) return 'Insufficient USDGLO balance';

  return null;
}
