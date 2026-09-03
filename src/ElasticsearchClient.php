<?php
/**
 * Elasticsearch client for Zammad indices.
 * Uses cURL (no external dependencies) — works on any PHP install with curl + json.
 *
 * Zammad indices (from indexes.txt):
 *   zammad_production_ticket
 *   zammad_production_user
 *   zammad_production_role
 *   zammad_production_group
 *   zammad_production_chat_session
 *   zammad_production_cti_log
 *   zammad_production_ticket_state
 *   zammad_production_ticket_priority
 *   zammad_production_organization
 *   zammad_production_stats_store
 *   ... and more
 */

// Block direct HTTP access — this file must be included by index.php/api.php.
defined('APP_RUNNING') or die('No direct access');

final class ElasticsearchClient
{
    private string $host;
    private string $prefix;
    private string $user;
    private string $pass;
    private bool $verifySsl;
    private ?string $caBundle;

    /** @var array{method:string,url:string,code:int,error:string,duration_ms:float} Last request info (for diagnostics). */
    private array $lastRequest = ['method' => '', 'url' => '', 'code' => 0, 'error' => '', 'duration_ms' => 0.0];
    private int $requestCount = 0;

    public function __construct(array $cfg)
    {
        $this->host      = rtrim($cfg['host'], '/');
        $this->prefix    = $cfg['index_prefix'];
        $this->user      = $cfg['username'];
        $this->pass      = $cfg['password'];
        $this->verifySsl = $cfg['verify_ssl'] ?? false;
        $this->caBundle  = $cfg['ca_bundle'] ?? null;
    }

    /** Build a full index name with prefix. */
    public function index(string $name): string
    {
        return $this->prefix . '_' . $name;
    }

    /** Run a search query against an index. */
    public function search(string $indexName, array $body, int $size = 0): array
    {
        $body['size'] = $body['size'] ?? $size;
        return $this->request('POST', '/' . $this->index($indexName) . '/_search', $body);
    }

    /** Count documents matching a query. */
    public function count(string $indexName, array $query = []): int
    {
        $body = empty($query) ? new \stdClass() : ['query' => $query];
        $res = $this->request('POST', '/' . $this->index($indexName) . '/_count', $body);
        return (int)($res['count'] ?? 0);
    }

    /** Get a single document by id. */
    public function get(string $indexName, string $id): ?array
    {
        $res = $this->request('GET', '/' . $this->index($indexName) . '/_doc/' . urlencode($id), null);
        return $res['found'] ?? false ? $res : null;
    }

    /** Ping the cluster. */
    public function ping(): bool
    {
        try {
            $res = $this->request('GET', '/', null);
            return isset($res['version']['number']);
        } catch (\Throwable $e) {
            return false;
        }
    }

    /** List indices (for diagnostics). */
    public function listIndices(): array
    {
        $res = $this->request('GET', '/_cat/indices?format=json', null);
        return is_array($res) ? $res : [];
    }

    /** Get cluster health (for diagnostics). */
    public function clusterHealth(): array
    {
        try {
            return $this->request('GET', '/_cluster/health', null);
        } catch (\Throwable $e) {
            return ['error' => $e->getMessage()];
        }
    }

    /** Get the ES server info (version, cluster name). */
    public function info(): array
    {
        try {
            return $this->request('GET', '/', null);
        } catch (\Throwable $e) {
            return ['error' => $e->getMessage()];
        }
    }

    /** Get mapping for an index (for diagnostics). */
    public function mapping(string $indexName): array
    {
        try {
            return $this->request('GET', '/' . $this->index($indexName) . '/_mapping', null);
        } catch (\Throwable $e) {
            return ['error' => $e->getMessage()];
        }
    }

    /** Return diagnostics about the last HTTP request. */
    public function lastRequest(): array
    {
        return $this->lastRequest;
    }

    /** Total number of ES requests made by this client instance. */
    public function requestCount(): int
    {
        return $this->requestCount;
    }

    /** Return a safe (password-redacted) config snapshot for diagnostics. */
    public function configSnapshot(): array
    {
        return [
            'host'        => $this->host,
            'index_prefix'=> $this->prefix,
            'username'    => $this->user,
            'password_set'=> strlen($this->pass) > 0 && $this->pass !== 'CHANGE_ME_ELASTIC_PASSWORD',
            'password_len'=> strlen($this->pass),
            'verify_ssl'  => $this->verifySsl,
            'ca_bundle'   => $this->caBundle,
        ];
    }

    /** Low-level HTTP request. */
    private function request(string $method, string $path, $body): array
    {
        $url = $this->host . $path;
        $ch = curl_init($url);
        $headers = ['Content-Type: application/json', 'Accept: application/json'];

        curl_setopt_array($ch, [
            CURLOPT_RETURNTRANSFER => true,
            CURLOPT_CUSTOMREQUEST  => $method,
            CURLOPT_HTTPHEADER     => $headers,
            CURLOPT_USERPWD        => $this->user . ':' . $this->pass,
            CURLOPT_TIMEOUT        => 20,
            CURLOPT_SSL_VERIFYPEER => $this->verifySsl,
            CURLOPT_SSL_VERIFYHOST => $this->verifySsl ? 2 : 0,
        ]);

        if ($this->caBundle && $this->verifySsl) {
            curl_setopt($ch, CURLOPT_CAINFO, $this->caBundle);
        }

        $payload = null;
        if ($body !== null) {
            $payload = ($body instanceof \stdClass) ? '{}' : json_encode($body, JSON_UNESCAPED_UNICODE);
            curl_setopt($ch, CURLOPT_POSTFIELDS, $payload);
        }

        $start = microtime(true);
        $resp = curl_exec($ch);
        $code = curl_getinfo($ch, CURLINFO_HTTP_CODE);
        $err  = curl_error($ch);
        $errno = curl_errno($ch);
        $duration = round((microtime(true) - $start) * 1000, 1);
        curl_close($ch);

        $this->requestCount++;
        $this->lastRequest = [
            'method'      => $method,
            'url'         => $this->redactUrl($url),
            'code'        => (int)$code,
            'error'       => $err,
            'errno'       => $errno,
            'duration_ms' => $duration,
        ];

        if ($resp === false) {
            throw new \RuntimeException('Elasticsearch request failed: ' . $err . ' (cURL errno ' . $errno . ')');
        }

        $data = json_decode($resp, true);
        if ($code >= 400) {
            $reason = $data['error']['reason']
                ?? $data['error']['type']
                ?? $data['message']
                ?? 'HTTP ' . $code;
            $rootCause = $data['error']['root_cause'][0]['reason'] ?? null;
            $msg = 'Elasticsearch error (' . $code . '): ' . $reason;
            if ($rootCause && $rootCause !== $reason) {
                $msg .= ' — root cause: ' . $rootCause;
            }
            throw new \RuntimeException($msg);
        }

        return $data ?: [];
    }

    /** Redact credentials from a URL for safe logging. */
    private function redactUrl(string $url): string
    {
        return preg_replace('#(https?://)([^:@/]+):([^@/]+)@#', '$1$2:••••@', $url);
    }
}
