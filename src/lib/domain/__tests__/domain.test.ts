import { strict as assert } from "node:assert";
import test from "node:test";
import { computeProgress, trackProgress } from "@/lib/domain/progress";
import {
  computeSubmissionStats,
  statusAfterResponse,
  submissionTiming,
  suggestFollowupDate,
  findExistingSubmissions,
} from "@/lib/domain/submissions";
import { generatePromoPlan, recomputeDueDate } from "@/lib/domain/promo-plan";
import { computeSuggestions } from "@/lib/domain/next-action";

function isoDaysAgo(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() - days);
  return d.toISOString().slice(0, 10);
}

const task = (over: Record<string, unknown> = {}) =>
  ({
    id: Math.random().toString(16).slice(2),
    user_id: "u",
    track_id: "t1",
    title: "Tâche",
    description: null,
    category: "production",
    phase: "production",
    priority: "normale",
    due_date: null,
    weight: 1,
    status: "a_faire",
    estimated_minutes: null,
    actual_minutes: 0,
    position: 0,
    completed_at: null,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    ...over,
  }) as any;

const submission = (over: Record<string, unknown> = {}) =>
  ({
    id: Math.random().toString(16).slice(2),
    user_id: "u",
    track_id: "t1",
    label_id: "l1",
    contact_name: null,
    email_used: null,
    sent_at: null,
    method: "email",
    private_link: null,
    message: null,
    status: "envoye",
    followup_due_date: null,
    last_followup_at: null,
    followup_count: 0,
    responded_at: null,
    responded: false,
    response_type: null,
    response_message: null,
    next_action: null,
    next_action_date: null,
    notes: null,
    archived: false,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    ...over,
  }) as any;

// --- Progression -------------------------------------------------------------

test("la progression pondère par le poids et ignore les tâches écartées", () => {
  const result = computeProgress([
    task({ status: "terminee", weight: 3 }),
    task({ status: "a_faire", weight: 1 }),
    task({ status: "ignoree", weight: 5 }),
  ]);
  assert.equal(result.percent, 75);
  assert.equal(result.total, 2, "la tâche ignorée n'est pas active");
  assert.equal(result.remaining, 1);
});

test("une liste vide vaut 0 % et non NaN", () => {
  assert.equal(computeProgress([]).percent, 0);
  assert.equal(computeProgress([task({ status: "ignoree" })]).percent, 0);
});

test("production et promotion sont indépendantes", () => {
  const { production, promotion } = trackProgress(
    [
      task({ category: "production", status: "terminee" }),
      task({ category: "production", status: "terminee" }),
      task({ category: "promotion", status: "terminee" }),
      task({ category: "promotion", status: "a_faire" }),
      task({ category: "promotion", status: "a_faire" }),
    ],
    [],
  );
  assert.equal(production.percent, 100);
  assert.equal(promotion.percent, 33);
});

test("les tâches de campagne comptent dans la progression promotion", () => {
  const { promotion } = trackProgress(
    [task({ category: "promotion", status: "terminee" })],
    [{ status: "a_faire", weight: 1 } as any],
  );
  assert.equal(promotion.percent, 50);
});

// --- Envois aux labels --------------------------------------------------------

test("le libellé de suivi décrit l'ancienneté de l'envoi", () => {
  const timing = submissionTiming(submission({ sent_at: isoDaysAgo(8) }));
  assert.equal(timing.label, "Envoyé il y a 8 jours");
  assert.equal(timing.sentDays, 8);
  assert.equal(timing.needsFollowup, false);
});

test("une relance à échéance dépassée est signalée en retard", () => {
  const timing = submissionTiming(
    submission({ sent_at: isoDaysAgo(13), followup_due_date: isoDaysAgo(3) }),
  );
  assert.equal(timing.label, "Relance en retard de 3 jours");
  assert.equal(timing.tone, "danger");
  assert.equal(timing.needsFollowup, true);
});

test("une relance prévue demain n'est pas encore à faire", () => {
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  const timing = submissionTiming(
    submission({ sent_at: isoDaysAgo(9), followup_due_date: tomorrow.toISOString().slice(0, 10) }),
  );
  assert.equal(timing.label, "Relance prévue demain");
  assert.equal(timing.needsFollowup, false);
});

