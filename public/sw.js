/*
 * Service worker d'Atelier.
 *
 * Objectif : rendre l'application installable et permettre l'ouverture de la
 * coquille hors connexion. Les données restent toujours demandées au réseau :
 * on ne met jamais en cache les appels Supabase, afin de ne jamais afficher
 * des informations périmées comme si elles étaient à jour.
 */

// La version change dès que la coquille change : l'ancien cache est alors
// effacé à l'activation, ce qui évite de servir hors connexion des écrans qui
// n'existent plus.
const VERSION = "atelier-v2";
const SHELL_CACHE = `${VERSION}-shell`;
const ASSET_CACHE = `${VERSION}-assets`;

const SHELL_ASSETS = [
  "/manifest.webmanifest",
  "/icons/icon-192.png",
  "/icons/icon-512.png",
  "/favicon.png",
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(SHELL_CACHE)
      .then((cache) => cache.addAll(SHELL_ASSETS))
      .then(() => self.skipWaiting())
      .catch(() => self.skipWaiting()),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys.filter((key) => !key.startsWith(VERSION)).map((key) => caches.delete(key)),
        ),
      )
      .then(() => self.clients.claim()),
  );
});

function isSupabase(url) {
  return url.hostname.endsWith(".supabase.co") || url.pathname.startsWith("/auth/");
}

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;
  if (isSupabase(url)) return;

  // Navigation : réseau d'abord, cache en secours si hors connexion.
  if (request.mode === "navigate") {
    event.respondWith(
      fetch(request)
        .then((response) => {
          const copy = response.clone();
          caches.open(SHELL_CACHE).then((cache) => cache.put(request, copy));
          return response;
        })
        .catch(() =>
          caches.match(request).then((cached) => cached ?? caches.match("/studio")),
        ),
    );
    return;
  }

  // Ressources statiques immuables : cache d'abord.
  if (url.pathname.startsWith("/_next/static/") || url.pathname.startsWith("/icons/")) {
    event.respondWith(
      caches.match(request).then(
        (cached) =>
          cached ??
          fetch(request).then((response) => {
            const copy = response.clone();
            caches.open(ASSET_CACHE).then((cache) => cache.put(request, copy));
            return response;
          }),
      ),
    );
  }
});
