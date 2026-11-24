<?php
/**
 * reports-api.php - backend of the Reports page (manager-admin-report.html: Customer / Sales / Ticket report).
 * Called by pages.js: crmLoadReportsData() -> crmFillReports(data).
 *
 *   GET reports-api.php?range=weekly|monthly|yearly
 *   GET reports-api.php?range=custom&start=YYYY-MM-DD&end=YYYY-MM-DD
 *
 * Put it in the SAME folder as inquiry-common.php, bookings-schema.php and quotations-schema.php.
 * It only reads tables provisioned by database/catering_crm.sql; request-time schema changes are not performed:
 *   users + roles -> the 5 roles | leads -> inquiries | quotations | bookings | cib_tickets -> support tickets
 *
 * THE 5 ROLES
 *   Customer               creates the data (account, inquiry, ticket)  -> no access to this report (403)
 *   Sales Staff            handles inquiries / quotations / bookings     -> sees ONLY their own numbers (Customer + Sales tabs)
 *   Customer Service Staff handles tickets                               -> Ticket tab only
 *   Manager / Admin        everything, organization-wide
 *
 * HOW THE NUMBERS ARE DEFINED
 *   Total customers     = customer accounts registered on or before the end of the period
 *   New customers       = registered inside the period (users.created_at; without that column: date of their first inquiry)
 *   Returning clients   = registered before the period AND sent at least one inquiry inside it
 *   Customers by staff  = ALL customers, grouped by the Sales Staff of their most recent accepted inquiry (none = Unassigned)
 *   Inquiries submitted = leads created in the period.  Stages: New Inquiry | Declined | In Progress (every other stage)
 *   Quotations sent     = inquiries whose quotation was sent in the period (a revised version counts once; Drafts never)
 *   Confirmed bookings  = bookings created in the period (bookings.created_at = the day the deposit confirmed it), not cancelled
 *   Quotation value     = total of those quotations      Booking value = quotation_amount of the confirmed bookings
 *   Verified payments   = amount_paid of the confirmed bookings (payments Xendit confirmed)   Outstanding = remaining_balance of them
 *   Tickets             = tickets submitted in the period, by their current status / priority
 *   Feedback            = booking_feedback rows (rating 1-5) SUBMITTED in the period (booking-feedback.php). Average = mean rating.
 *                         Satisfied = 4-5 stars, Low = 1-2 stars. Response rate = of the bookings whose rating request was sent in the
 *                         period (bookings.feedback_requested_at), how many have a rating now. Sales Staff only see their own bookings.
 */
// Shared session setup: secure cookie settings + 30-minute inactivity timeout (replies 401 "session_expired" as JSON).
define('SESSION_API', true);
require_once __DIR__ . '/session-init.php';

require __DIR__ . '/inquiry-common.php';
// Keep internal PHP/database exceptions out of this JSON API response.
set_exception_handler(function ($e) {
    error_log('reports-api: ' . $e->getMessage());
    fail('An internal error occurred while loading reports.', 500);
});

$uid = (int)($_SESSION['user_id'] ?? 0);
if ($uid < 1) fail('Please log in again.', 401);

