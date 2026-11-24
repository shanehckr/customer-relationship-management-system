<?php
declare(strict_types=1);

$message = "This is a test email confirming that the Espinosilla's Kainan CRM email notification system is working.";
$html = '<div style="font-family:Arial,sans-serif;color:#222"><h2>CRM email test</h2><p>'
    . htmlspecialchars($message, ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8') . '</p></div>';
return ['html' => $html, 'text' => $message];
