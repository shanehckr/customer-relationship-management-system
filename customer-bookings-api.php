<?php
/**
 * customer-bookings-api.php - API for customer-bookings.html ("My Bookings").
 *
 * Reuses the DB connection + session + helpers from inquiry-common.php.
 * GET  ?action=list                     -> { success, bookings: [ { ... , payment: {...}, customer: {...}, feedback: {...}|null } ] }
 * GET  ?action=details&id=123           -> { success, booking: {...} }
 * POST ?action=feedback                 -> { success, feedback: {...} }
 *        fields: booking_id, rating (1-5), comments (max 1000), feedback_images[] (optional, up to 4 images, 25MB each)
 *
 * Safety: only bookings that belong to the logged-in customer are ever returned.
 */
// Shared session setup: secure cookie settings + 30-minute inactivity timeout (replies 401 "session_expired" as JSON).
define('SESSION_API', true);
require_once __DIR__ . '/session-init.php';

require __DIR__ . '/inquiry-common.php';
require __DIR__ . '/bookings-schema.php';
require_once __DIR__ . '/booking-feedback.php';   // the booking_feedback table (also read by the staff screens)
require_once __DIR__ . '/payments-schema.php';
require_once __DIR__ . '/notifications-helper.php';   // bell notifications (see notifications-api.php)
ensureBookingsSchema($db);
ensureBookingFeedbackSchema($db);

ensurePaymentRequestsSchema($db);

