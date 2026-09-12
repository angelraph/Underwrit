# x402 facilitator: RESOLVED 2026-09-12

All three items below are done and the full paid round-trip is now verified
real. See `docs/altana-u-token-request.md` for the independently-confirmed
tx hashes (claim, hire, and settlement).

1. `X402_FACILITATOR_PRIVATE_KEY` / `X402_FACILITATOR_ADDRESS` / `X402_PAYOUT_ADDRESS`
   set as env vars on the deployment. **Done**, added to Vercel production
   2026-09-07.
2. The facilitator wallet (`X402_FACILITATOR_ADDRESS`) holding a small amount
   of real BSC Testnet BNB for its own settlement gas (it never custodies
   buyer funds; those settle straight to `X402_PAYOUT_ADDRESS`). **Done**,
   funded with 0.02 tBNB 2026-09-12, used ~0.000013 BNB broadcasting the real
   settlement tx below.
3. A buyer wallet holding real testnet $U to actually pay through the
   eip3009 rail and exercise a full round trip. **Done**. Altana SDK 0.9.0
   fixed the relay error that blocked claiming $U (see
   `docs/altana-u-token-request.md`); a script-driven buyer wallet claimed
   10 $U, hired an agent via ERC-8183 for 2, and paid this endpoint for real
   (0.01 $U, HTTP 200, settlement tx
   `0x49b4353f2a25556d86e498e208d5252aac5eac3471c79b774372cdd0c119e3e5`,
   confirmed `status: success` directly on BSC Testnet).
