export const DEFAULT_EVENT_BATCH_SIZE = 10_000n
export const DEFAULT_EVENT_LOOKBACK = 500_000n
export const WAIT_DELAY = 5000 // 1 second delay
export const LOG_BATCH_CONCURRENCY_LIMIT = 5

export interface BlockRange {
  from: bigint
  to: bigint
}

export interface BlockRangeConfig {
  batchSize: bigint
  fromBlock: bigint
  toBlock: bigint
}

export async function promisePool<T>(
  tasks: Array<() => Promise<T>>,
  concurrency: number,
): Promise<T[]> {
  if (tasks.length === 0) return []
  const limit = Math.max(1, concurrency)
  const results: T[] = new Array(tasks.length)
  let nextIndex = 0

  const worker = async () => {
    while (true) {
      const currentIndex = nextIndex++
      if (currentIndex >= tasks.length) break
      results[currentIndex] = await tasks[currentIndex]()
    }
  }

  const workers = Array.from({ length: Math.min(limit, tasks.length) }, () =>
    worker(),
  )
  await Promise.all(workers)

  return results
}

export function createBlockRanges({
  batchSize,
  fromBlock,
  toBlock,
}: BlockRangeConfig): BlockRange[] {
  if (batchSize <= 0n) {
    throw new Error("batchSize must be greater than zero")
  }
  if (fromBlock < 0n) {
    throw new Error("fromBlock must be zero or greater")
  }
  if (toBlock < fromBlock) {
    throw new Error("toBlock must be greater than or equal to fromBlock")
  }

  const ranges: BlockRange[] = []
  let rangeStart = fromBlock

  while (rangeStart <= toBlock) {
    const tentativeEnd = rangeStart + batchSize - 1n
    const rangeEnd = tentativeEnd > toBlock ? toBlock : tentativeEnd
    ranges.push({ from: rangeStart, to: rangeEnd })
    if (rangeEnd === toBlock) {
      break
    }
    rangeStart = rangeEnd + 1n
  }

  return ranges
}

export interface FetchInBlockBatchesParams<T> extends BlockRangeConfig {
  concurrency?: number
  promiseCreator: (fromBlock: bigint, toBlock: bigint) => Promise<T[]>
  onBatchFailure?: (error: unknown, range: BlockRange) => void
}

export async function fetchInBlockBatches<T>({
  batchSize,
  fromBlock,
  toBlock,
  concurrency = LOG_BATCH_CONCURRENCY_LIMIT,
  promiseCreator,
  onBatchFailure,
}: FetchInBlockBatchesParams<T>): Promise<T[]> {
  const ranges = createBlockRanges({ batchSize, fromBlock, toBlock })
  if (ranges.length === 0) return []

  const tasks = ranges.map((range) => async () => {
    try {
      return await promiseCreator(range.from, range.to)
    } catch (error) {
      if (onBatchFailure) {
        onBatchFailure(error, range)
      }
      return [] as T[]
    }
  })

  const results = await promisePool(tasks, concurrency)
  return results.flat()
}
