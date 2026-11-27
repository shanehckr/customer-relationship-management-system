<?php
declare(strict_types=1);

$message = "This is a test email confirming that the Espinosilla's Kainan CRM email notification system is working.";
$html = '<div style="margin:0;padding:24px 12px;background:#f3f5f4;font-family:Arial,Helvetica,sans-serif;color:#202724">'
    . '<div style="max-width:560px;margin:0 auto;background:#ffffff;border:1px solid #edf0ee;border-radius:6px">'
    . '<div style="padding:20px 28px 12px;text-align:center;font-size:13px;font-weight:700;color:#156042">Espinosilla\'s Kainan</div>'
    . '<div style="padding:8px 28px 24px;text-align:center">'
    . '<h1 style="margin:8px 0 14px;font-size:22px;line-height:1.3;color:#202724">CRM email test</h1>'
    . '<p style="margin:0;font-size:15px;line-height:1.6">' . htmlspecialchars($message, ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8') . '</p>'
    . '</div><div style="padding:14px 28px;border-top:1px solid #edf0ee;text-align:center;color:#7a837f;font-size:12px">Espinosilla\'s Kainan Catering CRM</div>'
    . '</div></div>';
return ['html' => $html, 'text' => $message];
