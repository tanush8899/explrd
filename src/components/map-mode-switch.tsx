"use client";

import type { MapMode } from "@/lib/types";

const MODES: Array<{ key: MapMode; label: string }> = [
  { key: "city", label: "City" },
  { key: "state", label: "State" },
  { key: "country", label: "Country" },
  { key: "continent", label: "Continent" },
];

type MapModeSwitchProps = {
  mode: MapMode;
  onChange: (mode: MapMode) => void;
  variant?: "light" | "dark";
};

export default function MapModeSwitch({
  mode,
  onChange,
  variant = "light",
}: MapModeSwitchProps) {
  const isDark = variant === "dark";

  return (
    <div
      className={`inline-flex w-full items-center gap-1 rounded-full p-1 sm:w-auto ${
        isDark
          ? "border border-white/10 bg-black/25 backdrop-blur"
          : "border border-slate-200 bg-white"
      }`}
    >
      {MODES.map((option) => (
        <button
          key={option.key}
          type="button"
          onClick={() => onChange(option.key)}
          className={`flex-1 rounded-full px-4 py-2.5 text-sm font-medium transition sm:flex-none ${
            option.key === mode
              ? isDark
                ? "bg-[#f5e6a8] text-[#071421] shadow-[0_12px_28px_rgba(245,230,168,0.18)]"
                : "bg-slate-950 text-white"
              : isDark
                ? "text-white/64 hover:bg-white/[0.06] hover:text-white"
                : "text-slate-600 hover:bg-slate-50 hover:text-slate-950"
          }`}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}
