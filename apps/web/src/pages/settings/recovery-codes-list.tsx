export function RecoveryCodesList({ codes }: { codes: string[] }) {
  return (
    <div className="grid grid-cols-2 gap-2 rounded-md bg-[var(--color-surface-muted)] p-4 font-mono text-sm text-slate-900">
      {codes.map((code) => (
        <span key={code}>{code}</span>
      ))}
    </div>
  );
}
