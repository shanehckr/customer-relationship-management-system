<?php
/**
 * customer-inquiries-api.php - called by customer-pages.js (IW_API)
 *   GET  ?action=list    -> { success, csrf_token, inquiries: [...] }   (the customer's own inquiries)
 *   POST ?action=create  -> saves the inquiry as an UNASSIGNED lead, so it shows up in Sales > Available Inquiries.
 *   POST ?action=quotation_respond -> quotation_id, decision = accept | decline | change (the customer answers a quotation;
 *                                     'change' = request changes, allowed while Sent or Accepted-but-unpaid, reason required)
 */
// Shared session setup: secure cookie settings + 30-minute inactivity timeout (replies 401 "session_expired" as JSON).
define('SESSION_API', true);
require_once __DIR__ . '/session-init.php';

require __DIR__ . '/inquiry-common.php';
require __DIR__ . '/quotations-schema.php';
require_once __DIR__ . '/notifications-helper.php';   // bell notifications (see notifications-api.php)
require_once __DIR__ . '/booking-deadlines.php';        // CUSTOMER_MIN_DAYS_BEFORE_EVENT

$customerId = (int)sessionFirst(['customer_id', 'user_id', 'id']);
if (!$customerId) fail('Please log in again.', 401);

$action = $_GET['action'] ?? '';

