<?php
/**
 * customer-inbox-api.php  (XAMPP / MySQL)
 *
 * Put this file in the SAME folder as customer-inbox.html, e.g.
 *   C:\xampp\htdocs\customer-relationship-management-system\customer-inbox-api.php
 *
 * It creates its own tables on first run (cib_conversations, cib_messages,
 * cib_tickets, cib_ticket_messages), so you only need to set the 4 DB values below.
 *
 * Actions used by customerPages.js:
 *   list_conversations, messages, send_message,
 *   list_tickets, ticket_messages, reply_ticket, create_ticket, resolve_ticket
 */

/* ------------------------- 1. SETTINGS (edit these) ------------------------- */
$DB_HOST = '127.0.0.1';
$DB_NAME = 'catering_crm';          // <-- your database name in phpMyAdmin (create it if needed)
$DB_USER = 'root';         // XAMPP default
$DB_PASS = '';             // XAMPP default is empty

// Which session keys hold the logged-in customer's id (first one found is used).
$SESSION_KEYS = ['customer_id', 'user_id', 'id'];

// If nobody is logged in (testing only), use this customer id. Set to null to require login.
$TEST_CUSTOMER_ID = 1;

$UPLOAD_DIR = __DIR__ . '/uploads/inbox';   // saved files
$UPLOAD_URL = 'uploads/inbox';              // how the browser reaches them
$MAX_FILE_BYTES = 5 * 1024 * 1024;          // 5 MB each
$ALLOWED_EXT = ['jpg', 'jpeg', 'png', 'gif', 'webp', 'pdf', 'doc', 'docx', 'xls', 'xlsx'];
/* ---------------------------------------------------------------------------- */

date_default_timezone_set('Asia/Manila');   // so message times match your clock
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

/* ------------------------- 2. DATABASE ------------------------- */
try {
    $root = new PDO("mysql:host=$DB_HOST;charset=utf8mb4", $DB_USER, $DB_PASS, [PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION]);
    $root->exec("CREATE DATABASE IF NOT EXISTS `$DB_NAME` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci");
    $db = new PDO("mysql:host=$DB_HOST;dbname=$DB_NAME;charset=utf8mb4", $DB_USER, $DB_PASS, [
        PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
        PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
    ]);
} catch (PDOException $e) {
    fail('Database connection failed. Check the settings at the top of customer-inbox-api.php. (' . $e->getMessage() . ')', 500);
}

$db->exec("CREATE TABLE IF NOT EXISTS cib_conversations (
    id INT AUTO_INCREMENT PRIMARY KEY,
    customer_id INT NOT NULL,
    title VARCHAR(160) NOT NULL,
    reference VARCHAR(60) DEFAULT '',
    status VARCHAR(30) NOT NULL DEFAULT 'Active',
    created_at DATETIME NOT NULL,
    updated_at DATETIME NOT NULL,
    INDEX (customer_id)
) ENGINE=InnoDB");
$db->exec("CREATE TABLE IF NOT EXISTS cib_messages (
    id INT AUTO_INCREMENT PRIMARY KEY,
    conversation_id INT NOT NULL,
    sender_type VARCHAR(20) NOT NULL,
    sender_name VARCHAR(120) DEFAULT '',
    message TEXT,
    attachments TEXT,
    created_at DATETIME NOT NULL,
    INDEX (conversation_id)
) ENGINE=InnoDB");
$db->exec("CREATE TABLE IF NOT EXISTS cib_tickets (
    id INT AUTO_INCREMENT PRIMARY KEY,
    customer_id INT NOT NULL,
    ticket_number VARCHAR(30) DEFAULT '',
    subject VARCHAR(160) NOT NULL,
    status VARCHAR(30) NOT NULL DEFAULT 'Open',
    conversation_id INT DEFAULT NULL,
    created_at DATETIME NOT NULL,
    updated_at DATETIME NOT NULL,
    INDEX (customer_id)
) ENGINE=InnoDB");
$db->exec("CREATE TABLE IF NOT EXISTS cib_ticket_messages (
    id INT AUTO_INCREMENT PRIMARY KEY,
    ticket_id INT NOT NULL,
    sender_type VARCHAR(20) NOT NULL,
    sender_name VARCHAR(120) DEFAULT '',
    message TEXT,
    attachments TEXT,
    created_at DATETIME NOT NULL,
    INDEX (ticket_id)
) ENGINE=InnoDB");
require_once __DIR__ . '/quotations-schema.php';
ensureQuotationsSchema($db);
require_once __DIR__ . '/payments-schema.php';
ensurePaymentRequestsSchema($db);

