<?php
/**
 * ============================================================================
 *  Zeportic — Zammad Reporting Tool — CLI Diagnostics
 * ============================================================================
 *
 *  Run from the terminal ON THE SERVER where the dashboard lives:
 *
 *      php diagnose.php
 *
 *  This script does NOT go through the web server. It directly tests your
 *  Elasticsearch connection using the credentials in config.php and tells
 *  you exactly what is wrong (or right).
 *
 *  It checks:
 *    1. PHP version + required extensions (curl, json, openssl, mbstring)
 *    2. config.php is readable and credentials are not still placeholders
 *    3. Network reachability to the ES host (TCP connect)
 *    4. TLS/SSL handshake (common failure point with self-signed certs)
 *    5. ES authentication (elastic user + password)
 *    6. ES cluster health + version
 *    7. Whether the expected Zammad indices exist
 *    8. A sample search on the ticket index (catches mapping/permission errors)
 *    9. A sample count on the ticket index
 *
 *  Everything is printed in colour to the terminal. Exit code 0 = all good,
 *  non-zero = at least one check failed.
 *
 * ----------------------------------------------------------------------------
 */

declare(strict_types=1);
define('APP_RUNNING', true);
define('BASE_DIR', __DIR__);

if (PHP_SAPI !== 'cli') {
    fwrite(STDERR, "This script must be run from the command line.\n");
    fwrite(STDERR, "Usage: php diagnose.php\n");
    exit(2);
}

// ---- ANSI colours (auto-disabled on Windows / non-TTY) ----
$useColour = function_exists('posix_isatty') ? posix_isatty(STDOUT) : false;
if (DIRECTORY_SEPARATOR === '\\') $useColour = false;
function C(string $code): string { global $useColour; return $useColour ? "\033[" . $code . "m" : ''; }
$C_RESET = C('0');
function cRed(string $s)    { return C('31') . $s . C('0'); }
function cGreen(string $s)  { return C('32') . $s . C('0'); }
function cYellow(string $s) { return C('33') . $s . C('0'); }
function cCyan(string $s)   { return C('36') . $s . C('0'); }
function cBold(string $s)   { return C('1')  . $s . C('0'); }
function cDim(string $s)    { return C('2')  . $s . C('0'); }

$results = [];
$failures = 0;
$warnings = 0;

function pass(string $label, string $detail = ''): void {
    global $results, $failures, $warnings;
    echo cGreen('  ✔ PASS') . '  ' . $label . ($detail !== '' ? cDim('  — ' . $detail) : '') . "\n";
    $results[] = ['status' => 'pass', 'label' => $label, 'detail' => $detail];
}
function fail(string $label, string $detail, string $fix = ''): void {
    global $results, $failures;
    echo cRed('  ✘ FAIL') . '  ' . $label . "\n";
    echo cRed('          ') . $detail . "\n";
    if ($fix !== '') echo cYellow('          → FIX: ') . $fix . "\n";
    $failures++;
    $results[] = ['status' => 'fail', 'label' => $label, 'detail' => $detail, 'fix' => $fix];
}
function warn(string $label, string $detail, string $fix = ''): void {
    global $results, $warnings;
    echo cYellow('  ⚠ WARN') . '  ' . $label . "\n";
    echo cYellow('          ') . $detail . "\n";
    if ($fix !== '') echo cYellow('          → FIX: ') . $fix . "\n";
    $warnings++;
    $results[] = ['status' => 'warn', 'label' => $label, 'detail' => $detail, 'fix' => $fix];
}
function section(string $title): void {
    echo "\n" . cBold(cCyan('━━ ' . $title . ' ')) . cDim(str_repeat('─', max(2, 60 - strlen($title)))) . "\n";
}

// ============================================================================
echo cBold(cCyan("\n╔══════════════════════════════════════════════════════════════╗\n"));
echo cBold(cCyan("║  Zeportic — Zammad Reporting Tool — Diagnostics               ║\n"));
echo cBold(cCyan("║  Community edition · GPL-3.0                                  ║\n"));
echo cBold(cCyan("╚══════════════════════════════════════════════════════════════╝\n"));

