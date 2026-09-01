export function FormError({ message }: { message?: string | null }) {
  if (!message) return null;
  return (
    <p className="rounded-md border border-[var(--color-negative)]/20 bg-[var(--color-negative-muted)] px-3 py-2 text-sm text-[var(--color-negative)]">
      {message}
    </p>
  );
}
