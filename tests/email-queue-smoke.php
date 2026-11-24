<?php
declare(strict_types=1);

if (PHP_SAPI !== 'cli') {
    http_response_code(404);
    exit;
}

require_once __DIR__ . '/../config/database.php';
require_once __DIR__ . '/../includes/Mail/EmailTemplateRenderer.php';
require_once __DIR__ . '/../includes/Mail/EmailService.php';
require_once __DIR__ . '/../includes/Mail/EmailQueueWorker.php';

$config = require __DIR__ . '/../config/mail.php';
$config['enabled'] = true;
$config['queue_encryption_key'] = random_bytes(32); // ephemeral test-only key
foreach ($config['identities'] as &$testIdentity) {
    $testIdentity['password'] = '';
    $testIdentity['available'] = false;
}
unset($testIdentity);
$config['identities']['crm_notifications']['password'] = 'test-transport-only';
$config['identities']['crm_notifications']['available'] = true;
$service = new EmailService($db, $config);
$worker = new EmailQueueWorker($db, $service, $config);
$suffix = bin2hex(random_bytes(10));
$ids = [];
$assert = static function (bool $condition, string $message): void {
    if (!$condition) throw new RuntimeException($message);
};
$enqueue = static function (string $key) use ($service, $suffix): int {
    return $service->enqueue([
        'notification_type' => 'phase1_smoke_test',
        'recipient_email' => 'email-queue-test@example.invalid',
        'recipient_name' => 'Queue Test',
        'sender' => 'crm_notifications',
        'subject' => 'Email queue smoke test',
        'template_key' => 'password_reset',
        'template_data' => [
            'name' => 'Queue Test',
            'reset_url' => 'https://example.invalid/reset/' . $suffix,
            'expires_minutes' => 1,
        ],
        'dedupe_key' => $key,
        'related_record_type' => 'phase1_test',
    ]);
};

