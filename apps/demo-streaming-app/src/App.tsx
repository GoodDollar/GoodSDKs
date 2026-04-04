import React, { useEffect, useRef, useState } from "react"
import {
    View,
    Text,
    YStack,
    XStack,
    Button,
    ScrollView,
    Separator,
    Spinner,
    Input,
    TamaguiProvider,
    createTamagui,
} from "tamagui"
import { config as tamaguiConfigBase } from "@tamagui/config/v3"
import { useAccount, usePublicClient, useSwitchChain } from "wagmi"
import {
    useDeleteStream,
    useSetStream,
    useStreamList,
    useSuperTokenBalance,
    useBalanceHistory,
    usePoolMemberships,
    useSupReserves,
    useConnectToPool,
    useDisconnectFromPool,
} from "@goodsdks/react-hooks"
import {
    calculateFlowRate,
    formatFlowRate,
    getG$Token,
    getSUPToken,
    SupportedChains,
    type Environment,
    type StreamInfo,
    type PoolMembership,
    type SUPReserveLocker,
    type TokenSymbol,
} from "@goodsdks/streaming-sdk"
import { formatEther, parseEther, type Address } from "viem"

const tamaguiConfig = createTamagui(tamaguiConfigBase)
const DEFAULT_HISTORY_WINDOW_SECONDS = 30 * 24 * 60 * 60

function getBalanceHistoryWindow() {
    const toTimestamp = Date.now()
    return {
        fromTimestamp: toTimestamp - (DEFAULT_HISTORY_WINDOW_SECONDS * 1000),
        toTimestamp,
    }
}

function formatTokenAmount(amount: bigint): string {
    const formatted = formatEther(amount)
    const [integer, fraction] = formatted.split(".")
    if (!fraction) return formatted
    return `${integer}.${fraction.slice(0, 4)}`
}

// mutation wrapper with error/success alerts
function runMutationWithAlerts<TArgs>(
    mutate: (
        args: TArgs,
        options?: { onSuccess?: (data: unknown) => void; onError?: (error: unknown) => void }
    ) => void,
    args: TArgs,
    { onSuccess, successMessage }: { onSuccess?: (hash: string) => void; successMessage?: string } = {}
) {
    try {
        mutate(args, {
            onSuccess: (data: unknown) => {
                const hash = data as string
                if (successMessage) {
                    alert(`${successMessage} Transaction: ${hash}`)
                }
                onSuccess?.(hash)
            },
            onError: (error: unknown) => {
                const err = error as Error
                console.error(err)
                alert(`Error: ${err.message}`)
            },
        })
    } catch (error) {
        const err = error as Error
        console.error(err)
        alert(`Error: ${err.message}`)
    }
}

// UI Components
const SectionCard: React.FC<React.PropsWithChildren<{
    gap?: string | number
    bg?: string
    title?: string
    subtitle?: string
    headerAction?: React.ReactNode
    borderColor?: string
    flex?: number
    contentMinHeight?: number
}>> = ({
    children,
    gap = "$3",
    bg = "white",
    title,
    subtitle,
    headerAction,
    borderColor = "#E2E8F0",
    contentMinHeight,
}) => (
    <YStack
        padding="$4"
        backgroundColor={bg}
        borderRadius="$4"
        borderWidth={1}
        borderColor={borderColor}
        gap={gap}
        elevation={2}
        shadowColor="rgba(0,0,0,0.05)"
        shadowOffset={{ width: 0, height: 2 }}
        shadowRadius={4}
    >
        {(title || headerAction) && (
            <XStack justifyContent="space-between" alignItems="flex-start" gap="$3">
                <YStack flex={1} gap="$1">
                    {title ? (
                        <Text fontSize={18} fontWeight="bold" color="$blue11">
                            {title}
                        </Text>
                    ) : null}
                    {subtitle ? (
                        <Text fontSize={11} color="$gray10" lineHeight={16}>
                            {subtitle}
                        </Text>
                    ) : null}
                </YStack>
                {headerAction ? headerAction : null}
            </XStack>
        )}
        <YStack gap={gap} minHeight={contentMinHeight}>
            {children}
        </YStack>
    </YStack>
)

