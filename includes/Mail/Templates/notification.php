<?php
declare(strict_types=1);

$escape = static fn(mixed $value): string => htmlspecialchars((string) $value, ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8');
$heading = trim((string) ($data['heading'] ?? 'Catering CRM notification')) ?: 'Catering CRM notification';
$greeting = trim((string) ($data['greeting'] ?? 'Customer')) ?: 'Customer';
$message = trim((string) ($data['message'] ?? '')) ?: 'There is an update regarding your Catering CRM activity.';
$rows = is_array($data['rows'] ?? null) ? $data['rows'] : [];
$amount = trim((string) ($data['amount'] ?? ''));
$buttonText = trim((string) ($data['button_text'] ?? ''));
$buttonUrl = trim((string) ($data['button_url'] ?? ''));
$subject = trim((string) ($data['subject'] ?? $heading)) ?: $heading;

$rowHtml = '';
$text = "Hi {$greeting},\n\n{$message}\n\n";
foreach ($rows as $label => $value) {
    $label = trim((string) $label);
    $value = trim((string) $value);
    if ($label === '' || $value === '') continue;
    $rowHtml .= '<tr>'
        . '<td style="padding:9px 12px;color:#5f6964;border-bottom:1px solid #e6ece8;font-size:14px">' . $escape($label) . '</td>'
        . '<td style="padding:9px 12px;color:#202724;border-bottom:1px solid #e6ece8;font-size:14px;font-weight:600;text-align:right">' . $escape($value) . '</td>'
        . '</tr>';
    $text .= $label . ': ' . $value . "\n";
}
$amountHtml = $amount !== ''
    ? '<div style="margin:20px 0;text-align:center"><div style="color:#156042;font-size:24px;font-weight:700">' . $escape($amount) . '</div></div>'
    : '';
$buttonHtml = ($buttonText !== '' && $buttonUrl !== '')
    ? '<div style="margin:22px 0;text-align:center"><a href="' . $escape($buttonUrl) . '" style="display:inline-block;background:#156042;color:#ffffff;text-decoration:none;font-size:14px;font-weight:700;padding:12px 22px;border-radius:4px">' . $escape($buttonText) . '</a></div>'
    : '';
$html = '<div style="margin:0;padding:24px 12px;background:#f3f5f4;font-family:Arial,Helvetica,sans-serif;color:#202724">'
    . '<div style="max-width:560px;margin:0 auto;background:#ffffff;border:1px solid #edf0ee;border-radius:6px">'
    . '<div style="padding:20px 28px 12px;text-align:center;font-size:13px;font-weight:700;color:#156042">Espinosilla\'s Kainan</div>'
    . '<div style="padding:8px 28px 24px;text-align:center">'
    . '<h1 style="margin:8px 0 14px;font-size:22px;line-height:1.3;color:#202724">' . $escape($heading) . '</h1>'
    . '<p style="margin:0 0 14px;font-size:15px;line-height:1.6">Hi ' . $escape($greeting) . ',</p>'
    . '<p style="margin:0 0 10px;font-size:15px;line-height:1.6">' . nl2br($escape($message)) . '</p>'
    . $amountHtml
    . ($rowHtml !== '' ? '<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="width:100%;border-collapse:collapse;margin:16px 0">' . $rowHtml . '</table>' : '')
    . $buttonHtml
    . '</div><div style="padding:14px 28px;border-top:1px solid #edf0ee;text-align:center;color:#7a837f;font-size:12px">Espinosilla\'s Kainan Catering CRM</div>'
    . '</div></div>';

$text .= "\nEspinosilla's Kainan Catering CRM";
return ['html' => $html, 'text' => $text, 'subject' => $subject];
