<?php
declare(strict_types=1);

if (PHP_SAPI !== 'cli') {
    http_response_code(404);
    exit;
}

require_once __DIR__ . '/config/database.php';
require_once __DIR__ . '/includes/Mail/EmailTemplateRenderer.php';
require_once __DIR__ . '/includes/Mail/EmailService.php';
require_once __DIR__ . '/includes/Mail/EmailQueueWorker.php';

$lockPath = rtrim(sys_get_temp_dir(), DIRECTORY_SEPARATOR) . DIRECTORY_SEPARATOR . 'crm-email-queue.lock';
$lock = fopen($lockPath, 'c');
if ($lock === false || !flock($lock, LOCK_EX | LOCK_NB)) {
    fwrite(STDERR, "Email queue worker is already running.\n");
    exit(2);
}

try {
    $emailService = EmailService::fromApplicationConfig($db);
    $mailConfig = $emailService->configuration();
    if (($mailConfig['enabled'] ?? false) !== true) {
        fwrite(STDOUT, "Email sending is disabled; queued messages were left unchanged.\n");
        exit(0);
    }
    $worker = new EmailQueueWorker($db, $emailService, $mailConfig);
    $processed = 0;
    $limit = max(1, min(250, (int) ($mailConfig['batch_limit'] ?? 25)));
    while ($processed < $limit && $worker->processOne()) $processed++;
    fwrite(STDOUT, 'Processed ' . $processed . " queued email(s).\n");
} catch (Throwable $e) {
    error_log('Email queue worker stopped: ' . $e->getMessage());
    fwrite(STDERR, "Email queue worker stopped due to a configuration or database error. See the server error log.\n");
    exit(1);
} finally {
    flock($lock, LOCK_UN);
    fclose($lock);
}