const InlineActionButton: React.FC<{
    label: string
    onPress: () => void
}> = ({ label, onPress }) => (
    <Button
        size="$2"
        chromeless
        color="$blue10"
        fontWeight="600"
        onPress={onPress}
        paddingHorizontal="$1"
    >
        {label}
    </Button>
)

const CenteredCardState: React.FC<React.PropsWithChildren<{ minHeight?: number }>> = ({
    children,
    minHeight = 140,
}) => (
    <YStack
        minHeight={minHeight}
        justifyContent="center"
        alignItems="center"
        paddingVertical="$4"
        paddingHorizontal="$3"
    >
        {children}
    </YStack>
)

const OperationSection: React.FC<{
    title: string
    buttonText: string
    buttonColor: string
    isLoading: boolean
    onAction: (receiver: string, amount: string) => void
    description?: string
    showAmount?: boolean
    timeUnit?: "hour" | "day" | "month"
    setTimeUnit?: (unit: "hour" | "day" | "month") => void
    disabled?: boolean
}> = ({
    title,
    buttonText,
    buttonColor,
    isLoading,
    onAction,
    description,
    showAmount = true,
    timeUnit,
    setTimeUnit,
    disabled,
}) => {
        const [receiver, setReceiver] = useState("")
        const [amount, setAmount] = useState("10")

        return (
            <SectionCard title={title} subtitle={description}>
                <Input
                    placeholder="Receiver 0x..."
                    value={receiver}
                    onChangeText={setReceiver}
                    borderColor="#CBD5E0"
                    bg="white"
                />
                {showAmount && (
                    <YStack gap="$2">
                        <XStack gap="$2" alignItems="center">
                            <Input
                                flex={1}
                                placeholder="Amount"
                                value={amount}
                                onChangeText={setAmount}
                                borderColor="#CBD5E0"
                                bg="white"
                            />
                            {setTimeUnit && (
                                <XStack backgroundColor="#EDF2F7" borderRadius="$3" padding="$1">
                                    {(["hour", "day", "month"] as const).map(unit => (
                                        <Button
                                            key={unit}
                                            size="$2"
                                            onPress={() => setTimeUnit(unit)}
                                            backgroundColor={timeUnit === unit ? "$blue10" : "transparent"}
                                            color={timeUnit === unit ? "white" : "$gray11"}
                                            borderWidth={0}
                                            hoverStyle={{ backgroundColor: timeUnit === unit ? "$blue10" : "$gray3" }}
                                        >
                                            {unit}
                                        </Button>
                                    ))}
                                </XStack>
                            )}
                        </XStack>
                        <Text fontSize={11} color="$gray10">
                            Amount sets a streaming rate for the selected time unit. It does not transfer that full amount immediately.
                        </Text>
                    </YStack>
                )}
                <Button
                    onPress={() => onAction(receiver, amount)}
                    backgroundColor={buttonColor}
                    color="white"
                    disabled={isLoading || disabled}
                    opacity={disabled ? 0.5 : 1}
                    icon={isLoading ? <Spinner size="small" color="white" /> : undefined}
                    hoverStyle={{ opacity: 0.8 }}
                >
                    {isLoading ? "Processing..." : buttonText}
                </Button>
            </SectionCard>
        )
    }

