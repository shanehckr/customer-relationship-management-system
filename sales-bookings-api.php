<?php
/**
 * sales-bookings-api.php - Bookings list + "Request Full Payment" (pages.js crmInitManagerBookings contract).
 *   GET  ?action=list             -> { success, bookings: [ {booking_ref, customer_name, event_title, event_date, event_time, location,
 *                                     arrangement, expected_guests, quotation_amount, amount_paid, remaining_balance, payment_status,
 *                                     assigned_staff, booking_status,
 *                                     payment_request, can_request_payment, default_due_date} ] }
 *   POST ?action=request_payment  booking_id, due_date (optional, YYYY-MM-DD), note (optional)
 *                                 -> asks the customer to pay the FULL remaining balance: saves a payment request, posts a chat message
 *                                    with a "Pay Now" card in the customer's inbox, and shows it in My Bookings > Payment.
 *   POST ?action=cancel_request   request_id   -> cancels a Pending request (e.g. to send a new one)
 *   POST ?action=update_progress  booking_id, status -> Sales Staff moves the food / service progress one step forward (see bookingProgress() in bookings-schema.php)
 * Admin / Manager see every booking; Sales Staff see only the bookings of inquiries they handle.
 * Payment requests are for SALES STAFF only: Admin / Manager get no payment_request, can_request_payment = false,
 * and request_payment / cancel_request answer 403 for them (so the Payment Request card is not shown on their Bookings page).
 * Needs payments-schema.php in the same folder.
 */
// Shared session setup (30-minute timeout). bookings-api.php defines this first, so guard it.
if (!defined('SESSION_API')) define('SESSION_API', true);
require_once __DIR__ . '/session-init.php';

require __DIR__ . '/inquiry-common.php';
require __DIR__ . '/bookings-schema.php';
require __DIR__ . '/payments-schema.php';
if (!function_exists('quoteDeadlineCheck')) require_once __DIR__ . '/quotations-schema.php';   // quoteDeadlineCheck(): the same date + time rules as the quotation "valid until"
require_once __DIR__ . '/notifications-helper.php';   // bell notifications (see notifications-api.php)
require_once __DIR__ . '/booking-feedback.php';       // the customer's rating / comments / photos for each booking
try { completeFinishedBookings($db, $DB_CRM ?? ''); }   // Confirmed + past date + fully paid -> Completed, and the "please rate us" message
catch (Throwable $e) { error_log('sales-bookings-api: completeFinishedBookings failed: ' . $e->getMessage()); }

$uid = (int)sessionFirst(['user_id', 'id']);
if (!$uid) fail('Please log in again.', 401);
$role = normRole(sessionFirst(['role_name', 'role', 'user_role']));
$seeAll = str_contains($role, 'admin') || str_contains($role, 'manager');
if (!$seeAll && !str_contains($role, 'sales')) fail('You do not have access to bookings.', 403);
$staffName = sessionFirst(['user_name', 'name', 'full_name']) ?: 'Sales Staff';
$canRequestPayments = !$seeAll;      // Request Full Payment belongs to Sales Staff; Manager / Admin only view bookings
$canUpdateProgress = !$seeAll;       // so does the food / service progress (Preparing, Ready, Delivered...)

$action = $_GET['action'] ?? $_POST['action'] ?? '';
$isPost = $_SERVER['REQUEST_METHOD'] === 'POST';
try { ensureBookingsSchema($db); } catch (Throwable $e) { error_log('sales-bookings-api: bookings schema: ' . $e->getMessage()); }   // adds fulfillment_status when missing

/** A booking the logged-in person may act on (sales staff: only their own). */
function staffBooking(PDO $db, int $bookingId, int $uid, bool $seeAll, bool $lock = false): array {
    $sql = 'SELECT * FROM bookings WHERE booking_id = ?' . ($seeAll ? '' : ' AND assigned_staff_id = ?') . ($lock ? ' FOR UPDATE' : '');
    $st = $db->prepare($sql);
    $st->execute($seeAll ? [$bookingId] : [$bookingId, $uid]);
    $b = $st->fetch();
    if (!$b) fail('Booking not found.', 404);
    return $b;
}

