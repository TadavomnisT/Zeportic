<?php
/**
 * Session-based auth for the Zeportic dashboard admin.
 *
 * Features:
 *  - Plain-text OR password_hash() credentials (bcrypt/argon via password_verify).
 *  - Brute-force throttling: 5 failed attempts per window → 60 s lockout.
 *  - Hardened session cookie (HttpOnly, SameSite=Lax, Secure on HTTPS).
 *  - Session id regeneration on login (session fixation defence).
 */

// Block direct HTTP access — this file must be included by index.php/api.php.
defined('APP_RUNNING') or die('No direct access');

final class Auth
{
    private const MAX_ATTEMPTS = 5;
    private const LOCKOUT_SECONDS = 60;

    public static function start(array $cfg): void
    {
        $secure = (!empty($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off')
            || (($_SERVER['HTTP_X_FORWARDED_PROTO'] ?? '') === 'https');
        session_set_cookie_params([
            'httponly' => true,
            'samesite' => 'Lax',
            'secure'   => $secure,
            'lifetime' => 0,
        ]);
        session_start();
        if (!isset($_SESSION['lifetime'])) {
            $_SESSION['lifetime'] = $cfg['session_lifetime'] ?? 28800;
        }
        // expire
        if (isset($_SESSION['last_activity']) && (time() - $_SESSION['last_activity'] > $_SESSION['lifetime'])) {
            self::logout();
        }
        $_SESSION['last_activity'] = time();
    }

    public static function check(array $cfg): bool
    {
        return !empty($_SESSION['authenticated']) && $_SESSION['authenticated'] === true;
    }

    /** Constant-time credential check. Supports password_hash() when provided. */
    private static function verifyCredentials(array $cfg, string $user, string $pass): bool
    {
        if (!hash_equals((string)($cfg['username'] ?? ''), $user)) {
            // Burn time so user-enumeration via timing is harder.
            if (!empty($cfg['password_hash'])) { password_verify($pass, (string)$cfg['password_hash']); }
            return false;
        }
        $hash = $cfg['password_hash'] ?? null;
        if (is_string($hash) && $hash !== '') {
            return password_verify($pass, $hash);
        }
        return hash_equals((string)($cfg['password'] ?? ''), $pass);
    }

    /**
     * Attempt a login. Returns true on success; on failure it also bumps the
     * throttling counter. When locked out, returns false without checking.
     */
    public static function attempt(array $cfg, string $user, string $pass): bool
    {
        // ---- throttle ----
        $now = time();
        if (!isset($_SESSION['fail_count']) || !is_int($_SESSION['fail_count'])) {
            $_SESSION['fail_count'] = 0;
        }
        if (($_SESSION['locked_until'] ?? 0) > $now) {
            return false; // locked out — do not even check credentials
        }

        if (self::verifyCredentials($cfg, $user, $pass)) {
            $_SESSION['fail_count'] = 0;
            unset($_SESSION['locked_until']);
            session_regenerate_id(true);
            $_SESSION['authenticated'] = true;
            $_SESSION['user'] = $user;
            return true;
        }

        $_SESSION['fail_count'] = (int)($_SESSION['fail_count'] ?? 0) + 1;
        if ($_SESSION['fail_count'] >= self::MAX_ATTEMPTS) {
            $_SESSION['locked_until'] = $now + self::LOCKOUT_SECONDS;
            $_SESSION['fail_count'] = 0;
        }
        return false;
    }

    /** Seconds remaining in the current lockout (0 = not locked). */
    public static function lockedFor(): int
    {
        return max(0, (int)($_SESSION['locked_until'] ?? 0) - time());
    }

    public static function user(): ?string
    {
        return $_SESSION['user'] ?? null;
    }

    public static function logout(): void
    {
        $_SESSION = [];
        if (ini_get('session.use_cookies')) {
            $p = session_get_cookie_params();
            setcookie(session_name(), '', time() - 42000, $p['path'], $p['domain'], $p['secure'], $p['httponly']);
        }
        session_destroy();
    }
}
