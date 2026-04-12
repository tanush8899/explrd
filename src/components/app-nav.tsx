import Link from "next/link";
import { signOut } from "@/lib/auth";

type AppNavProps = {
  active: "home" | "places" | "profile";
};

export default function AppNav({ active }: AppNavProps) {
  return (
    <header className="sticky top-0 z-20 border-b border-slate-200/80 backdrop-blur supports-[backdrop-filter]:bg-white/70">
      <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-4 sm:px-6 lg:px-8">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-slate-900 text-sm font-semibold text-white">
            Ex
          </div>
          <div>
            <div className="text-base font-semibold tracking-tight text-slate-950">Explrd</div>
            <div className="text-xs text-slate-500">Travel map</div>
          </div>
        </div>

        <nav className="hidden items-center gap-1 rounded-full border border-slate-200 bg-white p-1 md:flex">
          <Link
            href="/"
            className={`rounded-full px-4 py-2 text-sm font-medium ${
              active === "home"
                ? "bg-slate-900 text-white"
                : "text-slate-600 hover:bg-slate-50 hover:text-slate-900"
            }`}
          >
            Map
          </Link>
          <Link
            href="/places"
            className={`rounded-full px-4 py-2 text-sm font-medium ${
              active === "places"
                ? "bg-slate-900 text-white"
                : "text-slate-600 hover:bg-slate-50 hover:text-slate-900"
            }`}
          >
            Places
          </Link>
          <Link
            href="/profile"
            className={`rounded-full px-4 py-2 text-sm font-medium ${
              active === "profile"
                ? "bg-slate-900 text-white"
                : "text-slate-600 hover:bg-slate-50 hover:text-slate-900"
            }`}
          >
            Profile
          </Link>
        </nav>

        <div className="flex items-center gap-2">
          <Link
            href="/profile"
            className="hidden rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 sm:inline-flex"
          >
            Share
          </Link>
          <button
            onClick={() => signOut().then(() => window.location.replace("/login"))}
            className="rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
          >
            Sign out
          </button>
        </div>
      </div>
    </header>
  );
}
