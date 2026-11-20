<?php
/**
 * sales-available.php - Sales Staff > Available Inquiries (pages.js crmInitSalesAvailable)
 *   GET  ?action=available -> unassigned inquiries (assigned_staff_id IS NULL, not Declined)
 *   POST ?action=claim     -> inquiry_ref ; assigns the logged-in staff, stage -> "In Progress", creates the chat conversation
 * pages.js swaps "action=..." in data-api, so keep data-api="sales-available.php?action=available" in the HTML.
 *
 * firstOf(), loadMenu() and enrichLeads() live in inquiry-common.php (shared), so they are NOT redeclared here.
 */
// Shared session setup: secure cookie settings + 30-minute inactivity timeout (replies 401 "session_expired" as JSON).
define('SESSION_API', true);
require_once __DIR__ . '/session-init.php';

require __DIR__ . '/inquiry-common.php';
require_once __DIR__ . '/notifications-helper.php';   // bell notifications (see notifications-api.php)
$staff = requireSalesStaff();
$action = $_GET['action'] ?? '';

if ($action === 'available') {
    $st = $db->query("SELECT l.* FROM leads l WHERE l.assigned_staff_id IS NULL AND l.stage <> 'Declined'
                      ORDER BY l.created_at DESC, l.`$LEAD_PK` DESC");
    out(['success' => true, 'inquiries' => enrichLeads($db, $DB_CRM, $st->fetchAll())]);
}

if ($action === 'claim') {
    if ($_SERVER['REQUEST_METHOD'] !== 'POST') fail('POST required.', 405);
    $id = leadIdFromRef((string)($_POST['inquiry_ref'] ?? ''));
    if (!$id) fail('Inquiry not found.', 404);

    $db->beginTransaction();
    try {
        // "assigned_staff_id IS NULL" makes this safe when two staff accept at once: only one UPDATE wins.
        $st = $db->prepare("UPDATE leads SET assigned_staff_id = ?, assigned_staff_name = ?, stage = ?, claimed_at = ?
                            WHERE `$LEAD_PK` = ? AND assigned_staff_id IS NULL");
        $st->execute([$staff['id'], $staff['name'], STAGE_PROGRESS, now(), $id]);
        if ($st->rowCount() === 0) {
            $db->rollBack();
            $chk = $db->prepare("SELECT assigned_staff_id FROM leads WHERE `$LEAD_PK` = ?");
            $chk->execute([$id]);
            if (!$chk->fetch()) fail('Inquiry not found.', 404);
            fail('This inquiry was already accepted by another staff member.', 409);
        }

        // The customer's inbox conversation is created ONLY now, after a staff accepted.
        $ls = $db->prepare("SELECT event_name, inquiry_ref, customer_id, customer_name, notes FROM leads WHERE `$LEAD_PK` = ?");
        $ls->execute([$id]);
        $lead = $ls->fetch();
        $has = $db->prepare("SELECT id FROM `$DB_CRM`.cib_conversations WHERE inquiry_id = ?");
        $has->execute([$id]);
        if ($lead && !empty($lead['customer_id']) && !$has->fetch()) {
            $ref = $lead['inquiry_ref'] ?: 'INQ-' . str_pad((string)$id, 4, '0', STR_PAD_LEFT);
            $db->prepare("INSERT INTO `$DB_CRM`.cib_conversations (customer_id, title, reference, status, created_at, updated_at, inquiry_id)
                          VALUES (?,?,?,?,?,?,?)")
               ->execute([$lead['customer_id'], $lead['event_name'], $ref, 'Active', now(), now(), $id]);
            $convId = (int)$db->lastInsertId();
            if (trim((string)$lead['notes']) !== '') {
                $db->prepare("INSERT INTO `$DB_CRM`.cib_messages (conversation_id, sender_type, sender_name, message, created_at) VALUES (?,?,?,?,?)")
                   ->execute([$convId, 'customer', $lead['customer_name'] ?: 'Customer', $lead['notes'], now()]);
            }
            // Welcome: the first thing the customer sees in the new chat.
            $db->prepare("INSERT INTO `$DB_CRM`.cib_messages (conversation_id, sender_type, sender_name, message, created_at) VALUES (?,?,?,?,?)")
               ->execute([$convId, 'staff', $staff['name'], nfWelcomeMessage((string)($lead['event_name'] ?? ''), $staff['name']), now()]);
        }
        $db->commit();
    } catch (Throwable $e) {
        if ($db->inTransaction()) $db->rollBack();
        throw $e;
    }
// Bell: the customer hears who handles the inquiry; Admin and Manager see it too.
$lead = is_array($lead) ? $lead : [];
$nfRef = !empty($lead['inquiry_ref']) ? $lead['inquiry_ref'] : 'INQ-' . str_pad((string)$id, 4, '0', STR_PAD_LEFT);
$nfEvent = trim((string)($lead['event_name'] ?? '')) !== '' ? $lead['event_name'] : 'an event';
notifySend($db, [
    'type' => 'lead', 'kind' => 'inquiry', 'ref' => $nfRef,
    'title' => 'Inquiry accepted',
    'message' => $staff['name'] . ' accepted ' . $nfRef . ' (' . $nfEvent . ').',
    'user_ids' => !empty($lead['customer_id']) ? [(int)$lead['customer_id']] : [],
    'exclude_user_id' => $staff['id'],
    'customer' => [
        'title' => 'Your inquiry is being handled',
        'message' => $staff['name'] . ' from our sales team is now handling your inquiry for ' . $nfEvent . '. You can chat with them in your Inbox.',
    ],
]);
out(['success' => true, 'message' => 'Inquiry accepted. It is now in your Inquiries and the chat with the customer is open.']);
}

fail('Unknown action.', 400);