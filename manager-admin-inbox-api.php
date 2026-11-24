<?php
/**
 * manager-admin-inbox-api.php  (XAMPP / MySQL)   -   Admin + Manager inbox (READ-ONLY)
 *
 * Put this file in the SAME folder as sales-inbox-api.php and cs-inbox-api.php.
 * It reads the SAME tables they use, so Admin and Manager can monitor everything:
 *   - Sales conversations (cib_conversations / cib_messages)       -> "Sales Conversations" tab
 *   - Support tickets     (cib_tickets / cib_ticket_messages)      -> "Support Tickets" tab
 *
 * READ ONLY: there is no send / reply action here, and opening a conversation does NOT mark it as read
 * (the "Unread" count means "the assigned staff has not opened it yet").
 *
 * Actions used by pages.js (crmInitManagerInbox):
 *   list_conversations, conversation_messages, list_tickets, ticket_messages
 */

/* ------------------------- 1. SETTINGS (edit these) ------------------------- */
$DB_NAME = 'catering_crm';
// Where the customer's name / email come from. Change to match your customers table.
// If this lookup fails, the inbox still works and shows "Customer #id".
$CUSTOMER_TABLE     = 'customers';
$CUSTOMER_ID_COL    = 'id';
$CUSTOMER_NAME_SQL  = "TRIM(CONCAT(c.first_name, ' ', c.last_name))";   // or "c.name" / "c.full_name"
$CUSTOMER_EMAIL_COL = 'email';

// Only these roles may use this API (compared in lower case, "_" and "-" read as spaces).
$ALLOWED_ROLES     = ['admin', 'manager'];
$ROLE_SESSION_KEY = 'role_name';

/* ---------------------------------------------------------------------------- */

date_default_timezone_set('Asia/Manila');
ini_set('display_errors', '0');
error_reporting(E_ALL);
ob_start();
header('Content-Type: application/json; charset=utf-8');
header('Cache-Control: no-store');

