import {
  BNB_TESTNET,
  createClient,
  signerFromPasskey,
  type Client,
  type PasskeyCredential,
} from "@altananetwork/sdk";

/**
 * Underwrit hires run on BSC Testnet, same as every reference agent — a
 * hired agent's own wallet is a real testnet address, so the session grant
 * has to target the same chain. Swap in `BNB` (mainnet) once agents
 * graduate, per the plan's graduated testnet -> mainnet migration.
 */
let client: Client | undefined;

export function getAltanaClient(): Client {
  client ??= createClient({ chains: [BNB_TESTNET] });
  return client;
}

export { BNB_TESTNET, signerFromPasskey };
export type { PasskeyCredential };
