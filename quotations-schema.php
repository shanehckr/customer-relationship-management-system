<?php
/**
 * quotations-schema.php - shared by sales-inquiries.php, customer-inquiries-api.php,
 * sales-inbox-api.php and customer-inbox-api.php.
 * Creates the `quotations` table (and cib_messages.quotation_id) and holds the helpers every API uses,
 * so the sales screen, the customer's Quotation tab and the inbox card always show the same numbers.
 * Put it in the SAME folder as bookings-schema.php.
 *
 * Statuses: Draft (staff only) -> Sent -> Accepted | Declined   (an older version becomes "Superseded" when a newer one is sent)
 * DEPOSIT: 20% of the quotation total, for every service arrangement.
 */
const QUOTE_DEPOSIT_RATE = 0.20;

function ensureQuotationsSchema(PDO $db): void {
    $db->exec("CREATE TABLE IF NOT EXISTS quotations (
        quotation_id INT AUTO_INCREMENT PRIMARY KEY,
        inquiry_id INT NOT NULL,
        version INT NOT NULL DEFAULT 1,
        status VARCHAR(20) NOT NULL DEFAULT 'Draft',
        items TEXT NULL,
        subtotal DECIMAL(12,2) NOT NULL DEFAULT 0,
        total DECIMAL(12,2) NOT NULL DEFAULT 0,
        deposit_amount DECIMAL(12,2) NOT NULL DEFAULT 0,
        valid_until DATE NULL,
        notes TEXT NULL,
        prepared_by VARCHAR(120) NULL,
        prepared_by_id INT NULL,
        prepared_at DATETIME NULL,
        sent_at DATETIME NULL,
        responded_at DATETIME NULL,
        INDEX idx_quote_inquiry (inquiry_id)
    ) ENGINE=InnoDB");
    // v2 columns: discount, extra_charge (additional fee), deposit_rate (percent)
    foreach ([
        'discount'     => "DECIMAL(12,2) NOT NULL DEFAULT 0",
        'extra_charge' => "DECIMAL(12,2) NOT NULL DEFAULT 0",
        'deposit_rate' => "INT NOT NULL DEFAULT 20",
        'valid_until_time' => "TIME NULL",          // time of day the quotation stops being valid (with valid_until)
    ] as $col => $def) {
        $c = $db->prepare("SHOW COLUMNS FROM `quotations` LIKE ?");
        $c->execute([$col]);
        if (!$c->fetch()) $db->exec("ALTER TABLE `quotations` ADD COLUMN `$col` $def");
    }
    // the chat message that announces a quotation
    try {
        $st = $db->prepare("SHOW COLUMNS FROM `cib_messages` LIKE 'quotation_id'");
        $st->execute();
        if (!$st->fetch()) $db->exec("ALTER TABLE `cib_messages` ADD COLUMN `quotation_id` INT NULL DEFAULT NULL");
    } catch (PDOException $e) { /* cib_messages does not exist yet: the inbox APIs create it first */ }
}

/** Primary-key column of the leads table. The customer inbox does not load inquiry-common.php, so find it here when $LEAD_PK is not set. */
function quoteLeadPk(PDO $db): string {
    global $LEAD_PK;
    if (!empty($LEAD_PK)) return $LEAD_PK;
    static $pk = null;
    if ($pk !== null) return $pk;
    try {
        $r = $db->query("SHOW KEYS FROM leads WHERE Key_name = 'PRIMARY'")->fetch();
        $pk = $r['Column_name'] ?? 'lead_id';
    } catch (PDOException $e) { $pk = 'lead_id'; }
    return $pk;
}

function quoteRef(int $inquiryId): string { return 'QT-' . str_pad((string)$inquiryId, 4, '0', STR_PAD_LEFT); }
function quotePeso($v): string { return '₱ ' . number_format((float)$v, 2); }
function quoteDay($v): string { return $v ? date('M j, Y', strtotime((string)$v)) : ''; }
function quoteIso($v): string { return $v ? str_replace(' ', 'T', (string)$v) : ''; }

