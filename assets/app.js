/* Zeportic — Zammad Reporting Tool — Frontend SPA
   Purple theme, 26 languages (RTL + LTR), dark mode, Chart.js, wordcloud,
   exports. Pure static JS — no framework, no build step. */
(function () {
  'use strict';

  // ---- Boot config (provided by index.php via data-* attributes on <body>) ----
  // No inline scripts are used, so a strict CSP (script-src 'self') holds.
  window.__CONFIG__ = window.__CONFIG__ || {
    authenticated: document.body && document.body.dataset.authenticated === '1',
    version: (document.body && document.body.dataset.version) || '1.1.1',
  };

  // ---- Persian date utils ----
  var FA_DIGITS = ['۰','۱','۲','۳','۴','۵','۶','۷','۸','۹'];
  /** Persian-digit conversion. One-arg calls (render code) respect the active
   *  language — digits are only converted for Persian; all other languages get
   *  Latin digits. Explicit two-arg form is used inside the fa-guarded helpers. */
  function toFa(s, lang) {
    var l = (lang !== undefined) ? lang : (typeof state !== 'undefined' && state ? state.lang : 'en');
    if (l !== 'fa') return String(s);
    return String(s).replace(/[0-9]/g, function (d) { return FA_DIGITS[+d]; });
  }
  /** Localized percent sign: ٪ for Persian, % everywhere else. */
  function pctSign() { return state.lang === 'fa' ? '٪' : '%'; }
  /** Language-aware digit conversion — use this in render code, NOT bare toFa(). */
  function digits(v, lang) { return lang === 'fa' ? toFa(v) : String(v); }
  var FA_MONTHS = ['فروردین','اردیبهشت','خرداد','تیر','مرداد','شهریور','مهر','آبان','آذر','دی','بهمن','اسفند'];
  var EN_MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  var FA_WEEK = ['یکشنبه','دوشنبه','سه‌شنبه','چهارشنبه','پنجشنبه','جمعه','شنبه'];

  function toJalali(date) {
    // Convert Gregorian to Jalali (Persian) calendar.
    // Corrected algorithm — the old version returned the Gregorian year (2026)
    // instead of the Jalali year (1405). Fixed: proper epoch offset (979) and
    // second-half-of-year day calculation uses % 30 (months 7-12 have 30 days).
    var gy = date.getFullYear(), gm = date.getMonth() + 1, gd = date.getDate();
    var g_d_m = [0, 31, 59, 90, 120, 151, 181, 212, 243, 273, 304, 334];
    var jy = (gy <= 1600) ? 0 : 979;
    gy -= (gy <= 1600) ? 0 : 1600;
    // For leap-year-aware day count, use gy+1 when month > 2 (Mar onward)
    var gy2 = (gm > 2) ? (gy + 1) : gy;
    var days = 365 * gy
      + Math.floor((gy2 + 3) / 4)
      - Math.floor((gy2 + 99) / 100)
      + Math.floor((gy2 + 399) / 400)
      - 80
      + gd
      + g_d_m[gm - 1];
    jy += 33 * Math.floor(days / 12053);
    days %= 12053;
    jy += 4 * Math.floor(days / 1461);
    days %= 1461;
    if (days > 365) {
      jy += Math.floor((days - 1) / 365);
      days = (days - 1) % 365;
    }
    // First 6 months have 31 days, last 6 have 30 days
    var jm = (days < 186) ? 1 + Math.floor(days / 31) : 7 + Math.floor((days - 186) / 30);
    var jd = 1 + ((days < 186) ? (days % 31) : ((days - 186) % 30));
    return { jy: jy, jm: jm, jd: jd };
  }
  function formatJalali(date, lang) {
    if (lang === 'fa') {
      var j = toJalali(date);
      return toFa(j.jd) + ' ' + FA_MONTHS[j.jm - 1] + ' ' + toFa(j.jy);
    }
    // English mode: use Gregorian dates (not Persian month names)
    return date.getDate() + ' ' + EN_MONTHS[date.getMonth()] + ' ' + date.getFullYear();
  }
  function formatJalaliFull(date, lang) {
    var j = toJalali(date), day = date.getDay();
    if (lang === 'fa') return FA_WEEK[day] + ' ' + toFa(j.jd) + ' ' + FA_MONTHS[j.jm - 1] + ' ' + toFa(j.jy) + ' - ' + formatTime(date, lang);
    return EN_MONTHS[date.getMonth()] + ' ' + date.getDate() + ', ' + date.getFullYear() + ' - ' + formatTime(date, lang);
  }
  /** Format a time as HH:MM with language-aware digits + Persian colon separator.
   *  Fixes the "۱۳:00" half-Persian/half-English bug. */
  function formatTime(date, lang) {
    var hh = String(date.getHours()).padStart(2, '0');
    var mm = String(date.getMinutes()).padStart(2, '0');
    if (lang === 'fa') return toFa(hh) + '٫' + toFa(mm);
    return hh + ':' + mm;
  }
  /** Format an hour value as HH:00 (on-the-hour) with Persian digits.
   *  Used by the heatmap busiest-hour KPI and cell tooltips. */
  function formatHour(hour, lang) {
    var hh = String(hour).padStart(2, '0');
    if (lang === 'fa') return toFa(hh) + '٫۰۰';
    return hh + ':00';
  }
  function dateLabel(dateStr, lang) {
    var d = new Date(dateStr);
    var j = toJalali(d);
    if (lang === 'fa') return toFa(j.jd) + ' ' + FA_MONTHS[j.jm - 1];
    return EN_MONTHS[d.getMonth()] + ' ' + d.getDate();
  }
  function formatDuration(min, lang) {
    if (min < 60) return lang === 'fa' ? toFa(Math.round(min)) + ' دقیقه' : Math.round(min) + ' min';
    var h = Math.floor(min / 60), m = Math.round(min % 60);
    if (h < 24) {
      if (m === 0) return lang === 'fa' ? toFa(h) + ' ساعت' : h + ' h';
      return lang === 'fa' ? toFa(h) + ' ساعت و ' + toFa(m) + ' دقیقه' : h + 'h ' + m + 'm';
    }
    var d = Math.floor(h / 24), rh = h % 24;
    return lang === 'fa' ? toFa(d) + ' روز و ' + toFa(rh) + ' ساعت' : d + 'd ' + rh + 'h';
  }
  function formatNum(n, lang) { var s = Number(n).toLocaleString('en-US'); return lang === 'fa' ? toFa(s) : s; }

  // ---- Jalali ↔ Gregorian conversion (reverse direction) ----
  // toJalali() converts Gregorian → Jalali. We also need the reverse
  // (Jalali → Gregorian) for the Jalali datepicker, plus leap-year + month-length helpers.
  /** Determine if a Jalali year is a leap year (366 days). */
  function isJalaliLeap(jy) { return jalCalLeap(jy) === 0; }
  /** Jalali calendar helper — returns the leap-year residue (0 = leap).
   *  Algorithm from jalaali-js (Behrang Noruzi Niya). */
  function jalCalLeap(jy) {
    var breaks = [-61,9,38,199,426,686,756,818,1111,1181,1210,1635,2060,2097,2192,2262,2324,2394,2456,3178];
    var bl = breaks.length, gy = jy + 621, leapJ = -14, jp = breaks[0], jm, jump = 0, n, i;
    for (i = 1; i < bl; i++) {
      jm = breaks[i];
      jump = jm - jp;
      if (jy < jm) break;
      leapJ = leapJ + Math.floor(jump / 33) * 8 + Math.floor((jump % 33) / 4);
      jp = jm;
    }
    n = jy - jp;
    leapJ = leapJ + Math.floor(n / 33) * 8 + Math.floor((n % 33 + 3) / 4);
    if (jump % 33 === 4 && jump - n === 4) leapJ += 1;
    if (jump - n < 6) n = n - jump + Math.floor((jump + 4) / 33) * 33;
    var leap = ((n + 1) % 33 - 1) % 4;
    if (leap === -1) leap = 4;
    return leap;
  }
  /** Convert Jalali (jy, jm, jd) → Gregorian Date object. */
  function jalaliToDate(jy, jm, jd) {
    var gy = (jy <= 979) ? 621 : 1600;
    jy -= (jy <= 979) ? 0 : 979;
    var days = 365 * jy + Math.floor(jy / 33) * 8 + Math.floor((jy % 33 + 3) / 4) + 78 + jd + (jm < 7 ? (jm - 1) * 31 : 186 + (jm - 7) * 30);
    gy += 400 * Math.floor(days / 146097);
    days %= 146097;
    if (days > 36524) {
      gy += 100 * Math.floor(--days / 36524);
      days %= 36524;
      if (days >= 365) days++;
    }
    gy += 4 * Math.floor(days / 1461);
    days %= 1461;
    if (days > 365) {
      gy += Math.floor((days - 1) / 365);
      days = (days - 1) % 365;
    }
    var gd = days + 1;
    var salA = [0, 31, ((gy % 4 === 0 && gy % 100 !== 0) || (gy % 400 === 0)) ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
    var gm;
    for (gm = 0; gm < 13 && gd > salA[gm]; gm++) gd -= salA[gm];
    return new Date(gy, gm - 1, gd, 0, 0, 0, 0);
  }
  /** Number of days in a Jalali month. Months 1-6 = 31, 7-11 = 30, 12 = 29/30 (leap). */
  function jalaliMonthLength(jy, jm) {
    if (jm <= 6) return 31;
    if (jm <= 11) return 30;
    return isJalaliLeap(jy) ? 30 : 29;
  }

  // ---- Round-3 mirror: storage keys + refresh event name ----
  // Declared BEFORE the state object so loadReadNotifications() can use them.
  var NOTIF_STORAGE_KEY = 'zeportic-notifications-read';
  var REFRESH_EVENT = 'zeportic:refresh-all';
  function loadReadNotifications() {
    try {
      var raw = localStorage.getItem(NOTIF_STORAGE_KEY);
      var arr = raw ? JSON.parse(raw) : [];
      return new Set(Array.isArray(arr) ? arr : []);
    } catch (e) { return new Set(); }
  }
  function persistReadNotifications() {
    try { localStorage.setItem(NOTIF_STORAGE_KEY, JSON.stringify(Array.from(state.readNotifications))); } catch (e) {}
  }

  // ---- Settings (Task 9-PHP-MIRROR-2) ----
  var SETTINGS_STORAGE_KEY = 'zeportic-dashboard-settings';
  var SAVED_VIEWS_STORAGE_KEY = 'zeportic-saved-views';
  var DEFAULT_SETTINGS = {
    defaultPeriod: 30,
    itemsPerPage: 10,
    animations: true,
    compactMode: false,
    showTips: true,
    autoRefreshEnabled: false,
    autoRefreshInterval: 300,
  };
  function loadSettings() {
    try {
      var raw = localStorage.getItem(SETTINGS_STORAGE_KEY);
      if (!raw) return Object.assign({}, DEFAULT_SETTINGS);
      var parsed = JSON.parse(raw);
      return Object.assign({}, DEFAULT_SETTINGS, parsed);
    } catch (e) { return Object.assign({}, DEFAULT_SETTINGS); }
  }
  function persistSettings() {
    try { localStorage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify(state.settings)); } catch (e) {}
  }
  function applySettingsToDocument() {
    if (!state.settings) return;
    var html = document.documentElement;
    if (state.settings.compactMode) html.classList.add('compact-mode'); else html.classList.remove('compact-mode');
    if (!state.settings.animations) html.classList.add('no-animations'); else html.classList.remove('no-animations');
  }
  function loadSavedViews() {
    try {
      var raw = localStorage.getItem(SAVED_VIEWS_STORAGE_KEY);
      var arr = raw ? JSON.parse(raw) : [];
      return Array.isArray(arr) ? arr : [];
    } catch (e) { return []; }
  }
  function persistSavedViews() {
    try { localStorage.setItem(SAVED_VIEWS_STORAGE_KEY, JSON.stringify(state.savedViews)); } catch (e) {}
  }

  // ---- State ----
  // Resolve the initial language: saved choice → <html lang> → 'en'. Only
  // languages present in the catalog (assets/lang/meta.js) are accepted.
  var INITIAL_LANG = (function () {
    var catalog = window.ZEPORTIC_LANG_META || [];
    var codes = catalog.map(function (l) { return l.code; });
    var saved = null;
    try { saved = localStorage.getItem('zr-lang'); } catch (e) {}
    if (saved && codes.indexOf(saved) >= 0) return saved;
    var docLang = (document.documentElement.lang || 'en').toLowerCase();
    if (codes.indexOf(docLang) >= 0) return docLang;
    var base = docLang.split('-')[0];
    if (codes.indexOf(base) >= 0) return base;
    return 'en';
  })();
  var state = {
    lang: INITIAL_LANG,
    theme: localStorage.getItem('zr-theme') || (document.documentElement.dataset.theme || 'dark'),
    section: 'overview',
    period: 30,
    customRange: null, // { from: Date, to: Date } when user picks a custom range
    compareTrends: false, // period-over-period comparison toggle in Trends
    data: {},
    // Round-3 mirror features
    notifications: [],
    notificationsOpen: false,
    helpOpen: false,
    wordDrilldown: null, // clicked word for the wordcloud drill-down modal
    wordDrilldownTickets: [],
    sidebarStats: null,
    healthLatency: 42,
    healthOpen: false,
    refreshing: false,
    readNotifications: loadReadNotifications(), // Set<string> persisted in localStorage
    // Task 9-PHP-MIRROR-2: settings + saved views
    settings: loadSettings(),
    settingsOpen: false,
    savedViews: loadSavedViews(),
    savedViewsOpen: false,
    aiInsights: null,        // cached AI insights array
    agentLeaderboard: null,  // cached leaderboard array
    // CRON-REVIEW-5: KPI sparklines + drill-down + trends forecast
    kpiSparklines: {},        // map<key, sparkline payload> — cached for overview tiles
    kpiDrilldownOpen: false,  // modal visibility flag
    kpiDrilldownKey: null,    // currently-open KPI key
    kpiDrilldownData: null,   // last-fetched drill-down payload
    trendForecast: null,      // cached trendForecast payload
    trendsShowForecast: true, // forecast toggle in trends section
    trendsShowAnomalies: true,// anomaly toggle in trends section
  };
  // Theme is applied right after state init; language direction via applyLangDoc()
  // (i18n block below, after LANG_META is assigned).
  document.documentElement.dataset.theme = state.theme;
  // Apply persisted settings (compact-mode / no-animations) to <html> on init.
  applySettingsToDocument();
  // If user has a saved default-period setting, apply it as the initial period.
  if (state.settings && state.settings.defaultPeriod) state.period = state.settings.defaultPeriod;

  // ---- i18n ----
  // Language packs live in assets/lang/<code>.js and register themselves on
  // window.ZEPORTIC_LANGS (see assets/lang/meta.js for the catalog).
  // English doubles as the canonical fallback dictionary: any key missing in
  // the active language gracefully falls back to English, then to the key.
  var I18N = (window.ZEPORTIC_LANGS && window.ZEPORTIC_LANGS.en) || {};
  var LANGS = window.ZEPORTIC_LANGS || {};
  var LANG_META = window.ZEPORTIC_LANG_META || [];
  var RTL_LANGS = { fa: 1, ar: 1, he: 1, ur: 1 };
  applyLangDoc();
  function t(key) {
    var d = LANGS[state.lang];
    if (d && d[key] != null) return d[key];
    var en = I18N[key];
    return en != null ? en : key;
  }
  /** Metadata (name, text direction) for a language code. */
  function langMeta(code) {
    for (var i = 0; i < LANG_META.length; i++) if (LANG_META[i].code === code) return LANG_META[i];
    return { code: code, name: code, dir: 'ltr' };
  }
  function isRTL() { return !!RTL_LANGS[state.lang]; }
  /** Apply the active language to the document (lang attribute + direction). */
  function applyLangDoc() {
    var m = langMeta(state.lang);
    document.documentElement.lang = state.lang;
    document.documentElement.dir = m.dir || 'ltr';
  }
  /** Load a language pack on demand, then re-render. */
  function ensureLang(code, cb) {
    if (LANGS[code]) { if (cb) cb(); return; }
    var s = document.createElement('script');
    s.src = '/assets/lang/' + code + '.js';
    s.onload = function () { LANGS = window.ZEPORTIC_LANGS || LANGS; if (cb) cb(); };
    s.onerror = function () { if (cb) cb(); };
    document.head.appendChild(s);
  }
  /** Switch the UI language (lazy-loads the pack if needed). */
  function setLang(code) {
    if (code === state.lang) return;
    ensureLang(code, function () {
      if (!LANGS[code]) return; // load failed — keep current language
      state.lang = code;
      try { localStorage.setItem('zr-lang', code); } catch (e) {}
      // Also mirror the choice into a cookie so the server can preload the
      // right language pack (and set <html lang/dir>) on the next visit.
      try { document.cookie = 'zr-lang=' + encodeURIComponent(code) + '; path=/; max-age=31536000; samesite=Lax'; } catch (e) {}
      applyLangDoc();
      rerender();
    });
  }
  // Boot safety: if the active language pack wasn't preloaded by the server
  // (e.g. the language was chosen client-side on a previous visit), load it now.
  if (!LANGS[state.lang]) ensureLang(state.lang, function () { rerender(); });

  // ---- API ----
  function api(action, params) {
    var url = '/api.php?action=' + encodeURIComponent(action);
    if (params) for (var k in params) url += '&' + encodeURIComponent(k) + '=' + encodeURIComponent(params[k]);
    return fetch(url, { credentials: 'same-origin' }).then(function (r) {
      if (r.status === 401) { location.reload(); throw new Error('Unauthorized'); }
      return r.json().then(function (data) {
        if (data && data.error) {
          // Server returned an error payload — surface it to the console + throw.
          var msg = data.error + (data.error_type ? ' [' + data.error_type + ']' : '');
          console.error('[API ' + action + ']', data.error, data.error_type || '', data.file || '', data.line || '');
          var err = new Error(msg);
          err.payload = data;
          throw err;
        }
        return data;
      });
    });
  }
  function apiPost(action, body) {
    return fetch('/api.php?action=' + action, {
      method: 'POST', credentials: 'same-origin',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body || {})
    }).then(function (r) { return r.json(); });
  }

  // ---- Global error banner (shown when ES queries fail) ----
  var errorBannerTimer = null;
  function showErrorBanner(message, hint) {
    var existing = document.getElementById('es-error-banner');
    if (existing) existing.remove();
    if (errorBannerTimer) { clearTimeout(errorBannerTimer); errorBannerTimer = null; }
    var banner = el('div', { class: 'es-error-banner', id: 'es-error-banner' }, [
      el('div', { class: 'es-error-icon', html: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>' }),
      el('div', { class: 'es-error-body' }, [
        el('div', { class: 'es-error-title' }, state.lang === 'fa' ? 'خطا در ارتباط با Elasticsearch' : 'Elasticsearch Connection Error'),
        el('div', { class: 'es-error-msg' }, message),
        el('div', { class: 'es-error-hint', html: (hint || (state.lang === 'fa'
          ? 'برای عیب‌یابی کامل، در سرور اجرا کنید: <code>php diagnose.php</code>  ·  یا فایل <code>storage/errors.php</code> را بررسی کنید.'
          : 'Run <code>php diagnose.php</code> on the server for full diagnostics  ·  check <code>storage/errors.php</code>')) }),
      ]),
      el('button', { class: 'es-error-close', onclick: function () { banner.remove(); if (errorBannerTimer) clearTimeout(errorBannerTimer); } }, '×'),
    ]);
    document.body.appendChild(banner);
    errorBannerTimer = setTimeout(function () { if (banner.parentNode) banner.remove(); }, 20000);
  }
  // Catch unhandled promise rejections from api() calls that lack .catch()
  window.addEventListener('unhandledrejection', function (ev) {
    var err = ev.reason;
    if (err && err.message) {
      var msg = err.message;
      if (err.payload && err.payload.file) msg += ' (' + err.payload.file + ':' + err.payload.line + ')';
      showErrorBanner(msg);
    }
  });

  // ---- Icons (inline SVG) ----
  var ICONS = {
    overview: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/></svg>',
    channels: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4.9 19.1C1 15.2 1 8.8 4.9 4.9"/><path d="M7.8 16.2c-2.3-2.3-2.3-6.1 0-8.5"/><circle cx="12" cy="12" r="2"/><path d="M16.2 7.8c2.3 2.3 2.3 6.1 0 8.5"/><path d="M19.1 4.9C23 8.8 23 15.1 19.1 19"/></svg>',
    agents: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="8.5" cy="7" r="4"/><path d="M20 8v6M23 11h-6"/></svg>',
    roles: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>',
    responseTime: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>',
    wordcloud: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M17.5 19a4.5 4.5 0 0 0 0-9 6 6 0 0 0-11.5 1.5A4.5 4.5 0 0 0 6 19z"/></svg>',
    trends: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="23 6 13.5 15.5 8.5 10.5 1 18"/><polyline points="17 6 23 6 23 12"/></svg>',
    shieldCheck: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.24-2.72a1.17 1.17 0 0 1 1.52 0C14.51 3.81 17 5 19 5a1 1 0 0 1 1 1z"/><path d="m9 12 2 2 4-4"/></svg>',
    tickets: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 8V7a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v1a2 2 0 0 1 0 4v1a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-1a2 2 0 0 1 0-4z"/><line x1="13" y1="5" x2="13" y2="7"/><line x1="13" y1="11" x2="13" y2="13"/><line x1="13" y1="17" x2="13" y2="19"/></svg>',
    ticket: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 8V7a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v1a2 2 0 0 1 0 4v1a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-1a2 2 0 0 1 0-4z"/></svg>',
    clock: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>',
    check: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>',
    alert: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>',
    users: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/></svg>',
    smile: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><path d="M8 14s1.5 2 4 2 4-2 4-2"/><line x1="9" y1="9" x2="9.01" y2="9"/><line x1="15" y1="9" x2="15.01" y2="9"/></svg>',
    gauge: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 14l4-4"/><path d="M3.34 19a10 10 0 1 1 17.32 0"/></svg>',
    download: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>',
    refresh: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="23 4 23 10 17 10"/><polyline points="1 20 1 14 7 14"/><path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"/></svg>',
    menu: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="18" x2="21" y2="18"/></svg>',
    moon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg>',
    sun: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="5"/><line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/><line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/></svg>',
    globe: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="2" y1="12" x2="22" y2="12"/><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/></svg>',
    user: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>',
    lock: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>',
    logout: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>',
    csv: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>',
    trophy: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M6 9H4.5a2.5 2.5 0 0 1 0-5H6"/><path d="M18 9h1.5a2.5 2.5 0 0 0 0-5H18"/><path d="M4 22h16"/><path d="M10 14.66V17c0 .55-.47.98-.97 1.21C7.85 18.75 7 20.24 7 22"/><path d="M14 14.66V17c0 .55.47.98.97 1.21C16.15 18.75 17 20.24 17 22"/><path d="M18 2H6v7a6 6 0 0 0 12 0V2Z"/></svg>',
    grid: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/></svg>',
    building: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 21h18M5 21V7l8-4v18M19 21V11l-6-4M9 9v.01M9 12v.01M9 15v.01M9 18v.01"/></svg>',
    flame: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M8.5 14.5A2.5 2.5 0 0 0 11 12c0-1.38-.5-2-1-3-1.072-2.143-.224-4.054 2-6 .5 2.5 2 4.9 4 6.5 2 1.6 3 3.5 3 5.5a7 7 0 1 1-14 0c0-1.153.433-2.294 1-3a2.5 2.5 0 0 0 2.5 2.5z"/></svg>',
    target: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="6"/><circle cx="12" cy="12" r="2"/></svg>',
    cmd: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M9 6a3 3 0 0 0-3 3v6a3 3 0 0 0 3 3h6a3 3 0 0 0 3-3V9a3 3 0 0 0-3-3z"/><path d="M9 6V3M15 6V3M9 18v3M15 18v3M6 9H3M6 15H3M18 9h3M18 15h3"/></svg>',
    // new icons for mirrored features
    calendar: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>',
    calendarRange: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/><path d="M7 14h2"/><path d="M15 14h2"/></svg>',
    printer: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="6 9 6 2 18 2 18 9"/><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/><rect x="6" y="14" width="12" height="8"/></svg>',
    hash: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="4" y1="9" x2="20" y2="9"/><line x1="4" y1="15" x2="20" y2="15"/><line x1="10" y1="3" x2="8" y2="21"/><line x1="16" y1="3" x2="14" y2="21"/></svg>',
    tag: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z"/><line x1="7" y1="7" x2="7.01" y2="7"/></svg>',
    plus: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>',
    userCheck: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="8.5" cy="7" r="4"/><polyline points="17 11 19 13 23 9"/></svg>',
    messageSquare: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>',
    checkCircle: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>',
    alertTriangle: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>',
    rotateCcw: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="1 4 1 10 7 10"/><path d="M3.51 15a9 9 0 1 0 2.13-9.36L1 10"/></svg>',
    gitMerge: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="18" cy="18" r="3"/><circle cx="6" cy="6" r="3"/><path d="M6 21V9a9 9 0 0 0 9 9"/></svg>',
    radio: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="2"/><path d="M16.24 7.76a6 6 0 0 1 0 8.49M7.76 16.24a6 6 0 0 1 0-8.49M19.07 4.93a10 10 0 0 1 0 14.14M4.93 19.07a10 10 0 0 1 0-14.14"/></svg>',
    x: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>',
    chevronLeft: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="15 18 9 12 15 6"/></svg>',
    chevronRight: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="9 18 15 12 9 6"/></svg>',
    mail: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,13 2,6"/></svg>',
    phone: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"/></svg>',
    // KB + comparison icons
    bookOpen: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"/><path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"/></svg>',
    folderTree: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 10a4 4 0 0 0 0-8 4 4 0 0 0-1.6.3A6 6 0 0 0 6 6c0 1.3.4 2.5 1 3.5A4 4 0 0 0 7 21a4 4 0 0 0 4-4c0-1-.4-1.9-1-2.6"/><path d="M12 12a4 4 0 0 0 4-4"/></svg>',
    languages: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m5 8 6 6"/><path d="m4 14 6-6 2-3"/><path d="M2 5h12"/><path d="M7 2h1"/><path d="m22 22-5-10-5 10"/><path d="M14 18h6"/></svg>',
    eye: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M2.062 12.348a1 1 0 0 1 0-.696 10.75 10.75 0 0 1 19.876 0 1 1 0 0 1 0 .696 10.75 10.75 0 0 1-19.876 0"/><circle cx="12" cy="12" r="3"/></svg>',
    thumbsUp: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M7 10v12"/><path d="M15 5.88 14 10h5.83a2 2 0 0 1 1.92 2.56l-2.33 8A2 2 0 0 1 17.5 22H4a2 2 0 0 1-2-2v-8a2 2 0 0 1 2-2h2.76a2 2 0 0 0 1.79-1.11L12 2h0a3.13 3.13 0 0 1 3 3.88Z"/></svg>',
    fileText: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z"/><path d="M14 2v4a2 2 0 0 0 2 2h4"/><path d="M16 13H8"/><path d="M16 17H8"/><path d="M10 9H8"/></svg>',
    filePlus: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z"/><path d="M14 2v4a2 2 0 0 0 2 2h4"/><path d="M12 18v-6"/><path d="M9 15h6"/></svg>',
    trendingUp: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="22 7 13.5 15.5 8.5 10.5 2 17"/><polyline points="16 7 22 7 22 13"/></svg>',
    // Round-3 mirror icons: notifications, help, system health, refresh, drill-down, mini-stats
    bell: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9"/><path d="M10.3 21a1.94 1.94 0 0 0 3.4 0"/></svg>',
    bellRing: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M10.3 21a1.94 1.94 0 0 0 3.4 0"/><path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9"/><path d="M4 2C2.8 3.7 2 5.7 2 8"/><path d="M22 8c0-2.3-.8-4.3-2-6"/></svg>',
    helpCircle: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>',
    refreshCw: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="23 4 23 10 17 10"/><polyline points="1 20 1 14 7 14"/><path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"/></svg>',
    search: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/></svg>',
    alertOctagon: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="7.86 2 16.14 2 22 7.86 22 16.14 16.14 22 7.86 22 2 16.14 2 7.86 7.86 2"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>',
    userX: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="8.5" cy="7" r="4"/><line x1="17" y1="8" x2="23" y2="14"/><line x1="23" y1="8" x2="17" y2="14"/></svg>',
    checkCheck: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 6 7 17l-5-5"/><path d="m22 10-7.5 7.5L13 16"/></svg>',
    keyboard: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect width="20" height="16" x="2" y="4" rx="2"/><path d="M6 8h.001M10 8h.001M14 8h.001M18 8h.001M8 12h.001M12 12h.001M16 12h.001M7 16h10"/></svg>',
    lightbulb: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M15 14c.2-1 .7-1.7 1.5-2.5 1-.9 1.5-2.2 1.5-3.5A6 6 0 0 0 6 8c0 1 .2 2.2 1.5 3.5.7.7 1.3 1.5 1.5 2.5"/><path d="M9 18h6"/><path d="M10 22h4"/></svg>',
    calendarDays: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="18" rx="2"/><path d="M3 10h18"/><path d="M8 2v4"/><path d="M16 2v4"/><path d="M8 14h.01M12 14h.01M16 14h.01M8 18h.01M12 18h.01M16 18h.01"/></svg>',
    circleDot: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="1"/></svg>',
    mousePointerClick: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 9l5 12 1.8-5.2L21 14Z"/><path d="M7.2 2.2 8 5.1"/><path d="m5.1 8-2.9-.8"/><path d="M14 4.1 12 6"/><path d="m6 12-1.9 2"/></svg>',
    // Task 9-PHP-MIRROR-2: AI insights, leaderboard, settings, saved views
    sparkles: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9.937 15.5A2 2 0 0 0 8.5 14.063l-6.135-1.582a.5.5 0 0 1 0-.962L8.5 9.936A2 2 0 0 0 9.937 8.5l1.582-6.135a.5.5 0 0 1 .963 0L14.063 8.5A2 2 0 0 0 15.5 9.937l6.135 1.581a.5.5 0 0 1 0 .964L15.5 14.063a2 2 0 0 0-1.437 1.437l-1.582 6.135a.5.5 0 0 1-.963 0z"/><path d="M20 3v4"/><path d="M22 5h-4"/><path d="M4 17v2"/><path d="M5 18H3"/></svg>',
    medal: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M7.21 15 2.66 7.14a2 2 0 0 1 .13-2.2L4.4 2.8A2 2 0 0 1 6 2h12a2 2 0 0 1 1.6.8l1.6 2.14a2 2 0 0 1 .14 2.2L16.79 15"/><path d="M11 12 5.12 2.2"/><path d="m13 12 5.88-9.8"/><path d="M8 7h8"/><circle cx="12" cy="17" r="5"/><path d="M12 18v-2h-.5"/></svg>',
    crown: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M11.562 3.266a.5.5 0 0 1 .876 0L15.39 8.87a1 1 0 0 0 1.516.294L21.183 5.5a.5.5 0 0 1 .798.519l-2.834 10.246a1 1 0 0 1-.956.734H5.81a1 1 0 0 1-.957-.734L2.02 6.02a.5.5 0 0 1 .798-.519l4.276 3.664a1 1 0 0 0 1.516-.294z"/><path d="M5 21h14"/></svg>',
    award: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="8" r="6"/><path d="M15.477 12.89 17 22l-5-3-5 3 1.523-9.11"/></svg>',
    bookmark: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m19 21-7-4-7 4V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2v16z"/></svg>',
    bookmarkPlus: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m19 21-7-4-7 4V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2v16z"/><path d="M12 5v4"/><path d="M10 7h4"/></svg>',
    gear: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z"/><circle cx="12" cy="12" r="3"/></svg>',
    play: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="6 3 20 12 6 21 6 3"/></svg>',
    trash2: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 6h18"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6"/><path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/><line x1="10" y1="11" x2="10" y2="17"/><line x1="14" y1="11" x2="14" y2="17"/></svg>',
    star: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>',
    save: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M15.2 3a2 2 0 0 1 1.4.6l3.8 3.8a2 2 0 0 1 .6 1.4V19a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2z"/><path d="M17 21v-7a1 1 0 0 0-1-1H8a1 1 0 0 0-1 1v7"/><path d="M7 3v4a1 1 0 0 0 1 1h7"/></svg>',
    rotateCcw2: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/><path d="M3 3v5h5"/></svg>',
    listOrdered: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M7 24a2 2 0 0 1-2-2v-2.5a2 2 0 0 1 2-2H22"/><path d="M2 5.5a2 2 0 0 1 2-2H22"/><path d="M7 13.5H22"/><path d="M2 13.5a2 2 0 0 1 2-2"/><path d="M2 21.5a2 2 0 0 1 2-2"/></svg>',
    // CRON-REVIEW-5: KPI sparklines + drill-down + forecast + anomaly detection
    activity: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 12h-2.48a2 2 0 0 0-1.93 1.46l-2.35 8.36a.25.25 0 0 1-.48 0L9.24 2.18a.25.25 0 0 0-.48 0l-2.35 8.36A2 2 0 0 1 4.49 12H2"/></svg>',
    zap: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg>',
    // CRON-REVIEW-6: GitCompare icon for Period Comparison nav
    gitCompare: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="18" cy="18" r="3"/><circle cx="6" cy="6" r="3"/><path d="M13 6h3a2 2 0 0 1 2 2v7"/><path d="M11 18H8a2 2 0 0 1-2-2V9"/></svg>',
    trendingDown: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="22 17 13.5 8.5 8.5 13.5 2 7"/><polyline points="16 17 22 17 22 11"/></svg>',
    minus: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="5" y1="12" x2="19" y2="12"/></svg>',
    // Missing nav icons — SLA, Heatmap, Organizations
    sla: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2v4"/><path d="M12 18v4"/><path d="M4.93 4.93l2.83 2.83"/><path d="M16.24 16.24l2.83 2.83"/><path d="M2 12h4"/><path d="M18 12h4"/><path d="M4.93 19.07l2.83-2.83"/><path d="M16.24 7.76l2.83-2.83"/><circle cx="12" cy="12" r="3"/></svg>',
    heatmap: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="18" height="18" rx="2"/><path d="M9 3v18"/><path d="M15 3v18"/><path d="M3 9h18"/><path d="M3 15h18"/></svg>',
    organizations: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 21h18"/><path d="M5 21V7l8-4v18"/><path d="M19 21V11l-6-4"/><path d="M9 9v.01"/><path d="M9 12v.01"/><path d="M9 15v.01"/><path d="M9 18v.01"/></svg>',
  };

  // ---- Render helpers ----
  function el(tag, attrs, children) {
    var e = document.createElement(tag);
    if (attrs) for (var k in attrs) {
      if (k === 'class') e.className = attrs[k];
      else if (k === 'html') e.innerHTML = attrs[k];
      else if (k.startsWith('on') && typeof attrs[k] === 'function') e.addEventListener(k.slice(2), attrs[k]);
      else e.setAttribute(k, attrs[k]);
    }
    if (children) (Array.isArray(children) ? children : [children]).forEach(function (c) {
      if (c == null) return;
      if (typeof c === 'string') {
        // SVG/markup strings → render as HTML; plain text → text node
        if (c.charAt(0) === '<') e.insertAdjacentHTML('beforeend', c);
        else e.appendChild(document.createTextNode(c));
      } else {
        e.appendChild(c);
      }
    });
    return e;
  }
  function badge(text, cls) { return '<span class="badge ' + cls + '">' + text + '</span>'; }
  // Null-safe DOM helpers — prevents "X is null" errors when an API callback
  // fires after the user has navigated away (the target element no longer exists).
  function $(id) { return document.getElementById(id); }
  function setHTML(id, html) { var el = document.getElementById(id); if (el) el.innerHTML = html; return el; }
  function stateBadge(s) {
    var map = { open: ['stateOpen', 'badge-amber'], closed: ['stateClosed', 'badge-emerald'], pending_reminder: ['statePending', 'badge-violet'], pending_close: ['statePending', 'badge-violet'] };
    var m = map[s] || map.open;
    return badge(t(m[0]), m[1]);
  }
  function priorityBadge(p) {
    var map = { low: ['priorityLow', 'badge-cyan'], normal: ['priorityNormal', 'badge-primary'], high: ['priorityHigh', 'badge-amber'], urgent: ['priorityUrgent', 'badge-rose'] };
    var m = map[p] || map.normal;
    return badge(t(m[0]), m[1]);
  }
  /** Localized display label for a canonical channel key (email → "Email"). */
  function channelLabel(name) {
    var map = { email: 'channelEmail', chat: 'channelChat', phone: 'channelPhone', web: 'channelWeb',
                sms: 'channelSms', fax: 'channelFax', facebook: 'channelFacebook',
                telegram: 'channelTelegram', twitter: 'channelTwitter', whatsapp: 'channelWhatsapp' };
    return map[name] ? t(map[name]) : name;
  }
  function channelBadge(c) {
    var map = { email: 'channelEmail', chat: 'channelChat', phone: 'channelPhone', web: 'channelWeb' };
    return badge(t(map[c] || 'channelEmail'), 'badge-muted');
  }

  // ---- Charts registry ----
  var charts = {};
  function destroyCharts() { for (var k in charts) { charts[k].destroy(); delete charts[k]; } }

  // Set Chart.js global default font to Vazirmatn so ALL charts (axes, legends,
  // tooltips, labels) use the Persian font — not the browser default (Helvetica).
  // This applies to every Chart instance created after this line.
  if (typeof Chart !== 'undefined' && Chart.defaults) {
    Chart.defaults.font.family = "'Vazirmatn','Tahoma','system-ui',sans-serif";
    Chart.defaults.font.size = 11;
    Chart.defaults.color = '#64748b';
    Chart.defaults.plugins.tooltip = Chart.defaults.plugins.tooltip || {};
    Chart.defaults.plugins.tooltip.titleFont = { family: "'Vazirmatn','Tahoma',sans-serif", weight: '600', size: 12 };
    Chart.defaults.plugins.tooltip.bodyFont = { family: "'Vazirmatn','Tahoma',sans-serif", size: 11 };
    Chart.defaults.plugins.legend = Chart.defaults.plugins.legend || {};
    Chart.defaults.plugins.legend.labels = Chart.defaults.plugins.legend.labels || {};
    Chart.defaults.plugins.legend.labels.font = { family: "'Vazirmatn','Tahoma',sans-serif", size: 11 };
  }

  // ---- Login view ----
  function renderLogin() {
    var view = document.getElementById('login-view');
    view.innerHTML = '';
    var VERSION = (window.__CONFIG__ && window.__CONFIG__.version) || '1.1.1';

    // top bar: language + theme
    var top = el('div', { class: 'login-top' }, [
      langDropdown(),
      el('button', { class: 'icon-btn', onclick: toggleTheme, title: 'Theme', 'aria-label': 'Theme' }, [state.theme === 'dark' ? ICONS.sun : ICONS.moon]),
    ]);

    // decorative orbs
    var orbs = el('div', { 'aria-hidden': 'true' }, [
      el('div', { class: 'login-orb orb-1' }), el('div', { class: 'login-orb orb-2' }), el('div', { class: 'login-orb orb-3' }),
    ]);

    // --- 3D logo stage ---
    var stage = el('div', { class: 'logo-stage' }, [
      el('div', { class: 'logo-3d', id: 'logo-3d' }, [
        el('div', { class: 'logo-halo' }),
        el('img', { class: 'logo-disc', src: '/assets/img/logo-mark.png', alt: 'Zeportic logo', width: 148, height: 148, draggable: false }),
        el('div', { class: 'logo-shine' }),
        el('div', { class: 'logo-chip chip-a' }, [ICONS.languages, ' +' + LANG_META.length]),
        el('div', { class: 'logo-chip chip-b' }, [ICONS.shieldCheck, ' SLA']),
        el('div', { class: 'logo-chip chip-c' }, [ICONS.download, ' CSV · PDF']),
      ]),
      el('div', { class: 'logo-reflection' }),
    ]);

    // mouse-tracked 3D tilt (desktop pointers only; respects reduced motion)
    function bindTilt() {
      var fine = window.matchMedia && window.matchMedia('(pointer:fine)').matches;
      var reduced = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
      if (!fine || reduced) return;
      var disc = document.getElementById('logo-3d');
      if (!disc) return;
      var chips = disc.querySelectorAll('.logo-chip');
      var raf = null, tx = 0, ty = 0;
      function apply() {
        raf = null;
        disc.style.transform = 'rotateX(' + (-ty * 14) + 'deg) rotateY(' + (tx * 16) + 'deg)';
        chips.forEach(function (c, i) {
          var depth = (i + 1) * 14;
          c.style.transform = 'translate3d(' + (tx * depth) + 'px,' + (ty * depth) + 'px,0)';
        });
      }
      function onMove(e) {
        var r = disc.getBoundingClientRect();
        var cx = r.left + r.width / 2, cy = r.top + r.height / 2;
        tx = Math.max(-1, Math.min(1, (e.clientX - cx) / (r.width)));
        ty = Math.max(-1, Math.min(1, (e.clientY - cy) / (r.height)));
        if (!raf) raf = requestAnimationFrame(apply);
      }
      function onLeave() { tx = 0; ty = 0; if (!raf) raf = requestAnimationFrame(apply); }
      view.addEventListener('mousemove', onMove);
      view.addEventListener('mouseleave', onLeave);
    }

    // --- feature cards ---
    var features = [
      [ICONS.activity, 'featRealtime', 'featRealtimeDesc'],
      [ICONS.grid, 'featReports', 'featReportsDesc'],
      [ICONS.messageSquare, 'featWordcloud', 'featWordcloudDesc'],
      [ICONS.shieldCheck, 'featSla', 'featSlaDesc'],
      [ICONS.download, 'featExport', 'featExportDesc'],
      [ICONS.languages, 'featI18n', 'featI18nDesc'],
      [ICONS.moon, 'featDark', 'featDarkDesc'],
      [ICONS.zap, 'featPurePhp', 'featPurePhpDesc'],
    ];
    var featureGrid = el('div', { class: 'login-feature-grid' });
    features.forEach(function (f) {
      featureGrid.appendChild(el('div', { class: 'login-feature' }, [
        el('div', { class: 'login-feature-icon', html: f[0] }),
        el('div', {}, [el('h3', {}, t(f[1])), el('p', {}, t(f[2]))]),
      ]));
    });

    var heroMain = el('div', { class: 'login-hero-main' }, [
      stage,
      el('h1', {}, t('appName')),
      el('div', { class: 'login-version' }, [el('span', { class: 'live-dot' }), 'v' + VERSION]),
      el('p', {}, [el('strong', {}, t('appSubtitle')), ' — ', t('loginTagline')]),
      el('span', { class: 'login-oss' }, [ICONS.check, t('loginOpenSource')]),
    ]);
    var heroFeatures = el('div', { class: 'login-features' }, [
      el('h2', {}, t('loginFeaturesTitle')),
      el('div', { class: 'login-features-sub' }, t('loginFeaturesDesc')),
      featureGrid,
    ]);

    var card = el('div', { class: 'login-card animate-fade-in-up' }, [
      el('div', { class: 'card' }, [
        el('div', { class: 'card-body' }, [
          el('h3', {}, [ICONS.shieldCheck, t('loginTitle')]),
          el('p', { class: 'card-desc' }, t('loginDesc')),
          el('form', { onsubmit: doLogin }, [
            el('div', { class: 'form-group' }, [
              el('label', { class: 'label', for: 'li-user' }, t('username')),
              el('div', { class: 'input-icon' }, [ICONS.user, el('input', { class: 'input', id: 'li-user', name: 'username', placeholder: 'admin', required: true, autocomplete: 'username' })]),
            ]),
            el('div', { class: 'form-group' }, [
              el('label', { class: 'label', for: 'li-pass' }, t('password')),
              el('div', { class: 'input-icon' }, [ICONS.lock, el('input', { class: 'input', id: 'li-pass', type: 'password', name: 'password', placeholder: '••••••', required: true, autocomplete: 'current-password' })]),
            ]),
            el('div', { id: 'li-error' }),
            el('button', { class: 'btn btn-primary', type: 'submit' }, t('signIn')),
            el('p', { class: 'input-hint' }, t('loginHint')),
          ]),
        ]),
      ]),
      el('p', { class: 'login-footer' }, [
        el('span', { class: 'login-footer-brand' }, t('appName')), ' · ', t('appSubtitle'), ' · ', t('poweredByElastic'),
      ]),
    ]);

    var wrap = el('div', { class: 'login-wrap' }, [
      el('div', { class: 'login-hero' }, [heroMain, heroFeatures]),
      card,
    ]);
    view.appendChild(orbs);
    view.appendChild(top);
    view.appendChild(wrap);
    bindTilt();
  }
  function doLogin(e) {
    e.preventDefault();
    var user = document.getElementById('li-user').value;
    var pass = document.getElementById('li-pass').value;
    apiPost('login', { username: user, password: pass }).then(function (res) {
      if (res.ok) location.reload();
      else document.getElementById('li-error').innerHTML = '<div class="alert alert-error">' + ICONS.alert + t('loginError') + '</div>';
    }).catch(function () {
      document.getElementById('li-error').innerHTML = '<div class="alert alert-error">' + ICONS.alert + t('loginError') + '</div>';
    });
  }

  // ---- Dashboard shell ----
  function renderDashboard() {
    var view = document.getElementById('dashboard-view');
    view.innerHTML = '';
    var dash = el('div', { class: 'dashboard' });

    // sidebar
    var sidebar = el('aside', { class: 'sidebar', id: 'sidebar' });
    sidebar.appendChild(el('div', { class: 'brand' }, [
      el('img', { class: 'brand-logo-img', src: '/assets/img/logo-mark.png', alt: 'Zeportic logo', width: 44, height: 44, draggable: false }),
      el('div', { style: 'flex:1;min-width:0;' }, [el('h1', {}, t('appName')), el('p', {}, t('appSubtitle'))]),
      // Mobile-only close button (X) — hidden on desktop via CSS
      el('button', { class: 'sidebar-close no-print', onclick: closeSidebar, title: t('scClose'), 'aria-label': t('scClose') }, [ICONS.x]),
    ]));
    var nav = el('nav', { class: 'nav' });
    nav.appendChild(el('div', { class: 'nav-label' }, t('poweredBy')));
    var items = [
      ['overview', 'navOverview', 'overview'], ['channels', 'navChannels', 'channels'],
      ['agents', 'navAgents', 'agents'], ['roles', 'navRoles', 'roles'],
      ['responseTime', 'navResponseTime', 'responseTime'], ['sla', 'navSla', 'sla'],
      ['heatmap', 'navHeatmap', 'heatmap'], ['wordcloud', 'navWordcloud', 'wordcloud'],
      ['trends', 'navTrends', 'trends'], ['organizations', 'navOrganizations', 'organizations'],
      ['tags', 'navTags', 'hash'],
      ['kb', 'navKb', 'bookOpen'],
      ['comparison', 'navComparison', 'gitCompare'],
      ['tickets', 'navTickets', 'tickets'],
    ];
    items.forEach(function (it) {
      var btn = el('button', { class: 'nav-item' + (state.section === it[0] ? ' active' : ''), onclick: function () { navigate(it[0]); } }, [ICONS[it[2]], t(it[1])]);
      nav.appendChild(btn);
    });
    sidebar.appendChild(nav);
    // mini-stats card (round-3 mirror) — 2x2 grid of quick counts above user info
    var miniStats = el('div', { class: 'sidebar-mini-stats', id: 'sidebar-mini-stats' });
    sidebar.appendChild(miniStats);
    // user
    var userBox = el('div', { class: 'nav-user' }, [
      el('div', { class: 'avatar' }, 'A'),
      el('div', { style: 'flex:1;min-width:0;' }, [el('div', { style: 'font-size:13px;font-weight:500;' }, 'admin'), el('div', { style: 'font-size:11px;color:var(--muted-fg);' }, state.lang === 'fa' ? 'مدیر سیستم' : 'Administrator')]),
      el('button', { class: 'icon-btn', onclick: doLogout, title: t('signOut') }, [ICONS.logout]),
    ]);
    sidebar.appendChild(userBox);

    // main
    var main = el('div', { class: 'main' });
    var searchBtn = el('button', { class: 'btn no-print', onclick: openPalette, style: 'gap:8px;', title: t('commandHint') }, [ICONS.search, el('span', { style: 'display:none;' }, t('searchPlaceholder'))]);
    searchBtn.lastChild.style.display = '';
    searchBtn.lastChild.style.fontSize = '13px';
    searchBtn.lastChild.style.color = 'var(--muted-fg)';
    // ---- Round-3 mirror header buttons ----
    var headerActions = el('div', { class: 'header-actions no-print', style: 'display:flex;align-items:center;gap:4px;' }, [
      // system health pill
      renderSystemHealthPill(),
      // refresh-all
      renderRefreshAllButton(),
      // saved views / bookmarks (Task 9-PHP-MIRROR-2) — between Refresh and Notifications
      renderSavedViewsButton(),
      // notifications bell + dropdown
      renderNotificationsButton(),
      // help (?)
      renderHelpButton(),
      // settings (Task 9-PHP-MIRROR-2) — between Help and Language toggle
      renderSettingsButton(),
    ]);
    var header = el('header', { class: 'header' }, [
      el('button', { class: 'icon-btn menu-toggle no-print', onclick: toggleSidebar }, [ICONS.menu]),
      el('h2', { id: 'page-title' }, t('navOverview')),
      searchBtn,
      headerActions,
      el('div', { class: 'clock', id: 'clock' }, [ICONS.responseTime, el('span', { class: 'clock-text' }, '')]),
      langDropdown(),
      el('button', { class: 'icon-btn no-print', onclick: toggleTheme, title: 'Theme' }, [state.theme === 'dark' ? ICONS.sun : ICONS.moon]),
      el('button', { class: 'icon-btn no-print', onclick: function () { window.print(); }, title: t('print') }, [ICONS.printer]),
    ]);
    var content = el('main', { class: 'content', id: 'content' });
    var footer = el('footer', { class: 'footer' }, [
      el('div', { style: 'display:flex;align-items:center;gap:8px;' }, [el('span', { style: 'color:var(--primary);' }, ICONS.trends), el('span', { style: 'font-weight:500;' }, t('appName')), el('span', { style: 'display:none;' }, '· ' + t('appSubtitle'))]),
      el('div', { style: 'display:flex;align-items:center;gap:8px;' }, [el('span', { class: 'live-dot' }), el('span', {}, state.lang === 'fa' ? 'متصل به Elasticsearch' : 'Elasticsearch Connected'), el('span', {}, '·'), el('span', { id: 'footer-date' })]),
    ]);
    main.appendChild(header);
    main.appendChild(content);
    main.appendChild(footer);

    dash.appendChild(sidebar);
    dash.appendChild(main);
    view.appendChild(dash);

    // overlay for mobile — visibility controlled by .visible class (CSS)
    var overlay = el('div', { class: 'overlay', id: 'overlay', onclick: closeSidebar });
    view.appendChild(overlay);

    startClock();
    renderSection();
    // kick off the round-3 mirror side-fetches (sidebar mini-stats, notifications,
    // health-pill latency). All non-blocking; each updates its own DOM node.
    // Render from cached state first (instant), then refresh from the API.
    renderSidebarMiniStats();
    updateNotificationsBadge();
    fetchSidebarStats();
    fetchNotifications();
    startHealthPillTicker();
    startNotificationsTicker();
  }

  function startClock() {
    function tick() {
      var c = document.getElementById('clock');
      if (c) {
        var span = c.querySelector('.clock-text');
        if (span) span.textContent = formatJalaliFull(new Date(), state.lang);
      }
      var f = document.getElementById('footer-date');
      if (f) f.textContent = formatJalaliFull(new Date(), state.lang);
    }
    tick();
    setInterval(tick, 1000);
  }

  function navigate(section) {
    state.section = section;
    destroyCharts();
    // cleanup live activity feed interval when leaving overview
    if (section !== 'overview' && state._activityInterval) { clearInterval(state._activityInterval); state._activityInterval = null; }
    // update active nav
    var navItems = document.querySelectorAll('.nav-item');
    var navOrder = ['overview','channels','agents','roles','responseTime','sla','heatmap','wordcloud','trends','organizations','tags','kb','comparison','tickets'];
    navItems.forEach(function (b, i) {
      b.classList.toggle('active', navOrder[i] === section);
    });
    var titleMap = { overview:'navOverview', channels:'navChannels', agents:'navAgents', roles:'navRoles', responseTime:'navResponseTime', sla:'navSla', heatmap:'navHeatmap', wordcloud:'navWordcloud', trends:'navTrends', organizations:'navOrganizations', tags:'navTags', kb:'navKb', comparison:'navComparison', tickets:'navTickets' };
    document.getElementById('page-title').textContent = t(titleMap[section] || 'navOverview');
    closeSidebar();
    renderSection();
  }

  function renderSection() {
    var c = document.getElementById('content');
    c.innerHTML = '<div class="empty">' + t('loading') + '</div>';
    switch (state.section) {
      case 'overview': renderOverview(c); break;
      case 'channels': renderChannels(c); break;
      case 'agents': renderAgents(c); break;
      case 'roles': renderRoles(c); break;
      case 'responseTime': renderResponseTime(c); break;
      case 'sla': renderSla(c); break;
      case 'heatmap': renderHeatmap(c); break;
      case 'wordcloud': renderWordcloud(c); break;
      case 'trends': renderTrends(c); break;
      case 'organizations': renderOrganizations(c); break;
      case 'tags': renderTags(c); break;
      case 'kb': renderKb(c); break;
      case 'comparison': renderComparison(c); break;
      case 'tickets': renderTickets(c); break;
    }
  }

  // ---- Count-up animation (requestAnimationFrame, ease-out cubic) ----
  function countUp(el, target, duration, formatter) {
    if (!el) return;
    duration = duration || 700;
    target = Number(target) || 0;
    var start = performance.now();
    var rafId = null;
    function step(now) {
      var t = Math.min(1, (now - start) / duration);
      var eased = 1 - Math.pow(1 - t, 3);
      var cur = target * eased;
      el.textContent = formatter(cur);
      if (t < 1) rafId = requestAnimationFrame(step);
      else { el.textContent = formatter(target); el.setAttribute('data-counted', '1'); }
    }
    rafId = requestAnimationFrame(step);
    el.setAttribute('data-counted', '1');
  }
  function animateCountUpsIn(root) {
    if (!root) return;
    var nodes = root.querySelectorAll('[data-count-target]:not([data-counted])');
    Array.prototype.forEach.call(nodes, function (n) {
      var target = parseFloat(n.getAttribute('data-count-target')) || 0;
      var unit = n.getAttribute('data-count-unit') || 'number';
      var fmt = function (v) {
        if (unit === 'minutes') return formatDuration(Math.round(v), state.lang);
        if (unit === 'percent') return toFa(v.toFixed(1)) + pctSign();
        return formatNum(Math.round(v), state.lang);
      };
      countUp(n, target, 700, fmt);
    });
  }

  // ---- Relative time ----
  function formatRelativeTime(dateStr, lang, now) {
    var d = new Date(dateStr);
    now = now || new Date();
    var diffMs = now.getTime() - d.getTime();
    if (diffMs < 0) diffMs = 0;
    var sec = Math.floor(diffMs / 1000);
    if (sec < 60) return t('justNow');
    var min = Math.floor(sec / 60);
    if (min < 60) return (lang === 'fa' ? toFa(min) : min) + ' ' + t('minutesAgo');
    var hr = Math.floor(min / 60);
    if (hr < 24) return (lang === 'fa' ? toFa(hr) : hr) + ' ' + t('hoursAgo');
    var days = Math.floor(hr / 24);
    return (lang === 'fa' ? toFa(days) : days) + ' ' + t('daysAgo');
  }

  // ---- Date input helpers (for custom range) ----
  function toInputValue(d) {
    var y = d.getFullYear();
    var m = String(d.getMonth() + 1).padStart(2, '0');
    var day = String(d.getDate()).padStart(2, '0');
    return y + '-' + m + '-' + day;
  }
  function fromInputValue(s) {
    if (!s) return null;
    var parts = s.split('-').map(Number);
    if (!parts[0] || !parts[1] || !parts[2]) return null;
    return new Date(parts[0], parts[1] - 1, parts[2], 0, 0, 0, 0);
  }
  function daysBetween(a, b) {
    var ms = b.getTime() - a.getTime();
    return Math.floor(ms / (1000 * 60 * 60 * 24)) + 1;
  }
  function customDays() {
    if (!state.customRange) return 30;
    return Math.max(1, Math.min(730, daysBetween(state.customRange.from, state.customRange.to)));
  }

  // ---- Period selector ----
  function periodSelector() {
    var wrap = el('div', { class: 'period', style: 'position:relative;flex-wrap:wrap;' });
    var isCustom = !!state.customRange;
    var presets = [[7, 'last7Days'], [30, 'last30Days']];
    presets.forEach(function (p) {
      var active = !isCustom && state.period === p[0];
      wrap.appendChild(el('button', {
        class: active ? 'active' : '',
        onclick: function () { state.customRange = null; state.period = p[0]; renderSection(); }
      }, t(p[1])));
    });
    // 90-day preset — language-aware digits (fixes Persian-digit bug)
    var n90 = state.lang === 'fa' ? toFa(90) : '90';
    var active90 = !isCustom && state.period === 90;
    wrap.appendChild(el('button', {
      class: active90 ? 'active' : '',
      onclick: function () { state.customRange = null; state.period = 90; renderSection(); }
    }, n90 + ' ' + t('days')));
    // Custom button
    var activeCustom = isCustom;
    var customBtn = el('button', {
      class: activeCustom ? 'active' : '',
      style: 'display:inline-flex;align-items:center;gap:6px;',
      onclick: function (e) { e.stopPropagation(); toggleCustomPopover(wrap); }
    }, [ICONS.calendarRange, t('custom')]);
    wrap.appendChild(customBtn);
    // Custom range chip
    if (isCustom) {
      var chip = el('div', {
        class: 'custom-chip',
        style: 'display:inline-flex;align-items:center;gap:6px;padding:4px 10px;border-radius:8px;background:rgba(124,58,237,0.10);color:var(--primary);font-size:12px;font-weight:500;border:1px solid rgba(124,58,237,0.25);',
        title: t('customRange')
      }, [
        ICONS.calendarRange,
        el('span', { style: 'font-variant-numeric:tabular-nums;' }, formatJalali(state.customRange.from, state.lang) + ' — ' + formatJalali(state.customRange.to, state.lang)),
        el('span', { style: 'color:var(--muted-fg);' }, '· ' + (state.lang === 'fa' ? toFa(customDays()) : customDays()) + ' ' + t('days')),
        el('button', {
          class: 'icon-btn', style: 'width:18px;height:18px;padding:0;', title: t('cancel'),
          onclick: function (e) { e.stopPropagation(); state.customRange = null; state.period = 30; renderSection(); }
        }, ICONS.x)
      ]);
      wrap.appendChild(chip);
    }
    return wrap;
  }

  // ---- Jalali Datepicker (pure JS, no external deps) ----
  // Creates a calendar widget that lets the user pick a Jalali (Persian) date.
  // Returns a Date object (Gregorian) via the onSelect callback.
  // Used in place of native <input type="date"> when language is Persian.
  var JDP_WEEKDAYS_FA = ['ش', 'ی', 'د', 'س', 'چ', 'پ', 'ج']; // Sat..Fri
  var JDP_WEEKDAYS_EN = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'];

  /** Create a Jalali datepicker input.
   *  @param {Object} opts
   *  @param {Date|null} opts.value - initial Date value
   *  @param {Date|null} opts.min - minimum selectable date
   *  @param {Date|null} opts.max - maximum selectable date
   *  @param {Function} opts.onChange - called with the new Date when user picks one
   *  @returns {HTMLElement} the .jdp-input-wrap element */
  function createJalaliDatepicker(opts) {
    opts = opts || {};
    var lang = state.lang;
    var value = opts.value || null;
    var minDate = opts.min || null;
    var maxDate = opts.max || null;

    var wrap = el('div', { class: 'jdp-input-wrap' });
    var input = el('input', {
      class: 'jdp-input',
      type: 'text',
      readonly: 'readonly',
      placeholder: lang === 'fa' ? 'انتخاب تاریخ' : 'Pick a date'
    });
    // Display initial value
    function formatDisplay(d) {
      if (!d) return '';
      if (lang === 'fa') {
        var j = toJalali(d);
        return toFa(j.jy) + '/' + toFa(String(j.jm).padStart(2, '0')) + '/' + toFa(String(j.jd).padStart(2, '0'));
      }
      return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
    }
    input.value = formatDisplay(value);

    var icon = el('span', { class: 'jdp-input-icon', html: ICONS.calendar });
    // The popup is appended to document.body (NOT to wrap) so it escapes any
    // parent with overflow:hidden. It's positioned with position:fixed using
    // the input's getBoundingClientRect() so it appears in the right place.
    var popup = el('div', { class: 'jdp-calendar-popup' });
    // Prevent clicks inside the calendar from bubbling up to document handlers
    // (which would close the custom-popover that contains this datepicker)
    popup.addEventListener('click', function (e) { e.stopPropagation(); });
    document.body.appendChild(popup);

    wrap.appendChild(input);
    wrap.appendChild(icon);

    /** Position the popup just below the input, using fixed coordinates. */
    function positionPopup() {
      var rect = input.getBoundingClientRect();
      var popupW = 296; // 280px root + 2*8px padding approx
      var popupH = 360; // estimated height
      // Default: below the input, aligned to the input's left edge
      var left = rect.left;
      var top = rect.bottom + 4;
      // If it would overflow the right edge, shift left
      if (left + popupW > window.innerWidth) left = window.innerWidth - popupW - 8;
      // If it would overflow the bottom edge, show above the input
      if (top + popupH > window.innerHeight) top = rect.top - popupH - 4;
      if (top < 8) top = 8;
      if (left < 8) left = 8;
      popup.style.left = left + 'px';
      popup.style.top = top + 'px';
    }

    // Calendar state — the month being viewed (defaults to value's month or today)
    var viewJy, viewJm;
    var now = toJalali(new Date());
    if (value) {
      var vj = toJalali(value);
      viewJy = vj.jy; viewJm = vj.jm;
    } else {
      viewJy = now.jy; viewJm = now.jm;
    }
    var selectorMode = null; // null | 'months' | 'years'

    function togglePopup() {
      var isOpen = popup.classList.contains('open');
      // Close all other open datepickers first
      document.querySelectorAll('.jdp-calendar-popup.open').forEach(function (p) {
        if (p !== popup) p.classList.remove('open');
      });
      popup.classList.toggle('open', !isOpen);
      if (!isOpen) {
        render();
        positionPopup();
      }
    }
    input.addEventListener('click', function (e) { e.stopPropagation(); togglePopup(); });

    // Close on outside click
    function onDocClick(e) {
      if (!wrap.contains(e.target)) {
        popup.classList.remove('open');
      }
    }
    document.addEventListener('click', onDocClick);

    function isDateDisabled(d) {
      if (!d) return true;
      if (minDate && d < minDate) return true;
      if (maxDate && d > maxDate) return true;
      return false;
    }

    function render() {
      popup.innerHTML = '';
      var root = el('div', { class: 'jdp-root' });

      if (selectorMode === 'months') {
        renderMonthsSelector(root);
      } else if (selectorMode === 'years') {
        renderYearsSelector(root);
      } else {
        renderCalendar(root);
      }
      popup.appendChild(root);
    }

    function renderCalendar(root) {
      // Header: prev / title / next
      var header = el('div', { class: 'jdp-header' });
      var prevBtn = el('button', { class: 'jdp-nav-btn', title: lang === 'fa' ? 'ماه قبل' : 'Previous' }, [ICONS.chevronRight]); // RTL: right chevron = previous
      var nextBtn = el('button', { class: 'jdp-nav-btn', title: lang === 'fa' ? 'ماه بعد' : 'Next' }, [ICONS.chevronLeft]);
      var title = el('span', { class: 'jdp-title' }, (lang === 'fa' ? FA_MONTHS[viewJm - 1] : EN_MONTHS[viewJm - 1]) + ' ' + (lang === 'fa' ? toFa(viewJy) : viewJy));
      title.addEventListener('click', function () { selectorMode = 'months'; render(); });
      prevBtn.addEventListener('click', function () {
        viewJm--; if (viewJm < 1) { viewJm = 12; viewJy--; }
        render();
      });
      nextBtn.addEventListener('click', function () {
        viewJm++; if (viewJm > 12) { viewJm = 1; viewJy++; }
        render();
      });
      header.appendChild(prevBtn);
      header.appendChild(title);
      header.appendChild(nextBtn);
      root.appendChild(header);

      // Weekdays row
      var wdRow = el('div', { class: 'jdp-weekdays' });
      var wdLabels = lang === 'fa' ? JDP_WEEKDAYS_FA : JDP_WEEKDAYS_EN;
      // Persian week starts Saturday; English starts Sunday
      wdLabels.forEach(function (wd) {
        wdRow.appendChild(el('div', { class: 'jdp-weekday' }, wd));
      });
      root.appendChild(wdRow);

      // Days grid
      var daysGrid = el('div', { class: 'jdp-days' });
      var monthLen = jalaliMonthLength(viewJy, viewJm);
      // Day of week for the 1st of the month (0=Sat for Persian)
      var firstDow = (function () {
        var d = jalaliToDate(viewJy, viewJm, 1);
        // JS getDay: 0=Sun..6=Sat. Persian: 0=Sat..6=Fri
        return (d.getDay() + 1) % 7;
      })();
      // Previous month's trailing days (for the first row)
      var prevJm = viewJm - 1, prevJy = viewJy;
      if (prevJm < 1) { prevJm = 12; prevJy--; }
      var prevMonthLen = jalaliMonthLength(prevJy, prevJm);

      var todayJ = toJalali(new Date());
      var valueJ = value ? toJalali(value) : null;

      // Leading days from previous month
      for (var i = 0; i < firstDow; i++) {
        var dayNum = prevMonthLen - firstDow + i + 1;
        daysGrid.appendChild(makeDayCell(prevJy, prevJm, dayNum, true, todayJ, valueJ));
      }
      // Current month days
      for (var d = 1; d <= monthLen; d++) {
        daysGrid.appendChild(makeDayCell(viewJy, viewJm, d, false, todayJ, valueJ));
      }
      // Trailing days from next month (fill to 42 cells = 6 rows)
      var nextJm = viewJm + 1, nextJy = viewJy;
      if (nextJm > 12) { nextJm = 1; nextJy++; }
      var totalSoFar = firstDow + monthLen;
      var trailing = (7 - (totalSoFar % 7)) % 7;
      for (var t = 1; t <= trailing; t++) {
        daysGrid.appendChild(makeDayCell(nextJy, nextJm, t, true, todayJ, valueJ));
      }
      root.appendChild(daysGrid);

      // Footer: Today / Clear
      var footer = el('div', { class: 'jdp-footer' });
      var todayBtn = el('button', { class: 'jdp-today-btn' }, lang === 'fa' ? 'امروز' : 'Today');
      todayBtn.addEventListener('click', function () {
        var td = new Date(); td.setHours(0, 0, 0, 0);
        if (!isDateDisabled(td)) {
          value = td;
          input.value = formatDisplay(value);
          popup.classList.remove('open');
          if (opts.onChange) opts.onChange(value);
        }
      });
      var clearBtn = el('button', { class: 'jdp-clear-btn' }, lang === 'fa' ? 'پاک‌کردن' : 'Clear');
      clearBtn.addEventListener('click', function () {
        value = null;
        input.value = '';
        popup.classList.remove('open');
        if (opts.onChange) opts.onChange(null);
      });
      footer.appendChild(todayBtn);
      footer.appendChild(clearBtn);
      root.appendChild(footer);
    }

    function makeDayCell(jy, jm, jd, otherMonth, todayJ, valueJ) {
      var date = jalaliToDate(jy, jm, jd);
      var disabled = isDateDisabled(date);
      var classes = 'jdp-day';
      if (otherMonth) classes += ' other-month';
      if (todayJ.jy === jy && todayJ.jm === jm && todayJ.jd === jd) classes += ' today';
      if (valueJ && valueJ.jy === jy && valueJ.jm === jm && valueJ.jd === jd) classes += ' selected';
      var label = lang === 'fa' ? toFa(jd) : jd;
      // NOTE: do NOT pass disabled as an attribute when false — el() uses
      // setAttribute which would set it to "null"/"false" (both truthy as
      // attributes) and disable the button. Only set the attribute when true.
      var btn = el('button', { class: classes }, label);
      if (disabled) btn.setAttribute('disabled', 'disabled');
      if (!disabled) {
        btn.addEventListener('click', function () {
          value = date;
          input.value = formatDisplay(value);
          popup.classList.remove('open');
          if (opts.onChange) opts.onChange(value);
        });
      }
      return btn;
    }

    function renderMonthsSelector(root) {
      var header = el('div', { class: 'jdp-header' });
      var backBtn = el('button', { class: 'jdp-nav-btn', title: lang === 'fa' ? 'بازگشت' : 'Back' }, [ICONS.chevronRight]);
      backBtn.addEventListener('click', function () { selectorMode = null; render(); });
      var title = el('span', { class: 'jdp-title' }, lang === 'fa' ? toFa(viewJy) : String(viewJy));
      title.addEventListener('click', function () { selectorMode = 'years'; render(); });
      header.appendChild(backBtn);
      header.appendChild(title);
      header.appendChild(el('span', {})); // spacer
      root.appendChild(header);

      var grid = el('div', { class: 'jdp-selector' });
      for (var m = 1; m <= 12; m++) {
        (function (mm) {
          var item = el('button', {
            class: 'jdp-sel-item' + (mm === viewJm ? ' active' : '')
          }, lang === 'fa' ? FA_MONTHS[mm - 1] : EN_MONTHS[mm - 1]);
          item.addEventListener('click', function () {
            viewJm = mm;
            selectorMode = null;
            render();
          });
          grid.appendChild(item);
        })(m);
      }
      root.appendChild(grid);
    }

    function renderYearsSelector(root) {
      var header = el('div', { class: 'jdp-header' });
      var prevYear = el('button', { class: 'jdp-nav-btn' }, [ICONS.chevronRight]);
      var nextYear = el('button', { class: 'jdp-nav-btn' }, [ICONS.chevronLeft]);
      var title = el('span', { class: 'jdp-title' }, lang === 'fa' ? 'انتخاب سال' : 'Select Year');
      prevYear.addEventListener('click', function () { yearPageStart -= 12; render(); });
      nextYear.addEventListener('click', function () { yearPageStart += 12; render(); });
      header.appendChild(prevYear);
      header.appendChild(title);
      header.appendChild(nextYear);
      root.appendChild(header);

      if (typeof yearPageStart === 'undefined') yearPageStart = Math.floor(viewJy / 12) * 12;
      var grid = el('div', { class: 'jdp-selector' });
      for (var y = yearPageStart; y < yearPageStart + 12; y++) {
        (function (yy) {
          var item = el('button', {
            class: 'jdp-sel-item' + (yy === viewJy ? ' active' : '')
          }, lang === 'fa' ? toFa(yy) : String(yy));
          item.addEventListener('click', function () {
            viewJy = yy;
            selectorMode = 'months';
            render();
          });
          grid.appendChild(item);
        })(y);
      }
      root.appendChild(grid);
    }

    // Public API
    wrap.getValue = function () { return value; };
    wrap.setValue = function (d) { value = d; input.value = formatDisplay(value); };
    wrap.close = function () { popup.classList.remove('open'); };
    /** Remove the popup from document.body (call when the datepicker is discarded). */
    wrap.destroy = function () {
      popup.remove();
      document.removeEventListener('scroll', onScrollReposition, true);
      window.removeEventListener('resize', onScrollReposition);
    };
    // Reposition the popup on scroll/resize so it stays aligned with the input
    function onScrollReposition() {
      if (popup.classList.contains('open')) positionPopup();
    }
    document.addEventListener('scroll', onScrollReposition, true);
    window.addEventListener('resize', onScrollReposition);

    return wrap;
  }

  // ---- Custom range popover ----
  function toggleCustomPopover(wrap) {
    var existing = document.getElementById('custom-popover');
    if (existing) { existing.remove(); return; }
    var today = new Date(); today.setHours(0, 0, 0, 0);
    var initFrom, initTo;
    if (state.customRange) { initFrom = toInputValue(state.customRange.from); initTo = toInputValue(state.customRange.to); }
    else {
      var start = new Date(today);
      start.setDate(start.getDate() - (state.period >= 1 ? state.period - 1 : 29));
      initFrom = toInputValue(start); initTo = toInputValue(today);
    }
    var pop = el('div', {
      id: 'custom-popover',
      class: 'card',
      style: 'position:absolute;top:calc(100% + 6px);inset-inline-end:0;z-index:9000;width:min(92vw,420px);box-shadow:var(--shadow-lg);padding:0;'
    });
    // header
    var head = el('div', { style: 'display:flex;align-items:center;gap:10px;padding:14px 16px;border-bottom:1px solid var(--border);' }, [
      el('div', { style: 'width:32px;height:32px;border-radius:8px;background:rgba(124,58,237,0.12);color:var(--primary);display:flex;align-items:center;justify-content:center;' }, ICONS.calendarRange),
      el('div', {}, [el('div', { style: 'font-size:13px;font-weight:700;' }, t('customRange')), el('div', { style: 'font-size:11px;color:var(--muted-fg);' }, t('customRangeDesc'))])
    ]);
    pop.appendChild(head);
    // body
    var body = el('div', { style: 'padding:14px 16px;display:flex;flex-direction:column;gap:12px;' });
    // presets row
    body.appendChild(el('div', { style: 'font-size:11px;font-weight:600;color:var(--muted-fg);' }, t('presetRange')));
    var presetsGrid = el('div', { style: 'display:grid;grid-template-columns:repeat(4,1fr);gap:6px;' });
    [7, 14, 30, 90].forEach(function (d) {
      var lbl = (state.lang === 'fa' ? toFa(d) : d) + ' ' + t('days');
      presetsGrid.appendChild(el('button', {
        style: 'padding:6px 4px;border:1px solid var(--border);background:var(--card);color:var(--muted-fg);border-radius:6px;font-size:11px;font-weight:500;cursor:pointer;',
        onclick: function () { state.customRange = null; state.period = d; closeCustomPopover(); renderSection(); }
      }, lbl));
    });
    body.appendChild(presetsGrid);
    body.appendChild(el('div', { style: 'height:1px;background:var(--border);' }));
    // date inputs (2-col) — use Jalali datepicker when Persian, native date input when English
    var grid2 = el('div', { style: 'display:grid;grid-template-columns:1fr 1fr;gap:10px;' });
    var fromWrap = el('div', { style: 'display:flex;flex-direction:column;gap:4px;' });
    fromWrap.appendChild(el('label', { style: 'font-size:11px;font-weight:500;color:var(--muted-fg);' }, t('startDate')));
    var fromPrev = el('p', { style: 'font-size:10px;color:var(--muted-fg);min-height:14px;margin:0;' }, '');
    var toWrap = el('div', { style: 'display:flex;flex-direction:column;gap:4px;' });
    toWrap.appendChild(el('label', { style: 'font-size:11px;font-weight:500;color:var(--muted-fg);' }, t('endDate')));
    var toPrev = el('p', { style: 'font-size:10px;color:var(--muted-fg);min-height:14px;margin:0;' }, '');

    // Track the current from/to Date values (works for both Jalali + native modes)
    var fromValue = fromInputValue(initFrom);
    var toValue = fromInputValue(initTo);

    if (state.lang === 'fa') {
      // Jalali datepicker for Persian mode
      var fromPicker = createJalaliDatepicker({
        value: fromValue,
        max: toValue,
        onChange: function (d) {
          fromValue = d;
          fromPrev.textContent = d ? formatJalali(d, state.lang) : '';
          err.textContent = '';
        }
      });
      fromWrap.appendChild(fromPicker);
      fromWrap.appendChild(fromPrev);
      grid2.appendChild(fromWrap);

      var toPicker = createJalaliDatepicker({
        value: toValue,
        max: today,
        onChange: function (d) {
          toValue = d;
          toPrev.textContent = d ? formatJalali(d, state.lang) : '';
          err.textContent = '';
        }
      });
      toWrap.appendChild(toPicker);
      toWrap.appendChild(toPrev);
      grid2.appendChild(toWrap);
    } else {
      // Native date input for English mode
      var fromInput = el('input', { type: 'date', value: initFrom, max: initTo, style: 'padding:6px 8px;border:1px solid var(--border);border-radius:6px;background:var(--card);color:var(--fg);font-family:inherit;font-size:13px;outline:none;' });
      fromWrap.appendChild(fromInput);
      fromWrap.appendChild(fromPrev);
      grid2.appendChild(fromWrap);
      var toInput = el('input', { type: 'date', value: initTo, max: toInputValue(today), style: 'padding:6px 8px;border:1px solid var(--border);border-radius:6px;background:var(--card);color:var(--fg);font-family:inherit;font-size:13px;outline:none;' });
      toWrap.appendChild(toInput);
      toWrap.appendChild(toPrev);
      grid2.appendChild(toWrap);
      fromInput.addEventListener('input', function () {
        fromValue = fromInput.value ? fromInputValue(fromInput.value) : null;
        fromPrev.textContent = fromValue ? formatJalali(fromValue, state.lang) : '';
        err.textContent = '';
      });
      toInput.addEventListener('input', function () {
        toValue = toInput.value ? fromInputValue(toInput.value) : null;
        toPrev.textContent = toValue ? formatJalali(toValue, state.lang) : '';
        err.textContent = '';
      });
    }
    body.appendChild(grid2);
    // error message
    var err = el('p', { style: 'font-size:11px;color:#dc2626;margin:0;min-height:14px;' }, '');
    body.appendChild(err);
    // buttons
    var actions = el('div', { style: 'display:flex;justify-content:flex-end;gap:8px;' }, [
      el('button', { class: 'btn', onclick: function () { closeCustomPopover(); } }, t('cancel')),
      el('button', { class: 'btn btn-primary', onclick: function () {
        var from = fromValue;
        var to = toValue;
        if (!from || !to) { err.textContent = state.lang === 'fa' ? 'هر دو تاریخ را وارد کنید' : 'Please enter both dates'; return; }
        if (from > to) { err.textContent = state.lang === 'fa' ? 'تاریخ شروع باید قبل از پایان باشد' : 'Start must be before end'; return; }
        var d = Math.max(1, Math.min(730, daysBetween(from, to)));
        state.customRange = { from: from, to: to };
        state.period = d;
        closeCustomPopover();
        renderSection();
      } }, t('confirm'))
    ]);
    body.appendChild(actions);
    pop.appendChild(body);

    // Set initial preview text
    fromPrev.textContent = fromValue ? formatJalali(fromValue, state.lang) : '';
    toPrev.textContent = toValue ? formatJalali(toValue, state.lang) : '';

    wrap.appendChild(pop);
    // dismiss on outside click
    setTimeout(function () {
      document.addEventListener('click', closeCustomPopoverOnOutside, { once: true });
    }, 0);
    function closeCustomPopoverOnOutside(e) {
      var p = document.getElementById('custom-popover');
      if (p && !p.contains(e.target) && !wrap.contains(e.target)) closeCustomPopover();
      else if (p) document.addEventListener('click', closeCustomPopoverOnOutside, { once: true });
    }
  }
  function closeCustomPopover() {
    var p = document.getElementById('custom-popover');
    if (p) {
      // Destroy any Jalali datepicker popups that were appended to document.body
      var pickers = p.querySelectorAll('.jdp-input-wrap');
      pickers.forEach(function (pk) { if (pk.destroy) pk.destroy(); });
      // Also remove any orphaned calendar popups
      document.querySelectorAll('.jdp-calendar-popup').forEach(function (cp) { cp.remove(); });
      p.remove();
    }
  }

  // ---- Export menu ----
  // The dropdown menu is portaled to document.body with position:fixed so it
  // escapes any parent with overflow:hidden. This prevents the menu from being
  // clipped when the export button is inside a .card-head or similar container.
  function exportMenu(type, rows, headers, filename, title) {
    var dd = el('div', { class: 'dropdown' });
    var trigger = el('button', { class: 'btn', onclick: function (e) { e.stopPropagation(); toggleExportMenu(); } }, [ICONS.download, el('span', { style: 'display:none;' }, t('export'))]);
    trigger.lastChild.style.display = '';
    trigger.lastChild.textContent = t('export');
    // Build the menu but DON'T append it to dd — append to document.body instead
    var menu = el('div', { class: 'dropdown-menu', style: 'position:fixed; z-index:10001;' }, [
      el('div', { class: 'dropdown-label' }, t('export')),
      el('div', { class: 'dropdown-sep' }),
      el('button', { class: 'dropdown-item', onclick: function () { closeExportMenu(); exportCsv(rows, headers, filename); } }, [ICONS.csv, t('exportCsv')]),
      el('button', { class: 'dropdown-item', onclick: function () { closeExportMenu(); exportExcel(rows, headers, filename); } }, [ICONS.csv, t('exportExcel')]),
      el('button', { class: 'dropdown-item', onclick: function () { closeExportMenu(); exportPdf(rows, headers, filename, title); } }, [ICONS.csv, t('exportPdf')]),
    ]);
    menu.addEventListener('click', function (e) { e.stopPropagation(); });
    document.body.appendChild(menu);

    function positionMenu() {
      var rect = trigger.getBoundingClientRect();
      var menuW = 200, menuH = 180;
      var left = rect.right - menuW; // align to the right edge of the button
      if (left < 8) left = 8;
      var top = rect.bottom + 4;
      if (top + menuH > window.innerHeight) top = rect.top - menuH - 4;
      if (top < 8) top = 8;
      menu.style.left = left + 'px';
      menu.style.top = top + 'px';
    }
    function toggleExportMenu() {
      var isOpen = menu.classList.contains('open');
      // Close all other open dropdown menus
      document.querySelectorAll('.dropdown-menu.open').forEach(function (m) {
        if (m !== menu) m.classList.remove('open');
      });
      menu.classList.toggle('open', !isOpen);
      if (!isOpen) positionMenu();
    }
    function closeExportMenu() { menu.classList.remove('open'); }

    // Close on outside click
    document.addEventListener('click', function (e) {
      if (menu.classList.contains('open') && !menu.contains(e.target) && !trigger.contains(e.target)) {
        closeExportMenu();
      }
    });
    // Reposition on scroll/resize
    document.addEventListener('scroll', function () {
      if (menu.classList.contains('open')) positionMenu();
    }, true);
    window.addEventListener('resize', function () {
      if (menu.classList.contains('open')) positionMenu();
    });

    dd.appendChild(trigger);
    return dd;
  }

  // ---- Export implementations ----
  function downloadBlob(content, filename, type) {
    var blob = new Blob([content], { type: type });
    var url = URL.createObjectURL(blob);
    var a = document.createElement('a');
    a.href = url; a.download = filename;
    document.body.appendChild(a); a.click(); document.body.removeChild(a);
    setTimeout(function () { URL.revokeObjectURL(url); }, 1000);
  }
  function exportCsv(rows, headers, filename) {
    var esc = function (v) { var s = String(v == null ? '' : v); if (s.indexOf(',') >= 0 || s.indexOf('"') >= 0 || s.indexOf('\n') >= 0) s = '"' + s.replace(/"/g, '""') + '"'; return s; };
    var lines = [headers.map(function (h) { return esc(h.label); }).join(',')];
    rows.forEach(function (r) { lines.push(headers.map(function (h) { return esc(r[h.key]); }).join(',')); });
    downloadBlob('\uFEFF' + lines.join('\n'), filename + '.csv', 'text/csv;charset=utf-8;');
  }
  function exportExcel(rows, headers, filename) {
    var trs = rows.map(function (r) { return '<tr>' + headers.map(function (h) { return '<td>' + String(r[h.key] == null ? '' : r[h.key]).replace(/&/g, '&amp;').replace(/</g, '&lt;') + '</td>'; }).join('') + '</tr>'; }).join('');
    var html = '<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:x="urn:schemas-microsoft-com:office:excel" xmlns="http://www.w3.org/TR/REC-html40"><head><meta charset="utf-8"></head><body><table border="1"><thead><tr>' + headers.map(function (h) { return '<th>' + h.label + '</th>'; }).join('') + '</tr></thead><tbody>' + trs + '</tbody></table></body></html>';
    downloadBlob('\uFEFF' + html, filename + '.xls', 'application/vnd.ms-excel;charset=utf-8;');
  }
  function exportPdf(rows, headers, filename, title) {
    // Open a print-friendly window
    var w = window.open('', '_blank');
    var html = '<html dir="' + (state.lang === 'fa' ? 'rtl' : 'ltr') + '"><head><meta charset="utf-8"><title>' + title + '</title><style>body{font-family:Vazirmatn,Tahoma,sans-serif;padding:20px}h1{font-size:18px}table{width:100%;border-collapse:collapse;font-size:11px}th,td{border:1px solid #ccc;padding:6px;text-align:start}th{background:#7c3aed;color:#fff}</style></head><body><h1>' + title + '</h1><p style="color:#666;font-size:12px">' + formatJalaliFull(new Date(), state.lang) + '</p><table><thead><tr>' + headers.map(function (h) { return '<th>' + h.label + '</th>'; }).join('') + '</tr></thead><tbody>' + rows.map(function (r) { return '<tr>' + headers.map(function (h) { return '<td>' + (r[h.key] == null ? '' : r[h.key]) + '</td>'; }).join('') + '</tr>'; }).join('') + '</tbody></table><script>window.onload=function(){setTimeout(function(){window.print()},300)}<\/script></body></html>';
    w.document.write(html);
    w.document.close();
  }
  function downloadCanvasPng(canvas, filename) {
    var out = document.createElement('canvas');
    out.width = canvas.width; out.height = canvas.height;
    var ctx = out.getContext('2d');
    ctx.fillStyle = state.theme === 'dark' ? '#1a2227' : '#ffffff';
    ctx.fillRect(0, 0, out.width, out.height);
    ctx.drawImage(canvas, 0, 0);
    out.toBlob(function (blob) { downloadBlob(blob, filename + '.png', 'image/png'); }, 'image/png');
  }

  // ---- Sections ----
  function sectionHead(title, subtitle, extraRight) {
    var left = el('div', {}, [el('h3', {}, title), subtitle ? el('p', { style: 'font-size:13px;color:var(--muted-fg);margin-top:2px;' }, subtitle) : null]);
    var right = el('div', { style: 'display:flex;gap:8px;align-items:center;flex-wrap:wrap;' }, extraRight || []);
    return el('div', { class: 'section-head' }, [left, right]);
  }

  function kpiCard(title, value, icon, accent, delta, isMinutes, opts) {
    opts = opts || {};
    var goodDelta = isMinutes ? (delta || 0) < 0 : (delta || 0) >= 0;
    var deltaHtml = (delta !== undefined && delta !== null)
      ? '<div class="kpi-delta ' + (goodDelta ? 'good' : 'bad') + '">' + (delta >= 0 ? '↑' : '↓') + ' ' + toFa(Math.abs(delta).toFixed(1)) + pctSign() + ' · ' + (state.lang === 'fa' ? 'دوره قبل' : 'prev') + '</div>'
      : '';
    var colors = { primary: 'rgba(124,58,237,0.12);color:var(--primary)', amber: 'rgba(217,119,6,0.12);color:#d97706', rose: 'rgba(220,38,38,0.12);color:#dc2626', cyan: 'rgba(8,145,178,0.12);color:#0891b2', violet: 'rgba(147,51,234,0.12);color:#9333ea', emerald: 'rgba(22,163,74,0.12);color:#16a34a' };
    var accentColor = { primary: 'var(--primary)', amber: '#d97706', rose: '#dc2626', cyan: '#0891b2', violet: '#9333ea', emerald: '#16a34a' }[accent || 'primary'] || 'var(--primary)';
    var valueHtml = value;
    if (opts && typeof opts.numeric === 'number' && isFinite(opts.numeric)) {
      var unit = opts.unit || 'number';
      var initial = unit === 'minutes' ? formatDuration(0, state.lang) : (unit === 'percent' ? toFa('0.0') + pctSign() : formatNum(0, state.lang));
      valueHtml = '<span class="count-up" data-count-target="' + opts.numeric + '" data-count-unit="' + unit + '">' + initial + '</span>';
    }
    // CRON-REVIEW-5: optional sparkline + trend chip + clickable behavior
    var kpiKey = opts.kpiKey ? (' data-kpi-key="' + escHtml(opts.kpiKey) + '"') : '';
    var clickableCls = opts.kpiKey ? ' kpi-tile kpi-clickable' : ' kpi-tile';
    var sparkHtml = '';
    if (opts.spark && opts.spark.length > 1) {
      var sparkAnom = opts.sparkAnomalies || [];
      var trend = opts.sparkTrend || 'flat';
      var trendArrow = trend === 'up' ? '▲' : (trend === 'down' ? '▼' : '—');
      var trendCls = trend === 'up' ? 'spark-trend-up' : (trend === 'down' ? 'spark-trend-down' : 'spark-trend-flat');
      sparkHtml = '<div class="kpi-spark-wrap">'
        + sparklineSvg(opts.spark, { color: accentColor, fill: accentColor, width: 72, height: 22, strokeWidth: 1.5, anomalies: sparkAnom, showLastDot: true, smooth: true })
        + '<span class="spark-trend-chip ' + trendCls + '">' + trendArrow + ' ' + t(trend) + '</span>'
        + '</div>';
    }
    return '<div class="card card-hover kpi kpi-tile fade-in"' + kpiKey + '>'
      + '<div class="kpi-top">'
        + '<div>'
          + '<div class="kpi-label">' + title + '</div>'
          + '<div class="kpi-value">' + valueHtml + '</div>'
          + deltaHtml
        + '</div>'
        + '<div class="kpi-side">'
          + '<div class="kpi-icon" style="background:' + colors[accent || 'primary'] + '">' + icon + '</div>'
          + sparkHtml
        + '</div>'
      + '</div>'
    + '</div>';
  }

  // ---- Sparkline SVG helper (CRON-REVIEW-5) ----
  // Pure-SVG mini chart, dependency-free. Used inside KPI tiles (~72×22) and
  // the drill-down modal mini-trend card (~200×40). Mirrors the React
  // Sparkline component: smoothed line, gradient fill, red anomaly dots,
  // last-point dot, optional mean reference line.
  var SPARK_ID_SEQ = 0;
  function sparklineSvg(data, opts) {
    opts = opts || {};
    var color = opts.color || 'var(--primary)';
    var fill = opts.fill || color;
    var w = opts.width || 72;
    var h = opts.height || 22;
    var sw = opts.strokeWidth || 1.5;
    var anomalies = opts.anomalies || [];
    var showLastDot = opts.showLastDot !== false;
    var smooth = opts.smooth !== false;
    var showMean = !!opts.showMean;
    SPARK_ID_SEQ = (SPARK_ID_SEQ + 1) % 1000000;
    var id = opts.id || ('spark-' + SPARK_ID_SEQ);
    if (!data || data.length < 2) {
      return '<svg class="sparkline" width="' + w + '" height="' + h + '" aria-hidden="true"></svg>';
    }
    var pad = 2;
    var min = Math.min.apply(null, data);
    var max = Math.max.apply(null, data);
    var range = (max - min) || 1;
    var stepX = (w - pad * 2) / (data.length - 1);
    function yOf(v) { return pad + (h - pad * 2) * (1 - (v - min) / range); }
    var pts = data.map(function (v, i) { return { x: pad + i * stepX, y: yOf(v) }; });
    var line = '';
    if (smooth && pts.length > 2) {
      line = 'M ' + pts[0].x.toFixed(2) + ',' + pts[0].y.toFixed(2);
      for (var i = 0; i < pts.length - 1; i++) {
        var p0 = pts[i], p1 = pts[i + 1];
        var midX = (p0.x + p1.x) / 2;
        line += ' C ' + midX.toFixed(2) + ',' + p0.y.toFixed(2)
              + ' '   + midX.toFixed(2) + ',' + p1.y.toFixed(2)
              + ' '   + p1.x.toFixed(2) + ',' + p1.y.toFixed(2);
      }
    } else {
      line = pts.map(function (p, i) {
        return (i === 0 ? 'M' : 'L') + ' ' + p.x.toFixed(2) + ',' + p.y.toFixed(2);
      }).join(' ');
    }
    var area = line
      + ' L ' + pts[pts.length - 1].x.toFixed(2) + ',' + (h - pad)
      + ' L ' + pts[0].x.toFixed(2) + ',' + (h - pad) + ' Z';
    var mean = data.reduce(function (a, b) { return a + b; }, 0) / data.length;
    var meanY = yOf(mean);
    var meanLine = showMean
      ? '<line x1="' + pad + '" x2="' + (w - pad) + '" y1="' + meanY.toFixed(2) + '" y2="' + meanY.toFixed(2) + '" stroke="currentColor" stroke-width="0.75" stroke-dasharray="3 3" opacity="0.5"/>'
      : '';
    var anomDots = anomalies.map(function (idx) {
      var p = pts[idx]; if (!p) return '';
      return '<circle class="spark-anomaly-dot" cx="' + p.x.toFixed(2) + '" cy="' + p.y.toFixed(2) + '" r="2" fill="#dc2626" stroke="white" stroke-width="0.8"/>';
    }).join('');
    var lastDot = showLastDot
      ? '<circle cx="' + pts[pts.length - 1].x.toFixed(2) + '" cy="' + pts[pts.length - 1].y.toFixed(2) + '" r="2.4" fill="' + color + '" stroke="white" stroke-width="1"/>'
      : '';
    return '<svg class="sparkline" width="' + w + '" height="' + h + '" viewBox="0 0 ' + w + ' ' + h + '" preserveAspectRatio="none" aria-hidden="true">'
      + '<defs><linearGradient id="' + id + '" x1="0" y1="0" x2="0" y2="1">'
        + '<stop offset="0%" stop-color="' + fill + '" stop-opacity="0.32"/>'
        + '<stop offset="100%" stop-color="' + fill + '" stop-opacity="0"/>'
      + '</linearGradient></defs>'
      + meanLine
      + '<path d="' + area + '" fill="url(#' + id + ')"/>'
      + '<path d="' + line + '" fill="none" stroke="' + color + '" stroke-width="' + sw + '" stroke-linecap="round" stroke-linejoin="round"/>'
      + anomDots + lastDot
    + '</svg>';
  }

  // ---- KPI Sparkline fetch + inject (CRON-REVIEW-5 Feature 1) ----
  // Fetches sparkline data for all 8 KPIs in parallel, then injects the SVG
  // into each KPI tile's .kpi-side via [data-kpi-key] selector.
  var KPI_KEYS = ['total','open','closed','escalated','avgResponse','avgResolution','activeAgents','csat'];
  function fetchKpiSparklines(keys) {
    keys = keys || KPI_KEYS;
    keys.forEach(function (key) {
      api('kpiSparkline', { key: key, days: state.period }).then(function (spark) {
        state.kpiSparklines[key] = spark;
        injectKpiSparkline(key, spark);
      }).catch(function () { /* leave tile without sparkline */ });
    });
  }
  function injectKpiSparkline(key, spark) {
    var tile = document.querySelector('.kpi-tile[data-kpi-key="' + key + '"]');
    if (!tile) return;
    var side = tile.querySelector('.kpi-side');
    if (!side) return;
    // Skip if a sparkline is already rendered (e.g. after a re-render that kept state)
    if (side.querySelector('.kpi-spark-wrap')) {
      var existing = side.querySelector('.kpi-spark-wrap');
      existing.remove();
    }
    var accentColor = tile.getAttribute('data-spark-color') || 'var(--primary)';
    var data = (spark.points || []).map(function (p) { return p.value; });
    if (!data || data.length < 2) return;
    var wrap = el('div', { class: 'kpi-spark-wrap' });
    wrap.innerHTML = sparklineSvg(data, {
      color: accentColor, fill: accentColor, width: 72, height: 22,
      strokeWidth: 1.5, anomalies: spark.anomalies || [], showLastDot: true, smooth: true
    })
      + '<span class="spark-trend-chip spark-trend-' + (spark.trend || 'flat') + '">'
      + (spark.trend === 'up' ? '▲' : (spark.trend === 'down' ? '▼' : '—'))
      + ' ' + t(spark.trend || 'flat')
      + '</span>';
    side.appendChild(wrap);
  }

  function renderOverview(c) {
    c.innerHTML = '';
    c.appendChild(sectionHead(t('navOverview'), state.lang === 'fa' ? 'داشبورد گزارشگیری · ' + t('appSubtitle') : 'Reporting Dashboard · ' + t('appSubtitle'), [periodSelector()]));
    var grid = el('div', { class: 'grid grid-4 glass-card', id: 'kpi-grid' });
    grid.innerHTML = '<div class="skeleton" style="height:120px"></div>'.repeat(8);
    c.appendChild(grid);

    api('overview', { period: state.period }).then(function (d) {
      state.data.overview = d;
      grid.innerHTML =
        kpiCard(t('kpiTotalTickets'), formatNum(d.total, state.lang), ICONS.ticket, 'primary', d.deltaTotal, false, { numeric: d.total, unit: 'number', kpiKey: 'total' }) +
        kpiCard(t('kpiOpenTickets'), formatNum(d.open, state.lang), ICONS.alert, 'amber', d.deltaOpen, false, { numeric: d.open, unit: 'number', kpiKey: 'open' }) +
        kpiCard(t('kpiClosedTickets'), formatNum(d.closed, state.lang), ICONS.check, 'emerald', false, { numeric: d.closed, unit: 'number', kpiKey: 'closed' }) +
        kpiCard(t('kpiEscalated'), formatNum(d.escalated, state.lang), ICONS.alert, 'rose', false, { numeric: d.escalated, unit: 'number', kpiKey: 'escalated' }) +
        kpiCard(t('kpiAvgResponse'), formatDuration(d.avgResponse, state.lang), ICONS.clock, 'cyan', d.deltaResponse, true, { numeric: d.avgResponse, unit: 'minutes', kpiKey: 'avgResponse' }) +
        kpiCard(t('kpiAvgResolution'), formatDuration(d.avgResolution, state.lang), ICONS.gauge, 'violet', null, true, { numeric: d.avgResolution, unit: 'minutes', kpiKey: 'avgResolution' }) +
        kpiCard(t('kpiActiveAgents'), formatNum(d.activeAgents, state.lang), ICONS.users, 'primary', false, { numeric: d.activeAgents, unit: 'number', kpiKey: 'activeAgents' }) +
        kpiCard(state.lang === 'fa' ? 'رضایت مشتری' : 'CSAT', '—', ICONS.smile, 'emerald', null, false, { kpiKey: 'csat' });
      // Tag each tile with its accent color so the sparkline inject knows what to use.
      var accentMap = { total: 'var(--primary)', open: '#d97706', closed: '#16a34a', escalated: '#dc2626', avgResponse: '#0891b2', avgResolution: '#9333ea', activeAgents: 'var(--primary)', csat: '#16a34a' };
      Array.prototype.forEach.call(grid.querySelectorAll('.kpi-tile[data-kpi-key]'), function (tile) {
        tile.setAttribute('data-spark-color', accentMap[tile.getAttribute('data-kpi-key')] || 'var(--primary)');
      });
      // CRON-REVIEW-5 Feature 1+2: fetch sparklines + wire click-to-drill-down.
      fetchKpiSparklines();
      Array.prototype.forEach.call(grid.querySelectorAll('.kpi-tile[data-kpi-key]'), function (tile) {
        tile.addEventListener('click', function () { openKpiDrilldown(tile.getAttribute('data-kpi-key')); });
        tile.addEventListener('keydown', function (e) {
          if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); openKpiDrilldown(tile.getAttribute('data-kpi-key')); }
        });
        tile.setAttribute('tabindex', '0');
        tile.setAttribute('role', 'button');
      });
      // animate count-ups
      animateCountUpsIn(grid);
      // Task 9-PHP-MIRROR-2: AI Insights card + Agent Leaderboard card
      // (2-col row, rendered above the charts row).
      renderAiInsightsAndLeaderboardRow(c);
      // charts row + activity feed
      renderOverviewCharts(c, d);
    }).catch(function (e) { grid.innerHTML = '<div class="empty">' + (e.message || t('noData')) + '</div>'; });
  }

  // ---- AI Insights + Agent Leaderboard (Task 9-PHP-MIRROR-2) ----
  // Two cards side-by-side, fetched in parallel. Each card renders its own
  // skeleton first, then fills in when its API call resolves.
  function renderAiInsightsAndLeaderboardRow(c) {
    var row = el('div', { class: 'grid grid-2', id: 'ai-lb-row', style: 'margin-top:16px;' });
    row.appendChild(renderAiInsightsCard());
    row.appendChild(renderAgentLeaderboardCard());
    c.appendChild(row);
  }

  // ---- AI Insights card ----
  var AI_SEVERITY_STYLES = {
    info:     { bg: 'rgba(8,145,178,0.10)',  text: '#0891b2', stripe: '#0891b2' },
    warning:  { bg: 'rgba(217,119,6,0.10)',  text: '#d97706', stripe: '#d97706' },
    critical: { bg: 'rgba(220,38,38,0.10)',  text: '#dc2626', stripe: '#dc2626' },
    success:  { bg: 'rgba(22,163,74,0.10)',  text: '#16a34a', stripe: '#16a34a' },
  };
  var AI_TYPE_ICON = { trend: 'trendingUp', alert: 'alertTriangle', tip: 'lightbulb', strength: 'award' };
  function renderAiInsightsCard() {
    var card = el('div', { class: 'ai-insights-card card gradient-border', style: 'position:relative;overflow:hidden;' });
    // Decorative gradient blobs (purely visual, hidden in print)
    card.innerHTML =
      '<div class="ai-decor-blob ai-decor-1" aria-hidden="true"></div>' +
      '<div class="ai-decor-blob ai-decor-2" aria-hidden="true"></div>';
    // Header
    var head = el('div', { class: 'ai-head', style: 'position:relative;display:flex;align-items:center;justify-content:space-between;gap:12px;padding:14px 16px;' });
    head.appendChild(el('div', { style: 'display:flex;align-items:center;gap:12px;min-width:0;' }, [
      el('div', { class: 'ai-icon-wrap', html: ICONS.sparkles }),
      el('div', {}, [
        el('div', { style: 'display:flex;align-items:center;gap:6px;' }, [
          el('h3', { style: 'font-size:14px;font-weight:700;margin:0;' }, t('aiInsightsTitle')),
          el('span', { class: 'badge badge-primary', style: 'font-size:9px;font-weight:700;letter-spacing:0.06em;text-transform:uppercase;' }, t('newFeature')),
        ]),
        el('p', { style: 'font-size:11px;color:var(--muted-fg);margin:2px 0 0;' }, t('aiInsightsDesc')),
      ]),
    ]));
    var refreshBtn = el('button', {
      class: 'icon-btn ai-refresh-btn',
      onclick: function () {
        var btn = refreshBtn;
        if (btn) btn.classList.add('refreshing');
        fetchAiInsights(true).then(function () {
          if (btn) btn.classList.remove('refreshing');
        });
      },
      title: t('aiRefresh'),
      'aria-label': t('aiRefresh'),
    }, [ICONS.refreshCw]);
    head.appendChild(refreshBtn);
    card.appendChild(head);
    // Body — 2x2 grid.
    // NOTE: previously had min-height:280px which forced the card too tall when
    // empty/loading and made the grid-2 row unbalanced vs the leaderboard card.
    // Now the body grows naturally with its content.
    var body = el('div', { class: 'ai-body', id: 'ai-insights-body', style: 'position:relative;display:grid;grid-template-columns:repeat(2,1fr);gap:10px;padding:0 16px 12px;align-content:start;' }, '<div class="skeleton" style="height:80px;grid-column:1 / -1"></div>');
    card.appendChild(body);
    // Footer — "AI-generated"
    card.appendChild(el('div', { class: 'ai-footer', style: 'border-top:1px solid var(--border);background:var(--muted);padding:8px 16px;font-size:10px;color:var(--muted-fg);display:flex;align-items:center;gap:6px;' }, [
      '<span style="display:inline-flex;align-items:center;gap:4px;">' + ICONS.sparkles + '<span style="width:12px;height:12px;display:inline-flex;">' + ICONS.sparkles + '</span></span>',
      el('span', {}, t('aiGenerated')),
    ]));
    // Fetch data
    fetchAiInsights(false);
    return card;
  }
  function fetchAiInsights(force) {
    return api('aiInsights', { days: state.period }).then(function (insights) {
      state.aiInsights = Array.isArray(insights) ? insights : [];
      renderAiInsightsBody(state.aiInsights);
    }).catch(function () {
      renderAiInsightsBody([]);
    });
  }
  function renderAiInsightsBody(insights) {
    var body = document.getElementById('ai-insights-body');
    if (!body) return;
    if (!insights || !insights.length) {
      body.innerHTML = '<div class="empty" style="grid-column:1 / -1;padding:24px;">' + t('noData') + '</div>';
      return;
    }
    var chev = state.lang === 'fa' ? ICONS.chevronLeft : ICONS.chevronRight;
    body.innerHTML = insights.map(function (ins) {
      var sev = ins.severity || 'info';
      var st = AI_SEVERITY_STYLES[sev] || AI_SEVERITY_STYLES.info;
      var iconKey = AI_TYPE_ICON[ins.type] || 'sparkles';
      var title = state.lang === 'fa' ? (ins.titleFa || ins.titleEn) : (ins.titleEn || ins.titleFa);
      var bodyTxt = state.lang === 'fa' ? (ins.bodyFa || ins.bodyEn) : (ins.bodyEn || ins.bodyFa);
      var metric = ins.metric || '';
      return '<div class="ai-insight-tile" style="position:relative;overflow:hidden;border:1px solid var(--border);border-radius:10px;padding:12px;background:var(--card);box-shadow:inset 3px 0 0 ' + st.stripe + ';">' +
        '<div style="display:flex;align-items:flex-start;justify-content:space-between;gap:8px;">' +
          '<div style="display:flex;align-items:center;gap:8px;min-width:0;">' +
            '<span style="display:inline-flex;width:28px;height:28px;border-radius:8px;align-items:center;justify-content:center;background:' + st.bg + ';color:' + st.text + ';flex-shrink:0;">' + (ICONS[iconKey] || ICONS.sparkles) + '</span>' +
            '<h4 style="font-size:13px;font-weight:700;margin:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">' + escHtml(title) + '</h4>' +
          '</div>' +
          (metric ? '<span style="background:' + st.bg + ';color:' + st.text + ';padding:2px 8px;border-radius:6px;font-size:11px;font-weight:700;flex-shrink:0;">' + escHtml(digits(metric, state.lang)) + '</span>' : '') +
        '</div>' +
        '<p style="margin:8px 0 0;font-size:12px;line-height:1.55;color:var(--muted-fg);">' + escHtml(bodyTxt) + '</p>' +
        '<div class="ai-view-details" style="margin-top:8px;display:flex;align-items:center;gap:4px;font-size:11px;font-weight:500;color:var(--primary);opacity:0;transition:opacity 0.2s;">' +
          '<span>' + t('aiViewDetails') + '</span>' + chev +
        '</div>' +
      '</div>';
    }).join('');
  }

  // ---- Agent Leaderboard card ----
  var MEDAL_STYLES = {
    gold:   { bg: 'linear-gradient(135deg,#fbbf24,#eab308)', text: '#78350f', color: '#eab308', labelFa: 'نفر اول', labelEn: '1st', icon: 'crown', height: 168, order: 2 },
    silver: { bg: 'linear-gradient(135deg,#cbd5e1,#94a3b8)', text: '#1e293b', color: '#94a3b8', labelFa: 'نفر دوم', labelEn: '2nd', icon: 'medal', height: 132, order: 1 },
    bronze: { bg: 'linear-gradient(135deg,#fb923c,#c2410c)', text: '#451a03', color: '#c2410c', labelFa: 'نفر سوم', labelEn: '3rd', icon: 'medal', height: 100, order: 3 },
  };
  function renderAgentLeaderboardCard() {
    var card = el('div', { class: 'leaderboard-card card', style: 'overflow:visible;' });
    var head = el('div', { class: 'card-head', style: 'padding:14px 16px;' }, [
      el('div', { style: 'display:flex;align-items:center;gap:12px;' }, [
        el('div', { class: 'lb-trophy-wrap', html: ICONS.trophy }),
        el('div', {}, [
          el('div', { style: 'display:flex;align-items:center;gap:6px;' }, [
            el('h3', { style: 'font-size:14px;font-weight:700;margin:0;' }, t('leaderboardTitle')),
            el('span', { class: 'badge badge-amber', style: 'font-size:9px;font-weight:700;letter-spacing:0.06em;text-transform:uppercase;' }, t('newFeature')),
          ]),
          el('p', { style: 'font-size:11px;color:var(--muted-fg);margin:2px 0 0;' }, t('leaderboardDesc')),
        ]),
      ]),
    ]);
    card.appendChild(head);
    var body = el('div', { class: 'card-body', id: 'leaderboard-body', style: 'padding:24px 16px 12px;overflow:visible;' }, '<div class="skeleton" style="height:200px"></div>');
    card.appendChild(body);
    fetchAgentLeaderboard();
    return card;
  }
  function fetchAgentLeaderboard() {
    return api('agentLeaderboard', { days: state.period }).then(function (entries) {
      state.agentLeaderboard = Array.isArray(entries) ? entries : [];
      renderAgentLeaderboardBody(state.agentLeaderboard);
    }).catch(function () { renderAgentLeaderboardBody([]); });
  }
  function renderAgentLeaderboardBody(entries) {
    var body = document.getElementById('leaderboard-body');
    if (!body) return;
    if (!entries || !entries.length) {
      body.innerHTML = '<div class="empty" style="padding:24px;">' + t('noData') + '</div>';
      return;
    }
    var podium = entries.slice(0, 3);
    var rest = entries.slice(3, 8);
    // Order podium for display: silver (left), gold (center), bronze (right)
    var order = [1, 0, 2]; // index into `podium`
    var html = '<div class="lb-podium">';
    order.forEach(function (idx) {
      var e = podium[idx];
      if (!e) { html += '<div></div>'; return; }
      var medal = e.medal || 'gold';
      var st = MEDAL_STYLES[medal] || MEDAL_STYLES.gold;
      var h = st.height;
      var agent = e.agent || {};
      var name = state.lang === 'fa' ? (agent.fullnameFa || agent.fullname || '—') : (agent.fullname || agent.fullnameFa || '—');
      var initial = (name || '?').charAt(0);
      var label = state.lang === 'fa' ? st.labelFa : st.labelEn;
      var icon = ICONS[st.icon] || ICONS.medal;
      html += '<div class="podium-card lb-podium-card" style="min-height:' + h + 'px;">';
      html += '<div class="lb-medal-badge">' + icon + '<span>' + escHtml(label) + '</span></div>';
      html += '<div class="lb-avatar" style="background:' + (agent.avatarColor || st.color) + ';border-color:' + st.color + ';">' + escHtml(initial) + '</div>';
      html += '<p class="lb-name">' + escHtml(name) + '</p>';
      html += '<div class="lb-score"><span class="lb-score-num">' + digits(formatNum(e.score, state.lang), state.lang) + '</span><span class="lb-score-max">/ 100</span></div>';
      // Pillar bar
      html += '<div class="lb-pillar" style="height:' + Math.round(e.score * 0.4) + 'px;background:linear-gradient(to top, transparent, ' + st.color + '40);"></div>';
      html += '</div>';
    });
    html += '</div>';
    // Rest (rank 4..8)
    if (rest.length > 0) {
      html += '<p style="margin:0 0 8px;font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:0.05em;color:var(--muted-fg);">' + t('rank') + ' ۴–۸</p>';
      html += '<div style="display:flex;flex-direction:column;gap:6px;">';
      rest.forEach(function (e) {
        var agent = e.agent || {};
        var name = state.lang === 'fa' ? (agent.fullnameFa || agent.fullname || '—') : (agent.fullname || agent.fullnameFa || '—');
        var initial = (name || '?').charAt(0);
        var respUnit = state.lang === 'fa' ? 'د' : 'm';
        html += '<div class="lb-rest-row" style="display:flex;align-items:center;gap:10px;padding:8px;border:1px solid var(--border);border-radius:8px;background:var(--card);">';
        html += '<span style="display:flex;width:24px;height:24px;align-items:center;justify-content:center;border-radius:6px;background:var(--muted);color:var(--muted-fg);font-size:11px;font-weight:700;flex-shrink:0;">' + digits(e.rank, state.lang) + '</span>';
        html += '<span style="display:flex;width:32px;height:32px;align-items:center;justify-content:center;border-radius:50%;background:' + (agent.avatarColor || 'var(--muted)') + ';color:#fff;font-size:12px;font-weight:700;flex-shrink:0;">' + escHtml(initial) + '</span>';
        html += '<div style="flex:1;min-width:0;">';
        html += '<p style="margin:0;font-size:13px;font-weight:500;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">' + escHtml(name) + '</p>';
        html += '<div style="margin-top:2px;display:flex;align-items:center;gap:10px;font-size:11px;color:var(--muted-fg);">';
        html += '<span style="display:inline-flex;align-items:center;gap:3px;color:#16a34a;">' + ICONS.checkCircle + digits(formatNum(e.resolved, state.lang), state.lang) + '</span>';
        html += '<span style="display:inline-flex;align-items:center;gap:3px;color:#d97706;">' + ICONS.star + digits(formatNum(e.csat, state.lang), state.lang) + pctSign() + '</span>';
        html += '<span style="display:inline-flex;align-items:center;gap:3px;color:#0891b2;">' + ICONS.clock + digits(formatNum(e.avgResponse, state.lang), state.lang) + respUnit + '</span>';
        html += '</div></div>';
        html += '<div style="display:flex;align-items:center;gap:8px;flex-shrink:0;">';
        html += '<div class="progress" style="width:64px;height:6px;"><div class="progress-fill" style="width:' + Math.min(e.score, 100) + '%;background:linear-gradient(to right,var(--primary),#16a34a);"></div></div>';
        html += '<span style="font-size:13px;font-weight:700;min-width:32px;text-align:end;">' + digits(e.score, state.lang) + '</span>';
        html += '</div></div>';
      });
      html += '</div>';
    }
    html += '<p style="margin:10px 0 0;text-align:center;font-size:10px;color:var(--muted-fg);">' + t('basedOn') + '</p>';
    body.innerHTML = html;
  }

  // ---- Settings dialog (Task 9-PHP-MIRROR-2) ----
  function renderSettingsButton() {
    return el('button', {
      class: 'icon-btn no-print',
      onclick: openSettingsDialog,
      title: t('settingsTitle'),
      'aria-label': t('settingsTitle'),
      id: 'settings-btn',
    }, [ICONS.gear]);
  }
  function openSettingsDialog() {
    // close other popovers/dialogs first
    closeNotificationsPanel();
    closeHelpDialog();
    closeHealthPopover();
    closeSavedViewsPanel();
    state.settingsOpen = true;
    var overlay = el('div', { class: 'settings-dialog-overlay no-print', id: 'settings-dialog-overlay', role: 'dialog', 'aria-modal': 'true', 'aria-label': t('settingsTitle') });
    var dialog = el('div', { class: 'settings-dialog animate-pop-in' });
    // Header
    var head = el('div', { class: 'settings-head' }, [
      el('div', { class: 'settings-head-left' }, [
        el('div', { class: 'settings-head-icon', html: ICONS.gear }),
        el('div', {}, [
          el('h2', {}, t('settingsTitle')),
          el('p', { class: 'settings-head-desc' }, t('settingsGeneral') + ' · ' + t('settingsDisplay') + ' · ' + t('settingsData')),
        ]),
      ]),
      el('button', { class: 'icon-btn', onclick: closeSettingsDialog, 'aria-label': 'close', title: t('scClose') }, [ICONS.x]),
    ]);
    dialog.appendChild(head);
    // Body — clone current settings into a draft
    var draft = Object.assign({}, state.settings);
    var body = el('div', { class: 'settings-body scrollbar-custom' });
    // === Display section ===
    body.appendChild(el('h3', { class: 'settings-section-title' }, [el('span', { html: ICONS.eye }), t('settingsDisplay')]));
    // Theme row
    body.appendChild(settingsThemeRow());
    // Language row
    body.appendChild(settingsLanguageRow());
    // Animations toggle
    body.appendChild(settingsToggleRow(ICONS.sparkles, 'rgba(147,51,234,0.12)', '#9333ea', t('settingsAnimations'), state.lang === 'fa' ? 'انیمیشن ورود کارت‌ها و تغییرات' : 'Card entrance and transition animations', draft.animations, function (v) { draft.animations = v; }));
    // Compact mode toggle
    body.appendChild(settingsToggleRow(ICONS.listOrdered, 'rgba(8,145,178,0.12)', '#0891b2', t('settingsCompactMode'), state.lang === 'fa' ? 'فشرده‌تر کردن جدول‌ها و کارت‌ها' : 'Denser tables and cards', draft.compactMode, function (v) { draft.compactMode = v; }));
    // Show tips toggle
    body.appendChild(settingsToggleRow(ICONS.lightbulb, 'rgba(217,119,6,0.12)', '#d97706', t('settingsShowTips'), state.lang === 'fa' ? 'نمایش نکته روز و راهنمای داخل صفحه' : 'Show daily tip and inline help', draft.showTips, function (v) { draft.showTips = v; }));

    // === Data section ===
    body.appendChild(el('h3', { class: 'settings-section-title', style: 'margin-top:20px;' }, [el('span', { html: ICONS.clock }), t('settingsData')]));
    // Default period button group
    body.appendChild(settingsButtonGroupRow(ICONS.clock, 'rgba(22,163,74,0.12)', '#16a34a', t('settingsDefaultPeriod'), state.lang === 'fa' ? 'بازه پیش‌فرض هنگام ورود به داشبورد' : 'Default period when entering the dashboard', [7,14,30,60,90,180], draft.defaultPeriod, function (v) { draft.defaultPeriod = v; }, function (v) { return digits(v, state.lang) + ' ' + (state.lang === 'fa' ? 'روز' : 'days'); }));
    // Items per page button group
    body.appendChild(settingsButtonGroupRow(ICONS.listOrdered, 'rgba(220,38,38,0.12)', '#dc2626', t('settingsItemsPerPage'), state.lang === 'fa' ? 'تعداد ردیف در جدول‌ها' : 'Rows shown in tables', [5,10,15,25,50], draft.itemsPerPage, function (v) { draft.itemsPerPage = v; }, function (v) { return digits(v, state.lang); }));
    // Auto-refresh toggle
    body.appendChild(settingsToggleRow(ICONS.refreshCw, 'rgba(124,58,237,0.12)', 'var(--primary)', t('settingsAutoRefresh'), state.lang === 'fa' ? 'بازخوانی خودکار داده‌ها در فواصل زمانی مشخص' : 'Automatically refresh data at fixed intervals', draft.autoRefreshEnabled, function (v) { draft.autoRefreshEnabled = v; refreshAutoRefreshRow(); }));
    // Auto-refresh interval (shown only when autoRefreshEnabled is on)
    var arIntervalRow = el('div', { id: 'settings-ar-interval-row' });
    body.appendChild(arIntervalRow);
    function refreshAutoRefreshRow() {
      arIntervalRow.innerHTML = '';
      if (!draft.autoRefreshEnabled) { arIntervalRow.style.display = 'none'; return; }
      arIntervalRow.style.display = '';
      arIntervalRow.appendChild(settingsButtonGroupRow(ICONS.clock, 'rgba(124,58,237,0.12)', 'var(--primary)', t('settingsAutoRefreshEvery'), '', [60,120,300,600,1800], draft.autoRefreshInterval, function (v) { draft.autoRefreshInterval = v; }, function (v) { return v < 60 ? digits(v, state.lang) + ' ' + (state.lang === 'fa' ? 'ث' : 's') : digits(Math.round(v/60), state.lang) + ' ' + (state.lang === 'fa' ? 'دقیقه' : 'min'); }));
    }
    refreshAutoRefreshRow();
    dialog.appendChild(body);
    // Footer
    var savedMsg = el('span', { class: 'settings-saved-msg', style: 'color:#16a34a;font-size:12px;font-weight:500;opacity:0;transition:opacity 0.3s;' }, '✓ ' + t('settingsSaved'));
    var footer = el('div', { class: 'settings-footer' }, [
      el('button', { class: 'btn', onclick: function () { draft = Object.assign({}, DEFAULT_SETTINGS); refreshAutoRefreshRow(); /* rebuild body to reflect reset */ rebuildBody(); } }, [ICONS.rotateCcw2, t('settingsReset')]),
      el('div', { style: 'display:flex;align-items:center;gap:8px;' }, [
        savedMsg,
        el('button', { class: 'btn', onclick: closeSettingsDialog }, t('settingsCancel')),
        el('button', { class: 'btn btn-primary', onclick: function () {
          state.settings = Object.assign({}, draft);
          persistSettings();
          applySettingsToDocument();
          // brief "saved" toast
          savedMsg.style.opacity = '1';
          setTimeout(function () { savedMsg.style.opacity = '0'; }, 1800);
          // re-render current section so compact-mode/items-per-page take effect
          destroyCharts(); renderSection();
        } }, [ICONS.save, t('settingsSave')]),
      ]),
    ]);
    dialog.appendChild(footer);
    overlay.appendChild(dialog);
    overlay.addEventListener('click', function (e) { if (e.target === overlay) closeSettingsDialog(); });
    document.body.appendChild(overlay);
    document.addEventListener('keydown', onSettingsEsc);
    // rebuildBody(): cheap trick to reflect "Reset" — close & reopen the dialog
    function rebuildBody() {
      closeSettingsDialog();
      openSettingsDialog();
    }
  }
  function onSettingsEsc(e) { if (e.key === 'Escape') closeSettingsDialog(); }
  function closeSettingsDialog() {
    state.settingsOpen = false;
    var ov = document.getElementById('settings-dialog-overlay');
    if (ov) ov.remove();
    document.removeEventListener('keydown', onSettingsEsc);
  }
  function settingsThemeRow() {
    var isDark = state.theme === 'dark';
    return el('div', { class: 'settings-row' }, [
      el('div', { class: 'settings-row-icon', style: 'background:rgba(217,119,6,0.12);color:#d97706;' }, isDark ? ICONS.moon : ICONS.sun),
      el('div', { style: 'flex:1;min-width:0;' }, [
        el('p', { class: 'settings-row-title' }, state.lang === 'fa' ? 'حالت نمایش' : 'Appearance'),
        el('p', { class: 'settings-row-desc' }, isDark ? t('dark') : t('light')),
      ]),
      el('button', { class: 'btn', onclick: toggleTheme }, [isDark ? ICONS.sun : ICONS.moon, isDark ? t('light') : t('dark')]),
    ]);
  }
  function settingsLanguageRow() {
    return el('div', { class: 'settings-row' }, [
      el('div', { class: 'settings-row-icon', style: 'background:rgba(124,58,237,0.12);color:var(--primary);' }, ICONS.languages),
      el('div', { style: 'flex:1;min-width:0;' }, [
        el('p', { class: 'settings-row-title' }, state.lang === 'fa' ? 'زبان' : 'Language'),
        el('p', { class: 'settings-row-desc' }, state.lang === 'fa' ? 'فارسی (راست به چپ)' : 'English (LTR)'),
      ]),
      el('span', { class: 'badge badge-muted' }, state.lang === 'fa' ? 'فارسی' : 'English'),
    ]);
  }
  function settingsToggleRow(icon, iconBg, iconColor, title, desc, value, onChange) {
    var row = el('div', { class: 'settings-row' });
    row.appendChild(el('div', { class: 'settings-row-icon', style: 'background:' + iconBg + ';color:' + iconColor + ';' }, icon));
    row.appendChild(el('div', { style: 'flex:1;min-width:0;' }, [
      el('p', { class: 'settings-row-title' }, title),
      el('p', { class: 'settings-row-desc' }, desc),
    ]));
    var btn = el('button', { class: 'settings-toggle' + (value ? ' on' : ''), role: 'switch', 'aria-checked': value ? 'true' : 'false', onclick: function () {
      value = !value;
      btn.classList.toggle('on', value);
      btn.setAttribute('aria-checked', value ? 'true' : 'false');
      onChange(value);
    } });
    btn.appendChild(el('span', { class: 'settings-toggle-knob' }));
    row.appendChild(btn);
    return row;
  }
  function settingsButtonGroupRow(icon, iconBg, iconColor, title, desc, options, currentValue, onChange, formatLabel) {
    var row = el('div', { class: 'settings-row', style: 'flex-wrap:wrap;' });
    var iconWrap = el('div', { class: 'settings-row-icon', style: 'background:' + iconBg + ';color:' + iconColor + ';' }, icon);
    row.appendChild(iconWrap);
    var txtWrap = el('div', { style: 'flex:1;min-width:120px;' }, [
      el('p', { class: 'settings-row-title' }, title),
      desc ? el('p', { class: 'settings-row-desc' }, desc) : null,
    ]);
    row.appendChild(txtWrap);
    var grp = el('div', { class: 'settings-btn-group', style: 'display:flex;flex-wrap:wrap;gap:6px;' });
    options.forEach(function (opt) {
      var active = opt === currentValue;
      var btn = el('button', {
        class: 'settings-btn-grp-item' + (active ? ' active' : ''),
        onclick: function () {
          currentValue = opt;
          // toggle active state on all siblings
          Array.prototype.forEach.call(grp.querySelectorAll('.settings-btn-grp-item'), function (b) { b.classList.remove('active'); });
          btn.classList.add('active');
          onChange(opt);
        },
      }, formatLabel(opt));
      grp.appendChild(btn);
    });
    row.appendChild(grp);
    return row;
  }

  // ---- Saved Views / Bookmarks (Task 9-PHP-MIRROR-2) ----
  function renderSavedViewsButton() {
    var wrap = el('div', { class: 'saved-views-wrap no-print', style: 'position:relative;display:inline-flex;' });
    var btn = el('button', {
      class: 'icon-btn saved-views-btn',
      onclick: toggleSavedViewsPanel,
      title: t('savedViewsTitle'),
      'aria-label': t('savedViewsTitle'),
      'aria-expanded': 'false',
      id: 'saved-views-btn',
    }, [ICONS.bookmark]);
    // Count badge
    var count = state.savedViews.length;
    var badge = el('span', { class: 'saved-views-badge', id: 'saved-views-badge', style: count > 0 ? '' : 'display:none;' }, digits(count, state.lang));
    btn.appendChild(badge);
    wrap.appendChild(btn);
    return wrap;
  }
  function updateSavedViewsBadge() {
    var badge = document.getElementById('saved-views-badge');
    var count = state.savedViews.length;
    if (badge) {
      badge.style.display = count > 0 ? '' : 'none';
      badge.textContent = digits(count, state.lang);
    }
  }
  function toggleSavedViewsPanel() { if (state.savedViewsOpen) closeSavedViewsPanel(); else openSavedViewsPanel(); }
  function openSavedViewsPanel() {
    closeNotificationsPanel();
    closeHelpDialog();
    closeHealthPopover();
    closeSettingsDialog();
    state.savedViewsOpen = true;
    var btn = document.getElementById('saved-views-btn');
    if (btn) btn.setAttribute('aria-expanded', 'true');
    var panel = el('div', { class: 'saved-views-panel no-print', id: 'saved-views-panel', role: 'dialog', 'aria-label': t('savedViewsTitle') });
    panel.innerHTML = savedViewsPanelHtml();
    document.body.appendChild(panel);
    positionSavedViewsPanel();
    wireSavedViewsHandlers();
    setTimeout(function () {
      document.addEventListener('mousedown', onSavedViewsOutsideClick);
      document.addEventListener('keydown', onSavedViewsEsc);
      window.addEventListener('resize', positionSavedViewsPanel);
    }, 0);
  }
  function savedViewsPanelHtml() {
    var html = '';
    // Header
    html += '<div class="sv-head">';
    html += '<div class="sv-head-left"><span class="sv-head-icon">' + ICONS.bookmark + '</span><h3>' + escHtml(t('savedViewsTitle')) + '</h3></div>';
    html += '<button class="icon-btn sv-close" id="sv-close-btn" aria-label="close" title="' + escHtml(t('scClose')) + '">' + ICONS.x + '</button>';
    html += '</div>';
    // Save-current-view form
    html += '<div class="sv-save-form" id="sv-save-form-wrap">';
    html += '<button class="sv-save-trigger" id="sv-save-trigger"><span class="sv-save-trigger-icon">' + ICONS.bookmarkPlus + '</span><span>' + escHtml(t('saveCurrentView')) + '</span><span class="sv-save-trigger-meta">' + escHtml(savedViewSectionLabel(state.section)) + ' · ' + digits(state.period, state.lang) + (state.lang === 'fa' ? 'ر' : 'd') + '</span></button>';
    html += '</div>';
    // List
    html += '<div class="sv-list-wrap scrollbar-custom">';
    if (!state.savedViews.length) {
      html += '<div class="sv-empty"><span class="sv-empty-icon">' + ICONS.bookmark + '</span><p>' + escHtml(t('noSavedViews')) + '</p></div>';
    } else {
      html += '<ul class="sv-list">';
      state.savedViews.forEach(function (v) {
        html += '<li class="sv-item" data-sv-id="' + escHtml(v.id) + '">';
        html += '<span class="sv-item-icon">' + ICONS.star + '</span>';
        html += '<div class="sv-item-body"><p class="sv-item-name">' + escHtml(v.name) + '</p>';
        html += '<div class="sv-item-meta"><span>' + escHtml(savedViewSectionLabel(v.section)) + '</span><span>·</span><span class="sv-item-clock">' + ICONS.clock + '</span><span>' + digits(v.period, state.lang) + (state.lang === 'fa' ? 'ر' : 'd') + '</span><span>·</span><span>' + escHtml(savedViewRelativeTime(v.createdAt)) + '</span></div>';
        html += '</div>';
        html += '<button class="sv-load-btn" data-sv-action="load" title="' + escHtml(t('loadView')) + '">' + ICONS.play + '</button>';
        html += '<button class="sv-del-btn" data-sv-action="delete" title="' + escHtml(t('deleteView')) + '">' + ICONS.trash2 + '</button>';
        html += '</li>';
      });
      html += '</ul>';
    }
    html += '</div>';
    // Footer
    html += '<div class="sv-footer">' + escHtml(t('savedViewsDesc')) + '</div>';
    return html;
  }
  function savedViewSectionLabel(sec) {
    var map = {
      overview: { fa: 'نمای کلی', en: 'Overview' },
      channels: { fa: 'کانال‌ها', en: 'Channels' },
      agents: { fa: 'پاسخگویان', en: 'Agents' },
      roles: { fa: 'نقش‌ها', en: 'Roles' },
      responseTime: { fa: 'زمان پاسخ', en: 'Response Time' },
      sla: { fa: 'SLA', en: 'SLA' },
      heatmap: { fa: 'نقشه فعالیت', en: 'Heatmap' },
      wordcloud: { fa: 'ابر واژگان', en: 'Word Cloud' },
      trends: { fa: 'روند تیکت‌ها', en: 'Trends' },
      organizations: { fa: 'سازمان‌ها', en: 'Organizations' },
      tags: { fa: 'برچسب‌ها', en: 'Tags' },
      kb: { fa: 'پایگاه دانش', en: 'Knowledge Base' },
      tickets: { fa: 'تیکت‌ها', en: 'Tickets' },
    };
    var m = map[sec] || { fa: sec, en: sec };
    return state.lang === 'fa' ? m.fa : m.en;
  }
  function savedViewRelativeTime(ts) {
    if (!ts) return '';
    var diff = Date.now() - ts;
    var mins = Math.floor(diff / 60000);
    if (mins < 1) return state.lang === 'fa' ? 'همین حالا' : 'just now';
    if (mins < 60) return state.lang === 'fa' ? digits(mins, state.lang) + ' دقیقه پیش' : mins + 'm ago';
    var hrs = Math.floor(mins / 60);
    if (hrs < 24) return state.lang === 'fa' ? digits(hrs, state.lang) + ' ساعت پیش' : hrs + 'h ago';
    var days = Math.floor(hrs / 24);
    return state.lang === 'fa' ? digits(days, state.lang) + ' روز پیش' : days + 'd ago';
  }
  function positionSavedViewsPanel() {
    var panel = document.getElementById('saved-views-panel');
    var btn = document.getElementById('saved-views-btn');
    if (!panel || !btn) return;
    var rect = btn.getBoundingClientRect();
    var panelW = Math.min(window.innerWidth - 24, 340);
    panel.style.width = panelW + 'px';
    var left;
    if (state.lang === 'fa') left = rect.right - panelW; else left = rect.left;
    if (left < 12) left = 12;
    if (left + panelW > window.innerWidth - 12) left = window.innerWidth - panelW - 12;
    panel.style.left = left + 'px';
    panel.style.top = (rect.bottom + 8) + 'px';
  }
  function onSavedViewsOutsideClick(e) {
    var panel = document.getElementById('saved-views-panel');
    var btn = document.getElementById('saved-views-btn');
    if (panel && !panel.contains(e.target) && btn && !btn.contains(e.target)) closeSavedViewsPanel();
  }
  function onSavedViewsEsc(e) { if (e.key === 'Escape') closeSavedViewsPanel(); }
  function closeSavedViewsPanel() {
    state.savedViewsOpen = false;
    var panel = document.getElementById('saved-views-panel');
    if (panel) panel.remove();
    var btn = document.getElementById('saved-views-btn');
    if (btn) btn.setAttribute('aria-expanded', 'false');
    document.removeEventListener('mousedown', onSavedViewsOutsideClick);
    document.removeEventListener('keydown', onSavedViewsEsc);
    window.removeEventListener('resize', positionSavedViewsPanel);
  }
  function wireSavedViewsHandlers() {
    var panel = document.getElementById('saved-views-panel');
    if (!panel) return;
    var closeBtn = document.getElementById('sv-close-btn');
    if (closeBtn) closeBtn.addEventListener('click', closeSavedViewsPanel);
    var trigger = document.getElementById('sv-save-trigger');
    if (trigger) trigger.addEventListener('click', function () { showSavedViewSaveForm(); });
    // Load/delete buttons
    var items = panel.querySelectorAll('.sv-item');
    Array.prototype.forEach.call(items, function (it) {
      var id = it.getAttribute('data-sv-id');
      var loadBtn = it.querySelector('[data-sv-action="load"]');
      var delBtn = it.querySelector('[data-sv-action="delete"]');
      if (loadBtn) loadBtn.addEventListener('click', function (e) { e.stopPropagation(); loadSavedView(id); });
      if (delBtn) delBtn.addEventListener('click', function (e) { e.stopPropagation(); deleteSavedView(id); });
    });
  }
  function showSavedViewSaveForm() {
    var wrap = document.getElementById('sv-save-form-wrap');
    if (!wrap) return;
    wrap.innerHTML = '';
    var input = el('input', {
      type: 'text', class: 'sv-name-input', id: 'sv-name-input',
      placeholder: t('viewNamePlaceholder'),
      style: 'width:100%;padding:8px 10px;border:1px solid var(--border);border-radius:6px;background:var(--card);color:var(--fg);font-family:inherit;font-size:13px;outline:none;',
    });
    input.addEventListener('keydown', function (e) {
      if (e.key === 'Enter') { e.preventDefault(); saveCurrentView(input.value); }
      else if (e.key === 'Escape') { closeSavedViewsPanel(); }
    });
    wrap.appendChild(input);
    var actions = el('div', { style: 'display:flex;justify-content:flex-end;gap:6px;margin-top:8px;' }, [
      el('button', { class: 'btn', style: 'height:28px;padding:0 10px;font-size:12px;', onclick: function () { closeSavedViewsPanel(); } }, t('settingsCancel')),
      el('button', { class: 'btn btn-primary', style: 'height:28px;padding:0 10px;font-size:12px;', onclick: function () { saveCurrentView(input.value); } }, [ICONS.bookmarkPlus, t('settingsSave')]),
    ]);
    wrap.appendChild(actions);
    input.focus();
  }
  function saveCurrentView(name) {
    name = (name || '').trim();
    if (!name) return;
    var view = {
      id: 'view-' + Date.now(),
      name: name,
      section: state.section,
      period: state.period,
      createdAt: Date.now(),
    };
    state.savedViews = [view].concat(state.savedViews);
    persistSavedViews();
    updateSavedViewsBadge();
    // Refresh panel list
    var panel = document.getElementById('saved-views-panel');
    if (panel) { panel.innerHTML = savedViewsPanelHtml(); wireSavedViewsHandlers(); positionSavedViewsPanel(); }
  }
  function loadSavedView(id) {
    var v = null;
    for (var i = 0; i < state.savedViews.length; i++) {
      if (state.savedViews[i].id === id) { v = state.savedViews[i]; break; }
    }
    if (!v) return;
    state.period = v.period;
    state.customRange = null;
    closeSavedViewsPanel();
    navigate(v.section);
  }
  function deleteSavedView(id) {
    state.savedViews = state.savedViews.filter(function (v) { return v.id !== id; });
    persistSavedViews();
    updateSavedViewsBadge();
    var panel = document.getElementById('saved-views-panel');
    if (panel) { panel.innerHTML = savedViewsPanelHtml(); wireSavedViewsHandlers(); positionSavedViewsPanel(); }
  }

  function renderOverviewCharts(c, d) {
    // 2-col row: live activity feed (left, 2fr) + recent tickets (right, 3fr)
    var feedRow = el('div', { class: 'grid', style: 'grid-template-columns: 2fr 3fr; margin-top:16px; gap:16px;' });
    feedRow.appendChild(renderActivityFeedCard());
    var rtWrap = el('div', { class: 'card' }, [el('div', { class: 'card-head' }, [el('div', { class: 'card-title' }, t('navTickets'))]), el('div', { class: 'card-body', id: 'recent-tickets', style: 'padding:0;' }, '<div class="skeleton" style="height:200px"></div>')]);
    feedRow.appendChild(rtWrap);
    c.appendChild(feedRow);

    // by state pie + priority bar + top groups (grid-3)
    // FIX: wrap each canvas in a .chart-wrap div with fixed height so Chart.js
    // v4 (maintainAspectRatio:false) always has a rendering surface. Without
    // this, the canvas can collapse to 0 height when the parent's height is
    // content-driven, making the chart invisible ("charts not loading" bug).
    var row = el('div', { class: 'grid grid-3', style: 'margin-top:16px;' });
    row.appendChild(el('div', { class: 'card glass-card' }, [el('div', { class: 'card-head' }, [el('div', { class: 'card-title' }, t('ticketsByState'))]), el('div', { class: 'card-body' }, [el('div', { class: 'chart-wrap' }, [el('canvas', { id: 'chart-state' })])])]));
    row.appendChild(el('div', { class: 'card glass-card' }, [el('div', { class: 'card-head' }, [el('div', { class: 'card-title' }, t('ticketsByPriority'))]), el('div', { class: 'card-body' }, [el('div', { class: 'chart-wrap' }, [el('canvas', { id: 'chart-priority' })])])]));
    row.appendChild(el('div', { class: 'card glass-card' }, [el('div', { class: 'card-head' }, [el('div', { class: 'card-title' }, t('topGroups'))]), el('div', { class: 'card-body', id: 'top-groups' }, '<div class="skeleton" style="height:160px"></div>')]));
    c.appendChild(row);

    setTimeout(function () {
      // state pie — show real open/closed/pending data.
      // If all values are 0, show a "no data" placeholder inside the chart-wrap.
      var stateData = [d.open || 0, d.closed || 0, d.pending || 0];
      var stateAllZero = stateData.every(function (v) { return v === 0; });
      var sctx = document.getElementById('chart-state');
      if (sctx) {
        if (stateAllZero) {
          // Render an empty doughnut with a "no data" overlay
          charts.state = new Chart(sctx, {
            type: 'doughnut',
            data: { labels: [t('stateOpen'), t('stateClosed'), t('statePending')], datasets: [{ data: [1], backgroundColor: [getCss('--muted')], borderWidth: 2, borderColor: getCss('--card') }] },
            options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { position: 'bottom', labels: { font: { size: 11 }, color: getCss('--muted-fg') } } }, cutout: '65%' }
          });
          var sw = sctx.parentElement;
          if (sw) {
            var soverlay = document.createElement('div');
            soverlay.style.cssText = 'position:absolute;top:50%;left:50%;transform:translate(-50%,-50%);font-size:12px;color:var(--muted-fg);text-align:center;pointer-events:none;';
            soverlay.textContent = t('noData');
            sw.appendChild(soverlay);
          }
        } else {
          charts.state = new Chart(sctx, {
            type: 'doughnut',
            data: { labels: [t('stateOpen'), t('stateClosed'), t('statePending')], datasets: [{ data: stateData, backgroundColor: ['#d97706', '#16a34a', '#9333ea'], borderWidth: 2, borderColor: getCss('--card') }] },
            options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { position: 'bottom', labels: { font: { size: 11 } } }, tooltip: { callbacks: { label: function (ctx) { return ctx.label + ': ' + toFa(formatNum(ctx.raw, state.lang)); } } } }, cutout: '55%' }
          });
        }
      }
      // priority bar — use REAL priority distribution from the API (d.priority)
      // instead of hardcoded 20/50/22/8 percent estimates. Falls back to the
      // estimate only if the API didn't return priority data.
      var pri = d.priority || {};
      var priData = [
        pri.low || 0,
        pri.normal || 0,
        pri.high || 0,
        pri.urgent || 0
      ];
      var priSum = priData.reduce(function (a, b) { return a + b; }, 0);
      if (priSum === 0 && d.total > 0) {
        // Fallback to estimates if no real priority data
        priData = [Math.round(d.total * 0.2), Math.round(d.total * 0.5), Math.round(d.total * 0.22), Math.round(d.total * 0.08)];
      }
      var pctx = document.getElementById('chart-priority');
      if (pctx) charts.priority = new Chart(pctx, {
        type: 'bar',
        data: { labels: [t('priorityLow'), t('priorityNormal'), t('priorityHigh'), t('priorityUrgent')], datasets: [{ data: priData, backgroundColor: ['#0891b2', '#7c3aed', '#d97706', '#dc2626'], borderRadius: 6, maxBarThickness: 60 }] },
        options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false }, tooltip: { callbacks: { label: function (ctx) { return toFa(formatNum(ctx.raw, state.lang)) + ' ' + (state.lang === 'fa' ? 'تیکت' : 'tickets'); } } } }, scales: { y: { beginAtZero: true, grid: { color: getCss('--border') }, ticks: { callback: function (v) { return toFa(formatNum(v, state.lang)); } } }, x: { grid: { display: false } } } }
      });
    }, 50);

    // top groups — fetch from the dedicated topGroups endpoint (group.name.keyword aggregation)
    api('topGroups', { period: state.period }).then(function (groups) {
      var tg = document.getElementById('top-groups');
      if (tg) {
        if (!groups || !groups.length) {
          tg.innerHTML = '<div class="empty" style="padding:24px;text-align:center;">' + t('noData') + '</div>';
          return;
        }
        var max = groups[0] ? groups[0].ticketCount : 1;
        tg.innerHTML = groups.slice(0, 6).map(function (g, i) {
          var pct = Math.round((g.ticketCount / max) * 100);
          var openPct = g.ticketCount > 0 ? Math.round((g.openCount / g.ticketCount) * 100) : 0;
          return '<div style="display:flex;align-items:center;gap:12px;margin-bottom:10px;">' +
            '<span style="font-size:12px;font-weight:700;color:var(--muted-fg);width:20px;flex-shrink:0;">' + toFa(i + 1) + '</span>' +
            '<div style="flex:1;min-width:0;">' +
              '<div style="display:flex;justify-content:space-between;font-size:13px;gap:8px;">' +
                '<span style="overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-weight:500;">' + escHtml(g.nameFa) + '</span>' +
                '<span style="color:var(--muted-fg);flex-shrink:0;">' + toFa(formatNum(g.ticketCount, state.lang)) + '</span>' +
              '</div>' +
              '<div class="progress progress-animated" style="margin-top:4px"><div class="progress-fill" style="width:' + pct + '%"></div></div>' +
              (g.openCount > 0 ? '<div style="font-size:10px;color:var(--muted-fg);margin-top:2px;">' + toFa(formatNum(g.openCount, state.lang)) + ' ' + (state.lang === 'fa' ? 'باز' : 'open') + ' · ' + toFa(openPct) + pctSign() + '</div>' : '') +
            '</div>' +
          '</div>';
        }).join('');
      }
    }).catch(function () {
      var tg = document.getElementById('top-groups');
      if (tg) tg.innerHTML = '<div class="empty" style="padding:24px;text-align:center;">' + t('noData') + '</div>';
    });

    api('tickets', { limit: 6 }).then(function (res) {
      var rt2 = document.getElementById('recent-tickets');
      if (!rt2) return;
      if (!res.tickets || !res.tickets.length) { rt2.innerHTML = '<div class="empty">' + t('noData') + '</div>'; return; }
      rt2.innerHTML = '<div class="table-wrap"><table><thead><tr><th>#</th><th>' + t('ticketTitle') + '</th><th>' + t('ticketState') + '</th><th>' + t('ticketPriority') + '</th><th>' + t('ticketChannel') + '</th><th>' + t('ticketCreated') + '</th></tr></thead><tbody>' + res.tickets.map(function (tk) {
        return '<tr><td class="mono">' + toFa(tk.number) + '</td><td class="truncate">' + escHtml(tk.titleFa) + '</td><td>' + stateBadge(tk.state) + '</td><td>' + priorityBadge(tk.priority) + '</td><td>' + channelBadge(tk.channel) + '</td><td class="mono">' + toFa(tk.createdAt ? tk.createdAt.slice(0, 10) : '') + '</td></tr>';
      }).join('') + '</tbody></table></div>';
    }).catch(function () {});
  }

  // ---- Live Activity Feed (Overview) ----
  function renderActivityFeedCard() {
    var card = el('div', { class: 'card', style: 'overflow:hidden;display:flex;flex-direction:column;' });
    var head = el('div', { class: 'card-head', style: 'padding:12px 16px;' }, [
      el('div', { style: 'display:flex;align-items:center;gap:8px;' }, [
        el('span', { class: 'live-badge-glow', style: 'width:8px;height:8px;border-radius:50%;background:#dc2626;display:inline-block;flex-shrink:0;' }),
        el('div', { class: 'card-title' }, t('liveActivity')),
      ]),
      el('span', { class: 'badge badge-rose live-badge-glow', style: 'font-size:10px;font-weight:700;letter-spacing:0.05em;text-transform:uppercase;display:inline-flex;align-items:center;gap:4px;' }, [ICONS.radio, t('live')]),
    ]);
    var body = el('div', { class: 'card-body', id: 'activity-feed', style: 'padding:0;max-height:26rem;overflow-y:auto;flex:1;' }, '<div class="skeleton" style="height:200px"></div>');
    card.appendChild(head);
    card.appendChild(body);
    fetchActivity();
    return card;
  }
  function fetchActivity() {
    if (state._activityInterval) { clearInterval(state._activityInterval); state._activityInterval = null; }
    state._activityTick = state._activityTick || 0;
    function load() {
      if (state.section !== 'overview') {
        if (state._activityInterval) { clearInterval(state._activityInterval); state._activityInterval = null; }
        return;
      }
      api('activity', { limit: 8, tick: state._activityTick }).then(function (events) {
        renderActivityEvents(events);
      }).catch(function () {});
      state._activityTick++;
    }
    load();
    state._activityInterval = setInterval(load, 8000);
  }
  function renderActivityEvents(events) {
    var root = document.getElementById('activity-feed');
    if (!root) return;
    if (!events || !events.length) { root.innerHTML = '<div class="empty" style="padding:32px;">' + t('noActivity') + '</div>'; return; }
    var meta = {
      created: { icon: ICONS.plus, key: 'evtCreated', cls: 'rgba(124,58,237,0.12);color:var(--primary)' },
      assigned: { icon: ICONS.userCheck, key: 'evtAssigned', cls: 'rgba(8,145,178,0.12);color:#0891b2' },
      replied: { icon: ICONS.messageSquare, key: 'evtReplied', cls: 'rgba(147,51,234,0.12);color:#9333ea' },
      closed: { icon: ICONS.checkCircle, key: 'evtClosed', cls: 'rgba(22,163,74,0.12);color:#16a34a' },
      escalated: { icon: ICONS.alertTriangle, key: 'evtEscalated', cls: 'rgba(220,38,38,0.12);color:#dc2626' },
      reopened: { icon: ICONS.rotateCcw, key: 'evtReopened', cls: 'rgba(217,119,6,0.12);color:#d97706' },
      merged: { icon: ICONS.gitMerge, key: 'evtMerged', cls: 'rgba(100,116,139,0.12);color:#64748b' },
    };
    var now = new Date();
    root.innerHTML = '<ul class="activity-feed-list">' + events.map(function (evt) {
      var m = meta[evt.type] || meta.created;
      var agent = state.lang === 'fa' ? (evt.agentNameFa || evt.agentName) : (evt.agentName || evt.agentNameFa);
      var title = evt.titleFa || evt.title || '';
      return '<li class="activity-item" style="display:flex;align-items:flex-start;gap:12px;padding:12px 16px;border-bottom:1px solid var(--border);">' +
        '<div style="width:28px;height:28px;border-radius:50%;display:flex;align-items:center;justify-content:center;flex-shrink:0;background:' + m.cls + '">' + m.icon + '</div>' +
        '<div style="flex:1;min-width:0;">' +
          '<div style="font-size:13px;line-height:1.5;">' +
            '<span style="font-weight:600;color:' + (evt.agentColor || 'var(--primary)') + ';">' + escHtml(agent) + '</span>' +
            '<span style="color:var(--muted-fg);"> · ' + t(m.key) + '</span>' +
          '</div>' +
          '<div style="margin-top:2px;font-size:12px;color:var(--muted-fg);overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">' +
            '<span style="font-family:monospace;">' + toFa(evt.ticketNumber) + '</span> — ' +
            '<span style="color:var(--fg);opacity:0.85;">' + escHtml(title) + '</span>' +
          '</div>' +
        '</div>' +
        '<div style="font-size:10px;color:var(--muted-fg);white-space:nowrap;flex-shrink:0;">' + formatRelativeTime(evt.at, state.lang, now) + '</div>' +
      '</li>';
    }).join('') + '</ul>';
  }

  function renderChannels(c) {
    c.innerHTML = '';
    c.appendChild(sectionHead(t('navChannels'), t('channelDistribution') + ' · ' + t('channelTrend'), [periodSelector()]));
    var note = el('div', { class: 'card', style: 'margin-bottom:16px;' }, [el('div', { class: 'card-body', style: 'font-size:13px;color:var(--muted-fg);display:flex;align-items:center;gap:8px;' }, [el('span', { style: 'flex-shrink:0;' }, state.lang === 'fa' ? 'ℹ️' : 'ℹ️'), el('span', {}, t('channelsNote'))])]);
    c.appendChild(note);
    var grid = el('div', { class: 'grid grid-4', id: 'ch-cards-grid' });
    grid.innerHTML = '<div class="skeleton" style="height:80px"></div>'.repeat(4);
    c.appendChild(grid);
    // FIX: wrap canvases in .chart-wrap (fixed height) so Chart.js v4 always
    // has a rendering surface. The old code put the canvas directly in
    // .card-body, which collapses when maintainAspectRatio:false removes the
    // canvas from the content flow.
    var row = el('div', { class: 'grid grid-2', style: 'margin-top:16px;' }, [
      el('div', { class: 'card' }, [el('div', { class: 'card-head' }, [el('div', { class: 'card-title' }, t('channelDistribution'))]), el('div', { class: 'card-body' }, [el('div', { class: 'chart-wrap chart-wrap-md' }, [el('canvas', { id: 'chart-ch-dist' })])])]),
      el('div', { class: 'card' }, [el('div', { class: 'card-head' }, [el('div', { class: 'card-title' }, t('channelTrend'))]), el('div', { class: 'card-body' }, [el('div', { class: 'chart-wrap chart-wrap-md', id: 'ch-trend-wrap' }, [el('canvas', { id: 'chart-ch-trend' })])])]),
    ]);
    c.appendChild(row);
    api('channels', { period: state.period }).then(function (d) {
      state.data.channels = d;
      var discovered = d.discovered || [];
      var channelColors = { email: '#7c3aed', chat: '#d97706', phone: '#9333ea', web: '#0891b2', sms: '#dc2626', facebook: '#1877f2', telegram: '#0088cc', whatsapp: '#25d366' };
      var extraColors = ['#16a34a', '#9333ea', '#0891b2', '#d97706', '#dc2626', '#7c3aed', '#ca8a04', '#7c3aed'];
      var channelsToShow;
      if (discovered.length > 0) {
        channelsToShow = discovered.slice(0, 8);
      } else {
        channelsToShow = ['email', 'chat', 'phone', 'web'].map(function (ch) {
          return { name: ch, count: d.dist[ch] || 0 };
        });
      }
      var colorIdx = 0;
      var grid2 = document.getElementById('ch-cards-grid');
      if (grid2) {
        grid2.innerHTML = channelsToShow.map(function (ch) {
          var name = ch.name;
          var color = channelColors[name] || extraColors[(colorIdx++) % extraColors.length];
          var label = channelLabel(name);
          return '<div class="card card-hover"><div class="card-body" style="display:flex;align-items:center;gap:12px;"><div class="kpi-icon" style="background:' + color + '20;color:' + color + '">' + ICONS.channels + '</div><div><div class="kpi-label">' + escHtml(label) + '</div><div class="kpi-value">' + formatNum(ch.count, state.lang) + '</div></div></div></div>';
        }).join('');
      }
      setTimeout(function () {
        var ctx1 = document.getElementById('chart-ch-dist');
        if (ctx1) {
          var distData = channelsToShow.map(function (ch) { return ch.count; });
          var distAllZero = distData.every(function (v) { return v === 0; });
          if (distAllZero) {
            // Show empty pie with "no data" overlay
            charts.chDist = new Chart(ctx1, {
              type: 'pie',
              data: { labels: channelsToShow.map(function (ch) { return channelLabel(ch.name); }), datasets: [{ data: [1], backgroundColor: [getCss('--muted')], borderWidth: 2, borderColor: getCss('--card') }] },
              options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { position: 'bottom', labels: { font: { size: 11 }, color: getCss('--muted-fg') } } } }
            });
            var dw = ctx1.parentElement;
            if (dw) {
              var doverlay = document.createElement('div');
              doverlay.style.cssText = 'position:absolute;top:40%;left:50%;transform:translate(-50%,-50%);font-size:12px;color:var(--muted-fg);text-align:center;pointer-events:none;';
              doverlay.textContent = t('noData');
              dw.appendChild(doverlay);
            }
          } else {
            charts.chDist = new Chart(ctx1, {
              type: 'pie',
              data: { labels: channelsToShow.map(function (ch) { return channelLabel(ch.name); }), datasets: [{ data: distData, backgroundColor: channelsToShow.map(function (ch, i) { return channelColors[ch.name] || extraColors[i % extraColors.length]; }), borderWidth: 2, borderColor: getCss('--card') }] },
              options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { position: 'bottom', labels: { font: { size: 11 } } }, tooltip: { callbacks: { label: function (ctx) { return ctx.label + ': ' + toFa(formatNum(ctx.raw, state.lang)); } } } } }
            });
          }
        }
        // Trend: use channel_keys from the API response (or derive from the first trend row)
        var trendKeys = (d.channel_keys && d.channel_keys.length > 0) ? d.channel_keys : (d.trend && d.trend[0] ? Object.keys(d.trend[0]).filter(function (k) { return k !== 'date'; }) : []);
        if (trendKeys.length === 0) trendKeys = ['email', 'chat', 'phone', 'web'];

        // FIX: handle empty trend data gracefully. The old code would render a
        // line chart with empty labels/data arrays, which Chart.js draws as a
        // blank chart with just axes — appearing "not loaded". Now we show a
        // clear "no data" message instead.
        var trendWrap = document.getElementById('ch-trend-wrap');
        var ctx2 = document.getElementById('chart-ch-trend');
        if (!d.trend || d.trend.length === 0) {
          if (trendWrap) {
            trendWrap.innerHTML = '<div style="position:absolute;top:50%;left:50%;transform:translate(-50%,-50%);font-size:13px;color:var(--muted-fg);text-align:center;">' +
              '<div style="font-size:32px;margin-bottom:8px;opacity:0.4;">' + ICONS.trends + '</div>' +
              '<p style="font-weight:600;margin:0 0 4px;">' + (state.lang === 'fa' ? 'داده روند در دسترس نیست' : 'No trend data available') + '</p>' +
              '<p style="font-size:11px;margin:0;">' + (state.lang === 'fa' ? 'هنوز هیچ تیکتی در این بازه ثبت نشده است.' : 'No tickets have been created in this period yet.') + '</p>' +
            '</div>';
          }
        } else {
          // Check if ALL trend values are 0 across all channels
          var allTrendZero = true;
          for (var ti = 0; ti < d.trend.length && allTrendZero; ti++) {
            for (var tk = 0; tk < trendKeys.length; tk++) {
              if ((d.trend[ti][trendKeys[tk]] || 0) > 0) { allTrendZero = false; break; }
            }
          }
          if (allTrendZero && trendWrap) {
            trendWrap.innerHTML = '<div style="position:absolute;top:50%;left:50%;transform:translate(-50%,-50%);font-size:13px;color:var(--muted-fg);text-align:center;">' +
              '<div style="font-size:32px;margin-bottom:8px;opacity:0.4;">' + ICONS.trends + '</div>' +
              '<p style="font-weight:600;margin:0 0 4px;">' + (state.lang === 'fa' ? 'روند کانال‌ها صفر است' : 'Channel trends are all zero') + '</p>' +
              '<p style="font-size:11px;margin:0;">' + (state.lang === 'fa' ? 'در این بازه زمانی تیکتی برای این کانال‌ها ثبت نشده است.' : 'No tickets for these channels in this period.') + '</p>' +
            '</div>';
          } else if (ctx2) {
            charts.chTrend = new Chart(ctx2, {
              type: 'line',
              data: { labels: d.trend.map(function (r) { return dateLabel(r.date, state.lang); }), datasets: trendKeys.map(function (ch, i) {
                var color = channelColors[ch] || extraColors[i % extraColors.length];
                var label = channelFaMap[ch] || ch;
                return { label: label, data: d.trend.map(function (r) { return r[ch] || 0; }), borderColor: color, backgroundColor: color + '20', tension: 0.3, borderWidth: 2, pointRadius: 0, fill: false };
              }) },
              options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { position: 'bottom', labels: { font: { size: 11 } } }, tooltip: { mode: 'index', intersect: false } }, scales: { y: { beginAtZero: true, grid: { color: getCss('--border') }, ticks: { callback: function (v) { return toFa(formatNum(v, state.lang)); } } }, x: { grid: { display: false } } } }
            });
          }
        }
      }, 50);
    }).catch(function (e) { c.appendChild(el('div', { class: 'empty' }, e.message)); });
  }

  function renderAgents(c) {
    c.innerHTML = '';
    c.appendChild(sectionHead(t('navAgents'), t('agentPerformance'), [periodSelector()]));
    c.appendChild(el('div', { class: 'grid grid-3', id: 'podium', style: 'margin-bottom:16px;' }, '<div class="skeleton" style="height:100px"></div>'.repeat(3)));
    c.appendChild(el('div', { class: 'card', style: 'margin-bottom:16px;' }, [el('div', { class: 'card-head' }, [el('div', { class: 'card-title' }, t('topAgents'))]), el('div', { class: 'card-body' }, [el('canvas', { id: 'chart-agents', height: 300 })])]));
    c.appendChild(el('div', { class: 'card' }, [el('div', { class: 'card-head', id: 'agents-head' }, [el('div', { class: 'card-title' }, t('agentPerformance'))]), el('div', { class: 'card-body', id: 'agents-table', style: 'padding:0;' }, '<div class="skeleton" style="height:300px"></div>')]));
    api('agents', { period: state.period }).then(function (agents) {
      state.data.agents = agents;
      // podium (clickable → opens agent sheet)
      var medals = ['#d4af37', '#a8a8a8', '#cd7f32'];
      var podium = document.getElementById('podium');
      podium.innerHTML = agents.slice(0, 3).map(function (a, i) {
        return '<div class="card card-hover podium-card fade-in" data-agent-id="' + a.id + '" data-clickable="true" style="cursor:pointer;"><div class="podium-bar" style="background:' + medals[i] + '"></div><div class="avatar" style="background:' + medals[i] + ';color:#fff;width:56px;height:56px;font-size:20px">' + (a.fullnameFa.charAt(0)) + '</div><div style="flex:1;min-width:0"><div style="display:flex;align-items:center;gap:6px"><span style="color:' + medals[i] + '">' + ICONS.trophy + '</span><span style="font-weight:700;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">' + a.fullnameFa + '</span></div><div style="font-size:12px;color:var(--muted-fg)">' + (a.role === 'admin' ? t('roles') : t('navAgents')) + '</div><div style="margin-top:6px;display:flex;gap:12px;font-size:13px"><span class="kpi-value" style="font-size:16px">' + toFa(formatNum(a.ticketsHandled, state.lang)) + '</span><span style="color:var(--muted-fg);align-self:center">' + t('tickets') + '</span><span style="color:#16a34a">·</span><span class="kpi-value" style="font-size:16px;color:#16a34a">' + toFa(a.csat) + pctSign() + '</span></div></div></div>';
      }).join('');
      attachAgentClickHandlers(podium);
      // chart
      setTimeout(function () {
        var ctx = document.getElementById('chart-agents');
        if (ctx) charts.agents = new Chart(ctx, {
          type: 'bar',
          data: { labels: agents.map(function (a) { return a.fullnameFa; }), datasets: [
            { label: t('ticketsHandled'), data: agents.map(function (a) { return a.ticketsHandled; }), backgroundColor: '#7c3aed', borderRadius: 4 },
            { label: t('resolved'), data: agents.map(function (a) { return a.resolved; }), backgroundColor: '#16a34a', borderRadius: 4 },
          ] },
          options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { position: 'bottom', labels: { font: { size: 11 } } } }, scales: { y: { beginAtZero: true, grid: { color: getCss('--border') } }, x: { grid: { display: false }, ticks: { font: { size: 10 }, maxRotation: 45, minRotation: 45 } } } }
        });
      }, 50);
      // table
      var rows = agents.map(function (a) {
        var rr = a.ticketsHandled ? Math.round((a.resolved / a.ticketsHandled) * 100) : 0;
        return { name: a.fullnameFa, role: a.role === 'admin' ? t('roles') : t('navAgents'), ticketsHandled: a.ticketsHandled, resolved: a.resolved, resolveRate: rr, avgResponse: formatDuration(a.avgResponseMin, state.lang), avgResolution: formatDuration(a.avgResolutionMin, state.lang), csat: a.csat };
      });
      var headers = [
        { key: 'name', label: t('agentName') }, { key: 'ticketsHandled', label: t('ticketsHandled') },
        { key: 'resolved', label: t('resolved') }, { key: 'resolveRate', label: t('resolveRate') + ' ' + pctSign() },
        { key: 'avgResponse', label: t('avgFirstResponse') }, { key: 'avgResolution', label: t('resolutionTime') }, { key: 'csat', label: t('satisfaction') + ' ' + pctSign() },
      ];
      var head = document.getElementById('agents-head');
      head.appendChild(exportMenu('agents', rows, headers, 'agents-performance', t('agentPerformance')));
      var tbl = document.getElementById('agents-table');
      tbl.innerHTML = '<div class="table-wrap"><table><thead><tr>' + headers.map(function (h) { return '<th>' + h.label + '</th>'; }).join('') + '<th></th></tr></thead><tbody>' + agents.map(function (a) {
        var rr = a.ticketsHandled ? Math.round((a.resolved / a.ticketsHandled) * 100) : 0;
        var chev = state.lang === 'fa' ? ICONS.chevronLeft : ICONS.chevronRight;
        return '<tr data-agent-id="' + a.id + '" data-clickable="true"><td style="font-weight:500">' + a.fullnameFa + '</td><td>' + toFa(formatNum(a.ticketsHandled, state.lang)) + '</td><td>' + toFa(formatNum(a.resolved, state.lang)) + '</td><td><div style="display:flex;align-items:center;gap:8px"><div class="progress progress-animated" style="width:60px"><div class="progress-fill" style="width:' + rr + '%;background:#16a34a"></div></div><span style="font-size:12px">' + toFa(rr) + pctSign() + '</span></div></td><td style="color:var(--muted-fg)">' + formatDuration(a.avgResponseMin, state.lang) + '</td><td style="color:var(--muted-fg)">' + formatDuration(a.avgResolutionMin, state.lang) + '</td><td style="color:#16a34a;font-weight:500">' + toFa(a.csat) + pctSign() + '</td><td style="color:var(--muted-fg)">' + chev + '</td></tr>';
      }).join('') + '</tbody></table></div>';
      attachAgentClickHandlers(tbl);
    }).catch(function (e) { setHTML('agents-table', '<div class="empty">' + e.message + '</div>'); });
  }

  function attachAgentClickHandlers(root) {
    if (!root) return;
    var nodes = root.querySelectorAll('[data-agent-id]');
    Array.prototype.forEach.call(nodes, function (n) {
      n.addEventListener('click', function () {
        var id = parseInt(n.getAttribute('data-agent-id'), 10);
        if (id) openAgentSheet(id);
      });
    });
  }

  // ---- Agent drill-down sheet ----
  function openAgentSheet(agentId) {
    closeAgentSheet();
    var dir = state.lang === 'fa' ? 'rtl' : 'ltr';
    var side = dir === 'rtl' ? 'left' : 'right';
    var overlay = el('div', { id: 'agent-sheet-overlay', style: 'position:fixed;inset:0;z-index:90;background:rgba(0,0,0,0.5);display:flex;' + (side === 'right' ? 'justify-content:flex-end' : 'justify-content:flex-start') + ';' });
    var sheet = el('div', { id: 'agent-sheet', 'data-side': side, style: 'width:100%;max-width:640px;height:100vh;background:var(--card);color:var(--card-fg);box-shadow:var(--shadow-lg);display:flex;flex-direction:column;overflow:hidden;' });
    // header (with loading skeleton)
    var head = el('div', { id: 'agent-sheet-head', class: 'bg-gradient-to-br', style: 'padding:18px 20px;border-bottom:1px solid var(--border);display:flex;align-items:center;gap:14px;' }, [
      el('div', { class: 'skeleton', style: 'width:56px;height:56px;border-radius:50%;' }),
      el('div', { style: 'flex:1;' }, [el('div', { class: 'skeleton', style: 'height:16px;width:60%;margin-bottom:6px;' }), el('div', { class: 'skeleton', style: 'height:12px;width:40%;' })]),
      el('button', { class: 'icon-btn no-print', onclick: closeAgentSheet, title: t('cancel') }, ICONS.x),
    ]);
    sheet.appendChild(head);
    // body
    var body = el('div', { id: 'agent-sheet-body', style: 'flex:1;min-height:0;overflow-y:auto;padding:20px;' }, '<div class="skeleton" style="height:300px"></div>');
    sheet.appendChild(body);
    overlay.appendChild(sheet);
    overlay.addEventListener('click', function (e) { if (e.target === overlay) closeAgentSheet(); });
    document.body.appendChild(overlay);
    document.addEventListener('keydown', agentSheetEsc);
    // fetch
    api('agentDetail', { id: agentId, period: state.period }).then(function (d) {
      renderAgentSheetContent(d);
    }).catch(function (e) {
      var b = document.getElementById('agent-sheet-body');
      if (b) b.innerHTML = '<div class="empty">' + (e.message || t('noData')) + '</div>';
    });
  }
  function agentSheetEsc(e) { if (e.key === 'Escape') closeAgentSheet(); }
  function closeAgentSheet() {
    var ov = document.getElementById('agent-sheet-overlay');
    if (ov) ov.remove();
    document.removeEventListener('keydown', agentSheetEsc);
  }
  function renderAgentSheetContent(d) {
    if (!d || !d.agent) return;
    var head = document.getElementById('agent-sheet-head');
    if (!head) return;
    var a = d.agent;
    var name = state.lang === 'fa' ? (a.fullnameFa || a.fullname) : (a.fullname || a.fullnameFa);
    var roleLabel = a.role === 'admin' ? t('roles') : t('navAgents');
    head.innerHTML = '';
    head.appendChild(el('div', { class: 'avatar', style: 'background:' + (a.avatarColor || 'var(--primary)') + ';color:#fff;width:56px;height:56px;font-size:20px;flex-shrink:0;' }, escHtml((name || '?').charAt(0))));
    head.appendChild(el('div', { style: 'flex:1;min-width:0;' }, [
      el('div', { style: 'font-size:16px;font-weight:700;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;' }, escHtml(name || '')),
      el('div', { style: 'font-size:12px;color:var(--muted-fg);display:flex;align-items:center;gap:6px;margin-top:2px;' }, [el('span', {}, roleLabel), el('span', {}, '·'), el('span', { style: 'font-family:monospace;' }, escHtml(a.email || ('user' + a.id + '@example.com')))]),
    ]));
    head.appendChild(el('button', { class: 'icon-btn no-print', onclick: closeAgentSheet, title: t('cancel') }, ICONS.x));

    var body = document.getElementById('agent-sheet-body');
    if (!body) return;
    var k = d.kpis || {};
    var ch = d.byChannel || { email: 0, chat: 0, phone: 0, web: 0 };
    var html = '';
    // KPI tiles (2 cols x 3 rows)
    html += '<div style="display:grid;grid-template-columns:repeat(2,1fr);gap:10px;margin-bottom:14px;">';
    html += agentDrillKpi(ICONS.ticket, t('ticketsHandled'), formatNum(k.handled || 0, state.lang), 'primary');
    html += agentDrillKpi(ICONS.checkCircle, t('resolved'), formatNum(k.resolved || 0, state.lang), 'emerald');
    html += agentDrillKpi(ICONS.gauge, t('resolveRateLong'), toFa(k.resolveRate || 0) + pctSign(), 'emerald');
    html += agentDrillKpi(ICONS.clock, t('avgResponseLong'), formatDuration(k.avgResponse || 0, state.lang), 'cyan');
    html += agentDrillKpi(ICONS.gauge, t('avgResolutionLong'), formatDuration(k.avgResolution || 0, state.lang), 'violet');
    html += agentDrillKpi(ICONS.smile, t('csatLong'), toFa(k.csat || 0) + pctSign(), 'amber');
    html += '</div>';
    // Channel breakdown (4 cols)
    html += '<div style="font-size:11px;font-weight:600;color:var(--muted-fg);text-transform:uppercase;letter-spacing:0.05em;margin-bottom:6px;">' + t('channelDistribution') + '</div>';
    html += '<div style="display:grid;grid-template-columns:repeat(4,1fr);gap:8px;margin-bottom:14px;">';
    var chIcons = { email: ICONS.mail, chat: ICONS.messageSquare, phone: ICONS.phone, web: ICONS.globe };
    ['email', 'chat', 'phone', 'web'].forEach(function (c) {
      html += '<div style="border:1px solid var(--border);border-radius:8px;padding:8px;text-align:center;background:var(--card);">' +
        '<div style="margin:0 auto 4px;width:28px;height:28px;border-radius:50%;display:flex;align-items:center;justify-content:center;background:var(--muted);color:var(--muted-fg);">' + chIcons[c] + '</div>' +
        '<div class="stat-number" style="font-size:14px;font-weight:700;">' + toFa(formatNum(ch[c] || 0, state.lang)) + '</div>' +
        '<div style="font-size:10px;color:var(--muted-fg);">' + t('channel' + c.charAt(0).toUpperCase() + c.slice(1)) + '</div>' +
      '</div>';
    });
    html += '</div>';
    // Agent's tickets
    html += '<div style="display:flex;justify-content:space-between;align-items:center;padding:10px 0;border-top:1px solid var(--border);border-bottom:1px solid var(--border);background:var(--muted);padding-left:14px;padding-right:14px;">';
    html += '<span style="font-size:13px;font-weight:600;">' + t('agentTickets') + '</span>';
    if (k.escalated > 0) {
      html += '<span class="badge badge-rose" style="display:inline-flex;align-items:center;gap:4px;">' + ICONS.alertTriangle + ' ' + toFa(k.escalated) + ' ' + t('kpiEscalated') + '</span>';
    }
    html += '</div>';
    var tk = d.tickets || [];
    if (!tk.length) {
      html += '<div class="empty" style="padding:32px;">' + t('noTicketsForAgent') + '</div>';
    } else {
      html += '<div style="overflow:auto;max-height:50vh;"><table style="width:100%;font-size:12px;border-collapse:collapse;"><thead class="sticky-bg" style="position:sticky;top:0;background:var(--muted);"><tr>';
      html += '<th style="text-align:start;padding:8px 10px;font-weight:600;color:var(--muted-fg);">#</th>';
      html += '<th style="text-align:start;padding:8px 10px;font-weight:600;color:var(--muted-fg);">' + t('ticketTitle') + '</th>';
      html += '<th style="text-align:start;padding:8px 10px;font-weight:600;color:var(--muted-fg);">' + t('ticketState') + '</th>';
      html += '<th style="text-align:start;padding:8px 10px;font-weight:600;color:var(--muted-fg);">' + t('ticketPriority') + '</th>';
      html += '<th style="text-align:start;padding:8px 10px;font-weight:600;color:var(--muted-fg);">' + t('ticketCreated') + '</th>';
      html += '</tr></thead><tbody>';
      tk.slice(0, 40).forEach(function (t2) {
        var createdShort = t2.createdAt ? t2.createdAt.slice(0, 10) : '';
        html += '<tr style="border-top:1px solid var(--border);">' +
          '<td style="padding:8px 10px;font-family:monospace;color:var(--muted-fg);">' + toFa(t2.number) + '</td>' +
          '<td style="padding:8px 10px;max-width:14rem;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-weight:500;">' + escHtml(t2.titleFa || t2.title) + '</td>' +
          '<td style="padding:8px 10px;">' + stateBadge(t2.state) + '</td>' +
          '<td style="padding:8px 10px;">' + priorityBadge(t2.priority) + '</td>' +
          '<td style="padding:8px 10px;font-family:monospace;color:var(--muted-fg);white-space:nowrap;">' + toFa(createdShort) + '</td>' +
        '</tr>';
      });
      html += '</tbody></table></div>';
    }
    body.innerHTML = html;
  }
  function agentDrillKpi(icon, label, value, accent) {
    var colors = { primary: 'rgba(124,58,237,0.12);color:var(--primary)', amber: 'rgba(217,119,6,0.12);color:#d97706', cyan: 'rgba(8,145,178,0.12);color:#0891b2', violet: 'rgba(147,51,234,0.12);color:#9333ea', emerald: 'rgba(22,163,74,0.12);color:#16a34a', rose: 'rgba(220,38,38,0.12);color:#dc2626' };
    return '<div style="border:1px solid var(--border);border-radius:8px;padding:10px;background:var(--card);">' +
      '<div style="width:28px;height:28px;border-radius:8px;display:flex;align-items:center;justify-content:center;background:' + colors[accent || 'primary'] + ';margin-bottom:6px;">' + icon + '</div>' +
      '<div class="stat-number" style="font-size:18px;font-weight:700;">' + value + '</div>' +
      '<div style="font-size:11px;color:var(--muted-fg);margin-top:2px;">' + label + '</div>' +
    '</div>';
  }

  function renderRoles(c) {
    c.innerHTML = '';
    c.appendChild(sectionHead(t('navRoles'), t('roleDistribution'), []));
    c.appendChild(el('div', { class: 'grid grid-3', id: 'role-cards', style: 'margin-bottom:16px;' }, '<div class="skeleton" style="height:100px"></div>'.repeat(3)));
    c.appendChild(el('div', { class: 'grid grid-2' }, [
      el('div', { class: 'card' }, [el('div', { class: 'card-head', id: 'roles-head' }, [el('div', { class: 'card-title' }, t('roleDistribution'))]), el('div', { class: 'card-body' }, [el('canvas', { id: 'chart-roles', height: 300 })])]),
      el('div', { class: 'card' }, [el('div', { class: 'card-head' }, [el('div', { class: 'card-title' }, t('roleDistribution'))]), el('div', { class: 'card-body', id: 'roles-bars' }, '')]),
    ]));
    api('roles').then(function (roles) {
      state.data.roles = roles;
      var colors = ['#dc2626', '#7c3aed', '#d97706', '#9333ea', '#0891b2'];
      var cards = document.getElementById('role-cards');
      if (!cards) return; // user navigated away before API resolved
      cards.innerHTML = roles.slice(0, 6).map(function (r, i) {
        return '<div class="card card-hover fade-in"><div class="card-body" style="display:flex;align-items:center;gap:16px"><div class="kpi-icon" style="background:' + colors[i % colors.length] + '20;color:' + colors[i % colors.length] + '">' + ICONS.roles + '</div><div><div class="kpi-label">' + r.nameFa + '</div><div class="kpi-value">' + toFa(formatNum(r.count, state.lang)) + '</div><div style="font-size:11px;color:var(--muted-fg)">' + (state.lang === 'fa' ? 'کاربر' : 'Users') + '</div></div></div></div>';
      }).join('');
      var rows = roles.map(function (r) { return { role: r.nameFa, count: r.count }; });
      var headers = [{ key: 'role', label: t('navRoles') }, { key: 'count', label: state.lang === 'fa' ? 'کاربران' : 'Users' }];
      var rolesHeadEl = document.getElementById('roles-head');
      if (rolesHeadEl) rolesHeadEl.appendChild(exportMenu('roles', rows, headers, 'roles-distribution', t('roleDistribution')));
      setTimeout(function () {
        var ctx = document.getElementById('chart-roles');
        if (ctx) charts.roles = new Chart(ctx, {
          type: 'doughnut',
          data: { labels: roles.map(function (r) { return r.nameFa; }), datasets: [{ data: roles.map(function (r) { return r.count; }), backgroundColor: colors, borderWidth: 2, borderColor: getCss('--card') }] },
          options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { position: 'bottom', labels: { font: { size: 11 } } } } }
        });
      }, 50);
      var total = roles.reduce(function (s, r) { return s + r.count; }, 0);
      setHTML('roles-bars', roles.map(function (r, i) {
        var pct = total ? (r.count / total) * 100 : 0;
        return '<div style="margin-bottom:14px"><div style="display:flex;justify-content:space-between;font-size:13px"><span style="font-weight:500">' + r.nameFa + '</span><span style="color:var(--muted-fg)">' + toFa(formatNum(r.count, state.lang)) + ' (' + toFa(pct.toFixed(1)) + pctSign() + ')</span></div><div class="progress" style="margin-top:6px;height:10px"><div class="progress-fill" style="width:' + pct + '%;background:' + colors[i % colors.length] + '"></div></div></div>';
      }).join(''));
    }).catch(function (e) { c.appendChild(el('div', { class: 'empty' }, e.message)); });
  }

  // ---- Response Time page (COMPLETELY REWRITTEN) ----
  // The old version had two critical bugs:
  //   1. When first_response_at was NULL for all tickets (common on this
  //      Zammad cluster), `hasData` was false → the page showed "no data"
  //      banners for every section → "nothing works".
  //   2. Charts were placed directly in .card-body without a fixed-height
  //      wrapper, so Chart.js v4 (maintainAspectRatio:false) could collapse
  //      the canvas to 0 height.
  //
  // The new version:
  //   - Uses the `summary` object from the API (avg, median, P90, P99, min,
  //     max, response rate) for richer KPI cards.
  //   - Always renders the trend chart (even with zeros) so the user sees
  //     the timeline instead of a blank page.
  //   - Adds a distribution histogram (0-15m / 15-60m / 1-4h / 4-24h / 1-3d / 3d+).
  //   - Adds a detailed by-channel table with SLA badges + progress bars.
  //   - Shows an informational banner about the data source.
  //   - Wraps all charts in .chart-wrap (fixed height) for robust rendering.
  function renderResponseTime(c) {
    c.innerHTML = '';
    c.appendChild(sectionHead(t('responseTimeTitle'), t('responseTimeTrend') + ' · ' + t('slaCompliance'), [periodSelector()]));

    // KPI row — 4 metric cards (skeletons while loading)
    c.appendChild(el('div', { class: 'grid grid-4', id: 'rt-kpis' }, '<div class="skeleton" style="height:110px"></div>'.repeat(4)));

    // Info banner — shows the data source (first_response_at vs proxy fields)
    var banner = el('div', { class: 'card', style: 'margin-top:16px;' }, [
      el('div', { class: 'card-body', style: 'padding:0;' }, [el('div', { id: 'rt-banner', class: 'rt-info-banner', style: 'margin:0;border:none;border-radius:0;' })])
    ]);
    c.appendChild(banner);

    // Trend chart — full width, fixed height wrapper
    var trendCard = el('div', { class: 'card', style: 'margin-top:16px;' }, [
      el('div', { class: 'card-head' }, [el('div', { class: 'card-title' }, t('responseTimeTrend'))]),
      el('div', { class: 'card-body' }, [el('div', { class: 'chart-wrap chart-wrap-lg', id: 'rt-trend-wrap' }, [el('canvas', { id: 'chart-rt-trend' })])])
    ]);
    c.appendChild(trendCard);

    // Row: by-channel bar chart + distribution histogram
    c.appendChild(el('div', { class: 'grid grid-2', style: 'margin-top:16px;' }, [
      el('div', { class: 'card' }, [
        el('div', { class: 'card-head' }, [el('div', { class: 'card-title' }, t('ticketsByChannel') || t('channelDistribution'))]),
        el('div', { class: 'card-body' }, [el('div', { class: 'chart-wrap chart-wrap-md', id: 'rt-ch-wrap' }, [el('canvas', { id: 'chart-rt-ch' })])])
      ]),
      el('div', { class: 'card' }, [
        el('div', { class: 'card-head' }, [el('div', { class: 'card-title' }, state.lang === 'fa' ? 'توزیع زمان پاسخ' : 'Response Time Distribution')]),
        el('div', { class: 'card-body', id: 'rt-histogram-body' }, '<div class="skeleton" style="height:160px"></div>')
      ]),
    ]));

    // Detailed by-channel table with SLA compliance
    c.appendChild(el('div', { class: 'card', style: 'margin-top:16px;' }, [
      el('div', { class: 'card-head', id: 'sla-head' }, [el('div', { class: 'card-title' }, t('slaCompliance'))]),
      el('div', { class: 'card-body', id: 'sla-bars', style: 'padding:0;' }, '<div class="skeleton" style="height:200px"></div>')
    ]));

    api('responseTime', { period: state.period }).then(function (d) {
      state.data.rt = d;
      var summary = d.summary || {};
      var hasData = d.hasData !== false;
      var channelKeys = d.channelKeys || Object.keys(d.byChannel || {});
      var overallSla = d.overallSla || 0;

      // ---- KPI cards (using summary data) ----
      var kpis = document.getElementById('rt-kpis');
      if (kpis) {
        kpis.innerHTML =
          rtMetricCard(t('avgFirstResponse'), formatDuration(summary.avgFirstResponse || 0, state.lang), ICONS.clock, '#7c3aed',
            state.lang === 'fa' ? 'میانگین زمان اولین پاسخ' : 'Average first response time') +
          rtMetricCard(t('resolutionTime'), formatDuration(summary.avgResolution || 0, state.lang), ICONS.gauge, '#9333ea',
            state.lang === 'fa' ? 'میانگین زمان حل تیکت' : 'Average resolution time') +
          rtMetricCard(state.lang === 'fa' ? 'صدک ۹۰' : '90th Percentile', formatDuration(summary.p90FirstResponse || 0, state.lang), ICONS.alert, '#d97706',
            state.lang === 'fa' ? '۹۰٪ تیکت‌ها در این زمان پاسخ داده شده‌اند' : '90% of tickets responded to within this time') +
          rtMetricCard(t('slaCompliance'), digits(Math.round(overallSla), state.lang) + pctSign(), ICONS.check, overallSla >= 85 ? '#16a34a' : overallSla >= 70 ? '#d97706' : '#dc2626',
            state.lang === 'fa' ? 'درصد تیکت‌های منطبق با SLA' : 'SLA-compliant tickets percentage');
      }

      // ---- Info banner ----
      var bannerEl = document.getElementById('rt-banner');
      if (bannerEl) {
        var dsLabel = {
          'first_response_at': state.lang === 'fa' ? 'فیلد first_response_at (دقیق)' : 'first_response_at field (accurate)',
          'last_owner_update_at (proxy)': state.lang === 'fa' ? 'فیلد last_owner_update_at (تقریبی)' : 'last_owner_update_at field (proxy)',
          'updated_at (proxy)': state.lang === 'fa' ? 'فیلد updated_at (تقریبی)' : 'updated_at field (proxy)',
          'none': state.lang === 'fa' ? 'هیچ منبع داده‌ای یافت نشد' : 'No data source found'
        };
        var ds = d.dataSource || 'first_response_at';
        var dsText = dsLabel[ds] || ds;
        var responseRate = summary.responseRate || 0;
        var bannerText = state.lang === 'fa'
          ? 'منبع داده: ' + dsText + ' · نرخ پاسخگویی: ' + digits(responseRate, state.lang) + pctSign() + ' (' + digits(summary.ticketsWithResponse || 0, state.lang) + ' از ' + digits(summary.totalTickets || 0, state.lang) + ' تیکت)'
          : 'Data source: ' + dsText + ' · Response rate: ' + digits(responseRate, state.lang) + '% (' + digits(summary.ticketsWithResponse || 0, state.lang) + ' of ' + digits(summary.totalTickets || 0, state.lang) + ' tickets)';
        bannerEl.innerHTML = (ICONS.helpCircle || ICONS.alert) + '<span>' + escHtml(bannerText) + '</span>';
      }

      // ---- Trend chart ----
      setTimeout(function () {
        var trendWrap = document.getElementById('rt-trend-wrap');
        // Check if there's real trend data (non-zero values)
        var hasRealData = d.trend && d.trend.length > 0 && d.trend.some(function (r) {
          return (r.firstResponse || 0) > 0 || (r.resolution || 0) > 0 || (r.p90 || 0) > 0;
        });

        if (!hasRealData) {
          // No real trend data — show a clear "no data" message instead of
          // fabricating fake activity
          if (trendWrap) trendWrap.innerHTML = rtEmptyState(
            state.lang === 'fa' ? 'داده روند زمان پاسخ در دسترس نیست' : 'No response time trend data',
            state.lang === 'fa'
              ? 'هنوز هیچ تیکتی در این بازه پاسخ داده نشده است. فیلدهای first_response_at در Elasticsearch خالی هستند.'
              : 'No tickets have been responded to in this period. The first_response_at fields are empty in Elasticsearch.'
          );
        } else {
          // Real data exists — render the chart
          var ctx = document.getElementById('chart-rt-trend');
          if (ctx) {
            var datasets = [
              { label: t('avgFirstResponse'), data: d.trend.map(function (r) { return r.firstResponse || 0; }), borderColor: '#7c3aed', backgroundColor: 'rgba(124,58,237,0.1)', tension: 0.3, borderWidth: 2, pointRadius: 0, fill: true },
              { label: t('resolutionTime'), data: d.trend.map(function (r) { return r.resolution || 0; }), borderColor: '#9333ea', backgroundColor: 'rgba(147,51,234,0.05)', tension: 0.3, borderWidth: 2, pointRadius: 0, fill: false },
              { label: state.lang === 'fa' ? 'صدک ۹۰' : 'P90', data: d.trend.map(function (r) { return r.p90 || 0; }), borderColor: '#d97706', tension: 0.3, borderWidth: 2, borderDash: [5, 5], pointRadius: 0, fill: false },
            ];
            // Add median line if available
            if (d.trend[0] && d.trend[0].median !== undefined) {
              datasets.push({ label: state.lang === 'fa' ? 'میانه' : 'Median', data: d.trend.map(function (r) { return r.median || 0; }), borderColor: '#0891b2', tension: 0.3, borderWidth: 1.5, borderDash: [2, 2], pointRadius: 0, fill: false });
            }
            charts.rtTrend = new Chart(ctx, {
              type: 'line',
              data: { labels: d.trend.map(function (r) { return dateLabel(r.date, state.lang); }), datasets: datasets },
              options: {
                responsive: true, maintainAspectRatio: false,
                plugins: {
                  legend: { position: 'bottom', labels: { font: { size: 11 }, usePointStyle: true, pointStyle: 'circle' } },
                  tooltip: { mode: 'index', intersect: false, callbacks: { label: function (ctx) { return ctx.dataset.label + ': ' + formatDuration(ctx.raw, state.lang); } } }
                },
                scales: {
                  y: { beginAtZero: true, grid: { color: getCss('--border') }, ticks: { callback: function (v) { return formatDuration(v, state.lang); } } },
                  x: { grid: { display: false }, ticks: { maxRotation: 0, autoSkip: true, maxTicksLimit: 12 } }
                }
              }
            });
          }
        }

        // ---- By-channel bar chart ----
        var chWrap = document.getElementById('rt-ch-wrap');
        if (channelKeys.length === 0 || !d.byChannel || Object.keys(d.byChannel).length === 0) {
          if (chWrap) chWrap.innerHTML = rtEmptyState(state.lang === 'fa' ? 'داده کانال در دسترس نیست' : 'No channel data', state.lang === 'fa' ? 'کانالی یافت نشد.' : 'No channels found.');
        } else {
          var ctx2 = document.getElementById('chart-rt-ch');
          if (ctx2) charts.rtCh = new Chart(ctx2, {
            type: 'bar',
            data: {
              labels: channelKeys.map(function (ch) { return d.byChannel[ch] ? channelLabel(ch.name || ch) : ch; }),
              datasets: [
                { label: t('avgFirstResponse'), data: channelKeys.map(function (ch) { return d.byChannel[ch] ? d.byChannel[ch].avgResponse : 0; }), backgroundColor: channelKeys.map(function (_, i) { return ['#7c3aed', '#d97706', '#9333ea', '#0891b2', '#dc2626', '#16a34a', '#ca8a04', '#7c3aed'][i % 8]; }), borderRadius: 4, maxBarThickness: 50 },
                { label: t('resolutionTime'), data: channelKeys.map(function (ch) { return d.byChannel[ch] ? d.byChannel[ch].avgResolution : 0; }), backgroundColor: channelKeys.map(function (_, i) { return ['rgba(124,58,237,0.4)', 'rgba(217,119,6,0.4)', 'rgba(147,51,234,0.4)', 'rgba(8,145,178,0.4)', 'rgba(220,38,38,0.4)', 'rgba(22,163,74,0.4)', 'rgba(202,138,4,0.4)', 'rgba(124,58,237,0.4)'][i % 8]; }), borderRadius: 4, maxBarThickness: 50 },
              ]
            },
            options: {
              responsive: true, maintainAspectRatio: false,
              plugins: { legend: { position: 'bottom', labels: { font: { size: 11 }, usePointStyle: true, pointStyle: 'circle' } }, tooltip: { callbacks: { label: function (ctx) { return ctx.dataset.label + ': ' + formatDuration(ctx.raw, state.lang); } } } },
              scales: { y: { beginAtZero: true, grid: { color: getCss('--border') }, ticks: { callback: function (v) { return formatDuration(v, state.lang); } } }, x: { grid: { display: false }, ticks: { font: { size: 10 }, maxRotation: 45, minRotation: 0 } } }
            }
          });
        }
      }, 50);

      // ---- Distribution histogram ----
      var histBody = document.getElementById('rt-histogram-body');
      if (histBody) {
        var hist = d.histogram || [];
        if (hist.length === 0 || hist.every(function (h) { return h.count === 0; })) {
          histBody.innerHTML = '<div class="empty" style="padding:24px;text-align:center;color:var(--muted-fg);">' + (state.lang === 'fa' ? 'داده‌ای برای توزیع در دسترس نیست' : 'No distribution data') + '</div>';
        } else {
          var maxCount = Math.max.apply(null, hist.map(function (h) { return h.count; })) || 1;
          var histHtml = '<div class="rt-histogram">' + hist.map(function (h) {
            var pct = Math.round((h.count / maxCount) * 100);
            return '<div class="rt-histogram-bar" style="height:' + pct + '%;" title="' + escHtml(h.labelFa) + ': ' + digits(h.count, state.lang) + '">' +
              '<span class="rt-histogram-bar-value">' + digits(h.count, state.lang) + '</span>' +
              '</div>';
          }).join('') + '</div>';
          histHtml += '<div style="display:flex;gap:4px;margin-top:24px;">' + hist.map(function (h) {
            return '<div style="flex:1;text-align:center;font-size:9px;color:var(--muted-fg);line-height:1.3;overflow:hidden;">' + escHtml(h.labelFa) + '</div>';
          }).join('') + '</div>';
          histBody.innerHTML = histHtml;
        }
      }

      // ---- Detailed by-channel SLA table ----
      var slaHead = document.getElementById('sla-head');
      var slaBars = document.getElementById('sla-bars');
      var rows = channelKeys.map(function (ch) {
        var v = d.byChannel[ch] || { avgResponse: 0, avgResolution: 0, sla: 0, total: 0, withResponse: 0, slaOk: 0, slaBreached: 0, threshold: 120 };
        return {
          channel: channelLabel(ch),
          avgResponse: formatDuration(v.avgResponse, state.lang),
          avgResolution: formatDuration(v.avgResolution, state.lang),
          sla: v.sla,
          total: v.total,
          withResponse: v.withResponse || 0,
          slaOk: v.slaOk || 0,
          slaBreached: v.slaBreached || 0,
          threshold: v.threshold || 120,
        };
      });
      var headers = [
        { key: 'channel', label: t('ticketChannel') },
        { key: 'avgResponse', label: t('avgFirstResponse') },
        { key: 'avgResolution', label: t('resolutionTime') },
        { key: 'sla', label: t('slaCompliance') + ' ' + pctSign() },
        { key: 'withResponse', label: state.lang === 'fa' ? 'پاسخ‌داده‌شده' : 'Responded' },
      ];
      if (slaHead) slaHead.appendChild(exportMenu('responsetime', rows, headers, 'response-time', t('responseTimeTitle')));

      if (slaBars) {
        if (channelKeys.length === 0) {
          slaBars.innerHTML = '<div class="empty" style="padding:24px;text-align:center;color:var(--muted-fg);">' + (state.lang === 'fa' ? 'داده‌ای یافت نشد' : 'No data') + '</div>';
        } else {
          // Table header
          var tableHtml = '<div style="overflow-x:auto;"><table style="width:100%;font-size:13px;border-collapse:collapse;">';
          tableHtml += '<thead><tr style="border-bottom:2px solid var(--border);">' +
            '<th style="text-align:right;padding:10px 12px;font-size:11px;color:var(--muted-fg);font-weight:600;text-transform:uppercase;">' + t('ticketChannel') + '</th>' +
            '<th style="text-align:center;padding:10px 12px;font-size:11px;color:var(--muted-fg);font-weight:600;text-transform:uppercase;">' + t('avgFirstResponse') + '</th>' +
            '<th style="text-align:center;padding:10px 12px;font-size:11px;color:var(--muted-fg);font-weight:600;text-transform:uppercase;">' + t('resolutionTime') + '</th>' +
            '<th style="text-align:center;padding:10px 12px;font-size:11px;color:var(--muted-fg);font-weight:600;text-transform:uppercase;">SLA</th>' +
            '<th style="text-align:center;padding:10px 12px;font-size:11px;color:var(--muted-fg);font-weight:600;text-transform:uppercase;">' + (state.lang === 'fa' ? 'تعداد' : 'Count') + '</th>' +
            '</tr></thead><tbody>';
          tableHtml += channelKeys.map(function (ch) {
            var v = d.byChannel[ch] || { sla: 0, avgResponse: 0, avgResolution: 0, total: 0, withResponse: 0, slaOk: 0, threshold: 120 };
            var slaColor = v.sla >= 85 ? 'good' : v.sla >= 70 ? 'warn' : 'bad';
            var slaPct = v.sla || 0;
            return '<tr style="border-bottom:1px solid var(--border);">' +
              '<td style="padding:12px;font-weight:600;">' + escHtml(channelLabel(ch)) + '</td>' +
              '<td style="padding:12px;text-align:center;font-family:monospace;">' + formatDuration(v.avgResponse, state.lang) + '</td>' +
              '<td style="padding:12px;text-align:center;font-family:monospace;">' + formatDuration(v.avgResolution, state.lang) + '</td>' +
              '<td style="padding:12px;text-align:center;">' +
                '<div style="display:flex;align-items:center;gap:8px;justify-content:center;">' +
                  '<div class="rt-channel-bar" style="flex:1;max-width:80px;"><div class="rt-channel-bar-fill" style="width:' + slaPct + '%;background:' + (slaColor === 'good' ? '#16a34a' : slaColor === 'warn' ? '#d97706' : '#dc2626') + ';"></div></div>' +
                  '<span class="rt-sla-badge ' + slaColor + '">' + digits(slaPct, state.lang) + pctSign() + '</span>' +
                '</div>' +
              '</td>' +
              '<td style="padding:12px;text-align:center;color:var(--muted-fg);">' + digits(v.total || 0, state.lang) + '</td>' +
            '</tr>';
          }).join('');
          tableHtml += '</tbody></table></div>';
          slaBars.innerHTML = tableHtml;
        }
      }
    }).catch(function (e) {
      var kpis = document.getElementById('rt-kpis');
      if (kpis) kpis.innerHTML = '<div class="empty" style="grid-column:1/-1;">' + (e.message || t('noData')) + '</div>';
      c.appendChild(el('div', { class: 'empty' }, e.message || t('noData')));
    });
  }

  // Helper: response-time metric card (custom styled, different from kpiCard)
  function rtMetricCard(label, value, icon, accent, subtext) {
    return '<div class="rt-metric-card" style="--accent:' + accent + ';">' +
      '<div style="display:flex;align-items:center;justify-content:space-between;">' +
        '<div class="rt-metric-icon">' + icon + '</div>' +
      '</div>' +
      '<div class="rt-metric-label">' + escHtml(label) + '</div>' +
      '<div class="rt-metric-value">' + value + '</div>' +
      (subtext ? '<div class="rt-metric-sub">' + escHtml(subtext) + '</div>' : '') +
    '</div>';
  }

  // Helper: empty state for chart containers
  function rtEmptyState(title, subtitle) {
    return '<div style="position:absolute;top:50%;left:50%;transform:translate(-50%,-50%);text-align:center;color:var(--muted-fg);">' +
      '<div style="font-size:32px;margin-bottom:8px;opacity:0.4;">' + ICONS.clock + '</div>' +
      '<p style="font-weight:600;margin:0 0 4px;font-size:13px;">' + escHtml(title) + '</p>' +
      '<p style="font-size:11px;margin:0;">' + escHtml(subtitle) + '</p>' +
    '</div>';
  }

  function renderTrends(c) {
    c.innerHTML = '';
    c.appendChild(sectionHead(t('trendsTitle'), t('ticketsByState'), [periodSelector()]));
    // CRON-REVIEW-5 Feature 3: Forecast Summary card sits ABOVE the existing
    // KPI row and chart. Includes 4 KPI tiles, 3 status banners, the forecast
    // chart (Chart.js), 2 toggle switches (forecast + anomalies), and an
    // anomaly chip list. Toggles are persisted in `state`.
    c.appendChild(renderForecastSummaryCard(c));
    c.appendChild(el('div', { class: 'grid grid-3', id: 'tr-kpis' }));
    c.appendChild(el('div', { class: 'card', style: 'margin-top:16px;' }, [el('div', { class: 'card-head', id: 'tr-head' }, [el('div', { class: 'card-title' }, t('trendsTitle'))]), el('div', { class: 'card-body' }, [el('canvas', { id: 'chart-trend', height: 360 })])]));
    api('trends', { period: state.period }).then(function (trend) {
      state.data.trends = trend;
      var totalC = trend.reduce(function (s, r) { return s + r.created; }, 0);
      var totalCl = trend.reduce(function (s, r) { return s + r.closed; }, 0);
      var rate = totalC ? Math.round((totalCl / totalC) * 100) : 0;
      document.getElementById('tr-kpis').innerHTML =
        kpiCard(state.lang === 'fa' ? 'ایجادشده' : 'Created', formatNum(totalC, state.lang), ICONS.trends, 'amber') +
        kpiCard(state.lang === 'fa' ? 'بسته‌شده' : 'Closed', formatNum(totalCl, state.lang), ICONS.check, 'emerald') +
        kpiCard(t('resolveRate'), toFa(rate) + pctSign(), ICONS.gauge, 'primary');
      var rows = trend.map(function (r) { return { date: dateLabel(r.date, 'en'), created: r.created, closed: r.closed }; });
      var headers = [{ key: 'date', label: t('ticketCreated') }, { key: 'created', label: state.lang === 'fa' ? 'ایجادشده' : 'Created' }, { key: 'closed', label: state.lang === 'fa' ? 'بسته‌شده' : 'Closed' }];
      document.getElementById('tr-head').appendChild(exportMenu('trends', rows, headers, 'ticket-trends', t('trendsTitle')));
      setTimeout(function () {
        var ctx = document.getElementById('chart-trend');
        if (ctx) charts.trend = new Chart(ctx, {
          type: 'line',
          data: { labels: trend.map(function (r) { return dateLabel(r.date, state.lang); }), datasets: [
            { label: state.lang === 'fa' ? 'ایجادشده' : 'Created', data: trend.map(function (r) { return r.created; }), borderColor: '#d97706', backgroundColor: 'rgba(217,119,6,0.15)', fill: true, tension: 0.3, borderWidth: 2, pointRadius: 0 },
            { label: state.lang === 'fa' ? 'بسته‌شده' : 'Closed', data: trend.map(function (r) { return r.closed; }), borderColor: '#16a34a', backgroundColor: 'rgba(22,163,74,0.15)', fill: true, tension: 0.3, borderWidth: 2, pointRadius: 0 },
          ] },
          options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { position: 'bottom', labels: { font: { size: 11 } } } }, scales: { y: { beginAtZero: true, grid: { color: getCss('--border') } }, x: { grid: { display: false } } } }
        });
      }, 50);
    }).catch(function (e) { c.appendChild(el('div', { class: 'empty' }, e.message)); });
  }

  // ---- Forecast Summary card (CRON-REVIEW-5 Feature 3) ----
  // Mirrors src/components/dashboard/sections/trends.tsx forecast card:
  //   - 4 KPI tiles (Created, Closed, Resolve Rate, 7-day Forecast Sum)
  //   - 3 status banners (anomaly count, trend direction, expected tickets)
  //   - Chart.js line chart: created area (amber) + closed area (emerald) +
  //     dashed cyan forecast line + cyan confidence band + red anomaly scatter
  //   - 2 toggle switches: Enable Forecast + Show Anomalies
  //   - Anomaly chip list (date + created + closed for each anomaly)
  function renderForecastSummaryCard(root) {
    var card = el('div', { class: 'card forecast-card', style: 'margin-bottom:16px;position:relative;overflow:hidden;' });
    // Decorative blurred blob (cyan/emerald) for visual flourish
    var decor = el('div', { class: 'forecast-card-decor no-print', 'aria-hidden': 'true' });
    card.appendChild(decor);
    // Header with title + NEW badge + 2 toggle switches
    var head = el('div', { class: 'card-head', style: 'position:relative;' }, [
      el('div', { style: 'display:flex;align-items:center;gap:12px;' }, [
        el('div', { class: 'forecast-card-icon', html: ICONS.activity }),
        el('div', {}, [
          el('div', { style: 'display:flex;align-items:center;gap:6px;' }, [
            el('h3', { class: 'card-title' }, t('forecastSummary')),
            el('span', { class: 'badge badge-primary', style: 'font-size:9px;font-weight:700;letter-spacing:0.06em;text-transform:uppercase;' }, t('newFeature')),
          ]),
        ]),
      ]),
      el('div', { style: 'display:flex;align-items:center;gap:8px;flex-wrap:wrap;' }, [
        forecastToggleSwitch('forecast-toggle', state.trendsShowForecast, '#0891b2', t('enableForecast'), function (v) {
          state.trendsShowForecast = v;
          // re-render just the chart + anomaly list, not the whole section
          if (state.trendForecast) renderForecastChart(state.trendForecast);
        }),
        forecastToggleSwitch('anomaly-toggle', state.trendsShowAnomalies, '#dc2626', t('enableAnomalies'), function (v) {
          state.trendsShowAnomalies = v;
          if (state.trendForecast) {
            renderForecastChart(state.trendForecast);
            renderForecastAnomalyList(state.trendForecast);
          }
        }),
      ]),
    ]);
    card.appendChild(head);
    // Body — 4 KPI tiles + 3 status banners + chart host + anomaly list
    var body = el('div', { class: 'card-body', id: 'forecast-body', style: 'position:relative;' }, '<div class="skeleton" style="height:340px"></div>');
    card.appendChild(body);

    // Fetch trend forecast
    api('trendForecast', { days: state.period }).then(function (fc) {
      state.trendForecast = fc;
      renderForecastSummaryBody(fc, body);
    }).catch(function (e) {
      body.innerHTML = '<div class="empty">' + (e.message || t('noData')) + '</div>';
    });

    return card;
  }
  function forecastToggleSwitch(id, checked, color, label, onChange) {
    var wrap = el('div', { class: 'forecast-toggle-wrap', style: 'display:flex;align-items:center;gap:8px;padding:6px 10px;border:1px solid var(--border);border-radius:8px;background:color-mix(in srgb,' + color + ' 5%, transparent);' });
    var cb = el('input', { type: 'checkbox', id: id, class: 'forecast-toggle-cb' });
    cb.checked = !!checked;
    cb.style.display = 'none';
    var knob = el('span', { class: 'forecast-toggle-knob ' + (checked ? 'on' : ''), style: '--ft-color:' + color + ';' });
    var lbl = el('label', { for: id, style: 'cursor:pointer;font-size:12px;font-weight:500;' }, label);
    cb.addEventListener('change', function () {
      knob.classList.toggle('on', cb.checked);
      onChange(cb.checked);
    });
    wrap.appendChild(cb);
    wrap.appendChild(knob);
    wrap.appendChild(lbl);
    return wrap;
  }
  function renderForecastSummaryBody(fc, body) {
    if (!body) return;
    var stats = (fc && fc.stats) || {};
    var series = (fc && fc.series) || [];
    var anomalies = (fc && fc.anomalies) || [];

    // Compute totals from the actual (non-forecast) part of the series
    var totalC = 0, totalCl = 0;
    series.forEach(function (s) { if (!s.isForecast) { totalC += (s.created || 0); totalCl += (s.closed || 0); } });
    var rate = totalC ? Math.round((totalCl / totalC) * 100) : 0;
    var fcNext7 = stats.createdForecastNext7 || 0;

    // 4 KPI tiles (mini stat cards)
    var kpiTilesHtml =
      '<div class="forecast-kpi-grid">'
      + '<div class="forecast-kpi-tile"><div class="forecast-kpi-bar" style="background:linear-gradient(90deg,#d97706,#f59e0b)"></div><div class="forecast-kpi-body"><p class="forecast-kpi-label">' + t('createdLabel') + '</p><p class="forecast-kpi-value" style="color:#d97706">' + digits(formatNum(totalC, state.lang), state.lang) + '</p></div></div>'
      + '<div class="forecast-kpi-tile"><div class="forecast-kpi-bar" style="background:linear-gradient(90deg,#16a34a,#10b981)"></div><div class="forecast-kpi-body"><p class="forecast-kpi-label">' + t('closedLabel') + '</p><p class="forecast-kpi-value" style="color:#16a34a">' + digits(formatNum(totalCl, state.lang), state.lang) + '</p></div></div>'
      + '<div class="forecast-kpi-tile"><div class="forecast-kpi-bar" style="background:linear-gradient(90deg,var(--primary),#0891b2)"></div><div class="forecast-kpi-body"><p class="forecast-kpi-label">' + t('resolveRate') + '</p><p class="forecast-kpi-value" style="color:var(--primary)">' + toFa(rate) + pctSign() + '</p></div></div>'
      + '<div class="forecast-kpi-tile" style="border-color:rgba(8,145,178,0.25)"><div class="forecast-kpi-bar" style="background:linear-gradient(90deg,#0891b2,var(--primary))"></div><div class="forecast-kpi-body"><p class="forecast-kpi-label">' + t('forecastNext7') + '</p><div style="display:flex;align-items:center;justify-content:space-between;gap:6px;"><p class="forecast-kpi-value" style="color:#0891b2">' + digits(formatNum(fcNext7, state.lang), state.lang) + '</p><span class="forecast-kpi-decor">' + ICONS.sparkles + '</span></div><p class="forecast-kpi-sub">' + t('basedOnRegression') + '</p></div></div>'
      + '</div>';

    // 3 status banners: anomaly count / trend direction / expected tickets
    var anomalyCount = anomalies.length;
    var trendBanner = (stats.createdMean > stats.createdStd)
      ? t('trendRising')
      : (stats.createdStd > stats.createdMean ? t('trendFalling') : t('trendStable'));
    var trendBannerCls = (stats.createdMean > stats.createdStd)
      ? 'forecast-banner-amber'
      : (stats.createdStd > stats.createdMean ? 'forecast-banner-rose' : 'forecast-banner-emerald');
    var bannersHtml =
      '<div class="forecast-banners-row">'
      + '<div class="forecast-banner ' + (anomalyCount > 0 ? 'forecast-banner-rose' : 'forecast-banner-emerald') + '">'
        + '<span class="forecast-banner-icon">' + (anomalyCount > 0 ? ICONS.alertTriangle : ICONS.trendingUp) + '</span>'
        + '<div><p class="forecast-banner-title">' + (anomalyCount > 0 ? digits(anomalyCount, state.lang) + ' ' + t('anomalyDetected') : t('trendStable')) + '</p><p class="forecast-banner-sub">' + t('anomalyDesc') + '</p></div>'
      + '</div>'
      + '<div class="forecast-banner forecast-banner-cyan">'
        + '<span class="forecast-banner-icon">' + ICONS.zap + '</span>'
        + '<div><p class="forecast-banner-title">' + trendBanner + '</p><p class="forecast-banner-sub">' + t('mean') + ': ' + digits(formatNum(Math.round(stats.createdMean || 0), state.lang), state.lang) + ' · ' + t('stdDev') + ': ' + digits(formatNum(Math.round(stats.createdStd || 0), state.lang), state.lang) + '</p></div>'
      + '</div>'
      + '<div class="forecast-banner forecast-banner-primary">'
        + '<span class="forecast-banner-icon">' + ICONS.activity + '</span>'
        + '<div><p class="forecast-banner-title">' + t('expectedTickets7d') + '</p><p class="forecast-banner-sub">' + t('createdLabel') + ': ' + digits(formatNum(stats.createdForecastNext7 || 0, state.lang), state.lang) + ' · ' + t('closedLabel') + ': ' + digits(formatNum(stats.closedForecastNext7 || 0, state.lang), state.lang) + '</p></div>'
      + '</div>'
      + '</div>';

    // Chart host (Chart.js line — created + closed areas, forecast dashed line,
    // forecast confidence band, anomaly scatter dots)
    var chartHostHtml =
      '<div class="forecast-chart-card">'
      + '<div class="forecast-chart-head">'
        + '<p class="forecast-chart-title">' + t('dailyTrend') + ' + ' + t('forecast7d') + '</p>'
        + '<div class="forecast-chart-legend">'
          + '<span class="kdd-leg-item"><span class="kdd-leg-dot" style="background:#d97706"></span>' + t('createdLabel') + '</span>'
          + '<span class="kdd-leg-item"><span class="kdd-leg-dot" style="background:#16a34a"></span>' + t('closedLabel') + '</span>'
          + (state.trendsShowForecast ? '<span class="kdd-leg-item"><span class="kdd-leg-dot" style="background:#0891b2;opacity:0.6"></span>' + t('forecast') + '</span>' : '')
          + (state.trendsShowAnomalies ? '<span class="kdd-leg-item"><span class="kdd-leg-dot" style="background:#dc2626"></span>' + t('anomaly') + '</span>' : '')
        + '</div>'
      + '</div>'
      + '<div class="forecast-chart-wrap"><canvas id="chart-forecast" height="320"></canvas></div>'
      + '</div>';

    // Anomaly chip list host
    var anomListHost = '<div id="forecast-anomaly-list"></div>';

    body.innerHTML = kpiTilesHtml + bannersHtml + chartHostHtml + anomListHost;

    // Render the chart and anomaly list
    renderForecastChart(fc);
    renderForecastAnomalyList(fc);
  }
  function renderForecastChart(fc) {
    var ctx = document.getElementById('chart-forecast');
    if (!ctx || typeof Chart === 'undefined') return;
    if (charts.trendForecast) { try { charts.trendForecast.destroy(); } catch (e) {} delete charts.trendForecast; }
    var series = (fc && fc.series) || [];
    var labels = series.map(function (s) { return s.label || dateLabel(s.date, state.lang); });
    var createdData = series.map(function (s) { return s.created; });
    var closedData = series.map(function (s) { return s.closed; });
    var fcCreatedData = series.map(function (s) { return s.forecastCreated; });
    var fcHiData = series.map(function (s) { return s.forecastHi; });
    var fcLoData = series.map(function (s) { return s.forecastLo; });
    var anomData = series.map(function (s) { return (state.trendsShowAnomalies && s.isAnomaly && !s.isForecast) ? (s.created || 0) : null; });

    var dsCreated = {
      label: t('createdLabel'), data: createdData,
      borderColor: '#d97706', backgroundColor: 'rgba(217,119,6,0.15)', fill: true,
      tension: 0.3, borderWidth: 2, pointRadius: 0, pointHoverRadius: 4,
    };
    var dsClosed = {
      label: t('closedLabel'), data: closedData,
      borderColor: '#16a34a', backgroundColor: 'rgba(22,163,74,0.15)', fill: true,
      tension: 0.3, borderWidth: 2, pointRadius: 0, pointHoverRadius: 4,
    };
    var datasets = [dsCreated, dsClosed];
    if (state.trendsShowForecast) {
      var dsFcHi = {
        label: 'fcHi', data: fcHiData, borderColor: 'transparent',
        backgroundColor: 'rgba(8,145,178,0.10)', fill: '+1',
        tension: 0.3, pointRadius: 0,
      };
      var dsFcLo = {
        label: 'fcLo', data: fcLoData, borderColor: 'transparent',
        backgroundColor: 'transparent', tension: 0.3, pointRadius: 0, fill: false,
      };
      var dsFcCreated = {
        label: t('forecast'), data: fcCreatedData,
        borderColor: '#0891b2', backgroundColor: 'rgba(8,145,178,0.05)',
        borderDash: [5, 4], borderWidth: 2, tension: 0.3,
        pointRadius: 0, pointHoverRadius: 4, fill: false,
      };
      datasets.push(dsFcHi, dsFcLo, dsFcCreated);
    }
    if (state.trendsShowAnomalies) {
      datasets.push({
        label: t('anomaly'), data: anomData,
        borderColor: '#dc2626', backgroundColor: '#dc2626',
        showLine: false, pointRadius: 5, pointHoverRadius: 7,
        pointStyle: 'circle', pointBorderColor: '#fff', pointBorderWidth: 1.5,
      });
    }
    charts.trendForecast = new Chart(ctx, {
      type: 'line',
      data: { labels: labels, datasets: datasets },
      options: {
        responsive: true, maintainAspectRatio: false,
        plugins: {
          legend: { display: false },
          tooltip: {
            callbacks: {
              label: function (ctx2) {
                var v = ctx2.parsed.y;
                if (v == null) return null;
                return ctx2.dataset.label + ': ' + digits(formatNum(Math.round(v), state.lang), state.lang);
              }
            }
          }
        },
        scales: {
          y: { beginAtZero: true, grid: { color: getCss('--border') }, ticks: { font: { size: 11 }, color: getCss('--muted-fg') } },
          x: { grid: { display: false }, ticks: { font: { size: 10 }, color: getCss('--muted-fg'), maxRotation: 0, autoSkip: true, maxTicksLimit: 10 } }
        }
      }
    });
  }
  function renderForecastAnomalyList(fc) {
    var host = document.getElementById('forecast-anomaly-list');
    if (!host) return;
    var anomalies = (fc && fc.anomalies) || [];
    if (!state.trendsShowAnomalies || anomalies.length === 0) {
      host.innerHTML = '';
      return;
    }
    host.innerHTML =
      '<div class="forecast-anomaly-list-wrap">'
      + '<p class="forecast-anomaly-head"><span class="forecast-anomaly-head-icon">' + ICONS.alertTriangle + '</span>' + t('anomalies') + ' (' + digits(anomalies.length, state.lang) + ')</p>'
      + '<div class="forecast-anomaly-chips">'
      + anomalies.map(function (a) {
        return '<span class="forecast-anomaly-chip"><span class="mono">' + dateLabel(a.date, state.lang) + '</span><span class="sep">·</span><span>' + t('createdLabel') + ': ' + digits(a.created, state.lang) + '</span><span class="sep">·</span><span>' + t('closedLabel') + ': ' + digits(a.closed, state.lang) + '</span></span>';
      }).join('')
      + '</div></div>';
  }

  function renderTickets(c) {
    c.innerHTML = '';
    c.appendChild(sectionHead(t('navTickets'), '', [periodSelector()]));
    var card = el('div', { class: 'card' }, [
      el('div', { class: 'card-head', id: 'tk-head' }, [el('div', { class: 'card-title' }, t('navTickets'))]),
      el('div', { class: 'card-body', id: 'tk-table', style: 'padding:0;' }, '<div class="skeleton" style="height:300px"></div>'),
    ]);
    c.appendChild(card);
    api('tickets', { limit: 50 }).then(function (res) {
      var tickets = res.tickets || [];
      var rows = tickets.map(function (tk) {
        return { number: tk.number, title: tk.titleFa, state: tk.state === 'open' ? t('stateOpen') : tk.state === 'closed' ? t('stateClosed') : t('statePending'), priority: tk.priority === 'low' ? t('priorityLow') : tk.priority === 'normal' ? t('priorityNormal') : tk.priority === 'high' ? t('priorityHigh') : t('priorityUrgent'), channel: tk.channel, owner: tk.ownerName || tk.ownerId || '-', created: tk.createdAt ? tk.createdAt.slice(0, 10) : '' };
      });
      var headers = [{ key: 'number', label: '#' }, { key: 'title', label: t('ticketTitle') }, { key: 'state', label: t('ticketState') }, { key: 'priority', label: t('ticketPriority') }, { key: 'channel', label: t('ticketChannel') }, { key: 'owner', label: t('ticketOwner') }, { key: 'created', label: t('ticketCreated') }];
      document.getElementById('tk-head').appendChild(exportMenu('tickets', rows, headers, 'tickets', t('navTickets')));
      if (!tickets.length) { document.getElementById('tk-table').innerHTML = '<div class="empty">' + t('noData') + '</div>'; return; }
      document.getElementById('tk-table').innerHTML = '<div class="table-wrap"><table><thead><tr>' + headers.map(function (h) { return '<th>' + h.label + '</th>'; }).join('') + '</tr></thead><tbody>' + tickets.map(function (tk) {
        var ownerDisplay = tk.ownerName || (tk.ownerId ? 'User ' + tk.ownerId : '-');
        return '<tr><td class="mono">' + toFa(tk.number) + '</td><td class="truncate">' + escHtml(tk.titleFa) + '</td><td>' + stateBadge(tk.state) + '</td><td>' + priorityBadge(tk.priority) + '</td><td>' + channelBadge(tk.channel) + '</td><td>' + escHtml(ownerDisplay) + '</td><td class="mono">' + toFa(tk.createdAt ? tk.createdAt.slice(0, 10) : '') + '</td></tr>';
      }).join('') + '</tbody></table></div>';
    }).catch(function (e) { setHTML('tk-table', '<div class="empty">' + e.message + '</div>'); });
  }

  // ---- Wordcloud section ----
  var PALETTE = ['#7c3aed', '#d97706', '#9333ea', '#0891b2', '#dc2626', '#16a34a', '#ca8a04', '#7c3aed', '#db2777', '#2563eb', '#059669', '#ea580c'];
  function mulberry32(seed) { return function () { var t = seed += 0x6d2b79f5; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
  // Placed-word registry for hit-testing clicks on the canvas.
  // Each entry: { word: string, box: { x, y, w, h } } in CSS pixels.
  var wcPlacedWords = [];
  function renderWc(canvas, words) {
    wcPlacedWords = [];
    var dpr = window.devicePixelRatio || 1;
    var cssW = canvas.clientWidth || 800, cssH = 420;
    canvas.width = cssW * dpr; canvas.height = cssH * dpr;
    canvas.style.height = cssH + 'px';
    var ctx = canvas.getContext('2d'); ctx.setTransform(dpr, 0, 0, dpr, 0, 0); ctx.clearRect(0, 0, cssW, cssH);
    ctx.textBaseline = 'middle'; ctx.textAlign = 'center';
    if (!words.length) return;
    var fontFamily = state.lang === 'fa' ? 'Vazirmatn, Tahoma, sans-serif' : 'Inter, sans-serif';
    var drawAll = function () { drawWcWords(ctx, words, cssW, cssH, fontFamily); };
    // Canvas text needs the webfont fully loaded, otherwise it falls back to
    // Tahoma/sans-serif. Use the Font Loading API to wait for Vazirmatn.
    // NOTE: document.fonts.load() expects a SINGLE font family in the shorthand,
    // not a comma-separated list — passing 'Vazirmatn, Tahoma, sans-serif' would
    // fail to match any @font-face and the promise rejects (falling back to
    // the error handler which draws with whatever is available). Load just
    // 'Vazirmatn' at the weight we draw with (600), then draw.
    if (document.fonts && document.fonts.load) {
      var primaryFont = state.lang === 'fa' ? 'Vazirmatn' : 'Inter';
      // Load multiple weights since drawWcWords uses 600 for all sizes.
      Promise.all([
        document.fonts.load('600 48px ' + primaryFont),
        document.fonts.load('400 48px ' + primaryFont),
      ]).then(drawAll, drawAll).catch(drawAll);
      // Also redraw once all fonts are settled (covers the edge case where the
      // specific load() promise resolves before the face is actually usable).
      document.fonts.ready.then(function () {
        ctx.clearRect(0, 0, cssW, cssH);
        drawAll();
      });
    } else {
      drawAll();
    }
  }
  // Draws the placed wordcloud words into a 2D context. Extracted so it can be
  // called both immediately and after font-load.
  function drawWcWords(ctx, words, cssW, cssH, fontFamily) {
    ctx.clearRect(0, 0, cssW, cssH);
    ctx.textBaseline = 'middle'; ctx.textAlign = 'center';
    var max = words[0].count, min = words[words.length - 1].count, rng = mulberry32(7);
    var cx = cssW / 2, cy = cssH / 2, placed = [];
    for (var i = 0; i < words.length; i++) {
      var w = words[i], tt = (w.count - min) / Math.max(1, max - min), fs = Math.round(13 + tt * 46);
      var rot = rng() < 0.25 ? -90 : 0;
      ctx.font = '600 ' + fs + 'px ' + fontFamily;
      var tw = ctx.measureText(w.word).width, th = fs;
      var bw = rot === 0 ? tw : th, bh = rot === 0 ? th : tw;
      var ok = false, px = 0, py = 0, theta = rng() * Math.PI * 2, radius = 0, pad = 4;
      for (var s = 0; s < 4000; s++) {
        var x = cx + radius * Math.cos(theta) - bw / 2, y = cy + radius * Math.sin(theta) - bh / 2;
        var box = { x: x, y: y, w: bw, h: bh };
        if (x >= 2 && y >= 2 && x + bw <= cssW - 2 && y + bh <= cssH - 2 && !placed.some(function (p) { return !(p.x + p.w + pad < box.x || box.x + box.w + pad < p.x || p.y + p.h + pad < box.y || box.y + box.h + pad < p.y); })) { px = x; py = y; ok = true; break; }
        theta += 0.3; radius += 0.18;
      }
      if (!ok) continue;
      placed.push({ x: px, y: py, w: bw, h: bh });
      wcPlacedWords.push({ word: w.word, box: { x: px, y: py, w: bw, h: bh } });
      ctx.save(); ctx.translate(px + bw / 2, py + bh / 2); if (rot !== 0) ctx.rotate(rot * Math.PI / 180); ctx.fillStyle = PALETTE[i % PALETTE.length]; ctx.fillText(w.word, 0, 0); ctx.restore();
    }
  }
  // Hit-test a CSS-relative (x,y) against the placed-word boxes; returns the topmost word or null.
  function hitTestWord(x, y) {
    for (var i = wcPlacedWords.length - 1; i >= 0; i--) {
      var p = wcPlacedWords[i].box;
      if (x >= p.x && x <= p.x + p.w && y >= p.y && y <= p.y + p.h) {
        return wcPlacedWords[i].word;
      }
    }
    return null;
  }
  // ---- Date Spectrum Slider (for word cloud) — REWRITTEN ----
  // A dual-handle range slider on a date spectrum from the first ticket date
  // to today. The slider bar is ALWAYS LTR (left = past, right = present)
  // regardless of page direction, because a timeline is inherently LTR.
  // Labels and text around it are RTL/LTR aware.
  // Dates show Jalali in Persian mode, Gregorian in English mode.
  function createDateSpectrumSlider(opts) {
    opts = opts || {};
    var minDate = opts.min || new Date(Date.now() - 90 * 86400000);
    var maxDate = opts.max || new Date();
    var initStart = opts.start || minDate;
    var initEnd = opts.end || maxDate;
    var onChange = opts.onChange || function () {};
    var lang = state.lang;

    var wrap = el('div', { class: 'wc-spectrum-wrap' });
    var title = el('div', { class: 'wc-spectrum-title' }, [
      ICONS.calendarRange,
      el('span', {}, lang === 'fa' ? 'بازه زمانی ابر واژگان' : 'Word Cloud Date Range')
    ]);
    wrap.appendChild(title);

    // The bar is always LTR (direction:ltr) — timeline goes left→right
    var bar = el('div', { class: 'wc-spectrum-bar', style: 'direction:ltr;', tabindex: '0' });
    var rangeEl = el('div', { class: 'wc-spectrum-range' });
    var startHandle = el('div', { class: 'wc-spectrum-handle wc-spectrum-handle-start', title: lang === 'fa' ? 'تاریخ شروع (کشیدن)' : 'Start date (drag)' });
    var endHandle = el('div', { class: 'wc-spectrum-handle wc-spectrum-handle-end', title: lang === 'fa' ? 'تاریخ پایان (کشیدن)' : 'End date (drag)' });
    bar.appendChild(rangeEl);
    bar.appendChild(startHandle);
    bar.appendChild(endHandle);
    wrap.appendChild(bar);

    // Labels: in RTL, "first date" is on the right; in LTR, on the left.
    // But since the bar is LTR, we show min date on left, max date on right.
    var labels = el('div', { class: 'wc-spectrum-labels', style: 'direction:ltr;' }, [
      el('span', {}, formatJalali(minDate, lang)),
      el('span', {}, formatJalali(maxDate, lang))
    ]);
    wrap.appendChild(labels);

    var selectedDisplay = el('div', { class: 'wc-spectrum-selected' });
    wrap.appendChild(selectedDisplay);

    // Internal state (always in milliseconds, LTR timeline)
    var minMs = minDate.getTime();
    var maxMs = maxDate.getTime();
    // Clamp initial start/end to the [min, max] range
    var startMs = Math.max(initStart.getTime(), minMs);
    var endMs = Math.min(initEnd.getTime(), maxMs);
    if (endMs < startMs) { endMs = Math.min(startMs + 86400000, maxMs); }
    var totalMs = maxMs - minMs;
    if (totalMs <= 0) totalMs = 86400000;

    function pctToMs(pct) { return minMs + (pct / 100) * totalMs; }
    function msToPct(ms) { return ((ms - minMs) / totalMs) * 100; }
    function clamp(v, min, max) { return Math.max(min, Math.min(max, v)); }

    function updateUI() {
      var startPct = msToPct(startMs);
      var endPct = msToPct(endMs);
      // Always use `left` since the bar is direction:ltr
      startHandle.style.left = startPct + '%';
      startHandle.style.right = '';
      endHandle.style.left = endPct + '%';
      endHandle.style.right = '';
      rangeEl.style.left = startPct + '%';
      rangeEl.style.right = '';
      rangeEl.style.width = (endPct - startPct) + '%';

      // Update selected range display
      var startDate = new Date(startMs);
      var endDate = new Date(endMs);
      var dayCount = Math.round((endMs - startMs) / 86400000) + 1;
      // Format: "start_date — end_date (N days)"
      // In RTL, the order should be start→end reading right-to-left
      var sep = lang === 'fa' ? ' — ' : ' — ';
      selectedDisplay.innerHTML =
        '<span class="wc-range-badge">' + formatJalali(startDate, lang) + '</span>' +
        '<span>' + sep + '</span>' +
        '<span class="wc-range-badge">' + formatJalali(endDate, lang) + '</span>' +
        '<span style="font-size:11px;color:var(--muted-fg);font-weight:400">(' + digits(dayCount, lang) + ' ' + (lang === 'fa' ? 'روز' : 'days') + ')</span>';
    }

    // Drag handling — uses pointer events for touch+mouse support
    var dragging = null;
    function onPointerDown(e, which) {
      e.preventDefault();
      e.stopPropagation();
      dragging = which;
      document.addEventListener('pointermove', onPointerMove);
      document.addEventListener('pointerup', onPointerUp);
    }
    function onPointerMove(e) {
      if (!dragging) return;
      var rect = bar.getBoundingClientRect();
      // Since the bar is direction:ltr, x is always left-to-right
      var x = e.clientX - rect.left;
      var pct = clamp((x / rect.width) * 100, 0, 100);
      var ms = pctToMs(pct);
      if (dragging === 'start') {
        startMs = clamp(ms, minMs, endMs - 86400000);
      } else {
        endMs = clamp(ms, startMs + 86400000, maxMs);
      }
      updateUI();
    }
    function onPointerUp() {
      if (dragging) {
        dragging = null;
        document.removeEventListener('pointermove', onPointerMove);
        document.removeEventListener('pointerup', onPointerUp);
        onChange(new Date(startMs), new Date(endMs));
      }
    }
    startHandle.addEventListener('pointerdown', function (e) { onPointerDown(e, 'start'); });
    endHandle.addEventListener('pointerdown', function (e) { onPointerDown(e, 'end'); });

    // Click on bar to move the nearest handle
    bar.addEventListener('click', function (e) {
      if (e.target === startHandle || e.target === endHandle) return;
      var rect = bar.getBoundingClientRect();
      var x = e.clientX - rect.left;
      var pct = (x / rect.width) * 100;
      var ms = pctToMs(pct);
      if (Math.abs(ms - startMs) < Math.abs(ms - endMs)) {
        startMs = clamp(ms, minMs, endMs - 86400000);
      } else {
        endMs = clamp(ms, startMs + 86400000, maxMs);
      }
      updateUI();
      onChange(new Date(startMs), new Date(endMs));
    });

    updateUI();

    // Public API
    wrap.getRange = function () { return { start: new Date(startMs), end: new Date(endMs) }; };
    wrap.setRange = function (s, e) { startMs = s.getTime(); endMs = e.getTime(); updateUI(); };
    return wrap;
  }

  function renderWordcloud(c) {
    c.innerHTML = '';
    c.appendChild(sectionHead(t('wordcloudTitle'), t('realtimeWordcloud' in I18N ? t('realtimeWordcloud') : t('wordcloudDesc')), [periodSelector()]));
    var card = el('div', { class: 'card' });
    var head = el('div', { class: 'card-head bg-muted' }, [
      el('div', {}, [el('div', { style: 'display:flex;align-items:center;gap:8px' }, [el('div', { class: 'card-title' }, t('wordcloudTitle')), el('span', { class: 'badge badge-emerald' }, [el('span', { class: 'live-dot' }), ' ' + t('live')])]), el('div', { class: 'card-desc' }, t('wordcloudDesc'))]),
      el('div', { style: 'display:flex;gap:8px' }, [
        el('button', { class: 'btn', onclick: function () { state._wcRefresh = Date.now(); renderWordcloud(c); } }, [ICONS.refresh, el('span', { style: 'display:none;' }, t('refreshNow'))]),
        el('button', { class: 'btn btn-primary', onclick: function () { var cv = document.getElementById('wc-canvas'); if (cv) downloadCanvasPng(cv, 'ticket-wordcloud-' + new Date().toISOString().slice(0, 10)); } }, [ICONS.download, el('span', {}, t('wordcloudDownload'))]),
      ]),
    ]);
    // fix refresh button text
    head.children[1].children[0].lastChild.style.display = '';
    head.children[1].children[0].lastChild.textContent = t('refreshNow');
    // canvas wrapped in a relative container so the hint badge can float in the corner
    var canvasWrap = el('div', { style: 'position:relative;width:100%;' });
    var canvas = el('canvas', { id: 'wc-canvas', class: 'wc-canvas' });
    canvas.addEventListener('click', function (e) {
      var rect = canvas.getBoundingClientRect();
      var x = e.clientX - rect.left;
      var y = e.clientY - rect.top;
      var hit = hitTestWord(x, y);
      if (hit) openWordDrilldown(hit);
    });
    canvas.addEventListener('mousemove', function (e) {
      var rect = canvas.getBoundingClientRect();
      var x = e.clientX - rect.left;
      var y = e.clientY - rect.top;
      canvas.style.cursor = hitTestWord(x, y) ? 'pointer' : 'default';
    });
    canvasWrap.appendChild(canvas);
    var hintBadge = el('div', { class: 'wc-hint-badge no-print' }, [ICONS.mousePointerClick, ' ' + t('clickWordHint')]);
    canvasWrap.appendChild(hintBadge);
    var body = el('div', { class: 'card-body', style: 'padding:0;' }, [canvasWrap]);
    var kw = el('div', { class: 'wc-keywords', id: 'wc-keywords' }, '<span class="kw-label">' + t('topKeywords') + ':</span>');
    card.appendChild(head);

    // ---- Date spectrum slider ----
    // Fetch the first ticket date to build the spectrum, then add the slider
    // between the head and the canvas body.
    var spectrumContainer = el('div', { id: 'wc-spectrum-container' });
    card.appendChild(spectrumContainer);

    card.appendChild(body); card.appendChild(kw);
    c.appendChild(card);

    // Fetch tickets to determine the spectrum range (oldest ticket → today)
    // Store a reference to the slider so the period selector can update it
    var wcSlider = null;
    api('tickets', { limit: 200 }).then(function (res) {
      var tickets = (res && res.tickets) || [];
      var oldestDate = null;
      tickets.forEach(function (tk) {
        if (tk.createdAt) {
          var d = new Date(tk.createdAt);
          if (!oldestDate || d < oldestDate) oldestDate = d;
        }
      });
      var today = new Date();
      var minDate = oldestDate || new Date(Date.now() - 365 * 86400000);
      // Default selected range: last `state.period` days
      var initStart = new Date(today);
      initStart.setDate(initStart.getDate() - (state.period || 30));
      var initEnd = today;

      wcSlider = createDateSpectrumSlider({
        min: minDate,
        max: today,
        start: initStart,
        end: initEnd,
        onChange: function (from, to) {
          fetchWordcloud(from, to);
        }
      });
      spectrumContainer.appendChild(wcSlider);
      // Initial fetch with the slider's default range
      fetchWordcloud(initStart, initEnd);
    }).catch(function () {
      // Fallback: just use the period-based fetch
      api('wordcloud', { period: state.period }).then(function (words) { renderWordcloudData(words); });
    });

    /** Fetch word cloud for a custom date range. Uses `from`/`to` params
     *  which the mock API supports. Falls back to `period` param. */
    function fetchWordcloud(from, to) {
      var days = Math.max(1, Math.round((to.getTime() - from.getTime()) / 86400000) + 1);
      // Show loading state
      var cv = document.getElementById('wc-canvas');
      if (cv) {
        var ctx = cv.getContext('2d');
        ctx.clearRect(0, 0, cv.width, cv.height);
        ctx.fillStyle = '#64748b';
        ctx.font = '14px Vazirmatn';
        ctx.textAlign = 'center';
        ctx.fillText(state.lang === 'fa' ? 'در حال بارگذاری...' : 'Loading...', cv.width / 2, cv.height / 2);
      }
      api('wordcloud', { from: toInputValue(from), to: toInputValue(to), size: 80, period: days }).then(function (words) {
        renderWordcloudData(words);
      }).catch(function () {
        api('wordcloud', { period: days }).then(function (words) { renderWordcloudData(words); });
      });
    }

    function renderWordcloudData(words) {
      state.data.wc = words;
      var cv = document.getElementById('wc-canvas');
      if (cv) renderWc(cv, words);
      var top10 = words.slice(0, 10);
      // Top-10 keyword badges are now clickable — open the drill-down modal.
      document.getElementById('wc-keywords').innerHTML = '<span class="kw-label">' + t('topKeywords') + ':</span>' + top10.map(function (w, i) {
        return '<button type="button" class="wc-kw-btn" data-word="' + escHtml(w.word) + '" title="' + escHtml(w.word) + '"><span class="badge badge-muted" style="color:' + PALETTE[i % PALETTE.length] + '"><span style="font-weight:600">' + escHtml(w.word) + '</span> <span style="color:var(--muted-fg)">' + toFa(formatNum(w.count, state.lang)) + '</span></span></button>';
      }).join('') + '<div class="wc-meta-line">' + ICONS.refresh + '<span>' + t('generatedAt') + ': ' + formatTime(new Date(), state.lang) + ' · ' + toFa(words.length) + ' ' + (state.lang === 'fa' ? 'واژه منحصر' : 'unique words') + '</span></div>';
      // wire up keyword badge clicks
      var kwBtns = document.getElementById('wc-keywords').querySelectorAll('.wc-kw-btn');
      Array.prototype.forEach.call(kwBtns, function (b) {
        b.addEventListener('click', function () { openWordDrilldown(b.getAttribute('data-word')); });
      });
      // live refresh
      if (state._wcInterval) clearInterval(state._wcInterval);
      state._wcInterval = setInterval(function () {
        api('wordcloud', { period: state.period }).then(function (w2) {
          var cv2 = document.getElementById('wc-canvas');
          if (cv2 && state.section === 'wordcloud') renderWc(cv2, w2);
        }).catch(function () {});
      }, 15000);
    }
  }

  // ---- helpers ----
  function getCss(v) { return getComputedStyle(document.documentElement).getPropertyValue(v).trim() || '#ccc'; }
  function escHtml(s) { return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;'); }
  function toggleTheme() { state.theme = state.theme === 'dark' ? 'light' : 'dark'; document.documentElement.dataset.theme = state.theme; localStorage.setItem('zr-theme', state.theme); destroyCharts(); renderSection(); }
  /** Re-render whichever view is currently active (login or dashboard). */
  function rerender() {
    if (window.__CONFIG__ && window.__CONFIG__.authenticated) renderDashboard();
    else renderLogin();
  }
  /** Cycle to the next available language (keyboard shortcut: l). */
  function cycleLang() {
    if (!LANG_META.length) return;
    var idx = -1;
    for (var i = 0; i < LANG_META.length; i++) if (LANG_META[i].code === state.lang) { idx = i; break; }
    var next = LANG_META[(idx + 1) % LANG_META.length];
    setLang(next.code);
  }
  /** Language picker dropdown (portaled, like the export menu). */
  function langDropdown() {
    var dd = el('div', { class: 'dropdown' });
    // Re-render hygiene: drop any orphaned menu left by a previous render.
    document.querySelectorAll('.lang-menu').forEach(function (m) { m.remove(); });
    var trigger = el('button', { class: 'icon-btn no-print lang-btn', type: 'button', title: t('language'), 'aria-haspopup': 'listbox' }, [
      ICONS.globe, el('span', { style: 'font-size:11px;font-weight:700;letter-spacing:0.02em;' }, state.lang.split('-')[0].toUpperCase()),
    ]);
    var menu = el('div', { class: 'dropdown-menu lang-menu', role: 'listbox', style: 'position:fixed;z-index:10001;' });
    menu.addEventListener('click', function (e) { e.stopPropagation(); });
    document.body.appendChild(menu);

    function buildMenu() {
      menu.innerHTML = '';
      menu.appendChild(el('div', { class: 'dropdown-label' }, t('selectLanguage')));
      menu.appendChild(el('div', { class: 'dropdown-sep' }));
      LANG_META.forEach(function (l) {
        var active = l.code === state.lang;
        var item = el('button', {
          class: 'dropdown-item' + (active ? ' active' : ''), type: 'button', role: 'option',
          'aria-selected': active ? 'true' : 'false',
          onclick: function () { close(); setLang(l.code); },
        }, [
          el('span', { style: 'flex:1;' }, l.name),
          el('span', { class: 'lang-dir' }, (l.dir || 'ltr').toUpperCase()),
          active ? el('span', { html: ICONS.check }) : null,
        ]);
        menu.appendChild(item);
      });
    }
    function positionMenu() {
      buildMenu();
      var rect = trigger.getBoundingClientRect();
      var menuW = 232, menuH = Math.min(340, LANG_META.length * 34 + 60);
      var left = rect.right - menuW;
      if (left < 8) left = 8;
      var top = rect.bottom + 4;
      if (top + menuH > window.innerHeight) top = rect.top - menuH - 4;
      if (top < 8) top = 8;
      menu.style.left = left + 'px';
      menu.style.top = top + 'px';
    }
    function toggle() {
      var isOpen = menu.classList.contains('open');
      document.querySelectorAll('.dropdown-menu.open').forEach(function (m) { if (m !== menu) m.classList.remove('open'); });
      menu.classList.toggle('open', !isOpen);
      if (!isOpen) positionMenu();
    }
    function close() { menu.classList.remove('open'); }
    trigger.addEventListener('click', function (e) { e.stopPropagation(); toggle(); });
    document.addEventListener('click', function (e) { if (!menu.contains(e.target)) close(); });
    window.addEventListener('resize', close);
    dd.appendChild(trigger);
    return dd;
  }
  function toggleSidebar() {
    var sb = document.getElementById('sidebar');
    var ov = document.getElementById('overlay');
    if (!sb) return;
    var isOpen = sb.classList.toggle('mobile-open');
    if (ov) {
      if (isOpen) ov.classList.add('visible');
      else ov.classList.remove('visible');
    }
    // Lock/unlock body scroll
    document.body.classList.toggle('sidebar-open', isOpen);
  }
  function closeSidebar() {
    var sb = document.getElementById('sidebar');
    var ov = document.getElementById('overlay');
    if (sb) sb.classList.remove('mobile-open');
    if (ov) ov.classList.remove('visible');
    document.body.classList.remove('sidebar-open');
  }
  function doLogout() { api('logout').then(function () { location.reload(); }); }

  // ---- Round-3 mirror: notifications, help dialog, system health, refresh-all, word drill-down, sidebar mini-stats ----

  var NOTIF_META = {
    sla_breach:        { icon: 'alertTriangle', key: 'ntfSlaBreach',       sev: 'critical' },
    escalation:        { icon: 'flame',         key: 'ntfEscalation',      sev: 'critical' },
    overdue_pending:   { icon: 'clock',         key: 'ntfOverduePending',  sev: 'warning'  },
    high_priority_open:{ icon: 'alertOctagon',  key: 'ntfHighPriorityOpen',sev: 'warning'  },
    no_owner:          { icon: 'userX',         key: 'ntfNoOwner',         sev: 'info'     },
    agent_idle:        { icon: 'userX',         key: 'ntfAgentIdle',       sev: 'info'     },
  };
  var SEV_BAR_COLOR = { critical: '#dc2626', warning: '#d97706', info: '#0891b2' };
  var SEV_RING = {
    critical: 'background:rgba(220,38,38,0.12);color:#dc2626;',
    warning:  'background:rgba(217,119,6,0.12);color:#d97706;',
    info:     'background:rgba(8,145,178,0.12);color:#0891b2;',
  };

  // ---- Notifications: data fetch + read-state + render ----
  function fetchNotifications() {
    return api('notifications', { limit: 20 }).then(function (list) {
      state.notifications = Array.isArray(list) ? list : [];
      updateNotificationsBadge();
      // if the panel is open, refresh its body too
      if (state.notificationsOpen) {
        var body = document.getElementById('notif-panel-body');
        if (body) body.innerHTML = notificationsPanelBodyHtml();
      }
    }).catch(function () { /* silent — panel just stays empty */ });
  }
  function startNotificationsTicker() {
    if (state._notifInterval) clearInterval(state._notifInterval);
    state._notifInterval = setInterval(function () { fetchNotifications(); }, 30000);
  }
  function unreadCount() {
    var n = 0;
    for (var i = 0; i < state.notifications.length; i++) {
      if (!state.readNotifications.has(state.notifications[i].id)) n++;
    }
    return n;
  }
  function updateNotificationsBadge() {
    var badge = document.getElementById('notif-badge');
    var count = unreadCount();
    if (badge) {
      badge.style.display = count > 0 ? 'flex' : 'none';
      badge.textContent = count > 99 ? (state.lang === 'fa' ? '۹۹+' : '99+') : digits(count, state.lang);
    }
  }
  function markAllNotificationsRead() {
    for (var i = 0; i < state.notifications.length; i++) {
      state.readNotifications.add(state.notifications[i].id);
    }
    persistReadNotifications();
    updateNotificationsBadge();
    if (state.notificationsOpen) {
      var body = document.getElementById('notif-panel-body');
      if (body) body.innerHTML = notificationsPanelBodyHtml();
    }
  }
  function markNotificationRead(id) {
    state.readNotifications.add(id);
    persistReadNotifications();
    updateNotificationsBadge();
    if (state.notificationsOpen) {
      var body = document.getElementById('notif-panel-body');
      if (body) body.innerHTML = notificationsPanelBodyHtml();
    }
  }
  function handleNotificationClick(n) {
    markNotificationRead(n.id);
    closeNotificationsPanel();
    // SLA breaches & escalations route to the SLA section; everything else to Tickets
    if (n.type === 'sla_breach' || n.type === 'escalation') navigate('sla');
    else navigate('tickets');
  }
  function notificationsPanelBodyHtml() {
    if (!state.notifications.length) {
      return '<div class="notif-empty">' + ICONS.checkCheck + '<p>' + t('noNotifications') + '</p></div>';
    }
    // group by severity
    var groups = { critical: [], warning: [], info: [] };
    for (var i = 0; i < state.notifications.length; i++) {
      var n = state.notifications[i];
      if (groups[n.severity]) groups[n.severity].push(n);
    }
    var html = '';
    ['critical', 'warning', 'info'].forEach(function (sev) {
      var list = groups[sev];
      if (!list.length) return;
      html += '<div class="notif-group-label">' + t(sev) + ' · ' + digits(list.length, state.lang) + '</div>';
      html += '<ul class="notif-list">';
      list.forEach(function (n) {
        var meta = NOTIF_META[n.type] || NOTIF_META.no_owner;
        var isUnread = !state.readNotifications.has(n.id);
        var title = (state.lang === 'fa' ? n.title_fa : n.title) || n.title || '';
        var detail = (state.lang === 'fa' ? n.detail_fa : n.detail) || n.detail || '';
        var num = n.ticket_number || ('#' + n.ticket_id);
        var rel = formatRelativeTime(n.at, state.lang, new Date());
        html += '<li class="notif-item' + (isUnread ? ' unread' : '') + '" data-nid="' + escHtml(n.id) + '">' +
          '<span class="notif-severity-bar" style="background:' + SEV_BAR_COLOR[sev] + '"></span>' +
          '<span class="notif-icon" style="' + SEV_RING[sev] + '">' + (ICONS[meta.icon] || ICONS.bell) + '</span>' +
          '<div class="notif-body">' +
            '<div class="notif-row1"><span class="notif-title">' + escHtml(title) + '</span>' +
              (isUnread ? '<span class="notif-unread-dot"></span>' : '') + '</div>' +
            '<p class="notif-detail"><span class="notif-type">' + t(meta.key) + '</span> — ' + escHtml(detail) + '</p>' +
            '<div class="notif-meta"><span class="mono">#' + escHtml(digits(num, state.lang)) + '</span><span>·</span><span>' + rel + '</span></div>' +
          '</div>' +
        '</li>';
      });
      html += '</ul>';
    });
    return html;
  }
  function renderNotificationsButton() {
    var wrap = el('div', { class: 'notif-wrap no-print' });
    var btn = el('button', {
      class: 'icon-btn notif-btn',
      onclick: toggleNotificationsPanel,
      title: t('notifications'),
      'aria-label': t('notifications'),
      'aria-expanded': 'false',
      id: 'notif-btn',
    }, [ICONS.bell]);
    var badge = el('span', { class: 'notif-badge', id: 'notif-badge', style: 'display:none;' }, '');
    btn.appendChild(badge);
    wrap.appendChild(btn);
    // The dropdown is appended to body on open so it can overlay everything.
    return wrap;
  }
  function renderNotificationsPanel() {
    // Build the dropdown once (reused across opens)
    var panel = el('div', { class: 'notifications-panel no-print', id: 'notifications-panel', role: 'dialog', 'aria-label': t('notificationsTitle') });
    // Header
    var head = el('div', { class: 'notif-head' }, [
      el('div', { class: 'notif-head-left' }, [
        el('span', { class: 'notif-head-icon', html: ICONS.bell }),
        el('h3', {}, t('notificationsTitle')),
        el('span', { class: 'notif-head-count', id: 'notif-head-count' }, ''),
      ]),
      el('div', { class: 'notif-head-right' }, [
        el('button', { class: 'notif-mark-all', onclick: markAllNotificationsRead, title: t('markAllRead') }, [ICONS.checkCheck, el('span', { class: 'notif-mark-all-label' }, t('markAllRead'))]),
        el('button', { class: 'icon-btn notif-close', onclick: closeNotificationsPanel, 'aria-label': 'close', title: t('scClose') }, [ICONS.x]),
      ]),
    ]);
    panel.appendChild(head);
    // Body
    var body = el('div', { class: 'notif-body scrollbar-custom', id: 'notif-panel-body' }, notificationsPanelBodyHtml());
    panel.appendChild(body);
    // Footer
    var footer = el('div', { class: 'notif-footer' }, [
      el('button', { class: 'notif-view-tickets', onclick: function () { closeNotificationsPanel(); navigate('tickets'); } }, t('viewTickets') + ' →'),
    ]);
    panel.appendChild(footer);
    return panel;
  }
  function toggleNotificationsPanel() {
    if (state.notificationsOpen) closeNotificationsPanel();
    else openNotificationsPanel();
  }
  function openNotificationsPanel() {
    // close other open popovers/dialogs first
    closeHealthPopover();
    closeHelpDialog();
    state.notificationsOpen = true;
    var btn = document.getElementById('notif-btn');
    if (btn) btn.setAttribute('aria-expanded', 'true');
    var panel = renderNotificationsPanel();
    // Position: anchor to the bell button. Use fixed positioning at viewport coords.
    document.body.appendChild(panel);
    positionNotificationsPanel();
    updateNotificationsBadge();
    // update header count
    var hc = document.getElementById('notif-head-count');
    if (hc) {
      var n = unreadCount();
      hc.textContent = n > 0 ? (digits(n, state.lang) + ' ' + t('newLabel')) : '';
      hc.style.display = n > 0 ? '' : 'none';
    }
    // wire item clicks
    wireNotificationItemClicks();
    // dismiss on outside click + Esc
    setTimeout(function () {
      document.addEventListener('mousedown', onNotifOutsideClick);
      document.addEventListener('keydown', onNotifEsc);
      window.addEventListener('resize', positionNotificationsPanel);
    }, 0);
  }
  function positionNotificationsPanel() {
    var panel = document.getElementById('notifications-panel');
    var btn = document.getElementById('notif-btn');
    if (!panel || !btn) return;
    var rect = btn.getBoundingClientRect();
    var panelW = Math.min(window.innerWidth - 24, 420);
    panel.style.width = panelW + 'px';
    // In RTL (fa) anchor to the LEFT edge of the button; in LTR anchor to the RIGHT.
    var left;
    if (state.lang === 'fa') {
      left = rect.right - panelW; // opens to the left
    } else {
      left = rect.left; // opens to the right
    }
    if (left < 12) left = 12;
    if (left + panelW > window.innerWidth - 12) left = window.innerWidth - panelW - 12;
    panel.style.left = left + 'px';
    panel.style.top = (rect.bottom + 8) + 'px';
  }
  function onNotifOutsideClick(e) {
    var panel = document.getElementById('notifications-panel');
    var btn = document.getElementById('notif-btn');
    if (panel && !panel.contains(e.target) && btn && !btn.contains(e.target)) {
      closeNotificationsPanel();
    }
  }
  function onNotifEsc(e) { if (e.key === 'Escape') closeNotificationsPanel(); }
  function closeNotificationsPanel() {
    state.notificationsOpen = false;
    var panel = document.getElementById('notifications-panel');
    if (panel) panel.remove();
    var btn = document.getElementById('notif-btn');
    if (btn) btn.setAttribute('aria-expanded', 'false');
    document.removeEventListener('mousedown', onNotifOutsideClick);
    document.removeEventListener('keydown', onNotifEsc);
    window.removeEventListener('resize', positionNotificationsPanel);
  }
  function wireNotificationItemClicks() {
    var panel = document.getElementById('notifications-panel');
    if (!panel) return;
    var items = panel.querySelectorAll('.notif-item');
    Array.prototype.forEach.call(items, function (it) {
      it.addEventListener('click', function () {
        var nid = it.getAttribute('data-nid');
        var n = null;
        for (var i = 0; i < state.notifications.length; i++) {
          if (state.notifications[i].id === nid) { n = state.notifications[i]; break; }
        }
        if (n) handleNotificationClick(n);
      });
    });
  }

  // ---- Help dialog ----
  var SHORTCUTS_LIST = [
    { key: 'Ctrl K', keyFa: 'Ctrl+K', descKey: 'scOpenPalette' },
    { key: '?',      keyFa: '?',      descKey: 'scHelp' },
    { key: 'Esc',    keyFa: 'Esc',    descKey: 'scClose' },
    { key: 'r',      keyFa: 'r',      descKey: 'scRefresh' },
    { key: 't',      keyFa: 't',      descKey: 'scToggleTheme' },
    { key: 'l',      keyFa: 'l',      descKey: 'scToggleLang' },
    { key: 'g o',    keyFa: 'g o',    descKey: 'scGoOverview' },
    { key: 'g c',    keyFa: 'g c',    descKey: 'scGoChannels' },
    { key: 'g a',    keyFa: 'g a',    descKey: 'scGoAgents' },
    { key: 'g t',    keyFa: 'g t',    descKey: 'scGoTickets' },
    { key: 'g w',    keyFa: 'g w',    descKey: 'scGoWordcloud' },
  ];
  function renderHelpButton() {
    var btn = el('button', {
      class: 'icon-btn no-print',
      onclick: toggleHelpDialog,
      title: t('helpTitle') + ' (?)',
      'aria-label': t('helpTitle'),
      id: 'help-btn',
    }, [ICONS.helpCircle]);
    return btn;
  }
  function toggleHelpDialog() { if (state.helpOpen) closeHelpDialog(); else openHelpDialog(); }
  function openHelpDialog() {
    closeNotificationsPanel();
    closeHealthPopover();
    state.helpOpen = true;
    var overlay = el('div', { class: 'help-dialog-overlay no-print', id: 'help-dialog-overlay', role: 'dialog', 'aria-modal': 'true', 'aria-label': t('helpTitle') });
    var dialog = el('div', { class: 'help-dialog animate-pop-in' });
    // Header
    var head = el('div', { class: 'help-head' }, [
      el('div', { class: 'help-head-left' }, [
        el('div', { class: 'help-head-icon', html: ICONS.keyboard }),
        el('div', {}, [el('h2', {}, t('helpTitle')), el('p', { class: 'help-head-desc' }, t('helpDesc'))]),
      ]),
      el('button', { class: 'icon-btn', onclick: closeHelpDialog, 'aria-label': 'close', title: t('scClose') }, [ICONS.x]),
    ]);
    dialog.appendChild(head);
    // Body — 2 columns: shortcuts | tips
    var body = el('div', { class: 'help-body scrollbar-custom' });
    // Shortcuts column
    var scCol = el('div', { class: 'help-col' }, [el('h3', { class: 'help-col-title' }, t('shortcutAction'))]);
    var scList = el('ul', { class: 'shortcut-list' });
    SHORTCUTS_LIST.forEach(function (sc) {
      var kbdHtml = (state.lang === 'fa' ? sc.keyFa : sc.key).split(' ').map(function (k, i) {
        return (i > 0 ? '<span class="kbd-plus">+</span>' : '') + '<span class="kbd-key">' + escHtml(k) + '</span>';
      }).join('');
      var li = el('li', { class: 'shortcut-row' });
      li.innerHTML = '<span class="shortcut-desc">' + t(sc.descKey) + '</span><kbd class="shortcut-kbd">' + kbdHtml + '</kbd>';
      scList.appendChild(li);
    });
    scCol.appendChild(scList);
    body.appendChild(scCol);
    // Tips column
    var tipsCol = el('div', { class: 'help-col' }, [
      el('div', { class: 'tips-head' }, [el('span', { class: 'tips-icon', html: ICONS.lightbulb }), el('h3', { class: 'help-col-title' }, t('tipsTitle'))]),
    ]);
    var tipsList = el('ul', { class: 'tips-list' });
    ['tip1', 'tip2', 'tip3', 'tip4'].forEach(function (tipKey, i) {
      var li = el('li', { class: 'tip-card' });
      li.innerHTML = '<span class="tip-num">' + digits(i + 1, state.lang) + '</span><span class="tip-text">' + t(tipKey) + '</span>';
      tipsList.appendChild(li);
    });
    tipsCol.appendChild(tipsList);
    // Quick action buttons
    var quickActions = el('div', { class: 'tips-quick-actions' }, [
      el('button', { class: 'btn', onclick: function () { toggleTheme(); } }, (state.theme === 'dark' ? '☀ ' : '☾ ') + t('scToggleTheme')),
      el('button', { class: 'btn', onclick: closeHelpDialog }, t('scClose') + ' (Esc)'),
    ]);
    tipsCol.appendChild(quickActions);
    body.appendChild(tipsCol);
    dialog.appendChild(body);
    // Footer
    var footer = el('div', { class: 'help-footer' }, t('appName') + ' · ' + t('appSubtitle'));
    dialog.appendChild(footer);
    overlay.appendChild(dialog);
    overlay.addEventListener('click', function (e) { if (e.target === overlay) closeHelpDialog(); });
    document.body.appendChild(overlay);
    document.addEventListener('keydown', onHelpEsc);
  }
  function onHelpEsc(e) { if (e.key === 'Escape') closeHelpDialog(); }
  function closeHelpDialog() {
    state.helpOpen = false;
    var ov = document.getElementById('help-dialog-overlay');
    if (ov) ov.remove();
    document.removeEventListener('keydown', onHelpEsc);
  }

  // ---- System health pill + popover ----
  function startHealthPillTicker() {
    if (state._healthInterval) clearInterval(state._healthInterval);
    // initial render uses the seeded latency (42ms)
    updateHealthPillDom();
    state._healthInterval = setInterval(function () {
      // Mock ping: 20–100ms, healthy while under 200
      state.healthLatency = Math.round(20 + Math.random() * 80);
      updateHealthPillDom();
    }, 30000);
  }
  function updateHealthPillDom() {
    var latencyEl = document.getElementById('health-latency');
    if (latencyEl) latencyEl.textContent = digits(state.healthLatency, state.lang) + 'ms';
    // if popover open, refresh its latency too
    var popLat = document.getElementById('health-pop-latency');
    if (popLat) popLat.textContent = digits(state.healthLatency, state.lang) + ' ms';
  }
  function renderSystemHealthPill() {
    var wrap = el('div', { class: 'system-health-wrap no-print' });
    var btn = el('button', {
      class: 'system-health-pill',
      onclick: toggleHealthPopover,
      title: t('esConnected'),
      id: 'health-pill-btn',
    });
    btn.innerHTML =
      '<span class="health-dot-wrap">' +
        '<span class="health-dot-ping"></span>' +
        '<span class="health-dot"></span>' +
      '</span>' +
      '<span class="health-label">' + t('systemHealthy') + '</span>' +
      '<span class="health-sep">·</span>' +
      '<span class="health-latency" id="health-latency">' + digits(state.healthLatency, state.lang) + 'ms</span>';
    wrap.appendChild(btn);
    return wrap;
  }
  function toggleHealthPopover() { if (state.healthOpen) closeHealthPopover(); else openHealthPopover(); }
  function openHealthPopover() {
    closeNotificationsPanel();
    closeHelpDialog();
    state.healthOpen = true;
    var pop = el('div', { class: 'system-health-popover no-print', id: 'system-health-popover' });
    var healthy = state.healthLatency < 200;
    var head = el('div', { class: 'health-pop-head' }, [
      el('span', { class: 'health-pop-dot', style: 'background:' + (healthy ? '#16a34a' : '#dc2626') }),
      el('p', { class: 'health-pop-title' }, t('systemHealthy')),
    ]);
    pop.appendChild(head);
    var list = el('ul', { class: 'health-pop-list' });
    var onlineLabel = healthy ? (state.lang === 'fa' ? 'برقرار' : 'Online') : (state.lang === 'fa' ? 'قطع' : 'Offline');
    var onlineColor = healthy ? '#16a34a' : '#dc2626';
    var indices = 18; // mock index count
    list.innerHTML =
      '<li class="health-pop-row"><span class="health-pop-key">' + t('esConnected') + '</span><span class="health-pop-val" style="color:' + onlineColor + '">' + onlineLabel + '</span></li>' +
      '<li class="health-pop-row"><span class="health-pop-key">' + t('esIndices') + '</span><span class="health-pop-val mono">' + digits(formatNum(indices, state.lang), state.lang) + '</span></li>' +
      '<li class="health-pop-row"><span class="health-pop-key">' + t('esLatency') + '</span><span class="health-pop-val mono" id="health-pop-latency">' + digits(state.healthLatency, state.lang) + ' ms</span></li>';
    pop.appendChild(list);
    var footer = el('p', { class: 'health-pop-footer' }, t('poweredByElastic'));
    pop.appendChild(footer);
    document.body.appendChild(pop);
    positionHealthPopover();
    setTimeout(function () {
      document.addEventListener('mousedown', onHealthOutsideClick);
      window.addEventListener('resize', positionHealthPopover);
    }, 0);
  }
  function positionHealthPopover() {
    var pop = document.getElementById('system-health-popover');
    var btn = document.getElementById('health-pill-btn');
    if (!pop || !btn) return;
    var rect = btn.getBoundingClientRect();
    var popW = 224;
    pop.style.width = popW + 'px';
    var left;
    if (state.lang === 'fa') left = rect.right - popW;
    else left = rect.left;
    if (left < 12) left = 12;
    if (left + popW > window.innerWidth - 12) left = window.innerWidth - popW - 12;
    pop.style.left = left + 'px';
    pop.style.top = (rect.bottom + 8) + 'px';
  }
  function onHealthOutsideClick(e) {
    var pop = document.getElementById('system-health-popover');
    var btn = document.getElementById('health-pill-btn');
    if (pop && !pop.contains(e.target) && btn && !btn.contains(e.target)) closeHealthPopover();
  }
  function closeHealthPopover() {
    state.healthOpen = false;
    var pop = document.getElementById('system-health-popover');
    if (pop) pop.remove();
    document.removeEventListener('mousedown', onHealthOutsideClick);
    window.removeEventListener('resize', positionHealthPopover);
  }

  // ---- Refresh-all button + global refresh event ----
  function renderRefreshAllButton() {
    var btn = el('button', {
      class: 'icon-btn refresh-all-btn no-print',
      onclick: handleRefreshAll,
      title: t('refreshAll'),
      'aria-label': t('refreshAll'),
      id: 'refresh-all-btn',
    }, [ICONS.refreshCw]);
    return btn;
  }
  function handleRefreshAll() {
    if (state.refreshing) return;
    state.refreshing = true;
    // spin the icon
    var btn = document.getElementById('refresh-all-btn');
    if (btn) btn.classList.add('refreshing');
    // broadcast the global event so any listening section re-fetches
    window.dispatchEvent(new CustomEvent(REFRESH_EVENT));
    // re-render the current section (force data refresh)
    destroyCharts();
    renderSection();
    // also refresh side panels
    fetchSidebarStats();
    fetchNotifications();
    // stop the spinner after 800ms
    setTimeout(function () {
      state.refreshing = false;
      if (btn) btn.classList.remove('refreshing');
    }, 800);
  }

  // ---- Sidebar mini-stats card ----
  function fetchSidebarStats() {
    return api('sidebarStats').then(function (s) {
      state.sidebarStats = s;
      renderSidebarMiniStats();
    }).catch(function () { /* silent */ });
  }
  function renderSidebarMiniStats() {
    var host = document.getElementById('sidebar-mini-stats');
    if (!host) return;
    var s = state.sidebarStats;
    if (!s) { host.innerHTML = '<div class="mini-stats-skeleton"><div></div><div></div><div></div><div></div></div>'; return; }
    var items = [
      { icon: ICONS.calendarDays,  label: t('todayTickets'),      value: s.todayCount,    color: '#d97706' },
      { icon: ICONS.calendarRange, label: t('weekTickets'),       value: s.weekCount,     color: '#16a34a' },
      { icon: ICONS.circleDot,     label: t('openNow'),           value: s.openCount,     color: '#dc2626' },
      { icon: ICONS.users,         label: t('activeAgentsShort'), value: s.activeAgents,  color: 'var(--primary)' },
    ];
    host.innerHTML = items.map(function (it) {
      return '<div class="mini-stat-item">' +
        '<span class="mini-stat-icon" style="color:' + it.color + '">' + it.icon + '</span>' +
        '<div class="mini-stat-body">' +
          '<p class="mini-stat-label">' + escHtml(it.label) + '</p>' +
          '<p class="mini-stat-value">' + digits(formatNum(it.value || 0, state.lang), state.lang) + '</p>' +
        '</div>' +
      '</div>';
    }).join('');
  }

  // ---- Word drill-down modal ----
  function openWordDrilldown(word) {
    if (!word) return;
    state.wordDrilldown = word;
    state.wordDrilldownTickets = [];
    // Build the modal shell immediately (shows a loading state)
    var overlay = el('div', { class: 'word-drilldown-overlay no-print', id: 'word-drilldown-overlay', role: 'dialog', 'aria-modal': 'true', 'aria-label': t('ticketsWithWord') });
    var dialog = el('div', { class: 'word-drilldown-modal animate-pop-in' });
    // Header
    var head = el('div', { class: 'wd-head' }, [
      el('div', { class: 'wd-head-left' }, [
        el('div', { class: 'wd-head-icon', html: ICONS.search }),
        el('div', {}, [el('h2', {}, t('ticketsWithWord')), el('p', { class: 'wd-head-desc' }, t('ticketsWithWordDesc'))]),
      ]),
      el('div', { class: 'wd-head-right' }, [
        el('span', { class: 'wd-count-badge', id: 'wd-count-badge' }, '«' + escHtml(word) + '» · ' + t('loading')),
        el('button', { class: 'icon-btn', onclick: closeWordDrilldown, 'aria-label': 'close', title: t('scClose') }, [ICONS.x]),
      ]),
    ]);
    dialog.appendChild(head);
    // Body — table
    var body = el('div', { class: 'wd-body scrollbar-custom', id: 'wd-body' }, '<div class="empty">' + t('loading') + '</div>');
    dialog.appendChild(body);
    // Footer (export menu added after fetch so rows are populated)
    var footer = el('div', { class: 'wd-footer', id: 'wd-footer' });
    dialog.appendChild(footer);
    overlay.appendChild(dialog);
    overlay.addEventListener('click', function (e) { if (e.target === overlay) closeWordDrilldown(); });
    document.body.appendChild(overlay);
    document.addEventListener('keydown', onWordDrilldownEsc);

    // Fetch the matching tickets
    fetchTicketsByWord(word).then(function (tickets) {
      state.wordDrilldownTickets = tickets;
      renderWordDrilldownTable(tickets);
    }).catch(function (e) {
      var b = document.getElementById('wd-body');
      if (b) b.innerHTML = '<div class="empty">' + (e.message || t('noData')) + '</div>';
    });
  }
  function onWordDrilldownEsc(e) { if (e.key === 'Escape') closeWordDrilldown(); }
  function closeWordDrilldown() {
    state.wordDrilldown = null;
    state.wordDrilldownTickets = [];
    var ov = document.getElementById('word-drilldown-overlay');
    if (ov) ov.remove();
    document.removeEventListener('keydown', onWordDrilldownEsc);
  }
  function fetchTicketsByWord(word) {
    return api('ticketsByWord', { word: word, limit: 100 }).then(function (res) {
      // endpoint returns { tickets: [...], word: '...' }
      return (res && Array.isArray(res.tickets)) ? res.tickets : [];
    });
  }
  function renderWordDrilldownTable(tickets) {
    var body = document.getElementById('wd-body');
    var countBadge = document.getElementById('wd-count-badge');
    var footer = document.getElementById('wd-footer');
    var word = state.wordDrilldown || '';
    if (countBadge) {
      countBadge.innerHTML = '«' + escHtml(word) + '» · ' + digits(formatNum(tickets.length, state.lang), state.lang) + ' ' + t('tickets');
    }
    if (!body) return;
    if (!tickets.length) {
      body.innerHTML = '<div class="empty">' + t('noData') + '</div>';
      if (footer) footer.innerHTML = '';
      return;
    }
    var rowsHtml = tickets.map(function (tk, i) {
      var num = tk.number || ('#' + tk.id);
      var title = tk.titleFa || tk.title || '';
      var created = tk.createdAt ? formatJalali(new Date(tk.createdAt), state.lang) : '';
      return '<tr>' +
        '<td class="mono wd-num">' + digits(num, state.lang) + '</td>' +
        '<td class="wd-title truncate">' + escHtml(title) + '</td>' +
        '<td>' + stateBadge(tk.state) + '</td>' +
        '<td>' + priorityBadge(tk.priority) + '</td>' +
        '<td>' + channelBadge(tk.channel) + '</td>' +
        '<td class="mono wd-created">' + escHtml(created) + '</td>' +
      '</tr>';
    }).join('');
    body.innerHTML = '<div class="table-wrap" style="max-height:none;"><table class="wd-table"><thead class="sticky-bg"><tr>' +
      '<th>#</th><th>' + t('ticketTitle') + '</th><th>' + t('ticketState') + '</th><th>' + t('ticketPriority') + '</th><th>' + t('ticketChannel') + '</th><th>' + t('ticketCreated') + '</th>' +
      '</tr></thead><tbody>' + rowsHtml + '</tbody></table></div>';
    // Footer with count + export menu
    if (footer) {
      footer.innerHTML = '';
      var countP = el('p', { class: 'wd-footer-count' }, digits(formatNum(tickets.length, state.lang), state.lang) + ' ' + t('tickets'));
      footer.appendChild(countP);
      var rows = tickets.map(function (tk) {
        return {
          number: tk.number || ('#' + tk.id),
          title: tk.titleFa || tk.title || '',
          state: tk.state === 'open' ? t('stateOpen') : (tk.state === 'closed' ? t('stateClosed') : t('statePending')),
          priority: tk.priority === 'low' ? t('priorityLow') : (tk.priority === 'normal' ? t('priorityNormal') : (tk.priority === 'high' ? t('priorityHigh') : t('priorityUrgent'))),
          channel: tk.channel === 'email' ? t('channelEmail') : (tk.channel === 'chat' ? t('channelChat') : (tk.channel === 'phone' ? t('channelPhone') : t('channelWeb'))),
          created: tk.createdAt ? formatJalali(new Date(tk.createdAt), 'en') : '',
        };
      });
      var headers = [
        { key: 'number', label: '#' }, { key: 'title', label: t('ticketTitle') },
        { key: 'state', label: t('ticketState') }, { key: 'priority', label: t('ticketPriority') },
        { key: 'channel', label: t('ticketChannel') }, { key: 'created', label: t('ticketCreated') },
      ];
      footer.appendChild(exportMenu('ticketsByWord', rows, headers, 'word-' + word + '-tickets', t('ticketsWithWord') + ': ' + word));
    }
  }

  // ---- KPI Drill-down modal (CRON-REVIEW-5 Feature 2) ----
  // Opens when a KPI tile is clicked. Mirrors src/components/dashboard/kpi-drilldown.tsx:
  //   - Header: KPI title + bilingual description + trend badge
  //   - Mini stats grid: Mean / Std Dev / Max / Min
  //   - Anomaly banner (if any anomalies)
  //   - Main chart (Chart.js line): actual area+line, dashed cyan forecast line,
  //     forecast confidence band, ±1σ reference band, mean reference line, anomaly
  //     scatter dots (red, pulsing via CSS class on canvas wrapper)
  //   - 3 small cards: Mini Trend sparkline, 7-day Forecast Sum, Normal Range ±1σ
  //   - Related Tickets table (12 rows, key-routed sort/filter — see kpiDrilldownTickets())
  var KPI_ACCENT_COLORS = {
    total: 'var(--primary)', open: '#d97706', closed: '#16a34a', escalated: '#dc2626',
    avgResponse: '#0891b2', avgResolution: '#9333ea', activeAgents: 'var(--primary)', csat: '#16a34a'
  };
  function openKpiDrilldown(key) {
    if (!key) return;
    // close other dialogs first
    closeHelpDialog();
    closeNotificationsPanel();
    closeHealthPopover();
    closeSavedViewsPanel();
    closeSettingsDialog();
    state.kpiDrilldownKey = key;
    state.kpiDrilldownOpen = true;
    state.kpiDrilldownData = null;

    var color = KPI_ACCENT_COLORS[key] || 'var(--primary)';
    var overlay = el('div', { class: 'kpi-drilldown-overlay no-print', id: 'kpi-drilldown-overlay', role: 'dialog', 'aria-modal': 'true', 'aria-label': t('kpiDrilldown') });
    var dialog = el('div', { class: 'kpi-drilldown-modal animate-pop-in' });
    // Header
    var head = el('div', { class: 'kdd-head' }, [
      el('div', { class: 'kdd-head-left' }, [
        el('div', { class: 'kdd-head-icon', style: 'background:color-mix(in srgb,' + color + ' 12%, transparent);color:' + color + ';box-shadow:inset 0 0 0 1px color-mix(in srgb,' + color + ' 25%, transparent);', html: ICONS.activity }),
        el('div', {}, [
          el('h2', { id: 'kdd-title' }, t('loading')),
          el('p', { class: 'kdd-head-desc', id: 'kdd-desc' }, ''),
        ]),
      ]),
      el('div', { class: 'kdd-head-right' }, [
        el('span', { class: 'kdd-trend-badge', id: 'kdd-trend-badge' }, ''),
        el('button', { class: 'icon-btn', onclick: closeKpiDrilldown, 'aria-label': 'close', title: t('scClose') }, [ICONS.x]),
      ]),
    ]);
    dialog.appendChild(head);
    // Body — skeleton, replaced after fetch
    var body = el('div', { class: 'kdd-body scrollbar-custom', id: 'kdd-body' }, '<div class="skeleton" style="height:480px"></div>');
    dialog.appendChild(body);
    overlay.appendChild(dialog);
    overlay.addEventListener('click', function (e) { if (e.target === overlay) closeKpiDrilldown(); });
    document.body.appendChild(overlay);
    document.addEventListener('keydown', onKpiDrilldownEsc);

    // Fetch drilldown data
    api('kpiDrilldown', { key: key, days: state.period }).then(function (data) {
      state.kpiDrilldownData = data;
      renderKpiDrilldownBody(data, color);
    }).catch(function (e) {
      var b = document.getElementById('kdd-body');
      if (b) b.innerHTML = '<div class="empty">' + (e.message || t('noData')) + '</div>';
    });
  }
  function onKpiDrilldownEsc(e) { if (e.key === 'Escape') closeKpiDrilldown(); }
  function closeKpiDrilldown() {
    state.kpiDrilldownOpen = false;
    state.kpiDrilldownKey = null;
    state.kpiDrilldownData = null;
    // destroy the chart instance so we don't leak
    if (charts.kpiDrilldown) { try { charts.kpiDrilldown.destroy(); } catch (e) {} delete charts.kpiDrilldown; }
    var ov = document.getElementById('kpi-drilldown-overlay');
    if (ov) ov.remove();
    document.removeEventListener('keydown', onKpiDrilldownEsc);
  }
  function renderKpiDrilldownBody(data, color) {
    var titleEl = document.getElementById('kdd-title');
    var descEl = document.getElementById('kdd-desc');
    var trendBadge = document.getElementById('kdd-trend-badge');
    var body = document.getElementById('kdd-body');
    if (!body) return;
    var spark = data.sparkline || {};
    var tickets = data.tickets || [];
    var desc = data.description || {};
    var titleKey = data.titleKey || 'kpiDrilldown';
    var trend = spark.trend || 'flat';
    var trendIcon = trend === 'up' ? ICONS.trendingUp : (trend === 'down' ? ICONS.trendingUp : ICONS.activity);
    if (titleEl) titleEl.textContent = t(titleKey);
    if (descEl) descEl.textContent = state.lang === 'fa' ? (desc.fa || '') : (desc.en || '');
    if (trendBadge) {
      var trendCls = trend === 'up' ? 'kdd-trend-up' : (trend === 'down' ? 'kdd-trend-down' : 'kdd-trend-flat');
      trendBadge.className = 'kdd-trend-badge ' + trendCls;
      trendBadge.innerHTML = trendIcon + ' ' + t(trend);
    }

    // Mini stats grid (Mean / Std Dev / Max / Min)
    var vals = (spark.points || []).map(function (p) { return p.value; });
    var maxV = vals.length ? Math.max.apply(null, vals) : 0;
    var minV = vals.length ? Math.min.apply(null, vals) : 0;
    var statsHtml = [
      ['mean', digits(formatNum(Math.round(spark.mean || 0), state.lang), state.lang), 'kdd-stat-cyan'],
      ['stdDev', digits(formatNum(Math.round(spark.stddev || 0), state.lang), state.lang), 'kdd-stat-amber'],
      ['max', digits(formatNum(maxV, state.lang), state.lang), 'kdd-stat-emerald'],
      ['min', digits(formatNum(minV, state.lang), state.lang), 'kdd-stat-rose'],
    ].map(function (row) {
      return '<div class="kdd-stat-tile ' + row[2] + '"><p class="kdd-stat-label">' + t(row[0]) + '</p><p class="kdd-stat-value">' + row[1] + '</p></div>';
    }).join('');

    // Anomaly banner
    var anomCount = (spark.anomalies || []).length;
    var anomBannerHtml = anomCount > 0
      ? '<div class="kdd-anom-banner"><span class="kdd-anom-icon">' + ICONS.alertTriangle + '</span><p>'
        + (state.lang === 'fa'
          ? digits(anomCount, state.lang) + ' نقطه خارج از محدوده ±۲ انحراف معیار شناسایی شد (نقاط قرمز در نمودار).'
          : anomCount + ' point(s) detected outside ±2σ (red dots in the chart).')
        + '</p></div>'
      : '';

    // Main chart host (Chart.js line — actual + forecast band + mean line + anomalies)
    var chartHostHtml =
      '<div class="kdd-chart-card">'
      + '<div class="kdd-chart-head">'
        + '<p class="kdd-chart-title">' + t('dailyTrend') + ' + ' + t('forecast7d') + '</p>'
        + '<div class="kdd-chart-legend">'
          + '<span class="kdd-leg-item"><span class="kdd-leg-dot" style="background:' + color + '"></span>' + t('actual') + '</span>'
          + '<span class="kdd-leg-item"><span class="kdd-leg-dot" style="background:#0891b2;opacity:0.6"></span>' + t('forecast') + '</span>'
          + '<span class="kdd-leg-item"><span class="kdd-leg-dot" style="background:#dc2626"></span>' + t('anomaly') + '</span>'
        + '</div>'
      + '</div>'
      + '<div class="kdd-chart-wrap"><canvas id="kdd-chart" height="240"></canvas></div>'
      + '</div>';

    // Three small cards: Mini Trend sparkline / 7-day Forecast Sum / Normal Range ±1σ
    var fcSum = (spark.forecast || []).reduce(function (s, f) { return s + (f.value || 0); }, 0);
    var meanHigh = (spark.mean || 0) + (spark.stddev || 0);
    var meanLow = Math.max(0, (spark.mean || 0) - (spark.stddev || 0));
    var cardsHtml =
      '<div class="kdd-cards-row">'
      + '<div class="kdd-card-mini">'
        + '<p class="kdd-card-label">' + t('miniTrend') + '</p>'
        + '<div class="kdd-card-spark">' + sparklineSvg(vals, { color: color, fill: color, width: 200, height: 40, strokeWidth: 2, anomalies: spark.anomalies || [], showMean: true, showLastDot: true, smooth: true }) + '</div>'
      + '</div>'
      + '<div class="kdd-card-mini">'
        + '<p class="kdd-card-label">' + t('forecastSum7d') + '</p>'
        + '<p class="kdd-card-value kdd-stat-cyan">' + digits(formatNum(fcSum, state.lang), state.lang) + '</p>'
        + '<p class="kdd-card-sub">' + t('basedOnRegression') + '</p>'
      + '</div>'
      + '<div class="kdd-card-mini">'
        + '<p class="kdd-card-label">' + t('normalRange') + '</p>'
        + '<p class="kdd-card-value kdd-stat-emerald">' + digits(formatNum(Math.round(meanLow), state.lang), state.lang) + ' – ' + digits(formatNum(Math.round(meanHigh), state.lang), state.lang) + '</p>'
        + '<p class="kdd-card-sub">' + t('expectedRange') + '</p>'
      + '</div>'
      + '</div>';

    // Related Tickets table
    var tableHtml;
    if (!tickets.length) {
      tableHtml = '<div class="empty" style="padding:24px;">' + t('noTicketsForAgent') + '</div>';
    } else {
      var rowsHtml = tickets.map(function (tk) {
        var num = tk.number || ('#' + tk.id);
        var title = tk.titleFa || tk.title || '';
        var created = tk.createdAt ? formatJalali(new Date(tk.createdAt), state.lang) : '';
        return '<tr>'
          + '<td class="mono">' + digits(num, state.lang) + '</td>'
          + '<td class="truncate">' + escHtml(title) + '</td>'
          + '<td>' + stateBadge(tk.state) + '</td>'
          + '<td>' + priorityBadge(tk.priority) + '</td>'
          + '<td class="mono">' + escHtml(created) + '</td>'
        + '</tr>';
      }).join('');
      tableHtml =
        '<div class="kdd-tickets-head">'
        + '<h4><span class="kdd-tickets-icon">' + ICONS.tickets + '</span>' + t('relatedTickets') + '</h4>'
        + '<span class="badge badge-muted">' + digits(tickets.length, state.lang) + '</span>'
        + '</div>'
        + '<div class="table-wrap" style="max-height:260px;"><table class="kdd-table"><thead class="sticky-bg"><tr>'
        + '<th>#</th><th>' + t('ticketTitle') + '</th><th>' + t('ticketState') + '</th><th>' + t('ticketPriority') + '</th><th>' + t('ticketCreated') + '</th>'
        + '</tr></thead><tbody>' + rowsHtml + '</tbody></table></div>';
    }

    body.innerHTML =
      '<div class="kdd-stats-grid">' + statsHtml + '</div>'
      + anomBannerHtml
      + chartHostHtml
      + cardsHtml
      + '<div class="kdd-tickets-wrap">' + tableHtml + '</div>';

    // Render the Chart.js line chart
    setTimeout(function () {
      var ctx = document.getElementById('kdd-chart');
      if (!ctx || typeof Chart === 'undefined') return;
      var pts = spark.points || [];
      var fc = spark.forecast || [];
      var labels = pts.map(function (p) { return dateLabel(p.date, state.lang); });
      // bridge: last actual point at start of forecast for continuity
      var bridge = pts.length ? pts[pts.length - 1] : null;
      if (bridge) labels.push(dateLabel(bridge.date, state.lang));
      fc.forEach(function (f) { labels.push(dateLabel(f.date, state.lang)); });
      var actualData = pts.map(function (p) { return p.value; });
      if (bridge) actualData.push(bridge.value);
      for (var i = 0; i < fc.length; i++) actualData.push(null);
      var fcData = [];
      if (bridge) fcData.push(bridge.value);
      fc.forEach(function (f) { fcData.push(f.value); });
      while (fcData.length < labels.length) fcData.unshift(null);
      var fcHiData = []; var fcLoData = [];
      if (bridge) { fcHiData.push(bridge.value); fcLoData.push(bridge.value); }
      fc.forEach(function (f) { fcHiData.push(f.hi); fcLoData.push(f.lo); });
      while (fcHiData.length < labels.length) fcHiData.unshift(null);
      while (fcLoData.length < labels.length) fcLoData.unshift(null);
      // mean reference line (flat dataset) + ±1σ band (two datasets)
      var mean = spark.mean || 0;
      var meanPlus = mean + (spark.stddev || 0);
      var meanMinus = Math.max(0, mean - (spark.stddev || 0));
      var sigmaHiData = labels.map(function () { return meanPlus; });
      var sigmaLoData = labels.map(function () { return meanMinus; });
      // anomaly scatter
      var anomData = pts.map(function (p, i) {
        return (spark.anomalies || []).indexOf(i) >= 0 ? p.value : null;
      });
      if (bridge) anomData.push(null);
      while (anomData.length < labels.length) anomData.push(null);

      var dsActual = {
        label: t('actual'),
        data: actualData,
        borderColor: color, backgroundColor: color, fill: true,
        tension: 0.3, borderWidth: 2.2, pointRadius: 0, pointHoverRadius: 4,
      };
      dsActual.backgroundColor = (function () {
        // build a soft fill color from the accent (rough alpha)
        if (color === 'var(--primary)') return 'rgba(124,58,237,0.15)';
        var m = color.replace('#','');
        if (m.length === 6) {
          var r = parseInt(m.slice(0,2),16), g = parseInt(m.slice(2,4),16), b = parseInt(m.slice(4,6),16);
          return 'rgba(' + r + ',' + g + ',' + b + ',0.15)';
        }
        return color;
      })();
      var dsForecast = {
        label: t('forecast'),
        data: fcData,
        borderColor: '#0891b2', backgroundColor: 'rgba(8,145,178,0.05)',
        borderDash: [5, 4], borderWidth: 2, tension: 0.3,
        pointRadius: 0, pointHoverRadius: 4, fill: false,
      };
      var dsFcHi = {
        label: 'fcHi', data: fcHiData, borderColor: 'transparent',
        backgroundColor: 'rgba(8,145,178,0.10)', fill: '+1',
        tension: 0.3, pointRadius: 0,
      };
      var dsFcLo = {
        label: 'fcLo', data: fcLoData, borderColor: 'transparent',
        backgroundColor: 'transparent', tension: 0.3, pointRadius: 0, fill: false,
      };
      var dsSigmaHi = {
        label: 'σ+', data: sigmaHiData, borderColor: 'transparent',
        backgroundColor: 'rgba(154,164,172,0.10)', fill: '+1',
        tension: 0, pointRadius: 0,
      };
      var dsSigmaLo = {
        label: 'σ-', data: sigmaLoData, borderColor: 'transparent',
        backgroundColor: 'transparent', tension: 0, pointRadius: 0, fill: false,
      };
      var dsMean = {
        label: t('mean'), data: labels.map(function () { return mean; }),
        borderColor: 'rgba(154,164,172,0.55)', borderWidth: 1, borderDash: [4, 4],
        pointRadius: 0, fill: false,
      };
      var dsAnom = {
        label: t('anomaly'), data: anomData,
        borderColor: '#dc2626', backgroundColor: '#dc2626',
        showLine: false, pointRadius: 5, pointHoverRadius: 7,
        pointStyle: 'circle', pointBorderColor: '#fff', pointBorderWidth: 1.5,
      };
      charts.kpiDrilldown = new Chart(ctx, {
        type: 'line',
        data: { labels: labels, datasets: [dsSigmaHi, dsSigmaLo, dsFcHi, dsFcLo, dsActual, dsForecast, dsMean, dsAnom] },
        options: {
          responsive: true, maintainAspectRatio: false,
          plugins: {
            legend: { display: false },
            tooltip: {
              callbacks: {
                label: function (ctx2) {
                  var v = ctx2.parsed.y;
                  if (v == null) return null;
                  return ctx2.dataset.label + ': ' + digits(formatNum(Math.round(v), state.lang), state.lang);
                }
              }
            }
          },
          scales: {
            y: { beginAtZero: true, grid: { color: getCss('--border') }, ticks: { font: { size: 11 }, color: getCss('--muted-fg') } },
            x: { grid: { display: false }, ticks: { font: { size: 10 }, color: getCss('--muted-fg'), maxRotation: 0, autoSkip: true, maxTicksLimit: 8 } }
          }
        }
      });
    }, 50);
  }

  // ---- Heatmap section ----
  // ---- Period Comparison section (CRON-REVIEW-6) ----
  var COMPARISON_METRICS = [
    { key: 'total', labelKey: 'kpiTotalTickets', icon: 'ticket', unit: 'number', accent: 'var(--primary)' },
    { key: 'open', labelKey: 'kpiOpenTickets', icon: 'alert', unit: 'number', invertDelta: false, accent: '#d97706' },
    { key: 'closed', labelKey: 'kpiClosedTickets', icon: 'check', unit: 'number', invertDelta: false, accent: '#16a34a' },
    { key: 'escalated', labelKey: 'kpiEscalated', icon: 'alertTriangle', unit: 'number', invertDelta: true, accent: '#dc2626' },
    { key: 'avgResponse', labelKey: 'kpiAvgResponse', icon: 'clock', unit: 'minutes', invertDelta: true, accent: '#0891b2' },
    { key: 'avgResolution', labelKey: 'kpiAvgResolution', icon: 'gauge', unit: 'minutes', invertDelta: true, accent: '#7c3aed' },
    { key: 'created', labelKey: 'createdLabel', icon: 'plus', unit: 'number', accent: '#7c3aed' },
    { key: 'activeAgents', labelKey: 'kpiActiveAgents', icon: 'users', unit: 'number', accent: '#ea580c' },
  ];

  function comparisonKpiCard(title, curVal, prevVal, delta, unit, invertDelta, accent, iconSvg, idx) {
    var isImproved = invertDelta ? delta < 0 : delta > 0;
    var isDeclined = invertDelta ? delta > 0 : delta < 0;
    var isFlat = delta === 0;

    var displayCur = unit === 'minutes' ? formatDuration(curVal, state.lang) : formatNum(curVal, state.lang);
    var displayPrev = unit === 'minutes' ? formatDuration(prevVal, state.lang) : formatNum(prevVal, state.lang);

    var deltaClass = isImproved ? 'color:#16a34a;background:rgba(22,163,74,0.10)' : isDeclined ? 'color:#dc2626;background:rgba(220,38,38,0.10)' : 'color:var(--muted-fg);background:var(--muted)';
    var deltaArrow = isImproved ? '↑' : isDeclined ? '↓' : '—';
    var maxVal = Math.max(curVal, prevVal, 1);
    var curPct = Math.min(100, (curVal / maxVal) * 100);
    var prevPct = Math.min(100, (prevVal / maxVal) * 100);

    return '<div class="card card-hover glass-card" style="position:relative;overflow:hidden;animation:fadeInUp 0.4s ease ' + (idx * 60) + 'ms both">' +
      '<div style="pointer-events:none;position:absolute;' + (state.lang === 'fa' ? 'left' : 'right') + ':-24px;top:-24px;width:80px;height:80px;border-radius:50%;opacity:0.30;filter:blur(24px);background:' + accent + '" aria-hidden="true"></div>' +
      '<div class="card-body" style="position:relative;padding:16px;">' +
        '<div style="display:flex;align-items:center;gap:8px;margin-bottom:8px;">' +
          '<div style="display:flex;align-items:center;justify-content:center;width:32px;height:32px;border-radius:8px;background:' + accent + '1a;color:' + accent + '">' + iconSvg + '</div>' +
          '<span style="font-size:12px;font-weight:500;color:var(--muted-fg);line-height:1.3;">' + title + '</span>' +
        '</div>' +
        '<p class="stat-number" style="font-size:24px;font-weight:700;letter-spacing:-0.02em;margin:0;">' + displayCur + '</p>' +
        '<div style="display:flex;align-items:center;justify-content:space-between;gap:8px;margin-top:6px;">' +
          '<span style="font-size:12px;color:var(--muted-fg);">' + (state.lang === 'fa' ? 'قبل: ' : 'Prev: ') + displayPrev + '</span>' +
          '<span style="display:inline-flex;align-items:center;gap:2px;padding:2px 8px;border-radius:6px;font-size:11px;font-weight:600;' + deltaClass + '">' + deltaArrow + ' ' + digits(Math.abs(delta).toFixed(1), state.lang) + pctSign() + '</span>' +
        '</div>' +
        '<div style="margin-top:12px;">' +
          '<div style="display:flex;align-items:center;gap:8px;margin-bottom:4px;">' +
            '<span style="width:36px;font-size:10px;color:var(--muted-fg);">' + (state.lang === 'fa' ? 'جاری' : 'Cur') + '</span>' +
            '<div style="height:6px;flex:1;overflow:hidden;border-radius:999px;background:var(--muted);">' +
              '<div class="progress-animated" style="height:100%;border-radius:999px;transition:width 0.7s ease;width:' + curPct + '%;background:' + accent + ';position:relative;overflow:hidden;"></div>' +
            '</div>' +
          '</div>' +
          '<div style="display:flex;align-items:center;gap:8px;">' +
            '<span style="width:36px;font-size:10px;color:var(--muted-fg);">' + (state.lang === 'fa' ? 'قبل' : 'Prev') + '</span>' +
            '<div style="height:6px;flex:1;overflow:hidden;border-radius:999px;background:var(--muted);">' +
              '<div style="height:100%;border-radius:999px;transition:width 0.7s ease;width:' + prevPct + '%;background:' + accent + '60;"></div>' +
            '</div>' +
          '</div>' +
        '</div>' +
      '</div>' +
    '</div>';
  }

  function renderComparison(c) {
    c.innerHTML = '';
    // Header
    var headerLeft = el('div', { style: 'display:flex;align-items:center;gap:12px;' }, [
      el('div', { style: 'display:flex;align-items:center;justify-content:center;width:40px;height:40px;border-radius:12px;background:rgba(124,58,237,0.10);color:var(--primary);', html: ICONS.gitCompare }),
      el('div', {}, [
        el('h3', { style: 'font-size:18px;font-weight:700;margin:0;' }, t('comparisonTitle')),
        el('p', { style: 'font-size:13px;color:var(--muted-fg);margin:2px 0 0;' }, t('vsPrevious')),
      ]),
    ]);
    var header = sectionHead(null, null, [periodSelector()]);
    header.insertBefore(headerLeft, header.firstChild);
    c.appendChild(header);

    // KPI grid (2x4)
    var kpiGrid = el('div', { class: 'grid grid-4', id: 'comp-kpis', style: 'gap:12px;margin-bottom:16px;' });
    kpiGrid.innerHTML = '<div class="skeleton" style="height:160px"></div>'.repeat(8);
    c.appendChild(kpiGrid);

    // Overlay trend chart
    var chartCard = el('div', { class: 'card chart-card-glow', style: 'margin-bottom:16px;' }, [
      el('div', { class: 'card-head', style: 'display:flex;align-items:center;justify-content:space-between;' }, [
        el('div', { class: 'card-title' }, t('dailyOverlay')),
        el('div', { id: 'comp-chart-export' }),
      ]),
      el('div', { class: 'card-body' }, [el('canvas', { id: 'chart-comparison', height: 340 })]),
    ]);
    c.appendChild(chartCard);

    // Key Changes summary
    var changesCard = el('div', { class: 'card', style: 'margin-bottom:16px;' }, [
      el('div', { class: 'card-head' }, [
        el('div', { class: 'card-title', style: 'display:flex;align-items:center;gap:8px;' }, [ICONS.alertTriangle, t('keyChanges')]),
      ]),
      el('div', { class: 'card-body', id: 'comp-changes' }, '<div class="skeleton" style="height:80px"></div>'),
    ]);
    c.appendChild(changesCard);

    // Export KPI card
    var exportCard = el('div', { class: 'card' }, [
      el('div', { class: 'card-head', style: 'display:flex;align-items:center;justify-content:space-between;' }, [
        el('div', { class: 'card-title' }, t('comparisonTitle') + ' — ' + t('export')),
        el('div', { id: 'comp-kpi-export' }),
      ]),
    ]);
    c.appendChild(exportCard);

    // Fetch data
    api('periodComparison', { days: state.period }).then(function (data) {
      state.data.comparison = data;

      // Render KPI cards
      var kpiHtml = '';
      COMPARISON_METRICS.forEach(function (m, i) {
        var cur = m.key === 'activeAgents' ? (data.current.activeAgents || 0) : (data.current[m.key] || 0);
        var prev = m.key === 'activeAgents' ? (data.previous.activeAgents || 0) : (data.previous[m.key] || 0);
        var delta = data.deltas[m.key] || 0;
        var iconSvg = ICONS[m.icon] || ICONS.ticket;
        kpiHtml += comparisonKpiCard(t(m.labelKey), cur, prev, delta, m.unit, m.invertDelta, m.accent, iconSvg, i);
      });
      document.getElementById('comp-kpis').innerHTML = kpiHtml;

      // Render overlay trend chart
      var trendData = data.trend || [];
      var chartLabels = trendData.map(function (d, i) { return dateLabel(d.date, state.lang); });
      var curData = trendData.map(function (d) { return d.current; });
      var prevData = trendData.map(function (d) { return d.previous; });

      setTimeout(function () {
        var ctx = document.getElementById('chart-comparison');
        if (ctx) {
          charts.comparison = new Chart(ctx, {
            type: 'line',
            data: {
              labels: chartLabels,
              datasets: [
                {
                  label: t('currentPeriod'),
                  data: curData,
                  borderColor: getCss('--primary'),
                  backgroundColor: 'rgba(124,58,237,0.10)',
                  fill: true,
                  tension: 0.4,
                  borderWidth: 2,
                  pointRadius: 0,
                  pointHoverRadius: 4,
                },
                {
                  label: t('previousPeriod'),
                  data: prevData,
                  borderColor: '#d97706',
                  backgroundColor: 'rgba(217,119,6,0.08)',
                  fill: true,
                  tension: 0.4,
                  borderWidth: 2,
                  borderDash: [6, 3],
                  pointRadius: 0,
                  pointHoverRadius: 4,
                },
              ],
            },
            options: {
              responsive: true,
              maintainAspectRatio: false,
              interaction: { intersect: false, mode: 'index' },
              plugins: {
                legend: { display: true, labels: { usePointStyle: true, padding: 16, font: { size: 12 } } },
                tooltip: {
                  backgroundColor: getCss('--card'),
                  titleColor: getCss('--card-fg'),
                  bodyColor: getCss('--card-fg'),
                  borderColor: getCss('--border'),
                  borderWidth: 1,
                  cornerRadius: 8,
                  padding: 10,
                },
              },
              scales: {
                x: { grid: { display: false }, ticks: { font: { size: 10 }, maxTicksLimit: 15 } },
                y: { beginAtZero: true, grid: { color: getCss('--border') }, ticks: { font: { size: 11 } } },
              },
            },
          });
        }
      }, 50);

      // Export menu for chart
      var chartRows = trendData.map(function (d, i) { return { day: digits(i + 1, state.lang), label: dateLabel(d.date, state.lang), current: d.current, previous: d.previous }; });
      var chartHeaders = [
        { key: 'day', label: state.lang === 'fa' ? 'روز' : 'Day' },
        { key: 'label', label: state.lang === 'fa' ? 'تاریخ' : 'Date' },
        { key: 'current', label: t('currentPeriod') },
        { key: 'previous', label: t('previousPeriod') },
      ];
      var chartExportEl = document.getElementById('comp-chart-export');
      if (chartExportEl) chartExportEl.appendChild(exportMenu('comparison-trend', chartRows, chartHeaders, 'comparison-trend', t('dailyOverlay')));

      // Compute insights
      var metricScores = COMPARISON_METRICS.map(function (m) {
        var delta = data.deltas[m.key] || 0;
        var score = m.invertDelta ? -delta : delta;
        return { key: m.key, labelKey: m.labelKey, delta: delta, score: score };
      });
      metricScores.sort(function (a, b) { return b.score - a.score; });
      var biggestImprovement = metricScores[0];
      var biggestDecline = metricScores[metricScores.length - 1];
      var avgScore = metricScores.reduce(function (s, m) { return s + m.score; }, 0) / metricScores.length;
      var direction = avgScore > 3 ? 'improving' : avgScore < -3 ? 'declining' : 'stable';

      var dirColor, dirIcon, dirLabel;
      if (direction === 'improving') { dirColor = '#16a34a'; dirIcon = ICONS.trendingUp; dirLabel = t('improving'); }
      else if (direction === 'declining') { dirColor = '#dc2626'; dirIcon = ICONS.trendingDown || ICONS.trends; dirLabel = t('declining'); }
      else { dirColor = 'var(--muted-fg)'; dirIcon = ICONS.minus || ICONS.gauge; dirLabel = t('stable'); }

      document.getElementById('comp-changes').innerHTML =
        '<div style="display:grid;grid-template-columns:repeat(3,1fr);gap:12px;">' +
          // Biggest Improvement
          '<div style="display:flex;align-items:center;gap:12px;padding:12px;border-radius:12px;border:1px solid rgba(22,163,74,0.20);background:rgba(22,163,74,0.05);">' +
            '<div style="display:flex;align-items:center;justify-content:center;width:40px;height:40px;border-radius:8px;background:rgba(22,163,74,0.10);color:#16a34a;">' + ICONS.trendingUp + '</div>' +
            '<div style="min-width:0;">' +
              '<p style="font-size:12px;color:var(--muted-fg);margin:0;">' + t('biggestImprovement') + '</p>' +
              '<p style="font-size:14px;font-weight:700;color:#16a34a;margin:2px 0 0;">' + t(biggestImprovement.labelKey) + '</p>' +
              '<p style="font-size:12px;color:var(--muted-fg);margin:2px 0 0;">' + (biggestImprovement.delta >= 0 ? '+' : '') + digits(biggestImprovement.delta, state.lang) + pctSign() + '</p>' +
            '</div>' +
          '</div>' +
          // Biggest Decline
          '<div style="display:flex;align-items:center;gap:12px;padding:12px;border-radius:12px;border:1px solid rgba(220,38,38,0.20);background:rgba(220,38,38,0.05);">' +
            '<div style="display:flex;align-items:center;justify-content:center;width:40px;height:40px;border-radius:8px;background:rgba(220,38,38,0.10);color:#dc2626;">' + (ICONS.trendingDown || ICONS.trends) + '</div>' +
            '<div style="min-width:0;">' +
              '<p style="font-size:12px;color:var(--muted-fg);margin:0;">' + t('biggestDecline') + '</p>' +
              '<p style="font-size:14px;font-weight:700;color:#dc2626;margin:2px 0 0;">' + t(biggestDecline.labelKey) + '</p>' +
              '<p style="font-size:12px;color:var(--muted-fg);margin:2px 0 0;">' + (biggestDecline.delta >= 0 ? '+' : '') + digits(biggestDecline.delta, state.lang) + pctSign() + '</p>' +
            '</div>' +
          '</div>' +
          // Overall Direction
          '<div style="display:flex;align-items:center;gap:12px;padding:12px;border-radius:12px;border:1px solid ' + (direction === 'improving' ? 'rgba(22,163,74,0.20)' : direction === 'declining' ? 'rgba(220,38,38,0.20)' : 'var(--border)') + ';background:' + (direction === 'improving' ? 'rgba(22,163,74,0.05)' : direction === 'declining' ? 'rgba(220,38,38,0.05)' : 'var(--muted)') + ';">' +
            '<div style="display:flex;align-items:center;justify-content:center;width:40px;height:40px;border-radius:8px;color:' + dirColor + ';">' + dirIcon + '</div>' +
            '<div style="min-width:0;">' +
              '<p style="font-size:12px;color:var(--muted-fg);margin:0;">' + t('overallDirection') + '</p>' +
              '<p style="font-size:14px;font-weight:700;color:' + dirColor + ';margin:2px 0 0;">' + dirLabel + '</p>' +
            '</div>' +
          '</div>' +
        '</div>';

      // Export KPI rows
      var kpiExportRows = COMPARISON_METRICS.map(function (m) {
        var cur = m.key === 'activeAgents' ? (data.current.activeAgents || 0) : (data.current[m.key] || 0);
        var prev = m.key === 'activeAgents' ? (data.previous.activeAgents || 0) : (data.previous[m.key] || 0);
        var delta = data.deltas[m.key] || 0;
        return { metric: t(m.labelKey), current: cur, previous: prev, delta: (delta >= 0 ? '+' : '') + delta + '%' };
      });
      var kpiExportHeaders = [
        { key: 'metric', label: state.lang === 'fa' ? 'شاخص' : 'Metric' },
        { key: 'current', label: t('currentPeriod') },
        { key: 'previous', label: t('previousPeriod') },
        { key: 'delta', label: t('deltaChange') },
      ];
      var kpiExportEl = document.getElementById('comp-kpi-export');
      if (kpiExportEl) kpiExportEl.appendChild(exportMenu('comparison-kpis', kpiExportRows, kpiExportHeaders, 'comparison-kpis', t('comparisonTitle')));

    }).catch(function (e) {
      document.getElementById('comp-kpis').innerHTML = '<div class="empty" style="grid-column:1/-1;">' + (e.message || t('noData')) + '</div>';
    });
  }

  // ---- Period Comparison report generation (CRON-REVIEW-6) ----
  function generateComparisonReport(type) {
    var data = state.data.comparison;
    if (!data) return;

    if (type === 'quickSummary' || type === 'pdf') {
      // Generate a PDF-like report using the existing print-based approach
      var w = window.open('', '_blank');
      var dir = state.lang === 'fa' ? 'rtl' : 'ltr';
      var now = formatJalaliFull(new Date(), state.lang);
      var periodLabel = state.period + ' ' + t('days');

      var kpiRows = COMPARISON_METRICS.map(function (m) {
        var cur = m.key === 'activeAgents' ? (data.current.activeAgents || 0) : (data.current[m.key] || 0);
        var prev = m.key === 'activeAgents' ? (data.previous.activeAgents || 0) : (data.previous[m.key] || 0);
        var delta = data.deltas[m.key] || 0;
        var displayCur = m.unit === 'minutes' ? formatDuration(cur, state.lang) : formatNum(cur, state.lang);
        var displayPrev = m.unit === 'minutes' ? formatDuration(prev, state.lang) : formatNum(prev, state.lang);
        var deltaStr = (delta >= 0 ? '+' : '') + delta + '%';
        var deltaColor = (m.invertDelta ? delta < 0 : delta > 0) ? '#16a34a' : (m.invertDelta ? delta > 0 : delta < 0) ? '#dc2626' : '#888';
        return '<tr><td style="font-weight:500">' + t(m.labelKey) + '</td><td>' + displayCur + '</td><td>' + displayPrev + '</td><td style="color:' + deltaColor + ';font-weight:600">' + deltaStr + '</td></tr>';
      }).join('');

      var summaryContent = type === 'quickSummary' ? '' :
        '<h2 style="margin-top:20px;">' + t('dailyOverlay') + '</h2>' +
        '<table style="width:100%;border-collapse:collapse;font-size:11px"><thead><tr><th>' + (state.lang === 'fa' ? 'تاریخ' : 'Date') + '</th><th>' + t('currentPeriod') + '</th><th>' + t('previousPeriod') + '</th></tr></thead><tbody>' +
        (data.trend || []).map(function (d) { return '<tr><td>' + dateLabel(d.date, state.lang) + '</td><td>' + d.current + '</td><td>' + d.previous + '</td></tr>'; }).join('') +
        '</tbody></table>';

      var html = '<html dir="' + dir + '"><head><meta charset="utf-8"><title>' + t('comparisonTitle') + '</title>' +
        '<style>body{font-family:Vazirmatn,Tahoma,sans-serif;padding:20px}h1{font-size:20px;color:#7c3aed}h2{font-size:16px;color:#333;margin-top:16px}table{width:100%;border-collapse:collapse;font-size:12px;margin-top:8px}th,td{border:1px solid #ddd;padding:8px;text-align:start}th{background:#7c3aed;color:#fff}.summary-header{display:flex;justify-content:space-between;align-items:center;border-bottom:2px solid #7c3aed;padding-bottom:8px;margin-bottom:16px}</style>' +
        '</head><body>' +
        '<div class="summary-header"><div><h1>' + t('comparisonTitle') + '</h1><p style="color:#666;font-size:13px">' + t('reportPeriod') + ': ' + periodLabel + '</p></div><div style="text-align:' + (dir === 'rtl' ? 'left' : 'right') + ';font-size:12px;color:#666">' + t('generatedOn') + ': ' + now + '</div></div>' +
        '<h2>' + t('executiveSummary') + '</h2>' +
        '<table><thead><tr><th>' + (state.lang === 'fa' ? 'شاخص' : 'Metric') + '</th><th>' + t('currentPeriod') + '</th><th>' + t('previousPeriod') + '</th><th>' + t('deltaChange') + '</th></tr></thead><tbody>' + kpiRows + '</tbody></table>' +
        summaryContent +
        '<script>window.onload=function(){setTimeout(function(){window.print()},300)}<\/script></body></html>';
      w.document.write(html);
      w.document.close();
    } else if (type === 'excel') {
      // Generate multi-sheet Excel
      var kpiRows = COMPARISON_METRICS.map(function (m) {
        var cur = m.key === 'activeAgents' ? (data.current.activeAgents || 0) : (data.current[m.key] || 0);
        var prev = m.key === 'activeAgents' ? (data.previous.activeAgents || 0) : (data.previous[m.key] || 0);
        var delta = data.deltas[m.key] || 0;
        return { metric: t(m.labelKey), current: cur, previous: prev, delta: (delta >= 0 ? '+' : '') + delta + '%' };
      });
      var headers = [
        { key: 'metric', label: state.lang === 'fa' ? 'شاخص' : 'Metric' },
        { key: 'current', label: t('currentPeriod') },
        { key: 'previous', label: t('previousPeriod') },
        { key: 'delta', label: t('deltaChange') },
      ];
      exportExcel(kpiRows, headers, 'comparison-report');
    }
  }

  function renderHeatmap(c) {
    c.innerHTML = '';
    c.appendChild(sectionHead(t('heatmapTitle'), t('heatmapDesc'), [periodSelector()]));
    var kpiRow = el('div', { class: 'grid grid-4', id: 'hm-kpis' });
    c.appendChild(kpiRow);
    var card = el('div', { class: 'card', style: 'margin-top:16px;' }, [el('div', { class: 'card-head' }, [el('div', { class: 'card-title' }, t('heatmapTitle'))]), el('div', { class: 'card-body', id: 'hm-grid', style: 'overflow-x:auto;' }, '<div class="skeleton" style="height:300px"></div>')]);
    c.appendChild(card);
    api('heatmap', { period: state.period }).then(function (d) {
      var grid = d.grid;
      var max = 0, total = d.total || 0;
      var dayTotals = [0,0,0,0,0,0,0], hourTotals = Array(24).fill(0);
      for (var dd = 0; dd < 7; dd++) for (var hh = 0; hh < 24; hh++) { var v = grid[dd][hh]; if (v > max) max = v; total += v; dayTotals[dd] += v; hourTotals[hh] += v; }
      var faOrder = [6,0,1,2,3,4,5];
      var dayKeys = ['weekdaySun','weekdayMon','weekdayTue','weekdayWed','weekdayThu','weekdayFri','weekdaySat'];
      var dayLabels = faOrder.map(function (d) { return t(dayKeys[d]); });
      var busiestDay = dayTotals.indexOf(Math.max.apply(null, dayTotals));
      var busiestHour = hourTotals.indexOf(Math.max.apply(null, hourTotals));
      kpiRow.innerHTML = hmKpi(t('heatmapTotalInrange'), formatNum(total, state.lang), ICONS.trends, '#7c3aed') + hmKpi(t('heatmapPeak'), formatNum(max, state.lang) + ' ' + t('ticketsAbbr'), ICONS.flame, '#dc2626') + hmKpi(t('heatmapBusiestDay'), dayLabels[faOrder.indexOf(busiestDay)], ICONS.trends, '#d97706') + hmKpi(t('heatmapBusiestHour'), formatHour(busiestHour, state.lang), ICONS.clock, '#9333ea');
      var cellColor = function (v) { if (v === 0) return 'var(--muted)'; var r = v / max; if (r < 0.25) return 'rgba(124,58,237,0.20)'; if (r < 0.5) return 'rgba(124,58,237,0.40)'; if (r < 0.75) return 'rgba(124,58,237,0.65)'; return 'rgba(124,58,237,0.92)'; };
      var html = '<div style="min-width:760px"><div style="display:grid;grid-template-columns:48px repeat(24,1fr);margin-bottom:4px"><div></div>';
      for (var h0 = 0; h0 < 24; h0++) html += '<div style="text-align:center;font-size:10px;color:var(--muted-fg)">' + (h0 % 3 === 0 ? toFa(h0) : '') + '</div>';
      html += '</div>';
      faOrder.forEach(function (d, ri) {
        html += '<div style="display:grid;grid-template-columns:48px repeat(24,1fr);align-items:center;gap:3px;margin-bottom:3px"><div style="font-size:12px;font-weight:500;color:var(--muted-fg)">' + dayLabels[ri] + '</div>';
        for (var hh2 = 0; hh2 < 24; hh2++) { var v2 = grid[d][hh2]; html += '<div title="' + dayLabels[ri] + ' ' + formatHour(hh2, state.lang) + ' — ' + toFa(formatNum(v2, state.lang)) + ' ' + t('tickets') + '" style="height:34px;display:flex;align-items:center;justify-content:center;border-radius:3px;font-size:10px;font-weight:500;cursor:default;background:' + cellColor(v2) + ';color:' + (v2 > max * 0.5 ? '#fff' : 'var(--foreground)') + '">' + (v2 > max * 0.15 ? toFa(v2) : '') + '</div>'; }
        html += '</div>';
      });
      html += '<div style="display:flex;justify-content:flex-end;align-items:center;gap:6px;margin-top:12px;font-size:11px;color:var(--muted-fg)"><span>' + (state.lang === 'fa' ? 'کمتر' : 'Less') + '</span>';
      [0,0.2,0.4,0.65,0.92].forEach(function (r) { html += '<div style="width:24px;height:14px;border-radius:2px;background:' + (r === 0 ? 'var(--muted)' : 'rgba(124,58,237,' + r + ')') + '"></div>'; });
      html += '<span>' + (state.lang === 'fa' ? 'بیشتر' : 'More') + '</span></div></div>';
      document.getElementById('hm-grid').innerHTML = html;
    }).catch(function (e) { setHTML('hm-grid', '<div class="empty">' + e.message + '</div>'); });
  }
  function hmKpi(label, value, icon, color) {
    return '<div class="card card-hover"><div class="card-body" style="padding:20px"><div class="kpi-icon" style="background:' + color + '20;color:' + color + '">' + icon + '</div><p class="kpi-label" style="margin-top:12px">' + label + '</p><p class="kpi-value" style="margin-top:4px">' + value + '</p></div></div>';
  }

  // ---- Organizations section ----
  function renderOrganizations(c) {
    c.innerHTML = '';
    c.appendChild(sectionHead(t('orgsTitle'), t('orgsDesc'), [periodSelector()]));
    c.appendChild(el('div', { class: 'grid grid-3', id: 'org-sum', style: 'margin-bottom:16px;' }, '<div class="skeleton" style="height:100px"></div>'.repeat(3)));
    c.appendChild(el('div', { class: 'card', style: 'margin-bottom:16px;' }, [el('div', { class: 'card-head' }, [el('div', { class: 'card-title' }, state.lang === 'fa' ? '۱۰ سازمان برتر' : 'Top 10 Organizations')]), el('div', { class: 'card-body' }, [el('canvas', { id: 'chart-orgs', height: 340 })])]));
    c.appendChild(el('div', { class: 'card' }, [el('div', { class: 'card-head', id: 'org-head' }, [el('div', { class: 'card-title' }, t('orgsTitle'))]), el('div', { class: 'card-body', id: 'org-table', style: 'padding:0;' }, '<div class="skeleton" style="height:300px"></div>')]));
    api('organizations', { period: state.period }).then(function (orgs) {
      var totalT = orgs.reduce(function (s, o) { return s + o.ticketCount; }, 0);
      var totalO = orgs.reduce(function (s, o) { return s + o.openCount; }, 0);
      document.getElementById('org-sum').innerHTML = orgSumCard(t('orgTickets'), formatNum(totalT, state.lang), ICONS.ticket, '#7c3aed') + orgSumCard(t('orgOpen'), formatNum(totalO, state.lang), ICONS.ticket, '#d97706') + orgSumCard(t('orgUsers'), formatNum(orgs.length, state.lang), ICONS.users, '#9333ea');
      var colors = ['#7c3aed','#d97706','#9333ea','#0891b2','#dc2626','#16a34a','#ca8a04','#7c3aed'];
      setTimeout(function () {
        var ctx = document.getElementById('chart-orgs');
        if (ctx) charts.orgs = new Chart(ctx, { type: 'bar', data: { labels: orgs.slice(0, 10).map(function (o) { return o.nameFa; }), datasets: [{ data: orgs.slice(0, 10).map(function (o) { return o.ticketCount; }), backgroundColor: orgs.slice(0, 10).map(function (_, i) { return colors[i % colors.length]; }), borderRadius: 4 }] }, options: { indexAxis: 'y', responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } }, scales: { x: { beginAtZero: true, grid: { color: getCss('--border') } }, y: { grid: { display: false }, ticks: { font: { size: 10 } } } } } });
      }, 50);
      var rows = orgs.map(function (o) { return { name: o.nameFa, tickets: o.ticketCount, open: o.openCount, users: o.activeUsers, share: o.share }; });
      var headers = [{ key: 'name', label: t('orgName') }, { key: 'tickets', label: t('orgTickets') }, { key: 'open', label: t('orgOpen') }, { key: 'users', label: t('orgUsers') }, { key: 'share', label: t('orgShare') + ' ' + pctSign() }];
      document.getElementById('org-head').appendChild(exportMenu('organizations', rows, headers, 'organizations', t('orgsTitle')));
      document.getElementById('org-table').innerHTML = '<div class="table-wrap"><table><thead><tr><th>#</th>' + headers.map(function (h) { return '<th>' + h.label + '</th>'; }).join('') + '</tr></thead><tbody>' + orgs.map(function (o, i) { return '<tr><td><span style="display:flex;width:24px;height:24px;align-items:center;justify-content:center;border-radius:50%;color:#fff;font-size:11px;font-weight:700;background:' + colors[i % colors.length] + '">' + toFa(i + 1) + '</span></td><td style="font-weight:500">' + o.nameFa + '</td><td>' + toFa(formatNum(o.ticketCount, state.lang)) + '</td><td><span class="badge badge-amber">' + toFa(formatNum(o.openCount, state.lang)) + '</span></td><td style="color:var(--muted-fg)">' + toFa(formatNum(o.activeUsers, state.lang)) + '</td><td><div style="display:flex;align-items:center;gap:8px"><div class="progress" style="width:60px"><div class="progress-fill" style="width:' + Math.min(o.share * 3, 100) + '%"></div></div><span style="font-size:12px">' + toFa(o.share) + pctSign() + '</span></div></td></tr>'; }).join('') + '</tbody></table></div>';
    }).catch(function (e) { setHTML('org-table', '<div class="empty">' + e.message + '</div>'); });
  }
  function orgSumCard(label, value, icon, color) {
    return '<div class="card card-hover"><div class="card-body" style="display:flex;align-items:center;gap:16px"><div class="kpi-icon" style="background:' + color + '20;color:' + color + '">' + icon + '</div><div><div class="kpi-label">' + label + '</div><div class="kpi-value">' + value + '</div></div></div></div>';
  }

  // ---- SLA section ----
  function renderSla(c) {
    c.innerHTML = '';
    c.appendChild(sectionHead(t('slaTitle'), t('slaDesc'), [periodSelector()]));
    c.appendChild(el('div', { class: 'grid grid-4', id: 'sla-kpis' }, '<div class="skeleton" style="height:100px"></div>'.repeat(4)));
    c.appendChild(el('div', { class: 'grid grid-2', style: 'margin-top:16px;' }, [
      el('div', { class: 'card' }, [el('div', { class: 'card-head' }, [el('div', { class: 'card-title' }, t('slaByPriority'))]), el('div', { class: 'card-body' }, [el('canvas', { id: 'chart-sla', height: 300 })])]),
      el('div', { class: 'card' }, [el('div', { class: 'card-head', id: 'sla-head' }, [el('div', { class: 'card-title' }, t('slaByPriority'))]), el('div', { class: 'card-body', id: 'sla-list' }, '')]),
    ]));
    api('sla', { period: state.period }).then(function (d) {
      document.getElementById('sla-kpis').innerHTML = hmKpi(t('slaComplianceOverall'), toFa(d.slaCompliance) + pctSign(), ICONS.check, '#16a34a') + hmKpi(t('slaBreached'), formatNum(d.breachedCount, state.lang), ICONS.alert, '#d97706') + hmKpi(t('slaEscalated'), formatNum(d.escalatedCount, state.lang), ICONS.flame, '#dc2626') + hmKpi(t('slaEscalatedRate'), toFa(d.escalatedRate) + pctSign(), ICONS.target, '#9333ea');
      var colors = { low: '#0891b2', normal: '#7c3aed', high: '#d97706', urgent: '#dc2626' };
      var chartData = d.byPriority.map(function (p) { return { name: t('priority' + p.priority.charAt(0).toUpperCase() + p.priority.slice(1)), slaRate: p.slaRate, color: colors[p.priority] }; });
      setTimeout(function () {
        var ctx = document.getElementById('chart-sla');
        if (ctx) charts.sla = new Chart(ctx, { type: 'bar', data: { labels: chartData.map(function (x) { return x.name; }), datasets: [{ data: chartData.map(function (x) { return x.slaRate; }), backgroundColor: chartData.map(function (x) { return x.color; }), borderRadius: 4 }] }, options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } }, scales: { y: { beginAtZero: true, max: 100, grid: { color: getCss('--border') } }, x: { grid: { display: false } } } } });
      }, 50);
      var rows = d.byPriority.map(function (p) { return { priority: t('priority' + p.priority.charAt(0).toUpperCase() + p.priority.slice(1)), total: p.total, breached: p.breached, slaRate: p.slaRate, threshold: p.threshold }; });
      var headers = [{ key: 'priority', label: t('ticketPriority') }, { key: 'total', label: t('tickets') }, { key: 'breached', label: t('slaBreached') }, { key: 'slaRate', label: t('slaCompliance') + ' ' + pctSign() }, { key: 'threshold', label: t('slaThreshold') }];
      document.getElementById('sla-head').appendChild(exportMenu('sla', rows, headers, 'sla-by-priority', t('slaTitle')));
      document.getElementById('sla-list').innerHTML = d.byPriority.map(function (p) { var color = colors[p.priority]; var label = t('priority' + p.priority.charAt(0).toUpperCase() + p.priority.slice(1)); var rc = p.slaRate >= 85 ? '#16a34a' : p.slaRate >= 70 ? '#d97706' : '#dc2626'; return '<div style="border:1px solid var(--border);border-radius:8px;padding:12px;margin-bottom:12px"><div style="display:flex;justify-content:space-between;align-items:center"><div style="display:flex;align-items:center;gap:8px"><span style="width:12px;height:12px;border-radius:50%;background:' + color + '"></span><span style="font-weight:500">' + label + '</span><span style="font-size:11px;color:var(--muted-fg)">· ' + t('slaThreshold') + ': ' + toFa(p.threshold) + ' ' + (state.lang === 'fa' ? 'دقیقه' : 'min') + '</span></div><span style="font-weight:700;color:' + rc + '">' + toFa(p.slaRate) + pctSign() + '</span></div><div style="display:flex;gap:8px;margin-top:6px;font-size:11px;color:var(--muted-fg)"><span>' + toFa(formatNum(p.total, state.lang)) + ' ' + t('tickets') + '</span><span>·</span><span style="color:#dc2626">' + toFa(formatNum(p.breached, state.lang)) + ' ' + t('slaBreached') + '</span></div><div class="progress" style="margin-top:6px;height:8px"><div class="progress-fill" style="width:' + p.slaRate + '%;background:' + rc + '"></div></div></div>'; }).join('');
    }).catch(function (e) { setHTML('sla-list', '<div class="empty">' + e.message + '</div>'); });
  }

  // ---- Tags section (Tag Analytics) ----
  var TAG_COLORS = ['#7c3aed', '#d97706', '#9333ea', '#0891b2', '#dc2626', '#16a34a', '#ca8a04', '#7c3aed', '#db2777', '#0ea5e9'];
  function renderTags(c) {
    c.innerHTML = '';
    c.appendChild(sectionHead(t('tagsTitle'), t('tagsDesc'), [periodSelector()]));
    // summary cards
    var sum = el('div', { class: 'grid grid-4', id: 'tag-sum', style: 'margin-bottom:16px;' }, '<div class="skeleton" style="height:100px"></div>'.repeat(4));
    c.appendChild(sum);
    // charts row (2-col)
    var chartsRow = el('div', { class: 'grid grid-2', style: 'margin-bottom:16px;' }, [
      el('div', { class: 'card' }, [el('div', { class: 'card-head' }, [el('div', { class: 'card-title' }, t('tagDistribution'))]), el('div', { class: 'card-body' }, [el('canvas', { id: 'chart-tag-dist', height: 320 })])]),
      el('div', { class: 'card' }, [el('div', { class: 'card-head' }, [el('div', { class: 'card-title' }, t('tagTrend'))]), el('div', { class: 'card-body' }, [el('canvas', { id: 'chart-tag-trend', height: 320 })])]),
    ]);
    c.appendChild(chartsRow);
    // tag chips cloud
    var chipsCard = el('div', { class: 'card', style: 'margin-bottom:16px;' }, [el('div', { class: 'card-head' }, [el('div', { class: 'card-title' }, t('topTags'))]), el('div', { class: 'card-body', id: 'tag-chips', style: 'display:flex;flex-wrap:wrap;gap:8px;' }, '<div class="skeleton" style="height:60px;width:100%"></div>')]);
    c.appendChild(chipsCard);
    // full table
    c.appendChild(el('div', { class: 'card' }, [el('div', { class: 'card-head', id: 'tags-head' }, [el('div', { class: 'card-title' }, t('tagDistribution'))]), el('div', { class: 'card-body', id: 'tags-table', style: 'padding:0;' }, '<div class="skeleton" style="height:300px"></div>')]));

    api('tags', { period: state.period }).then(function (d) {
      state.data.tags = d;
      var top = (d.top || []).slice(0, 10);
      var totals = d.totals || {};
      // summary cards
      document.getElementById('tag-sum').innerHTML =
        hmKpi(t('totalUniqueTags'), formatNum(totals.uniqueTags || 0, state.lang), ICONS.hash, '#7c3aed') +
        hmKpi(t('taggedTickets'), formatNum(totals.taggedTickets || 0, state.lang), ICONS.ticket, '#d97706') +
        hmKpi(t('avgTagsPerTicket'), toFa(totals.avgPerTicket || 0), ICONS.trends, '#9333ea') +
        hmKpi(t('topTags'), formatNum(top[0] ? top[0].count : 0, state.lang), ICONS.tag, '#16a34a');
      // charts
      setTimeout(function () {
        var distCtx = document.getElementById('chart-tag-dist');
        if (distCtx) charts.tagDist = new Chart(distCtx, {
          type: 'bar',
          data: {
            labels: top.map(function (x) { return '#' + (x.labelFa || x.label || x.key); }),
            datasets: [{ data: top.map(function (x) { return x.count; }), backgroundColor: top.map(function (_, i) { return TAG_COLORS[i % TAG_COLORS.length]; }), borderRadius: 4 }]
          },
          options: { indexAxis: 'y', responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } }, scales: { x: { beginAtZero: true, grid: { color: getCss('--border') } }, y: { grid: { display: false }, ticks: { font: { size: 11 } } } } }
        });
        var trendKeys = (d.trendKeys || []).slice(0, 5);
        var trendRows = d.trend || [];
        var trendCtx = document.getElementById('chart-tag-trend');
        if (trendCtx) charts.tagTrend = new Chart(trendCtx, {
          type: 'line',
          data: {
            labels: trendRows.map(function (r) { return dateLabel(r.date, state.lang); }),
            datasets: trendKeys.map(function (k, i) {
              return {
                label: '#' + k,
                data: trendRows.map(function (r) { return r[k] || 0; }),
                borderColor: TAG_COLORS[i % TAG_COLORS.length],
                backgroundColor: TAG_COLORS[i % TAG_COLORS.length] + '22',
                tension: 0.3, borderWidth: 2, pointRadius: 0
              };
            })
          },
          options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { position: 'bottom', labels: { font: { size: 11 } } } }, scales: { y: { beginAtZero: true, grid: { color: getCss('--border') } }, x: { grid: { display: false }, ticks: { font: { size: 10 }, maxRotation: 45, minRotation: 45 } } } }
        });
      }, 50);
      // chips cloud
      var max = top[0] ? top[0].count : 1;
      var chipsHtml = (d.top || []).map(function (tag, i) {
        var scale = 0.85 + ((tag.count / max) * 0.9);
        var color = TAG_COLORS[i % TAG_COLORS.length];
        var lbl = state.lang === 'fa' ? (tag.labelFa || tag.label || tag.key) : (tag.label || tag.labelFa || tag.key);
        return '<span class="tag-chip" style="font-size:' + scale + 'rem;color:' + color + ';border-color:' + color + '40;background:' + color + '14;" title="#' + (tag.label || tag.key) + ' · ' + tag.count + '">#' + escHtml(lbl) + '<span style="margin-inline-start:6px;font-size:0.7em;opacity:0.6;">' + toFa(formatNum(tag.count, state.lang)) + '</span></span>';
      }).join('');
      var chips = document.getElementById('tag-chips');
      if (chips) chips.innerHTML = chipsHtml || '<div class="empty">' + t('noData') + '</div>';
      // full table
      var all = d.top || [];
      var rows = all.map(function (tag) {
        return { name: '#' + (tag.labelFa || tag.label || tag.key), count: tag.count, share: tag.share, growth: tag.growth };
      });
      var headers = [
        { key: 'name', label: t('tagName') }, { key: 'count', label: t('tagCount') },
        { key: 'share', label: t('tagShare') + ' ' + pctSign() }, { key: 'growth', label: t('tagGrowth') + ' ' + pctSign() },
      ];
      var head = document.getElementById('tags-head');
      head.appendChild(exportMenu('tags', rows, headers, 'tag-analytics', t('tagsTitle')));
      var tbl = document.getElementById('tags-table');
      tbl.innerHTML = '<div class="table-wrap" style="max-height:28rem;"><table><thead class="sticky-bg"><tr><th>#</th>' + headers.map(function (h) { return '<th>' + h.label + '</th>'; }).join('') + '</tr></thead><tbody>' + all.map(function (tag, i) {
        var color = TAG_COLORS[i % TAG_COLORS.length];
        var gpos = (tag.growth || 0) >= 0;
        var lbl = state.lang === 'fa' ? (tag.labelFa || tag.label || tag.key) : (tag.label || tag.labelFa || tag.key);
        return '<tr><td><span style="display:flex;width:24px;height:24px;align-items:center;justify-content:center;border-radius:50%;color:#fff;font-size:11px;font-weight:700;background:' + color + '">' + toFa(i + 1) + '</span></td>' +
          '<td style="font-weight:500">#' + escHtml(lbl) + '</td>' +
          '<td class="stat-number" style="font-weight:500">' + toFa(formatNum(tag.count, state.lang)) + '</td>' +
          '<td><div style="display:flex;align-items:center;gap:8px"><div class="progress" style="width:80px"><div class="progress-fill" style="width:' + Math.min((tag.count / max) * 100, 100) + '%;background:' + color + '"></div></div><span class="stat-number" style="font-size:12px;color:var(--muted-fg)">' + toFa(tag.share) + pctSign() + '</span></div></td>' +
          '<td><span class="badge ' + (gpos ? 'badge-emerald' : 'badge-rose') + '">' + (gpos ? '▲' : '▼') + ' ' + toFa(Math.abs(tag.growth || 0)) + pctSign() + '</span></td>' +
        '</tr>';
      }).join('') + '</tbody></table></div>';
    }).catch(function (e) {
      var st = document.getElementById('tag-sum'); if (st) st.innerHTML = '';
      var tt = document.getElementById('tags-table'); if (tt) tt.innerHTML = '<div class="empty">' + (e.message || t('noData')) + '</div>';
    });
  }

  // ---- Command Palette ----
  var paletteOpen = false;
  function openPalette() {
    paletteOpen = true;
    var overlay = el('div', { id: 'palette-overlay', style: 'position:fixed;inset:0;z-index:100;background:rgba(0,0,0,0.5);display:flex;align-items:flex-start;justify-content:center;padding-top:15vh;' });
    var dialog = el('div', { class: 'card', style: 'width:100%;max-width:560px;' });
    var inputWrap = el('div', { style: 'display:flex;align-items:center;gap:12px;padding:12px 16px;border-bottom:1px solid var(--border);' }, [el('span', { style: 'display:inline-flex;flex-shrink:0;width:18px;height:18px;color:var(--muted-fg);', html: ICONS.search }), el('input', { id: 'palette-input', placeholder: t('searchPlaceholder'), style: 'flex:1;background:transparent;border:none;outline:none;font-family:inherit;font-size:14px;color:var(--fg)' })]);
    var list = el('div', { id: 'palette-list', style: 'max-height:320px;overflow-y:auto;padding:8px;' });
    var footer = el('div', { style: 'border-top:1px solid var(--border);padding:8px 16px;font-size:11px;color:var(--muted-fg);background:var(--muted)' }, '↑↓ ' + (state.lang === 'fa' ? 'پیمایش' : 'navigate') + ' · ↵ ' + (state.lang === 'fa' ? 'انتخاب' : 'select') + ' · ESC');
    dialog.appendChild(inputWrap); dialog.appendChild(list); dialog.appendChild(footer);
    overlay.appendChild(dialog);
    overlay.addEventListener('click', function (e) { if (e.target === overlay) closePalette(); });
    document.body.appendChild(overlay);
    var commands = [['overview','navOverview'],['channels','navChannels'],['agents','navAgents'],['roles','navRoles'],['responseTime','navResponseTime'],['sla','navSla'],['heatmap','navHeatmap'],['wordcloud','navWordcloud'],['trends','navTrends'],['organizations','navOrganizations'],['tags','navTags'],['kb','navKb'],['tickets','navTickets']];
    function renderList(q) {
      var filtered = q ? commands.filter(function (cmd) { var label = t(cmd[1]); return label.toLowerCase().indexOf(q.toLowerCase()) >= 0 || cmd[0].indexOf(q.toLowerCase()) >= 0; }) : commands;
      if (!filtered.length) { list.innerHTML = '<div class="empty">' + t('noResults') + '</div>'; return; }
      list.innerHTML = filtered.map(function (cmd, i) { return '<button class="dropdown-item" data-section="' + cmd[0] + '" style="width:100%;justify-content:space-between">' + t(cmd[1]) + '</button>'; }).join('');
      list.querySelectorAll('button').forEach(function (b) { b.addEventListener('click', function () { navigate(b.dataset.section); closePalette(); }); });
    }
    renderList('');
    var inp = document.getElementById('palette-input');
    inp.addEventListener('input', function () { renderList(inp.value); });
    inp.focus();
    document.addEventListener('keydown', paletteKey);
  }
  function paletteKey(e) {
    if (e.key === 'Escape') { closePalette(); }
  }
  function closePalette() {
    paletteOpen = false;
    var ov = document.getElementById('palette-overlay');
    if (ov) ov.remove();
    document.removeEventListener('keydown', paletteKey);
  }

  // ---- init ----
  if (window.__CONFIG__ && window.__CONFIG__.authenticated) {
    renderDashboard();
    // Global keyboard shortcuts handler.
    // Mirrors src/app/page.tsx: Ctrl+K (palette), ? (help), Esc (close),
    // r (refresh-all), t (toggle theme), l (toggle lang), g+letter (navigate).
    var gPressed = false;
    var gResetTimer = null;
    document.addEventListener('keydown', function (e) {
      // Cmd/Ctrl + K → palette (always works, even in inputs)
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        if (paletteOpen) closePalette(); else openPalette();
        return;
      }

      // Ignore the rest when typing in an input/textarea/contenteditable
      var tag = (e.target && e.target.tagName) ? e.target.tagName.toUpperCase() : '';
      var isInput = tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || (e.target && e.target.isContentEditable);
      if (isInput) return;

      // ? → help (also catches Shift+/ which produces '?' on most layouts)
      if (e.key === '?' || (e.shiftKey && e.key === '/')) {
        e.preventDefault();
        if (state.helpOpen) closeHelpDialog(); else openHelpDialog();
        return;
      }
      // Esc closes any open dialog (palette handled by its own listener; help, notif, health, drill-down here)
      if (e.key === 'Escape') {
        if (paletteOpen) { closePalette(); return; }
        if (state.helpOpen) { closeHelpDialog(); return; }
        if (state.notificationsOpen) { closeNotificationsPanel(); return; }
        if (state.healthOpen) { closeHealthPopover(); return; }
        if (state.wordDrilldown) { closeWordDrilldown(); return; }
        if (state.kpiDrilldownOpen) { closeKpiDrilldown(); return; }
        if (state.settingsOpen) { closeSettingsDialog(); return; }
        return;
      }
      // Don't trigger shortcuts if a modifier is held (so Ctrl+R browser refresh still works, etc.)
      if (e.metaKey || e.ctrlKey || e.altKey) return;

      var key = e.key.toLowerCase();

      // r → refresh-all
      if (key === 'r') { e.preventDefault(); handleRefreshAll(); return; }
      // t → toggle theme
      if (key === 't') { e.preventDefault(); toggleTheme(); return; }
      // l → toggle language
      if (key === 'l') { e.preventDefault(); cycleLang(); return; }
      // s → open settings dialog (Task 9-PHP-MIRROR-2)
      if (key === 's') { e.preventDefault(); if (state.settingsOpen) closeSettingsDialog(); else openSettingsDialog(); return; }
      // b → open saved views panel (Task 9-PHP-MIRROR-2)
      if (key === 'b') { e.preventDefault(); if (state.savedViewsOpen) closeSavedViewsPanel(); else openSavedViewsPanel(); return; }

      // g + letter → navigate (two-key sequence; second key must arrive within 800ms)
      if (key === 'g' && !gPressed) {
        gPressed = true;
        if (gResetTimer) clearTimeout(gResetTimer);
        gResetTimer = setTimeout(function () { gPressed = false; }, 800);
        return;
      }
      if (gPressed) {
        var navMap = {
          o: 'overview', c: 'channels', a: 'agents', r: 'roles',
          t: 'tickets', w: 'wordcloud', h: 'heatmap', s: 'sla',
          e: 'responseTime', n: 'trends', g: 'organizations', b: 'kb', l: 'tags', p: 'comparison',
        };
        if (navMap[key]) {
          e.preventDefault();
          navigate(navMap[key]);
        }
        gPressed = false;
        if (gResetTimer) { clearTimeout(gResetTimer); gResetTimer = null; }
        return;
      }
    });
    // Listen for the global refresh event (so non-header callers can also trigger a refresh)
    window.addEventListener(REFRESH_EVENT, function () {
      // The actual re-fetch is done in handleRefreshAll; this listener is a hook
      // for any future component that wants to subscribe. We also bump the
      // sidebar stats & notifications here for resilience.
      if (!state.refreshing) {
        fetchSidebarStats();
        fetchNotifications();
      }
    });
  } else {
    renderLogin();
  }
})();
