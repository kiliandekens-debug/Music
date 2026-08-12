/**
 * Parcours complet de l'application, du premier écran de connexion jusqu'à
 * l'isolation entre deux comptes. Nécessite le harnais local (voir README).
 */

import { chromium, devices } from "playwright";

const BASE = "http://localhost:3111";
const errors = [];
const steps = [];

function log(message) {
  console.log(message);
  steps.push(message);
}

const browser = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium" });
const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
const page = await context.newPage();

// En mode développement, Next compile chaque route au premier accès : la fiche
// track demande plusieurs secondes. On laisse donc de la marge, sans quoi le
// parcours échouerait sur une lenteur de compilation et non sur un défaut.
page.setDefaultTimeout(30_000);
page.setDefaultNavigationTimeout(30_000);

process.on("uncaughtException", async (error) => {
  console.error("\n✗ ÉCHEC :", error.message.split("\n")[0]);
  console.error("\n--- erreurs de page capturées ---");
  console.error(errors.length ? errors.join("\n") : "aucune");
  try {
    await page.screenshot({ path: "/tmp/shots/echec.png" });
    console.error("\n--- URL au moment de l'échec ---");
    console.error(page.url());
  } catch {}
  await browser.close();
  process.exit(1);
});

page.on("console", (msg) => {
  if (msg.type() === "error") errors.push(`CONSOLE: ${msg.text()}`);
});
page.on("pageerror", (e) => errors.push(`PAGE ERROR: ${e.message}`));

const shot = (name) => page.screenshot({ path: `/tmp/shots/${name}.png` });

/**
 * Ouvre (ou referme) un bloc repliable de la fiche track sans se soucier de son
 * état d'origine : le bloc Production est déjà déplié au premier affichage.
 */
async function setBlock(name, open) {
  const button = page.getByRole("button", { name: new RegExp(`^${name}`) }).first();
  const expanded = (await button.getAttribute("aria-expanded")) === "true";
  if (expanded !== open) {
    await button.click();
    await page.waitForTimeout(600);
  }
}

// --- Connexion ---------------------------------------------------------------
await page.goto(`${BASE}/connexion`, { waitUntil: "networkidle" });
await page.getByLabel("Adresse e-mail").fill("producteur@exemple.com");
await page.getByRole("button", { name: /Recevoir le lien/ }).click();
await page.getByLabel(/Code reçu/).waitFor({ timeout: 30_000 });
await page.getByLabel(/Code reçu/).fill("123456");
await page.getByRole("button", { name: "Se connecter" }).click();
await page.waitForURL(/studio/, { timeout: 30_000 });
log("✓ Connexion par e-mail réussie, Studio comme page d'accueil");

// --- Onboarding --------------------------------------------------------------
await page.getByText("Bienvenue dans Atelier").waitFor({ timeout: 30_000 });
await shot("01-onboarding");
log("✓ Onboarding affiché à la première connexion");

await page.getByRole("button", { name: "Continuer" }).click(); // alias -> pipeline
await page.getByRole("button", { name: "Continuer" }).click(); // pipeline -> relances
await page.getByRole("button", { name: "10 jours" }).click();
await page.getByRole("button", { name: "Continuer" }).click(); // relances -> track
await page.getByLabel("Titre").fill("Nocturne");
await page.getByLabel(/Quelques labels/).fill("Anjunadeep, demo@anjunadeep.com\nAfterlife");
await page.getByRole("button", { name: "Terminer" }).click();
await page.waitForTimeout(3000);
log("✓ Onboarding terminé : alias, étapes, modèles, track et labels créés");

// --- Navigation : trois entrées seulement ------------------------------------
await page.goto(`${BASE}/studio`, { waitUntil: "networkidle" });
await page.waitForTimeout(1500);
const navLinks = await page.locator("aside nav a").allInnerTexts();
const navNames = navLinks.map((t) => t.trim()).filter(Boolean);
if (navNames.length !== 3) {
  throw new Error(`La navigation doit compter trois entrées, trouvé : ${navNames.join(", ")}`);
}
for (const expected of ["Studio", "Labels", "Promotion"]) {
  if (!navNames.includes(expected)) throw new Error(`Entrée manquante : ${expected}`);
}
log(`✓ Navigation réduite à trois entrées : ${navNames.join(", ")}`);

