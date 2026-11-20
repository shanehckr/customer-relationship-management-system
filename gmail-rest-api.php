<?php
/**
 * mailer.php - sends the "payment received" email through the GMAIL API (no PHPMailer, no extra library).
 * Put it in the SAME folder as xendit-api.php. xendit-api.php does not need any change.
 *
 * SETUP (one time):
 *   1. Google Cloud Console > your project > APIs & Services > Library > enable "Gmail API".
 *   2. OAuth consent screen: add the sending Gmail account as a Test user (while the app is in Testing mode).
 *   3. Credentials > Create credentials > OAuth client ID (type: Web application).
 *      Add this Authorized redirect URI: https://developers.google.com/oauthplayground
 *      Copy the Client ID and Client secret into the settings below.
 *   4. Get the refresh token: open https://developers.google.com/oauthplayground
 *        - click the gear icon > tick "Use your own OAuth credentials" > paste your Client ID and secret
 *        - in Step 1 type this scope:  https://www.googleapis.com/auth/gmail.send   > Authorize APIs
 *          (sign in with the Gmail account that will send the emails)
 *        - Step 2 > "Exchange authorization code for tokens" > copy the Refresh token into GMAIL_REFRESH_TOKEN.
 *      Note: in Testing mode Google expires the refresh token after 7 days. Publish the app (In production)
 *      on the OAuth consent screen to get a token that does not expire.
 *
 * If your project already has its own Gmail API token/sending code, keep sendPaymentEmail($d) below and
 * replace only the body of gmailAccessToken() / the send part with your existing code.
 *
 * SSL error on XAMPP/Windows ("SSL certificate problem"): set curl.cainfo in php.ini to a cacert.pem file.
 */

/* ------------------------- SETTINGS (edit these) ------------------------- */
define('GMAIL_CLIENT_ID',     'gmail_client_id');
define('GMAIL_CLIENT_SECRET', 'gmail_client_secret');
define('GMAIL_REFRESH_TOKEN', 'gmail_refresh_token');
define('MAIL_FROM',           'mail_from');    // the Gmail account that authorized the refresh token
define('MAIL_FROM_NAME',      'Your Catering Company');
define('MAIL_REPLY_TO',       'mail_reply_to');
define('MAIL_ENABLED',        false);                        // set false to switch emails off while testing

function mailPeso(float $n): string {
    return 'PHP ' . number_format($n, 2);
}

function gmailHttp(string $url, array $opts): array {
    $ch = curl_init($url);
    curl_setopt_array($ch, $opts + [CURLOPT_RETURNTRANSFER => true, CURLOPT_TIMEOUT => 20]);
    $res = curl_exec($ch);
    if ($res === false) { $err = curl_error($ch); curl_close($ch); throw new RuntimeException('Gmail request failed: ' . $err); }
    $code = (int)curl_getinfo($ch, CURLINFO_HTTP_CODE);
    curl_close($ch);
    return [$code, json_decode($res, true) ?: []];
}

/** Trades the refresh token for a short-lived access token. */
function gmailAccessToken(): string {
    [$code, $j] = gmailHttp('https://oauth2.googleapis.com/token', [
        CURLOPT_POST       => true,
        CURLOPT_POSTFIELDS => http_build_query([
            'client_id'     => GMAIL_CLIENT_ID,
            'client_secret' => GMAIL_CLIENT_SECRET,
            'refresh_token' => GMAIL_REFRESH_TOKEN,
            'grant_type'    => 'refresh_token',
        ]),
    ]);
    if ($code !== 200 || empty($j['access_token'])) {
        throw new RuntimeException('Gmail token error (HTTP ' . $code . '): ' . ($j['error_description'] ?? $j['error'] ?? 'unknown'));
    }
    return $j['access_token'];
}

function mimeHeader(string $s): string {
    return '=?UTF-8?B?' . base64_encode($s) . '?=';
}

/**
 * Sends the payment confirmation to the customer.
 * $d keys: to_email, to_name, booking_ref, event_name, event_date, location, paid, total, balance, method, reference
 *   optional 'type' => 'balance' for a "Request Full Payment" payment (the remaining balance): the wording then says
 *   "fully paid" / "remaining balance" instead of "deposit received, booking confirmed".
 * Throws on failure (xendit-api.php catches it and logs it, so the payment is never affected).
 */
