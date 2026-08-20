import type { Address } from "viem";
import { hireErc8183Agent, type HireAgentResult, type Signer } from "@altananetwork/sdk";
import { BNB_TESTNET } from "./altana";

/**
 * ERC-8183 buyer-side hiring (Altana bonus track) — funds a real job-escrow
 * against a provider's wallet in $U, via the AgenticCommerce kernel on BSC
 * Testnet. One atomic relay intent (createJob, registerJob, setBudget,
 * approve $U, fund).
 *
 * The natural `provider` for Underwrit is one of its own four reference
 * agents' wallets: they're already real ERC-8004 identities registered on
 * the exact registry (0x8004A818...4BD9e) ERC8183_ADDRESSES points to for
 * seller discovery, so hiring one is a fully self-contained, independently
 * verifiable test that doesn't depend on any third party's willingness or
 * ability to fulfil a job. A third-party provider (e.g. from Discover) works
 * the same way, just without that guarantee.
 *
 * Not yet run for real: needs a wallet holding testnet $U to fund the job,
 * and there's no self-serve way to get any (see
 * docs/altana-u-token-request.md). Ready to call the moment that's resolved.
 */
export async function hireAgentViaErc8183({
  buyerAddress,
  signer,
  providerAddress,
  task,
  budgetU,
  deadlineSeconds,
}: {
  buyerAddress: Address;
  signer: Signer;
  providerAddress: Address;
  /** The task text, or an anchored signed-quote JSON. */
  task: string;
  /** Budget in raw $U units (18 decimals). */
  budgetU: bigint;
  /** Extra submission time beyond the dispute window, seconds (SDK default 1800). */
  deadlineSeconds?: number;
}): Promise<HireAgentResult> {
  return hireErc8183Agent(
    { address: buyerAddress },
    signer,
    { provider: providerAddress, task, budget: budgetU, deadlineSeconds },
    { network: BNB_TESTNET }
  );
}
