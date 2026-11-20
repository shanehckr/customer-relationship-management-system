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
 * $db is the PDO connection you already use there.
 */
function cib_start_conversation(PDO $db, int $customerId, int $inquiryId, string $title, string $reference = '', string $firstMessage = ''): int {
    $db->exec("CREATE TABLE IF NOT EXISTS cib_conversations (
        id INT AUTO_INCREMENT PRIMARY KEY, customer_id INT NOT NULL, title VARCHAR(160) NOT NULL, reference VARCHAR(60) DEFAULT '',
        status VARCHAR(30) NOT NULL DEFAULT 'Active', created_at DATETIME NOT NULL, updated_at DATETIME NOT NULL, INDEX (customer_id)
    ) ENGINE=InnoDB");
    $db->exec("CREATE TABLE IF NOT EXISTS cib_messages (
        id INT AUTO_INCREMENT PRIMARY KEY, conversation_id INT NOT NULL, sender_type VARCHAR(20) NOT NULL,
        sender_name VARCHAR(120) DEFAULT '', message TEXT, attachments TEXT, created_at DATETIME NOT NULL, INDEX (conversation_id)
    ) ENGINE=InnoDB");
    $has = $db->query("SHOW COLUMNS FROM cib_conversations LIKE 'inquiry_id'")->fetch();
    if (!$has) $db->exec("ALTER TABLE cib_conversations ADD COLUMN inquiry_id INT NULL DEFAULT NULL");

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