const RISK_STYLES: Record<string, string> = {
  Low: "bg-risk-low/15 text-risk-low border-risk-low/30",
  Moderate: "bg-risk-moderate/15 text-risk-moderate border-risk-moderate/30",
  High: "bg-risk-high/15 text-risk-high border-risk-high/30",
};

export function RiskBadge({ risk }: { risk: string }) {
  return (
    <span
      className={`inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium ${RISK_STYLES[risk] ?? ""}`}
    >
      {risk} risk
    </span>
  );
}
