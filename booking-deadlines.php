<?php
/**
 * booking-deadlines.php - payment deadlines, automatic follow-up messages and auto-cancel.
 * Put it in the SAME folder as booking-feedback.php, payments-schema.php and quotations-schema.php.
 *
 * RULES
 *  - A customer can only pick an event date that is at least CUSTOMER_MIN_DAYS_BEFORE_EVENT days from today
 *    (checked in customer-inquiries-api.php and in the Add Inquiry calendar of customer-pages.js).
 *  - DEPOSIT deadline  = event date - DEADLINE_DEPOSIT_DAYS_BEFORE_EVENT days   (event in 3 days -> deposit due tomorrow).
 *    Not paid in time: the open quotation is withdrawn and the inquiry is closed (Declined). No money was taken, nothing to refund.
 *  - FULL PAYMENT deadline = event date - DEADLINE_FULL_PAYMENT_DAYS_BEFORE_EVENT days.
 *    Balance not paid in time: the booking is Cancelled. The deposit is NOT refundable.
 *  - The deadlines are the date + TIME the Sales Staff set (quotation "valid until", payment request "pay by", 8:00 AM - 8:00 PM).
 *  - Before each deadline the assigned Sales Staff "sends" a message to the customer's inbox (and a bell notification):
 *    ONE per day at 8:00 AM (DEADLINE_REMIND_FROM_HOUR), starting the day AFTER it was sent, never within 3 hours of it, until the deadline day.
 *    PLUS one "last call" on the deadline day, 2 hours before the cutoff time (never later than 9:00 PM, and only when that is 10:00 AM or later).
 *    A deadline set on the same day it was sent: no morning reminder; the last call is 2 hours before the cutoff, or 30 minutes before when the
 *    2-hour mark has already passed; nothing when less than that is left (see deadlineReminderStage()). The balance reminder carries a Pay Now card.
 *  - A deadline with no time chosen (a later date) ends at 11:59 PM of that day. Auto-close (deposit) and auto-cancel (balance) happen at the exact deadline time.
 *  - Only inquiries / bookings created on or after DEADLINES_APPLY_FROM are touched, so old test data is never cancelled.
 *
 *  - EVENT reminders: for confirmed, fully paid bookings only, the day before and the morning of the event (see processEventReminders()).
 *
 * HOW IT RUNS: cron-booking-deadlines.php (Windows Task Scheduler, every hour). It also runs (at most every 10 minutes)
 * when a staff member opens Bookings or a customer opens My Bookings, as a backup.
 * Every step is safe to repeat: each reminder is sent once (table deadline_reminders).
 */
require_once __DIR__ . '/bookings-schema.php';
require_once __DIR__ . '/quotations-schema.php';
require_once __DIR__ . '/payments-schema.php';
require_once __DIR__ . '/notifications-helper.php';
require_once __DIR__ . '/xendit-invoice-verification.php';

const CUSTOMER_MIN_DAYS_BEFORE_EVENT          = 3;
const CUSTOMER_SUBMIT_CUTOFF_HOUR             = 21;   // 9:00 PM: an inquiry sent at or after this hour cannot use the 3-day date (staff close at 11:00 PM)
const DEADLINE_DEPOSIT_DAYS_BEFORE_EVENT      = 2;
const DEADLINE_FULL_PAYMENT_DAYS_BEFORE_EVENT = 1;
const DEADLINE_REMIND_MAX_DAYS                = 14;   // one reminder EVERY day, starting this many days before a deadline (0 = only on the deadline day)
const DEADLINE_REMIND_FROM_HOUR               = 8;    // reminders are sent from this hour (8 = 8:00 AM), never at midnight
const DEADLINE_MIN_GAP_HOURS                  = 3;    // never remind sooner than this after the quotation / payment request was sent
const DEADLINE_LASTCALL_HOURS                 = 2;    // one "last call" this many hours before the cutoff time, on the deadline day
const DEADLINE_LASTCALL_LATEST_HOUR           = 21;   // ...but never later than 9:00 PM (a 11:59 PM deadline is reminded at 9:00 PM)
const DEADLINE_LASTCALL_EARLIEST_HOUR         = 10;   // ...and only when it falls at 10:00 AM or later (an earlier one would sit right after the 8:00 AM reminder)
const DEADLINE_LASTCALL_FALLBACK_MIN          = 30;   // sent too late for the 2-hour call: one call this many minutes before the cutoff instead
const DEADLINE_LASTCALL_MIN_AFTER_SENT_MIN    = 60;   // the 2-hour call must come at least this long after the quotation / request was sent
const DEADLINE_FALLBACK_MIN_AFTER_SENT_MIN    = 20;   // the 30-minute call must come at least this long after it was sent
const DEADLINE_REMIND_UNTIL_HOUR              = 20;   // no daily reminder from 8:00 PM on
const DEADLINES_APPLY_FROM                    = '2026-11-18 00:00:00';   // set this to the day you go live

/**
 * Earliest event date a customer can choose right now ("Y-m-d").
 * Before 9:00 PM: today + CUSTOMER_MIN_DAYS_BEFORE_EVENT. From 9:00 PM: one day later, because Sales Staff
 * would have less than 2 hours (they close at 11:00 PM) to prepare and send the quotation for the 3-day date.
 * Keep equal to minEventISO() in customer-pages.js.
 */
