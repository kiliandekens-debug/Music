"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useUi, type QuickAddKind } from "@/lib/store/ui";
import { Modal, cn } from "@/components/ui";
import { TrackForm } from "@/components/tracks/track-form";
import { TaskForm } from "@/components/tasks/task-form";
import { LabelForm } from "@/components/labels/label-form";
import { SubmissionForm } from "@/components/labels/submission-form";
import { ContactForm, ContentForm, MetricForm } from "@/components/promo/forms";
import { SessionStarter } from "@/components/sessions/session-starter";
import {
  IconChart,
  IconLabel,
  IconMail,
  IconMusic,
  IconNote,
  IconSession,
  IconSparks,
  IconTarget,
  IconCheck,
} from "@/components/ui/icons";

const OPTIONS: {
  kind: QuickAddKind;
  label: string;
  hint: string;
  icon: (props: { size?: number }) => React.ReactElement;
}[] = [
  { kind: "track", label: "Track", hint: "Nouveau morceau", icon: IconMusic },
  { kind: "idee", label: "Idée", hint: "À trier plus tard", icon: IconSparks },
  { kind: "tache", label: "Tâche", hint: "Sur une track", icon: IconCheck },
  { kind: "session", label: "Session", hint: "Commencer à travailler", icon: IconSession },
  { kind: "label", label: "Label", hint: "Nouveau contact label", icon: IconLabel },
  { kind: "envoi", label: "Envoi label", hint: "Track envoyée", icon: IconMail },
  { kind: "contact", label: "Contact promo", hint: "DJ, radio, playlist", icon: IconTarget },
  { kind: "contenu", label: "Contenu", hint: "Publication planifiée", icon: IconNote },
  { kind: "resultat", label: "Résultat", hint: "Relevé de sortie", icon: IconChart },
];

const TITLES: Record<QuickAddKind, string> = {
  track: "Nouvelle track",
  idee: "Nouvelle idée",
  tache: "Nouvelle tâche",
  session: "Démarrer une session",
  label: "Nouveau label",
  envoi: "Nouvel envoi label",
  contact: "Nouveau contact promo",
  contenu: "Nouveau contenu",
  resultat: "Nouveau relevé de résultats",
};

/** Bouton « + » global : un seul point d'entrée pour tout créer. */
export function QuickAdd() {
  const router = useRouter();
  const { quickAdd, closeQuickAdd, openQuickAdd } = useUi();
  const [chooser, setChooser] = useState(true);

  const open = quickAdd !== null;
  const kind = quickAdd ?? "track";

  function close() {
    closeQuickAdd();
    setChooser(true);
  }

  return (
    <Modal
      open={open}
      onClose={close}
      title={chooser ? "Ajouter" : TITLES[kind]}
      size={chooser ? "md" : kind === "resultat" || kind === "envoi" ? "lg" : "md"}
    >
      {chooser ? (
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
          {OPTIONS.map((option) => {
            const Icon = option.icon;
            return (
              <button
                key={option.kind}
                type="button"
                onClick={() => {
                  openQuickAdd(option.kind);
                  setChooser(false);
                }}
                className={cn(
                  "touch-target flex flex-col items-start gap-1.5 rounded-xl border border-line bg-surface-2 p-3 text-left transition-colors duration-100",
                  "hover:border-line-strong hover:bg-surface-3",
                )}
              >
                <span className="text-accent">
                  <Icon size={18} />
                </span>
                <span className="text-[13px] font-medium text-ink">{option.label}</span>
                <span className="text-[11px] text-faint">{option.hint}</span>
              </button>
            );
          })}
        </div>
      ) : (
        <div>
          {kind === "track" || kind === "idee" ? (
            <TrackForm
              compact={kind === "idee"}
              onDone={(trackId) => {
                close();
                router.push(`/studio/${trackId}`);
              }}
              onCancel={close}
            />
          ) : null}

          {kind === "tache" ? <TaskForm onDone={close} onCancel={close} /> : null}

          {kind === "session" ? (
            <SessionStarter
              onStarted={() => {
                close();
                router.push("/sessions/mode");
              }}
              onCancel={close}
            />
          ) : null}

          {kind === "label" ? <LabelForm onDone={close} onCancel={close} /> : null}
          {kind === "envoi" ? <SubmissionForm onDone={close} onCancel={close} /> : null}
          {kind === "contact" ? <ContactForm onDone={close} onCancel={close} /> : null}
          {kind === "contenu" ? <ContentForm onDone={close} onCancel={close} /> : null}
          {kind === "resultat" ? <MetricForm onDone={close} onCancel={close} /> : null}
        </div>
      )}
    </Modal>
  );
}
