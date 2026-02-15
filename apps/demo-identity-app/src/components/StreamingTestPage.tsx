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
} from "tamagui"
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
    SupportedChains,
    type Environment,
    type StreamInfo,
    type GDAPool,
    type SUPReserveLocker,
} from "@goodsdks/streaming-sdk"
import { parseEther, type Address } from "viem"

/**
 * Sub-components
 */
const SectionCard: React.FC<React.PropsWithChildren<{ gap?: string | number; bg?: string; title?: string }>> = ({
    children,
    gap = "$3",
    bg = "white",
    title,
}) => (
    <YStack
        padding="$4"
        backgroundColor={bg}
        borderRadius="$4"
        borderWidth={1}
        borderColor="#E2E8F0"
        gap={gap}
    >
        {title && (
            <Text fontSize={18} fontWeight="bold" marginBottom="$2">
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
    timeUnit?: string
    setTimeUnit?: (unit: "hour" | "day" | "month") => void
}> = ({
    title,
    buttonText,
    buttonColor,
    isLoading,
    onAction,
    showAmount = true,
    timeUnit,
    setTimeUnit,
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
                />
                {showAmount && (
                    <XStack gap="$2">
                        <Input
                            flex={1}
                            placeholder="Amount"
                            value={amount}
                            onChangeText={setAmount}
                            borderColor="#CBD5E0"
                        />
                        {setTimeUnit && (
                            <XStack gap="$2">
                                {(["hour", "day", "month"] as const).map(unit => (
                                    <Button
                                        key={unit}
                                        size="$3"
                                        onPress={() => setTimeUnit(unit)}
                                        backgroundColor={timeUnit === unit ? "$blue10" : "$gray4"}
                                        color={timeUnit === unit ? "white" : "$gray11"}
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
                    disabled={isLoading}
                    icon={isLoading ? <Spinner /> : undefined}
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
            <Button size="$2" onPress={onRefresh}>Refresh</Button>
        </XStack>
        {isLoading ? <Spinner /> : (streams && streams.length > 0) ? (
            <YStack gap="$2">
                {streams.map((s, i) => (
                    <YStack key={i} padding="$3" backgroundColor="#F7FAFC" borderRadius="$3" gap="$1">
                        <XStack justifyContent="space-between">
                            <Text fontSize={12} fontWeight="600">To:</Text>
                            <Text fontSize={12}>{s.receiver?.slice(0, 10)}...</Text>
                        </XStack>
                        <XStack justifyContent="space-between">
                            <Text fontSize={12} fontWeight="600">Flow Rate:</Text>
                            <Text fontSize={12}>{formatFlowRate(s.flowRate, "month")}</Text>
                        </XStack>
                    </YStack>
                ))}
            </YStack>
        ) : <Text color="$gray10" textAlign="center">No active streams found</Text>}
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
                <Button flex={1} backgroundColor="$green10" color="white" onPress={onConnect} disabled={isConnecting}>
                    {isConnecting ? <Spinner /> : "Connect"}
                </Button>
                <Button flex={1} backgroundColor="$red10" color="white" onPress={onDisconnect} disabled={isDisconnecting}>
                    {isDisconnecting ? <Spinner /> : "Disconnect"}
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
                        >
                            <Text fontSize={12} fontWeight="bold">{p.id.slice(0, 10)}... Admin: {p.admin?.slice(0, 6)}</Text>
                            <Text fontSize={11} color="$gray9">Flow Rate: {formatFlowRate(p.flowRate, "month")}</Text>
                        </YStack>
                    ))}
                </YStack>
            ) : <Text color="$gray10" textAlign="center">No pools found</Text>}
        </YStack>
    </SectionCard>
)

/**
 * Mutation Helper for Transactions
 */
function runMutationWithAlerts<TArgs>(
    mutate: (args: TArgs, options?: { onSuccess?: (data: unknown) => void; onError?: (error: unknown) => void }) => void,
    args: TArgs,
    { onSuccess, successMessage }: { onSuccess?: (hash: string) => void; successMessage?: string } = {},
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

export const StreamingTestPage: React.FC = () => {
    const { address, isConnected } = useAccount()
    const publicClient = usePublicClient()
    const { switchChain } = useSwitchChain()

    const [environment, setEnvironment] = useState<"production" | "staging" | "development">("production")
    const [poolAddress, setPoolAddress] = useState("")
    const [timeUnit, setTimeUnit] = useState<"month" | "day" | "hour">("month")
    const apiKey = import.meta.env.VITE_GRAPH_API_KEY

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

    const G$_TOKEN = chainId ? getG$Token(chainId, environment) : undefined

    const handleAction = (
        receiver: string,
        amount: string,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        mutation: (args: UseCreateStreamParams | UseUpdateStreamParams | UseDeleteStreamParams, options?: any) => void,
        msg: string
    ) => {
        if (!receiver || (!amount && msg !== "Stream deleted!")) return alert("Please fill in all fields")
        if (!G$_TOKEN) return alert('G$ token not configured for this chain/environment')
        const flowRate = amount ? calculateFlowRate(parseEther(amount), timeUnit) : undefined

        const args: UseCreateStreamParams & UseUpdateStreamParams & UseDeleteStreamParams = {
            receiver: receiver as Address,
            token: G$_TOKEN as Address,
            environment,
        }
        if (msg === "Stream created!") args.flowRate = flowRate
        if (msg === "Stream updated!") args.newFlowRate = flowRate

        runMutationWithAlerts(mutation, args, {
            onSuccess: () => {
                refetchStreams()
            },
            successMessage: msg
        })
    }

    if (!isConnected) {
        return (
            <View padding="$4" alignItems="center">
                <Text fontSize={18} color="$red10">Please connect your wallet to test the Streaming SDK</Text>
                <appkit-button></appkit-button>
            </View>
        )
    }

    return (
        <ScrollView flex={1} padding="$4" backgroundColor="#F7FAFC">
            <YStack maxWidth={800} width="100%" alignSelf="center" gap="$4">
                {/* Header Info */}
                <XStack gap="$4">
                    <SectionCard bg="white" gap="$1" title="NETWORK">
                        <Text fontSize={14} color="$blue10" fontWeight="bold">
                            {publicClient?.chain?.name || "Unknown"} ({chainId})
                        </Text>
                        <XStack backgroundColor="#EDF2F7" borderRadius="$2" padding="$1" gap="$1" flexWrap="wrap">
                            {[
                                { id: SupportedChains.CELO, name: "Celo" },
                                { id: SupportedChains.BASE, name: "Base" },
                                { id: SupportedChains.CELO_ALFAJORES, name: "Alfajores" },
                                { id: 137 as SupportedChains, name: "Polygon" },
                            ].map(c => (
                                <Button key={c.id} size="$2" chromeless={chainId !== c.id} onPress={() => switchChain?.({ chainId: c.id })}>
                                    {c.name}
                                </Button>
                            ))}
                        </XStack>
                    </SectionCard>
                    <SectionCard bg="white" gap="$1" title="SDK ENVIRONMENT">
                        <XStack backgroundColor="#EDF2F7" borderRadius="$2" padding="$1">
                            {["production", "staging", "development"].map(env => (
                                <Button key={env} size="$2" chromeless={environment !== env} onPress={() => setEnvironment(env as Environment)}>
                                    {env.charAt(0).toUpperCase() + env.slice(1)}
                                </Button>
                            ))}
                        </XStack>
                        <Text fontSize={12} color="$blue10" fontWeight="bold">Connected as {address?.slice(0, 6)}...{address?.slice(-4)}</Text>
                    </SectionCard>
                </XStack>


                <YStack alignItems="center" gap="$2">
                    <Text fontSize={28} fontWeight="bold">Streaming SDK</Text>
                    <Text fontSize={12} color="$gray9">G$ Token: <Text fontWeight="bold" color="$blue10">{G$_TOKEN || "Not configured"}</Text></Text>
                    {chainId === SupportedChains.BASE && (
                        <Text fontSize={12} color="$orange10" fontWeight="bold">SUP streaming / no G$ on Base</Text>
                    )}
                </YStack>

                {/* Operations */}
                <OperationSection title="Create Stream" buttonText="Create Stream" buttonColor="$blue10" isLoading={isCreating} onAction={(r, a) => handleAction(r, a, createStream, "Stream created!")} timeUnit={timeUnit} setTimeUnit={setTimeUnit} disabled={!G$_TOKEN} />
                <OperationSection title="Update Stream" buttonText="Update Stream" buttonColor="$orange10" isLoading={isUpdating} onAction={(r, a) => handleAction(r, a, updateStream, "Stream updated!")} disabled={!G$_TOKEN} />
                <OperationSection title="Delete Stream" buttonText="Delete Stream" buttonColor="$red10" isLoading={isDeleting} onAction={(r) => handleAction(r, "", deleteStream, "Stream deleted!")} showAmount={false} disabled={!G$_TOKEN} />

                <Separator />

                {/* Data Displays */}
                <ActiveStreamsList streams={streams || []} isLoading={streamsLoading} onRefresh={() => refetchStreams()} />

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

                <SectionCard title="SUP Reserve Holdings">
                    <Text fontSize={12} color="$orange10">(Only on Base mainnet)</Text>
                    {supLoading ? <Spinner /> : (supReserves && supReserves.length > 0) ? (
                        <YStack gap="$2">
                            {supReserves.slice(0, 5).map((l: SUPReserveLocker, i: number) => (
                                <XStack key={i} padding="$3" backgroundColor="#F7FAFC" borderRadius="$3" justifyContent="space-between">
                                    <Text fontSize={12} fontWeight="bold">Locker: {l.id?.slice(0, 10)}...</Text>
                                    <Text fontSize={10} color="$gray9">Owner: {l.lockerOwner?.slice(0, 10)}...</Text>
                                </XStack>
                            ))}
                        </YStack>
                    ) : <Text color="$gray10" textAlign="center">No SUP lockers found (Check API Key)</Text>}
                </SectionCard>
            </YStack>
        </ScrollView>
    )
}
