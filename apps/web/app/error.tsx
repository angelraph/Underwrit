"use client";

// Shown when a page can't load its data, most often the evidence database
// being briefly unreachable. Underwrit never falls back to placeholder
// agents in that case, so this says what happened and offers a retry.
export default function Error({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <div className="mx-auto max-w-xl px-4 sm:px-6 py-24 text-center">
      <h1 className="text-2xl font-semibold tracking-tight">Couldn&apos;t load this page</h1>
      <p className="mt-3 text-muted">
        The evidence database didn&apos;t respond in time. Nothing on this page is shown without real data behind it,
        so it&apos;s blank rather than guessed. This usually clears up within a few seconds.
      </p>
      <button
        type="button"
        onClick={reset}
        className="mt-8 rounded-md bg-accent-dim text-background px-4 py-2.5 text-sm font-medium hover:bg-accent transition-colors"
      >
        Try again
      </button>
    </div>
  );
}