function sendPaymentEmail(array $d): void {
    if (!MAIL_ENABLED) return;
    if (strpos(GMAIL_REFRESH_TOKEN, 'PASTE_') !== false || strpos(GMAIL_CLIENT_ID, 'PASTE_') !== false) {
        throw new RuntimeException('Email is not set up yet: fill in the GMAIL_* settings in mailer.php.');
    }

    $h = fn($v) => htmlspecialchars((string)$v, ENT_QUOTES, 'UTF-8');
    $name = trim((string)$d['to_name']) !== '' ? $d['to_name'] : 'Customer';
    $date = $d['event_date'] ? date('F j, Y', strtotime($d['event_date'])) : '';

    // wording: first payment (deposit, booking confirmed) or a later payment of the remaining balance
    $isBalance = ($d['type'] ?? '') === 'balance';
    $fullyPaid = $isBalance && (float)$d['balance'] <= 0;
    if ($isBalance) {
        $introText = $fullyPaid
            ? 'We received your payment. Your booking is now fully paid.'
            : 'We received your payment. Your remaining balance is ' . mailPeso((float)$d['balance']) . '.';
        $introHtml = $fullyPaid
            ? 'Thank you! We received your payment and your booking is now <strong>fully paid</strong>.'
            : 'Thank you! We received your payment. Your remaining balance is <strong>' . $h(mailPeso((float)$d['balance'])) . '</strong>.';
        $subject = 'Payment received - booking ' . $d['booking_ref'] . ($fullyPaid ? ' fully paid' : '');
    } else {
        $introText = 'We received your payment. Your booking is confirmed.';
        $introHtml = 'Thank you! We received your deposit and your booking is now <strong>confirmed</strong>.';
        $subject = 'Payment received - booking ' . $d['booking_ref'] . ' confirmed';
    }

    $rows = [
        'Booking reference' => $d['booking_ref'],
        'Event'             => $d['event_name'],
        'Event date'        => $date,
        'Venue'             => $d['location'],
        'Amount paid'       => mailPeso((float)$d['paid']),
        'Payment method'    => $d['method'],
        'Payment Reference No' => $d['reference'],
        'Total'             => mailPeso((float)$d['total']),
        'Remaining balance' => mailPeso((float)$d['balance']),
    ];
    $tr = '';
    $plain = "Hi {$name},\n\n{$introText}\n\n";
    foreach ($rows as $label => $value) {
        if (trim((string)$value) === '') continue;
        $tr .= '<tr><td style="padding:8px 12px;color:#666;border-bottom:1px solid #eee;">' . $h($label)
             . '</td><td style="padding:8px 12px;font-weight:600;border-bottom:1px solid #eee;">' . $h($value) . '</td></tr>';
        $plain .= $label . ': ' . $value . "\n";
    }
    $plain .= "\nThank you for choosing " . MAIL_FROM_NAME . ".";

    $html = '<div style="font-family:Arial,sans-serif;max-width:560px;margin:auto;color:#222;">'
          . '<h2 style="color:#2e7d32;">Payment received</h2>'
          . '<p>Hi ' . $h($name) . ',</p>'
          . '<p>' . $introHtml . '</p>'
          . '<table style="width:100%;border-collapse:collapse;margin:16px 0;">' . $tr . '</table>'
          . '<p>If you have questions, just reply to this email or message us on your My Inquiries page.</p>'
          . '<p style="color:#888;font-size:12px;">' . $h(MAIL_FROM_NAME) . '</p></div>';

    // build the raw email (multipart: plain text + HTML)
    $to       = str_replace(["\r", "\n", '<', '>', '"'], '', (string)$d['to_email']);
    $toName   = str_replace(["\r", "\n", '<', '>', '"'], '', (string)$d['to_name']);
    $boundary = 'b_' . bin2hex(random_bytes(12));
    $raw  = 'From: ' . mimeHeader(MAIL_FROM_NAME) . ' <' . MAIL_FROM . ">\r\n";
    $raw .= 'To: ' . ($toName !== '' ? mimeHeader($toName) . ' ' : '') . '<' . $to . ">\r\n";
    $raw .= 'Reply-To: ' . MAIL_REPLY_TO . "\r\n";
    $raw .= 'Subject: ' . mimeHeader($subject) . "\r\n";
    $raw .= "MIME-Version: 1.0\r\n";
    $raw .= 'Content-Type: multipart/alternative; boundary="' . $boundary . "\"\r\n\r\n";
    $raw .= '--' . $boundary . "\r\nContent-Type: text/plain; charset=UTF-8\r\nContent-Transfer-Encoding: base64\r\n\r\n"
          . chunk_split(base64_encode($plain)) . "\r\n";
    $raw .= '--' . $boundary . "\r\nContent-Type: text/html; charset=UTF-8\r\nContent-Transfer-Encoding: base64\r\n\r\n"
          . chunk_split(base64_encode($html)) . "\r\n";
    $raw .= '--' . $boundary . "--\r\n";

    $payload = json_encode(['raw' => rtrim(strtr(base64_encode($raw), '+/', '-_'), '=')]);
    [$code, $j] = gmailHttp('https://gmail.googleapis.com/gmail/v1/users/me/messages/send', [
        CURLOPT_POST       => true,
        CURLOPT_POSTFIELDS => $payload,
        CURLOPT_HTTPHEADER => ['Authorization: Bearer ' . gmailAccessToken(), 'Content-Type: application/json'],
    ]);
    if ($code >= 300) {
        throw new RuntimeException('Gmail API error (HTTP ' . $code . '): ' . ($j['error']['message'] ?? 'send failed'));
    }
}