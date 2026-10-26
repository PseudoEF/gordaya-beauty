"use client";

import Link from "next/link";
import { useLocale } from "@/lib/i18n/LocaleContext";
import { SiteHeader } from "./SiteHeader";
import { SiteFooter } from "./SiteFooter";

interface PriceItemDTO {
  id: string;
  labelUa: string;
  labelRu: string;
  amount: number;
  isSurcharge: boolean;
}

interface ServiceDTO {
  id: string;
  slug: string;
  nameUa: string;
  nameRu: string;
  durationMin: number;
  priceFrom: number | null;
  noteUa: string | null;
  noteRu: string | null;
  priceItems: PriceItemDTO[];
}

export function HomeClient({ services }: { services: ServiceDTO[] }) {
  const { t, locale } = useLocale();

  return (
    <div className="relative min-h-screen overflow-hidden">
      <div className="grain-overlay" />
      <div
        aria-hidden
        className="pointer-events-none absolute -top-40 left-1/2 h-[36rem] w-[36rem] -translate-x-1/2 rounded-full opacity-30 blur-3xl"
        style={{
          background:
            "radial-gradient(circle, var(--color-accent) 0%, transparent 70%)",
        }}
      />

      <SiteHeader />

      <main className="relative z-10">
        {/* Hero */}
        <section className="flex flex-col items-center px-6 pb-24 pt-16 text-center sm:pt-24">
          <span className="mb-6 text-xs uppercase tracking-[0.4em] text-text-muted">
            {t.hero.kicker}
          </span>
          <h1 className="max-w-3xl whitespace-pre-line font-serif text-4xl font-light leading-tight text-text sm:text-6xl">
            {t.hero.title}
          </h1>
          <p className="mt-3 font-script text-4xl text-accent sm:text-5xl">
            {t.brand.tagline}
          </p>
          <p className="mt-6 max-w-xl text-balance text-base leading-relaxed text-text-muted sm:text-lg">
            {t.hero.subtitle}
          </p>
          <a
            href="#services"
            className="mt-10 rounded-full border border-accent px-8 py-3 text-sm uppercase tracking-[0.2em] text-accent transition-colors hover:bg-accent-soft"
          >
            {t.hero.cta}
          </a>
        </section>

        <div className="divider-line mx-6 sm:mx-10" />

        {/* Services */}
        <section id="services" className="px-6 py-20 sm:px-10">
          <div className="mx-auto mb-14 max-w-2xl text-center">
            <span className="text-xs uppercase tracking-[0.4em] text-text-muted">
              {t.brand.tagline}
            </span>
            <h2 className="mt-3 font-serif text-3xl font-light text-text sm:text-4xl">
              {t.services.title}
            </h2>
          </div>

          <div className="mx-auto grid max-w-4xl gap-6 sm:grid-cols-2">
            {services.map((service) => {
              const name = locale === "ua" ? service.nameUa : service.nameRu;
              const note = locale === "ua" ? service.noteUa : service.noteRu;
              return (
                <div
                  key={service.id}
                  className="group flex flex-col justify-between rounded-2xl border border-border bg-card p-8 transition-colors hover:border-accent/60"
                >
                  <div>
                    <div className="flex items-baseline justify-between gap-3">
                      <h3 className="font-serif text-2xl font-light text-text sm:text-3xl">
                        {name}
                      </h3>
                      <span className="whitespace-nowrap text-sm tracking-wide text-text-muted">
                        {t.services.duration}
                      </span>
                    </div>

                    {service.priceItems.length > 0 ? (
                      <ul className="mt-4 border-t border-border">
                        {service.priceItems.map((item) => (
                          <li
                            key={item.id}
                            className="flex items-baseline justify-between gap-4 border-b border-border py-3 text-sm text-text-muted"
                          >
                            <span>{locale === "ua" ? item.labelUa : item.labelRu}</span>
                            <span className="whitespace-nowrap font-serif text-accent">
                              {item.isSurcharge ? "+" : ""}
                              {item.amount} {t.services.currency}
                            </span>
                          </li>
                        ))}
                      </ul>
                    ) : service.priceFrom != null ? (
                      <p className="mt-4 font-serif text-xl text-accent">
                        {t.services.priceFrom} {service.priceFrom} {t.services.currency}
                      </p>
                    ) : (
                      <p className="mt-4 font-serif text-xl text-accent">
                        {t.services.askPrice}
                      </p>
                    )}

                    {note && (
                      <p className="mt-3 text-xs leading-relaxed text-text-muted">{note}</p>
                    )}
                  </div>
                  <Link
                    href={`/booking/${service.slug}`}
                    className="mt-8 inline-flex items-center justify-center rounded-full bg-accent px-6 py-3 text-sm uppercase tracking-[0.2em] text-bg transition-opacity hover:opacity-90"
                  >
                    {t.services.bookButton}
                  </Link>
                </div>
              );
            })}
          </div>
        </section>
      </main>

      <SiteFooter />
    </div>
  );
}