function customerEarliestEventDate(?int $now = null): string {
    $now = $now ?? time();
    $days = CUSTOMER_MIN_DAYS_BEFORE_EVENT + ((int)date('G', $now) >= CUSTOMER_SUBMIT_CUTOFF_HOUR ? 1 : 0);
    return date('Y-m-d', strtotime('+' . $days . ' days', $now));
}
function depositDeadlineDate(string $eventDate): string {
    return date('Y-m-d', strtotime($eventDate . ' -' . DEADLINE_DEPOSIT_DAYS_BEFORE_EVENT . ' days'));
}
function fullPaymentDeadlineDate(string $eventDate): string {
    return date('Y-m-d', strtotime($eventDate . ' -' . DEADLINE_FULL_PAYMENT_DAYS_BEFORE_EVENT . ' days'));
}
/**
 * Last day the customer can pay the deposit for a quotation (used by xendit-api.php and processDepositDeadlines()).
 * = event date - DEADLINE_DEPOSIT_DAYS_BEFORE_EVENT days. $validUntil is accepted for compatibility but is not used here:
 * an unanswered quotation is already refused after its own valid_until date by the checkout.
 * Skipped when another file (e.g. quotations-schema.php) already defines it.
 */
if (!function_exists('quoteDepositDeadline')) {
    function quoteDepositDeadline(string $eventDate, $validUntil = null): string {
        return depositDeadlineDate(substr($eventDate, 0, 10));
    }
}
/** true when a booking is under the deadline rules and its full-payment deadline has already passed (no more paying: the booking gets cancelled). */
function bookingPastPaymentDeadline(array $b): bool {
    $event = (string)($b['event_date'] ?? '');
    $created = (string)($b['created_at'] ?? '');
    if ($event === '' || $created === '' || $created < DEADLINES_APPLY_FROM) return false;
    return date('Y-m-d') > fullPaymentDeadlineDate(substr($event, 0, 10));
}
function deadlineDaysLeft(string $deadline): int {
    $a = new DateTime(date('Y-m-d'));
    $b = new DateTime(substr($deadline, 0, 10));
    return (int)$a->diff($b)->format('%r%a');
}
/** One reminder per day: the "stage" is simply the number of days left, so each day is sent once (table deadline_reminders). */
function deadlineStage(int $daysLeft): ?int {
    if ($daysLeft < 0 || $daysLeft > DEADLINE_REMIND_MAX_DAYS) return null;
    if ((int)date('G') < DEADLINE_REMIND_FROM_HOUR) return null;   // wait until the morning
    return $daysLeft;
}
/**
 * Which reminder (if any) is due right now for a deadline. Returns a "stage" number (each stage is sent once) or null.
 *  - Daily: ONE reminder per day, 8:00 AM - 8:00 PM, starting the day AFTER it was sent (never within 3 hours of it), until the deadline day. stage = days left.
 *  - Last call (stage 99): on the deadline day, 2 hours before the cutoff time. Never later than 9:00 PM, and only when it is 10:00 AM or later.
 *  - Deadline set on the SAME day it was sent: no daily reminder. Last call 2 hours before the cutoff when that is at least 60 minutes after it was sent;
 *    otherwise one call 30 minutes before the cutoff (stage 98) when that is at least 20 minutes after it was sent; otherwise none.
 *  - Never after the deadline. $now is only for testing.
 */
