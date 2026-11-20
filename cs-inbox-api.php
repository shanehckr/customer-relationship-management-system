<?php
/**
 * cs-inbox-api.php  (XAMPP / MySQL)   -   Customer Service Staff inbox
 *
 * Put this file in the SAME folder as customer-inbox-api.php.
 * It reads and writes the SAME support-ticket tables the customer inbox uses
 * (cib_tickets, cib_ticket_messages), so a ticket a customer creates shows up here,
 * and a staff reply shows up in the customer's "My Concerns" tab.
 * Only SUPPORT TICKETS are handled here. Inquiry conversations (Sales Staff) are not touched.
 *
 * Actions used by pages.js (crmInitCsInbox):
 *   list_tickets, ticket_messages, reply_ticket
 */

/* ------------------------- 1. SETTINGS (edit these) ------------------------- */
$DB_HOST = '127.0.0.1';
$DB_NAME = 'catering_crm';
$DB_USER = 'root';
$DB_PASS = '';

// Where the customer's name / email come from. Change to match your customers table.
// If this lookup fails, the inbox still works and shows "Customer #id".
$CUSTOMER_TABLE    = 'customers';
$CUSTOMER_ID_COL   = 'id';
$CUSTOMER_NAME_SQL = "TRIM(CONCAT(c.first_name, ' ', c.last_name))";   // or "c.name" / "c.full_name"
$CUSTOMER_EMAIL_COL = 'email';

// Roles allowed to use this inbox (compared in lower case, "_" and "-" read as spaces).
$ALLOWED_ROLES = ['customer service', 'cs staff', 'customer service staff', 'admin', 'manager'];
$ROLE_SESSION_KEYS = ['role', 'user_role'];
$NAME_SESSION_KEYS = ['user_name', 'name', 'full_name'];

// TESTING ONLY: lets the page work when no staff is logged in (same idea as $TEST_CUSTOMER_ID
// in customer-inbox-api.php). Set to false before going live.
$ALLOW_TEST_STAFF = true;

$UPLOAD_DIR = __DIR__ . '/uploads/inbox';
$UPLOAD_URL = 'uploads/inbox';
$MAX_FILE_BYTES = 5 * 1024 * 1024;
$ALLOWED_EXT = ['jpg', 'jpeg', 'png', 'gif', 'webp', 'pdf', 'doc', 'docx', 'xls', 'xlsx'];
/* ---------------------------------------------------------------------------- */

require_once __DIR__ . '/notifications-helper.php';   // bell notifications (see notifications-api.php)

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
foreach ($ROLE_SESSION_KEYS as $k) { if (!empty($_SESSION[$k])) { $role = normRole($_SESSION[$k]); break; } }
if ($role !== '') {
    if (!in_array($role, array_map('normRole', $ALLOWED_ROLES), true)) fail('You do not have access to the support inbox.', 403);
} elseif (!$ALLOW_TEST_STAFF) {
    fail('Please log in again.', 401);
}
$staffName = '';
foreach ($NAME_SESSION_KEYS as $k) { if (!empty($_SESSION[$k])) { $staffName = trim((string)$_SESSION[$k]); break; } }
if ($staffName === '') $staffName = 'Customer Service Staff';

/* ------------------------- 3. DATABASE ------------------------- */
try {
    $db = new PDO("mysql:host=$DB_HOST;dbname=$DB_NAME;charset=utf8mb4", $DB_USER, $DB_PASS, [
        PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
        PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
    ]);
} catch (PDOException $e) {
    fail('Database connection failed. Check the settings at the top of cs-inbox-api.php. (' . $e->getMessage() . ')', 500);
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
} catch (PDOException $e) { error_log('inbox: could not read the users table: ' . $e->getMessage()); }

// The customer inbox creates these tables. Make sure they exist, then add the 2 columns this inbox needs.
$db->exec("CREATE TABLE IF NOT EXISTS cib_tickets (
    id INT AUTO_INCREMENT PRIMARY KEY, customer_id INT NOT NULL, ticket_number VARCHAR(30) DEFAULT '',
    subject VARCHAR(160) NOT NULL, status VARCHAR(30) NOT NULL DEFAULT 'Open', conversation_id INT DEFAULT NULL,
    created_at DATETIME NOT NULL, updated_at DATETIME NOT NULL, INDEX (customer_id)
) ENGINE=InnoDB");
$db->exec("CREATE TABLE IF NOT EXISTS cib_ticket_messages (
    id INT AUTO_INCREMENT PRIMARY KEY, ticket_id INT NOT NULL, sender_type VARCHAR(20) NOT NULL,
    sender_name VARCHAR(120) DEFAULT '', message TEXT, attachments TEXT, created_at DATETIME NOT NULL, INDEX (ticket_id)
) ENGINE=InnoDB");
function ensureColumn(PDO $db, string $table, string $column, string $definition): void {
    $st = $db->prepare("SHOW COLUMNS FROM `$table` LIKE ?");
    $st->execute([$column]);
    if (!$st->fetch()) $db->exec("ALTER TABLE `$table` ADD COLUMN `$column` $definition");
}
ensureColumn($db, 'cib_tickets', 'priority', "VARCHAR(20) NOT NULL DEFAULT 'Medium'");
ensureColumn($db, 'cib_tickets', 'cs_read_at', 'DATETIME NULL DEFAULT NULL');
$db->exec("CREATE TABLE IF NOT EXISTS cib_ticket_activity (
    id INT AUTO_INCREMENT PRIMARY KEY, ticket_id INT NOT NULL, action VARCHAR(255) NOT NULL,
    performed_by VARCHAR(120) NOT NULL DEFAULT '', performed_by_role VARCHAR(60) NOT NULL DEFAULT '',
    created_at DATETIME NOT NULL, INDEX (ticket_id)
) ENGINE=InnoDB");

