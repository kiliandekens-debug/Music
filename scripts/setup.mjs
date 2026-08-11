/**
 * Installation guidée d'Atelier.
 *
 * Fait à votre place tout ce qui peut l'être :
 *   - écrit .env.local ;
 *   - applique la migration SQL dans votre base Supabase ;
 *   - vérifie que les 22 tables, la Row Level Security et le bucket de
 *     stockage sont bien en place.
 *
 * Ce qui reste manuel, faute d'accès à votre compte : créer le projet Supabase
 * et copier deux valeurs depuis son tableau de bord.
 *
 * Utilisation :
 *   npm run setup
 *   npm run setup -- --verifier          (contrôle sans rien modifier)
 *
 * Les secrets saisis ne sont jamais affichés ni journalisés.
 */

import { createInterface } from "node:readline/promises";
import { stdin, stdout } from "node:process";
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import pg from "pg";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const MIGRATION = resolve(root, "supabase/migrations/0001_init.sql");
const ENV_FILE = resolve(root, ".env.local");
const ENV_EXAMPLE = resolve(root, ".env.example");

/** Valeur d'exemple d'une variable, proposée par défaut à la saisie. */
function exampleValue(name) {
  if (!existsSync(ENV_EXAMPLE)) return "";
  const line = readFileSync(ENV_EXAMPLE, "utf8")
    .split(/\r?\n/)
    .find((l) => l.startsWith(`${name}=`));
  const value = line?.slice(name.length + 1).trim() ?? "";
  return /^votre_|^https:\/\/votre-/.test(value) ? "" : value;
}

const EXPECTED_TABLES = [
  "profiles", "workspaces", "stages", "tracks", "track_tasks",
  "checklist_templates", "checklist_template_items", "audio_versions",
  "timestamp_notes", "track_references", "track_files", "work_sessions",
  "labels", "label_submissions", "promotion_campaigns", "promotion_tasks",
  "promotion_contacts", "promotion_outreach", "content_calendar",
  "release_metrics", "activity_log", "reminders",
];

const c = {
  bold: (s) => `[1m${s}[0m`,
  dim: (s) => `[2m${s}[0m`,
  green: (s) => `[32m${s}[0m`,
  red: (s) => `[31m${s}[0m`,
  yellow: (s) => `[33m${s}[0m`,
  cyan: (s) => `[36m${s}[0m`,
};

/**
 * Entrées du script.
 *
 * Au clavier, on passe par readline (saisie masquée pour les secrets).
 * Avec une entrée redirigée — essais automatisés, ou `printf ... | npm run setup`
 * — readline ne restitue pas les lignes de façon fiable : on lit donc tout le
 * flux d'un coup et on répond aux questions dans l'ordre.
 */
const interactive = stdin.isTTY;
const rl = interactive ? createInterface({ input: stdin, output: stdout }) : null;

let pipedLines = null;
async function readPipedLines() {
  if (pipedLines) return pipedLines;
  const chunks = [];
  for await (const chunk of stdin) chunks.push(chunk);
  pipedLines = Buffer.concat(chunks).toString().split(/\r?\n/);
  return pipedLines;
}

async function ask(question) {
  if (interactive) return (await rl.question(question)).trim();
  const lines = await readPipedLines();
  const value = lines.shift() ?? "";
  stdout.write(`${question}${value}\n`);
  return value.trim();
}

/** Comme ask(), mais la saisie n'apparaît pas à l'écran. */
async function askSecret(question) {
  if (!interactive) {
    const lines = await readPipedLines();
    const value = lines.shift() ?? "";
    stdout.write(`${question}${value ? "••••••••" : ""}\n`);
    return value.trim();
  }

  const original = rl._writeToOutput.bind(rl);
  rl._writeToOutput = (chunk) => {
    if (typeof chunk === "string" && chunk.includes(question)) original(chunk);
  };
  try {
    const value = await rl.question(question);
    stdout.write("\n");
    return value.trim();
  } finally {
    rl._writeToOutput = original;
  }
}

