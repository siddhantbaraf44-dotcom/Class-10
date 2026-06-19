/* ============================================================
   shared.js — Q&A Student (Android-optimized, v2)

   Responsibilities (loaded synchronously, before page script):
     1. localStorage cache for the entire /classes Firebase tree
        (key: "qa:v1:tree", meta: "qa:v1:meta").
     2. URL helpers, HTML escaping, toast.
     3. Lazy Firebase SDK loader (dynamic <script async>).
        Does NOT block initial render.
     4. refreshTree()       — fetches whole /classes tree
        refreshSlice(path)  — fetches only one Firebase path
        Both write-through to localStorage so the next visit is instant.

   No service worker. No PWA. No Cloudflare bot challenge.
   ============================================================ */
(function () {
  window.APP = window.APP || {};

  /* ---------- localStorage cache ---------- */
  var TREE_KEY = 'qa:v1:tree';
  var META_KEY = 'qa:v1:meta';

  function _lsGet(key) {
    try { return JSON.parse(localStorage.getItem(key) || 'null'); }
    catch (e) { return null; }
  }
  function _lsSet(key, value) {
    try { localStorage.setItem(key, JSON.stringify(value)); return true; }
    catch (e) { return false; } /* QuotaExceededError etc. */
  }
  function _lsDel(key) {
    try { localStorage.removeItem(key); } catch (e) {}
  }

  function _setPath(obj, parts, value) {
    var cur = obj;
    for (var i = 0; i < parts.length - 1; i++) {
      var p = parts[i];
      if (cur[p] == null || typeof cur[p] !== 'object') cur[p] = {};
      cur = cur[p];
    }
    cur[parts[parts.length - 1]] = value;
  }

  /* The cached tree's root IS Firebase's /classes path, so a path like
     "/classes/C10/subjects" becomes just ["C10","subjects"]. We strip the
     leading "classes/" (and any leading slashes) before traversal. */
  function _normalizePath(path) {
    var s = String(path || '').replace(/^\/+/, '');
    if (s.indexOf('classes/') === 0) s = s.slice('classes/'.length);
    else if (s === 'classes') s = '';
    return s.split('/').filter(Boolean);
  }

  var Store = {
    /* Full /classes tree */
    getTree: function () { return _lsGet(TREE_KEY); },
    setTree: function (data) {
      var ok = _lsSet(TREE_KEY, data);
      _lsSet(META_KEY, { t: Date.now() });
      return ok;
    },
    ageMs: function () {
      var m = _lsGet(META_KEY);
      return m && m.t ? Date.now() - m.t : Infinity;
    },
    /* One slice at a Firebase-style path, e.g. "/classes/C10/subjects".
       The leading "/classes" is stripped because the tree root IS /classes. */
    getBranch: function (path) {
      var tree = _lsGet(TREE_KEY);
      if (!tree) return null;
      var parts = _normalizePath(path);
      var cur = tree;
      for (var i = 0; i < parts.length; i++) {
        if (cur == null) return null;
        cur = cur[parts[i]];
      }
      return cur == null ? null : cur;
    },
    setBranch: function (path, value) {
      var tree = _lsGet(TREE_KEY) || {};
      var parts = _normalizePath(path);
      if (!parts.length) return;
      _setPath(tree, parts, value);
      this.setTree(tree);
    },
    clear: function () { _lsDel(TREE_KEY); _lsDel(META_KEY); }
  };
  window.APP.Store = Store;

  /* ---------- URL + DOM helpers ---------- */
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
  function setUpdating(on) {
    var el = document.getElementById('updatePill');
    if (el) el.classList.toggle('show', !!on);
  }
  Object.assign(window.APP, {
    escapeHtml: escapeHtml,
    showToast: showToast,
    getParam: getParam,
    buildUrl: buildUrl,
    setUpdating: setUpdating
  });

  /* ---------- Lazy Firebase SDK loader ----------
     SDKs are injected as <script async> after the initial render so they
     never block the cached render. Subsequent calls reuse the same
     in-flight promise. */
  var _sdkReady = null;
  var _cfg = {
    apiKey: 'AIzaSyAqhYpUhIdH5r2-LAtkGpN696nRwzB5GQA',
    authDomain: 'rosho-c2d11.firebaseapp.com',
    databaseURL: 'https://rosho-c2d11-default-rtdb.firebaseio.com',
    projectId: 'rosho-c2d11',
    storageBucket: 'rosho-c2d11.firebasestorage.app',
    messagingSenderId: '99652225033',
    appId: '1:99652225033:web:8988f43c9e77c27338d0d8'
  };
  function _inject(src) {
    return new Promise(function (resolve, reject) {
      var s = document.createElement('script');
      s.src = src;
      s.async = true;
      s.onload = function () { resolve(); };
      s.onerror = function () { reject(new Error('Failed to load ' + src)); };
      document.head.appendChild(s);
    });
  }
  function loadFirebase() {
    if (_sdkReady) return _sdkReady;
    _sdkReady = (window.firebase && firebase.database)
      ? Promise.resolve()
      : Promise.all([
          _inject('https://www.gstatic.com/firebasejs/12.14.0/firebase-app-compat.js'),
          _inject('https://www.gstatic.com/firebasejs/12.14.0/firebase-database-compat.js')
        ]).then(function () {
          if (!firebase.apps.length) firebase.initializeApp(_cfg);
          window.APP.db = firebase.database();
        });
    return _sdkReady;
  }

  /* ---------- Network helpers (always write-through to cache) ---------- */
  function refreshTree() {
    return loadFirebase().then(function () {
      return new Promise(function (resolve, reject) {
        window.APP.db.ref('/classes').once('value', function (snap) {
          var data = snap.val() || {};
          Store.setTree(data);
          resolve(data);
        }, reject);
      });
    });
  }
  function refreshSlice(path) {
    return loadFirebase().then(function () {
      return new Promise(function (resolve, reject) {
        window.APP.db.ref(path).once('value', function (snap) {
          var v = snap.val();
          Store.setBranch(path, v);
          resolve(v);
        }, reject);
      });
    });
  }
  window.APP.loadFirebase = loadFirebase;
  window.APP.refreshTree = refreshTree;
  window.APP.refreshSlice = refreshSlice;

  /* ---------- Online/offline indicator ---------- */
  function updateOnline() {
    var el = document.getElementById('offlineTag');
    if (el) el.classList.toggle('show', !navigator.onLine);
  }
  window.addEventListener('online', updateOnline);
  window.addEventListener('offline', updateOnline);
  updateOnline();
})();
