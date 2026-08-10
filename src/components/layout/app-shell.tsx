"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { APP_NAME, accentHex } from "@/lib/constants";
import { useData } from "@/lib/store/data";
import { UiProvider, useUi } from "@/lib/store/ui";
import { SessionProvider } from "@/lib/store/session";
import { Button, IconButton, Skeleton, cn } from "@/components/ui";
import { IconMusic, IconPlus, IconRefresh, IconSearch } from "@/components/ui/icons";
import { MOBILE_NAV_ITEMS, NAV_ITEMS } from "./nav";
import { QuickAdd } from "./quick-add";
import { ActiveSessionBar } from "./active-session-bar";
import { GlobalSearch } from "./global-search";
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
      <SessionProvider>
        <ShellFrame>{children}</ShellFrame>
      </SessionProvider>
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
        <TopBar />
        <main className="flex-1 pb-28 lg:pb-8">{children}</main>
      </div>
      <MobileNav />
      <QuickAdd />
      <ActiveSessionBar />
    </div>
  );
}

// --- Barre latérale (ordinateur) --------------------------------------------

function Sidebar() {
  const pathname = usePathname();
  const { workspaces } = useData();
  const { workspaceId, setWorkspaceId } = useUi();
  const visible = workspaces.filter((w) => !w.archived);

  return (
    <aside className="sticky top-0 hidden h-dvh w-[224px] shrink-0 flex-col border-r border-line bg-surface/40 lg:flex">
      <div className="flex h-14 items-center gap-2.5 px-4">
        <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-accent-soft text-accent">
          <IconMusic size={16} />
        </span>
        <span className="text-[15px] font-semibold tracking-tight">{APP_NAME}</span>
      </div>

      <nav className="flex flex-col gap-0.5 px-2.5 py-2">
        {NAV_ITEMS.map((item) => {
          const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-[13px] font-medium transition-colors duration-100",
                active
                  ? "bg-surface-3 text-ink"
                  : "text-muted hover:bg-surface-2 hover:text-ink-soft",
              )}
            >
              <Icon size={17} className={active ? "text-accent" : undefined} />
              {item.label}
            </Link>
          );
        })}
      </nav>

      <div className="mt-4 flex min-h-0 flex-1 flex-col px-2.5">
        <p className="px-2.5 pb-1.5 text-[11px] font-semibold uppercase tracking-wide text-faint">
          Espaces
        </p>
        <div className="flex flex-col gap-0.5 overflow-y-auto">
          <WorkspaceLink
            active={workspaceId === "tous"}
            onClick={() => setWorkspaceId("tous")}
            label="Tous les espaces"
          />
          {visible.map((workspace) => (
            <WorkspaceLink
              key={workspace.id}
              active={workspaceId === workspace.id}
              onClick={() => setWorkspaceId(workspace.id)}
              label={workspace.name}
              color={accentHex(workspace.color)}
            />
          ))}
        </div>
      </div>

      <div className="border-t border-line p-2.5">
        <Link
          href="/parametres"
          className="block truncate rounded-lg px-2.5 py-2 text-[12px] text-faint hover:bg-surface-2 hover:text-ink-soft"
        >
          Compte et préférences
        </Link>
      </div>
    </aside>
  );
}

function WorkspaceLink({
  active,
  onClick,
  label,
  color,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
  color?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "flex items-center gap-2.5 rounded-lg px-2.5 py-1.5 text-left text-[13px] transition-colors duration-100",
        active ? "bg-surface-2 text-ink" : "text-muted hover:text-ink-soft",
      )}
    >
      <span
        className="h-2 w-2 shrink-0 rounded-full"
        style={{ backgroundColor: color ?? "var(--color-line-strong)" }}
        aria-hidden
      />
      <span className="truncate">{label}</span>
    </button>
  );
}

// --- Barre supérieure --------------------------------------------------------

