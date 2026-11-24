<?php
/**
 * inbox-link.php
 *
 * Creates the customer's conversation (Messages tab) for an inquiry, so Sales Staff can reply from
 * their inbox (sales-inbox-api.php). Call it from the place where an inquiry is saved, e.g. in
 * customer-inquiries-api.php right after the inquiry row is inserted:
 *
 *     require_once __DIR__ . '/inbox-link.php';
 *     cib_start_conversation($db, $customerId, $inquiryId, $inquiryTitle, $inquiryReference, $firstMessage);
 *
 * It is safe to call twice for the same inquiry: the existing conversation is returned.
 * $db is the AppDatabase connection you already use there.
 */
function cib_start_conversation(AppDatabase $db, int $customerId, int $inquiryId, string $title, string $reference = '', string $firstMessage = ''): int {
    // Schema is installed from database/catering_crm.sql, never mutated in requests.
    // Schema is installed from database/catering_crm.sql, never mutated in requests.
    $has = $db->query("SHOW COLUMNS FROM cib_conversations LIKE 'inquiry_id'")->fetch();

    $st = $db->prepare('SELECT id FROM cib_conversations WHERE inquiry_id = ? LIMIT 1');
    $st->execute([$inquiryId]);
    $existing = $st->fetchColumn();
    if ($existing) return (int)$existing;

    $now = date('Y-m-d H:i:s');
    $title = mb_substr(trim($title) !== '' ? trim($title) : 'Catering Inquiry', 0, 160);
    $db->prepare('INSERT INTO cib_conversations (customer_id, title, reference, status, inquiry_id, created_at, updated_at) VALUES (?,?,?,?,?,?,?)')
       ->execute([$customerId, $title, $reference, 'Active', $inquiryId, $now, $now]);
    $conversationId = (int)$db->lastInsertId();
    if (trim($firstMessage) !== '') {
        $db->prepare('INSERT INTO cib_messages (conversation_id, sender_type, sender_name, message, created_at) VALUES (?,?,?,?,?)')
           ->execute([$conversationId, 'customer', 'You', trim($firstMessage), $now]);
    }
    return $conversationId;
}