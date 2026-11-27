<?php
declare(strict_types=1);

use PHPMailer\PHPMailer\PHPMailer;

final class EmailSenderUnavailableException extends RuntimeException
{
}

final class EmailService
{
    private EmailTemplateRenderer $renderer;

    public function __construct(private AppDatabase $db, private array $config)
    {
        $this->renderer = new EmailTemplateRenderer();
    }

    /** Load the protected configuration through the shared application mail service. */
    public static function fromApplicationConfig(AppDatabase $db): self
    {
        $config = require dirname(__DIR__, 2) . '/config/mail.php';
        return new self($db, $config);
    }

    public function configuration(): array
    {
        return $this->config;
    }

    /** @return array<string,string> */
    public function senderAvailability(): array
    {
        $availability = [];
        foreach ((array) ($this->config['identities'] ?? []) as $key => $identity) {
            $availability[(string) $key] = !empty($identity['available'])
                || (trim((string) ($identity['password'] ?? '')) !== '' && trim((string) ($identity['username'] ?? '')) !== '')
                ? 'available'
                : 'unavailable';
        }
        return $availability;
    }

    /** Optional notifications may safely skip when their selected department identity is unavailable. */
    public function tryEnqueue(array $message): ?int
    {
        try {
            $notificationId = $this->enqueue($message);
            return $notificationId > 0 ? $notificationId : null;
        } catch (EmailSenderUnavailableException $e) {
            error_log('Email notification skipped because its sender identity is unavailable.');
            return null;
        }
    }

    public function isEnabled(): bool
    {
        return ($this->config['enabled'] ?? false) === true;
    }

    public function sendControlledTestMessage(string $recipientEmail): void
    {
        if (PHP_SAPI !== 'cli') {
            throw new RuntimeException('Controlled mail tests are available only from the command line.');
        }
        if (getenv('CRM_MAIL_ENABLED') !== '0' || $this->isEnabled()) {
            throw new RuntimeException('Disable business email notifications before running a controlled test.');
        }
        $recipientEmail = trim($recipientEmail);
        if (!filter_var($recipientEmail, FILTER_VALIDATE_EMAIL)) {
            throw new InvalidArgumentException('A valid test recipient email is required.');
        }

        $identity = $this->resolveSender('crm_notifications', []);
        $rendered = $this->renderer->render('system_test', []);
        $this->sendWithPhpMailer([
            'recipient_email' => $recipientEmail,
            'recipient_name' => 'CRM SMTP Test Recipient',
            'reply_to_email' => $identity['email'],
            'email_subject' => 'Catering CRM SMTP configuration test',
        ], $identity, $rendered);
    }

    /**
     * Store an encrypted, deduplicated email request. Required: type, recipient, template,
     * template_data and dedupe_key. sender may be crm_notifications, customer_service,
     * john, lara, or sales (with assigned_employee_email).
     */
    public function enqueue(array $message): int
    {
        $recipient = trim((string) ($message['recipient_email'] ?? ''));
        if (!filter_var($recipient, FILTER_VALIDATE_EMAIL)) {
            throw new InvalidArgumentException('A valid recipient email is required.');
        }
        $type = $this->cleanHeader((string) ($message['notification_type'] ?? ''));
        $subject = $this->cleanHeader((string) ($message['subject'] ?? ''));
        $template = (string) ($message['template_key'] ?? '');
        $dedupeKey = trim((string) ($message['dedupe_key'] ?? ''));
        if ($type === '' || $subject === '' || $dedupeKey === '' || strlen($dedupeKey) > 190) {
            throw new InvalidArgumentException('Notification type, subject and a deduplication key are required.');
        }
        // Render once here to reject missing or invalid templates before they enter the queue.
        $this->renderer->render($template, (array) ($message['template_data'] ?? []));
        try {
            $sender = $this->resolveSender((string) ($message['sender'] ?? 'crm_notifications'), $message);
        } catch (EmailSenderUnavailableException $e) {
            error_log('Email notification skipped because its sender identity is unavailable.');
            return 0;
        }
        $payload = $this->encryptPayload((array) ($message['template_data'] ?? []));
        $userId = isset($message['user_id']) ? (int) $message['user_id'] : null;
        $recordId = isset($message['related_record_id']) ? (int) $message['related_record_id'] : null;

        $this->db->prepare(
            "INSERT INTO notification_logs
                (user_id, notification_type, related_record_type, related_record_id, channel, delivery_status,
                 recipient_email, recipient_name, sender_email, sender_identity, from_name, reply_to_email,
                 email_subject, template_key, payload_encrypted, dedupe_key, attempt_count, next_attempt_at, created_at)
             VALUES (?, ?, ?, ?, 'EMAIL', 'QUEUED', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, UTC_TIMESTAMP(), UTC_TIMESTAMP())
             ON DUPLICATE KEY UPDATE notification_id = LAST_INSERT_ID(notification_id)"
        )->execute([
            $userId,
            $type,
            $message['related_record_type'] ?? null,
            $recordId,
            $recipient,
            mb_substr((string) ($message['recipient_name'] ?? ''), 0, 150),
            $sender['email'],
            $sender['key'],
            mb_substr($sender['name'], 0, 150),
            $sender['reply_to'],
            mb_substr($subject, 0, 255),
            $template,
            $payload,
            $dedupeKey,
        ]);
        return (int) $this->db->lastInsertId();
    }

