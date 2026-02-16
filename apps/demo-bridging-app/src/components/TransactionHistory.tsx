import { useState, useEffect } from "react"
import { useAccount } from "wagmi"
import { useBridgingSDK } from "@goodsdks/bridging-sdk"
import {
  formatChainName,
  formatProtocolName,
  formatTimestamp,
  getStatusLabel,
  getExplorerLink,
} from "@goodsdks/bridging-sdk"
import type {
  BridgeRequestEvent,
  ExecutedTransferEvent,
  BridgeProtocol,
} from "@goodsdks/bridging-sdk"

interface TransactionItem {
  type: "request" | "executed"
  data: BridgeRequestEvent | ExecutedTransferEvent
  protocol: BridgeProtocol
}

export function TransactionHistory() {
  const { address, isConnected } = useAccount()
  const { sdk } = useBridgingSDK()
  const [transactions, setTransactions] = useState<TransactionItem[]>([])
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (!isConnected || !sdk || !address) return

    const fetchTransactions = async () => {
      try {
        setLoading(true)
        const [requests, executed] = await Promise.all([
          sdk.getBridgeRequests(address as `0x${string}`),
          sdk.getExecutedTransfers(address as `0x${string}`),
        ])

        const allTransactions: TransactionItem[] = [
          ...requests.map((req) => ({
            type: "request" as const,
            data: req,
            protocol: req.args.bridge,
          })),
          ...executed.map((exec) => ({
            type: "executed" as const,
            data: exec,
            protocol: exec.args.bridge,
          })),
        ].sort((a, b) =>
          a.data.blockNumber === b.data.blockNumber
            ? 0
            : a.data.blockNumber < b.data.blockNumber
              ? 1
              : -1,
        )

        setTransactions(allTransactions)
      } catch (err) {
        console.error("Failed to fetch transactions:", err)
      } finally {
        setLoading(false)
      }
    }

    fetchTransactions()
  }, [isConnected, sdk, address])

  if (!isConnected) return null

  if (loading) {
    return (
      <div className="flex justify-center py-20">
        <svg
          className="animate-spin h-10 w-10 text-blue-600"
          fill="none"
          viewBox="0 0 24 24"
        >
          <circle
            className="opacity-25"
            cx="12"
            cy="12"
            r="10"
            stroke="currentColor"
            strokeWidth="4"
          ></circle>
          <path
            className="opacity-75"
            fill="currentColor"
            d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
          ></path>
        </svg>
      </div>
    )
  }

  if (transactions.length === 0) {
    return (
      <div className="premium-card text-center p-12">
        <p className="text-slate-400 font-medium text-lg mb-2">
          No recent bridge transactions found
        </p>
        <p className="text-slate-300 text-sm">
          Make sure your wallet is connected to see your bridge transactions
        </p>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {transactions.map((tx, index) => (
        <TransactionCard key={index} transaction={tx} />
      ))}
    </div>
  )
}

function TransactionCard({ transaction }: { transaction: TransactionItem }) {
  const { sdk } = useBridgingSDK()
  const [status, setStatus] = useState<any>(null)
  const [statusLoading, setStatusLoading] = useState(false)

  const fetchStatus = async () => {
    if (!sdk || transaction.type !== "request") return
    try {
      setStatusLoading(true)
      const txStatus = await sdk.getTransactionStatus(
        transaction.data.transactionHash,
        transaction.protocol,
      )
      setStatus(txStatus)
    } catch (err) {
      console.error("Failed to fetch status:", err)
    } finally {
      setStatusLoading(false)
    }
  }

  const formatAmount = (amount: bigint, decimals: number) => {
    const val = Number(amount) / Math.pow(10, decimals)
    return val.toLocaleString(undefined, {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })
  }

  const getDecimalsForChain = (chainId: number) => {
    switch (chainId) {
      case 42220:
      case 50:
        return 18
      case 1:
      case 122:
        return 2
      default:
        return 18
    }
  }

  const srcChainId =
    transaction.type === "request"
      ? sdk?.publicClient.chain?.id || 42220
      : (transaction.data.args as any).sourceChainId

  const dstChainId =
    transaction.type === "request"
      ? (transaction.data.args as any).targetChainId
      : sdk?.publicClient.chain?.id || 42220

  const amount = formatAmount(
    transaction.data.args.amount,
    getDecimalsForChain(Number(srcChainId)),
  )

  return (
    <div className="premium-card !p-6 flex flex-col gap-6">
      {/* Card Header */}
      <div className="flex justify-between items-start">
        <div className="flex flex-col gap-1">
          <div className="flex items-center gap-2">
            <span className="text-slate-900 font-bold">
              Bridged via {formatProtocolName(transaction.protocol)}
            </span>
            <span className="text-slate-300">•</span>
            <span className="text-slate-400 text-sm font-medium">
              {formatTimestamp(Number(transaction.data.args.timestamp) * 1000)}
            </span>
          </div>
          <div className="flex items-center gap-3">
            <div
              className={`w-2 h-2 rounded-full ${transaction.type === "request" ? "bg-blue-500" : "bg-emerald-500"}`}
            ></div>
            <span className="text-slate-500 text-sm font-semibold capitalize">
              {transaction.type === "request" ? "Initiated" : "Completed"}
            </span>
          </div>
        </div>
        <div className="text-2xl font-bold text-emerald-500">+{amount} G$</div>
      </div>

      {/* Card Body */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-6">
          <div className="flex items-center gap-4">
            <div className="w-10 h-10 rounded-full bg-yellow-400 flex items-center justify-center font-bold text-white shadow-sm">
              {formatChainName(Number(srcChainId))[0]}
            </div>
            <div className="flex flex-col">
              <span className="text-slate-400 text-xs font-bold uppercase tracking-wider">
                From
              </span>
              <span className="text-slate-900 font-bold">
                {formatChainName(Number(srcChainId))}
              </span>
            </div>
          </div>

          <div className="text-slate-200">
            <svg
              className="w-6 h-6"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M17 8l4 4m0 0l-4 4m4-4H3"
              />
            </svg>
          </div>

          <div className="flex items-center gap-4">
            <div className="w-10 h-10 rounded-full bg-slate-800 flex items-center justify-center font-bold text-white shadow-sm">
              {formatChainName(Number(dstChainId))[0]}
            </div>
            <div className="flex flex-col">
              <span className="text-slate-400 text-xs font-bold uppercase tracking-wider">
                To
              </span>
              <span className="text-slate-900 font-bold">
                {formatChainName(Number(dstChainId))}
              </span>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3">
          {transaction.type === "request" && !status && (
            <button
              onClick={fetchStatus}
              disabled={statusLoading}
              className="px-4 py-2 bg-slate-50 hover:bg-slate-100 text-slate-600 font-bold rounded-xl border border-slate-200 transition-colors disabled:opacity-50"
            >
              {statusLoading ? "Checking..." : "Track Status"}
            </button>
          )}

          {status && (
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-orange-50 border border-orange-100">
              <div className="animate-pulse w-2 h-2 rounded-full bg-orange-400"></div>
              <span className="text-orange-600 font-bold text-sm">
                {getStatusLabel(status)}
              </span>
            </div>
          )}

          <a
            href={getExplorerLink(
              transaction.data.transactionHash,
              transaction.protocol,
            )}
            target="_blank"
            rel="noopener"
            className="p-2.5 rounded-xl bg-slate-50 hover:bg-slate-100 border border-slate-200 text-slate-400 transition-colors"
          >
            <svg
              className="w-5 h-5"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"
              />
            </svg>
          </a>
        </div>
      </div>
    </div>
  )
}
