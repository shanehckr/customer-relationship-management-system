<?php
/**
 * payments-schema.php - "Request Full Payment" (the remaining balance of a booking).
 * Shared by sales-bookings-api.php, sales-inbox-api.php, customer-inbox-api.php,
 * customer-bookings-api.php and xendit-api.php.
 * Put it in the SAME folder as quotations-schema.php (it needs quotePeso / quoteDay / quoteIso from there).
 *
 * Flow:  sales staff opens a booking -> "Request Full Payment" -> a payment_requests row (Pending) + a chat message with a card
 *        customer taps "Pay Now" (inbox card or My Bookings > Payment) -> Xendit hosted checkout (GCash / Maya)
 *        Xendit confirms -> booking.amount_paid / remaining_balance / payment_status update, request becomes Paid
 *
 * The amount is ALWAYS the booking's full remaining balance at the time of the request (and re-read when the customer pays).
 * Statuses: Pending -> Paid | Cancelled | Needs Review
 */
require_once __DIR__ . '/quotations-schema.php';

const PAY_REQUEST_URL = 'xendit-api.php?action=pay_request&id=';   // the customer's "Pay Now" link
const PAY_REQUEST_DAYS_BEFORE_EVENT = 1;                            // default due date = event date minus this many days

function ensurePaymentRequestsSchema(AppDatabase $db): void {
    // Payment request tables and message links are provisioned centrally from database/catering_crm.sql.
}

/** Default due date: PAY_REQUEST_DAYS_BEFORE_EVENT days before the event, but never in the past and never after the event. */
function paymentRequestDefaultDue(?string $eventDate): string {
    $today = date('Y-m-d');
    if (!$eventDate) return date('Y-m-d', strtotime('+' . PAY_REQUEST_DAYS_BEFORE_EVENT . ' days'));
    $due = date('Y-m-d', strtotime($eventDate . ' -' . PAY_REQUEST_DAYS_BEFORE_EVENT . ' days'));
    if ($due < $today) $due = $today;
    if ($eventDate >= $today && $due > $eventDate) $due = $eventDate;
    return $due;
}

/** Last day staff can ask for the full payment: PAY_REQUEST_DAYS_BEFORE_EVENT day(s) before the event (or today, when the event is that close). '' = no event date. */
function paymentRequestMaxDue(?string $eventDate): string {
    $eventDate = substr((string)$eventDate, 0, 10);
    if ($eventDate === '') return '';
    $max = date('Y-m-d', strtotime($eventDate . ' -' . PAY_REQUEST_DAYS_BEFORE_EVENT . ' days'));
    return $max < date('Y-m-d') ? date('Y-m-d') : $max;
}
/** Validates the "Pay by" date + time typed by staff. Returns [due_date, due_time "HH:MM:SS"]. Use it in the request_payment action. */
function paymentRequestCheckDue(?string $eventDate, string $dueDate, $timeIn): array {
    $d = DateTime::createFromFormat('Y-m-d', $dueDate);
    if (!$d || $d->format('Y-m-d') !== $dueDate) fail('Choose a valid "Pay by" date.');
    if ($dueDate < date('Y-m-d')) fail('The "Pay by" date cannot be in the past.');
    $max = paymentRequestMaxDue($eventDate);
    if ($max !== '' && $dueDate > $max) fail('The full payment must be paid at least ' . PAY_REQUEST_DAYS_BEFORE_EVENT . ' day before the event. Choose ' . quoteDay($max) . ' or earlier.');
    return [$dueDate, deadlineCheck($dueDate, $timeIn, 'payment deadline')];
}

/** Remaining balance of a bookings row (uses remaining_balance when saved, otherwise total - paid). */
function bookingBalanceDue(array $b): float {
    $stored = $b['remaining_balance'] ?? null;
    if ($stored !== null && $stored !== '') return max(0.0, round((float)$stored, 2));
    return max(0.0, round((float)($b['quotation_amount'] ?? 0) - (float)($b['amount_paid'] ?? 0), 2));
}

function paymentRequestSelect(): string {
    return "SELECT pr.*, b.event_title, b.booking_ref, b.event_date AS b_event_date, b.created_at AS b_created_at FROM payment_requests pr LEFT JOIN bookings b ON b.booking_id = pr.booking_id";
}

