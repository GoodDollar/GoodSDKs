import { WalletClient, WalletActions } from "viem"

import {
  contractAddresses,
  ContractAddresses,
  contractEnv,
  SupportedChains,
} from "../constants"

export const isSupportedChain = (chainId: any): chainId is SupportedChains =>
  Object.values(SupportedChains).includes(chainId)

export const resolveChainAndContract = (
  walletClient: WalletClient & WalletActions,
  env: contractEnv,
): { chainId: SupportedChains; contractEnvAddresses: ContractAddresses } => {
  const chainId = walletClient.chain?.id

  if (!chainId || !isSupportedChain(chainId)) {
    throw new Error(`Unsupported chain ID.`)
  }

  const contractEnvAddresses = contractAddresses[chainId][env]

  if (!contractAddresses) {
    throw new Error(`Contract address for environment "${env}" not found.`)
  }

  return { chainId, contractEnvAddresses }
}
