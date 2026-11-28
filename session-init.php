<?php
declare(strict_types=1);

require_once __DIR__ . '/config/environment.php';

const SESSION_TIMEOUT_SECONDS = 30 * 60 ;   // 30 minutes of inactivity

if (session_status() !== PHP_SESSION_ACTIVE) {
    ini_set('session.use_strict_mode', '1');
    ini_set('session.use_only_cookies', '1');
    ini_set('session.use_trans_sid', '0');
    // Make sure PHP's garbage collector never deletes an idle session before our own timeout does.
    ini_set('session.gc_maxlifetime', (string) (SESSION_TIMEOUT_SECONDS + 600));

    $sessionIsHttps = !empty($_SERVER['HTTPS']) && strtolower((string) $_SERVER['HTTPS']) !== 'off';

    session_set_cookie_params([
        'lifetime' => 0,                 // browser-session cookie; the server enforces the 30-minute limit
        'path'     => '/',
        'httponly' => true,
        'secure'   => $sessionIsHttps,   // false on local XAMPP (HTTP), true automatically under HTTPS
        'samesite' => 'Lax',
    ]);

    session_start();
}

if (isset($_SESSION['user_id'])) {
    $sessionNow  = time();
    $sessionLast = (int) ($_SESSION['last_activity'] ?? 0);

    if ($sessionLast > 0 && ($sessionNow - $sessionLast) > SESSION_TIMEOUT_SECONDS) {
        // Timed out: drop everything and move to a brand-new, logged-out session (old one is deleted).
        $_SESSION = [];
        session_regenerate_id(true);
        $_SESSION['timed_out'] = true;

        if (defined('SESSION_API')) {
            http_response_code(401);
            header('Content-Type: application/json; charset=utf-8');
            header('Cache-Control: no-store');
            echo json_encode([
                'success' => false,
                'message' => 'You were logged out after 30 minutes of inactivity. Please log in again.',
                'code'    => 'session_expired',
            ], JSON_UNESCAPED_UNICODE);
            exit;
        }

        if (!defined('SESSION_NO_REDIRECT')) {
            header('Location: login.php?timeout=1');
            exit;
        }
        // SESSION_NO_REDIRECT (login/logout): carry on as a logged-out visitor.
    } elseif (!defined('SESSION_NO_TOUCH')) {
        // Still active: restart the 30-minute clock.
        $_SESSION['last_activity'] = $sessionNow;
    }
}