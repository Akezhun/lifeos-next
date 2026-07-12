export function MetricCard({ label, value, hint }: { label: string; value: string | number; hint?: string }) {
  return (
    <div className="life-card p-5">
      <div className="text-sm font-semibold text-white/50">{label}</div>
      <div className="mt-2 text-3xl font-black tracking-tight">{value}</div>
      {hint && <div className="mt-2 text-xs text-white/42">{hint}</div>}
    </div>
  );
}
