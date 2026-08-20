# Underwrit — Live Demo Script

Target: under 5 minutes, matches the flow judges are told to expect (functionality + data quality + agent diversity, plus the three partner tracks). Every number shown on screen is real — pulled live from Postgres or read live from BSC Testnet — nothing in this script is staged or scripted data.

Practice this out loud at least twice before submission day. Times below are cumulative, not per-step — they're a pacing guide, not a stopwatch to hit exactly.

---

## 0:00 – Open on the landing page (`/`)

**Say:** "Underwrit is the BNB agent marketplace where agents have to prove what they can do — with real evidence, not a profile — before anyone hires them. Right now there are over 200,000 ERC-8004 agents registered on BSC and no real way to compare them or trust them. That's the problem we're solving."

**Do:** Point at the terminal bar. Don't type yet — first pan down to the four categories and the second row (Discover, Arena, Opportunities, My Hires) so judges see the shape of the product in one screen.

**Say:** "Four agent categories, all built and running for real on testnet: Health Factor protection, Yield routing, Rebalancing, and Grid trading. Every one of them has actually executed real transactions — I'll show you."

---

## 0:45 – Job Contract → Job Fit (`/job/new` → `/job/[id]`)

**Do:** Type an objective into the terminal bar, e.g. `Protect my Venus position from liquidation`, submit.

**Say:** "This isn't a search box — it produces a real Job Contract with constraints, and the agents underneath get scored against it live: capability, evidence, reliability, risk fit, and price efficiency. Nothing here is a black-box recommendation."

**Do:** Open the ranked results, point at the Job Fit score bars and the fact that the ranking is computed from real logged evidence, not a static rating.

---

## 1:30 – Performance Passport (`/agents/[id]`)

**Do:** Click into the top-ranked agent — ideally Health Factor Guardian, since it has the clearest before/after story (a real forced at-risk check that triggered a real repay).

**Say:** "This is the Performance Passport. Confidence score, capital actually tested, actions executed and their success rate, average cost, net yield where it applies. Every one of these numbers traces back to a real on-chain transaction hash — not a count, not a synthetic figure."

**Do:** Scroll to the Action log, click through to one real tx hash on BscScan Testnet live, let it resolve on screen.

**Say:** "That's not a mockup — that's the actual repay transaction this agent executed when a testnet Venus position went under threshold."

---

## 2:30 – Trial (`/job/[id]/trial`)

**Do:** Run the Trial.

**Say:** "Before anyone commits capital, Trial replays the agent's actual decision logic against live chain state right now — read-only, no signing, no spend. For Health Factor that's a real Comptroller check; for Rebalancer it's a real position-range check against the live pool. This tells you what the agent would do today, not what it did once in a backtest."

---

## 3:15 – Hire (`/job/[id]/hire`) — the Altana moment

**Say:** "Hiring isn't a database write — it's a real Altana session grant on BSC Testnet, with an on-chain-enforced spend cap, a call allowlist limited to the agent's own contracts, and an expiry. All visible, all revocable."

**Do:** Walk through the Can/Cannot permission envelope on screen before clicking Hire — this is the screen Altana's judges are specifically told to look for.

**[HANDOFF POINT — see note below]** Click Hire. This triggers a real WebAuthn passkey prompt — it needs an actual human click, not the mouse-driven walkthrough; do this step live, in your own hands, during the real recording/demo rather than relying on any earlier automated pass.

**Say (while the session grant confirms):** "That's a real `grantSession` transaction, addressable right now on Altana's explorer — not BscScan, since Altana's own Keystore explorer is the actual proof destination the judges confirmed for this track."

---

## 4:00 – My Hires → Revoke (`/hires`)

**Do:** Show the active session: spend used vs. cap, expiry.

**Say:** "And it's revocable in one click, live." Click Revoke, let the real `revokeSession` transaction confirm on screen.

---

## 4:30 – Close on breadth (10–15 seconds each, pick two or three depending on time)

Pick whichever of these best fits the remaining time and the judges in the room:

- **Discover (`/discover`)** — "This is the other half of the 200,000-agent problem: real third-party agents pulled live from 8004scan, clearly labeled as third-party evidence, never blended with our own."
- **Arena (`/arena`)** — "Every one of our four agents ranked on its own real evidence, side by side."
- **Opportunities (`/opportunities`)** — "Live PancakeSwap pool data across all four fee tiers, recommending the Rebalancer agent where there's a real signal."
- **Advantage Report (`/advantage-report`)** — "Auto-generated from real logged Action data — agent-assisted outcome versus a labeled, methodology-shown manual estimate. This is the TermiX track's real-task requirement, not three examples written by hand."

**Close:** "Every number in this product is real — a real transaction hash, a real chain read, or a real evidence snapshot computed from one. Four categories, equal depth, three partner tracks built into the core mechanic instead of bolted on at the end. That's Underwrit."

---

## Handoff note — the one step that can't be automated

The Hire click triggers a genuine WebAuthn passkey ceremony (no seed phrase, no browser extension). Browser automation can drive every other click in this script, but this one needs a real human hand on the mouse/keyboard at the moment of the click — the OS-level WebAuthn UI won't respond to a scripted click. **Do this step yourself, live**, whether in rehearsal or on the actual recording. Everything before and after it can be prepared/tested with automation.

## Fallback / if something doesn't load live

- If a live 8004scan call is slow (rate-limited or cold), the Discover page and Advantage Report both work with cached snapshots already in Postgres — no need to apologize, just keep talking.
- If BscScan Testnet or Altana's explorer is slow to resolve, keep the tx hash visible on screen and say "you can verify this independently at [hash]" rather than waiting on the page load.
- If a live testnet RPC call times out mid-demo (has happened before, self-heals within a few seconds), don't panic-click — it retries.

## One-sentence pitch (for intros / Q&A)

"Underwrit is the BNB agent marketplace where agents have to prove what they can do — with real evidence, not a profile — before anyone hires them."

## Likely judge questions, answered honestly

- **"Is this all testnet?"** — Yes, all four reference agents run on BSC Testnet by design (free to iterate, safe to fail during the build window); the architecture and evidence model both carry a `network` field and are built to grade mainnet evidence higher once agents graduate. Nothing here pretends to be mainnet.
- **"What happens if I ask for a category you don't have evidence for yet?"** — Rebalancing and Grid Trading are both honestly labeled "counterfactual not yet available" rather than showing a fabricated number — the testnet pools genuinely haven't accrued third-party fee volume yet.
- **"Who's actually running these agents right now?"** — A scheduled task on the builder's machine re-runs all four agents' monitors every 6 hours and re-syncs evidence; say so plainly if asked, it's a real (if honestly-scoped) answer, not evasive.
