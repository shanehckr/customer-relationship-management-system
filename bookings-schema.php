<?php
/**
 * bookings-schema.php - shared by sales-inbox-api.php and bookings.php.
 * Creates the bookings table (if you do not have one) and adds any missing column.
 * Column names are the ones the Bookings page in pages.js already reads (crmBookingFields).
 */
function ensureBookingsSchema(PDO $db): void {
    $db->exec("CREATE TABLE IF NOT EXISTS bookings (
        booking_id INT AUTO_INCREMENT PRIMARY KEY, booking_ref VARCHAR(30) NULL, inquiry_id INT NULL, customer_id INT NULL,
        customer_name VARCHAR(160) DEFAULT '', event_title VARCHAR(160) DEFAULT '', event_date DATE NULL, event_time VARCHAR(20) NULL,
        location VARCHAR(255) DEFAULT '', arrangement VARCHAR(60) DEFAULT '', package VARCHAR(160) DEFAULT '', expected_guests INT NULL,
        quotation_amount DECIMAL(12,2) NULL, amount_paid DECIMAL(12,2) NOT NULL DEFAULT 0, remaining_balance DECIMAL(12,2) NULL,
        payment_status VARCHAR(20) NOT NULL DEFAULT 'Unpaid', payment_method VARCHAR(40) NULL, payment_reference VARCHAR(60) NULL,
        paid_at DATETIME NULL, assigned_staff_id INT NULL, assigned_staff VARCHAR(120) NULL,
        booking_status VARCHAR(20) NOT NULL DEFAULT 'Confirmed', created_at DATETIME NULL,
        UNIQUE KEY uq_booking_inquiry (inquiry_id)
    ) ENGINE=InnoDB");
    foreach ([
        'booking_ref' => "VARCHAR(30) NULL", 'inquiry_id' => "INT NULL", 'customer_id' => "INT NULL",
        'customer_name' => "VARCHAR(160) DEFAULT ''", 'event_title' => "VARCHAR(160) DEFAULT ''", 'event_date' => "DATE NULL",
        'event_time' => "VARCHAR(20) NULL", 'location' => "VARCHAR(255) DEFAULT ''", 'arrangement' => "VARCHAR(60) DEFAULT ''",
        'package' => "VARCHAR(160) DEFAULT ''", 'expected_guests' => "INT NULL", 'quotation_amount' => "DECIMAL(12,2) NULL", 'deposit_amount' => "DECIMAL(12,2) NULL",
        'amount_paid' => "DECIMAL(12,2) NOT NULL DEFAULT 0", 'remaining_balance' => "DECIMAL(12,2) NULL",
        'payment_status' => "VARCHAR(20) NOT NULL DEFAULT 'Unpaid'", 'payment_method' => "VARCHAR(40) NULL",
        'payment_reference' => "VARCHAR(60) NULL", 'paid_at' => "DATETIME NULL", 'assigned_staff_id' => "INT NULL",
        'assigned_staff' => "VARCHAR(120) NULL", 'booking_status' => "VARCHAR(20) NOT NULL DEFAULT 'Confirmed'", 'created_at' => "DATETIME NULL",
        'fulfillment_status' => "VARCHAR(30) NULL", 'fulfillment_updated_at' => "DATETIME NULL",
    ] as $col => $def) {
        $st = $db->prepare("SHOW COLUMNS FROM `bookings` LIKE ?");
        $st->execute([$col]);
        if (!$st->fetch()) $db->exec("ALTER TABLE `bookings` ADD COLUMN `$col` $def");
    }
}

/* =====================================================================================================
   Booking progress (food + service), updated by the assigned Sales Staff.
   Steps depend on the service arrangement:
     Customer Pickup   : Booking Confirmed > Fully Paid > Preparing Food > Ready for Pickup > Picked Up
     Delivery          : Booking Confirmed > Fully Paid > Preparing Food > Out for Delivery > Delivered
     Buffet with setup : Booking Confirmed > Fully Paid > Preparing Food > On the Way > Setting Up > Event Served
   "Booking Confirmed" and "Fully Paid" come from the booking itself; the rest are saved in bookings.fulfillment_status.
   ===================================================================================================== */
function bookingProgressKind(string $arrangement): string {
    $a = strtolower($arrangement);
    if (strpos($a, 'pick') !== false) return 'pickup';
    if (strpos($a, 'deliver') !== false) return 'delivery';
    if (strpos($a, 'buffet') !== false || strpos($a, 'setup') !== false || strpos($a, 'set-up') !== false || strpos($a, 'set up') !== false) return 'buffet';
    return 'generic';
}

