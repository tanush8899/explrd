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
    <div className="rounded-[22px] border border-white/12 bg-white/10 px-4 py-4 backdrop-blur">
      <div className="text-[10px] uppercase tracking-[0.2em] text-white/52">{label}</div>
      <div className="mt-2 text-2xl font-semibold tracking-tight text-white">{value}</div>
    </div>
  );
}

export default function ShareCard({ profile, stats }: ShareCardProps) {
  return (
    <div className="overflow-hidden rounded-[34px] border border-[#184147] bg-[#13252a] text-white shadow-[0_28px_70px_rgba(7,44,52,0.28)]">
      <div className="bg-[radial-gradient(circle_at_top_left,rgba(237,198,154,0.28),transparent_28%),radial-gradient(circle_at_bottom_right,rgba(74,138,145,0.38),transparent_34%),linear-gradient(135deg,#11262a_0%,#19444a_52%,#8e4d30_100%)] p-5">
        <div className="flex items-start justify-between gap-4">
          <div>
            <div className="text-[11px] uppercase tracking-[0.24em] text-white/60">Explrd profile</div>
            <div className="mt-3 text-3xl font-semibold tracking-[-0.05em] text-white">
              {profile.display_name?.trim() || "Explrd Traveler"}
            </div>
            <div className="mt-2 text-sm text-white/72">
              {profile.public_slug ? `@${profile.public_slug}` : "@choose-a-public-name"}
            </div>
          </div>

          <div className="rounded-[22px] border border-white/12 bg-black/15 px-4 py-3 text-right backdrop-blur">
            <div className="text-[10px] uppercase tracking-[0.2em] text-white/50">Score</div>
            <div className="mt-1 text-3xl font-semibold tracking-tight text-white">{stats.score}</div>
          </div>
        </div>

        <div className="mt-5 grid grid-cols-2 gap-3">
          <StatCell label="Places" value={stats.totalPlaces} />
          <StatCell label="Cities" value={stats.uniqueCities} />
          <StatCell label="Countries" value={stats.uniqueCountries} />
          <StatCell label="Continents" value={stats.uniqueContinents} />
        </div>

        <div className="mt-5 rounded-[24px] border border-white/12 bg-black/12 px-4 py-4 text-sm leading-6 text-white/72 backdrop-blur">
          A clean public snapshot of where you have explored so far, centered on the map instead of extra profile noise.
        </div>
      </div>
    </div>
  );
}