/* ------------------------- 3. WHO IS LOGGED IN ------------------------- */
$customerId = null;
foreach ($SESSION_KEYS as $key) {
    if (!empty($_SESSION[$key])) { $customerId = (int)$_SESSION[$key]; break; }
}
if (!$customerId && $TEST_CUSTOMER_ID) $customerId = (int)$TEST_CUSTOMER_ID;
if (!$customerId) fail('Please log in again.', 401);
require_once __DIR__ . '/notifications-helper.php';   // bell notifications (see notifications-api.php)
require_once __DIR__ . '/booking-feedback.php';       // "please rate us" message + card after an event is completed

/* ------------------------- 4. HELPERS ------------------------- */
function now(): string { return date('Y-m-d H:i:s'); }

/* Audit trail shown on the staff Tickets page (also written by tickets-api.php and cs-inbox-api.php). */
$db->exec("CREATE TABLE IF NOT EXISTS cib_ticket_activity (
    id INT AUTO_INCREMENT PRIMARY KEY, ticket_id INT NOT NULL, action VARCHAR(255) NOT NULL,
    performed_by VARCHAR(120) NOT NULL DEFAULT '', performed_by_role VARCHAR(60) NOT NULL DEFAULT '',
    created_at DATETIME NOT NULL, INDEX (ticket_id)
) ENGINE=InnoDB");

/* Unread badges for the customer: when the customer last opened a conversation / ticket. */
function cibEnsureColumn(PDO $db, string $table, string $column, string $definition): bool {
    $st = $db->prepare("SHOW COLUMNS FROM `$table` LIKE ?");
    $st->execute([$column]);
    if ($st->fetch()) return false;
    $db->exec("ALTER TABLE `$table` ADD COLUMN `$column` $definition");
    return true;
}
foreach (['cib_conversations', 'cib_tickets'] as $cibTable) {
    // first time only: everything that already exists counts as read
    if (cibEnsureColumn($db, $cibTable, 'customer_read_at', 'DATETIME NULL DEFAULT NULL')) {
        $db->prepare("UPDATE `$cibTable` SET customer_read_at = ?")->execute([now()]);
    }
}

function ownConversation(PDO $db, int $customerId, $id): array {
    $st = $db->prepare('SELECT * FROM cib_conversations WHERE id = ? AND customer_id = ?');
    $st->execute([(int)$id, $customerId]);
    $row = $st->fetch();
    if (!$row) fail('Conversation not found.', 404);
    return $row;
}
function ownTicket(PDO $db, int $customerId, $id): array {
    $st = $db->prepare('SELECT * FROM cib_tickets WHERE id = ? AND customer_id = ?');
    $st->execute([(int)$id, $customerId]);
    $row = $st->fetch();
    if (!$row) fail('Support ticket not found.', 404);
    return $row;
}

/** Saves $_FILES['attachments'] and returns [{name,url,mime_type}, ...] */
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
            'mime_type' => in_array($ext, ['jpg', 'jpeg', 'png', 'gif', 'webp'], true) ? 'image/' . ($ext === 'jpg' ? 'jpeg' : $ext) : 'application/' . $ext,
        ];
    }
    return $saved;
}

/** Customers see the event name only: hide quotation codes like "(QT-0038 (v1))" that staff messages contain (staff still see them). */
function customerHideQuoteCode(string $text): string {
    $text = preg_replace('/\s*[\(\[]\s*QT-\d+(?:\s*[\(\[]\s*v\d+\s*[\)\]])?\s*[\)\]]/i', '', $text);
    return preg_replace('/\bQT-\d+\b/i', 'your quotation', (string)$text);
}

