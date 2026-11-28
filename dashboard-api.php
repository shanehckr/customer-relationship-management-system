<?php
declare(strict_types=1);

const DASH_DEBUG = true;
const DASH_LARGE_EVENT_PAX = 50;                 // "Large Events" threshold for the Manager
const DASH_OPEN_TICKET = "('Open','In Progress','Pending')";

mysqli_report(MYSQLI_REPORT_ERROR | MYSQLI_REPORT_STRICT);
// Shared session setup: secure cookie settings + 30-minute inactivity timeout (replies 401 "session_expired" as JSON).
define('SESSION_API', true);
require_once __DIR__ . '/session-init.php';
date_default_timezone_set('Asia/Manila');
header('Content-Type: application/json; charset=utf-8');
header('Cache-Control: no-store');

$warnings = [];

function dash_out(array $payload, int $code = 200): never
{
    http_response_code($code);
    echo json_encode($payload, JSON_UNESCAPED_UNICODE | JSON_INVALID_UTF8_SUBSTITUTE | JSON_PARTIAL_OUTPUT_ON_ERROR);
    exit;
}

/* Small query helpers. */
function dash_rows(string $sql, array $params = []): array
{
    global $conn;
    $st = $conn->prepare($sql);
    if ($params) {
        $types = '';
        foreach ($params as $p) { $types .= is_int($p) ? 'i' : 's'; }
        $st->bind_param($types, ...$params);
    }
    $st->execute();
    $rows = $st->get_result()->fetch_all(MYSQLI_ASSOC);
    $st->close();
    return $rows;
}
function dash_val(string $sql, array $params = []): int
{
    $r = dash_rows($sql, $params)[0] ?? [];
    return (int)(array_values($r)[0] ?? 0);
}
/** Run one block; on any SQL problem return $default and remember why. */
function dash_safe(string $label, callable $fn, mixed $default = [])
{
    global $warnings;
    try { return $fn(); }
    catch (Throwable $e) { $warnings[] = $label . ': ' . $e->getMessage(); return $default; }
}
/** "SELECT x AS label, COUNT(*) AS n ... GROUP BY x"  ->  ["Label" => n] with every wanted label present. */
function dash_counts(string $sql, array $params, array $labels): array
{
    $out = array_fill_keys($labels, 0);
    foreach (dash_rows($sql, $params) as $r) {
        if (array_key_exists((string)$r['label'], $out)) { $out[(string)$r['label']] = (int)$r['n']; }
    }
    return $out;
}
/** The 3 booking services: "Customer Pickup", "Food Delivery" or "Buffet with Setup" (anything that is not pick-up / delivery). */
function dash_service_label($arrangement): string
{
    $a = (string)$arrangement;
    if (preg_match('/pick\s*-?\s*up/i', $a)) return 'Customer Pickup';
    if (preg_match('/deliver/i', $a))          return 'Food Delivery';
    return 'Buffet with Setup';
}
/** Bookings per service (cancelled ones are not counted). Uses the inquiry's arrangement when the booking has none. */
function dash_booking_services(): array
{
    $out = ['Customer Pickup' => 0, 'Food Delivery' => 0, 'Buffet with Setup' => 0];
    try {
        $rows = dash_rows("SELECT COALESCE(NULLIF(TRIM(b.arrangement), ''), l.arrangement) AS a, b.booking_status AS s, COUNT(*) AS n
                           FROM bookings b LEFT JOIN leads l ON l.lead_id = b.inquiry_id GROUP BY 1, 2");
    } catch (Throwable $e) {   // no inquiry link: use the booking's own arrangement only
        $rows = dash_rows("SELECT b.arrangement AS a, b.booking_status AS s, COUNT(*) AS n FROM bookings b GROUP BY 1, 2");
    }
    foreach ($rows as $r) {
        if (preg_match('/cancel/i', (string)$r['s'])) continue;
        $out[dash_service_label($r['a'])] += (int)$r['n'];
    }
    return $out;
}
function dash_today(): string { return "'" . date('Y-m-d') . "'"; }

/* Shared SQL fragments. */
const REF_LEAD    = "COALESCE(NULLIF(l.inquiry_ref,''), CONCAT('INQ-', LPAD(l.lead_id, 4, '0')))";
const REF_BOOKING = "COALESCE(NULLIF(b.booking_ref,''), CONCAT('BK-', LPAD(b.booking_id, 4, '0')))";
const BOOKING_LIVE = "b.booking_status NOT IN ('Completed','Cancelled')";
// General active status is In Progress: terminal statuses and booking-confirmed inquiries leave the pipeline.
const LEAD_ACTIVE = "l.stage NOT IN ('Declined','Cancelled') AND NOT EXISTS (SELECT 1 FROM bookings b WHERE b.inquiry_id = l.lead_id)";

function dash_stage_counts(?int $staffId = null): array
{
    // One row per lead. New Inquiry is an internal submission/assignment stage and maps to general In Progress.
    $sql = "SELECT CASE
                    WHEN l.stage = 'Cancelled' THEN 'Cancelled'
                    WHEN l.stage = 'Declined' THEN 'Declined'
                    WHEN EXISTS (SELECT 1 FROM bookings b WHERE b.inquiry_id = l.lead_id) THEN 'Confirmed'
                    ELSE 'In Progress'
                END AS label, COUNT(*) AS n
            FROM leads l" . ($staffId ? " WHERE l.assigned_staff_id = ?" : "") . " GROUP BY label";
    return dash_counts($sql, $staffId ? [$staffId] : [], ['In Progress', 'Confirmed', 'Declined', 'Cancelled']);
}
function dash_upcoming_bookings(int $limit, ?int $staffId = null): array
{
    return dash_rows(
        "SELECT " . REF_BOOKING . " AS booking_ref, b.event_title AS event_name, b.event_date, b.arrangement,
                b.expected_guests AS pax, b.customer_name, b.assigned_staff, b.booking_status AS status
         FROM bookings b WHERE b.event_date >= " . dash_today() . " AND " . BOOKING_LIVE
        . ($staffId ? " AND b.assigned_staff_id = ?" : "")
        . " ORDER BY b.event_date ASC, b.booking_id ASC LIMIT " . (int)$limit, $staffId ? [$staffId] : []);
}
function dash_upcoming_count(?int $staffId = null): int
{
    return dash_val("SELECT COUNT(*) FROM bookings b WHERE b.event_date >= " . dash_today() . " AND " . BOOKING_LIVE
        . ($staffId ? " AND b.assigned_staff_id = ?" : ""), $staffId ? [$staffId] : []);
}
/** Quotations sent and still waiting for the customer's answer. */
function dash_pending_quotes(?int $staffId = null): int
{
    return dash_val("SELECT COUNT(*) FROM quotations q JOIN leads l ON l.lead_id = q.inquiry_id WHERE q.status = 'Sent'"
        . ($staffId ? " AND l.assigned_staff_id = ?" : ""), $staffId ? [$staffId] : []);
}
/**
 * Recent activity, built from what really happened in your tables (inquiries, quotations, bookings, payments,
 * chat messages, ticket changes) so it needs no separate log table.
 * Every kind of event is its own small query: if one fails (see "warnings"), the others still show.
 * $staffId limits it to that Sales Staff's own inquiries / bookings; $withTickets adds ticket changes (Admin).
 */
function dash_activity(int $limit, ?int $staffId = null, bool $withTickets = false, bool $withMessages = false): array
{
    $pieces = [
        'inquiries' => ["SELECT CONCAT('New catering inquiry submitted for ', l.event_name) AS text, " . REF_LEAD . " AS ref,
                                COALESCE(NULLIF(l.customer_name,''), 'Customer') AS source_name, 'Customer' AS source_role, l.created_at AS `at`
                         FROM leads l WHERE l.created_at IS NOT NULL", 'l.assigned_staff_id'],
        'quotes_sent' => ["SELECT CONCAT('Quotation (V', q.version, ') sent to customer for ', COALESCE(l.event_name, 'the event')) AS text,
                                  CONCAT('QT-', LPAD(q.inquiry_id, 4, '0'), '-v', q.version) AS ref,
                                  COALESCE(NULLIF(q.prepared_by,''), 'Sales Staff') AS source_name, 'Sales Staff' AS source_role, q.sent_at AS `at`
                           FROM quotations q LEFT JOIN leads l ON l.lead_id = q.inquiry_id WHERE q.sent_at IS NOT NULL", 'l.assigned_staff_id'],
        'quotes_accepted' => ["SELECT CONCAT('Customer accepted quotation for ', COALESCE(l.event_name, 'the event')) AS text,
                                      CONCAT('QT-', LPAD(q.inquiry_id, 4, '0'), '-v', q.version) AS ref,
                                      COALESCE(NULLIF(l.customer_name,''), 'Customer') AS source_name, 'Customer' AS source_role, q.responded_at AS `at`
                               FROM quotations q LEFT JOIN leads l ON l.lead_id = q.inquiry_id WHERE q.status = 'Accepted' AND q.responded_at IS NOT NULL", 'l.assigned_staff_id'],
        'bookings' => ["SELECT CONCAT('Booking confirmed for ', b.event_title) AS text, " . REF_BOOKING . " AS ref,
                               'System' AS source_name, 'Automated' AS source_role, b.created_at AS `at`
                        FROM bookings b WHERE b.created_at IS NOT NULL", 'b.assigned_staff_id'],
        'payments' => ["SELECT CONCAT('Payment received for ', b.event_title) AS text, " . REF_BOOKING . " AS ref,
                               'Payment Gateway' AS source_name, 'Automated' AS source_role, pr.paid_at AS `at`
                        FROM payment_requests pr JOIN bookings b ON b.booking_id = pr.booking_id WHERE pr.status = 'Paid' AND pr.paid_at IS NOT NULL", 'b.assigned_staff_id'],
    ];
    if ($withMessages) {
        $pieces['messages'] = ["SELECT CONCAT('Customer sent a message regarding ', l.event_name) AS text, " . REF_LEAD . " AS ref,
                                       COALESCE(NULLIF(l.customer_name,''), 'Customer') AS source_name, 'Customer' AS source_role, m.created_at AS `at`
                                FROM cib_messages m JOIN cib_conversations c ON c.id = m.conversation_id JOIN leads l ON l.lead_id = c.inquiry_id
                                WHERE m.sender_type = 'customer'", 'l.assigned_staff_id'];
    }
    if ($withTickets) {
        $pieces['tickets'] = ["SELECT ta.action AS text, COALESCE(NULLIF(t.ticket_number,''), CONCAT('TCK-', LPAD(t.id, 4, '0'))) AS ref,
                                      ta.performed_by AS source_name, ta.performed_by_role AS source_role, ta.created_at AS `at`
                               FROM cib_ticket_activity ta JOIN cib_tickets t ON t.id = ta.ticket_id", null];
    }
    $all = [];
    foreach ($pieces as $name => [$sql, $scope]) {
        $params = [];
        if ($scope && $staffId) { $sql .= " AND $scope = ?"; $params[] = $staffId; }
        $rows = dash_safe('activity.' . $name, fn() => dash_rows($sql . " ORDER BY `at` DESC LIMIT " . (int)$limit, $params), []);
        array_push($all, ...$rows);
    }
    usort($all, fn($x, $y) => strcmp((string)$y['at'], (string)$x['at']));
    return array_slice($all, 0, $limit);
}

/* Role-specific builders. */
function build_admin(): array
{
    $open = DASH_OPEN_TICKET;
    $m = [
        'total_customers'  => dash_safe('total_customers',  fn() => dash_val("SELECT COUNT(*) FROM users u JOIN roles r ON r.role_id = u.role_id WHERE r.role_name = 'Customer'"), 0),
        'active_employees' => dash_safe('active_employees', fn() => dash_val("SELECT COUNT(*) FROM users u JOIN roles r ON r.role_id = u.role_id WHERE u.account_status = 'Active' AND r.role_name <> 'Customer'"), 0),
        'active_inquiries' => dash_safe('active_inquiries', fn() => dash_val("SELECT COUNT(*) FROM leads l WHERE " . LEAD_ACTIVE), 0),
        'upcoming_bookings'=> dash_safe('upcoming_bookings',fn() => dash_upcoming_count(), 0),
        'open_tickets'     => dash_safe('open_tickets',     fn() => dash_val("SELECT COUNT(*) FROM cib_tickets WHERE status IN $open"), 0),
    ];
    $unassigned = dash_safe('unassigned', fn() => dash_val("SELECT COUNT(*) FROM leads l WHERE l.assigned_staff_id IS NULL AND l.stage = 'New Inquiry' AND NOT EXISTS (SELECT 1 FROM bookings b WHERE b.inquiry_id = l.lead_id)"), 0);
    $unpaid     = dash_safe('unpaid', fn() => dash_val("SELECT COUNT(*) FROM bookings b WHERE b.payment_status IN ('Unpaid','Partial','Partially Paid') AND " . BOOKING_LIVE), 0);

    return [
        'metrics'          => $m,
        'inquiry_stages'   => dash_safe('inquiry_stages', fn() => dash_stage_counts(), []),
        'booking_statuses' => dash_safe('booking_statuses', fn() => dash_counts(
            "SELECT b.booking_status AS label, COUNT(*) AS n FROM bookings b GROUP BY b.booking_status", [],
            ['Confirmed', 'Preparing', 'Ready for Pickup', 'Out for Delivery', 'Service Scheduled', 'Completed']), []),
        'booking_services' => dash_safe('booking_services', fn() => dash_booking_services(), []),
        'pending_actions'  => [
            ['label' => 'Unassigned Inquiries Awaiting Staff Assignment', 'count' => $unassigned, 'button' => 'Manage', 'page' => 'manager-admin-inquiries.html'],
            ['label' => 'Bookings Awaiting Payment',                      'count' => $unpaid,     'button' => 'View',   'page' => 'manager-admin-bookings.html'],
            ['label' => 'Open Customer Support Tickets',                  'count' => $m['open_tickets'], 'button' => 'View', 'page' => 'manager-admin-ticket.html'],
        ],
        'upcoming_bookings' => dash_safe('upcoming_list', fn() => dash_upcoming_bookings(5), []),
        'activity'          => dash_safe('activity', fn() => dash_activity(7, null, true), []),
    ];
}

function build_manager(): array
{
    $m = [
        'active_inquiries'     => dash_safe('active_inquiries', fn() => dash_val("SELECT COUNT(*) FROM leads l WHERE " . LEAD_ACTIVE), 0),
        'unassigned_inquiries' => dash_safe('unassigned', fn() => dash_val("SELECT COUNT(*) FROM leads l WHERE l.assigned_staff_id IS NULL AND l.stage = 'New Inquiry' AND NOT EXISTS (SELECT 1 FROM bookings b WHERE b.inquiry_id = l.lead_id)"), 0),
        'pending_quotations'   => dash_safe('pending_quotes', fn() => dash_pending_quotes(), 0),
        'upcoming_bookings'    => dash_safe('upcoming_bookings', fn() => dash_upcoming_count(), 0),
    ];

    $attention = dash_safe('attention', function () {
        $today = dash_today();
        $conflicts = dash_val("SELECT COUNT(*) FROM (SELECT b.event_date FROM bookings b WHERE b.event_date >= $today AND " . BOOKING_LIVE
            . " AND b.assigned_staff_id IS NOT NULL GROUP BY b.event_date, b.assigned_staff_id HAVING COUNT(*) > 1) x");
        return [
            ['label' => 'Large Events', 'hint' => 'Active inquiries with ' . DASH_LARGE_EVENT_PAX . ' PAX or more',
             'count' => dash_val("SELECT COUNT(*) FROM leads l WHERE " . LEAD_ACTIVE . " AND l.expected_guests >= " . DASH_LARGE_EVENT_PAX), 'page' => 'manager-admin-inquiries.html'],
            ['label' => 'Scheduling Conflicts', 'hint' => 'Bookings where one staff member has two events on the same date',
             'count' => $conflicts, 'page' => 'manager-admin-bookings.html'],
            ['label' => 'Overdue Payment Requests', 'hint' => 'Full-payment requests past their due date and still unpaid',
             'count' => dash_val("SELECT COUNT(*) FROM payment_requests WHERE status = 'Pending' AND due_date < $today"), 'page' => 'manager-admin-bookings.html'],
            ['label' => 'Expired Quotations', 'hint' => 'Sent quotations past their validity date with no customer response',
             'count' => dash_val("SELECT COUNT(*) FROM quotations WHERE status = 'Sent' AND valid_until IS NOT NULL AND valid_until < $today"), 'page' => 'manager-admin-inquiries.html'],
        ];
    }, []);

    return [
        'metrics'        => $m,
        'inquiry_stages' => dash_safe('inquiry_stages', fn() => dash_stage_counts(), []),
        'sales_workload' => dash_safe('workload', fn() => dash_rows(
            "SELECT u.user_id AS staff_id, u.full_name AS name,
                    (SELECT COUNT(*) FROM leads l WHERE l.assigned_staff_id = u.user_id AND " . LEAD_ACTIVE . ") AS active_inquiries,
                    (SELECT COUNT(*) FROM bookings b WHERE b.assigned_staff_id = u.user_id AND b.event_date >= " . dash_today() . " AND " . BOOKING_LIVE . ") AS upcoming_bookings
             FROM users u JOIN roles r ON r.role_id = u.role_id
             WHERE r.role_name LIKE '%Sales%' AND u.account_status = 'Active' ORDER BY u.full_name"), []),
        'attention'         => $attention,
        'upcoming_bookings' => dash_safe('upcoming_list', fn() => dash_upcoming_bookings(6), []),
        'activity'          => dash_safe('activity', fn() => dash_activity(7), []),
    ];
}

function build_sales(int $uid): array
{
    $m = [
        'my_active_inquiries' => dash_safe('my_active', fn() => dash_val("SELECT COUNT(*) FROM leads l WHERE l.assigned_staff_id = ? AND " . LEAD_ACTIVE, [$uid]), 0),
        'pending_quotations'  => dash_safe('my_quotes', fn() => dash_pending_quotes($uid), 0),
        'my_upcoming_bookings'=> dash_safe('my_bookings', fn() => dash_upcoming_count($uid), 0),
        // conversations that hold a customer message newer than the last time this staff opened the chat
        'unread_messages'     => dash_safe('my_unread', fn() => dash_val(
            "SELECT COUNT(DISTINCT c.id) FROM cib_conversations c JOIN leads l ON l.lead_id = c.inquiry_id
             WHERE l.assigned_staff_id = ? AND EXISTS (SELECT 1 FROM cib_messages m WHERE m.conversation_id = c.id AND m.sender_type = 'customer'
                   AND m.created_at > COALESCE(c.sales_read_at, '1970-01-01'))", [$uid]), 0),
    ];

    $attention = dash_safe('attention', function () use ($uid) {
        $unread = dash_rows(
            "SELECT " . REF_LEAD . " AS inquiry_ref, l.event_name, l.customer_name,
                    (SELECT m.message FROM cib_messages m WHERE m.conversation_id = c.id AND m.sender_type = 'customer' ORDER BY m.id DESC LIMIT 1) AS message,
                    (SELECT m.created_at FROM cib_messages m WHERE m.conversation_id = c.id AND m.sender_type = 'customer' ORDER BY m.id DESC LIMIT 1) AS `at`,
                    'unread' AS kind
             FROM cib_conversations c JOIN leads l ON l.lead_id = c.inquiry_id
             WHERE l.assigned_staff_id = ? AND EXISTS (SELECT 1 FROM cib_messages m WHERE m.conversation_id = c.id AND m.sender_type = 'customer'
                   AND m.created_at > COALESCE(c.sales_read_at, '1970-01-01'))
             ORDER BY `at` DESC LIMIT 5", [$uid]);
        $fresh = dash_rows(
            "SELECT " . REF_LEAD . " AS inquiry_ref, l.event_name, l.customer_name, NULL AS message,
                    COALESCE(l.claimed_at, l.created_at) AS `at`, 'new' AS kind
             FROM leads l WHERE l.assigned_staff_id = ? AND l.stage = 'New Inquiry' ORDER BY `at` DESC LIMIT 5", [$uid]);
        return array_slice(array_merge($fresh, $unread), 0, 5);
    }, []);

    return [
        'metrics'           => $m,
        'attention'         => $attention,
        'inquiry_stages'    => dash_safe('stages', fn() => dash_stage_counts($uid), []),
        'upcoming_bookings' => dash_safe('upcoming_list', fn() => dash_upcoming_bookings(5, $uid), []),
        'activity'          => dash_safe('activity', fn() => dash_activity(6, $uid, false, true), []),
    ];
}

/** Customer Service: support tickets are shared by all CS staff (same as tickets-api.php), so no per-staff filter. */
function build_cs(): array
{
    $open = DASH_OPEN_TICKET;
    $lastSender  = "(SELECT x.sender_type FROM cib_ticket_messages x WHERE x.ticket_id = t.id ORDER BY x.id DESC LIMIT 1)";
    $lastMessage = "(SELECT x.message FROM cib_ticket_messages x WHERE x.ticket_id = t.id ORDER BY x.id DESC LIMIT 1)";
    // customer messages written after the last staff reply
    $unreadN = "(SELECT COUNT(*) FROM cib_ticket_messages x WHERE x.ticket_id = t.id AND x.sender_type = 'customer'
                  AND x.id > COALESCE((SELECT MAX(s.id) FROM cib_ticket_messages s WHERE s.ticket_id = t.id AND s.sender_type <> 'customer'), 0))";

    $m = [
        'open_tickets'        => dash_safe('open', fn() => dash_val("SELECT COUNT(*) FROM cib_tickets t WHERE t.status IN $open"), 0),
        'requiring_action'    => dash_safe('action', fn() => dash_val("SELECT COUNT(*) FROM cib_tickets t WHERE t.status IN $open AND $lastSender = 'customer'"), 0),
        'unread_messages'     => dash_safe('unread', fn() => dash_val("SELECT COALESCE(SUM($unreadN), 0) FROM cib_tickets t WHERE t.status IN $open"), 0),
        'resolved_this_month' => dash_safe('resolved', fn() => dash_val("SELECT COUNT(*) FROM cib_tickets t WHERE t.status = 'Resolved' AND t.updated_at >= " . "'" . date('Y-m-01') . "'"), 0),
    ];

    $base = "SELECT t.id AS ticket_id, COALESCE(NULLIF(t.ticket_number,''), CONCAT('TCK-', LPAD(t.id, 4, '0'))) AS ticket_number,
                    t.subject, t.status, t.priority, t.updated_at, COALESCE(NULLIF(TRIM(u.full_name),''), CONCAT('Customer #', t.customer_id)) AS customer_name,
                    $lastMessage AS last_message, $unreadN AS unread, CASE WHEN $lastSender = 'customer' THEN 1 ELSE 0 END AS awaiting_staff
             FROM cib_tickets t LEFT JOIN users u ON u.user_id = t.customer_id";

    return [
        'metrics'   => $m,
        'attention' => dash_safe('attention', fn() => dash_rows(
            "$base WHERE t.status IN $open AND ($lastSender = 'customer' OR t.priority IN ('Urgent','High'))
             ORDER BY awaiting_staff DESC, FIELD(t.priority,'Urgent','High','Medium','Low'), t.updated_at DESC LIMIT 5"), []),
        'inbox'     => dash_safe('inbox', fn() => dash_rows("$base ORDER BY t.updated_at DESC LIMIT 5"), []),
        'ticket_statuses'   => dash_safe('t_status', fn() => dash_counts("SELECT status AS label, COUNT(*) AS n FROM cib_tickets GROUP BY status", [],
            ['Open', 'In Progress', 'Pending', 'Resolved']), []),
        'ticket_priorities' => dash_safe('t_priority', fn() => dash_counts("SELECT priority AS label, COUNT(*) AS n FROM cib_tickets GROUP BY priority", [],
            ['Urgent', 'High', 'Medium', 'Low']), []),
        'recent_tickets'    => dash_safe('recent', fn() => dash_rows("$base ORDER BY t.updated_at DESC LIMIT 5"), []),
    ];
}

/* Request handling. */
if (($_SERVER['REQUEST_METHOD'] ?? 'GET') !== 'GET') {
    header('Allow: GET');
    dash_out(['success' => false, 'message' => 'Method not allowed.'], 405);
}

$uid = $_SESSION['user_id'] ?? null;
if (!is_int($uid) || $uid < 1) {
    dash_out(['success' => false, 'message' => 'Please log in to continue.', 'code' => 'session_expired'], 401);
}
session_write_close();

try {
    require_once __DIR__ . '/config/database.php';     // gives $conn (mysqli), same as tickets-api.php

    $me = dash_rows("SELECT u.account_status AS status, u.full_name, r.role_name FROM users u INNER JOIN roles r ON r.role_id = u.role_id WHERE u.user_id = ? LIMIT 1", [$uid])[0] ?? null;
    if (!$me || $me['status'] !== 'Active') {
        dash_out(['success' => false, 'message' => 'Your account is no longer active. Please log in again.', 'code' => 'session_expired'], 401);
    }
    $roleName = strtolower((string)$me['role_name']);
    $role = match (true) {
        str_contains($roleName, 'admin')                                  => 'admin',
        str_contains($roleName, 'manager')                                => 'manager',
        str_contains($roleName, 'sales')                                  => 'sales',
        str_contains($roleName, 'customer service'), str_contains($roleName, 'support') => 'customer-service',
        default                                                           => '',
    };
    if ($role === '') {
        dash_out(['success' => false, 'message' => 'You are not authorized to view this dashboard.'], 403);
    }

    $payload = match ($role) {
        'admin'            => build_admin(),
        'manager'          => build_manager(),
        'sales'            => build_sales($uid),
        'customer-service' => build_cs(),
    };
} catch (Throwable $e) {
    dash_out(['success' => false, 'message' => DASH_DEBUG ? $e->getMessage() : 'Unable to load dashboard data.'], 500);
}

dash_out(array_merge(
    ['success' => true, 'role' => $role, 'role_name' => $me['role_name'], 'user_name' => (string)$me['full_name'], 'generated_at' => date('c')],
    $payload,
    DASH_DEBUG && $warnings ? ['warnings' => $warnings] : []
));
