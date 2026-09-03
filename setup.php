<?php

/**
 * ============================================================================
 *  Zeportic — Zammad Reporting Tool — Graphical First-Run Setup Wizard
 * ============================================================================
 *
 *  Shown automatically when the app is not configured yet (no
 *  config.local.php AND config.php still carries the shipped placeholders).
 *
 *  Flow (driven by assets/setup.js):
 *    1. Welcome + environment check      GET  setup.php?action=requirements
 *    2. Elasticsearch connection test    POST setup.php?action=test
 *    3. Dashboard admin account          (client-side)
 *    4. Save & finish                    POST setup.php?action=finish
 *
 *  Once configuration exists (config.local.php written, or config.php edited
 *  manually) this page immediately redirects to index.php. To re-run the
 *  wizard, delete config.local.php.
 *
 *  SECURITY: the wizard is only reachable while the instance is UNCONFIGURED.
 *  Finish setup promptly after deploying a fresh copy.
 * ----------------------------------------------------------------------------
 */

declare(strict_types=1);

define('APP_RUNNING', true);
define('BASE_DIR', __DIR__);

require BASE_DIR . '/src/Config.php';

// Already configured? Nothing to do here.
if (Config::isConfigured()) {
    header('Location: index.php');
    exit;
}

require BASE_DIR . '/src/ElasticsearchClient.php';

header('X-Content-Type-Options: nosniff');
header('X-Frame-Options: DENY');
header('Referrer-Policy: same-origin');

$action = $_GET['action'] ?? '';
$method = $_SERVER['REQUEST_METHOD'] ?? 'GET';

/** JSON response helper. */
function setupOut(array $data, int $code = 200): void
{
    http_response_code($code);
    header('Content-Type: application/json; charset=utf-8');
    echo json_encode($data, JSON_UNESCAPED_UNICODE);
    exit;
}

/** Read + validate the ES connection payload sent by the wizard. */
function setupEsInput(array $body): array
{
    $host = trim((string)($body['host'] ?? ''));
    $prefix = trim((string)($body['indexPrefix'] ?? ''));
    $username = trim((string)($body['username'] ?? ''));
    $password = (string)($body['password'] ?? '');
    $verifySsl = !empty($body['verifySsl']);

    if ($host === '') {
        setupOut(['ok' => false, 'error' => 'Elasticsearch URL is required.']);
    }
    if (mb_strlen($host) > 512 || !preg_match('#^https?://[A-Za-z0-9\.\-_:\[\]]+(:\d+)?(/.*)?$#', $host)) {
        setupOut(['ok' => false, 'error' => 'The URL must start with http:// or https:// followed by a valid host.']);
    }
    if (preg_match('#https?://(127\.0\.0\.1|localhost|\[::1\])#i', $host) === 0 && filter_var(parse_url($host, PHP_URL_HOST), FILTER_VALIDATE_IP) === false && !str_contains($host, '.')) {
        setupOut(['ok' => false, 'error' => 'The host name looks invalid.']);
    }
    if (mb_strlen($prefix) > 128 || !preg_match('/^[A-Za-z0-9_\-\.]*$/', $prefix)) {
        setupOut(['ok' => false, 'error' => 'Index prefix may only contain letters, digits, dots, dashes and underscores.']);
    }
    if (mb_strlen($username) > 128) {
        setupOut(['ok' => false, 'error' => 'Username is too long.']);
    }
    if (mb_strlen($password) > 1024) {
        setupOut(['ok' => false, 'error' => 'Password is too long.']);
    }

    return [
        'host'        => $host,
        'index_prefix' => $prefix,
        'username'    => $username,
        'password'    => $password,
        'verify_ssl'  => $verifySsl,
        'ca_bundle'   => null,
    ];
}