const ActiveStreamsList: React.FC<{
    streams: StreamInfo[]
    isLoading: boolean
    onRefresh: () => void
    account?: Address
}> = ({ streams, isLoading, onRefresh, account }) => (
    <SectionCard
        title="Active Streams"
        subtitle="Shows current indexed stream state for this wallet, not one-time transfer history."
        headerAction={<InlineActionButton label="Refresh" onPress={onRefresh} />}
        contentMinHeight={196}
    >
        {isLoading ? <Spinner /> : (streams && streams.length > 0) ? (
            <YStack gap="$2">
                {streams.map((s, i) => {
                    const isOutgoing = account ? s.sender?.toLowerCase() === account.toLowerCase() : true
                    const counterpartyLabel = isOutgoing ? "To:" : "From:"
                    const counterparty = isOutgoing ? s.receiver : s.sender

                    return (
                    <YStack key={i} padding="$3" backgroundColor="#F7FAFC" borderRadius="$3" gap="$1" borderWidth={1} borderColor="#E2E8F0">
                        <XStack justifyContent="space-between">
                            <Text fontSize={12} color="$gray10" fontWeight="600">{counterpartyLabel}</Text>
                            <Text fontSize={12} fontFamily="$mono" color="$blue11">{counterparty?.slice(0, 10)}...{counterparty?.slice(-6)}</Text>
                        </XStack>
                        <XStack justifyContent="space-between">
                            <Text fontSize={12} color="$gray10" fontWeight="600">Current Rate:</Text>
                            <Text fontSize={12} fontWeight="bold" color="$green10">{formatFlowRate(s.flowRate, "month")}</Text>
                        </XStack>
                        <XStack justifyContent="space-between">
                            <Text fontSize={12} color="$gray10" fontWeight="600">Indexed Streamed:</Text>
                            <Text fontSize={12} fontWeight="600" color="$blue11">
                                {formatTokenAmount(s.streamedSoFar ?? 0n)}
                            </Text>
                        </XStack>
                        <XStack justifyContent="space-between">
                            <Text fontSize={12} color="$gray10" fontWeight="600">Started:</Text>
                            <Text fontSize={11} color="$gray10">
                                {new Date(Number(s.timestamp) * 1000).toLocaleString()}
                            </Text>
                        </XStack>
                    </YStack>
                )})}
            </YStack>
        ) : (
            <CenteredCardState>
                <Text color="$gray10" textAlign="center">
                    No active streams found
                </Text>
            </CenteredCardState>
        )}
    </SectionCard>
)

const CompactBalanceSummary: React.FC<{
    balance?: bigint
    isLoading: boolean
    symbol: TokenSymbol
    onRefresh: () => void
}> = ({ balance, isLoading, symbol, onRefresh }) => (
    <YStack
        marginTop="$2"
        padding="$3"
        backgroundColor="#F7FAFC"
        borderRadius="$3"
        borderWidth={1}
        borderColor="#E2E8F0"
        gap="$2"
    >
        <XStack justifyContent="space-between" alignItems="flex-start" gap="$2">
            <YStack gap="$1">
                <Text fontSize={12} fontWeight="700" color="$blue11">
                    {symbol} Balance
                </Text>
                <Text fontSize={11} color="$gray10">
                    Current indexed snapshot
                </Text>
            </YStack>
            <InlineActionButton label="Refresh" onPress={onRefresh} />
        </XStack>
        {isLoading ? (
            <XStack minHeight={52} alignItems="center">
                <Spinner size="small" />
            </XStack>
        ) : (
            <YStack gap="$1">
                <Text fontSize={26} fontWeight="bold" color="$blue11" lineHeight={30}>
                    {formatTokenAmount(balance ?? 0n)}
                </Text>
                <Text fontSize={11} color="$gray10">
                    Selected token balance
                </Text>
                <Text fontSize={10} color="$gray9">
                    Updates follow subgraph indexing, so changes may appear a few seconds after a stream update.
                </Text>
            </YStack>
        )}
    </YStack>
)

