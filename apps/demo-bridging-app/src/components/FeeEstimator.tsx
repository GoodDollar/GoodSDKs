import { useState } from "react"
import { useBridgeFee } from "@goodsdks/bridging-sdk"
import { SUPPORTED_CHAINS, BRIDGE_PROTOCOLS } from "@goodsdks/bridging-sdk"
import type { BridgeProtocol, ChainId } from "@goodsdks/bridging-sdk"

interface FeeEstimatorProps {
  fromChain: ChainId
  toChain: ChainId
  amount: string
}

export function FeeEstimator({ fromChain, toChain, amount }: FeeEstimatorProps) {
  const [selectedProtocol, setSelectedProtocol] = useState<BridgeProtocol>("AXELAR")
  
  // Get fees for both protocols
  const { fee: axelarFee, loading: axelarLoading, error: axelarError } = useBridgeFee(
    fromChain,
    toChain,
    "AXELAR"
  )
  
  const { fee: lzFee, loading: lzLoading, error: lzError } = useBridgeFee(
    fromChain,
    toChain,
    "LAYERZERO"
  )

  const getFeeDisplay = (fee: any) => {
    if (!fee) return null
    const [amount, token] = fee.formatted.split(" ")
    return { amount: parseFloat(amount), token }
  }

  const axelarFeeDisplay = getFeeDisplay(axelarFee)
  const lzFeeDisplay = getFeeDisplay(lzFee)

  const getCheapestProtocol = () => {
    if (!axelarFeeDisplay || !lzFeeDisplay) return null
    
    if (axelarFeeDisplay.amount < lzFeeDisplay.amount) {
      return "AXELAR"
    } else {
      return "LAYERZERO"
    }
  }

  const cheapestProtocol = getCheapestProtocol()

  const getTotalCost = (protocol: BridgeProtocol) => {
    const feeDisplay = protocol === "AXELAR" ? axelarFeeDisplay : lzFeeDisplay
    if (!feeDisplay || !amount) return 0
    
    return parseFloat(amount) + feeDisplay.amount
  }

  if (!fromChain || !toChain) {
    return (
      <div className="bg-white rounded-lg shadow-md p-6">
        <h2 className="text-xl font-bold mb-4">Fee Estimator</h2>
        <p>Select source and destination chains to see fee estimates.</p>
      </div>
    )
  }

  return (
    <div className="bg-white rounded-lg shadow-md p-6">
      <h2 className="text-xl font-bold mb-6">Fee Estimator</h2>
      
      <div className="mb-4">
        <p className="text-sm text-gray-600">
          Bridging from <span className="font-medium">{SUPPORTED_CHAINS[fromChain].name}</span> to{" "}
          <span className="font-medium">{SUPPORTED_CHAINS[toChain].name}</span>
        </p>
      </div>

      {/* Protocol Comparison */}
      <div className="space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Axelar Fee */}
          <div 
            className={`border rounded-lg p-4 cursor-pointer transition-colors ${
              selectedProtocol === "AXELAR" 
                ? "border-blue-500 bg-blue-50" 
                : "border-gray-200 hover:border-gray-300"
            }`}
            onClick={() => setSelectedProtocol("AXELAR")}
          >
            <div className="flex items-center justify-between mb-2">
              <h3 className="font-medium">Axelar</h3>
              {cheapestProtocol === "AXELAR" && (
                <span className="text-xs bg-green-100 text-green-800 px-2 py-1 rounded-full">
                  Cheapest
                </span>
              )}
            </div>
            
            {axelarLoading ? (
              <p className="text-sm text-gray-500">Loading fee...</p>
            ) : axelarError ? (
              <p className="text-sm text-red-500">Error loading fee</p>
            ) : axelarFeeDisplay ? (
              <div>
                <p className="text-lg font-semibold">
                  {axelarFeeDisplay.amount.toFixed(6)} {axelarFeeDisplay.token}
                </p>
                {amount && (
                  <p className="text-sm text-gray-600">
                    Total: {getTotalCost("AXELAR").toFixed(6)} {axelarFeeDisplay.token}
                  </p>
                )}
              </div>
            ) : (
              <p className="text-sm text-gray-500">No route available</p>
            )}
          </div>

          {/* LayerZero Fee */}
          <div 
            className={`border rounded-lg p-4 cursor-pointer transition-colors ${
              selectedProtocol === "LAYERZERO" 
                ? "border-blue-500 bg-blue-50" 
                : "border-gray-200 hover:border-gray-300"
            }`}
            onClick={() => setSelectedProtocol("LAYERZERO")}
          >
            <div className="flex items-center justify-between mb-2">
              <h3 className="font-medium">LayerZero</h3>
              {cheapestProtocol === "LAYERZERO" && (
                <span className="text-xs bg-green-100 text-green-800 px-2 py-1 rounded-full">
                  Cheapest
                </span>
              )}
            </div>
            
            {lzLoading ? (
              <p className="text-sm text-gray-500">Loading fee...</p>
            ) : lzError ? (
              <p className="text-sm text-red-500">Error loading fee</p>
            ) : lzFeeDisplay ? (
              <div>
                <p className="text-lg font-semibold">
                  {lzFeeDisplay.amount.toFixed(6)} {lzFeeDisplay.token}
                </p>
                {amount && (
                  <p className="text-sm text-gray-600">
                    Total: {getTotalCost("LAYERZERO").toFixed(6)} {lzFeeDisplay.token}
                  </p>
                )}
              </div>
            ) : (
              <p className="text-sm text-gray-500">No route available</p>
            )}
          </div>
        </div>

        {/* Selected Protocol Details */}
        <div className="mt-6 p-4 bg-gray-50 rounded-lg">
          <h3 className="font-medium mb-2">
            Selected: {BRIDGE_PROTOCOLS[selectedProtocol]}
          </h3>
          
          {selectedProtocol === "AXELAR" && axelarFeeDisplay && (
            <div className="text-sm text-gray-600">
              <p>• Secure cross-chain communication</p>
              <p>• Gas refunds supported</p>
              <p>• Explorer: axelarscan.io</p>
            </div>
          )}
          
          {selectedProtocol === "LAYERZERO" && lzFeeDisplay && (
            <div className="text-sm text-gray-600">
              <p>• Ultra-light node endpoints</p>
              <p>• Custom adapter parameters</p>
              <p>• Explorer: layerzeroscan.com</p>
            </div>
          )}
        </div>

        {/* Fee Information */}
        <div className="mt-4 p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
          <h4 className="font-medium text-yellow-800 mb-2">Important Notes</h4>
          <ul className="text-sm text-yellow-700 space-y-1">
            <li>• Fees are paid in the source chain's native token</li>
            <li>• Fees cover cross-chain infrastructure costs</li>
            <li>• Fees may vary based on network congestion</li>
            <li>• Total cost = bridge amount + protocol fee</li>
          </ul>
        </div>
      </div>
    </div>
  )
}