/** Map a raw cURL/ES error to a human hint. */
function setupHint(string $msg): string
{
    $m = mb_strtolower($msg);
    if (str_contains($m, 'couldn\'t connect') || str_contains($m, 'connection refused') || str_contains($m, 'error 7')) {
        return 'Elasticsearch is not reachable on that host/port. If Zammad runs in Docker, make sure port 9200 is published (docker compose ps) or attach Zeportic to the compose network.';
    }
    if (str_contains($m, '401') || str_contains($m, 'authentication') || str_contains($m, 'unable to authenticate')) {
        return 'Wrong username/password. With the official Zammad Docker stack the password is in the stack\'s .env (ELASTICSEARCH related variables).';
    }
    if (str_contains($m, '403') || str_contains($m, 'forbidden')) {
        return 'The user exists but lacks read permission on the zammad_* indices. Use the elastic superuser or grant read on zammad_*.';
    }
    if (str_contains($m, 'certificate') || str_contains($m, 'ssl')) {
        return 'TLS problem. Zammad\'s ES usually uses a self-signed certificate — keep "Verify TLS certificate" unchecked.';
    }
    if (str_contains($m, 'timed out') || str_contains($m, 'timeout')) {
        return 'The connection timed out — check firewalls between Zeportic and Elasticsearch.';
    }
    return 'Run "php diagnose.php" in the project folder for a detailed, step-by-step diagnosis.';
}

// ============================================================================
//  JSON endpoint — environment requirements (step 1)
// ============================================================================
if ($action === 'requirements') {
    $storage = BASE_DIR . '/storage';
    if (!is_dir($storage)) {
        @mkdir($storage, 0775, true);
    }
    setupOut([
        'phpVersion'      => PHP_VERSION,
        'phpOk'           => version_compare(PHP_VERSION, '8.0.0', '>='),
        'sapi'            => PHP_SAPI,
        'ext'             => [
            'curl'     => extension_loaded('curl'),
            'json'     => extension_loaded('json'),
            'mbstring' => extension_loaded('mbstring'),
            'openssl'  => extension_loaded('openssl'),
        ],
        'storageWritable' => is_dir($storage) && is_writable($storage),
        'rootWritable'    => is_writable(BASE_DIR),
        'allOk'           => version_compare(PHP_VERSION, '8.0.0', '>=')
            && extension_loaded('curl') && extension_loaded('json') && extension_loaded('mbstring'),
    ]);
}

// ============================================================================
//  JSON endpoint — Elasticsearch connection test (step 2)
// ============================================================================
if ($method === 'POST' && $action === 'test') {
    $body = json_decode((string)file_get_contents('php://input'), true) ?: [];
    $esCfg = setupEsInput($body);

    try {
        $client = new ElasticsearchClient($esCfg);
        $info = $client->info();
        $health = $client->clusterHealth();

        // Discover zammad_* indices and suggest the matching prefixes.
        $all = $client->listIndices();
        $zammad = [];
        foreach ($all as $idx) {
            $name = (string)($idx['index'] ?? '');
            if (str_starts_with($name, 'zammad')) {
                $zammad[$name] = (int)($idx['docs.count'] ?? 0);
            }
        }
        ksort($zammad);

        $suggestions = [];
        foreach (array_keys($zammad) as $name) {
            if (preg_match('/^(zammad_[a-z0-9_]+)_ticket$/', $name, $m)) {
                $suggestions[$m[1]] = true;
            }
        }

        // Ticket doc count for the requested prefix (if the index exists).
        $ticketDocs = null;
        if ($esCfg['index_prefix'] !== '' && isset($zammad[$esCfg['index_prefix'] . '_ticket'])) {
            try {
                $ticketDocs = $client->count('ticket');
            } catch (\Throwable) {
                $ticketDocs = null;
            }
        }

        setupOut([
            'ok'            => true,
            'clusterName'   => (string)($info['cluster_name'] ?? '?'),
            'esVersion'     => (string)($info['version']['number'] ?? '?'),
            'healthStatus'  => (string)($health['status'] ?? '?'),
            'nodes'         => (int)($health['number_of_nodes'] ?? 0),
            'indexCount'    => count($all),
            'zammadIndices' => array_slice($zammad, 0, 12, true),
            'zammadTotal'   => count($zammad),
            'prefixSuggestions' => array_keys($suggestions),
            'ticketDocs'    => $ticketDocs,
        ]);
    } catch (\Throwable $e) {
        setupOut([
            'ok'    => false,
            'error' => $e->getMessage(),
            'hint'  => setupHint($e->getMessage()),
        ]);
    }
}

