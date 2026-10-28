// Service worker simplu: cache "network-first" pentru fisierele de date (ca sa fie mereu proaspete
// cand e net), si "cache-first" pentru restul (css/js/harta), ca aplicatia sa porneasca si offline.
const CACHE = 'peco-v1';
const CORE = [
    './',
    './index.html',
    './style.css',
    './app.js',
    './data.js',
    './map.js',
    './istoric.js',
    './manifest.json',
    './icons/icon.svg',
    './icons/icon-maskable.svg'
];

self.addEventListener('install', (event) => {
    event.waitUntil(caches.open(CACHE).then((cache) => cache.addAll(CORE)));
    self.skipWaiting();
});

self.addEventListener('activate', (event) => {
    event.waitUntil(
        caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
    );
    self.clients.claim();
});

const DATA_FILES = ['data.json', 'data.js', 'istoric.json', 'istoric.js'];

self.addEventListener('fetch', (event) => {
    if (event.request.method !== 'GET') return;
    const url = new URL(event.request.url);
    const isData = DATA_FILES.some((f) => url.pathname.endsWith(f));

    if (isData) {
        // network-first: preturi proaspete cand e net, ultimele cunoscute cand nu e
        event.respondWith(
            fetch(event.request)
                .then((res) => {
                    const copy = res.clone();
                    caches.open(CACHE).then((cache) => cache.put(event.request, copy));
                    return res;
                })
                .catch(() => caches.match(event.request))
        );
        return;
    }

    event.respondWith(
        caches.match(event.request).then((cached) => cached || fetch(event.request))
    );
});
