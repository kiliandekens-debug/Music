/**
 * Harnais de vérification local : expose une API compatible Supabase
 * (auth + rest + storage) au-dessus d'un vrai PostgreSQL et de PostgREST.
 * Sert uniquement à tester l'application ; ne fait pas partie du produit.
 */

import http from "node:http";
import crypto from "node:crypto";
import { Buffer } from "node:buffer";

const PORT = 5555;
const POSTGREST = "http://127.0.0.1:8000";
const JWT_SECRET = process.env.JWT_SECRET ?? "super-secret-jwt-token-with-at-least-32-characters";

// --- JWT (HS256) -------------------------------------------------------------

const b64url = (input) =>
  Buffer.from(input).toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");

function sign(payload) {
  const header = b64url(JSON.stringify({ alg: "HS256", typ: "JWT" }));
  const body = b64url(JSON.stringify(payload));
  const signature = crypto
    .createHmac("sha256", JWT_SECRET)
    .update(`${header}.${body}`)
    .digest("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
  return `${header}.${body}.${signature}`;
}

function verify(token) {
  try {
    const [header, body, signature] = token.split(".");
    const expected = crypto
      .createHmac("sha256", JWT_SECRET)
      .update(`${header}.${body}`)
      .digest("base64")
      .replace(/\+/g, "-")
      .replace(/\//g, "_")
      .replace(/=+$/, "");
    if (signature !== expected) return null;
    const payload = JSON.parse(Buffer.from(body, "base64").toString());
    if (payload.exp && payload.exp * 1000 < Date.now()) return null;
    return payload;
  } catch {
    return null;
  }
}

// --- Comptes de test ---------------------------------------------------------

const USERS = new Map(); // email -> user
const users = [
  { id: "11111111-1111-1111-1111-111111111111", email: "producteur@exemple.com" },
  { id: "22222222-2222-2222-2222-222222222222", email: "autre@exemple.com" },
];
for (const user of users) USERS.set(user.email, user);

function sessionFor(user) {
  const now = Math.floor(Date.now() / 1000);
  const payload = {
    sub: user.id,
    email: user.email,
    role: "authenticated",
    aud: "authenticated",
    iat: now,
    exp: now + 3600,
    app_metadata: {},
    user_metadata: {},
  };
  return {
    access_token: sign(payload),
    token_type: "bearer",
    expires_in: 3600,
    expires_at: now + 3600,
    refresh_token: `refresh-${user.id}`,
    user: {
      id: user.id,
      aud: "authenticated",
      role: "authenticated",
      email: user.email,
      email_confirmed_at: new Date().toISOString(),
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      app_metadata: { provider: "email", providers: ["email"] },
      user_metadata: {},
      identities: [],
    },
  };
}

// --- Stockage en mémoire ------------------------------------------------------

const FILES = new Map(); // path -> { buffer, contentType }

// --- Utilitaires --------------------------------------------------------------

function readBody(req) {
  return new Promise((resolve) => {
    const chunks = [];
    req.on("data", (chunk) => chunks.push(chunk));
    req.on("end", () => resolve(Buffer.concat(chunks)));
  });
}

function json(res, status, payload) {
  const body = JSON.stringify(payload);
  res.writeHead(status, {
    "content-type": "application/json",
    "access-control-allow-origin": "*",
  });
  res.end(body);
}

/**
 * supabase-js envoie les fichiers en multipart/form-data depuis le navigateur.
 * On extrait la partie « fichier » pour stocker les octets réels.
 */
function extractUpload(body, contentType) {
  if (!contentType?.startsWith("multipart/form-data")) {
    return { buffer: body, contentType: contentType ?? "application/octet-stream" };
  }
  const boundary = contentType.split("boundary=")[1]?.replace(/^"|"$/g, "");
  if (!boundary) return { buffer: body, contentType: "application/octet-stream" };

  const separator = Buffer.from(`--${boundary}`);
  const parts = [];
  let index = body.indexOf(separator);
  while (index !== -1) {
    const next = body.indexOf(separator, index + separator.length);
    if (next === -1) break;
    parts.push(body.subarray(index + separator.length, next));
    index = next;
  }

  for (const part of parts) {
    const headerEnd = part.indexOf("\r\n\r\n");
    if (headerEnd === -1) continue;
    const headers = part.subarray(0, headerEnd).toString();
    if (!/filename=/i.test(headers)) continue;
    // Le corps se termine par le CRLF précédant le séparateur suivant.
    const content = part.subarray(headerEnd + 4, part.length - 2);
    const type = headers.match(/content-type:\s*([^\r\n]+)/i)?.[1]?.trim();
    return { buffer: content, contentType: type ?? "application/octet-stream" };
  }

  return { buffer: body, contentType: "application/octet-stream" };
}

function bearer(req) {
  const header = req.headers.authorization ?? "";
  const token = header.replace(/^Bearer\s+/i, "");
  return verify(token);
}

// --- Serveur ------------------------------------------------------------------

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://localhost:${PORT}`);
  const path = url.pathname;

  if (req.method === "OPTIONS") {
    res.writeHead(204, {
      "access-control-allow-origin": "*",
      "access-control-allow-methods": "GET,POST,PATCH,DELETE,PUT,OPTIONS",
      "access-control-allow-headers": "*",
    });
    res.end();
    return;
  }

  // --- Auth ------------------------------------------------------------------
  if (path.startsWith("/auth/v1/")) {
    const body = (await readBody(req)).toString();
    const payload = body ? JSON.parse(body) : {};

    // Envoi du lien de connexion : on considère le compte comme existant.
    if (path === "/auth/v1/otp") {
      const email = String(payload.email ?? "").toLowerCase();
      if (!USERS.has(email)) {
        USERS.set(email, { id: crypto.randomUUID(), email });
      }
      console.log(`[auth] lien de connexion demandé pour ${email}`);
      return json(res, 200, {});
    }

    // Vérification du code : le harnais accepte « 123456 ».
    if (path === "/auth/v1/verify") {
      const email = String(payload.email ?? "").toLowerCase();
      const user = USERS.get(email);
      if (!user || payload.token !== "123456") {
        return json(res, 403, { error: "invalid_otp", error_description: "Code invalide" });
      }
      return json(res, 200, sessionFor(user));
    }

    if (path === "/auth/v1/token") {
      const grant = url.searchParams.get("grant_type");
      if (grant === "refresh_token") {
        const id = String(payload.refresh_token ?? "").replace("refresh-", "");
        const user = users.find((u) => u.id === id) ?? [...USERS.values()].find((u) => u.id === id);
        if (!user) return json(res, 401, { error: "invalid_grant" });
        return json(res, 200, sessionFor(user));
      }
      return json(res, 400, { error: "unsupported_grant_type" });
    }

    if (path === "/auth/v1/user") {
      const claims = bearer(req);
      if (!claims) return json(res, 401, { message: "invalid token" });
      const user = [...USERS.values()].find((u) => u.id === claims.sub);
      if (!user) return json(res, 401, { message: "user not found" });
      return json(res, 200, sessionFor(user).user);
    }

    if (path === "/auth/v1/logout") {
      res.writeHead(204, { "access-control-allow-origin": "*" });
      return res.end();
    }

    return json(res, 404, { message: "not found" });
  }

  // --- Storage ---------------------------------------------------------------
  if (path.startsWith("/storage/v1/")) {
    const claims = bearer(req);

    // Téléversement
    if (req.method === "POST" && path.startsWith("/storage/v1/object/media/")) {
      if (!claims) return json(res, 401, { message: "unauthorized" });
      const key = path.replace("/storage/v1/object/media/", "");
      if (!key.startsWith(`${claims.sub}/`)) {
        return json(res, 403, { message: "row-level security" });
      }
      const raw = await readBody(req);
      FILES.set(key, extractUpload(raw, req.headers["content-type"]));
      console.log(
        `[storage] reçu ${key} (${FILES.get(key).buffer.length} octets, ${FILES.get(key).contentType})`,
      );
      return json(res, 200, { Key: `media/${key}` });
    }

    // Création d'un lien signé
    if (req.method === "POST" && path.startsWith("/storage/v1/object/sign/media/")) {
      if (!claims) return json(res, 401, { message: "unauthorized" });
      const key = path.replace("/storage/v1/object/sign/media/", "");
      if (!FILES.has(key)) return json(res, 404, { message: "Object not found" });
      return json(res, 200, {
        signedURL: `/object/sign/media/${key}?token=harness`,
      });
    }

    // Lecture d'un fichier signé
    if (req.method === "GET" && path.startsWith("/storage/v1/object/sign/media/")) {
      const key = path.replace("/storage/v1/object/sign/media/", "");
      const file = FILES.get(key);
      if (!file) {
        res.writeHead(404);
        return res.end();
      }

      // Le lecteur audio a besoin des requêtes Range pour se déplacer dans le fichier.
      const range = req.headers.range;
      const total = file.buffer.length;
      if (range) {
        const match = /bytes=(\d*)-(\d*)/.exec(range);
        const start = match?.[1] ? Number(match[1]) : 0;
        const end = match?.[2] ? Number(match[2]) : total - 1;
        const slice = file.buffer.subarray(start, end + 1);
        res.writeHead(206, {
          "content-type": file.contentType,
          "content-length": String(slice.length),
          "content-range": `bytes ${start}-${end}/${total}`,
          "accept-ranges": "bytes",
          "access-control-allow-origin": "*",
        });
        return res.end(slice);
      }

      res.writeHead(200, {
        "content-type": file.contentType,
        "content-length": String(total),
        "access-control-allow-origin": "*",
        "accept-ranges": "bytes",
      });
      return res.end(file.buffer);
    }

    // Suppression
    if (req.method === "DELETE" && path.startsWith("/storage/v1/object/media")) {
      const payload = JSON.parse((await readBody(req)).toString() || "{}");
      for (const prefix of payload.prefixes ?? []) FILES.delete(prefix);
      return json(res, 200, []);
    }

    return json(res, 404, { message: "not found" });
  }

  // --- REST : relais vers PostgREST -------------------------------------------
  if (path.startsWith("/rest/v1/")) {
    const target = `${POSTGREST}${path.replace("/rest/v1", "")}${url.search}`;
    const body = ["GET", "HEAD"].includes(req.method) ? undefined : await readBody(req);

    const headers = { ...req.headers };
    delete headers.host;
    delete headers["content-length"];
    delete headers.apikey;
    delete headers.connection;

    try {
      const response = await fetch(target, { method: req.method, headers, body });
      const text = await response.text();
      if (!response.ok) {
        console.log(`[rest] ${req.method} ${path} -> ${response.status} ${text.slice(0, 200)}`);
      }
      res.writeHead(response.status, {
        "content-type": response.headers.get("content-type") ?? "application/json",
        "content-range": response.headers.get("content-range") ?? "",
        "access-control-allow-origin": "*",
      });
      return res.end(text);
    } catch (error) {
      console.error("[rest] erreur", error.message);
      return json(res, 502, { message: String(error.message) });
    }
  }

  return json(res, 404, { message: "not found" });
});

server.listen(PORT, () => {
  console.log(`Harnais Supabase local sur http://localhost:${PORT}`);
  console.log(`Comptes : ${users.map((u) => u.email).join(", ")} — code de connexion : 123456`);
});
