<?php
declare(strict_types=1);

$escape = static fn(mixed $value): string => htmlspecialchars((string) $value, ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8');
$name = trim((string) ($data['name'] ?? '')) ?: 'Customer';
$url = (string) ($data['reset_url'] ?? '');
$minutes = max(1, (int) ($data['expires_minutes'] ?? 30));
$html = '<div style="margin:0;padding:24px 12px;background:#f3f5f4;font-family:Arial,Helvetica,sans-serif;color:#202724">'
    . '<div style="max-width:560px;margin:0 auto;background:#ffffff;border:1px solid #edf0ee;border-radius:6px">'
    . '<div style="padding:20px 28px 12px;text-align:center;font-size:13px;font-weight:700;color:#156042">Espinosilla\'s Kainan</div>'
    . '<div style="padding:8px 28px 24px;text-align:center">'
    . '<h1 style="margin:8px 0 14px;font-size:22px;line-height:1.3;color:#202724">Reset your password.</h1>'
    . '<p style="margin:0 0 14px;font-size:15px;line-height:1.6">Hi ' . $escape($name) . ',</p>'
    . '<p style="margin:0 0 14px;font-size:15px;line-height:1.6">We received a request to reset your password. This link expires in ' . $minutes . ' minutes.</p>'
    . '<p style="margin:22px 0;text-align:center"><a href="' . $escape($url) . '" style="display:inline-block;background:#156042;color:#ffffff;padding:12px 22px;border-radius:4px;text-decoration:none;font-size:14px;font-weight:700">Reset Password</a></p>'
    . '<p style="margin:0 0 14px;font-size:14px;line-height:1.6;word-break:break-all">Or copy this link into your browser:<br>' . $escape($url) . '</p>'
    . '<p style="margin:0;font-size:14px;line-height:1.6">If you did not request this, you can safely ignore this email.</p>'
    . '</div><div style="padding:14px 28px;border-top:1px solid #edf0ee;text-align:center;color:#7a837f;font-size:12px">Espinosilla\'s Kainan</div>'
    . '</div></div>';
$text = "Hi {$name},\n\nReset your password using this link (expires in {$minutes} minutes):\n{$url}\n\nIf you did not request this, ignore this email.\n\nEspinosilla's Kainan";
return ['html' => $html, 'text' => $text];
