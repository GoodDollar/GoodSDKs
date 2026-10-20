export type TransactionSubmittedCallback = (
  hash: `0x${string}`,
) => void | Promise<void>

/**
 * Invokes a submitted-transaction callback without awaiting it (so a slow or
 * hanging callback cannot block confirmation) and logs callback failures without
 * interrupting the transaction flow.
 * @param hash - The submitted transaction hash.
 * @param onSubmitted - Optional callback to notify after transaction broadcast.
 * @param label - Log message prefix used when the callback throws.
 */
export function safeInvokeSubmittedCallback(
  hash: `0x${string}`,
  onSubmitted?: TransactionSubmittedCallback,
  label = "Transaction submitted callback",
): void {
  try {
    Promise.resolve(onSubmitted?.(hash)).catch((error) => {
      console.warn(`${label} failed`, error)
    })
  } catch (error) {
    console.warn(`${label} failed`, error)
  }
}
