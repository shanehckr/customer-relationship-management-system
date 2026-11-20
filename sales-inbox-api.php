<?php
/**
 * sales-inbox-api.php  (XAMPP / MySQL)   -   Sales Staff inbox
 *
 * Put this file in the SAME folder as customer-inbox-api.php.
 * It reads and writes the SAME conversation tables the customer inbox uses
 * (cib_conversations, cib_messages), so a message a customer sends in the "Messages" tab
 * shows up here, and a Sales Staff reply shows up in the customer's "Messages" tab.
 *
 * Only INQUIRY conversations are handled here. Support-ticket conversations (status "Support",
 * or linked from cib_tickets) belong to Customer Service Staff and are not shown here.
 * A conversation is created when a customer submits an inquiry and a staff member accepts it.
 *
 * Payment is now handled by PayMongo (xendit-api.php). The old receipt-upload / OCR /
 * confirm_payment flow has been removed. Booking creation happens automatically when PayMongo
 * confirms the deposit — no staff action required.
 *
 * Actions used by pages.js (crmInitSalesInbox):
 *   list_conversations, messages, send_message, payment_status
 */

/* ------------------------- 1. SETTINGS (edit these) ------------------------- */
$DB_HOST     = '127.0.0.1';
$DB_NAME     = 'catering_crm';
$DB_CATERING = 'catering_crm';   // leads table (same value as in inquiry-common.php)
$DB_USER     = 'root';
$DB_PASS     = '';

// Where the customer's name / email come from. Change to match your customers table.
$CUSTOMER_TABLE     = 'customers';
$CUSTOMER_ID_COL    = 'id';
$CUSTOMER_NAME_SQL  = "TRIM(CONCAT(c.first_name, ' ', c.last_name))";
$CUSTOMER_EMAIL_COL = 'email';

// Roles allowed to use this inbox (compared lower-case; underscores/dashes read as spaces).
$ALLOWED_ROLES     = ['sales staff', 'sales', 'admin', 'manager'];
$ROLE_SESSION_KEYS = ['role', 'user_role'];
$NAME_SESSION_KEYS = ['user_name', 'name', 'full_name'];

// TESTING ONLY: lets the page work when no staff is logged in. Set to false before going live.
$ALLOW_TEST_STAFF = true;

// Conversations with these statuses cannot be replied to.
$CLOSED_STATUSES_REGEX = '/closed|resolved|cancel/i';

$UPLOAD_DIR     = __DIR__ . '/uploads/inbox';
$UPLOAD_URL     = 'uploads/inbox';
$MAX_FILE_BYTES = 5 * 1024 * 1024;   // 5 MB per file
$ALLOWED_EXT    = ['jpg', 'jpeg', 'png', 'gif', 'webp', 'pdf', 'doc', 'docx', 'xls', 'xlsx'];
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
foreach ($ROLE_SESSION_KEYS as $k) { if (!empty($_SESSION[$k])) { $role = normRole($_SESSION[$k]); break; } }
if ($role !== '') {
    if (!in_array($role, array_map('normRole', $ALLOWED_ROLES), true)) fail('You do not have access to the sales inbox.', 403);
} elseif (!$ALLOW_TEST_STAFF) {
    fail('Please log in again.', 401);
}
$staffName = '';
foreach ($NAME_SESSION_KEYS as $k) { if (!empty($_SESSION[$k])) { $staffName = trim((string)$_SESSION[$k]); break; } }
if ($staffName === '') $staffName = 'Sales Staff';
$staffId = (int)($_SESSION['user_id'] ?? 0);

