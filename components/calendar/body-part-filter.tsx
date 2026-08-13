"use client";

import { useState } from "react";

const filters = ["すべて", "胸", "背中", "脚", "肩", "腕", "腹筋", "有酸素"];

export function BodyPartFilter() {
  const [selected, setSelected] = useState("すべて");

  return (
    <div className="-mx-1 mb-4 overflow-x-auto px-1 pb-1">
      <div className="flex min-w-max gap-2">
        {filters.map((filter) => (
          <button
            key={filter}
            type="button"
            onClick={() => setSelected(filter)}
            aria-pressed={selected === filter}
            className={[
              "min-h-10 rounded-[8px] border px-3 text-sm font-medium",
              selected === filter
                ? "border-[var(--accent)] bg-[var(--accent)] text-white"
                : "border-[var(--border)] bg-[var(--surface-soft)] text-[var(--text)]",
            ].join(" ")}
          >
            {filter}
          </button>
        ))}
      </div>
    </div>
  );
}