echo cDim('  ' . date('Y-m-d H:i:s T') . '  ·  PHP ' . PHP_VERSION . '  ·  ' . PHP_SAPI . "\n");

// ============================================================================
// 1. PHP environment
// ============================================================================
section('1. PHP Environment');

if (version_compare(PHP_VERSION, '8.0.0', '>=')) {
    pass('PHP version', PHP_VERSION);
} else {
    fail('PHP version', 'Running ' . PHP_VERSION . ', need 8.0+', 'Upgrade PHP.');
}

$requiredExt = ['curl', 'json', 'mbstring', 'openssl'];
foreach ($requiredExt as $ext) {
    if (extension_loaded($ext)) {
        pass("Extension: $ext", phpversion($ext) ?: 'loaded');
    } else {
        fail("Extension: $ext", 'Not loaded', "Install it: apt install php-$ext  (Debian/Ubuntu)  or  yum install php-$ext");
    }
}

// curl capabilities
if (extension_loaded('curl')) {
    $cv = curl_version();
    pass('cURL version', $cv['version'] . '  ·  SSL: ' . ($cv['ssl_version'] ?? 'n/a'));
    if (empty($cv['protocols']) || !in_array('https', $cv['protocols'], true)) {
        warn('cURL HTTPS support', 'cURL was not built with HTTPS protocol support', 'Recompile/install cURL with OpenSSL.');
    }
}

// ============================================================================
// 2. config.php
// ============================================================================
section('2. Configuration (config.php)');

$configPath = BASE_DIR . '/config.php';
if (!is_readable($configPath)) {
    fail('config.php readable', 'File not found or not readable at ' . $configPath, 'Check the file exists and has 644 permissions.');
    echo "\n" . cRed('Cannot continue without config.php.') . "\n";
    exit(1);
}

// Merge in config.local.php (setup wizard output) when present.
require BASE_DIR . '/src/Config.php';
$config = Config::load();
pass('config.php loaded');
if (is_file(Config::localPath())) {
    pass('config.local.php (setup wizard output) merged', 'delete the file to re-run the wizard');
} else {
    warn('config.local.php not present', 'The setup wizard has not run on this install.', 'Either run the graphical wizard (open the app in a browser) or edit config.php manually.');
}

$es = $config['elasticsearch'] ?? null;
if (!is_array($es)) {
    fail('elasticsearch config block', 'Missing or not an array', 'Check config.php — the elasticsearch key must exist.');
    exit(1);
}

$host     = (string)($es['host'] ?? '');
$prefix   = (string)($es['index_prefix'] ?? '');
$user     = (string)($es['username'] ?? '');
$pass     = (string)($es['password'] ?? '');
$verifySsl = (bool)($es['verify_ssl'] ?? false);

echo cDim('          host     = ') . $host . "\n";
echo cDim('          prefix   = ') . $prefix . "\n";
echo cDim('          username = ') . $user . "\n";
echo cDim('          password = ') . (strlen($pass) >= 8 ? str_repeat('•', 8) . cDim(' (' . strlen($pass) . ' chars)') : cYellow('"' . $pass . '"')) . "\n";
echo cDim('          verify_ssl = ') . ($verifySsl ? 'true' : 'false') . "\n";

if ($host === '') {
    fail('ES host set', 'host is empty', 'Set elasticsearch.host in config.php, e.g. https://localhost:9200');
} elseif (!preg_match('#^https?://#', $host)) {
    fail('ES host scheme', "host must start with http:// or https://, got: $host", 'Add the scheme.');
} else {
    pass('ES host scheme', 'OK');
}

if ($prefix === '') {
    warn('index_prefix empty', 'No prefix — searching raw index names.', 'Zammad usually uses zammad_production or zammad_test.');
} else {
    pass('index_prefix', $prefix);
}

if ($user === '') {
    warn('ES username empty', 'No username set — most ES clusters require auth.', 'Set username to "elastic" or a read-only user.');
} else {
    pass('ES username', $user);
}

