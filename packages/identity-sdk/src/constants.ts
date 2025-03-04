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
