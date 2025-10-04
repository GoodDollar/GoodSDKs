import { WalletActions, WalletClient } from "viem"

import {
  ContractAddresses,
  contractEnv,
  chainConfigs,
  isSupportedChain,
  SupportedChains,
} from "../constants"

export const resolveChainAndContract = (
  walletClient: WalletClient & WalletActions,
  env: contractEnv,
): { chainId: SupportedChains; contractEnvAddresses: ContractAddresses } => {
  const chainId = walletClient.chain?.id

  if (!isSupportedChain(chainId)) {
    throw new Error(`Unsupported chain ID.`)
  }

  const contractEnvAddresses = chainConfigs[chainId]?.contracts[env] ?? null

  if (!contractEnvAddresses) {
    throw new Error(
      `Contract address for environment "${env}" on chain "${chainConfigs[chainId].label}" not found. Try a different environment or chain.`,
    )
  }

  return { chainId, contractEnvAddresses }
}