if ($action === 'list') {
    if (empty($_SESSION['csrf_token'])) $_SESSION['csrf_token'] = bin2hex(random_bytes(16));
    $st = $db->prepare("SELECT l.*, c.id AS conversation_id FROM leads l
        LEFT JOIN `$DB_CRM`.cib_conversations c ON c.inquiry_id = l.`$LEAD_PK`
        WHERE l.customer_id = ? ORDER BY l.created_at DESC, l.`$LEAD_PK` DESC");
    $st->execute([$customerId]);
    $rawLeads = $st->fetchAll();
    // Menu items with each dish's tier PAX ("25 PAX") from Menu Management, same lookup the staff pages use.
    $menuByLead = [];
    try {
        foreach (enrichLeads($db, $DB_CRM, $rawLeads) as $e) $menuByLead[(int)$e['lead_id']] = $e['menu_items'] ?? [];
    } catch (Throwable $e) { error_log('customer-inquiries-api: menu lookup failed: ' . $e->getMessage()); }
    $rows = array_map(function ($l) use ($menuByLead) {
        $s = shapeLead($l);
        $s['decline_reason'] = (string)($l['decline_reason'] ?? '');
        $s['menu_items'] = $menuByLead[(int)$s['lead_id']] ?? [];
        return $s;
    }, $rawLeads);
    $quotes = quotesByInquiry($db, array_column($rows, 'lead_id'), true);   // customers never see Draft versions
    foreach ($rows as &$r) {
        $q = $quotes[(int)$r['lead_id']] ?? null;
        $r = quoteAttach($r, $q);
        $r['progress_step'] = inquiryProgressStep((string)$r['stage'], $q);
    }
    unset($r);
    out(['success' => true, 'csrf_token' => $_SESSION['csrf_token'], 'inquiries' => $rows]);
}

if ($action === 'create') {
    if ($_SERVER['REQUEST_METHOD'] !== 'POST') fail('POST required.', 405);
    $token = $_SERVER['HTTP_X_CSRF_TOKEN'] ?? ($_POST['csrf_token'] ?? '');
    if (empty($_SESSION['csrf_token']) || !hash_equals($_SESSION['csrf_token'], (string)$token)) fail('Session expired. Refresh and try again.', 403);

    $pick = function (array $keys) { foreach ($keys as $k) if (isset($_POST[$k]) && trim((string)$_POST[$k]) !== '') return trim((string)$_POST[$k]); return ''; };
    $eventName   = $pick(['event_name']);
    $eventDate   = $pick(['event_date']);
    $eventTimeIn = $pick(['event_time']);
    $location    = $pick(['event_location', 'venue']);
    $arrangement = $pick(['arrangement']);
    $package     = $pick(['package']);
    $notes       = $pick(['notes']);
    $guests      = (int)preg_replace('/\D/', '', $pick(['expected_guests', 'guests', 'pax']));
    $dishes      = array_values(array_filter(array_map('trim', (array)($_POST['dishes'] ?? []))));
    $menuIds     = array_values(array_filter(array_map('trim', (array)($_POST['menu_item_ids'] ?? []))));

    if ($eventName === '' || mb_strlen($eventName) > 160) fail('Enter the event name.');
    $d = DateTime::createFromFormat('Y-m-d', $eventDate);
    if (!$d || $d->format('Y-m-d') !== $eventDate) fail('Choose a valid event date.');
    if ($eventDate < date('Y-m-d')) fail('The event date cannot be in the past.');
    // 9:00 PM submission cutoff: from 9 PM the 3-day date is closed (staff cannot finish the quotation before 11 PM), so the earliest is 4 days away
    $earliest = customerEarliestEventDate();
    if ($eventDate < $earliest) {
        $afterCutoff = (int)date('G') >= CUSTOMER_SUBMIT_CUTOFF_HOUR;
        fail($afterCutoff
            ? 'Inquiries sent at or after 9:00 PM need an event date at least ' . (CUSTOMER_MIN_DAYS_BEFORE_EVENT + 1) . ' days from today (earliest: ' . date('M j, Y', strtotime($earliest)) . ').'
            : 'Please choose an event date at least ' . CUSTOMER_MIN_DAYS_BEFORE_EVENT . ' days from today (earliest: ' . date('M j, Y', strtotime($earliest)) . ').');
    }
    // Pickup / Delivery / Event time: required, between 8:00 AM and 8:00 PM
    $eventTime = eventTimeClean($eventTimeIn);
    if ($eventTimeIn === '') fail('Choose the ' . strtolower(eventTimeLabel($arrangement)) . '.');
    if ($eventTime === '') fail('The ' . strtolower(eventTimeLabel($arrangement)) . ' must be between 8:00 AM and 8:00 PM.');
    // Customer Pickup: the customer collects the food, so no address is needed (staff and the customer see "Customer pickup")
    if (stripos($arrangement, 'pick') !== false) $location = 'Customer pickup';
    if ($location === '') fail('Enter the venue or delivery address.');
    if ($arrangement === '') fail('Choose a catering arrangement.');
    // PAX only applies to Buffet with Setup; Pickup / Delivery never store a guest count
    $guests = arrangementHasPax($arrangement) && $guests > 0 ? min($guests, 100000) : null;
    if (mb_strlen($notes) > 2000) fail('Notes are too long (max 2000 characters).');

    $name = sessionFirst(['customer_name', 'user_name', 'name', 'full_name']);
    $email = sessionFirst(['email', 'user_email']);
    try {
        // the customer's account lives in the users table; its email is saved on the inquiry so we can email them later
        $upk = usersPk($db, $DB_CRM);
        $c = $db->prepare("SELECT email FROM `$DB_CRM`.users WHERE `$upk` = ?");
        $c->execute([$customerId]);
        if ($row = $c->fetch()) { $email = trim((string)$row['email']) !== '' ? trim((string)$row['email']) : $email; }
    } catch (PDOException $e) { error_log('create inquiry: could not read the users table: ' . $e->getMessage()); }
    if ($name === '') $name = 'Customer #' . $customerId;

    $db->beginTransaction();
    try {
        $db->prepare("INSERT INTO leads (event_name, event_date, event_time, event_location, arrangement, stage, assigned_staff_id,
                customer_id, customer_name, customer_email, package, dishes, menu_item_ids, notes, expected_guests, created_at)
            VALUES (?,?,?,?,?,?,NULL,?,?,?,?,?,?,?,?,?)")
           ->execute([$eventName, $eventDate, $eventTime, $location, $arrangement, STAGE_NEW, $customerId, $name, $email, $package,
                      json_encode($dishes, JSON_UNESCAPED_UNICODE), json_encode($menuIds), $notes, $guests, now()]);
        $leadId = (int)$db->lastInsertId();
        $ref = 'INQ-' . str_pad((string)$leadId, 4, '0', STR_PAD_LEFT);
        $db->prepare("UPDATE leads SET inquiry_ref = ? WHERE `$LEAD_PK` = ?")->execute([$ref, $leadId]);

        $db->commit();
    } catch (Throwable $e) {
        $db->rollBack();
        throw $e;
    }
    // Bell: every Sales Staff sees the new inquiry in Available Inquiries; Admin and Manager are added by the helper.
    notifySend($db, [
        'type' => 'lead', 'kind' => 'available', 'ref' => $ref,
        'title' => 'New inquiry',
        'message' => $name . ' submitted ' . $ref . ': ' . $eventName,
        'roles' => ['Sales Staff'],
        'exclude_user_id' => $customerId,
    ]);
    // Bell: thank the customer right away (the chat only opens once a Sales Staff accepts the inquiry).
    notifySend($db, [
        'type' => 'lead', 'kind' => 'inquiry', 'ref' => $ref,
        'title' => 'Inquiry received',
        'message' => 'Thank you! We received your inquiry for ' . $eventName . '. Please wait while our team reviews it.',
        'user_ids' => [$customerId], 'include_admins' => false,
    ]);
    out(['success' => true, 'message' => 'Inquiry submitted. We will be in touch soon.', 'inquiry_ref' => $ref, 'inquiry_id' => $leadId]);
}

/** 1 Submitted, 2 Under review, 3 Quotation, 4 Confirmation (quotation accepted), 5 Completed. */
function inquiryProgressStep(string $stage, ?array $quote): int {
    if ($stage === 'Declined') return 0;           // no progress bar for a declined inquiry
    if ($stage === 'Completed') return 5;
    if ($quote && $quote['status'] === 'Accepted') return 4;
    if ($stage === 'Confirmed') return 4;
    if ($stage === 'Quotation Sent' || $stage === 'Negotiation') return 3;
    if ($stage === 'New Inquiry') return 1;
    return 2;
}

if ($action === 'quotation_respond') {
    if ($_SERVER['REQUEST_METHOD'] !== 'POST') fail('POST required.', 405);
    $token = $_SERVER['HTTP_X_CSRF_TOKEN'] ?? ($_POST['csrf_token'] ?? '');
    if (empty($_SESSION['csrf_token']) || !hash_equals($_SESSION['csrf_token'], (string)$token)) fail('Session expired. Refresh and try again.', 403);
    $decision = $_POST['decision'] ?? '';
    if (!in_array($decision, ['accept', 'decline', 'change'], true)) fail('Choose accept, decline or request changes.');
    $reason = trim((string)($_POST['reason'] ?? ''));
    if ($decision === 'change' && $reason === '') fail('Please tell us what you would like to change.');

    $db->beginTransaction();
    try {
        // the quotation must belong to one of THIS customer's inquiries
        $st = $db->prepare("SELECT q.*, l.`$LEAD_PK` AS lead_pk, l.stage AS lead_stage, l.event_name AS lead_event_name, l.assigned_staff_id AS lead_staff_id FROM quotations q JOIN leads l ON l.`$LEAD_PK` = q.inquiry_id
                            WHERE q.quotation_id = ? AND l.customer_id = ? FOR UPDATE");
        $st->execute([(int)($_POST['quotation_id'] ?? 0), $customerId]);
        $q = $st->fetch();
        if (!$q) { $db->rollBack(); fail('Quotation not found.', 404); }
        if ($decision === 'change') {
            // a change request is allowed while the quotation is open (Sent) or accepted but not yet paid
            $paid = in_array($q['lead_stage'], ['Confirmed', 'Completed'], true);
            if ($paid) { $db->rollBack(); fail('The deposit was already paid, so this booking is confirmed. Please message the catering team to change it.', 409); }
            if (!in_array($q['status'], ['Sent', 'Accepted'], true)) { $db->rollBack(); fail('This quotation is no longer open for changes (' . strtolower($q['status']) . ').', 409); }
        } else {
            if ($q['status'] !== 'Sent') { $db->rollBack(); fail('This quotation is no longer open for a response (' . strtolower($q['status']) . ').', 409); }
            if ($q['valid_until'] && deadlineExpired($q['valid_until'], $q['valid_until_time'] ?? null)) { $db->rollBack(); fail('This quotation has expired (it was valid until ' . deadlineLabel($q['valid_until'], $q['valid_until_time'] ?? null) . '). Please ask the catering team for a new one.', 409); }
        }

        $iid = (int)$q['inquiry_id'];
        // 'change' closes this version (Declined) and moves the inquiry back to Negotiation so staff can send a revised quotation
        $newStatus = $decision === 'accept' ? 'Accepted' : 'Declined';
        $db->prepare('UPDATE quotations SET status = ?, responded_at = ? WHERE quotation_id = ?')->execute([$newStatus, now(), $q['quotation_id']]);
        if ($decision !== 'accept') $db->prepare("UPDATE leads SET stage = 'Negotiation' WHERE `$LEAD_PK` = ?")->execute([$iid]);

        $ref = '**' . (trim((string)($q['lead_event_name'] ?? '')) !== '' ? $q['lead_event_name'] : 'my event') . '**';   // the event name replaces the QT-0000 (v1) label
        if ($decision === 'accept') {
            $text = 'I accept the quotation for ' . $ref . '. I will pay the ' . quotePeso($q['deposit_amount']) . ' deposit to confirm my booking.';
        } elseif ($decision === 'change') {
            $text = 'I would like to request changes to the quotation for ' . $ref . ($q['status'] === 'Accepted' ? ' (I had accepted it, but changed my mind before paying)' : '') . '. Requested changes: ' . mb_substr($reason, 0, 1000) . ' Could you please send a revised quotation?';
        } else {
            $text = 'I am declining the quotation for ' . $ref . '.' . ($reason !== '' ? ' Reason: ' . mb_substr($reason, 0, 500) : '') . ' Could you please send a revised one?';
        }
        $cv = $db->prepare("SELECT id FROM `$DB_CRM`.cib_conversations WHERE inquiry_id = ? LIMIT 1");
        $cv->execute([$iid]);
        if ($conv = $cv->fetch()) {
            $db->prepare("INSERT INTO `$DB_CRM`.cib_messages (conversation_id, sender_type, sender_name, message, attachments, created_at) VALUES (?,?,?,?,NULL,?)")
               ->execute([$conv['id'], 'customer', 'You', $text, now()]);
            // After acceptance, the catering team reminds the customer about the cancellation policy.
            if ($decision === 'accept') {
                $evName = trim((string)($q['lead_event_name'] ?? '')) !== '' ? $q['lead_event_name'] : 'your event';
                $cancelMsg = 'Thank you for accepting the quotation for **' . $evName . '**! '
                    . 'Please pay the ' . quotePeso($q['deposit_amount']) . ' deposit to confirm and reserve your event date. '
                    . 'Please note: once the deposit is paid, the booking is confirmed and **cancellations are non-refundable**. '
                    . 'If you need to make any changes, please message us before paying the deposit.';
                $at = date('Y-m-d H:i:s', strtotime(now()) + 1);
                $db->prepare("INSERT INTO `$DB_CRM`.cib_messages (conversation_id, sender_type, sender_name, message, attachments, created_at) VALUES (?,?,?,?,NULL,?)")
                   ->execute([$conv['id'], 'staff', 'Catering Team', $cancelMsg, $at]);
            }
            $db->prepare("UPDATE `$DB_CRM`.cib_conversations SET updated_at = ? WHERE id = ?")->execute([now(), $conv['id']]);
        }
        $db->commit();
    } catch (Throwable $e) {
        if ($db->inTransaction()) $db->rollBack();
        throw $e;
    }
    // Bell: the Sales Staff who handles this inquiry (+ Admin / Manager) hears what the customer decided.
    $nfEvent = trim((string)($q['lead_event_name'] ?? '')) !== '' ? $q['lead_event_name'] : 'an event';
    $nfWho = nfUserName($db, $customerId);
    $nfTitle = ['accept' => 'Quotation accepted', 'decline' => 'Quotation declined', 'change' => 'Changes requested'][$decision];
    $nfVerb = ['accept' => 'accepted', 'decline' => 'declined', 'change' => 'requested changes to'][$decision];
    notifySend($db, [
        'type' => 'deal', 'kind' => 'inquiry', 'ref' => 'INQ-' . str_pad((string)$iid, 4, '0', STR_PAD_LEFT),
        'title' => $nfTitle,
        'message' => $nfWho . ' ' . $nfVerb . ' the quotation for ' . $nfEvent . '.' . ($decision !== 'accept' && $reason !== '' ? ' Reason: ' . mb_substr($reason, 0, 120) : ''),
        'user_ids' => !empty($q['lead_staff_id']) ? [(int)$q['lead_staff_id']] : [],
        'exclude_user_id' => $customerId,
    ]);
    $quote = quotesByInquiry($db, [$iid], true)[$iid] ?? null;
    out(['success' => true, 'decision' => $decision, 'quotation' => $quote,
         'message' => $decision === 'accept'
             ? 'Quotation accepted. Your acceptance was sent to the catering team. Use the Pay deposit button to confirm your booking.'
             : ($decision === 'change'
                 ? 'Change request sent. The catering team will send you a revised quotation.'
                 : 'Quotation declined. The catering team will be notified.')]);
}

fail('Unknown action.', 400);