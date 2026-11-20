<?php
/**
 * customer-home-api.php - API for customer-home.html (the dashboard).
 * GET ?action=summary -> {
 *   success, customer:{full_name},
 *   confirmed_booking: {...} | null,   // the customer's next upcoming booking
 *   active_inquiry:    {...} | null    // the customer's newest inquiry that is still open
 * }
 * Only the logged-in customer's own records are ever returned.
 * Put this file in the SAME folder as inquiry-common.php and bookings-schema.php.
 */
// Shared session setup: secure cookie settings + 30-minute inactivity timeout (replies 401 "session_expired" as JSON).
define('SESSION_API', true);
require_once __DIR__ . '/session-init.php';

require __DIR__ . '/inquiry-common.php';
require __DIR__ . '/bookings-schema.php';
require __DIR__ . '/quotations-schema.php';
ensureBookingsSchema($db);
ensureQuotationsSchema($db);

$customerId = (int)sessionFirst(['customer_id', 'user_id', 'id']);
if (!$customerId) {
    // TESTING only - same as customer-bookings-api.php / customer-inquiries-api.php.
    // Set to 0 (or delete these lines) before going live.
    $TEST_CUSTOMER_ID = 1;
    if ($TEST_CUSTOMER_ID) $customerId = (int)$TEST_CUSTOMER_ID;
    else fail('Please log in again.', 401);
}

if (($_GET['action'] ?? 'summary') !== 'summary') fail('Unknown action.', 400);

/* The page only understands these three labels. */
function homeArrangement($v): string {
    $s = strtolower(trim((string)$v));
    if ($s === '') return '';
    if (strpos($s, 'pick') !== false) return 'Customer Pickup';
    if (strpos($s, 'deliver') !== false) return 'Delivery';
    if (strpos($s, 'buffet') !== false || strpos($s, 'setup') !== false) return 'Buffet with setup';
    return trim((string)$v);
}

/* "2026-11-20" + "10:00 AM" -> "2026-11-20T10:00:00" (date only if the time can't be read). */
function homeDateTime($date, $time): string {
    if (empty($date)) return '';
    $d = substr((string)$date, 0, 10);
    $t = trim((string)$time);
    if ($t !== '' && ($ts = strtotime($t)) !== false) return $d . 'T' . date('H:i:s', $ts);
    return $d . 'T00:00:00';
}

/* leads.stage -> a status word the page's progress bar understands. */
function homeInquiryStatus($stage): string {
    switch (trim((string)$stage)) {
        case 'New Inquiry':           return 'Submitted';
        case 'In Progress':
        case 'In Discussion':         return 'In Progress';
        case 'Quotation Preparation': return 'Quotation in Preparation';
        case 'Quotation Sent':
        case 'Negotiation':           return 'Quotation Sent';
        default:                      return (string)$stage;
    }
}

/* ---- customer name: session first, then the customers / users table ---- */
$fullName = sessionFirst(['customer_name', 'user_name', 'name', 'full_name']);
if ($fullName === '') {
    foreach ([['customers', 'id'], ['users', 'id']] as [$table, $pk]) {
        try {
            $st = $db->prepare("SELECT * FROM `$DB_CRM`.`$table` WHERE `$pk` = ? LIMIT 1");
            $st->execute([$customerId]);
            if ($row = $st->fetch()) {
                $n = firstOf($row, ['full_name', 'name', 'fullname', 'customer_name', 'user_name']);
                if ($n === '') $n = trim(firstOf($row, ['first_name', 'firstname']) . ' ' . firstOf($row, ['last_name', 'lastname']));
                if ($n !== '') { $fullName = $n; break; }
            }
        } catch (PDOException $e) { /* table/columns differ: try the next one */ }
    }
}

/* ---- next upcoming booking (not finished, not cancelled) ---- */
$booking = null;
$st = $db->prepare("SELECT * FROM bookings
    WHERE customer_id = ?
      AND LOWER(COALESCE(booking_status, '')) NOT IN ('completed', 'cancelled', 'canceled')
      AND (event_date IS NULL OR event_date >= CURDATE())
    ORDER BY event_date IS NULL, event_date ASC, booking_id ASC
    LIMIT 1");
$st->execute([$customerId]);
if ($b = $st->fetch()) {
    $id = (int)$b['booking_id'];
    $prog = bookingProgress($b);
    unset($prog['next'], $prog['blocked']);
    $booking = [
        'booking_id'          => $id,
        'reference'           => $b['booking_ref'] ?: 'BK-' . str_pad((string)$id, 4, '0', STR_PAD_LEFT),
        'event_name'          => $b['event_title'],
        'event_datetime'      => homeDateTime($b['event_date'], $b['event_time']),
        'expected_guests'     => $b['expected_guests'] !== null ? (int)$b['expected_guests'] : null,
        'venue'               => $b['location'],
        'service_arrangement' => homeArrangement($b['arrangement']),
        'status'              => $b['booking_status'] ?: 'Confirmed',
        'is_confirmed'        => true,   // every booking row is a confirmed booking
        'progress'            => $prog,  // steps change with the service arrangement (pickup / delivery / buffet)
    ];
}

/* ---- newest inquiry that is still open (not Confirmed / Completed / Declined) ---- */
$inquiry = null;
$st = $db->prepare("SELECT * FROM leads
    WHERE customer_id = ?
      AND stage NOT IN ('Confirmed', 'Completed', 'Declined')
    ORDER BY created_at DESC, `$LEAD_PK` DESC
    LIMIT 1");
$st->execute([$customerId]);
if ($l = $st->fetch()) {
    $id  = (int)$l[$LEAD_PK];
    $ref = !empty($l['inquiry_ref']) ? $l['inquiry_ref'] : 'INQ-' . str_pad((string)$id, 4, '0', STR_PAD_LEFT);
    // what the customer has done with the latest quotation changes the label the progress bar reads
    $q = quotesByInquiry($db, [$id], true)[$id] ?? null;
    $status = homeInquiryStatus($l['stage']);
    if ($q && $q['status'] === 'Accepted') $status = 'Quotation Accepted';   // -> "Confirmation" step
    if ($q && $q['status'] === 'Declined') $status = 'In Progress';          // waiting for a revised quotation
    $inquiry = [
        'inquiry_id'          => $id,
        'reference'           => $ref,
        'event_name'          => $l['event_name'],
        'event_datetime'      => homeDateTime($l['event_date'], ''),
        'venue'               => $l['event_location'],
        'service_arrangement' => homeArrangement($l['arrangement']),
        'status'              => $status,
        'stage'               => $l['stage'],
    ];
}

/* no booking and nothing open: if the customer's newest inquiry was declined, say so (instead of a silent empty page) */
$declined = null;
if (!$booking && !$inquiry) {
    $st = $db->prepare("SELECT * FROM leads WHERE customer_id = ? ORDER BY created_at DESC, `$LEAD_PK` DESC LIMIT 1");
    $st->execute([$customerId]);
    if (($d = $st->fetch()) && $d['stage'] === 'Declined') {
        $did = (int)$d[$LEAD_PK];
        $declined = [
            'reference'  => !empty($d['inquiry_ref']) ? $d['inquiry_ref'] : 'INQ-' . str_pad((string)$did, 4, '0', STR_PAD_LEFT),
            'event_name' => $d['event_name'],
            'reason'     => (string)($d['decline_reason'] ?? ''),
        ];
    }
}

out([
    'success'           => true,
    'customer'          => ['full_name' => $fullName],
    'confirmed_booking' => $booking,
    'active_inquiry'    => $inquiry,
    'declined_inquiry'  => $declined,
]);