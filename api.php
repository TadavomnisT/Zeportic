<?php
/**
 * ============================================================================
 *  Zeportic — Zammad Reporting Tool — JSON API
 * ============================================================================
 *
 *  All endpoints live under:  /api.php?action=...&period=30
 *  Most require an authenticated session (except: login, me, health).
 *
 *  Endpoints:
 *    login, logout, me, health, overview, channels, agents, roles,
 *    responseTime, trends, wordcloud, tickets, heatmap, organizations,
 *    sla, tags, activity, agentDetail, kb, compare, notifications,
 *    ticketsByWord, sidebarStats, aiInsights, periodComparison,
 *    agentLeaderboard, kpiSparkline, kpiDrilldown, trendForecast, export
 * ----------------------------------------------------------------------------
 */

declare(strict_types=1);

// Block direct access to lib files; allow this entry.
define('APP_RUNNING', true);

define('BASE_DIR', __DIR__);
require BASE_DIR . '/src/Config.php';
$config = Config::load();
require BASE_DIR . '/src/ElasticsearchClient.php';
require BASE_DIR . '/src/ReportService.php';
require BASE_DIR . '/src/Auth.php';

date_default_timezone_set($config['app']['timezone'] ?? 'UTC');
Auth::start($config['auth']);

header('Content-Type: application/json; charset=utf-8');
header('X-Content-Type-Options: nosniff');
header('X-Frame-Options: DENY');
header('Referrer-Policy: same-origin');
header('Cache-Control: no-store');

// First run? Point clients at the graphical setup wizard.
if (!Config::isConfigured()) {
    http_response_code(503);
    echo json_encode([
        'error'        => 'Zeportic is not configured yet. Open /setup.php to run the setup wizard.',
        'setup_required' => true,
        'setup_url'    => 'setup.php',
    ], JSON_UNESCAPED_UNICODE | JSON_PRETTY_PRINT);
    exit;
}

$action = $_GET['action'] ?? '';
$period = (int)($_GET['period'] ?? 30);

function es(array $config): ElasticsearchClient
{
    return new ElasticsearchClient($config['elasticsearch']);
}

function service(array $config): ReportService
{
    return new ReportService(es($config));
}

function out($data, int $code = 200): void
{
    http_response_code($code);
    echo json_encode($data, JSON_UNESCAPED_UNICODE | JSON_PRETTY_PRINT);
    exit;
}

function error(string $msg, int $code = 400, array $extra = []): void
{
    out(array_merge(['error' => $msg], $extra), $code);
}

/** Write a structured error to the on-disk log so it can be tailed.
 *  The file is named *.php with a guard line so it cannot be served over HTTP
 *  by `php -S` (requesting it returns 403 Forbidden). Read it with:
 *      tail -f storage/errors.php        (the first line is a PHP guard, skip it)
 *      tail -n +2 storage/errors.php     (skip the guard line)
 */
function logError(string $action, \Throwable $e, array $config): void
{
    $logDir = BASE_DIR . '/storage';
    if (!is_dir($logDir)) @mkdir($logDir, 0775, true);
    $logFile = $logDir . '/errors.php';
    // Write the PHP guard on first creation so the file can't be read over HTTP.
    if (!is_file($logFile)) {
        @file_put_contents($logFile, "<?php http_response_code(403); die('Forbidden'); ?>\n", LOCK_EX);
    }
    $entry = [
        'time'      => date('Y-m-d H:i:s'),
        'action'    => $action,
        'type'      => get_class($e),
        'message'   => $e->getMessage(),
        'file'      => basename($e->getFile()),
        'line'      => $e->getLine(),
        'trace'     => array_slice(array_map(fn($f) => ($f['file'] ?? '?') . ':' . ($f['line'] ?? '?') . ' ' . ($f['class'] ?? '') . ($f['type'] ?? '') . ($f['function'] ?? ''), $e->getTrace()), 0, 8),
        'request'   => $_SERVER['REQUEST_METHOD'] . ' ' . ($_SERVER['REQUEST_URI'] ?? ''),
        'ip'        => $_SERVER['REMOTE_ADDR'] ?? '-',
    ];
    @file_put_contents($logFile, json_encode($entry, JSON_UNESCAPED_UNICODE) . "\n", FILE_APPEND | LOCK_EX);
}

