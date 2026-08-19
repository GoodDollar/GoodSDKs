export type TransactionSubmittedCallback = (
  hash: `0x${string}`,
) => void | Promise<void>

export async function safeInvokeSubmittedCallback(
  hash: `0x${string}`,
  onSubmitted?: TransactionSubmittedCallback,
  label = "Transaction submitted callback",
): Promise<void> {
  try {
    await onSubmitted?.(hash)
  } catch (error) {
    console.warn(`${label} failed`, error)
  }
}