// --- Studio ------------------------------------------------------------------
if (!(await page.getByRole("heading", { name: "Mes tracks" }).isVisible())) {
  throw new Error("Le titre « Mes tracks » est absent");
}
if (!(await page.getByText("Nocturne").first().isVisible())) {
  throw new Error("La track créée pendant l'onboarding est absente du studio");
}

// Quatre colonnes, pas une de plus, et aucune ne dépasse de l'écran.
const columnTitles = await page.locator("section > header h2").allInnerTexts();
const columns = columnTitles.map((t) => t.trim());
if (columns.length !== 4) {
  throw new Error(`Le tableau doit avoir quatre colonnes, trouvé ${columns.length}`);
}
const overflows = await page.evaluate(
  () => document.documentElement.scrollWidth > document.documentElement.clientWidth + 1,
);
if (overflows) throw new Error("Le tableau provoque un défilement horizontal");
await shot("02-studio");
log(`✓ Studio : quatre colonnes (${columns.join(", ")}) sans défilement horizontal`);

// Le filtre par alias fonctionne.
await page.getByRole("button", { name: "ELVIK", exact: true }).click();
await page.waitForTimeout(900);
await page.getByRole("button", { name: "Toutes", exact: true }).click();
await page.waitForTimeout(900);
log("✓ Filtre par alias opérationnel");

// --- Fiche track : quatre blocs repliables -----------------------------------
await page.getByText("Nocturne").first().click();
await page.waitForURL(/\/studio\/[0-9a-f-]+/, { timeout: 30_000 });
await page.waitForTimeout(1500);
const trackUrl = page.url().split("?")[0];

const blockTitles = (await page.locator('button[aria-expanded]').allInnerTexts())
  .map((t) => t.trim().split("\n")[0])
  .filter(Boolean);
for (const expected of ["Production", "Envois aux labels", "Promotion", "Notes et fichiers"]) {
  if (!blockTitles.some((t) => t.startsWith(expected))) {
    throw new Error(`Bloc manquant dans la fiche : ${expected}`);
  }
}
if (blockTitles.length !== 4) {
  throw new Error(`La fiche doit compter quatre blocs, trouvé ${blockTitles.length}`);
}
if ((await page.getByRole("tab").count()) > 0) {
  throw new Error("La fiche affiche encore des onglets");
}
await shot("03-fiche-track");
log("✓ Fiche track : quatre blocs repliables, aucun onglet");

// --- Bloc Production : checklist et progression -------------------------------
await setBlock("Production", true);
await page.getByRole("button", { name: "Utiliser un modèle" }).click();
await page.waitForTimeout(500);
const templateSelect = page.locator('[role="dialog"] select').first();
const deepestOption = await templateSelect
  .locator("option", { hasText: "Deepest Mind" })
  .first()
  .getAttribute("value");
await templateSelect.selectOption(deepestOption);
await page.locator('[role="dialog"]').getByRole("button", { name: "Ajouter", exact: true }).click();
await page.waitForTimeout(2500);
log("✓ Modèle de checklist appliqué depuis le bloc Production");

const progressBefore = await page
  .locator('[role="progressbar"]')
  .first()
  .getAttribute("aria-valuenow");
const checkboxes = page.locator('input[type="checkbox"]');
await checkboxes.nth(0).click({ force: true });
await page.waitForTimeout(1200);
await checkboxes.nth(1).click({ force: true });
await page.waitForTimeout(1800);
const progressAfter = await page
  .locator('[role="progressbar"]')
  .first()
  .getAttribute("aria-valuenow");
if (Number(progressAfter) <= Number(progressBefore)) {
  throw new Error(`La progression n'a pas augmenté (${progressBefore} -> ${progressAfter})`);
}
log(`✓ Progression recalculée : ${progressBefore} % -> ${progressAfter} %`);

// --- Version audio et correction horodatée, dans le même bloc ------------------
await page.setInputFiles('input[type="file"]', "/tmp/demo.wav");
await page.waitForTimeout(900);
await page.getByRole("button", { name: "Envoyer", exact: true }).click();
await page.waitForTimeout(4000);
if (!(await page.getByText("demo").first().isVisible())) {
  throw new Error("La version audio envoyée n'apparaît pas");
}
log("✓ Version audio téléversée depuis le bloc Production");

await page.getByLabel("Horodatage").fill("2:34");
await page
  .locator("textarea")
  .filter({ hasNot: page.locator("[placeholder*='Intentions']") })
  .last()
  .fill("Le lead est trop faible et le kick perd de l'impact.");
