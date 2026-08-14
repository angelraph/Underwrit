/**
 * Load `.studio/.env.local` for standalone scripts run outside the `bag` CLI
 * wrapper. See healthfactormonitor's identical loadEnv.ts for the full
 * rationale — same fix, same reason, duplicated for the same deploy-isolation
 * constraint (this is its own standalone pnpm workspace).
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
