<?php
declare(strict_types=1);

mysqli_report(MYSQLI_REPORT_ERROR | MYSQLI_REPORT_STRICT);

// Shared session setup: secure cookie settings + 30-minute inactivity timeout (replies 401 "session_expired" as JSON).
define('SESSION_API', true);
require_once __DIR__ . '/session-init.php';

date_default_timezone_set("Asia/Manila");
header("Content-Type: application/json; charset=utf-8");
header("Cache-Control: no-store");

const TICKET_STATUSES = ["Open", "In Progress", "Pending", "Resolved"];
const TICKET_PRIORITIES = ["Urgent", "High", "Medium", "Low"];
const TICKET_MANAGER_ROLE = "Customer Service Staff";

function ticketsRespond(int $status, array $data): void
{
    http_response_code($status);
    echo json_encode($data, JSON_UNESCAPED_UNICODE | JSON_INVALID_UTF8_SUBSTITUTE);
    exit;
}

function ticketsFail(int $status, string $message, string $code = ""): void
{
    $body = ["success" => false, "message" => $message];
    if ($code !== "") {
        $body["code"] = $code;
    }
    ticketsRespond($status, $body);
}

function ticketsPostString(string $key): string
{
    $value = $_POST[$key] ?? "";
    return is_string($value) ? trim($value) : "";
}

function ticketsPositiveId(string $value): ?int
{
    return preg_match('/\A[1-9][0-9]*\z/', $value) === 1 ? (int) $value : null;
}

/** Runs a prepared statement and returns every row (ints only for the types string). */
function ticketsRows(mysqli $conn, string $sql, string $types = "", array $args = []): array
{
    $st = $conn->prepare($sql);
    if ($types !== "") {
        $st->bind_param($types, ...$args);
    }
    $st->execute();
    $rows = $st->get_result()->fetch_all(MYSQLI_ASSOC);
    $st->close();
    return $rows;
}

function ticketsRun(mysqli $conn, string $sql, string $types = "", array $args = []): void
{
    $st = $conn->prepare($sql);
    if ($types !== "") {
        $st->bind_param($types, ...$args);
    }
    $st->execute();
    $st->close();
}

/** A customer's profile photo as a web path (uploads/profile/...), or "" when they have none. */
function ticketsPhotoUrl($rel): string
{
    $rel = trim((string) $rel);
    if ($rel === "" || strpos($rel, "uploads/profile/") !== 0) {
        return "";
    }
    $file = __DIR__ . "/" . $rel;
    return $rel . "?v=" . (is_file($file) ? (string) filemtime($file) : "1");
}

function ticketsNow(): string
{
    return date("Y-m-d H:i:s");
}

/* ------------------------- 1. SESSION + ROLE ------------------------- */
$sessionUserId = $_SESSION["user_id"] ?? null;
if (!is_int($sessionUserId) || $sessionUserId < 1) {
    ticketsFail(401, "Please log in to continue.", "session_expired");
}

$action = $_GET["action"] ?? "";
$method = $_SERVER["REQUEST_METHOD"] ?? "";
$postActions = ["update_status", "update_priority", "resolve", "add_note"];

if (!(($method === "GET" && in_array($action, ["list", "attachment"], true)) || ($method === "POST" && in_array($action, $postActions, true)))) {
    header("Allow: GET, POST");
    ticketsFail(405, "This Tickets API operation is not supported.");
}

