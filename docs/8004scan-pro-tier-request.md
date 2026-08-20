# 8004scan Pro-tier request — draft message for Telegram (t.me/jiayaoqi)

8004scan is an AltLayer product, not an Ethereum Foundation one — the
t.me/ERC8004 group pointed us to AltLayer's founder, Jiayao Qi
(t.me/jiayaoqi), directly. Send there instead.

Free-tier key (30 req/min) is already wired into `apps/web/.env.local`
(`SCAN8004_API_KEY`) and powers the Discover page. This is only needed if
usage during judging risks hitting the free-tier rate limit — send it if/when
that becomes a real concern, not preemptively.

---

Hi — I'm building Underwrit for BNB Chain's "Build the Era" hackathon, an
agent marketplace that scores agents on real on-chain evidence before
they're hired (ERC-8004 based). We use the 8004scan API to power a
"Discover" page that surfaces real third-party BSC agents alongside our own
four reference agents.

We're currently on the free-tier key (30 req/min) and it's been fine for
development, but with judging running Sep 9–23 and live traffic from judges
hitting the Discover page, I'd like to move to the Pro tier (500 req/min) to
be safe. Is there a self-serve path for this, or is manual approval needed
here?

Repo: github.com/angelraph/Underwrit
Free-tier key already in use, happy to share the associated account/email if
useful for lookup.

Thanks!
