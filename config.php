<?php
/**
 * ============================================================================
 *  Zeportic — Zammad Reporting Tool — Configuration
 * ============================================================================
 *
 *  THIS IS THE ONLY FILE YOU NEED TO EDIT.
 *
 *  Put your Elasticsearch credentials and your dashboard admin password here,
 *  then run:   php -S 0.0.0.0:1234
 *  and open:   http://YOUR-SERVER-IP:1234
 *
 *  The app only READS from Elasticsearch — it never writes or deletes.
 * ----------------------------------------------------------------------------
 */

// Block direct HTTP access to this file (so credentials are never served).
defined('APP_RUNNING') or die('No direct access');

return [

    // ===================== Elasticsearch =====================
    'elasticsearch' => [
        // ES endpoint. Zammad's Docker Compose default publishes 9200 to the
        // host. See README.md → "Connecting to Zammad" for Docker setups.
        'host'     => 'https://localhost:9200',

        // Index prefix used by Zammad.
        //  - production environment  -> 'zammad_production'
        //  - staging/test environment -> 'zammad_test'
        'index_prefix' => 'zammad_production',

        // ES credentials.
        'username' => 'elastic',
        'password' => 'CHANGE_ME_ELASTIC_PASSWORD',   // <-- your elastic password

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
    // CHANGE THESE from the defaults before exposing the dashboard.
    'auth' => [
        'username' => 'admin',
        'password' => 'CHANGE_ME',           // <-- CHANGE THIS (plain text)
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
        'default_theme' => 'light', // light | dark
        'timezone'      => 'UTC',
        // Shown in the footer and on the login page. Bump when you customize.
        'version'       => '1.0.0',
    ],

];
