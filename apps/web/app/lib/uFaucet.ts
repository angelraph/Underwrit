import { encodeFunctionData, type Address } from "viem";
import type { Signer } from "@altananetwork/sdk";
import { getAltanaClient, BNB_TESTNET } from "./altana";

/**
 * $U (United Stables) testnet faucet on BSC Testnet — pays 10 $U to the
 * caller, once per address every 30 minutes. Confirmed real by the Altana
 * team directly (docs.altana.network/sdk/erc8183#get-testnet-u); this
 * project checked first and found no self-serve path documented anywhere
 * else (no public mint on the token contract, no PancakeSwap testnet
 * liquidity) before asking.
 */
const U_FAUCET_ADDRESS: Address = "0x86e9197CC0F76E4e4aaa7082180945196bBAb5D3";

const FAUCET_ABI = [
  { name: "requestTokens", type: "function", stateMutability: "nonpayable", inputs: [], outputs: [] },
] as const;

export async function claimTestnetU(address: Address, signer: Signer) {
  const client = getAltanaClient();
  return client.execute({
    wallet: { address },
    signer,
    calls: [
      {
        to: U_FAUCET_ADDRESS,
        data: encodeFunctionData({ abi: FAUCET_ABI, functionName: "requestTokens" }),
      },
    ],
    chainId: BNB_TESTNET.chainId,
  });
}

/**
 * Send a small amount of native tBNB from the connected wallet to another
 * address — used once to give the x402 facilitator EOA (which holds no
 * funds of its own by design) enough gas to test the $U faucet's plain-EOA
 * claim path (Method 2 in the Altana docs) after the smart-account path
 * (Method 1) reverted for real.
 */
export async function sendTestnetBnb(from: Address, signer: Signer, to: Address, weiAmount: bigint) {
  const client = getAltanaClient();
  return client.execute({
    wallet: { address: from },
    signer,
    calls: [{ to, value: weiAmount }],
    chainId: BNB_TESTNET.chainId,
  });
}
