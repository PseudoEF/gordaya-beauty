"use client";

import Link from "next/link";
import { useLocale } from "@/lib/i18n/LocaleContext";
import { LocaleToggle } from "./LocaleToggle";

export function SiteHeader() {
  const { t } = useLocale();

  return (
    <header className="relative z-10 flex items-center justify-between px-6 py-6 sm:px-10">
      <Link href="/" className="flex items-baseline gap-2">
        <span className="font-serif text-xl tracking-[0.2em] text-text">
          {t.brand.name}
        </span>
        <span className="hidden font-script text-2xl text-accent sm:inline">
          {t.brand.tagline}
        </span>
      </Link>
      <LocaleToggle />
    </header>
  );
}
