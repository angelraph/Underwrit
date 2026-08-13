"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export function HireButton({ agentId, agentName }: { agentId: string; agentName: string }) {
  const router = useRouter();
  const [status, setStatus] = useState<"idle" | "granting">("idle");

  async function handleHire() {
    setStatus("granting");
    // TODO(week 3): call an API route that runs client.grantSession(...) via
    // @altananetwork/sdk against the user's wallet, writes a Session row via
    // @underwrit/db with the real grantTxHash, then redirects here. Mocked
    // for now so the full journey is clickable end-to-end.
    await new Promise((r) => setTimeout(r, 900));
    router.push(`/hires?granted=${encodeURIComponent(agentName)}&agent=${agentId}`);
  }

  return (
    <button
      onClick={handleHire}
      disabled={status === "granting"}
      className="mt-8 w-full rounded-md bg-accent-dim text-background px-5 py-3 text-sm font-medium hover:bg-accent transition-colors disabled:opacity-60"
    >
      {status === "granting" ? "Granting session…" : "Grant Session & Hire"}
    </button>
  );
}
