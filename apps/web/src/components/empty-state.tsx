type EmptyStateProps = {
  title: string;
  description: string;
};

export default function EmptyState({ title, description }: EmptyStateProps) {
  return (
    <div className="rounded-xl border border-dashed border-[#e1e4e8] bg-[#fafbfc] px-5 py-8 text-center">
      <div className="text-base font-semibold text-[#3d4249]">{title}</div>
      <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-[#868c94]">{description}</p>
    </div>
  );
}
