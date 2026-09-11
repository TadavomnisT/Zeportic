/* ============================================================================
   Zeportic — Setup Wizard front-end (setup.php)
   Vanilla ES5-compatible JS, no dependencies, CSP-safe (no eval, no inline).
   Renders a 4-step wizard: Welcome → Elasticsearch → Admin account → Done.
   ============================================================================ */
(function () {
  'use strict';

  var body = document.body;
  var VERSION = body.getAttribute('data-version') || '1.1.0';
  var LANGS = [];
  try { LANGS = JSON.parse(body.getAttribute('data-langs') || '[]'); } catch (e) { LANGS = []; }

  var LANG_NAMES = {
    en: 'English', fa: 'فارسی', ar: 'العربية', he: 'עברית', ur: 'اردو',
    de: 'Deutsch', fr: 'Français', es: 'Español', pt: 'Português', it: 'Italiano',
    nl: 'Nederlands', pl: 'Polski', cs: 'Čeština', el: 'Ελληνικά', ru: 'Русский',
    uk: 'Українська', tr: 'Türkçe', sv: 'Svenska', id: 'Bahasa Indonesia',
    vi: 'Tiếng Việt', hi: 'हिन्दी', th: 'ไทย', ja: '日本語', ko: '한국어',
    'zh-cn': '简体中文', 'zh-tw': '繁體中文'
  };

  var ICONS = {
    check: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6 9 17l-5-5"/></svg>',
    x: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><path d="M18 6 6 18M6 6l12 12"/></svg>',
    alert: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z"/><path d="M12 9v4"/><path d="M12 17h.01"/></svg>',
    arrowR: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12h14"/><path d="m12 5 7 7-7 7"/></svg>',
    arrowL: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M19 12H5"/><path d="m12 19-7-7 7-7"/></svg>',
    refresh: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 12a9 9 0 0 1 15-6.7L21 8"/><path d="M21 3v5h-5"/><path d="M21 12a9 9 0 0 1-15 6.7L3 16"/><path d="M3 21v-5h5"/></svg>',
    sun: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="4"/><path d="M12 2v2"/><path d="M12 20v2"/><path d="m4.93 4.93 1.41 1.41"/><path d="m17.66 17.66 1.41 1.41"/><path d="M2 12h2"/><path d="M20 12h2"/><path d="m6.34 17.66-1.41 1.41"/><path d="m19.07 4.93-1.41 1.41"/></svg>',
    moon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z"/></svg>',
    db: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><ellipse cx="12" cy="5" rx="9" ry="3"/><path d="M3 5v14a9 3 0 0 0 18 0V5"/><path d="M3 12a9 3 0 0 0 18 0"/></svg>',
    shield: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.24-2.72a1.17 1.17 0 0 1 1.52 0C14.51 3.81 17 5 19 5a1 1 0 0 1 1 1z"/></svg>'
  };

  // ------------------------------------------------------------------ utils
  function el(tag, attrs, children) {
    var node = document.createElement(tag);
    if (attrs) {
      Object.keys(attrs).forEach(function (k) {
        var v = attrs[k];
        if (v === null || v === undefined) return;
        if (k === 'class') node.className = v;
        else if (k === 'html') node.innerHTML = v; // static SVG strings only
        else if (k.slice(0, 2) === 'on') node.addEventListener(k.slice(2), v);
        else node.setAttribute(k, v);
      });
    }
    (children || []).forEach(function (c) { if (c) node.appendChild(typeof c === 'string' ? document.createTextNode(c) : c); });
    return node;
  }

  var toastTimer = null;
  function toast(msg) {
    var old = document.querySelector('.setup-toast');
    if (old) old.remove();
    var t = el('div', { class: 'setup-toast', role: 'alert' }, [msg]);
    document.body.appendChild(t);
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { t.remove(); }, 4500);
  }

  function api(action, payload, method) {
    return fetch('/setup.php?action=' + encodeURIComponent(action), {
      method: method || (payload ? 'POST' : 'GET'),
      headers: payload ? { 'Content-Type': 'application/json' } : undefined,
      body: payload ? JSON.stringify(payload) : undefined,
      credentials: 'same-origin'
    }).then(function (r) {
      return r.json().then(function (j) { j.__http = r.status; return j; });
    });
  }

  // ------------------------------------------------------------------ state
  var state = {
    step: 0,
    reqs: null,
    esTested: false,
    esTest: null,
    form: {
      host: 'https://localhost:9200',
      indexPrefix: 'zammad_production',
      username: 'elastic',
      password: '',
      verifySsl: false,
      adminUsername: 'admin',
      adminPassword: '',
      adminPassword2: '',
      lang: 'en',
      theme: 'dark'
    }
  };

  var root = document.getElementById('setup-root');
  var shell = el('div', { class: 'setup-shell' });
  root.appendChild(shell);

  // background orbs
  shell.parentElement.appendChild(el('div', { class: 'setup-orb orb-1' }));
  shell.parentElement.appendChild(el('div', { class: 'setup-orb orb-2' }));

  function brand() {
    return el('div', { class: 'setup-brand' }, [
      el('img', { src: '/assets/img/logo-mark.png', alt: 'Zeportic logo' }),
      el('div', { class: 't' }, [
        el('b', null, ['Zeportic']),
        el('span', null, ['Zammad Reporting Tool — first-run setup · v' + VERSION])
      ])
    ]);
  }

  function stepsBar(current, labels) {
    var bar = el('div', { class: 'setup-steps' });
    labels.forEach(function (lbl, i) {
      if (i > 0) bar.appendChild(el('div', { class: 'setup-step-link' }));
      var cls = 'setup-step' + (i === current ? ' active' : '') + (i < current ? ' done' : '');
      var dot = el('div', { class: 'dot' }, [String(i < current ? '✓' : i + 1)]);
      bar.appendChild(el('div', { class: cls }, [dot, el('span', { class: 'lbl' }, [lbl])]));
    });
    return bar;
  }

  function actions(leftBtn, rightBtns) {
    var a = el('div', { class: 'setup-actions' });
    a.appendChild(leftBtn || el('span'));
    var right = el('div', { style: 'display:flex;gap:8px;' });
    (rightBtns || []).forEach(function (b) { right.appendChild(b); });
    a.appendChild(right);
    return a;
  }

  function field(label, input, hint) {
    return el('div', { class: 'f' }, [
      el('label', null, [label, hint ? el('span', { class: 'hint' }, [' — ' + hint]) : null]),
      input
    ]);
  }

  // =====================================================================
  // STEP 0 — Welcome + environment requirements
  // =====================================================================
  function renderWelcome() {
    shell.innerHTML = '';
    var card = el('div', { class: 'setup-card', id: 'welcome-card' });
    card.appendChild(el('h2', null, ['Welcome to Zeportic']));
    card.appendChild(el('p', { class: 'desc' }, [
      'This wizard connects Zeportic to the Elasticsearch indices behind your Zammad helpdesk and creates the dashboard administrator account. ',
      'It only runs once — everything it writes can be changed later in ',
      el('code', { class: 'mono' }, ['config.local.php']), '.'
    ]));
    card.appendChild(el('div', { class: 'req-list', id: 'req-list' }, [
      el('div', { class: 'req-item' }, [el('span', { class: 'warn' }, ['…']), el('span', { class: 'name' }, ['Checking your environment…'])])
    ]));

    var nextBtn = el('button', { class: 'btn primary', disabled: '' }, ['Begin setup', el('span', { html: ICONS.arrowR, class: 'flex-shrink-svg' })]);
    nextBtn.addEventListener('click', function () { state.step = 1; renderEs(); });
    card.appendChild(actions(null, [nextBtn]));

    shell.appendChild(brand());
    shell.appendChild(stepsBar(0, ['Welcome', 'Elasticsearch', 'Admin account', 'Finish']));
    shell.appendChild(card);
    shell.appendChild(el('div', { class: 'setup-foot' }, [
      'Pure PHP · no dependencies · GPL-3.0 · ',
      el('a', { href: 'https://github.com/TadavomnisT/Zeportic', target: '_blank', rel: 'noopener' }, ['github.com/TadavomnisT/Zeportic'])
    ]));

    api('requirements').then(function (r) {
      state.reqs = r;
      var list = document.getElementById('req-list');
      if (!list) return;
      list.innerHTML = '';

      function item(ok, name, detail, warnOnly) {
        var badge = ok ? el('span', { class: 'ok', html: ICONS.check }) : (warnOnly ? el('span', { class: 'warn', html: ICONS.alert }) : el('span', { class: 'bad', html: ICONS.x }));
        return el('div', { class: 'req-item' }, [badge, el('span', { class: 'name' }, [name]), el('small', null, [detail])]);
      }

      list.appendChild(item(r.phpOk, 'PHP version', r.phpVersion + (r.phpOk ? '' : ' — 8.0+ required')));
      list.appendChild(item(!!(r.ext && r.ext.curl), 'curl extension', r.ext && r.ext.curl ? 'loaded' : 'required for Elasticsearch calls'));
      list.appendChild(item(!!(r.ext && r.ext.json), 'json extension', r.ext && r.ext.json ? 'loaded' : 'required'));
      list.appendChild(item(!!(r.ext && r.ext.mbstring), 'mbstring extension', r.ext && r.ext.mbstring ? 'loaded' : 'required for multi-language text'));
      list.appendChild(item(r.storageWritable, 'storage/ folder writable', r.storageWritable ? 'error logs can be written' : 'error logging will fail', true));
      list.appendChild(item(r.rootWritable, 'project folder writable', r.rootWritable ? 'setup can save config.local.php' : 'setup cannot save the configuration!', true));

      var fatal = !(r.phpOk && r.ext && r.ext.curl && r.ext.json && r.ext.mbstring);
      if (fatal) {
        nextBtn.disabled = true;
        toast('Fix the failed requirements above, then reload this page.');
      } else if (!r.rootWritable) {
        nextBtn.disabled = true;
        toast('The project folder is not writable — Zeportic cannot save config.local.php. Fix permissions and reload.');
      } else {
        nextBtn.disabled = false;
      }
    }).catch(function () { toast('Could not load requirements — is PHP running?'); });
  }

  // =====================================================================
  // STEP 1 — Elasticsearch connection
  // =====================================================================
  function renderEs() {
    shell.innerHTML = '';
    var card = el('div', { class: 'setup-card' });
    card.appendChild(el('h2', null, ['Connect to Elasticsearch']));
    card.appendChild(el('p', { class: 'desc' }, [
      'Zammad stores tickets, users, organizations and more in Elasticsearch. ',
      'Zeportic only READS those indices — it never writes a single byte. ',
      'With the official ', el('b', null, ['zammad-docker-compose']), ' stack, the default endpoint is ',
      el('code', { class: 'mono' }, ['http://127.0.0.1:9200']), ' (port published to the host) or ',
      el('code', { class: 'mono' }, ['https://localhost:9200']), ' (TLS).'
    ]));

    var fHost = el('input', { type: 'text', id: 'f-host', placeholder: 'http://127.0.0.1:9200', autocomplete: 'url', spellcheck: 'false' });
    fHost.value = state.form.host;
    var fPrefix = el('input', { type: 'text', id: 'f-prefix', placeholder: 'zammad_production', spellcheck: 'false' });
    fPrefix.value = state.form.indexPrefix;
    var fUser = el('input', { type: 'text', id: 'f-user', placeholder: 'elastic', autocomplete: 'off', spellcheck: 'false' });
    fUser.value = state.form.username;
    var fPass = el('input', { type: 'password', id: 'f-pass', placeholder: 'Elasticsearch password', autocomplete: 'new-password' });
    fPass.value = state.form.password;
    var chk = el('input', { type: 'checkbox', id: 'f-verify' });
    chk.checked = state.form.verifySsl;

    var grid = el('div', { class: 'f-grid' });
    grid.appendChild(field('Elasticsearch URL', fHost, 'the base URL, no index path'));
    grid.appendChild(field('Index prefix', fPrefix, "Zammad's default: zammad_production"));
    grid.appendChild(field('Username', fUser, 'elastic or a read-only user'));
    grid.appendChild(field('Password', fPass));
    card.appendChild(grid);
    card.appendChild(el('div', { style: 'height:14px' }));
    card.appendChild(el('label', { class: 'check-row' }, [
      chk,
      el('span', null, ['Verify TLS certificate', el('small', null, ["Zammad's ES usually uses a self-signed certificate — leave unchecked to accept it."])]
      )
    ]));

    // test button + result container
    var testBtn = el('button', { class: 'btn', id: 'test-btn' }, [el('span', { html: ICONS.db, class: 'flex-shrink-svg' }), 'Test connection']);
    var resultBox = el('div', { id: 'test-result' });

    var backBtn = el('button', { class: 'btn ghost' }, [el('span', { html: ICONS.arrowL, class: 'flex-shrink-svg' }), 'Back']);
    backBtn.addEventListener('click', function () { state.step = 0; renderWelcome(); });
    var nextBtn = el('button', { class: 'btn primary', disabled: '' }, ['Continue', el('span', { html: ICONS.arrowR, class: 'flex-shrink-svg' })]);
    nextBtn.addEventListener('click', function () {
      collect();
      state.step = 2;
      renderAdmin();
    });

    function collect() {
      state.form.host = fHost.value.trim();
      state.form.indexPrefix = fPrefix.value.trim();
      state.form.username = fUser.value.trim();
      state.form.password = fPass.value;
      state.form.verifySsl = chk.checked;
    }

    testBtn.addEventListener('click', function () {
      collect();
      var btn = testBtn;
      btn.disabled = true;
      btn.innerHTML = '';
      btn.appendChild(el('span', { class: 'spinner' }));
      btn.appendChild(document.createTextNode('Testing…'));
      resultBox.innerHTML = '';
      nextBtn.disabled = true;

      api('test', {
        host: state.form.host,
        indexPrefix: state.form.indexPrefix,
        username: state.form.username,
        password: state.form.password,
        verifySsl: state.form.verifySsl
      }).then(function (r) {
        btn.disabled = false;
        btn.innerHTML = '';
        btn.appendChild(el('span', { html: ICONS.db, class: 'flex-shrink-svg' }));
        btn.appendChild(document.createTextNode('Test again'));
        state.esTested = !!r.ok;
        state.esTest = r;
        resultBox.appendChild(renderTestResult(r, fPrefix, state.form.indexPrefix));
        if (r.ok) nextBtn.disabled = false;
        else toast(r.error || 'Connection test failed');
      }).catch(function () {
        btn.disabled = false;
        btn.innerHTML = '';
        btn.appendChild(el('span', { html: ICONS.db, class: 'flex-shrink-svg' }));
        btn.appendChild(document.createTextNode('Test connection'));
        toast('Network error while testing the connection');
      });
    });

    card.appendChild(el('div', { style: 'height:16px' }));
    card.appendChild(testBtn);
    card.appendChild(resultBox);
    card.appendChild(actions(backBtn, [nextBtn]));

    shell.appendChild(brand());
    shell.appendChild(stepsBar(1, ['Welcome', 'Elasticsearch', 'Admin account', 'Finish']));
    shell.appendChild(card);
    shell.appendChild(el('div', { class: 'setup-foot' }, ['Need help? Run ', el('code', { class: 'mono' }, ['php diagnose.php']), ' on the server, or see the README “Connecting to Zammad” section.']));
  }

  function renderTestResult(r, prefixInput, currentPrefix) {
    var box = el('div', { class: 'test-result ' + (r.ok ? 'ok' : 'fail') });
    box.appendChild(el('div', { class: 'head' }, [
      el('span', { html: r.ok ? ICONS.check : ICONS.x, class: 'flex-shrink-svg' }),
      r.ok ? 'Connected — cluster is reachable' : 'Connection failed'
    ]));
    var bodyEl = el('div', { class: 'body' });

    if (r.ok) {
      var kv = el('div', { class: 'kv' });
      kv.appendChild(el('span', { class: 'k' }, ['Cluster name']));
      kv.appendChild(el('span', { class: 'v' }, [r.clusterName || '?']));
      kv.appendChild(el('span', { class: 'k' }, ['Elasticsearch version']));
      kv.appendChild(el('span', { class: 'v' }, [r.esVersion || '?']));
      kv.appendChild(el('span', { class: 'k' }, ['Cluster health']));
      kv.appendChild(el('span', { class: 'v' }, [(r.healthStatus || '?').toUpperCase() + ' · ' + r.nodes + ' node(s)']));
      kv.appendChild(el('span', { class: 'k' }, ['Zammad indices found']));
      kv.appendChild(el('span', { class: 'v' }, [String(r.zammadTotal)]));
      if (r.ticketDocs !== null && r.ticketDocs !== undefined) {
        kv.appendChild(el('span', { class: 'k' }, ['Tickets with this prefix']));
        kv.appendChild(el('span', { class: 'v' }, [Number(r.ticketDocs).toLocaleString('en-US')]));
      }
      bodyEl.appendChild(kv);

      // discovered indices as chips
      var names = Object.keys(r.zammadIndices || {});
      if (names.length) {
        var chips = el('div', { class: 'idx-chips' });
        names.forEach(function (n) {
          chips.appendChild(el('span', { class: 'idx-chip', title: r.zammadIndices[n] + ' documents' }, [
            n, ' ', el('b', null, [Number(r.zammadIndices[n]).toLocaleString('en-US')])
          ]));
        });
        bodyEl.appendChild(chips);
      }

      // prefix suggestions
      var sug = (r.prefixSuggestions || []).filter(function (p) { return p; });
      if (sug.length) {
        var row = el('div', { class: 'suggest-row' }, [el('span', { class: 's-lbl' }, ['Detected index prefixes:'])]);
        sug.forEach(function (p) {
          var chip = el('button', { type: 'button', class: 'suggest-chip' }, [p]);
          chip.addEventListener('click', function () {
            prefixInput.value = p;
            prefixInput.dispatchEvent(new Event('input'));
            toast('Index prefix set to "' + p + '" — test the connection again.');
          });
          row.appendChild(chip);
        });
        bodyEl.appendChild(row);
      }

      if (!(r.zammadTotal > 0)) {
        bodyEl.appendChild(el('div', { class: 'hint-box' }, [
          'The cluster is reachable but no zammad_* indices were found. Zammad only creates them once Search indexing is enabled (Admin → Search Settings) and at least one ticket exists.'
        ]));
      } else if (r.ticketDocs === null && currentPrefix) {
        bodyEl.appendChild(el('div', { class: 'hint-box' }, [
          'No ticket index found for prefix "', currentPrefix, '". If Zammad runs with a staging prefix (zammad_test), adjust the field above.'
        ]));
      }
    } else {
      bodyEl.appendChild(el('div', { class: 'kv' }, [
        el('span', { class: 'k' }, ['Error']),
        el('span', { class: 'v' }, [r.error || 'unknown'])
      ]));
      if (r.hint) bodyEl.appendChild(el('div', { class: 'hint-box' }, [r.hint]));
    }
    box.appendChild(bodyEl);
    return box;
  }

  // =====================================================================
  // STEP 2 — Dashboard admin account + preferences
  // =====================================================================
  function renderAdmin() {
    shell.innerHTML = '';
    var card = el('div', { class: 'setup-card' });
    card.appendChild(el('h2', null, ['Dashboard administrator']));
    card.appendChild(el('p', { class: 'desc' }, [
      'These credentials log you into the Zeportic dashboard itself (not Elasticsearch). ',
      'The password is stored as a modern ', el('b', null, ['password_hash()']), ' — never in plain text.'
    ]));

    var fUser = el('input', { type: 'text', id: 'a-user', autocomplete: 'username', spellcheck: 'false' });
    fUser.value = state.form.adminUsername;
    var fPass = el('input', { type: 'password', id: 'a-pass', autocomplete: 'new-password', placeholder: 'Choose a password' });
    fPass.value = state.form.adminPassword;
    var fPass2 = el('input', { type: 'password', id: 'a-pass2', autocomplete: 'new-password', placeholder: 'Repeat the password' });
    fPass2.value = state.form.adminPassword2;

    var meter = el('div', { class: 'pw-meter' }, [el('i')]);
    var note = el('div', { class: 'pw-note' }, ['Minimum 4 characters — 8+ with letters and digits recommended.']);

    function pwScore(v) {
      var s = 0;
      if (v.length >= 4) s = 1;
      if (v.length >= 8) s = 2;
      if (v.length >= 8 && /[a-zA-Z]/.test(v) && /\d/.test(v)) s = 3;
      if (v.length >= 12 && /[a-zA-Z]/.test(v) && /\d/.test(v) && /[^a-zA-Z0-9]/.test(v)) s = 4;
      return s;
    }
    function updateMeter() {
      var v = fPass.value;
      var s = pwScore(v);
      var i = meter.firstChild;
      var width = ['0%', '25%', '50%', '75%', '100%'][s];
      var color = ['#ef4444', '#ef4444', '#f59e0b', '#a3e635', '#22c55e'][s];
      i.style.width = v ? width : '0%';
      i.style.background = color;
      note.textContent = !v ? 'Minimum 4 characters — 8+ with letters and digits recommended.'
        : (['Very weak password', 'Weak password', 'Fair password', 'Good password', 'Strong password'][s]);
    }
    fPass.addEventListener('input', updateMeter);
    updateMeter();

    var grid = el('div', { class: 'f-grid' });
    grid.appendChild(field('Username', fUser));
    grid.appendChild(el('div'));
    grid.appendChild(field('Password', fPass));
    grid.appendChild(field('Confirm password', fPass2));
    card.appendChild(grid);
    card.appendChild(el('div', { style: 'margin-top:10px' }, [meter, el('div', { style: 'height:4px' }), note]));

    // --- preferences
    card.appendChild(el('h2', { style: 'font-size:15px;margin-top:22px' }, ['Preferences']));
    card.appendChild(el('p', { class: 'desc', style: 'margin-bottom:10px' }, ['You can change both later from the dashboard (language: globe button or L key · theme: T key).']));

    // theme segment
    var seg = el('div', { class: 'seg' });
    [['dark', ICONS.moon, 'Dark', 'recommended'], ['light', ICONS.sun, 'Light', 'bright offices']].forEach(function (opt) {
      var b = el('button', { type: 'button', class: state.form.theme === opt[0] ? 'on' : '' }, [
        el('span', { html: opt[1], class: 'flex-shrink-svg' }),
        opt[2],
        el('small', null, [opt[3]])
      ]);
      b.addEventListener('click', function () {
        state.form.theme = opt[0];
        Array.prototype.forEach.call(seg.children, function (c) { c.classList.remove('on'); });
        b.classList.add('on');
        document.documentElement.setAttribute('data-theme', opt[0]);
      });
      seg.appendChild(b);
    });
    card.appendChild(el('div', { class: 'f full', style: 'margin-top:12px' }, [el('label', null, ['Interface theme']), seg]));

    // language select
    var sel = el('select', { id: 'a-lang' });
    (LANGS.length ? LANGS : ['en']).forEach(function (code) {
      var o = el('option', { value: code }, [(LANG_NAMES[code] || code) + '  (' + code + ')']);
      if (state.form.lang === code) o.selected = true;
      sel.appendChild(o);
    });
    sel.addEventListener('change', function () { state.form.lang = sel.value; });
    card.appendChild(el('div', { style: 'height:14px' }));
    card.appendChild(el('div', { class: 'f full' }, [el('label', null, ['Default interface language — ', el('span', { class: 'hint' }, ['26 languages shipped, full RTL support'])]), sel]));

    var backBtn = el('button', { class: 'btn ghost' }, [el('span', { html: ICONS.arrowL, class: 'flex-shrink-svg' }), 'Back']);
    backBtn.addEventListener('click', function () { collect(); state.step = 1; renderEs(); });
    var finishBtn = el('button', { class: 'btn primary', id: 'finish-btn' }, [el('span', { html: ICONS.shield, class: 'flex-shrink-svg' }), 'Save & finish setup']);

    function collect() {
      state.form.adminUsername = fUser.value.trim();
      state.form.adminPassword = fPass.value;
      state.form.adminPassword2 = fPass2.value;
    }

    finishBtn.addEventListener('click', function () {
      collect();
      if (fPass.value !== fPass2.value) { toast('The two passwords do not match.'); return; }
      if (fPass.value.length < 4) { toast('Password must be at least 4 characters.'); return; }
      finishBtn.disabled = true;
      finishBtn.innerHTML = '';
      finishBtn.appendChild(el('span', { class: 'spinner' }));
      finishBtn.appendChild(document.createTextNode('Saving…'));

      api('finish', {
        host: state.form.host,
        indexPrefix: state.form.indexPrefix,
        username: state.form.username,
        password: state.form.password,
        verifySsl: state.form.verifySsl,
        adminUsername: state.form.adminUsername,
        adminPassword: state.form.adminPassword,
        adminPassword2: state.form.adminPassword2,
        lang: state.form.lang,
        theme: state.form.theme
      }).then(function (r) {
        if (r.ok) {
          state.step = 3;
          renderDone();
        } else {
          finishBtn.disabled = false;
          finishBtn.innerHTML = '';
          finishBtn.appendChild(el('span', { html: ICONS.shield, class: 'flex-shrink-svg' }));
          finishBtn.appendChild(document.createTextNode('Save & finish setup'));
          toast(r.error || 'Could not save the configuration');
        }
      }).catch(function () {
        finishBtn.disabled = false;
        toast('Network error while saving');
      });
    });

    card.appendChild(el('div', { style: 'height:20px' }));
    card.appendChild(el('div', { class: 'hint-box' }, [
      el('b', null, ['Security note: ']),
      'this wizard is only available until setup completes. Finish it promptly after deploying Zeportic — anyone who reaches an unconfigured instance can claim it.'
    ]));
    card.appendChild(actions(backBtn, [finishBtn]));

    shell.appendChild(brand());
    shell.appendChild(stepsBar(2, ['Welcome', 'Elasticsearch', 'Admin account', 'Finish']));
    shell.appendChild(card);
    shell.appendChild(el('div', { class: 'setup-foot' }, ['The wizard writes ', el('code', { class: 'mono' }, ['config.local.php']), ' (git-ignored). Delete that file to re-run this wizard.']));
  }

  // =====================================================================
  // STEP 3 — Done
  // =====================================================================
  function renderDone() {
    shell.innerHTML = '';
    var card = el('div', { class: 'setup-card center' });
    card.appendChild(el('div', { class: 'done-icon', html: ICONS.check }));
    card.appendChild(el('h2', null, ['Setup complete']));
    card.appendChild(el('p', { class: 'desc', style: 'margin-bottom:4px' }, [
      'Zeportic is configured and ready. The settings were saved to ',
      el('code', { class: 'mono' }, ['config.local.php']), '.'
    ]));
    var loginBtn = el('a', { class: 'btn primary', href: 'index.php', style: 'margin-top:18px;text-decoration:none' }, ['Open the dashboard login', el('span', { html: ICONS.arrowR, class: 'flex-shrink-svg' })]);
    card.appendChild(loginBtn);
    card.appendChild(el('p', { class: 'pw-note', style: 'margin-top:14px' }, ['Log in with: ', el('b', null, [state.form.adminUsername]), ' and the password you just chose.']));

    shell.appendChild(brand());
    shell.appendChild(stepsBar(3, ['Welcome', 'Elasticsearch', 'Admin account', 'Finish']));
    shell.appendChild(card);
    shell.appendChild(el('div', { class: 'setup-foot' }, ['Enjoying Zeportic? Star it on ', el('a', { href: 'https://github.com/TadavomnisT/Zeportic', target: '_blank', rel: 'noopener' }, ['GitHub']), ' — it helps the community grow.']));
  }

  // ------------------------------------------------------------------ boot
  renderWelcome();
})();