/* ---- Deadline = date + time (quotation "valid until", payment request "pay by"). No time saved = the end of that day. ---- */
const DEADLINE_TIME_MIN = '08:00';      // staff can set a deadline between 8:00 AM ...
const DEADLINE_TIME_MAX = '20:00';      // ... and 8:00 PM
const DEADLINE_DEFAULT_TIME = '23:59';  // later-day deadlines (no time chosen) end at 11:59 PM of that day
const DEADLINE_MIN_LEAD_SECONDS = 3600; // a deadline set for today must be at least 1 hour from now
/** "18:00:00" / "18:00" -> "18:00"; '' when empty or invalid. */
function deadlineTime($v): string {
    return preg_match('/^([01]?\d|2[0-3]):([0-5]\d)/', trim((string)$v), $m) ? str_pad($m[1], 2, '0', STR_PAD_LEFT) . ':' . $m[2] : '';
}
/** "2026-11-18" + "18:00" -> "2026-11-18 18:00:00" ('' when the date is empty). */
function deadlineAt($date, $time = null): string {
    $date = substr((string)$date, 0, 10);
    if (!preg_match('/^\d{4}-\d{2}-\d{2}$/', $date)) return '';
    $t = deadlineTime($time);
    return $date . ' ' . ($t !== '' ? $t . ':00' : '23:59:59');
}
function deadlineExpired($date, $time = null): bool {
    $at = deadlineAt($date, $time);
    return $at !== '' && date('Y-m-d H:i:s') > $at;
}
/** "Nov 18, 2026, 6:00 PM" (just the day when there is no time). */
/** "today, Nov 19, 2026" / "tomorrow, Nov 20, 2026" / "Nov 21, 2026" (from the day after tomorrow on, just the date). */
function deadlineDayLabel($date): string {
    $day = substr((string)$date, 0, 10);
    $text = quoteDay($date);
    if (!preg_match('/^\d{4}-\d{2}-\d{2}$/', $day)) return $text;
    if ($day === date('Y-m-d')) return 'today, ' . $text;
    if ($day === date('Y-m-d', strtotime('+1 day'))) return 'tomorrow, ' . $text;
    return $text;
}
function deadlineLabel($date, $time = null): string {
    $d = deadlineDayLabel($date);
    $t = deadlineTime($time);
    return $d !== '' && $t !== '' ? $d . ', ' . date('g:i A', strtotime($t)) : $d;
}
/**
 * A deadline typed by staff. Returns the time to save ("HH:MM:SS").
 * Today -> a time is required and must be at least 1 hour from now. Later day -> the time is optional (default 8:00 PM).
 */
function deadlineCheck(string $date, $timeIn, string $what): string {
    $raw = trim((string)$timeIn);
    $t = deadlineTime($raw);
    if ($raw !== '' && ($t === '' || $t < DEADLINE_TIME_MIN || $t > DEADLINE_TIME_MAX)) fail('The ' . $what . ' time must be between 8:00 AM and 8:00 PM.');
    if ($date === date('Y-m-d')) {
        if ($t === '') fail('The date is today, so choose a time for the ' . $what . ' (between 8:00 AM and 8:00 PM).');
        if (strtotime($date . ' ' . $t . ':00') < time() + DEADLINE_MIN_LEAD_SECONDS) {
            fail('The ' . $what . ' time must be at least 1 hour from now (and no later than 8:00 PM). Choose a later time, or a later date if the event allows it.');
        }
    }
    return ($t !== '' ? $t : DEADLINE_DEFAULT_TIME) . ':00';
}

/* ---- Quotation "valid until" (Sales Staff only; payment "pay by" keeps deadlineCheck above) ----
   8:00 AM - 11:00 PM (11:00 PM included), always on the hour or half hour (7:00, 7:30). Today -> a time is required and must be
   at least 1 hour from now, rounded up to the next :00 / :30 (7:10 PM -> earliest 8:30 PM). Later day -> the time is optional; when left empty the deadline is 11:59 PM of that day. Mirrors crmQuoteDeadlineProblem() in pages.js. */