try {
    switch ($action) {
        case 'login':
            if ($_SERVER['REQUEST_METHOD'] !== 'POST') error('Method not allowed', 405);
            $body = json_decode(file_get_contents('php://input'), true) ?: [];
            $user = (string)($body['username'] ?? '');
            $pass = (string)($body['password'] ?? '');
            if (mb_strlen($user) > 128 || mb_strlen($pass) > 1024) error('Invalid credentials', 401);
            if (Auth::attempt($config['auth'], $user, $pass)) {
                out(['ok' => true, 'user' => $user]);
            }
            $retry = Auth::lockedFor();
            header($retry > 0 ? 'Retry-After: ' . $retry : 'Retry-After: 0');
            error($retry > 0
                ? 'Too many failed attempts — try again in ' . $retry . 's'
                : 'Invalid credentials', 401, $retry > 0 ? ['retry_after' => $retry] : []);

        case 'logout':
            Auth::logout();
            out(['ok' => true]);

        case 'me':
            out(['authenticated' => Auth::check($config['auth']), 'user' => Auth::user()]);

        case 'health':
            out(service($config)->health());

        case 'diagnostics':
            // Full diagnostic dump — requires auth.
            if (!Auth::check($config['auth'])) {
                error('Unauthorized', 401);
            }
            out(buildDiagnostics(es($config)));

        default:
            if (!Auth::check($config['auth'])) {
                error('Unauthorized', 401);
            }
    }

    $svc = service($config);
    switch ($action) {
        case 'overview':         out($svc->overview($period));
        case 'channels':         out($svc->channels($period));
        case 'topGroups':        out($svc->topGroups($period));
        case 'agents':           out($svc->agents($period));
        case 'roles':            out($svc->roles());
        case 'responseTime':     out($svc->responseTime($period));
        case 'trends':           out($svc->trends($period));
        case 'wordcloud':        out($svc->wordcloud($period, (int)($_GET['size'] ?? 80)));
        case 'tickets':          out(['tickets' => $svc->recentTickets((int)($_GET['limit'] ?? 50))]);
        case 'heatmap':          out($svc->heatmap($period));
        case 'organizations':    out($svc->organizations($period));
        case 'sla':              out($svc->slaReport($period));
        case 'tags':             out($svc->tagStats($period));
        case 'activity':         out($svc->activityFeed((int)($_GET['limit'] ?? 12), (int)($_GET['tick'] ?? 0)));
        case 'agentDetail':
            $aid = (int)($_GET['id'] ?? 0);
            if ($aid <= 0) error('Missing agent id', 400);
            out($svc->agentDetail($aid, $period));
        case 'kb':               out($svc->kbStats($period));
        case 'compare':          out($svc->comparePeriods($period));
        case 'notifications':    out($svc->notifications((int)($_GET['limit'] ?? 20)));
        case 'ticketsByWord':
            $word = (string)($_GET['word'] ?? '');
            if ($word === '') error('Missing word parameter', 400);
            out(['tickets' => $svc->ticketsByWord($word, (int)($_GET['limit'] ?? 50)), 'word' => $word]);
        case 'sidebarStats':     out($svc->sidebarStats());
        case 'aiInsights':       out($svc->aiInsights((int)($_GET['days'] ?? $period)));
        case 'periodComparison': out($svc->periodComparison((int)($_GET['days'] ?? $period)));
        case 'agentLeaderboard': out($svc->agentLeaderboard((int)($_GET['days'] ?? $period)));
        case 'kpiSparkline':
            $key = (string)($_GET['key'] ?? 'total');
            if ($key === '') $key = 'total';
            out($svc->kpiSparkline($key, (int)($_GET['days'] ?? $period)));
        case 'kpiDrilldown':
            $dkey = (string)($_GET['key'] ?? 'total');
            if ($dkey === '') $dkey = 'total';
            out($svc->kpiDrilldown($dkey, (int)($_GET['days'] ?? $period), (int)($_GET['limit'] ?? 12)));
        case 'trendForecast':    out($svc->trendForecast((int)($_GET['days'] ?? $period)));
        case 'export':
            $type = $_GET['type'] ?? 'agents';
            $data = match ($type) {
                'agents'        => $svc->agents($period),
                'tickets'       => $svc->recentTickets(200),
                'channels'      => $svc->channels($period),
                'wordcloud'     => $svc->wordcloud($period, 200),
                'organizations' => $svc->organizations($period),
                'sla'           => $svc->slaReport($period)['byPriority'] ?? [],
                'tags'          => $svc->tagStats($period)['top'] ?? [],
                'kb'            => $svc->kbStats($period)['topViewed'] ?? [],
                'notifications' => $svc->notifications(200),
                'sidebarStats'  => (function () use ($svc) {
                    $s = $svc->sidebarStats();
                    return [
                        ['metric' => 'todayCount', 'value' => $s['todayCount'] ?? 0],
                        ['metric' => 'weekCount', 'value' => $s['weekCount'] ?? 0],
                        ['metric' => 'openCount', 'value' => $s['openCount'] ?? 0],
                        ['metric' => 'escalatedCount', 'value' => $s['escalatedCount'] ?? 0],
                        ['metric' => 'activeAgents', 'value' => $s['activeAgents'] ?? 0],
                    ];
                })(),
                'compare' => (function () use ($svc, $period) {
                    $c = $svc->comparePeriods($period);
                    return [
                        ['metric' => 'total', 'current' => $c['current']['total'] ?? 0, 'previous' => $c['previous']['total'] ?? 0, 'delta_pct' => $c['deltas']['total'] ?? 0],
                        ['metric' => 'open', 'current' => $c['current']['open'] ?? 0, 'previous' => $c['previous']['open'] ?? 0, 'delta_pct' => $c['deltas']['open'] ?? 0],
                        ['metric' => 'closed', 'current' => $c['current']['closed'] ?? 0, 'previous' => $c['previous']['closed'] ?? 0, 'delta_pct' => $c['deltas']['closed'] ?? 0],
                        ['metric' => 'escalated', 'current' => $c['current']['escalated'] ?? 0, 'previous' => $c['previous']['escalated'] ?? 0, 'delta_pct' => $c['deltas']['escalated'] ?? 0],
                        ['metric' => 'avgResponse', 'current' => $c['current']['avgResponse'] ?? 0, 'previous' => $c['previous']['avgResponse'] ?? 0, 'delta_pct' => $c['deltas']['avgResponse'] ?? 0],
                        ['metric' => 'avgResolution', 'current' => $c['current']['avgResolution'] ?? 0, 'previous' => $c['previous']['avgResolution'] ?? 0, 'delta_pct' => $c['deltas']['avgResolution'] ?? 0],
                    ];
                })(),
                default => [],
            };
            exportCsv($type, $data);
            exit;
        default: error('Unknown action', 404);
    }
} catch (\Throwable $e) {
    logError($action, $e, $config);
    $extra = [
        'error_type'  => get_class($e),
        'file'        => basename($e->getFile()),
        'line'        => $e->getLine(),
        'hint'        => 'See storage/error.log for details, or run: php diagnose.php',
    ];
    error($e->getMessage(), 500, $extra);
}

