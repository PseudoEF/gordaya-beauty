"use client";

import { useLocale } from "@/lib/i18n/LocaleContext";
import { locales } from "@/lib/i18n/dictionaries";

export function LocaleToggle() {
  const { locale, setLocale } = useLocale();

  return (
    <div className="flex items-center gap-1 rounded-full border border-border px-1 py-1 text-xs tracking-wide">
      {locales.map((l) => (
        <button
          key={l}
          onClick={() => setLocale(l)}
          className={`rounded-full px-2.5 py-1 uppercase transition-colors ${
            locale === l
              ? "bg-accent-soft text-accent"
              : "text-text-muted hover:text-text"
          }`}
        >
          {l}
        </button>
      ))}
    </div>
  );
}
