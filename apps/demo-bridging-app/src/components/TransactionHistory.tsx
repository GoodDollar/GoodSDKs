import { useState } from "react"
import { useAccount } from "wagmi"
import { useBridgingSDK, useBridgeHistory } from "@goodsdks/react-hooks"
import { BridgingSDK } from "@goodsdks/bridging-sdk"
import type { BridgeRequestEvent, ExecutedTransferEvent } from "@goodsdks/bridging-sdk"

export function TransactionHistory() {
  const { address, isConnected } = useAccount()
  const { history, loading } = useBridgeHistory(address)

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

  if (history.length === 0) {
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
      {history.map((tx: BridgeRequestEvent | ExecutedTransferEvent, index: number) => (
        <TransactionCard key={index} transaction={tx} />
      ))}
    </div>
  )
}

function TransactionCard({ transaction }: { transaction: BridgeRequestEvent | ExecutedTransferEvent }) {
  const { sdk } = useBridgingSDK()
  const [status, setStatus] = useState<any>(null)
  const [statusLoading, setStatusLoading] = useState(false)
  const type = "targetChainId" in transaction.args ? "request" : "executed"
  const protocol = transaction.args.bridge

  const fetchStatus = async () => {
    if (!sdk || type !== "request") return
    try {
      setStatusLoading(true)
      const txStatus = await sdk.getTransactionStatus(
        transaction.transactionHash,
        protocol,
      )
      setStatus(txStatus)
    } catch (err) {
      console.error("Failed to fetch status:", err)
    } finally {
      setStatusLoading(false)
    }
  }

  const formatAmountValue = (amount: bigint, chainId: number) => {
    const decimals = chainId === 1 || chainId === 122 ? 2 : 18
    const val = Number(amount) / Math.pow(10, decimals)
    return val.toLocaleString(undefined, {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })
  }

  const srcChainId = type === "request"
    ? sdk?.publicClient.chain?.id || 42220
    : (transaction.args as ExecutedTransferEvent["args"]).sourceChainId

  const dstChainId = type === "request"
    ? (transaction.args as BridgeRequestEvent["args"]).targetChainId
    : sdk?.publicClient.chain?.id || 42220

  const amount = formatAmountValue(transaction.args.amount, Number(srcChainId))

  return (
    <div className="premium-card !p-6 flex flex-col gap-6">
      {/* Card Header */}
      <div className="flex justify-between items-start">
        <div className="flex flex-col gap-1">
          <div className="flex items-center gap-2">
            <span className="text-slate-900 font-bold">
              Bridged via {BridgingSDK.formatProtocolName(protocol)}
            </span>
            <span className="text-slate-300">•</span>
            <span className="text-slate-400 text-sm font-medium">
              {type === "request"
                ? new Date(Number((transaction.args as BridgeRequestEvent["args"]).timestamp) * 1000).toLocaleString()
                : `Block #${transaction.blockNumber}`}
            </span>
          </div>
          <div className="flex items-center gap-3">
            <div
              className={`w-2 h-2 rounded-full ${type === "request" ? "bg-blue-500" : "bg-emerald-500"}`}
            ></div>
            <span className="text-slate-500 text-sm font-semibold capitalize">
              {type === "request" ? "Initiated" : "Completed"}
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
              {BridgingSDK.formatChainName(Number(srcChainId))[0]}
            </div>
            <div className="flex flex-col">
              <span className="text-slate-400 text-xs font-bold uppercase tracking-wider">
                From
              </span>
              <span className="text-slate-900 font-bold">
                {BridgingSDK.formatChainName(Number(srcChainId))}
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
              {BridgingSDK.formatChainName(Number(dstChainId))[0]}
            </div>
            <div className="flex flex-col">
              <span className="text-slate-400 text-xs font-bold uppercase tracking-wider">
                To
              </span>
              <span className="text-slate-900 font-bold">
                {BridgingSDK.formatChainName(Number(dstChainId))}
              </span>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3">
          {type === "request" && !status && (
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
                {BridgingSDK.getStatusLabel(status)}
              </span>
            </div>
          )}

          <a
            href={sdk?.explorerLink(
              transaction.transactionHash,
              protocol,
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
