export interface ActionLike {
  timestamp: Date;
  result: "SUCCESS" | "FAIL";
  gasCost: number | null;
  latencyMs: number | null;
  /** Free-form params — capital amount, if present, should be under `capital`. */
  paramsJson: Record<string, unknown>;
}

export interface EvidenceSnapshotFields {
  confidenceScore: number; // 0-100
  successRate: number; // 0-1
  avgCost: number;
  avgReactionTimeSec: number;
  capitalTested: number;
  daysObserved: number;
  actionsExecuted: number;
  actionsSucceeded: number;
  actionsFailed: number;
}

export interface JobConstraints {
  maxCapital: number;
  maxDailySpend: number;
  maxDrawdownPct: number;
  allowedProtocols: string[];
  withdrawalsAllowed: boolean;
  expiryDays: number;
}

export interface AgentCandidate {
  agentId: string;
  category: string;
  network: "TESTNET" | "MAINNET";
  evidence: EvidenceSnapshotFields;
  netYieldPct: number | null;
  worstDrawdownPct: number | null;
  protocolsUsed: string[];
  avgCostPerAction: number;
}

export interface JobFitResult {
  agentId: string;
  fitScore: number; // 0-100
  breakdown: {
    capabilityMatch: number;
    evidenceConfidence: number;
    reliability: number;
    riskCompatibility: number;
    priceEfficiency: number;
  };
  eligible: boolean;
  ineligibleReason?: string;
}
