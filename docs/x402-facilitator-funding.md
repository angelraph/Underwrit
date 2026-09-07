# x402 facilitator — funding status

The sell endpoint (`/api/x402/evidence/[agentId]`) needs three things to go live:

1. `X402_FACILITATOR_PRIVATE_KEY` / `X402_FACILITATOR_ADDRESS` / `X402_PAYOUT_ADDRESS`
   set as env vars on the deployment. **Done** — added to Vercel production
   2026-09-07.
2. The facilitator wallet (`X402_FACILITATOR_ADDRESS`) holding a small amount
   of real BSC Testnet BNB for its own settlement gas (it never custodies
   buyer funds — those settle straight to `X402_PAYOUT_ADDRESS`). **Not yet
   funded** — checked on-chain 2026-09-07, balance is 0 tBNB. The endpoint
   still correctly issues a 402 challenge without it; it just can't broadcast
   a real settlement transaction yet. Needs a small amount of tBNB sent to
   `X402_FACILITATOR_ADDRESS` before a paid request can actually settle.
3. A buyer wallet holding real testnet $U to actually pay through the
   eip3009 rail and exercise a full round trip. This is the one still
   blocked — see `docs/altana-u-token-request.md`. The endpoint itself is
   live and correctly issues a 402 challenge without it; only the fully
   paid round-trip is unverified.