/**
 * Build a full diagnostics payload by exercising the ES client.
 * Tests: ping, info, cluster health, index list, sample count + search.
 */
function buildDiagnostics(ElasticsearchClient $client): array
{
    $cfg = $client->configSnapshot();
    $result = [
        'php'        => ['version' => PHP_VERSION, 'sapi' => PHP_SAPI],
        'extensions' => [
            'curl'     => extension_loaded('curl'),
            'json'     => extension_loaded('json'),
            'openssl'  => extension_loaded('openssl'),
            'mbstring' => extension_loaded('mbstring'),
        ],
        'config'     => $cfg,
        'connection' => null,
        'cluster'    => null,
        'indices'    => null,
        'sample'     => null,
        'last_request' => null,
    ];

    // 1. Ping
    $pingStart = microtime(true);
    try {
        $ping = $client->ping();
        $result['connection'] = [
            'ping'         => $ping,
            'ping_ms'      => round((microtime(true) - $pingStart) * 1000, 1),
            'request_count'=> $client->requestCount(),
        ];
    } catch (\Throwable $e) {
        $result['connection'] = ['ping' => false, 'error' => $e->getMessage(), 'last_request' => $client->lastRequest()];
        $result['last_request'] = $client->lastRequest();
        return $result;
    }

    // 2. ES info (version, cluster name)
    $info = $client->info();
    $result['cluster'] = [
        'version'      => $info['version']['number'] ?? null,
        'distribution' => $info['version']['distribution'] ?? null,
        'cluster_name' => $info['cluster_name'] ?? null,
        'tagline'      => $info['tagline'] ?? null,
        'health'       => $client->clusterHealth(),
    ];

    // 3. Indices matching the prefix
    try {
        $all = $client->listIndices();
        $prefix = $cfg['index_prefix'];
        $matching = array_values(array_filter($all, function ($i) use ($prefix) {
            return str_starts_with((string)($i['index'] ?? ''), $prefix);
        }));
        $result['indices'] = [
            'total_in_cluster' => count($all),
            'matching_prefix'  => count($matching),
            'matching'          => array_map(fn($i) => [
                'index'      => $i['index'] ?? '',
                'docs.count' => $i['docs.count'] ?? 0,
                'store.size' => $i['store.size'] ?? '',
                'health'     => $i['health'] ?? '',
            ], array_slice($matching, 0, 30)),
        ];
    } catch (\Throwable $e) {
        $result['indices'] = ['error' => $e->getMessage()];
    }

    // 4. Sample query on ticket index
    try {
        $count = $client->count('ticket');
        $search = $client->search('ticket', [
            'query' => ['match_all' => new \stdClass()],
            'sort'  => [['created_at' => ['order' => 'desc']]],
        ], 1);
        $hits = $search['hits']['hits'] ?? [];
        $result['sample'] = [
            'ticket_count' => $count,
            'search_ok'    => true,
            'sample_title' => mb_substr((string)($hits[0]['_source']['title'] ?? $hits[0]['_source']['number'] ?? ''), 0, 80),
        ];
    } catch (\Throwable $e) {
        $result['sample'] = ['search_ok' => false, 'error' => $e->getMessage()];
    }

    $result['last_request'] = $client->lastRequest();
    $result['request_count'] = $client->requestCount();
    return $result;
}

function exportCsv(string $type, array $data): void
{
    $filename = 'zammad-report-' . $type . '-' . date('Y-m-d') . '.csv';
    header('Content-Type: text/csv; charset=utf-8');
    header('Content-Disposition: attachment; filename="' . $filename . '"');
    echo "\xEF\xBB\xBF"; // UTF-8 BOM for Excel
    $out = fopen('php://output', 'w');
    if (empty($data)) {
        fputcsv($out, ['No data']);
        fclose($out);
        return;
    }
    $headers = array_keys($data[0]);
    fputcsv($out, $headers);
    foreach ($data as $row) {
        fputcsv($out, array_map(fn($v) => is_array($v) ? json_encode($v, JSON_UNESCAPED_UNICODE) : $v, array_values($row)));
    }
    fclose($out);
}
