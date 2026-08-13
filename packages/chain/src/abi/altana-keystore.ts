import { parseAbi } from "viem";

/**
 * Minimal read-only ABI for Altana's KeyStore contract — enough to
 * independently verify a session's authority (isValidKey) without going
 * through Altana's own SDK/relay. Writes (grantSession/execute/revokeSession)
 * go through @altananetwork/sdk instead of raw contract calls — see
 * apps/agents for that usage.
 */
export const altanaKeyStoreAbi = parseAbi([
  "function isValidKey(address user, bytes32 keyId) view returns (bool)",
  "function getKeys(address user) view returns (bytes32[])",
]);
