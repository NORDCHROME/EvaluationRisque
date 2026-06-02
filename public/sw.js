// ═══════════════════════════════════════════════════════════════
// EvalRisque — Service Worker (offline + background sync)
// ═══════════════════════════════════════════════════════════════
const CACHE_NAME   = 'evalrisque-v1';
const SYNC_TAG     = 'evalrisque-sync';
const API_PREFIX   = '/api/';

// Ressources à précacher pour le mode offline
const PRECACHE = [
  '/',
  '/index.html',
  'https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js',
];

// ── Installation : précacher les ressources statiques ─────────
self.addEventListener('install', evt => {
  self.skipWaiting();
  evt.waitUntil(
    caches.open(CACHE_NAME).then(cache => {
      // Précacher silencieusement (ignorer les erreurs réseau à l'install)
      return Promise.allSettled(PRECACHE.map(url => cache.add(url).catch(() => {})));
    })
  );
});

// ── Activation : nettoyer les anciens caches ───────────────────
self.addEventListener('activate', evt => {
  evt.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

// ── Fetch : stratégie par type de requête ─────────────────────
self.addEventListener('fetch', evt => {
  const url = new URL(evt.request.url);

  // Requêtes API : Network first, puis erreur offline (pas de cache pour les GET sensibles)
  if (url.pathname.startsWith(API_PREFIX)) {
    // On ne met pas en cache les requêtes API sauf GET de données de référence
    const isRef = /\/(company|settings|custom-risks|custom-keywords|custom-types|intervention-types|risks|epi-items|keyword-rules)/.test(url.pathname);
    if (evt.request.method === 'GET' && isRef) {
      evt.respondWith(networkFirstWithCache(evt.request));
    }
    // Mutations offline → gérées par offlineQueue (voir api() côté client)
    return;
  }

  // Assets statiques : Cache first, puis réseau
  evt.respondWith(cacheFirstWithNetwork(evt.request));
});

// Cache first (assets statiques : HTML, JS, CSS, fonts)
async function cacheFirstWithNetwork(req) {
  const cached = await caches.match(req);
  if (cached) return cached;
  try {
    const res = await fetch(req);
    if (res.ok) {
      const cache = await caches.open(CACHE_NAME);
      cache.put(req, res.clone());
    }
    return res;
  } catch {
    // Hors ligne et pas en cache : renvoyer index.html pour les navigations
    if (req.mode === 'navigate') {
      const fallback = await caches.match('/index.html') || await caches.match('/');
      if (fallback) return fallback;
    }
    return new Response('Hors ligne — ressource non disponible', { status: 503 });
  }
}

// Network first (données de référence)
async function networkFirstWithCache(req) {
  try {
    const res = await fetch(req);
    if (res.ok) {
      const cache = await caches.open(CACHE_NAME);
      cache.put(req, res.clone());
    }
    return res;
  } catch {
    const cached = await caches.match(req);
    if (cached) return cached;
    return new Response(JSON.stringify([]), { headers: { 'Content-Type': 'application/json' } });
  }
}

// ── Background Sync : rejouer la file d'attente offline ────────
self.addEventListener('sync', evt => {
  if (evt.tag === SYNC_TAG) {
    evt.waitUntil(replayOfflineQueue());
  }
});

// ── Message depuis le client (sync manuelle) ───────────────────
self.addEventListener('message', evt => {
  if (evt.data?.type === 'SYNC_NOW') {
    replayOfflineQueue().then(() => {
      evt.source?.postMessage({ type: 'SYNC_DONE' });
    });
  }
  if (evt.data?.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});

// ── Rejouer la file d'attente stockée dans IndexedDB ──────────
async function replayOfflineQueue() {
  const db   = await openDB();
  const items = await getAllItems(db);
  if (!items.length) return;

  const results = { ok: 0, fail: 0 };

  for (const item of items) {
    try {
      const res = await fetch(item.url, {
        method:  item.method,
        headers: { ...item.headers, 'Content-Type': 'application/json' },
        body:    item.body || undefined,
      });
      if (res.ok) {
        await deleteItem(db, item.id);
        results.ok++;
      } else {
        results.fail++;
      }
    } catch {
      results.fail++; // Toujours hors ligne
    }
  }

  // Notifier tous les clients ouverts
  const clients = await self.clients.matchAll({ includeUncontrolled: true });
  clients.forEach(client => client.postMessage({
    type:    'SYNC_RESULT',
    synced:  results.ok,
    failed:  results.fail,
    total:   items.length,
  }));
}

// ── IndexedDB helpers ─────────────────────────────────────────
function openDB() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open('evalrisque-offline', 1);
    req.onupgradeneeded = e => {
      const db = e.target.result;
      if (!db.objectStoreNames.contains('queue')) {
        const store = db.createObjectStore('queue', { keyPath: 'id', autoIncrement: true });
        store.createIndex('createdAt', 'createdAt');
      }
    };
    req.onsuccess = e => resolve(e.target.result);
    req.onerror   = e => reject(e.target.error);
  });
}

function getAllItems(db) {
  return new Promise((resolve, reject) => {
    const tx    = db.transaction('queue', 'readonly');
    const store = tx.objectStore('queue');
    const req   = store.index('createdAt').getAll();
    req.onsuccess = e => resolve(e.target.result);
    req.onerror   = e => reject(e.target.error);
  });
}

function deleteItem(db, id) {
  return new Promise((resolve, reject) => {
    const tx    = db.transaction('queue', 'readwrite');
    const store = tx.objectStore('queue');
    const req   = store.delete(id);
    req.onsuccess = () => resolve();
    req.onerror   = e => reject(e.target.error);
  });
}
