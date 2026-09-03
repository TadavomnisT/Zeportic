# Changelog

All notable changes to Zeportic are documented here.
Format based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
versioning follows [SemVer](https://semver.org/).

## [1.1.0] — 2026-09-03

### Added
- **Graphical first-run setup wizard** (`setup.php` + `assets/setup.js/css`):
  environment check, Elasticsearch connection test with cluster health and
  automatic `zammad*` index discovery (with document counts and prefix
  suggestions), dashboard admin account creation, default language/theme
  selection. Writes `config.local.php` (git-ignored, HTTP-guarded, atomic
  write) and stores the admin password as a `password_hash()`.
- New `src/Config.php`: versioned `config.php` deep-merged with the optional
  `config.local.php`; `Config::isConfigured()` drives the wizard flow.
  `index.php`, `api.php` and `diagnose.php` all load config through it —
  unconfigured installs redirect to the wizard (`api.php` answers
  `503 setup_required` with the wizard URL).
- `docs/screenshots/` — real screenshots of every report section, the setup
  wizard and the login page, embedded in the README.
- README: repository URLs (github.com/TadavomnisT/Zeportic), `git clone`
  instructions, screenshot gallery, setup-wizard guide, emoji-free feature
  table, new troubleshooting entries (wizard re-run, write permissions,
  forgotten dashboard password).

### Changed
- **Dark theme is now the default** (`app.default_theme: dark`) — the branded
  purple dark mode ships out of the box; light remains one click away.
- Shipped `config.php` now contains placeholder credentials
  (`CHANGE_ME_ELASTIC_PASSWORD`) so a fresh clone boots straight into the
  setup wizard; manual configuration remains fully supported.
- Version bumped to 1.1.0 (login badge, footer, exports).

## [1.0.0] — 2026-09-03

The first community release of **Zeportic — Zammad Reporting Tool**.

### Added
- Purple brand theme matching the Zeportic logo (light + dark).
- English as the default UI language with full internationalization:
  **26 languages** (English, Persian, Arabic, Hebrew, Urdu, German, French,
  Spanish, Portuguese-BR, Italian, Dutch, Polish, Czech, Greek, Russian,
  Ukrainian, Turkish, Swedish, Indonesian, Vietnamese, Hindi, Thai, Japanese,
  Korean, Chinese Simplified/Traditional) with runtime switching, per-language
  packs (`assets/lang/*.js`), English fallback, and automatic RTL/LTR layout.
- Rebuilt login page: 3D animated logo (mouse-tracked tilt, halo, parallax
  chips), feature showcase, language switcher, version badge.
- Brute-force login lockout (5 attempts → 60 s) with `Retry-After` header.
- Support for `password_hash()` credentials in `config.php`.
- Strict Content-Security-Policy (`script-src 'self'`), `X-Frame-Options`,
  `Referrer-Policy`, `Cache-Control: no-store` on API responses.
- Favicon + purple `theme-color`; sidebar and login use the real logo mark.
- GitHub community files: CONTRIBUTING.md, SECURITY.md, CHANGELOG.md.
- README rewritten: Zammad 6.x/7.x compatibility, Docker & docker-compose
  connection guide, systemd unit, configuration reference, troubleshooting.

### Changed
- All university-specific branding removed; the project is now the generic,
  community-oriented **Zeportic — Zammad Reporting Tool**.
- Timezone default changed from `Asia/Tehran` to `UTC` (configurable).
- Storage keys and refresh events renamed from `shahrood-*` to `zeportic-*`.
- Chart + palette colors migrated from teal/sky to the purple brand family.
- Demo/mock datasets use English content and fictional organizations.

### Fixed
- Language toggle on the login page crashed instead of re-rendering —
  language/theme switching now works on both views.
- Jalali calendar date-picker strings now follow the active language.
- Session cookie now sets the `Secure` flag automatically on HTTPS.