if ($pass === '' || $pass === 'CHANGE_ME_ELASTIC_PASSWORD') {
    fail('ES password', 'Still the placeholder "CHANGE_ME_ELASTIC_PASSWORD" or empty', 'Set elasticsearch.password to your actual elastic superuser password in config.php.');
} else {
    pass('ES password set', strlen($pass) . ' characters');
}

// ============================================================================
// 3. Parse host + TCP reachability
// ============================================================================
section('3. Network Reachability');

$parsed = parse_url($host);
$scheme = $parsed['scheme'] ?? 'https';
$hostname = $parsed['host'] ?? '';
$port = $parsed['port'] ?? ($scheme === 'https' ? 443 : 80);

if ($hostname === '') {
    fail('Host parsing', "Could not parse hostname from: $host", 'Fix the host URL in config.php.');
    exit(1);
}

echo cDim('          resolving ') . $hostname . ' ... ';
if (filter_var($hostname, FILTER_VALIDATE_IP)) {
    // The host is already an IP literal — no DNS lookup needed.
    echo cGreen($hostname) . "\n";
    pass('IP literal (no DNS needed)', $hostname);
} elseif ($hostname === 'localhost') {
    echo cGreen('localhost') . "\n";
    pass('Hostname', 'localhost');
} else {
    $ips = @dns_get_record($hostname, DNS_A);
    if ($ips === false || empty($ips)) {
        // Maybe it's an IP or localhost — try gethostbyname
        $resolved = @gethostbyname($hostname);
        if ($resolved && $resolved !== $hostname) {
            echo cGreen($resolved) . "\n";
            pass('DNS resolution', $resolved);
        } else {
            echo cRed('FAILED') . "\n";
            fail('DNS resolution', "Cannot resolve $hostname", 'Check the hostname spelling or your DNS / /etc/hosts.');
        }
    } else {
        $ip = $ips[0]['ip'];
        echo cGreen($ip) . "\n";
        pass('DNS resolution', $ip);
    }
}

echo cDim('          TCP connect ') . $hostname . ':' . $port . ' ... ';
$start = microtime(true);
$sock = @fsockopen($hostname, $port, $errno, $errstr, 5.0);
$latency = round((microtime(true) - $start) * 1000);
if ($sock) {
    fclose($sock);
    echo cGreen('OPEN') . cDim(" ({$latency}ms)") . "\n";
    pass('TCP connection', $hostname . ':' . $port . ' — ' . $latency . 'ms');
} else {
    echo cRed('REFUSED') . "\n";
    fail('TCP connection', "Cannot connect to $hostname:$port — $errstr ($errno)", 'Is Elasticsearch running? Is the port open? Check: systemctl status elasticsearch  ·  firewall-cmd --list-ports  ·  ufw status');
}

