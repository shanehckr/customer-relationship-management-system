<?php

define('SESSION_NO_REDIRECT', true);
require_once __DIR__ . '/session-init.php';

require __DIR__ . '/inquiry-common.php';
require_once __DIR__ . '/notifications-helper.php';   // bell notifications (see notifications-api.php)
require __DIR__ . '/quotations-schema.php';
require __DIR__ . '/bookings-schema.php';
require_once __DIR__ . '/payments-schema.php';   // Request Full Payment (remaining balance)
require __DIR__ . '/gmail-rest-api.php';          // sendPaymentEmail() - SMTP settings are inside mailer.php
require_once __DIR__ . '/booking-deadlines.php';        // depositDeadlineDate()
ensureQuotationsSchema($db);
ensureBookingsSchema($db);
ensurePaymentRequestsSchema($db);

$crmConfig = is_file(__DIR__ . '/config.local.php') ? (require __DIR__ . '/config.local.php') : [];
define('XENDIT_SECRET_KEY',     (string)($crmConfig['xendit_secret_key'] ?? ''));       // Settings > Developers > API keys (Money-in = Write)
define('XENDIT_CALLBACK_TOKEN', (string)($crmConfig['xendit_callback_token'] ?? ''));   // Settings > Developers > Callbacks (only needed for the webhook)
unset($crmConfig);
define('APP_BASE_URL',          'http://localhost/customer-relationship-management-system');                    // folder that holds this file, NO trailing slash
define('CUSTOMER_PAGE',         'index.php');                      // page the customer lands on after paying
define('BALANCE_RETURN_PAGE',   CUSTOMER_PAGE);                    // where the customer lands after paying a "Request Full Payment" (the page that loads My Bookings)
define('XENDIT_CURRENCY',       'PHP');
define('XENDIT_INVOICE_SECONDS', 6 * 3600);                                      // fallback only: normally the checkout stays open until the payment deadline (see xenSecondsUntil)

$TEST_CUSTOMER_ID = 0;   // TESTING only, same as customer-inquiries-api.php. Set to 0 when login works.
    // Schema is installed from database/catering_crm.sql, never mutated in requests.

/* the invoice expiry is saved so a still-open checkout page can be reused safely */
function xenEnsureColumn(AppDatabase $db, string $table, string $col, string $def): void {
    // Payment columns are provisioned centrally from database/catering_crm.sql.
}
xenEnsureColumn($db, 'xendit_payments', 'invoice_expires_at', 'DATETIME NULL');
xenEnsureColumn($db, 'payment_requests', 'invoice_expires_at', 'DATETIME NULL');

/**
 * Seconds the checkout page should stay open: until the payment deadline ("Y-m-d H:i:s"), so the page the customer sees
 * ("Pay before ...") matches the deadline the Sales Staff set. Xendit needs a positive duration, so the minimum is 60 seconds
 * (callers already refuse to start a checkout once the deadline has passed). '' = no deadline known: the old fixed duration.
 */
function xenSecondsUntil(string $deadlineAt): int {
    if ($deadlineAt === '' || !($t = strtotime($deadlineAt))) return XENDIT_INVOICE_SECONDS;
    return (int)max(60, min($t - time(), 30 * 86400));
}
/** The earlier of two "Y-m-d H:i:s" deadlines ('' = none). */
function xenEarlier(string $a, string $b): string {
    if ($a === '') return $b;
    if ($b === '') return $a;
    return $a < $b ? $a : $b;
}

/* ------------------------- Xendit helpers ------------------------- */
function xenRequest(string $method, string $path, ?array $body = null, bool $returnTransportError = false): array {
    $ch = curl_init('https://api.xendit.co' . $path);
    curl_setopt_array($ch, [
        CURLOPT_CUSTOMREQUEST  => $method,
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_TIMEOUT        => 25,
        CURLOPT_USERPWD        => XENDIT_SECRET_KEY . ':',          // secret key as the username, empty password
        CURLOPT_HTTPHEADER     => ['Accept: application/json', 'Content-Type: application/json'],
    ]);
    if ($body !== null) curl_setopt($ch, CURLOPT_POSTFIELDS, json_encode($body, JSON_UNESCAPED_UNICODE));
    $res = curl_exec($ch);
    if ($res === false) {
        $err = curl_error($ch); curl_close($ch);
        if ($returnTransportError) return [-1, ['message' => 'Could not reach Xendit.']];
        // "SSL certificate problem" on XAMPP/Windows: set curl.cainfo in php.ini to a cacert.pem file
        fail('Could not reach Xendit: ' . $err, 502);
    }
    $code = (int)curl_getinfo($ch, CURLINFO_HTTP_CODE);
    curl_close($ch);
    return [$code, json_decode($res, true) ?: []];
}

function xenMethodLabel(string $code): string {
    $c = strtoupper(trim($code));
    return ['GCASH' => 'GCash', 'PAYMAYA' => 'Maya'][$c]
        ?? ($c === '' ? 'Online' : ucwords(strtolower(str_replace('_', ' ', $c))));
}

/** True when a Xendit invoice object says the money is in. */
function xenIsPaid(array $invoice): bool {
    return in_array(strtoupper((string)($invoice['status'] ?? '')), ['PAID', 'SETTLED'], true);
}

/** Turns a paid Xendit invoice into the small array finalizePayment() needs. */
function xenPaymentFrom(array $invoice): array {
    $amount = (float)($invoice['paid_amount'] ?? 0);
    if ($amount <= 0) $amount = (float)($invoice['amount'] ?? 0);
    $code = (string)($invoice['payment_channel'] ?? '') !== '' ? $invoice['payment_channel'] : ($invoice['payment_method'] ?? '');
    return [
        'id'     => (string)(($invoice['payment_id'] ?? '') !== '' ? $invoice['payment_id'] : ($invoice['id'] ?? '')),
        'amount' => round($amount, 2),
        'method' => xenMethodLabel((string)$code),
    ];
}

