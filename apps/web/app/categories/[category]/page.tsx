import { notFound } from "next/navigation";
import {
  CATEGORY_DESCRIPTIONS,
  CATEGORY_LABELS,
  CATEGORY_ORDER,
  MOCK_AGENTS,
  type Category,
} from "../../lib/mockData";
import { PassportCard } from "../../components/PassportCard";

function resolveCategory(slug: string): Category | null {
  const match = CATEGORY_ORDER.find((c) => c.toLowerCase() === slug.toLowerCase());
  return match ?? null;
}

export default async function CategoryDetailPage({
  params,
}: {
  params: Promise<{ category: string }>;
}) {
  const { category: slug } = await params;
  const category = resolveCategory(slug);
  if (!category) notFound();

  const agents = MOCK_AGENTS.filter((a) => a.category === category);

  return (
    <div className="mx-auto max-w-6xl px-6 py-12">
      <h1 className="text-2xl font-semibold tracking-tight">
        {CATEGORY_LABELS[category]}
      </h1>
      <p className="mt-2 text-muted max-w-2xl">
        {CATEGORY_DESCRIPTIONS[category]}
      </p>

      <div className="mt-8 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {agents.map((agent) => (
          <PassportCard key={agent.id} agent={agent} />
        ))}
        {agents.length === 0 && (
          <p className="text-muted text-sm">
            No agents listed in this category yet.
          </p>
        )}
      </div>
    </div>
  );
}