function deadlineReminderStage(?string $sentAt, string $deadlineAt, ?int $now = null): ?int {
    if ($deadlineAt === '') return null;
    $now = $now ?? time();
    $dl = strtotime($deadlineAt);
    $sent = $sentAt ? (int)strtotime($sentAt) : 0;
    if (!$dl || $now >= $dl) return null;
    $deadDay = date('Y-m-d', $dl);
    $sameDay = $sent && date('Y-m-d', $sent) === $deadDay;

    // the 2-hour "last call", kept inside 10:00 AM - 9:00 PM
    $call = $dl - DEADLINE_LASTCALL_HOURS * 3600;
    $latest = strtotime($deadDay . ' ' . str_pad((string)DEADLINE_LASTCALL_LATEST_HOUR, 2, '0', STR_PAD_LEFT) . ':00:00');
    $earliest = strtotime($deadDay . ' ' . str_pad((string)DEADLINE_LASTCALL_EARLIEST_HOUR, 2, '0', STR_PAD_LEFT) . ':00:00');
    if ($call > $latest) $call = $latest;
    $callOk = $call >= $earliest && $call < $dl && (!$sameDay || $call >= $sent + DEADLINE_LASTCALL_MIN_AFTER_SENT_MIN * 60);
    if ($callOk && $now >= $call && $now < $dl - 600) return 99;

    if ($sameDay) {
        if ($callOk) return null;   // the 2-hour call is still to come (or already sent)
        $fallback = $dl - DEADLINE_LASTCALL_FALLBACK_MIN * 60;   // the 2-hour mark already passed when it was sent
        if ($sent && $fallback >= $sent + DEADLINE_FALLBACK_MIN_AFTER_SENT_MIN * 60 && $now >= $fallback && $now < $dl - 300) return 98;
        return null;
    }
    if ($sent && date('Y-m-d', $sent) === date('Y-m-d', $now)) return null;            // never on the day it was sent
    if ($sent && $now - $sent < DEADLINE_MIN_GAP_HOURS * 3600) return null;            // 3-hour cool-down
    $hour = (int)date('G', $now);
    if ($hour < DEADLINE_REMIND_FROM_HOUR || $hour >= DEADLINE_REMIND_UNTIL_HOUR) return null;
    $left = (int)(new DateTime(date('Y-m-d', $now)))->diff(new DateTime($deadDay))->format('%r%a');
    return ($left >= 0 && $left <= DEADLINE_REMIND_MAX_DAYS) ? $left : null;
}
/** "in about 2 hours" / "in about 30 minutes" for the last calls (stage 98 / 99), otherwise "today" / "tomorrow" / "in N days". */
function deadlineWhenStage(int $stage, int $daysLeft, ?string $deadlineAt = null): string {
    if ($stage >= 98) {
        $mins = $deadlineAt ? max(1, (int)round((strtotime($deadlineAt) - time()) / 60)) : DEADLINE_LASTCALL_HOURS * 60;
        if ($mins >= 90) return 'in about ' . (int)round($mins / 60) . ' hours';
        return 'in about ' . ($mins >= 10 ? (int)(round($mins / 5) * 5) : $mins) . ' minutes';
    }
    return deadlineWhen($daysLeft);
}
/** " (in about 2 hours)" for last calls, " (in 3 days)" for daily reminders; empty for today / tomorrow because the date already says it. */
function deadlineWhenParen(int $stage, int $daysLeft, ?string $deadlineAt = null): string {
    if ($stage < 98 && $daysLeft <= 1) return '';
    return ' (' . deadlineWhenStage($stage, $daysLeft, $deadlineAt) . ')';
}
function deadlineWhen(int $daysLeft): string {
    return $daysLeft <= 0 ? 'today' : ($daysLeft === 1 ? 'tomorrow' : 'in ' . $daysLeft . ' days');
}

function ensureDeadlineSchema(AppDatabase $db): void {
    // Reminder table is provisioned centrally from database/catering_crm.sql.
}

/** true only for the first caller: two requests at the same moment cannot send the same reminder twice. */
function deadlineClaim(AppDatabase $db, string $kind, int $refId, int $stage): bool {
    $st = $db->prepare('INSERT IGNORE INTO deadline_reminders (kind, ref_id, stage, sent_at) VALUES (?,?,?,?)');
    $st->execute([$kind, $refId, $stage, date('Y-m-d H:i:s')]);
    return $st->rowCount() === 1;
}
function deadlineRelease(AppDatabase $db, string $kind, int $refId, int $stage): void {
    $db->prepare('DELETE FROM deadline_reminders WHERE kind = ? AND ref_id = ? AND stage = ?')->execute([$kind, $refId, $stage]);
}

/** Shared nonblocking lock for the CLI worker and page-load fallback. */
function deadlineJobLock(AppDatabase $db, bool $acquire): bool {
    $st = $db->prepare($acquire ? "SELECT GET_LOCK('espinosilla.booking-deadlines', 0)" : "SELECT RELEASE_LOCK('espinosilla.booking-deadlines')");
    $st->execute();
    return (int)$st->fetchColumn() === 1;
}

/** Serializes closing an inquiry with checkout creation and verified Xendit callbacks for that inquiry. */
function deadlineInquiryLock(AppDatabase $db, int $inquiryId, bool $acquire, int $timeout = 0): bool {
    if ($inquiryId <= 0) return false;
    $name = 'espinosilla.inquiry.' . $inquiryId;
    $st = $db->prepare($acquire ? 'SELECT GET_LOCK(?, ?)' : 'SELECT RELEASE_LOCK(?)');
    $st->execute($acquire ? [$name, $timeout] : [$name]);
    return (int)$st->fetchColumn() === 1;
}

/** Pure closure gate: a pending Xendit row is safe only after an authoritative terminal-unpaid result. */
function deadlineXenditClosureGate(array $paymentRows, array $scannedIds, array $outcomes): array {
    $updates = [];
    foreach ($paymentRows as $row) {
        $id = (int)$row['id'];
        $status = strtolower((string)$row['status']);
        if (in_array($status, ['expired', 'failed', 'canceled', 'cancelled', 'voided'], true)) continue;
        $verified = $outcomes[$id] ?? null;
        if ($status !== 'pending' || !$verified || !array_key_exists($id, $scannedIds)
            || $scannedIds[$id] !== (string)($row['invoice_id'] ?? '')) return ['safe' => false, 'updates' => []];
        if (in_array($verified['outcome'], ['unpaid_terminal', 'not_found'], true)) {
            $updates[$id] = [
                'status' => $verified['outcome'] === 'not_found' ? 'failed' : strtolower($verified['status']),
                'invoice_id' => (string)($verified['invoice_id'] ?? ''),
            ];
        } else {
            return ['safe' => false, 'updates' => []];
        }
    }
    return ['safe' => true, 'updates' => $updates];
}