/* ------------------------- 3. DATABASE ------------------------- */
try {
    $db = new PDO("mysql:host=$DB_HOST;dbname=$DB_NAME;charset=utf8mb4", $DB_USER, $DB_PASS, [
        PDO::ATTR_ERRMODE    => PDO::ERRMODE_EXCEPTION,
        PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
    ]);
} catch (PDOException $e) {
    fail('Database connection failed. Check the settings at the top of sales-inbox-api.php. (' . $e->getMessage() . ')', 500);
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

// Ensure base tables exist (customer-inbox-api.php normally creates these first).
$db->exec("CREATE TABLE IF NOT EXISTS cib_conversations (
    id INT AUTO_INCREMENT PRIMARY KEY, customer_id INT NOT NULL, title VARCHAR(160) NOT NULL,
    reference VARCHAR(60) DEFAULT '', status VARCHAR(30) NOT NULL DEFAULT 'Active',
    created_at DATETIME NOT NULL, updated_at DATETIME NOT NULL, INDEX (customer_id)
) ENGINE=InnoDB");
$db->exec("CREATE TABLE IF NOT EXISTS cib_messages (
    id INT AUTO_INCREMENT PRIMARY KEY, conversation_id INT NOT NULL, sender_type VARCHAR(20) NOT NULL,
    sender_name VARCHAR(120) DEFAULT '', message TEXT, attachments TEXT,
    created_at DATETIME NOT NULL, INDEX (conversation_id)
) ENGINE=InnoDB");
$db->exec("CREATE TABLE IF NOT EXISTS cib_tickets (
    id INT AUTO_INCREMENT PRIMARY KEY, customer_id INT NOT NULL, ticket_number VARCHAR(30) DEFAULT '',
    subject VARCHAR(160) NOT NULL, status VARCHAR(30) NOT NULL DEFAULT 'Open',
    conversation_id INT DEFAULT NULL, created_at DATETIME NOT NULL, updated_at DATETIME NOT NULL,
    INDEX (customer_id)
) ENGINE=InnoDB");

function ensureColumn(PDO $db, string $table, string $column, string $definition): void {
    $st = $db->prepare("SHOW COLUMNS FROM `$table` LIKE ?");
    $st->execute([$column]);
    if (!$st->fetch()) $db->exec("ALTER TABLE `$table` ADD COLUMN `$column` $definition");
}
ensureColumn($db, 'cib_conversations', 'inquiry_id',    'INT NULL DEFAULT NULL');
ensureColumn($db, 'cib_conversations', 'sales_read_at', 'DATETIME NULL DEFAULT NULL');

require_once __DIR__ . '/bookings-schema.php';
ensureBookingsSchema($db);
require_once __DIR__ . '/quotations-schema.php';
ensureQuotationsSchema($db);
require_once __DIR__ . '/payments-schema.php';
ensurePaymentRequestsSchema($db);
require_once __DIR__ . '/notifications-helper.php';   // bell notifications (see notifications-api.php)


$pkRow  = $db->query("SHOW KEYS FROM `$DB_CATERING`.leads WHERE Key_name = 'PRIMARY'")->fetch();
$LEAD_PK = $pkRow['Column_name'] ?? 'lead_id';

/* ------------------------- 4. HELPERS ------------------------- */
/** A customer's profile photo as a web path (uploads/profile/...), or '' when they have none. Staff never have photos. */
function inboxPhotoUrl($rel): string {
    $rel = trim((string)$rel);
    if ($rel === '' || strpos($rel, 'uploads/profile/') !== 0) return '';
    $file = __DIR__ . '/' . $rel;
    return $rel . '?v=' . (is_file($file) ? (string)filemtime($file) : '1');
}

function now(): string { return date('Y-m-d H:i:s'); }

/** Inquiry conversations only: not Support tickets. */
const INQUIRY_ONLY = "cv.status <> 'Support' AND NOT EXISTS (SELECT 1 FROM cib_tickets tk WHERE tk.conversation_id = cv.id)";

/** Only conversations the logged-in staff member (or admin/manager) may see. */
function assignedOnly(): string {
    global $DB_CATERING, $staffId, $role, $LEAD_PK;
    $who = ($staffId > 0 && !in_array($role, ['admin', 'manager'], true)) ? '= ' . (int)$staffId : 'IS NOT NULL';
    return "EXISTS (SELECT 1 FROM `$DB_CATERING`.leads l WHERE l.`$LEAD_PK` = cv.inquiry_id AND l.assigned_staff_id $who)";
}

function conversationQuery(PDO $db, string $where, array $args): array {
    global $CUSTOMER_TABLE, $CUSTOMER_ID_COL, $CUSTOMER_NAME_SQL, $CUSTOMER_EMAIL_COL, $CUSTOMER_PHOTO_SQL;
    $base = "cv.id, cv.customer_id, cv.title, cv.reference, cv.status, cv.inquiry_id,
        cv.created_at, cv.updated_at,
        (SELECT m.message     FROM cib_messages m WHERE m.conversation_id = cv.id ORDER BY m.id DESC LIMIT 1) AS last_message,
        (SELECT m.attachments FROM cib_messages m WHERE m.conversation_id = cv.id ORDER BY m.id DESC LIMIT 1) AS last_attachments,
        COALESCE((SELECT MAX(m.created_at) FROM cib_messages m WHERE m.conversation_id = cv.id), cv.updated_at) AS last_message_at,
        (SELECT COUNT(*) FROM cib_messages m WHERE m.conversation_id = cv.id AND m.sender_type = 'customer'
            AND m.created_at > COALESCE(cv.sales_read_at, '1970-01-01 00:00:00')) AS unread";
    $order = ' ORDER BY last_message_at DESC, cv.id DESC';
    try {
        $sql = "SELECT $base, $CUSTOMER_NAME_SQL AS customer_name, c.`$CUSTOMER_EMAIL_COL` AS customer_email, $CUSTOMER_PHOTO_SQL AS customer_photo_path
                FROM cib_conversations cv LEFT JOIN `$CUSTOMER_TABLE` c ON c.`$CUSTOMER_ID_COL` = cv.customer_id
                WHERE " . INQUIRY_ONLY . " AND " . assignedOnly() . " $where $order";
        $st  = $db->prepare($sql);
        $st->execute($args);
        $rows = $st->fetchAll();
    } catch (PDOException $e) {
        $st = $db->prepare("SELECT $base FROM cib_conversations cv
                            WHERE " . INQUIRY_ONLY . " AND " . assignedOnly() . " $where $order");
        $st->execute($args);
        $rows = $st->fetchAll();
    }
    return array_map(function ($r) use ($db) {
        $name = trim((string)($r['customer_name'] ?? ''));
        $last = str_replace('**', '', staffAcceptText($db, $r['inquiry_id'], (string)$r['title'], (string)($r['reference'] ?: 'INQ-' . str_pad((string)$r['id'], 4, '0', STR_PAD_LEFT)), (string)$r['last_message']));
        if ($last === '' && !empty($r['last_attachments'])) $last = 'Sent an attachment';
        return [
            'id'              => (int)$r['id'],
            'customer_id'     => (int)$r['customer_id'],
            'inquiry_id'      => $r['inquiry_id'] !== null ? (int)$r['inquiry_id'] : null,
            'reference'       => $r['reference'] ?: 'INQ-' . str_pad((string)$r['id'], 4, '0', STR_PAD_LEFT),
            'subject'         => $r['title'],
            'status'          => $r['status'],
            'customer_name'   => $name !== '' ? $name : 'Customer #' . $r['customer_id'],
            'customer_email'  => (string)($r['customer_email'] ?? ''),
            'customer_photo'  => inboxPhotoUrl($r['customer_photo_path'] ?? ''),
            'last_message'    => $last,
            'last_message_at' => str_replace(' ', 'T', $r['last_message_at']),
            'created_at'      => str_replace(' ', 'T', $r['created_at']),
            'unread'          => (int)$r['unread'],
        ];
    }, $rows);
}

/**
 * Staff-side rewrite of customer quotation response messages (accept / decline / request changes).
 * Always uses the INQ reference and the event name so staff can find the inquiry directly.
 * **...** is shown in bold by pages.js.
 */
function staffAcceptText(PDO $db, $inquiryId, string $subject, string $reference, string $text): string {
    if (empty($inquiryId)) return $text;

    // Build the label: "Event Name (INQ-0000)"
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
        // Replace everything up to and including the bold event/ref label with our canonical label,
        // then keep the rest of the message (the requested changes text) unchanged.
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

function getConversation(PDO $db, $id): array {
    $rows = conversationQuery($db, 'AND cv.id = ?', [(int)$id]);
    if (!$rows) fail('Conversation not found.', 404);
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
            'name'      => basename($original),
            'url'       => $url . '/' . $safe,
            'size'      => (int)$_FILES['attachments']['size'][$i],
            'mime_type' => in_array($ext, ['jpg', 'jpeg', 'png', 'gif', 'webp'], true)
                            ? 'image/' . ($ext === 'jpg' ? 'jpeg' : $ext)
                            : 'application/' . $ext,
        ];
    }
    return $saved;
}

function shapeMessage(array $m, string $customerName): array {
    $isStaff = $m['sender_type'] === 'staff';
    return [
        'id'          => (int)$m['id'],
        'message'     => $m['message'],
        'is_mine'     => $isStaff,
        'sender_type' => $m['sender_type'],
        'sender_name' => $isStaff ? ($m['sender_name'] ?: 'Sales Staff') : $customerName,
        'attachments' => $m['attachments'] ? json_decode($m['attachments'], true) : [],
        'created_at'  => str_replace(' ', 'T', $m['created_at']),
    ];
}

/* ------------------------- 5. ACTIONS ------------------------- */
$action = $_GET['action'] ?? $_POST['action'] ?? '';
$isPost = $_SERVER['REQUEST_METHOD'] === 'POST';
$text   = trim((string)($_POST['message'] ?? ''));

switch ($action) {

    case 'list_conversations': {
        out(['success' => true, 'conversations' => conversationQuery($db, '', [])]);
    }

    case 'messages': {
        $conv = getConversation($db, $_GET['conversation_id'] ?? 0);
        $st   = $db->prepare('SELECT * FROM cib_messages WHERE conversation_id = ? ORDER BY id ASC');
        $st->execute([$conv['id']]);
        $rows  = $st->fetchAll();
        $qmap  = quotesForMessages($db, $rows);   // quotation cards embedded in chat messages
        $pmap  = paymentRequestsForMessages($db, $rows);   // payment-request cards embedded in chat messages
        $messages = array_map(function ($m) use ($conv, $qmap, $pmap, $db) {
            $s = shapeMessage($m, $conv['customer_name']);
            if ($m['sender_type'] === 'customer') $s['message'] = staffAcceptText($db, $conv['inquiry_id'], (string)$conv['subject'], (string)$conv['reference'], (string)$s['message']);
            if (!empty($m['quotation_id'])) $s['quotation'] = $qmap[(int)$m['quotation_id']] ?? null;
            if (!empty($m['payment_request_id'])) $s['payment_request'] = $pmap[(int)$m['payment_request_id']] ?? null;
            return $s;
        }, $rows);
        // Mark customer messages as read.
        $db->prepare('UPDATE cib_conversations SET sales_read_at = ? WHERE id = ?')->execute([now(), $conv['id']]);
        $conv['unread'] = 0;
        out(['success' => true, 'conversation' => $conv, 'messages' => $messages]);
    }

    case 'send_message': {
        if (!$isPost) fail('POST required.', 405);
        $conv  = getConversation($db, $_POST['conversation_id'] ?? 0);
        if (preg_match($CLOSED_STATUSES_REGEX, $conv['status'])) fail('This conversation is closed.');
        $files = saveUploads($UPLOAD_DIR, $UPLOAD_URL, $MAX_FILE_BYTES, $ALLOWED_EXT);
        if ($text === '' && !$files) fail('Type a reply or attach a file.');
        if (mb_strlen($text) > 5000) fail('Message is too long (max 5000 characters).');
        $db->prepare('INSERT INTO cib_messages (conversation_id, sender_type, sender_name, message, attachments, created_at) VALUES (?,?,?,?,?,?)')
           ->execute([$conv['id'], 'staff', $staffName, $text, $files ? json_encode($files) : null, now()]);
        $db->prepare('UPDATE cib_conversations SET updated_at = ?, sales_read_at = ? WHERE id = ?')->execute([now(), now(), $conv['id']]);
        // Bell: the customer (+ Admin / Manager) sees the new message.
        notifySend($db, [
            'type' => 'customer', 'kind' => 'message', 'ref' => (string)($conv['reference'] ?? ''),
            'title' => 'New message',
            'message' => $staffName . ' sent a message about ' . $conv['title'] . '.',
            'user_ids' => [(int)$conv['customer_id']],
            'exclude_user_id' => $staffId > 0 ? $staffId : null,
            'customer' => [
                'title' => 'New message from our team',
                'message' => $staffName . ' sent you a message about ' . $conv['title'] . '.',
            ],
        ]);
        out(['success' => true]);
    }

    /**
     * payment_status  GET ?action=payment_status&conversation_id=...
     * Returns the PayMongo payment record for the inquiry linked to this conversation,
     * plus the booking ref if one was created. Useful for staff to see if the deposit arrived.
     */
    case 'payment_status': {
        $conv = getConversation($db, $_GET['conversation_id'] ?? 0);
        if (empty($conv['inquiry_id'])) out(['success' => true, 'payment' => null]);

        // paymongo_payments table is created by xendit-api.php; it may not exist yet.
        try {
            $st = $db->prepare("SELECT p.*, b.booking_ref FROM paymongo_payments p
                                LEFT JOIN bookings b ON b.booking_id = p.booking_id
                                WHERE p.inquiry_id = ? ORDER BY p.id DESC LIMIT 1");
            $st->execute([$conv['inquiry_id']]);
            $row = $st->fetch();
        } catch (PDOException $e) {
            $row = null;   // paymongo_payments table does not exist yet
        }

        if (!$row) {
            out(['success' => true, 'payment' => null,
                 'note' => 'No payment attempt on record. The customer pays the deposit online via their My Inquiries page.']);
        }

        out(['success' => true, 'payment' => [
            'status'             => $row['status'],
            'amount'             => (float)$row['amount'],
            'method'             => (string)$row['method'],
            'payment_id'         => (string)$row['payment_id'],
            'checkout_session_id'=> (string)$row['checkout_session_id'],
            'booking_ref'        => (string)($row['booking_ref'] ?? ''),
            'paid_at'            => $row['paid_at'] ? str_replace(' ', 'T', $row['paid_at']) : null,
            'created_at'         => str_replace(' ', 'T', $row['created_at']),
        ]]);
    }

    default:
        fail('Unknown action.', 400);
}