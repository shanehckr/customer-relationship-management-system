<?php
declare(strict_types=1);

$escape = static fn(mixed $value): string => htmlspecialchars((string) $value, ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8');
$name = trim((string) ($data['to_name'] ?? '')) ?: 'Customer';
$isBalance = ($data['type'] ?? '') === 'balance';
$remaining = (float) ($data['balance'] ?? 0);
$fullyPaid = $isBalance && $remaining <= 0;
$introText = $isBalance
    ? ($fullyPaid ? 'We received your payment. Your booking is now fully paid.' : 'We received your payment. Your remaining balance is PHP ' . number_format($remaining, 2) . '.')
    : 'We received your payment. Your booking is confirmed.';
$introHtml = $isBalance
    ? ($fullyPaid ? 'Thank you! We received your payment and your booking is now <strong>fully paid</strong>.' : 'Thank you! We received your payment. Your remaining balance is <strong>PHP ' . number_format($remaining, 2) . '</strong>.')
    : 'Thank you! We received your deposit and your booking is now <strong>confirmed</strong>.';
$subject = 'Payment received - booking ' . (string) ($data['booking_ref'] ?? '')
    . (!$isBalance ? ' confirmed' : ($fullyPaid ? ' fully paid' : ''));
$eventDate = trim((string) ($data['event_date'] ?? ''));
$dateText = $eventDate !== '' ? date('F j, Y', strtotime($eventDate)) : '';
$rows = [
    'Booking reference' => $data['booking_ref'] ?? '',
    'Event' => $data['event_name'] ?? '',
    'Event date' => $dateText,
    'Venue' => $data['location'] ?? '',
    'Amount paid' => 'PHP ' . number_format((float) ($data['paid'] ?? 0), 2),
    'Payment method' => $data['method'] ?? '',
    'Payment reference' => $data['reference'] ?? '',
    'Total' => 'PHP ' . number_format((float) ($data['total'] ?? 0), 2),
    'Remaining balance' => 'PHP ' . number_format($remaining, 2),
];
$table = '';
$text = "Hi {$name},\n\n{$introText}\n\n";
foreach ($rows as $label => $value) {
    if (trim((string) $value) === '') continue;
    $table .= '<tr><td style="padding:8px 12px;color:#666;border-bottom:1px solid #eee">' . $escape($label)
        . '</td><td style="padding:8px 12px;font-weight:600;border-bottom:1px solid #eee">' . $escape($value) . '</td></tr>';
    $text .= $label . ': ' . $value . "\n";
}
$text .= "\nThank you for choosing Espinosilla's Kainan Catering.";
$html = '<div style="font-family:Arial,sans-serif;max-width:560px;margin:auto;color:#222">'
    . '<h2 style="color:#2e7d32">Payment received</h2><p>Hi ' . $escape($name) . ',</p><p>' . $introHtml . '</p>'
    . '<table style="width:100%;border-collapse:collapse;margin:16px 0">' . $table . '</table>'
    . '<p>If you have questions, reply to this email or message us through your CRM account.</p>'
    . '<p style="color:#888;font-size:12px">Espinosilla\'s Kainan Catering</p></div>';
return ['html' => $html, 'text' => $text, 'subject' => $subject];
