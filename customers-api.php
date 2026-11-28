<?php
declare(strict_types=1);

mysqli_report(MYSQLI_REPORT_ERROR | MYSQLI_REPORT_STRICT);

// Shared session setup: secure cookie settings + 30-minute inactivity timeout (replies 401 "session_expired" as JSON).
define('SESSION_API', true);
require_once __DIR__ . '/session-init.php';

date_default_timezone_set("Asia/Manila");
header("Content-Type: application/json; charset=utf-8");
header("Cache-Control: no-store");

function custRespond(int $status, array $data): void
{
    http_response_code($status);
    echo json_encode($data, JSON_UNESCAPED_UNICODE | JSON_INVALID_UTF8_SUBSTITUTE);
    exit;
}

function custFail(int $status, string $message): void
{
    custRespond($status, ["success" => false, "message" => $message]);
}

/** Prepared SELECT -> all rows. $types is a mysqli type string ("i", "ss", ...). */
function custRows(mysqli $conn, string $sql, string $types = "", array $args = []): array
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

/** Same as custRows, but a missing table / column gives an empty list instead of breaking the whole page. */
function custSafeRows(mysqli $conn, string $label, string $sql, string $types = "", array $args = []): array
{
    try {
        return custRows($conn, $sql, $types, $args);
    } catch (mysqli_sql_exception $e) {
        error_log("Customers API ($label): " . $e->getMessage());
        return [];
    }
}

/** A customer's profile photo as a web path (uploads/profile/...), or "" when they have none. */
function custPhotoUrl($rel): string
{
    $rel = trim((string) $rel);
    if ($rel === "" || strpos($rel, "uploads/profile/") !== 0) {
        return "";
    }
    $file = __DIR__ . "/" . $rel;
    return $rel . "?v=" . (is_file($file) ? (string) filemtime($file) : "1");
}

function custCode(int $id): string
{
    return "CUS-" . str_pad((string) $id, 4, "0", STR_PAD_LEFT);
}

function custDay($value): string
{
    $t = $value ? strtotime((string) $value) : false;
    return $t ? date("F j, Y", $t) : "";
}

function custShape(array $u): array
{
    $id = (int) $u["user_id"];
    return [
        "customer_id" => $id,
        "customer_code" => custCode($id),
        "full_name" => trim((string) ($u["full_name"] ?? "")) !== "" ? trim((string) $u["full_name"]) : (string) ($u["username"] ?? ""),
        "email" => (string) ($u["email"] ?? ""),
        "phone" => (string) ($u["phone"] ?? ""),
        "status" => (string) ($u["status"] ?? ""),
        "customer_photo" => custPhotoUrl($u["photo_path"] ?? ""),
        "registered_at" => (string) ($u["created_at"] ?? ""),
        "registered_label" => custDay($u["created_at"] ?? null),
    ];
}

/* Session and role validation. */
$sessionUserId = (int) ($_SESSION["user_id"] ?? 0);
if ($sessionUserId < 1) {
    custFail(401, "Please log in to continue.");
}

$action = $_GET["action"] ?? "";
if (($_SERVER["REQUEST_METHOD"] ?? "") !== "GET" || !in_array($action, ["list", "detail"], true)) {
    header("Allow: GET");
    custFail(405, "This Customers API operation is not supported.");
}

