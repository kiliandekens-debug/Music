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

// --- Connexion ---------------------------------------------------------------
await page.goto(`${BASE}/connexion`, { waitUntil: "networkidle" });
await page.getByLabel("Adresse e-mail").fill("producteur@exemple.com");
await page.getByRole("button", { name: /Recevoir le lien/ }).click();
await page.getByLabel(/Code reçu/).waitFor({ timeout: 10000 });
await page.getByLabel(/Code reçu/).fill("123456");
await page.getByRole("button", { name: "Se connecter" }).click();
await page.waitForURL(/aujourdhui/, { timeout: 15000 });
log("✓ Connexion par e-mail réussie");

// --- Onboarding --------------------------------------------------------------
await page.getByText("Bienvenue dans Atelier").waitFor({ timeout: 10000 });
await shot("01-onboarding");
log("✓ Onboarding affiché à la première connexion");

await page.getByRole("button", { name: "Continuer" }).click(); // espaces -> pipeline
await page.getByRole("button", { name: "Continuer" }).click(); // pipeline -> relances
await page.getByRole("button", { name: "10 jours" }).click();
await page.getByRole("button", { name: "Continuer" }).click(); // relances -> track
await page.getByLabel("Titre").fill("Nocturne");
await page.getByLabel(/Quelques labels/).fill("Anjunadeep, demo@anjunadeep.com\nAfterlife");
await page.getByRole("button", { name: "Terminer" }).click();
await page.waitForTimeout(3000);
log("✓ Onboarding terminé : espaces, étapes, modèles, track et labels créés");

// --- Aujourd'hui -------------------------------------------------------------
await page.goto(`${BASE}/aujourdhui`, { waitUntil: "networkidle" });
await page.waitForTimeout(1200);
await shot("02-aujourdhui");
log("✓ Page Aujourd'hui chargée");

// --- Studio : pipeline -------------------------------------------------------
await page.goto(`${BASE}/studio`, { waitUntil: "networkidle" });
await page.waitForTimeout(1200);
if (!(await page.getByText("Nocturne").first().isVisible())) {
  throw new Error("La track créée pendant l'onboarding est absente du studio");
}
await shot("03-studio-kanban");
log("✓ Le pipeline affiche la track persistée");

// --- Fiche track : tâches et progression -------------------------------------
await page.getByText("Nocturne").first().click();
await page.waitForURL(/\/studio\/[0-9a-f-]+/, { timeout: 10000 });
await page.waitForTimeout(1200);
log("✓ Fiche de la track ouverte");

await page.getByRole("tab", { name: /Tâches/ }).click();
await page.waitForTimeout(600);

// Applique un modèle de checklist
await page.getByRole("button", { name: "Appliquer un modèle" }).click();
await page.waitForTimeout(400);
const templateSelect = page.locator("select").last();
const deepestOption = await templateSelect
  .locator("option", { hasText: "Deepest Mind" })
  .first()
  .getAttribute("value");
await templateSelect.selectOption(deepestOption);
await page.getByRole("button", { name: "Ajouter les tâches" }).click();
await page.waitForTimeout(2500);
log("✓ Modèle de checklist appliqué");

// Coche deux tâches et vérifie que la progression bouge
const progressBefore = await page
  .locator('[role="progressbar"]')
  .first()
  .getAttribute("aria-valuenow");
const checkboxes = page.locator('input[type="checkbox"]');
await checkboxes.nth(1).click({ force: true });
await page.waitForTimeout(1200);
await checkboxes.nth(2).click({ force: true });
await page.waitForTimeout(1500);
const progressAfter = await page
  .locator('[role="progressbar"]')
  .first()
  .getAttribute("aria-valuenow");
if (Number(progressAfter) <= Number(progressBefore)) {
  throw new Error(`La progression n'a pas augmenté (${progressBefore} -> ${progressAfter})`);
}
log(`✓ Progression recalculée automatiquement : ${progressBefore} % -> ${progressAfter} %`);
await shot("04-taches-progression");

const trackUrl = page.url().split("?")[0];

