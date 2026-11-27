<?php
require_once __DIR__ . '/includes/Mail/EmailNotificationService.php';
/**
 * booking-feedback.php - customer feedback (rating, comments, photos) for a booking.
 *
 * Used by:
 *   - customer-bookings-api.php   (the customer saves feedback; this file makes sure the table exists)
 *   - calendar-api.php, bookings-api.php, sales-bookings-api.php   (staff screens show the feedback)
 *
 * In a staff API, add these two lines (the second one right BEFORE the rows are sent with out(...)):
 *     require_once __DIR__ . '/booking-feedback.php';
 *     attachBookingFeedback($db, $rows);          // $rows = the list of bookings; each one gets  ['feedback' => {...} | null]
 * For a single booking (details):
 *     attachBookingFeedbackOne($db, $booking);
 *
 * pages.js (crmBookingFeedbackHTML) reads record.feedback = { rating, comments, images: [{url, name}], created_at }.
 * Feedback never breaks the page: if anything goes wrong here, the booking is returned with feedback = null.
 */

function ensureBookingFeedbackSchema(AppDatabase $db): void {
    // Schema is provisioned centrally from database/catering_crm.sql.
}

/** [booking_id => feedback] for the given booking ids (bookings without feedback are simply missing). */
function bookingFeedbackMap(AppDatabase $db, array $ids): array {
    $ids = array_values(array_unique(array_filter(array_map('intval', $ids))));
    $map = [];
    if (!$ids) return $map;
    $in = implode(',', array_fill(0, count($ids), '?'));
    $st = $db->prepare("SELECT booking_id, rating, comments, images, created_at FROM booking_feedback WHERE booking_id IN ($in) ORDER BY feedback_id");
    $st->execute($ids);
    foreach ($st->fetchAll() as $f) {
        $map[(int)$f['booking_id']] = [
            'rating'     => (int)$f['rating'],
            'comments'   => (string)($f['comments'] ?? ''),
            'images'     => !empty($f['images']) ? (json_decode($f['images'], true) ?: []) : [],
            'created_at' => $f['created_at'] ? str_replace(' ', 'T', $f['created_at']) : '',
        ];
    }
    return $map;
}

/** Adds 'feedback' to every booking in the list. */
function attachBookingFeedback(AppDatabase $db, array &$rows): void {
    $map = [];
    try {
        ensureBookingFeedbackSchema($db);
        $ids = [];
        foreach ($rows as $r) $ids[] = $r['booking_id'] ?? $r['id'] ?? 0;
        $map = bookingFeedbackMap($db, $ids);
    } catch (Throwable $e) { /* never block the page */ }
    foreach ($rows as &$r) {
        $id = (int)($r['booking_id'] ?? $r['id'] ?? 0);
        $r['feedback'] = $map[$id] ?? null;
    }
    unset($r);
}

/** Same for one booking. */
function attachBookingFeedbackOne(AppDatabase $db, array &$booking): void {
    $list = [$booking];
    attachBookingFeedback($db, $list);
    $booking = $list[0];
}

/* ======================================================================================================
   After the event: Completed + "Thank you, please rate us" message in the customer's inbox
   ====================================================================================================== */

/** Adds bookings.feedback_requested_at and cib_messages.feedback_booking_id when missing. $crm = database of the cib_* tables ('' = same database). */
function ensureFeedbackRequestColumns(AppDatabase $db, string $crm = ''): bool {
    // All reminder columns are installed by database/catering_crm.sql.
    return true;
}

/**
 * 1) A Confirmed booking whose event date has passed becomes Completed (paid in full or not; the balance stays on the booking).
 * 2) For each Completed booking that has no feedback and no request yet, the assigned staff "sends" a thank-you
 *    message with a "Rate Now" card in the customer's inbox (once per booking) and the customer gets a bell notification.
 * Safe to call on every request; it never breaks the page.  $crm = the database name of cib_conversations / cib_messages.
 */
