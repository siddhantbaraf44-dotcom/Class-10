/* ============================================================
   shared.js — Q&A Student (no localStorage)

   - No browser localStorage cache: every page reads fresh data from Firebase.
   - Uses Firebase Realtime Database REST API for fast read-only loading.
   - Loads only the small slice each page needs where possible.
   - Adds request timeout + visible error banners so the UI never spins forever.
   - Keeps URL helpers, HTML escaping, toast, and online/offline indicator.
   - NEW: slug helpers + SEO meta helpers for clean, SEO-friendly URLs.
   ============================================================ */
(function () {
  /* ---------- Global error handler ---------- */
  function _showErrorBanner(label, err) {
    try {
      console.error('[Q&A]', label, err);
      var body = document.body;
      if (!body) return;
      var old = document.getElementById('qaFatalError');
      if (old) old.remove();
      var b = document.createElement('div');
      b.id = 'qaFatalError';
      b.style.cssText = 'position:fixed;top:0;left:0;right:0;z-index:99999;' +
                        'background:#2a1418;color:#ffb1b8;border-bottom:2px solid #ff8a96;' +
                        'padding:10px 14px;font:13px/1.4 ui-monospace,SFMono-Regular,Menlo,monospace;' +
                        'white-space:pre-wrap;word-break:break-word;max-height:50vh;overflow:auto;';
      var msg = (err && err.stack) ? err.stack : (err && err.message) ? err.message : String(err);
      b.textContent = '⚠ ' + label + '\n' + msg;
      body.insertBefore(b, body.firstChild);
    } catch (e) { /* swallow */ }
  }
  window.addEventListener('error', function (ev) {
    _showErrorBanner('window.error: ' + (ev.message || 'unknown'), ev.error || ev);
  });
  window.addEventListener('unhandledrejection', function (ev) {
    _showErrorBanner('unhandledrejection', ev.reason || 'unknown');
  });

  try {
    window.APP = window.APP || {};

    var DB_URL = 'https://rosho-c2d11-default-rtdb.firebaseio.com';
    var REQUEST_TIMEOUT_MS = 12000;

    /* ---------- DOM helpers ---------- */
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
    function showContentError(el, message, backHtml) {
      if (!el) return;
      el.innerHTML = '<div class="error-banner">' + escapeHtml(message) +
                     (backHtml || '') + '</div>';
    }

    /* ---------- Firebase REST helpers ---------- */
    function _withTimeout(promise, label) {
      var timer;
      var timeout = new Promise(function (_, reject) {
        timer = setTimeout(function () {
          reject(new Error((label || 'Request') + ' timed out. Check your internet connection and Firebase rules.'));
        }, REQUEST_TIMEOUT_MS);
      });
      return Promise.race([promise, timeout]).then(function (v) {
        clearTimeout(timer);
        return v;
      }, function (err) {
        clearTimeout(timer);
        throw err;
      });
    }

    function _toRestUrl(path, query) {
      var cleaned = String(path || '/classes').replace(/^\/+|\/+$/g, '');
      if (!cleaned) cleaned = 'classes';
      var parts = cleaned.split('/').filter(Boolean).map(function (part) {
        return encodeURIComponent(part);
      });
      var url = DB_URL + '/' + parts.join('/') + '.json';
      if (query) {
        var qs = new URLSearchParams(query).toString();
        if (qs) url += '?' + qs;
      }
      return url;
    }

    function readData(path, query) {
      if (!window.fetch) {
        return Promise.reject(new Error('This browser is too old: fetch() is not supported.'));
      }

      var controller = window.AbortController ? new AbortController() : null;
      var req = fetch(_toRestUrl(path, query), {
        method: 'GET',
        cache: 'no-store',
        signal: controller ? controller.signal : undefined
      }).then(function (res) {
        if (!res.ok) {
          throw new Error('Firebase read failed (' + res.status + ' ' + res.statusText + ')');
        }
        return res.json();
      });

      return _withTimeout(req, 'Firebase read').catch(function (err) {
        if (controller && err && /timed out/i.test(err.message || '')) {
          try { controller.abort(); } catch (e) {}
        }
        if (err && err.name === 'AbortError') {
          throw new Error('Firebase read timed out. Check your internet connection.');
        }
        throw err;
      });
    }

    function getName(value, fallback) {
      if (value == null) return fallback || '';
      if (typeof value === 'object' && value.name != null) return String(value.name);
      return String(value);
    }

    function generateSlug(name) {
      return String(name || '')
        .toLowerCase()
        .trim()
        .replace(/[^a-z0-9\s-]+/g, '')
        .replace(/\s+/g, '-')
        .replace(/-+/g, '-')
        .replace(/^-|-$/g, '');
    }

    function sortByName(items) {
      return items.sort(function (a, b) {
        return String(a.name || a.id).localeCompare(String(b.name || b.id), undefined, { numeric: true });
      });
    }

    function svgIcon(kind) {
      var paths = {
        class: '<path d="M4 7.5 12 4l8 3.5-8 3.5L4 7.5Z"/><path d="M6.5 10v4.2c0 1.3 2.5 2.8 5.5 2.8s5.5-1.5 5.5-2.8V10"/>',
        subject: '<path d="M6.5 4.5h8.5a2.5 2.5 0 0 1 2.5 2.5v12.5h-11A2.5 2.5 0 0 1 4 17V7a2.5 2.5 0 0 1 2.5-2.5Z"/><path d="M7 15.5h10.5"/><path d="M8 8h6"/>',
        chapter: '<path d="M5 5.5A2.5 2.5 0 0 1 7.5 3H19v16H7.5A2.5 2.5 0 0 0 5 21V5.5Z"/><path d="M8 7h7"/><path d="M8 10.5h8"/>',
        question: '<path d="M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18Z"/><path d="M9.7 9a2.4 2.4 0 0 1 4.5 1.2c0 1.8-2.2 2-2.2 3.6"/><path d="M12 17h.01"/>',
        book: '<path d="M6.5 4H18a2 2 0 0 1 2 2v14H7.5A3.5 3.5 0 0 1 4 16.5v-10A2.5 2.5 0 0 1 6.5 4Z"/><path d="M7 16h13"/><path d="M8 8h7"/>',
        download: '<path d="M12 4v10"/><path d="m8 10 4 4 4-4"/><path d="M5 20h14"/>'
      };
      return '<span class="card-icon" aria-hidden="true"><svg viewBox="0 0 24 24">' + (paths[kind] || paths.question) + '</svg></span>';
    }

    /* Reads only child keys first, then each child's /name and /slug.
       This avoids downloading all nested chapters/questions just to render lists. */
    function getChildSummaries(path) {
      return readData(path, { shallow: true }).then(function (keysObj) {
        var ids = Object.keys(keysObj || {});
        if (!ids.length) return [];
        return Promise.all(ids.map(function (id) {
          return Promise.all([
            readData(path + '/' + id + '/name').catch(function () { return id; }),
            readData(path + '/' + id + '/slug').catch(function () { return ''; })
          ]).then(function (parts) {
            var name = getName(parts[0], id);
            var slug = String(parts[1] || '').trim() || generateSlug(name);
            return { id: id, name: name, slug: slug };
          });
        })).then(sortByName);
      });
    }

    function getClassSummaries() {
      return readData('/classes', { shallow: true }).then(function (keysObj) {
        var ids = Object.keys(keysObj || {});
        if (!ids.length) return [];
        return Promise.all(ids.map(function (id) {
          return Promise.all([
            readData('/classes/' + id + '/name').catch(function () { return id; }),
            readData('/classes/' + id + '/board').catch(function () { return ''; }),
            readData('/classes/' + id + '/boardOrder').catch(function () { return null; }),
            readData('/classes/' + id + '/order').catch(function () { return null; }),
            readData('/classes/' + id + '/slug').catch(function () { return ''; }),
            readData('/classes/' + id + '/subjects', { shallow: true }).catch(function () { return null; })
          ]).then(function (parts) {
            var subjectKeys = parts[5] || {};
            var name = getName(parts[0], id);
            return {
              id: id,
              name: name,
              slug: String(parts[4] || '').trim() || generateSlug(name),
              board: getName(parts[1], 'Classes') || 'Classes',
              boardOrder: Number(parts[2] == null ? 9999 : parts[2]),
              order: Number(parts[3] == null ? 9999 : parts[3]),
              subjectCount: Object.keys(subjectKeys).length
            };
          });
        })).then(function (items) {
          return items.sort(function (a, b) {
            if (a.boardOrder !== b.boardOrder) return a.boardOrder - b.boardOrder;
            var bc = String(a.board).localeCompare(String(b.board), undefined, { numeric: true });
            if (bc) return bc;
            if (a.order !== b.order) return a.order - b.order;
            return String(a.name || a.id).localeCompare(String(b.name || b.id), undefined, { numeric: true });
          });
        });
      });
    }

    function getChapterSummaries(path) {
      return readData(path, { shallow: true }).then(function (keysObj) {
        var ids = Object.keys(keysObj || {});
        if (!ids.length) return [];
        return Promise.all(ids.map(function (id) {
          return Promise.all([
            readData(path + '/' + id + '/name').catch(function () { return id; }),
            readData(path + '/' + id + '/slug').catch(function () { return ''; }),
            readData(path + '/' + id + '/questions', { shallow: true }).catch(function () { return null; })
          ]).then(function (parts) {
            var name = getName(parts[0], id);
            var slug = String(parts[1] || '').trim() || generateSlug(name);
            var qKeys = parts[2] || {};
            return {
              id: id,
              name: name,
              slug: slug,
              qcount: Object.keys(qKeys).length
            };
          });
        })).then(sortByName);
      });
    }

    /* ---------- Slug resolution helpers ---------- */
    function resolveClassSlug(slug) {
      return readData('/classes').then(function (data) {
        var keys = Object.keys(data || {});
        for (var i = 0; i < keys.length; i++) {
          var id = keys[i];
          var item = data[id] || {};
          var itemSlug = item.slug || generateSlug(item.name);
          if (itemSlug === slug) {
            return { id: id, name: item.name || id, slug: itemSlug };
          }
        }
        return null;
      });
    }

    function resolveSubjectSlug(classId, slug) {
      return readData('/classes/' + classId + '/subjects').then(function (data) {
        var keys = Object.keys(data || {});
        for (var i = 0; i < keys.length; i++) {
          var id = keys[i];
          var item = data[id] || {};
          var itemSlug = item.slug || generateSlug(item.name);
          if (itemSlug === slug) {
            return { id: id, name: item.name || id, slug: itemSlug };
          }
        }
        return null;
      });
    }

    function resolveChapterSlug(classId, subjectId, slug) {
      return readData('/classes/' + classId + '/subjects/' + subjectId + '/chapters').then(function (data) {
        var keys = Object.keys(data || {});
        for (var i = 0; i < keys.length; i++) {
          var id = keys[i];
          var item = data[id] || {};
          var itemSlug = item.slug || generateSlug(item.name);
          if (itemSlug === slug) {
            return { id: id, name: item.name || id, slug: itemSlug };
          }
        }
        return null;
      });
    }

    function loadClassById(id) {
      return Promise.all([
        readData('/classes/' + id + '/name').catch(function () { return ''; }),
        readData('/classes/' + id + '/slug').catch(function () { return ''; })
      ]).then(function (parts) {
        var name = parts[0] || '';
        var slug = String(parts[1] || '').trim() || generateSlug(name);
        return { id: id, name: name, slug: slug };
      });
    }

    function loadSubjectById(classId, id) {
      return Promise.all([
        readData('/classes/' + classId + '/subjects/' + id + '/name').catch(function () { return ''; }),
        readData('/classes/' + classId + '/subjects/' + id + '/slug').catch(function () { return ''; })
      ]).then(function (parts) {
        var name = parts[0] || '';
        var slug = String(parts[1] || '').trim() || generateSlug(name);
        return { id: id, name: name, slug: slug };
      });
    }

    function loadChapterById(classId, subjectId, id) {
      return Promise.all([
        readData('/classes/' + classId + '/subjects/' + subjectId + '/chapters/' + id + '/name').catch(function () { return ''; }),
        readData('/classes/' + classId + '/subjects/' + subjectId + '/chapters/' + id + '/slug').catch(function () { return ''; })
      ]).then(function (parts) {
        var name = parts[0] || '';
        var slug = String(parts[1] || '').trim() || generateSlug(name);
        return { id: id, name: name, slug: slug };
      });
    }

    /* ---------- SEO / meta helpers ---------- */
    function setMeta(attr, name, val) {
  var el = document.querySelector('meta[' + attr + '="' + name + '"]');
  if (!el) { el = document.createElement('meta'); el.setAttribute(attr, name); document.head.appendChild(el); }
  el.setAttribute('content', val || '');
}

function setPageMeta(opts) {
  opts = opts || {};
  if (opts.title) document.title = opts.title;

  var desc = opts.description || '';
  var can = opts.canonical || window.location.href;

  setMeta('name', 'description', desc);

  var canEl = document.querySelector('link[rel="canonical"]');
  if (!canEl) { canEl = document.createElement('link'); canEl.rel = 'canonical'; document.head.appendChild(canEl); }
  canEl.setAttribute('href', can);

  setMeta('property', 'og:title', opts.title || '');
  setMeta('property', 'og:description', desc);
  setMeta('property', 'og:url', can);
}

    /* Compatibility names used by older pages/debug tools. These do not cache. */
    function refreshTree() {
      return readData('/classes').then(function (data) { return data || {}; });
    }
    function refreshSlice(path) {
      return readData(path);
    }

    Object.assign(window.APP, {
      escapeHtml: escapeHtml,
      showToast: showToast,
      getParam: getParam,
      buildUrl: buildUrl,
      setUpdating: setUpdating,
      showContentError: showContentError,
      readData: readData,
      getName: getName,
      generateSlug: generateSlug,
      sortByName: sortByName,
      svgIcon: svgIcon,
      getChildSummaries: getChildSummaries,
      getClassSummaries: getClassSummaries,
      getChapterSummaries: getChapterSummaries,
      refreshTree: refreshTree,
      refreshSlice: refreshSlice,
      resolveClassSlug: resolveClassSlug,
      resolveSubjectSlug: resolveSubjectSlug,
      resolveChapterSlug: resolveChapterSlug,
      loadClassById: loadClassById,
      loadSubjectById: loadSubjectById,
      loadChapterById: loadChapterById,
      setPageMeta: setPageMeta
    });

    /* ---------- Online/offline indicator ---------- */
    function updateOnline() {
      var el = document.getElementById('offlineTag');
      if (el) el.classList.toggle('show', !navigator.onLine);
    }
    window.addEventListener('online', updateOnline);
    window.addEventListener('offline', updateOnline);
    updateOnline();

    console.log('[shared.js] ready — no localStorage, REST reads enabled, slug support loaded');
  } catch (e) {
    _showErrorBanner('shared.js failed to initialize', e);
  }
})();