try {
    $identity = $db->prepare('SELECT u.account_status, r.role_name FROM users u
                              JOIN roles r ON r.role_id = u.role_id WHERE u.user_id = ? LIMIT 1');
    $identity->execute([$uid]);
    $account = $identity->fetch();
} catch (Throwable $e) {
    error_log('reports-api: account authorization lookup failed: ' . $e->getMessage());
    fail('Unable to verify your account.', 500);
}
if (!$account || $account['account_status'] !== 'Active') fail('Please log in again.', 401);

$role = normRole($account['role_name']);
$isAdmin = str_contains($role, 'admin');
$isManager = !$isAdmin && str_contains($role, 'manager');
$isSales = !$isAdmin && !$isManager && str_contains($role, 'sales');
$isCs = !$isAdmin && !$isManager && !$isSales &&
    (str_contains($role, 'service') || (bool)preg_match('/\bcs\b/', $role));
if (!$isAdmin && !$isManager && !$isSales && !$isCs) fail('You do not have access to reports.', 403);

if (($_SERVER['REQUEST_METHOD'] ?? 'GET') !== 'GET') fail('GET required.', 405);

require __DIR__ . '/bookings-schema.php';
require __DIR__ . '/quotations-schema.php';
require __DIR__ . '/booking-feedback.php';
ensureBookingsSchema($db);
ensureQuotationsSchema($db);

/* ------------------------------------------------------------------ helpers ------------------------------------------------------------------ */

function rpDay($v): string { return substr((string)$v, 0, 10); }
function rpIn($v, string $from, string $to): bool { $d = rpDay($v); return $d !== '' && $d >= $from && $d <= $to; }

/** Every user with their role name. Works with users.role_id -> roles, or with a text role column. */
function rpLoadUsers(AppDatabase $db, string $crm): array {
    $cols = [];
    foreach ($db->query("SHOW COLUMNS FROM `$crm`.users")->fetchAll() as $c) $cols[strtolower($c['Field'])] = $c['Field'];
    $pk = usersPk($db, $crm);
    $parts = [];
    if (isset($cols['first_name'], $cols['last_name'])) $parts[] = "NULLIF(TRIM(CONCAT(u.`{$cols['first_name']}`, ' ', u.`{$cols['last_name']}`)), '')";
    foreach (['full_name', 'name', 'username'] as $n) if (isset($cols[$n])) $parts[] = "NULLIF(TRIM(u.`{$cols[$n]}`), '')";
    $nameSql = $parts ? 'COALESCE(' . implode(', ', $parts) . ')' : 'NULL';
    $regSql = 'NULL';
    foreach (['created_at', 'date_created', 'registered_at', 'date_registered', 'date_added', 'created_on'] as $c) if (isset($cols[$c])) { $regSql = "u.`{$cols[$c]}`"; break; }
    $statusSql = isset($cols['status']) ? "u.`{$cols['status']}`" : "''";
    $base = "u.`$pk` AS id, $nameSql AS name, $regSql AS registered, $statusSql AS status";
    try {
        $rows = $db->query("SELECT $base, r.role_name AS role FROM `$crm`.users u LEFT JOIN `$crm`.roles r ON r.role_id = u.role_id")->fetchAll();
    } catch (Throwable $e) {                      // no role_id / roles table: the role is stored as text on the user
        $roleSql = "''";
        foreach (['role', 'user_role', 'role_name', 'user_type', 'account_type'] as $c) if (isset($cols[$c])) { $roleSql = "u.`{$cols[$c]}`"; break; }
        $rows = $db->query("SELECT $base, $roleSql AS role FROM `$crm`.users u")->fetchAll();
    }
    return array_map(fn($r) => [
        'id' => (int)$r['id'], 'name' => trim((string)$r['name']) !== '' ? trim((string)$r['name']) : 'User #' . $r['id'],
        'registered' => $r['registered'], 'status' => strtolower(trim((string)$r['status'])), 'role' => (string)$r['role'],
    ], $rows);
}

/** [key, label] of a staff member. No staff at all = ['none', 'Unassigned']. */
function rpStaffKey($id, $fallbackName, array $names): array {
    $id = (int)$id; $fb = trim((string)$fallbackName);
    if ($id) return ['i' . $id, $names[$id] ?? ($fb !== '' ? $fb : 'Staff #' . $id)];
    if ($fb !== '') return ['n' . strtolower($fb), $fb];
    return ['none', 'Unassigned'];
}

/** "May 1–7", "Oct 30–Nov 5", "May 9" */
function rpRangeLabel(DateTimeImmutable $s, DateTimeImmutable $e): string {
    if ($s->format('Y-m-d') === $e->format('Y-m-d')) return $s->format('M j');
    if ($s->format('Ym') === $e->format('Ym')) return $s->format('M j') . '–' . $e->format('j');
    return $s->format('M j') . '–' . $e->format('M j');
}

/** Date buckets for the trend chart. <=14 days: one per day. <=93 days: weeks. Longer: months. */
function rpBuckets(string $from, string $to): array {
    $a = new DateTimeImmutable($from); $z = new DateTimeImmutable($to);
    $days = (int)$a->diff($z)->days + 1;
    $out = [];
    if ($days <= 14) {
        for ($d = $a; $d <= $z; $d = $d->modify('+1 day')) {
            $out[] = ['label' => $d->format('D') . ' (' . $d->format('M j') . ')', 'from' => $d->format('Y-m-d'), 'to' => $d->format('Y-m-d')];
        }
    } elseif ($days <= 93) {
        for ($s = $a; $s <= $z; $s = $s->modify('+7 days')) {
            $e = $s->modify('+6 days');
            if ($e > $z) $e = $z;
            $out[] = ['label' => rpRangeLabel($s, $e), 'from' => $s->format('Y-m-d'), 'to' => $e->format('Y-m-d')];
        }
    } else {
        $sameYear = $a->format('Y') === $z->format('Y');
        for ($m = $a->modify('first day of this month'); $m <= $z; $m = $m->modify('first day of next month')) {
            $s = $m < $a ? $a : $m;
            $last = $m->modify('last day of this month');
            $e = $last > $z ? $z : $last;
            $out[] = ['label' => $m->format('M') . ($sameYear ? '' : ' (' . $m->format('Y') . ')'), 'from' => $s->format('Y-m-d'), 'to' => $e->format('Y-m-d')];
        }
    }
    return $out;
}

/** [{label, count}] : how many of $dates fall in each bucket. */
function rpTrend(array $buckets, array $dates): array {
    $out = [];
    foreach ($buckets as $b) {
        $n = 0;
        foreach ($dates as $d) if ($d >= $b['from'] && $d <= $b['to']) $n++;
        $out[] = ['label' => $b['label'], 'count' => $n];
    }
    return $out;
}

function rpInquiryStage($stage): string {
    $s = strtolower(trim((string)$stage));
    if ($s === 'new inquiry' || $s === 'new') return 'new';
    if ($s === 'declined') return 'declined';
    return 'in_progress';
}
function rpArrangement($a): string {
    if (arrangementIsPickup($a)) return 'Customer Pickup';
    if (arrangementIsDelivery($a)) return 'Food Delivery';
    return 'On-site Catering';
}
function rpTicketStatus($status): string {
    $s = strtolower(trim((string)$status));
    if ($s === 'open' || $s === '') return 'Open';
    if ($s === 'in progress') return 'In Progress';
    if ($s === 'pending' || str_contains($s, 'waiting')) return 'Pending';
    if ($s === 'resolved' || $s === 'closed') return 'Resolved';
    if (str_contains($s, 'cancel')) return 'Cancelled';
    return ucfirst($s);
}

/* ------------------------------------------------------------------ who is asking ------------------------------------------------------------------ */

$users = rpLoadUsers($db, $DB_CRM);
$names = [];
foreach ($users as $u) $names[$u['id']] = $u['name'];

$orgWide     = $isAdmin || $isManager;
$showSales   = $orgWide || $isSales;     // customer + sales sections
$showTickets = $orgWide || $isCs;
$scopeRole   = $isAdmin ? 'Organization-Wide Analytics ( Admin )'
             : ($isManager ? 'Organization-Wide Analytics ( Manager )'
             : ($isSales ? 'My Sales Analytics ( Sales Staff )' : 'Support Analytics ( Customer Service )'));

/* ------------------------------------------------------------------ date range ------------------------------------------------------------------ */

$rangeKey = strtolower(trim((string)($_GET['range'] ?? 'monthly')));
$today = new DateTimeImmutable('today');
if ($rangeKey === 'weekly') {
    $a = $today->modify('-' . ((int)$today->format('N') - 1) . ' days');          // Monday
    $from = $a->format('Y-m-d'); $to = $a->modify('+6 days')->format('Y-m-d');     // Sunday
} elseif ($rangeKey === 'yearly') {
    $from = $today->format('Y') . '-01-01'; $to = $today->format('Y') . '-12-31';
} elseif ($rangeKey === 'custom') {
    $from = trim((string)($_GET['start'] ?? '')); $to = trim((string)($_GET['end'] ?? ''));
    $d1 = DateTime::createFromFormat('Y-m-d', $from); $d2 = DateTime::createFromFormat('Y-m-d', $to);
    if (!$d1 || $d1->format('Y-m-d') !== $from || !$d2 || $d2->format('Y-m-d') !== $to) fail('Choose a valid start and end date.', 422);
    if ($from > $to) fail('The start date must be on or before the end date.', 422);
    if ($d1->diff($d2)->days > 366) fail('Please choose a range of one year or less.', 422);
} else {
    $rangeKey = 'monthly';
    $from = $today->format('Y-m-01'); $to = $today->format('Y-m-t');
}

$myName = $names[$uid] ?? (sessionFirst(['user_name', 'name', 'full_name']) ?: '');
$scope = $isAdmin ? ['label' => 'Organization-Wide Analytics', 'name' => '', 'role' => 'Admin']
       : ($isManager ? ['label' => 'Organization-Wide Analytics', 'name' => '', 'role' => 'Manager']
       : ($isSales ? ['label' => 'My Assigned Sales Records', 'name' => $myName, 'role' => 'Sales Staff']
       : ['label' => 'Support Tickets', 'name' => $myName, 'role' => 'Customer Service Staff']));
$response = ['success' => true, 'scope_role' => $scopeRole, 'scope' => $scope, 'range' => ['key' => $rangeKey, 'from' => $from, 'to' => $to]];

/* ------------------------------------------------------------------ read the data once ------------------------------------------------------------------ */

$leads = $quoteRows = $bkRows = $tkRows = $fbRows = $fbReq = [];
$salesStaff = $leadStaff = $firstLead = $mine = $custStaff = $custStaffAt = [];

if ($showSales) {
    $leads = $db->query("SELECT `$LEAD_PK` AS id, customer_id, stage, assigned_staff_id, assigned_staff_name, created_at, claimed_at FROM leads")->fetchAll();
    foreach ($leads as $l) $leadStaff[(int)$l['id']] = (int)$l['assigned_staff_id'];       // lead id => staff id (scopes quotations for a Sales Staff)

    foreach ($users as $u) {                                                                // every active Sales Staff, so staff with 0 customers still show
        $r = normRole($u['role']);
        if (str_contains($r, 'sales') && !str_contains($r, 'manager') && !in_array($u['status'], ['inactive', 'disabled', 'deleted', 'deactivated'], true)) $salesStaff['i' . $u['id']] = $u['name'];
    }
    if ($isSales) $salesStaff = ['i' . $uid => $names[$uid] ?? 'Me'];

    foreach ($leads as $l) {
        $cid = (int)$l['customer_id'];
        if (!$cid) continue;
        $d = rpDay($l['created_at']);
        if (!isset($firstLead[$cid]) || $d < $firstLead[$cid]) $firstLead[$cid] = $d;
        if ((int)$l['assigned_staff_id'] === $uid) $mine[$cid] = true;
        if ((int)$l['assigned_staff_id'] || trim((string)$l['assigned_staff_name']) !== '') {
            $at = (string)($l['claimed_at'] ?: $l['created_at']);
            if (!isset($custStaffAt[$cid]) || $at >= $custStaffAt[$cid]) { $custStaffAt[$cid] = $at; $custStaff[$cid] = [$l['assigned_staff_id'], $l['assigned_staff_name']]; }
        }
    }
    $quoteRows = $db->query("SELECT inquiry_id, version, total, sent_at FROM quotations WHERE status <> 'Draft' AND sent_at IS NOT NULL ORDER BY version ASC")->fetchAll();
    $bkRows = $db->query("SELECT b.*, l.arrangement AS lead_arrangement FROM bookings b LEFT JOIN leads l ON l.`$LEAD_PK` = b.inquiry_id")->fetchAll();

    // customer feedback: never breaks the report (no table / no column = the Feedback tab just shows zeros)
    try {
        ensureBookingFeedbackSchema($db);
        $fbRows = $db->query("SELECT f.feedback_id, f.booking_id, f.rating, f.comments, f.images, f.created_at,
                                     b.booking_ref, b.customer_name, b.event_title, b.assigned_staff_id, b.assigned_staff
                              FROM booking_feedback f LEFT JOIN bookings b ON b.booking_id = f.booking_id
                              WHERE f.rating > 0 ORDER BY f.created_at DESC, f.feedback_id DESC")->fetchAll();
    } catch (Throwable $e) { error_log('reports-api: feedback rows: ' . $e->getMessage()); }
    try {
        if ($db->query("SHOW COLUMNS FROM `bookings` LIKE 'feedback_requested_at'")->fetch()) {
            $fbReq = $db->query("SELECT b.assigned_staff_id, b.feedback_requested_at AS requested_at,
                                        (SELECT COUNT(*) FROM booking_feedback f WHERE f.booking_id = b.booking_id AND f.rating > 0) AS rated
                                 FROM bookings b WHERE b.feedback_requested_at IS NOT NULL")->fetchAll();
        }
    } catch (Throwable $e) { error_log('reports-api: feedback requests: ' . $e->getMessage()); }
}
if ($showTickets) {
    $tkRows = $db->query("SELECT status, priority, created_at FROM `$DB_CRM`.cib_tickets")->fetchAll();
}

/* ------------------------------------------------------------------ every number of ONE period ------------------------------------------------------------------
   Used twice: for the chosen period and for the period before it, so "vs last month" compares like with like. */

$compute = function (string $from, string $to) use ($showSales, $showTickets, $isSales, $uid, $users, $names, $salesStaff, $leadStaff, $leads, $firstLead, $mine, $custStaff, $quoteRows, $bkRows, $tkRows, $fbRows, $fbReq): array {
    $buckets = rpBuckets($from, $to);
    $out = [];

    if ($showSales) {
        /* ---------------- customers ---------------- */
        $inPeriod = [];
        foreach ($leads as $l) {
            $cid = (int)$l['customer_id'];
            if ($cid && rpIn($l['created_at'], $from, $to)) $inPeriod[$cid] = true;
        }
        $cust = ['total' => 0, 'new' => 0, 'returning' => 0];
        $by = []; $reg = $salesStaff; $newDates = [];
        foreach ($users as $u) {
            if (normRole($u['role']) !== 'customer') continue;
            $cid = $u['id'];
            if ($isSales && empty($mine[$cid])) continue;
            $regDay = rpDay($u['registered']);
            if ($regDay === '') $regDay = $firstLead[$cid] ?? '';
            if ($regDay !== '' && $regDay > $to) continue;                       // registered after the period
            $isNew = $regDay !== '' && $regDay >= $from;
            $isRet = !$isNew && !empty($inPeriod[$cid]);
            if ($isSales) { $k = 'i' . $uid; }
            elseif (isset($custStaff[$cid])) { [$k, $label] = rpStaffKey($custStaff[$cid][0], $custStaff[$cid][1], $names); $reg[$k] = $reg[$k] ?? $label; }
            else $k = 'none';
            $by[$k] = ($by[$k] ?? 0) + 1;
            $cust['total']++;
            if ($isNew) { $cust['new']++; $newDates[] = $regDay; }
            if ($isRet) $cust['returning']++;
        }
        unset($reg['none']);
        $keys = array_keys($reg);
        usort($keys, fn($x, $y) => strcasecmp($reg[$x], $reg[$y]));
        if (!empty($by['none'])) $keys[] = 'none';
        $byStaff = [];
        foreach ($keys as $k) $byStaff[] = ['label' => $k === 'none' ? 'Unassigned' : $reg[$k], 'count' => $by[$k] ?? 0];
        $out['customer'] = $cust + ['trend' => rpTrend($buckets, $newDates), 'by_staff' => $byStaff];

        /* ---------------- inquiries ---------------- */
        $inq = ['new' => 0, 'in_progress' => 0, 'declined' => 0];
        foreach ($leads as $l) {
            if (!rpIn($l['created_at'], $from, $to)) continue;
            if ($isSales && (int)$l['assigned_staff_id'] !== $uid) continue;
            $inq[rpInquiryStage($l['stage'])]++;
        }
        $inquiries = $inq['new'] + $inq['in_progress'] + $inq['declined'];

        /* ---------------- quotations sent (one per inquiry: its latest version sent in the period) ---------------- */
        $quoted = [];
        foreach ($quoteRows as $q) {
            if (!rpIn($q['sent_at'], $from, $to)) continue;
            if ($isSales && ($leadStaff[(int)$q['inquiry_id']] ?? 0) !== $uid) continue;
            $quoted[(int)$q['inquiry_id']] = (float)$q['total'];                // later versions overwrite earlier ones
        }

        /* ---------------- confirmed bookings ---------------- */
        $arr = ['On-site Catering' => 0, 'Food Delivery' => 0, 'Customer Pickup' => 0];
        $confirmed = 0; $bookingValue = 0.0; $paid = 0.0; $outstanding = 0.0;
        foreach ($bkRows as $b) {
            $when = (string)($b['confirmed_at'] ?? $b['created_at'] ?? '');
            if (!rpIn($when, $from, $to)) continue;
            if (preg_match('/cancel/i', (string)($b['booking_status'] ?? ''))) continue;
            if ($isSales && (int)($b['assigned_staff_id'] ?? 0) !== $uid) continue;
            $confirmed++;
            $arrangement = trim((string)($b['arrangement'] ?? '')) !== '' ? $b['arrangement'] : ($b['lead_arrangement'] ?? '');
            $arr[rpArrangement($arrangement)]++;
            $total = (float)($b['quotation_amount'] ?? 0);
            $got = (float)($b['amount_paid'] ?? 0);
            $bookingValue += $total;
            $paid += $got;
            $outstanding += ($b['remaining_balance'] ?? '') !== '' && $b['remaining_balance'] !== null ? max(0, (float)$b['remaining_balance']) : max(0, $total - $got);
        }
        $out['sales'] = [
            'inquiries' => $inquiries, 'quotations' => count($quoted), 'confirmed_bookings' => $confirmed, 'verified_revenue' => round($paid, 2),
            'stages' => [['label' => 'New Inquiry', 'count' => $inq['new']], ['label' => 'In Progress', 'count' => $inq['in_progress']], ['label' => 'Declined', 'count' => $inq['declined']]],
            'arrangement' => array_map(fn($k) => ['label' => $k, 'count' => $arr[$k]], array_keys($arr)),
            'finance' => ['quotation_value' => round(array_sum($quoted), 2), 'booking_value' => round($bookingValue, 2),
                          'verified_payments' => round($paid, 2), 'outstanding' => round($outstanding, 2)],
        ];

        /* ---------------- customer feedback (by the day it was submitted) ---------------- */
        $dist = [5 => 0, 4 => 0, 3 => 0, 2 => 0, 1 => 0]; $sum = 0; $n = 0; $recent = []; $rated = [];
        foreach ($fbRows as $f) {
            if (!rpIn($f['created_at'], $from, $to)) continue;
            if ($isSales && (int)$f['assigned_staff_id'] !== $uid) continue;
            $r = max(1, min(5, (int)$f['rating']));
            $dist[$r]++; $sum += $r; $n++;
            $rated[] = [rpDay($f['created_at']), $r];
            $imgs = !empty($f['images']) ? json_decode($f['images'], true) : [];
            $recent[] = [
                'date' => rpDay($f['created_at']), 'booking' => (string)($f['booking_ref'] ?: 'BK-' . str_pad((string)(int)$f['booking_id'], 4, '0', STR_PAD_LEFT)),
                'customer' => (string)($f['customer_name'] ?? ''), 'event' => (string)($f['event_title'] ?? ''),
                'rating' => $r, 'comment' => trim((string)($f['comments'] ?? '')), 'photos' => is_array($imgs) ? count($imgs) : 0,
                'staff' => (string)($f['assigned_staff'] ?? ''),
            ];
        }
        $fbTrend = [];
        foreach ($buckets as $b) {
            $s = 0; $c = 0;
            foreach ($rated as $x) if ($x[0] >= $b['from'] && $x[0] <= $b['to']) { $s += $x[1]; $c++; }
            $fbTrend[] = ['label' => $b['label'], 'count' => $c ? round($s / $c, 1) : 0];       // average rating of that bucket (0 = no feedback)
        }
        $requested = 0; $answered = 0;
        foreach ($fbReq as $q) {
            if (!rpIn($q['requested_at'], $from, $to)) continue;
            if ($isSales && (int)$q['assigned_staff_id'] !== $uid) continue;
            $requested++;
            if ((int)$q['rated'] > 0) $answered++;
        }
        $out['feedback'] = [
            'total' => $n, 'average' => $n ? round($sum / $n, 2) : 0,
            'satisfied' => $dist[5] + $dist[4], 'low' => $dist[2] + $dist[1],
            'requested' => $requested, 'responded' => $answered,
            'distribution' => array_map(fn($k) => ['label' => $k . ($k === 1 ? ' Star' : ' Stars'), 'count' => $dist[$k]], [5, 4, 3, 2, 1]),
            'trend' => $fbTrend,
            'recent' => array_slice($recent, 0, 100),
        ];
    }

    if ($showTickets) {
        $tix = ['total' => 0, 'open' => 0, 'in_progress' => 0, 'resolved' => 0];
        $statusCount = ['Open' => 0, 'In Progress' => 0, 'Resolved' => 0];
        $prio = ['High' => 0, 'Medium' => 0, 'Low' => 0];
        foreach ($tkRows as $t) {
            if (!rpIn($t['created_at'], $from, $to)) continue;
            $status = rpTicketStatus($t['status']);
            $tix['total']++;
            $statusCount[$status] = ($statusCount[$status] ?? 0) + 1;
            if ($status === 'Open') $tix['open']++;
            if ($status === 'In Progress') $tix['in_progress']++;
            if ($status === 'Resolved') $tix['resolved']++;
            $p = ucfirst(strtolower(trim((string)$t['priority'])));
            if (!in_array($p, ['Urgent', 'High', 'Medium', 'Low'], true)) $p = 'Medium';
            $prio[$p] = ($prio[$p] ?? 0) + 1;
        }
        if (isset($prio['Urgent'])) $prio = ['Urgent' => $prio['Urgent']] + $prio;       // Urgent only shows when there is one
        $out['ticket'] = $tix + [
            'statuses' => array_map(fn($k) => ['label' => $k, 'count' => $statusCount[$k]], array_keys($statusCount)),
            'priority' => array_map(fn($k) => ['label' => $k, 'count' => $prio[$k]], array_keys($prio)),
        ];
    }
    return $out;
};

$response += $compute($from, $to);

/* ------------------------------------------------------------------ the period before (for the "vs last month" arrows) ------------------------------------------------------------------
   weekly -> last week, monthly -> last calendar month, yearly -> last year, custom -> the same number of days right before the start. */

$f0 = new DateTimeImmutable($from); $t0 = new DateTimeImmutable($to);
if ($rangeKey === 'weekly')      { $pf = $f0->modify('-7 days'); $pt = $t0->modify('-7 days'); $prevLabel = 'last week'; }
elseif ($rangeKey === 'yearly')  { $pf = $f0->modify('-1 year'); $pt = $t0->modify('-1 year'); $prevLabel = 'last year'; }
elseif ($rangeKey === 'monthly') { $pf = $f0->modify('first day of previous month'); $pt = $pf->modify('last day of this month'); $prevLabel = 'last month'; }
else { $len = (int)$f0->diff($t0)->days + 1; $pt = $f0->modify('-1 day'); $pf = $pt->modify('-' . ($len - 1) . ' days'); $prevLabel = 'previous period'; }

$prev = $compute($pf->format('Y-m-d'), $pt->format('Y-m-d'));
$keep = fn(array $row, array $keys) => array_intersect_key($row, array_flip($keys));
$response['previous'] = ['label' => $prevLabel, 'range' => ['from' => $pf->format('Y-m-d'), 'to' => $pt->format('Y-m-d')]]
    + (isset($prev['customer']) ? ['customer' => $keep($prev['customer'], ['total', 'new', 'returning'])] : [])
    + (isset($prev['sales'])    ? ['sales'    => $keep($prev['sales'], ['inquiries', 'quotations', 'confirmed_bookings', 'verified_revenue'])] : [])
    + (isset($prev['feedback']) ? ['feedback' => $keep($prev['feedback'], ['total', 'average', 'satisfied', 'low'])] : [])
    + (isset($prev['ticket'])   ? ['ticket'   => $keep($prev['ticket'], ['total', 'open', 'in_progress', 'resolved'])] : []);

out($response);