function completeFinishedBookings(AppDatabase $db, string $crm = ''): void {
    // deadlines first: unpaid bookings past their full-payment deadline are cancelled BEFORE they could be marked Completed
    try {
        if (is_file(__DIR__ . '/booking-deadlines.php')) { require_once __DIR__ . '/booking-deadlines.php'; runBookingDeadlinesThrottled($db, $crm); }
    } catch (Throwable $e) { error_log('booking-feedback: deadlines step failed: ' . $e->getMessage()); }
    try {
        $eligible = $db->query("SELECT booking_id FROM bookings WHERE booking_status = 'Confirmed' AND event_date IS NOT NULL AND event_date < CURDATE()")
                        ->fetchAll(AppDatabase::FETCH_COLUMN);
        $db->exec("UPDATE bookings
                   SET booking_status = 'Completed'
                   WHERE booking_status = 'Confirmed'
                     AND event_date IS NOT NULL AND event_date < CURDATE()");   // the event happened; any unpaid balance stays on the booking (see remindOverdueBalances)
        $history = $db->prepare("INSERT INTO booking_status_history (booking_id, status_type, old_status, new_status, remarks)
                                 VALUES (?, 'booking', 'Confirmed', 'Completed', 'Automatically completed after the event date.')");
        foreach ($eligible as $bookingId) $history->execute([(int)$bookingId]);
        foreach ($eligible as $bookingId) {
            $row = $db->prepare('SELECT * FROM bookings WHERE booking_id = ? LIMIT 1');
            $row->execute([(int) $bookingId]);
            $booking = $row->fetch();
            if (!$booking || empty($booking['customer_id'])) continue;
            $recipient = EmailNotificationService::customerRecipient(
                $db,
                (int) $booking['customer_id'],
                (string) ($booking['customer_email'] ?? ''),
                (string) ($booking['customer_name'] ?? '')
            );
            $ref = (string) ($booking['booking_ref'] ?: 'BK-' . str_pad((string) $bookingId, 4, '0', STR_PAD_LEFT));
            $event = trim((string) ($booking['event_title'] ?? '')) !== '' ? trim((string) $booking['event_title']) : 'your event';
            EmailNotificationService::queue(
                $db,
                (int) $booking['customer_id'],
                $recipient['email'],
                $recipient['name'],
                'booking_completed',
                'Booking completed - ' . $ref,
                [
                    'heading' => 'Booking Completed',
                    'greeting' => $recipient['name'],
                    'message' => 'Thank you for choosing Espinosilla\'s Kainan. We invite you to share feedback about your experience.',
                    'rows' => [
                        'Booking reference' => $ref,
                        'Event name' => $event,
                        'Event date' => !empty($booking['event_date']) ? date('F j, Y', strtotime((string) $booking['event_date'])) : '',
                        'Status' => 'Completed',
                    ],
                    'button_text' => 'View My Bookings',
                    'button_url' => EmailNotificationService::customerAppUrl($db, 'customer-bookings.html', (int) $bookingId),
                ],
                'booking_completed:' . (int) $bookingId,
                'booking',
                (int) $bookingId
            );
        }
    } catch (Throwable $e) { error_log('booking-feedback: auto-complete failed: ' . $e->getMessage()); return; }

    try {
        if (!ensureFeedbackRequestColumns($db, $crm)) return;
        ensureBookingFeedbackSchema($db);
        $cv = $crm !== '' ? "`$crm`." : '';
        $rows = $db->query("SELECT * FROM bookings b
                            WHERE b.booking_status = 'Completed' AND b.feedback_requested_at IS NULL AND b.customer_id IS NOT NULL
                              AND NOT EXISTS (SELECT 1 FROM booking_feedback f WHERE f.booking_id = b.booking_id)
                            ORDER BY b.booking_id LIMIT 25")->fetchAll();
        foreach ($rows as $b) {
            $bid = (int)$b['booking_id'];
            // Claim it first, so two requests at the same moment cannot post the message twice.
            $claim = $db->prepare('UPDATE bookings SET feedback_requested_at = ? WHERE booking_id = ? AND feedback_requested_at IS NULL');
            $claim->execute([date('Y-m-d H:i:s'), $bid]);
            if ($claim->rowCount() !== 1) continue;
            try {
                $event = trim((string)($b['event_title'] ?? '')) !== '' ? trim((string)$b['event_title']) : 'your event';
                $first = trim((string)explode(' ', trim((string)($b['customer_name'] ?? '')))[0]);
                $staff = trim((string)($b['assigned_staff'] ?? '')) !== '' ? trim((string)$b['assigned_staff']) : 'Catering team';
                if (!empty($b['inquiry_id'])) {
                    $cs = $db->prepare("SELECT id FROM {$cv}cib_conversations WHERE inquiry_id = ? LIMIT 1");
                    $cs->execute([(int)$b['inquiry_id']]);
                    if ($conv = $cs->fetch()) {
                        $text = 'Hello' . ($first !== '' ? ' ' . $first : '') . '! Thank you for trusting us with **' . $event . '**. '
                              . 'We hope everything was perfect. Please take a moment to rate our service. Tap Rate Now below, '
                              . 'it helps us serve you and our future customers better.';
                        $at = date('Y-m-d H:i:s');
                        $db->prepare("INSERT INTO {$cv}cib_messages (conversation_id, sender_type, sender_name, message, attachments, created_at, feedback_booking_id) VALUES (?,?,?,?,NULL,?,?)")
                           ->execute([$conv['id'], 'staff', $staff, $text, $at, $bid]);
                        $db->prepare("UPDATE {$cv}cib_conversations SET updated_at = ?, sales_read_at = ? WHERE id = ?")->execute([$at, $at, $conv['id']]);
                    }
                }
                if (function_exists('notifySend')) {
                    $ref = $b['booking_ref'] ?: 'BK-' . str_pad((string)$bid, 4, '0', STR_PAD_LEFT);
                    notifySend($db, [
                        'type' => 'deal', 'kind' => 'booking', 'ref' => $ref,
                        'title' => 'Feedback requested',
                        'message' => 'Feedback requested from ' . ($b['customer_name'] ?: 'the customer') . ' for ' . $event . ' (' . $ref . ').',
                        'user_ids' => [(int)$b['customer_id']],
                        'customer' => ['title' => 'How was your event?', 'message' => 'Thank you for choosing us! Please rate your experience for ' . $event . '.'],
                    ]);
                }
            } catch (Throwable $e) {
                $db->prepare('UPDATE bookings SET feedback_requested_at = NULL WHERE booking_id = ?')->execute([$bid]);   // try again next time
                error_log('booking-feedback: could not post the thank-you message for booking ' . $bid . ': ' . $e->getMessage());
            }
        }
    } catch (Throwable $e) { error_log('booking-feedback: feedback request step failed: ' . $e->getMessage()); }

    remindOverdueBalances($db);
}

/* ======================================================================================================
   Unpaid balance after the event: remind the customer + assigned staff (+ Admin / Manager) and repeat weekly
   ====================================================================================================== */

const BALANCE_OVERDUE_AFTER_DAYS = 3;   // a balance counts as overdue this many days after the event date
const BALANCE_REMIND_EVERY_DAYS  = 7;   // then remind again every this many days until it is paid

/**
 * Bell notification for each past, non-cancelled booking that still owes money.
 * Customer: asked to pay.  Assigned Sales Staff + Admin + Manager: told the balance is overdue.
 * Uses bookings.balance_reminded_at so nobody is reminded twice in the same period. Safe to call on every request.
 */
function remindOverdueBalances(AppDatabase $db): void {
    try {
        if (!function_exists('notifySend')) return;
        $st = $db->query("SHOW COLUMNS FROM `bookings` LIKE 'balance_reminded_at'");

        $due = (int)BALANCE_OVERDUE_AFTER_DAYS;
        $every = (int)BALANCE_REMIND_EVERY_DAYS;
        $rows = $db->query("SELECT * FROM bookings
                            WHERE event_date IS NOT NULL AND event_date < DATE_SUB(CURDATE(), INTERVAL $due DAY)
                              AND COALESCE(booking_status, '') NOT LIKE '%cancel%'
                              AND customer_id IS NOT NULL
                              AND COALESCE(remaining_balance, GREATEST(COALESCE(quotation_amount, 0) - amount_paid, 0)) > 0
                              AND (balance_reminded_at IS NULL OR balance_reminded_at < DATE_SUB(NOW(), INTERVAL $every DAY))
                            ORDER BY booking_id LIMIT 25")->fetchAll();
        foreach ($rows as $b) {
            $bid = (int)$b['booking_id'];
            $claim = $db->prepare("UPDATE bookings SET balance_reminded_at = NOW()
                                   WHERE booking_id = ? AND (balance_reminded_at IS NULL OR balance_reminded_at < DATE_SUB(NOW(), INTERVAL $every DAY))");
            $claim->execute([$bid]);
            if ($claim->rowCount() !== 1) continue;   // another request already sent it

            $balance = $b['remaining_balance'] !== null && $b['remaining_balance'] !== ''
                ? (float)$b['remaining_balance']
                : max(0.0, (float)($b['quotation_amount'] ?? 0) - (float)($b['amount_paid'] ?? 0));
            $money = function_exists('quotePeso') ? quotePeso($balance) : 'PHP ' . number_format($balance, 2);
            $event = trim((string)($b['event_title'] ?? '')) !== '' ? trim((string)$b['event_title']) : 'the event';
            $ref = $b['booking_ref'] ?: 'BK-' . str_pad((string)$bid, 4, '0', STR_PAD_LEFT);
            $ids = [(int)$b['customer_id']];
            if (!empty($b['assigned_staff_id'])) $ids[] = (int)$b['assigned_staff_id'];
            try {
                notifySend($db, [
                    'type' => 'deal', 'kind' => 'booking', 'ref' => $ref,
                    'title' => 'Unpaid balance',
                    'message' => ($b['customer_name'] ?: 'The customer') . ' still owes ' . $money . ' for ' . $event . ' (' . $ref . '). The event date has passed.',
                    'user_ids' => $ids,
                    'customer' => ['title' => 'Balance still unpaid', 'message' => 'Your remaining balance of ' . $money . ' for ' . $event . ' is still unpaid. Please settle it as soon as you can.'],
                ]);
            } catch (Throwable $e) {
                $db->prepare('UPDATE bookings SET balance_reminded_at = NULL WHERE booking_id = ?')->execute([$bid]);   // try again next time
                error_log('booking-feedback: balance reminder failed for booking ' . $bid . ': ' . $e->getMessage());
            }
        }
    } catch (Throwable $e) { error_log('booking-feedback: balance reminders failed: ' . $e->getMessage()); }
}

/** What the customer's chat card needs: { booking_id, event_name, rated, rating }. */
function feedbackRequestCard(AppDatabase $db, int $bookingId): array {
    $card = ['booking_id' => $bookingId, 'event_name' => '', 'rated' => false, 'rating' => 0];
    try {
        ensureBookingFeedbackSchema($db);
        $st = $db->prepare('SELECT rating FROM booking_feedback WHERE booking_id = ? ORDER BY feedback_id DESC LIMIT 1');
        $st->execute([$bookingId]);
        if ($r = $st->fetch()) { $card['rating'] = (int)$r['rating']; $card['rated'] = $card['rating'] > 0; }
        $st = $db->prepare('SELECT event_title FROM bookings WHERE booking_id = ?');
        $st->execute([$bookingId]);
        if ($b = $st->fetch()) $card['event_name'] = (string)($b['event_title'] ?? '');
    } catch (Throwable $e) { /* the card still shows */ }
    return $card;
}
