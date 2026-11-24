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

/* ------------------------- 1. SETTINGS (edit these) ------------------------- */
$DB_NAME = 'catering_crm';

// Login establishes these canonical identity fields.

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
require_once __DIR__ . '/config/database.php';
    // Schema is installed from database/catering_crm.sql, never mutated in requests.
    // Schema is installed from database/catering_crm.sql, never mutated in requests.
    // Schema is installed from database/catering_crm.sql, never mutated in requests.
    // Schema is installed from database/catering_crm.sql, never mutated in requests.
require_once __DIR__ . '/quotations-schema.php';
ensureQuotationsSchema($db);
require_once __DIR__ . '/payments-schema.php';
ensurePaymentRequestsSchema($db);

/* ------------------------- 3. WHO IS LOGGED IN ------------------------- */
$customerId = (int)($_SESSION['user_id'] ?? 0);
$sessionRole = strtolower(trim((string)($_SESSION['role_name'] ?? '')));
if ($customerId < 1 || $sessionRole !== 'customer') fail('Please log in again.', 401);
$identity = $db->prepare("SELECT u.user_id FROM users u JOIN roles r ON r.role_id = u.role_id
                          WHERE u.user_id = ? AND u.account_status = 'Active' AND r.role_name = 'Customer' LIMIT 1");
$identity->execute([$customerId]);
if (!$identity->fetchColumn()) fail('Please log in again.', 401);
require_once __DIR__ . '/notifications-helper.php';   // bell notifications (see notifications-api.php)
require_once __DIR__ . '/booking-feedback.php';       // "please rate us" message + card after an event is completed

/* ------------------------- 4. HELPERS ------------------------- */
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

    default:
        fail('Unknown action.', 400);
}
