/**
 * Values an agent wallet's holdings in BNB at any block, using the
 * PancakeSwap WBNB/USDT 0.01% pool's own price at that block. With an
 * archive RPC (see walletHistory.ts) this gives a real starting point for
 * "what if the agent had done nothing": read the balances the block before
 * its first action, then value them at today's price.
 */

import { erc20Abi, formatEther, formatUnits, type PublicClient } from "viem";
import { pancakeV3NfpmAbi, PANCAKESWAP_V3_TESTNET, VENUS_USDT_TESTNET } from "@underwrit/chain";
import { prisma } from "@underwrit/db";

const slot0Abi = [
  {
    type: "function",
    name: "slot0",
    stateMutability: "view",
    inputs: [],
    outputs: [
      { type: "uint160", name: "sqrtPriceX96" },
      { type: "int24", name: "tick" },
      { type: "uint16", name: "observationIndex" },
      { type: "uint16", name: "observationCardinality" },
      { type: "uint16", name: "observationCardinalityNext" },
      { type: "uint32", name: "feeProtocol" },
      { type: "bool", name: "unlocked" },
    ],
  },
] as const;

export interface Holdings {
  native: number;
  wbnb: number;
  usdt: number;
  /** Pool tick the price was read at. token0 is USDT (6 dp), token1 is WBNB (18 dp). */
  tick: number;
  usdtPerBnb: number;
}

export async function readHoldings(client: PublicClient, wallet: `0x${string}`, blockNumber?: bigint): Promise<Holdings> {
  const [native, wbnb, usdt, slot0] = await Promise.all([
    client.getBalance({ address: wallet, blockNumber }),
    client.readContract({ address: PANCAKESWAP_V3_TESTNET.WBNB, abi: erc20Abi, functionName: "balanceOf", args: [wallet], blockNumber }),
    client.readContract({ address: VENUS_USDT_TESTNET, abi: erc20Abi, functionName: "balanceOf", args: [wallet], blockNumber }),
    client.readContract({ address: PANCAKESWAP_V3_TESTNET.wbnbUsdtPool001Pct, abi: slot0Abi, functionName: "slot0", blockNumber }),
  ]);
  const tick = slot0[1];
  const wbnbPerUsdt = (1.0001 ** tick * 1e6) / 1e18;
  return {
    native: Number(formatEther(native)),
    wbnb: Number(formatEther(wbnb)),
    usdt: Number(formatUnits(usdt, 6)),
    tick,
    usdtPerBnb: 1 / wbnbPerUsdt,
  };
}

/** BNB value of a set of holdings, priced at `usdtPerBnb` (pass today's price to value old holdings now). */
export function valueInBnb(h: Pick<Holdings, "native" | "wbnb" | "usdt">, usdtPerBnb: number): number {
  return h.native + h.wbnb + h.usdt / usdtPerBnb;
}

/** The block just before the agent's earliest recorded action, i.e. its untouched starting position. */
export async function startingBlock(client: PublicClient, agentId: string): Promise<bigint | null> {
  const first = await prisma.action.findFirst({ where: { agentId }, orderBy: { timestamp: "asc" } });
  if (!first) return null;
  const receipt = await client.getTransactionReceipt({ hash: first.txHash as `0x${string}` });
  return receipt.blockNumber - 1n;
}

/**
 * Token amounts a PancakeSwap V3 position would pay out if closed at the
 * given tick (standard concentrated-liquidity math, prices as raw
 * token1-per-token0), plus any fees already owed to it.
 */
export function positionAmounts(
  p: { liquidity: bigint; tickLower: number; tickUpper: number; tokensOwed0: bigint; tokensOwed1: bigint },
  tick: number,
): { usdt: number; wbnb: number } {
  const L = Number(p.liquidity);
  const sqrt = (t: number) => Math.sqrt(1.0001 ** t);
  const [sa, sb] = [sqrt(p.tickLower), sqrt(p.tickUpper)];
  const s = Math.min(Math.max(sqrt(tick), sa), sb);
  const raw0 = L * (1 / s - 1 / sb); // USDT, 6 dp
  const raw1 = L * (s - sa); // WBNB, 18 dp
  return { usdt: (raw0 + Number(p.tokensOwed0)) / 1e6, wbnb: (raw1 + Number(p.tokensOwed1)) / 1e18 };
}

export async function readPosition(client: PublicClient, tokenId: bigint, blockNumber?: bigint) {
  const r = await client.readContract({
    address: PANCAKESWAP_V3_TESTNET.nonfungiblePositionManager,
    abi: pancakeV3NfpmAbi,
    functionName: "positions",
    args: [tokenId],
    blockNumber,
  });
  return { tickLower: r[5], tickUpper: r[6], liquidity: r[7], tokensOwed0: r[10], tokensOwed1: r[11] };
}
