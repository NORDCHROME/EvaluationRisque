// ═══════════════════════════════════════════════════════════════
// EvalRisque — Offline Manager
// Gestion de la file d'attente hors ligne + sync automatique
// ═══════════════════════════════════════════════════════════════

const OfflineManager = (() => {

  const DB_NAME    = 'evalrisque-offline';
  const DB_VERSION = 1;
  const STORE      = 'queue';
  const SYNC_TAG   = 'evalrisque-sync';

  let _db          = null;
  let _online      = navigator.onLine;
  let _sw          = null;
  let _onSyncCb    = null;   // callback quand sync terminée

  // ── Init ────────────────────────────────────────────────────
  async function init() {
    // Ouvrir IndexedDB
    _db = await _openDB();

    // Enregistrer le Service Worker
    if ('serviceWorker' in navigator) {
      try {
        const reg = await navigator.serviceWorker.register('/sw.js', { scope: '/' });
        _sw = reg;
        console.log('[OfflineManager] SW enregistré:', reg.scope);

        // Écouter les messages du SW
        navigator.serviceWorker.addEventListener('message', _onSwMessage);

        // Vérifier les updates SW
        reg.addEventListener('updatefound', () => {
          const newWorker = reg.installing;
          newWorker?.addEventListener('statechange', () => {
            if (newWorker.statechange === 'installed' && navigator.serviceWorker.controller) {
              _showUpdateToast();
            }
          });
        });
      } catch (e) {
        console.warn('[OfflineManager] SW non disponible:', e.message);
      }
    }

    // Écouteurs réseau
    window.addEventListener('online',  _onOnline);
    window.addEventListener('offline', _onOffline);

    // Mettre à jour le bandeau de statut
    _updateStatusBanner();

    // Si online au démarrage, sync immédiate des items en attente
    if (_online) setTimeout(() => syncNow(), 2000);

    return { online: _online };
  }

  // ── Enregistrer une requête dans la file (hors ligne) ───────
  async function enqueue(method, url, headers, body) {
    if (!_db) return false;
    return new Promise((resolve, reject) => {
      const tx    = _db.transaction(STORE, 'readwrite');
      const store = tx.objectStore(STORE);
      const req   = store.add({
        method,
        url,
        headers,
        body:      body ? JSON.stringify(body) : null,
        createdAt: Date.now(),
        label:     `${method} ${url}`,
      });
      req.onsuccess = () => resolve(true);
      req.onerror   = e => reject(e.target.error);
    });
  }

  // ── Compter les items en attente ────────────────────────────
  async function pendingCount() {
    if (!_db) return 0;
    return new Promise((resolve) => {
      const tx    = _db.transaction(STORE, 'readonly');
      const store = tx.objectStore(STORE);
      const req   = store.count();
      req.onsuccess = e => resolve(e.target.result);
      req.onerror   = () => resolve(0);
    });
  }

  // ── Déclencher la sync ────────────────────────────────────
  async function syncNow() {
    const count = await pendingCount();
    if (!count) return;

    // Essayer Background Sync API (Chrome)
    if (_sw && 'sync' in _sw) {
      try {
        await _sw.sync.register(SYNC_TAG);
        return;
      } catch {}
    }

    // Fallback : message direct au SW
    if (navigator.serviceWorker.controller) {
      navigator.serviceWorker.controller.postMessage({ type: 'SYNC_NOW' });
      return;
    }

    // Fallback ultime : rejouer depuis le client
    await _replayFromClient();
  }

  // ── Rejouer depuis le client (fallback sans SW) ─────────────
  async function _replayFromClient() {
    if (!_db) return;
    const items = await _getAllItems();
    if (!items.length) return;

    let synced = 0, failed = 0;
    for (const item of items) {
      try {
        const res = await fetch(item.url, {
          method:  item.method,
          headers: { ...item.headers, 'Content-Type': 'application/json' },
          body:    item.body || undefined,
        });
        if (res.ok) {
          await _deleteItem(item.id);
          synced++;
        } else { failed++; }
      } catch { failed++; }
    }

    _onSwMessage({ data: { type: 'SYNC_RESULT', synced, failed, total: items.length } });
  }

  // ── Événements réseau ────────────────────────────────────────
  function _onOnline() {
    _online = true;
    _updateStatusBanner();
    setTimeout(() => syncNow(), 800);
  }

  function _onOffline() {
    _online = false;
    _updateStatusBanner();
  }

  // ── Réception message du SW ──────────────────────────────────
  function _onSwMessage(evt) {
    const data = evt.data;
    if (!data) return;

    if (data.type === 'SYNC_RESULT') {
      _updateStatusBanner();
      if (data.synced > 0) {
        _showToast(
          `☁️ ${data.synced} action${data.synced > 1 ? 's' : ''} synchronisée${data.synced > 1 ? 's' : ''} avec le serveur`,
          'success'
        );
        // Rafraîchir les données
        if (typeof loadAllDataFromAPI === 'function') loadAllDataFromAPI().catch(() => {});
        if (typeof renderMyEvals === 'function') renderMyEvals().catch(() => {});
        if (typeof renderValidationList === 'function') renderValidationList().catch(() => {});
      }
      if (data.failed > 0) {
        _showToast(`⚠️ ${data.failed} action(s) n'ont pas pu être synchronisées`, 'error');
      }
      if (_onSyncCb) _onSyncCb(data);
    }

    if (data.type === 'SYNC_DONE') {
      _updateStatusBanner();
    }
  }

  // ── Bandeau de statut offline ────────────────────────────────
  async function _updateStatusBanner() {
    let banner = document.getElementById('offlineBanner');

    if (_online) {
      const count = await pendingCount();
      if (count > 0) {
        _ensureBanner();
        banner = document.getElementById('offlineBanner');
        banner.style.background = '#d97706';
        banner.innerHTML = `
          <span>🔄 ${count} action${count > 1 ? 's' : ''} en attente de synchronisation</span>
          <button onclick="OfflineManager.syncNow()" style="margin-left:12px;padding:3px 12px;background:rgba(255,255,255,.25);border:1px solid rgba(255,255,255,.4);border-radius:3px;color:#fff;font-size:11px;font-weight:700;cursor:pointer">Synchroniser maintenant</button>
        `;
        banner.style.display = 'flex';
      } else {
        if (banner) banner.style.display = 'none';
      }
    } else {
      _ensureBanner();
      banner = document.getElementById('offlineBanner');
      banner.style.background = '#dc2626';
      banner.innerHTML = `<span>📵 Mode hors ligne — vos actions seront synchronisées à la reconnexion</span>`;
      banner.style.display = 'flex';
    }
  }

  function _ensureBanner() {
    if (document.getElementById('offlineBanner')) return;
    const el = document.createElement('div');
    el.id = 'offlineBanner';
    el.style.cssText = [
      'display:none',
      'position:fixed',
      'top:0',
      'left:0',
      'right:0',
      'z-index:9999',
      'align-items:center',
      'justify-content:center',
      'gap:10px',
      'padding:8px 20px',
      'color:#fff',
      'font-size:12px',
      'font-weight:600',
      'text-align:center',
      'box-shadow:0 2px 8px rgba(0,0,0,.3)',
    ].join(';');
    document.body.prepend(el);
  }

  function _showUpdateToast() {
    _showToast('🆕 Mise à jour disponible — <button onclick="location.reload()" style="font-weight:700;text-decoration:underline;background:none;border:none;cursor:pointer;color:inherit">Actualiser</button>', 'info', 8000);
  }

  // ── Toast helper ─────────────────────────────────────────────
  function _showToast(msg, type, duration) {
    if (typeof showToast === 'function') { showToast(msg, type, duration); return; }
    console.log(`[OfflineManager] ${type}: ${msg}`);
  }

  // ── IndexedDB helpers ────────────────────────────────────────
  function _openDB() {
    return new Promise((resolve, reject) => {
      const req = indexedDB.open(DB_NAME, DB_VERSION);
      req.onupgradeneeded = e => {
        const db = e.target.result;
        if (!db.objectStoreNames.contains(STORE)) {
          const store = db.createObjectStore(STORE, { keyPath: 'id', autoIncrement: true });
          store.createIndex('createdAt', 'createdAt');
        }
      };
      req.onsuccess = e => resolve(e.target.result);
      req.onerror   = e => reject(e.target.error);
    });
  }

  function _getAllItems() {
    return new Promise((resolve) => {
      if (!_db) return resolve([]);
      const tx    = _db.transaction(STORE, 'readonly');
      const store = tx.objectStore(STORE);
      const req   = store.index('createdAt').getAll();
      req.onsuccess = e => resolve(e.target.result);
      req.onerror   = () => resolve([]);
    });
  }

  function _deleteItem(id) {
    return new Promise((resolve) => {
      if (!_db) return resolve();
      const tx    = _db.transaction(STORE, 'readwrite');
      const store = tx.objectStore(STORE);
      store.delete(id);
      tx.oncomplete = () => resolve();
      tx.onerror    = () => resolve();
    });
  }

  return {
    init,
    enqueue,
    pendingCount,
    syncNow,
    isOnline: () => _online,
    onSync: (cb) => { _onSyncCb = cb; },
  };
})();

// Lancer au chargement de la page
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => OfflineManager.init());
} else {
  OfflineManager.init();
}
