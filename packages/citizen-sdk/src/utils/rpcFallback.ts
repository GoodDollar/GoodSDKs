import { createPublicClient, http, type PublicClient } from "viem"

import {
  SupportedChains,
  chainConfigs,
  createRpcUrlIterator,
} from "../constants"

export type RpcIteratorRegistry = Map<SupportedChains, () => string>

export const createRpcIteratorRegistry = (): RpcIteratorRegistry =>
  new Map<SupportedChains, () => string>()

const getIterator = (
  chainId: SupportedChains,
  registry: RpcIteratorRegistry,
): (() => string) => {
  if (!registry.has(chainId)) {
    registry.set(chainId, createRpcUrlIterator(chainId))
  }

  const iterator = registry.get(chainId)
  if (!iterator) {
    throw new Error(`RPC iterator not available for chain ${chainId}`)
  }

  return iterator
}

export const getRpcFallbackClient = (
  chainId: SupportedChains,
  registry: RpcIteratorRegistry,
): PublicClient => {
  const iterator = getIterator(chainId, registry)
  const rpcUrl = iterator()

  return createPublicClient({
    transport: http(rpcUrl),
  }) as PublicClient
}

export const shouldRetryRpcFallback = (
  errorMessage: string,
  chainId: SupportedChains,
  attempt: number,
): boolean => {
  if (attempt > 0) {
    return false
  }

  const rpcUrls = chainConfigs[chainId]?.rpcUrls ?? []
  if (!rpcUrls.length) {
    return false
  }

  const normalizedMessage = errorMessage.toLowerCase()
  return normalizedMessage.includes("transports[i] is not a function")
}

export const extractErrorMessage = (error: unknown): string => {
  const messages = new Set<string>()
  const err = error as Record<string, any> | null | undefined

  if (typeof err?.shortMessage === "string") {
    messages.add(err.shortMessage)
  }

  if (typeof err?.message === "string") {
    messages.add(err.message)
  }

  if (typeof err?.details === "string") {
    messages.add(err.details)
  }

  const causeMessage = err?.cause?.message
  if (typeof causeMessage === "string") {
    messages.add(causeMessage)
  }

  if (!messages.size) {
    return "Unknown error"
  }

  return Array.from(messages).join(" | ")
}
