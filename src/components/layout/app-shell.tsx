"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { APP_NAME } from "@/lib/constants";
import { useData } from "@/lib/store/data";
import { UiProvider } from "@/lib/store/ui";
import { Button, Skeleton, cn } from "@/components/ui";
import { IconMusic, IconRefresh, IconSettings } from "@/components/ui/icons";
import { NAV_ITEMS } from "./nav";
import { Onboarding } from "./onboarding";

export function AppShell({ children }: { children: React.ReactNode }) {
  const { ready, loading, error, reload } = useData();

  if (error && !ready) {
    return (
      <div className="flex min-h-dvh items-center justify-center px-6">
        <div className="card max-w-md space-y-4 p-6 text-center">
          <h1 className="text-base font-semibold">Chargement impossible</h1>
          <p className="text-[13px] leading-relaxed text-muted">{error}</p>
          <p className="text-[12px] leading-relaxed text-faint">
            Vérifiez que les migrations SQL ont bien été appliquées à votre projet Supabase.
          </p>
          <Button variant="primary" onClick={() => void reload()} className="mx-auto">
            <IconRefresh size={16} />
            Réessayer
          </Button>
        </div>
      </div>
    );
  }

  if (!ready && loading) return <ShellSkeleton />;

  return (
    <UiProvider>
      <ShellFrame>{children}</ShellFrame>
    </UiProvider>
  );
}

function ShellFrame({ children }: { children: React.ReactNode }) {
  const { profile } = useData();

  if (profile && !profile.onboarding_done) return <Onboarding />;

  return (
    <div className="flex min-h-dvh">
      <Sidebar />
      <div className="flex min-w-0 flex-1 flex-col">
        <MobileHeader />
        <main className="flex-1 pb-24 lg:pb-0">{children}</main>
      </div>
      <MobileNav />
    </div>
  );
}

// --- Barre latérale (ordinateur) --------------------------------------------

/**
 * Trois destinations, un logo, une icône de réglages. Rien d'autre : la barre
 * latérale sert à se déplacer, pas à filtrer ni à créer.
 */
function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="sticky top-0 hidden h-dvh w-[196px] shrink-0 flex-col border-r border-line bg-surface/30 lg:flex">
      <Link href="/studio" className="flex h-16 items-center gap-2.5 px-5">
        <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-accent-soft text-accent">
          <IconMusic size={17} />
        </span>
        <span className="text-[16px] font-semibold tracking-tight">{APP_NAME}</span>
      </Link>

      <nav className="flex flex-col gap-1 px-3 py-2">
        {NAV_ITEMS.map((item) => {
          const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              aria-current={active ? "page" : undefined}
              className={cn(
                "flex items-center gap-3 rounded-xl px-3 py-2.5 text-[14px] font-medium transition-colors duration-100",
                active
                  ? "bg-surface-3 text-ink"
                  : "text-muted hover:bg-surface-2 hover:text-ink-soft",
              )}
            >
              <Icon size={18} className={active ? "text-accent" : undefined} />
              {item.label}
            </Link>
          );
        })}
      </nav>

      <div className="mt-auto p-3">
        <Link
          href="/parametres"
          aria-label="Paramètres"
          title="Paramètres"
          className={cn(
            "flex h-9 w-9 items-center justify-center rounded-xl transition-colors duration-100",
            pathname.startsWith("/parametres")
              ? "bg-surface-3 text-ink"
              : "text-faint hover:bg-surface-2 hover:text-ink-soft",
          )}
        >
          <IconSettings size={17} />
        </Link>
      </div>
    </aside>
  );
}

// --- Mobile ------------------------------------------------------------------

function MobileHeader() {
  return (
    <header className="sticky top-0 z-30 flex h-14 items-center justify-between border-b border-line bg-canvas/85 px-4 backdrop-blur pt-safe lg:hidden">
      <Link href="/studio" className="flex items-center gap-2">
        <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-accent-soft text-accent">
          <IconMusic size={15} />
        </span>
        <span className="text-[15px] font-semibold tracking-tight">{APP_NAME}</span>
      </Link>
      <Link
        href="/parametres"
        aria-label="Paramètres"
        className="touch-target flex h-9 w-9 items-center justify-center rounded-lg text-faint hover:text-ink"
      >
        <IconSettings size={18} />
      </Link>
    </header>
  );
}

function MobileNav() {
  const pathname = usePathname();

  return (
    <nav className="fixed inset-x-0 bottom-0 z-40 border-t border-line bg-surface/95 backdrop-blur pb-safe lg:hidden">
      <div className="flex items-stretch">
        {NAV_ITEMS.map((item) => {
          const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              aria-current={active ? "page" : undefined}
              className={cn(
                "flex flex-1 flex-col items-center gap-1 px-1 py-2.5 text-[11px] font-medium transition-colors duration-100",
                active ? "text-accent" : "text-muted",
              )}
            >
              <Icon size={22} />
              <span className="truncate">{item.label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}

// --- Chargement --------------------------------------------------------------

function ShellSkeleton() {
  return (
    <div className="flex min-h-dvh">
      <div className="hidden w-[196px] shrink-0 border-r border-line p-4 lg:block">
        <Skeleton className="h-8 w-28" />
        <div className="mt-6 space-y-2">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-10 w-full" />
          ))}
        </div>
      </div>
      <div className="flex-1 p-6">
        <Skeleton className="h-9 w-48" />
        <div className="mt-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {Array.from({ length: 8 }).map((_, i) => (
            <Skeleton key={i} className="h-36 w-full" />
          ))}
        </div>
      </div>
    </div>
  );
}
