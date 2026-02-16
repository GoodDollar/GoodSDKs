import { useState, useEffect } from "react"
import { useAccount, useReadContract } from "wagmi"
import { formatUnits } from "viem"
import { useBridgingSDK, useBridgeFee, parseAmount } from "@goodsdks/bridging-sdk"
import { SUPPORTED_CHAINS, BRIDGE_PROTOCOLS } from "@goodsdks/bridging-sdk"
import type { BridgeProtocol, ChainId } from "@goodsdks/bridging-sdk"

interface BridgeFormProps {
  defaultProtocol: BridgeProtocol
}

export function BridgeForm({ defaultProtocol }: BridgeFormProps) {
  const { address } = useAccount()
  const { sdk, loading: sdkLoading } = useBridgingSDK()
  
  const [fromChain, setFromChain] = useState<ChainId>(42220) // Celo
  const [toChain, setToChain] = useState<ChainId>(1) // Ethereum
  const [amount, setAmount] = useState("")
  const [recipient, setRecipient] = useState("")
  const [isBridging, setIsBridging] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Get user G$ token balance (not native chain balance)
  const { data: rawBalance } = useReadContract({
    address: SUPPORTED_CHAINS[fromChain].tokenAddress,
    abi: [{
      name: "balanceOf",
      type: "function",
      stateMutability: "view",
      inputs: [{ name: "account", type: "address" }],
      outputs: [{ name: "", type: "uint256" }],
    }] as const,
    functionName: "balanceOf",
    args: address ? [address] : undefined,
    chainId: fromChain,
    query: { enabled: !!address },
  })

  const decimals = SUPPORTED_CHAINS[fromChain].decimals
  const balance = rawBalance != null
    ? { formatted: formatUnits(rawBalance as bigint, decimals), value: rawBalance as bigint }
    : undefined

  // Get fee estimate
  const { fee, loading: feeLoading } = useBridgeFee(
    fromChain,
    toChain,
    defaultProtocol
  )

  // Set recipient to connected address if not set
  useEffect(() => {
    if (address && !recipient) {
      setRecipient(address)
    }
  }, [address, recipient])

  const handleBridge = async () => {
    if (!sdk || !address) return

    try {
      setIsBridging(true)
      setError(null)

      const decimals = SUPPORTED_CHAINS[fromChain].decimals
      const amountInWei = parseAmount(amount, decimals)

      if (amountInWei <= 0n) {
        throw new Error("Amount must be greater than 0")
      }

      const canBridgeResult = await sdk.canBridge(address, amountInWei, toChain)
      if (!canBridgeResult.isWithinLimit) {
        throw new Error(canBridgeResult.error || "Bridge limit exceeded")
      }

      await sdk.bridgeTo(
        recipient as `0x${string}`,
        toChain,
        amountInWei,
        defaultProtocol,
        fee?.amount
      )

      setAmount("")
    } catch (err) {
      setError(err instanceof Error ? err.message : "Bridge failed")
    } finally {
      setIsBridging(false)
    }
  }

  const handleMaxAmount = () => {
    if (balance) {
      setAmount(balance.formatted)
    }
  }

  const handleSwapChains = () => {
    setFromChain(toChain)
    setToChain(fromChain)
  }

  const getEstimatedReceive = () => {
    if (!amount) return "0.00"
    const val = parseFloat(amount)
    // Simple estimation: subtract 0.1% protocol fee + hypothetical network fee
    const estimate = val * 0.999 - (fee ? 0.01 : 0) 
    return Math.max(0, estimate).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })
  }

  return (
    <div className="space-y-8">
      {/* Chain Selection Row */}
      <div className="flex flex-col md:flex-row items-center gap-4 relative">
        <div className="flex-1 w-full">
          <label className="block text-slate-400 text-sm font-semibold mb-3 ml-1">From</label>
          <div className="premium-card !p-4 !bg-slate-50 flex items-center justify-between cursor-pointer hover:!bg-slate-100 transition-colors">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-yellow-400 flex items-center justify-center font-bold text-white shadow-sm">
                {SUPPORTED_CHAINS[fromChain].name[0]}
              </div>
              <div>
                <span className="font-bold text-slate-900">G$ {SUPPORTED_CHAINS[fromChain].name}</span>
              </div>
            </div>
            <select 
              value={fromChain} 
              onChange={(e) => setFromChain(Number(e.target.value) as ChainId)}
              className="absolute inset-0 opacity-0 cursor-pointer"
            >
              {Object.entries(SUPPORTED_CHAINS).map(([id, chain]) => (
                <option key={id} value={id}>{chain.name}</option>
              ))}
            </select>
            <svg className="w-5 h-5 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
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
            <span className="text-slate-400 font-semibold">Balance: {balance?.formatted || "0.00"} G$</span>
          </div>
          <div className="relative group">
            <div className="absolute left-5 top-1/2 -translate-y-1/2 flex items-center gap-3 pointer-events-none">
              <button 
                onClick={(e) => { e.stopPropagation(); handleMaxAmount(); }}
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

          {/* Fee Estimate Display */}
          {amount && (
            <div className="mt-3 px-1">
              {feeLoading ? (
                <div className="flex items-center gap-2 text-slate-400 text-sm">
                  <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  Estimating bridge fee...
                </div>
              ) : fee ? (
                <div className="flex items-center justify-between text-sm">
                  <span className="text-slate-500 font-medium">Estimated bridge fee:</span>
                  <span className="text-slate-700 font-semibold">
                    {parseFloat(fee.formatted.split(" ")[0]).toFixed(6)} {SUPPORTED_CHAINS[fromChain].name}
                  </span>
                </div>
              ) : null}
            </div>
          )}
        </div>

        <div>
          <div className="flex justify-between mb-3 px-1">
            <label className="text-slate-900 font-bold text-lg">You will receive on {SUPPORTED_CHAINS[toChain].name.toUpperCase()}</label>
            <span className="text-slate-400 font-semibold">Balance: 0.00 G$</span>
          </div>
          <div className="relative">
            <input
              type="text"
              readOnly
              value={`${getEstimatedReceive()} G$`}
              className="w-full bg-slate-50 border border-slate-100 rounded-2xl py-6 px-6 text-2xl font-bold text-slate-900 outline-none"
            />
          </div>
        </div>
      </div>

      {/* Action Button */}
      <button
        onClick={handleBridge}
        disabled={!amount || isBridging || sdkLoading}
        className="premium-button w-full text-xl py-5"
      >
        {isBridging ? (
          <span className="flex items-center justify-center gap-3">
            <svg className="animate-spin h-6 w-6 text-white" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
            </svg>
            Bridging...
          </span>
        ) : (
          `Bridge to ${SUPPORTED_CHAINS[toChain].name}`
        )}
      </button>

      {/* Details Footnote */}
      <div className="pt-4 border-t border-slate-100 text-center space-y-2">
        <p className="text-slate-500 font-medium">Protocol Fee: 0.10% of bridged G$ amount</p>
        <p className="text-slate-500 font-medium">Provider: {BRIDGE_PROTOCOLS[defaultProtocol]}</p>
        {fee && (
          <p className="text-slate-400 text-sm italic">
            Bridge fee (pre-execution): {parseFloat(fee.formatted.split(" ")[0]).toFixed(10)} {SUPPORTED_CHAINS[fromChain].name}
          </p>
        )}
      </div>

      {/* Error Display */}
      {error && (
        <div className="bg-red-50 text-red-600 p-4 rounded-2xl font-medium text-center border border-red-100">
          {error}
        </div>
      )}
    </div>
  )
}