/* ------------------------- 4. HELPERS ------------------------- */
/** A customer's profile photo as a web path (uploads/profile/...), or '' when they have none. Staff never have photos. */
function inboxPhotoUrl($rel): string {
    $rel = trim((string)$rel);
    if ($rel === '' || strpos($rel, 'uploads/profile/') !== 0) return '';
    $file = __DIR__ . '/' . $rel;
    return $rel . '?v=' . (is_file($file) ? (string)filemtime($file) : '1');
}

function now(): string { return date('Y-m-d H:i:s'); }

/** One ticket row with customer name / email, last message and unread count. */
function ticketQuery(PDO $db, string $where, array $args): array {
    global $CUSTOMER_TABLE, $CUSTOMER_ID_COL, $CUSTOMER_NAME_SQL, $CUSTOMER_EMAIL_COL, $CUSTOMER_PHOTO_SQL;
    $base = "t.id, t.customer_id, t.ticket_number, t.subject, t.status, t.priority, t.created_at, t.updated_at,
        (SELECT m.message FROM cib_ticket_messages m WHERE m.ticket_id = t.id ORDER BY m.id DESC LIMIT 1) AS last_message,
        (SELECT m.attachments FROM cib_ticket_messages m WHERE m.ticket_id = t.id ORDER BY m.id DESC LIMIT 1) AS last_attachments,
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
    } catch (PDOException $e) {
        // customers table / columns not found: still show the tickets
        $st = $db->prepare("SELECT $base FROM cib_tickets t $where $order");
        $st->execute($args);
        $rows = $st->fetchAll();
    }
    return array_map(function ($r) {
        $name = trim((string)($r['customer_name'] ?? ''));
        $last = (string)$r['last_message'];
        if ($last === '' && !empty($r['last_attachments'])) $last = 'Sent an attachment';
        return [
            'id' => (int)$r['id'],
            'customer_id' => (int)$r['customer_id'],
            'ticket_number' => $r['ticket_number'] ?: 'TCK-' . str_pad((string)$r['id'], 4, '0', STR_PAD_LEFT),
            'subject' => $r['subject'],
            'status' => $r['status'],
            'priority' => $r['priority'] ?: 'Medium',
            'customer_name' => $name !== '' ? $name : 'Customer #' . $r['customer_id'],
            'customer_email' => (string)($r['customer_email'] ?? ''),
            'customer_photo' => inboxPhotoUrl($r['customer_photo_path'] ?? ''),
            'last_message' => $last,
            'last_message_at' => str_replace(' ', 'T', $r['last_message_at']),
            'created_at' => str_replace(' ', 'T', $r['created_at']),
            'unread' => (int)$r['unread'],
        ];
    }, $rows);
}

function getTicket(PDO $db, $id): array {
    $rows = ticketQuery($db, 'WHERE t.id = ?', [(int)$id]);
    if (!$rows) fail('Support ticket not found.', 404);
    return $rows[0];
}

/** Saves $_FILES['attachments'] and returns [{name,url,mime_type,size}, ...] */
function saveUploads(string $dir, string $url, int $max, array $allowed): array {
    $saved = [];
    if (empty($_FILES['attachments']) || !is_array($_FILES['attachments']['name'])) return $saved;
    if (!is_dir($dir) && !mkdir($dir, 0775, true)) fail('Could not create the uploads folder.', 500);
    foreach ($_FILES['attachments']['name'] as $i => $original) {
        if ($_FILES['attachments']['error'][$i] === UPLOAD_ERR_NO_FILE) continue;
        if ($_FILES['attachments']['error'][$i] !== UPLOAD_ERR_OK) fail('A file could not be uploaded.');
        if ($_FILES['attachments']['size'][$i] > $max) fail('Each file must be 5 MB or smaller.');
        $ext = strtolower(pathinfo($original, PATHINFO_EXTENSION));
        if (!in_array($ext, $allowed, true)) fail('File type ".' . $ext . '" is not allowed.');
        $safe = bin2hex(random_bytes(8)) . '.' . $ext;
        if (!move_uploaded_file($_FILES['attachments']['tmp_name'][$i], $dir . '/' . $safe)) fail('Could not save the file.', 500);
        $saved[] = [
            'name' => basename($original),
            'url' => $url . '/' . $safe,
            'size' => (int)$_FILES['attachments']['size'][$i],
            'mime_type' => in_array($ext, ['jpg', 'jpeg', 'png', 'gif', 'webp'], true) ? 'image/' . ($ext === 'jpg' ? 'jpeg' : $ext) : 'application/' . $ext,
        ];
    }
    return $saved;
}

