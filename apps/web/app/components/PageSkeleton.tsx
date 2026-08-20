export function PageSkeleton({
  maxWidth = "max-w-4xl",
  cards = 3,
}: {
  maxWidth?: string;
  cards?: number;
}) {
  return (
    <div className={`mx-auto ${maxWidth} px-4 sm:px-6 py-12 animate-pulse`}>
      <div className="h-4 w-32 rounded bg-surface" />
      <div className="mt-3 h-8 w-2/3 rounded bg-surface" />
      <div className="mt-3 h-4 w-full max-w-xl rounded bg-surface" />
      <div className="mt-2 h-4 w-4/5 max-w-lg rounded bg-surface" />
      <div className="mt-10 flex flex-col gap-4">
        {Array.from({ length: cards }).map((_, i) => (
          <div key={i} className="h-28 rounded-lg border border-border bg-surface" />
        ))}
      </div>
    </div>
  );
}
