<?php
declare(strict_types=1);

/** Check for the optional sender identity column without changing the schema at runtime. */
function ticketMessageSenderIdAvailable(AppDatabase $db): bool
{
    static $available = null;
    if ($available !== null) {
        return $available;
    }

    try {
        $available = (bool)$db->query("SHOW COLUMNS FROM cib_ticket_messages LIKE 'sender_id'")->fetch();
    } catch (Throwable $error) {
        error_log('Inbox ticket sender identity schema check failed: ' . $error->getMessage());
        $available = false;
    }
    return $available;
}
