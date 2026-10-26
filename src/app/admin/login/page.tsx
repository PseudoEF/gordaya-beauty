"use client";

import { Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { useLocale } from "@/lib/i18n/LocaleContext";

function LoginForm() {
  const { t } = useLocale();
  const searchParams = useSearchParams();
  const hasError = searchParams.has("error");

  return (
    // Plain native form submission (no JS fetch/onSubmit): the browser
    // handles the POST + redirect + cookie itself in one go, which is the
    // most reliable way to log in across mobile browsers.
    <form
      action="/api/admin/login"
      method="POST"
      className="w-full max-w-sm rounded-2xl border border-border bg-card p-8"
    >
      <h1 className="mb-6 text-center font-serif text-2xl font-light text-text">
        {t.admin.loginTitle}
      </h1>
      <label htmlFor="admin-password" className="mb-1 block text-sm text-text-muted">
        {t.admin.passwordLabel}
      </label>
      <input
        id="admin-password"
        name="password"
        type="password"
        autoComplete="current-password"
        autoFocus
        required
        className="w-full rounded-xl border border-border bg-bg-elevated px-4 py-3 text-text outline-none transition-colors focus:border-accent"
      />
      {hasError && <p className="mt-3 text-sm text-red-400">{t.admin.loginError}</p>}
      <button
        type="submit"
        className="mt-6 w-full rounded-full bg-accent px-6 py-3 text-sm uppercase tracking-[0.2em] text-bg transition-opacity hover:opacity-90"
      >
        {t.admin.loginButton}
      </button>
    </form>
  );
}

export default function AdminLoginPage() {
  return (
    <div className="flex min-h-screen items-center justify-center px-6">
      <Suspense fallback={null}>
        <LoginForm />
      </Suspense>
    </div>
  );
}