/** The steps staff can mark, in order: [ ['key','label','button','title','notify'], ... ]  ({event} in notify = the event name). */
function bookingProgressSteps(string $kind): array {
    $s = fn($key, $label, $button, $title, $notify) => ['key' => $key, 'label' => $label, 'button' => $button, 'title' => $title, 'notify' => $notify];
    $prep = $s('preparing', 'Preparing Food', 'Mark as preparing', 'We are preparing your food', 'We started preparing the food for {event}.');
    switch ($kind) {
        case 'pickup': return [$prep,
            $s('ready_pickup', 'Ready for Pickup', 'Mark as ready for pickup', 'Your order is ready for pickup', 'Your order for {event} is ready for pickup.'),
            $s('picked_up', 'Picked Up', 'Mark as picked up', 'Order picked up', 'Thank you! Your order for {event} was picked up.')];
        case 'delivery': return [$prep,
            $s('out_for_delivery', 'Out for Delivery', 'Mark as out for delivery', 'Your order is on its way', 'Your order for {event} is out for delivery.'),
            $s('delivered', 'Delivered', 'Mark as delivered', 'Order delivered', 'Your order for {event} was delivered. Enjoy!')];
        case 'buffet': return [$prep,
            $s('on_the_way', 'On the Way', 'Mark as on the way', 'Our team is on the way', 'Our team is on the way to your venue for {event}.'),
            $s('setting_up', 'Setting Up', 'Mark as setting up', 'Setting up your event', 'Our team is setting up at your venue for {event}.'),
            $s('served', 'Event Served', 'Mark event as served', 'Your event was served', 'Your event {event} has been served. Thank you for choosing us!')];
        default: return [$prep,
            $s('ready', 'Ready', 'Mark as ready', 'Your order is ready', 'Your order for {event} is ready.'),
            $s('done', 'Completed', 'Mark as done', 'Order completed', 'Your order for {event} is complete. Thank you!')];
    }
}

/**
 * Progress of one bookings row -> { kind, steps[labels], keys[], current, status, status_label, next{key,label,button}|null, blocked, is_done }.
 * current = 0-based index of the current step; steps.length = everything done; -1 = cancelled.
 */
function bookingProgress(array $b): array {
    $kind = bookingProgressKind((string)($b['arrangement'] ?? ''));
    $defs = bookingProgressSteps($kind);
    $labels = ['Booking Confirmed', 'Fully Paid'];
    foreach ($defs as $d) $labels[] = $d['label'];
    $total = count($labels);
    $keys = array_column($defs, 'key');
    $last = count($keys) - 1;

    $status = strtolower(trim((string)($b['booking_status'] ?? '')));
    $cancelled = strpos($status, 'cancel') !== false;
    $completed = strpos($status, 'complete') !== false;
    $stored = $b['remaining_balance'] ?? null;
    $balance = ($stored !== null && $stored !== '') ? max(0.0, (float)$stored) : max(0.0, (float)($b['quotation_amount'] ?? 0) - (float)($b['amount_paid'] ?? 0));
    $paid = (float)($b['amount_paid'] ?? 0) > 0 && $balance <= 0;

    $fi = array_search((string)($b['fulfillment_status'] ?? ''), $keys, true);
    $fi = $fi === false ? -1 : (int)$fi;

    if ($cancelled) $current = -1;
    elseif ($fi >= $last) $current = $total;               // last step reached: everything done
    elseif ($fi >= 0) $current = 2 + $fi;                  // that step is happening now
    elseif ($completed && $paid) $current = $total;        // auto-completed after the event date
    elseif ($paid) $current = 2;                           // paid: Preparing Food is next
    else $current = 1;                                     // waiting for full payment

    $next = null; $blocked = '';
    if (!$cancelled && !$completed && $fi < $last) {
        $d = $defs[$fi + 1];
        $next = ['key' => $d['key'], 'label' => $d['label'], 'button' => $d['button']];
        if (!$paid) $blocked = 'You can update the progress once the booking is fully paid.';
        elseif ($fi + 1 === $last && !empty($b['event_date']) && substr((string)$b['event_date'], 0, 10) > date('Y-m-d')) $blocked = 'The last step can be marked on the event day.';
    }
    return [
        'kind' => $kind, 'steps' => $labels, 'keys' => $keys, 'current' => $current,
        'status' => $fi >= 0 ? $keys[$fi] : '', 'status_label' => $fi >= 0 ? $defs[$fi]['label'] : '',
        'next' => $next, 'blocked' => $blocked, 'is_done' => $current >= $total,
    ];
}