<?php

define('SESSION_API', true);
require_once __DIR__ . '/session-init.php';

require __DIR__ . '/inquiry-common.php';
require __DIR__ . '/quotations-schema.php';
require __DIR__ . '/bookings-schema.php';
require_once __DIR__ . '/notifications-helper.php';   // bell notifications (see notifications-api.php)
require_once __DIR__ . '/includes/Mail/EmailNotificationService.php';
$staff = requireSalesStaff();
$action = $_GET['action'] ?? '';

/** The inquiry, only if it is assigned to the logged-in staff. */
function myLead(AppDatabase $db, array $staff, string $ref): array {
    global $LEAD_PK;
    $id = leadIdFromRef($ref);
    $st = $db->prepare("SELECT * FROM leads WHERE `$LEAD_PK` = ? AND assigned_staff_id = ?");
    $st->execute([$id, $staff['id']]);
    $lead = $st->fetch();
    if (!$lead) fail('This inquiry is not assigned to you.', 403);
    return $lead;
}
function quoteRows(AppDatabase $db, int $inquiryId): array {
    $st = $db->prepare('SELECT * FROM quotations WHERE inquiry_id = ? ORDER BY version DESC');
    $st->execute([$inquiryId]);
    return $st->fetchAll();
}

/** The official menu with portion tiers: [menu_item_id => [id,name,category,photo,specs,base_price,price_text,tiers[]]]. Same tables loadMenu() reads. */
function salesMenuCatalog(AppDatabase $db): array {
    global $DB_CATERING, $DB_CRM;
    foreach (array_unique([$DB_CATERING, $DB_CRM]) as $schema) {
        try {
            $cols = array_column($db->query("SHOW COLUMNS FROM `$schema`.menu_items")->fetchAll(), 'Field');
            $where = '';
            if (in_array('is_active', $cols, true)) $where = ' WHERE is_active <> 0';
            elseif (in_array('status', $cols, true)) $where = " WHERE LOWER(status) NOT IN ('inactive','unavailable','archived','deleted','disabled')";
            $rows = $db->query("SELECT menu_item_id, item_name, category, display_price, serving_specs, photo_path FROM `$schema`.menu_items$where ORDER BY category, item_name")->fetchAll();
        } catch (Throwable $e) { continue; }
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
            foreach ($db->query("SELECT menu_item_id, tier_id, tier_name, price, pax_description FROM `$schema`.menu_item_tiers WHERE menu_item_id IN ($in) AND is_active = 1 ORDER BY sort_order")->fetchAll() as $t) {
                $menu[(int)$t['menu_item_id']]['tiers'][] = ['name' => (string)$t['tier_name'], 'price' => round((float)$t['price'], 2),
                    'pax' => trim((string)$t['pax_description'])];
            }
        } catch (Throwable $e) { /* no tiers table */ }
        return $menu;
    }
    return [];
}

