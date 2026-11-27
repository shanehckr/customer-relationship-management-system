<?php
declare(strict_types=1);

$escape = static fn(mixed $value): string => htmlspecialchars((string) $value, ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8');
$name = trim((string) ($data['to_name'] ?? '')) ?: 'Customer';
$isBalance = ($data['type'] ?? '') === 'balance';
$hasRemaining = array_key_exists('balance', $data) && is_numeric($data['balance']);
$remaining = $hasRemaining ? (float) $data['balance'] : null;
$fullyPaid = $isBalance && $hasRemaining && $remaining <= 0;
$introText = $isBalance
    ? ($fullyPaid ? 'We received your payment. Your booking is now fully paid.' : ($hasRemaining ? 'We received your payment. Your remaining balance is PHP ' . number_format((float) $remaining, 2) . '.' : 'We received your payment.'))
    : 'We received your payment. Your booking is confirmed.';
$introHtml = $isBalance
    ? ($fullyPaid ? 'Thank you! We received your payment and your booking is now <strong>fully paid</strong>.' : ($hasRemaining ? 'Thank you! We received your payment. Your remaining balance is <strong>PHP ' . number_format((float) $remaining, 2) . '</strong>.' : 'Thank you! We received your payment.'))
    : 'Thank you! We received your deposit and your booking is now <strong>confirmed</strong>.';
$bookingRef = trim((string) ($data['booking_ref'] ?? ''));
$subject = $isBalance ? 'Balance payment received' : 'Deposit payment received';
if ($bookingRef !== '') $subject .= ' - booking ' . $bookingRef;
if (!$isBalance) $subject .= ' confirmed';
elseif ($fullyPaid) $subject .= ' fully paid';
$eventDate = trim((string) ($data['event_date'] ?? ''));
$eventTimestamp = $eventDate !== '' ? strtotime($eventDate) : false;
$dateText = $eventTimestamp !== false ? date('F j, Y', $eventTimestamp) : '';
$rows = [
    'Booking reference' => $bookingRef,
    'Event' => $data['event_name'] ?? '',
    'Event date' => $dateText,
    'Venue' => $data['location'] ?? '',
    'Amount paid' => isset($data['paid']) && is_numeric($data['paid']) ? 'PHP ' . number_format((float) $data['paid'], 2) : '',
    'Payment method' => $data['method'] ?? '',
    'Payment reference' => $data['reference'] ?? '',
    'Total' => isset($data['total']) && is_numeric($data['total']) ? 'PHP ' . number_format((float) $data['total'], 2) : '',
    'Remaining balance' => $hasRemaining ? 'PHP ' . number_format((float) $remaining, 2) : '',
];
$table = '';
$text = "Hi {$name},\n\n{$introText}\n\n";
foreach ($rows as $label => $value) {
    if (trim((string) $value) === '') continue;
    $table .= '<tr><td style="width:42%;padding:8px 12px;color:#666;border-bottom:1px solid #eee;text-align:left;vertical-align:top;overflow-wrap:anywhere;word-break:break-word">' . $escape($label)
        . '</td><td style="width:58%;padding:8px 12px;font-weight:600;border-bottom:1px solid #eee;text-align:right;vertical-align:top;overflow-wrap:anywhere;word-break:break-word">' . $escape($value) . '</td></tr>';
    $text .= $label . ': ' . $value . "\n";
}
$text .= "\nThank you for choosing Espinosilla's Kainan Catering.";
$html = '<div style="margin:0;padding:24px 12px;background:#f3f5f4;font-family:Arial,Helvetica,sans-serif;color:#202724">'
    . '<div style="max-width:560px;margin:0 auto;background:#ffffff;border:1px solid #edf0ee;border-radius:6px">'
    . '<div style="padding:20px 28px 12px;text-align:center;font-size:13px;font-weight:700;color:#156042">Espinosilla\'s Kainan</div>'
    . '<div style="padding:8px 28px 24px;text-align:center">'
    . '<h1 style="margin:8px 0 14px;font-size:22px;line-height:1.3;color:#202724">Payment received</h1>'
    . '<p style="margin:0 0 14px;font-size:15px;line-height:1.6">Hi ' . $escape($name) . ',</p>'
    . '<p style="margin:0 0 10px;font-size:15px;line-height:1.6">' . $introHtml . '</p>'
    . '<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="width:100%;table-layout:fixed;border-collapse:collapse;margin:16px 0;text-align:left">' . $table . '</table>'
    . '<p style="margin:0;font-size:14px;line-height:1.6">If you have questions, reply to this email or message us through your Espinosilla\'s Kainan account.</p>'
    . '</div><div style="padding:14px 28px;border-top:1px solid #edf0ee;text-align:center;color:#7a837f;font-size:12px">Espinosilla\'s Kainan</div>'
    . '</div></div>';
return ['html' => $html, 'text' => $text, 'subject' => $subject];
