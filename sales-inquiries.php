<?php
/**
 * sales-inquiries.php - Sales Staff > My Inquiries
 *   GET  ?action=list           -> inquiries assigned to the logged-in staff (+ conversation_id, unread_count, quotation)
 *   POST ?action=update_stage   -> inquiry_ref, stage, reason   (only your own inquiries; Declined needs a reason,
 *                                   and moving a Declined inquiry to another stage re-opens it)
 *   GET  ?action=menu          -> the official menu (categories, portion tiers, fixed prices) for the Create Quotation page
 *   POST ?action=quotation_save -> inquiry_ref, items (JSON), valid_until, notes, mode = save | revise, deposit_rate, discount, extra_charge
 *                                   Same quotation for Buffet with Setup, Pickup and Delivery. Additional fee: Pickup none (forced to 0),
 *                                   Delivery / Buffet with Setup editable (the page starts Delivery at DELIVERY_FEE_DEFAULT).
 *   POST ?action=quotation_send -> inquiry_ref          (sends the latest Draft to the customer + posts it in the chat)
 */
// Shared session setup: secure cookie settings + 30-minute inactivity timeout (replies 401 "session_expired" as JSON).
define('SESSION_API', true);
require_once __DIR__ . '/session-init.php';

require __DIR__ . '/inquiry-common.php';
require __DIR__ . '/quotations-schema.php';
require __DIR__ . '/bookings-schema.php';
require_once __DIR__ . '/notifications-helper.php';   // bell notifications (see notifications-api.php)
$staff = requireSalesStaff();
ensureColumn($db, $DB_CATERING, 'leads', 'decline_reason', 'TEXT NULL');
ensureColumn($db, $DB_CATERING, 'leads', 'declined_at', 'DATETIME NULL');
$action = $_GET['action'] ?? '';

/** The inquiry, only if it is assigned to the logged-in staff. */
function myLead(PDO $db, array $staff, string $ref): array {
    global $LEAD_PK;
    $id = leadIdFromRef($ref);
    $st = $db->prepare("SELECT * FROM leads WHERE `$LEAD_PK` = ? AND assigned_staff_id = ?");
    $st->execute([$id, $staff['id']]);
    $lead = $st->fetch();
    if (!$lead) fail('This inquiry is not assigned to you.', 403);
    return $lead;
}
function quoteRows(PDO $db, int $inquiryId): array {
    $st = $db->prepare('SELECT * FROM quotations WHERE inquiry_id = ? ORDER BY version DESC');
    $st->execute([$inquiryId]);
    return $st->fetchAll();
}

/** The official menu with portion tiers: [menu_item_id => [id,name,category,photo,specs,base_price,price_text,tiers[]]]. Same tables loadMenu() reads. */
function salesMenuCatalog(PDO $db): array {
    global $DB_CATERING, $DB_CRM;
    foreach (array_unique([$DB_CATERING, $DB_CRM]) as $schema) {
        try {
            $cols = array_column($db->query("SHOW COLUMNS FROM `$schema`.menu_items")->fetchAll(), 'Field');
            $where = '';
            if (in_array('is_active', $cols, true)) $where = ' WHERE is_active <> 0';
            elseif (in_array('status', $cols, true)) $where = " WHERE LOWER(status) NOT IN ('inactive','unavailable','archived','deleted','disabled')";
            $rows = $db->query("SELECT menu_item_id, item_name, category, display_price, serving_specs, photo_path FROM `$schema`.menu_items$where ORDER BY category, item_name")->fetchAll();
        } catch (PDOException $e) { continue; }
        $menu = [];
        foreach ($rows as $m) {
            $price = trim((string)$m['display_price']);
            // price is automatic from the menu: "₱890.00" -> 890; a range like "₱2,500 – ₱3,500" (no portion prices) uses its lowest figure and is flagged
            preg_match_all('/\d[\d,]*(?:\.\d+)?/', $price, $found);
            $vals = array_map(fn($n) => (float)str_replace(',', '', $n), $found[0]);
            $single = $vals ? round(min($vals), 2) : null;
            $isRange = count($vals) > 1 && max($vals) > min($vals);
            $menu[(int)$m['menu_item_id']] = [
                'id' => (int)$m['menu_item_id'], 'name' => (string)$m['item_name'], 'category' => (string)($m['category'] ?? ''),
                'photo' => (string)($m['photo_path'] ?? ''), 'specs' => trim((string)$m['serving_specs']),
                'base_price' => $single, 'price_range' => $isRange, 'price_text' => $price, 'tiers' => [],
            ];
        }
        if (!$menu) continue;
        try {
            $in = implode(',', array_map('intval', array_keys($menu)));
            foreach ($db->query("SELECT menu_item_id, tier_name, price, pax_description FROM `$schema`.menu_item_tiers WHERE menu_item_id IN ($in) ORDER BY sort_order")->fetchAll() as $t) {
                $menu[(int)$t['menu_item_id']]['tiers'][] = ['name' => (string)$t['tier_name'], 'price' => round((float)$t['price'], 2),
                    'pax' => trim((string)$t['pax_description'])];
            }
        } catch (PDOException $e) { /* no tiers table */ }
        return $menu;
    }
    return [];
}