const QUOTE_DEADLINE_TIME_MIN = '08:00';
const QUOTE_DEADLINE_TIME_MAX = '23:00';
const QUOTE_DEADLINE_DEFAULT_TIME = '23:59';   // a later day with no time chosen = the end of that day (11:59 PM)
const QUOTE_DEADLINE_BUFFER_SECONDS = 3600;
const QUOTE_DEADLINE_STEP_SECONDS = 1800;
/** Returns the time to save ("HH:MM:SS"). Fails with a message the staff member can act on. */
/**
 * Rush event = the event date is the earliest date a customer can choose, or sooner (today + 3 days, or + 4 after 9:00 PM; see customerEarliestEventDate()).
 * Only rush events have a deadline TIME. Every other event ends at 11:59 PM of the chosen date.
 * Keep equal to crmIsRushEvent() in pages.js.
 */
function quoteIsRushEvent($eventDate): bool {
    $d = substr((string)$eventDate, 0, 10);
    if (!preg_match('/^\d{4}-\d{2}-\d{2}$/', $d)) return false;
    $earliest = function_exists('customerEarliestEventDate') ? customerEarliestEventDate() : date('Y-m-d', strtotime('+3 days'));
    return $d <= $earliest;
}

/**
 * $eventDate: when given and the event is NOT a rush event, no time is asked for or kept: the deadline is 11:59 PM of $date (even when $date is today).
 * Rush event (or $eventDate = null): the rules below apply (today = a time is required, at least 1 hour from now, on the hour / half hour).
 */
function quoteDeadlineCheck(string $date, $timeIn, string $what, ?string $eventDate = null): string {
    if ($eventDate !== null && !quoteIsRushEvent($eventDate)) return QUOTE_DEADLINE_DEFAULT_TIME . ':00';
    $raw = trim((string)$timeIn);
    $t = deadlineTime($raw);
    if ($raw !== '' && ($t === '' || $t < QUOTE_DEADLINE_TIME_MIN || $t > QUOTE_DEADLINE_TIME_MAX)) fail('The ' . $what . ' time must be between 8:00 AM and 11:00 PM.');
    if ($t !== '' && (int)substr($t, 3, 2) % 30 !== 0) fail('Choose a ' . $what . ' time on the hour or half hour (for example 7:00 PM or 7:30 PM).');
    if ($date === date('Y-m-d')) {
        if ($t === '') fail('The date is today, so choose a time for the ' . $what . ' (between 8:00 AM and 11:00 PM).');
        $earliest = (int)(ceil((time() - (time() % 60) + QUOTE_DEADLINE_BUFFER_SECONDS) / QUOTE_DEADLINE_STEP_SECONDS) * QUOTE_DEADLINE_STEP_SECONDS);   // 7:10 PM -> 8:30 PM
        if (strtotime($date . ' ' . $t . ':00') < $earliest) {
            fail('The ' . $what . ' time must be at least 1 hour from now (earliest: ' . date('g:i A', $earliest) . ') and no later than 11:00 PM. Choose a later time, or a later date if the event allows it.');
        }
    }
    return ($t !== '' ? $t : QUOTE_DEADLINE_DEFAULT_TIME) . ':00';
}