/** Resolve every selected line against the live menu so browser prices and labels are never authoritative. */
function quotationMenuLines(AppDatabase $db, $raw): array {
    $input = is_string($raw) ? json_decode($raw, true) : $raw;
    if (!is_array($input) || !$input) fail('Add at least one menu item to the quotation.');
    $lines = []; $subtotal = 0.0;
    foreach ($input as $row) {
        if (!is_array($row)) continue;
        $menuId = (int)($row['menu_item_id'] ?? 0);
        $qty = (float)($row['quantity'] ?? 0);
        if ($menuId < 1 || $qty < 1 || $qty > 100000) fail('Choose a valid menu item and quantity for every quotation line.');
        $menu = $db->prepare("SELECT menu_item_id,item_name,category,base_price,display_price,serving_specs,status FROM menu_items WHERE menu_item_id=? LIMIT 1");
        $menu->execute([$menuId]); $item = $menu->fetch();
        if (!$item || !in_array(strtolower((string)$item['status']), ['active','1'], true)) fail('A selected menu item is no longer available. Refresh the menu and try again.');
        $tierName = trim((string)($row['tier'] ?? '')); $tierId = null; $unit = null; $pax = trim((string)($item['serving_specs'] ?? ''));
        $tiers = $db->prepare('SELECT tier_id,tier_name,price,pax_description FROM menu_item_tiers WHERE menu_item_id=? AND is_active=1 ORDER BY sort_order');
        $tiers->execute([$menuId]); $availableTiers = $tiers->fetchAll();
        if ($availableTiers) {
            $selected = null;
            foreach ($availableTiers as $candidate) if (strcasecmp(trim((string)$candidate['tier_name']), $tierName) === 0) { $selected = $candidate; break; }
            if (!$selected) fail('Choose a valid pricing tier for ' . $item['item_name'] . '.');
            $tierId = (int)$selected['tier_id']; $tierName = (string)$selected['tier_name'];
            $unit = (float)$selected['price']; $pax = trim((string)($selected['pax_description'] ?? ''));
        } else {
            if ($tierName !== '') fail('This menu item does not have pricing tiers.');
            if ($item['base_price'] === null) fail($item['item_name'] . ' does not have a fixed price in Menu Management.');
            $unit = (float)$item['base_price'];
            if ($unit <= 0) {
                preg_match('/\d[\d,]*(?:\.\d+)?/', (string)$item['display_price'], $match);
                if (!$match) fail($item['item_name'] . ' does not have a valid menu price.');
                $unit = (float)str_replace(',', '', $match[0]);
            }
        }
        $amount = round($qty * $unit, 2); $subtotal += $amount;
        $lines[] = ['menu_item_id'=>$menuId,'tier_id'=>$tierId,'name'=>(string)$item['item_name'],
            'category'=>(string)$item['category'],'tier'=>$tierName,'pax'=>$pax,'quantity'=>$qty,
            'unit_price'=>round($unit,2),'amount'=>$amount,
            'description'=>(string)$item['item_name'].($tierName !== '' ? ' - '.$tierName : '')];
    }
    if (!$lines) fail('Add at least one valid menu item to the quotation.');
    return [$lines,round($subtotal,2)];
}

if ($action === 'menu') {
    out(['success' => true, 'items' => array_values(salesMenuCatalog($db))]);
}

if ($action === 'quotation_config') {
    out(['success' => true, 'deposit_rate' => (int)round(QUOTE_DEPOSIT_RATE * 100)]);
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
    foreach ($rows as &$r) {
        $q = $quotes[(int)$r['lead_id']] ?? null;
        $r = quoteAttach($r, $q);
        $book = $db->prepare('SELECT 1 FROM bookings WHERE inquiry_id = ? LIMIT 1');
        $book->execute([(int)$r['lead_id']]);
        $hasBooking = (bool)$book->fetchColumn();
        $r['inquiry_status'] = inquiryGeneralStatus((string)$r['stage'], $hasBooking);
        $r['workflow_label'] = inquiryWorkflowLabel((string)$r['stage'], $q, $hasBooking);
    }
    unset($r);
    out(['success' => true, 'inquiries' => $rows]);
}

