import { Client } from "viem";
import { getCode } from "viem/actions";

export const isContract = async (client: Client, address: string) => {
  const code = await getCode(client, { address: address as `0x${string}` });
  return !!code && code !== "0x";
};

export const checkSourceVerification = async (
  address: string,
  chainId: number,
) => {
  try {
    const response = await fetch(
      `https://sourcify.dev/server/check-all-by-addresses?chainIds=${chainId}&addresses=${address}`,
    ).then((_) => _.json());
    return response.find((_: { status: string }) => _.status !== "false");
  } catch (error) {
    console.error("Error checking sourcify:", error);
    return false;
  }
};