/** Cleans the items a staff member typed. Returns [items, subtotal]. */
function quoteCleanItems($raw): array {
    if (is_string($raw)) $raw = json_decode($raw, true);
    if (!is_array($raw)) fail('Add at least one item to the quotation.');
    $items = []; $sub = 0.0;
    foreach ($raw as $r) {
        if (!is_array($r)) continue;
        $desc = trim((string)($r['description'] ?? ''));
        $qty  = (float)($r['quantity'] ?? 1);
        $unit = round((float)str_replace(',', '', (string)($r['unit_price'] ?? 0)), 2);
        $meta = [];
        foreach (['menu_item_id', 'category', 'tier', 'name', 'pax'] as $k) if (isset($r[$k]) && $r[$k] !== '') $meta[$k] = is_numeric($r[$k]) && $k === 'menu_item_id' ? (int)$r[$k] : mb_substr(trim((string)$r[$k]), 0, 160);
        if ($desc === '' && $unit <= 0) continue;
        if ($desc === '') fail('Every quotation item needs a description.');
        if (mb_strlen($desc) > 200) fail('An item description is too long (max 200 characters).');
        if ($qty <= 0 || $qty > 100000) fail('Item quantities must be greater than zero.');
        if ($unit < 0 || $unit > 100000000) fail('Item prices must be zero or more.');
        $amt = round($qty * $unit, 2);
        $sub += $amt;
        $items[] = array_merge($meta, ['description' => $desc, 'quantity' => $qty, 'unit_price' => $unit, 'amount' => $amt]);
    }
    if (!$items) fail('Add at least one item to the quotation.');
    return [$items, round($sub, 2)];
}

/** One quotations row -> the JSON every screen reads. */
function quoteShape(array $q, array $history = [], bool $forCustomer = false): array {
    $items = $q['items'] ? (json_decode($q['items'], true) ?: []) : [];
    $total = (float)$q['total'];
    $deposit = (float)$q['deposit_amount'];
    $rate = (int)($q['deposit_rate'] ?? 0) ?: (int)round(QUOTE_DEPOSIT_RATE * 100);
    $id = (int)$q['quotation_id'];
    $date = $q['sent_at'] ?: $q['prepared_at'];
    $ev = trim((string)($q['event_name'] ?? ''));      // event name of the inquiry (joined in the queries below)
    $out = [
        'quotation_id'   => $id,
        'inquiry_id'     => (int)$q['inquiry_id'],
        // customers see the event name; staff, admin and manager keep the unique QT-0000 code
        'reference'      => ($forCustomer && $ev !== '') ? $ev : quoteRef((int)$q['inquiry_id']),
        'quote_code'     => quoteRef((int)$q['inquiry_id']),
        'event_name'     => $ev,
        'version'        => (int)$q['version'],
        'title'          => ($ev !== '' ? $ev . ' (Quotation v' . (int)$q['version'] . ')' : 'Quotation v' . (int)$q['version']),
        'status'         => $q['status'],
        'items'          => $items,
        'subtotal'       => (float)$q['subtotal'],
        'total'          => $total,
        'amount'         => $total,
        'deposit_rate'   => $rate,
        'extra_charge'   => (float)($q['extra_charge'] ?? 0),
        'discount'       => (float)($q['discount'] ?? 0),
        'deposit_amount' => $deposit,
        'balance_after_deposit' => round($total - $deposit, 2),
        'valid_until'    => $q['valid_until'] ?: '',
        'valid_until_time' => deadlineTime($q['valid_until_time'] ?? ''),
        'validity'       => deadlineLabel($q['valid_until'], $q['valid_until_time'] ?? null),
        'date'           => quoteDay($date),
        'notes'          => (string)($q['notes'] ?? ''),
        'message'        => (string)($q['notes'] ?? ''),
        'prepared_by'    => (string)($q['prepared_by'] ?? ''),
        'prepared_at'    => quoteIso($q['prepared_at']),
        'sent_at'        => quoteIso($q['sent_at']),
        'responded_at'   => quoteIso($q['responded_at']),
        'is_expired'     => (bool)($q['valid_until'] && $q['status'] === 'Sent' && deadlineExpired($q['valid_until'], $q['valid_until_time'] ?? null)),
    ];
    if ($history) $out['history'] = $history;
    return $out;
}

