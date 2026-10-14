export type TransactionSubmittedCallback = (
  hash: `0x${string}`,
) => void | Promise<void>

/**
 * Invokes a submitted-transaction callback and logs callback failures without
 * interrupting the transaction flow.
 * @param hash - The submitted transaction hash.
 * @param onSubmitted - Optional callback to notify after transaction broadcast.
 * @param label - Log message prefix used when the callback throws.
 */
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
