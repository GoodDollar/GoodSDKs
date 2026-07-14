export const mapFriendlyError = (err: unknown, fallback: string): string => {
  const message = err instanceof Error ? err.message : String(err ?? fallback)
  const lower = message.toLowerCase()

  if (lower.includes("user rejected")) return "Transaction canceled in wallet."
  if (lower.includes("insufficient funds"))
    return "Insufficient funds for token amount or gas."
  if (lower.includes("allowance"))
    return "Insufficient allowance. Approve and try again."
  if (lower.includes("slippage"))
    return "Slippage too high. Increase tolerance or reduce trade size."
  if (lower.includes("revert"))
    return "Quote or swap reverted on-chain. Try a smaller amount."
  if (lower.includes("outflow"))
    return "Reserve limits may apply (for example, weekly outflow constraints)."

  return message || fallback
}
