# Security Policy

## Supported versions

| Version | Supported |
|---|---|
| 1.0.x | ✅ |

## Reporting a vulnerability

Please **do not open a public GitHub issue** for security problems.

Instead, use [GitHub Security Advisories](https://github.com/YOUR-ORG/zeportic/security/advisories/new)
("Report a vulnerability") or contact the maintainers directly. Include:

- Affected version / commit hash
- Step-by-step reproduction or PoC
- Impact assessment

You can expect an initial response within **7 days**. Please allow up to
90 days for a fix before public disclosure.

## Security model (what Zeportic promises)

- Zeportic talks **read-only** to Elasticsearch — it never indexes, writes or
  deletes documents.
- `config.php` and everything in `src/` is guarded by an `APP_RUNNING` check
  and refuses direct HTTP access (credentials are never served).
- The frontend ships with a strict Content-Security-Policy:
  `script-src 'self'` — no inline scripts, no third-party code, no telemetry.
- Dashboard sessions are HttpOnly, SameSite=Lax, regenerated on login, and
  brute-force throttled (5 failures → 60 s lockout).
- The runtime error log (`storage/errors.php`) is a PHP file that returns 403
  when requested over HTTP.

## Deployment recommendations

- Change the default dashboard credentials (`admin`/`admin`) **before**
  exposing anything — prefer `password_hash` over plain text in `config.php`.
- Create a dedicated read-only Elasticsearch user instead of `elastic`.
- Terminate TLS in nginx/Apache; do not expose the PHP built-in server raw to
  the internet.
- Keep `storage/` writable only by the PHP user.
