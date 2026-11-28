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

function sendPaymentEmail(array $data): bool
{
    global $db;
    if (!$db instanceof AppDatabase) {
        throw new RuntimeException('Central CRM database is unavailable for email queueing.');
    }
    $service = EmailService::fromApplicationConfig($db);
    $config = $service->configuration();
    // Preserve the previous MAIL_ENABLED=false behavior until SMTP is configured and enabled.
    if (($config['enabled'] ?? false) !== true) return false;

    $reference = trim((string) ($data['reference'] ?? ''));
    $type = ($data['type'] ?? '') === 'balance' ? 'balance' : 'deposit';
    $bookingRef = trim((string) ($data['booking_ref'] ?? ''));
    $uniquePart = $reference !== '' ? $reference : $bookingRef . ':' . sha1(json_encode($data) ?: '');
    $dedupe = 'payment-email:' . $type . ':' . substr(hash('sha256', $uniquePart), 0, 48);
    $isBalance = $type === 'balance';
    require_once __DIR__ . '/includes/Mail/EmailNotificationService.php';
    $recipient = EmailNotificationService::customerRecipient(
        $db,
        (int) ($data['customer_id'] ?? 0),
        (string) ($data['to_email'] ?? ''),
        (string) ($data['to_name'] ?? '')
    );
    $remaining = (float) ($data['balance'] ?? 0);
    $heading = $isBalance ? 'Balance Payment Received' : 'Booking Confirmed';
    $subject = $isBalance
        ? 'Balance payment received - booking ' . $bookingRef
        : 'Deposit payment received - booking ' . $bookingRef . ' confirmed';
    $rows = [
        'Booking reference' => $bookingRef,
        'Event' => (string) ($data['event_name'] ?? ''),
        'Event date' => !empty($data['event_date']) ? date('F j, Y', strtotime((string) $data['event_date'])) : '',
        'Service arrangement' => (string) ($data['arrangement'] ?? ''),
        'Payment method' => (string) ($data['method'] ?? ''),
        'Transaction reference' => $reference,
        'Total booking amount' => 'PHP ' . number_format((float) ($data['total'] ?? 0), 2),
        'Verified deposit' => !$isBalance ? 'PHP ' . number_format((float) ($data['paid'] ?? 0), 2) : '',
        'Balance payment' => $isBalance ? 'PHP ' . number_format((float) ($data['paid'] ?? 0), 2) : '',
        'Remaining balance' => 'PHP ' . number_format(max(0, $remaining), 2),
    ];
    return EmailNotificationService::queue(
        $db,
        (int) ($data['customer_id'] ?? 0),
        $recipient['email'],
        $recipient['name'],
        $isBalance ? 'payment_balance_received' : 'payment_deposit_booking_confirmed',
        $subject,
        [
            'heading' => $heading,
            'greeting' => $recipient['name'],
            'message' => $isBalance
                ? 'We verified your remaining balance payment.'
                : 'We verified your 20% deposit and successfully confirmed your booking.',
            'amount' => 'PHP ' . number_format((float) ($data['paid'] ?? 0), 2),
            'rows' => $rows,
            'button_text' => 'View My Bookings',
            'button_url' => EmailNotificationService::customerAppUrl($db, 'customer-bookings.html', (int) ($data['booking_id'] ?? 0)),
        ],
        $dedupe,
        'booking',
        (int) ($data['booking_id'] ?? 0)
    ) !== null;
}