/** Rechecked under row locks immediately before closing, so a paid booking never gets withdrawn. */
function deadlineClosureStateEligible(?string $leadStage, ?string $quoteStatus, bool $hasBooking): bool {
    return !$hasBooking && $leadStage !== null && $quoteStatus !== null
        && in_array($quoteStatus, ['Sent', 'Accepted'], true)
        && !in_array($leadStage, ['Declined', 'Completed', 'Confirmed'], true);
}

/** Posts a message in the customer's chat under the staff member's name. Returns false when the inquiry has no chat yet. */
function deadlineSay(AppDatabase $db, string $crm, int $inquiryId, string $from, string $text, ?int $paymentRequestId = null): bool {
    if ($inquiryId <= 0) return false;
    $cv = $crm !== '' ? "`$crm`." : '';
    $cs = $db->prepare("SELECT id FROM {$cv}cib_conversations WHERE inquiry_id = ? LIMIT 1");
    $cs->execute([$inquiryId]);
    if (!($conv = $cs->fetch())) return false;
    $at = date('Y-m-d H:i:s');
    if ($paymentRequestId) {
        $db->prepare("INSERT INTO {$cv}cib_messages (conversation_id, sender_type, sender_name, message, attachments, created_at, payment_request_id) VALUES (?,?,?,?,NULL,?,?)")
           ->execute([$conv['id'], 'staff', $from, $text, $at, $paymentRequestId]);
    } else {
        $db->prepare("INSERT INTO {$cv}cib_messages (conversation_id, sender_type, sender_name, message, attachments, created_at) VALUES (?,?,?,?,NULL,?)")
           ->execute([$conv['id'], 'staff', $from, $text, $at]);
    }
    $db->prepare("UPDATE {$cv}cib_conversations SET updated_at = ?, sales_read_at = ? WHERE id = ?")->execute([$at, $at, $conv['id']]);
    return true;
}

