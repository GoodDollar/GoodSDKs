import React, { useState } from "react"
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
    useCreateStream,
    useUpdateStream,
    useDeleteStream,
    useStreamList,
    useGDAPools,
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
    type GDAPool,
    type SUPReserveLocker,
    type TokenSymbol,
} from "@goodsdks/streaming-sdk"
import { parseEther, type Address } from "viem"

const tamaguiConfig = createTamagui(tamaguiConfigBase)

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
const SectionCard: React.FC<React.PropsWithChildren<{ gap?: string | number; bg?: string; title?: string; borderColor?: string; flex?: number }>> = ({
    children,
    gap = "$3",
    bg = "white",
    title,
    borderColor = "#E2E8F0",
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
        {title && (
            <Text fontSize={18} fontWeight="bold" marginBottom="$2" color="$blue11">
                {title}
            </Text>
        )}
        {children}
    </YStack>
)

const OperationSection: React.FC<{
    title: string
    buttonText: string
    buttonColor: string
    isLoading: boolean
    onAction: (receiver: string, amount: string) => void
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
    showAmount = true,
    timeUnit,
    setTimeUnit,
    disabled,
}) => {
        const [receiver, setReceiver] = useState("")
        const [amount, setAmount] = useState("10")

        return (
            <SectionCard title={title}>
                <Input
                    placeholder="Receiver 0x..."
                    value={receiver}
                    onChangeText={setReceiver}
                    borderColor="#CBD5E0"
                    bg="white"
                />
                {showAmount && (
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
}> = ({ streams, isLoading, onRefresh }) => (
    <SectionCard title="Active Streams">
        <XStack justifyContent="flex-end">
            <Button size="$2" onPress={onRefresh} chromeless>Refresh</Button>
        </XStack>
        {isLoading ? <Spinner /> : (streams && streams.length > 0) ? (
            <YStack gap="$2">
                {streams.map((s, i) => (
                    <YStack key={i} padding="$3" backgroundColor="#F7FAFC" borderRadius="$3" gap="$1" borderWidth={1} borderColor="#E2E8F0">
                        <XStack justifyContent="space-between">
                            <Text fontSize={12} color="$gray10" fontWeight="600">To:</Text>
                            <Text fontSize={12} fontFamily="$mono" color="$blue11">{s.receiver?.slice(0, 10)}...{s.receiver?.slice(-6)}</Text>
                        </XStack>
                        <XStack justifyContent="space-between">
                            <Text fontSize={12} color="$gray10" fontWeight="600">Flow Rate:</Text>
                            <Text fontSize={12} fontWeight="bold" color="$green10">{formatFlowRate(s.flowRate, "month")}</Text>
                        </XStack>
                    </YStack>
                ))}
            </YStack>
        ) : <Text color="$gray10" textAlign="center" padding="$4">No active streams found</Text>}
    </SectionCard>
)

const GDAPoolsSection: React.FC<{
    pools: GDAPool[]
    isLoading: boolean
    poolAddress: string
    setPoolAddress: (addr: string) => void
    onConnect: () => void
    onDisconnect: () => void
    isConnecting: boolean
    isDisconnecting: boolean
}> = ({ pools, isLoading, poolAddress, setPoolAddress, onConnect, onDisconnect, isConnecting, isDisconnecting }) => (
    <SectionCard title="Distribution Pools (GDA)">
        <YStack gap="$2">
            <XStack gap="$2">
                <Button flex={1} backgroundColor="$green10" color="white" onPress={onConnect} disabled={isConnecting} hoverStyle={{ opacity: 0.8 }}>
                    {isConnecting ? <Spinner color="white" /> : "Connect"}
                </Button>
                <Button flex={1} backgroundColor="$red10" color="white" onPress={onDisconnect} disabled={isDisconnecting} hoverStyle={{ opacity: 0.8 }}>
                    {isDisconnecting ? <Spinner color="white" /> : "Disconnect"}
                </Button>
            </XStack>
            {isLoading ? <Spinner /> : (pools && pools.length > 0) ? (
                <YStack gap="$2">
                    {pools.slice(0, 5).map((p, i) => (
                        <YStack
                            key={i}
                            padding="$3"
                            backgroundColor="#F7FAFC"
                            borderRadius="$3"
                            onPress={() => setPoolAddress(p.id)}
                            hoverStyle={{ backgroundColor: "#EDF2F7" }}
                            cursor="pointer"
                            borderWidth={poolAddress === p.id ? 1 : 0}
                            borderColor="$blue10"
                            gap="$1"
                        >
                            <Text fontSize={12} fontWeight="bold" color="$blue11">{p.id.slice(0, 10)}... Admin: {p.admin?.slice(0, 6)}</Text>
                            <Text fontSize={11} color="$gray9">Current Flow Rate: <Text color="$green10" fontWeight="600">{formatFlowRate(p.flowRate, "month")}</Text></Text>
                        </YStack>
                    ))}
                </YStack>
            ) : <Text color="$gray10" textAlign="center" padding="$4">No pools found</Text>}
        </YStack>
    </SectionCard>
)

// Main App
export default function App() {
    const { address, isConnected } = useAccount()
    const publicClient = usePublicClient()
    const { switchChain } = useSwitchChain()

    const [environment, setEnvironment] = useState<Environment>("production")
    const [selectedToken, setSelectedToken] = useState<TokenSymbol>("G$")
    const [poolAddress, setPoolAddress] = useState("")
    const [timeUnit, setTimeUnit] = useState<"month" | "day" | "hour">("month")
    const apiKey = import.meta.env.VITE_GRAPH_API_KEY || ""

    const { mutate: createStream, isLoading: isCreating } = useCreateStream()
    const { mutate: updateStream, isLoading: isUpdating } = useUpdateStream()
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
        enabled: !!address,
    }) as { data: StreamInfo[] | undefined, isLoading: boolean, refetch: () => void }

    const { data: pools, isLoading: poolsLoading } = useGDAPools({
        environment,
        enabled: !!address,
    }) as { data: GDAPool[] | undefined, isLoading: boolean }

    const { data: supReserves, isLoading: supLoading } = useSupReserves({
        apiKey,
        enabled: isConnected && environment === "production",
    })

    const chainId = publicClient?.chain?.id

    // Resolves address for display
    const RESOLVED_TOKEN_ADDR = chainId
        ? (selectedToken === "G$" ? getG$Token(chainId, environment) : getSUPToken(chainId, environment))
        : undefined

    const handleCreateStream = (receiver: string, amount: string) => {
        if (!receiver || !amount) return alert("Please fill in all fields")
        const flowRate = calculateFlowRate(parseEther(amount), timeUnit)
        runMutationWithAlerts(createStream, {
            receiver: receiver as Address,
            environment,
            flowRate,
            token: selectedToken
        }, {
            onSuccess: () => refetchStreams(),
            successMessage: "Stream created!"
        })
    }

    const handleUpdateStream = (receiver: string, amount: string) => {
        if (!receiver || !amount) return alert("Please fill in all fields")
        const newFlowRate = calculateFlowRate(parseEther(amount), timeUnit)
        runMutationWithAlerts(updateStream, {
            receiver: receiver as Address,
            environment,
            newFlowRate,
            token: selectedToken
        }, {
            onSuccess: () => refetchStreams(),
            successMessage: "Stream updated!"
        })
    }

    const handleDeleteStream = (receiver: string) => {
        if (!receiver) return alert("Please provide receiver address")
        runMutationWithAlerts(deleteStream, {
            receiver: receiver as Address,
            environment,
            token: selectedToken
        }, {
            onSuccess: () => refetchStreams(),
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
                <YStack maxWidth={800} width="100%" alignSelf="center" gap="$4" paddingBottom="$10">

                    <XStack justifyContent="space-between" ai="center">
                        <Text fontSize={28} fontWeight="bold" color="$blue11">Streaming SDK</Text>
                        <appkit-button />
                    </XStack>

                    {/* Network and Environment selection */}
                    <XStack gap="$4" $sm={{ fd: "column" }}>
                        <SectionCard bg="white" gap="$2" title="NETWORK" flex={1}>
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

                        <SectionCard bg="white" gap="$2" title="TOKEN & ENVIRONMENT" flex={1}>
                            <XStack backgroundColor="#EDF2F7" borderRadius="$2" padding="$1" gap="$1" mb="$2">
                                {(["G$", "SUP"] as const).map(tk => (
                                    <Button
                                        key={tk}
                                        size="$2"
                                        flex={1}
                                        backgroundColor={selectedToken === tk ? "white" : "transparent"}
                                        color={selectedToken === tk ? "$blue10" : "$gray11"}
                                        borderWidth={0}
                                        elevation={selectedToken === tk ? 2 : 0}
                                        onPress={() => setSelectedToken(tk)}
                                        disabled={tk === "G$" && chainId === SupportedChains.BASE} // G$ not on Base yet
                                        opacity={tk === "G$" && chainId === SupportedChains.BASE ? 0.3 : 1}
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
                                    >
                                        {env.charAt(0).toUpperCase() + env.slice(1)}
                                    </Button>
                                ))}
                            </XStack>
                            <Text fontSize={11} color="$gray10" mt="$2">
                                Current {selectedToken}: <Text fontWeight="bold" color="$blue10">{RESOLVED_TOKEN_ADDR ? `${RESOLVED_TOKEN_ADDR.slice(0, 10)}...` : "Not available"}</Text>
                            </Text>
                        </SectionCard>
                    </XStack>

                    {chainId === SupportedChains.BASE && (
                        <SectionCard bg="$orange2" borderColor="$orange8">
                            <Text fontSize={14} color="$orange10" fontWeight="bold">
                                Base Network Mode (SUP Only)
                            </Text>
                            <Text fontSize={12} color="$orange10">
                                Streaming and GDA Pools are not yet configured for G$ on Base. This view is filtered to show **SUP Reserves** only.
                            </Text>
                        </SectionCard>
                    )}

                    {/* SDK Operations - Only on Celo */}
                    {chainId !== SupportedChains.BASE && (
                        <YStack gap="$4">
                            <XStack gap="$4" $sm={{ fd: "column" }}>
                                <View flex={1}>
                                    <OperationSection
                                        title="Create Stream"
                                        buttonText="Create Stream"
                                        buttonColor="$blue10"
                                        isLoading={isCreating}
                                        onAction={handleCreateStream}
                                        timeUnit={timeUnit}
                                        setTimeUnit={setTimeUnit}
                                        disabled={!RESOLVED_TOKEN_ADDR}
                                    />
                                </View>
                                <View flex={1}>
                                    <OperationSection
                                        title="Update Stream"
                                        buttonText="Update Stream"
                                        buttonColor="$orange10"
                                        isLoading={isUpdating}
                                        onAction={handleUpdateStream}
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
                    <XStack gap="$4" $sm={{ fd: "column" }}>
                        {chainId !== SupportedChains.BASE && (
                            <>
                                <View flex={1}>
                                    <ActiveStreamsList streams={streams || []} isLoading={streamsLoading} onRefresh={() => refetchStreams()} />
                                </View>
                                <View flex={1}>
                                    <GDAPoolsSection
                                        pools={pools || []}
                                        isLoading={poolsLoading}
                                        poolAddress={poolAddress}
                                        setPoolAddress={setPoolAddress}
                                        onConnect={() => runMutationWithAlerts(connectToPool, { poolAddress: poolAddress as Address }, { successMessage: "Connected!" })}
                                        onDisconnect={() => runMutationWithAlerts(disconnectFromPool, { poolAddress: poolAddress as Address }, { successMessage: "Disconnected!" })}
                                        isConnecting={isConnecting}
                                        isDisconnecting={isDisconnecting}
                                    />
                                </View>
                            </>
                        )}
                    </XStack>

                    {chainId === SupportedChains.BASE && (
                        <SectionCard title="SUP Reserve Holdings">
                            <XStack ai="center" gap="$2" mb="$2">
                                <Text fontSize={12} color="$orange10" fontWeight="600">(Only on Base mainnet)</Text>
                            </XStack>
                            {supLoading ? <Spinner /> : (supReserves && supReserves.length > 0) ? (
                                <YStack gap="$2">
                                    {supReserves.slice(0, 5).map((l: SUPReserveLocker, i: number) => (
                                        <XStack key={i} padding="$3" backgroundColor="#F7FAFC" borderRadius="$3" justifyContent="space-between" ai="center" borderWidth={1} borderColor="#E2E8F0">
                                            <YStack>
                                                <Text fontSize={12} fontWeight="bold" color="$blue11">Locker: {l.id?.slice(0, 10)}...</Text>
                                                <Text fontSize={10} color="$gray9">Owner: {l.lockerOwner?.slice(0, 10)}...</Text>
                                            </YStack>
                                            <Text fontSize={10} color="$gray10">ID: {i + 1}</Text>
                                        </XStack>
                                    ))}
                                </YStack>
                            ) : (
                                <View p="$4" ai="center" bg="#F7FAFC" br="$3">
                                    <Text color="$gray10" textAlign="center">No SUP lockers found or unsupported chain</Text>
                                </View>
                            )}
                        </SectionCard>
                    )}
                </YStack>
            </ScrollView>
        </TamaguiProvider>
    )
}
