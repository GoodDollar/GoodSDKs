import type { HardhatUserConfig } from "hardhat/config"
import "@nomicfoundation/hardhat-toolbox"
import "@nomicfoundation/hardhat-chai-matchers"
import "@nomicfoundation/hardhat-ethers"
import "@openzeppelin/hardhat-upgrades"
import "@typechain/hardhat"
import dotenv from "dotenv"
import { ethers } from "ethers"
dotenv.config()

const mnemonic =
  process.env.MNEMONIC ||
  "test test test test test test test test test test test junk"
const deployerPrivateKey =
  process.env.PRIVATE_KEY || ethers.zeroPadBytes("0x11", 32)
const etherscan_key = process.env.ETHERSCAN_KEY
const celoscan_key = process.env.CELOSCAN_KEY || ""

const config: HardhatUserConfig = {
  solidity: {
    version: "0.8.28",
    settings: {
      optimizer: {
        enabled: true,
        runs: 0,
      },
      viaIR: true,
    },
  },
  sourcify: {
    enabled: true,
  },
  etherscan: {
    apiKey: {
      celo: celoscan_key,
    },
    customChains: [
      {
        network: "celo",
        chainId: 42220,
        urls: {
          apiURL: "https://api.etherscan.io/v2/api?chainid=42220",
          browserURL: "https://celoscan.io/",
        },
      },
    ],
  },
  networks: {
    hardhat: {
      chainId: process.env.FORK_CHAIN_ID
        ? Number(process.env.FORK_CHAIN_ID)
        : 4447,
      allowUnlimitedContractSize: true,
      accounts: {
        accountsBalance: "10000000000000000000000000",
      },
    },
    "production-celo": {
      accounts: [deployerPrivateKey],
      url: "https://forno.celo.org",
      gas: 8000000,
      gasPrice: 5000000000,
      chainId: 42220,
    },
    "development-celo": {
      accounts: { mnemonic },
      url: "https://forno.celo.org",
      gas: 3000000,
      gasPrice: 5000000000,
      chainId: 42220,
    },
  },
}

export default config
