import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Workspace packages ship TS source directly (no build step) — Next needs
  // to transpile them itself rather than treating them as pre-built.
  transpilePackages: ["@underwrit/db", "@underwrit/chain", "@underwrit/evidence-engine"],
};

export default nextConfig;
