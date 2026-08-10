"use client";

import Link from "next/link";
import { APP_NAME } from "@/lib/constants";
import { useData } from "@/lib/store/data";
import { useUi } from "@/lib/store/ui";
import { Card, cn } from "@/components/ui";
import { IconChevronRight, IconPlus } from "@/components/ui/icons";
import { MORE_ITEMS } from "@/components/layout/nav";

/** Écran « Plus » : sections secondaires regroupées pour la navigation mobile. */
export default function MorePage() {
  const { profile, userEmail } = useData();
  const { openQuickAdd } = useUi();

  return (
    <div className="px-4 py-5 lg:px-6">
      <div className="mb-4">
        <h1 className="text-xl font-semibold tracking-tight">{APP_NAME}</h1>
        <p className="mt-0.5 text-[13px] text-muted">
          {profile?.display_name ?? userEmail ?? "Votre espace de production"}
        </p>
      </div>

      <Card className="mb-4 overflow-hidden">
        <ul className="divide-y divide-line">
          {MORE_ITEMS.map((item) => {
            const Icon = item.icon;
            return (
              <li key={item.href}>
                <Link
                  href={item.href}
                  className={cn(
                    "flex touch-target items-center gap-3 px-4 py-3.5 transition-colors",
                    "hover:bg-surface-2",
                  )}
                >
                  <Icon size={19} className="shrink-0 text-accent" />
                  <span className="flex-1 text-[14px] text-ink">{item.label}</span>
                  <IconChevronRight size={16} className="shrink-0 text-faint" />
                </Link>
              </li>
            );
          })}
        </ul>
      </Card>

      <button
        type="button"
        onClick={() => openQuickAdd()}
        className="flex w-full touch-target items-center gap-3 rounded-xl border border-line bg-surface px-4 py-3.5 text-left transition-colors hover:bg-surface-2"
      >
        <IconPlus size={19} className="shrink-0 text-accent" />
        <span className="flex-1 text-[14px] text-ink">Ajout rapide</span>
        <IconChevronRight size={16} className="shrink-0 text-faint" />
      </button>
    </div>
  );
}