function shapeMessage(array $m): array {
    return [
        'id' => (int)$m['id'],
        'message' => customerHideQuoteCode((string)$m['message']),
        'is_mine' => $m['sender_type'] === 'customer',
        'sender_name' => $m['sender_type'] === 'customer' ? 'You' : ($m['sender_name'] ?: 'Catering team'),
        'attachments' => $m['attachments'] ? json_decode($m['attachments'], true) : [],
        'created_at' => str_replace(' ', 'T', $m['created_at']),
    ];
}

/** A quotation as the customer's chat card draws it (formatted text, grouped lines). */
function customerQuoteCard(array $q): array {
    $lines = array_map(fn($i) => [
        'name'   => $i['description'] . ((float)$i['quantity'] != 1.0 ? ' x ' . rtrim(rtrim(number_format((float)$i['quantity'], 2, '.', ''), '0'), '.') : ''),
        'amount' => quotePeso($i['amount']),
    ], $q['items']);
    return [
        'title'            => 'Quotation v' . $q['version'] . ' - ' . $q['status'],
        'reference'        => $q['reference'],
        'groups'           => [['title' => 'Menu and services', 'items' => $lines]],
        'subtotal'         => quotePeso($q['subtotal']),
        'total'            => quotePeso($q['total']),
        'required_deposit' => quotePeso($q['deposit_amount']) . ' (' . $q['deposit_rate'] . '%)',
        'valid_until'      => $q['validity'],
        'status'           => $q['status'],
    ];
}

$action = $_GET['action'] ?? $_POST['action'] ?? '';
$isPost = $_SERVER['REQUEST_METHOD'] === 'POST';
$text = trim((string)($_POST['message'] ?? ''));

