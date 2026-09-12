# Testnet $U request: RESOLVED 2026-09-12

**Both bonus-track items (ERC-8183 buyer-side hire and x402/B402 sell) are
now verified real, end to end, independently confirmed on-chain.** The
history below is kept for the record; skip to the bottom for the resolution.

## Resolution (2026-09-12)

Altana shipped SDK/MCP 0.9.0, fixing the exact relay error in the second
follow-up below. Upgraded this project to it, then used the new
`createPrivateKeySigner` (documented as "server-side or CLI use") to drive
the whole flow from a script, no browser/WebAuthn needed at all. User
funded a fresh buyer wallet (`0xb33e52bb5dece784b735baB75A8Aa63f00f8210E`)
and the x402 facilitator with 0.02 tBNB each. Then, in order, every step
independently verified against BSC Testnet directly, not just trusting the
SDK's own reported status:

1. **$U claim**: `requestTokens()` via `client.execute()`, the exact call
   that hit the relay error before. Now `CONFIRMED`, tx
   `0x4926460a784aecc001605b0d6d399ba58df59e307e9345549ba8c87ab4f4a12f`
   (`status: success`). Buyer's $U balance went from 0 to 10 (read directly
   from the token contract, not from the SDK's own report).
2. **ERC-8183 hire**: `hireErc8183Agent`, buyer hiring Health Factor
   Guardian's wallet (a real ERC-8004 identity on the same registry
   ERC8183_ADDRESSES uses) for 2 $U. Tx
   `0x39c905eb18850b6605308db39367226ce0144b6238e0dfba42126987132ca882`
   (`status: success`, jobId `1218`). Buyer's $U went from 10 to 8.
3. **x402 sell round trip**: granted a session with a $U spend permission,
   approved $U as the session's ERC-1271 signature checker (required for
   the eip3009 rail), then paid the live
   `/api/x402/evidence/[agentId]` endpoint for real. HTTP 200, real
   evidence history returned, settlement tx
   `0x49b4353f2a25556d86e498e208d5252aac5eac3471c79b774372cdd0c119e3e5`
   broadcast by the facilitator itself (`status: success`, gas paid from
   its own funded balance). Buyer's $U went from 8 to 7.99, exactly the
   0.01 $U price.

Nothing here was assumed from an SDK success message alone. Every balance
change and every tx status above was re-read from BSC Testnet directly.

---

Hi, building Underwrit for BNB Chain's "Build the Era" hackathon (agent
marketplace, github.com/angelraph/Underwrit). Going for the Altana bonus
track items: ERC-8183 buyer-side hiring and selling over x402/B402. Both are
fully coded and ready (hireAgentViaErc8183 in apps/web/app/lib/erc8183.ts,
and a live x402 sell endpoint already answering real 402 challenges at
/api/x402/evidence/[agentId]), the only thing blocking a real end-to-end
test of either is funding.

Both need a wallet holding real testnet $U to actually test end to end
(hireErc8183Agent needs it to fund a job; verifying our own x402 sell
endpoint needs a buyer who can pay the eip3009 rail). I've checked and can't
find a self-serve way to get any on BSC Testnet (chain 97): no faucet, no
public mint on the token contract, no DEX liquidity.

Two addresses that could use a small amount:
- Buyer/test wallet: 0x404323dd6dcD39485bEf0E73C5BfD1Ff45F64136
- x402 facilitator (settles our own sell endpoint's payments):
  0xbE3B8F9D79A51B21d972ba3EC973add9d9B02A3c

Even a small amount (enough for a handful of test transactions) would let us
verify both flows for real rather than leaving them untested. Thanks!

---

## Follow-up (send after the message above, once you've tried Method 1)

Tried Method 1 from the docs (calling requestTokens() through the Altana
smart-account wallet via client.execute(), same code as the docs example)
against 0x404323dd6dcD39485bEf0E73C5BfD1Ff45F64136. It reverted with a
generic "Reason: 0x Details: 0x", turned out to just be an underfunded
wallet (0 tBNB for its own gas), not a faucet issue. Funded it and moved on.

## Second follow-up

Retried on a second wallet, freshly funded with 0.03 tBNB, that's never
executed anything before (recovered via recoverFromPasskey, this would be
its first-ever call). Same requestTokens() call, same code as the docs
example. Now getting a different, more specific error straight from the
relay:

"Invalid parameters were provided to the RPC method. Double check you have
provided the correct parameters. URL: https://testnet-relay.altana.network
Request body: {"method":"wallet_sendPreparedCalls",...}"

Could this be related to first-execute account initialization (the
initialRegisterKey prepend mentioned in your SDK docs) not being handled
correctly by the relay for a brand-new account, or is there something else
"invalid" about the request the relay is rejecting? Happy to send the full
request body if useful.