if ($action === 'quotation_save') {
    if ($_SERVER['REQUEST_METHOD'] !== 'POST') fail('POST required.', 405);
    $lead = myLead($db, $staff, (string)($_POST['inquiry_ref'] ?? ''));
    $iid = (int)$lead[$LEAD_PK];
    if (in_array($lead['stage'], ['Declined', 'Cancelled', 'Completed'], true)) fail('This inquiry is closed and can no longer be changed.');

    [$items, $subtotal] = quotationMenuLines($db, $_POST['items'] ?? '');

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
    $itemsJson = json_encode(array_map(static function($item) { unset($item['tier_id']); return $item; }, $items), JSON_UNESCAPED_UNICODE);

    $db->beginTransaction();
    try {
        $leadLock = $db->prepare("SELECT stage FROM leads WHERE `$LEAD_PK` = ? FOR UPDATE");
        $leadLock->execute([$iid]);
        $lockedLead = $leadLock->fetch();
        $lockedStage = (string)($lockedLead['stage'] ?? '');
        if (!$lockedLead || in_array($lockedStage, ['Declined', 'Cancelled', 'Completed'], true)) {
            $db->rollBack();
            fail('This inquiry is closed and can no longer be changed.');
        }
        $latestLock = $db->prepare('SELECT * FROM quotations WHERE inquiry_id = ? ORDER BY version DESC LIMIT 1 FOR UPDATE');
        $latestLock->execute([$iid]);
        $latest = $latestLock->fetch() ?: null;
        if ($mode === 'revise') {
            if (!$latest || !in_array((string)$latest['status'], ['Declined', 'Negotiation'], true) || $lockedStage !== 'Negotiation') {
                $db->rollBack();
                fail('A revised quotation can only be prepared after the customer requests changes.');
            }
        } elseif ($latest && (string)$latest['status'] !== 'Draft') {
            $db->rollBack();
            fail('Only a new inquiry or an existing draft can be prepared.');
        }
        if ($latest && $latest['status'] === 'Draft') {
            if ($mode === 'revise') {
                $db->rollBack();
                fail('Edit the existing draft instead of creating another version.');
            }
            $quoteId = (int)$latest['quotation_id']; $version = (int)$latest['version'];
            $db->prepare('UPDATE quotations SET items=?,discount=?,extra_charge=?,total=?,deposit_amount=?,notes=?,prepared_by=?,prepared_by_id=?,prepared_at=? WHERE quotation_id=?')
               ->execute([$itemsJson,$discount,$extra,$total,$deposit,$notes,$staff['name'],$staff['id'],now(),$quoteId]);
        } else {
            $version = $latest ? (int)$latest['version'] + 1 : 1;
            $db->prepare('INSERT INTO quotations (lead_id,inquiry_id,created_by,version,status,items,discount,extra_charge,total,deposit_amount,notes,prepared_by,prepared_by_id,prepared_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)')
               ->execute([$iid,$iid,$staff['id'],$version,'Draft',$itemsJson,$discount,$extra,$total,$deposit,$notes,$staff['name'],$staff['id'],now()]);
            $quoteId = (int)$db->lastInsertId();
        }
        saveNormalizedQuotationVersion($db,$quoteId,$version,$items,$subtotal,$discount,$extra,$total,$rate,$deposit,$validUntil,$validTime,$notes,(int)$staff['id'],true);
        $db->commit();
    } catch (Throwable $e) { if ($db->inTransaction()) $db->rollBack(); throw $e; }
    $quote = quotesByInquiry($db, [$iid], false, (string)($lead['customer_name'] ?? ''))[$iid];
    out(['success' => true, 'message' => 'Quotation saved as a draft.', 'quotation' => $quote]);
}