/* ------------------------- 5. ACTIONS ------------------------- */
switch ($action) {

    case 'list_conversations': {
        try { completeFinishedBookings($db, $DB_NAME); } catch (Throwable $e) { error_log('customer-inbox-api: ' . $e->getMessage()); }   // thank-you / rate-us message
        // "Messages" shows INQUIRY conversations only. A conversation exists once the customer has submitted an
        // inquiry (see inbox-link.php). Support-ticket conversations belong to "My Concerns" / Customer Service Staff.
        $st = $db->prepare("SELECT c.id, c.title, c.reference, c.status, c.updated_at,
                (SELECT message FROM cib_messages m WHERE m.conversation_id = c.id ORDER BY m.id DESC LIMIT 1) AS last_message,
                (SELECT attachments FROM cib_messages m WHERE m.conversation_id = c.id ORDER BY m.id DESC LIMIT 1) AS last_attachments,
                (SELECT COUNT(*) FROM cib_messages m WHERE m.conversation_id = c.id AND m.sender_type <> 'customer'
                    AND m.created_at > COALESCE(c.customer_read_at, '1970-01-01 00:00:00')) AS unread
            FROM cib_conversations c WHERE c.customer_id = ?
              AND c.status <> 'Support' AND NOT EXISTS (SELECT 1 FROM cib_tickets tk WHERE tk.conversation_id = c.id)
            ORDER BY c.updated_at DESC, c.id DESC");
        $st->execute([$customerId]);
        $rows = array_map(function ($r) {
            if ((string)$r['last_message'] === '' && !empty($r['last_attachments'])) $r['last_message'] = 'Sent an attachment';
            unset($r['last_attachments']);
            $r['unread'] = (int)$r['unread'];
            $r['last_message'] = customerHideQuoteCode(str_replace('**', '', (string)$r['last_message']));   // list preview: no raw ** markers, no QT codes
            // Customers see the event name only: drop "(INQ-0017)" / "BK-0016" style reference codes.
            $r['title'] = trim(preg_replace('/\s*[\(\[]?\s*\b(?:INQ|BK)-[A-Za-z0-9-]+\s*[\)\]]?/i', '', (string)$r['title'])) ?: 'Conversation';
            $r['reference'] = '';
            return $r;
        }, $st->fetchAll());
        out(['success' => true, 'conversations' => $rows]);
    }

    case 'messages': {
        try { completeFinishedBookings($db, $DB_NAME); } catch (Throwable $e) { error_log('customer-inbox-api: ' . $e->getMessage()); }
        $conv = ownConversation($db, $customerId, $_GET['conversation_id'] ?? 0);
        $st = $db->prepare('SELECT * FROM cib_messages WHERE conversation_id = ? ORDER BY id ASC');
        $st->execute([$conv['id']]);
        $db->prepare('UPDATE cib_conversations SET customer_read_at = ? WHERE id = ?')->execute([now(), $conv['id']]);
        $rows = $st->fetchAll();
        $qmap = quotesForMessages($db, $rows, true);          // Draft versions are never shown to customers
        $pmap = paymentRequestsForMessages($db, $rows, true);   // "Pay Now" cards
        out(['success' => true, 'messages' => array_map(function ($m) use ($qmap, $pmap, $db) {
            $s = shapeMessage($m);
            if (!empty($m['payment_request_id']) && isset($pmap[(int)$m['payment_request_id']])) $s['payment_request'] = $pmap[(int)$m['payment_request_id']];
            if (!empty($m['feedback_booking_id']) && function_exists('feedbackRequestCard')) $s['feedback_request'] = feedbackRequestCard($db, (int)$m['feedback_booking_id']);   // "Rate Now" card
            if (!empty($m['quotation_id']) && isset($qmap[(int)$m['quotation_id']])) $s['quotation'] = customerQuoteCard($qmap[(int)$m['quotation_id']]);
            return $s;
        }, $rows)]);
    }

    case 'send_message': {
        if (!$isPost) fail('POST required.', 405);
        $conv = ownConversation($db, $customerId, $_POST['conversation_id'] ?? 0);
        $files = saveUploads($UPLOAD_DIR, $UPLOAD_URL, $MAX_FILE_BYTES, $ALLOWED_EXT);
        if ($text === '' && !$files) fail('Type a message or attach a file.');
        if (mb_strlen($text) > 5000) fail('Message is too long (max 5000 characters).');
        $db->prepare('INSERT INTO cib_messages (conversation_id, sender_type, sender_name, message, attachments, created_at) VALUES (?,?,?,?,?,?)')
           ->execute([$conv['id'], 'customer', 'You', $text, $files ? json_encode($files) : null, now()]);
        $newId = (int)$db->lastInsertId();
        $db->prepare('UPDATE cib_conversations SET updated_at = ?, customer_read_at = ? WHERE id = ?')->execute([now(), now(), $conv['id']]);
        // Bell: the Sales Staff handling this inquiry (+ Admin / Manager) sees the new message.
        $nfStaff = [];
        try {
            if (!empty($conv['inquiry_id'])) {
                $ls = $db->prepare('SELECT assigned_staff_id FROM leads WHERE lead_id = ?');
                $ls->execute([(int)$conv['inquiry_id']]);
                if ($sid = (int)$ls->fetchColumn()) $nfStaff[] = $sid;
            }
        } catch (Throwable $e) { error_log('notify: could not read the assigned staff: ' . $e->getMessage()); }
        notifySend($db, [
            'type' => 'customer', 'kind' => 'message', 'ref' => (string)($conv['reference'] ?? ''),
            'title' => 'New customer message',
            'message' => nfUserName($db, $customerId) . ' sent a message about ' . $conv['title'] . '.',
            'user_ids' => $nfStaff,
            'exclude_user_id' => $customerId,
        ]);
        out(['success' => true, 'message_id' => $newId]);
    }

    case 'list_tickets': {
        $st = $db->prepare("SELECT t.id, t.ticket_number, t.subject, t.status, t.conversation_id, t.created_at, t.updated_at,
                (SELECT message FROM cib_ticket_messages m WHERE m.ticket_id = t.id ORDER BY m.id DESC LIMIT 1) AS last_message,
                (SELECT attachments FROM cib_ticket_messages m WHERE m.ticket_id = t.id ORDER BY m.id DESC LIMIT 1) AS last_attachments,
                (SELECT COUNT(*) FROM cib_ticket_messages m WHERE m.ticket_id = t.id AND m.sender_type <> 'customer'
                    AND m.created_at > COALESCE(t.customer_read_at, '1970-01-01 00:00:00')) AS unread
            FROM cib_tickets t WHERE t.customer_id = ? ORDER BY t.updated_at DESC, t.id DESC");
        $st->execute([$customerId]);
        $rows = array_map(function ($r) {
            if ((string)$r['last_message'] === '' && !empty($r['last_attachments'])) $r['last_message'] = 'Sent an attachment';
            unset($r['last_attachments']);
            $r['unread'] = (int)$r['unread'];
            return $r;
        }, $st->fetchAll());
        out(['success' => true, 'tickets' => $rows]);
    }

    case 'ticket_messages': {
        $ticket = ownTicket($db, $customerId, $_GET['ticket_id'] ?? 0);
        $st = $db->prepare('SELECT * FROM cib_ticket_messages WHERE ticket_id = ? ORDER BY id ASC');
        $st->execute([$ticket['id']]);
        $db->prepare('UPDATE cib_tickets SET customer_read_at = ? WHERE id = ?')->execute([now(), $ticket['id']]);
        out(['success' => true, 'messages' => array_map('shapeMessage', $st->fetchAll())]);
    }

    case 'reply_ticket': {
        if (!$isPost) fail('POST required.', 405);
        $ticket = ownTicket($db, $customerId, $_POST['ticket_id'] ?? 0);
        if (preg_match('/resolved|closed/i', $ticket['status'])) fail('This ticket is already resolved.');
        $files = saveUploads($UPLOAD_DIR, $UPLOAD_URL, $MAX_FILE_BYTES, $ALLOWED_EXT);
        if ($text === '' && !$files) fail('Type a reply or attach a file.');
        $db->prepare('INSERT INTO cib_ticket_messages (ticket_id, sender_type, sender_name, message, attachments, created_at) VALUES (?,?,?,?,?,?)')
           ->execute([$ticket['id'], 'customer', 'You', $text, $files ? json_encode($files) : null, now()]);
        $db->prepare('UPDATE cib_tickets SET updated_at = ?, customer_read_at = ? WHERE id = ?')->execute([now(), now(), $ticket['id']]);
        notifyTicketStaff($db, $ticket, $customerId, 'New customer reply', 'replied on');
        out(['success' => true]);
    }

    case 'create_ticket': {
        if (!$isPost) fail('POST required.', 405);
        $subject = trim((string)($_POST['subject'] ?? ''));
        $description = trim((string)($_POST['description'] ?? ''));
        if ($subject === '' || $description === '') fail('Subject and concern details are required.');
        if (mb_strlen($subject) > 160) fail('Subject is too long (max 160 characters).');

        $db->beginTransaction();
        try {
            $db->prepare('INSERT INTO cib_conversations (customer_id, title, reference, status, created_at, updated_at) VALUES (?,?,?,?,?,?)')
               ->execute([$customerId, $subject, '', 'Support', now(), now()]);
            $conversationId = (int)$db->lastInsertId();
            $db->prepare('INSERT INTO cib_messages (conversation_id, sender_type, sender_name, message, created_at) VALUES (?,?,?,?,?)')
               ->execute([$conversationId, 'customer', 'You', $description, now()]);

            $db->prepare('INSERT INTO cib_tickets (customer_id, subject, status, conversation_id, created_at, updated_at) VALUES (?,?,?,?,?,?)')
               ->execute([$customerId, $subject, 'Open', $conversationId, now(), now()]);
            $ticketId = (int)$db->lastInsertId();
            $number = 'TCK-' . str_pad((string)$ticketId, 4, '0', STR_PAD_LEFT);
            $db->prepare('UPDATE cib_tickets SET ticket_number = ? WHERE id = ?')->execute([$number, $ticketId]);
                        $db->prepare('INSERT INTO cib_ticket_messages (ticket_id, sender_type, sender_name, message, created_at) VALUES (?,?,?,?,?)')
               ->execute([$ticketId, 'customer', 'You', $description, now()]);
            $db->commit();
        } catch (Throwable $e) {
            $db->rollBack();
            throw $e;
        }
        notifyTicketStaff($db, ['id' => $ticketId, 'ticket_number' => $number, 'subject' => $subject], $customerId, 'New support ticket', 'submitted');
        out(['success' => true, 'conversation_id' => $conversationId, 'ticket' => ['id' => $ticketId, 'ticket_number' => $number, 'subject' => $subject, 'status' => 'Open']]);
    }

    case 'resolve_ticket': {
        if (!$isPost) fail('POST required.', 405);
        $ticket = ownTicket($db, $customerId, $_POST['ticket_id'] ?? 0);
        $db->prepare("UPDATE cib_tickets SET status = 'Resolved', updated_at = ? WHERE id = ?")->execute([now(), $ticket['id']]);
        if ($ticket['status'] !== 'Resolved') {
            $db->prepare('INSERT INTO cib_ticket_activity (ticket_id, action, performed_by, performed_by_role, created_at) VALUES (?,?,?,?,?)')
               ->execute([$ticket['id'], 'Ticket marked as resolved by the customer', '', 'Customer', now()]);
            notifyTicketStaff($db, $ticket, $customerId, 'Ticket resolved by customer', 'marked as resolved');
        }
        out(['success' => true]);
    }

    case 'reopen_ticket': {
        if (!$isPost) fail('POST required.', 405);
        $ticket = ownTicket($db, $customerId, $_POST['ticket_id'] ?? 0);
        if (!preg_match('/resolved|closed/i', $ticket['status'])) fail('This ticket is not resolved.');
        $db->prepare("UPDATE cib_tickets SET status = 'Open', updated_at = ?, customer_read_at = ? WHERE id = ?")->execute([now(), now(), $ticket['id']]);
        $db->prepare('INSERT INTO cib_ticket_activity (ticket_id, action, performed_by, performed_by_role, created_at) VALUES (?,?,?,?,?)')
           ->execute([$ticket['id'], 'Ticket reopened by the customer', '', 'Customer', now()]);
        notifyTicketStaff($db, $ticket, $customerId, 'Ticket reopened', 'reopened');
        out(['success' => true]);
    }

    case 'seed_test_data': {
        // TEST ONLY: open  customer-inbox-api.php?action=seed_test_data  in the browser.
        // Replaces THIS customer's inbox data with examples. Delete this case before going live.
        $db->beginTransaction();
        try {
            $db->prepare('DELETE FROM cib_messages WHERE conversation_id IN (SELECT id FROM cib_conversations WHERE customer_id = ?)')->execute([$customerId]);
            $db->prepare('DELETE FROM cib_ticket_messages WHERE ticket_id IN (SELECT id FROM cib_tickets WHERE customer_id = ?)')->execute([$customerId]);
            $db->prepare('DELETE FROM cib_tickets WHERE customer_id = ?')->execute([$customerId]);
            $db->prepare('DELETE FROM cib_conversations WHERE customer_id = ?')->execute([$customerId]);

            $newConv = function (string $title, string $ref, string $status, string $at) use ($db, $customerId): int {
                $db->prepare('INSERT INTO cib_conversations (customer_id, title, reference, status, created_at, updated_at) VALUES (?,?,?,?,?,?)')
                   ->execute([$customerId, $title, $ref, $status, $at, $at]);
                return (int)$db->lastInsertId();
            };
            $addMsg = function (int $cid, string $who, string $msg, string $at) use ($db): void {
                $db->prepare('INSERT INTO cib_messages (conversation_id, sender_type, sender_name, message, created_at) VALUES (?,?,?,?,?)')
                   ->execute([$cid, $who, $who === 'customer' ? 'You' : 'Catering team', $msg, $at]);
                $db->prepare('UPDATE cib_conversations SET updated_at = ? WHERE id = ?')->execute([$at, $cid]);
            };

            $c1 = $newConv('Corporate Gala Dinner', 'INQ-2026-0419', 'Active', '2026-11-01 09:00:00');
            $addMsg($c1, 'staff',    'Hello! We reviewed your inquiry for the Corporate Gala Dinner.', '2026-11-01 09:00:00');
            $addMsg($c1, 'customer', 'Great, thank you. Can you do 80 guests with a plated menu?',      '2026-11-01 09:10:00');
            $addMsg($c1, 'staff',    'Yes, we can. We are preparing your quotation now.',               '2026-11-03 09:00:00');
            $addMsg($c1, 'staff',    'We sent your quotation. Please check your email.',                '2026-11-03 09:05:00');

            $c2 = $newConv('Wedding Reception', 'INQ-2026-0420', 'Active', '2026-10-28 14:00:00');
            $addMsg($c2, 'customer', 'Hi, we would like a quote for a wedding reception on Dec 20.',    '2026-10-28 14:00:00');
            $addMsg($c2, 'staff',    'Congratulations! How many guests are you expecting?',             '2026-10-29 10:00:00');
            $addMsg($c2, 'customer', 'About 120 guests. Thank you!',                                    '2026-10-30 15:30:00');

            $c3 = $newConv('Birthday Buffet', 'INQ-2026-0421', 'Active', '2026-10-20 10:00:00');
            $addMsg($c3, 'staff',    'Your birthday buffet is confirmed. See you on the day!',          '2026-10-21 11:00:00');

            // Ticket 1 (open) with its linked conversation, ticket 2 (resolved)
            $c4 = $newConv('Change event date', '', 'Support', '2026-11-02 08:00:00');
            $addMsg($c4, 'customer', 'I need to move my event to December 22.', '2026-11-02 08:00:00');

            $addTicket = function (string $subject, string $status, ?int $convId, string $at) use ($db, $customerId): int {
                $db->prepare('INSERT INTO cib_tickets (customer_id, subject, status, conversation_id, created_at, updated_at) VALUES (?,?,?,?,?,?)')
                   ->execute([$customerId, $subject, $status, $convId, $at, $at]);
                $id = (int)$db->lastInsertId();
                $db->prepare('UPDATE cib_tickets SET ticket_number = ? WHERE id = ?')->execute(['TCK-' . str_pad((string)$id, 4, '0', STR_PAD_LEFT), $id]);
                return $id;
            };
            $addTicketMsg = function (int $tid, string $who, string $msg, string $at) use ($db): void {
                $db->prepare('INSERT INTO cib_ticket_messages (ticket_id, sender_type, sender_name, message, created_at) VALUES (?,?,?,?,?)')
                   ->execute([$tid, $who, $who === 'customer' ? 'You' : 'Support team', $msg, $at]);
                $db->prepare('UPDATE cib_tickets SET updated_at = ? WHERE id = ?')->execute([$at, $tid]);
            };

            $t1 = $addTicket('Change event date', 'Open', $c4, '2026-11-02 08:00:00');
            $addTicketMsg($t1, 'customer', 'I need to move my event to December 22.',                '2026-11-02 08:00:00');
            $addTicketMsg($t1, 'staff',    'Thanks! We are checking availability for December 22.', '2026-11-03 08:00:00');

            $t2 = $addTicket('Invoice address wrong', 'Resolved', null, '2026-10-15 13:00:00');
            $addTicketMsg($t2, 'customer', 'The address on my invoice is wrong.',                   '2026-10-15 13:00:00');
            $addTicketMsg($t2, 'staff',    'Fixed and re-sent. Marking this as resolved.',          '2026-10-16 09:00:00');

            $db->commit();
        } catch (Throwable $e) {
            $db->rollBack();
            throw $e;
        }
        out(['success' => true, 'message' => 'Test data created for customer id ' . $customerId . '. Now open the Inbox page and refresh.']);
    }

    default:
        fail('Unknown action.', 400);
}