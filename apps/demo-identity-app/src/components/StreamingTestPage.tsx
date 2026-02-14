import React, { useState } from "react"
import {
    View,
    Text,
    YStack,
    XStack,
    Button,
    Input,
    ScrollView,
    Spinner,
    Separator,
} from "tamagui"
import { useAccount, usePublicClient, useWalletClient, useSwitchChain } from "wagmi"
import {
    useCreateStream,
    useUpdateStream,
    useDeleteStream,
    useStreamList,
    useGDAPools,
    usePoolMemberships,
    useSupReserves,
    useConnectToPool,
    useDisconnectFromPool,
} from "@goodsdks/react-hooks"
import { calculateFlowRate, formatFlowRate } from "@goodsdks/streaming-sdk"
import { parseEther, formatEther, type Address } from "viem"

export const StreamingTestPage: React.FC = () => {
    const { address, isConnected } = useAccount()
    const publicClient = usePublicClient()
    const { data: walletClient } = useWalletClient()
    const { switchChain } = useSwitchChain()


    const [receiver, setReceiver] = useState("")
    const [amount, setAmount] = useState("10")
    const [timeUnit, setTimeUnit] = useState<"month" | "day" | "hour">("month")


    const [updateReceiver, setUpdateReceiver] = useState("")
    const [updateAmount, setUpdateAmount] = useState("20")


    const [deleteReceiver, setDeleteReceiver] = useState("")


    const [environment, setEnvironment] = useState<"production" | "staging" | "development">("production")


    const [poolAddress, setPoolAddress] = useState("")


    const [lastTxHash, setLastTxHash] = useState<string | null>(null)


    const { mutate: createStream, isLoading: isCreating } = useCreateStream()
    const { mutate: updateStream, isLoading: isUpdating } = useUpdateStream()
    const { mutate: deleteStream, isLoading: isDeleting } = useDeleteStream()
    const { mutate: connectToPool, isLoading: isConnecting } = useConnectToPool()
    const { mutate: disconnectFromPool, isLoading: isDisconnecting } =
        useDisconnectFromPool()

    const {
        data: streams,
        isLoading: streamsLoading,
        refetch: refetchStreams,
    } = useStreamList({
        account: address as Address,
        environment,
        enabled: !!address,
    })

    const { data: pools, isLoading: poolsLoading } = useGDAPools({
        environment,
        enabled: !!address,
    })

    const { data: memberships } = usePoolMemberships({
        account: address as Address,
        environment,
        enabled: !!address,
    })

    const { data: supReserves, isLoading: supLoading } = useSupReserves({
        enabled: isConnected && environment === "production",
    })

    const chainId = publicClient?.chain?.id

    const getG$Token = () => {
        if (!chainId) return "0x"
        try {
            // Mapping for UI purposes
            const addresses: any = {
                production: {
                    42220: "0x62B8B11039FcfE5aB0C56E502b1C372A3d2a9c7A", // Celo Mainnet
                },
                staging: {
                    42220: "0x61FA0fB802fd8345C06da558240E0651886fec69", // Celo Staging
                },
                development: {
                    44787: "0xFa51eFDc0910CCdA91732e6806912Fa12e2FD475", // Celo Alfajores
                    42220: "0xFa51eFDc0910CCdA91732e6806912Fa12e2FD475", // Fallback for user case
                }
            }
            return addresses[environment]?.[chainId] || addresses[environment]?.[42220] || "0x"
        } catch (e) {
            return "0x"
        }
    }

    const G$_TOKEN = getG$Token()

    const handleCreateStream = () => {
        if (!receiver || !amount) {
            alert("Please fill in all fields")
            return
        }

        try {
            const flowRate = calculateFlowRate(parseEther(amount), timeUnit)

            createStream(
                {
                    receiver: receiver as Address,
                    token: G$_TOKEN as Address,
                    flowRate,
                    environment,
                },
                {
                    onSuccess: (hash) => {
                        console.log("Stream created:", hash)
                        setLastTxHash(hash)
                        refetchStreams()
                        setReceiver("")
                        setAmount("10")
                    },
                    onError: (error) => {
                        console.error("Error creating stream:", error)
                        alert(`Error: ${error.message}`)
                    },
                },
            )
        } catch (error: any) {
            alert(`Error: ${error.message}`)
        }
    }

    const handleUpdateStream = () => {
        if (!updateReceiver || !updateAmount) {
            alert("Please fill in all fields")
            return
        }

        try {
            const newFlowRate = calculateFlowRate(parseEther(updateAmount), timeUnit)

            updateStream(
                {
                    receiver: updateReceiver as Address,
                    token: G$_TOKEN as Address,
                    newFlowRate,
                    environment,
                },
                {
                    onSuccess: (hash) => {
                        console.log("Stream updated:", hash)
                        setLastTxHash(hash)
                        refetchStreams()
                    },
                    onError: (error) => {
                        console.error("Error updating stream:", error)
                        alert(`Error: ${error.message}`)
                    },
                },
            )
        } catch (error: any) {
            alert(`Error: ${error.message}`)
        }
    }

    const handleDeleteStream = () => {
        if (!deleteReceiver) {
            alert("Please enter receiver address")
            return
        }

        deleteStream(
            {
                receiver: deleteReceiver as Address,
                token: G$_TOKEN as Address,
                environment,
            },
            {
                onSuccess: (hash) => {
                    console.log("Stream deleted:", hash)
                    setLastTxHash(hash)
                    refetchStreams()
                    setDeleteReceiver("")
                },
                onError: (error) => {
                    console.error("Error deleting stream:", error)
                    alert(`Error: ${error.message}`)
                },
            },
        )
    }

    const handleConnectToPool = () => {
        if (!poolAddress) {
            alert("Please enter pool address")
            return
        }

        connectToPool(
            {
                poolAddress: poolAddress as Address,
            },
            {
                onSuccess: (hash) => {
                    console.log("Connected to pool:", hash)
                    setLastTxHash(hash)
                },
                onError: (error) => {
                    console.error("Error connecting to pool:", error)
                    alert(`Error: ${error.message}`)
                },
            },
        )
    }

    if (!isConnected) {
        return (
            <View padding="$4" alignItems="center">
                <Text fontSize={18} color="$red10">
                    Please connect your wallet to test the Streaming SDK
                </Text>
                <appkit-button></appkit-button>
            </View>
        )
    }

    return (
        <ScrollView flex={1} padding="$4" backgroundColor="#F7FAFC">
            <YStack maxWidth={800} width="100%" alignSelf="center" gap="$4">
                {/* Status & Environment Selection */}
                <XStack justifyContent="space-between" alignItems="center" backgroundColor="white" padding="$3" borderRadius="$4" borderWidth={1} borderColor="#E2E8F0">
                    <YStack gap="$1">
                        <Text fontSize={12} color="$gray10" fontWeight="bold">NETWORK</Text>
                        <Text fontSize={14} color="$blue10" fontWeight="bold">
                            {publicClient?.chain?.name || "Unknown Chain"} ({chainId})
                        </Text>
                    </YStack>
                    <YStack gap="$1" alignItems="flex-end">
                        <Text fontSize={12} color="$gray10" fontWeight="bold">SWITCH CHAIN</Text>
                        <XStack backgroundColor="#EDF2F7" borderRadius="$2" padding="$1" gap="$1">
                            {[
                                { id: 42220, name: "Celo" },
                                { id: 8453, name: "Base" },
                                { id: 44787, name: "Alfajores" },
                                { id: 84532, name: "Base Sep" }
                            ].map((chain) => (
                                <Button
                                    key={chain.id}
                                    size="$2"
                                    backgroundColor={chainId === chain.id ? "white" : "transparent"}
                                    color={chainId === chain.id ? "$blue10" : "$gray10"}
                                    onPress={() => switchChain?.({ chainId: chain.id })}
                                    paddingHorizontal="$2"
                                    chromeless={chainId !== chain.id}
                                    borderRadius="$2"
                                >
                                    {chain.name}
                                </Button>
                            ))}
                        </XStack>
                    </YStack>
                </XStack>

                <XStack justifyContent="space-between" alignItems="center" backgroundColor="white" padding="$3" borderRadius="$4" borderWidth={1} borderColor="#E2E8F0">
                    <YStack gap="$1">
                        <Text fontSize={12} color="$gray10" fontWeight="bold">SDK ENVIRONMENT</Text>
                        <XStack backgroundColor="#EDF2F7" borderRadius="$2" padding="$1">
                            {["production", "staging", "development"].map((env) => (
                                <Button
                                    key={env}
                                    size="$2"
                                    backgroundColor={environment === env ? "white" : "transparent"}
                                    color={environment === env ? "$blue10" : "$gray10"}
                                    onPress={() => setEnvironment(env as any)}
                                    paddingHorizontal="$2"
                                    chromeless={environment !== env}
                                    borderRadius="$2"
                                >
                                    {env.charAt(0).toUpperCase() + env.slice(1)}
                                </Button>
                            ))}
                        </XStack>
                    </YStack>
                    <YStack gap="$1" alignItems="flex-end">
                        <Text fontSize={12} color="$gray10" fontWeight="bold">CONNECTED AS</Text>
                        <Text fontSize={12} color="$blue10" fontWeight="bold">
                            {address?.slice(0, 6)}...{address?.slice(-4)}
                        </Text>
                    </YStack>
                </XStack>

                <YStack alignItems="center" gap="$2">
                    <Text fontSize={28} fontWeight="bold" color="$text">
                        🌊 Streaming SDK Test Page
                    </Text>
                    <Text fontSize={14} color="$gray10" textAlign="center">
                        Test the GoodDollar Streaming SDK features
                    </Text>
                    <Text fontSize={12} color="$gray9" textAlign="center">
                        G$ Token: <Text fontWeight="bold" color="$blue10">{G$_TOKEN}</Text>
                    </Text>
                </YStack>

                {/* Transaction Alert */}
                {lastTxHash && (
                    <YStack
                        padding="$4"
                        backgroundColor="#F0FFF4"
                        borderRadius="$4"
                        borderWidth={1}
                        borderColor="#68D391"
                        gap="$2"
                    >
                        <XStack justifyContent="space-between" alignItems="center">
                            <Text color="#2F855A" fontWeight="bold">
                                ✅ Success! Transaction confirmed.
                            </Text>
                            <Button size="$2" onPress={() => setLastTxHash(null)}>
                                Dismiss
                            </Button>
                        </XStack>
                        <Text fontSize={12} color="$gray11">
                            Hash: {lastTxHash}
                        </Text>
                        <Button
                            size="$3"
                            backgroundColor="$blue10"
                            color="white"
                            onPress={() => {
                                const explorer =
                                    publicClient?.chain?.blockExplorers?.default?.url ||
                                    (chainId === 44787 ? "https://alfajores.celoscan.io" : "https://celoscan.io")
                                window.open(`${explorer}/tx/${lastTxHash}`, "_blank")
                            }}
                        >
                            View on Block Explorer
                        </Button>
                    </YStack>
                )}

                {/* Create Stream Section */}
                <YStack
                    padding="$4"
                    backgroundColor="white"
                    borderRadius="$4"
                    borderWidth={1}
                    borderColor="#E2E8F0"
                    gap="$3"
                >
                    <Text fontSize={20} fontWeight="bold" color="$text">
                        📤 Create Stream
                    </Text>
                    <Text fontSize={14} color="$gray10">
                        Create a new money stream to a recipient
                    </Text>

                    <YStack gap="$2">
                        <Text fontSize={14} fontWeight="600">
                            Receiver Address
                        </Text>
                        <Input
                            placeholder="0x..."
                            value={receiver}
                            onChangeText={setReceiver}
                            borderColor="#CBD5E0"
                        />
                    </YStack>

                    <XStack gap="$2">
                        <YStack flex={1} gap="$2">
                            <Text fontSize={14} fontWeight="600">
                                Amount (G$)
                            </Text>
                            <Input
                                placeholder="10"
                                value={amount}
                                onChangeText={setAmount}
                                borderColor="#CBD5E0"
                            />
                        </YStack>

                        <YStack flex={1} gap="$2">
                            <Text fontSize={14} fontWeight="600">
                                Time Unit
                            </Text>
                            <XStack gap="$2">
                                {(["hour", "day", "month"] as const).map((unit) => (
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
                        </YStack>
                    </XStack>

                    <Button
                        onPress={handleCreateStream}
                        backgroundColor="$blue10"
                        color="white"
                        disabled={isCreating}
                        icon={isCreating ? <Spinner /> : undefined}
                    >
                        {isCreating ? "Creating..." : "Create Stream"}
                    </Button>
                </YStack>

                {/* Update Stream Section */}
                <YStack
                    padding="$4"
                    backgroundColor="white"
                    borderRadius="$4"
                    borderWidth={1}
                    borderColor="#E2E8F0"
                    gap="$3"
                >
                    <Text fontSize={20} fontWeight="bold" color="$text">
                        🔄 Update Stream
                    </Text>
                    <Text fontSize={14} color="$gray10">
                        Update the flow rate of an existing stream
                    </Text>

                    <YStack gap="$2">
                        <Text fontSize={14} fontWeight="600">
                            Receiver Address
                        </Text>
                        <Input
                            placeholder="0x..."
                            value={updateReceiver}
                            onChangeText={setUpdateReceiver}
                            borderColor="#CBD5E0"
                        />
                    </YStack>

                    <YStack gap="$2">
                        <Text fontSize={14} fontWeight="600">
                            New Amount (G$ per {timeUnit})
                        </Text>
                        <Input
                            placeholder="20"
                            value={updateAmount}
                            onChangeText={setUpdateAmount}
                            borderColor="#CBD5E0"
                        />
                    </YStack>

                    <Button
                        onPress={handleUpdateStream}
                        backgroundColor="$orange10"
                        color="white"
                        disabled={isUpdating}
                        icon={isUpdating ? <Spinner /> : undefined}
                    >
                        {isUpdating ? "Updating..." : "Update Stream"}
                    </Button>
                </YStack>

                {/* Delete Stream Section */}
                <YStack
                    padding="$4"
                    backgroundColor="white"
                    borderRadius="$4"
                    borderWidth={1}
                    borderColor="#E2E8F0"
                    gap="$3"
                >
                    <Text fontSize={20} fontWeight="bold" color="$text">
                        🗑️ Delete Stream
                    </Text>
                    <Text fontSize={14} color="$gray10">
                        Stop and delete an active stream
                    </Text>

                    <YStack gap="$2">
                        <Text fontSize={14} fontWeight="600">
                            Receiver Address
                        </Text>
                        <Input
                            placeholder="0x..."
                            value={deleteReceiver}
                            onChangeText={setDeleteReceiver}
                            borderColor="#CBD5E0"
                        />
                    </YStack>

                    <Button
                        onPress={handleDeleteStream}
                        backgroundColor="$red10"
                        color="white"
                        disabled={isDeleting}
                        icon={isDeleting ? <Spinner /> : undefined}
                    >
                        {isDeleting ? "Deleting..." : "Delete Stream"}
                    </Button>
                </YStack>

                <Separator />

                {/* Active Streams Section */}
                <YStack
                    padding="$4"
                    backgroundColor="white"
                    borderRadius="$4"
                    borderWidth={1}
                    borderColor="#E2E8F0"
                    gap="$3"
                >
                    <XStack justifyContent="space-between" alignItems="center">
                        <Text fontSize={20} fontWeight="bold" color="$text">
                            📊 Your Active Streams
                        </Text>
                        <Button size="$2" onPress={() => refetchStreams()}>
                            Refresh
                        </Button>
                    </XStack>

                    {streamsLoading ? (
                        <Spinner />
                    ) : streams && streams.length > 0 ? (
                        <YStack gap="$2">
                            {streams.map((stream, index) => (
                                <YStack
                                    key={index}
                                    padding="$3"
                                    backgroundColor="#F7FAFC"
                                    borderRadius="$3"
                                    gap="$1"
                                >
                                    <XStack justifyContent="space-between">
                                        <Text fontSize={12} fontWeight="600" color="$gray11">
                                            To:
                                        </Text>
                                        <Text fontSize={12} color="$gray10">
                                            {stream.receiver
                                                ? `${stream.receiver.slice(0, 6)}...${stream.receiver.slice(-4)}`
                                                : "Unknown"}
                                        </Text>
                                    </XStack>
                                    <XStack justifyContent="space-between">
                                        <Text fontSize={12} fontWeight="600" color="$gray11">
                                            Flow Rate:
                                        </Text>
                                        <Text fontSize={12} color="$gray10">
                                            {formatFlowRate(stream.flowRate, "month")}
                                        </Text>
                                    </XStack>
                                    <XStack justifyContent="space-between">
                                        <Text fontSize={12} fontWeight="600" color="$gray11">
                                            Streamed:
                                        </Text>
                                        <Text fontSize={12} color="$gray10">
                                            {stream.streamedSoFar
                                                ? formatEther(stream.streamedSoFar)
                                                : "0"}{" "}
                                            G$
                                        </Text>
                                    </XStack>
                                </YStack>
                            ))}
                        </YStack>
                    ) : (
                        <Text fontSize={14} color="$gray10" textAlign="center">
                            No active streams found
                        </Text>
                    )}
                </YStack>

                {/* GDA Pools Section */}
                <YStack
                    padding="$4"
                    backgroundColor="white"
                    borderRadius="$4"
                    borderWidth={1}
                    borderColor="#E2E8F0"
                    gap="$3"
                >
                    <Text fontSize={20} fontWeight="bold" color="$text">
                        🎯 Distribution Pools (GDA)
                    </Text>
                    <Text fontSize={14} color="$gray10">
                        Connect to distribution pools for 1-to-many streaming
                    </Text>

                    <YStack gap="$2">
                        <Text fontSize={14} fontWeight="600">
                            Pool Address
                        </Text>
                        <Input
                            placeholder="0x..."
                            value={poolAddress}
                            onChangeText={setPoolAddress}
                            borderColor="#CBD5E0"
                        />
                    </YStack>

                    <XStack gap="$2">
                        <Button
                            flex={1}
                            onPress={handleConnectToPool}
                            backgroundColor="$green10"
                            color="white"
                            disabled={isConnecting}
                            icon={isConnecting ? <Spinner /> : undefined}
                        >
                            {isConnecting ? "Connecting..." : "Connect"}
                        </Button>
                        <Button
                            flex={1}
                            onPress={() => {
                                if (!poolAddress) {
                                    alert("Please enter pool address")
                                    return
                                }
                                disconnectFromPool(
                                    { poolAddress: poolAddress as Address },
                                    {
                                        onSuccess: (hash) => {
                                            alert(`Disconnected! Transaction: ${hash}`)
                                        },
                                        onError: (error) => {
                                            alert(`Error: ${error.message}`)
                                        },
                                    },
                                )
                            }}
                            backgroundColor="$red10"
                            color="white"
                            disabled={isDisconnecting}
                            icon={isDisconnecting ? <Spinner /> : undefined}
                        >
                            {isDisconnecting ? "Disconnecting..." : "Disconnect"}
                        </Button>
                    </XStack>

                    {poolsLoading ? (
                        <Spinner />
                    ) : pools && pools.length > 0 ? (
                        <YStack gap="$2">
                            <Text fontSize={14} fontWeight="600" color="$gray11">
                                Available Pools:
                            </Text>
                            {pools.slice(0, 5).map((pool, index) => {
                                const membership = memberships?.find(
                                    (m) => m.pool.toLowerCase() === pool.id.toLowerCase(),
                                )
                                const isMember = membership?.isConnected

                                return (
                                    <YStack
                                        key={index}
                                        padding="$3"
                                        backgroundColor={isMember ? "#F0FFF4" : "#F7FAFC"}
                                        borderRadius="$3"
                                        borderWidth={isMember ? 1 : 0}
                                        borderColor={isMember ? "#68D391" : "transparent"}
                                        gap="$1"
                                        hoverStyle={{ backgroundColor: "#EDF2F7" }}
                                        cursor="pointer"
                                        onPress={() => {
                                            setPoolAddress(pool.id)
                                        }}
                                    >
                                        <XStack justifyContent="space-between" alignItems="center">
                                            <XStack gap="$2" alignItems="center">
                                                <Text fontSize={12} color="$gray10" fontWeight="600">
                                                    {pool.id.slice(0, 10)}...{pool.id.slice(-8)}
                                                </Text>
                                                {isMember && (
                                                    <View backgroundColor="$green10" paddingHorizontal="$2" borderRadius="$2">
                                                        <Text fontSize={8} color="white" fontWeight="bold">CONNECTED</Text>
                                                    </View>
                                                )}
                                            </XStack>
                                            <Text fontSize={10} color="$blue10" fontWeight="bold">
                                                USE THIS
                                            </Text>
                                        </XStack>
                                        <YStack gap="$1">
                                            <XStack justifyContent="space-between">
                                                <Text fontSize={11} color="$gray9">
                                                    Flow Rate: {formatFlowRate(pool.flowRate, "month")}
                                                </Text>
                                                {isMember && (
                                                    <Text fontSize={11} color="$green10" fontWeight="bold">
                                                        Units: {membership.units?.toString()}
                                                    </Text>
                                                )}
                                            </XStack>
                                            <XStack gap="$1">
                                                <Text fontSize={10} color="$gray8">Admin:</Text>
                                                <Text fontSize={10} color="$gray8">
                                                    {pool.admin ? `${pool.admin.slice(0, 6)}...${pool.admin.slice(-4)}` : "Unknown"}
                                                </Text>
                                            </XStack>
                                        </YStack>
                                    </YStack>
                                )
                            })}
                        </YStack>
                    ) : (
                        <Text fontSize={14} color="$gray10" textAlign="center">
                            No pools found
                        </Text>
                    )}
                </YStack>

                {/* SUP Reserve Holdings Section */}
                <YStack
                    padding="$4"
                    backgroundColor="white"
                    borderRadius="$4"
                    borderWidth={1}
                    borderColor="#E2E8F0"
                    gap="$3"
                >
                    <Text fontSize={20} fontWeight="bold" color="$text">
                        🏦 SUP Reserve Holdings
                    </Text>
                    <Text fontSize={14} color="$gray10">
                        Active SUP lockers from the dedicated reserve subgraph
                    </Text>
                    <Text fontSize={12} color="$orange10" fontWeight="600">
                        (Only visible on Base mainnet)
                    </Text>

                    {supLoading ? (
                        <Spinner />
                    ) : supReserves && supReserves.length > 0 ? (
                        <YStack gap="$2">
                            {supReserves.slice(0, 5).map((locker, index) => (
                                <XStack
                                    key={index}
                                    padding="$3"
                                    backgroundColor="#F7FAFC"
                                    borderRadius="$3"
                                    justifyContent="space-between"
                                    alignItems="center"
                                >
                                    <YStack>
                                        <Text fontSize={12} fontWeight="bold" color="$gray11">
                                            Locker: {locker.id.slice(0, 10)}...{locker.id.slice(-8)}
                                        </Text>
                                        <Text fontSize={10} color="$gray9">
                                            Owner: {locker.lockerOwner.slice(0, 12)}...
                                        </Text>
                                    </YStack>
                                    <View backgroundColor="$blue2" paddingHorizontal="$2" borderRadius="$2">
                                        <Text fontSize={10} color="$blue10">
                                            Block: {locker.blockNumber.toString()}
                                        </Text>
                                    </View>
                                </XStack>
                            ))}
                        </YStack>
                    ) : (
                        <Text fontSize={14} color="$gray10" textAlign="center">
                            No SUP lockers found or network not supported
                        </Text>
                    )}
                </YStack>

                {/* Documentation Section */}
                <YStack
                    padding="$4"
                    backgroundColor="#EBF8FF"
                    borderRadius="$4"
                    borderWidth={1}
                    borderColor="#90CDF4"
                    gap="$2"
                >
                    <Text fontSize={16} fontWeight="bold" color="$blue11">
                        📚 SDK Usage Example
                    </Text>
                    <Text fontSize={12} color="$gray11" fontFamily="$mono" whiteSpace="pre">
                        {`import { 
  useCreateStream, 
  usePoolMemberships, 
  useSupReserves 
} from '@goodsdks/react-hooks'
import { calculateFlowRate } from '@goodsdks/streaming-sdk'
import { parseEther } from 'viem'

// 1. One-to-One Streams
const { mutate: createStream } = useCreateStream()
const flowRate = calculateFlowRate(parseEther('100'), 'month')

// 2. Data Visualization
const { data: memberships } = usePoolMemberships({ account: '0x...' })
const { data: supLockers } = useSupReserves()

createStream({
  receiver: '0x...',
  token: '0x...',
  flowRate,
  environment: 'development'
})`}
                    </Text>
                </YStack>
            </YStack>
        </ScrollView>
    )
}
