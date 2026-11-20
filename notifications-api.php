<?php
declare(strict_types=1);

/**
 * notifications-api.php  -  the bell for EVERY role (Admin, Manager, Sales Staff, Customer Service Staff, Customer)
 *
 *   GET  ?action=list           -> { success, unread, notifications: [ {id,type,title,message,page,ref,read,createdAt} ] }
 *   POST ?action=mark_read      id
 *   POST ?action=mark_all_read
 *
 * Every query is limited to the logged-in account ($_SESSION['user_id']), so accounts never see each other's
 * notifications. Notifications are created by the other APIs through notifications-helper.php.
 */

mysqli_report(MYSQLI_REPORT_ERROR | MYSQLI_REPORT_STRICT);

// Shared session setup: secure cookie settings + 30-minute inactivity timeout (replies 401 "session_expired" as JSON).
define('SESSION_API', true);
define('SESSION_NO_TOUCH', true);   // the bell polls in the background: polling must not keep an idle session alive
require_once __DIR__ . '/session-init.php';

date_default_timezone_set("Asia/Manila");
header("Content-Type: application/json; charset=utf-8");
header("Cache-Control: no-store");

function notifRespond(int $status, array $data): void
{
    http_response_code($status);
    echo json_encode($data, JSON_UNESCAPED_UNICODE | JSON_INVALID_UTF8_SUBSTITUTE);
    exit;
}

$userId = $_SESSION["user_id"] ?? null;
if (!is_int($userId) || $userId < 1) {
    notifRespond(401, ["success" => false, "code" => "session_expired", "message" => "Please log in to continue."]);
}
session_write_close();   // read-only use of the session: do not block other requests

$action = $_GET["action"] ?? "";
$method = $_SERVER["REQUEST_METHOD"] ?? "";
$isList = $method === "GET" && $action === "list";
$isPost = $method === "POST" && in_array($action, ["mark_read", "mark_all_read"], true);
if (!$isList && !$isPost) {
    header("Allow: GET, POST");
    notifRespond(405, ["success" => false, "message" => "This Notifications API operation is not supported."]);
}
// A browser cannot add this header on a cross-site form post, so it blocks forged requests.
if ($isPost && ($_SERVER["HTTP_X_REQUESTED_WITH"] ?? "") !== "XMLHttpRequest") {
    notifRespond(403, ["success" => false, "message" => "Invalid request."]);
}

try {
    require_once __DIR__ . "/config/database.php";   // gives $conn (mysqli)
    require_once __DIR__ . "/notifications-helper.php";
    nfEnsureTable($conn);

    if ($isPost) {
        if ($action === "mark_all_read") {
            nfRun($conn, "UPDATE notifications SET is_read = 1 WHERE user_id = ? AND is_read = 0", [$userId]);
        } else {
            $id = (string) ($_POST["id"] ?? "");
            if (preg_match('/\A[1-9][0-9]*\z/', $id) !== 1) {
                notifRespond(422, ["success" => false, "message" => "Select a valid notification."]);
            }
            nfRun($conn, "UPDATE notifications SET is_read = 1 WHERE id = ? AND user_id = ?", [$id, $userId]);
        }
        notifRespond(200, ["success" => true]);
    }

    // Keep the table small: read notifications older than 60 days are removed (this account's only).
    nfRun($conn, "DELETE FROM notifications WHERE user_id = ? AND is_read = 1 AND created_at < (NOW() - INTERVAL 60 DAY)", [$userId]);

    $rows = nfRows(
        $conn,
        "SELECT id, type, title, message, page, ref, is_read, created_at
         FROM notifications WHERE user_id = ? ORDER BY created_at DESC, id DESC LIMIT 50",
        [$userId]
    );
    $unread = (int) (nfRows($conn, "SELECT COUNT(*) AS c FROM notifications WHERE user_id = ? AND is_read = 0", [$userId])[0]["c"] ?? 0);

    notifRespond(200, [
        "success" => true,
        "unread" => $unread,
        "notifications" => array_map(fn($r) => [
            "id" => (int) $r["id"],
            "type" => $r["type"],
            "title" => $r["title"],
            "message" => $r["message"],
            "page" => $r["page"],
            "ref" => $r["ref"],
            "read" => (int) $r["is_read"] === 1,
            "createdAt" => date("c", strtotime((string) $r["created_at"])),
        ], $rows),
    ]);
} catch (Throwable $e) {
    error_log("Notifications API error: " . $e->getMessage());
    notifRespond(500, ["success" => false, "message" => "Unable to process this notification request."]);
}