"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { BrandMark } from "@/components/brand";
import { ThemeToggle } from "@/components/theme-toggle";
import { loginSchema, type LoginInput } from "@/lib/schemas";
import { useAuth } from "@/lib/client/auth-context";

export default function SignInPage() {
  const { login, user, ready } = useAuth();
  const router = useRouter();
  const [formError, setFormError] = useState<string | null>(null);
  const [showPassword, setShowPassword] = useState(false);

  const {
    register,
    handleSubmit,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<LoginInput>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: "demo@encodr.dev", password: "" },
  });

  useEffect(() => {
    if (ready && user) router.replace("/jobs");
  }, [ready, user, router]);

  const onSubmit = handleSubmit(async (values) => {
    setFormError(null);
    try {
      await login(values.email, values.password);
      router.replace("/jobs");
    } catch (e) {
      setFormError(e instanceof Error ? e.message : "Login failed");
    }
  });

  return (
    <main className="app-shell min-h-screen">
      <div className="absolute right-4 top-4 z-10 sm:right-6 sm:top-6">
        <ThemeToggle />
      </div>

      <div className="mx-auto grid min-h-screen max-w-6xl items-center gap-12 px-5 py-12 lg:grid-cols-[1.05fr_.95fr] lg:px-8">
        <section className="hidden lg:block fade-up">
          <div className="mb-8 flex items-center gap-3">
            <BrandMark />
            <span className="text-sm font-semibold tracking-tight ink">Encodr</span>
          </div>
          <p className="mb-4 inline-flex rounded-full border border-[var(--line)] bg-[var(--fill)] px-3 py-1.5 text-[10px] font-semibold uppercase tracking-[0.16em] faint">
            Media encoding workspace
          </p>
          <h1 className="max-w-xl text-5xl font-semibold leading-[1.05] tracking-[-0.045em] ink xl:text-6xl">
            Encode once. <span className="gradient-text">Ship everywhere.</span>
          </h1>
          <p className="mt-6 max-w-lg text-base leading-7 muted">
            Submit a source, watch the pipeline live, and review renditions — without extra infrastructure.
          </p>

          <div className="mt-10 grid max-w-lg grid-cols-2 gap-3">
            {[
              ["Live", "SSE progress"],
              ["Reliable", "Retryable runs"],
              ["Fast", "Optimistic jobs"],
              ["Clear", "Output renditions"],
            ].map(([title, body], index) => (
              <div key={title} className={`surface rounded-2xl p-4 fade-up fade-up-delay-${Math.min(index + 1, 3)}`}>
                <p className="text-xs font-semibold ink">{title}</p>
                <p className="mt-1 text-xs faint">{body}</p>
              </div>
            ))}
          </div>
        </section>

        <section className="mx-auto w-full max-w-md fade-up fade-up-delay-1">
          <div className="mb-6 lg:hidden">
            <div className="flex items-center gap-3">
              <BrandMark />
              <span className="text-base font-semibold tracking-tight ink">Encodr</span>
            </div>
          </div>

          <div className="surface rounded-[28px] p-6 sm:p-8">
            <div className="mb-8">
              <span className="mb-4 inline-flex size-10 items-center justify-center rounded-2xl border border-indigo-400/20 bg-indigo-500/10 text-indigo-600 dark:text-indigo-200">
                <svg viewBox="0 0 24 24" className="size-5" fill="none" aria-hidden="true">
                  <path d="M7 10V8a5 5 0 0 1 10 0v2" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
                  <rect x="5" y="10" width="14" height="10" rx="2.5" stroke="currentColor" strokeWidth="1.7" />
                  <path d="M12 14v2" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
                </svg>
              </span>
              <h2 className="text-2xl font-semibold tracking-[-0.025em] ink">Welcome back</h2>
              <p className="mt-2 text-sm leading-6 muted">Sign in to manage encode jobs and monitor active runs.</p>
            </div>

            <form onSubmit={onSubmit} className="space-y-5" noValidate>
              <div>
                <label htmlFor="email" className="mb-2 block text-xs font-semibold muted">
                  Email
                </label>
                <input
                  id="email"
                  {...register("email")}
                  type="email"
                  className="input-field"
                  autoComplete="username"
                  spellCheck={false}
                />
                {errors.email && <p className="mt-2 text-xs text-rose-600 dark:text-rose-300">{errors.email.message}</p>}
              </div>

              <div>
                <label htmlFor="password" className="mb-2 block text-xs font-semibold muted">
                  Password
                </label>
                <div className="relative">
                  <input
                    id="password"
                    {...register("password")}
                    type={showPassword ? "text" : "password"}
                    className="input-field pr-12"
                    autoComplete="current-password"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((value) => !value)}
                    className="absolute right-2 top-1/2 grid size-8 -translate-y-1/2 place-items-center rounded-xl text-[var(--faint)] hover:bg-[var(--fill)] hover:text-[var(--ink)]"
                    aria-label={showPassword ? "Hide password" : "Show password"}
                  >
                    <svg viewBox="0 0 24 24" className="size-4" fill="none" aria-hidden="true">
                      {showPassword ? (
                        <>
                          <path d="M3.5 3.5 20.5 20.5" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
                          <path d="M10.6 9.2a3 3 0 0 0 4.2 4.2M9.9 5.5A10.6 10.6 0 0 1 12 5.3c5.1 0 8.2 4.2 9.2 6.2a13.4 13.4 0 0 1-2.8 3.7M6.3 7.2C4.2 8.6 2.9 10.6 2.8 12c.9 1.9 3.8 5.6 8.5 6.6" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
                        </>
                      ) : (
                        <>
                          <path d="M2.8 12c.9-2 4-6.2 9.2-6.2s8.3 4.2 9.2 6.2c-1 2-4.1 6.2-9.2 6.2S3.7 14 2.8 12Z" stroke="currentColor" strokeWidth="1.7" />
                          <circle cx="12" cy="12" r="2.5" stroke="currentColor" strokeWidth="1.7" />
                        </>
                      )}
                    </svg>
                  </button>
                </div>
                {errors.password && <p className="mt-2 text-xs text-rose-600 dark:text-rose-300">{errors.password.message}</p>}
              </div>

              {formError && (
                <div className="rounded-2xl border border-rose-400/25 bg-rose-500/10 px-4 py-3 text-sm text-rose-700 dark:text-rose-200" role="alert">
                  {formError}
                </div>
              )}

              <button
                type="submit"
                disabled={isSubmitting}
                className="btn-primary h-12 w-full text-sm"
              >
                <span className="relative z-10 inline-flex items-center gap-2">
                  {isSubmitting && <span className="size-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />}
                  {isSubmitting ? "Signing you in…" : "Sign in"}
                </span>
                <span className="absolute inset-y-0 -left-1/3 w-1/3 -skew-x-12 bg-white/15 blur-lg transition-transform duration-700 group-hover:translate-x-[420%]" />
              </button>
            </form>

            <div className="mt-6 rounded-2xl border border-dashed border-[var(--line)] bg-[var(--fill)] p-4">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-[10px] font-semibold uppercase tracking-[0.12em] faint">Demo workspace</p>
                  <p className="mt-1 text-xs muted">Use the provided account to review the flow.</p>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setValue("email", "demo@encodr.dev");
                    setValue("password", "password123");
                  }}
                  className="btn-ghost shrink-0"
                >
                  Fill demo
                </button>
              </div>
            </div>
          </div>

          <p className="mt-5 text-center text-[11px] faint">Secure session · short-lived access token · silent refresh</p>
        </section>
      </div>
    </main>
  );
}
