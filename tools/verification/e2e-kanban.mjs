/**
 * Vérifie le glisser-déposer du pipeline sur ordinateur : une carte déplacée
 * d'une colonne à l'autre change réellement d'étape, et le changement survit à
 * un rechargement.
 * Nécessite le harnais local (voir le README de ce dossier).
 */

import { chromium } from "playwright";

const BASE = "http://localhost:3111";
const errors = [];
const browser = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium" });
// Large viewport : les colonnes du Kanban n'apparaissent qu'à partir de lg.
const page = await browser.newPage({ viewport: { width: 1600, height: 950 } });
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

await page.goto(`${BASE}/studio`, { waitUntil: "networkidle" });
await page.waitForTimeout(2000);

// Repère la carte à déplacer et son étape de départ.
const card = page.locator("article").first();
const title = (await card.locator("a").first().innerText()).trim();
const columns = page.locator("section").filter({ has: page.locator("h2") });
const columnCount = await columns.count();
if (columnCount < 2) throw new Error("Le tableau Kanban n'affiche pas ses colonnes");

// Choisit une colonne d'arrivée différente de celle où se trouve la carte.
let sourceIndex = -1;
for (let i = 0; i < columnCount; i += 1) {
  if ((await columns.nth(i).innerText()).includes(title)) {
    sourceIndex = i;
    break;
  }
}
if (sourceIndex === -1) throw new Error("Carte introuvable dans une colonne");
const targetIndex = sourceIndex === 0 ? 1 : 0;
const targetName = (await columns.nth(targetIndex).locator("h2").innerText()).trim();

const from = await card.boundingBox();
const to = await columns.nth(targetIndex).boundingBox();
if (!from || !to) throw new Error("Impossible de mesurer les colonnes");

// Glisser-déposer réel : dnd-kit exige un mouvement d'au moins 6 px pour
// démarrer, puis un survol de la zone de dépôt.
await page.mouse.move(from.x + from.width / 2, from.y + 24);
await page.mouse.down();
await page.mouse.move(from.x + from.width / 2 + 20, from.y + 40, { steps: 5 });
await page.mouse.move(to.x + to.width / 2, to.y + 120, { steps: 20 });
await page.waitForTimeout(400);
await page.mouse.up();
await page.waitForTimeout(2500);

const movedInPlace = (await columns.nth(targetIndex).innerText()).includes(title);
if (!movedInPlace) {
  throw new Error(`La carte n'a pas rejoint la colonne « ${targetName} »`);
}
console.log(`✓ « ${title} » glissée vers « ${targetName} »`);

// Le changement doit être enregistré, pas seulement affiché.
await page.reload({ waitUntil: "networkidle" });
await page.waitForTimeout(2500);
const columnsAfter = page.locator("section").filter({ has: page.locator("h2") });
const stillThere = (await columnsAfter.nth(targetIndex).innerText()).includes(title);
if (!stillThere) throw new Error("Le déplacement n'a pas été enregistré");
console.log("✓ Changement d'étape persisté après rechargement");

// L'historique de la track doit garder trace du déplacement.
await page.locator("article").filter({ hasText: title }).first().locator("a").first().click();
await page.waitForURL(/\/studio\/[0-9a-f-]+/);
await page.waitForTimeout(1500);
await page.getByRole("tab", { name: /Notes et historique/ }).click();
await page.waitForTimeout(1500);
// Les titres de colonnes sont mis en capitales par la feuille de style :
// la comparaison se fait sans tenir compte de la casse.
const history = await page.locator("main").innerText();
if (!history.toLocaleLowerCase("fr").includes(targetName.toLocaleLowerCase("fr"))) {
  throw new Error("Le changement d'étape n'apparaît pas dans l'historique");
}
console.log("✓ Le déplacement est consigné dans l'historique de la track");

await browser.close();
console.log("\nErreurs :", errors.length ? errors.join("\n") : "aucune");
process.exit(errors.some((e) => e.includes("PAGE ERROR")) ? 1 : 0);
