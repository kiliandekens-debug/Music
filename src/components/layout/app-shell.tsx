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
          <p className="text-sm leading-relaxed text-muted">{error}</p>
          <p className="text-sm leading-relaxed text-muted">
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

// --- Rail de navigation (ordinateur) ----------------------------------------

/**
 * Trois destinations, une marque, un accès aux réglages.
 *
 * Un panneau de 196 px pour trois liens laissait les trois quarts de sa hauteur
 * vides et prenait au tableau une largeur dont il a besoin. Le rail garde la
 * navigation visible en permanence, avec l'icône et son mot, sur 76 px — et il
 * parle le même langage que la barre du bas sur téléphone.
 */
function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="sticky top-0 hidden h-dvh w-[76px] shrink-0 flex-col items-center border-r border-line bg-surface/40 py-4 lg:flex">
      <Link
        href="/studio"
        aria-label={APP_NAME}
        title={APP_NAME}
        className="flex h-10 w-10 items-center justify-center rounded-2xl bg-accent-soft text-accent transition-colors duration-100 hover:brightness-125"
      >
        <IconMusic size={19} />
      </Link>

      <nav className="mt-6 flex flex-col items-center gap-1.5">
        {NAV_ITEMS.map((item) => {
          const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              aria-current={active ? "page" : undefined}
              className={cn(
                "group relative flex w-[60px] flex-col items-center gap-1 rounded-2xl px-1 py-2.5 text-label font-medium transition-colors duration-100",
                active
                  ? "bg-surface-3 text-ink"
                  : "text-muted hover:bg-surface-2 hover:text-ink-soft",
              )}
            >
              {/* Repère d'activité : lisible même en vision périphérique. */}
              <span
                className={cn(
                  "absolute -left-2 top-1/2 h-7 w-[3px] -translate-y-1/2 rounded-r-full bg-accent transition-opacity duration-100",
                  active ? "opacity-100" : "opacity-0",
                )}
                aria-hidden
              />
              <Icon size={20} className={active ? "text-accent" : undefined} />
              <span className="truncate">{item.label}</span>
            </Link>
          );
        })}
      </nav>

      <Link
        href="/parametres"
        aria-label="Paramètres"
        title="Paramètres"
        className={cn(
          "mt-auto flex h-10 w-10 items-center justify-center rounded-2xl transition-colors duration-100",
          pathname.startsWith("/parametres")
            ? "bg-surface-3 text-ink"
            : "text-muted hover:bg-surface-2 hover:text-ink-soft",
        )}
      >
        <IconSettings size={18} />
      </Link>
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
        <span className="text-base font-semibold tracking-tight">{APP_NAME}</span>
      </Link>
      <Link
        href="/parametres"
        aria-label="Paramètres"
        className="touch-target flex h-9 w-9 items-center justify-center rounded-lg text-muted hover:text-ink"
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
                "flex flex-1 flex-col items-center gap-1 px-1 py-2.5 text-label font-medium transition-colors duration-100",
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
      <div className="hidden w-[76px] shrink-0 flex-col items-center border-r border-line py-4 lg:flex">
        <Skeleton className="h-10 w-10 rounded-2xl" />
        <div className="mt-6 space-y-1.5">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-14 w-[60px] rounded-2xl" />
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