    /** Resolve a CRM- or staff-approved identity. Arbitrary From addresses are never accepted. */
    private function resolveSender(string $requested, array $message): array
    {
        $identities = (array) ($this->config['identities'] ?? []);
        $replyTo = '';
        if ($requested === 'sales') {
            $employeeEmail = trim((string) ($message['assigned_employee_email'] ?? ''));
            if (!filter_var($employeeEmail, FILTER_VALIDATE_EMAIL)) {
                throw new InvalidArgumentException('Sales email requires the assigned employee email.');
            }
            $check = $this->db->prepare(
                "SELECT u.email FROM users u JOIN roles r ON r.role_id = u.role_id
                 WHERE u.email = ? AND r.role_name = 'Sales Staff' AND u.account_status = 'Active' LIMIT 1"
            );
            $check->execute([$employeeEmail]);
            $stored = $check->fetch();
            if (!$stored) throw new InvalidArgumentException('Assigned Sales Staff identity is not authorized.');
            $replyTo = (string) $stored['email'];
            $requested = '';
            foreach (['john', 'lara'] as $staffIdentity) {
                if (strcasecmp((string) ($identities[$staffIdentity]['email'] ?? ''), $replyTo) === 0) {
                    $requested = $staffIdentity;
                    break;
                }
            }
            // Approved CRM fallback: use it when the assigned employee's own Gmail is unavailable.
            if ($requested === '' || empty($identities[$requested]['password'])) $requested = 'crm_notifications';
        }

        if (!in_array($requested, ['crm_notifications', 'customer_service', 'john', 'lara'], true)) {
            throw new InvalidArgumentException('Sender identity is not approved.');
        }
        $identity = $identities[$requested] ?? null;
        if (!is_array($identity) || !filter_var((string) ($identity['email'] ?? ''), FILTER_VALIDATE_EMAIL)) {
            throw new EmailSenderUnavailableException('Approved sender identity is not configured.');
        }
        if (trim((string) ($identity['password'] ?? '')) === '') {
            throw new EmailSenderUnavailableException('SMTP credentials are unavailable for the selected sender.');
        }
        $identityName = trim((string) ($identity['name'] ?? ''));
        $username = trim((string) ($identity['username'] ?? ''));
        if ($username === '' || strcasecmp($username, (string) $identity['email']) !== 0) {
            throw new RuntimeException('SMTP authentication must use the selected Gmail identity account.');
        }
        return [
            'key' => $requested,
            'email' => (string) $identity['email'],
            'name' => $identityName !== '' ? $identityName : "Espinosilla's Kainan",
            'username' => $username,
            'password' => (string) ($identity['password'] ?? ''),
            'reply_to' => $replyTo !== '' ? $replyTo : (string) $identity['email'],
        ];
    }

    public function sendQueuedRecord(array $record, ?callable $transport = null): void
    {
        $identity = $this->resolveSender((string) $record['sender_identity'], []);
        // Preserve the exact approved identity captured when queued; reject stale/altered values.
        if (strcasecmp($identity['email'], (string) $record['sender_email']) !== 0
            || $identity['name'] !== (string) $record['from_name']) {
            throw new RuntimeException('Queued sender identity no longer matches configuration.');
        }
        if ($transport === null && ($identity['password'] === '' || $identity['username'] === '')) {
            throw new RuntimeException('SMTP credentials are not configured for the queued sender.');
        }
        $data = $this->decryptPayload((string) $record['payload_encrypted']);
        $rendered = $this->renderer->render((string) $record['template_key'], $data);
        if ($transport !== null) {
            $transport($record, $identity, $rendered);
            return;
        }
        $this->sendWithPhpMailer($record, $identity, $rendered);
    }

