/* ===== Shared student-app code =====
   - Firebase init (once) + offline persistence
   - URL helpers
   - HTML escaping
   - Toast helper
*/
(function () {
  const firebaseConfig = {
    apiKey: "AIzaSyAqhYpUhIdH5r2-LAtkGpN696nRwzB5GQA",
    authDomain: "rosho-c2d11.firebaseapp.com",
    databaseURL: "https://rosho-c2d11-default-rtdb.firebaseio.com",
    projectId: "rosho-c2d11",
    storageBucket: "rosho-c2d11.firebasestorage.app",
    messagingSenderId: "99652225033",
    appId: "1:99652225033:web:8988f43c9e77c27338d0d8"
  };

  if (!firebase.apps.length) firebase.initializeApp(firebaseConfig);
  const db = firebase.database();

  try {
    db.enablePersistence({ synchronizeTabs: true }).catch(err => {
      if (err.code !== 'failed-precondition' && err.code !== 'unimplemented') {
        console.warn('Persistence error:', err);
      }
    });
  } catch (e) { /* ignore */ }

  function escapeHtml(s) {
    return (s == null ? '' : String(s))
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }

  function showToast(msg, dur) {
    const t = document.getElementById('toast');
    if (!t) return;
    t.textContent = msg;
    t.classList.add('show');
    clearTimeout(t._t);
    t._t = setTimeout(() => t.classList.remove('show'), dur || 1800);
  }

  function getParam(key) {
    return new URLSearchParams(window.location.search).get(key);
  }

  function buildUrl(page, params) {
    const qs = params ? new URLSearchParams(params).toString() : '';
    return page + (qs ? '?' + qs : '');
  }

  function updateOnline() {
    const el = document.getElementById('offlineTag');
    if (el) el.classList.toggle('show', !navigator.onLine);
  }
  window.addEventListener('online', updateOnline);
  window.addEventListener('offline', updateOnline);
  updateOnline();

  // Register service worker (PWA install + offline shell)
  if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
      navigator.serviceWorker.register('./sw.js').catch(() => {
        /* registration may fail on file:// or http (non-https) origins */
      });
    });
  }

  // Expose helpers globally
  window.APP = { db, escapeHtml, showToast, getParam, buildUrl };
})();
