export type TransactionSubmittedCallback = (
  hash: `0x${string}`,
) => void | Promise<void>

export async function safeInvokeSubmittedCallback(
  hash: `0x${string}`,
  onSubmitted?: TransactionSubmittedCallback,
): Promise<void> {
  try {
    await onSubmitted?.(hash)
  } catch (error) {
    console.warn("[ClaimSDK] onClaimSubmitted callback failed", error)
  }
}
