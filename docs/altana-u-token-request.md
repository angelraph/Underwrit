# Testnet $U request — draft message for Altana Builders Telegram

Send to the Altana Builders Telegram (t.me/+8nOYcIdypZliYjVh), or raise during
office hours if that's sooner. Checked first and confirmed there's no
self-serve path: no faucet for $U anywhere in the docs/SDK, no public mint
function on the testnet token contract (0xc70B87...E5565 on chain 97), and no
PancakeSwap testnet liquidity for it either.

---

Hi — building Underwrit for BNB Chain's "Build the Era" hackathon (agent
marketplace, github.com/angelraph/Underwrit). Going for the Altana bonus
track items: ERC-8183 buyer-side hiring and selling over x402/B402.

Both need a wallet holding real testnet $U to actually test end to end
(hireErc8183Agent needs it to fund a job; verifying our own x402 sell
endpoint needs a buyer who can pay the eip3009 rail). I've checked and can't
find a self-serve way to get any on BSC Testnet (chain 97) — no faucet, no
public mint on the token contract, no DEX liquidity.

Two addresses that could use a small amount:
- Buyer/test wallet: [insert the Altana passkey wallet address you want to
  test hiring from]
- x402 facilitator (settles our own sell endpoint's payments):
  0xbE3B8F9D79A51B21d972ba3EC973add9d9B02A3c

Even a small amount (enough for a handful of test transactions) would let us
verify both flows for real rather than leaving them untested. Thanks!