try {
    $successId = $enqueue('phase1-smoke:success:' . $suffix);
    $ids[] = $successId;
    $duplicateId = $enqueue('phase1-smoke:success:' . $suffix);
    $assert($successId === $duplicateId, 'Duplicate enqueue did not return the original row.');

    $sent = 0;
    $worker->processOne($successId, static function (array $row, array $identity, array $rendered) use (&$sent): void {
        $sent++;
        if (!str_contains($rendered['text'], 'Queue Test')) throw new RuntimeException('Plain-text template content missing.');
        if (!str_contains($rendered['html'], 'Queue Test')) throw new RuntimeException('HTML template content missing.');
    });
    $row = $db->prepare('SELECT delivery_status, attempt_count, sent_at, user_id FROM notification_logs WHERE notification_id = ?');
    $row->execute([$successId]);
    $success = $row->fetch();
    $assert($sent === 1 && $success['delivery_status'] === 'SENT' && (int) $success['attempt_count'] === 1, 'Successful dispatch did not log SENT.');
    $assert($success['sent_at'] !== null && $success['user_id'] === null, 'Sent timestamp or external-recipient logging failed.');

    $retryId = $enqueue('phase1-smoke:retry:' . $suffix);
    $ids[] = $retryId;
    $firstAttempt = true;
    $worker->processOne($retryId, static function () use (&$firstAttempt): void {
        if ($firstAttempt) {
            $firstAttempt = false;
            throw new RuntimeException('Simulated transient transport failure.');
        }
    });
    $db->prepare("UPDATE notification_logs SET next_attempt_at = DATE_SUB(UTC_TIMESTAMP(), INTERVAL 1 SECOND) WHERE notification_id = ?")->execute([$retryId]);
    $worker->processOne($retryId, static function (): void {});
    $row->execute([$retryId]);
    $retried = $row->fetch();
    $assert($retried['delivery_status'] === 'SENT' && (int) $retried['attempt_count'] === 2, 'Retry did not transition back to SENT.');

    $terminalId = $enqueue('phase1-smoke:terminal:' . $suffix);
    $ids[] = $terminalId;
    $terminalConfig = $config;
    $terminalConfig['max_attempts'] = 2;
    $terminalWorker = new EmailQueueWorker($db, $service, $terminalConfig);
    $alwaysFail = static function (): void { throw new RuntimeException('Simulated permanent transport failure.'); };
    $terminalWorker->processOne($terminalId, $alwaysFail);
    $db->prepare("UPDATE notification_logs SET next_attempt_at = DATE_SUB(UTC_TIMESTAMP(), INTERVAL 1 SECOND) WHERE notification_id = ?")->execute([$terminalId]);
    $terminalWorker->processOne($terminalId, $alwaysFail);
    $row->execute([$terminalId]);
    $failed = $row->fetch();
    $assert($failed['delivery_status'] === 'FAILED' && (int) $failed['attempt_count'] === 2, 'Retry limit did not end in FAILED.');

    $unauthorizedRejected = false;
    try {
        $service->enqueue([
            'notification_type' => 'phase1_smoke_test',
            'recipient_email' => 'email-queue-test@example.invalid',
            'subject' => 'Unauthorized sender check',
            'template_key' => 'password_reset',
            'template_data' => ['name' => 'Test', 'reset_url' => 'https://example.invalid', 'expires_minutes' => 1],
            'dedupe_key' => 'phase1-smoke:unauthorized:' . $suffix,
            'sender' => 'attacker@example.invalid',
        ]);
    } catch (InvalidArgumentException) {
        $unauthorizedRejected = true;
    }
    $assert($unauthorizedRejected, 'Unapproved sender identity was accepted.');
    $availability = $service->senderAvailability();
    $assert($availability['crm_notifications'] === 'available'
        && $availability['customer_service'] === 'unavailable'
        && $availability['john'] === 'unavailable'
        && $availability['lara'] === 'unavailable', 'Departmental sender availability was not reported independently.');
    $unavailableResult = $service->tryEnqueue([
        'notification_type' => 'phase1_smoke_test',
        'recipient_email' => 'email-queue-test@example.invalid',
        'subject' => 'Unavailable sender check',
        'template_key' => 'password_reset',
        'template_data' => ['name' => 'Test', 'reset_url' => 'https://example.invalid', 'expires_minutes' => 1],
        'dedupe_key' => 'phase1-smoke:unavailable:' . $suffix,
        'sender' => 'customer_service',
    ]);
    $assert($unavailableResult === null, 'Unavailable sender did not safely skip queueing.');
    $configuredLater = $config;
    $configuredLater['identities']['customer_service']['password'] = 'test-transport-only';
    $configuredLater['identities']['customer_service']['available'] = true;
    $laterService = new EmailService($db, $configuredLater);
    $departmentId = $laterService->enqueue([
        'notification_type' => 'phase1_smoke_test',
        'recipient_email' => 'email-queue-test@example.invalid',
        'subject' => 'Department sender availability check',
        'template_key' => 'password_reset',
        'template_data' => ['name' => 'Test', 'reset_url' => 'https://example.invalid', 'expires_minutes' => 1],
        'dedupe_key' => 'phase1-smoke:department:' . $suffix,
        'sender' => 'customer_service',
    ]);
    $ids[] = $departmentId;
    $attemptedUnavailableSender = false;
    $assert(!$worker->processOne($departmentId, static function () use (&$attemptedUnavailableSender): void {
        $attemptedUnavailableSender = true;
    }), 'Worker selected a sender whose credentials are unavailable.');
    $row->execute([$departmentId]);
    $departmentRow = $row->fetch();
    $assert(!$attemptedUnavailableSender && $departmentRow['delivery_status'] === 'QUEUED'
        && (int) $departmentRow['attempt_count'] === 0, 'Unavailable department queue row was attempted or changed.');
    fwrite(STDOUT, "PASS: queue insert, deduplication, encrypted external recipient, template render, SENT logging, retry, terminal FAILED state, sender allowlist, per-account availability, and safe unavailable-sender skip.\n");
} finally {
    if ($ids) {
        $marks = implode(',', array_fill(0, count($ids), '?'));
        $db->prepare("DELETE FROM notification_logs WHERE notification_id IN ($marks) AND notification_type = 'phase1_smoke_test'")->execute($ids);
    }
}