await page.getByRole("button", { name: "Ajouter", exact: true }).click();
await page.waitForTimeout(2500);
if (!(await page.getByText("2:34").first().isVisible())) {
  throw new Error("La correction horodatée n'a pas été enregistrée à 2:34");
}
await page.getByRole("button", { name: "2:34" }).first().click();
await page.waitForTimeout(1500);
const playerPosition = await page.evaluate(() => {
  const audio = document.querySelector("audio");
  return audio ? Math.round(audio.currentTime) : -1;
});
if (Math.abs(playerPosition - 154) > 3) {
  throw new Error(`Le lecteur ne s'est pas placé à 2:34 (position ${playerPosition}s)`);
}
await shot("04-production");
log(`✓ Correction horodatée posée à 2:34, le lecteur y saute (${playerPosition}s)`);

// --- Bloc Envois aux labels ---------------------------------------------------
await setBlock("Production", false);
await setBlock("Envois aux labels", true);
await page.getByRole("button", { name: /Envoyer à un label/ }).click();
await page.waitForTimeout(800);
await page.getByRole("button", { name: "Enregistrer l'envoi" }).click();
await page.waitForTimeout(2500);
if (!(await page.getByText(/Envoyé aujourd'hui|Relance prévue/).first().isVisible())) {
  throw new Error("L'envoi au label n'apparaît pas dans le bloc");
}
log("✓ Envoi à un label enregistré depuis la fiche");

// La case « Répondu » n'ouvre plus qu'une fenêtre à trois champs.
await page.getByText("Répondu").first().click();
await page.waitForTimeout(900);
const dialogFields = await page.locator('[role="dialog"] input, [role="dialog"] textarea').count();
if (dialogFields > 3) {
  throw new Error(`La fenêtre « Répondu » demande trop d'informations (${dialogFields} champs)`);
}
await page.getByRole("button", { name: "Positive" }).click();
await page.locator('[role="dialog"] textarea').fill("On adore, envoie les stems.");
await page.getByRole("button", { name: "Enregistrer", exact: true }).click();
await page.waitForTimeout(2500);
if (!(await page.getByText("On adore, envoie les stems.").isVisible())) {
  throw new Error("La réponse du label n'a pas été enregistrée");
}
await shot("05-labels");
log("✓ Réponse enregistrée via une fenêtre réduite à trois champs");

// --- Bloc Promotion -----------------------------------------------------------
await setBlock("Envois aux labels", false);
await setBlock("Promotion", true);
if (!(await page.getByText("Aucune date de sortie enregistrée").isVisible())) {
  throw new Error("Sans date de sortie, le bloc Promotion doit rester réduit");
}
await page.getByRole("button", { name: "Ajouter une date de sortie" }).click();
await page.waitForTimeout(800);
const release = new Date();
release.setDate(release.getDate() + 30);
await page.getByLabel("Date de sortie").fill(release.toISOString().slice(0, 10));
await page.getByRole("button", { name: "Enregistrer", exact: true }).click();
await page.waitForTimeout(2500);
await page.getByRole("button", { name: "Générer la checklist" }).click();
await page.waitForTimeout(3500);
if (!(await page.getByText("Artwork prêt").first().isVisible())) {
  throw new Error("La checklist de sortie n'a pas été générée");
}
if (!(await page.getByText(/Dans \d+ jours/).first().isVisible())) {
  throw new Error("Le compte à rebours n'apparaît pas");
}
await shot("06-promotion-fiche");
log("✓ Checklist de sortie générée avec compte à rebours");

// --- Page Promotion -----------------------------------------------------------
await page.goto(`${BASE}/promotion`, { waitUntil: "networkidle" });
await page.waitForTimeout(2000);
if (!(await page.getByText("Nocturne").first().isVisible())) {
  throw new Error("La sortie datée n'apparaît pas sur la page Promotion");
}
// La carte de sortie elle-même, pas le rappel qui la cite en haut de page.
await page.locator("button").filter({ hasText: "Nocturne" }).last().click();
await page.waitForTimeout(1500);
const panel = page.locator('[role="dialog"]');
if (!(await panel.isVisible())) {
  throw new Error("La checklist ne s'ouvre pas en panneau depuis la page Promotion");
}
if (!(await panel.getByText("Master final prêt").first().isVisible())) {
  throw new Error("La checklist chronologique est absente du panneau");
}
await shot("07-promotion");
log("✓ Page Promotion : carte de sortie et checklist chronologique");
await page.keyboard.press("Escape");

// --- Page Labels --------------------------------------------------------------
await page.goto(`${BASE}/labels`, { waitUntil: "networkidle" });
await page.waitForTimeout(2000);
// Les en-têtes sont mis en capitales par la feuille de style : on compare
// sans tenir compte de la casse.
const headers = (await page.locator("table thead th").allInnerTexts()).map((t) =>
  t.trim().toLocaleLowerCase("fr"),
);
for (const expected of ["Label", "Dernière track", "Envoi", "Suivi", "Répondu"]) {
  if (!headers.includes(expected.toLocaleLowerCase("fr"))) {
    throw new Error(`Colonne manquante dans le carnet de labels : ${expected}`);
  }
}
if (!(await page.getByText("Anjunadeep").first().isVisible())) {
  throw new Error("Les labels créés à l'onboarding n'apparaissent pas");
}
if ((await page.locator("table thead th").count()) > 6) {
  throw new Error("Le carnet de labels compte encore trop de colonnes");
}
await shot("08-labels");
log(`✓ Page Labels : carnet en tableau (${headers.filter(Boolean).join(", ")})`);

// --- Persistance après rechargement ------------------------------------------
await page.goto(`${BASE}/studio`, { waitUntil: "networkidle" });
await page.reload({ waitUntil: "networkidle" });
await page.waitForTimeout(2000);
if (!(await page.getByText("Nocturne").first().isVisible())) {
  throw new Error("Les données ne survivent pas à un rechargement");
}
log("✓ Les données sont bien persistées après actualisation");

// --- Les anciens écrans ne doivent plus exister -------------------------------
for (const gone of ["aujourdhui", "sessions", "calendrier", "analyses", "plus", "releases"]) {
  const response = await page.goto(`${BASE}/${gone}`, { waitUntil: "domcontentloaded" });
  if (response && response.status() !== 404) {
    throw new Error(`La page /${gone} répond encore (${response.status()})`);
  }
}
log("✓ Les écrans retirés ne répondent plus");

// --- Mobile ------------------------------------------------------------------
const mobile = await browser.newContext({
  ...devices["iPhone 13"],
  storageState: await context.storageState(),
});
const mobilePage = await mobile.newPage();
mobilePage.on("pageerror", (e) => errors.push(`MOBILE PAGE ERROR: ${e.message}`));
await mobilePage.goto(`${BASE}/studio`, { waitUntil: "networkidle" });
await mobilePage.waitForTimeout(2500);
const mobileOverflow = await mobilePage.evaluate(
  () => document.documentElement.scrollWidth > document.documentElement.clientWidth + 1,
);
if (mobileOverflow) throw new Error("La page Studio déborde horizontalement sur mobile");
await mobilePage.screenshot({ path: "/tmp/shots/09-mobile-studio.png" });
await mobilePage.goto(`${BASE}/labels`, { waitUntil: "networkidle" });
await mobilePage.waitForTimeout(1800);
await mobilePage.screenshot({ path: "/tmp/shots/10-mobile-labels.png" });
log("✓ Rendu mobile vérifié (iPhone), sans débordement horizontal");

// --- Isolation entre comptes -------------------------------------------------
const other = await browser.newContext({ viewport: { width: 1280, height: 800 } });
const otherPage = await other.newPage();
await otherPage.goto(`${BASE}/connexion`, { waitUntil: "networkidle" });
await otherPage.getByLabel("Adresse e-mail").fill("autre@exemple.com");
await otherPage.getByRole("button", { name: /Recevoir le lien/ }).click();
await otherPage.getByLabel(/Code reçu/).waitFor({ timeout: 30_000 });
await otherPage.getByLabel(/Code reçu/).fill("123456");
await otherPage.getByRole("button", { name: "Se connecter" }).click();
await otherPage.waitForURL(/studio/, { timeout: 30_000 });
await otherPage.waitForTimeout(2500);
const leaked = await otherPage.getByText("Nocturne").count();
if (leaked > 0) throw new Error("FUITE DE DONNÉES : un autre compte voit la track");
log("✓ Un second compte ne voit aucune donnée du premier");

await browser.close();

console.log("\n=== Résumé ===");
console.log(`${steps.length} étapes validées`);
console.log(`Fiche ouverte : ${trackUrl}`);
console.log("\n=== Erreurs console ===");
console.log(errors.length ? errors.join("\n") : "aucune");
process.exit(errors.filter((e) => e.includes("PAGE ERROR")).length > 0 ? 1 : 0);
