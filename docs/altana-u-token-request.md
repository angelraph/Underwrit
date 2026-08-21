# Testnet $U request — draft message for Altana Builders Telegram

Send to the Altana Builders Telegram (t.me/+8nOYcIdypZliYjVh), or raise during
office hours if that's sooner. Checked first and confirmed there's no
self-serve path: no faucet for $U anywhere in the docs/SDK, no public mint
function on the testnet token contract (0xc70B87...E5565 on chain 97), and no
PancakeSwap testnet liquidity for it either.

---

Hi — building Underwrit for BNB Chain's "Build the Era" hackathon (agent
marketplace, github.com/angelraph/Underwrit). Going for the Altana bonus
track items: ERC-8183 buyer-side hiring and selling over x402/B402. Both are
fully coded and ready (hireAgentViaErc8183 in apps/web/app/lib/erc8183.ts,
and a live x402 sell endpoint already answering real 402 challenges at
/api/x402/evidence/[agentId]) — the only thing blocking a real end-to-end
test of either is funding.

Both need a wallet holding real testnet $U to actually test end to end
(hireErc8183Agent needs it to fund a job; verifying our own x402 sell
endpoint needs a buyer who can pay the eip3009 rail). I've checked and can't
find a self-serve way to get any on BSC Testnet (chain 97) — no faucet, no
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
generic "Reason: 0x Details: 0x" — turned out to just be an underfunded
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