    private function sendWithPhpMailer(array $record, array $identity, array $rendered): void
    {
        if (!class_exists(PHPMailer::class)) {
            $root = dirname(__DIR__, 2);
            require_once $root . '/phpmailer/src/Exception.php';
            require_once $root . '/phpmailer/src/PHPMailer.php';
            require_once $root . '/phpmailer/src/SMTP.php';
        }
        $mail = new PHPMailer(true);
        $mail->isSMTP();
        $mail->Host = (string) ($this->config['host'] ?? 'smtp.gmail.com');
        $mail->SMTPAuth = ($this->config['smtp_auth'] ?? true) === true;
        $mail->Username = $identity['username'];
        $mail->Password = $identity['password'];
        $mail->SMTPSecure = strtoupper((string) ($this->config['encryption'] ?? 'STARTTLS')) === 'STARTTLS'
            ? PHPMailer::ENCRYPTION_STARTTLS
            : throw new RuntimeException('Only Gmail STARTTLS is permitted.');
        $mail->Port = (int) ($this->config['port'] ?? 587);
        $mail->Timeout = (int) ($this->config['timeout'] ?? 20);
        $mail->CharSet = PHPMailer::CHARSET_UTF8;
        $mail->isHTML(true);
        $mail->setFrom($identity['email'], $identity['name']);
        $mail->addAddress((string) $record['recipient_email'], (string) ($record['recipient_name'] ?? ''));
        $mail->addReplyTo((string) $record['reply_to_email']);
        $mail->Subject = (string) $record['email_subject'];
        $mail->Body = $rendered['html'];
        $mail->AltBody = $rendered['text'];
        $mail->send();
    }

    private function encryptPayload(array $data): string
    {
        $key = $this->config['queue_encryption_key'] ?? null;
        if (!is_string($key) || strlen($key) !== 32) {
            throw new RuntimeException('Email queue encryption key is not configured.');
        }
        $nonce = random_bytes(12);
        $tag = '';
        $plain = json_encode($data, JSON_THROW_ON_ERROR | JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE);
        $ciphertext = openssl_encrypt($plain, 'aes-256-gcm', $key, OPENSSL_RAW_DATA, $nonce, $tag);
        if (!is_string($ciphertext)) throw new RuntimeException('Could not encrypt email queue payload.');
        return json_encode([
            'v' => 1,
            'n' => base64_encode($nonce),
            't' => base64_encode($tag),
            'c' => base64_encode($ciphertext),
        ], JSON_THROW_ON_ERROR);
    }

    private function decryptPayload(string $payload): array
    {
        $key = $this->config['queue_encryption_key'] ?? null;
        if (!is_string($key) || strlen($key) !== 32) throw new RuntimeException('Email queue encryption key is not configured.');
        $envelope = json_decode($payload, true, 8, JSON_THROW_ON_ERROR);
        if (($envelope['v'] ?? null) !== 1) throw new RuntimeException('Unsupported encrypted email payload version.');
        $nonce = base64_decode((string) ($envelope['n'] ?? ''), true);
        $tag = base64_decode((string) ($envelope['t'] ?? ''), true);
        $ciphertext = base64_decode((string) ($envelope['c'] ?? ''), true);
        if (!is_string($nonce) || !is_string($tag) || !is_string($ciphertext)) throw new RuntimeException('Invalid encrypted email payload.');
        $plain = openssl_decrypt($ciphertext, 'aes-256-gcm', $key, OPENSSL_RAW_DATA, $nonce, $tag);
        if (!is_string($plain)) throw new RuntimeException('Email queue payload authentication failed.');
        $data = json_decode($plain, true, 64, JSON_THROW_ON_ERROR);
        if (!is_array($data)) throw new RuntimeException('Email queue payload is malformed.');
        return $data;
    }

    private function cleanHeader(string $value): string
    {
        return trim(str_replace(["\r", "\n", "\0"], '', $value));
    }
}
