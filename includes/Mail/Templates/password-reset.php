<?php
declare(strict_types=1);

$escape = static fn(mixed $value): string => htmlspecialchars((string) $value, ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8');
$name = trim((string) ($data['name'] ?? '')) ?: 'Customer';
$url = (string) ($data['reset_url'] ?? '');
$minutes = max(1, (int) ($data['expires_minutes'] ?? 30));
$html = '<div style="font-family:Arial,sans-serif;max-width:560px;margin:auto;color:#222">'
    . '<h2>Reset your Catering CRM password</h2><p>Hi ' . $escape($name) . ',</p>'
    . '<p>We received a request to reset your password. This link expires in ' . $minutes . ' minutes.</p>'
    . '<p><a href="' . $escape($url) . '" style="background:#d97706;color:#fff;padding:10px 20px;border-radius:20px;text-decoration:none">Reset Password</a></p>'
    . '<p>Or copy this link into your browser:<br>' . $escape($url) . '</p>'
    . '<p>If you did not request this, you can safely ignore this email.</p></div>';
$text = "Hi {$name},\n\nReset your password using this link (expires in {$minutes} minutes):\n{$url}\n\nIf you did not request this, ignore this email.";
return ['html' => $html, 'text' => $text];
