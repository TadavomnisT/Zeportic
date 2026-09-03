# Zeportic — Zammad Reporting Tool

<p align="center">
  <img src="assets/img/logo-mark.png" width="140" alt="Zeportic logo" />
</p>

<p align="center">
  <strong>Real-time reporting & analytics for your Zammad helpdesk.</strong><br>
  Connects directly to the Elasticsearch indices behind <a href="https://zammad.org">Zammad</a> and turns raw ticket data into clear, decision-ready dashboards.
</p>

<p align="center">
  <img alt="license" src="https://img.shields.io/badge/license-GPL--3.0-blueviolet" />
  <img alt="php" src="https://img.shields.io/badge/PHP-%E2%89%A5%208.0-773bbd" />
  <img alt="zammad" src="https://img.shields.io/badge/Zammad-6.x%20%7C%207.x-8b5cf6" />
  <img alt="dependencies" src="https://img.shields.io/badge/dependencies-none-success" />
  <img alt="languages" src="https://img.shields.io/badge/UI%20languages-26-9333ea" />
</p>

> **Pure PHP. No npm. No bun. No Composer. No CDN. No internet required.**
> Just PHP + HTML + CSS + JS. Copy the folder to your Zammad/Elasticsearch server and run it.

---

## Table of contents

1. [Why Zeportic](#why-zeportic)
2. [Features](#features)
3. [Requirements](#requirements)
4. [Quick start (3 steps)](#quick-start-3-steps)
5. [Configuration reference](#configuration-reference)
6. [Connecting to Zammad](#connecting-to-zammad)
   - [Native (package-based) installation](#native-package-based-installation)
   - [Zammad running on Docker](#zammad-running-on-docker)
   - [Docker Compose service example](#docker-compose-service-example)
   - [Running Zeportic itself as a container](#running-zeportic-itself-as-a-container)
7. [Running as a systemd service](#running-as-a-systemd-service)
8. [Languages & translation](#languages--translation)
9. [Security notes](#security-notes)
10. [API reference](#api-reference)
11. [Troubleshooting](#troubleshooting)
12. [Project structure](#project-structure)
13. [Contributing](#contributing)
14. [License](#license)

---

## Why Zeportic

Zammad is an excellent helpdesk — but its built-in reporting is limited, and the
data lives inside Elasticsearch indices that are awkward to query by hand.

**Zeportic** bridges that gap. It is a small, dependency-free PHP application
that reads Zammad's Elasticsearch indices (`zammad_production_*`) and renders a
complete, admin-only analytics dashboard:

- Zero dependencies to install, zero build steps, zero external requests
- Runs on any machine that can reach your Elasticsearch (same host, LAN, or container)
- Read-only: it never writes a single byte to your Zammad data
- Compatible with **Zammad 6.x and 7.x** (index schema: ticket, user, organization,
  group, role, ticket_state, ticket_priority)

## Features

| | |
|---|---|
| 📊 **Real-time KPIs** | Total / open / closed tickets, escalations, average first-response and resolution time, active agents — with period-over-period deltas. |
| 🗂 **14 report sections** | Overview, Channels, Agents, Roles, Response Time, SLA & Escalation, Activity Heatmap, Word Cloud, Ticket Trends, Organizations, Tag Analytics, Knowledge Base, Period Comparison, Tickets. |
| 💬 **Interactive word cloud** | The most frequent customer words in real time — click any word to drill into matching tickets. |
| ⏱ **SLA & escalation analytics** | Compliance per priority, breach counts, escalation rates, response-time percentiles per channel. |
| 📈 **Trends & forecasting** | Created-vs-closed daily trend, 7-day linear-regression forecast, anomaly detection (±2σ), period comparison. |
| 🧠 **AI insights & leaderboard** | Auto-generated textual insights, agent performance leaderboard with podium. |
| 🔔 **Smart notifications** | SLA breaches, escalations, unassigned and urgent-open ticket alerts. |
| 📤 **Exports** | CSV / Excel / PDF export for every table; print-friendly layout. |
| 🌍 **26 UI languages** | Full RTL & LTR support (English, Persian, Arabic, Hebrew, Urdu, Chinese, Japanese, Korean, Hindi and more) — switchable at runtime. |
| 🌙 **Dark mode** | A carefully tuned purple dark theme across the whole dashboard. |
| ⌨️ **Power-user tools** | Command palette (Ctrl+K), keyboard shortcuts, saved views, settings. |
| 🩺 **Diagnostics** | `php diagnose.php` runs 7 connection checks with human-readable fixes; every error is structured-logged. |

## Requirements

On the machine that will run Zeportic (usually the Zammad/ES host itself):

- **PHP ≥ 8.0** with the `curl`, `json` and `mbstring` extensions
  (`curl` and `json` are enabled by default on Debian/Ubuntu):
  ```bash
  php -v              # check version
  php -m | grep curl  # check curl extension
  php -m | grep mbstring
  ```
- Network access from this app to your Elasticsearch instance
  (default `http://localhost:9200` or `https://localhost:9200`).
- Your **Elasticsearch password** (the `elastic` user, or a dedicated read-only user).

That's it. **No Composer, no npm, no bun, no build step.**

## Quick start (3 steps)

### 1. Copy the folder to your server

```bash
# from your local machine:
scp -r zeportic/ user@zammad-host:/opt/zeportic/

ssh user@zammad-host
cd /opt/zeportic
```

### 2. Edit `config.php` — the ONLY file you need to touch

```php
'elasticsearch' => [
    'host'          => 'https://localhost:9200',  // your ES endpoint
    'index_prefix'  => 'zammad_production',       // Zammad's default
    'username'      => 'elastic',
    'password'      => 'YOUR_ELASTIC_PASSWORD',   // ← put your elastic password here
    'verify_ssl'    => false,                     // false = accept self-signed cert
    'ca_bundle'     => null,
],
'auth' => [
    'username' => 'admin',
    'password' => 'CHANGE-ME',                    // ← login for the dashboard itself
    // Better: store a hash instead of plain text:
    // 'password_hash' => '$2y$10$...',            // php -r "echo password_hash('CHANGE-ME', PASSWORD_DEFAULT);"
],
```

### 3. Start the server

```bash
php -S 0.0.0.0:1234
```

Open `http://YOUR-SERVER-IP:1234` and log in with the `auth.username` /
`auth.password` you set in `config.php`.

> **That's the whole command.** No `-t`, no router file, no flags — PHP's
> built-in server uses the current folder as docroot and `index.php` as the
> default entry. (Optionally, `./start.sh 8080` does the same with a banner.)

Verify everything with the built-in doctor:

```bash
php diagnose.php
```

## Configuration reference

All configuration lives in `config.php` (guarded against direct HTTP access):

| Key | Default | Description |
|---|---|---|
| `elasticsearch.host` | `http://127.0.0.1:9200` | Base URL of your Elasticsearch. Use `https://` for TLS. |
| `elasticsearch.index_prefix` | `zammad_production` | Zammad's index prefix. Staging installs usually use `zammad_test`. |
| `elasticsearch.username` / `password` | — | ES credentials. The app only issues read requests (`_search`, `_count`, `_cat/indices`, `_cluster/health`, `_mapping`). |
| `elasticsearch.verify_ssl` | `false` | Verify the TLS certificate. Keep `false` for self-signed certs (Zammad's default). |
| `elasticsearch.ca_bundle` | `null` | Path to a CA bundle used when `verify_ssl` is `true`. |
| `auth.username` / `password` | `admin` / `admin` | Dashboard login (not your Zammad/ES credentials). **Change before exposing.** |
| `auth.password_hash` | `null` | Optional `password_hash()` value. When set, it takes precedence over `password`. |
| `auth.session_lifetime` | `28800` | Session lifetime in seconds (8 h). |
| `app.name` / `app.subtitle` | `Zeportic` / `Zammad Reporting Tool` | Branding shown in the sidebar, login and exports. |
| `app.default_lang` | `en` | Any language code from `assets/lang/meta.js` (e.g. `fa`, `de`, `zh-cn`). |
| `app.default_theme` | `light` | `light` or `dark`. |
| `app.timezone` | `UTC` | PHP timezone used for log timestamps and exports. |
| `app.version` | `1.0.0` | Shown on the login page and in the footer. |

## Connecting to Zammad

### Native (package-based) installation

If Zammad was installed from packages (apt/yum) together with Elasticsearch:

1. Find your ES password — Zammad stores it in
   `/opt/zammad/config/elastic_search.yml` (or you set it during ES install).
2. Test connectivity from the Zeportic host:
   ```bash
   curl -u elastic:YOURPASS http://localhost:9200/_cluster/health
   ```
3. Put the same URL + credentials into `config.php`.
4. Confirm the index prefix:
   ```bash
   curl -u elastic:YOURPASS http://localhost:9200/_cat/indices?v | grep zammad
   ```
   You should see `zammad_production_ticket`, `zammad_production_user`, etc.

### Zammad running on Docker

If Zammad runs through the official
[zammad-docker-compose](https://github.com/zammad/zammad-docker-compose) stack,
Elasticsearch lives in a container — usually named **`zammad-elasticsearch`** —
on a private compose network, with port 9200 typically published to
`127.0.0.1:9200` on the host.

**Step 1 — discover your setup**

```bash
cd /opt/zammad-docker-compose        # or wherever you cloned the stack

# service status + actual container names:
docker compose ps

# ES password (look for ELASTIC / ELASTICSEARCH variables, or check .env):
docker compose exec zammad-elasticsearch env | grep -i elastic

# is ES answering inside the network?
docker compose exec zammad-elasticsearch curl -s -u elastic:YOURPASS localhost:9200/_cluster/health
```

**Step 2 — pick how Zeportic reaches ES**

| Scenario | `config.php` host value |
|---|---|
| Compose publishes 9200 to the host (default) | `http://127.0.0.1:9200` |
| ES exposed with TLS | `https://127.0.0.1:9200` + `'verify_ssl' => false` (self-signed) |
| Port **not** published / Zeportic in a container | Attach Zeportic to the compose network and use `http://zammad-elasticsearch:9200` |

**Step 3 — verify**

```bash
php diagnose.php
```

The diagnostic discovers the indices for you: if the prefix is wrong it lists
every `zammad*` index it can find so you can copy the right one into
`index_prefix`.

### Docker Compose service example

Add Zeportic as a side-car service inside your existing
`docker-compose.yml` (same network as Zammad — the default network name is
usually `<folder>_default`):

```yaml
services:
  zeportic:
    image: php:8.3-cli
    container_name: zeportic
    restart: unless-stopped
    working_dir: /app
    volumes:
      - ./zeportic:/app            # this folder, mounted read-write for storage/
    ports:
      - "1234:1234"
    command: php -S 0.0.0.0:1234 -t /app
    networks:
      - default                    # zammad-docker-compose's default network
    # optional hardening:
    read_only: false
    security_opt:
      - no-new-privileges:true
```

Then point `config.php` at the ES **service name**:

```php
'host' => 'http://zammad-elasticsearch:9200',
```

> ⚠️ The exact service name and network differ between compose versions —
> run `docker compose ps` and `docker network ls` to confirm yours.

### Running Zeportic itself as a container

If you prefer to keep Zeportic outside the Zammad compose file:

```bash
docker run -d --name zeportic \
  --network zammad-docker-compose_default \
  -p 1234:1234 \
  -v /opt/zeportic:/app \
  --restart unless-stopped \
  php:8.3-cli php -S 0.0.0.0:1234 -t /app
```

## Running as a systemd service

For long-lived production deployments behind nginx/Apache, run the PHP server
as a service:

```ini
# /etc/systemd/system/zeportic.service
[Unit]
Description=Zeportic — Zammad Reporting Tool
After=network.target elasticsearch.service

[Service]
User=www-data
WorkingDirectory=/opt/zeportic
ExecStart=/usr/bin/php -S 0.0.0.0:1234 -t /opt/zeportic
Restart=always
RestartSec=3
; Hardening
NoNewPrivileges=true
ProtectSystem=full
ReadWritePaths=/opt/zeportic/storage

[Install]
WantedBy=multi-user.target
```

```bash
sudo systemctl daemon-reload
sudo systemctl enable --now zeportic
```

For real production traffic, put TLS in front (nginx `proxy_pass
http://127.0.0.1:1234;` + Let's Encrypt) instead of exposing port 1234 raw.

## Languages & translation

Zeportic ships with **26 interface languages**, switchable at runtime from the
globe button (login page and header) or the `L` keyboard shortcut:

| | | | |
|---|---|---|---|
| English | فارسی (Persian) | العربية (Arabic) | עברית (Hebrew) |
| اردو (Urdu) | Deutsch (German) | Français (French) | Español (Spanish) |
| Português (BR) | Italiano | Nederlands | Polski |
| Čeština | Ελληνικά | Русский | Українська |
| Türkçe | Svenska | Bahasa Indonesia | Tiếng Việt |
| हिन्दी (Hindi) | ไทย (Thai) | 日本語 (Japanese) | 한국어 (Korean) |
| 简体中文 | 繁體中文 | | |

- Right-to-left languages (Persian, Arabic, Hebrew, Urdu) automatically flip
  the entire layout, including charts, tooltips and the Jalali calendar.
- English doubles as the fallback: any string missing from a translation
  gracefully renders in English instead of breaking.
- **Adding a language** = copying one file. Duplicate
  `assets/lang/en.js`, translate the values, save it as
  `assets/lang/<code>.js`, and register the code + native name in
  `assets/lang/meta.js`. No build step, no code changes.

## Security notes

- **`config.php` and `src/*.php` are guarded** with an `APP_RUNNING` constant.
  Opening `http://host:1234/config.php` directly prints `No direct access` and
  exits — your ES password is never served.
- The app only **reads** from Elasticsearch. For least privilege, create a
  read-only ES role limited to `zammad_*` indices instead of using `elastic`.
- Login is brute-force throttled: 5 failed attempts lock the session for 60 s
  (with a `Retry-After` header), and sessions regenerate their ID on login.
- A strict Content-Security-Policy (`script-src 'self'`) is served — the
  frontend loads **zero** inline or third-party scripts.
- The error log is stored as `storage/errors.php`, a PHP file that returns 403
  if requested over HTTP (read it with `tail -n +2 storage/errors.php`).
- Don't expose port 1234 to the public internet without TLS — put nginx/Apache
  with HTTPS in front (see [systemd section](#running-as-a-systemd-service)).

## API reference

All endpoints live under `api.php?action=…` and require an authenticated
session (except `login`, `me`, `health`). Most accept `&period=7|30|90` (days).

| Action | Returns |
|---|---|
| `login` / `logout` / `me` | auth |
| `health` | ES connectivity check |
| `diagnostics` | full ES diagnostic dump (auth required) |
| `overview` | KPIs + deltas vs previous period |
| `channels` | channel distribution + daily trend |
| `agents` | per-agent performance |
| `roles` | role distribution |
| `responseTime` | first-response / resolution / P90 / SLA per channel |
| `trends` | created vs closed per day |
| `wordcloud` | top keywords from ticket titles + notes |
| `tickets` | recent tickets |
| `heatmap` | activity heatmap (weekday × hour) |
| `organizations` | top organizations |
| `sla` | SLA report by priority |
| `tags` | tag stats |
| `activity` | live activity feed |
| `agentDetail` | single-agent drilldown (`&id=`) |
| `kb` | knowledge-base stats |
| `compare` | period-over-period comparison |
| `notifications` | notifications feed |
| `ticketsByWord` | tickets matching a wordcloud word (`&word=`) |
| `sidebarStats` | sidebar live counters |
| `aiInsights` | AI-generated insights |
| `periodComparison` | period comparison |
| `agentLeaderboard` | agent leaderboard |
| `kpiSparkline` | KPI sparkline data (`&key=`) |
| `kpiDrilldown` | KPI drilldown modal (`&key=`) |
| `trendForecast` | trend forecast + anomaly detection |
| `export&type=…` | CSV download (`agents`, `tickets`, `channels`, `wordcloud`, `organizations`, `sla`, `tags`, `kb`, `notifications`, `sidebarStats`, `compare`) |

## Troubleshooting

### ⚡ Quick diagnosis — run this FIRST

If you see HTTP 500 errors on API calls, or the dashboard shows an
*"Elasticsearch Connection Error"* banner:

```bash
cd /opt/zeportic
php diagnose.php
```

It runs **7 checks** with colored ✔/✘/⚠ output and tells you exactly what to fix:

1. **PHP environment** — version + required extensions
2. **config.php** — validates credentials aren't still placeholders
3. **DNS + TCP** — can the server reach the ES host/port at all?
4. **TLS + auth** — SSL handshake + elastic password (maps cURL errors to human hints)
5. **Cluster health** — green/yellow/red, node count, unassigned shards
6. **Index discovery** — lists matching indices; if the prefix is wrong it shows
   every `zammad*` index it can find
7. **Sample query** — a real count + search on the ticket index

Exit code `0` = all good, `1` = at least one failure.

### Other ways to diagnose

- **Web endpoint** (after login): `http://YOUR-SERVER-IP:1234/api.php?action=diagnostics`
- **Error log**: `tail -n +2 storage/errors.php` (each line is structured JSON)
- **Browser DevTools**: the dashboard shows a red error banner with the real ES message

### Common fixes

**"Elasticsearch request failed: … certificate"**
Zammad's ES often uses a self-signed cert. Keep `'verify_ssl' => false`, or set
`'ca_bundle' => '/etc/ssl/certs/ca-certificates.crt'` + `'verify_ssl' => true`.

**HTTP 401 / "unable to authenticate user [elastic]"**
Wrong elastic password. Reset it and update `config.php`:
```bash
/usr/share/elasticsearch/bin/elasticsearch-reset-password -u elastic
# Docker:
docker compose exec zammad-elasticsearch elasticsearch-reset-password -u elastic  # or check the stack's .env
```

**HTTP 403 / "forbidden"**
The ES user lacks read permission on `zammad_*` indices. Use a user with read
access, or grant your role the `read` privilege on `zammad_*`.

**cURL error 7 (couldn't connect)**
ES isn't reachable. If it runs in Docker, check the port is published or attach
Zeportic to the compose network (see [Docker section](#zammad-running-on-docker)):
```bash
docker compose ps                  # is zammad-elasticsearch up?
ss -tlnp | grep 9200               # is the port published on the host?
```

**All counts are 0**
`index_prefix` probably doesn't match. Production = `zammad_production`,
staging = `zammad_test`. Verify:
```bash
curl -u elastic:YOURPASS http://localhost:9200/_cat/indices?v | grep zammad
```

**Dashboard loads but charts are empty**
Your Zammad may not have indexed KB/tags data — those sections simply render
"No data". Tickets/KPIs require `zammad_production_ticket` to contain documents.

## Project structure

```
zeportic/
├── index.php              ← entry point (HTML shell) — served for "/"
├── api.php                ← JSON API — served for "/api.php?action=..."
├── config.php             ← ★ EDIT THIS (ES credentials + dashboard login)
├── diagnose.php           ← CLI diagnostics — run: php diagnose.php
├── start.sh               ← optional launcher (just runs php -S)
├── LICENSE                ← GPL-3.0
├── README.md              ← this file
├── CONTRIBUTING.md        ← how to contribute
├── SECURITY.md            ← how to report vulnerabilities
├── CHANGELOG.md           ← release notes
├── storage/               ← runtime error log (auto-created, HTTP-protected)
├── assets/                ← all static assets, bundled locally
│   ├── app.css            ← full stylesheet (purple theme, RTL + dark mode)
│   ├── app.js             ← SPA: charts, wordcloud, exports, i18n runtime
│   ├── chart.umd.min.js   ← Chart.js 4.x (bundled, NOT from a CDN)
│   ├── fonts.css          ← @font-face for Vazirmatn (local)
│   ├── fonts/             ← Vazirmatn woff2 files (5 weights, bundled)
│   ├── lang/              ← 26 language packs + catalog (meta.js)
│   └── img/               ← Zeportic logo + favicon
└── src/                   ← PHP classes (NOT web-accessible — guarded)
    ├── ElasticsearchClient.php   ← cURL-based ES client (no dependencies)
    ├── ReportService.php         ← all aggregations vs Zammad indices
    └── Auth.php                  ← session auth + brute-force lockout
```

## Contributing

Contributions are welcome — new languages, report ideas, performance work, bug
fixes. See [CONTRIBUTING.md](CONTRIBUTING.md). Translating to a new language is
the easiest way to help: one file, no code.

## License

Released under the [GNU GPL-3.0](LICENSE) — same as Zammad itself.
Copyright (C) 2026 Zeportic contributors.
