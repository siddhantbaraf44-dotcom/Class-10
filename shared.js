/* ============= FIXED shared.js =============
   - Removed enablePersistence() (it can silently break the page)
   - Wrapped everything in try/catch with a visible error
   - Same Firebase config as your original
   Drop-in replacement for your existing shared.js.
*/
(function () {
  // Surface any boot error visibly (instead of failing silently)
  window.addEventListener('error', function (ev) {
    console.error('[shared.js boot error]', ev.error || ev.message);
  });

  try {
    var firebaseConfig = {
      apiKey: "AIzaSyAqhYpUhIdH5r2-LAtkGpN696nRwzB5GQA",
      authDomain: "rosho-c2d11.firebaseapp.com",
      databaseURL: "https://rosho-c2d11-default-rtdb.firebaseio.com",
      projectId: "rosho-c2d11",
      storageBucket: "rosho-c2d11.firebasestorage.app",
      messagingSenderId: "99652225033",
      appId: "1:99652225033:web:8988f43c9e77c27338d0d8"
    };

    if (!firebase.apps.length) firebase.initializeApp(firebaseConfig);
    var db = firebase.database();

    function escapeHtml(s) {
      return (s == null ? '' : String(s))
        .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
    }
    function showToast(msg, dur) {
      var t = document.getElementById('toast');
      if (!t) return;
      t.textContent = msg;
      t.classList.add('show');
      clearTimeout(t._t);
      t._t = setTimeout(function () { t.classList.remove('show'); }, dur || 1800);
    }
    function getParam(key) {
      return new URLSearchParams(window.location.search).get(key);
    }
    function buildUrl(page, params) {
      var qs = params ? new URLSearchParams(params).toString() : '';
      return page + (qs ? '?' + qs : '');
    }

    function updateOnline() {
      var el = document.getElementById('offlineTag');
      if (el) el.classList.toggle('show', !navigator.onLine);
    }
    window.addEventListener('online', updateOnline);
    window.addEventListener('offline', updateOnline);
    updateOnline();

    window.APP = { db: db, escapeHtml: escapeHtml, showToast: showToast, getParam: getParam, buildUrl: buildUrl };
    console.log('[shared.js] OK — window.APP set');
  } catch (e) {
    console.error('[shared.js] FATAL:', e);
    // Show the error in the page so it's not silent
    var body = document.body;
    if (body) {
      var banner = document.createElement('div');
      banner.style.cssText = 'position:fixed;top:0;left:0;right:0;background:#2a1418;color:#ffb1b8;padding:10px;font-family:monospace;font-size:13px;z-index:9999;white-space:pre-wrap;';
      banner.textContent = 'shared.js failed: ' + (e && e.stack || e);
      body.insertBefore(banner, body.firstChild);
    }
  }
})();
