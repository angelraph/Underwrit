/**
 * Retry wrapper for transient Neon/Postgres connection failures.
 *
 * Neon's free-tier compute scales to zero after a few minutes of inactivity
 * and takes a moment to wake back up on the next connection. Our sync
 * scripts only run every few hours (see scripts/runAllAgentMonitors.ps1),
 * so every run's first DB touch is very likely a cold start. Prisma's
 * default connect timeout is 5 seconds, and that isn't always enough to
 * cover that wake-up window. That surfaced as intermittent "Can't reach
 * database server" (P1001) failures even though the database itself was
 * never actually down.
 *
 * Every sync script is already idempotent (it skips any txHash already in
 * the Action table), so retrying the whole main() on a transient failure is
 * safe. Worst case it re-reads a few already-synced actions from chain and
 * no-ops on them.
 */

const TRANSIENT_PATTERNS = [
  "Can't reach database server",
  "P1001",
  "P1002",
  "Connection terminated unexpectedly",
  "ECONNRESET",
  "ETIMEDOUT",
];

function isTransientDbError(err: unknown): boolean {
  if (!(err instanceof Error)) return false;
  return TRANSIENT_PATTERNS.some((p) => err.message.includes(p));
}

export async function withDbRetry<T>(
  fn: () => Promise<T>,
  opts: { attempts?: number; baseDelayMs?: number; label?: string } = {},
): Promise<T> {
  const attempts = opts.attempts ?? 4;
  const baseDelayMs = opts.baseDelayMs ?? 3000;
  const label = opts.label ?? "operation";

  let lastErr: unknown;
  for (let attempt = 1; attempt <= attempts; attempt++) {
    try {
      return await fn();
    } catch (err) {
      lastErr = err;
      if (!isTransientDbError(err) || attempt === attempts) throw err;

      const delay = baseDelayMs * 2 ** (attempt - 1);
      console.warn(
        `  ⚠ ${label}: transient DB error on attempt ${attempt}/${attempts}, ` +
          `likely a Neon cold start. Retrying in ${delay}ms.`,
      );
      await new Promise((resolve) => setTimeout(resolve, delay));
    }
  }
  throw lastErr;
}