// ============================================================================
// 4. TLS / SSL handshake
// ============================================================================
if ($scheme === 'https') {
    section('4. TLS / SSL');

    if (!$verifySsl) {
        echo cDim('          verify_ssl = false → skipping cert verification (OK for self-signed)') . "\n";
    }

    // Try a raw cURL GET to the root — this exercises the TLS handshake + auth
    echo cDim('          TLS handshake + auth probe ... ');
    $ch = curl_init($host . '/');
    curl_setopt_array($ch, [
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_CUSTOMREQUEST  => 'GET',
        CURLOPT_HTTPHEADER     => ['Accept: application/json'],
        CURLOPT_USERPWD        => $user . ':' . $pass,
        CURLOPT_TIMEOUT        => 15,
        CURLOPT_SSL_VERIFYPEER => $verifySsl,
        CURLOPT_SSL_VERIFYHOST => $verifySsl ? 2 : 0,
        CURLOPT_HEADER         => true,
        CURLOPT_NOBODY         => false,
    ]);
    $resp = curl_exec($ch);
    $code = curl_getinfo($ch, CURLINFO_HTTP_CODE);
    $cerr = curl_error($ch);
    $cerrno = curl_errno($ch);
    $sslVerify = curl_getinfo($ch, CURLINFO_SSL_VERIFYRESULT);
    curl_close($ch);

    if ($resp === false) {
        echo cRed('FAILED') . "\n";
        $hint = '';
        switch ($cerrno) {
            case CURLE_SSL_PEER_CERTIFICATE: // 51
            case CURLE_SSL_CACERT: // 60
                $hint = 'TLS certificate verification failed. Either set verify_ssl=false (for self-signed) or set ca_bundle to a valid CA file.';
                break;
            case CURLE_SSL_CONNECT_ERROR: // 35
                $hint = 'TLS handshake failed. ES may not have TLS enabled on this port, or uses an incompatible TLS version. Try http:// instead of https:// if ES runs plain HTTP.';
                break;
            case CURLE_COULDNT_CONNECT: // 7
                $hint = 'Connection refused. ES is not listening, or firewall is blocking the port.';
                break;
            case CURLE_OPERATION_TIMEDOUT: // 28
                $hint = 'Timed out. Network too slow or ES overloaded.';
                break;
            case 6: // CURLE_COULDNT_RESOLVE_HOST
                $hint = 'DNS resolution failed inside cURL.';
                break;
            default:
                $hint = 'cURL error ' . $cerrno . ': ' . $cerr;
        }
        fail('TLS + auth probe', $cerr, $hint);
        echo "\n" . cYellow('Stopping here — fix the connection first, then re-run.') . "\n";
        exit(1);
    }

    echo cGreen("HTTP $code") . "\n";

    if ($code === 401) {
        fail('Authentication', 'HTTP 401 Unauthorized — wrong username/password', 'Reset the elastic password: /usr/share/elasticsearch/bin/elasticsearch-reset-password -u elastic');
        exit(1);
    }
    if ($code === 403) {
        fail('Authorization', 'HTTP 403 Forbidden — user lacks permissions', 'Use the elastic superuser, or grant the user read access to zammad_* indices.');
        exit(1);
    }
    if ($code >= 400) {
        $bodyStart = strpos($resp, "\r\n\r\n");
        $body = $bodyStart !== false ? substr($resp, $bodyStart + 4) : $resp;
        $j = json_decode($body, true);
        $reason = $j['error']['reason'] ?? $j['error']['type'] ?? substr($body, 0, 200);
        fail('ES root request', "HTTP $code: $reason", 'Check ES logs: journalctl -u elasticsearch --no-pager | tail -50');
        exit(1);
    }

    pass('TLS + auth probe', "HTTP $code");

    // Parse the JSON body (skip headers)
    $bodyStart = strpos($resp, "\r\n\r\n");
    $body = $bodyStart !== false ? substr($resp, $bodyStart + 4) : $resp;
    $info = json_decode($body, true);
    if (isset($info['version']['number'])) {
        pass('ES version', $info['version']['number'] . '  ·  ' . ($info['version']['distribution'] ?? 'elasticsearch'));
        $cluster = $info['cluster_name'] ?? 'unknown';
        echo cDim('          cluster_name = ') . $cluster . "\n";
    } else {
        warn('ES version', 'Could not parse version from response', 'Response was: ' . substr($body, 0, 200));
    }
}

// ============================================================================
// 5. Cluster health + indices
// ============================================================================
section('5. Cluster Health & Indices');

// Reuse the client for structured queries
require BASE_DIR . '/src/ElasticsearchClient.php';
$client = new ElasticsearchClient($es);

// Cluster health
$health = null;
try {
    $ch2 = curl_init($host . '/_cluster/health');
    curl_setopt_array($ch2, [
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_USERPWD        => $user . ':' . $pass,
        CURLOPT_TIMEOUT        => 10,
        CURLOPT_SSL_VERIFYPEER => $verifySsl,
        CURLOPT_SSL_VERIFYHOST => $verifySsl ? 2 : 0,
    ]);
    $hResp = curl_exec($ch2);
    $hCode = curl_getinfo($ch2, CURLINFO_HTTP_CODE);
    curl_close($ch2);
    if ($hResp && $hCode < 400) {
        $health = json_decode($hResp, true);
    }
} catch (\Throwable $e) {}

