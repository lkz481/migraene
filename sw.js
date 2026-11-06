// Offline-Cache für die App-Dateien. Bei Änderungen VERSION erhöhen.
const VERSION = 'migraene-v19';
const FILES = [
  './', './index.html', './styles.css', './app.js', './manifest.webmanifest',
  './icons/icon-180.png', './icons/icon-192.png', './icons/icon-512.png', './fonts/lexend.woff2'
];

self.addEventListener('install', e => {
  // cache: 'reload' holt frische Dateien statt evtl. veralteter aus dem Browser-Cache
  e.waitUntil(caches.open(VERSION).then(c => c.addAll(FILES.map(u => new Request(u, { cache: 'reload' })))).then(() => self.skipWaiting()));
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys()
      // Nur eigene alte Caches löschen – die Zyklus-App liegt unter derselben Adresse
      .then(keys => Promise.all(keys.filter(k => k.startsWith('migraene-') && k !== VERSION).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', e => {
  if (e.request.method !== 'GET') return;
  const url = new URL(e.request.url);
  if (url.origin !== location.origin) return; // Wetterdaten immer live laden
  // Netz zuerst (damit Updates ankommen), bei fehlendem oder zu langsamem Netz aus dem Cache
  const network = fetch(e.request).then(res => {
    // Nur gültige Antworten speichern, damit eine Fehlerseite nie die Offline-Kopie ersetzt
    if (res.ok) {
      const copy = res.clone();
      caches.open(VERSION).then(c => c.put(e.request, copy)).catch(() => {});
    }
    return res;
  });
  network.catch(() => {}); // Fehler wird unten behandelt
  const timeout = new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), 3000));
  e.respondWith(
    Promise.race([network, timeout])
      .catch(() => caches.match(e.request, { ignoreSearch: true }).then(r => r || network))
  );
});
