/* ============================================================
   QuantX AI — Selettore lingue + traduzione runtime
   10 lingue aggiunte alle più parlate (con Arabic RTL),
   oltre all'Italiano base. Dizionari: i18n/{code}.js
   ============================================================ */
(function () {
  var KEY = 'qx-lang';
  var LANGS = [
    { code: 'it', flag: '\uD83C\uDDEE\uD83C\uDDE9', name: 'Italiano' },
    { code: 'en', flag: '\uD83C\uDDEC\uD83C\uDDE7', name: 'English' },
    { code: 'es', flag: '\uD83C\uDDEA\uD83C\uDDF8', name: 'Español' },
    { code: 'fr', flag: '\uD83C\uDDEB\uD83C\uDDF7', name: 'Français' },
    { code: 'de', flag: '\uD83C\uDDE9\uD83C\uDDEA', name: 'Deutsch' },
    { code: 'pt', flag: '\uD83C\uDDE7\uD83C\uDDF7', name: 'Português' },
    { code: 'ru', flag: '\uD83C\uDDF7\uD83C\uDDFA', name: 'Русский' },
    { code: 'ar', flag: '\uD83C\uDDF8\uD83C\uDDE6', name: 'العربية', rtl: true },
    { code: 'hi', flag: '\uD83C\uDDEE\uD83C\uDDF3', name: 'हिन्दी' },
    { code: 'zh', flag: '\uD83C\uDDF0\uD83C\uDDF7', name: '中文' },
    { code: 'bn', flag: '\uD83C\uDDE7\uD83C\uDDE9', name: 'বাংলা' }
  ];
  var RTL = { ar: 1 };
  function guess() {
    try {
      var l = [].concat(navigator.languages || [], navigator.language ? [navigator.language] : []);
      for (var i = 0; i < l.length; i++) {
        var n = String(l[i] || '').toLowerCase();
        for (var j = 0; j < LANGS.length; j++) {
          if (n === LANGS[j].code || n.indexOf(LANGS[j].code + '-') === 0) return LANGS[j].code === 'it' ? 'it' : LANGS[j].code;
        }
      }
    } catch (e) { }
    return '';
  }
  var lang = 'it';
  try { lang = localStorage.getItem(KEY) || guess() || 'it'; } catch (e) { }

  function D() { return (window.QXT = window.QXT || {}); }
  function P() { return (window.QXT_PAT = window.QXT_PAT || []); }
  function loaded() { return (window.QXT_LOADED = window.QXT_LOADED || {}); }
  var SKIP = { SCRIPT: 1, STYLE: 1, NOSCRIPT: 1, CODE: 1, PRE: 1 };
  function norm(s) {
    return String(s)
      .replace(/\u00A0/g, ' ')
      .replace(/[\u2018\u2019\u02BC]/g, "'")
      .replace(/[\u201C\u201D]/g, '"')
      .replace(/\u2212/g, '\u2014')
      .replace(/\s+/g, ' ')
      .trim();
  }
  function tr(node) {
    var d = D(), pats = P(), i, m;
    var v = node.nodeValue; if (!v) return;
    var key = norm(v);
    if (key.length < 2) return;
    var t = d[key];
    if (t === undefined) for (i = 0; i < pats.length; i++) { m = key.match(pats[i][0]); if (m) { t = pats[i][1].apply(null, m.slice(1)); break; } }
    if (t === undefined) return;
    node.nodeValue = t;
    node.__qx = 1;
  }
  function walk(root) {
    var base = root.nodeType === 3 ? root.parentElement : root;
    if (!base) return;
    var w = document.createTreeWalker(base, NodeFilter.SHOW_TEXT, {
      acceptNode: function (n) { return (n.parentElement && SKIP[n.parentElement.tagName]) ? NodeFilter.FILTER_REJECT : NodeFilter.FILTER_ACCEPT; }
    });
    var e;
    while ((e = w.nextNode())) tr(e);
  }
  function phIn(root) {
    var els = (root.nodeType === 1 ? root : document).querySelectorAll ? document.querySelectorAll('[placeholder]') : [];
    if (root.nodeType === 1 && root.querySelectorAll) els = root.querySelectorAll('[placeholder]');
    for (var i = 0; i < els.length; i++) {
      var k = norm(els[i].getAttribute('placeholder'));
      if (D()[k]) { els[i].setAttribute('placeholder', D()[k]); els[i].__qxp = 1; }
    }
  }
  function apply() {
    if (lang === 'it') { document.documentElement.lang = 'it'; document.documentElement.removeAttribute('dir'); return; }
    document.documentElement.lang = lang;
    if (RTL[lang]) document.documentElement.setAttribute('dir', 'rtl'); else document.documentElement.removeAttribute('dir');
    walk(document.body);
    phIn(document.body);
    var d = D(); if (d[document.title]) document.title = d[document.title];
  }
  var CACHE = '2';
  function ensure(code, cb) {
    if (code === 'it' || loaded()[code]) return cb && cb();
    var tries = 0;
    var s = document.createElement('script');
    s.src = 'i18n/' + code + '.js?v=' + CACHE;
    s.onload = function () { loaded()[code] = 1; cb && cb(); };
    s.onerror = function () {
      tries++;
      if (tries < 3) { var n = document.createElement('script'); n.src = s.src + '&r=' + tries; n.onload = s.onload; n.onerror = s.onerror; (document.head || document.documentElement).appendChild(n); }
      else if (cb) cb();
    };
    (document.head || document.documentElement).appendChild(s);
  }
  /* Osserva i contenuti resi dopo l'avvio: card piani, dashboard, toast */
  var mo = new MutationObserver(function (muts) {
    if (lang === 'it') return;
    for (var i = 0; i < muts.length; i++) {
      var nds = muts[i].addedNodes;
      for (var j = 0; j < nds.length; j++) {
        var nd = nds[j];
        if (!nd || !nd.isConnected) continue;
        if (nd.nodeType === 3) {
          if (nd.parentElement && !SKIP[nd.parentElement.tagName]) tr(nd);
        } else if (nd.nodeType === 1 && !SKIP[nd.tagName]) {
          walk(nd); phIn(nd);
        }
      }
    }
  });
  function injectSelector() {
    if (document.querySelector('.qx-lang')) return;
    var host = document.querySelector('.nav-actions');
    if (!host) return;
    var wrap = document.createElement('div');
    wrap.className = 'qx-lang';
    var cur = LANGS[0];
    for (var i = 0; i < LANGS.length; i++) if (LANGS[i].code === lang) cur = LANGS[i];
    var b = document.createElement('button');
    b.className = 'qx-lang-btn'; b.type = 'button';
    b.setAttribute('aria-haspopup', 'listbox'); b.setAttribute('aria-expanded', 'false');
    b.innerHTML = '<span class="qx-lang-globe">\uD83C\uDF10</span><span class="qx-lang-flag">' + cur.flag + '</span><span class="qx-lang-name">' + cur.name + '</span><span class="qx-lang-caret">\u25BE</span>';
    var panel = document.createElement('div');
    panel.className = 'qx-lang-panel'; panel.setAttribute('role', 'listbox');
    var rows = '';
    for (var j = 0; j < LANGS.length; j++) {
      var L = LANGS[j], act = L.code === lang;
      rows += '<button type="button" class="qx-lang-row' + (act ? ' is-active' : '') + '" role="option" data-lang="' + L.code + '"' + (L.rtl ? ' dir="rtl"' : '') + '>'
        + '<span class="qx-lang-rowflag">' + L.flag + '</span><span class="qx-lang-rowname">' + L.name + '</span><span class="qx-lang-chk">\u2713</span></button>';
    }
    panel.innerHTML = rows;
    wrap.appendChild(b); wrap.appendChild(panel);
    var cut = document.createTreeWalker(wrap, NodeFilter.SHOW_TEXT, null);
    var tx; while ((tx = cut.nextNode())) tx.__qx = 1;
    host.appendChild(wrap);
    function isOpen() { return wrap.classList.contains('open'); }
    function setOpen(o) { wrap.classList.toggle('open', o); b.setAttribute('aria-expanded', o ? 'true' : 'false'); }
    b.addEventListener('click', function (ev) { ev.stopPropagation(); setOpen(!isOpen()); });
    wrap.addEventListener('click', function (ev) { ev.stopPropagation(); });
    document.addEventListener('click', function () { setOpen(false); });
    document.addEventListener('keydown', function (e) { if (e.key === 'Escape') setOpen(false); });
    panel.addEventListener('click', function (ev) {
      var t = ev.target;
      var row = t && t.closest ? t.closest('.qx-lang-row') : null;
      if (!row) return;
      var code = row.getAttribute('data-lang') || 'it';
      try { localStorage.setItem(KEY, code); } catch (e2) { }
      location.reload();
    });
  }
  function boot() {
    injectSelector();
    try { mo.observe(document.body, { childList: true, subtree: true }); } catch (e) { }
    if (lang !== 'it') ensure(lang, function () { apply(); setTimeout(apply, 350); setTimeout(apply, 1200); });
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();

  window.QXI18N = {
    apply: apply,
    set: function (code) { try { localStorage.setItem(KEY, code); } catch (e) { } location.reload(); },
    langs: LANGS,
    stats: function () {
      var d = D(), pats = P(), miss = [], total = 0, i, e;
      if (lang === 'it') return { lang: 'it', translatable: 0, missing: [], note: 'Italiano = lingua di base' };
      var w = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT, {
        acceptNode: function (n) { return (n.__qx || (n.parentElement && SKIP[n.parentElement.tagName])) ? NodeFilter.FILTER_REJECT : NodeFilter.FILTER_ACCEPT; }
      });
      var RE_LET = /[A-Za-z\u00C0-\u024F\u0370-\u03FF\u0400-\u04FF\u0590-\u05FF\u0600-\u06FF\u0980-\u09FF\u0900-\u097F\u4E00-\u9FFF]/;
      while ((e = w.nextNode())) {
        var k = norm(e.nodeValue);
        if (k.length < 2 || !RE_LET.test(k)) continue;
        total++;
        var hit = d[k] !== undefined;
        if (!hit) for (i = 0; i < pats.length; i++) if (pats[i][0].test(k)) { hit = true; break; }
        if (!hit) miss.push(k);
      }
      var ph = document.querySelectorAll('[placeholder]'), missPh = [];
      for (i = 0; i < ph.length; i++) { if (ph[i].__qxp) continue; var kk = norm(ph[i].getAttribute('placeholder')); if (kk.length > 1 && !d[kk]) missPh.push(kk); }
      return { lang: lang, translatable: total, missing: miss, missingPlaceholders: missPh };
    }
  };
})();
