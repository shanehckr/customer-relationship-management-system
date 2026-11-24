<?php
/**
 * calendar-api.php - Calendar of bookings.
 * GET ?action=list[&start=YYYY-MM-DD&end=YYYY-MM-DD]
 *   -> { success, events:[...], bookings:[...] }
 * Admin / Manager: all bookings. Sales Staff: only bookings assigned to them.
 */
define('SESSION_API', true);
require_once __DIR__ . '/session-init.php';
require __DIR__ . '/inquiry-common.php';
require __DIR__ . '/bookings-schema.php';
require_once __DIR__ . '/quotations-schema.php';   // quoteForBooking(): amount fallback from the accepted / sent quotation

ensureBookingsSchema($db);

$uid = (int)sessionFirst(['user_id', 'id']);
if (!$uid) fail('Please log in again.', 401);
$role = normRole(sessionFirst(['role_name', 'role', 'user_role']));
$seeAll = str_contains($role, 'admin') || str_contains($role, 'manager');
if (!$seeAll && !str_contains($role, 'sales')) fail('You do not have access to the calendar.', 403);

$action = $_GET['action'] ?? 'list';
if ($action !== 'list') fail('Unknown action.', 400);

$where  = ['event_date IS NOT NULL', "COALESCE(booking_status, '') NOT LIKE '%complete%'", "COALESCE(booking_status, '') NOT LIKE '%cancel%'"];   // finished events leave the calendar: Completed ones, and any event whose date has already passed
$params = [];
$where[] = 'event_date >= CURDATE()';   // today and upcoming only; past events stay on the Bookings page
if (!$seeAll) { $where[] = 'assigned_staff_id = ?'; $params[] = $uid; }

$start = $_GET['start'] ?? '';
$end   = $_GET['end'] ?? '';
if (preg_match('/^\d{4}-\d{2}-\d{2}$/', $start)) { $where[] = 'event_date >= ?'; $params[] = $start; }
if (preg_match('/^\d{4}-\d{2}-\d{2}$/', $end))   { $where[] = 'event_date <= ?'; $params[] = $end; }

$st = $db->prepare('SELECT * FROM bookings WHERE ' . implode(' AND ', $where) . ' ORDER BY event_date ASC, event_time ASC');
$st->execute($params);
$bookings = $st->fetchAll();

// Pax / arrangement are typed on the inquiry (leads row) and may never have been copied onto the booking.
$inqIds = [];
foreach ($bookings as $b) {
    if (!empty($b['inquiry_id']) && ((int)($b['expected_guests'] ?? 0) <= 0 || empty($b['arrangement']))) {
        $inqIds[(int)$b['inquiry_id']] = true;
    }
}
$inqMap = [];
if ($inqIds) {
    try {
        $ids = array_keys($inqIds);
        $in  = implode(',', array_fill(0, count($ids), '?'));
        $iq  = $db->prepare("SELECT lead_id, arrangement, expected_guests FROM `$DB_CATERING`.leads WHERE lead_id IN ($in)");
        $iq->execute($ids);
        foreach ($iq->fetchAll() as $r) $inqMap[(int)$r['lead_id']] = $r;
    } catch (Throwable $e) { error_log('calendar-api: inquiry lookup failed: ' . $e->getMessage()); }
}
foreach ($bookings as &$b) {
    $q = $inqMap[(int)($b['inquiry_id'] ?? 0)] ?? null;
    if (!$q) continue;
    if ((int)($b['expected_guests'] ?? 0) <= 0 && (int)($q['expected_guests'] ?? 0) > 0) $b['expected_guests'] = (int)$q['expected_guests'];
    if (empty($b['arrangement']) && !empty($q['arrangement'])) $b['arrangement'] = $q['arrangement'];
}
unset($b);

// Customer (phone / email) and assigned staff (profile photo) both live in the users table.
$userIds = [];
foreach ($bookings as $b) {
    if (!empty($b['customer_id']))       $userIds[(int)$b['customer_id']] = true;
    if (!empty($b['assigned_staff_id'])) $userIds[(int)$b['assigned_staff_id']] = true;
}
$users = [];
if ($userIds) {
    try {
        $ids = array_keys($userIds);
        $upk = usersPk($db, $DB_CRM);
        $in  = implode(',', array_fill(0, count($ids), '?'));
        $us  = $db->prepare("SELECT * FROM `$DB_CRM`.users WHERE `$upk` IN ($in)");
        $us->execute($ids);
        foreach ($us->fetchAll() as $u) $users[(int)$u[$upk]] = $u;
    } catch (Throwable $e) { error_log('calendar-api: could not read the users table: ' . $e->getMessage()); }
}

$events = array_map(function ($b) use ($db, $users) {
    $ref  = $b['booking_ref'] ?: 'BK-' . str_pad((string)$b['booking_id'], 4, '0', STR_PAD_LEFT);
    $cust = $users[(int)($b['customer_id'] ?? 0)] ?? [];
    $staff = $users[(int)($b['assigned_staff_id'] ?? 0)] ?? [];

    // Confirmed quotation amount: the booking's own amount, otherwise the accepted / sent quotation's total.
    $amount = $b['quotation_amount'];
    if (($amount === null || $amount === '' || (float)$amount <= 0) && !empty($b['inquiry_id'])) {
        try { $q = quoteForBooking($db, (int)$b['inquiry_id']); if ($q) $amount = $q['total']; }
        catch (Throwable $e) { error_log('calendar-api: quotation lookup failed: ' . $e->getMessage()); }
    }

    $paid = (float)($b['amount_paid'] ?? 0);
    $stored = $b['remaining_balance'] ?? null;
    $balance = ($stored !== null && $stored !== '') ? max(0.0, round((float)$stored, 2)) : max(0.0, round((float)$amount - $paid, 2));

    return [
        'id'              => (int)$b['booking_id'],
        'booking_id'      => (int)$b['booking_id'],
        'booking_ref'     => $ref,
        'title'           => $b['event_title'] ?: $ref,
        'event_title'     => $b['event_title'],
        'event_date'      => $b['event_date'],
        'date'            => $b['event_date'],
        'event_time'      => $b['event_time'],
        'time'            => $b['event_time'],
        'location'        => $b['location'],
        'arrangement'     => arrangementDisplay((string)$b['arrangement']),
        'customer_name'   => $b['customer_name'],
        'customer_phone'  => firstOf($cust, ['phone', 'phone_number', 'contact_number', 'contact_no', 'mobile', 'mobile_number', 'cellphone']),
        'customer_photo'  => $cust ? customerPhotoUrl($cust) : '',
        'customer_email'  => firstOf($cust, ['email', 'email_address']),
        'expected_guests' => $b['expected_guests'] !== null ? (int)$b['expected_guests'] : 0,
        'package'         => $b['package'],
        'assigned_staff'  => $b['assigned_staff'],
        'staff_photo'     => $staff ? customerPhotoUrl($staff) : '',   // '' = the page shows initials
        'amount_paid'     => (float)($b['amount_paid'] ?? 0),
        'remaining_balance' => $balance,
        'quotation_amount'=> $amount !== null && $amount !== '' ? (float)$amount : null,
        'booking_status'  => $b['booking_status'],
        'status'          => $b['booking_status'],
        'payment_status'  => $b['payment_status'],
    ];
}, $bookings);

out(['success' => true, 'events' => $events, 'bookings' => $events]);