function closeInput() {
  rl?.close();
}

function connectionFrom(input) {
  const value = input.trim();
  if (!value) return null;
  // Supabase colle parfois « psql "postgresql://…" » : on nettoie.
  const match = value.match(/postgres(?:ql)?:\/\/[^\s"']+/);
  return match ? match[0] : value;
}

/**
 * Supabase impose TLS. Une base locale ne l'a en général pas : on l'adapte pour
 * que le script serve aussi aux essais sur machine.
 */
function sslFor(connectionString) {
  if (/sslmode=disable/i.test(connectionString)) return false;
  try {
    const { hostname } = new URL(connectionString);
    if (["localhost", "127.0.0.1", "::1", "[::1]"].includes(hostname)) return false;
  } catch {
    // Chaîne non analysable : on garde TLS, c'est le cas distant.
  }
  return { rejectUnauthorized: false };
}

async function withClient(connectionString, work) {
  const client = new pg.Client({
    connectionString,
    ssl: sslFor(connectionString),
    application_name: "atelier-setup",
  });
  await client.connect();
  try {
    return await work(client);
  } finally {
    await client.end();
  }
}

async function inspect(client) {
  const tables = await client.query(
    `select table_name from information_schema.tables
     where table_schema = 'public' and table_name = any($1)`,
    [EXPECTED_TABLES],
  );
  const rls = await client.query(
    `select count(*)::int as n from pg_tables
     where schemaname = 'public' and rowsecurity = true and tablename = any($1)`,
    [EXPECTED_TABLES],
  );
  const policies = await client.query(
    `select count(*)::int as n from pg_policies where schemaname = 'public'`,
  );
  const bucket = await client.query(
    `select count(*)::int as n from storage.buckets where id = 'media'`,
  );
  const trigger = await client.query(
    `select count(*)::int as n from pg_trigger where tgname = 'on_auth_user_created'`,
  );

  return {
    tables: tables.rowCount,
    missing: EXPECTED_TABLES.filter(
      (t) => !tables.rows.some((r) => r.table_name === t),
    ),
    rls: rls.rows[0].n,
    policies: policies.rows[0].n,
    bucket: bucket.rows[0].n > 0,
    trigger: trigger.rows[0].n > 0,
  };
}

function report(state) {
  const line = (ok, text) => console.log(`  ${ok ? c.green("✓") : c.red("✗")} ${text}`);
  line(state.tables === EXPECTED_TABLES.length, `${state.tables}/${EXPECTED_TABLES.length} tables`);
  if (state.missing.length > 0) {
    console.log(c.dim(`     manquantes : ${state.missing.join(", ")}`));
  }
  line(state.rls === EXPECTED_TABLES.length, `Row Level Security active sur ${state.rls} tables`);
  line(state.policies >= EXPECTED_TABLES.length * 3, `${state.policies} politiques d'accès`);
  line(state.bucket, "bucket de stockage « media »");
  line(state.trigger, "création automatique du profil à l'inscription");
  return (
    state.tables === EXPECTED_TABLES.length &&
    state.rls === EXPECTED_TABLES.length &&
    state.bucket &&
    state.trigger
  );
}

/** Valeur d'une variable dans .env.local. */
function envValue(name) {
  if (!existsSync(ENV_FILE)) return "";
  const line = readFileSync(ENV_FILE, "utf8")
    .split(/\r?\n/)
    .find((l) => l.startsWith(`${name}=`));
  return line?.slice(name.length + 1).trim() ?? "";
}

/**
 * Contrôle à distance, avec la seule clé publique.
 *
 * L'existence d'une table se déduit de l'erreur renvoyée : « relation
 * inexistante » si la migration n'a pas tourné, « permission refusée » si la
 * table est là mais protégée. Ce second cas est le bon : il prouve du même
 * coup qu'un visiteur non authentifié n'accède à rien.
 */
async function inspectViaRest(url, key) {
  const base = `${url.replace(/\/$/, "")}/rest/v1`;
  const result = { missing: [], protected: [], readable: [], unknown: [] };

  for (const table of EXPECTED_TABLES) {
    let response;
    try {
      response = await fetch(`${base}/${table}?select=*&limit=1`, {
        headers: { apikey: key, Authorization: `Bearer ${key}` },
      });
    } catch (error) {
      throw new Error(`réseau : ${error.message}`);
    }

    const body = await response.text();

    // Une clé invalide est rejetée avant toute lecture : inutile de conclure
    // quoi que ce soit sur les tables, il faut le dire franchement.
    if (/PGRST301|JWSError|JWTIssuedAtFuture|Invalid API key|invalid signature/i.test(body)) {
      throw new Error(
        "clé refusée par Supabase — vérifiez NEXT_PUBLIC_SUPABASE_ANON_KEY dans .env.local",
      );
    }

    if (response.ok) {
      // Une lecture anonyme qui renvoie des lignes signalerait une RLS absente.
      const rows = (() => {
        try {
          return JSON.parse(body);
        } catch {
          return [];
        }
      })();
      if (Array.isArray(rows) && rows.length > 0) result.readable.push(table);
      else result.protected.push(table);
    } else if (/does not exist|42P01/i.test(body)) {
      result.missing.push(table);
    } else if (/permission denied|42501|JWT|Invalid API key/i.test(body)) {
      result.protected.push(table);
    } else {
      result.unknown.push(`${table} (${response.status})`);
    }
  }

  return result;
}

function reportRest(state) {
  const present = state.protected.length + state.readable.length;
  const ok = (v) => (v ? c.green("✓") : c.red("✗"));

  console.log(`  ${ok(present === EXPECTED_TABLES.length)} ${present}/${EXPECTED_TABLES.length} tables présentes`);
  if (state.missing.length > 0) {
    console.log(c.dim(`     manquantes : ${state.missing.join(", ")}`));
  }
  console.log(
    `  ${ok(state.readable.length === 0)} aucune donnée lisible sans être connecté` +
      (state.readable.length > 0 ? c.red(` — exposées : ${state.readable.join(", ")}`) : ""),
  );
  if (state.unknown.length > 0) {
    console.log(c.yellow(`  ⚠ réponses inattendues : ${state.unknown.join(", ")}`));
  }
  return present === EXPECTED_TABLES.length && state.readable.length === 0;
}

async function main() {
  const verifyOnly = process.argv.includes("--verifier");

  console.log(c.bold("\n  Atelier — installation\n"));

  if (verifyOnly) {
    console.log(c.dim("  Mode vérification : rien ne sera modifié.\n"));

    // Contrôle sans mot de passe : URL + clé publique suffisent.
    const url = envValue("NEXT_PUBLIC_SUPABASE_URL");
    const key = envValue("NEXT_PUBLIC_SUPABASE_ANON_KEY");

    if (url && key) {
      console.log(c.dim(`  Interrogation de ${url}\n`));
      try {
        const state = await inspectViaRest(url, key);
        const good = reportRest(state);
        console.log(
          good
            ? c.green("\n  La base est en place et correctement cloisonnée.\n")
            : c.yellow("\n  Contrôle incomplet : voir ci-dessus.\n"),
        );
        if (good) {
          console.log("  Vous pouvez lancer " + c.bold("npm run dev") + ".\n");
          closeInput();
          return;
        }
      } catch (error) {
        console.log(c.yellow(`  ⚠ contrôle à distance impossible (${error.message})\n`));
      }
    } else {
      console.log(
        c.dim("  .env.local introuvable ou incomplet : lancez d'abord « npm run setup ».\n"),
      );
    }
  } else {
    console.log(
      "  Ouvrez votre projet sur " +
        c.cyan("supabase.com") +
        " puis " +
        c.bold("Project Settings → API") +
        ".\n",
    );
  }

  // --- Variables d'environnement ---------------------------------------------
  let url = "";
  let anonKey = "";

  if (!verifyOnly) {
    const knownUrl = exampleValue("NEXT_PUBLIC_SUPABASE_URL");
    url =
      (
        await ask(
          knownUrl
            ? `  URL du projet [${knownUrl}] : `
            : "  URL du projet (https://xxx.supabase.co) : ",
        )
      ).trim() || knownUrl;
    if (!/^https:\/\/[^\s]+\.supabase\.(co|in)/.test(url)) {
      console.log(c.yellow("\n  ⚠ Cette URL ne ressemble pas à une URL Supabase, je la garde tout de même.\n"));
    }
    anonKey = await askSecret("  Clé anon / publishable (masquée) : ");
    if (!url || !anonKey) {
      console.log(c.red("\n  L'URL et la clé anon sont indispensables. Abandon.\n"));
      process.exit(1);
    }

    // Une clé privilégiée ne doit jamais atteindre le navigateur : elle
    // contourne la Row Level Security. On refuse les deux formats de Supabase.
    const refuse = (raison) => {
      console.log(
        c.red(`\n  ✗ ${raison}\n`) +
          "    Cette clé contourne la Row Level Security : elle donne accès à toutes\n" +
          "    les données, quel que soit le compte. Elle ne doit jamais figurer dans\n" +
          "    une variable NEXT_PUBLIC_*, et l'application n'en a pas besoin.\n\n" +
          `    Reprenez la clé ${c.bold("publishable")} (ou ${c.bold("anon")}), puis ${c.bold("révoquez")} celle-ci\n` +
          "    si vous l'avez exposée.\n",
      );
      process.exit(1);
    };

    // Format récent : sb_publishable_… / sb_secret_…
    if (/^sb_secret_/i.test(anonKey)) {
      refuse("Ceci est une clé secrète (« secret key »).");
    }

    // Format historique : JWT portant son rôle.
    if (/^eyJ/.test(anonKey)) {
      try {
        const payload = JSON.parse(Buffer.from(anonKey.split(".")[1], "base64").toString());
        if (payload.role && payload.role !== "anon") {
          refuse(`Cette clé a le rôle « ${payload.role} ».`);
        }
      } catch {
        // Clé non décodable : on laisse passer, Supabase la validera.
      }
    }

    const looksPublic = /^(sb_publishable_|eyJ)/.test(anonKey);
    if (!looksPublic) {
      console.log(
        c.yellow(
          "\n  ⚠ Cette clé ne ressemble ni à une clé publishable ni à une clé anon.\n" +
            "    Vérifiez que vous avez copié la bonne ligne dans Settings → API Keys.\n",
        ),
      );
    }

    const contents =
      `NEXT_PUBLIC_SUPABASE_URL=${url}\n` +
      `NEXT_PUBLIC_SUPABASE_ANON_KEY=${anonKey}\n`;

    if (existsSync(ENV_FILE)) {
      const replace = (
        await ask(`  ${c.yellow(".env.local existe déjà. Le remplacer ? [o/N] ")}`)
      )
        .trim()
        .toLowerCase();
      if (replace === "o" || replace === "oui") {
        writeFileSync(ENV_FILE, contents);
        console.log(c.green("  ✓ .env.local mis à jour"));
      } else {
        console.log(c.dim("  → .env.local laissé tel quel"));
      }
    } else {
      writeFileSync(ENV_FILE, contents);
      console.log(c.green("  ✓ .env.local créé"));
    }
  }

  // --- Migration --------------------------------------------------------------
  console.log(
    "\n  Pour appliquer la base de données, il me faut la chaîne de connexion :\n" +
      c.dim("  Project Settings → Database → Connection string → URI\n") +
      c.dim("  (laissez vide pour appliquer le SQL vous-même depuis l'éditeur Supabase)\n"),
  );

  const raw = await askSecret("  Chaîne de connexion (masquée) : ");
  const connectionString = connectionFrom(raw);

  if (!connectionString) {
    console.log(
      "\n  " +
        c.yellow("Étape restante :") +
        " ouvrez le SQL Editor de Supabase et exécutez le contenu de\n  " +
        c.cyan("supabase/migrations/0001_init.sql") +
        "\n\n  Relancez ensuite " +
        c.bold("npm run setup -- --verifier") +
        " pour contrôler le résultat.\n",
    );
    closeInput();
    return;
  }

  if (connectionString.includes("[YOUR-PASSWORD]") || connectionString.includes("[PASSWORD]")) {
    console.log(
      c.red("\n  ✗ La chaîne contient encore le marqueur [YOUR-PASSWORD].\n") +
        "    Remplacez-le par le mot de passe de votre base, puis relancez.\n",
    );
    process.exit(1);
  }

  try {
    console.log(c.dim("\n  Connexion à la base…"));

    const before = await withClient(connectionString, inspect);
    const already = before.tables === EXPECTED_TABLES.length;

    if (already && !verifyOnly) {
      const again = (
        await ask(
          `  ${c.yellow("La base contient déjà les tables d'Atelier. Réappliquer la migration ? [o/N] ")}`,
        )
      )
        .trim()
        .toLowerCase();
      if (again !== "o" && again !== "oui") {
        console.log(c.dim("\n  → migration ignorée. Vérification de l'existant :\n"));
        const ok = report(before);
        console.log(
          ok
            ? c.green("\n  Tout est en place.\n")
            : c.yellow("\n  Des éléments manquent : réappliquez la migration.\n"),
        );
        closeInput();
        return;
      }
    }

    if (!verifyOnly) {
      // La migration est écrite pour être rejouable (if not exists, drop policy…).
      const sql = readFileSync(MIGRATION, "utf8");
      await withClient(connectionString, (client) => client.query(sql));
      console.log(c.green("  ✓ migration appliquée"));
    }

    console.log("");
    const state = await withClient(connectionString, inspect);
    const ok = report(state);

    if (ok) {
      console.log(c.green("\n  Base prête.\n"));
      console.log("  Il reste deux réglages dans le tableau de bord Supabase :");
      console.log(
        "    1. " +
          c.bold("Authentication → URL Configuration") +
          " : ajoutez vos URL de redirection\n" +
          c.dim("       http://localhost:3000/auth/callback (et celle de production)"),
      );
      console.log(
        "    2. " +
          c.bold("Authentication → Sign In / Providers") +
          " : une fois votre compte créé,\n" +
          c.dim("       désactivez les inscriptions publiques (application personnelle)"),
      );
      console.log("\n  Puis : " + c.bold("npm run dev") + "\n");
    } else {
      console.log(c.yellow("\n  La base n'est pas complète. Relancez la migration.\n"));
      process.exitCode = 1;
    }
  } catch (error) {
    console.log(c.red(`\n  ✗ ${error.message}`));
    if (/password authentication failed/i.test(error.message)) {
      console.log(c.dim("    Vérifiez le mot de passe de la base dans la chaîne de connexion."));
    } else if (/ENOTFOUND|EAI_AGAIN|ETIMEDOUT/i.test(error.message)) {
      console.log(c.dim("    Hôte injoignable : vérifiez la chaîne, ou utilisez le pooler « Session »."));
    } else if (/permission denied|must be owner/i.test(error.message)) {
      console.log(
        c.dim("    Droits insuffisants : utilisez la chaîne de connexion « postgres », pas une clé applicative."),
      );
    }
    console.log(
      c.dim("\n    Repli : exécutez supabase/migrations/0001_init.sql dans le SQL Editor.\n"),
    );
    process.exitCode = 1;
  } finally {
    closeInput();
  }
}

main().catch((error) => {
  console.error(c.red(`\n  ✗ ${error.message}\n`));
  closeInput();
  process.exit(1);
});
