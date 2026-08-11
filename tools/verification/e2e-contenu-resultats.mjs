/**
 * Parcours complémentaire : planification d'un contenu, enregistrement d'un
 * relevé de résultats, déplacement d'une track dans le pipeline et lecture de
 * l'historique côté label.
 * Nécessite le harnais local (voir le README de ce dossier).
 */

import { chromium } from "playwright";

const BASE = "http://localhost:3111";
const errors = [];
const browser = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium" });
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });

// En mode développement, Next compile chaque route au premier accès : la fiche
// track demande plusieurs secondes. On laisse donc de la marge, sans quoi le
// parcours échouerait sur une lenteur de compilation et non sur un défaut.
page.setDefaultTimeout(30_000);
page.setDefaultNavigationTimeout(30_000);
page.on("pageerror", (e) => errors.push(`PAGE ERROR: ${e.message}`));
page.on("console", (m) => {
  if (m.type() === "error") errors.push(`CONSOLE: ${m.text().slice(0, 200)}`);
});

await page.goto(`${BASE}/connexion`, { waitUntil: "networkidle" });
await page.getByLabel("Adresse e-mail").fill("producteur@exemple.com");
await page.getByRole("button", { name: /Recevoir le lien/ }).click();
await page.getByLabel(/Code reçu/).waitFor();
await page.getByLabel(/Code reçu/).fill("123456");
await page.getByRole("button", { name: "Se connecter" }).click();
await page.waitForURL(/aujourdhui/);
await page.waitForTimeout(2000);

// --- Planifier un contenu ----------------------------------------------------
await page.goto(`${BASE}/releases?onglet=contenus`, { waitUntil: "networkidle" });
await page.waitForTimeout(1500);
await page.getByRole("button", { name: "Planifier" }).first().click();
await page.waitForTimeout(800);
await page.getByLabel("Titre").fill("Teaser vertical");
const when = new Date();
when.setDate(when.getDate() + 5);
await page.getByLabel("Date et heure prévues").fill(`${when.toISOString().slice(0, 10)}T18:00`);
await page.getByRole("button", { name: "Planifier" }).last().click();
await page.waitForTimeout(2500);
if (!(await page.getByText("Teaser vertical").first().isVisible())) {
  throw new Error("Le contenu planifié n'apparaît pas");
}
console.log("✓ Contenu planifié et listé");

// Il doit aussi apparaître dans le calendrier global.
await page.goto(`${BASE}/calendrier`, { waitUntil: "networkidle" });
await page.waitForTimeout(1800);
if ((await page.getByText("Teaser vertical").count()) === 0) {
  throw new Error("Le contenu planifié n'apparaît pas dans le calendrier");
}
console.log("✓ Le contenu apparaît dans le calendrier global");

// --- Enregistrer un relevé de résultats --------------------------------------
await page.goto(`${BASE}/releases?onglet=resultats`, { waitUntil: "networkidle" });
await page.waitForTimeout(1500);
await page.getByRole("button", { name: "Relevé" }).click();
await page.waitForTimeout(900);
// Un relevé par track et par date : on choisit une date libre pour que le
// parcours reste rejouable sans se heurter à la contrainte d'unicité.
const measured = new Date();
measured.setDate(measured.getDate() - Math.floor(Math.random() * 300) - 1);
await page.getByLabel("Date du relevé").fill(measured.toISOString().slice(0, 10));
await page.getByLabel("Streams Spotify").fill("1250");
await page.getByLabel("Auditeurs").fill("830");
await page.getByLabel("Ajouts en playlist").fill("12");
await page.getByLabel("Dépenses publicitaires").fill("40");
await page.getByRole("button", { name: "Ajouter le relevé" }).click();
await page.waitForTimeout(3000);
if (!(await page.getByText("1 250").first().isVisible())) {
  throw new Error("Le relevé de résultats n'apparaît pas");
}
console.log("✓ Relevé de résultats enregistré et affiché");

// --- Déplacer une track dans le pipeline -------------------------------------
await page.goto(`${BASE}/studio`, { waitUntil: "networkidle" });
await page.waitForTimeout(1800);
const card = page.locator("article").first();
const title = (await card.locator("a").first().innerText()).trim();
// On vise une étape différente de l'étape actuelle, pour que le test reste rejouable.
const current = await card.innerText();
const target = current.includes("Mixage") ? "Mastering" : "Mixage";
await card.getByRole("button", { name: "Actions" }).click();
await page.getByRole("menuitem", { name: target, exact: true }).click();
await page.waitForTimeout(2500);
await page.reload({ waitUntil: "networkidle" });
await page.waitForTimeout(2000);
const stageBadge = await page
  .locator("article")
  .filter({ hasText: title })
  .first()
  .innerText();
if (!stageBadge.includes(target)) {
  throw new Error(`La track n'a pas changé d'étape (contenu : ${stageBadge.slice(0, 80)})`);
}
console.log(`✓ « ${title} » déplacée vers ${target}, changement persisté`);

// --- Historique côté label ----------------------------------------------------
await page.goto(`${BASE}/labels`, { waitUntil: "networkidle" });
await page.waitForTimeout(1800);
await page.locator("table tbody tr td button").first().click();
await page.waitForTimeout(1800);
const panel = await page.locator('[role="dialog"]').innerText();
// Le titre est mis en capitales par la feuille de style.
if (!/historique des envois/i.test(panel)) {
  throw new Error("La fiche label n'affiche pas l'historique des envois");
}
console.log("✓ Fiche label ouverte avec statistiques et historique des envois");
await page.screenshot({ path: "/tmp/shots/17-fiche-label.png" });

await browser.close();
console.log("\nErreurs :", errors.length ? errors.join("\n") : "aucune");
process.exit(errors.some((e) => e.includes("PAGE ERROR")) ? 1 : 0);
