import Link from "next/link";
import {
  CATEGORY_DESCRIPTIONS,
  CATEGORY_LABELS,
  CATEGORY_ORDER,
  MOCK_AGENTS,
} from "../lib/mockData";
import { PassportCard } from "../components/PassportCard";

export default function CategoriesPage() {
  return (
    <div className="mx-auto max-w-6xl px-6 py-12">
      <h1 className="text-2xl font-semibold tracking-tight">
        Browse by category
      </h1>
      <p className="mt-2 text-muted max-w-2xl">
        All four categories are first-class here — same evidence depth, same
        hiring flow, no single category treated as the main event.
      </p>

      <div className="mt-10 flex flex-col gap-12">
        {CATEGORY_ORDER.map((category) => {
          const agents = MOCK_AGENTS.filter((a) => a.category === category);
          return (
            <section key={category}>
              <div className="flex items-baseline justify-between">
                <div>
                  <h2 className="text-lg font-medium">
                    {CATEGORY_LABELS[category]}
                  </h2>
                  <p className="text-sm text-muted">
                    {CATEGORY_DESCRIPTIONS[category]}
                  </p>
                </div>
                <Link
                  href={`/categories/${category.toLowerCase()}`}
                  className="text-sm text-accent hover:underline"
                >
                  View all →
                </Link>
              </div>
              <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {agents.map((agent) => (
                  <PassportCard key={agent.id} agent={agent} />
                ))}
              </div>
            </section>
          );
        })}
      </div>
    </div>
  );
}
