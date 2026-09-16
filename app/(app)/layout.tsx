"use client";

import { useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Brand } from "@/components/brand";
import { ThemeToggle } from "@/components/theme-toggle";
import { useAuth } from "@/lib/client/auth-context";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const { user, ready, logout } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (ready && !user) router.replace("/signin");
  }, [ready, user, router]);

  if (!ready || !user) {
    return (
      <main className="mx-auto min-h-screen max-w-5xl px-4 py-8 sm:px-6 lg:px-8">
        <div className="shimmer h-9 w-28 rounded-xl border border-[var(--line)]" />
      </main>
    );
  }

  return (
    <div className="app-shell min-h-screen">
      <div className="mx-auto min-h-screen max-w-6xl px-4 py-5 sm:px-6 lg:px-8">
        <header className="surface surface-glass sticky top-4 z-40 mb-10 flex items-center justify-between rounded-2xl px-3 py-2.5 sm:px-4">
          <Brand />

          <div className="flex items-center gap-2 sm:gap-3">
            <Link
              href="/jobs"
              className="hidden rounded-xl px-3 py-2 text-xs font-medium text-[var(--muted)] hover:bg-[var(--fill)] hover:text-[var(--ink)] sm:block"
            >
              Jobs
            </Link>
            <ThemeToggle />
            <div className="hidden h-5 w-px bg-[var(--line)] sm:block" />
            <div className="flex min-w-0 items-center gap-2">
              <span className="grid size-8 shrink-0 place-items-center rounded-full border border-[var(--line)] bg-[var(--fill)] text-[10px] font-semibold text-[var(--muted)]">
                {user.name.slice(0, 1).toUpperCase()}
              </span>
              <span className="hidden max-w-40 truncate text-xs text-[var(--faint)] sm:block">{user.email}</span>
            </div>
            <button type="button" onClick={logout} className="btn-ghost">
              Sign out
            </button>
          </div>
        </header>

        <main className="fade-up">{children}</main>

        <footer className="mt-20 border-t border-[var(--line)] py-6 text-[11px] text-[var(--faint)]">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <span>Encodr · media encoding workspace</span>
            <span>Live progress via Server-Sent Events</span>
          </div>
        </footer>
      </div>
    </div>
  );
}
