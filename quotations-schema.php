<?php
/**
 * quotations-schema.php - shared by sales-inquiries.php, customer-inquiries-api.php,
 * sales-inbox-api.php and customer-inbox-api.php.
 * Holds the quotation helpers every API uses and mirrors editor writes into normalized quotation tables,
 * so the sales screen, the customer's Quotation tab and the inbox card show the same values.
 * Put it in the SAME folder as bookings-schema.php.
 *
 * Statuses: Draft (staff only) -> Sent -> Accepted | Declined   (an older version becomes "Superseded" when a newer one is sent)
 * DEPOSIT: 20% of the quotation total, for every service arrangement.
 */
const QUOTE_DEPOSIT_RATE = 0.20;

function ensureQuotationsSchema(AppDatabase $db): void {
    // Quotation tables and message links are provisioned centrally from database/catering_crm.sql.
}

/** Persist the version's money and immutable menu snapshots in the normalized tables. */
function saveNormalizedQuotationVersion(AppDatabase $db, int $quotationId, int $version, array $items, float $subtotal,
    float $discount, float $charges, float $total, int $depositRate, float $deposit, string $validUntil,
    string $validUntilTime, string $notes, int $creator, bool $replaceItems): int {
    $db->prepare('UPDATE quotation_versions SET is_current = 0 WHERE quotation_id = ? AND version_number <> ?')->execute([$quotationId, $version]);
    $db->prepare("INSERT INTO quotation_versions
        (quotation_id,version_number,is_current,response_status,subtotal,discount_amount,additional_charges,total_amount,
         deposit_rate,deposit_amount,remaining_balance,valid_until,valid_until_time,terms_conditions,created_by)
        VALUES (?,?,1,NULL,?,?,?,?,?,?,?,?,?,?,?)
        ON DUPLICATE KEY UPDATE is_current=1,response_status=NULL,subtotal=VALUES(subtotal),discount_amount=VALUES(discount_amount),
         additional_charges=VALUES(additional_charges),total_amount=VALUES(total_amount),deposit_rate=VALUES(deposit_rate),
         deposit_amount=VALUES(deposit_amount),remaining_balance=VALUES(remaining_balance),valid_until=VALUES(valid_until),
         valid_until_time=VALUES(valid_until_time),terms_conditions=VALUES(terms_conditions)")
       ->execute([$quotationId,$version,$subtotal,$discount,$charges,$total,$depositRate,$deposit,
           max(0,round($total-$deposit,2)),$validUntil,$validUntilTime,$notes !== '' ? $notes : null,$creator]);
    $id = $db->prepare('SELECT quotation_version_id FROM quotation_versions WHERE quotation_id = ? AND version_number = ?');
    $id->execute([$quotationId,$version]);
    $versionId = (int)$id->fetchColumn();
    if ($versionId < 1) throw new RuntimeException('Could not save the quotation version.');
    if ($replaceItems) {
        $db->prepare('DELETE FROM quotation_items WHERE quotation_version_id = ?')->execute([$versionId]);
        $insert = $db->prepare('INSERT INTO quotation_items (quotation_version_id,menu_item_id,tier_id,item_name_snapshot,serving_option_snapshot,quantity,unit_price,subtotal) VALUES (?,?,?,?,?,?,?,?)');
        foreach ($items as $item) $insert->execute([$versionId,$item['menu_item_id'],$item['tier_id'],
            mb_substr($item['name'],0,150),$item['tier'] !== '' ? mb_substr($item['tier'],0,100) : null,
            $item['quantity'],$item['unit_price'],$item['amount']]);
    }
    return $versionId;
}

/** Keep workflow state in sync; quotation amounts and terms remain owned by quotation_versions. */
function syncNormalizedQuotationVersion(AppDatabase $db, int $quotationId, bool $refreshItems = false): int {
    $q = $db->prepare('SELECT version,status,sent_at,responded_at FROM quotations WHERE quotation_id = ? LIMIT 1');
    $q->execute([$quotationId]); $row = $q->fetch();
    if (!$row) throw new RuntimeException('Quotation was not found for normalized synchronization.');
    $response = in_array($row['status'], ['Accepted','Declined'], true) ? $row['status'] : null;
    $isCurrent = in_array($row['status'], ['Superseded','Withdrawn'], true) ? 0 : 1;
    $up = $db->prepare('UPDATE quotation_versions SET is_current=?,response_status=?,sent_at=?,responded_at=? WHERE quotation_id=? AND version_number=?');
    $up->execute([$isCurrent,$response,$row['sent_at'] ?: null,$row['responded_at'] ?: null,$quotationId,max(1,(int)$row['version'])]);
    $id = $db->prepare('SELECT quotation_version_id FROM quotation_versions WHERE quotation_id=? AND version_number=?');
    $id->execute([$quotationId,max(1,(int)$row['version'])]);
    $versionId = (int)$id->fetchColumn();
    if (!$versionId) throw new RuntimeException('Normalized quotation version was not found.');
    return $versionId;
}

/** Enrich the workflow record from its normalized version and immutable line snapshots. */
function quoteHydrate(AppDatabase $db, array $q): array {
    $st = $db->prepare('SELECT * FROM quotation_versions WHERE quotation_id=? AND version_number=? LIMIT 1');
    $st->execute([(int)$q['quotation_id'],max(1,(int)$q['version'])]);
    $v = $st->fetch();
    if (!$v) return $q; // Compatibility for any pre-migration historical rows.
    $q['subtotal'] = (float)$v['subtotal']; $q['discount'] = (float)$v['discount_amount'];
    $q['extra_charge'] = (float)$v['additional_charges']; $q['total'] = (float)$v['total_amount'];
    $q['deposit_rate'] = (float)$v['deposit_rate']; $q['deposit_amount'] = (float)$v['deposit_amount'];
    $q['valid_until'] = $v['valid_until']; $q['valid_until_time'] = $v['valid_until_time'];
    $q['notes'] = (string)($v['terms_conditions'] ?? $q['notes'] ?? '');
    $raw = json_decode((string)($q['items'] ?? ''),true) ?: [];
    $items = $db->prepare('SELECT menu_item_id,tier_id,item_name_snapshot,serving_option_snapshot,quantity,unit_price,subtotal FROM quotation_items WHERE quotation_version_id=? ORDER BY quotation_item_id');
    $items->execute([(int)$v['quotation_version_id']]); $lines = $items->fetchAll();
    if ($lines) {
        $q['items'] = json_encode(array_map(function($line,$i) use ($raw) {
            $meta = is_array($raw[$i] ?? null) ? $raw[$i] : [];
            $tier = (string)($line['serving_option_snapshot'] ?? '');
            return array_merge($meta,['menu_item_id'=>(int)$line['menu_item_id'],'tier'=>$tier,
                'description'=>$line['item_name_snapshot'].($tier !== '' ? ' - '.$tier : ''),
                'quantity'=>(float)$line['quantity'],'unit_price'=>(float)$line['unit_price'],'amount'=>(float)$line['subtotal']]);
        },$lines,array_keys($lines)),JSON_UNESCAPED_UNICODE);
    }
    return $q;
}

/** Primary-key column of the leads table. The customer inbox does not load inquiry-common.php, so find it here when $LEAD_PK is not set. */
function quoteLeadPk(AppDatabase $db): string {
    global $LEAD_PK;
    if (!empty($LEAD_PK)) return $LEAD_PK;
    static $pk = null;
    if ($pk !== null) return $pk;
    try {
        $r = $db->query("SHOW KEYS FROM leads WHERE Key_name = 'PRIMARY'")->fetch();
        $pk = $r['Column_name'] ?? 'lead_id';
    } catch (Throwable $e) { $pk = 'lead_id'; }
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
function quotesByInquiry(AppDatabase $db, array $inquiryIds, bool $forCustomer = false, string $recipient = ''): array {
    $ids = array_values(array_unique(array_filter(array_map('intval', $inquiryIds))));
    if (!$ids) return [];
    $in = implode(',', array_fill(0, count($ids), '?'));
    $where = "WHERE q.inquiry_id IN ($in)" . ($forCustomer ? " AND q.status <> 'Draft'" : '') . " ORDER BY q.inquiry_id, q.version DESC";
    try {
        $st = $db->prepare("SELECT q.*, l.event_name FROM quotations q LEFT JOIN leads l ON l.`" . quoteLeadPk($db) . "` = q.inquiry_id $where");
        $st->execute($ids);
        $found = $st->fetchAll();
    } catch (Throwable $e) {       // never break the screen just because the event name could not be read
        error_log('quotesByInquiry: event name lookup failed: ' . $e->getMessage());
        $st = $db->prepare("SELECT q.* FROM quotations q $where");
        $st->execute($ids);
        $found = $st->fetchAll();
    }
    $by = [];
    foreach ($found as $r) $by[(int)$r['inquiry_id']][] = quoteHydrate($db, $r);
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
function quoteForBooking(AppDatabase $db, int $inquiryId): ?array {
    $st = $db->prepare("SELECT * FROM quotations WHERE inquiry_id = ? AND status IN ('Accepted','Sent') ORDER BY version DESC LIMIT 1");
    $st->execute([$inquiryId]);
    $q = $st->fetch();
    return $q ? quoteHydrate($db, $q) : null;
}

/** Quotations referenced by chat messages: [quotation_id => quotation JSON]. Used by both inbox APIs. */
function quotesForMessages(AppDatabase $db, array $messageRows, bool $forCustomer = false): array {
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
    } catch (Throwable $e) {
        error_log('quotesForMessages: event name lookup failed: ' . $e->getMessage());
        $st = $db->prepare("SELECT q.* FROM quotations q $where");
        $st->execute($ids);
        $found = $st->fetchAll();
    }
    $out = [];
    foreach ($found as $q) $out[(int)$q['quotation_id']] = quoteShape(quoteHydrate($db, $q), [], $forCustomer);
    return $out;
}