test("une réponse affiche le délai qu'elle a mis à arriver", () => {
  const timing = submissionTiming(
    submission({ sent_at: isoDaysAgo(20), responded_at: isoDaysAgo(8), responded: true }),
  );
  assert.equal(timing.label, "Réponse reçue après 12 jours");
  assert.equal(timing.needsFollowup, false);
});

test("un silence prolongé est signalé", () => {
  const timing = submissionTiming(submission({ sent_at: isoDaysAgo(30) }));
  assert.equal(timing.label, "Aucune réponse après 30 jours");
  assert.equal(timing.needsFollowup, true);
});

test("une réponse arrivée le jour même n'affiche pas « 0 jour »", () => {
  const timing = submissionTiming(
    submission({ sent_at: isoDaysAgo(3), responded_at: isoDaysAgo(3), responded: true }),
  );
  assert.equal(timing.label, "Réponse reçue le jour même");
});

test("une réponse négative bascule le statut en refusé", () => {
  assert.equal(statusAfterResponse("negative", "envoye"), "refuse");
  assert.equal(statusAfterResponse("positive", "envoye"), "reponse_recue");
});

test("la date de relance par défaut suit le délai configuré", () => {
  assert.equal(suggestFollowupDate("2026-08-10", 10), "2026-08-20");
  assert.equal(suggestFollowupDate("2026-08-10", 0), null, "aucune relance demandée");
});

test("un envoi en double vers le même label est détecté", () => {
  const existing = [submission({ id: "s1", track_id: "t1", label_id: "l1" })];
  assert.equal(findExistingSubmissions(existing, "t1", "l1").length, 1);
  assert.equal(findExistingSubmissions(existing, "t1", "l2").length, 0);
  assert.equal(
    findExistingSubmissions(existing, "t1", "l1", "s1").length,
    0,
    "l'envoi en cours d'édition ne se compte pas lui-même",
  );
});

test("les statistiques d'envoi reflètent les vraies réponses", () => {
  const stats = computeSubmissionStats([
    submission({ sent_at: isoDaysAgo(20), responded_at: isoDaysAgo(10), responded: true, response_type: "positive", status: "interesse" }),
    submission({ sent_at: isoDaysAgo(20), responded_at: isoDaysAgo(14), responded: true, response_type: "negative", status: "refuse" }),
    submission({ sent_at: isoDaysAgo(5) }),
    submission({ status: "a_contacter" }),
  ]);
  assert.equal(stats.sent, 3, "un envoi sans date n'est pas parti");
  assert.equal(stats.responded, 2);
  assert.equal(Math.round(stats.responseRate), 67);
  assert.equal(stats.positive, 1);
  assert.equal(stats.negative, 1);
  assert.equal(stats.averageResponseDays, 8, "moyenne de 10 et 6 jours");
});

// --- Planning promotionnel ----------------------------------------------------

test("la checklist se calcule à rebours depuis la date de sortie", () => {
  const plan = generatePromoPlan("2026-09-30");
  const first = plan.find((t) => t.title === "Artwork prêt");
  assert.ok(first);
  assert.equal(first!.group_key, "J−28");
  assert.equal(first!.due_date, "2026-09-02", "28 jours avant le 30 septembre");

  const jourJ = plan.find((t) => t.title === "Publication du jour de sortie");
  assert.equal(jourJ!.due_date, "2026-09-30");

  const apres = plan.find((t) => t.title === "Suivi après la sortie");
  assert.equal(apres!.due_date, "2026-10-07", "7 jours après la sortie");
});

test("sans date de sortie, les tâches sont créées sans échéance", () => {
  const plan = generatePromoPlan(null);
  assert.ok(plan.length > 0);
  assert.ok(plan.every((t) => t.due_date === null));
});

test("la checklist reste courte et strictement chronologique", () => {
  const plan = generatePromoPlan("2026-09-30");
  assert.equal(plan.length, 8);
  const offsets = plan.map((t) => t.offset_days);
  assert.deepEqual(offsets, [...offsets].sort((a, b) => a - b));
});