// ============================================================================
//  JSON endpoint — finish (step 4): validate everything, write config.local.php
// ============================================================================
if ($method === 'POST' && $action === 'finish') {
    $body = json_decode((string)file_get_contents('php://input'), true) ?: [];

    $esCfg = setupEsInput($body);

    $adminUser = trim((string)($body['adminUsername'] ?? ''));
    $adminPass = (string)($body['adminPassword'] ?? '');
    $adminPass2 = (string)($body['adminPassword2'] ?? '');
    $lang = (string)($body['lang'] ?? 'en');
    $theme = (string)($body['theme'] ?? 'dark');

    if (!preg_match('/^[A-Za-z0-9\._\-]{3,64}$/', $adminUser)) {
        setupOut(['ok' => false, 'error' => 'Dashboard username: 3–64 characters — letters, digits, dot, dash, underscore.']);
    }
    if (mb_strlen($adminPass) < 4) {
        setupOut(['ok' => false, 'error' => 'Dashboard password must be at least 4 characters (8+ recommended).']);
    }
    if ($adminPass !== $adminPass2) {
        setupOut(['ok' => false, 'error' => 'The two passwords do not match.']);
    }
    if (!in_array($lang, Config::LANGS, true)) {
        $lang = 'en';
    }
    if (!in_array($theme, ['dark', 'light'], true)) {
        $theme = 'dark';
    }

    // Final smoke test with the exact values we are about to persist.
    try {
        (new ElasticsearchClient($esCfg))->ping();
    } catch (\Throwable $e) {
        setupOut(['ok' => false, 'error' => 'Connection check failed before saving: ' . $e->getMessage(), 'hint' => setupHint($e->getMessage())]);
    }

    try {
        Config::saveLocal([
            'elasticsearch' => [
                'host'         => $esCfg['host'],
                'index_prefix' => $esCfg['index_prefix'],
                'username'     => $esCfg['username'],
                'password'     => $esCfg['password'],
                'verify_ssl'   => $esCfg['verify_ssl'],
                'ca_bundle'    => null,
            ],
            'auth' => [
                'username'         => $adminUser,
                // Store only a modern bcrypt/argon2 hash — never the plain text.
                'password_hash'    => password_hash($adminPass, PASSWORD_DEFAULT),
                'session_lifetime' => 28800,
            ],
            'app' => [
                'default_lang'  => $lang,
                'default_theme' => $theme,
            ],
        ]);
    } catch (\Throwable $e) {
        setupOut(['ok' => false, 'error' => $e->getMessage()]);
    }

    setupOut(['ok' => true]);
}

// ============================================================================
//  HTML shell — the wizard UI itself is rendered by assets/setup.js
// ============================================================================
$config = Config::load();
$theme = in_array(($config['app']['default_theme'] ?? 'dark'), ['dark', 'light'], true)
    ? ($config['app']['default_theme'] ?? 'dark') : 'dark';
$version = htmlspecialchars((string)($config['app']['version'] ?? '1.1.0'));
$langsJson = json_encode(Config::LANGS);
?>
<!DOCTYPE html>
<html lang="en" dir="ltr" data-theme="<?= htmlspecialchars($theme) ?>">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Setup — Zeportic</title>
<meta name="robots" content="noindex, nofollow">
<meta name="theme-color" content="#7c3aed">
<link rel="icon" type="image/png" href="/assets/img/favicon.png">
<link rel="stylesheet" href="/assets/fonts.css">
<link rel="stylesheet" href="/assets/app.css">
<link rel="stylesheet" href="/assets/setup.css">
</head>
<body class="setup-page" data-theme="<?= htmlspecialchars($theme) ?>"
      data-version="<?= $version ?>"
      data-langs="<?= htmlspecialchars($langsJson) ?>">
<div id="setup-root"></div>
<script src="/assets/setup.js"></script>
</body>
</html>
