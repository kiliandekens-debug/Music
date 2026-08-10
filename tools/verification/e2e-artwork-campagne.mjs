/**
 * Parcours complémentaire : artwork, proposition automatique de campagne
 * et réorganisation des tâches du planning promotionnel.
 * Nécessite le harnais local (voir README de ce dossier) et une image de
 * test dans /tmp/art.png.
 */
import { chromium } from "playwright";
const errors = [];
const browser = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium" });
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
page.on("pageerror", (e) => errors.push("PAGE ERROR: " + e.message));
page.on("console", (m) => { if (m.type() === "error") errors.push("CONSOLE: " + m.text().slice(0,200)); });

await page.goto("http://localhost:3111/connexion", { waitUntil: "networkidle" });
await page.getByLabel("Adresse e-mail").fill("producteur@exemple.com");
await page.getByRole("button", { name: /Recevoir le lien/ }).click();
await page.getByLabel(/Code reçu/).waitFor();
await page.getByLabel(/Code reçu/).fill("123456");
await page.getByRole("button", { name: "Se connecter" }).click();
await page.waitForURL(/aujourdhui/);
await page.waitForTimeout(2000);

// Nouvelle track sans campagne, avec date de sortie -> la proposition doit apparaître
await page.goto("http://localhost:3111/studio", { waitUntil: "networkidle" });
await page.waitForTimeout(1200);
await page.getByRole("button", { name: "Nouvelle track" }).click();
await page.waitForTimeout(600);
await page.getByLabel("Titre").fill("Aurore");
await page.getByRole("button", { name: "Créer la track" }).click();
await page.waitForURL(/\/studio\/[0-9a-f-]+/, { timeout: 15000 });
await page.waitForTimeout(2000);
const trackUrl = page.url().split("?")[0];
console.log("✓ Track créée depuis l'ajout rapide");

// Ajoute une date de sortie via le formulaire d'édition
await page.getByRole("button", { name: "Actions" }).first().click();
await page.getByRole("menuitem", { name: /Modifier les informations/ }).click();
await page.waitForTimeout(700);
const release = new Date(); release.setDate(release.getDate() + 40);
await page.getByLabel("Date de sortie").fill(release.toISOString().slice(0,10));
await page.getByRole("button", { name: "Enregistrer" }).click();
await page.waitForTimeout(2500);
if (!(await page.getByText("Créer la campagne promotionnelle ?").isVisible()))
  throw new Error("La proposition de campagne n'apparaît pas après ajout d'une date de sortie");
console.log("✓ Proposition automatique de campagne après saisie d'une date de sortie");
await page.screenshot({ path: "/tmp/shots/15-proposition-campagne.png" });

// Artwork : envoi d'une image
const png = "/tmp/art.png";
await page.setInputFiles('input[type="file"]', png);
await page.waitForTimeout(3000);
const hasImg = await page.locator('img[alt*="Artwork"]').count();
if (hasImg === 0) throw new Error("L'artwork n'a pas été affiché");
console.log("✓ Artwork envoyé et affiché");
await page.screenshot({ path: "/tmp/shots/16-artwork.png" });

// Accepte la proposition -> campagne + planning
await page.getByRole("button", { name: "Créer la campagne" }).click();
await page.waitForTimeout(4000);
if (!(await page.getByText("J-28").first().isVisible()))
  throw new Error("Le planning n'a pas été généré depuis la proposition");
console.log("✓ Campagne et planning créés depuis la proposition");

// Réordonner une tâche promo à l'intérieur de son groupe
const group = page.locator("div").filter({ hasText: /^J-28/ }).last();
const rows = page.locator("li").filter({ has: page.locator('input[type="checkbox"]') });
const before = await rows.nth(0).innerText();
await rows.nth(0).hover();
await rows.nth(0).getByRole("button", { name: "Actions" }).click();
await page.getByRole("menuitem", { name: "Descendre" }).click();
await page.waitForTimeout(2500);
const after = await rows.nth(0).innerText();
if (after.trim() === before.trim()) throw new Error("La tâche promo n'a pas été réordonnée");
console.log(`✓ Tâche promo réordonnée (« ${before.trim()} » → « ${after.trim()} » en tête)`);

await browser.close();
console.log("\nErreurs:", errors.length ? errors.join("\n") : "aucune");
