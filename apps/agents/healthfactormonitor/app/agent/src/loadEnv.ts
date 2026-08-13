/**
 * Load `.studio/.env.local` for standalone scripts (seedPosition.ts,
 * monitor.ts) that run outside the `bag` CLI wrapper. `bag dev` / `bag
 * doctor` auto-load this file themselves; a plain `tsx src/foo.ts` does not,
 * so scripts meant to be run directly must import this FIRST, before any
 * code (e.g. `getWallet()`) that reads WALLET_PASSWORD from the environment.
 *
 * No-op (never throws) when the file is absent — a deployed runtime injects
 * secrets directly via Secrets Manager (see main.ts `loadRuntimeSecrets`)
 * and has no `.studio/.env.local` on disk at all.
 */

import { fileURLToPath } from "node:url";
import path from "node:path";

const envPath = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../../../.studio/.env.local",
);

try {
  process.loadEnvFile(envPath);
} catch {
  // absent/unreadable — fine for a deployed runtime or a shell that already
  // exported WALLET_PASSWORD itself.
}
