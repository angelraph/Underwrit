/**
 * Shared constants for the real Altana hire flow (grant + revoke).
 *
 * The per-agent "$X/day" figure shown elsewhere (Performance Passport,
 * category cards) is an informational proposed-cap comparison across
 * agents, not a live on-chain value — there's no honest USD/tBNB exchange
 * rate to invent for testnet money. The REAL cap actually enforced by the
 * granted Altana session is this fixed, small testnet BNB amount instead —
 * real, checkable on Altana's explorer, and sized consistently with every
 * other real testnet transaction in this project (a few hundredths of a
 * BNB, matching the reference agents' own funding amounts).
 */
export const REAL_SESSION_SPEND_CAP_TBNB = "0.02";

export const BSC_TESTNET_FAUCET_URL = "https://testnet.bnbchain.org/faucet-smart";