function out(array $payload, int $status = 200): void {
    if (ob_get_length()) ob_clean();
    http_response_code($status);
    echo json_encode($payload, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
    exit;
}
function fail(string $message, int $status = 400): void {
    out(['success' => false, 'message' => $message], $status);
}
set_exception_handler(function ($e) {
    fail('Server error: ' . $e->getMessage(), 500);
});

// Shared session setup: secure cookie settings + 30-minute inactivity timeout (replies 401 "session_expired" as JSON).
if (!defined('SESSION_API')) define('SESSION_API', true);
require_once __DIR__ . '/session-init.php';

/* ------------------------- 2. WHO IS LOGGED IN ------------------------- */
function normRole($r): string {
    return trim(preg_replace('/\s+/', ' ', preg_replace('/[_-]+/', ' ', strtolower((string)$r))));
}
$role = '';
$viewerRole = '';
if (!empty($_SESSION[$ROLE_SESSION_KEY])) {
    $viewerRole = trim((string)$_SESSION[$ROLE_SESSION_KEY]);
    $role = normRole($viewerRole);
}
$userId = (int)($_SESSION['user_id'] ?? 0);
if ($userId < 1 || $role === '') fail('Please log in again.', 401);
if (!in_array($role, array_map('normRole', $ALLOWED_ROLES), true)) fail('Only Admin and Manager can open this inbox.', 403);

/* ------------------------- 3. DATABASE + CURRENT ACCOUNT AUTHORIZATION ------------------------- */
require_once __DIR__ . '/config/database.php';
try {
    $identity = $db->prepare('SELECT u.account_status, r.role_name FROM users u
                              JOIN roles r ON r.role_id = u.role_id WHERE u.user_id = ? LIMIT 1');
    $identity->execute([$userId]);
    $account = $identity->fetch();
} catch (Throwable $e) {
    error_log('manager-admin-inbox-api: account authorization lookup failed: ' . $e->getMessage());
    fail('Unable to verify your account.', 500);
}
if (!$account || $account['account_status'] !== 'Active') fail('Please log in again.', 401);
$databaseRole = normRole($account['role_name']);
if (!in_array($databaseRole, array_map('normRole', $ALLOWED_ROLES), true)) {
    fail('Only Admin and Manager can open this inbox.', 403);
}
if ($databaseRole !== $role) fail('Your role changed. Please log in again.', 403);
$role = $databaseRole;
$viewerRole = (string)$account['role_name'];

// Read only: this API never accepts a POST.
if (($_SERVER['REQUEST_METHOD'] ?? 'GET') !== 'GET') {
    header('Allow: GET');
    fail('This inbox is read-only.', 405);
}

$CUSTOMER_PHOTO_SQL = 'NULL';   // customer profile photo (users.photo_path), see inboxPhotoUrl()
/* The customer's account lives in the users table (there is no customers table):
   find its key, name and email columns automatically so the inbox shows real names instead of "Customer #id". */
try {
    $uCols = [];
    foreach ($db->query("SHOW COLUMNS FROM `users`")->fetchAll() as $uc) $uCols[strtolower($uc['Field'])] = $uc['Field'];
    $uKey = $db->query("SHOW KEYS FROM `users` WHERE Key_name = 'PRIMARY'")->fetch();
    $nameParts = [];
    if (isset($uCols['first_name'], $uCols['last_name'])) $nameParts[] = "NULLIF(TRIM(CONCAT(c.`{$uCols['first_name']}`, ' ', c.`{$uCols['last_name']}`)), '')";
    foreach (['full_name', 'name', 'username'] as $n) if (isset($uCols[$n])) $nameParts[] = "NULLIF(TRIM(c.`{$uCols[$n]}`), '')";
    if ($nameParts) {
        $CUSTOMER_TABLE     = 'users';
        $CUSTOMER_ID_COL    = $uKey['Column_name'] ?? ($uCols['id'] ?? ($uCols['user_id'] ?? 'id'));
        $CUSTOMER_NAME_SQL  = 'COALESCE(' . implode(', ', $nameParts) . ')';
        $CUSTOMER_EMAIL_COL = $uCols['email'] ?? 'email';
        if (isset($uCols['photo_path'])) $CUSTOMER_PHOTO_SQL = "c.`{$uCols['photo_path']}`";
    }
} catch (Throwable $e) { error_log('inbox: could not read the users table: ' . $e->getMessage()); }

// Same tables the customer / sales / CS inboxes use (created there). Make sure they exist and have the columns used below.
    // Schema is installed from database/catering_crm.sql, never mutated in requests.
    // Schema is installed from database/catering_crm.sql, never mutated in requests.
    // Schema is installed from database/catering_crm.sql, never mutated in requests.
    // Schema is installed from database/catering_crm.sql, never mutated in requests.
function ensureColumn(AppDatabase $db, string $table, string $column, string $definition): void {
    // Inbox columns are provisioned centrally from database/catering_crm.sql.
}
ensureColumn($db, 'cib_conversations', 'inquiry_id', 'INT NULL DEFAULT NULL');
ensureColumn($db, 'cib_conversations', 'sales_read_at', 'DATETIME NULL DEFAULT NULL');
ensureColumn($db, 'cib_tickets', 'priority', "VARCHAR(20) NOT NULL DEFAULT 'Medium'");
ensureColumn($db, 'cib_tickets', 'cs_read_at', 'DATETIME NULL DEFAULT NULL');

/* ------------------------- 4. HELPERS ------------------------- */
require_once __DIR__ . '/quotations-schema.php';

/**
 * Staff-side rewrite of customer quotation response messages (accept / decline / request changes).
 * Always uses the INQ reference and the event name so staff can find the inquiry directly.
 * **...** is shown in bold by pages.js.
 */
function staffAcceptText(AppDatabase $db, $inquiryId, string $subject, string $reference, string $text): string {
    if (empty($inquiryId)) return $text;

    // Build the label: "Event Name (INQ-0000)" — always INQ, never BK
    $code  = trim($reference);
    $label = trim($subject);
    if ($code !== '' && stripos($label, $code) === false) $label = $label !== '' ? $label . ' (' . $code . ')' : $code;
    if ($label === '') $label = 'INQ-' . str_pad((string)$inquiryId, 4, '0', STR_PAD_LEFT);

    // "I accept the quotation…"
    if (preg_match('/^\s*I accept\b[^\n]*quotation/i', $text)) {
        try { $q = quoteForBooking($db, (int)$inquiryId); } catch (Throwable $e) { return $text; }
        if (!$q) return $text;
        return 'I accept the quotation for **' . $label . '**. I will pay the ' . quotePeso($q['deposit_amount']) . ' deposit to confirm my booking.';
    }

    // "I would like to request changes to the quotation…"
    if (preg_match('/^\s*I would like to request changes to the quotation for\s+\*\*/i', $text)) {
        return preg_replace(
            '/^\s*I would like to request changes to the quotation for\s+\*\*[^*]*\*\*/iu',
            'I would like to request changes to the quotation for **' . $label . '**',
            $text
        );
    }

    // "I am declining the quotation…"
    if (preg_match('/^\s*I am declining the quotation for\s+\*\*/i', $text)) {
        return preg_replace(
            '/^\s*I am declining the quotation for\s+\*\*[^*]*\*\*/iu',
            'I am declining the quotation for **' . $label . '**',
            $text
        );
    }

    return $text;
}

/** Inquiry conversations only: not "Support" and not the conversation of a support ticket (same rule as sales-inbox-api.php). */
const INQUIRY_ONLY = "cv.status <> 'Support' AND NOT EXISTS (SELECT 1 FROM cib_tickets tk WHERE tk.conversation_id = cv.id)
    AND (cv.inquiry_id IS NULL OR EXISTS (SELECT 1 FROM leads la WHERE la.lead_id = cv.inquiry_id AND la.assigned_staff_id IS NOT NULL))";

/** A customer's profile photo as a web path (uploads/profile/...), or '' when they have none. Staff never have photos. */
function inboxPhotoUrl($rel): string {
    $rel = trim((string)$rel);
    if ($rel === '' || strpos($rel, 'uploads/profile/') !== 0) return '';
    $file = __DIR__ . '/' . $rel;
    return $rel . '?v=' . (is_file($file) ? (string)filemtime($file) : '1');
}

/** Names (username + full name, lower case) of real accounts that have the given role. Used so the "staff" filter only lists actual staff,
 *  not labels like "Catering Team" or "Payments" that system / other-module messages put in sender_name. */
function staffNamesForRole(AppDatabase $db, string $roleName): array {
    $names = [];
    try {
        $st = $db->prepare("SELECT u.username, u.full_name FROM users u INNER JOIN roles r ON r.role_id = u.role_id WHERE r.role_name = ?");
        $st->execute([$roleName]);
        foreach ($st->fetchAll() as $u) {
            foreach (['username', 'full_name'] as $k) {
                $n = strtolower(trim((string)($u[$k] ?? '')));
                if ($n !== '') $names[$n] = true;
            }
        }
    } catch (Throwable $e) { error_log('inbox: could not read staff accounts: ' . $e->getMessage()); }
    return $names;
}
/** Keep the first candidate that is a real staff account of that role, else ''. */
function pickStaffName(array $valid, array $candidates): string {
    foreach ($candidates as $c) {
        $c = trim((string)$c);
        if ($c !== '' && isset($valid[strtolower($c)])) return $c;
    }
    return '';
}

function shapeRow(array $r, string $refKey, string $refPrefix, string $subjectKey, bool $isTicket): array {
    $name = trim((string)($r['customer_name'] ?? ''));
    if ($name === '') $name = trim((string)($r['lead_customer_name'] ?? ''));
    $last = (string)$r['last_message'];
    if ($last === '' && !empty($r['last_attachments'])) $last = 'Sent an attachment';
    $row = [
        'id' => (int)$r['id'],
        'customer_id' => (int)$r['customer_id'],
        'reference' => $r[$refKey] ?: $refPrefix . str_pad((string)$r['id'], 4, '0', STR_PAD_LEFT),
        'subject' => $r[$subjectKey],
        'status' => $r['status'],
        'customer_name' => $name !== '' ? $name : 'Customer #' . $r['customer_id'],
        'customer_email' => (string)($r['customer_email'] ?? ''),
        'customer_photo' => inboxPhotoUrl($r['customer_photo_path'] ?? ''),
        // The staff member who answered last (the one handling this customer).
        'staff_name' => trim((string)($r['staff_name'] ?? '')),
        'last_message' => $last,
        'last_message_at' => str_replace(' ', 'T', $r['last_message_at']),
        'created_at' => str_replace(' ', 'T', $r['created_at']),
        'unread' => (int)$r['unread'],
    ];
    if ($isTicket) {
        $row['ticket_number'] = $row['reference'];
        $row['priority'] = $r['priority'] ?: 'Medium';
    } else {
        $row['inquiry_id'] = $r['inquiry_id'] !== null ? (int)$r['inquiry_id'] : null;
    }
    return $row;
}

/** Sales conversations (alias cv) with customer, last message, handling staff and unread count. */
function conversationQuery(AppDatabase $db, string $where, array $args): array {
    global $CUSTOMER_TABLE, $CUSTOMER_ID_COL, $CUSTOMER_NAME_SQL, $CUSTOMER_EMAIL_COL, $CUSTOMER_PHOTO_SQL;
    $base = "cv.id, cv.customer_id, cv.title, cv.reference, cv.status, cv.inquiry_id, cv.created_at, cv.updated_at,
        (SELECT m.message FROM cib_messages m WHERE m.conversation_id = cv.id ORDER BY m.id DESC LIMIT 1) AS last_message,
        (SELECT m.attachments FROM cib_messages m WHERE m.conversation_id = cv.id ORDER BY m.id DESC LIMIT 1) AS last_attachments,
        COALESCE(
            (SELECT m.sender_name FROM cib_messages m WHERE m.conversation_id = cv.id AND m.sender_type = 'staff' ORDER BY m.id DESC LIMIT 1),
            (SELECT lb.assigned_staff_name FROM leads lb WHERE lb.lead_id = cv.inquiry_id)) AS staff_name,
        (SELECT lb2.assigned_staff_name FROM leads lb2 WHERE lb2.lead_id = cv.inquiry_id) AS lead_staff_name,
        (SELECT lc.customer_name FROM leads lc WHERE lc.lead_id = cv.inquiry_id) AS lead_customer_name,
        COALESCE((SELECT MAX(m.created_at) FROM cib_messages m WHERE m.conversation_id = cv.id), cv.updated_at) AS last_message_at,
        (SELECT COUNT(*) FROM cib_messages m WHERE m.conversation_id = cv.id AND m.sender_type = 'customer'
            AND m.created_at > COALESCE(cv.sales_read_at, '1970-01-01 00:00:00')) AS unread";
    $order = ' ORDER BY last_message_at DESC, cv.id DESC';
    try {
        $sql = "SELECT $base, $CUSTOMER_NAME_SQL AS customer_name, c.`$CUSTOMER_EMAIL_COL` AS customer_email, $CUSTOMER_PHOTO_SQL AS customer_photo_path
                FROM cib_conversations cv LEFT JOIN `$CUSTOMER_TABLE` c ON c.`$CUSTOMER_ID_COL` = cv.customer_id
                WHERE " . INQUIRY_ONLY . " $where $order";
        $st = $db->prepare($sql);
        $st->execute($args);
        $rows = $st->fetchAll();
    } catch (Throwable $e) {
        // customers table / columns not found: still show the conversations
        $st = $db->prepare("SELECT $base FROM cib_conversations cv WHERE " . INQUIRY_ONLY . " $where $order");
        $st->execute($args);
        $rows = $st->fetchAll();
    }
    $validSales = staffNamesForRole($db, 'Sales Staff');
    return array_map(function ($r) use ($db, $validSales) {
        $r['staff_name'] = pickStaffName($validSales, [$r['staff_name'] ?? '', $r['lead_staff_name'] ?? '']);
        $row = shapeRow($r, 'reference', 'INQ-', 'title', false);
        $row['last_message'] = str_replace('**', '', staffAcceptText($db, $row['inquiry_id'], (string)$row['subject'], (string)$row['reference'], (string)$row['last_message']));
        return $row;
    }, $rows);
}

/** Support tickets (alias t) with customer, last message, handling staff and unread count. */
function ticketQuery(AppDatabase $db, string $where, array $args): array {
    global $CUSTOMER_TABLE, $CUSTOMER_ID_COL, $CUSTOMER_NAME_SQL, $CUSTOMER_EMAIL_COL, $CUSTOMER_PHOTO_SQL;
    $base = "t.id, t.customer_id, t.ticket_number, t.subject, t.status, t.priority, t.created_at, t.updated_at,
        (SELECT m.message FROM cib_ticket_messages m WHERE m.ticket_id = t.id ORDER BY m.id DESC LIMIT 1) AS last_message,
        (SELECT m.attachments FROM cib_ticket_messages m WHERE m.ticket_id = t.id ORDER BY m.id DESC LIMIT 1) AS last_attachments,
        (SELECT m.sender_name FROM cib_ticket_messages m WHERE m.ticket_id = t.id AND m.sender_type = 'staff' ORDER BY m.id DESC LIMIT 1) AS staff_name,
        COALESCE((SELECT MAX(m.created_at) FROM cib_ticket_messages m WHERE m.ticket_id = t.id), t.updated_at) AS last_message_at,
        (SELECT COUNT(*) FROM cib_ticket_messages m WHERE m.ticket_id = t.id AND m.sender_type = 'customer'
            AND m.created_at > COALESCE(t.cs_read_at, '1970-01-01 00:00:00')) AS unread";
    $order = ' ORDER BY last_message_at DESC, t.id DESC';
    try {
        $sql = "SELECT $base, $CUSTOMER_NAME_SQL AS customer_name, c.`$CUSTOMER_EMAIL_COL` AS customer_email, $CUSTOMER_PHOTO_SQL AS customer_photo_path
                FROM cib_tickets t LEFT JOIN `$CUSTOMER_TABLE` c ON c.`$CUSTOMER_ID_COL` = t.customer_id $where $order";
        $st = $db->prepare($sql);
        $st->execute($args);
        $rows = $st->fetchAll();
    } catch (Throwable $e) {
        $st = $db->prepare("SELECT $base FROM cib_tickets t $where $order");
        $st->execute($args);
        $rows = $st->fetchAll();
    }
    $validCs = staffNamesForRole($db, 'Customer Service Staff');
    return array_map(function ($r) use ($validCs) {
        $r['staff_name'] = pickStaffName($validCs, [$r['staff_name'] ?? '']);
        return shapeRow($r, 'ticket_number', 'TCK-', 'subject', true);
    }, $rows);
}

function getConversation(AppDatabase $db, $id): array {
    $rows = conversationQuery($db, 'AND cv.id = ?', [(int)$id]);
    if (!$rows) fail('Conversation not found.', 404);
    return $rows[0];
}
function getTicket(AppDatabase $db, $id): array {
    $rows = ticketQuery($db, 'WHERE t.id = ?', [(int)$id]);
    if (!$rows) fail('Support ticket not found.', 404);
    return $rows[0];
}

function shapeMessage(array $m, string $customerName, string $staffFallback): array {
    $isStaff = $m['sender_type'] === 'staff';
    return [
        'id' => (int)$m['id'],
        'message' => $m['message'],
        'is_mine' => $isStaff,   // staff messages show on the right, like in the staff inboxes
        'sender_type' => $m['sender_type'],
        'sender_name' => $isStaff ? ($m['sender_name'] ?: $staffFallback) : $customerName,
        'attachments' => $m['attachments'] ? json_decode($m['attachments'], true) : [],
        'created_at' => str_replace(' ', 'T', $m['created_at']),
    ];
}

$action = $_GET['action'] ?? '';

/* ------------------------- 5. ACTIONS (all read-only) ------------------------- */
switch ($action) {

    case 'list_conversations':
        out(['success' => true, 'conversations' => conversationQuery($db, '', []), 'viewer_role' => $viewerRole]);

    case 'conversation_messages': {
        $conv = getConversation($db, $_GET['conversation_id'] ?? 0);
        $st = $db->prepare('SELECT * FROM cib_messages WHERE conversation_id = ? ORDER BY id ASC');
        $st->execute([$conv['id']]);
        $messages = array_map(function ($m) use ($conv, $db) {
            $s = shapeMessage($m, $conv['customer_name'], 'Sales Staff');
            if ($m['sender_type'] === 'customer') $s['message'] = staffAcceptText($db, $conv['inquiry_id'], (string)$conv['subject'], (string)$conv['reference'], (string)$s['message']);
            return $s;
        }, $st->fetchAll());
        // No "mark as read" here: Admin / Manager only watch.
        out(['success' => true, 'conversation' => $conv, 'messages' => $messages, 'viewer_role' => $viewerRole]);
    }

    case 'list_tickets':
        out(['success' => true, 'tickets' => ticketQuery($db, '', []), 'viewer_role' => $viewerRole]);

    case 'ticket_messages': {
        $ticket = getTicket($db, $_GET['ticket_id'] ?? 0);
        $st = $db->prepare('SELECT * FROM cib_ticket_messages WHERE ticket_id = ? ORDER BY id ASC');
        $st->execute([$ticket['id']]);
        $messages = array_map(function ($m) use ($ticket) { return shapeMessage($m, $ticket['customer_name'], 'Customer Service Staff'); }, $st->fetchAll());
        out(['success' => true, 'ticket' => $ticket, 'messages' => $messages, 'viewer_role' => $viewerRole]);
    }

    default:
        fail('Unknown action.', 400);
}