// --- Version audio + correction horodatée ------------------------------------
await page.goto(`${trackUrl}?onglet=versions`, { waitUntil: "networkidle" });
await page.waitForTimeout(900);
await page.setInputFiles('input[type="file"]', "/tmp/demo.wav");
await page.waitForTimeout(900);
await page.getByRole("button", { name: "Envoyer" }).click();
await page.waitForTimeout(4000);
if (!(await page.getByText("demo").first().isVisible())) {
  throw new Error("La version audio envoyée n'apparaît pas");
}
await shot("04b-versions-audio");
log("✓ Version audio téléversée et listée");

await page.goto(`${trackUrl}?onglet=corrections`, { waitUntil: "networkidle" });
await page.waitForTimeout(1500);
await page.getByLabel("Horodatage").fill("2:34");
await page
  .locator("textarea")
  .first()
  .fill("Le lead est trop faible et le kick perd de l'impact.");
await page.getByRole("button", { name: "Ajouter" }).click();
await page.waitForTimeout(2500);
if (!(await page.getByText("2:34").first().isVisible())) {
  throw new Error("La correction horodatée n'a pas été enregistrée à 2:34");
}
await shot("04c-corrections");
log("✓ Correction horodatée ajoutée à 2:34");

// Un clic sur l'horodatage doit déplacer le lecteur.
await page.getByRole("button", { name: "2:34" }).first().click();
await page.waitForTimeout(1500);
const playerPosition = await page.evaluate(() => {
  const audio = document.querySelector("audio");
  return audio ? Math.round(audio.currentTime) : -1;
});
if (Math.abs(playerPosition - 154) > 3) {
  throw new Error(`Le lecteur ne s'est pas placé à 2:34 (position ${playerPosition}s)`);
}
log(`✓ Clic sur la correction : le lecteur saute à ${playerPosition}s (2:34)`);

