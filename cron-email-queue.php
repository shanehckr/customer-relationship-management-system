<?php
declare(strict_types=1);

if (PHP_SAPI !== 'cli') {
    http_response_code(404);
    exit;
}

function emailQueueRunMessage(string $message, bool $error = false): void
{
    $stream = $error ? STDERR : STDOUT;
    $line = gmdate('c') . ' ' . $message . PHP_EOL;
    $logPath = rtrim(sys_get_temp_dir(), DIRECTORY_SEPARATOR)
        . DIRECTORY_SEPARATOR
        . 'espinosilla-crm-email-queue-' . gmdate('Y-m-d') . '.log';

    if (file_put_contents($logPath, $line, FILE_APPEND | LOCK_EX) === false) {
        error_log('Email queue worker could not write its execution log.');
    }
    fwrite($stream, $message . PHP_EOL);
}

$notificationId = null;
$afterNotificationId = null;
if ($argc > 1) {
    if ($argc !== 2) {
        emailQueueRunMessage('Usage: php cron-email-queue.php [--notification-id=<positive-id>|--after-notification-id=<positive-id>]', true);
        exit(64);
    }
    if (preg_match('/^--notification-id=([1-9][0-9]*)$/', $argv[1], $match) === 1) {
        $notificationId = (int) $match[1];
    } elseif (preg_match('/^--after-notification-id=([1-9][0-9]*)$/', $argv[1], $match) === 1) {
        $afterNotificationId = (int) $match[1];
    } else {
        emailQueueRunMessage('Usage: php cron-email-queue.php [--notification-id=<positive-id>|--after-notification-id=<positive-id>]', true);
        exit(64);
    }
}

require_once __DIR__ . '/config/database.php';
require_once __DIR__ . '/includes/Mail/EmailTemplateRenderer.php';
require_once __DIR__ . '/includes/Mail/EmailService.php';
require_once __DIR__ . '/includes/Mail/EmailQueueWorker.php';

$lockPath = rtrim(sys_get_temp_dir(), DIRECTORY_SEPARATOR) . DIRECTORY_SEPARATOR . 'crm-email-queue.lock';
$lock = fopen($lockPath, 'c');
if ($lock === false || !flock($lock, LOCK_EX | LOCK_NB)) {
    emailQueueRunMessage('Email queue worker is already running.', true);
    exit(2);
}

try {
    $emailService = EmailService::fromApplicationConfig($db);
    $mailConfig = $emailService->configuration();
    if (($mailConfig['enabled'] ?? false) !== true) {
        emailQueueRunMessage('Email sending is disabled; queued messages were left unchanged.');
        exit(0);
    }
    $worker = new EmailQueueWorker($db, $emailService, $mailConfig);
    if ($notificationId !== null) {
        $processed = $worker->processOne($notificationId) ? 1 : 0;
    } else {
        $processed = 0;
        $limit = max(1, min(250, (int) ($mailConfig['batch_limit'] ?? 25)));
        while ($processed < $limit && $worker->processOne(null, null, $afterNotificationId)) $processed++;
    }
    emailQueueRunMessage('Processed ' . $processed . ' queued email(s).');
} catch (Throwable $e) {
    error_log('Email queue worker stopped (' . get_class($e) . ').');
    emailQueueRunMessage('Email queue worker stopped due to a configuration or database error. See the server error log.', true);
    exit(1);
} finally {
    flock($lock, LOCK_UN);
    fclose($lock);
}