const BalanceHistorySection: React.FC<{
    history: { balance: bigint; updatedAtTimestamp: number; token: Address }[]
    isLoading: boolean
    onRefresh: () => void
    symbol: TokenSymbol
}> = ({ history, isLoading, onRefresh, symbol }) => (
    <SectionCard
        title={`Recent ${symbol} Balance Snapshots`}
        subtitle="Indexed balance snapshot logs from the last 30 days. This is not a transaction feed."
        headerAction={<InlineActionButton label="Refresh" onPress={onRefresh} />}
        contentMinHeight={156}
    >
        {isLoading ? (
            <CenteredCardState minHeight={120}>
                <Spinner />
            </CenteredCardState>
        ) : history.length > 0 ? (
                <YStack gap="$2">
                    {history.map((entry, index) => (
                        <YStack
                            key={`${entry.token}-${entry.updatedAtTimestamp}-${index}`}
                        padding="$3"
                        backgroundColor="#F7FAFC"
                        borderRadius="$3"
                        borderWidth={1}
                        borderColor="#E2E8F0"
                        gap="$1"
                    >
                        <XStack justifyContent="space-between">
                            <Text fontSize={12} color="$gray10" fontWeight="600">Balance</Text>
                            <Text fontSize={12} fontWeight="bold" color="$blue11">
                                {formatTokenAmount(entry.balance)}
                            </Text>
                        </XStack>
                        <Text fontSize={11} color="$gray10">
                            {new Date(entry.updatedAtTimestamp * 1000).toLocaleString()}
                        </Text>
                    </YStack>
                ))}
            </YStack>
        ) : (
            <CenteredCardState>
                <Text color="$gray10" textAlign="center">
                    No indexed balance snapshots found yet
                </Text>
                <Text color="$gray9" textAlign="center" fontSize={11} maxWidth={360}>
                    Stream transactions can exist even when this stays empty, because it only shows subgraph balance snapshot logs.
                </Text>
            </CenteredCardState>
        )}
    </SectionCard>
)

const GDAMembershipsSection: React.FC<{
    memberships: PoolMembership[]
    isLoading: boolean
    onConnect: (pool: Address) => void
    onDisconnect: (pool: Address) => void
    isConnecting: boolean
    isDisconnecting: boolean
}> = ({ memberships, isLoading, onConnect, onDisconnect, isConnecting, isDisconnecting }) => (
    <SectionCard
        title="My GDA Pool Memberships"
        subtitle="Member-scoped pool status and claimed amounts from the subgraph."
        contentMinHeight={196}
    >
        {isLoading ? <Spinner /> : (memberships && memberships.length > 0) ? (
            <YStack gap="$2">
                {memberships.map((membership, i) => (
                    <YStack
                        key={`${membership.pool}-${i}`}
                        padding="$3"
                        backgroundColor="#F7FAFC"
                        borderRadius="$3"
                        borderWidth={1}
                        borderColor="#E2E8F0"
                        gap="$2"
                    >
                        <XStack justifyContent="space-between" ai="center">
                            <Text fontSize={12} fontWeight="bold" color="$blue11">
                                {membership.pool.slice(0, 10)}...{membership.pool.slice(-6)}
                            </Text>
                            <View
                                paddingHorizontal="$2"
                                paddingVertical="$1"
                                borderRadius="$2"
                                backgroundColor={membership.isConnected ? "$green4" : "$gray3"}
                            >
                                <Text fontSize={10} color={membership.isConnected ? "$green10" : "$gray10"}>
                                    {membership.isConnected ? "Connected" : "Disconnected"}
                                </Text>
                            </View>
                        </XStack>

                        <XStack justifyContent="space-between">
                            <Text fontSize={11} color="$gray10">
                                Units: <Text fontWeight="600" color="$gray12">{membership.units.toString()}</Text>
                            </Text>
                            <Text fontSize={11} color="$gray10">
                                Claimed: <Text fontWeight="600" color="$gray12">{formatTokenAmount(membership.totalAmountClaimed)}</Text>
                            </Text>
                        </XStack>

                        <Button
                            backgroundColor={membership.isConnected ? "$red10" : "$green10"}
                            color="white"
                            onPress={() => (membership.isConnected ? onDisconnect(membership.pool) : onConnect(membership.pool))}
                            disabled={isConnecting || isDisconnecting}
                            hoverStyle={{ opacity: 0.8 }}
                        >
                            {membership.isConnected ? "Disconnect" : "Connect"}
                        </Button>
                    </YStack>
                ))}
            </YStack>
        ) : (
            <CenteredCardState>
                <Text color="$gray10" textAlign="center">
                    No GDA pool memberships found
                </Text>
            </CenteredCardState>
        )}
    </SectionCard>
)

