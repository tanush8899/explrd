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

function StatCell({
  label,
  value,
}: {
  label: string;
  value: number;
}) {
  return (
    <div className="rounded-xl border border-[#2a2d31] bg-[#1a1d21] px-4 py-3.5">
      <div className="text-[11px] uppercase tracking-[0.14em] text-[#6b7075]">{label}</div>
      <div className="mt-1.5 text-2xl font-semibold tracking-tight text-white">{value}</div>
    </div>
  );
}

export default function ShareCard({ profile, stats }: ShareCardProps) {
  return (
    <div className="overflow-hidden rounded-xl bg-[#111214] text-white">
      <div className="p-5">
        <div className="flex items-start justify-between gap-4">
          <div>
            <div className="text-[11px] uppercase tracking-[0.14em] text-[#6b7075]">Explrd profile</div>
            <div className="mt-2.5 text-2xl font-semibold tracking-[-0.03em] text-white">
              {profile.display_name?.trim() || "Explrd Traveler"}
            </div>
            <div className="mt-1.5 text-sm text-[#6b7075]">
              {profile.public_slug ? `@${profile.public_slug}` : "@choose-a-public-name"}
            </div>
          </div>

          <div className="rounded-xl border border-[#2a2d31] bg-[#1a1d21] px-4 py-3 text-right">
            <div className="text-[11px] uppercase tracking-[0.14em] text-[#6b7075]">Score</div>
            <div className="mt-1 text-3xl font-semibold tracking-tight text-white">{stats.score}</div>
          </div>
        </div>

        <div className="mt-5 grid grid-cols-2 gap-2.5">
          <StatCell label="Places" value={stats.totalPlaces} />
          <StatCell label="Cities" value={stats.uniqueCities} />
          <StatCell label="Countries" value={stats.uniqueCountries} />
          <StatCell label="Continents" value={stats.uniqueContinents} />
        </div>
      </div>
    </div>
  );
}
