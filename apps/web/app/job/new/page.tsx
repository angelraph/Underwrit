import { CATEGORY_LABELS, CATEGORY_ORDER } from "../../lib/mockData";
import { JobContractForm } from "./JobContractForm";

export default async function NewJobPage({
  searchParams,
}: {
  searchParams: Promise<{ category?: string; agent?: string; objective?: string }>;
}) {
  const params = await searchParams;

  return (
    <div className="mx-auto max-w-2xl px-4 sm:px-6 py-12">
      <h1 className="text-2xl font-semibold tracking-tight">Job Contract</h1>
      <p className="mt-2 text-muted">
        Describe the job and the constraints an agent must stay inside. This
        is what the Job Fit Engine actually scores against — not a vague
        prompt.
      </p>

      <JobContractForm
        categories={CATEGORY_ORDER}
        categoryLabels={CATEGORY_LABELS}
        defaultCategory={params.category}
        defaultObjective={params.objective}
      />
    </div>
  );
}