try {
    require_once __DIR__ . "/config/database.php";   // gives $conn (mysqli)

    $me = custRows(
        $conn,
        "SELECT u.account_status AS status, r.role_name
         FROM users AS u INNER JOIN roles AS r ON r.role_id = u.role_id
         WHERE u.user_id = ? LIMIT 1",
        "i",
        [$sessionUserId]
    )[0] ?? null;

    if (!$me || $me["status"] !== "Active") {
        custFail(401, "Your account is no longer active. Please log in again.");
    }
    if (!in_array((string) $me["role_name"], ["Admin", "Manager"], true)) {
        custFail(403, "You are not authorized to view customers.");
    }

    // role_id of the "Customer" role (5 on your database, but read it instead of hard-coding it)
    $roleRow = custRows($conn, "SELECT role_id FROM roles WHERE LOWER(role_name) = 'customer' LIMIT 1")[0] ?? null;
    $customerRoleId = $roleRow ? (int) $roleRow["role_id"] : 0;
    // profile photo column (added by customer-account-api.php the first time a customer opens Settings)
    $hasPhoto = count(custRows($conn, "SHOW COLUMNS FROM users LIKE 'photo_path'")) > 0;

    /* ------------------------- 2. LIST ------------------------- */
    if ($action === "list") {
        if ($customerRoleId < 1) {
            custRespond(200, ["success" => true, "total" => 0, "customers" => []]);
        }

        $where = ["u.role_id = ?"];
        $types = "i";
        $args = [$customerRoleId];

        // Search: Customer ID (CUS-0003 or 3), name, username, email, phone (spaces / dashes ignored)
        $q = mb_substr(trim((string) ($_GET["q"] ?? "")), 0, 100);
        if ($q !== "") {
            $like = "%" . addcslashes($q, "%_\\") . "%";
            $parts = ["u.full_name LIKE ?", "u.username LIKE ?", "u.email LIKE ?", "u.phone LIKE ?"];
            $types .= "ssss";
            array_push($args, $like, $like, $like, $like);

            if (preg_match('/^cus-?(\d+)$/i', $q, $m)) {
                $parts[] = "u.user_id = ?";
                $types .= "i";
                $args[] = (int) $m[1];
            } elseif (ctype_digit($q) && strlen($q) <= 6) {
                $parts[] = "u.user_id = ?";
                $types .= "i";
                $args[] = (int) $q;
            }
            $digits = preg_replace('/\D/', '', $q);
            if (strlen((string) $digits) >= 3) {
                $parts[] = "REPLACE(REPLACE(REPLACE(REPLACE(u.phone, ' ', ''), '-', ''), '+', ''), '(', '') LIKE ?";
                $types .= "s";
                $args[] = "%" . $digits . "%";
            }
            $where[] = "(" . implode(" OR ", $parts) . ")";
        }

        // Registration date filter
        $registered = (string) ($_GET["registered"] ?? "all");
        $since = null;
        switch ($registered) {
            case "today": $since = date("Y-m-d"); break;
            case "7d":    $since = date("Y-m-d", strtotime("-6 days")); break;
            case "30d":   $since = date("Y-m-d", strtotime("-29 days")); break;
            case "month": $since = date("Y-m-01"); break;
            case "year":  $since = date("Y-01-01"); break;
        }
        if ($since !== null) {
            $where[] = "u.created_at >= ?";
            $types .= "s";
            $args[] = $since . " 00:00:00";
        }

        $rows = custRows(
            $conn,
            "SELECT u.user_id, u.full_name, u.username, u.email, u.phone, u.account_status AS status, u.created_at" . ($hasPhoto ? ", u.photo_path" : "") . "
             FROM users AS u
             WHERE " . implode(" AND ", $where) . "
             ORDER BY u.created_at ASC, u.user_id ASC",
            $types,
            $args
        );
        $customers = array_map("custShape", $rows);
        custRespond(200, ["success" => true, "total" => count($customers), "customers" => $customers]);
    }

    /* ------------------------- 3. DETAIL ------------------------- */
    $idRaw = (string) ($_GET["id"] ?? "");
    if (preg_match('/\A[1-9][0-9]*\z/', $idRaw) !== 1) {
        custFail(400, "Choose a valid customer.");
    }
    $customerId = (int) $idRaw;

    $user = $customerRoleId > 0
        ? (custRows(
            $conn,
            "SELECT user_id, full_name, username, email, phone, account_status AS status, created_at" . ($hasPhoto ? ", photo_path" : "") . "
             FROM users WHERE user_id = ? AND role_id = ? LIMIT 1",
            "ii",
            [$customerId, $customerRoleId]
        )[0] ?? null)
        : null;
    if (!$user) {
        custFail(404, "Customer not found.");
    }

    // Inquiries  (leads.customer_id)
    $leadRows = custSafeRows($conn, "inquiries", "SELECT * FROM leads WHERE customer_id = ? ORDER BY created_at DESC", "i", [$customerId]);
    $inquiries = [];
    $leadIds = [];
    foreach ($leadRows as $r) {
        $lid = (int) ($r["lead_id"] ?? $r["id"] ?? 0);
        if ($lid) {
            $leadIds[] = $lid;
        }
        $inquiries[] = [
            "inquiry_ref" => !empty($r["inquiry_ref"]) ? (string) $r["inquiry_ref"] : "INQ-" . str_pad((string) $lid, 4, "0", STR_PAD_LEFT),
            "event_name" => (string) ($r["event_name"] ?? ""),
            "event_date" => (string) ($r["event_date"] ?? ""),
            "arrangement" => (string) ($r["arrangement"] ?? ""),
            "stage" => (string) ($r["stage"] ?? ""),
            "assigned_staff" => (string) ($r["assigned_staff_name"] ?? ""),
            "submitted_at" => (string) ($r["created_at"] ?? ""),
        ];
    }

    // Bookings  (bookings.customer_id, or a booking made from one of this customer's inquiries)
    $bkSql = "SELECT * FROM bookings WHERE customer_id = ?";
    $bkTypes = "i";
    $bkArgs = [$customerId];
    if ($leadIds) {
        $bkSql .= " OR inquiry_id IN (" . implode(",", array_fill(0, count($leadIds), "?")) . ")";
        $bkTypes .= str_repeat("i", count($leadIds));
        $bkArgs = array_merge($bkArgs, $leadIds);
    }
    $bkSql .= " ORDER BY created_at DESC";
    $bookings = [];
    $payments = [];
    foreach (custSafeRows($conn, "bookings", $bkSql, $bkTypes, $bkArgs) as $r) {
        $paid = (float) ($r["amount_paid"] ?? 0);
        $ref = !empty($r["booking_ref"]) ? (string) $r["booking_ref"] : "BK-" . str_pad((string) ($r["booking_id"] ?? 0), 4, "0", STR_PAD_LEFT);
        $bookings[] = [
            "booking_ref" => $ref,
            "event_title" => (string) ($r["event_title"] ?? ""),
            "event_date" => (string) ($r["event_date"] ?? ""),
            "arrangement" => (string) ($r["arrangement"] ?? ""),
            "total_amount" => isset($r["quotation_amount"]) ? (float) $r["quotation_amount"] : 0.0,
            "amount_paid" => $paid,
            "remaining_balance" => isset($r["remaining_balance"]) ? (float) $r["remaining_balance"] : 0.0,
            "payment_status" => (string) ($r["payment_status"] ?? ""),
            "booking_status" => (string) ($r["booking_status"] ?? ""),
        ];
        // A payment = money received on a booking (deposit or full payment)
        if ($paid > 0) {
            $payments[] = [
                "booking_ref" => $ref,
                "event_title" => (string) ($r["event_title"] ?? ""),
                "amount_paid" => $paid,
                "payment_method" => (string) ($r["payment_method"] ?? ""),
                "payment_reference" => (string) ($r["payment_reference"] ?? ""),
                "payment_status" => (string) ($r["payment_status"] ?? ""),
                "paid_at" => (string) ($r["paid_at"] ?? ""),
            ];
        }
    }

    // Tickets  (cib_tickets.customer_id)
    $tickets = [];
    foreach (custSafeRows($conn, "tickets", "SELECT * FROM cib_tickets WHERE customer_id = ? ORDER BY created_at DESC", "i", [$customerId]) as $r) {
        $tid = (int) ($r["id"] ?? 0);
        $tickets[] = [
            "ticket_number" => !empty($r["ticket_number"]) ? (string) $r["ticket_number"] : "TCK-" . str_pad((string) $tid, 4, "0", STR_PAD_LEFT),
            "subject" => (string) ($r["subject"] ?? ""),
            "status" => (string) ($r["status"] ?? ""),
            "priority" => (string) ($r["priority"] ?? ""),
            "created_at" => (string) ($r["created_at"] ?? ""),
            "updated_at" => (string) ($r["updated_at"] ?? ""),
        ];
    }

    $counts = [
        "inquiries" => count($inquiries),
        "bookings" => count($bookings),
        "payments" => count($payments),
        "tickets" => count($tickets),
    ];
    $linked = array_sum($counts);

    custRespond(200, [
        "success" => true,
        "customer" => custShape($user),
        "counts" => $counts,
        "linked_records" => $linked,
        "can_delete" => false,   // read only: this page never deletes accounts
        "deletion_note" => $linked > 0
            ? "Account deletion disabled ($linked linked business record" . ($linked === 1 ? "" : "s") . ")"
            : "No linked business records",
        "inquiries" => $inquiries,
        "bookings" => $bookings,
        "payments" => $payments,
        "tickets" => $tickets,
    ]);
} catch (Throwable $e) {
    error_log("Customers API error: " . $e->getMessage());
    custFail(500, "Unable to load customers. Please try again.");
}