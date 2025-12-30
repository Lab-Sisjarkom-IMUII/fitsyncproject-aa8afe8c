const CACHE_NAME = "fitsync-cache-v1";
const STATIC_CACHE_NAME = "fitsync-static-v1";
const API_CACHE_NAME = "fitsync-api-v1";

const urlsToCache = [
  "/",
  "/offline",
  "/manifest.json",
  "/icons/icon-192.jpg",
  "/icons/icon-512.jpg",
  "/_next/static/css/app.css",
  "/_next/static/chunks/main.js"
];

// Don't cache NextAuth routes
const AUTH_IGNORE = [
  '/api/auth/',
  '/api/auth/callback',
  '/api/auth/session',
  '/api/auth/providers'
];

// Don't cache API routes that should always be fresh
const API_IGNORE = [
  '/api/user-data',
  '/api/insights',
  '/api/ai',
  '/api/reminder'
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    Promise.all([
      caches.open(STATIC_CACHE_NAME)
        .then((cache) => {
          console.log("Static cache opened");
          return cache.addAll(urlsToCache);
        }),
      caches.open(API_CACHE_NAME)
        .then((cache) => {
          console.log("API cache opened");
          // Pre-populate API cache with minimal data
          return cache.put('/offline', new Response('Offline', { status: 200 }));
        })
    ])
  );
});

self.addEventListener("fetch", (event) => {
  const url = event.request.url;

  // Don't cache NextAuth routes
  if (AUTH_IGNORE.some(path => url.includes(path))) {
    event.respondWith(fetch(event.request));
    return;
  }

  // Also exclude auth and onboarding pages to prevent caching issues
  if (event.request.url.includes('/auth') || event.request.url.includes('/onboarding')) {
    event.respondWith(fetch(event.request));
    return;
  }

  // Handle API routes with different strategies
  if (event.request.url.includes('/api/')) {
    // Check if it's an API route that should not be cached
    if (API_IGNORE.some(path => url.includes(path))) {
      // Network-first strategy for critical API data
      event.respondWith(
        fetch(event.request)
          .then(networkResponse => {
            // Clone the response to put in cache for fallback
            const responseClone = networkResponse.clone();

            // Update API cache for future fallback
            caches.open(API_CACHE_NAME)
              .then(cache => cache.put(event.request, responseClone));

            return networkResponse;
          })
          .catch(() => {
            // If network fails, try cache
            return caches.match(event.request)
              .then(response => response || caches.match('/offline'));
          })
      );
    } else {
      // Cache-first strategy for other API routes
      event.respondWith(
        caches.match(event.request)
          .then(cachedResponse => {
            return cachedResponse || fetch(event.request)
              .then(networkResponse => {
                // Update cache with fresh response
                const responseClone = networkResponse.clone();
                caches.open(API_CACHE_NAME)
                  .then(cache => cache.put(event.request, responseClone));
                return networkResponse;
              })
              .catch(() => {
                // If both fail, serve offline page
                return caches.match('/offline');
              });
          })
      );
    }
  }
  // Check if the request is for navigation
  else if (event.request.mode === "navigate") {
    event.respondWith(
      fetch(event.request)
        .then((response) => {
          // If the response is successful, return it and update cache
          if (response.status === 200) {
            // Clone and cache the response for offline access
            const responseClone = response.clone();
            caches.open(STATIC_CACHE_NAME)
              .then(cache => cache.put(event.request, responseClone));
            return response;
          }

          // Otherwise, try to get from cache or return offline page
          return caches.match(event.request)
            .then((cachedResponse) => {
              return cachedResponse || caches.match("/offline");
            });
        })
        .catch(() => {
          // If fetch fails, return offline page from cache
          return caches.match("/offline")
            .then((offlineResponse) => {
              return offlineResponse || new Response("You are offline. Some features may be unavailable.", {
                status: 200,
                headers: { "Content-Type": "text/html" }
              });
            });
        })
    );
  } else {
    // For other requests (images, scripts, stylesheets), use cache-first strategy
    event.respondWith(
      caches.match(event.request)
        .then((cachedResponse) => {
          // Return cached response if found, otherwise fetch from network
          if (cachedResponse) {
            return cachedResponse;
          }

          return fetch(event.request)
            .then((networkResponse) => {
              // Cache network response if it's valid
              if (networkResponse.status === 200 &&
                  networkResponse.type === 'basic' &&
                  event.request.destination !== 'document') {
                const responseToCache = networkResponse.clone();
                caches.open(STATIC_CACHE_NAME)
                  .then((cache) => {
                    cache.put(event.request, responseToCache);
                  });
              }
              return networkResponse;
            })
            .catch(() => {
              // If network request fails, return cached response if available
              return cachedResponse;
            });
        })
    );
  }
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (cacheName !== STATIC_CACHE_NAME && cacheName !== API_CACHE_NAME) {
            console.log("Deleting old cache:", cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    })
  );
});