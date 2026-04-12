import { useState, useEffect, useCallback } from "react"
import { useAccount, useChainId, useSwitchChain } from "wagmi"
import { parseUnits } from "viem"
import { useBridgingSDK } from "@goodsdks/react-hooks"
import { SUPPORTED_CHAINS, BRIDGE_PROTOCOLS } from "@goodsdks/bridging-sdk"
import type {
  BridgeProtocol,
  ChainId,
  BridgeConfig,
  BridgeQuoteResult,
  BridgeStatus,
} from "@goodsdks/bridging-sdk"

interface BridgeFormProps {
  defaultProtocol: BridgeProtocol
}

export function BridgeForm({ defaultProtocol }: BridgeFormProps) {
  const { address } = useAccount()
  const { sdk, loading: sdkLoading } = useBridgingSDK()
  const walletChainId = useChainId() as ChainId
  const { switchChain } = useSwitchChain()

  const fromChain: ChainId = SUPPORTED_CHAINS[walletChainId] ? walletChainId : 42220
  const [toChain, setToChain] = useState<ChainId>(() => {
    return (Object.keys(SUPPORTED_CHAINS).map(Number).find((id) => id !== fromChain) as ChainId) ?? 1
  })

  const [amount, setAmount] = useState("")
  const [recipient, setRecipient] = useState("")
  const [bridgeStatus, setBridgeStatus] = useState<BridgeStatus | null>(null)

  // Base config: balances, allowance, fees, limits
  const [config, setConfig] = useState<BridgeConfig | null>(null)
  const [configLoading, setConfigLoading] = useState(false)

  // Quote: validation result for the current amount/route
  const [quoteResult, setQuoteResult] = useState<BridgeQuoteResult | null>(null)
  const [quoteLoading, setQuoteLoading] = useState(false)

  // Reset toChain when wallet switches to it
  useEffect(() => {
    if (toChain === fromChain) {
      const fallback = (Object.keys(SUPPORTED_CHAINS).map(Number).find((id) => id !== fromChain) as ChainId) ?? 1
      setToChain(fallback)
    }
  }, [fromChain])

  // Set recipient to connected address by default
  useEffect(() => {
    if (address && !recipient) {
      setRecipient(address)
    }
  }, [address, recipient])

  // Fetch base config once and on interval
  const refreshConfig = useCallback(async () => {
    if (!sdk || !address) return
    try {
      setConfigLoading(true)
      const cfg = await sdk.getBridgeConfig(address)
      setConfig(cfg)
    } catch (err) {
      console.error("Failed to load bridge config:", err)
    } finally {
      setConfigLoading(false)
    }
  }, [sdk, address, fromChain])

  useEffect(() => {
    refreshConfig()
    const interval = setInterval(refreshConfig, 30000)
    return () => clearInterval(interval)
  }, [refreshConfig])

  // Re-evaluate quote whenever amount, route, or config changes
  useEffect(() => {
    if (!sdk || !address || !config || !amount) {
      setQuoteResult(null)
      return
    }

    const decimals = SUPPORTED_CHAINS[fromChain]?.decimals ?? 18
    let amountInWei: bigint
    try {
      amountInWei = parseUnits(amount, decimals)
      if (amountInWei <= 0n) {
        setQuoteResult(null)
        return
      }
    } catch {
      setQuoteResult(null)
      return
    }

    let cancelled = false
    const run = async () => {
      setQuoteLoading(true)
      try {
        const result = await sdk.getQuote(
          amountInWei,
          fromChain,
          toChain,
          (recipient || address) as `0x${string}`,
          defaultProtocol,
          config.allowance,
        )
        if (!cancelled) setQuoteResult(result)
      } catch (err) {
        if (!cancelled) console.error("getQuote failed:", err)
      } finally {
        if (!cancelled) setQuoteLoading(false)
      }
    }

    run()
    return () => { cancelled = true }
  }, [sdk, address, config, amount, fromChain, toChain, recipient, defaultProtocol])

  const handleBridge = async () => {
    if (!sdk || !quoteResult?.quote) return
    setBridgeStatus(null)

    try {
      await sdk.doBridge(quoteResult.quote, (status) => {
        setBridgeStatus(status)
      })
      setAmount("")
      await refreshConfig()
    } catch {
      // Status already updated via onStatus callback
    }
  }

  const handleSwapChains = () => {
    switchChain({ chainId: toChain })
  }

  const handleMaxAmount = () => {
    if (!config) return
    const decimals = SUPPORTED_CHAINS[fromChain]?.decimals ?? 18
    const formatted = Number(config.tokenBalance) / Math.pow(10, decimals)
    setAmount(formatted.toFixed(decimals > 2 ? 6 : 2))
  }

  // Derived display values
  const decimals = SUPPORTED_CHAINS[fromChain]?.decimals ?? 18
  const tokenBalanceFormatted = config
    ? (Number(config.tokenBalance) / Math.pow(10, decimals)).toFixed(2)
    : "0.00"

  const blockingRequirements = quoteResult?.requirements.filter(
    (r) => r.type !== "insufficient_allowance",
  ) ?? []
  const needsApproval = quoteResult?.needsApproval ?? false
  const canSubmit = quoteResult?.canBridge && !bridgeStatus

  const isBusy =
    bridgeStatus?.step === "approving" || bridgeStatus?.step === "bridging"

  return (
    <div className="space-y-8">
      {/* Chain Selection Row */}
      <div className="flex flex-col md:flex-row items-center gap-4 relative">
        <div className="flex-1 w-full">
          <label className="block text-slate-400 text-sm font-semibold mb-3 ml-1">From (connected chain)</label>
          <div className="premium-card !p-4 !bg-slate-50 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-yellow-400 flex items-center justify-center font-bold text-white shadow-sm">
                {SUPPORTED_CHAINS[fromChain].name[0]}
              </div>
              <div>
                <span className="font-bold text-slate-900">G$ {SUPPORTED_CHAINS[fromChain].name}</span>
              </div>
            </div>
          </div>
        </div>

        <button
          onClick={handleSwapChains}
          className="w-12 h-12 rounded-2xl bg-white border border-slate-100 shadow-md flex items-center justify-center hover:bg-slate-50 transition-all z-10 active:scale-95 mt-8"
        >
          <svg className="w-6 h-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" />
          </svg>
        </button>

        <div className="flex-1 w-full">
          <label className="block text-slate-400 text-sm font-semibold mb-3 ml-1">To</label>
          <div className="premium-card !p-4 !bg-slate-50 flex items-center justify-between cursor-pointer hover:!bg-slate-100 transition-colors">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-slate-800 flex items-center justify-center font-bold text-white shadow-sm">
                {SUPPORTED_CHAINS[toChain].name[0]}
              </div>
              <div>
                <span className="font-bold text-slate-900">G$ {SUPPORTED_CHAINS[toChain].name}</span>
              </div>
            </div>
            <select
              value={toChain}
              onChange={(e) => setToChain(Number(e.target.value) as ChainId)}
              className="absolute inset-0 opacity-0 cursor-pointer"
            >
              {Object.entries(SUPPORTED_CHAINS).filter(([id]) => Number(id) !== fromChain).map(([id, chain]) => (
                <option key={id} value={id}>{chain.name}</option>
              ))}
            </select>
            <svg className="w-5 h-5 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </div>
        </div>
      </div>

      {/* Amount Input Section */}
      <div className="space-y-6">
        <div>
          <div className="flex justify-between mb-3 px-1">
            <label className="text-slate-900 font-bold text-lg">Amount to send</label>
            <span className="text-slate-400 font-semibold">
              Balance: {configLoading ? "..." : tokenBalanceFormatted} G$
            </span>
          </div>
          <div className="relative group">
            <div className="absolute left-5 top-1/2 -translate-y-1/2 flex items-center gap-3 pointer-events-none">
              <button
                onClick={(e) => { e.stopPropagation(); handleMaxAmount() }}
                className="bg-blue-50 text-blue-600 text-xs font-bold px-3 py-1.5 rounded-lg border border-blue-100 flex items-center justify-center hover:bg-blue-100 transition-colors pointer-events-auto"
              >
                Max
              </button>
              <div className="h-6 w-px bg-slate-200"></div>
              <span className="text-slate-900 font-bold text-2xl">G$</span>
            </div>
            <input
              type="number"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              className="w-full bg-slate-50 border border-slate-100 rounded-2xl py-6 pl-32 pr-6 text-2xl font-bold text-slate-900 focus:bg-white focus:border-blue-500 transition-all outline-none"
              placeholder="1000"
            />
          </div>

          {/* Fee display from quote */}
          {amount && (
            <div className="mt-3 px-1">
              {quoteLoading ? (
                <div className="flex items-center gap-2 text-slate-400 text-sm">
                  <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  Estimating bridge fee...
                </div>
              ) : quoteResult?.quote ? (
                <div className="flex items-center justify-between text-sm">
                  <span className="text-slate-500 font-medium">Estimated bridge fee:</span>
                  <span className="text-slate-700 font-semibold">
                    {parseFloat(quoteResult.quote.feeInNative.split(" ")[0]).toFixed(6)}{" "}
                    {SUPPORTED_CHAINS[fromChain].nativeCurrency.symbol}
                  </span>
                </div>
              ) : null}
            </div>
          )}
        </div>
      </div>

      {/* Requirements — non-approval blocking issues */}
      {blockingRequirements.length > 0 && (
        <div className="space-y-2">
          {blockingRequirements.map((req, i) => (
            <div key={i} className="bg-red-50 text-red-600 p-3 rounded-xl font-medium text-sm border border-red-100">
              {req.message}
            </div>
          ))}
        </div>
      )}

      {/* Approval notice */}
      {needsApproval && blockingRequirements.length === 0 && (
        <div className="bg-blue-50 text-blue-700 p-3 rounded-xl font-medium text-sm border border-blue-100">
          Token approval required — doBridge will handle it automatically before bridging.
        </div>
      )}

      {/* Bridge status feedback */}
      {bridgeStatus && (
        <div className={`p-4 rounded-2xl font-medium text-center border ${
          bridgeStatus.step === "completed"
            ? "bg-emerald-50 text-emerald-700 border-emerald-100"
            : bridgeStatus.step === "failed"
            ? "bg-red-50 text-red-600 border-red-100"
            : "bg-blue-50 text-blue-700 border-blue-100"
        }`}>
          {bridgeStatus.step === "approving" && "Approving G$ spending..."}
          {bridgeStatus.step === "bridging" && "Submitting bridge transaction..."}
          {bridgeStatus.step === "completed" && "Bridge submitted successfully!"}
          {bridgeStatus.step === "failed" && (bridgeStatus.error || "Transaction failed")}
        </div>
      )}

      {/* Bridge button */}
      <button
        onClick={handleBridge}
        disabled={!amount || isBusy || sdkLoading || !canSubmit}
        className="premium-button w-full text-xl py-5"
      >
        {isBusy ? (
          <span className="flex items-center justify-center gap-3">
            <svg className="animate-spin h-6 w-6 text-white" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
            </svg>
            {bridgeStatus?.step === "approving" ? "Approving..." : "Bridging..."}
          </span>
        ) : needsApproval ? (
          `Approve & Bridge to ${SUPPORTED_CHAINS[toChain].name}`
        ) : (
          `Bridge to ${SUPPORTED_CHAINS[toChain].name}`
        )}
      </button>

      {/* Details Footnote */}
      <div className="pt-4 border-t border-slate-100 text-center space-y-2">
        <p className="text-slate-500 font-medium">Protocol Fee: 0.10% of bridged G$ amount</p>
        <p className="text-slate-500 font-medium">Provider: {BRIDGE_PROTOCOLS[defaultProtocol]}</p>
      </div>
    </div>
  )
}