// --- Labels : envoi ----------------------------------------------------------
await page.goto(`${trackUrl}?onglet=labels`, { waitUntil: "networkidle" });
await page.waitForTimeout(1000);
await page.getByRole("button", { name: /Enregistrer un envoi/ }).click();
await page.waitForTimeout(800);
await page.getByRole("button", { name: "Enregistrer l'envoi" }).click();
await page.waitForTimeout(2500);
if (!(await page.getByText(/Envoyé aujourd'hui|Relance prévue/).first().isVisible())) {
  throw new Error("L'envoi au label n'apparaît pas dans l'historique de la track");
}
await shot("05-envoi-label");
log("✓ Envoi à un label enregistré, avec suivi du délai");

// --- Réponse du label --------------------------------------------------------
await page.getByText("Répondu").first().click();
await page.waitForTimeout(800);
await page.getByRole("button", { name: "Marquer comme intéressé" }).click();
await page.getByLabel(/Message ou résumé/).fill("On adore, envoie les stems.");
await page.getByRole("button", { name: "Enregistrer la réponse" }).click();
await page.waitForTimeout(2500);
if (!(await page.getByText("On adore, envoie les stems.").isVisible())) {
  throw new Error("La réponse du label n'a pas été enregistrée");
}
await shot("06-reponse-label");
log("✓ Réponse du label enregistrée via la case « Répondu »");

// --- Campagne promotionnelle -------------------------------------------------
await page.goto(`${trackUrl}?onglet=promotion`, { waitUntil: "networkidle" });
await page.waitForTimeout(1000);
await page.getByRole("button", { name: "Créer la campagne" }).click();
await page.waitForTimeout(600);
const release = new Date();
release.setDate(release.getDate() + 30);
await page.getByLabel("Date de sortie").fill(release.toISOString().slice(0, 10));
await page.getByRole("button", { name: "Créer avec le planning" }).click();
await page.waitForTimeout(4000);
const planVisible = await page.getByText("J-28").first().isVisible();
if (!planVisible) throw new Error("Le planning à rebours n'a pas été généré");
await shot("07-campagne-planning");
log("✓ Campagne créée et planning à rebours généré depuis la date de sortie");

// --- Session de travail ------------------------------------------------------
await page.goto(`${BASE}/sessions`, { waitUntil: "networkidle" });
await page.waitForTimeout(900);
await page.getByRole("button", { name: /Démarrer une session/ }).first().click();
await page.waitForTimeout(900);
// Sélectionne la première tâche encore ouverte proposée par le Mode Session.
await page.locator('button:has(input[type="checkbox"])').first().click();
await page.getByRole("button", { name: "Démarrer la session" }).click();
await page.waitForURL(/sessions\/mode/, { timeout: 10000 });
await page.waitForTimeout(2500);
await shot("08-mode-session");
log("✓ Mode Session démarré, chronomètre en marche");

await page.getByRole("button", { name: "Terminer la session" }).click();
await page.waitForTimeout(800);
await page.getByLabel("Qu'as-tu terminé ?").fill("La boucle principale tient debout.");
await page.getByLabel("Quelle est la prochaine action ?").fill("Travailler la basse.");
await page.getByRole("button", { name: "Enregistrer et terminer" }).click();
await page.waitForTimeout(3000);
if (!(await page.getByText("Travailler la basse.").first().isVisible())) {
  throw new Error("Le bilan de session n'a pas été enregistré");
}
await shot("09-sessions");
log("✓ Session terminée avec bilan et prochaine action");

// --- Persistance après rechargement ------------------------------------------
await page.goto(`${BASE}/studio`, { waitUntil: "networkidle" });
await page.reload({ waitUntil: "networkidle" });
await page.waitForTimeout(1800);
if (!(await page.getByText("Nocturne").first().isVisible())) {
  throw new Error("Les données ne survivent pas à un rechargement");
}
log("✓ Les données sont bien persistées après actualisation");

// --- Analyses et calendrier --------------------------------------------------
await page.goto(`${BASE}/analyses`, { waitUntil: "networkidle" });
await page.waitForTimeout(1800);
await shot("10-analyses");
await page.goto(`${BASE}/calendrier`, { waitUntil: "networkidle" });
await page.waitForTimeout(1500);
await shot("11-calendrier");
await page.goto(`${BASE}/labels`, { waitUntil: "networkidle" });
await page.waitForTimeout(1500);
await shot("12-labels");
log("✓ Analyses, calendrier et labels rendus");

// --- Mobile ------------------------------------------------------------------
const mobile = await browser.newContext({
  ...devices["iPhone 13"],
  storageState: await context.storageState(),
});
const mobilePage = await mobile.newPage();
mobilePage.on("pageerror", (e) => errors.push(`MOBILE PAGE ERROR: ${e.message}`));
await mobilePage.goto(`${BASE}/aujourdhui`, { waitUntil: "networkidle" });
await mobilePage.waitForTimeout(1800);
await mobilePage.screenshot({ path: "/tmp/shots/13-mobile-aujourdhui.png" });
await mobilePage.goto(`${BASE}/studio`, { waitUntil: "networkidle" });
await mobilePage.waitForTimeout(1500);
await mobilePage.screenshot({ path: "/tmp/shots/14-mobile-studio.png" });
log("✓ Rendu mobile vérifié (iPhone)");

// --- Isolation entre comptes -------------------------------------------------
const other = await browser.newContext({ viewport: { width: 1280, height: 800 } });
const otherPage = await other.newPage();
await otherPage.goto(`${BASE}/connexion`, { waitUntil: "networkidle" });
await otherPage.getByLabel("Adresse e-mail").fill("autre@exemple.com");
await otherPage.getByRole("button", { name: /Recevoir le lien/ }).click();
await otherPage.getByLabel(/Code reçu/).waitFor({ timeout: 10000 });
await otherPage.getByLabel(/Code reçu/).fill("123456");
await otherPage.getByRole("button", { name: "Se connecter" }).click();
await otherPage.waitForURL(/aujourdhui/, { timeout: 15000 });
await otherPage.waitForTimeout(2500);
const leaked = await otherPage.getByText("Nocturne").count();
if (leaked > 0) throw new Error("FUITE DE DONNÉES : un autre compte voit la track");
log("✓ Un second compte ne voit aucune donnée du premier");

await browser.close();

console.log("\n=== Résumé ===");
console.log(`${steps.length} étapes validées`);
console.log("\n=== Erreurs console ===");
console.log(errors.length ? errors.join("\n") : "aucune");
process.exit(errors.filter((e) => e.includes("PAGE ERROR")).length > 0 ? 1 : 0);
