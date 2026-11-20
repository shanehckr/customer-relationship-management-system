<?php
declare(strict_types=1);

/*
 * Main entry point of the Catering CRM.
 * Validates the user's session and redirects unauthenticated users to login.php.
 * Loads the shared application layout from includes/app-layout.php.
 */

// Shared session setup: secure cookie settings + 30-minute inactivity timeout.
// No SESSION_API / SESSION_NO_REDIRECT here: an expired session sends the user to login.php?timeout=1.
require_once __DIR__ . "/session-init.php";

// Allow only users with a valid authenticated session.
if (
    !isset($_SESSION["user_id"], $_SESSION["full_name"], $_SESSION["role_name"]) ||
    !is_int($_SESSION["user_id"]) ||
    !is_string($_SESSION["full_name"]) ||
    !is_string($_SESSION["role_name"])
) {
    header("Location: login.php");
    exit;
}

// Prevent browsers from caching the authenticated app shell.
header("Cache-Control: no-store, private");
header("X-Content-Type-Options: nosniff");

// Load the shared CRM layout after authentication.
require __DIR__ . "/includes/app-layout.php";