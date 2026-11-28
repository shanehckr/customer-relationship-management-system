<?php
declare(strict_types=1);

if (PHP_SAPI !== 'cli') {
    http_response_code(404);
    exit;
}

$recipient = trim((string) ($argv[1] ?? ''));
$confirmation = (string) ($argv[2] ?? '');
if (!filter_var($recipient, FILTER_VALIDATE_EMAIL) || $confirmation !== '--confirm-send') {
    fwrite(STDERR, "Usage: php tests/send-mail-test.php <test-recipient-email> --confirm-send\n");
    exit(2);
}

require_once __DIR__ . '/../config/database.php';
require_once __DIR__ . '/../includes/Mail/EmailNotificationService.php';

try {
    EmailNotificationService::sendControlledTest($db, $recipient);
    fwrite(STDOUT, "SMTP test message sent to the specified test recipient.\n");
} catch (Throwable $e) {
    fwrite(STDERR, "SMTP test was not sent. Check the server error log and mail configuration.\n");
    exit(1);
}