/** One payment_requests row (joined with its booking) -> the JSON every screen reads. */
function paymentRequestShape(array $r, bool $forCustomer = false): array {
    $id = (int)$r['id'];
    $status = (string)$r['status'];
    $ref = !empty($r['booking_ref']) ? $r['booking_ref'] : 'BK-' . str_pad((string)$r['booking_id'], 4, '0', STR_PAD_LEFT);
    $due = (string)($r['due_date'] ?? '');
    return [
        'payment_request_id' => $id,
        'booking_id'    => (int)$r['booking_id'],
        'booking_ref'   => $forCustomer ? '' : $ref,                    // customers see the event name, not the BK code
        'event_name'    => (string)($r['event_title'] ?? ''),
        'amount'        => (float)$r['amount'],
        'amount_label'  => quotePeso($r['amount']),
        'due_date'      => $due,
        'due_time'      => deadlineTime($r['due_time'] ?? ''),
        'due_label'     => deadlineLabel($due, $r['due_time'] ?? null),
        'is_overdue'    => $status === 'Pending' && $due !== '' && deadlineExpired($due, $r['due_time'] ?? null),
        'status'        => $status,
        'note'          => (string)($r['note'] ?? ''),
        'requested_by'  => $forCustomer ? '' : (string)($r['requested_by'] ?? ''),
        'requested_at'  => quoteIso($r['requested_at']),
        'paid_at'       => quoteIso($r['paid_at'] ?? null),
        'method'        => (string)($r['method'] ?? ''),
        // no Pay Now once the full-payment deadline has passed (the booking is cancelled automatically)
        'pay_url'       => ($forCustomer && $status === 'Pending' && !($due !== '' && deadlineExpired($due, $r['due_time'] ?? null)) && !(function_exists('bookingPastPaymentDeadline') && bookingPastPaymentDeadline(['event_date' => $r['b_event_date'] ?? null, 'created_at' => $r['b_created_at'] ?? null]))) ? PAY_REQUEST_URL . $id : '',
    ];
}

/**
 * The request each booking should show: its Pending one, otherwise its latest Paid one, otherwise none.
 * Returns [booking_id => payment request JSON].
 */
function paymentRequestsByBooking(AppDatabase $db, array $bookingIds, bool $forCustomer = false): array {
    $ids = array_values(array_unique(array_filter(array_map('intval', $bookingIds))));
    if (!$ids) return [];
    $in = implode(',', array_fill(0, count($ids), '?'));
    try {
        $st = $db->prepare(paymentRequestSelect() . " WHERE pr.booking_id IN ($in) AND pr.status IN ('Pending','Paid') ORDER BY pr.id DESC");
        $st->execute($ids);
        $rows = $st->fetchAll();
    } catch (Throwable $e) { error_log('paymentRequestsByBooking: ' . $e->getMessage()); return []; }
    $pending = []; $paid = [];
    foreach ($rows as $r) {
        $bid = (int)$r['booking_id'];
        if ($r['status'] === 'Pending' && !isset($pending[$bid])) $pending[$bid] = $r;
        if ($r['status'] === 'Paid' && !isset($paid[$bid])) $paid[$bid] = $r;
    }
    $out = [];
    foreach ($ids as $bid) {
        $row = $pending[$bid] ?? $paid[$bid] ?? null;
        if ($row) $out[$bid] = paymentRequestShape($row, $forCustomer);
    }
    return $out;
}

/** Payment requests referenced by chat messages: [payment_request_id => JSON]. Used by both inbox APIs. */
function paymentRequestsForMessages(AppDatabase $db, array $messageRows, bool $forCustomer = false): array {
    $ids = [];
    foreach ($messageRows as $m) if (!empty($m['payment_request_id'])) $ids[(int)$m['payment_request_id']] = true;
    $ids = array_keys($ids);
    if (!$ids) return [];
    $in = implode(',', array_fill(0, count($ids), '?'));
    try {
        $st = $db->prepare(paymentRequestSelect() . " WHERE pr.id IN ($in)");
        $st->execute($ids);
        $rows = $st->fetchAll();
    } catch (Throwable $e) { error_log('paymentRequestsForMessages: ' . $e->getMessage()); return []; }
    $out = [];
    foreach ($rows as $r) $out[(int)$r['id']] = paymentRequestShape($r, $forCustomer);
    return $out;
}

require_once __DIR__ . '/booking-deadlines.php';   // bookingPastPaymentDeadline() (safe if booking-deadlines.php loaded this file first)