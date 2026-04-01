import { parseAbi } from "viem"

// Only the contract methods and events actually used by the SDK
export const MESSAGE_PASSING_BRIDGE_ABI = parseAbi([
  // Read functions
  "function canBridge(address from, uint256 amount) view returns (bool isWithinLimit, string errorMessage)",
  "function bridgeLimits() view returns (uint256 dailyLimit, uint256 txLimit, uint256 accountDailyLimit, uint256 minAmount, bool onlyWhitelisted)",
  // Write functions
  "function bridgeTo(address target, uint256 targetChainId, uint256 amount, uint8 bridge) payable",
  "function bridgeToWithAxelar(address target, uint256 targetChainId, uint256 amount) payable",
  "function bridgeToWithLzAdapterParams(address target, uint256 targetChainId, uint256 amount, bytes adapterParams) payable",
  // Events
  "event BridgeRequest(address indexed from, address indexed to, uint256 targetChainId, uint256 normalizedAmount, uint256 timestamp, uint8 bridge, uint256 indexed id)",
  "event ExecutedTransfer(address indexed from, address indexed to, uint256 normalizedAmount, uint256 fee, uint256 sourceChainId, uint8 bridge, uint256 indexed id)",
])
