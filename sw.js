const CACHE_NAME = 'online-kelime-v42'; // v42 - 2026-03-27 16:15
const ASSETS_TO_CACHE = [
    './',
    './index.html',
    './styles.css',
    './script.js',
    './words.txt',
    './icon-512.png'
];

self.addEventListener('install', event => {
    event.waitUntil(
        caches.open(CACHE_NAME).then(cache => {
            return cache.addAll(ASSETS_TO_CACHE);
        })
    );
    self.skipWaiting();
});

self.addEventListener('activate', event => {
    event.waitUntil(
        caches.keys().then(cacheNames => {
            return Promise.all(
                cacheNames.map(cacheName => {
                    if (cacheName !== CACHE_NAME) {
                        return caches.delete(cacheName);
                    }
                })
            );
        })
    );
    self.clients.claim();
});

self.addEventListener('fetch', event => {
    // Exclude Firebase Auth and Google APIs from SW interception
    if (event.request.url.includes('/__/auth/') || 
        event.request.url.includes('googleapis.com') || 
        event.request.url.includes('firebase.com') || 
        event.request.url.includes('google.com') ||
        event.request.url.includes('firebaseapp.com')) {
        return; 
    }

    // Network-First strategy
    const isCoreAsset = ASSETS_TO_CACHE.some(asset => event.request.url.includes(asset.replace('./', '')));

    if (isCoreAsset || event.request.mode === 'navigate') {
        event.respondWith(
            fetch(event.request)
                .then(networkResponse => {
                    return caches.open(CACHE_NAME).then(cache => {
                        cache.put(event.request, networkResponse.clone());
                        return networkResponse;
                    });
                })
                .catch(() => caches.match(event.request))
        );
    } else {
        // Cache-First for other things (icons, etc)
        event.respondWith(
            caches.match(event.request).then(response => {
                return response || fetch(event.request);
            })
        );
    }
});