if ($health) {
    $status = $health['status'] ?? '?';
    $statusCol = $status === 'green' ? 'green' : ($status === 'yellow' ? 'yellow' : 'red');
    $statusFn = $statusCol === 'green' ? 'cGreen' : ($statusCol === 'yellow' ? 'cYellow' : 'cRed');
    echo cDim('          cluster status = ') . $statusFn($status) . "\n";
    echo cDim('          nodes = ') . ($health['number_of_nodes'] ?? '?') . '  ·  data nodes = ' . ($health['number_of_data_nodes'] ?? '?') . "\n";
    echo cDim('          unassigned shards = ') . ($health['unassigned_shards'] ?? '?') . "\n";
    if ($status === 'red') {
        warn('Cluster health', 'Cluster status is RED', 'Check ES logs for unassigned primary shards. Data may be unavailable.');
    } elseif ($status === 'yellow') {
        warn('Cluster health', 'Cluster status is YELLOW', 'Replicas are unassigned — fine for single-node setups.');
    } else {
        pass('Cluster health', 'green');
    }
} else {
    warn('Cluster health', 'Could not fetch /_cluster/health', 'Continuing anyway...');
}

// List indices
echo "\n" . cDim('          fetching index list ...') . "\n";
try {
    $indices = $client->listIndices();
} catch (\Throwable $e) {
    $indices = [];
    fail('List indices', $e->getMessage(), 'Check ES permissions for the user.');
}

if (!empty($indices)) {
    $zammadIndices = array_filter($indices, function ($i) use ($prefix) {
        return isset($i['index']) && str_starts_with((string)$i['index'], $prefix);
    });
    echo cDim('          total indices in cluster = ') . count($indices) . "\n";
    echo cDim('          indices matching prefix "' . $prefix . '" = ') . count($zammadIndices) . "\n";

    if (empty($zammadIndices)) {
        fail('Zammad indices found', "No indices starting with \"$prefix\" exist in the cluster", 'Check index_prefix in config.php. Common values: zammad_production, zammad_test. Available indices starting with "zammad":');
        $anyZammad = array_filter($indices, function ($i) { return isset($i['index']) && str_starts_with((string)$i['index'], 'zammad'); });
        foreach (array_slice($anyZammad, 0, 15) as $i) {
            echo cYellow('            · ') . ($i['index'] ?? '?') . cDim('  (' . ($i['docs.count'] ?? '?') . ' docs)') . "\n";
        }
        if (empty($anyZammad)) {
            echo cYellow('            · (none — Zammad may not have indexed ES yet, or uses a different prefix)') . "\n";
        }
    } else {
        pass('Zammad indices found', count($zammadIndices) . ' indices');
        // Show the key ones
        $expected = ['ticket', 'user', 'ticket_state', 'ticket_priority', 'organization'];
        echo "\n";
        foreach ($expected as $key) {
            $idxName = $prefix . '_' . $key;
            $found = null;
            foreach ($indices as $i) {
                if (($i['index'] ?? '') === $idxName) { $found = $i; break; }
            }
            if ($found) {
                pass("Index: $key", ($found['docs.count'] ?? '?') . ' docs  ·  ' . ($found['store.size'] ?? '?'));
            } else {
                warn("Index: $key", "$idxName not found", 'Some report sections may return empty results.');
            }
        }
    }
}

// ============================================================================
// 6. Sample search on ticket index
// ============================================================================
section('6. Sample Query (ticket index)');

try {
    $count = $client->count('ticket');
    if ($count > 0) {
        pass('Ticket count', number_format($count) . ' documents');
    } else {
        warn('Ticket count', '0 documents in ' . $prefix . '_ticket', 'Zammad may not have indexed tickets yet, or the index is empty.');
    }
} catch (\Throwable $e) {
    fail('Ticket count', $e->getMessage(), 'Check the index mapping or user permissions for ' . $prefix . '_ticket');
}

try {
    $search = $client->search('ticket', [
        'query' => ['match_all' => new \stdClass()],
        'sort' => [['created_at' => ['order' => 'desc']]],
    ], 1);
    $hits = $search['hits']['hits'] ?? [];
    if (!empty($hits)) {
        $src = $hits[0]['_source'] ?? [];
        $title = $src['title'] ?? ($src['number'] ?? '(no title)');
        pass('Sample search', 'Got 1 hit — title: ' . mb_substr((string)$title, 0, 60));
    } else {
        warn('Sample search', 'Query succeeded but returned 0 hits', 'Index may be empty.');
    }
} catch (\Throwable $e) {
    fail('Sample search', $e->getMessage(), 'Check if the "created_at" field exists in the mapping, or permissions.');
}

