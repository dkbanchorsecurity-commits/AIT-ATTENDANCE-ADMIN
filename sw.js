const CACHE_NAME = 'ait-admin-shell-v1';
const ASSETS_TO_CACHE = [
    '/',
    '/index.html',
    '/AIT.png',
    '/manifest.json'
    // Note: Tailwind and FontAwesome are loaded via CDN in your HTML. 
    // We will cache them dynamically below.
];

// 1. Install & Pre-cache UI Shell
self.addEventListener('install', (event) => {
    event.waitUntil(
        caches.open(CACHE_NAME).then((cache) => {
            return cache.addAll(ASSETS_TO_CACHE);
        })
    );
    self.skipWaiting();
});

// 2. Activate & Clean up old caches
self.addEventListener('activate', (event) => {
    event.waitUntil(
        caches.keys().then((cacheNames) => {
            return Promise.all(
                cacheNames.map((cache) => {
                    if (cache !== CACHE_NAME) {
                        return caches.delete(cache);
                    }
                })
            );
        })
    );
    self.clients.claim();
});

// 3. Intercept & Route Requests
self.addEventListener('fetch', (event) => {
    const url = new URL(event.request.url);

    // RULE A: Bypass cache completely for Firebase & Firestore API calls (Network Only)
    if (url.hostname.includes('googleapis.com') || 
        url.hostname.includes('firebaseio.com') || 
        url.hostname.includes('gstatic.com')) {
        return; // Exits the service worker, forcing the browser to use the network
    }

    // RULE B: UI Shell & Static Assets (Cache First, Fallback to Network)
    if (event.request.method === 'GET') {
        event.respondWith(
            caches.match(event.request).then((cachedResponse) => {
                if (cachedResponse) {
                    return cachedResponse; // Return from cache immediately
                }

                // If not in cache (e.g., FontAwesome, Tailwind CDN), fetch it and cache it dynamically
                return fetch(event.request).then((networkResponse) => {
                    // Don't cache invalid responses
                    if (!networkResponse || networkResponse.status !== 200 || networkResponse.type !== 'basic' && networkResponse.type !== 'cors') {
                        return networkResponse;
                    }

                    const responseToCache = networkResponse.clone();
                    caches.open(CACHE_NAME).then((cache) => {
                        cache.put(event.request, responseToCache);
                    });

                    return networkResponse;
                }).catch(() => {
                    // Optional: Return a custom offline HTML page if the network fails completely
                    // return caches.match('/offline.html');
                });
            })
        );
    }
});