/**
 * Appends one line to action-journal.jsonl for every run that broadcast a
 * transaction. packages/db/scripts/sync*.ts reads this file, so every real
 * action reaches Underwrit's Action table on the next sync without anyone
 * copying tx hashes into a script by hand (which is how the Rebalancer's
 * Aug 17 to Sep 10 history went unrecorded).
 *
 * The sync side doesn't take this file's word for anything: it re-reads
 * each hash from the chain and labels it from its own calldata. The one
 * thing only the agent knows is `detectedAt`, the moment it read the state
 * that made it act, which is what lets the sync measure response time.
 */

import { appendFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

export const JOURNAL_PATH = fileURLToPath(new URL("../action-journal.jsonl", import.meta.url));

export interface JournalEntry {
  action: string;
  detectedAt: string;
  legs: { hash: string; type?: string }[];
  params?: Record<string, unknown>;
}

export function recordAction(entry: JournalEntry): void {
  if (entry.legs.length === 0) return;
  appendFileSync(JOURNAL_PATH, JSON.stringify(entry) + "\n");
}
