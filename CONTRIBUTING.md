# Contributing to Zeportic

Thank you for helping make Zeportic better! 🎉

Zeportic is intentionally **dependency-free**: pure PHP on the server, plain
HTML/CSS/JS on the client. If your contribution needs Composer, npm, a build
step, or a CDN, please open an issue first so we can discuss an alternative.

## Ways to contribute

| Difficulty | Contribution |
|---|---|
| ★ | **Translate** the UI into a new language (see below) |
| ★ | Improve documentation / fix typos |
| ★★ | Report bugs with clear reproduction steps |
| ★★ | Improve an existing report or add chart polish |
| ★★★ | Add a new report section (PHP aggregation + JS render) |

## Getting started

```bash
git clone https://github.com/TadavomnisT/Zeportic.git
cd Zeportic
php -S 0.0.0.0:1234
# open http://localhost:1234 — the setup wizard appears on the first run
```

If you don't have a Zammad/Elasticsearch instance handy, any Elasticsearch
with the `zammad_production_*` index family works. `php diagnose.php` tells
you exactly what is missing.

## Adding a translation (the easiest way to help)

1. Copy `assets/lang/en.js` → `assets/lang/<code>.js` (use an ISO code, e.g.
   `fi.js`, `pl.js`, `zh-tw.js`).
2. Translate **values only** — keep keys and product names
   (Zeportic, Zammad, Elasticsearch) untouched.
3. Register your language in `assets/lang/meta.js`:
   ```js
   { code: 'fi', name: 'Suomi', dir: 'ltr' },
   ```
   Use `dir: 'rtl'` for right-to-left languages.
4. Test: switch languages from the globe button; missing keys fall back to
   English automatically, but please translate all of them.
5. Open a pull request with a screenshot of your language in action if you can.

## Pull request guidelines

- One feature or fix per PR; keep diffs focused.
- PHP: follow the existing style (strict types, `declare(strict_types=1)`,
  4-space indent). Run `php -l` on changed files and `php diagnose.php`.
- JS: ES5-compatible syntax in `assets/app.js` (the file is served as-is —
  no transpiler). Keep functions small and documented.
- CSS: use the design tokens in `:root`/`[data-theme="dark"]`; support both
  LTR and RTL via logical properties (`margin-inline-start`, `inset-inline-end`, …).
- Security: never introduce external network calls, CDNs, or eval — the CSP is
  `script-src 'self'` and must stay that way.
- Update `CHANGELOG.md` under an "Unreleased" heading.

## Reporting bugs

Open a [GitHub issue](https://github.com/TadavomnisT/Zeportic/issues) and include:

- Zeportic version (from `config.php` → `app.version`)
- PHP version and OS (`php -v`, `uname -a`)
- Zammad version + how ES is hosted (native/Docker)
- Output of `php diagnose.php` (**redact passwords!**)
- The relevant lines from `storage/errors.php`
- Browser + console output if it's a UI bug

## Code of conduct

Be kind and constructive. We're all volunteers making helpdesk data more
readable.
