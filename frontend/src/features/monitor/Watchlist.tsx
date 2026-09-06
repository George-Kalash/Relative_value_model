import { useState } from "react";

const KEY = "g10-rv-watchlist-v1";
export function useWatchlist() {
  const [warning, setWarning] = useState<string | null>(null);
  const [pinned, setPinned] = useState<string[]>(() => {
    try {
      const value: unknown = JSON.parse(localStorage.getItem(KEY) ?? "[]");
      return Array.isArray(value)
        ? value.filter(
            (x): x is string => typeof x === "string" && /^[A-Z]{6}$/.test(x),
          )
        : [];
    } catch {
      return [];
    }
  });
  function toggle(id: string) {
    const next = pinned.includes(id)
      ? pinned.filter((p) => p !== id)
      : [...pinned, id];
    setPinned(next);
    try {
      localStorage.setItem(KEY, JSON.stringify(next));
    } catch {
      setWarning(
        "Browser storage is unavailable. Your watchlist will last for this visit.",
      );
    }
  }
  return { pinned, toggle, warning };
}