// ============================================================================
// 7. Full metadata dump — writes es-metadata.json for app building
// ============================================================================
section('7. Full Metadata Dump');

$dumpFile = BASE_DIR . '/storage/es-metadata.json';
$metadata = [
    'generated_at' => date('c'),
    'config' => [
        'host' => $host,
        'index_prefix' => $prefix,
        'username' => $user,
        'verify_ssl' => $verifySsl,
    ],
    'php' => [
        'version' => PHP_VERSION,
        'extensions' => get_loaded_extensions(),
    ],
    'cluster_info' => null,
    'cluster_health' => null,
    'indices' => [],
    'index_mappings' => [],
    'sample_docs' => [],
    'field_values' => [],
    'field_stats' => [],
];

// Cluster info + health
try {
    $metadata['cluster_info'] = $client->info();
    $metadata['cluster_health'] = $client->clusterHealth();
} catch (\Throwable $e) {
    $metadata['cluster_info_error'] = $e->getMessage();
}

// All indices
try {
    $allIdx = $client->listIndices();
    $metadata['indices'] = array_map(function ($i) {
        return [
            'index' => $i['index'] ?? '',
            'health' => $i['health'] ?? '',
            'status' => $i['status'] ?? '',
            'docs_count' => (int)($i['docs.count'] ?? 0),
            'store_size' => $i['store.size'] ?? '',
            'pri' => $i['pri'] ?? '',
            'rep' => $i['rep'] ?? '',
        ];
    }, $allIdx);
} catch (\Throwable $e) {
    $metadata['indices_error'] = $e->getMessage();
}

// Key indices to dump in detail
$keyIndices = ['ticket', 'user', 'ticket_state', 'ticket_priority', 'organization', 'group', 'chat_session', 'cti_log', 'stats_store'];

foreach ($keyIndices as $idxShort) {
    $idxName = $prefix . '_' . $idxShort;
    $idxData = ['index' => $idxName, 'exists' => false, 'doc_count' => 0, 'mapping' => null, 'sample_doc' => null];

    // Check if index exists by trying a count
    try {
        $cnt = $client->count($idxShort);
        $idxData['exists'] = true;
        $idxData['doc_count'] = $cnt;
    } catch (\Throwable $e) {
        $idxData['exists'] = false;
        $idxData['error'] = $e->getMessage();
        $metadata['index_mappings'][$idxShort] = $idxData;
        continue;
    }

    // Get mapping
    try {
        $mapping = $client->mapping($idxShort);
        $idxData['mapping'] = $mapping;
        // Extract just the field names + types for a quick summary
        $props = $mapping[$idxName]['mappings']['properties'] ?? ($mapping['mappings']['properties'] ?? []);
        $fieldList = [];
        $extractFields = function ($props, $prefix = '') use (&$extractFields, &$fieldList) {
            foreach ($props as $name => $def) {
                $full = $prefix ? $prefix . '.' . $name : $name;
                $type = $def['type'] ?? 'object';
                $fieldList[] = ['field' => $full, 'type' => $type, 'keyword' => isset($def['fields']['keyword'])];
                if (isset($def['properties']) && is_array($def['properties'])) {
                    $extractFields($def['properties'], $full);
                }
            }
        };
        $extractFields($props);
        $idxData['fields'] = $fieldList;
    } catch (\Throwable $e) {
        $idxData['mapping_error'] = $e->getMessage();
    }

    // Sample document (1 doc, most recent by created_at if available)
    try {
        $sampleBody = [
            'query' => ['match_all' => new \stdClass()],
            'size' => 1,
        ];
        // Try sorting by created_at; if it fails, we'll retry without sort
        try {
            $sampleBody['sort'] = [['created_at' => ['order' => 'desc']]];
            $sampleRes = $client->search($idxShort, $sampleBody, 1);
        } catch (\Throwable $e2) {
            unset($sampleBody['sort']);
            $sampleRes = $client->search($idxShort, $sampleBody, 1);
        }
        $hits = $sampleRes['hits']['hits'] ?? [];
        if (!empty($hits)) {
            $idxData['sample_doc'] = $hits[0]['_source'] ?? null;
        }
    } catch (\Throwable $e) {
        $idxData['sample_doc_error'] = $e->getMessage();
    }

    $metadata['index_mappings'][$idxShort] = $idxData;
}

