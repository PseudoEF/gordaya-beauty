"use client";

import { useLocale } from "@/lib/i18n/LocaleContext";

// Public demo identity. Replace with the real salon details in a private
// deployment; this repository intentionally ships fictional contact data.
const DEMO_INSTAGRAM_HANDLE = "gordaya_demo";
const DEMO_INSTAGRAM_URL = "https://www.instagram.com/gordaya_demo";

export function SiteFooter() {
  const { t } = useLocale();
  const year = new Date().getFullYear();

  return (
    <footer className="relative z-10 mt-24 px-6 pb-10 pt-8 sm:px-10">
      <div className="divider-line mb-8" />
      <div className="flex flex-col items-center gap-3 text-center text-sm text-text-muted sm:flex-row sm:justify-between sm:text-left">
        <span className="font-serif tracking-widest">
          {t.brand.name} <span className="font-script text-accent">{t.brand.tagline}</span>
        </span>
        <a
          href={DEMO_INSTAGRAM_URL}
          target="_blank"
          rel="noopener noreferrer"
          className="tracking-wide text-accent transition-opacity hover:opacity-80"
        >
          @{DEMO_INSTAGRAM_HANDLE} — {t.footer.instagram}
        </a>
        <span>
          © {year} {t.brand.name}. {t.footer.rights}.
        </span>
      </div>
    </footer>
  );
}
