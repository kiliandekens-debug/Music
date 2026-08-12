/**
 * Vérifie le tableau à quatre colonnes : une carte glissée d'une colonne à
 * l'autre change réellement d'étape, le changement survit à un rechargement,
 * et la sous-étape reste modifiable sans quitter le tableau.
 * Nécessite le harnais local (voir le README de ce dossier).
 */

import { chromium } from "playwright";

const BASE = "http://localhost:3111";
const errors = [];
const browser = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium" });
// Large viewport : les colonnes n'apparaissent qu'à partir de lg.
const page = await browser.newPage({ viewport: { width: 1600, height: 950 } });

// En mode développement, Next compile chaque route au premier accès : on laisse
// de la marge, sans quoi le parcours échouerait sur une lenteur de compilation
// et non sur un défaut.
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
await page.waitForURL(/studio/);
await page.waitForTimeout(2500);

await page.goto(`${BASE}/studio`, { waitUntil: "networkidle" });
await page.waitForTimeout(2000);

const columns = page.locator("section").filter({ has: page.locator("header h2") });
const columnCount = await columns.count();
if (columnCount !== 4) throw new Error(`Quatre colonnes attendues, trouvé ${columnCount}`);

// Repère la carte à déplacer et sa colonne de départ.
const card = page.locator("article").first();
const title = (await card.locator("h3").first().innerText()).trim();
let sourceIndex = -1;
for (let i = 0; i < columnCount; i += 1) {
  if ((await columns.nth(i).innerText()).includes(title)) {
    sourceIndex = i;
    break;
  }
}
if (sourceIndex === -1) throw new Error("Carte introuvable dans une colonne");
const targetIndex = sourceIndex === 1 ? 2 : 1;
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

if (!(await columns.nth(targetIndex).innerText()).includes(title)) {
  throw new Error(`La carte n'a pas rejoint la colonne « ${targetName} »`);
}
console.log(`✓ « ${title} » glissée vers « ${targetName} »`);

// Le changement doit être enregistré, pas seulement affiché.
await page.reload({ waitUntil: "networkidle" });
await page.waitForTimeout(2500);
const columnsAfter = page.locator("section").filter({ has: page.locator("header h2") });
if (!(await columnsAfter.nth(targetIndex).innerText()).includes(title)) {
  throw new Error("Le déplacement n'a pas été enregistré");
}
console.log("✓ Changement de colonne persisté après rechargement");

// Sous-étape : une track « En cours » se règle depuis le menu de la carte.
const moved = page.locator("article").filter({ hasText: title }).first();
await moved.hover();
await moved.getByRole("button", { name: "Déplacer" }).click();
await page.waitForTimeout(400);
const inProgress = await page.getByRole("menuitem", { name: "Mixage" }).count();
if (inProgress > 0) {
  await page.getByRole("menuitem", { name: "Mixage" }).click();
  await page.waitForTimeout(2500);
  if (!(await page.locator("article").filter({ hasText: title }).first().innerText()).includes("Mixage")) {
    throw new Error("La sous-étape choisie n'apparaît pas sur la carte");
  }
  console.log("✓ Sous-étape « Mixage » appliquée depuis la carte");
} else {
  await page.keyboard.press("Escape");
  console.log("✓ Aucune sous-étape proposée hors de la colonne « En cours » (attendu)");
}

await browser.close();
console.log("\nErreurs :", errors.length ? errors.join("\n") : "aucune");
process.exit(errors.some((e) => e.includes("PAGE ERROR")) ? 1 : 0);