if ($action === 'menu') {
    out(['success' => true, 'items' => array_values(salesMenuCatalog($db))]);
}

if ($action === 'list') {
    $st = $db->prepare("
        SELECT l.*, c.id AS conversation_id,
               (SELECT COUNT(*) FROM `$DB_CRM`.cib_messages m
                WHERE m.conversation_id = c.id AND m.sender_type = 'customer'
                  AND m.created_at > COALESCE(c.sales_read_at, '1970-01-01 00:00:00')) AS unread_count
        FROM leads l
        LEFT JOIN `$DB_CRM`.cib_conversations c ON c.inquiry_id = l.`$LEAD_PK`
        WHERE l.assigned_staff_id = ?
        ORDER BY l.created_at DESC, l.`$LEAD_PK` DESC");
    $st->execute([$staff['id']]);
    $rows = enrichLeads($db, $DB_CRM, $st->fetchAll());
    $quotes = quotesByInquiry($db, array_column($rows, 'lead_id'));
    foreach ($rows as &$r) $r = quoteAttach($r, $quotes[(int)$r['lead_id']] ?? null);
    unset($r);
    out(['success' => true, 'inquiries' => $rows]);
}

if ($action === 'update_stage') {
    if ($_SERVER['REQUEST_METHOD'] !== 'POST') fail('POST required.', 405);
    $lead = myLead($db, $staff, (string)($_POST['inquiry_ref'] ?? ''));
    $iid = (int)$lead[$LEAD_PK];
    $stage = trim((string)($_POST['stage'] ?? ''));
    if (!in_array($stage, STAGES, true)) fail('Invalid stage.');
    $old = (string)$lead['stage'];
    $reason = trim((string)($_POST['reason'] ?? ''));
    if (mb_strlen($reason) > 500) fail('The reason is too long (max 500 characters).');
    $declining = $stage === 'Declined' && $old !== 'Declined';
    $reopening = $old === 'Declined' && $stage !== 'Declined';
    $ref = !empty($lead['inquiry_ref']) ? $lead['inquiry_ref'] : 'INQ-' . str_pad((string)$iid, 4, '0', STR_PAD_LEFT);
    $evLabel = trim((string)($lead['event_name'] ?? '')) !== '' ? '"' . $lead['event_name'] . '"' : 'your event';   // customers see the event name, not INQ-0000

    if ($declining) {
        if (mb_strlen($reason) < 3) fail('Please give the customer a short reason for declining.');
        $bk = $db->prepare('SELECT booking_ref, booking_id FROM bookings WHERE inquiry_id = ? LIMIT 1');
        $bk->execute([$iid]);
        if ($b = $bk->fetch()) fail('A booking (' . ($b['booking_ref'] ?: 'BK-' . str_pad((string)$b['booking_id'], 4, '0', STR_PAD_LEFT)) . ') already exists for this inquiry, so it cannot be declined.');
    }

    $db->beginTransaction();
    try {
        if ($declining) {
            $db->prepare("UPDATE leads SET stage = ?, decline_reason = ?, declined_at = ? WHERE `$LEAD_PK` = ?")->execute([$stage, $reason, now(), $iid]);
            // an open quotation can no longer be accepted or paid against
            $db->prepare("UPDATE quotations SET status = 'Withdrawn' WHERE inquiry_id = ? AND status IN ('Draft','Sent','Accepted')")->execute([$iid]);
        } elseif ($reopening) {
            $db->prepare("UPDATE leads SET stage = ?, decline_reason = NULL, declined_at = NULL WHERE `$LEAD_PK` = ?")->execute([$stage, $iid]);
        } else {
            $db->prepare("UPDATE leads SET stage = ? WHERE `$LEAD_PK` = ?")->execute([$stage, $iid]);
        }

        if ($declining || $reopening) {                       // tell the customer in the chat
            $cv = $db->prepare("SELECT id FROM `$DB_CRM`.cib_conversations WHERE inquiry_id = ? LIMIT 1");
            $cv->execute([$iid]);
            if ($conv = $cv->fetch()) {
                $text = $declining
                    ? 'We are sorry, but we are unable to take your inquiry for ' . $evLabel . '. Reason: ' . $reason . ' You are welcome to send a new inquiry anytime.'
                    : 'Good news: your inquiry for ' . $evLabel . ' has been reopened. Our team will continue working on it and send you an updated quotation.';
                $db->prepare("INSERT INTO `$DB_CRM`.cib_messages (conversation_id, sender_type, sender_name, message, attachments, created_at) VALUES (?,?,?,?,NULL,?)")
                   ->execute([$conv['id'], 'staff', $staff['name'], $text, now()]);
                $db->prepare("UPDATE `$DB_CRM`.cib_conversations SET updated_at = ?, sales_read_at = ? WHERE id = ?")->execute([now(), now(), $conv['id']]);
            }
        }
        $db->commit();
    } catch (Throwable $e) {
        if ($db->inTransaction()) $db->rollBack();
        throw $e;
    }
    if ($declining || $reopening) {      // Bell: the customer (+ Admin / Manager) is told
        $evPlain = trim((string)($lead['event_name'] ?? '')) !== '' ? $lead['event_name'] : 'your event';
        notifySend($db, [
            'type' => 'lead', 'kind' => 'inquiry', 'ref' => $ref,
            'title' => $declining ? 'Inquiry declined' : 'Inquiry reopened',
            'message' => $staff['name'] . ($declining ? ' declined ' : ' reopened ') . $ref . ' (' . $evPlain . ').',
            'user_ids' => [(int)($lead['customer_id'] ?? 0)],
            'exclude_user_id' => $staff['id'],
            'customer' => [
                'title' => $declining ? 'Your inquiry was declined' : 'Your inquiry was reopened',
                'message' => $declining ? 'We are unable to take your inquiry for ' . $evPlain . '. Reason: ' . $reason
                                        : 'Your inquiry for ' . $evPlain . ' has been reopened. We will send you an updated quotation.',
            ],
        ]);
    }
    $quote = quotesByInquiry($db, [$iid], false, (string)($lead['customer_name'] ?? ''))[$iid] ?? null;
    out(['success' => true, 'quotation' => $quote,
         'message' => $declining ? 'Inquiry declined. The customer was notified.' : ($reopening ? 'Inquiry reopened. The customer was notified.' : 'Stage updated.')]);
}

if ($action === 'quotation_save') {
    if ($_SERVER['REQUEST_METHOD'] !== 'POST') fail('POST required.', 405);
    $lead = myLead($db, $staff, (string)($_POST['inquiry_ref'] ?? ''));
    $iid = (int)$lead[$LEAD_PK];
    if ($lead['stage'] === 'Declined') fail('This inquiry is declined. Move it back to In Progress to reopen it before preparing a quotation.');

    [$items, $subtotal] = quoteCleanItems($_POST['items'] ?? '');

    $money = fn($v) => round(max(0, (float)str_replace(',', '', (string)$v)), 2);
    // additional fee: none for Customer Pickup; editable for Delivery (e.g. 450, depends on the address) and Buffet with Setup
    $extra = arrangementIsPickup($lead['arrangement'] ?? '') ? 0.0 : $money($_POST['extra_charge'] ?? 0);
    if ($extra > 100000000) fail('The additional fee is too large.');
    $discount = $money($_POST['discount'] ?? 0);
    if ($discount > $subtotal + $extra) fail('The discount cannot be more than the order total.');
    $total = round($subtotal + $extra - $discount, 2);
    if ($total <= 0) fail('The total must be greater than zero.');

    $rate = (int)($_POST['deposit_rate'] ?? round(QUOTE_DEPOSIT_RATE * 100));
    if ($rate < 1 || $rate > 100) fail('The deposit percentage must be between 1 and 100.');
    $validUntil = trim((string)($_POST['valid_until'] ?? ''));
    $d = DateTime::createFromFormat('Y-m-d', $validUntil);
    if (!$d || $d->format('Y-m-d') !== $validUntil) fail('Choose a valid "valid until" date.');
    if ($validUntil < date('Y-m-d')) fail('The valid-until date cannot be in the past.');
    $validTime = quoteDeadlineCheck($validUntil, $_POST['valid_until_time'] ?? '', 'quotation deadline', (string)($lead['event_date'] ?? ''));   // 8 AM - 11 PM; same day: time required, at least 1 hour from now, on the hour or half hour
    $notes = trim((string)($_POST['notes'] ?? ''));
    if (mb_strlen($notes) > 2000) fail('The note is too long (max 2000 characters).');
    $mode = ($_POST['mode'] ?? 'save') === 'revise' ? 'revise' : 'save';
    $deposit = round($total * $rate / 100, 2);
    $itemsJson = json_encode($items, JSON_UNESCAPED_UNICODE);

    $rows = quoteRows($db, $iid);
    $latest = $rows[0] ?? null;
    if ($latest && $latest['status'] === 'Accepted') fail('The customer already accepted this quotation, so it can no longer be changed.');

    if ($latest && $latest['status'] === 'Draft') {                      // edit the open draft
        $db->prepare('UPDATE quotations SET items=?, subtotal=?, extra_charge=?, discount=?, total=?, deposit_rate=?, deposit_amount=?, valid_until=?, valid_until_time=?, notes=?, prepared_by=?, prepared_by_id=?, prepared_at=? WHERE quotation_id=?')
           ->execute([$itemsJson, $subtotal, $extra, $discount, $total, $rate, $deposit, $validUntil, $validTime, $notes, $staff['name'], $staff['id'], now(), $latest['quotation_id']]);
    } else {
        if ($latest && $mode !== 'revise' && $latest['status'] !== 'Withdrawn') fail('This was already sent. Use "Prepare Revised Version" to change it.');
        $version = $latest ? (int)$latest['version'] + 1 : 1;
        $db->prepare("INSERT INTO quotations (inquiry_id, version, status, items, subtotal, extra_charge, discount, total, deposit_rate, deposit_amount, valid_until, valid_until_time, notes, prepared_by, prepared_by_id, prepared_at)
                      VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)")
           ->execute([$iid, $version, 'Draft', $itemsJson, $subtotal, $extra, $discount, $total, $rate, $deposit, $validUntil, $validTime, $notes, $staff['name'], $staff['id'], now()]);
    }
    $quote = quotesByInquiry($db, [$iid], false, (string)($lead['customer_name'] ?? ''))[$iid];
    out(['success' => true, 'message' => 'Quotation saved as a draft.', 'quotation' => $quote]);
}

if ($action === 'quotation_send') {
    if ($_SERVER['REQUEST_METHOD'] !== 'POST') fail('POST required.', 405);
    $lead = myLead($db, $staff, (string)($_POST['inquiry_ref'] ?? ''));
    $iid = (int)$lead[$LEAD_PK];
    if ($lead['stage'] === 'Declined') fail('This inquiry is declined. Move it back to In Progress to reopen it before sending a quotation.');
    $db->beginTransaction();
    try {
        $st = $db->prepare('SELECT * FROM quotations WHERE inquiry_id = ? ORDER BY version DESC LIMIT 1 FOR UPDATE');
        $st->execute([$iid]);
        $q = $st->fetch();
        if (!$q) { $db->rollBack(); fail('Prepare a quotation first.'); }
        if ($q['status'] !== 'Draft') { $db->rollBack(); fail('This version was already ' . strtolower($q['status']) . '. Use "Prepare Revised Version" to send a new one.'); }
        if ((float)$q['total'] <= 0) { $db->rollBack(); fail('The total must be greater than zero.'); }
        if (!$q['valid_until'] || deadlineExpired($q['valid_until'], $q['valid_until_time'] ?? null)) { $db->rollBack(); fail('The valid-until date and time have passed. Edit the draft and choose a new one.'); }

        $db->prepare("UPDATE quotations SET status = 'Superseded' WHERE inquiry_id = ? AND quotation_id <> ? AND status IN ('Sent','Declined')")->execute([$iid, $q['quotation_id']]);
        $db->prepare("UPDATE quotations SET status = 'Sent', sent_at = ? WHERE quotation_id = ?")->execute([now(), $q['quotation_id']]);
        $db->prepare("UPDATE leads SET stage = ? WHERE `$LEAD_PK` = ?")->execute(['Quotation Sent', $iid]);

        // announce it in the customer's chat (if the inquiry already has a conversation)
        $cv = $db->prepare("SELECT id FROM `$DB_CRM`.cib_conversations WHERE inquiry_id = ? LIMIT 1");
        $cv->execute([$iid]);
        if ($conv = $cv->fetch()) {
            $evn = trim((string)($lead['event_name'] ?? '')) !== '' ? $lead['event_name'] : 'your event';
            $qCode = quoteRef($iid) . ' (v' . (int)$q['version'] . ')';
            $text = 'Hello! Your quotation for **' . $evn . '** (' . $qCode . ') is ready.'
                . ' Total: ' . quotePeso($q['total'])
                . '. Deposit to reserve your date: ' . quotePeso($q['deposit_amount']) . ' (' . (int)($q['deposit_rate'] ?? round(QUOTE_DEPOSIT_RATE * 100)) . '%).'
                . ' Valid until ' . deadlineLabel($q['valid_until'], $q['valid_until_time'] ?? null) . '.'
                . ' Please open My Inquiries > Quotation to accept or decline it.'
                . ' Note: once your deposit is paid, your booking is confirmed and the event date is reserved for you.';
            $db->prepare("INSERT INTO `$DB_CRM`.cib_messages (conversation_id, sender_type, sender_name, message, attachments, quotation_id, created_at) VALUES (?,?,?,?,NULL,?,?)")
               ->execute([$conv['id'], 'staff', $staff['name'], $text, $q['quotation_id'], now()]);
            $db->prepare("UPDATE `$DB_CRM`.cib_conversations SET updated_at = ?, sales_read_at = ? WHERE id = ?")->execute([now(), now(), $conv['id']]);
        }
        $db->commit();
    } catch (Throwable $e) {
        if ($db->inTransaction()) $db->rollBack();
        throw $e;
    }
    // Bell: the customer (+ Admin / Manager) is told the quotation is ready.
    $nfEvent = trim((string)($lead['event_name'] ?? '')) !== '' ? $lead['event_name'] : 'your event';
    $nfRef = !empty($lead['inquiry_ref']) ? $lead['inquiry_ref'] : 'INQ-' . str_pad((string)$iid, 4, '0', STR_PAD_LEFT);
    notifySend($db, [
        'type' => 'deal', 'kind' => 'inquiry', 'ref' => $nfRef,
        'title' => 'Quotation sent',
        'message' => $staff['name'] . ' sent a quotation for ' . $nfEvent . ' (' . $nfRef . '): ' . quotePeso($q['total']),
        'user_ids' => [(int)($lead['customer_id'] ?? 0)],
        'exclude_user_id' => $staff['id'],
        'customer' => [
            'title' => 'Your quotation is ready',
            'message' => 'Your quotation for ' . $nfEvent . ' is ready (' . quotePeso($q['total']) . '). Open My Inquiries to accept or decline it.',
        ],
    ]);
    $quote = quotesByInquiry($db, [$iid], false, (string)($lead['customer_name'] ?? ''))[$iid];
    out(['success' => true, 'message' => 'Quotation sent to the customer.', 'quotation' => $quote, 'stage' => 'Quotation Sent']);
}

fail('Unknown action.', 400);