test("changer la date de sortie décale les échéances", () => {
  assert.equal(recomputeDueDate("2026-10-15", -28), "2026-09-17");
  assert.equal(recomputeDueDate(null, -28), null);
});

// --- Moteur « Prochaine action » ---------------------------------------------

const track = (over: Record<string, unknown> = {}) =>
  ({
    id: "t1",
    user_id: "u",
    workspace_id: null,
    stage_id: null,
    title: "Ma track",
    genre: null,
    subgenre: null,
    bpm: null,
    musical_key: null,
    priority: "normale",
    target_date: null,
    release_date: null,
    intended_label_id: null,
    distributor: null,
    ableton_path: null,
    is_blocked: false,
    blocked_reason: null,
    notes: null,
    artwork_url: null,
    artwork_path: null,
    position: 0,
    archived: false,
    last_activity_at: new Date().toISOString(),
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    ...over,
  }) as any;

test("une tâche en retard passe avant une tâche simplement commencée", () => {
  const suggestions = computeSuggestions({
    tracks: [track()],
    tasks: [
      task({ id: "late", title: "En retard", due_date: isoDaysAgo(4) }),
      task({ id: "wip", title: "Commencée", status: "en_cours" }),
    ],
    promoTasks: [],
    submissions: [],
    labels: [],
    inactivityDays: 7,
  });
  assert.equal(suggestions[0].title, "En retard");
  assert.equal(suggestions[0].rule, "tache_urgente");
  assert.match(suggestions[0].reason, /En retard de 4 jours/);
});

test("une relance due passe avant une tâche promo à venir", () => {
  const suggestions = computeSuggestions({
    tracks: [track({ release_date: isoDaysAgo(-20) })],
    tasks: [],
    promoTasks: [{ ...task({ id: "p1", title: "Teaser" }), campaign_id: "c1", group_key: "J-14", offset_days: -14, is_asset: false, due_date: isoDaysAgo(-2) } as any],
    submissions: [submission({ id: "s1", sent_at: isoDaysAgo(15), followup_due_date: isoDaysAgo(2) })],
    labels: [{ id: "l1", name: "Mon Label", allows_followup: true } as any],
    inactivityDays: 7,
  });
  assert.equal(suggestions[0].rule, "relance_label");
  assert.match(suggestions[0].title, /Relancer Mon Label/);
});

test("un label qui refuse les relances n'en génère pas", () => {
  const suggestions = computeSuggestions({
    tracks: [track()],
    tasks: [],
    promoTasks: [],
    submissions: [submission({ sent_at: isoDaysAgo(15), followup_due_date: isoDaysAgo(2) })],
    labels: [{ id: "l1", name: "Mon Label", allows_followup: false } as any],
    inactivityDays: 7,
  });
  assert.equal(suggestions.length, 0);
});

test("une track prioritaire laissée de côté remonte", () => {
  const suggestions = computeSuggestions({
    tracks: [track({ priority: "haute", last_activity_at: new Date(Date.now() - 12 * 86400000).toISOString() })],
    tasks: [task({ id: "next", title: "Reprendre le mix" })],
    promoTasks: [],
    submissions: [],
    labels: [],
    inactivityDays: 7,
  });
  const idle = suggestions.find((s) => s.rule === "track_prioritaire_inactive");
  assert.ok(idle, "la règle d'inactivité doit se déclencher");
  assert.match(idle!.reason, /aucune activité depuis 12 jours/);
});

test("une track archivée ne produit aucune suggestion", () => {
  const suggestions = computeSuggestions({
    tracks: [track({ archived: true, priority: "urgente" })],
    tasks: [task({ due_date: isoDaysAgo(10) })],
    promoTasks: [],
    submissions: [],
    labels: [],
    inactivityDays: 7,
  });
  assert.equal(suggestions.length, 0);
});

test("chaque suggestion expose la règle qui l'a produite", () => {
  const suggestions = computeSuggestions({
    tracks: [track({ priority: "urgente" })],
    tasks: [task({ due_date: isoDaysAgo(2) })],
    promoTasks: [],
    submissions: [],
    labels: [],
    inactivityDays: 7,
  });
  assert.ok(suggestions.every((s) => s.ruleLabel && s.reason && s.href));
});
