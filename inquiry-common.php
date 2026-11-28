<?php
/**
 * inquiry-common.php - shared by customer-inquiries-api.php, sales-available.php, sales-inquiries.php
 * Put it in the SAME folder as those files. Keeps one set of attribute names for the whole inquiry flow.
 *
 * FLOW:  customer submits  -> leads row: stage "New Inquiry", assigned_staff_id NULL   (NO chat yet)
 *        sales "Available" -> shows leads where assigned_staff_id IS NULL
 *        sales "Accept"    -> assigned_staff_id = that staff, stage "In Progress", chat conversation created
 *        sales "Inquiries" -> shows leads where assigned_staff_id = logged-in staff
 */
$DB_CATERING = 'catering_crm';   // leads table
$DB_CRM      = 'catering_crm';   // customers + conversation compatibility tables

const STAGE_NEW = 'New Inquiry';
const STAGE_PROGRESS = 'In Progress';

date_default_timezone_set('Asia/Manila');
ini_set('display_errors', '0');
error_reporting(E_ALL);
ob_start();
if (PHP_SAPI !== 'cli') {
    header('Content-Type: application/json; charset=utf-8');
    header('Cache-Control: no-store');
}

function out(array $p, int $status = 200): void {
    if (ob_get_length()) ob_clean();
    http_response_code($status);
    echo json_encode($p, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
    exit;
}
function fail(string $m, int $status = 400): void { out(['success' => false, 'message' => $m], $status); }
if (PHP_SAPI === 'cli') {
    set_exception_handler(function ($e) { error_log('CLI request failed: ' . get_class($e) . ' (' . (int)$e->getCode() . ')'); exit(1); });
} else {
    set_exception_handler(function ($e) {
        error_log('inquiry-common: ' . get_class($e) . ' (' . (int)$e->getCode() . '): ' . $e->getMessage());
        fail('An unexpected database error occurred. Please try again later.', 500);
    });
}

if (PHP_SAPI !== 'cli' && session_status() === PHP_SESSION_NONE) session_start();

require_once __DIR__ . '/config/database.php';

/* Real primary key of leads (lead_id on your database; falls back to id) */
$pkRow = $db->query("SHOW KEYS FROM leads WHERE Key_name = 'PRIMARY'")->fetch();
$LEAD_PK = $pkRow['Column_name'] ?? 'lead_id';
/** PAX / guests only exist for Buffet with Setup (on-site). Pickup and Delivery have none. Keep in sync with crmArrangementHasPax() in pages.js. */
function arrangementHasPax($arrangement): bool {
    return (bool)preg_match('/buffet|set[-_ ]?up|on[-_ ]?site/i', (string)$arrangement);
}

function arrangementCanonical(string $arrangement): string {
    if (stripos($arrangement, 'pick') !== false) return 'pickup';
    if (stripos($arrangement, 'deliver') !== false) return 'delivery';
    return 'on_site_catering';
}

function arrangementDisplay(string $arrangement): string {
    return match (strtolower(str_replace(['-', '_'], ' ', trim($arrangement)))) {
        'pickup', 'customer pickup' => 'Customer Pickup',
        'delivery', 'food delivery' => 'Delivery',
        'on site catering', 'onsite catering', 'buffet with setup', 'buffet with set up' => 'Buffet with setup',
        default => $arrangement,
    };
}

const DELIVERY_FEE_DEFAULT = 450;   // PHP; sales staff can change it per address
/** Buffet with Setup: fixed service fee by the customer's PAX (not multiplied by PAX). [max PAX, fee] */
const BUFFET_FEE_BRACKETS = [[25, 1000], [50, 1500], [75, 2000], [100, 2500], [150, 3500], [200, 4500]];
function arrangementIsPickup($arrangement): bool { return stripos((string)$arrangement, 'pick') !== false; }
function arrangementIsDelivery($arrangement): bool { return !arrangementIsPickup($arrangement) && stripos((string)$arrangement, 'deliver') !== false; }

/** Starting additional fee + a short note, from the arrangement and the customer's PAX. Sales staff can edit it on Delivery and Buffet with Setup. */
function serviceFeeFor($arrangement, $pax): array {
    if (arrangementIsPickup($arrangement)) return ['fee' => 0, 'note' => 'Customer pickup has no additional fee.'];
    if (arrangementIsDelivery($arrangement)) return ['fee' => DELIVERY_FEE_DEFAULT, 'note' => 'Delivery fee depends on the customer\'s address (default ' . DELIVERY_FEE_DEFAULT . ').'];
    $pax = (int)$pax;
    $lo = 1;
    foreach (BUFFET_FEE_BRACKETS as [$max, $fee]) {
        if ($pax >= 1 && $pax <= $max) return ['fee' => $fee, 'note' => $lo . '-' . $max . ' PAX bracket', 'bracket' => $lo . '-' . $max . ' PAX'];
        $lo = $max + 1;
    }
    return ['fee' => 0, 'note' => $pax > 0 ? 'More than 200 PAX: enter the setup fee.' : 'No guest count on the inquiry: enter the setup fee.'];
}

/* ---- Event time (pickup / delivery / event start). Keep the hours equal to EVENT_TIME_MIN / EVENT_TIME_MAX in customer-pages.js. ---- */
const EVENT_TIME_MIN = '08:00';   // 8:00 AM
const EVENT_TIME_MAX = '20:00';   // 8:00 PM
/** "Pickup time" / "Delivery time" / "Event time", from the catering arrangement. */
function eventTimeLabel($arrangement): string {
    if (arrangementIsPickup($arrangement)) return 'Pickup time';
    if (arrangementIsDelivery($arrangement)) return 'Delivery time';
    return 'Event time';
}
/** Accepts "14:30" or "14:30:00"; returns "14:30" or '' when it is empty / invalid / outside 8:00 AM - 8:00 PM. */
function eventTimeClean($v): string {
    if (!preg_match('/^([01]?\d|2[0-3]):([0-5]\d)(?::[0-5]\d)?$/', trim((string)$v), $m)) return '';
    $t = str_pad($m[1], 2, '0', STR_PAD_LEFT) . ':' . $m[2];
    return ($t >= EVENT_TIME_MIN && $t <= EVENT_TIME_MAX) ? $t : '';
}
/** "14:30:00" -> "2:30 PM" ('' when there is no time, e.g. bookings made before this feature). */
function eventTimeDisplay($v): string {
    $v = trim((string)$v);
    if ($v === '' || !preg_match('/^(\d{1,2}):(\d{2})/', $v, $m)) return '';
    return date('g:i A', strtotime(sprintf('%02d:%02d', $m[1], $m[2])));
}

function now(): string { return date('Y-m-d H:i:s'); }

function sessionFirst(array $keys): string {
    foreach ($keys as $k) if (!empty($_SESSION[$k])) return trim((string)$_SESSION[$k]);
    return '';
}
function normRole($r): string {
    return trim(preg_replace('/\s+/', ' ', preg_replace('/[_-]+/', ' ', strtolower((string)$r))));
}

/** Logged-in sales staff (id + name). Fails if not logged in / wrong role. */
function requireSalesStaff(): array {
    $id = (int)sessionFirst(['user_id']);
    if (!$id) fail('Please log in again.', 401);
    $role = normRole(sessionFirst(['role_name', 'role', 'user_role']));
    $allowed = ['sales staff', 'sales', 'admin', 'manager'];
    if (!in_array($role, $allowed, true)) fail('You do not have access to sales inquiries.', 403);
    $name = sessionFirst(['user_name', 'name', 'full_name']) ?: 'Sales Staff';
    return ['id' => $id, 'name' => $name];
}

/** One lead row -> the field names pages.js already reads (crmInquiryFields / crmAvCardHTML). */
function shapeLead(array $r): array {
    $idVal = (int)($r['lead_id'] ?? $r['id'] ?? 0);
    $ref = !empty($r['inquiry_ref']) ? $r['inquiry_ref'] : 'INQ-' . str_pad((string)$idVal, 4, '0', STR_PAD_LEFT);
    $arrangementDetails = $r['delivery_details'] ?? null;
    if (is_string($arrangementDetails)) {
        $decoded = json_decode($arrangementDetails, true);
        $arrangementDetails = is_array($decoded) ? $decoded : null;
    }
    if (!is_array($arrangementDetails)) $arrangementDetails = null;
    $arrangement = (string)($r['arrangement'] ?? '');
    return [
        'id'             => $idVal,
        'lead_id'        => $idVal,
        'inquiry_ref'    => $ref,
        'reference'      => $ref,
        'customer_id'    => isset($r['customer_id']) ? (int)$r['customer_id'] : null,
        'customer_name'  => $r['customer_name'] ?: 'Customer',
        'customer_email' => $r['customer_email'] ?? '',
        'event_name'     => $r['event_name'],
        'event_title'    => $r['event_name'],
        'event_date'     => $r['event_date'],
        'event_time'     => substr((string)($r['event_time'] ?? ''), 0, 5),            // "14:30" or ''
        'event_time_display' => eventTimeDisplay($r['event_time'] ?? ''),               // "2:30 PM" or ''
        'event_time_label'   => eventTimeLabel($r['arrangement'] ?? ''),                // Pickup / Delivery / Event time
        'event_location' => $r['event_location'],
        'venue'          => $r['event_location'],
        'event_location_label' => arrangementIsPickup($arrangement) ? 'Pickup Location' : (arrangementIsDelivery($arrangement) ? 'Delivery Address' : 'Event Venue / Address'),
        // Expose the legacy JSON column generically while preserving its delivery-only API alias.
        'arrangement_details' => $arrangementDetails,
        'delivery_details' => arrangementIsDelivery($arrangement) ? $arrangementDetails : null,
        'arrangement'    => arrangementDisplay($arrangement),
        'expected_guests'=> (arrangementHasPax($r['arrangement']) && !empty($r['expected_guests'])) ? (int)$r['expected_guests'] : '',
        'pax'            => (arrangementHasPax($r['arrangement']) && !empty($r['expected_guests'])) ? (int)$r['expected_guests'] : '',
        'package'        => $r['package'] ?? '',
        'dishes'         => !empty($r['dishes']) ? (json_decode($r['dishes'], true) ?: []) : [],
        'customer_notes' => $r['notes'] ?? '',
        'stage'          => $r['stage'],
        'status'         => inquiryGeneralStatus((string)$r['stage']),
        'inquiry_status' => inquiryGeneralStatus((string)$r['stage']),
        'workflow_label' => inquiryWorkflowLabel((string)$r['stage']),
        'assigned_staff' => $r['assigned_staff_name'] ?? '',
        'submitted_at'   => $r['created_at'],
        'created_at'     => $r['created_at'],
        'conversation_id'  => isset($r['conversation_id']) ? (int)$r['conversation_id'] : null,
        'unread_count'     => isset($r['unread_count']) ? (int)$r['unread_count'] : 0,
        'claimed_at'       => $r['claimed_at'] ?? null,
        'assigned_date'    => $r['claimed_at'] ?? null,
        // Additional fee on the quotation: Pickup has none, Delivery starts at DELIVERY_FEE_DEFAULT (depends on the address), Buffet with Setup starts at 0.
        // Sales staff can edit the fee on Delivery and Buffet with Setup.
        'service_fee_default'  => serviceFeeFor($r['arrangement'] ?? '', $r['expected_guests'] ?? 0)['fee'],
        'service_fee_note'     => serviceFeeFor($r['arrangement'] ?? '', $r['expected_guests'] ?? 0)['note'],
        'service_fee_bracket'  => serviceFeeFor($r['arrangement'] ?? '', $r['expected_guests'] ?? 0)['bracket'] ?? '',
        'service_fee_editable' => !arrangementIsPickup($r['arrangement'] ?? ''),
    ];
}

/** General status is derived from authoritative workflow state; stage remains the detailed workflow value. */
function inquiryGeneralStatus(string $stage, bool $hasBooking = false): string {
    if ($stage === 'Cancelled') return 'Cancelled';
    if ($stage === 'Declined') return 'Declined';
    if ($hasBooking) return 'Confirmed';
    return 'In Progress';
}

function inquiryWorkflowLabel(string $stage, ?array $quote = null, bool $hasBooking = false): string {
    if ($stage === 'Cancelled') return 'Cancelled';
    if ($stage === 'Declined') return 'Declined';
    if ($hasBooking) return 'Booking Confirmed';
    if ($quote && ($quote['status'] ?? '') === 'Accepted') return 'Quotation Accepted';
    return match ($stage) {
        'New Inquiry' => 'Submitted',
        'Quotation Sent' => 'Quotation Sent',
        'Negotiation' => 'Negotiation',
        default => 'Under Review',
    };
}
/** Find a lead by "INQ-0007" (or plain numeric id). */
function leadIdFromRef(string $ref): int {
    return (int)preg_replace('/\D/', '', $ref);
}

/* Shared by sales-available.php and sales-inquiries.php: adds customer_email, customer_phone, menu_items. */
/** First non-empty value among the candidate column names. */
function firstOf(array $row, array $keys): string {
    foreach ($keys as $k) if (isset($row[$k]) && trim((string)$row[$k]) !== '') return trim((string)$row[$k]);
    return '';
}

/** menu_items + menu_item_tiers for the ids used in $rows. Tries the databases where the menu tables may live. */
function loadMenu(AppDatabase $db, array $rows): array {
    global $DB_CATERING, $DB_CRM;
    $ids = [];
    foreach ($rows as $r) foreach ((json_decode($r['menu_item_ids'] ?? '[]', true) ?: []) as $id) if ((int)$id) $ids[(int)$id] = true;
    $ids = array_keys($ids);
    if (!$ids) return [];
    $in = implode(',', array_fill(0, count($ids), '?'));
    foreach (array_unique([$DB_CATERING, $DB_CRM]) as $schema) {
        try {
            $st = $db->prepare("SELECT menu_item_id, item_name, category, display_price, serving_specs, photo_path FROM `$schema`.menu_items WHERE menu_item_id IN ($in)");
            $st->execute($ids);
            $menu = [];
            foreach ($st->fetchAll() as $m) {
                $menu[(int)$m['menu_item_id']] = ['name' => $m['item_name'], 'category' => (string)($m['category'] ?? ''), 'price' => $m['display_price'],
                    'specs' => $m['serving_specs'], 'photo' => $m['photo_path'], 'tiers' => []];
            }
            try {
                $tt = $db->prepare("SELECT menu_item_id, tier_id, tier_name, price, pax_description FROM `$schema`.menu_item_tiers WHERE menu_item_id IN ($in) AND is_active = 1 ORDER BY sort_order");
                $tt->execute($ids);
                foreach ($tt->fetchAll() as $t) if (isset($menu[(int)$t['menu_item_id']])) $menu[(int)$t['menu_item_id']]['tiers'][] = $t;
            } catch (Throwable $e) { /* no tiers table here */ }
            if ($menu) return $menu;
        } catch (Throwable $e) { /* menu_items is not in this database: try the next */ }
    }
    return [];
}

/** Primary-key column of the users table (id or user_id, whichever your database uses). */
function usersPk(AppDatabase $db, string $schema): string {
    static $pk = null;
    if ($pk !== null) return $pk;
    try {
        $r = $db->query("SHOW KEYS FROM `$schema`.users WHERE Key_name = 'PRIMARY'")->fetch();
        $pk = $r['Column_name'] ?? 'id';
    } catch (Throwable $e) { $pk = 'id'; }
    return $pk;
}

/** Adds customer_email, customer_phone and menu_items to each shaped lead. */
/** The customer's profile photo as a web path (uploads/profile/...), or '' when they have none. Staff never have photos. */
function customerPhotoUrl(array $user): string {
    $rel = trim((string)($user['photo_path'] ?? ''));
    if ($rel === '' || strpos($rel, 'uploads/profile/') !== 0) return '';
    $file = __DIR__ . '/' . $rel;
    return $rel . '?v=' . (is_file($file) ? (string)filemtime($file) : '1');
}

function enrichLeads(AppDatabase $db, string $crmDb, array $rows): array {
    // General inquiry status depends on whether the lead has been converted to a booking.
    $bookingLeads = [];
    $leadIds = array_values(array_unique(array_filter(array_map(static fn($r) => (int)($r['lead_id'] ?? $r['id'] ?? 0), $rows))));
    if ($leadIds) {
        try {
            $in = implode(',', array_fill(0, count($leadIds), '?'));
            $st = $db->prepare("SELECT DISTINCT inquiry_id FROM bookings WHERE inquiry_id IN ($in)");
            $st->execute($leadIds);
            foreach ($st->fetchAll(AppDatabase::FETCH_COLUMN) as $inquiryId) $bookingLeads[(int)$inquiryId] = true;
        } catch (Throwable $e) { error_log('enrichLeads: could not read inquiry bookings: ' . $e->getMessage()); }
    }
    // 1) the customer's account (email / phone live in the users table; there is no customers table)
    // customers AND the assigned staff live in the users table (staff are loaded here for their profile photo)
    $ids = array_values(array_unique(array_filter(array_merge(
        array_map(fn($r) => (int)($r['customer_id'] ?? 0), $rows),
        array_map(fn($r) => (int)($r['assigned_staff_id'] ?? 0), $rows)
    ))));
    $customers = [];
    if ($ids) {
        try {
            $in = implode(',', array_fill(0, count($ids), '?'));
            $upk = usersPk($db, $crmDb);
            $st = $db->prepare("SELECT * FROM `$crmDb`.users WHERE `$upk` IN ($in)");
            $st->execute($ids);
            foreach ($st->fetchAll() as $c) $customers[(int)$c[$upk]] = $c;
        } catch (Throwable $e) { error_log('enrichLeads: could not read the users table: ' . $e->getMessage()); }
    }

    // menu items (name / photo / tiers) for every id used by these inquiries
    $menu = loadMenu($db, $rows);

    $out = [];
    foreach ($rows as $r) {
        $s = shapeLead($r);
        $hasBooking = isset($bookingLeads[(int)($r['lead_id'] ?? $r['id'] ?? 0)]);
        $s['status'] = inquiryGeneralStatus((string)($r['stage'] ?? ''), $hasBooking);
        $s['inquiry_status'] = $s['status'];
        $c = $customers[(int)($r['customer_id'] ?? 0)] ?? [];
        $email = firstOf($c, ['email', 'email_address']) ?: ($s['customer_email'] ?? '');
        $s['customer_email'] = $email;
        $s['customer_photo'] = customerPhotoUrl($c);
        $s['staff_photo'] = customerPhotoUrl($customers[(int)($r['assigned_staff_id'] ?? 0)] ?? []);   // '' = initials
        $s['customer_phone'] = firstOf($c, ['phone', 'phone_number', 'contact_number', 'contact_no', 'mobile', 'mobile_number', 'cellphone']);

        // 2) selected menu items. leads.dishes holds labels like "PORK ADOBO - 1/4 KG Portion (₱230.00)",
        //    leads.menu_item_ids holds the matching menu_items ids (same order) -> photo, tier PAX, price.
        $ids2 = json_decode($r['menu_item_ids'] ?? '[]', true) ?: [];
        $items = [];
        foreach ((array)$s['dishes'] as $i => $d) {
            $label = is_array($d) ? (string)($d['name'] ?? '') : trim((string)$d);
            if ($label === '') continue;
            $menuId = (int)($ids2[$i] ?? 0);
            $m = $menu[$menuId] ?? null;
            $name = $label; $tierName = ''; $price = ''; $qtyN = 1;
            // "NAME - TIER (price)" with an optional " x2" at the end = how many the customer ordered
            if (preg_match('/^(.*?)\s+-\s+(.*?)\s+\(([^()]*)\)(?:\s+x(\d+))?\s*$/u', $label, $mm)) {
                $name = $mm[1]; $tierName = $mm[2]; $price = $mm[3]; $qtyN = max(1, (int)($mm[4] ?? 1));
            }
            $pax = '';
            if ($m) {
                $name = $m['name'] ?: $name;
                foreach ($m['tiers'] as $t) {
                    if (strcasecmp($t['tier_name'], $tierName) === 0) {
                        // strip a trailing " PAX" (case-insensitive) so the UI doesn't render "20–25 PAX PAX"
                        $pax = trim(preg_replace('/\s+PAX\s*$/i', '', (string)$t['pax_description']));
                        break;
                    }
                }
                if ($tierName === '') { $price = $m['price']; $pax = trim(preg_replace('/\s+PAX\s*$/i', '', (string)$m['specs'])); }
            }
            // Clean the menu's serving text ("Good for 25 PAX", "Good for 2-3 person") down to its numbers: "25" / "2-3".
            $pLo = 0; $pHi = 0;
            if (preg_match('/(\d+)(?:\s*[-–—]\s*(\d+))?/u', $pax, $pm)) { $pLo = (int)$pm[1]; $pHi = (int)($pm[2] ?? $pm[1]); }
            $paxNice  = $pLo ? ($pHi > $pLo ? "$pLo-$pHi" : "$pLo") : '';
            $paxTotal = $pLo ? ($pHi > $pLo ? ($pLo * $qtyN) . '-' . ($pHi * $qtyN) : (string)($pLo * $qtyN)) : '';
            $unit     = (float)preg_replace('/[^\d.]/', '', (string)$price);
            $peso     = fn($n) => '₱' . number_format($n, 2);
            // same layout on every row:
            //   Quantity = "2 × LARGE (25 PAX)"        Details = "₱6,000.00 total · ₱3,000.00 each"  (one dish: just "₱3,000.00")
            $quantity = $qtyN . ' × ' . ($tierName !== '' ? $tierName : 'order') . ($paxNice !== '' ? ' (' . $paxNice . ' PAX)' : '');
            $details  = '';
            if ($unit > 0) $details = $qtyN > 1 ? $peso($unit * $qtyN) . ' total · ' . $price . ' each' : $price;
            elseif ($price !== '') $details = $price;
            $items[] = ['category' => $m['category'] ?? '', 'name' => $name, 'tier' => $tierName, 'pax' => $paxNice, 'price' => $price, 'photo' => $m['photo'] ?? '',
                        'qty_n' => $qtyN, 'quantity' => $quantity, 'details' => $details];
        }
        $s['menu_items'] = $items;
        $out[] = $s;
    }
    return $out;
}
