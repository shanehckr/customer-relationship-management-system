<?php
/**
 * customer-inbox-api.php  (XAMPP / MySQL)
 *
 * Put this file in the SAME folder as customer-inbox.html, e.g.
 *   C:\xampp\htdocs\customer-relationship-management-system\customer-inbox-api.php
 *
 * Database access and schema are provided centrally by config/database.php and
 * database/catering_crm.sql.
 *
 * Actions used by customerPages.js:
 *   list_conversations, messages, send_message,
 *   list_tickets, ticket_messages, reply_ticket, create_ticket, resolve_ticket
 */

/* 1. Settings */
$DB_NAME = 'catering_crm';

// Login establishes these canonical identity fields.

$UPLOAD_DIR = __DIR__ . '/uploads/inbox';   // saved files
$UPLOAD_URL = 'uploads/inbox';              // how the browser reaches them
$MAX_FILE_BYTES = 5 * 1024 * 1024;          // 5 MB each
$ALLOWED_EXT = ['jpg', 'jpeg', 'png', 'gif', 'webp', 'pdf', 'doc', 'docx', 'xls', 'xlsx'];

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
    error_log('customer-inbox-api: ' . get_class($e) . ' (' . (int)$e->getCode() . '): ' . $e->getMessage());
    fail('An unexpected database error occurred. Please try again later.', 500);
});

// Shared session setup: secure cookie settings + 30-minute inactivity timeout (replies 401 "session_expired" as JSON).
if (!defined('SESSION_API')) define('SESSION_API', true);
require_once __DIR__ . '/session-init.php';

/* 2. Database */
require_once __DIR__ . '/config/database.php';
require_once __DIR__ . '/includes/inbox-message-identity.php';
require_once __DIR__ . '/quotations-schema.php';
ensureQuotationsSchema($db);
require_once __DIR__ . '/payments-schema.php';
ensurePaymentRequestsSchema($db);