if ($action === 'list') {
    $sql = "SELECT * FROM bookings" . ($seeAll ? '' : ' WHERE assigned_staff_id = ?') . " ORDER BY created_at DESC, booking_id DESC";
    $st = $db->prepare($sql);
    $st->execute($seeAll ? [] : [$uid]);
    $bookings = $st->fetchAll();

    // The inquiry behind each booking gives the guest count (PAX), the assignment date and the customer's email / phone
    // (same enrichLeads() the Inquiries pages use: email + phone come from the customer's users row).
    $leads = [];
    $ids = array_values(array_unique(array_filter(array_map(fn($b) => (int)($b['inquiry_id'] ?? 0), $bookings))));
    if ($ids) {
        $in = implode(',', $ids);
        $leadRows = $db->query("SELECT * FROM leads WHERE `$LEAD_PK` IN ($in)")->fetchAll();
        foreach (enrichLeads($db, $DB_CRM, $leadRows) as $l) $leads[(int)$l['lead_id']] = $l;
    }
    // Assigned staff profile photo (users.photo_path; '' = the page shows initials)
    $staffPhotos = [];
    $sids = array_values(array_unique(array_filter(array_map(fn($b) => (int)($b['assigned_staff_id'] ?? 0), $bookings))));
    if ($sids) {
        try {
            $upk = usersPk($db, $DB_CRM);
            $su = $db->prepare("SELECT * FROM `$DB_CRM`.users WHERE `$upk` IN (" . implode(',', array_fill(0, count($sids), '?')) . ')');
            $su->execute($sids);
            foreach ($su->fetchAll() as $u) $staffPhotos[(int)$u[$upk]] = customerPhotoUrl($u);
        } catch (PDOException $e) { error_log('sales-bookings-api: staff photo lookup failed: ' . $e->getMessage()); }
    }
    $requests = $canRequestPayments ? paymentRequestsByBooking($db, array_map(fn($b) => (int)$b['booking_id'], $bookings)) : [];

    $rows = array_map(function ($b) use ($leads, $requests, $canRequestPayments, $canUpdateProgress, $staffPhotos) {
        $lead = $leads[(int)($b['inquiry_id'] ?? 0)] ?? [];
        $guests = $b['expected_guests'];
        if ($guests === null || trim((string)$guests) === '') $guests = $lead['expected_guests'] ?? '';
        $ref = $b['booking_ref'] ?: 'BK-' . str_pad((string)$b['booking_id'], 4, '0', STR_PAD_LEFT);
        $req = $requests[(int)$b['booking_id']] ?? null;
        $balance = bookingBalanceDue($b);
        $canRequest = $canRequestPayments && $balance > 0 && ($req['status'] ?? '') !== 'Pending';   // a Paid request with balance left (e.g. a part payment) can be followed up
        if (preg_match('/cancel/i', (string)$b['booking_status']) || empty($b['customer_id'])) $canRequest = false;
        $prog = bookingProgress($b);
        if (!$canUpdateProgress) { $prog['next'] = null; $prog['blocked'] = ''; }   // Admin / Manager only watch the progress
        return [
            'booking_id' => (int)$b['booking_id'],
            'booking_ref' => $ref,
            'booking_label' => (trim((string)($b['event_title'] ?? '')) !== '' ? trim((string)$b['event_title']) . ' (' . $ref . ')' : $ref),
            'inquiry_id' => $b['inquiry_id'] !== null ? (int)$b['inquiry_id'] : null,
            'customer_name' => $b['customer_name'], 'event_title' => $b['event_title'],
            'customer_phone' => $lead['customer_phone'] ?? '', 'customer_email' => $lead['customer_email'] ?? '',
            'customer_photo' => $lead['customer_photo'] ?? '',
            'event_date' => $b['event_date'], 'event_time' => $b['event_time'],
            'location' => $b['location'], 'arrangement' => $b['arrangement'], 'package' => $b['package'],
            'expected_guests' => $guests, 'quotation_amount' => $b['quotation_amount'],
            'amount_paid' => $b['amount_paid'], 'remaining_balance' => $b['remaining_balance'],
            'payment_status' => $b['payment_status'], 'payment_method' => $b['payment_method'],
            'assigned_staff' => $b['assigned_staff'], 'staff_photo' => $staffPhotos[(int)($b['assigned_staff_id'] ?? 0)] ?? '', 'assigned_at' => $lead['claimed_at'] ?? null,
            'booking_status' => $b['booking_status'],
            // Food / service progress (updated by the assigned Sales Staff)
            'fulfillment_status' => (string)($b['fulfillment_status'] ?? ''),
            'progress' => $prog,
            'can_update_progress' => $prog['next'] !== null && $prog['blocked'] === '',
            // Request Full Payment
            'balance_due' => $balance,
            'payment_request' => $req,
            'can_request_payment' => $canRequest,
            'default_due_date' => paymentRequestDefaultDue($b['event_date'] ?: null),
        ];
    }, $bookings);
    attachBookingFeedback($db, $rows);   // each booking gets  'feedback' => { rating, comments, images, created_at } | null
    out(['success' => true, 'bookings' => $rows]);
}

