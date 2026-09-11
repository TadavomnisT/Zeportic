<?php
/**
 * ============================================================================
 *  Zeportic — Zammad Reporting Tool — Entry Point
 * ============================================================================
 *
 *  Run with PHP's built-in server:
 *      php -S 0.0.0.0:1234
 *  Then open: http://YOUR-SERVER-IP:1234
 *
 *  This file serves the HTML shell. The frontend (assets/app.js) is a
 *  single-page app that calls /api.php?action=... for data.
 *
 *  All assets (CSS, JS, fonts, Chart.js) are bundled locally — NO external
 *  requests, NO CDN, NO internet required.
 * ----------------------------------------------------------------------------
 */

declare(strict_types=1);

// Marker so config.php / src/*.php refuse to run if accessed directly via HTTP.
define('APP_RUNNING', true);

define('BASE_DIR', __DIR__);
require BASE_DIR . '/src/Config.php';
$config = Config::load();

// First run? Send the user to the graphical setup wizard.
if (!Config::isConfigured()) {
    header('Location: setup.php');
    exit;
}

require BASE_DIR . '/src/Auth.php';

date_default_timezone_set($config['app']['timezone'] ?? 'UTC');
Auth::start($config['auth']);
$isAuth = Auth::check($config['auth']);

// ---- Language resolution (server side) ----
// Priority: user cookie (set by the client-side language switcher) → config
// default. The active pack is preloaded up front; English always loads too.
$langCatalog = Config::LANGS;
$rtlLangs = Config::RTL;
$Lang = (string)($config['app']['default_lang'] ?? 'en');
$cookieLang = isset($_COOKIE['zr-lang']) ? (string)$_COOKIE['zr-lang'] : '';
if ($cookieLang !== '' && in_array($cookieLang, $langCatalog, true)) {
    $Lang = $cookieLang;
}
if (!in_array($Lang, $langCatalog, true)) {
    $Lang = 'en';
}
$Dir = in_array($Lang, $rtlLangs, true) ? 'rtl' : 'ltr';

$Theme  = htmlspecialchars($config['app']['default_theme'] ?? 'dark');
$Name   = htmlspecialchars($config['app']['name'] ?? 'Zeportic');
$Sub    = htmlspecialchars($config['app']['subtitle'] ?? 'Zammad Reporting Tool');
$Title  = $Name . ' — ' . $Sub;
$Version = htmlspecialchars($config['app']['version'] ?? '1.1.1');
?>
<!DOCTYPE html>
<html lang="<?= $Lang ?>" dir="<?= $Dir ?>" data-theme="<?= $Theme ?>">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title><?= $Title ?></title>
<meta name="description" content="<?= $Name ?> — <?= $Sub ?>. Real-time reports and analytics for your Zammad helpdesk, powered by Elasticsearch.">
<meta name="theme-color" content="#7c3aed">
<link rel="icon" type="image/png" href="/assets/img/favicon.png">
<!-- Local fonts (Vazirmatn, bundled) -->
<link rel="stylesheet" href="/assets/fonts.css">
<!-- Local styles -->
<link rel="stylesheet" href="/assets/app.css">
<!-- Local Chart.js (bundled, no CDN) -->
<script src="/assets/chart.umd.min.js"></script>
<!-- i18n: catalog + English fallback + active pack -->
<script src="/assets/lang/meta.js"></script>
<script src="/assets/lang/en.js"></script>
<?php if ($Lang !== 'en'): ?><script src="/assets/lang/<?= htmlspecialchars($Lang) ?>.js"></script><?php endif; ?>
<!-- Content Security Policy: everything is local — no inline code needed. -->
<meta http-equiv="Content-Security-Policy"
      content="default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; font-src 'self'; connect-src 'self'; object-src 'none'; base-uri 'self'; form-action 'self'">
</head>
<body class="<?= $isAuth ? '' : 'login-page' ?>"
      data-authenticated="<?= $isAuth ? '1' : '0' ?>"
      data-version="<?= $Version ?>"
      data-app-name="<?= $Name ?>"
      data-app-subtitle="<?= $Sub ?>">
<div id="app">
<?php if (!$isAuth): ?>
  <div id="login-view"></div>
<?php else: ?>
  <div id="dashboard-view"></div>
<?php endif; ?>
</div>
<!-- Local app logic (SPA: charts, wordcloud, exports, i18n) -->
<script src="/assets/app.js"></script>
</body>
</html>