/** Asks Xendit about a pending row; books it if it has been paid. Returns the (possibly updated) payment row. */
function xenVerify(AppDatabase $db, array $row): array {
    if ($row['status'] !== 'pending') return $row;
    $verified = xenditResolvePaymentInvoice($row);
    if ($verified['invoice_id'] !== '' && empty($row['invoice_id'])) {
        $db->prepare("UPDATE xendit_payments SET invoice_id = ? WHERE id = ? AND status = 'pending' AND invoice_id IS NULL")
           ->execute([$verified['invoice_id'], $row['id']]);
        $row['invoice_id'] = $verified['invoice_id'];
    }
    if ($verified['outcome'] === 'paid' && $verified['invoice_id'] !== '') {
        $invoice = xenditInvoiceRead('/v2/invoices/' . rawurlencode($verified['invoice_id']));
        if ($invoice['ok'] && xenIsPaid($invoice['data'])) finalizePayment($db, (int)$row['id'], xenPaymentFrom($invoice['data']));
    } elseif (in_array($verified['outcome'], ['unpaid_terminal', 'not_found'], true)) {
        $status = $verified['outcome'] === 'not_found' ? 'failed' : strtolower($verified['status']);
        $db->prepare("UPDATE xendit_payments SET status = ? WHERE id = ? AND status = 'pending'")
           ->execute([$status, $row['id']]);
    }
    $st = $db->prepare('SELECT * FROM xendit_payments WHERE id = ?');
    $st->execute([$row['id']]);
    return $st->fetch();
}

/**
 * Money is in: create the booking (once), mark the quotation Accepted, the inquiry Completed, and tell the customer in the chat.
 * $pay = ['id' => payment reference, 'amount' => pesos paid, 'method' => label] from xenPaymentFrom().
 */