if ($action === 'quotation_send') {
    if ($_SERVER['REQUEST_METHOD'] !== 'POST') fail('POST required.', 405);
    $lead = myLead($db, $staff, (string)($_POST['inquiry_ref'] ?? ''));
    $iid = (int)$lead[$LEAD_PK];
    $db->beginTransaction();
    try {
        $leadLock = $db->prepare("SELECT stage FROM leads WHERE `$LEAD_PK` = ? FOR UPDATE");
        $leadLock->execute([$iid]);
        $lockedLead = $leadLock->fetch();
        if (!$lockedLead || in_array((string)$lockedLead['stage'], ['Declined', 'Cancelled', 'Completed'], true)) {
            $db->rollBack();
            fail('This inquiry is closed and can no longer be changed.');
        }
        $st = $db->prepare('SELECT * FROM quotations WHERE inquiry_id = ? ORDER BY version DESC LIMIT 1 FOR UPDATE');
        $st->execute([$iid]);
        $q = $st->fetch();
        if (!$q) { $db->rollBack(); fail('Prepare a quotation first.'); }
        $q = quoteHydrate($db, $q);
        if ($q['status'] !== 'Draft') { $db->rollBack(); fail('This version was already ' . strtolower($q['status']) . '. Use "Prepare Revised Version" to send a new one.'); }
        if ((float)$q['total'] <= 0) { $db->rollBack(); fail('The total must be greater than zero.'); }
        if (!$q['valid_until'] || deadlineExpired($q['valid_until'], $q['valid_until_time'] ?? null)) { $db->rollBack(); fail('The valid-until date and time have passed. Edit the draft and choose a new one.'); }

        $oldVersions = $db->prepare("SELECT quotation_id FROM quotations WHERE inquiry_id = ? AND quotation_id <> ? AND status IN ('Sent','Declined') FOR UPDATE");
        $oldVersions->execute([$iid, $q['quotation_id']]);
        $oldVersionIds = array_map('intval', $oldVersions->fetchAll(AppDatabase::FETCH_COLUMN));
        $db->prepare("UPDATE quotations SET status = 'Superseded' WHERE inquiry_id = ? AND quotation_id <> ? AND status IN ('Sent','Declined')")->execute([$iid, $q['quotation_id']]);
        foreach ($oldVersionIds as $oldVersionId) syncNormalizedQuotationVersion($db, $oldVersionId);
        $db->prepare("UPDATE quotations SET status = 'Sent', sent_at = ? WHERE quotation_id = ?")->execute([now(), $q['quotation_id']]);
        syncNormalizedQuotationVersion($db, (int)$q['quotation_id']);
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
    $recipient = EmailNotificationService::customerRecipient($db, (int) $lead['customer_id'], (string) ($lead['customer_email'] ?? ''), (string) ($lead['customer_name'] ?? ''));
    $items = json_decode((string) ($q['items'] ?? ''), true);
    $itemRows = [];
    if (is_array($items)) {
        foreach ($items as $item) {
            if (!is_array($item)) continue;
            $label = trim((string) ($item['description'] ?? $item['name'] ?? 'Menu item'));
            $quantity = (float) ($item['quantity'] ?? 1);
            $amount = (float) ($item['amount'] ?? ((float) ($item['unit_price'] ?? 0) * $quantity));
            $itemRows[$label] = 'Qty ' . rtrim(rtrim(number_format($quantity, 3, '.', ''), '0'), '.') . ' - PHP ' . number_format($amount, 2);
        }
    }
    $rows = [
        'Inquiry reference' => $nfRef,
        'Quotation reference' => quoteRef($iid),
        'Quotation version' => 'v' . (int) $q['version'],
        'Event name' => $nfEvent,
        'Event date' => !empty($lead['event_date']) ? date('F j, Y', strtotime((string) $lead['event_date'])) : '',
        'Service arrangement' => arrangementDisplay((string) ($lead['arrangement'] ?? '')),
        'Quotation validity' => !empty($q['valid_until']) ? deadlineLabel((string) $q['valid_until'], $q['valid_until_time'] ?? null) : '',
        'Total quotation amount' => 'PHP ' . number_format((float) $q['total'], 2),
    ];
    foreach ($itemRows as $label => $value) $rows['Item: ' . $label] = $value;
    EmailNotificationService::queue(
        $db,
        (int) $lead['customer_id'],
        $recipient['email'],
        $recipient['name'],
        (int) $q['version'] === 1 ? 'quotation_available' : 'quotation_revised',
        ((int) $q['version'] === 1 ? 'Quotation available' : 'Revised quotation available') . ' - ' . quoteRef($iid),
        [
            'heading' => (int) $q['version'] === 1 ? 'Quotation Available' : 'Revised Quotation Available',
            'greeting' => $recipient['name'],
            'message' => (int) $q['version'] === 1
                ? 'A new quotation is ready for your review.'
                : 'The revised quotation is ready for your review.',
            'amount' => 'PHP ' . number_format((float) $q['total'], 2),
            'rows' => $rows,
            'button_text' => 'Review the Quotation',
            'button_url' => EmailNotificationService::customerAppUrl($db, 'customer-inquiries.html'),
        ],
        'quotation_' . ((int) $q['version'] === 1 ? 'available' : 'revised') . ':' . (int) $q['quotation_id'] . ':v' . (int) $q['version'],
        'quotation',
        (int) $q['quotation_id']
    );
    $quote = quotesByInquiry($db, [$iid], false, (string)($lead['customer_name'] ?? ''))[$iid];
    out(['success' => true, 'message' => 'Quotation sent to the customer.', 'quotation' => $quote, 'stage' => 'Quotation Sent']);
}

fail('Unknown action.', 400);
