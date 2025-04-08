import { parseAbi } from "viem"

export const FV_IDENTIFIER_MSG2 = `Sign this message to request verifying your account <account> and to create your own secret unique identifier for your anonymized record.
You can use this identifier in the future to delete this anonymized record.
WARNING: do not sign this message unless you trust the website/application requesting this signature.`

export const Envs: Record<string, Record<string, string>> = {
  production: {
    dappUrl: "https://wallet.gooddollar.org",
    identityUrl: "https://goodid.gooddollar.org",
    backend: "https://goodserver.gooddollar.org",
    goodCollectiveUrl: "https://goodcollective.vercel.app/",
  },
  staging: {
    dappUrl: "https://qa.gooddollar.org",
    identityUrl: "https://goodid-qa.vercel.app",
    backend: "https://goodserver-qa.herokuapp.com",
    goodCollectiveUrl: "https://dev-goodcollective.vercel.app/",
  },
  development: {
    dappUrl: "https://dev.gooddollar.org",
    identityUrl: "https://goodid-dev.vercel.app",
    backend: "https://good-server.herokuapp.com",
    goodCollectiveUrl: "https://dev-goodcollective.vercel.app/",
  },
}

export const identityContractAddresses: { [key: string]: `0x${string}` } = {
  production: "0xC361A6E67822a0EDc17D899227dd9FC50BD62F42",
  staging: "0x0108BBc09772973aC27983Fc17c7D82D8e87ef4D",
  development: "0xF25fA0D4896271228193E782831F6f3CFCcF169C",
}

export const ubiContractAddresses: { [key: string]: `0x${string}` } = {
  production: "0x43d72Ff17701B2DA814620735C39C620Ce0ea4A1",
  staging: "0x2881d417dA066600372753E73A3570F0781f18cB",
  development: "0x6B86F82293552C3B9FE380FC038A89e0328C7C5f",
}

export const identityV2ABI = parseAbi([
  "function addWhitelisted(address account)",
  "function removeWhitelisted(address account)",
  "function getWhitelistedRoot(address account) view returns (address)",
  "function lastAuthenticated(address account) view returns (uint256)",
  "function authenticationPeriod() view returns (uint256)",
])

// ABI for the UBISchemeV2 contract for essential functions and events
export const ubiSchemeV2ABI = parseAbi([
  "function claim() returns (bool)",
  "function checkEntitlement() view returns (uint256)",
  "function checkEntitlement(address _member) view returns (uint256)",
  "function getDailyStats() view returns (uint256 claimers, uint256 amount)",
  "function periodStart() view returns (uint256)",
  "function currentDay() view returns (uint256)",
  "event UBIClaimed(address indexed account, uint256 amount)",
])

export type contractEnv = "production" | "staging" | "development"
