<?php
declare(strict_types=1);

final class EmailQueueWorker
{
    public function __construct(private AppDatabase $db, private EmailService $emailService, private array $config)
    {
    }

    /** Process one queued email. A transport callback is available for isolated smoke tests. */
    public function processOne(?int $notificationId = null, ?callable $transport = null): bool
    {
        if (($this->config['enabled'] ?? false) !== true) return false;
        $key = $this->config['queue_encryption_key'] ?? null;
        if (!is_string($key) || strlen($key) !== 32) {
            throw new RuntimeException('Email queue encryption key is not configured.');
        }
        $availableIdentities = [];
        foreach ((array) ($this->config['identities'] ?? []) as $identityKey => $identity) {
            if (!empty($identity['available']) || trim((string) ($identity['password'] ?? '')) !== '') {
                $availableIdentities[] = (string) $identityKey;
            }
        }
        if (!$availableIdentities) return false;

        $this->db->beginTransaction();
        try {
            $sql = "SELECT notification_id, sender_email, sender_identity, from_name, reply_to_email,
                           recipient_email, recipient_name, email_subject, template_key, payload_encrypted,
                           attempt_count
                    FROM notification_logs
                    WHERE channel = 'EMAIL' AND delivery_status = 'QUEUED'
                      AND (next_attempt_at IS NULL OR next_attempt_at <= UTC_TIMESTAMP())
                      AND (locked_until IS NULL OR locked_until <= UTC_TIMESTAMP())";
            $sql .= ' AND sender_identity IN (' . implode(',', array_fill(0, count($availableIdentities), '?')) . ')';
            $params = $availableIdentities;
            if ($notificationId !== null) {
                $sql .= ' AND notification_id = ?';
                $params[] = $notificationId;
            }
            $sql .= ' ORDER BY created_at, notification_id LIMIT 1 FOR UPDATE SKIP LOCKED';
            $statement = $this->db->prepare($sql);
            $statement->execute($params);
            $record = $statement->fetch();
            if (!$record) {
                $this->db->commit();
                return false;
            }
            $id = (int) $record['notification_id'];
            $this->db->prepare(
                'UPDATE notification_logs
                 SET locked_until = DATE_ADD(UTC_TIMESTAMP(), INTERVAL ? SECOND),
                     attempt_count = attempt_count + 1, last_attempt_at = UTC_TIMESTAMP()
                 WHERE notification_id = ? AND channel = \'EMAIL\' AND delivery_status = \'QUEUED\''
            )->execute([(int) ($this->config['claim_seconds'] ?? 300), $id]);
            $record['attempt_count'] = (int) $record['attempt_count'] + 1;
            $this->db->commit();
        } catch (Throwable $e) {
            if ($this->db->inTransaction()) $this->db->rollBack();
            throw $e;
        }

        try {
            $this->emailService->sendQueuedRecord($record, $transport);
            $this->db->prepare(
                "UPDATE notification_logs
                 SET delivery_status = 'SENT', sent_at = UTC_TIMESTAMP(), next_attempt_at = NULL,
                     locked_until = NULL, error_details = NULL
                 WHERE notification_id = ? AND channel = 'EMAIL' AND delivery_status = 'QUEUED'"
            )->execute([(int) $record['notification_id']]);
        } catch (Throwable $e) {
            $this->recordFailure($record, $e);
        }
        return true;
    }

    private function recordFailure(array $record, Throwable $error): void
    {
        $attempt = (int) $record['attempt_count'];
        $max = max(1, (int) ($this->config['max_attempts'] ?? 5));
        $failed = $attempt >= $max;
        $delay = min(
            (int) ($this->config['retry_max_seconds'] ?? 3600),
            (int) ($this->config['retry_base_seconds'] ?? 30) * (2 ** max(0, $attempt - 1))
        );
        $detail = mb_substr(trim(str_replace(["\r", "\n", "\0"], ' ', $error->getMessage())), 0, 2000);
        if ($detail === '') $detail = 'Email delivery failed.';

        $this->db->prepare(
            "UPDATE notification_logs
             SET delivery_status = ?, error_details = ?,
                 next_attempt_at = CASE WHEN ? = 'QUEUED' THEN DATE_ADD(UTC_TIMESTAMP(), INTERVAL ? SECOND) ELSE NULL END,
                 locked_until = NULL
             WHERE notification_id = ? AND channel = 'EMAIL' AND delivery_status = 'QUEUED'"
        )->execute([
            $failed ? 'FAILED' : 'QUEUED',
            $detail,
            $failed ? 'FAILED' : 'QUEUED',
            $delay,
            (int) $record['notification_id'],
        ]);
        error_log('Email queue delivery failed for notification ' . (int) $record['notification_id'] . ' (attempt ' . $attempt . ').');
    }
}
