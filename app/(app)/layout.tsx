"use client";

import { useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Brand } from "@/components/brand";
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
        <div className="shimmer h-9 w-28 rounded-xl border border-white/8" />
      </main>
    );
  }

  return (
    <div className="app-shell min-h-screen">
      <span className="ambient-orb orb-a" aria-hidden="true" />
      <span className="ambient-orb orb-b" aria-hidden="true" />

      <div className="mx-auto min-h-screen max-w-6xl px-4 py-5 sm:px-6 lg:px-8">
        <header className="surface sticky top-4 z-40 mb-10 flex items-center justify-between rounded-2xl px-3 py-2.5 sm:px-4">
          <Brand />

          <div className="flex items-center gap-2 sm:gap-3">
            <Link
              href="/jobs"
              className="hidden rounded-xl px-3 py-2 text-xs font-medium text-white/55 hover:bg-white/5 hover:text-white sm:block"
            >
              Jobs
            </Link>
            <div className="hidden h-5 w-px bg-white/10 sm:block" />
            <div className="flex min-w-0 items-center gap-2">
              <span className="grid size-8 shrink-0 place-items-center rounded-full border border-white/10 bg-white/5 text-[10px] font-semibold text-white/70">
                {user.name.slice(0, 1).toUpperCase()}
              </span>
              <span className="hidden max-w-40 truncate text-xs text-white/45 sm:block">{user.email}</span>
            </div>
            <button
              type="button"
              onClick={logout}
              className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-xs font-semibold text-white/75 hover:border-white/20 hover:bg-white/8 hover:text-white"
            >
              Sign out
            </button>
          </div>
        </header>

        <main className="fade-up">{children}</main>

        <footer className="mt-20 border-t border-white/8 py-6 text-[11px] text-white/30">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <span>Encodr · media encoding workspace</span>
            <span>Live progress via Server-Sent Events</span>
          </div>
        </footer>
      </div>
    </div>
  );
}