// Field value distributions for key ticket fields
// This tells us exactly what values exist for channel, state, priority, etc.
$ticketFieldAggs = [
    'channel' => ['terms' => ['field' => 'channel.keyword', 'size' => 20, 'missing' => '__missing__']],
    'channel_bare' => ['terms' => ['field' => 'channel', 'size' => 20, 'missing' => '__missing__']],
    'state_name' => ['terms' => ['field' => 'state.name.keyword', 'size' => 30, 'missing' => '__missing__']],
    'state_name_bare' => ['terms' => ['field' => 'state.name', 'size' => 30, 'missing' => '__missing__']],
    'priority_name' => ['terms' => ['field' => 'priority.name.keyword', 'size' => 10, 'missing' => '__missing__']],
    'priority_name_bare' => ['terms' => ['field' => 'priority.name', 'size' => 10, 'missing' => '__missing__']],
    'group_name' => ['terms' => ['field' => 'group.name.keyword', 'size' => 20, 'missing' => '__missing__']],
    'group_name_bare' => ['terms' => ['field' => 'group.name', 'size' => 20, 'missing' => '__missing__']],
];

try {
    $aggRes = $client->search('ticket', [
        'size' => 0,
        'aggs' => $ticketFieldAggs,
    ]);
    foreach ($ticketFieldAggs as $aggName => $_) {
        $buckets = $aggRes['aggregations'][$aggName]['buckets'] ?? [];
        $metadata['field_values'][$aggName] = array_map(function ($b) {
            return ['key' => $b['key'], 'count' => (int)$b['doc_count']];
        }, $buckets);
        // Skip printing bare-field aggs if they're identical to .keyword
    }
} catch (\Throwable $e) {
    $metadata['field_values_error'] = $e->getMessage();
}

// Field stats — which date fields exist and their date ranges
$dateFields = ['created_at', 'updated_at', 'close_at', 'first_response_escalation_at', 'escalation_at'];
foreach ($dateFields as $df) {
    try {
        $statRes = $client->search('ticket', [
            'size' => 0,
            'aggs' => [
                'min_' . $df => ['min' => ['field' => $df]],
                'max_' . $df => ['max' => ['field' => $df]],
            ],
        ]);
        $minVal = $statRes['aggregations']['min_' . $df]['value'] ?? null;
        $maxVal = $statRes['aggregations']['max_' . $df]['value'] ?? null;
        $metadata['field_stats'][$df] = [
            'min' => $minVal ? date('Y-m-d H:i:s', (int)($minVal / 1000)) : null,
            'max' => $maxVal ? date('Y-m-d H:i:s', (int)($maxVal / 1000)) : null,
            'exists' => $minVal !== null,
        ];
    } catch (\Throwable $e) {
        $metadata['field_stats'][$df] = ['error' => $e->getMessage()];
    }
}