if ($action === 'request_payment') {
    if (!$isPost) fail('POST required.', 405);
    if (!$canRequestPayments) fail('Only Sales Staff can request a payment.', 403);
    $bookingId = (int)($_POST['booking_id'] ?? 0);
    $note = trim((string)($_POST['note'] ?? ''));
    if (mb_strlen($note) > 300) fail('The note is too long (max 300 characters).');
    $dueIn = trim((string)($_POST['due_date'] ?? ''));
    $dueTimeIn = trim((string)($_POST['due_time'] ?? ''));
    // makes sure payment_requests (and its due_time column) exist; done before the transaction because ALTER TABLE commits implicitly
    try { ensurePaymentRequestsSchema($db); } catch (Throwable $e) { error_log('sales-bookings-api: payment_requests schema: ' . $e->getMessage()); }

    $bail = function (string $m, int $code = 400) use ($db) { if ($db->inTransaction()) $db->rollBack(); fail($m, $code); };
    $db->beginTransaction();
    try {
        $b = staffBooking($db, $bookingId, $uid, $seeAll, true);          // locks the row: two staff cannot request twice
        if (preg_match('/cancel/i', (string)$b['booking_status'])) $bail('This booking is cancelled.', 409);
        if (empty($b['customer_id'])) $bail('This booking has no customer account to send the request to.', 409);
        $balance = bookingBalanceDue($b);
        if ($balance <= 0) $bail('This booking is already fully paid.', 409);
        $pend = $db->prepare("SELECT id FROM payment_requests WHERE booking_id = ? AND status = 'Pending' LIMIT 1");
        $pend->execute([$bookingId]);
        if ($pend->fetch()) $bail('A payment request is already waiting for the customer. Cancel it first if you need to send a new one.', 409);

        $eventDate = $b['event_date'] ?: null;
        $due = $dueIn !== '' ? $dueIn : paymentRequestDefaultDue($eventDate);
        $d = DateTime::createFromFormat('Y-m-d', $due);
        if (!$d || $d->format('Y-m-d') !== $due) $bail('Choose a valid due date.');
        if ($due < date('Y-m-d')) $bail('The due date cannot be in the past.');
        if ($eventDate && $eventDate >= date('Y-m-d') && $due > $eventDate) $bail('The due date must be on or before the event date.');
        $maxDue = paymentRequestMaxDue($eventDate);
        if ($maxDue !== '' && $due > $maxDue) $bail('The full payment must be due at least ' . PAY_REQUEST_DAYS_BEFORE_EVENT . ' day before the event. Choose ' . quoteDay($maxDue) . ' or earlier.');
        $dueTime  = quoteDeadlineCheck($due, $dueTimeIn, 'payment deadline', (string)$eventDate);   // "HH:MM:SS"; today = at least 1 hour from now, on the hour / half hour
        $dueLabel = deadlineLabel($due, $dueTime);                              // "Nov 20, 2026, 2:00 PM"

        $db->prepare("INSERT INTO payment_requests (booking_id, inquiry_id, customer_id, amount, due_date, due_time, note, status, requested_by, requested_by_id, requested_at)
                      VALUES (?,?,?,?,?,?,?,?,?,?,?)")
           ->execute([$bookingId, $b['inquiry_id'], $b['customer_id'], $balance, $due, $dueTime, $note !== '' ? $note : null, 'Pending', $staffName, $uid, now()]);
        $reqId = (int)$db->lastInsertId();

        // chat message with the Pay Now card (same idea as the quotation card)
        $chatPosted = false;
        if (!empty($b['inquiry_id'])) {
            $cv = $db->prepare("SELECT id FROM `$DB_CRM`.cib_conversations WHERE inquiry_id = ? LIMIT 1");
            $cv->execute([$b['inquiry_id']]);
            if ($conv = $cv->fetch()) {
                $ev = trim((string)($b['event_title'] ?? ''));
                $text = 'Hi! Please settle the remaining balance of **' . quotePeso($balance) . '** for **' . ($ev !== '' ? $ev : 'your event')
                      . '** on or before **' . $dueLabel . '**. Tap Pay Now below to pay online (GCash or Maya).'
                      . ($note !== '' ? ' Note from our team: ' . $note : '');
                $db->prepare("INSERT INTO `$DB_CRM`.cib_messages (conversation_id, sender_type, sender_name, message, attachments, created_at, payment_request_id) VALUES (?,?,?,?,NULL,?,?)")
                   ->execute([$conv['id'], 'staff', $staffName, $text, now(), $reqId]);
                $db->prepare("UPDATE `$DB_CRM`.cib_conversations SET updated_at = ?, sales_read_at = ? WHERE id = ?")->execute([now(), now(), $conv['id']]);
                $chatPosted = true;
            }
        }
        $db->commit();
    } catch (Throwable $e) {
        if ($db->inTransaction()) $db->rollBack();
        throw $e;
    }
    // Bell: the customer is asked to pay (+ Admin / Manager see it).
    $nfEvent = trim((string)($b['event_title'] ?? '')) !== '' ? $b['event_title'] : 'the event';
    $nfRef = $b['booking_ref'] ?: 'BK-' . str_pad((string)$b['booking_id'], 4, '0', STR_PAD_LEFT);
    notifySend($db, [
        'type' => 'deal', 'kind' => 'booking', 'ref' => $nfRef,
        'title' => 'Payment requested',
        'message' => $staffName . ' requested ' . quotePeso($balance) . ' for ' . $nfEvent . ' (' . $nfRef . '), due ' . $dueLabel . '.',
        'user_ids' => [(int)$b['customer_id']],
        'exclude_user_id' => $uid,
        'customer' => [
            'title' => 'Payment requested',
            'message' => 'Please pay the remaining ' . quotePeso($balance) . ' for ' . $nfEvent . ' on or before ' . $dueLabel . '.',
        ],
    ]);
    $st = $db->prepare(paymentRequestSelect() . ' WHERE pr.id = ?');
    $st->execute([$reqId]);
    out(['success' => true, 'payment_request' => paymentRequestShape($st->fetch()), 'chat_posted' => $chatPosted]);
}

if ($action === 'cancel_request') {
    if (!$isPost) fail('POST required.', 405);
    if (!$canRequestPayments) fail('Only Sales Staff can cancel a payment request.', 403);
    $st = $db->prepare('SELECT * FROM payment_requests WHERE id = ?');
    $st->execute([(int)($_POST['request_id'] ?? 0)]);
    $req = $st->fetch();
    if (!$req) fail('Payment request not found.', 404);
    $b = staffBooking($db, (int)$req['booking_id'], $uid, $seeAll);       // also proves this staff member handles the booking
    if ($req['status'] !== 'Pending') fail('Only a pending request can be cancelled (this one is ' . strtolower($req['status']) . ').', 409);
    $db->prepare("UPDATE payment_requests SET status = 'Cancelled' WHERE id = ? AND status = 'Pending'")->execute([$req['id']]);
    out(['success' => true, 'payment_request' => null, 'can_request_payment' => bookingBalanceDue($b) > 0]);
}

if ($action === 'update_progress') {
    if (!$isPost) fail('POST required.', 405);
    if (!$canUpdateProgress) fail('Only the assigned Sales Staff can update the progress.', 403);
    $bookingId = (int)($_POST['booking_id'] ?? 0);
    $key = trim((string)($_POST['status'] ?? ''));
    $bail = function (string $m, int $code = 400) use ($db) { if ($db->inTransaction()) $db->rollBack(); fail($m, $code); };
    $db->beginTransaction();
    try {
        $b = staffBooking($db, $bookingId, $uid, $seeAll, true);
        if (preg_match('/cancel/i', (string)$b['booking_status'])) $bail('This booking is cancelled.', 409);
        $info = bookingProgress($b);
        if ($info['next'] === null) $bail('This booking has no further steps.', 409);
        if ($info['blocked'] !== '') $bail($info['blocked'], 409);
        if ($key !== $info['next']['key']) $bail('That is not the next step. Refresh the page and try again.', 409);
        $def = null;
        foreach (bookingProgressSteps($info['kind']) as $d) if ($d['key'] === $key) $def = $d;
        $isLast = $key === end($info['keys']);
        $db->prepare("UPDATE bookings SET fulfillment_status = ?, fulfillment_updated_at = ?" . ($isLast ? ", booking_status = IF(booking_status = 'Confirmed', 'Completed', booking_status)" : '') . " WHERE booking_id = ?")
           ->execute([$key, now(), $bookingId]);
        $db->commit();
    } catch (Throwable $e) {
        if ($db->inTransaction()) $db->rollBack();
        throw $e;
    }
    // Bell: tell the customer (the last step also completes the booking, which then asks for feedback).
    $nfEvent = trim((string)($b['event_title'] ?? '')) !== '' ? $b['event_title'] : 'your event';
    $nfRef = $b['booking_ref'] ?: 'BK-' . str_pad((string)$b['booking_id'], 4, '0', STR_PAD_LEFT);
    // Inbox: the same update as a chat message under the assigned staff's name (the last step is skipped: the "Rate Now" message follows it).
    if ($def && !$isLast && !empty($b['inquiry_id'])) {
        try {
            $cv = $db->prepare("SELECT id FROM `$DB_CRM`.cib_conversations WHERE inquiry_id = ? LIMIT 1");
            $cv->execute([$b['inquiry_id']]);
            if ($conv = $cv->fetch()) {
                $text = 'Hi! ' . str_replace('{event}', '**' . $nfEvent . '**', $def['notify']);
                $at = now();
                $db->prepare("INSERT INTO `$DB_CRM`.cib_messages (conversation_id, sender_type, sender_name, message, attachments, created_at) VALUES (?,?,?,?,NULL,?)")
                   ->execute([$conv['id'], 'staff', $staffName, $text, $at]);
                $db->prepare("UPDATE `$DB_CRM`.cib_conversations SET updated_at = ?, sales_read_at = ? WHERE id = ?")->execute([$at, $at, $conv['id']]);
            }
        } catch (Throwable $e) { error_log('sales-bookings-api: progress chat message failed: ' . $e->getMessage()); }
    }
    if (!empty($b['customer_id']) && $def) {
        notifySend($db, [
            'type' => 'deal', 'kind' => 'booking', 'ref' => $nfRef,
            'title' => $def['title'], 'message' => str_replace('{event}', $nfEvent, $def['notify']),
            'user_ids' => [(int)$b['customer_id']], 'include_admins' => false,
        ]);
    }
    $st = $db->prepare('SELECT * FROM bookings WHERE booking_id = ?');
    $st->execute([$bookingId]);
    $fresh = $st->fetch() ?: $b;
    $prog = bookingProgress($fresh);
    out(['success' => true, 'booking_status' => $fresh['booking_status'], 'fulfillment_status' => $key, 'progress' => $prog,
         'can_update_progress' => $prog['next'] !== null && $prog['blocked'] === '']);
}

fail('Unknown action.', 400);