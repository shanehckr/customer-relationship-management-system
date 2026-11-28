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
    $st = $db->query("SELECT l.* FROM leads l WHERE l.assigned_staff_id IS NULL AND l.stage NOT IN ('Declined','Cancelled')
                      ORDER BY l.created_at DESC, l.`$LEAD_PK` DESC");
    $rows = enrichLeads($db, $DB_CRM, $st->fetchAll());
    out(['success' => true, 'inquiries' => $rows]);
}

if ($action === 'claim') {
    if ($_SERVER['REQUEST_METHOD'] !== 'POST') fail('POST required.', 405);
    $id = leadIdFromRef((string)($_POST['inquiry_ref'] ?? ''));
    if (!$id) fail('Inquiry not found.', 404);

    try {
        $db->beginTransaction();
        // The conditional update is atomic: only one staff member can claim an unassigned, open inquiry.
        $st = $db->prepare("UPDATE leads SET assigned_staff_id = ?, assigned_staff_name = ?, stage = ?, claimed_at = ?
                            WHERE `$LEAD_PK` = ? AND assigned_staff_id IS NULL AND stage NOT IN ('Declined','Cancelled')");
        $st->execute([$staff['id'], $staff['name'], STAGE_PROGRESS, now(), $id]);
        if ($st->rowCount() === 0) {
            $db->rollBack();
            $chk = $db->prepare("SELECT assigned_staff_id, stage FROM leads WHERE `$LEAD_PK` = ?");
            $chk->execute([$id]);
            $current = $chk->fetch();
            if ($current === false) fail('Inquiry not found.', 404);
            if ((int)$current['assigned_staff_id'] === (int)$staff['id']) fail('You have already claimed this inquiry. Refresh My Inquiries to see it.', 409);
            if ($current['assigned_staff_id'] !== null) fail('This inquiry was already claimed by another staff member.', 409);
            fail('This inquiry is no longer available to claim.', 409);
        }
        $db->prepare('INSERT INTO inquiry_assignments (lead_id, previous_staff_id, new_staff_id, changed_by, reason)
                      VALUES (?, NULL, ?, ?, ?)')
           ->execute([$id, $staff['id'], $staff['id'], 'Accepted available inquiry']);

        // The customer's inbox conversation is created ONLY now, after a staff accepted.
        $ls = $db->prepare("SELECT event_name, inquiry_ref, customer_id, customer_name, notes FROM leads WHERE `$LEAD_PK` = ?");
        $ls->execute([$id]);
        $lead = $ls->fetch();
        if ($lead === false) throw new RuntimeException('The claimed inquiry could not be loaded.');
        $has = $db->prepare("SELECT id FROM `$DB_CRM`.cib_conversations WHERE inquiry_id = ?");
        $has->execute([$id]);
        $conversation = $has->fetch();
        if (!empty($lead['customer_id']) && $conversation === false) {
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
        if ($db->inTransaction()) {
            try {
                $db->rollBack();
            } catch (Throwable $rollbackError) {
                error_log('sales-available claim rollback failed for inquiry ' . $id . ': ' . $rollbackError->getMessage());
            }
        }
        error_log('sales-available claim failed for inquiry ' . $id . ': ' . $e->getMessage());
        fail('Unable to claim this inquiry right now. Please try again.', 500);
    }
// Bell: the customer hears who handles the inquiry; Admin and Manager see it too.
$lead = is_array($lead) ? $lead : [];
$nfRef = !empty($lead['inquiry_ref']) ? $lead['inquiry_ref'] : 'INQ-' . str_pad((string)$id, 4, '0', STR_PAD_LEFT);
$nfEvent = trim((string)($lead['event_name'] ?? '')) !== '' ? $lead['event_name'] : 'an event';
try {
    notifySend($db, [
        'type' => 'lead', 'kind' => 'inquiry', 'ref' => $nfRef,
        'title' => 'Inquiry claimed',
        'message' => $staff['name'] . ' claimed ' . $nfRef . ' (' . $nfEvent . ').',
        'user_ids' => !empty($lead['customer_id']) ? [(int)$lead['customer_id']] : [],
        'exclude_user_id' => $staff['id'],
        'customer' => [
            'title' => 'Your inquiry is being handled',
            'message' => $staff['name'] . ' from our sales team is now handling your inquiry for ' . $nfEvent . '. You can chat with them in your Inbox.',
        ],
    ]);
} catch (Throwable $e) {
    // Assignment and conversation are committed; a bell notification failure must not report a false claim failure.
    error_log('sales-available claim notification failed for inquiry ' . $id . ': ' . $e->getMessage());
}
out(['success' => true, 'message' => 'Inquiry claimed successfully. It is now in My Inquiries and the customer chat is ready.']);
}

fail('Unknown action.', 400);
