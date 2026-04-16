type StatCardProps = {
  label: string;
  value: number;
  subtitle?: string;
};

export default function StatCard({ label, value, subtitle }: StatCardProps) {
  return (
    <div className="surface-panel relative overflow-hidden rounded-[26px] p-5">
      <div className="absolute right-0 top-0 h-20 w-20 rounded-full bg-teal-50 blur-2xl" />
      <div className="relative">
        <div className="text-[11px] font-semibold uppercase tracking-[0.22em] text-slate-500">
          {label}
        </div>
        <div className="mt-3 text-3xl font-semibold tracking-tight text-slate-900">{value}</div>
        <div className="mt-3 h-px w-full bg-slate-100" />
        <div className="mt-3 text-sm text-slate-600">
          {subtitle ?? "Growing with every place you save."}
        </div>
      </div>
    </div>
  );
}
