type ShareCardProps = {
  profile: {
    display_name: string | null;
    public_slug: string | null;
  };
  stats: {
    totalPlaces: number;
    uniqueCities: number;
    uniqueCountries: number;
    uniqueContinents: number;
    score: number;
  };
};

export default function ShareCard({ profile, stats }: ShareCardProps) {
  return (
    <div className="overflow-hidden rounded-[28px] bg-[#0d1117] text-white">
      <div className="p-5">
        <div className="flex items-start justify-between gap-4">
          <div>
            <div className="text-[10px] font-bold uppercase tracking-[0.26em] text-[#3a4d66]">Explrd Profile</div>
            <div className="mt-2.5 text-xl font-bold tracking-[-0.04em] text-white">
              {profile.display_name?.trim() || "Explrd Traveler"}
            </div>
            <div className="mt-1 text-[11px] font-medium text-[#3a4d66]">
              {profile.public_slug ? `@${profile.public_slug}` : "explorer"}
            </div>
          </div>

          <div className="rounded-2xl border border-[#1a2336] bg-[#111827] px-4 py-3 text-right">
            <div className="text-[10px] font-bold uppercase tracking-[0.22em] text-[#3a4d66]">Score</div>
            <div className="mt-1 text-3xl font-bold tracking-tight text-white">{stats.score}</div>
          </div>
        </div>

        <div className="mt-5 h-px bg-[#161c28]" />

        <div className="mt-5 grid grid-cols-2 gap-x-6 gap-y-4">
          {[
            { label: "Places", value: stats.totalPlaces },
            { label: "Cities", value: stats.uniqueCities },
            { label: "Countries", value: stats.uniqueCountries },
            { label: "Continents", value: stats.uniqueContinents },
          ].map(({ label, value }) => (
            <div key={label}>
              <div className="text-[10px] font-semibold uppercase tracking-[0.22em] text-[#3a4d66]">{label}</div>
              <div className="mt-1 text-2xl font-bold tracking-tight text-white">{value}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