function shapeMessage(array $m, string $customerName): array {
    $isStaff = $m['sender_type'] === 'staff';
    return [
        'id' => (int)$m['id'],
        'message' => $m['message'],
        'is_mine' => $isStaff,
        'sender_type' => $m['sender_type'],
        'sender_name' => $isStaff ? ($m['sender_name'] ?: 'Customer Service Staff') : $customerName,
        'attachments' => $m['attachments'] ? json_decode($m['attachments'], true) : [],
        'created_at' => str_replace(' ', 'T', $m['created_at']),
    ];
}

$action = $_GET['action'] ?? $_POST['action'] ?? '';
$isPost = $_SERVER['REQUEST_METHOD'] === 'POST';
$text = trim((string)($_POST['message'] ?? ''));

/* ------------------------- 5. ACTIONS ------------------------- */
switch ($action) {

    case 'list_tickets': {
        out(['success' => true, 'tickets' => ticketQuery($db, '', [])]);
    }

    case 'ticket_messages': {
        $ticket = getTicket($db, $_GET['ticket_id'] ?? 0);
        $st = $db->prepare('SELECT * FROM cib_ticket_messages WHERE ticket_id = ? ORDER BY id ASC');
        $st->execute([$ticket['id']]);
        $messages = array_map(function ($m) use ($ticket) { return shapeMessage($m, $ticket['customer_name']); }, $st->fetchAll());
        // Opening the conversation marks the customer's messages as read.
        $db->prepare('UPDATE cib_tickets SET cs_read_at = ? WHERE id = ?')->execute([now(), $ticket['id']]);
        $ticket['unread'] = 0;
        out(['success' => true, 'ticket' => $ticket, 'messages' => $messages]);
    }

    case 'reply_ticket': {
        if (!$isPost) fail('POST required.', 405);
        $ticket = getTicket($db, $_POST['ticket_id'] ?? 0);
        if (preg_match('/resolved|closed/i', $ticket['status'])) fail('This ticket is already resolved.');
        $files = saveUploads($UPLOAD_DIR, $UPLOAD_URL, $MAX_FILE_BYTES, $ALLOWED_EXT);
        if ($text === '' && !$files) fail('Type a reply or attach a file.');
        if (mb_strlen($text) > 5000) fail('Message is too long (max 5000 characters).');
        $db->prepare('INSERT INTO cib_ticket_messages (ticket_id, sender_type, sender_name, message, attachments, created_at) VALUES (?,?,?,?,?,?)')
           ->execute([$ticket['id'], 'staff', $staffName, $text, $files ? json_encode($files) : null, now()]);
        // First staff reply moves a new ticket to In Progress; replying also counts as reading.
        $db->prepare("UPDATE cib_tickets SET updated_at = ?, cs_read_at = ?, status = IF(status = 'Open', 'In Progress', status) WHERE id = ?")
           ->execute([now(), now(), $ticket['id']]);
        if ($ticket['status'] === 'Open') {
            $db->prepare('INSERT INTO cib_ticket_activity (ticket_id, action, performed_by, performed_by_role, created_at) VALUES (?,?,?,?,?)')
               ->execute([$ticket['id'], 'Ticket status changed to In Progress', $staffName, 'CS Staff', now()]);
        }
        $nfRef = $ticket['ticket_number'];
        notifySend($db, [
            'type' => 'ticket',
            'title' => 'Support replied to a ticket',
            'message' => $staffName . ' replied to ' . $nfRef . ': ' . $ticket['subject'],
            'page' => 'manager-admin-ticket.html',
            'ref' => $nfRef,
            'user_ids' => [$ticket['customer_id']],
            'exclude_user_id' => $_SESSION['user_id'] ?? null,
            'by_role' => ['Customer' => [
                'title' => 'Support replied to your ticket',
                'message' => 'Customer Service replied to ' . $nfRef . ': ' . $ticket['subject'],
                'page' => 'customer-inbox.html',
            ]],
        ]);
        out(['success' => true]);
    }

    default:
        fail('Unknown action.', 400);
}