// Main App
export default function App() {
    const { address, isConnected } = useAccount()
    const publicClient = usePublicClient()
    const { switchChain } = useSwitchChain()
    const chainId = publicClient?.chain?.id

    const [environment, setEnvironment] = useState<Environment>("production")
    const [selectedToken, setSelectedToken] = useState<TokenSymbol>("G$")
    const [timeUnit, setTimeUnit] = useState<"month" | "day" | "hour">("month")
    const apiKey = import.meta.env.VITE_GRAPH_API_KEY || ""
    const hasGraphApiKey = !!apiKey
    const RESOLVED_TOKEN_ADDR = chainId
        ? (selectedToken === "G$" ? getG$Token(chainId, environment) : getSUPToken(chainId, environment))
        : undefined

    const { mutate: setStream, isLoading: isSettingStream } = useSetStream()
    const { mutate: deleteStream, isLoading: isDeleting } = useDeleteStream()
    const { mutate: connectToPool, isLoading: isConnecting } = useConnectToPool()
    const { mutate: disconnectFromPool, isLoading: isDisconnecting } = useDisconnectFromPool()

    const {
        data: streams,
        isLoading: streamsLoading,
        refetch: refetchStreams,
    } = useStreamList({
        account: address as Address,
        environment,
        first: 10,
        skip: 0,
        enabled: !!address,
    })

    const {
        data: selectedTokenBalance,
        isLoading: balanceLoading,
        refetch: refetchBalance,
    } = useSuperTokenBalance({
        account: address as Address,
        token: selectedToken,
        environment,
        enabled: !!address && !!RESOLVED_TOKEN_ADDR,
    })
    const [balanceHistoryWindow, setBalanceHistoryWindow] = useState(getBalanceHistoryWindow)

    const {
        data: balanceHistory,
        isLoading: balanceHistoryLoading,
        refetch: refetchBalanceHistory,
    } = useBalanceHistory({
        account: address as Address,
        token: selectedToken,
        fromTimestamp: balanceHistoryWindow.fromTimestamp,
        toTimestamp: balanceHistoryWindow.toTimestamp,
        environment,
        first: 8,
        skip: 0,
        enabled: !!address && !!RESOLVED_TOKEN_ADDR,
    })

    const { data: memberships, isLoading: membershipsLoading } = usePoolMemberships({
        account: address as Address,
        enabled: !!address && chainId !== SupportedChains.BASE,
    })

    const { data: supReserves, isLoading: supLoading } = useSupReserves({
        account: address,
        apiKey,
        enabled: isConnected && environment === "production" && hasGraphApiKey,
    })

    const recentBalanceHistory = [...(balanceHistory ?? [])]
        .sort((left, right) => right.updatedAtTimestamp - left.updatedAtTimestamp)
        .slice(0, 6)

    // Keep UI state consistent with network capabilities
    useEffect(() => {
        if (chainId === SupportedChains.BASE) {
            if (selectedToken !== "SUP") setSelectedToken("SUP")
            if (environment !== "production") setEnvironment("production")
        }
        if (chainId === SupportedChains.CELO) {
            if (selectedToken !== "G$") setSelectedToken("G$")
        }
    }, [chainId, environment, selectedToken])

    // Demo-only: make missing Graph key obvious in the console too (helps reviewers/devs)
    const missingGraphKeyLoggedRef = useRef(false)
    useEffect(() => {
        if (missingGraphKeyLoggedRef.current) return
        if (typeof window === "undefined") return
        const sessionKey = "demo-streaming-app:missing-graph-api-key-logged"
        if (window.sessionStorage.getItem(sessionKey)) {
            missingGraphKeyLoggedRef.current = true
            return
        }
        const shouldLog =
            chainId === SupportedChains.BASE &&
            isConnected &&
            environment === "production" &&
            !hasGraphApiKey
        if (!shouldLog) return

        window.sessionStorage.setItem(sessionKey, "1")
        missingGraphKeyLoggedRef.current = true
        console.warn(
            "[demo-streaming-app] SUP reserves use The Graph Gateway and require `VITE_GRAPH_API_KEY`. " +
            "Add it to `apps/demo-streaming-app/.env`, restart `yarn dev`, then refresh."
        )
    }, [chainId, isConnected, environment, hasGraphApiKey])

    const refetchIndexedViews = () => {
        refetchStreams()
        refetchBalance()
        setBalanceHistoryWindow(getBalanceHistoryWindow())
    }

    const refreshAfterStreamMutation = () => {
        refetchIndexedViews()
        if (typeof window !== "undefined") {
            window.setTimeout(() => {
                refetchIndexedViews()
            }, 6000)
        }
    }

    const handleSetStream = (receiver: string, amount: string) => {
        if (!receiver || !amount) return alert("Please fill in all fields")
        const flowRate = calculateFlowRate(parseEther(amount), timeUnit)
        runMutationWithAlerts(setStream, {
            receiver: receiver as Address,
            environment,
            flowRate,
            token: selectedToken
        }, {
            onSuccess: () => refreshAfterStreamMutation(),
            successMessage: "Stream created or updated!"
        })
    }

    const handleDeleteStream = (receiver: string) => {
        if (!receiver) return alert("Please provide receiver address")
        runMutationWithAlerts(deleteStream, {
            receiver: receiver as Address,
            environment,
            token: selectedToken
        }, {
            onSuccess: () => refreshAfterStreamMutation(),
            successMessage: "Stream deleted!"
        })
    }

    if (!isConnected) {
        return (
            <TamaguiProvider config={tamaguiConfig}>
                <View f={1} bc="#F7FAFC" jc="center" ai="center" p="$4">
                    <YStack gap="$4" ai="center" p="$8" bg="white" br="$4" elevation={5} maw={400} w="100%">
                        <Text fOW="bold" fS={24} color="$blue11">Streaming SDK Demo</Text>
                        <Text fS={16} ta="center" color="$gray10">
                            Connect your wallet to start streaming GoodDollar (G$) on Celo or Base.
                        </Text>
                        <appkit-button />
                    </YStack>
                </View>
            </TamaguiProvider>
        )
    }

    return (
        <TamaguiProvider config={tamaguiConfig}>
            <ScrollView flex={1} padding="$4" backgroundColor="#F7FAFC">
                <YStack maxWidth={920} width="100%" alignSelf="center" gap="$4" paddingBottom="$10">

                    <XStack justifyContent="space-between" ai="center">
                        <Text fontSize={28} fontWeight="bold" color="$blue11">Streaming SDK</Text>
                        <appkit-button />
                    </XStack>

                    {/* Network and Environment selection */}
                    <XStack gap="$4" alignItems="stretch" $sm={{ fd: "column" }}>
                        <View flex={0.85}>
                            <SectionCard bg="white" gap="$2" title="NETWORK">
                                <Text fontSize={14} color="$blue10" fontWeight="bold">
                                    {publicClient?.chain?.name || "Unknown"} ({chainId})
                                </Text>
                                <XStack backgroundColor="#EDF2F7" borderRadius="$2" padding="$1" gap="$1" flexWrap="wrap">
                                    {[
                                        { id: SupportedChains.CELO, name: "Celo" },
                                        { id: SupportedChains.BASE, name: "Base" },
                                    ].map(c => (
                                        <Button
                                            key={c.id}
                                            size="$2"
                                            backgroundColor={chainId === c.id ? "white" : "transparent"}
                                            color={chainId === c.id ? "$blue10" : "$gray11"}
                                            borderWidth={0}
                                            elevation={chainId === c.id ? 2 : 0}
                                            onPress={() => switchChain?.({ chainId: c.id })}
                                        >
                                            {c.name}
                                        </Button>
                                    ))}
                                </XStack>
                            </SectionCard>
                        </View>

                        <View flex={1.75}>
                            <SectionCard bg="white" gap="$2" title="TOKEN & ENVIRONMENT">
                                <XStack backgroundColor="#EDF2F7" borderRadius="$2" padding="$1" gap="$1" mb="$2">
                                    {(["G$", "SUP"] as const).map(tk => (
                                        // Token availability is chain-dependent: G$ on Celo, SUP on Base
                                        // Keep UI explicit to avoid "Not available" confusion.
                                        <Button
                                            key={tk}
                                            size="$2"
                                            flex={1}
                                            backgroundColor={selectedToken === tk ? "white" : "transparent"}
                                            color={selectedToken === tk ? "$blue10" : "$gray11"}
                                            borderWidth={0}
                                            elevation={selectedToken === tk ? 2 : 0}
                                            onPress={() => setSelectedToken(tk)}
                                            disabled={
                                                (tk === "G$" && chainId === SupportedChains.BASE) ||
                                                (tk === "SUP" && chainId === SupportedChains.CELO)
                                            }
                                            opacity={
                                                (tk === "G$" && chainId === SupportedChains.BASE) ||
                                                    (tk === "SUP" && chainId === SupportedChains.CELO)
                                                    ? 0.3
                                                    : 1
                                            }
                                        >
                                            {tk}
                                        </Button>
                                    ))}
                                </XStack>
                                <XStack backgroundColor="#EDF2F7" borderRadius="$2" padding="$1" gap="$1">
                                    {(["production", "staging", "development"] as const).map(env => (
                                        <Button
                                            key={env}
                                            size="$2"
                                            flex={1}
                                            backgroundColor={environment === env ? "white" : "transparent"}
                                            color={environment === env ? "$blue10" : "$gray11"}
                                            borderWidth={0}
                                            elevation={environment === env ? 2 : 0}
                                            onPress={() => setEnvironment(env)}
                                            disabled={chainId === SupportedChains.BASE && env !== "production"}
                                            opacity={chainId === SupportedChains.BASE && env !== "production" ? 0.4 : 1}
                                        >
                                            {env.charAt(0).toUpperCase() + env.slice(1)}
                                        </Button>
                                    ))}
                                </XStack>
                                <Text fontSize={11} color="$gray10" mt="$2">
                                    Current {selectedToken}: <Text fontWeight="bold" color="$blue10">{RESOLVED_TOKEN_ADDR ? `${RESOLVED_TOKEN_ADDR.slice(0, 10)}...` : "Not available"}</Text>
                                </Text>
                                <CompactBalanceSummary
                                    balance={selectedTokenBalance}
                                    isLoading={balanceLoading}
                                    symbol={selectedToken}
                                    onRefresh={() => {
                                        refetchBalance()
                                        refetchBalanceHistory()
                                    }}
                                />
                            </SectionCard>
                        </View>
                    </XStack>

                    {chainId === SupportedChains.BASE && (
                        <SectionCard bg="$orange2" borderColor="$orange8">
                            <Text fontSize={14} color="$orange10" fontWeight="bold">
                                Base Network Mode (SUP Only)
                            </Text>
                            <Text fontSize={12} color="$orange10">
                                This Base demo focuses on SUP balances, history, and reserve holdings. Stream write actions and GDA pool controls remain Celo-only here.
                            </Text>
                        </SectionCard>
                    )}

                    {/* SDK Operations - Only on Celo */}
                    {chainId !== SupportedChains.BASE && (
                        <YStack gap="$4">
                            <XStack gap="$4" $sm={{ fd: "column" }}>
                                <View flex={1}>
                                    <OperationSection
                                        title="Set Stream"
                                        buttonText="Create / Update Stream"
                                        buttonColor="$blue10"
                                        isLoading={isSettingStream}
                                        onAction={handleSetStream}
                                        description="Uses Superfluid's recommended setFlowrate path. The same sender + receiver + token updates an existing stream; use a different receiver to create a separate stream."
                                        timeUnit={timeUnit}
                                        setTimeUnit={setTimeUnit}
                                        disabled={!RESOLVED_TOKEN_ADDR}
                                    />
                                </View>
                            </XStack>

                            <OperationSection
                                title="Delete Stream"
                                buttonText="Delete Stream"
                                buttonColor="$red10"
                                isLoading={isDeleting}
                                onAction={(r) => handleDeleteStream(r)}
                                showAmount={false}
                                disabled={!RESOLVED_TOKEN_ADDR}
                            />
                        </YStack>
                    )}

                    <Separator marginVertical="$2" />

                    {/* Data Displays */}
                    {chainId !== SupportedChains.BASE && (
                        <YStack gap="$4">
                            <XStack gap="$4" $sm={{ fd: "column" }}>
                                <View flex={1}>
                                    <ActiveStreamsList
                                        streams={streams || []}
                                        isLoading={streamsLoading}
                                        onRefresh={() => refetchStreams()}
                                        account={address}
                                    />
                                </View>
                                <View flex={1}>
                                    <BalanceHistorySection
                                        history={recentBalanceHistory}
                                        isLoading={balanceHistoryLoading}
                                        onRefresh={() => {
                                            refetchBalance()
                                            setBalanceHistoryWindow(getBalanceHistoryWindow())
                                        }}
                                        symbol={selectedToken}
                                    />
                                </View>
                            </XStack>

                            <GDAMembershipsSection
                                memberships={memberships || []}
                                isLoading={membershipsLoading}
                                onConnect={(pool) =>
                                    runMutationWithAlerts(
                                        connectToPool,
                                        { poolAddress: pool },
                                        { successMessage: "Connected!" }
                                    )
                                }
                                onDisconnect={(pool) =>
                                    runMutationWithAlerts(
                                        disconnectFromPool,
                                        { poolAddress: pool },
                                        { successMessage: "Disconnected!" }
                                    )
                                }
                                isConnecting={isConnecting}
                                isDisconnecting={isDisconnecting}
                            />
                        </YStack>
                    )}

                    {chainId === SupportedChains.BASE && (
                        <SectionCard title="SUP Reserve Holdings">
                            <XStack ai="center" gap="$2" mb="$2">
                                <Text fontSize={12} color="$orange10" fontWeight="600">(Only on Base mainnet)</Text>
                            </XStack>
                            {!hasGraphApiKey ? (
                                <View p="$4" ai="center" bg="#F7FAFC" br="$3">
                                    <Text color="$gray10" textAlign="center">
                                        To view SUP reserves, add `VITE_GRAPH_API_KEY` (The Graph Gateway) to your `.env` and restart `yarn dev`.
                                    </Text>
                                </View>
                            ) : supLoading ? <Spinner /> : (supReserves && supReserves.length > 0) ? (
                                <YStack gap="$2">
                                    {supReserves.slice(0, 5).map((l: SUPReserveLocker, i: number) => (
                                        <XStack key={i} padding="$3" backgroundColor="#F7FAFC" borderRadius="$3" justifyContent="space-between" ai="center" borderWidth={1} borderColor="#E2E8F0">
                                            <YStack>
                                                <Text fontSize={12} fontWeight="bold" color="$blue11">Reserve: {l.id?.slice(0, 10)}...</Text>
                                                <Text fontSize={10} color="$gray9">Owner: {l.lockerOwner?.slice(0, 10)}...</Text>
                                            </YStack>
                                            <Text fontSize={10} color="$gray10">ID: {i + 1}</Text>
                                        </XStack>
                                    ))}
                                </YStack>
                            ) : (
                                <View p="$4" ai="center" bg="#F7FAFC" br="$3">
                                    <Text color="$gray10" textAlign="center">No SUP reserves found</Text>
                                </View>
                            )}
                        </SectionCard>
                    )}

                    {chainId === SupportedChains.BASE && (
                        <BalanceHistorySection
                            history={recentBalanceHistory}
                            isLoading={balanceHistoryLoading}
                            onRefresh={() => {
                                refetchBalance()
                                setBalanceHistoryWindow(getBalanceHistoryWindow())
                            }}
                            symbol={selectedToken}
                        />
                    )}
                </YStack>
            </ScrollView>
        </TamaguiProvider>
    )
}
