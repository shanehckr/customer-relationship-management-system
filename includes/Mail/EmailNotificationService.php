<?php
declare(strict_types=1);

require_once __DIR__ . '/EmailTemplateRenderer.php';
require_once __DIR__ . '/EmailService.php';
require_once dirname(__DIR__, 2) . '/config/environment.php';

final class EmailNotificationService
{
    public static function sendControlledTest(AppDatabase $db, string $recipientEmail): void
    {
        if (PHP_SAPI !== 'cli') {
            throw new RuntimeException('Controlled mail tests are available only from the command line.');
        }
        $service = EmailService::fromApplicationConfig($db);
        $service->sendControlledTestMessage($recipientEmail);
    }

    public static function queue(
        AppDatabase $db,
        int $recipientUserId,
        string $recipientEmail,
        string $recipientName,
        string $notificationType,
        string $subject,
        array $templateData,
        string $dedupeKey,
        string $relatedRecordType = '',
        int $relatedRecordId = 0
    ): ?int {
        // Keep low-value lifecycle emails off the queue while preserving essential
        // transaction confirmations and security mail.
        if (EmailService::isNotificationDisabled($notificationType)) {
            return null;
        }

        $recipientEmail = trim($recipientEmail);
        if (!filter_var($recipientEmail, FILTER_VALIDATE_EMAIL)) {
            error_log('Email notification skipped: no valid recipient email.');
            return null;
        }
        try {
            $service = EmailService::fromApplicationConfig($db);
            $config = $service->configuration();
            if (($config['enabled'] ?? false) !== true
                || !is_string($config['queue_encryption_key'] ?? null)
                || strlen((string) ($config['queue_encryption_key'] ?? '')) !== 32) {
                return null;
            }
            return $service->tryEnqueue([
                'user_id' => $recipientUserId > 0 ? $recipientUserId : null,
                'notification_type' => $notificationType,
                'related_record_type' => $relatedRecordType !== '' ? $relatedRecordType : null,
                'related_record_id' => $relatedRecordId > 0 ? $relatedRecordId : null,
                'recipient_email' => $recipientEmail,
                'recipient_name' => $recipientName,
                'sender' => str_starts_with($notificationType, 'support_ticket_')
                    ? 'customer_service'
                    : 'crm_notifications',
                'subject' => $subject,
                'template_key' => 'notification',
                'template_data' => $templateData,
                'dedupe_key' => $dedupeKey,
            ]);
        } catch (Throwable $e) {
            error_log('Email notification could not be queued safely.');
            return null;
        }
    }

    public static function customerRecipient(AppDatabase $db, int $userId, string $fallbackEmail = '', string $fallbackName = ''): array
    {
        $email = trim($fallbackEmail);
        $name = trim($fallbackName);
        if ($userId > 0) {
            try {
                $row = $db->prepare('SELECT full_name, email FROM users WHERE user_id = ? LIMIT 1');
                $row->execute([$userId]);
                $customer = $row->fetch();
                if ($customer) {
                    $name = trim((string) ($customer['full_name'] ?? '')) !== '' ? trim((string) $customer['full_name']) : $name;
                    $email = trim((string) ($customer['email'] ?? '')) !== '' ? trim((string) $customer['email']) : $email;
                }
            } catch (Throwable $e) {
            }
        }
        return ['email' => $email, 'name' => $name !== '' ? $name : 'Customer'];
    }

    public static function baseUrl(AppDatabase $db): string
    {
        try {
            $config = EmailService::fromApplicationConfig($db)->configuration();
            return rtrim((string) ($config['base_url'] ?? ''), '/') . '/';
        } catch (Throwable $e) {
            return crmApplicationBaseUrl();
        }
    }

    /** Existing authenticated application entry point; customer sub-pages are loaded inside this shell. */
    public static function customerAppUrl(AppDatabase $db, string $page, int $bookingId = 0): string
    {
        $customerPages = ['customer-home.html', 'customer-inquiries.html', 'customer-bookings.html', 'customer-inbox.html'];
        if (!in_array($page, $customerPages, true)) {
            $page = 'customer-home.html';
        }
        $query = ['crm_page' => $page];
        if ($page === 'customer-bookings.html' && $bookingId > 0) {
            $query['booking_id'] = $bookingId;
        }
        return rtrim(self::baseUrl($db), '/') . '/index.php?' . http_build_query($query);
    }
}
