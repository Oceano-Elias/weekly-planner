// Service Worker for Weekly Planner PWA
// Version: 3.1.0 - Full offline support with update notifications

const CACHE_VERSION = 'v5';
const APP_VERSION = '3.2.0';
const CACHE_NAME = `planner-v5`;

const DISABLE_ON_PORTS = new Set(['5173', '5174', '5175']);
const disableServiceWorker =
    (self.location.hostname === 'localhost' || self.location.hostname === '127.0.0.1') &&
    DISABLE_ON_PORTS.has(self.location.port);

// Core assets to cache for offline use
const CORE_ASSETS = ['./', './index.html', './manifest.json', './icon.png'];

if (disableServiceWorker) {
    self.addEventListener('install', (event) => {
        event.waitUntil(self.skipWaiting());
    });

    self.addEventListener('activate', (event) => {
        event.waitUntil(
            caches
                .keys()
                .then((names) => Promise.all(names.map((name) => caches.delete(name))))
                .then(() => self.clients.claim())
                .then(() => self.registration.unregister())
        );
    });

    self.addEventListener('fetch', (event) => {
        event.respondWith(fetch(event.request));
    });
} else {
    // Install: Cache all core assets
    self.addEventListener('install', (event) => {
        console.log('[SW] Installing version:', CACHE_VERSION);
        event.waitUntil(
            caches
                .open(CACHE_NAME)
                .then((cache) => {
                    console.log('[SW] Caching core assets');
                    return cache.addAll(CORE_ASSETS);
                })
                .then(() => {
                    // Skip waiting to activate immediately
                    return self.skipWaiting();
                })
        );
    });

    // Activate: Clean up old caches and notify clients
    self.addEventListener('activate', (event) => {
        console.log('[SW] Activating version:', CACHE_VERSION);
        event.waitUntil(
            caches
                .keys()
                .then((cacheNames) => {
                    return Promise.all(
                        cacheNames
                            .filter((name) => name.startsWith('planner-') && name !== CACHE_NAME)
                            .map((name) => {
                                console.log('[SW] Deleting old cache:', name);
                                return caches.delete(name);
                            })
                    );
                })
                .then(() => {
                    // Take control of all clients
                    return self.clients.claim();
                })
                .then(() => {
                    // Notify all clients about the update
                    return self.clients.matchAll();
                })
                .then((clients) => {
                    clients.forEach((client) => {
                        client.postMessage({ type: 'UPDATE_AVAILABLE', version: CACHE_VERSION });
                    });
                })
        );
    });

    // Fetch: Network-first for HTML, cache-first with network fallback for assets
    self.addEventListener('fetch', (event) => {
        const url = new URL(event.request.url);

        if (
            url.pathname.startsWith('/@vite') ||
            url.pathname.startsWith('/src/') ||
            url.pathname.startsWith('/node_modules/') ||
            url.pathname.includes('/@id/') ||
            url.searchParams.has('import')
        ) {
            event.respondWith(fetch(event.request));
            return;
        }

        // Navigation requests (HTML pages) - Network first
        if (
            event.request.mode === 'navigate' ||
            url.pathname.endsWith('.html') ||
            url.pathname === '/' ||
            url.pathname === ''
        ) {
            event.respondWith(
                fetch(event.request)
                    .then((response) => {
                        if (response.status === 200) {
                            const responseClone = response.clone();
                            caches.open(CACHE_NAME).then((cache) => {
                                cache.put(event.request, responseClone);
                            });
                        }
                        return response;
                    })
                    .catch(() => {
                        return caches
                            .match(event.request)
                            .then(
                                (cached) =>
                                    cached || caches.match('./index.html') || caches.match('./')
                            );
                    })
            );
            return;
        }

        // Static assets (JS, CSS, images) - Cache first with network fallback
        // Also handle cross-origin fonts and icons
        const isAsset =
            url.origin === location.origin ||
            url.hostname.includes('fonts.googleapis.com') ||
            url.hostname.includes('fonts.gstatic.com');

        if (isAsset) {
            event.respondWith(
                caches.match(event.request).then((cachedResponse) => {
                    if (cachedResponse) {
                        // Background refresh for non-hashed assets
                        if (
                            !url.pathname.includes('.') ||
                            !url.pathname.match(/\.[a-f0-9]{8,}\./)
                        ) {
                            fetch(event.request)
                                .then((networkResponse) => {
                                    if (networkResponse && networkResponse.status === 200) {
                                        caches.open(CACHE_NAME).then((cache) => {
                                            cache.put(event.request, networkResponse);
                                        });
                                    }
                                })
                                .catch(() => {});
                        }
                        return cachedResponse;
                    }

                    return fetch(event.request).then((networkResponse) => {
                        if (
                            networkResponse &&
                            (networkResponse.status === 200 || networkResponse.type === 'opaque')
                        ) {
                            const responseClone = networkResponse.clone();
                            caches.open(CACHE_NAME).then((cache) => {
                                cache.put(event.request, responseClone);
                            });
                        }
                        return networkResponse;
                    });
                })
            );
        }
    });

    // Listen for skip waiting message
    self.addEventListener('message', (event) => {
        if (event.data && event.data.type === 'SKIP_WAITING') {
            self.skipWaiting();
        }
    });
}
