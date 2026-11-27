<?php
declare(strict_types=1);

$escape = static fn(mixed $value): string => htmlspecialchars((string) $value, ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8');
$name = trim((string) ($data['name'] ?? '')) ?: 'Customer';
$code = (string) ($data['code'] ?? '');
if (preg_match('/^\d{6}$/', $code) !== 1) {
    throw new InvalidArgumentException('A six-digit verification code is required.');
}
$expiresMinutes = max(1, (int) ($data['expires_minutes'] ?? 5));

$html = '<div style="margin:0;padding:24px 12px;background:#f3f5f4;font-family:Arial,Helvetica,sans-serif;color:#202724">'
    . '<div style="max-width:560px;margin:0 auto;background:#ffffff;border:1px solid #edf0ee;border-radius:8px;text-align:center">'
    . '<div style="padding:20px 28px 12px;font-size:14px;font-weight:700;color:#156042">Espinosilla\'s Kainan</div>'
    . '<div style="padding:8px 28px 28px">'
    . '<h1 style="margin:8px 0 14px;font-size:22px;line-height:1.3;color:#202724">Email Verification Code</h1>'
    . '<p style="margin:0 0 14px;font-size:15px;line-height:1.6">Hi ' . $escape($name) . ',</p>'
    . '<p style="margin:0 0 18px;font-size:15px;line-height:1.6">Use this 6-digit code to verify your Espinosilla\'s Kainan customer account:</p>'
    . '<div style="margin:18px auto;padding:16px 12px;max-width:260px;background:#f0f7f3;border:1px solid #dce8e1;border-radius:8px;color:#156042;font-size:32px;font-weight:700;letter-spacing:8px">' . $escape($code) . '</div>'
    . '<p style="margin:18px 0 8px;font-size:14px;line-height:1.6">This code expires in ' . $expiresMinutes . ' minutes.</p>'
    . '<p style="margin:0;font-size:14px;line-height:1.6">For your security, do not share this code with anyone.</p>'
    . '<p style="margin:22px 0 0;font-size:14px;line-height:1.6">Thank you,<br><strong>Espinosilla\'s Kainan</strong></p>'
    . '</div>'
    . '<div style="padding:14px 28px;border-top:1px solid #edf0ee;text-align:center;color:#7a837f;font-size:12px">Espinosilla\'s Kainan</div>'
    . '</div></div>';

$text = "Hi {$name},\n\nYour Espinosilla's Kainan verification code is: {$code}\n\nThis code expires in {$expiresMinutes} minutes. Do not share this code with anyone.\n\nThank you,\nEspinosilla's Kainan";
return ['html' => $html, 'text' => $text];
