import { useState, useEffect, useMemo, useRef } from "react"
import { useAccount, useChainId, useSwitchChain, useWalletClient } from "wagmi"
import {
  parseUnits,
  formatUnits,
  isAddress,
  zeroAddress,
  type Address,
} from "viem"
import {
  BridgingSDK,
  SUPPORTED_CHAINS,
  BRIDGE_PROTOCOLS,
} from "@goodsdks/bridging-sdk"
import { publicClients, bridgingOptions } from "../config"
import type {
  BridgeProtocol,
  ChainId,
  BridgeConfig,
  BridgeQuoteResult,
  BridgeStatus,
} from "@goodsdks/bridging-sdk"

interface BridgeFormProps {
  defaultProtocol: BridgeProtocol
  onBusyChange: (busy: boolean) => void
}

export function BridgeForm({ defaultProtocol, onBusyChange }: BridgeFormProps) {
  const { address, isConnected, connector } = useAccount()
  const { data: walletClient } = useWalletClient()
  const walletChainId = useChainId() as ChainId
  const { switchChain, error: switchError } = useSwitchChain()
  // A replaced client invalidates preflight even if its account and chain match.
  const walletContext = useMemo(
    () => ({ walletClient, connector, address, isConnected, walletChainId }),
    [walletClient, connector, address, isConnected, walletChainId],
  )
  const activeWalletContext = useRef(walletContext)
  activeWalletContext.current = walletContext

  const [previewChain, setPreviewChain] = useState<ChainId>(42220)
  const fromChain =
    isConnected && SUPPORTED_CHAINS[walletChainId]
      ? walletChainId
      : previewChain
  const sender = address ?? zeroAddress
  const sdk = useMemo(
    () =>
      new BridgingSDK(
        publicClients[fromChain],
        isConnected && walletClient?.chain?.id === fromChain
          ? (walletClient as unknown as ConstructorParameters<
              typeof BridgingSDK
            >[1])
          : undefined,
        fromChain,
        publicClients,
        bridgingOptions,
      ),
    [fromChain, isConnected, walletClient],
  )
  const [toChain, setToChain] = useState<ChainId>(() => {
    return (
      (Object.keys(SUPPORTED_CHAINS)
        .map(Number)
        .find((id) => id !== fromChain) as ChainId) ?? 1
    )
  })

  const [amount, setAmount] = useState("1000")
  const [debouncedAmount, setDebouncedAmount] = useState(amount)
  const [recipient, setRecipient] = useState("")
  const [bridgeStatus, setBridgeStatus] = useState<BridgeStatus | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const submittingRef = useRef(false)
  const [refreshCount, setRefreshCount] = useState(0)
  const isBusy =
    submitting ||
    bridgeStatus?.step === "approving" ||
    bridgeStatus?.step === "bridging"
  const route = useMemo(
    () => ({
      fromChain,
      toChain,
      protocol: defaultProtocol,
    }),
    [fromChain, toChain, defaultProtocol],
  )
  const routeKey = `${fromChain}:${toChain}:${defaultProtocol}:${sender}`
  const quoteKey = `${routeKey}:${amount}:${recipient || sender}:${refreshCount}`
  const currentQuoteKey = useRef(quoteKey)
  currentQuoteKey.current = quoteKey

  useEffect(() => {
    onBusyChange(isBusy)
    return () => onBusyChange(false)
  }, [isBusy, onBusyChange])

  useEffect(() => {
    if (amount && !submittingRef.current) setBridgeStatus(null)
  }, [amount, routeKey, isConnected, walletChainId, connector?.uid])

  // Debounce amount input
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedAmount(amount)
    }, 300)
    return () => clearTimeout(timer)
  }, [amount])

  // Base config: balances, allowance, fees, limits
  const [configState, setConfigState] = useState<{
    key: string
    data: BridgeConfig
  } | null>(null)
  const configKey = `${routeKey}:${refreshCount}`
  const config = configState?.key === configKey ? configState.data : null
  const [configLoading, setConfigLoading] = useState(false)
  const [configError, setConfigError] = useState<string | null>(null)

  // Quote: validation result for the current amount/route
  const [quoteState, setQuoteState] = useState<{
    key: string
    data: BridgeQuoteResult
  } | null>(null)
  const quoteResult = quoteState?.key === quoteKey ? quoteState.data : null
  const [quoteLoading, setQuoteLoading] = useState(false)
  const [quoteError, setQuoteError] = useState<string | null>(null)

  // Reset toChain when wallet switches to it
  useEffect(() => {
    if (toChain === fromChain) {
      const fallback =
        (Object.keys(SUPPORTED_CHAINS)
          .map(Number)
          .find((id) => id !== fromChain) as ChainId) ?? 1
      setToChain(fallback)
    }
  }, [fromChain, toChain])

  // Route changes and explicit refreshes reload configuration, never amount changes.
  useEffect(() => {
    let cancelled = false
    const load = async () => {
      setConfigLoading(true)
      setConfigError(null)
      setConfigState(null)
      setQuoteState(null)
      setQuoteError(null)
      try {
        const data = await sdk.getBridgeConfig(sender, route, { refresh: true })
        if (!cancelled) setConfigState({ key: configKey, data })
      } catch (err) {
        if (!cancelled)
          setConfigError(
            err instanceof Error ? err.message : "Configuration unavailable",
          )
      } finally {
        if (!cancelled) setConfigLoading(false)
      }
    }
    void load()
    return () => {
      cancelled = true
    }
  }, [sdk, sender, route, configKey])

  const decimals = SUPPORTED_CHAINS[fromChain].decimals
  const parsedAmount = useMemo(() => {
    if (!amount) return { value: null, error: null }
    try {
      if (
        !/^\d+(\.\d*)?$/.test(amount) ||
        (amount.split(".")[1]?.length ?? 0) > decimals
      ) {
        throw new Error(
          `Enter a positive amount with at most ${decimals} decimal places.`,
        )
      }
      const value = parseUnits(amount, decimals)
      if (value <= 0n) throw new Error("Enter an amount greater than zero.")
      return { value, error: null }
    } catch (err) {
      return {
        value: null,
        error: err instanceof Error ? err.message : "Invalid amount",
      }
    }
  }, [amount, decimals])
  const recipientError =
    recipient && !isAddress(recipient)
      ? "Enter a valid recipient address."
      : null

  // Every amount update still runs the SDK's live validation checks.
  useEffect(() => {
    setQuoteState(null)
    setQuoteError(null)
    setQuoteLoading(false)
    if (
      !config ||
      parsedAmount.value === null ||
      amount !== debouncedAmount ||
      recipientError ||
      submitting
    ) {
      return
    }
    let cancelled = false
    const run = async () => {
      setQuoteLoading(true)
      try {
        const data = await sdk.getQuote({
          amount: parsedAmount.value!,
          ...route,
          sender,
          recipient: (recipient || sender) as Address,
        })
        if (!cancelled) {
          setQuoteState({ key: quoteKey, data })
          if (!data.quote)
            setQuoteError(
              data.requirements.map((r) => r.message).join("; ") ||
                "Quote unavailable",
            )
        }
      } catch (err) {
        if (!cancelled)
          setQuoteError(
            err instanceof Error ? err.message : "Quote unavailable",
          )
      } finally {
        if (!cancelled) setQuoteLoading(false)
      }
    }

    void run()
    return () => {
      cancelled = true
    }
  }, [
    sdk,
    sender,
    config,
    amount,
    debouncedAmount,
    parsedAmount,
    recipient,
    recipientError,
    route,
    quoteKey,
    submitting,
  ])

  const handleBridge = async () => {
    if (
      !canSubmit ||
      !walletClient ||
      submittingRef.current ||
      parsedAmount.value === null
    )
      return
    const submittedKey = quoteKey
    const submittedWallet = walletContext
    submittingRef.current = true
    setSubmitting(true)
    setBridgeStatus(null)
    try {
      const data = await sdk.getQuote({
        sender,
        recipient: (recipient || sender) as Address,
        amount: parsedAmount.value,
        ...route,
        refresh: true,
      })
      if (
        currentQuoteKey.current !== submittedKey ||
        activeWalletContext.current !== submittedWallet
      )
        throw new Error("Wallet or form changed; review a new quote.")
      setQuoteState({ key: submittedKey, data })
      if (!data.canBridge || !data.quote) {
        if (!data.quote) {
          setConfigState(null)
          setConfigError(
            data.requirements.map((r) => r.message).join("; ") ||
              "Configuration unavailable",
          )
        }
        throw new Error(
          data.requirements.map((r) => r.message).join("; ") || "Cannot bridge",
        )
      }
      const refreshedConfig = await sdk.getBridgeConfig(sender, route)
      if (
        currentQuoteKey.current !== submittedKey ||
        activeWalletContext.current !== submittedWallet
      )
        throw new Error("Wallet or form changed; review a new quote.")
      setConfigState({ key: configKey, data: refreshedConfig })
      if (
        (await walletClient.getChainId()) !== fromChain ||
        (await walletClient.getAddresses())[0]?.toLowerCase() !==
          sender.toLowerCase() ||
        currentQuoteKey.current !== submittedKey ||
        activeWalletContext.current !== submittedWallet
      ) {
        throw new Error("Wallet changed; review a new quote.")
      }
      await sdk.doBridge(data.quote, (status) => {
        setBridgeStatus(status)
      })
      setAmount("")
      setRefreshCount((count) => count + 1)
    } catch (err) {
      setBridgeStatus({
        step: "failed",
        error: err instanceof Error ? err.message : "Bridge failed",
      })
    } finally {
      submittingRef.current = false
      setSubmitting(false)
    }
  }

  const handleSwapChains = () => {
    if (isBusy) return
    if (isConnected) switchChain({ chainId: toChain })
    else {
      setPreviewChain(toChain)
      setToChain(fromChain)
    }
  }

  const handleMaxAmount = () => {
    if (!config) return
    setAmount(formatUnits(config.tokenBalance, decimals))
  }

  // Derived display values
  const tokenBalanceFormatted = config
    ? formatUnits(config.tokenBalance, decimals)
    : "Unavailable"

  const blockingRequirements =
    quoteResult?.requirements.filter(
      (r) => r.type !== "insufficient_allowance",
    ) ?? []
  const needsApproval = quoteResult?.needsApproval ?? false
  const canSubmit = Boolean(
    isConnected &&
      address &&
      walletClient &&
      walletChainId === fromChain &&
      walletClient.chain?.id === fromChain &&
      quoteResult?.quote &&
      quoteResult.canBridge &&
      !configLoading &&
      !quoteLoading &&
      !configError &&
      !quoteError &&
      !parsedAmount.error &&
      !recipientError &&
      !isBusy,
  )
  const destinationDecimals = SUPPORTED_CHAINS[toChain].decimals
  const displayedQuote = quoteResult?.quote
  const waitingForAmount = amount !== debouncedAmount

  return (
    <div className="space-y-8">
      {!isConnected && (
        <p className="text-slate-500" role="status">
          Read-only preview uses an empty address. No wallet or transaction is
          required; sending is disabled.
        </p>
      )}
      {isConnected && !SUPPORTED_CHAINS[walletChainId] && (
        <p role="alert">
          Unsupported wallet network. Switch to a supported source network
          before sending.
        </p>
      )}
      {switchError && <p role="alert">{switchError.message}</p>}
      {/* Chain Selection Row */}
      <div className="flex flex-col md:flex-row items-center gap-4 relative">
        <div className="flex-1 w-full">
          <label
            htmlFor="source-chain"
            className="block text-slate-400 text-sm font-semibold mb-3 ml-1"
          >
            Source network {isConnected ? "(wallet)" : "(preview)"}
          </label>
          <div className="premium-card !p-4 !bg-slate-50 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-yellow-400 flex items-center justify-center font-bold text-white shadow-sm">
                {SUPPORTED_CHAINS[fromChain].name[0]}
              </div>
              <div>
                <select
                  id="source-chain"
                  value={fromChain}
                  disabled={isBusy}
                  onChange={(e) => {
                    const chainId = Number(e.target.value)
                    if (isConnected) switchChain({ chainId })
                    else setPreviewChain(chainId)
                  }}
                  className="font-bold text-slate-900"
                >
                  {Object.entries(SUPPORTED_CHAINS).map(([id, chain]) => (
                    <option key={id} value={id}>
                      {chain.name} ({id})
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>
        </div>

        <button
          onClick={handleSwapChains}
          disabled={isBusy}
          aria-label="Swap source and destination networks"
          className="w-12 h-12 rounded-2xl bg-white border border-slate-100 shadow-md flex items-center justify-center hover:bg-slate-50 transition-all z-10 active:scale-95 mt-8"
        >
          <svg
            className="w-6 h-6 text-blue-600"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4"
            />
          </svg>
        </button>

        <div className="flex-1 w-full">
          <label
            htmlFor="destination-chain"
            className="block text-slate-400 text-sm font-semibold mb-3 ml-1"
          >
            Destination network
          </label>
          <div className="premium-card !p-4 !bg-slate-50 flex items-center justify-between cursor-pointer hover:!bg-slate-100 transition-colors">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-slate-800 flex items-center justify-center font-bold text-white shadow-sm">
                {SUPPORTED_CHAINS[toChain].name[0]}
              </div>
              <div>
                <select
                  id="destination-chain"
                  value={toChain}
                  disabled={isBusy}
                  onChange={(e) =>
                    setToChain(Number(e.target.value) as ChainId)
                  }
                  className="font-bold text-slate-900"
                >
                  {Object.entries(SUPPORTED_CHAINS)
                    .filter(([id]) => Number(id) !== fromChain)
                    .map(([id, chain]) => (
                      <option key={id} value={id}>
                        {chain.name} ({id})
                      </option>
                    ))}
                </select>
              </div>
            </div>
            <svg
              className="w-5 h-5 text-slate-400"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M19 9l-7 7-7-7"
              />
            </svg>
          </div>
        </div>
      </div>

      {/* Amount Input Section */}
      <div className="space-y-6">
        <div>
          <div className="flex justify-between mb-3 px-1">
            <label
              htmlFor="bridge-amount"
              className="text-slate-900 font-bold text-lg"
            >
              Amount to send ({SUPPORTED_CHAINS[fromChain].name})
            </label>
            <span className="text-slate-400 font-semibold">
              G$ balance: {configLoading ? "Loading..." : tokenBalanceFormatted}
            </span>
          </div>
          <div className="relative group">
            <div className="absolute left-5 top-1/2 -translate-y-1/2 flex items-center gap-3 pointer-events-none">
              <button
                onClick={(e) => {
                  e.stopPropagation()
                  handleMaxAmount()
                }}
                disabled={isBusy || !config}
                className="bg-blue-50 text-blue-600 text-xs font-bold px-3 py-1.5 rounded-lg border border-blue-100 flex items-center justify-center hover:bg-blue-100 transition-colors pointer-events-auto"
              >
                Max
              </button>
              <div className="h-6 w-px bg-slate-200"></div>
              <span className="text-slate-900 font-bold text-2xl">G$</span>
            </div>
            <input
              id="bridge-amount"
              type="text"
              inputMode="decimal"
              value={amount}
              disabled={isBusy}
              onChange={(e) => setAmount(e.target.value)}
              className="w-full bg-slate-50 border border-slate-100 rounded-2xl py-6 pl-32 pr-6 text-2xl font-bold text-slate-900 focus:bg-white focus:border-blue-500 transition-all outline-none"
              placeholder="1000"
            />
          </div>
        </div>

        <div>
          <div className="flex justify-between mb-3 px-1">
            <label
              htmlFor="bridge-recipient"
              className="text-slate-900 font-bold text-lg"
            >
              Recipient Address
            </label>
            <span className="text-slate-400 font-medium text-sm">Optional</span>
          </div>
          <div className="relative group">
            <input
              type="text"
              id="bridge-recipient"
              value={recipient}
              disabled={isBusy}
              onChange={(e) => setRecipient(e.target.value)}
              placeholder={address || "0x..."}
              className="w-full bg-slate-50 border border-slate-100 rounded-2xl py-4 px-6 font-mono text-sm text-slate-900 focus:bg-white focus:border-blue-500 transition-all outline-none"
            />
            {!recipient && address && (
              <div className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-300 text-xs font-bold tracking-wider pointer-events-none uppercase">
                Defaults to self
              </div>
            )}
          </div>
        </div>

        <div className="mt-3 px-1 space-y-3" aria-live="polite">
          <button
            onClick={() => setRefreshCount((count) => count + 1)}
            disabled={isBusy || configLoading || quoteLoading}
            className="premium-button-secondary"
          >
            Refresh quote
          </button>
          {configLoading && <p role="status">Loading route configuration...</p>}
          {(quoteLoading || waitingForAmount) && !configLoading && (
            <p role="status">Updating quote...</p>
          )}
          {configError && (
            <p role="alert" className="text-red-600">
              Configuration unavailable: {configError}. Use Refresh quote to
              retry.
            </p>
          )}
          {quoteError && (
            <p role="alert" className="text-red-600">
              Quote unavailable: {quoteError}. Use Refresh quote to retry.
            </p>
          )}
          {parsedAmount.error && (
            <p role="alert" className="text-red-600">
              {parsedAmount.error}
            </p>
          )}
          {recipientError && (
            <p role="alert" className="text-red-600">
              {recipientError}
            </p>
          )}
          <dl className="space-y-2">
            <div>
              <dt>
                G$ protocol fee rate — destination{" "}
                {SUPPORTED_CHAINS[toChain].name}
              </dt>
              <dd>
                {config?.protocolFeeBps != null
                  ? `${formatUnits(config.protocolFeeBps, 2)}%`
                  : "Unavailable"}
              </dd>
            </div>
            <div>
              <dt>
                G$ protocol fee — deducted on {SUPPORTED_CHAINS[toChain].name}
              </dt>
              <dd>
                {displayedQuote
                  ? `${formatUnits(displayedQuote.protocolFee, destinationDecimals)} G$`
                  : "Unavailable"}
              </dd>
            </div>
            <div>
              <dt>
                Expected amount received — {SUPPORTED_CHAINS[toChain].name}
              </dt>
              <dd>
                {displayedQuote
                  ? `${formatUnits(displayedQuote.amountReceived, destinationDecimals)} G$`
                  : "Unavailable"}
              </dd>
            </div>
            <div>
              <dt>
                Native network/provider fee — {SUPPORTED_CHAINS[fromChain].name}{" "}
                (separate payment)
              </dt>
              <dd>
                {displayedQuote
                  ? `${formatUnits(displayedQuote.fee, SUPPORTED_CHAINS[fromChain].nativeCurrency.decimals)} ${SUPPORTED_CHAINS[fromChain].nativeCurrency.symbol}`
                  : "Unavailable"}
              </dd>
            </div>
          </dl>
          <p className="text-slate-500 text-sm">
            The G$ fee is deducted from the transfer, not added to the required
            G$ balance. Native fee excludes the source transaction's gas.
          </p>
          <h3 className="font-bold">
            Configured bridge limits — {SUPPORTED_CHAINS[fromChain].name}{" "}
            (source network)
          </h3>
          {config?.routeLimits ? (
            <dl className="space-y-2">
              <div>
                <dt>Minimum amount</dt>
                <dd>{formatUnits(config.routeLimits.minAmount, 18)} G$</dd>
              </div>
              <div>
                <dt>Per-transaction limit</dt>
                <dd>{formatUnits(config.routeLimits.txLimit, 18)} G$</dd>
              </div>
              <div>
                <dt>Daily bridge limit</dt>
                <dd>{formatUnits(config.routeLimits.dailyLimit, 18)} G$</dd>
              </div>
              <div>
                <dt>Daily account limit</dt>
                <dd>
                  {formatUnits(config.routeLimits.accountDailyLimit, 18)} G$
                </dd>
              </div>
              <div>
                <dt>Whitelisted accounts only</dt>
                <dd>{config.routeLimits.onlyWhitelisted ? "Yes" : "No"}</dd>
              </div>
            </dl>
          ) : (
            <p>Limits unavailable.</p>
          )}
          <p className="text-slate-500 text-sm">
            Configured G$ limits use normalized 18-decimal units. These are not
            remaining daily capacity or a dynamic maximum.
          </p>
        </div>
      </div>

      {/* Requirements — non-approval blocking issues */}
      {blockingRequirements.length > 0 && (
        <div className="space-y-2">
          {blockingRequirements.map((req, i) => (
            <div
              key={i}
              className="bg-red-50 text-red-600 p-3 rounded-xl font-medium text-sm border border-red-100"
            >
              {req.message}
            </div>
          ))}
        </div>
      )}

      {/* Approval notice */}
      {needsApproval && blockingRequirements.length === 0 && (
        <div className="bg-blue-50 text-blue-700 p-3 rounded-xl font-medium text-sm border border-blue-100">
          Token approval required — doBridge will handle it automatically before
          bridging.
        </div>
      )}

      {/* Bridge status feedback */}
      {bridgeStatus && (
        <div
          className={`p-4 rounded-2xl font-medium text-center border ${
            bridgeStatus.step === "completed"
              ? "bg-emerald-50 text-emerald-700 border-emerald-100"
              : bridgeStatus.step === "failed"
                ? "bg-red-50 text-red-600 border-red-100"
                : "bg-blue-50 text-blue-700 border-blue-100"
          }`}
        >
          {bridgeStatus.step === "approving" && "Approving G$ spending..."}
          {bridgeStatus.step === "bridging" &&
            "Submitting bridge transaction..."}
          {bridgeStatus.step === "completed" &&
            "Source transaction confirmed. Destination delivery must be tracked separately in Recent Transactions."}
          {bridgeStatus.step === "failed" &&
            (bridgeStatus.error || "Transaction failed")}
        </div>
      )}

      {/* Bridge button */}
      <button
        onClick={handleBridge}
        disabled={!canSubmit}
        className="premium-button w-full text-xl py-5"
      >
        {isBusy ? (
          <span className="flex items-center justify-center gap-3">
            <svg
              className="animate-spin h-6 w-6 text-white"
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
            {submitting && !bridgeStatus
              ? "Refreshing before submission..."
              : bridgeStatus?.step === "approving"
                ? "Approving..."
                : "Bridging..."}
          </span>
        ) : needsApproval ? (
          `Approve & Bridge to ${SUPPORTED_CHAINS[toChain].name}`
        ) : (
          `Bridge to ${SUPPORTED_CHAINS[toChain].name}`
        )}
      </button>

      {/* Details Footnote */}
      <div className="pt-4 border-t border-slate-100 text-center space-y-2">
        <p className="text-slate-500 font-medium">
          Previewing a quote never requests an approval, signature or bridge
          transaction.
        </p>
        <p className="text-slate-500 font-medium">
          Provider: {BRIDGE_PROTOCOLS[defaultProtocol]}
        </p>
      </div>
    </div>
  )
}
