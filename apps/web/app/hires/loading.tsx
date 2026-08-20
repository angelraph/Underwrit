import { PageSkeleton } from "../components/PageSkeleton";

export default function Loading() {
  return <PageSkeleton maxWidth="max-w-3xl" cards={2} />;
}
