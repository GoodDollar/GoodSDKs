export interface StorageLike {
  getItem(key: string): string | null
  setItem(key: string, value: string): void
  removeItem(key: string): void
}

export type StorageLogger = (
  message: string,
  context?: Record<string, unknown>,
) => void

export function clearStorageKey(
  storage: StorageLike | undefined,
  key: string,
  log?: StorageLogger,
): void {
  if (!storage) return
  try {
    storage.removeItem(key)
  } catch (error) {
    log?.("storage:clear_failed", { key, error })
  }
}

export function readProgressBlock(
  storage: StorageLike | undefined,
  key: string,
  log?: StorageLogger,
): bigint | undefined {
  if (!storage) return undefined

  let raw: string | null
  try {
    raw = storage.getItem(key)
  } catch (error) {
    log?.("storage:read_failed", { key, error })
    return undefined
  }

  if (!raw) return undefined

  try {
    const value = BigInt(raw)
    if (value < 0n) {
      log?.("storage:read_invalid_negative", { key, raw })
      clearStorageKey(storage, key, log)
      return undefined
    }
    return value
  } catch (error) {
    log?.("storage:read_invalid_parse", { key, raw, error })
    clearStorageKey(storage, key, log)
    return undefined
  }
}

export function writeProgressBlock(
  storage: StorageLike | undefined,
  key: string,
  value: bigint,
  log?: StorageLogger,
): void {
  if (!storage) return
  try {
    storage.setItem(key, value.toString())
  } catch (error) {
    log?.("storage:write_failed", {
      key,
      value: value.toString(),
      error,
    })
    clearStorageKey(storage, key, log)
  }
}
