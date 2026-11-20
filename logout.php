<?php
declare(strict_types=1);

/*
 * Ends the user's session and redirects to the login page.
 */

// Start the session (same secure settings as the rest of the app) so it can be cleared.
// SESSION_NO_REDIRECT: never redirect from here, logout always ends at login.php anyway.
define("SESSION_NO_REDIRECT", true);
require_once __DIR__ . "/session-init.php";

// Clear authenticated data from the session.
$_SESSION = [];

// Expire the session cookie.
if (ini_get("session.use_cookies")) {
    $cookieParams = session_get_cookie_params();

    setcookie(
        session_name(),
        "",
        [
            "expires" => time() - 42000,
            "path" => $cookieParams["path"],
            "domain" => $cookieParams["domain"],
            "secure" => $cookieParams["secure"],
            "httponly" => $cookieParams["httponly"],
            "samesite" => $cookieParams["samesite"] ?? "Lax"
        ]
    );
}

// Destroy the server-side session.
session_destroy();

// Clear user details stored for frontend display.
header("Clear-Site-Data: \"cache\"");
header("Location: login.php");
exit;