function TopBar() {
  const pathname = usePathname();
  const { workspaces } = useData();
  const { workspaceId, setWorkspaceId, openQuickAdd } = useUi();
  const [searchOpen, setSearchOpen] = useState(false);
  const visible = workspaces.filter((w) => !w.archived);
  const current = visible.find((w) => w.id === workspaceId);
  const title = NAV_ITEMS.find(
    (item) => pathname === item.href || pathname.startsWith(`${item.href}/`),
  )?.label;

  return (
    <>
      <header className="sticky top-0 z-30 flex h-14 items-center gap-2 border-b border-line bg-canvas/85 px-4 backdrop-blur pt-safe lg:px-6">
        <div className="flex min-w-0 flex-1 items-center gap-2">
          <span className="hidden text-[15px] font-semibold lg:block">{title}</span>

          {/* Sélecteur d'espace : chips sur grand écran, liste déroulante sinon */}
          <div className="no-scrollbar hidden items-center gap-1 overflow-x-auto xl:flex">
            <WorkspaceChip
              label="Tous"
              active={workspaceId === "tous"}
              onClick={() => setWorkspaceId("tous")}
            />
            {visible.map((workspace) => (
              <WorkspaceChip
                key={workspace.id}
                label={workspace.name}
                color={accentHex(workspace.color)}
                active={workspaceId === workspace.id}
                onClick={() => setWorkspaceId(workspace.id)}
              />
            ))}
          </div>

          <div className="relative xl:hidden">
            <select
              value={workspaceId}
              onChange={(e) => setWorkspaceId(e.target.value)}
              aria-label="Espace"
              className="h-9 max-w-[190px] appearance-none truncate rounded-lg border border-line bg-surface-2 pl-3 pr-7 text-[13px] text-ink"
            >
              <option value="tous">Tous les espaces</option>
              {visible.map((workspace) => (
                <option key={workspace.id} value={workspace.id}>
                  {workspace.name}
                </option>
              ))}
            </select>
            <span
              className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-faint"
              aria-hidden
            >
              ▾
            </span>
          </div>
        </div>

        <div className="flex items-center gap-1.5">
          <IconButton label="Rechercher" onClick={() => setSearchOpen(true)}>
            <IconSearch size={18} />
          </IconButton>
          {/* Le libellé disparaît sur petit écran ; le bouton reste une cible tactile confortable. */}
          <Button
            variant="primary"
            size="sm"
            onClick={() => openQuickAdd()}
            aria-label="Ajout rapide"
            className="touch-target px-2.5 sm:px-3.5"
          >
            <IconPlus size={16} />
            <span className="hidden sm:inline">Ajouter</span>
          </Button>
        </div>
      </header>

      {current ? (
        <div
          className="h-0.5 w-full"
          style={{ backgroundColor: accentHex(current.color) }}
          aria-hidden
        />
      ) : null}

      <GlobalSearch open={searchOpen} onClose={() => setSearchOpen(false)} />
    </>
  );
}

function WorkspaceChip({
  label,
  active,
  onClick,
  color,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
  color?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "flex shrink-0 items-center gap-1.5 rounded-lg border px-2.5 py-1 text-[12px] font-medium transition-colors duration-100",
        active
          ? "border-line-strong bg-surface-2 text-ink"
          : "border-transparent text-muted hover:text-ink-soft",
      )}
    >
      {color ? (
        <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: color }} aria-hidden />
      ) : null}
      {label}
    </button>
  );
}

// --- Navigation inférieure (mobile) -----------------------------------------

function MobileNav() {
  const pathname = usePathname();

  return (
    <nav className="fixed inset-x-0 bottom-0 z-40 border-t border-line bg-surface/95 backdrop-blur pb-safe lg:hidden">
      <div className="flex items-stretch">
        {MOBILE_NAV_ITEMS.map((item) => {
          const active =
            pathname === item.href ||
            pathname.startsWith(`${item.href}/`) ||
            (item.href === "/plus" &&
              !MOBILE_NAV_ITEMS.some((m) => m.href !== "/plus" && pathname.startsWith(m.href)));
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex flex-1 flex-col items-center gap-1 px-1 py-2 text-[10px] font-medium transition-colors duration-100",
                active ? "text-accent" : "text-muted",
              )}
            >
              <Icon size={21} />
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
      <div className="hidden w-[224px] shrink-0 border-r border-line p-4 lg:block">
        <Skeleton className="h-7 w-32" />
        <div className="mt-6 space-y-2">
          {Array.from({ length: 8 }).map((_, i) => (
            <Skeleton key={i} className="h-8 w-full" />
          ))}
        </div>
      </div>
      <div className="flex-1 p-6">
        <Skeleton className="h-8 w-48" />
        <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-32 w-full" />
          ))}
        </div>
      </div>
    </div>
  );
}