try {
    require_once __DIR__ . "/config/database.php";   // gives $conn (mysqli)
    require_once __DIR__ . "/notifications-helper.php";   // bell notifications (see notifications-api.php)
    require_once __DIR__ . "/includes/Mail/EmailNotificationService.php";

    $me = ticketsRows(
        $conn,
        "SELECT u.account_status AS status, u.full_name, r.role_name
         FROM users AS u INNER JOIN roles AS r ON r.role_id = u.role_id
         WHERE u.user_id = ? LIMIT 1",
        "i",
        [$sessionUserId]
    )[0] ?? null;

    if (!$me || $me["status"] !== "Active") {
        ticketsFail(401, "Your account is no longer active. Please log in again.", "session_expired");
    }
    $roleName = (string) $me["role_name"];
    if (!in_array($roleName, ["Admin", "Manager", TICKET_MANAGER_ROLE], true)) {
        ticketsFail(403, "You are not authorized to access Tickets.");
    }
    $canManage = $roleName === TICKET_MANAGER_ROLE;
    $staffName = trim((string) $me["full_name"]) !== "" ? trim((string) $me["full_name"]) : $roleName;
    $staffRoleLabel = $roleName === TICKET_MANAGER_ROLE ? "CS Staff" : $roleName;

    if ($method === "GET" && $action === "attachment") {
        $ticketId = filter_var($_GET["ticket_id"] ?? null, FILTER_VALIDATE_INT, ["options" => ["min_range" => 1]]);
        $file = (string)($_GET["file"] ?? "");
        if (!$ticketId || !preg_match('/\A[a-f0-9]{32}\.(?:jpg|jpeg|png|webp|mp4|webm)\z/i', $file)) ticketsFail(404, "Attachment not found.");
        $stored = ticketsRows($conn, "SELECT m.attachments FROM cib_ticket_messages m JOIN cib_tickets t ON t.id = m.ticket_id WHERE t.id = ? AND m.sender_type = ? ORDER BY m.id ASC LIMIT 1", "is", [(int)$ticketId, "customer"])[0]["attachments"] ?? "";
        $items = json_decode((string)$stored, true) ?: [];
        $mime = ""; $allowed = false;
        foreach ($items as $item) if (is_array($item) && hash_equals((string)($item["stored_name"] ?? ""), $file)) { $allowed = true; $mime = (string)($item["mime_type"] ?? ""); break; }
        $path = dirname(__DIR__, 2) . DIRECTORY_SEPARATOR . "crm-private" . DIRECTORY_SEPARATOR . "ticket-attachments" . DIRECTORY_SEPARATOR . $file;
        if (!$allowed || !in_array($mime, ["image/jpeg", "image/png", "image/webp", "video/mp4", "video/webm"], true) || !is_file($path)) ticketsFail(404, "Attachment not found.");
        header_remove("Content-Type"); header("Content-Type: " . $mime); header("Content-Length: " . (string)filesize($path)); header("X-Content-Type-Options: nosniff"); header("Content-Disposition: inline; filename=\"" . $file . "\""); header("Cache-Control: private, no-store");
        readfile($path); exit;
    }

    /* ------------------------- 2. TABLES ------------------------- */
    // The Inbox creates cib_tickets / cib_ticket_messages. Make sure they exist, then add what this page needs.
    // Schema is installed from database/catering_crm.sql, never mutated in requests.
    // Schema is installed from database/catering_crm.sql, never mutated in requests.
    $hasPriority = ticketsRows($conn, "SHOW COLUMNS FROM cib_tickets LIKE 'priority'");
    if (!$hasPriority) {
    }
    // Schema is installed from database/catering_crm.sql, never mutated in requests.
    // Schema is installed from database/catering_crm.sql, never mutated in requests.

    /* ------------------------- 3. CUSTOMER COLUMNS (users table) ------------------------- */
    // The customer's account is in `users` (key user_id). Name / email / phone columns are found automatically.
    $uCols = [];
    foreach (ticketsRows($conn, "SHOW COLUMNS FROM users") as $c) {
        $uCols[strtolower($c["Field"])] = $c["Field"];
    }
    $nameParts = [];
    foreach (["full_name", "name", "username"] as $n) {
        if (isset($uCols[$n])) {
            $nameParts[] = "NULLIF(TRIM(u.`{$uCols[$n]}`), '')";
        }
    }
    if (isset($uCols["first_name"], $uCols["last_name"])) {
        array_unshift($nameParts, "NULLIF(TRIM(CONCAT(u.`{$uCols['first_name']}`, ' ', u.`{$uCols['last_name']}`)), '')");
    }
    $nameSql = $nameParts ? "COALESCE(" . implode(", ", $nameParts) . ")" : "NULL";
    $emailSql = isset($uCols["email"]) ? "u.`{$uCols['email']}`" : "NULL";
    $phoneSql = "NULL";
    foreach (["phone", "contact_number", "phone_number", "mobile", "mobile_number", "contact_no", "contact"] as $p) {
        if (isset($uCols[$p])) {
            $phoneSql = "u.`{$uCols[$p]}`";
            break;
        }
    }

    $photoSql = isset($uCols["photo_path"]) ? "u.`{$uCols['photo_path']}`" : "NULL";

    /* ------------------------- 4. BUILD TICKET RECORDS ------------------------- */
    /** Returns the full ticket records (with activity + notes) for the given ids, or every ticket when $ids is null. */
    $loadTickets = function (?array $ids) use ($conn, $nameSql, $emailSql, $phoneSql, $photoSql): array {
        $where = "";
        if ($ids !== null) {
            if (!$ids) {
                return [];
            }
            $where = "WHERE t.id IN (" . implode(",", array_map("intval", $ids)) . ")";
        }
        $tickets = ticketsRows(
            $conn,
            "SELECT t.id, t.customer_id, t.ticket_number, t.subject, t.status, t.priority, t.created_at, t.updated_at,
                    (SELECT m.message FROM cib_ticket_messages m WHERE m.ticket_id = t.id
                        ORDER BY (m.sender_type = 'customer') DESC, m.id ASC LIMIT 1) AS description,
                    (SELECT m.attachments FROM cib_ticket_messages m WHERE m.ticket_id = t.id AND m.sender_type = 'customer' ORDER BY m.id ASC LIMIT 1) AS initial_attachments,
                    $nameSql AS customer_name, $emailSql AS customer_email, $phoneSql AS customer_phone, $photoSql AS customer_photo_path
             FROM cib_tickets t
             LEFT JOIN users u ON u.user_id = t.customer_id
             $where
             ORDER BY t.created_at DESC, t.id DESC"
        );
        if (!$tickets) {
            return [];
        }
        $idList = implode(",", array_map(fn($t) => (int) $t["id"], $tickets));

        $messages = $logged = $notes = [];
        foreach (ticketsRows($conn, "SELECT id, ticket_id, sender_type, sender_name, created_at FROM cib_ticket_messages
                                      WHERE ticket_id IN ($idList) ORDER BY id ASC") as $m) {
            $messages[(int) $m["ticket_id"]][] = $m;
        }
        foreach (ticketsRows($conn, "SELECT ticket_id, action, performed_by, performed_by_role, created_at FROM cib_ticket_activity
                                      WHERE ticket_id IN ($idList) ORDER BY id ASC") as $a) {
            $logged[(int) $a["ticket_id"]][] = $a;
        }
        foreach (ticketsRows($conn, "SELECT ticket_id, note, created_by, created_by_role, created_at FROM cib_ticket_notes
                                      WHERE ticket_id IN ($idList) ORDER BY id ASC") as $n) {
            $notes[(int) $n["ticket_id"]][] = $n;
        }

        $result = [];
        foreach ($tickets as $t) {
            $id = (int) $t["id"];
            $customer = trim((string) ($t["customer_name"] ?? ""));
            if ($customer === "") {
                $customer = "Customer #" . $t["customer_id"];
            }
            $status = (string) $t["status"];
            $isClosed = (bool) preg_match('/^(resolved|closed)$/i', $status);

            // Audit trail: only what really happened after the ticket was submitted (every message after the first
            // one + the logged changes). Nothing is made up; a new ticket has an empty history.
            $trail = [];
            $ticketMessages = $messages[$id] ?? [];
            $skippedFirst = false;
            foreach ($ticketMessages as $m) {
                if (!$skippedFirst && $m["sender_type"] === "customer") {
                    $skippedFirst = true;   // the first customer message is the ticket itself
                    continue;
                }
                $fromCustomer = $m["sender_type"] === "customer";
                $trail[] = [
                    "action" => $fromCustomer ? "Customer sent a new message" : "Customer Service Staff replied to the customer",
                    "performed_by" => $fromCustomer ? $customer : (trim((string) $m["sender_name"]) ?: "Customer Service Staff"),
                    "performed_by_role" => $fromCustomer ? "Customer" : "CS Staff",
                    "created_at" => $m["created_at"],
                ];
            }
            foreach ($logged[$id] ?? [] as $a) {
                if (trim((string) $a["performed_by"]) === "" && $a["performed_by_role"] === "Customer") {
                    $a["performed_by"] = $customer;   // written by the customer Inbox, which does not know the name
                }
                $trail[] = $a;
            }
            usort($trail, fn($x, $y) => strcmp((string) $x["created_at"], (string) $y["created_at"]));   // stable in PHP 8

            $last = $ticketMessages ? end($ticketMessages) : null;
            if ($isClosed) {
                $actionNeeded = "No action needed";
            } elseif ($last && $last["sender_type"] !== "customer") {
                $actionNeeded = "Waiting for customer";
            } else {
                $actionNeeded = "Respond to customer";
            }

            $result[] = [
                "ticket_id" => $id,
                "ticket_no" => $t["ticket_number"] ?: "TCK-" . str_pad((string) $id, 4, "0", STR_PAD_LEFT),
                "ticket_name" => $t["subject"],
                "description" => (string) ($t["description"] ?? ""),
                "attachments" => array_map(static function ($file) use ($id) {
                    if (!is_array($file)) return [];
                    $stored = (string)($file["stored_name"] ?? "");
                    if (preg_match('/\A[a-f0-9]{32}\.(?:jpg|jpeg|png|webp|mp4|webm)\z/i', $stored)) {
                        $file["url"] = "tickets-api.php?action=attachment&ticket_id=" . $id . "&file=" . rawurlencode($stored);
                    }
                    unset($file["stored_name"]);
                    return $file;
                }, (array)(json_decode((string)($t["initial_attachments"] ?? ""), true) ?: [])),
                "customer_id" => (int) $t["customer_id"],
                "customer_name" => $customer,
                "customer_email" => (string) ($t["customer_email"] ?? ""),
                "customer_phone" => (string) ($t["customer_phone"] ?? ""),
                "customer_photo" => ticketsPhotoUrl($t["customer_photo_path"] ?? ""),
                "status" => $status,
                "priority" => $t["priority"] ?: "Medium",
                "created_at" => $t["created_at"],
                "updated_at" => $t["updated_at"],
                "last_activity" => $trail ? end($trail)["action"] : "Ticket submitted",
                "action_needed" => $actionNeeded,
                "activity" => array_values($trail),
                "internal_notes" => $notes[$id] ?? [],
            ];
        }
        return $result;
    };

    /* ------------------------- 5. LIST ------------------------- */
    if ($method === "GET") {
        $key = "tickets_csrf_token";
        if (!isset($_SESSION[$key]) || !is_string($_SESSION[$key]) || preg_match('/\A[a-f0-9]{64}\z/', $_SESSION[$key]) !== 1) {
            $_SESSION[$key] = bin2hex(random_bytes(32));
        }
        $csrfToken = $_SESSION[$key];
        session_write_close();

        ticketsRespond(200, [
            "success" => true,
            "role" => $roleName,
            "user_id" => $sessionUserId,
            "can_manage" => $canManage,
            "csrf_token" => $csrfToken,
            "tickets" => $loadTickets(null),
        ]);
    }

    /* ------------------------- 6. CHANGES (Customer Service Staff only) ------------------------- */
    $headerToken = $_SERVER["HTTP_X_CSRF_TOKEN"] ?? "";
    $formToken = $_POST["csrf_token"] ?? "";
    $submitted = is_string($headerToken) && $headerToken !== "" ? $headerToken : (is_string($formToken) ? $formToken : "");
    $stored = $_SESSION["tickets_csrf_token"] ?? "";
    if (!is_string($stored) || preg_match('/\A[a-f0-9]{64}\z/', $stored) !== 1 || !hash_equals($stored, $submitted)) {
        ticketsFail(403, "Your security token is no longer valid. Refresh Tickets and try again.", "csrf_invalid");
    }
    if (!$canManage) {
        ticketsFail(403, "Admin and Manager accounts can view tickets only. Customer Service Staff manage them.", "forbidden");
    }

    $ticketId = ticketsPositiveId(ticketsPostString("id"));
    if ($ticketId === null) {
        ticketsFail(422, "Select a valid ticket.", "invalid_ticket_id");
    }
    $ticket = ticketsRows($conn, "SELECT id, customer_id, ticket_number, subject, status, priority FROM cib_tickets WHERE id = ? LIMIT 1", "i", [$ticketId])[0] ?? null;
    if (!$ticket) {
        ticketsFail(404, "The selected ticket no longer exists.", "ticket_not_found");
    }

    $log = function (string $text) use ($conn, $ticketId, $staffName, $staffRoleLabel): void {
        ticketsRun(
            $conn,
            "INSERT INTO cib_ticket_activity (ticket_id, action, performed_by, performed_by_role, created_at) VALUES (?,?,?,?,?)",
            "issss",
            [$ticketId, $text, $staffName, $staffRoleLabel, ticketsNow()]
        );
    };
    $touch = function () use ($conn, $ticketId): void {
        ticketsRun($conn, "UPDATE cib_tickets SET updated_at = ? WHERE id = ?", "si", [ticketsNow(), $ticketId]);
    };

    $newStatus = null;   // set when the status really changed: the customer is notified after the commit
    $conn->begin_transaction();
    try {
        if ($action === "update_status" || $action === "resolve") {
            $status = $action === "resolve" ? "Resolved" : ticketsPostString("status");
            if (!in_array($status, TICKET_STATUSES, true)) {
                $conn->rollback();
                ticketsFail(422, "Select a valid ticket status.", "invalid_status");
            }
            if ($status !== $ticket["status"]) {
                ticketsRun($conn, "UPDATE cib_tickets SET status = ? WHERE id = ?", "si", [$status, $ticketId]);
                $log($action === "resolve" ? "Ticket resolved" : "Ticket status changed to " . $status);
                $touch();
                $newStatus = $status;
            }
        } elseif ($action === "update_priority") {
            $priority = ticketsPostString("priority");
            if (!in_array($priority, TICKET_PRIORITIES, true)) {
                $conn->rollback();
                ticketsFail(422, "Select a valid ticket priority.", "invalid_priority");
            }
            if ($priority !== $ticket["priority"]) {
                ticketsRun($conn, "UPDATE cib_tickets SET priority = ? WHERE id = ?", "si", [$priority, $ticketId]);
                $log("Ticket priority changed to " . $priority);
                $touch();
            }
        } else {   // add_note
            $note = ticketsPostString("note");
            if ($note === "" || mb_strlen($note, "UTF-8") > 2000) {
                $conn->rollback();
                ticketsFail(422, "Enter an internal note of 1 to 2000 characters.", "invalid_note");
            }
            ticketsRun(
                $conn,
                "INSERT INTO cib_ticket_notes (ticket_id, note, created_by, created_by_role, created_at) VALUES (?,?,?,?,?)",
                "issss",
                [$ticketId, $note, $staffName, $staffRoleLabel, ticketsNow()]
            );
            $log("Internal note added");
            $touch();
        }
        $conn->commit();
    } catch (Throwable $e) {
        $conn->rollback();
        throw $e;
    }

    if ($newStatus !== null) {
        $nfRef = nfTicketRef($ticket);
        $resolved = $newStatus === "Resolved";
        notifySend($conn, [
            "type" => "ticket",
            "title" => $resolved ? "Ticket resolved" : "Ticket status updated",
            "message" => $staffName . " changed " . $nfRef . " to " . $newStatus . ": " . $ticket["subject"],
            "page" => "manager-admin-ticket.html",
            "ref" => $nfRef,
            "user_ids" => [(int) $ticket["customer_id"]],
            "exclude_user_id" => $sessionUserId,
            "by_role" => ["Customer" => [
                "title" => $resolved ? "Your ticket was resolved" : "Your ticket status was updated",
                "message" => $resolved
                    ? $nfRef . " has been marked as resolved: " . $ticket["subject"]
                    : $nfRef . " is now " . $newStatus . ": " . $ticket["subject"],
                "page" => "customer-inbox.html",
            ]],
        ]);
        if ($resolved) {
            $recipient = EmailNotificationService::customerRecipient($db, (int) $ticket["customer_id"]);
            EmailNotificationService::queue(
                $db,
                (int) $ticket["customer_id"],
                $recipient["email"],
                $recipient["name"],
                "support_ticket_resolved",
                "Support ticket resolved - " . $nfRef,
                [
                    "heading" => "Support Ticket Resolved",
                    "greeting" => $recipient["name"],
                    "message" => "Your support concern has been resolved.",
                    "rows" => [
                        "Ticket reference" => $nfRef,
                        "Ticket subject" => (string) $ticket["subject"],
                        "Status" => "Resolved",
                    ],
                    "button_text" => "View My Concerns",
                    "button_url" => EmailNotificationService::customerAppUrl($db, "customer-inbox.html"),
                ],
                "support_ticket_resolved:" . $ticketId,
                "ticket",
                $ticketId
            );
        }
    }

    ticketsRespond(200, [
        "success" => true,
        "message" => "Ticket updated successfully.",
        "ticket" => ($loadTickets([$ticketId])[0] ?? null),
    ]);
} catch (Throwable $e) {
    error_log("Tickets API error: " . $e->getMessage());
    ticketsFail(500, "Unable to process this ticket request. Please try again.");
}
