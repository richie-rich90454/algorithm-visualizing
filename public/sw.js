/**
 * Offline service worker for the Algorithm Visualization Engine.
 *
 * Network-first with a cache fallback: a connected browser gets fresh files,
 * and a return visit works offline from whatever was already fetched. The app
 * shell is cached on install so the first offline open always works.
 */

const CACHE_NAME = "algorithm-visualizing-v1";

self.addEventListener("install", (event) => {
    const shell = new URL("index.html", self.registration.scope).href;
    event.waitUntil(caches.open(CACHE_NAME).then((cache) => cache.add(shell)));
    self.skipWaiting();
});

self.addEventListener("activate", (event) => {
    event.waitUntil(
        caches.keys().then((names) =>
            Promise.all(names.filter((name) => name !== CACHE_NAME).map((name) => caches.delete(name))),
        ),
    );
    self.clients.claim();
});

self.addEventListener("fetch", (event) => {
    const request = event.request;
    if (request.method !== "GET") return;

    const url = new URL(request.url);
    if (url.origin !== self.location.origin) return;

    event.respondWith(
        fetch(request)
            .then((response) => {
                if (response.ok && response.type === "basic") {
                    const copy = response.clone();
                    void caches.open(CACHE_NAME).then((cache) => cache.put(request, copy));
                }
                return response;
            })
            .catch(async () => {
                const cached = await caches.match(request);
                if (cached) return cached;
                const shell = new URL("index.html", self.registration.scope).href;
                const fallback = await caches.match(shell);
                if (fallback) return fallback;
                return Response.error();
            }),
    );
});
