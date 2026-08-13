import { parseAbi } from "viem";

/**
 * Venus Protocol (Compound v2 fork) — minimal ABIs covering what Underwrit's
 * Health Factor Guardian actually calls. Trimmed to the standard Compound-fork
 * surface (identical across every fork, including Venus) rather than the full
 * Diamond-proxy facet set.
 */

export const venusComptrollerAbi = parseAbi([
  "function getAccountLiquidity(address account) view returns (uint256 err, uint256 liquidity, uint256 shortfall)",
  "function enterMarkets(address[] vTokens) returns (uint256[])",
  "function markets(address vToken) view returns (bool isListed, uint256 collateralFactorMantissa, bool isVenus)",
  "function getAssetsIn(address account) view returns (address[])",
]);

/** vBNB (native-asset market) — mint/repay take BNB value directly, no ERC20 approve. */
export const vBnbAbi = parseAbi([
  "function mint() payable",
  "function repayBorrow() payable",
  "function borrow(uint256 borrowAmount) returns (uint256)",
  "function borrowBalanceStored(address account) view returns (uint256)",
  "function balanceOf(address account) view returns (uint256)",
  "function exchangeRateStored() view returns (uint256)",
]);

/** vBEP20 markets (e.g. vUSDT) — amounts as uint256, requires underlying ERC20 approval first. */
export const vBep20Abi = parseAbi([
  "function mint(uint256 mintAmount) returns (uint256)",
  "function repayBorrow(uint256 repayAmount) returns (uint256)",
  "function borrow(uint256 borrowAmount) returns (uint256)",
  "function borrowBalanceStored(address account) view returns (uint256)",
  "function balanceOf(address account) view returns (uint256)",
  "function exchangeRateStored() view returns (uint256)",
  "function underlying() view returns (address)",
]);

export const erc20Abi = parseAbi([
  "function approve(address spender, uint256 amount) returns (bool)",
  "function allowance(address owner, address spender) view returns (uint256)",
  "function balanceOf(address account) view returns (uint256)",
  "function decimals() view returns (uint8)",
]);
