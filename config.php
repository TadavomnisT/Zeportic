<?php
/**
 * ============================================================================
 *  Zeportic — Zammad Reporting Tool — Configuration
 * ============================================================================
 *
 *  TWO WAYS TO CONFIGURE:
 *
 *  1. (Recommended) Just run the app — the graphical setup wizard does it:
 *        php -S 0.0.0.0:1234      then open http://YOUR-SERVER-IP:1234
 *     The wizard writes config.local.php (git-ignored) and never touches
 *     this file. It also stores the dashboard password as a secure hash.
 *
 *  2. Manual: replace the CHANGE_ME placeholders below with your values.
 *     As long as the ES password below still reads CHANGE_ME_ELASTIC_PASSWORD,
 *     the setup wizard will start instead of the dashboard.
 *
 *  The app only READS from Elasticsearch — it never writes or deletes.
 * ----------------------------------------------------------------------------
 */

// Block direct HTTP access to this file (so credentials are never served).
defined('APP_RUNNING') or die('No direct access');

return [

    // ===================== Elasticsearch =====================
    // Zammad stores its data in Elasticsearch. Fill these in with the
    // values from your Zammad/ES installation — or let the setup wizard
    // do it (it can auto-detect the index prefix and test the connection).
    'elasticsearch' => [
        // ES endpoint. Zammad's Docker Compose default is https://localhost:9200
        // (see README.md → "Connecting to Zammad" for Docker setups).
        'host'     => 'https://localhost:9200',

        // Index prefix used by Zammad.
        //  - production environment  -> 'zammad_production'
        //  - staging/test environment -> 'zammad_test'
        'index_prefix' => 'zammad_production',

        // ES credentials.
        'username' => 'elastic',
        'password' => 'CHANGE_ME_ELASTIC_PASSWORD',   // <-- setup wizard or edit manually

        // TLS certificate verification.
        //  - Zammad's ES often uses a self-signed cert by default → keep false.
        //  - If you have a valid cert, set true (and optionally set ca_bundle).
        'verify_ssl' => false,

        // Path to a CA bundle file, e.g. '/etc/ssl/certs/ca-certificates.crt'
        // Leave null to use the system default. Only used when verify_ssl = true.
        'ca_bundle'  => null,
    ],

    // ===================== Dashboard Admin Auth =====================
    // Credentials for logging into THIS dashboard (NOT Elasticsearch).
    // The setup wizard writes a password_hash into config.local.php — no need
    // to touch this when using the wizard.
    'auth' => [
        'username' => 'admin',
        'password' => 'CHANGE-ME',               // <-- CHANGE THIS (plain text)
        // Optional: a PHP password_hash() of the password instead of plain text.
        // Generate with:  php -r "echo password_hash('YOUR-PASSWORD', PASSWORD_DEFAULT);"
        // When set, 'password' above is ignored for verification.
        'password_hash' => null,
        'session_lifetime' => 28800,         // seconds (8 hours)
    ],

    // ===================== App Settings =====================
    'app' => [
        'name'          => 'Zeportic',
        'subtitle'      => 'Zammad Reporting Tool',
        'default_lang'  => 'en',    // any language code from assets/lang/meta.js
        'default_theme' => 'dark',  // light | dark  (dark is the branded default)
        'timezone'      => 'UTC',
        // Shown in the footer and on the login page. Bump when you customize.
        'version'       => '1.1.0',
    ],

];