/* 3. Customer authentication */
$customerId = (int)($_SESSION['user_id'] ?? 0);
$sessionRole = strtolower(trim((string)($_SESSION['role_name'] ?? '')));
if ($customerId < 1 || $sessionRole !== 'customer') fail('Please log in again.', 401);
$identity = $db->prepare("SELECT u.user_id FROM users u JOIN roles r ON r.role_id = u.role_id
                          WHERE u.user_id = ? AND u.account_status = 'Active' AND r.role_name = 'Customer' LIMIT 1");
$identity->execute([$customerId]);
if (!$identity->fetchColumn()) fail('Please log in again.', 401);
$ticketSenderIdAvailable = ticketMessageSenderIdAvailable($db);
require_once __DIR__ . '/notifications-helper.php';   // bell notifications (see notifications-api.php)
require_once __DIR__ . '/booking-feedback.php';       // "please rate us" message + card after an event is completed
require_once __DIR__ . '/includes/Mail/EmailNotificationService.php';

/* 4. Helpers */
function now(): string { return date('Y-m-d H:i:s'); }

/* Audit trail shown on the staff Tickets page (also written by tickets-api.php and cs-inbox-api.php). */
    // Schema is installed from database/catering_crm.sql, never mutated in requests.

/* Unread badges for the customer: when the customer last opened a conversation / ticket. */
function cibEnsureColumn(AppDatabase $db, string $table, string $column, string $definition): bool {
    // Inbox columns are provisioned centrally from database/catering_crm.sql.
    return false;
}
foreach (['cib_conversations', 'cib_tickets'] as $cibTable) {
    // first time only: everything that already exists counts as read
    if (cibEnsureColumn($db, $cibTable, 'customer_read_at', 'DATETIME NULL DEFAULT NULL')) {
        $db->prepare("UPDATE `$cibTable` SET customer_read_at = ?")->execute([now()]);
    }
}

function ownConversation(AppDatabase $db, int $customerId, $id): array {
    $st = $db->prepare('SELECT * FROM cib_conversations WHERE id = ? AND customer_id = ?');
    $st->execute([(int)$id, $customerId]);
    $row = $st->fetch();
    if (!$row) fail('Conversation not found.', 404);
    return $row;
}
function ownTicket(AppDatabase $db, int $customerId, $id): array {
    $st = $db->prepare('SELECT * FROM cib_tickets WHERE id = ? AND customer_id = ?');
    $st->execute([(int)$id, $customerId]);
    $row = $st->fetch();
    if (!$row) fail('Support ticket not found.', 404);
    return $row;
}

function saveTicketAttachments(): array {
    if (empty($_FILES['attachments']) || !is_array($_FILES['attachments']['name'] ?? null)) return [];
    $files = $_FILES['attachments'];
    $indexes = [];
    foreach ($files['name'] as $i => $name) if ((string)$name !== '' && (int)($files['error'][$i] ?? UPLOAD_ERR_NO_FILE) !== UPLOAD_ERR_NO_FILE) $indexes[] = $i;
    if (count($indexes) > 4) fail('You can attach up to four files.');
    $finfo = new finfo(FILEINFO_MIME_TYPE);
    $rules = [
        'image/jpeg' => ['extensions' => ['jpg', 'jpeg'], 'size' => 25 * 1048576, 'kind' => 'IMAGE'],
        'image/png' => ['extensions' => ['png'], 'size' => 25 * 1048576, 'kind' => 'IMAGE'],
        'image/webp' => ['extensions' => ['webp'], 'size' => 25 * 1048576, 'kind' => 'IMAGE'],
        'video/mp4' => ['extensions' => ['mp4'], 'size' => 50 * 1048576, 'kind' => 'VIDEO'],
        'video/webm' => ['extensions' => ['webm'], 'size' => 50 * 1048576, 'kind' => 'VIDEO'],
    ];
    $valid = [];
    foreach ($indexes as $i) {
        $error = (int)$files['error'][$i];
        if ($error !== UPLOAD_ERR_OK) fail($error === UPLOAD_ERR_INI_SIZE || $error === UPLOAD_ERR_FORM_SIZE ? 'An attachment exceeds the server upload limit.' : 'An attachment could not be uploaded.');
        $tmp = (string)$files['tmp_name'][$i];
        $mime = $finfo->file($tmp) ?: '';
        $ext = strtolower(pathinfo((string)$files['name'][$i], PATHINFO_EXTENSION));
        if (!isset($rules[$mime]) || !in_array($ext, $rules[$mime]['extensions'], true)) fail('Only valid JPG, PNG, WebP, MP4, and WebM attachments are allowed.');
        $size = (int)$files['size'][$i];
        if ($size < 1 || $size > $rules[$mime]['size']) fail($rules[$mime]['kind'] === 'VIDEO' ? 'Each video must be 50 MB or smaller.' : 'Each image must be 25 MB or smaller.');
        if ($rules[$mime]['kind'] === 'IMAGE' && @getimagesize($tmp) === false) fail('An image attachment is invalid.');
        if ($mime === 'video/mp4') {
            $header = file_get_contents($tmp, false, null, 0, 12);
            if (!is_string($header) || substr($header, 4, 4) !== 'ftyp') fail('An MP4 attachment is invalid.');
        } elseif ($mime === 'video/webm') {
            $header = file_get_contents($tmp, false, null, 0, 4);
            if ($header !== "\x1A\x45\xDF\xA3") fail('A WebM attachment is invalid.');
        }
        $valid[] = ['tmp' => $tmp, 'name' => basename((string)$files['name'][$i]), 'mime_type' => $mime, 'media_type' => $rules[$mime]['kind'], 'size' => $size, 'ext' => $ext];
    }
    $dir = ticketAttachmentStorageDir();
    if (!is_dir($dir) && !mkdir($dir, 0750, true)) fail('Could not create the ticket attachment folder.', 500);
    $saved = [];
    foreach ($valid as $file) {
        $stored = bin2hex(random_bytes(16)) . '.' . $file['ext'];
        if (!move_uploaded_file($file['tmp'], $dir . '/' . $stored)) {
            foreach ($saved as $item) @unlink($dir . '/' . $item['stored_name']);
            fail('Could not save a ticket attachment.', 500);
        }
        $saved[] = ['name' => $file['name'], 'mime_type' => $file['mime_type'], 'media_type' => $file['media_type'], 'size' => $file['size'], 'stored_name' => $stored];
    }
    return $saved;
}

function ticketAttachmentStorageDir(): string {
    return dirname(__DIR__, 2) . DIRECTORY_SEPARATOR . 'crm-private' . DIRECTORY_SEPARATOR . 'ticket-attachments';
}

function ticketAttachmentView(array $attachments, int $ticketId): array {
    foreach ($attachments as &$file) {
        if (!empty($file['stored_name']) && preg_match('/\A[a-f0-9]{32}\.(?:jpg|jpeg|png|webp|mp4|webm)\z/i', (string)$file['stored_name'])) {
            $file['url'] = 'customer-inbox-api.php?action=ticket_attachment&ticket_id=' . $ticketId . '&file=' . rawurlencode($file['stored_name']);
        }
        unset($file['stored_name']);
    }
    unset($file);
    return $attachments;
}

function ticketPostMaxBytes(string $value): int {
    $value = trim($value);
    if ($value === '') return 0;
    $number = (float)$value;
    $unit = strtolower(substr($value, -1));
    if ($unit === 'g') $number *= 1024;
    if ($unit === 'g' || $unit === 'm') $number *= 1024;
    if ($unit === 'g' || $unit === 'm' || $unit === 'k') $number *= 1024;
    return (int)$number;
}

function serveCustomerTicketAttachment(AppDatabase $db, int $customerId): void {
    $ticket = ownTicket($db, $customerId, $_GET['ticket_id'] ?? 0);
    $file = (string)($_GET['file'] ?? '');
    if (!preg_match('/\A[a-f0-9]{32}\.(?:jpg|jpeg|png|webp|mp4|webm)\z/i', $file)) fail('Attachment not found.', 404);
    $st = $db->prepare('SELECT attachments FROM cib_ticket_messages WHERE ticket_id = ? AND sender_type = ? ORDER BY id ASC LIMIT 1');
    $st->execute([(int)$ticket['id'], 'customer']);
    $attachments = json_decode((string)$st->fetchColumn(), true) ?: [];
    $allowed = false; $mime = '';
    foreach ($attachments as $item) if (is_array($item) && hash_equals((string)($item['stored_name'] ?? ''), $file)) { $allowed = true; $mime = (string)($item['mime_type'] ?? ''); break; }
    $path = ticketAttachmentStorageDir() . DIRECTORY_SEPARATOR . $file;
    if (!$allowed || !in_array($mime, ['image/jpeg', 'image/png', 'image/webp', 'video/mp4', 'video/webm'], true) || !is_file($path)) fail('Attachment not found.', 404);
    header('Content-Type: ' . $mime); header('Content-Length: ' . (string)filesize($path)); header('X-Content-Type-Options: nosniff'); header('Content-Disposition: inline; filename="' . $file . '"'); header('Cache-Control: private, no-store');
    readfile($path); exit;
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
    $senderType = (string)($m['sender_type'] ?? 'staff');
    $senderName = trim((string)($m['sender_name'] ?? ''));
    // Payment gateway notices are stored as staff rows for compatibility; expose a display hint only.
    $isSystem = $senderType === 'system' || ($senderType === 'staff' && preg_match('/^(payments|payment system)$/i', $senderName) === 1);
    return [
        'id' => (int)$m['id'],
        'message' => customerHideQuoteCode((string)$m['message']),
        'is_mine' => $senderType === 'customer',
        'is_system' => $isSystem,
        'system_kind' => $isSystem ? ($senderType === 'system' ? 'system' : 'payment') : '',
        'sender_name' => $senderType === 'customer' ? 'You' : ($senderName ?: 'Catering team'),
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

/* 5. Actions */
switch ($action) {

    case 'list_conversations': {
        try { completeFinishedBookings($db, $DB_NAME); } catch (Throwable $e) { error_log('customer-inbox-api: ' . $e->getMessage()); }   // thank-you / rate-us message
        // "Messages" shows INQUIRY conversations only. A conversation exists once the customer has submitted an
        // inquiry (see inbox-link.php). Support-ticket conversations belong to "My Concerns" / Customer Service Staff.
        $st = $db->prepare("SELECT c.id, c.title, c.reference, c.status, c.updated_at,
                (SELECT message FROM cib_messages m WHERE m.conversation_id = c.id ORDER BY m.id DESC LIMIT 1) AS last_message,
                (SELECT sender_id FROM cib_messages m WHERE m.conversation_id = c.id ORDER BY m.id DESC LIMIT 1) AS last_sender_id,
                (SELECT attachments FROM cib_messages m WHERE m.conversation_id = c.id ORDER BY m.id DESC LIMIT 1) AS last_attachments,
                (SELECT COUNT(*) FROM cib_messages m WHERE m.conversation_id = c.id AND m.sender_type <> 'customer'
                    AND m.created_at > COALESCE(c.customer_read_at, '1970-01-01 00:00:00')) AS unread
            FROM cib_conversations c WHERE c.customer_id = ?
              AND c.status <> 'Support' AND NOT EXISTS (SELECT 1 FROM cib_tickets tk WHERE tk.conversation_id = c.id)
            ORDER BY c.updated_at DESC, c.id DESC");
        $st->execute([$customerId]);
        $rows = array_map(function ($r) use ($customerId) {
            if ((string)$r['last_message'] === '' && !empty($r['last_attachments'])) $r['last_message'] = 'Sent an attachment';
            $r['last_message_mine'] = $customerId > 0 && (int)($r['last_sender_id'] ?? 0) === $customerId;
            unset($r['last_sender_id']);
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
        $db->prepare('INSERT INTO cib_messages (conversation_id, sender_type, sender_name, sender_id, message, attachments, created_at) VALUES (?,?,?,?,?,?,?)')
           ->execute([$conv['id'], 'customer', 'You', $customerId, $text, $files ? json_encode($files) : null, now()]);
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
                " . ($ticketSenderIdAvailable
                    ? "(SELECT sender_id FROM cib_ticket_messages m WHERE m.ticket_id = t.id ORDER BY m.id DESC LIMIT 1)"
                    : "NULL") . " AS last_sender_id,
                (SELECT attachments FROM cib_ticket_messages m WHERE m.ticket_id = t.id ORDER BY m.id DESC LIMIT 1) AS last_attachments,
                (SELECT COUNT(*) FROM cib_ticket_messages m WHERE m.ticket_id = t.id AND m.sender_type <> 'customer'
                    AND m.created_at > COALESCE(t.customer_read_at, '1970-01-01 00:00:00')) AS unread
            FROM cib_tickets t WHERE t.customer_id = ? ORDER BY t.updated_at DESC, t.id DESC");
        $st->execute([$customerId]);
        $rows = array_map(function ($r) use ($customerId) {
            if ((string)$r['last_message'] === '' && !empty($r['last_attachments'])) $r['last_message'] = 'Sent an attachment';
            $r['last_message_mine'] = $customerId > 0 && (int)($r['last_sender_id'] ?? 0) === $customerId;
            unset($r['last_sender_id']);
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
        $messages = array_map('shapeMessage', $st->fetchAll());
        foreach ($messages as &$message) $message['attachments'] = ticketAttachmentView((array)($message['attachments'] ?? []), (int)$ticket['id']);
        unset($message);
        out(['success' => true, 'messages' => $messages]);
    }

    case 'ticket_attachment': {
        if (!$isPost && $_SERVER['REQUEST_METHOD'] === 'GET') serveCustomerTicketAttachment($db, $customerId);
        fail('GET required.', 405);
    }

    case 'reply_ticket': {
        if (!$isPost) fail('POST required.', 405);
        $ticket = ownTicket($db, $customerId, $_POST['ticket_id'] ?? 0);
        if (preg_match('/resolved|closed/i', $ticket['status'])) fail('This ticket is already resolved.');
        $files = saveUploads($UPLOAD_DIR, $UPLOAD_URL, $MAX_FILE_BYTES, $ALLOWED_EXT);
        if ($text === '' && !$files) fail('Type a reply or attach a file.');
        if ($ticketSenderIdAvailable) {
            $db->prepare('INSERT INTO cib_ticket_messages (ticket_id, sender_type, sender_name, sender_id, message, attachments, created_at) VALUES (?,?,?,?,?,?,?)')
               ->execute([$ticket['id'], 'customer', 'You', $customerId, $text, $files ? json_encode($files) : null, now()]);
        } else {
            $db->prepare('INSERT INTO cib_ticket_messages (ticket_id, sender_type, sender_name, message, attachments, created_at) VALUES (?,?,?,?,?,?)')
               ->execute([$ticket['id'], 'customer', 'You', $text, $files ? json_encode($files) : null, now()]);
        }
        $db->prepare('UPDATE cib_tickets SET updated_at = ?, customer_read_at = ? WHERE id = ?')->execute([now(), now(), $ticket['id']]);
        notifyTicketStaff($db, $ticket, $customerId, 'New customer reply', 'replied on');
        out(['success' => true]);
    }

    case 'create_ticket': {
        if (!$isPost) fail('POST required.', 405);
        $postLimit = ticketPostMaxBytes((string)ini_get('post_max_size'));
        if ($postLimit > 0 && (int)($_SERVER['CONTENT_LENGTH'] ?? 0) > $postLimit) fail('The attachments exceed the server request limit.', 413);
        $subject = trim((string)($_POST['subject'] ?? ''));
        $description = trim((string)($_POST['description'] ?? ''));
        if ($subject === '' || $description === '') fail('Subject and concern details are required.');
        if (mb_strlen($subject) > 160) fail('Subject is too long (max 160 characters).');

        $attachments = saveTicketAttachments();
        try {
            $db->beginTransaction();
            $db->prepare('INSERT INTO cib_conversations (customer_id, title, reference, status, created_at, updated_at) VALUES (?,?,?,?,?,?)')
               ->execute([$customerId, $subject, '', 'Support', now(), now()]);
            $conversationId = (int)$db->lastInsertId();
            $db->prepare('INSERT INTO cib_messages (conversation_id, sender_type, sender_name, sender_id, message, created_at) VALUES (?,?,?,?,?,?)')
               ->execute([$conversationId, 'customer', 'You', $customerId, $description, now()]);

            $db->prepare('INSERT INTO cib_tickets (customer_id, subject, status, conversation_id, created_at, updated_at) VALUES (?,?,?,?,?,?)')
               ->execute([$customerId, $subject, 'Open', $conversationId, now(), now()]);
            $ticketId = (int)$db->lastInsertId();
            $number = 'TCK-' . str_pad((string)$ticketId, 4, '0', STR_PAD_LEFT);
            $db->prepare('UPDATE cib_tickets SET ticket_number = ? WHERE id = ?')->execute([$number, $ticketId]);
            $attachmentJson = $attachments ? json_encode($attachments, JSON_UNESCAPED_SLASHES) : null;
            if ($ticketSenderIdAvailable) {
                $db->prepare('INSERT INTO cib_ticket_messages (ticket_id, sender_type, sender_name, sender_id, message, attachments, created_at) VALUES (?,?,?,?,?,?,?)')
                   ->execute([$ticketId, 'customer', 'You', $customerId, $description, $attachmentJson, now()]);
            } else {
                $db->prepare('INSERT INTO cib_ticket_messages (ticket_id, sender_type, sender_name, message, attachments, created_at) VALUES (?,?,?,?,?,?)')
                   ->execute([$ticketId, 'customer', 'You', $description, $attachmentJson, now()]);
            }
            $db->commit();
        } catch (Throwable $e) {
            if ($db->inTransaction()) $db->rollBack();
            foreach ($attachments as $item) @unlink(ticketAttachmentStorageDir() . DIRECTORY_SEPARATOR . $item['stored_name']);
            throw $e;
        }
        notifyTicketStaff($db, ['id' => $ticketId, 'ticket_number' => $number, 'subject' => $subject], $customerId, 'New support ticket', 'submitted');
        $recipient = EmailNotificationService::customerRecipient($db, $customerId);
        EmailNotificationService::queue(
            $db,
            $customerId,
            $recipient['email'],
            $recipient['name'],
            'support_ticket_received',
            'Support ticket received - ' . $number,
            [
                'heading' => 'Support Ticket Received',
                'greeting' => $recipient['name'],
                'message' => 'We received your support concern and will review it.',
                'rows' => [
                    'Ticket reference' => $number,
                    'Ticket subject' => $subject,
                    'Submission date' => date('F j, Y', strtotime(now())),
                    'Initial status' => 'Open',
                ],
                'button_text' => 'View My Concerns',
                'button_url' => EmailNotificationService::customerAppUrl($db, 'customer-inbox.html'),
            ],
            'support_ticket_received:' . $ticketId,
            'ticket',
            $ticketId
        );
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

    default:
        fail('Unknown action.', 400);
}
