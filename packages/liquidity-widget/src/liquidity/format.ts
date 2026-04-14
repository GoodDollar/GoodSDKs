import { formatEther } from 'viem';

export function formatBigIntDisplay(num: bigint): string {
  if (num === 0n) return '0';
  const [whole, frac = ''] = formatEther(num).split('.');
  const grouped = whole.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  const trimmedFrac = frac.slice(0, 2).replace(/0+$/, '');
  return trimmedFrac ? `${grouped}.${trimmedFrac}` : grouped;
}

export function formatAmount(num: number): string {
  if (num === 0) return '0';
  return num.toFixed(6).replace(/\.?0+$/, '');
}
