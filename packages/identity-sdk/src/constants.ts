import { parseAbi } from "viem";

export const FV_IDENTIFIER_MSG2 = `Sign this message to request verifying your account <account> and to create your own secret unique identifier for your anonymized record.
You can use this identifier in the future to delete this anonymized record.
WARNING: do not sign this message unless you trust the website/application requesting this signature.`;

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
};

export const identityContractAddresses: { [key: string]: `0x${string}` } = {
  production: "0xC361A6E67822a0EDc17D899227dd9FC50BD62F42",
  staging: "0x0108BBc09772973aC27983Fc17c7D82D8e87ef4D",
  development: "0xF25fA0D4896271228193E782831F6f3CFCcF169C",
};

export const identityV2ABI = parseAbi([
  "function addWhitelisted(address account)",
  "function removeWhitelisted(address account)",
  "function getWhitelistedRoot(address account) view returns (address)",
  "function lastAuthenticated(address account) view returns (uint256)",
  "function authenticationPeriod() view returns (uint256)",
]);

export type contractEnv = "production" | "staging" | "development";