// Write the metadata file
if (!is_dir(dirname($dumpFile))) @mkdir(dirname($dumpFile), 0775, true);
$written = @file_put_contents($dumpFile, json_encode($metadata, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES));
if ($written !== false) {
    $sizeKb = round($written / 1024, 1);
    pass('Metadata dump written', "es-metadata.json ({$sizeKb} KB)");

    // Print a summary of what was found
    echo "\n" . cDim('  ── Key findings ──') . "\n";

    // Channel values
    $chBuckets = $metadata['field_values']['channel'] ?? [];
    $chBareBuckets = $metadata['field_values']['channel_bare'] ?? [];
    $effectiveChannels = !empty($chBuckets) ? $chBuckets : $chBareBuckets;
    if (!empty($effectiveChannels)) {
        echo cDim('  Channel values discovered: ');
        $chList = array_map(function ($b) { return $b['key'] . ' (' . $b['count'] . ')'; }, $effectiveChannels);
        echo cGreen(implode(', ', $chList)) . "\n";
    } else {
        echo cYellow('  Channel values: NONE — the "channel" field does not exist or is empty in the ticket index.') . "\n";
        echo cDim('           → The dashboard will show 0 for all channels. This is expected for older Zammad versions') . "\n";
        echo cDim('             where channel is stored on the article, not the ticket.') . "\n";
    }

    // State values
    $stBuckets = $metadata['field_values']['state_name'] ?? [];
    $stBareBuckets = $metadata['field_values']['state_name_bare'] ?? [];
    $effectiveStates = !empty($stBuckets) ? $stBuckets : $stBareBuckets;
    if (!empty($effectiveStates)) {
        echo cDim('  State values: ');
        $stList = array_map(function ($b) { return $b['key'] . ' (' . $b['count'] . ')'; }, array_slice($effectiveStates, 0, 10));
        echo cGreen(implode(', ', $stList)) . "\n";
    }

    // Priority values
    $prBuckets = $metadata['field_values']['priority_name'] ?? [];
    $prBareBuckets = $metadata['field_values']['priority_name_bare'] ?? [];
    $effectivePriorities = !empty($prBuckets) ? $prBuckets : $prBareBuckets;
    if (!empty($effectivePriorities)) {
        echo cDim('  Priority values: ');
        $prList = array_map(function ($b) { return $b['key'] . ' (' . $b['count'] . ')'; }, $effectivePriorities);
        echo cGreen(implode(', ', $prList)) . "\n";
    }

    // Ticket field count
    $ticketFields = $metadata['index_mappings']['ticket']['fields'] ?? [];
    if (!empty($ticketFields)) {
        echo cDim('  Ticket index fields: ') . cGreen(count($ticketFields) . ' fields') . cDim(' (see es-metadata.json for full list)') . "\n";
    }

    // Date range
    $createdStats = $metadata['field_stats']['created_at'] ?? [];
    if (isset($createdStats['exists']) && $createdStats['exists']) {
        echo cDim('  Ticket date range: ') . cGreen($createdStats['min'] . ' → ' . $createdStats['max']) . "\n";
    }

    echo "\n" . cBold(cCyan('  📄 Full metadata saved to: ')) . cBold($dumpFile) . "\n";
    echo cDim('     Send this file back to get a dashboard tailored to your exact Zammad schema.') . "\n";
    echo cDim('     It contains: cluster info, all indices, full field mappings, sample documents,') . "\n";
    echo cDim('     and value distributions for channel/state/priority/group fields.') . "\n";
    echo cYellow('     ⚠ This file contains sample ticket data — do not expose it publicly.') . "\n";
    echo cDim('       (It is in storage/ which is guarded, but delete it after sending if concerned.)') . "\n";
} else {
    fail('Metadata dump', "Could not write to $dumpFile", 'Check write permissions on the project directory.');
}

// ============================================================================
// 8. Summary
// ============================================================================
section('Summary');
$total = count($results);
echo cBold('  Total checks: ') . $total . "\n";
echo cGreen('  Passed: ') . ($total - $failures - $warnings) . "\n";
echo cYellow('  Warnings: ') . $warnings . "\n";
echo cRed('  Failures: ') . $failures . "\n";

if ($failures === 0) {
    echo "\n" . cBold(cGreen('  ✓ All critical checks passed — the dashboard should connect fine.')) . "\n";
    if ($warnings > 0) {
        echo cYellow('  (There are warnings — review them above, but they are non-blocking.)') . "\n";
    }
    echo "\n" . cDim('  Next: start the dashboard with') . ' ' . cBold('php -S 0.0.0.0:1234') . "\n";
    exit(0);
} else {
    echo "\n" . cBold(cRed('  ✘ ' . $failures . ' check(s) failed.')) . "\n";
    echo cYellow('  Fix the issues above, then re-run: php diagnose.php') . "\n";
    exit(1);
}