/** Version list for the staff "Quotation Version History" block. */
function quoteHistory(array $rows, string $recipient = ''): array {
    return array_map(fn($r) => [
        'version' => (int)$r['version'], 'status' => $r['status'], 'recipient' => $recipient,
        'prepared_by' => (string)($r['prepared_by'] ?? ''), 'amount' => (float)$r['total'],
    ], $rows);
}

/**
 * Quotations for many inquiries at once.
 * $forCustomer = true hides Draft versions. Returns [inquiry_id => quotation JSON (the latest one, with ->history)].
 */
function quotesByInquiry(PDO $db, array $inquiryIds, bool $forCustomer = false, string $recipient = ''): array {
    $ids = array_values(array_unique(array_filter(array_map('intval', $inquiryIds))));
    if (!$ids) return [];
    $in = implode(',', array_fill(0, count($ids), '?'));
    $where = "WHERE q.inquiry_id IN ($in)" . ($forCustomer ? " AND q.status <> 'Draft'" : '') . " ORDER BY q.inquiry_id, q.version DESC";
    try {
        $st = $db->prepare("SELECT q.*, l.event_name FROM quotations q LEFT JOIN leads l ON l.`" . quoteLeadPk($db) . "` = q.inquiry_id $where");
        $st->execute($ids);
        $found = $st->fetchAll();
    } catch (PDOException $e) {       // never break the screen just because the event name could not be read
        error_log('quotesByInquiry: event name lookup failed: ' . $e->getMessage());
        $st = $db->prepare("SELECT q.* FROM quotations q $where");
        $st->execute($ids);
        $found = $st->fetchAll();
    }
    $by = [];
    foreach ($found as $r) $by[(int)$r['inquiry_id']][] = $r;
    $out = [];
    foreach ($by as $iid => $rows) $out[$iid] = quoteShape($rows[0], quoteHistory($rows, $recipient), $forCustomer);
    return $out;
}

/** Flat keys older parts of pages.js read (quotation_amount ...), merged into an inquiry record. */
function quoteAttach(array $record, ?array $quote): array {
    $record['quotation'] = $quote;
    if ($quote) {
        $record['quotation_ref'] = $quote['reference'];
        $record['quotation_version'] = $quote['version'];
        $record['quotation_status'] = $quote['status'];
        $record['quotation_amount'] = $quote['total'];
    }
    return $record;
}

/** The quotation a booking should be priced from: the newest one the customer can act on. */
function quoteForBooking(PDO $db, int $inquiryId): ?array {
    $st = $db->prepare("SELECT * FROM quotations WHERE inquiry_id = ? AND status IN ('Accepted','Sent') ORDER BY version DESC LIMIT 1");
    $st->execute([$inquiryId]);
    return $st->fetch() ?: null;
}

/** Quotations referenced by chat messages: [quotation_id => quotation JSON]. Used by both inbox APIs. */
function quotesForMessages(PDO $db, array $messageRows, bool $forCustomer = false): array {
    $ids = [];
    foreach ($messageRows as $m) if (!empty($m['quotation_id'])) $ids[(int)$m['quotation_id']] = true;
    $ids = array_keys($ids);
    if (!$ids) return [];
    $in = implode(',', array_fill(0, count($ids), '?'));
    $where = "WHERE q.quotation_id IN ($in)" . ($forCustomer ? " AND q.status <> 'Draft'" : '');
    try {
        $st = $db->prepare("SELECT q.*, l.event_name FROM quotations q LEFT JOIN leads l ON l.`" . quoteLeadPk($db) . "` = q.inquiry_id $where");
        $st->execute($ids);
        $found = $st->fetchAll();
    } catch (PDOException $e) {
        error_log('quotesForMessages: event name lookup failed: ' . $e->getMessage());
        $st = $db->prepare("SELECT q.* FROM quotations q $where");
        $st->execute($ids);
        $found = $st->fetchAll();
    }
    $out = [];
    foreach ($found as $q) $out[(int)$q['quotation_id']] = quoteShape($q, [], $forCustomer);
    return $out;
}