/* ============================== 1) DEPOSIT deadline ============================== */
function processDepositDeadlines(AppDatabase $db, string $crm): array {
    global $DB_CATERING;
    $res = ['reminded' => 0, 'closed' => 0, 'deferred_payment' => 0, 'errors' => 0];
    $pk = quoteLeadPk($db);
    try { ensureColumn($db, $DB_CATERING ?? '', 'leads', 'decline_reason', 'TEXT NULL'); } catch (Throwable $e) { /* column already there */ }
        $rows = $db->prepare("SELECT q.*, qv.valid_until, qv.valid_until_time, qv.deposit_rate, qv.deposit_amount,
                                     l.`$pk` AS lead_pk, l.event_date AS l_event_date, l.event_name AS l_event_name, l.customer_id AS l_customer_id,
                                 l.assigned_staff_id AS l_staff_id, l.assigned_staff_name AS l_staff_name
                          FROM quotations q JOIN quotation_versions qv ON qv.quotation_id=q.quotation_id AND qv.version_number=q.version
                          JOIN leads l ON l.`$pk` = q.inquiry_id
                          WHERE q.status IN ('Sent','Accepted') AND l.event_date IS NOT NULL
                            AND l.stage NOT IN ('Declined','Completed','Confirmed')
                            AND COALESCE(q.sent_at, q.prepared_at) >= ?
                            AND NOT EXISTS (SELECT 1 FROM bookings b WHERE b.inquiry_id = q.inquiry_id)
                            AND q.quotation_id = (SELECT MAX(q2.quotation_id) FROM quotations q2 WHERE q2.inquiry_id = q.inquiry_id AND q2.status IN ('Sent','Accepted'))
                          ORDER BY q.quotation_id LIMIT 50");
    $rows->execute([DEADLINES_APPLY_FROM]);
    foreach ($rows->fetchAll() as $q) {
        $iid = (int)$q['inquiry_id'];
        $event = trim((string)$q['l_event_name']) !== '' ? trim((string)$q['l_event_name']) : 'your event';
        $from = trim((string)$q['l_staff_name']) !== '' ? trim((string)$q['l_staff_name']) : 'Catering Team';
        // same deadline the quotation / deposit checkout uses (quoteDepositDeadline), so they can never disagree
        $deadline = function_exists('quoteDepositDeadline') ? quoteDepositDeadline((string)$q['l_event_date'], $q['valid_until'] ?? null) : depositDeadlineDate((string)$q['l_event_date']);
        $left = deadlineDaysLeft($deadline);
        // the deadline the customer sees: the Sales Staff's "valid until" date + time, unless the automatic deposit deadline is earlier
        $autoEnd = deadlineAt($deadline, null);
        $vuAt = !empty($q['valid_until']) ? deadlineAt($q['valid_until'], $q['valid_until_time'] ?? null) : '';
        $useValid = $vuAt !== '' && $vuAt < $autoEnd;
        $remindEnd = $useValid ? $vuAt : $autoEnd;
        $dueText = $useValid ? deadlineLabel($q['valid_until'], $q['valid_until_time'] ?? null) : deadlineLabel($deadline, '23:59');
        $money = quotePeso($q['deposit_amount']);
        $ref = 'INQ-' . str_pad((string)$iid, 4, '0', STR_PAD_LEFT);
        $customerId = (int)$q['l_customer_id'];
        $staffIds = !empty($q['l_staff_id']) ? [(int)$q['l_staff_id']] : [];

        if (date('Y-m-d H:i:s') >= $remindEnd) {   // deadline passed (exact time): close the inquiry
            // Verify outstanding Xendit attempts before locking records for the state change. Never infer failure from age.
            $paymentScan = $db->prepare('SELECT id,inquiry_id,quotation_id,status,invoice_id,created_at FROM xendit_payments WHERE inquiry_id = ? ORDER BY id');
            $paymentScan->execute([$iid]);
            $paymentOutcomes = [];
            $paymentScannedIds = [];
            foreach ($paymentScan->fetchAll() as $paymentRow) {
                if ($paymentRow['status'] === 'pending') {
                    $paymentId = (int)$paymentRow['id'];
                    $paymentScannedIds[$paymentId] = (string)($paymentRow['invoice_id'] ?? '');
                    $paymentOutcomes[$paymentId] = xenditResolvePaymentInvoice($paymentRow);
                }
            }
            if (!deadlineInquiryLock($db, $iid, true, 0)) { $res['deferred_payment']++; continue; }
            try {
                $db->beginTransaction();
                // Lock Xendit state first, matching finalizePayment()'s payment -> lead -> quotation order.
                $pay = $db->prepare("SELECT id,status,invoice_id FROM xendit_payments WHERE inquiry_id = ? ORDER BY id FOR UPDATE");
                $pay->execute([$iid]);
                $paymentRows = $pay->fetchAll();
                $paymentGate = deadlineXenditClosureGate($paymentRows, $paymentScannedIds, $paymentOutcomes);
                if (!$paymentGate['safe']) {
                    $db->rollBack();
                    deadlineInquiryLock($db, $iid, false);
                    $res['deferred_payment']++;
                    continue;
                }
                foreach ($paymentGate['updates'] as $paymentId => $update) {
                    if ($update['invoice_id'] !== '') {
                        $db->prepare("UPDATE xendit_payments SET invoice_id = ? WHERE id = ? AND status = 'pending' AND invoice_id IS NULL")
                           ->execute([$update['invoice_id'], $paymentId]);
                    }
                    $db->prepare("UPDATE xendit_payments SET status = ? WHERE id = ? AND status = 'pending'")
                       ->execute([$update['status'], $paymentId]);
                }
                $leadLock = $db->prepare("SELECT stage FROM leads WHERE `$pk` = ? FOR UPDATE");
                $leadLock->execute([$iid]);
                $currentLead = $leadLock->fetch();
                $quoteLock = $db->prepare('SELECT status FROM quotations WHERE quotation_id = ? FOR UPDATE');
                $quoteLock->execute([(int)$q['quotation_id']]);
                $currentQuote = $quoteLock->fetch();
                $chk = $db->prepare('SELECT 1 FROM bookings WHERE inquiry_id = ? LIMIT 1 FOR UPDATE');
                $chk->execute([$iid]);
                $hasBooking = (bool)$chk->fetch();
                if (!deadlineClosureStateEligible($currentLead['stage'] ?? null, $currentQuote['status'] ?? null, $hasBooking)) {
                    $db->rollBack();
                    deadlineInquiryLock($db, $iid, false);
                    continue;
                }
                $why = 'The deposit was not paid by ' . $dueText . ', so the inquiry was closed automatically.';
                $db->prepare("UPDATE quotations SET status = 'Withdrawn', responded_at = COALESCE(responded_at, ?) WHERE quotation_id = ?")->execute([date('Y-m-d H:i:s'), $q['quotation_id']]);
                syncNormalizedQuotationVersion($db, (int)$q['quotation_id']);
                $db->prepare("UPDATE leads SET stage = 'Declined', decline_reason = ? WHERE `$pk` = ?")->execute([$why, $iid]);
                deadlineSay($db, $crm, $iid, $from, 'Hello! We did not receive the ' . $money . ' deposit for **' . $event . '** by ' . $dueText
                    . ', so we had to release the date and close this inquiry. If you still need catering, you are welcome to send a new inquiry and we will gladly help.');
                notifySend($db, ['type' => 'lead', 'kind' => 'inquiry', 'ref' => $ref,
                    'title' => 'Inquiry closed: deposit not paid',
                    'message' => $event . ' (' . $ref . ') was closed because the deposit was not paid by ' . $dueText . '.',
                    'user_ids' => $staffIds,
                    'customer' => ['title' => 'Inquiry closed', 'message' => 'Your inquiry for ' . $event . ' was closed because the deposit was not paid by ' . $dueText . '.'],
                    '_throw_on_failure' => true]);
                $db->commit();
            } catch (Throwable $e) {
                if ($db->inTransaction()) $db->rollBack();
                deadlineInquiryLock($db, $iid, false);
                $res['errors']++;
                error_log('booking-deadlines: could not close inquiry ' . $iid . ': ' . get_class($e) . ' (' . (int)$e->getCode() . ')');
                continue;
            }
            deadlineInquiryLock($db, $iid, false);
            $res['closed']++;
            continue;
        }
        $stage = deadlineReminderStage($q['sent_at'] ?: ($q['prepared_at'] ?? null), $remindEnd);
        if ($stage === null) continue;
        $db->beginTransaction();
        try {
            if (!deadlineClaim($db, 'dep2', (int)$q['quotation_id'], $stage)) { $db->rollBack(); continue; }
            $step = $q['status'] === 'Accepted' ? 'Please pay the' : 'Please accept the quotation and pay the';
            deadlineSay($db, $crm, $iid, $from, 'Hi! A friendly reminder for **' . $event . '**: ' . $step . ' **' . $money . '** deposit by **' . $dueText . '**' . deadlineWhenParen($stage, $left, $remindEnd)
                . ' to reserve your event date. If the deposit is not paid by then, the inquiry is closed automatically and the date is released. '
                . 'Open your inquiry and tap Pay deposit, or message me here if you have questions.');
            notifySend($db, ['type' => 'lead', 'kind' => 'inquiry', 'ref' => $ref, 'title' => 'Deposit due ' . deadlineWhenStage($stage, $left, $remindEnd),
                'message' => 'Please pay the ' . $money . ' deposit for ' . $event . ' by ' . $dueText . '.',
                'user_ids' => [$customerId], 'include_admins' => false, '_throw_on_failure' => true]);
            $db->commit();
            $res['reminded']++;
        } catch (Throwable $e) {
            if ($db->inTransaction()) $db->rollBack(); // claim and message roll back together; retry next run
            $res['errors']++;
            error_log('booking-deadlines: deposit reminder failed for inquiry ' . $iid . ': ' . get_class($e) . ' (' . (int)$e->getCode() . ')');
        }
    }
    return $res;
}

/* ============================== 2) FULL PAYMENT deadline ============================== */
function processBalanceDeadlines(AppDatabase $db, string $crm): array {
    $res = ['reminded' => 0, 'cancelled' => 0];
    $st = $db->prepare("SELECT * FROM bookings
                        WHERE booking_status = 'Confirmed' AND event_date IS NOT NULL AND customer_id IS NOT NULL
                          AND created_at >= ?
                          AND COALESCE(remaining_balance, GREATEST(COALESCE(quotation_amount, 0) - amount_paid, 0)) > 0
                        ORDER BY booking_id LIMIT 50");
    $st->execute([DEADLINES_APPLY_FROM]);
    foreach ($st->fetchAll() as $b) {
        $bid = (int)$b['booking_id'];
        $iid = (int)($b['inquiry_id'] ?? 0);
        $event = trim((string)($b['event_title'] ?? '')) !== '' ? trim((string)$b['event_title']) : 'your event';
        $from = trim((string)($b['assigned_staff'] ?? '')) !== '' ? trim((string)$b['assigned_staff']) : 'Catering Team';
        $ref = $b['booking_ref'] ?: 'BK-' . str_pad((string)$bid, 4, '0', STR_PAD_LEFT);
        // The deadline is the "Pay by" date + time the Sales Staff set on the open payment request (never later than the day before the event).
        // Without a staff request it is the automatic deadline: the day before the event, end of day.
        $autoDeadline = fullPaymentDeadlineDate(substr((string)$b['event_date'], 0, 10));
        $po = $db->prepare("SELECT * FROM payment_requests WHERE booking_id = ? AND status = 'Pending' ORDER BY id DESC LIMIT 1");
        $po->execute([$bid]);
        $open = $po->fetch() ?: null;
        $deadline = $autoDeadline;
        $deadlineAt = deadlineAt($autoDeadline, null);
        $deadlineText = deadlineLabel($autoDeadline, '23:59');
        if ($open && !empty($open['due_date'])) {
            $reqAt = deadlineAt($open['due_date'], $open['due_time'] ?? null);
            if ($reqAt !== '' && $reqAt < $deadlineAt) {
                $deadlineAt = $reqAt;
                $deadline = substr((string)$open['due_date'], 0, 10);
                $deadlineText = deadlineLabel($open['due_date'], $open['due_time'] ?? null);
            }
        }
        $left = deadlineDaysLeft($deadline);
        $expired = date('Y-m-d H:i:s') > $deadlineAt;
        $balance = bookingBalanceDue($b);
        $money = quotePeso($balance);
        $ids = [(int)$b['customer_id']];
        if (!empty($b['assigned_staff_id'])) $ids[] = (int)$b['assigned_staff_id'];

        if ($expired) {   // deadline passed: cancel the booking (the deposit is not refundable)
            $db->beginTransaction();
            try {
                $lock = $db->prepare('SELECT * FROM bookings WHERE booking_id = ? FOR UPDATE');
                $lock->execute([$bid]);
                $cur = $lock->fetch();
                if (!$cur || $cur['booking_status'] !== 'Confirmed' || bookingBalanceDue($cur) <= 0) { $db->rollBack(); continue; }   // paid a moment ago
                $db->prepare("UPDATE bookings SET booking_status = 'Cancelled' WHERE booking_id = ?")->execute([$bid]);
                $db->prepare("INSERT INTO booking_status_history (booking_id, status_type, old_status, new_status, remarks)
                              VALUES (?, 'booking', 'Confirmed', 'Cancelled', 'Automatically cancelled after the payment deadline.')")
                   ->execute([$bid]);
                $db->prepare("UPDATE payments SET payment_status = 'EXPIRED' WHERE booking_id = ? AND payment_type = 'BALANCE' AND payment_status = 'PENDING'")
                   ->execute([$bid]);
                $db->prepare("UPDATE payment_requests SET status = 'Cancelled' WHERE booking_id = ? AND status = 'Pending'")->execute([$bid]);
                deadlineSay($db, $crm, $iid, $from, 'Hello! We did not receive the remaining balance of **' . $money . '** for **' . $event . '** by ' . $deadlineText
                    . ', so the booking has been cancelled and the food and service will not proceed. As stated in our policy, the deposit is non-refundable. '
                    . 'If you already paid or think this is a mistake, please message us here right away.');
                $db->commit();
            } catch (Throwable $e) {
                if ($db->inTransaction()) $db->rollBack();
                error_log('booking-deadlines: could not cancel booking ' . $bid . ': ' . $e->getMessage());
                continue;
            }
            notifySend($db, ['type' => 'deal', 'kind' => 'booking', 'ref' => $ref,
                'title' => 'Booking cancelled: unpaid balance',
                'message' => ($b['customer_name'] ?: 'The customer') . ' did not pay ' . $money . ' for ' . $event . ' (' . $ref . ') by ' . $deadlineText . '. The booking was cancelled.',
                'user_ids' => $ids,
                'customer' => ['title' => 'Booking cancelled', 'message' => 'Your booking for ' . $event . ' was cancelled because the balance of ' . $money . ' was not paid by ' . $deadlineText . '. The deposit is non-refundable.']]);
            $res['cancelled']++;
            continue;
        }
        $stage = deadlineReminderStage($open['requested_at'] ?? ($b['created_at'] ?? null), $deadlineAt);
        if ($stage === null) continue;
        $reqId = $open ? (int)$open['id'] : 0;
        try {
            if (!$reqId) {   // staff did not send a request: create one with the automatic deadline so the reminder carries a Pay Now card
                $db->prepare("INSERT INTO payment_requests (booking_id, inquiry_id, customer_id, amount, due_date, due_time, note, status, requested_by, requested_by_id, requested_at)
                              VALUES (?,?,?,?,?,NULL,NULL,'Pending',?,?,?)")
                   ->execute([$bid, $b['inquiry_id'], $b['customer_id'], $balance, $autoDeadline, $from, $b['assigned_staff_id'] ?: null, ($b['created_at'] ?: date('Y-m-d H:i:s'))]);   // requested_at = when the booking was confirmed, so the daily reminder is not suppressed
                $reqId = (int)$db->lastInsertId();
            }
            if (!deadlineClaim($db, 'bal2', $reqId, $stage)) continue;
        } catch (Throwable $e) {
            error_log('booking-deadlines: could not prepare the balance reminder for booking ' . $bid . ': ' . $e->getMessage());
            continue;
        }
        try {
            deadlineSay($db, $crm, $iid, $from, 'Hi! A reminder for **' . $event . '**: please pay the remaining balance of **' . $money . '** on or before **' . $deadlineText . '**' . deadlineWhenParen($stage, $left, $deadlineAt)
                . '. Tap Pay Now below to pay online (GCash or Maya). Bookings with an unpaid balance after that date are cancelled automatically, and the deposit is non-refundable.', $reqId);
            notifySend($db, ['type' => 'deal', 'kind' => 'booking', 'ref' => $ref, 'title' => 'Balance due ' . deadlineWhenStage($stage, $left, $deadlineAt),
                'message' => 'Please pay the remaining ' . $money . ' for ' . $event . ' by ' . $deadlineText . ' or the booking is cancelled.',
                'user_ids' => [(int)$b['customer_id']], 'include_admins' => false]);
            $res['reminded']++;
        } catch (Throwable $e) {
            deadlineRelease($db, 'bal2', $reqId, $stage);
            error_log('booking-deadlines: balance reminder failed for booking ' . $bid . ': ' . $e->getMessage());
        }
    }
    return $res;
}

/* ============================== 3) EVENT reminders (day before + morning of) ============================== */
/**
 * For CONFIRMED and FULLY PAID bookings only (unpaid or cancelled ones are ignored):
 *   - the day before the event (from DEADLINE_REMIND_FROM_HOUR) and the morning of the event (from the same hour)
 *   - customer: chat message (from the assigned Sales Staff) + bell notification
 *   - staff: bell notification to the assigned Sales Staff + Admin / Manager
 * Each reminder is sent once: it is claimed in deadline_reminders (kind event_eve / event_day), like the payment reminders.
 */
function processEventReminders(AppDatabase $db, string $crm): array {
    $res = ['eve' => 0, 'day' => 0];
    if ((int)date('G') < DEADLINE_REMIND_FROM_HOUR) return $res;   // wait until the morning, never at midnight
    $today = date('Y-m-d');
    $tomorrow = date('Y-m-d', strtotime('+1 day'));
    $st = $db->prepare("SELECT * FROM bookings
                        WHERE booking_status = 'Confirmed' AND customer_id IS NOT NULL AND event_date IN (?, ?)
                          AND created_at >= ?
                        ORDER BY booking_id LIMIT 100");
    $st->execute([$today, $tomorrow, DEADLINES_APPLY_FROM]);
    foreach ($st->fetchAll() as $b) {
        if (bookingBalanceDue($b) > 0) continue;                   // not fully paid: no reminder
        $bid = (int)$b['booking_id'];
        $iid = (int)($b['inquiry_id'] ?? 0);
        $isToday = substr((string)$b['event_date'], 0, 10) === $today;
        $kind = $isToday ? 'event_day' : 'event_eve';
        if (!deadlineClaim($db, $kind, $bid, 1)) continue;
        try {
            $event = trim((string)($b['event_title'] ?? '')) !== '' ? trim((string)$b['event_title']) : 'your event';
            $from  = trim((string)($b['assigned_staff'] ?? '')) !== '' ? trim((string)$b['assigned_staff']) : 'Catering Team';
            $ref   = $b['booking_ref'] ?: 'BK-' . str_pad((string)$bid, 4, '0', STR_PAD_LEFT);
            $label = eventTimeLabel($b['arrangement'] ?? '');                 // Pickup time / Delivery time / Event time
            $time  = eventTimeDisplay($b['event_time'] ?? '');                // '' for bookings made before the time field existed
            $when  = $isToday ? 'today' : 'tomorrow';
            $day   = quoteDay($b['event_date']);
            $timePart = $time !== '' ? ', ' . strtolower($label) . ' ' . $time : '';
            $where = trim((string)($b['location'] ?? ''));
            $customerText = $isToday
                ? 'Good morning! Your event **' . $event . '** is today (' . $day . ')' . ($time !== '' ? '. ' . $label . ': **' . $time . '**' : '') . '.'
                : 'Hi! A reminder that your event **' . $event . '** is tomorrow, **' . $day . '**' . ($time !== '' ? '. ' . $label . ': **' . $time . '**' : '') . '.';
            if ($where !== '') $customerText .= ' Location: ' . $where . '.';
            $customerText .= $isToday
                ? ' Our team is all set. If you need anything, message us here.'
                : ' Please make sure someone is ready to receive the order. If you need to change anything, message us here as early as possible.';
            deadlineSay($db, $crm, $iid, $from, $customerText);

            $customerId = (int)$b['customer_id'];
            notifySend($db, ['type' => 'deal', 'kind' => 'booking', 'ref' => $ref,
                'title' => $isToday ? 'Your event is today' : 'Your event is tomorrow',
                'message' => $event . ' (' . $ref . ') is ' . $when . $timePart . '.',
                'user_ids' => [$customerId], 'include_admins' => false]);
            // staff: the assigned Sales Staff + Admin / Manager (notifySend adds them)
            $who = trim((string)($b['customer_name'] ?? '')) !== '' ? $b['customer_name'] : 'The customer';
            notifySend($db, ['type' => 'deal', 'kind' => 'booking', 'ref' => $ref,
                'title' => $isToday ? 'Event today' : 'Event tomorrow',
                'message' => $event . ' (' . $ref . ') for ' . $who . ' is ' . $when . $timePart . '.',
                'user_ids' => !empty($b['assigned_staff_id']) ? [(int)$b['assigned_staff_id']] : [],
                'exclude_user_id' => $customerId]);
            $res[$isToday ? 'day' : 'eve']++;
        } catch (Throwable $e) {
            deadlineRelease($db, $kind, $bid, 1);                          // try again next run
            error_log('booking-deadlines: event reminder failed for booking ' . $bid . ': ' . $e->getMessage());
        }
    }
    return $res;
}

/** Runs all steps. Never throws. */
function runBookingDeadlines(AppDatabase $db, string $crm = ''): array {
    $out = ['deposit' => null, 'balance' => null, 'event_reminders' => null, 'skipped' => false, 'errors' => 0];
    try {
        if (!deadlineJobLock($db, true)) { $out['skipped'] = true; return $out; }
    } catch (Throwable $e) {
        $out['errors']++;
        error_log('booking-deadlines: lock failed: ' . get_class($e) . ' (' . (int)$e->getCode() . ')');
        return $out;
    }
    try {
        ensureBookingsSchema($db);
        ensureQuotationsSchema($db);
        ensurePaymentRequestsSchema($db);
        ensureDeadlineSchema($db);
        $out['deposit'] = processDepositDeadlines($db, $crm);
        $out['balance'] = processBalanceDeadlines($db, $crm);
        $out['event_reminders'] = processEventReminders($db, $crm);
        $out['errors'] += (int)($out['deposit']['errors'] ?? 0);
    } catch (Throwable $e) { $out['errors']++; error_log('booking-deadlines: run failed: ' . get_class($e) . ' (' . (int)$e->getCode() . ')'); }
    finally { try { deadlineJobLock($db, false); } catch (Throwable $e) { $out['errors']++; error_log('booking-deadlines: lock release failed'); } }
    return $out;
}

/** Backup trigger for the pages: runs at most once every 10 minutes. */
function runBookingDeadlinesThrottled(AppDatabase $db, string $crm = ''): void {
    $file = sys_get_temp_dir() . DIRECTORY_SEPARATOR . 'crm_booking_deadlines_last_run';
    if (is_file($file) && (time() - (int)@filemtime($file)) < 600) return;
    @touch($file);
    runBookingDeadlines($db, $crm);
}
