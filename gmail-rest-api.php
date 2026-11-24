<?php
declare(strict_types=1);

/**
 * Backward-compatible payment mail adapter.
 * Existing Xendit flow calls this only after verified payment data is committed.
 * Actual queuing, rendering, sending, and retry behavior lives in EmailService.
 */

require_once __DIR__ . '/includes/Mail/EmailTemplateRenderer.php';
require_once __DIR__ . '/includes/Mail/EmailService.php';
require_once __DIR__ . '/includes/Mail/EmailQueueWorker.php';

function mailPeso(float $amount): string
{
    return 'PHP ' . number_format($amount, 2);
}

function sendPaymentEmail(array $data): void
{
    global $db;
    if (!$db instanceof AppDatabase) {
        throw new RuntimeException('Central CRM database is unavailable for email queueing.');
    }
    $service = EmailService::fromApplicationConfig($db);
    $config = $service->configuration();
    // Preserve the previous MAIL_ENABLED=false behavior until SMTP is configured and enabled.
    if (($config['enabled'] ?? false) !== true) return;

    $renderer = new EmailTemplateRenderer();
    $rendered = $renderer->render('payment_received', $data);
    $reference = trim((string) ($data['reference'] ?? ''));
    $type = ($data['type'] ?? '') === 'balance' ? 'balance' : 'deposit';
    $bookingRef = trim((string) ($data['booking_ref'] ?? ''));
    $uniquePart = $reference !== '' ? $reference : $bookingRef . ':' . sha1(json_encode($data) ?: '');
    $dedupe = 'payment-email:' . $type . ':' . substr(hash('sha256', $uniquePart), 0, 48);

    $id = $service->enqueue([
        'notification_type' => 'payment_' . $type . '_received',
        'recipient_email' => (string) ($data['to_email'] ?? ''),
        'recipient_name' => (string) ($data['to_name'] ?? ''),
        'sender' => 'crm_notifications',
        'subject' => (string) ($rendered['subject'] ?? ('Payment received - booking ' . $bookingRef)),
        'template_key' => 'payment_received',
        'template_data' => $data,
        'dedupe_key' => $dedupe,
        'related_record_type' => 'booking',
        'related_record_id' => isset($data['booking_id']) ? (int) $data['booking_id'] : null,
    ]);

    $worker = new EmailQueueWorker($db, $service, $config);
    $worker->processOne($id);
    $status = $db->prepare('SELECT delivery_status FROM notification_logs WHERE notification_id = ?');
    $status->execute([$id]);
    if ($status->fetchColumn() !== 'SENT') {
        throw new RuntimeException('Payment email was queued for retry or marked failed.');
    }
}
