type SectionHeadingProps = {
  eyebrow?: string;
  title: string;
  description: string;
};

export default function SectionHeading({
  eyebrow,
  title,
  description,
}: SectionHeadingProps) {
  return (
    <div className="space-y-2">
      {eyebrow ? <div className="section-kicker">{eyebrow}</div> : null}
      <div className="text-xl font-semibold tracking-tight text-slate-900">{title}</div>
      <p className="max-w-2xl text-sm leading-6 text-slate-600">{description}</p>
    </div>
  );
}