function finalizePayment(AppDatabase $db, int $payRowId, array $pay): void {
    global $DB_CRM, $LEAD_PK;
    $paid       = (float)$pay['amount'];
    $payId      = (string)$pay['id'];
    $method     = (string)$pay['method'];
    $bookingRef = null;
    $mail       = null;     // filled when a booking is created; the email is sent AFTER the database commit

    $lookup = $db->prepare('SELECT inquiry_id FROM xendit_payments WHERE id = ? LIMIT 1');
    $lookup->execute([$payRowId]);
    $inquiryId = (int)$lookup->fetchColumn();
    if ($inquiryId <= 0) return;
    if (!deadlineInquiryLock($db, $inquiryId, true, 5)) throw new RuntimeException('Could not acquire the payment inquiry lock.');

    try {
        $db->beginTransaction();
        $st = $db->prepare('SELECT * FROM xendit_payments WHERE id = ? FOR UPDATE');
        $st->execute([$payRowId]);
        $row = $st->fetch();
        if (!$row || $row['status'] !== 'pending') { $db->commit(); deadlineInquiryLock($db, $inquiryId, false); return; } // already handled
        $iid = (int)$row['inquiry_id'];

        $ls = $db->prepare("SELECT * FROM leads WHERE `$LEAD_PK` = ? FOR UPDATE");
        $ls->execute([$iid]);
        $lead = $ls->fetch();
        $qs = $db->prepare('SELECT * FROM quotations WHERE quotation_id = ? FOR UPDATE');
        $qs->execute([$row['quotation_id']]);
        $q = $qs->fetch();
        if ($q) $q = quoteHydrate($db, $q);
        $ex = $db->prepare('SELECT booking_id FROM bookings WHERE inquiry_id = ?');
        $ex->execute([$iid]);
        $existing = $ex->fetch();

        $cv = $db->prepare("SELECT id FROM `$DB_CRM`.cib_conversations WHERE inquiry_id = ? LIMIT 1");
        $cv->execute([$iid]);
        $conv = $cv->fetch();
        $say = function (string $text, string $from = 'Payments') use ($db, $conv, $DB_CRM) {
            if (!$conv) return;
            $db->prepare("INSERT INTO `$DB_CRM`.cib_messages (conversation_id, sender_type, sender_name, message, attachments, created_at) VALUES (?,?,?,?,NULL,?)")
               ->execute([$conv['id'], 'staff', $from, $text, now()]);
            $db->prepare("UPDATE `$DB_CRM`.cib_conversations SET updated_at = ? WHERE id = ?")->execute([now(), $conv['id']]);
        };

        // paid twice, or the inquiry/quotation was closed while the customer was at the checkout page: keep the money
        // on record but do NOT create anything; staff must refund / resolve it in the Xendit dashboard.
        if ($existing || !$lead || !$q || $lead['stage'] === 'Declined' || in_array($q['status'], ['Withdrawn', 'Declined', 'Superseded'], true)) {
            $flag = $existing ? 'duplicate' : 'needs_review';
            $db->prepare('UPDATE xendit_payments SET status = ?, payment_id = ?, method = ?, amount = ?, paid_at = ? WHERE id = ?')
               ->execute([$flag, $payId, $method, $paid, now(), $payRowId]);
            $say('We received your payment of ' . quotePeso($paid) . ' (Ref. ' . $payId . '), but it could not be matched to an open quotation. '
               . 'Our team will review it and contact you about a refund or the next step.');
            $db->commit();
            deadlineInquiryLock($db, $inquiryId, false);
            return;
        }

        $total   = (float)$q['total'];
        $deposit = (float)$q['deposit_amount'];
        $balance = max(0, round($total - $paid, 2));
        $payStatus = $balance <= 0 ? 'Paid' : 'Partially Paid';
        $versionId = syncNormalizedQuotationVersion($db, (int)$q['quotation_id']);
        $temporaryRef = 'BK-TMP-' . bin2hex(random_bytes(8));
        $eventTime = ($lead['event_time'] ?? null) ?: null;
        $eventAddress = (string)($lead['event_location'] ?? '');
        $arrangement = arrangementCanonical((string)($lead['arrangement'] ?? ''));
        $db->prepare("INSERT INTO bookings
            (booking_reference, booking_ref, lead_id, inquiry_id, quotation_version_id, customer_id, assigned_staff_id,
             event_name, event_title, event_date, event_time, event_address, location, arrangement, expected_guests,
             booking_status, quotation_total, quotation_amount, deposit_required, deposit_amount, amount_paid,
             remaining_balance, payment_status, payment_method, payment_reference, paid_at, assigned_staff, created_at)
            VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)")
           ->execute([$temporaryRef, $temporaryRef, $iid, $iid, $versionId, $lead['customer_id'], $lead['assigned_staff_id'],
                $lead['event_name'], $lead['event_name'], $lead['event_date'], $eventTime, $eventAddress, $eventAddress,
                $arrangement, $lead['expected_guests'], 'Confirmed', $total, $total, $deposit, $deposit, $paid,
                $balance, $payStatus, $method, $payId, now(), $lead['assigned_staff_name'], now()]);
        $bookingId = (int)$db->lastInsertId();
        $bookingRef = 'BK-' . str_pad((string)$bookingId, 4, '0', STR_PAD_LEFT);
        $db->prepare('UPDATE bookings SET booking_reference = ?, booking_ref = ? WHERE booking_id = ?')->execute([$bookingRef, $bookingRef, $bookingId]);

        $db->prepare("INSERT INTO payments (booking_id, payment_reference, payment_type, amount, payment_status, paid_at)
                      VALUES (?,?, 'DEPOSIT', ?, 'PAID', ?) ON DUPLICATE KEY UPDATE amount=VALUES(amount), payment_status='PAID', paid_at=VALUES(paid_at)")
           ->execute([$bookingId, $bookingRef . '-DEPOSIT', $deposit, now()]);
        $db->prepare("INSERT INTO payments (booking_id, payment_reference, payment_type, amount, payment_status, paid_at)
                      VALUES (?,?, 'BALANCE', ?, ?, ?)
                      ON DUPLICATE KEY UPDATE amount=VALUES(amount), payment_status=VALUES(payment_status), paid_at=VALUES(paid_at)")
           ->execute([$bookingId, $bookingRef . '-BALANCE', $balance, $balance <= 0 ? 'PAID' : 'PENDING', $balance <= 0 ? now() : null]);
        $depositPayment = $db->prepare("SELECT payment_id FROM payments WHERE booking_id = ? AND payment_type = 'DEPOSIT'");
        $depositPayment->execute([$bookingId]);
        $depositPaymentId = (int)$depositPayment->fetchColumn();
        if ($depositPaymentId && $payId !== '') {
            $paymentMethod = strtoupper(str_replace('PAYMAYA', 'MAYA', $method));
            if (!in_array($paymentMethod, ['GCASH', 'MAYA'], true)) $paymentMethod = 'GCASH';
            $db->prepare("INSERT INTO gateway_transactions
                (payment_id, gateway_name, gateway_transaction_id, gateway_invoice_id, gateway_status, payment_method,
                 request_reference, response_reference, amount, completed_at)
                VALUES (?, 'XENDIT', ?, ?, 'PAID', ?, ?, ?, ?, ?)
                ON DUPLICATE KEY UPDATE gateway_status='PAID', response_reference=VALUES(response_reference), completed_at=VALUES(completed_at)")
               ->execute([$depositPaymentId, $payId, $row['invoice_id'] ?? null, $paymentMethod, $row['invoice_id'] ?? null, $payId, $paid, now()]);
        }
        $db->prepare("INSERT INTO booking_status_history (booking_id, status_type, old_status, new_status, changed_by, remarks)
                      VALUES (?, 'booking', NULL, 'Confirmed', ?, 'Deposit payment confirmed the booking.')")
           ->execute([$bookingId, $lead['customer_id']]);
        $db->prepare("INSERT INTO booking_items
            (booking_id, menu_item_id, tier_id, item_name_snapshot, serving_option_snapshot, quantity, unit_price, subtotal)
            SELECT ?, menu_item_id, tier_id, item_name_snapshot, serving_option_snapshot, quantity, unit_price, subtotal
            FROM quotation_items WHERE quotation_version_id = ?")
           ->execute([$bookingId, $versionId]);

        $db->prepare("UPDATE leads SET stage = 'Completed' WHERE `$LEAD_PK` = ?")->execute([$iid]);
        $db->prepare("UPDATE quotations SET status = 'Accepted', responded_at = COALESCE(responded_at, ?) WHERE quotation_id = ?")
           ->execute([now(), $q['quotation_id']]);
        syncNormalizedQuotationVersion($db, (int)$q['quotation_id']);
        $db->prepare('UPDATE xendit_payments SET status = ?, payment_id = ?, method = ?, amount = ?, booking_id = ?, paid_at = ? WHERE id = ?')
           ->execute(['paid', $payId, $method, $paid, $bookingId, now(), $payRowId]);
        $evName = trim((string)($lead['event_name'] ?? ''));
        $say('Payment received: ' . quotePeso($paid) . ' via ' . $method . ' (Ref. ' . $payId . '). Your booking for **'
            . ($evName !== '' ? $evName : 'your event') . '** is confirmed. Thank you!');
        // One follow-up message (the non-refundable policy was already sent when the customer accepted the quotation, so it is not repeated here).
        // No due date here: Sales Staff set it themselves when they send the payment request for the balance.
        $dueNote = '';
        if ($balance > 0) {
            $dueNote = 'The remaining balance of ' . quotePeso($balance) . ' will be requested by our catering team, and the payment request with its due date will be sent to you here. ';
        }
        $say('Your event date is now reserved exclusively for you. ' . $dueNote
           . 'Our catering team will contact you before your event date to confirm the final details. '
           . 'If you need to make changes or have any questions, please message us here.', 'Catering Team');
        $mail = [
            'to_email'    => (string)($lead['customer_email'] ?? ''),
            'to_name'     => (string)($lead['customer_name'] ?? ''),
            'customer_id' => (int)($lead['customer_id'] ?? 0),
            'booking_id'  => $bookingId,
            'booking_ref' => $bookingRef,
            'event_name'  => (string)($lead['event_name'] ?? ''),
            'event_date'  => (string)($lead['event_date'] ?? ''),
            'location'    => (string)($lead['event_location'] ?? ''),
            'arrangement' => arrangementDisplay($arrangement),
            'paid'        => $paid,
            'total'       => $total,
            'balance'     => $balance,
            'method'      => $method,
            'reference'   => $payId,
        ];
        $db->commit();
    } catch (Throwable $e) {
        if ($db->inTransaction()) $db->rollBack();
        deadlineInquiryLock($db, $inquiryId, false);
        throw $e;
    }
    deadlineInquiryLock($db, $inquiryId, false);

    // Payment and booking are saved. Now email the customer. This runs only once per payment, because the
    // 'already handled' check above returns early on every later call (return page, webhook, status polling).
    // A mail failure must NEVER undo or break the payment, so it is only logged.
    // Bell: the customer, the Sales Staff of this inquiry and Admin / Manager hear about the deposit + new booking.
    if ($mail) {
        $nfEvent = trim((string)($lead['event_name'] ?? '')) !== '' ? $lead['event_name'] : 'an event';
        notifySend($db, [
            'type' => 'deal', 'kind' => 'booking', 'ref' => $bookingRef,
            'title' => 'Payment received - booking confirmed',
            'message' => quotePeso($paid) . ' paid via ' . $method . ' for ' . $nfEvent . '. Booking ' . $bookingRef . ' is confirmed.',
            'user_ids' => array_values(array_filter([(int)($lead['customer_id'] ?? 0), (int)($lead['assigned_staff_id'] ?? 0)])),
            'customer' => [
                'title' => 'Payment received',
                'message' => 'We received your ' . quotePeso($paid) . ' payment. Your booking for ' . $nfEvent . ' (' . $bookingRef . ') is confirmed.',
            ],
        ]);
    }
    if ($mail) {
        try {
            // the inquiry may have no email saved: fall back to the customer's account email
            if (!filter_var($mail['to_email'], FILTER_VALIDATE_EMAIL) && !empty($lead['customer_id'])) {
                try {
                    $ce = $db->prepare("SELECT email FROM `$DB_CRM`.users WHERE `" . usersPk($db, $DB_CRM) . "` = ?");
                    $ce->execute([(int)$lead['customer_id']]);
                    $mail['to_email'] = trim((string)$ce->fetchColumn());
                } catch (Throwable $e) { /* users table differs: skip the fallback */ }
            }
            if (!filter_var($mail['to_email'], FILTER_VALIDATE_EMAIL)) {
                error_log('Payment email skipped for ' . $mail['booking_ref'] . ': no valid customer email (got "' . $mail['to_email'] . '")');
            } elseif (sendPaymentEmail($mail)) {
                error_log('Payment email queued for booking ' . $mail['booking_ref']);
            } else {
                error_log('Payment email was not queued for booking ' . $mail['booking_ref'] . '.');
            }
        } catch (Throwable $e) {
            error_log('Payment email failed for ' . $mail['booking_ref'] . ': ' . $e->getMessage());
        }
    }
}

function customerIdOrFail(): int {
    global $TEST_CUSTOMER_ID;
    $id = (int)sessionFirst(['customer_id', 'user_id', 'id']);
    if (!$id && $TEST_CUSTOMER_ID) $id = (int)$TEST_CUSTOMER_ID;
    if (!$id) fail('Please log in again.', 401);
    return $id;
}
function redirectToCustomer(string $result, string $extra = ''): void {
    if (ob_get_length()) ob_end_clean();
    header('Content-Type: text/html; charset=utf-8');
    header('Location: ' . APP_BASE_URL . '/' . CUSTOMER_PAGE . (strpos(CUSTOMER_PAGE, '?') === false ? '?' : '&') . 'pay=' . $result . $extra);   // works with or without a ?page=... part
    exit;
}

/* ------------------------- "Request Full Payment": remaining-balance payment ------------------------- */
/** Asks Xendit about a Pending payment request; books it if it has been paid. Returns the (possibly updated) request row. */
function xenVerifyRequest(AppDatabase $db, array $req): array {
    if ($req['status'] === 'Pending' && !empty($req['invoice_id'])) {
        [$code, $json] = xenRequest('GET', '/v2/invoices/' . rawurlencode($req['invoice_id']));
        if ($code === 200 && xenIsPaid($json)) finalizeBalancePayment($db, (int)$req['id'], xenPaymentFrom($json));
    }
    $st = $db->prepare('SELECT * FROM payment_requests WHERE id = ?');
    $st->execute([$req['id']]);
    return $st->fetch();
}

/**
 * Emails the customer after a "Request Full Payment" payment (same sendPaymentEmail() the deposit payment uses).
 * Runs AFTER the database commit; a mail problem is only logged and never undoes the payment.
 */
function emailBalancePayment(AppDatabase $db, array $mail, int $customerId, int $inquiryId): void {
    global $DB_CRM, $LEAD_PK;
    try {
        $ref = (string)$mail['booking_ref'];
        if (!function_exists('sendPaymentEmail')) { error_log('Balance payment email skipped for ' . $ref . ': sendPaymentEmail() not found (is gmail-rest-api.php loaded?)'); return; }
        // 1) the inquiry's saved email, 2) the customer's account email
        if (!filter_var($mail['to_email'], FILTER_VALIDATE_EMAIL) && $inquiryId) {
            try {
                $le = $db->prepare("SELECT customer_email FROM leads WHERE `$LEAD_PK` = ?");
                $le->execute([$inquiryId]);
                $mail['to_email'] = trim((string)$le->fetchColumn());
            } catch (Throwable $e) { /* leads has no customer_email column: use the account email below */ }
        }
        if (!filter_var($mail['to_email'], FILTER_VALIDATE_EMAIL) && $customerId) {
            try {
                $ce = $db->prepare("SELECT email FROM `$DB_CRM`.users WHERE `" . usersPk($db, $DB_CRM) . "` = ?");
                $ce->execute([$customerId]);
                $mail['to_email'] = trim((string)$ce->fetchColumn());
            } catch (Throwable $e) { /* users table differs: skip the fallback */ }
        }
        if (!filter_var($mail['to_email'], FILTER_VALIDATE_EMAIL)) {
            error_log('Balance payment email skipped for ' . $ref . ': no valid customer email (got "' . $mail['to_email'] . '")');
            return;
        }
        if (sendPaymentEmail($mail)) {
            error_log('Balance payment email queued for booking ' . $ref);
        } else {
            error_log('Balance payment email was not queued for booking ' . $ref . '.');
        }
    } catch (Throwable $e) {
        error_log('Balance payment email failed for ' . ($mail['booking_ref'] ?? '?') . ': ' . $e->getMessage());
    }
}

/**
 * Money is in for a payment request: add it to the booking (once), mark the request Paid, tell the customer in the chat.
 * Idempotent like finalizePayment(): the return page and the webhook can both call it, only one of them books the money.
 */
function finalizeBalancePayment(AppDatabase $db, int $reqId, array $pay): void {
    global $DB_CRM;
    $paid   = round((float)$pay['amount'], 2);
    $payId  = (string)$pay['id'];
    $method = (string)$pay['method'];
    $mail   = null;         // filled when the money is booked; the email is sent AFTER the database commit
    $mailCustomerId = 0; $mailInquiryId = 0;

    $db->beginTransaction();
    try {
        $st = $db->prepare('SELECT * FROM payment_requests WHERE id = ? FOR UPDATE');
        $st->execute([$reqId]);
        $req = $st->fetch();
        if (!$req || $req['status'] !== 'Pending') { $db->commit(); return; }          // already handled

        $bs = $db->prepare('SELECT * FROM bookings WHERE booking_id = ? FOR UPDATE');
        $bs->execute([$req['booking_id']]);
        $b = $bs->fetch();

        $conv = false;
        if (!empty($req['inquiry_id'])) {
            $cv = $db->prepare("SELECT id FROM `$DB_CRM`.cib_conversations WHERE inquiry_id = ? LIMIT 1");
            $cv->execute([$req['inquiry_id']]);
            $conv = $cv->fetch();
        }
        $say = function (string $text) use ($db, $conv, $DB_CRM) {
            if (!$conv) return;
            $db->prepare("INSERT INTO `$DB_CRM`.cib_messages (conversation_id, sender_type, sender_name, message, attachments, created_at) VALUES (?,?,?,?,NULL,?)")
               ->execute([$conv['id'], 'staff', 'Payments', $text, now()]);
            $db->prepare("UPDATE `$DB_CRM`.cib_conversations SET updated_at = ? WHERE id = ?")->execute([now(), $conv['id']]);
        };

        // booking gone or cancelled while the customer was at the checkout page: keep the money on record, staff resolve it in Xendit
        if (!$b || preg_match('/cancel/i', (string)$b['booking_status'])) {
            $db->prepare("UPDATE payment_requests SET status = 'Needs Review', payment_id = ?, method = ?, paid_amount = ?, paid_at = ? WHERE id = ?")
               ->execute([$payId, $method, $paid, now(), $reqId]);
            $say('We received your payment of ' . quotePeso($paid) . ' (Ref. ' . $payId . '), but this booking is no longer active. '
               . 'Our team will review it and contact you about a refund or the next step.');
            $db->commit();
            return;
        }

        $total   = (float)$b['quotation_amount'];
        $newPaid = round((float)$b['amount_paid'] + $paid, 2);
        $balance = max(0, round($total - $newPaid, 2));
        $payStatus = $balance <= 0 ? 'Paid' : 'Partially Paid';
        $db->prepare('UPDATE bookings SET amount_paid = ?, remaining_balance = ?, payment_status = ?, payment_method = ?, payment_reference = ?, paid_at = ? WHERE booking_id = ?')
           ->execute([$newPaid, $balance, $payStatus, $method, $payId, now(), $b['booking_id']]);
        $db->prepare("UPDATE payment_requests SET status = 'Paid', payment_id = ?, method = ?, paid_amount = ?, paid_at = ? WHERE id = ?")
           ->execute([$payId, $method, $paid, now(), $reqId]);
        $slot = $db->prepare("SELECT payment_id FROM payments WHERE booking_id = ? AND payment_type = 'BALANCE' FOR UPDATE");
        $slot->execute([$b['booking_id']]);
        $balancePaymentId = (int)$slot->fetchColumn();
        if ($balancePaymentId) {
            $db->prepare("UPDATE payments SET amount = ?, payment_status = 'PAID', paid_at = ? WHERE payment_id = ?")
               ->execute([$paid, now(), $balancePaymentId]);
            if ($payId !== '') {
                $paymentMethod = strtoupper(str_replace('PAYMAYA', 'MAYA', $method));
                if (!in_array($paymentMethod, ['GCASH', 'MAYA'], true)) $paymentMethod = 'GCASH';
                $db->prepare("INSERT INTO gateway_transactions
                    (payment_id, gateway_name, gateway_transaction_id, gateway_status, payment_method,
                     request_reference, response_reference, amount, completed_at)
                    VALUES (?, 'XENDIT', ?, 'PAID', ?, ?, ?, ?, ?)
                    ON DUPLICATE KEY UPDATE gateway_status='PAID', response_reference=VALUES(response_reference), completed_at=VALUES(completed_at)")
                   ->execute([$balancePaymentId, $payId, $paymentMethod, (string)$reqId, $payId, $paid, now()]);
            }
        }

        $ev = trim((string)($b['event_title'] ?? ''));
        $say('Payment received: ' . quotePeso($paid) . ' via ' . $method . ' (Ref. ' . $payId . '). '
           . ($balance <= 0
                ? 'Your booking for **' . ($ev !== '' ? $ev : 'your event') . '** is now fully paid. Thank you!'
                : 'Your remaining balance is ' . quotePeso($balance) . '.'));
        $mail = [
            'to_email'    => '',                                   // looked up after the commit (inquiry email, then account email)
            'to_name'     => (string)($b['customer_name'] ?? ''),
            'customer_id' => (int)($b['customer_id'] ?? $req['customer_id'] ?? 0),
            'booking_id'  => (int)$b['booking_id'],
            'booking_ref' => (string)(($b['booking_ref'] ?? '') !== '' ? $b['booking_ref'] : 'BK-' . str_pad((string)$b['booking_id'], 4, '0', STR_PAD_LEFT)),
            'event_name'  => $ev,
            'event_date'  => (string)($b['event_date'] ?? ''),
            'location'    => (string)($b['location'] ?? ''),
            'arrangement' => arrangementDisplay((string)($b['arrangement'] ?? '')),
            'paid'        => $paid,
            'total'       => $total,
            'balance'     => $balance,
            'method'      => $method,
            'reference'   => $payId,
            'type'        => 'balance',                            // tells sendPaymentEmail() to use the "remaining balance" wording
        ];
        $mailCustomerId = (int)($b['customer_id'] ?? $req['customer_id'] ?? 0);
        $mailInquiryId  = (int)($req['inquiry_id'] ?? $b['inquiry_id'] ?? 0);
        $db->commit();
    } catch (Throwable $e) {
        if ($db->inTransaction()) $db->rollBack();
        throw $e;
    }

    // Payment is saved. Now email the customer (runs once: the 'already handled' check above returns early on later calls).
    // Bell: the customer, the Sales Staff of this booking and Admin / Manager hear about the balance payment.
    if ($mail) {
        $nfRef = $mail['booking_ref'];
        $nfEvent = $mail['event_name'] !== '' ? $mail['event_name'] : 'an event';
        $nfDone = $mail['balance'] <= 0;
        notifySend($db, [
            'type' => 'deal', 'kind' => 'booking', 'ref' => $nfRef,
            'title' => $nfDone ? 'Booking fully paid' : 'Balance payment received',
            'message' => quotePeso($paid) . ' paid via ' . $method . ' for ' . $nfEvent . ' (' . $nfRef . ').'
                       . ($nfDone ? ' Fully paid.' : ' Remaining ' . quotePeso($mail['balance']) . '.'),
            'user_ids' => array_values(array_filter([$mailCustomerId, (int)($b['assigned_staff_id'] ?? 0)])),
            'customer' => [
                'title' => 'Payment received',
                'message' => 'We received your ' . quotePeso($paid) . ' payment for ' . $nfEvent . '.'
                           . ($nfDone ? ' Your booking is fully paid. Thank you!' : ' Remaining balance: ' . quotePeso($mail['balance']) . '.'),
            ],
        ]);
    }
    if ($mail) emailBalancePayment($db, $mail, $mailCustomerId, $mailInquiryId);
}

/** Browser redirect after a remaining-balance payment: ?pay=balance_success|balance_cancelled|balance_pending|balance_review|balance_error (&msg=...) */
function redirectToBalance(string $result, string $msg = ''): void {
    if (ob_get_length()) ob_end_clean();
    header('Content-Type: text/html; charset=utf-8');
    $page = BALANCE_RETURN_PAGE;
    header('Location: ' . APP_BASE_URL . '/' . $page . (strpos($page, '?') === false ? '?' : '&') . 'pay=' . $result . ($msg !== '' ? '&msg=' . rawurlencode($msg) : ''));
    exit;
}
function redirectExternal(string $url): void {
    if (ob_get_length()) ob_end_clean();
    header('Content-Type: text/html; charset=utf-8');
    header('Location: ' . $url);
    exit;
}

$action = $_GET['action'] ?? '';

/* ------------------------- create_checkout ------------------------- */
if ($action === 'create_checkout') {
    if ($_SERVER['REQUEST_METHOD'] !== 'POST') fail('POST required.', 405);
    $customerId = customerIdOrFail();
    $token = $_SERVER['HTTP_X_CSRF_TOKEN'] ?? ($_POST['csrf_token'] ?? '');
    if (empty($_SESSION['csrf_token']) || !hash_equals($_SESSION['csrf_token'], (string)$token)) fail('Session expired. Refresh and try again.', 403);
    if (XENDIT_SECRET_KEY === '' || strpos(XENDIT_SECRET_KEY, 'PASTE_YOUR') !== false) fail('Xendit is not set up yet: put your secret key in config.local.php (xendit_secret_key).', 500);

    $st = $db->prepare("SELECT q.*, qv.valid_until, qv.valid_until_time, qv.deposit_rate, qv.deposit_amount,
                               qv.subtotal, qv.discount_amount, qv.additional_charges, qv.total_amount AS normalized_total,
                               l.stage AS lead_stage, l.event_name, l.event_date AS lead_event_date, l.customer_name, l.customer_email
                        FROM quotations q JOIN quotation_versions qv ON qv.quotation_id=q.quotation_id AND qv.version_number=q.version
                        JOIN leads l ON l.`$LEAD_PK` = q.inquiry_id
                        WHERE q.quotation_id = ? AND l.customer_id = ?");
    $st->execute([(int)($_POST['quotation_id'] ?? 0), $customerId]);
    $q = $st->fetch();
    if (!$q) fail('Quotation not found.', 404);
    $q = quoteHydrate($db, $q);
    $iid = (int)$q['inquiry_id'];
    if ($q['lead_stage'] === 'Declined') fail('This inquiry was declined.', 409);
    if (!in_array($q['status'], ['Sent', 'Accepted'], true)) fail('This quotation is no longer open for payment (' . strtolower($q['status']) . ').', 409);
    // the deposit must be paid before the "valid until" date AND time set by the Sales Staff (an Accepted quotation made before times existed keeps the old rule)
    if (($q['status'] === 'Sent' || !empty($q['valid_until_time'])) && $q['valid_until'] && deadlineExpired($q['valid_until'], $q['valid_until_time'] ?? null)) {
        fail('The deadline to pay this deposit (' . deadlineLabel($q['valid_until'], $q['valid_until_time'] ?? null) . ') has passed. Please ask the catering team for a new quotation.', 409);
    }
    $bk = $db->prepare('SELECT booking_ref FROM bookings WHERE inquiry_id = ?');
    $bk->execute([$iid]);
    if ($bk->fetch()) fail('This inquiry already has a booking. The deposit was paid.', 409);
    if (!empty($q['lead_event_date']) && ($q['sent_at'] ?: $q['prepared_at']) >= DEADLINES_APPLY_FROM
        && date('Y-m-d') > quoteDepositDeadline((string)$q['lead_event_date'], $q['valid_until'] ?? null)) {
        fail('The deposit deadline for this event (' . quoteDay(quoteDepositDeadline((string)$q['lead_event_date'], $q['valid_until'] ?? null)) . ') has passed. Please send a new inquiry.', 409);
    }

    $amount = round((float)$q['deposit_amount'], 2);
    if ($amount <= 0) fail('There is no deposit amount to pay for this quotation.');   // Xendit reports its own minimum amount

    // reuse a checkout page that is still open, so the customer cannot pay twice by accident
    // (an invoice is "still open" until its saved expiry; older rows without one fall back to created_at + the old fixed duration)
    if (!deadlineInquiryLock($db, $iid, true, 5)) fail('Payment is being updated. Please try again in a moment.', 409);
    $state = $db->prepare("SELECT q.status,q.version,l.stage FROM quotations q JOIN leads l ON l.`$LEAD_PK` = q.inquiry_id WHERE q.quotation_id = ? AND q.inquiry_id = ? LIMIT 1");
    $state->execute([(int)$q['quotation_id'], $iid]);
    $current = $state->fetch();
    if (!$current || $current['version'] != $q['version'] || !in_array($current['status'], ['Sent', 'Accepted'], true)
        || in_array($current['stage'], ['Declined', 'Completed', 'Confirmed'], true)) {
        deadlineInquiryLock($db, $iid, false);
        fail('This quotation is no longer open for payment.', 409);
    }
    $bk = $db->prepare('SELECT booking_ref FROM bookings WHERE inquiry_id = ?');
    $bk->execute([$iid]);
    if ($bk->fetch()) { deadlineInquiryLock($db, $iid, false); fail('This inquiry already has a booking. The deposit was paid.', 409); }
    $old = $db->prepare("SELECT * FROM xendit_payments WHERE quotation_id = ? AND status = 'pending' AND checkout_url IS NOT NULL
                         AND amount = ? AND COALESCE(invoice_expires_at, DATE_ADD(created_at, INTERVAL " . (int)XENDIT_INVOICE_SECONDS . " SECOND)) > ? ORDER BY id DESC LIMIT 1");
    $old->execute([$q['quotation_id'], $amount, date('Y-m-d H:i:s')]);
    if ($o = $old->fetch()) {
        deadlineInquiryLock($db, $iid, false);
        $o = xenVerify($db, $o);                                // maybe it was already paid
        if ($o['status'] === 'pending') out(['success' => true, 'checkout_url' => $o['checkout_url']]);
        fail('This deposit was already paid.', 409);
    }

    $db->prepare('INSERT INTO xendit_payments (inquiry_id, quotation_id, customer_id, amount, status, created_at) VALUES (?,?,?,?,?,?)')
       ->execute([$iid, $q['quotation_id'], $customerId, $amount, 'pending', now()]);
    $rowId = (int)$db->lastInsertId();

    // The checkout stays open until the deposit deadline: the Sales Staff's "valid until" date + time, or the automatic
    // deposit deadline (end of that day) when it is earlier. Same rule as processDepositDeadlines() in booking-deadlines.php.
    $dueAt = '';
    if (($q['status'] === 'Sent' || !empty($q['valid_until_time'])) && !empty($q['valid_until'])) $dueAt = deadlineAt($q['valid_until'], $q['valid_until_time'] ?? null);
    if (!empty($q['lead_event_date']) && ($q['sent_at'] ?: $q['prepared_at']) >= DEADLINES_APPLY_FROM) {
        $dueAt = xenEarlier($dueAt, deadlineAt(quoteDepositDeadline((string)$q['lead_event_date'], $q['valid_until'] ?? null), null));
    }
    if ($dueAt !== '' && $dueAt <= date('Y-m-d H:i:s')) {
        $db->prepare('DELETE FROM xendit_payments WHERE id = ?')->execute([$rowId]);
        deadlineInquiryLock($db, $iid, false);
        fail('The deadline to pay this deposit (' . deadlineLabel(substr($dueAt, 0, 10), substr($dueAt, 11, 5)) . ') has passed. Please ask the catering team for a new quotation.', 409);
    }
    $invoiceSeconds = xenSecondsUntil($dueAt);

    $itemName = 'Catering deposit - ' . ($q['event_name'] ?: 'Catering event');
    $body = [
        'external_id'      => quoteRef($iid) . '-' . $rowId . '-' . time(),          // must be unique per invoice
        'amount'           => $amount,
        'currency'         => XENDIT_CURRENCY,
        'description'      => 'Deposit for ' . ($q['event_name'] ?: 'Catering event')
                              . ' (' . ((int)$q['deposit_rate'] ?: (int)round(QUOTE_DEPOSIT_RATE * 100)) . '% deposit, quotation v' . (int)$q['version'] . ')',
        'invoice_duration' => $invoiceSeconds,
        'payment_methods'  => ['GCASH', 'PAYMAYA'],                  // only GCash and Maya appear on the checkout page
        'items'            => [['name' => $itemName, 'quantity' => 1, 'price' => $amount]],
        'success_redirect_url' => APP_BASE_URL . '/xendit-api.php?action=return&result=success&id=' . $rowId,
        'failure_redirect_url' => APP_BASE_URL . '/xendit-api.php?action=return&result=cancel&id=' . $rowId,
    ];
    if (filter_var($q['customer_email'], FILTER_VALIDATE_EMAIL)) {
        $body['payer_email'] = $q['customer_email'];
        $body['customer']    = ['given_names' => $q['customer_name'] ?: 'Customer', 'email' => $q['customer_email']];
    }
    [$code, $json] = xenRequest('POST', '/v2/invoices', $body, true);
    $url = (string)($json['invoice_url'] ?? '');
    if ($code >= 300 || $url === '' || empty($json['id'])) {
        $db->prepare('DELETE FROM xendit_payments WHERE id = ?')->execute([$rowId]);
        $why = $json['message'] ?? ($json['error_code'] ?? 'could not start the payment');
        deadlineInquiryLock($db, $iid, false);
        fail('Xendit error: ' . $why . ' (HTTP ' . $code . ')', 502);
    }
    $db->prepare('UPDATE xendit_payments SET invoice_id = ?, checkout_url = ?, invoice_expires_at = ? WHERE id = ?')->execute([$json['id'], $url, date('Y-m-d H:i:s', time() + $invoiceSeconds), $rowId]);
    deadlineInquiryLock($db, $iid, false);
    out(['success' => true, 'checkout_url' => $url]);
}

/* ------------------------- return (customer comes back from Xendit) ------------------------- */
if ($action === 'return') {
    $st = $db->prepare('SELECT * FROM xendit_payments WHERE id = ?');
    $st->execute([(int)($_GET['id'] ?? 0)]);
    $row = $st->fetch();
    if (!$row) redirectToCustomer('error');
    $row = xenVerify($db, $row);                        // asks Xendit directly: nobody can fake "success" in the URL
    if ($row['status'] === 'paid') {
        $b = $db->prepare('SELECT booking_ref FROM bookings WHERE booking_id = ?');
        $b->execute([$row['booking_id']]);
        redirectToCustomer('success', '&booking=' . urlencode((string)($b->fetchColumn() ?: '')));
    }
    if (($_GET['result'] ?? '') === 'cancel') redirectToCustomer('cancelled');
    redirectToCustomer($row['status'] === 'pending' ? 'pending' : 'review');
}

/* ------------------------- status (optional polling from the customer page) ------------------------- */
if ($action === 'status') {
    $customerId = customerIdOrFail();
    $st = $db->prepare('SELECT * FROM xendit_payments WHERE quotation_id = ? AND customer_id = ? ORDER BY id DESC LIMIT 1');
    $st->execute([(int)($_GET['quotation_id'] ?? 0), $customerId]);
    $row = $st->fetch();
    if (!$row) out(['success' => true, 'paid' => false, 'status' => 'none']);
    $row = xenVerify($db, $row);
    $ref = '';
    if ($row['booking_id']) { $b = $db->prepare('SELECT booking_ref FROM bookings WHERE booking_id = ?'); $b->execute([$row['booking_id']]); $ref = (string)$b->fetchColumn(); }
    out(['success' => true, 'paid' => $row['status'] === 'paid', 'status' => $row['status'], 'booking_ref' => $ref]);
}

/* ------------------------- webhook ------------------------- */
if ($action === 'webhook') {
    // Xendit sends your "callback verification token" in the x-callback-token header
    $sent = $_SERVER['HTTP_X_CALLBACK_TOKEN'] ?? '';
    if (XENDIT_CALLBACK_TOKEN === '' || strpos(XENDIT_CALLBACK_TOKEN, 'PASTE_') !== false || !hash_equals((string)XENDIT_CALLBACK_TOKEN, (string)$sent)) fail('Invalid callback token.', 401);   // an empty / placeholder token never matches

    $event = json_decode(file_get_contents('php://input'), true) ?: [];
    $invoiceId = (string)($event['id'] ?? '');
    if ($invoiceId !== '' && in_array(strtoupper((string)($event['status'] ?? '')), ['PAID', 'SETTLED'], true)) {
        $st = $db->prepare('SELECT * FROM xendit_payments WHERE invoice_id = ?');
        $st->execute([$invoiceId]);
        if ($row = $st->fetch()) xenVerify($db, $row);   // re-check with Xendit instead of trusting the callback body
        else {                                            // not a deposit: maybe a "Request Full Payment" invoice
            $pr = $db->prepare('SELECT * FROM payment_requests WHERE invoice_id = ?');
            $pr->execute([$invoiceId]);
            if ($req = $pr->fetch()) xenVerifyRequest($db, $req);
        }
    }
    out(['success' => true]);                           // always 200 so Xendit does not keep retrying events we ignore
}

/* ------------------------- pay_request (the "Pay Now" button for a Request Full Payment) ------------------------- */
// A plain link (GET): the customer clicks it in the inbox card or in My Bookings > Payment. Only the owner of the request can use it.
// The amount is the booking's CURRENT remaining balance. An open Xendit checkout page is reused, so nobody pays twice by accident.
if ($action === 'pay_request') {
    $customerId = customerIdOrFail();
    if (XENDIT_SECRET_KEY === '' || strpos(XENDIT_SECRET_KEY, 'PASTE_YOUR') !== false) redirectToBalance('balance_error', 'Online payment is not set up yet.');
    $st = $db->prepare('SELECT * FROM payment_requests WHERE id = ? AND customer_id = ?');
    $st->execute([(int)($_GET['id'] ?? 0), $customerId]);
    $req = $st->fetch();
    if (!$req) redirectToBalance('balance_error', 'We could not find that payment request.');

    $req = xenVerifyRequest($db, $req);                  // maybe it was already paid
    if ($req['status'] === 'Paid') redirectToBalance('balance_success');
    if ($req['status'] !== 'Pending') redirectToBalance('balance_error', 'This payment request is no longer open.');

    $bs = $db->prepare('SELECT * FROM bookings WHERE booking_id = ? AND customer_id = ?');
    $bs->execute([$req['booking_id'], $customerId]);
    $b = $bs->fetch();
    if (!$b || preg_match('/cancel/i', (string)$b['booking_status'])) redirectToBalance('balance_error', 'This booking is no longer active.');
    if (bookingPastPaymentDeadline($b)) redirectToBalance('balance_error', 'The payment deadline for this booking has passed, so it can no longer be paid online. Please message the catering team.');
    if (!empty($req['due_date']) && deadlineExpired($req['due_date'], $req['due_time'] ?? null)) redirectToBalance('balance_error', 'The pay-by time for this request (' . deadlineLabel($req['due_date'], $req['due_time'] ?? null) . ') has passed. Please message the catering team.');
    $amount = bookingBalanceDue($b);
    if ($amount <= 0) {
        $db->prepare("UPDATE payment_requests SET status = 'Cancelled' WHERE id = ? AND status = 'Pending'")->execute([$req['id']]);
        redirectToBalance('balance_error', 'This booking is already fully paid.');
    }

    // reuse the checkout page while it is still open and the amount has not changed
    $openUntil = !empty($req['invoice_expires_at']) ? strtotime($req['invoice_expires_at']) : (!empty($req['invoice_created_at']) ? strtotime($req['invoice_created_at']) + XENDIT_INVOICE_SECONDS : 0);
    if (!empty($req['checkout_url']) && !empty($req['invoice_id']) && $openUntil > time() && abs((float)$req['amount'] - $amount) < 0.01) {
        redirectExternal($req['checkout_url']);
    }

    // The checkout stays open until the "Pay by" date + time the Sales Staff set (never later than the automatic deadline, the day before the event).
    $dueAt = !empty($req['due_date']) ? deadlineAt($req['due_date'], $req['due_time'] ?? null) : '';
    if (!empty($b['event_date'])) $dueAt = xenEarlier($dueAt, deadlineAt(fullPaymentDeadlineDate(substr((string)$b['event_date'], 0, 10)), null));
    if ($dueAt !== '' && $dueAt <= date('Y-m-d H:i:s')) redirectToBalance('balance_error', 'The pay-by time for this request has passed. Please message the catering team.');
    $invoiceSeconds = xenSecondsUntil($dueAt);

    $ref  = $b['booking_ref'] ?: 'BK-' . str_pad((string)$b['booking_id'], 4, '0', STR_PAD_LEFT);
    $ev   = trim((string)($b['event_title'] ?? '')) ?: 'Catering event';
    $body = [
        'external_id'      => 'BAL-' . $ref . '-' . (int)$req['id'] . '-' . time(),     // must be unique per invoice
        'amount'           => $amount,
        'currency'         => XENDIT_CURRENCY,
        'description'      => 'Remaining balance for ' . $ev,
        'invoice_duration' => $invoiceSeconds,
        'payment_methods'  => ['GCASH', 'PAYMAYA'],
        'items'            => [['name' => 'Catering balance - ' . $ev, 'quantity' => 1, 'price' => $amount]],
        'success_redirect_url' => APP_BASE_URL . '/xendit-api.php?action=return_balance&result=success&id=' . (int)$req['id'],
        'failure_redirect_url' => APP_BASE_URL . '/xendit-api.php?action=return_balance&result=cancel&id=' . (int)$req['id'],
    ];
    [$code, $json] = xenRequest('POST', '/v2/invoices', $body);
    $url = (string)($json['invoice_url'] ?? '');
    if ($code >= 300 || $url === '' || empty($json['id'])) {
        error_log('pay_request: Xendit error HTTP ' . $code . ' ' . json_encode($json));
        redirectToBalance('balance_error', 'Xendit error: ' . ($json['message'] ?? 'could not start the payment'));
    }
    $db->prepare('UPDATE payment_requests SET amount = ?, invoice_id = ?, checkout_url = ?, invoice_created_at = ?, invoice_expires_at = ? WHERE id = ?')
       ->execute([$amount, $json['id'], $url, now(), date('Y-m-d H:i:s', time() + $invoiceSeconds), $req['id']]);
    redirectExternal($url);
}

/* ------------------------- return_balance (customer comes back from Xendit) ------------------------- */
if ($action === 'return_balance') {
    $st = $db->prepare('SELECT * FROM payment_requests WHERE id = ?');
    $st->execute([(int)($_GET['id'] ?? 0)]);
    $req = $st->fetch();
    if (!$req) redirectToBalance('balance_error');
    $req = xenVerifyRequest($db, $req);                 // asks Xendit directly: nobody can fake "success" in the URL
    if ($req['status'] === 'Paid') redirectToBalance('balance_success');
    if (($_GET['result'] ?? '') === 'cancel') redirectToBalance('balance_cancelled');
    redirectToBalance($req['status'] === 'Pending' ? 'balance_pending' : 'balance_review');
}

fail('Unknown action.', 400);