/* ---------- who is logged in ---------- */
$customerId = (int)($_SESSION['user_id'] ?? 0);
$sessionRole = strtolower(trim((string)($_SESSION['role_name'] ?? '')));
if ($customerId < 1 || $sessionRole !== 'customer') fail('Please log in again.', 401);
$identity = $db->prepare("SELECT u.user_id FROM users u JOIN roles r ON r.role_id = u.role_id
                          WHERE u.user_id = ? AND u.account_status = 'Active' AND r.role_name = 'Customer' LIMIT 1");
$identity->execute([$customerId]);
if (!$identity->fetchColumn()) fail('Please log in again.', 401);

/* Auto-complete and feedback-request processing runs only after customer identity is validated. */
try { completeFinishedBookings($db, $DB_CRM ?? ''); }
catch (Throwable $e) { error_log('customer-bookings-api: completeFinishedBookings failed: ' . $e->getMessage()); }

/* ---------- helpers ---------- */
function ownBooking(AppDatabase $db, int $customerId, $id): array {
    $st = $db->prepare('SELECT * FROM bookings WHERE booking_id = ? AND customer_id = ?');
    $st->execute([(int)$id, $customerId]);
    $row = $st->fetch();
    if (!$row) fail('Booking not found.', 404);
    return $row;
}

function money($v): float { return (float)($v ?? 0); }

function feedbackIniBytes(string $value): int {
    $value = trim($value);
    if ($value === '' || $value === '0') return 0;
    if (!preg_match('/^(\d+(?:\.\d+)?)\s*([KMG])?$/i', $value, $match)) return 0;
    $factor = strtoupper($match[2] ?? '') === 'G' ? 1073741824 : (strtoupper($match[2] ?? '') === 'M' ? 1048576 : (strtoupper($match[2] ?? '') === 'K' ? 1024 : 1));
    return (int)round((float)$match[1] * $factor);
}

/**
 * The booking row can be missing pax / arrangement (they were typed on the inquiry and never copied over).
 * Look them up on the linked inquiry so "Expected Guests" can show for Buffet with Set-up.
 */
function inquiryExtras(AppDatabase $db, array $b): array {
    global $DB_CATERING;
    $out = ['pax' => null, 'arrangement' => null];
    if (empty($b['inquiry_id'])) return $out;
    try {
        // the inquiry is the leads row: primary key lead_id, pax in expected_guests
        $st = $db->prepare("SELECT arrangement, expected_guests FROM `$DB_CATERING`.leads WHERE lead_id = ? LIMIT 1");
        $st->execute([(int)$b['inquiry_id']]);
        if ($q = $st->fetch()) {
            if ((int)($q['expected_guests'] ?? 0) > 0) $out['pax'] = (int)$q['expected_guests'];
            if (!empty($q['arrangement'])) $out['arrangement'] = (string)$q['arrangement'];
        }
    } catch (Throwable $e) { error_log('inquiryExtras: ' . $e->getMessage()); }
    return $out;
}

/**
 * The customer's own contact details (shown on the "Contact Person" card).
 * The customer's account is a row in the `users` table (no separate customers table), so look up
 * name / email / phone by customer_id. Column names are auto-detected like sales-inbox-api.php does.
 * If the account has no email/phone, fall back to what the customer typed on the inquiry (leads row).
 */
function customerContact(AppDatabase $db, array $b): array {
    global $DB_CATERING;
    $out = ['name' => trim((string)($b['customer_name'] ?? '')), 'email' => '', 'phone' => ''];

    $emailCands = ['email', 'email_address', 'contact_email'];
    $phoneCands = ['phone', 'phone_number', 'contact_number', 'contact_phone', 'contact_no', 'mobile', 'mobile_number', 'cellphone'];
    $pick = function (array $cols, array $cands) {
        foreach ($cands as $n) if (isset($cols[$n])) return $cols[$n];
        return null;
    };

    // 1) the customer's account in `users`
    try {
        if (!empty($b['customer_id'])) {
            $cols = [];
            foreach ($db->query("SHOW COLUMNS FROM `users`")->fetchAll() as $c) $cols[strtolower($c['Field'])] = $c['Field'];
            $key  = $db->query("SHOW KEYS FROM `users` WHERE Key_name = 'PRIMARY'")->fetch();
            $idCol = $key['Column_name'] ?? ($cols['user_id'] ?? ($cols['id'] ?? 'id'));

            $nameParts = [];
            if (isset($cols['first_name'], $cols['last_name']))
                $nameParts[] = "NULLIF(TRIM(CONCAT(`{$cols['first_name']}`, ' ', `{$cols['last_name']}`)), '')";
            foreach (['full_name', 'name', 'username'] as $n)
                if (isset($cols[$n])) $nameParts[] = "NULLIF(TRIM(`{$cols[$n]}`), '')";
            $nameSql  = $nameParts ? 'COALESCE(' . implode(', ', $nameParts) . ", '')" : "''";
            $emailCol = $pick($cols, $emailCands);
            $phoneCol = $pick($cols, $phoneCands);
            $emailSql = $emailCol ? "`$emailCol`" : "''";
            $phoneSql = $phoneCol ? "`$phoneCol`" : "''";

            $st = $db->prepare("SELECT $nameSql AS name, $emailSql AS email, $phoneSql AS phone FROM `users` WHERE `$idCol` = ? LIMIT 1");
            $st->execute([(int)$b['customer_id']]);
            if ($u = $st->fetch()) {
                if ($out['name'] === '' && trim((string)$u['name']) !== '') $out['name'] = trim((string)$u['name']);
                $out['email'] = trim((string)($u['email'] ?? ''));
                $out['phone'] = trim((string)($u['phone'] ?? ''));
            }
        }
    } catch (Throwable $e) { error_log('customerContact users: ' . $e->getMessage()); }

    // 2) fallback: what was typed on the inquiry form
    if (($out['email'] === '' || $out['phone'] === '') && !empty($b['inquiry_id'])) {
        try {
            $cols = [];
            foreach ($db->query("SHOW COLUMNS FROM `$DB_CATERING`.leads")->fetchAll() as $c) $cols[strtolower($c['Field'])] = $c['Field'];
            $pk = $db->query("SHOW KEYS FROM `$DB_CATERING`.leads WHERE Key_name = 'PRIMARY'")->fetch();
            $leadPk = $pk['Column_name'] ?? 'lead_id';
            $emailCol = $pick($cols, $emailCands);
            $phoneCol = $pick($cols, $phoneCands);
            if ($emailCol || $phoneCol) {
                $emailSql = $emailCol ? "`$emailCol`" : "''";
                $phoneSql = $phoneCol ? "`$phoneCol`" : "''";
                $st = $db->prepare("SELECT $emailSql AS email, $phoneSql AS phone FROM `$DB_CATERING`.leads WHERE `$leadPk` = ? LIMIT 1");
                $st->execute([(int)$b['inquiry_id']]);
                if ($q = $st->fetch()) {
                    if ($out['email'] === '') $out['email'] = trim((string)($q['email'] ?? ''));
                    if ($out['phone'] === '') $out['phone'] = trim((string)($q['phone'] ?? ''));
                }
            }
        } catch (Throwable $e) { error_log('customerContact leads: ' . $e->getMessage()); }
    }
    return $out;
}

/** One booking row -> everything the page might want, flat + nested. */
function bookingMenuItems(AppDatabase $db, int $bookingId): array {
    $st = $db->prepare('SELECT item_name_snapshot, serving_option_snapshot, quantity, unit_price, subtotal
                        FROM booking_items WHERE booking_id = ? ORDER BY booking_item_id ASC');
    $st->execute([$bookingId]);
    return array_map(static fn(array $item): array => [
        'name' => (string)$item['item_name_snapshot'],
        'serving_option' => (string)($item['serving_option_snapshot'] ?? ''),
        'quantity' => (float)$item['quantity'],
        'unit_price' => (float)$item['unit_price'],
        'subtotal' => (float)$item['subtotal'],
    ], $st->fetchAll(PDO::FETCH_ASSOC));
}

function bookingPaymentHistory(AppDatabase $db, int $bookingId): array {
    $st = $db->prepare("SELECT p.payment_type, p.payment_reference, p.amount, p.currency, p.payment_status,
                               p.paid_at, p.created_at, g.payment_method, g.gateway_transaction_id,
                               g.response_reference, g.gateway_status, g.completed_at
                        FROM payments p
                        LEFT JOIN gateway_transactions g ON g.transaction_id = (
                            SELECT g2.transaction_id FROM gateway_transactions g2
                            WHERE g2.payment_id = p.payment_id
                            ORDER BY COALESCE(g2.completed_at, g2.initiated_at, g2.created_at) DESC, g2.transaction_id DESC
                            LIMIT 1
                        )
                        WHERE p.booking_id = ?
                        ORDER BY COALESCE(g.completed_at, p.paid_at, p.created_at) DESC, p.payment_id DESC");
    $st->execute([$bookingId]);
    return array_map(static fn(array $payment): array => [
        'type' => (string)$payment['payment_type'],
        'reference' => (string)($payment['gateway_transaction_id'] ?: ($payment['response_reference'] ?: $payment['payment_reference'])),
        'amount' => (float)$payment['amount'],
        'currency' => (string)$payment['currency'],
        'status' => (string)$payment['payment_status'],
        'method' => (string)($payment['payment_method'] ?? ''),
        'paid_at' => $payment['completed_at'] ?: $payment['paid_at'],
        'created_at' => (string)$payment['created_at'],
    ], $st->fetchAll(PDO::FETCH_ASSOC));
}

function shapeBooking(AppDatabase $db, array $b): array {
    $extra = inquiryExtras($db, $b);
    if ((int)($b['expected_guests'] ?? 0) <= 0 && $extra['pax']) $b['expected_guests'] = $extra['pax'];
    if (empty($b['arrangement']) && $extra['arrangement']) $b['arrangement'] = $extra['arrangement'];

    $total   = money($b['quotation_amount']);
    $paid    = money($b['amount_paid']);
    $balance = isset($b['remaining_balance']) && $b['remaining_balance'] !== null
        ? money($b['remaining_balance'])
        : max(0, $total - $paid);
    $deposit = money($b['deposit_amount']);
    if ($deposit <= 0 && $total > 0) $deposit = round($total * 0.20, 2);
    $percent = $total > 0 ? (int)round($paid / $total * 100) : ($paid > 0 ? 100 : 0);

    // Include saved feedback and attachments.
    $fb = bookingFeedbackMap($db, [(int)$b['booking_id']])[(int)$b['booking_id']] ?? null;

    $dateLabel = '';
    if (!empty($b['event_date'])) {
        $d = new DateTime($b['event_date']);
        $dateLabel = $d->format('F j, Y');
        if (!empty($b['event_time'])) {
            $time = DateTime::createFromFormat('H:i:s', (string)$b['event_time']) ?: DateTime::createFromFormat('H:i', (string)$b['event_time']);
            $dateLabel .= ' · ' . ($time ? $time->format('g:i A') : (string)$b['event_time']);
        }
    }

    $prog = bookingProgress($b);
    unset($prog['next'], $prog['blocked']);   // customers only watch the progress; staff move it

    return [
        // ---- flat fields ----
        'booking_id'        => (int)$b['booking_id'],
        'booking_ref'       => $b['booking_ref'] ?: 'BK-' . str_pad((string)$b['booking_id'], 4, '0', STR_PAD_LEFT),
        'inquiry_id'        => $b['inquiry_id'] !== null ? (int)$b['inquiry_id'] : null,
        'customer_id'       => (int)$b['customer_id'],

        'event_title'       => $b['event_title'],
        'event_type'        => ($b['event_type'] ?? '') ?: $b['event_title'],
        'event_date'        => $b['event_date'],
        'event_time'        => $b['event_time'],
        'schedule'          => $dateLabel,
        'venue'             => $b['location'],
        'location'          => $b['location'],
        'arrangement'       => arrangementDisplay((string)$b['arrangement']),
        'package'           => $b['package'],
        'expected_guests'   => (int)$b['expected_guests'],
        'guests'            => (int)$b['expected_guests'],
        'pax'               => (int)$b['expected_guests'],
        'special_requests'  => (string)($b['special_requests'] ?? ''),
        'items'             => bookingMenuItems($db, (int)$b['booking_id']),
        'booking_status'    => $b['booking_status'],
        'status'            => $b['booking_status'],
        'assigned_staff'    => $b['assigned_staff'],
        'fulfillment_status' => (string)($b['fulfillment_status'] ?? ''),
        'progress'          => $prog,   // { kind, steps[], current, status, status_label, is_done } drawn by the My Bookings progress bar

        // ---- nested customer (Contact Person card) ----
        'customer' => customerContact($db, $b),

        // ---- nested payment (all fields the Payment tab needs) ----
        'payment' => [
            'total_amount'      => $total,
            'quotation_amount'  => $total,
            'amount_paid'       => $paid,
            'paid_amount'       => $paid,
            'remaining_balance' => $balance,
            'deposit_amount'    => $deposit,
            'payment_method'    => $b['payment_method'] ?? '',
            'payment_date'      => ($pd = ($b['payment_date'] ?? $b['paid_at'] ?? '')) ? str_replace(' ', 'T', $pd) : '',
            'payment_status'    => $b['payment_status'],
            'percent_paid'      => $percent,
        ],
        'payment_history' => bookingPaymentHistory($db, (int)$b['booking_id']),

        // Request Full Payment: the open request (with its Pay Now link) or the last paid one
        'payment_request' => paymentRequestsByBooking($db, [(int)$b['booking_id']], true)[(int)$b['booking_id']] ?? null,

        'feedback'    => $fb,
        'created_at'  => str_replace(' ', 'T', $b['created_at']),
    ];
}

/* Feedback attachments (four combined maximum). */
function saveFeedbackAttachments(int $limit = 4): array {
    $saved = [];
    if ($limit <= 0) return $saved;
    if (empty($_FILES['feedback_images']) || !is_array($_FILES['feedback_images']['name'])) return $saved;
    $dir = __DIR__ . '/uploads/feedback';
    $url = 'uploads/feedback';
    $limits = ['image/jpeg' => 25 * 1024 * 1024, 'image/png' => 25 * 1024 * 1024, 'image/webp' => 25 * 1024 * 1024,
               'video/mp4' => 50 * 1024 * 1024, 'video/webm' => 50 * 1024 * 1024];
    $extensions = ['image/jpeg' => 'jpg', 'image/png' => 'png', 'image/webp' => 'webp', 'video/mp4' => 'mp4', 'video/webm' => 'webm'];
    $names = array_values(array_filter($_FILES['feedback_images']['name'], static fn($name) => (string)$name !== ''));
    if (count($names) > $limit) fail('You can attach up to four photos or videos.');
    $finfo = new finfo(FILEINFO_MIME_TYPE);
    $validated = [];
    foreach ($_FILES['feedback_images']['name'] as $i => $original) {
        if ($_FILES['feedback_images']['error'][$i] === UPLOAD_ERR_NO_FILE) continue;
        $error = (int)$_FILES['feedback_images']['error'][$i];
        if ($error !== UPLOAD_ERR_OK) {
            if ($error === UPLOAD_ERR_INI_SIZE || $error === UPLOAD_ERR_FORM_SIZE) fail('The upload exceeds the server limit. Increase PHP upload_max_filesize and post_max_size to support the selected attachment.');
            fail('An attachment could not be uploaded.');
        }
        $tmp = $_FILES['feedback_images']['tmp_name'][$i];
        $mime = $finfo->file($tmp) ?: '';
        if (!isset($limits[$mime])) fail('Only JPG, PNG, WebP, MP4, or WebM attachments are allowed.');
        if ((int)$_FILES['feedback_images']['size'][$i] > $limits[$mime]) {
            $type = str_starts_with($mime, 'video/') ? 'video' : 'image';
            fail('Each ' . $type . ' must be ' . ($type === 'video' ? '50' : '25') . ' MB or smaller.');
        }
        $ext = strtolower(pathinfo($original, PATHINFO_EXTENSION));
        if (!in_array($ext, $mime === 'image/jpeg' ? ['jpg', 'jpeg'] : [$extensions[$mime]], true)) fail('The attachment extension does not match its file type.');
        $mediaType = str_starts_with($mime, 'video/') ? 'VIDEO' : 'IMAGE';
        $validated[] = ['original' => $original, 'tmp' => $tmp, 'mime' => $mime, 'ext' => $ext, 'media_type' => $mediaType, 'size' => (int)$_FILES['feedback_images']['size'][$i]];
    }
    if (!is_dir($dir) && !mkdir($dir, 0775, true)) fail('Could not create the feedback folder.', 500);
    foreach ($validated as $file) {
        $safe = bin2hex(random_bytes(8)) . '.' . $file['ext'];
        if (!move_uploaded_file($file['tmp'], $dir . '/' . $safe)) {
            foreach ($saved as $attachment) {
                $path = __DIR__ . '/' . ltrim((string)$attachment['url'], '/');
                if (is_file($path)) @unlink($path);
            }
            fail('Could not save the attachment.', 500);
        }
        $saved[] = [
            'name' => basename($file['original']),
            'url'  => $url . '/' . $safe,
            'size' => $file['size'],
            'mime_type' => $file['mime'],
            'media_type' => $file['media_type'],
        ];
    }
    return $saved;
}

/* ---------- actions ---------- */
$action = $_GET['action'] ?? $_POST['action'] ?? '';

switch ($action) {

    case 'list': {
        // Order: upcoming events first (not fully paid above fully paid, soonest date first),
        // then past events (most recent first). Bookings with no event date go last.
        $st = $db->prepare("SELECT * FROM bookings WHERE customer_id = ?
                            ORDER BY
                              (event_date IS NULL) ASC,
                              (event_date < CURDATE()) ASC,
                              CASE WHEN event_date >= CURDATE()
                                    AND COALESCE(remaining_balance, GREATEST(COALESCE(quotation_amount, 0) - amount_paid, 0)) > 0
                                   THEN 0 ELSE 1 END ASC,
                              CASE WHEN event_date >= CURDATE() THEN event_date END ASC,
                              CASE WHEN event_date < CURDATE() THEN event_date END DESC,
                              booking_id DESC");
        $st->execute([$customerId]);
        $rows = array_map(fn($b) => shapeBooking($db, $b), $st->fetchAll());
        out(['success' => true, 'bookings' => $rows]);
    }

    case 'details': {
        $b = ownBooking($db, $customerId, $_GET['id'] ?? 0);
        out(['success' => true, 'booking' => shapeBooking($db, $b)]);
    }

    case 'feedback':
    case 'submit_feedback': {   // customer-pages.js posts ?action=submit_feedback
        if ($_SERVER['REQUEST_METHOD'] !== 'POST') fail('POST required.', 405);
        $postLimit = feedbackIniBytes((string)ini_get('post_max_size'));
        if ($postLimit > 0 && (int)($_SERVER['CONTENT_LENGTH'] ?? 0) > $postLimit) {
            fail('The upload exceeds the server request limit. Increase PHP post_max_size to upload these attachments.', 413);
        }
        $b = ownBooking($db, $customerId, $_POST['booking_id'] ?? 0);

        // Feedback opens only after the event is finished (Completed).
        if (!preg_match('/completed/i', (string)$b['booking_status'])) fail('Feedback opens after your event is completed.', 409);

        $rating = (int)($_POST['rating'] ?? 0);
        if ($rating < 1 || $rating > 5) fail('Please select a rating from 1 to 5 stars.');
        $comments = trim((string)($_POST['comments'] ?? ''));
        if (mb_strlen($comments) > 1000) fail('Comments are too long (max 1000 characters).');

        // Keep feedback immutable; the unique booking constraint prevents concurrent duplicates.
        $existing = $db->prepare('SELECT feedback_id FROM booking_feedback WHERE booking_id = ? LIMIT 1');
        $existing->execute([(int)$b['booking_id']]);
        if ($existing->fetchColumn()) fail('Feedback has already been submitted for this booking.', 409);
        $attachments = saveFeedbackAttachments(4);

        $payload = [
            'booking_id'  => (int)$b['booking_id'],
            'customer_id' => $customerId,
            'rating'      => $rating,
            'comments'    => $comments,
            'images'      => json_encode($attachments),
            'created_at'  => now(),
        ];
        try {
            $db->beginTransaction();
            $db->prepare('INSERT INTO booking_feedback (booking_id, customer_id, rating, comments, images, created_at) VALUES (?,?,?,?,?,?)')
               ->execute([$payload['booking_id'], $customerId, $rating, $comments, $payload['images'], $payload['created_at']]);
            $feedbackId = (int)$db->lastInsertId();
            $attachmentInsert = $db->prepare('INSERT INTO feedback_attachments (feedback_id, media_type, file_path, original_name, mime_type, file_size) VALUES (?,?,?,?,?,?)');
            foreach ($attachments as $attachment) {
                $attachmentInsert->execute([$feedbackId, $attachment['media_type'], $attachment['url'], $attachment['name'], $attachment['mime_type'], $attachment['size']]);
            }
            $db->commit();
        } catch (Throwable $e) {
            if ($db->inTransaction()) $db->rollBack();
            foreach ($attachments as $attachment) {
                $path = __DIR__ . '/' . ltrim((string)$attachment['url'], '/');
                if (is_file($path)) @unlink($path);
            }
            $duplicate = ($e instanceof mysqli_sql_exception && (int)$e->getCode() === 1062)
                || (string)$e->getCode() === '23000'
                || stripos($e->getMessage(), 'duplicate entry') !== false;
            if ($duplicate) fail('Feedback has already been submitted for this booking.', 409);
            error_log('customer-bookings-api: feedback save failed: ' . $e->getMessage());
            fail('Could not save your feedback. Please try again.', 500);
        }

        // Bell: the Sales Staff of this booking (+ Admin / Manager) sees the new feedback.
        $nfEvent = trim((string)($b['event_title'] ?? '')) !== '' ? $b['event_title'] : 'an event';
        $nfRef = $b['booking_ref'] ?: 'BK-' . str_pad((string)$b['booking_id'], 4, '0', STR_PAD_LEFT);
        notifySend($db, [
            'type' => 'customer', 'kind' => 'booking', 'ref' => $nfRef,
            'title' => 'New customer feedback',
            'message' => nfUserName($db, $customerId) . ' rated ' . $nfEvent . ' (' . $nfRef . ') ' . $rating . '/5.',
            'user_ids' => !empty($b['assigned_staff_id']) ? [(int)$b['assigned_staff_id']] : [],
            'exclude_user_id' => $customerId,
        ]);
        out(['success' => true, 'feedback' => [
            'rating' => $rating,
            'comments' => $comments,
            'images' => $attachments,
            'attachments' => $attachments,
            'created_at' => str_replace(' ', 'T', $payload['created_at']),
        ]]);
    }

    default:
        fail('Unknown action.', 400);
}
