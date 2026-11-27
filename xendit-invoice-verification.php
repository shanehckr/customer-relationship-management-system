<?php
/** Read-only Xendit invoice lookups shared by the CLI deadline service and xendit-api.php. */

function xenditInvoiceRead(string $path): array
{
    $configFile = __DIR__ . '/config.local.php';
    if (!is_file($configFile) || !function_exists('curl_init')) return ['ok' => false, 'code' => 0, 'data' => []];
    try { $config = require $configFile; } catch (Throwable $e) { return ['ok' => false, 'code' => 0, 'data' => []]; }
    $secret = trim((string)($config['xendit_secret_key'] ?? ''));
    unset($config);
    if ($secret === '' || str_contains($secret, 'PASTE_YOUR')) return ['ok' => false, 'code' => 0, 'data' => []];

    $ch = curl_init('https://api.xendit.co' . $path);
    curl_setopt_array($ch, [
        CURLOPT_CUSTOMREQUEST => 'GET',
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_CONNECTTIMEOUT => 4,
        CURLOPT_TIMEOUT => 8,
        CURLOPT_USERPWD => $secret . ':',
        CURLOPT_HTTPHEADER => ['Accept: application/json'],
    ]);
    $response = curl_exec($ch);
    if ($response === false) { curl_close($ch); return ['ok' => false, 'code' => 0, 'data' => []]; }
    $code = (int)curl_getinfo($ch, CURLINFO_HTTP_CODE);
    curl_close($ch);
    $data = json_decode($response, true);
    return ['ok' => $code >= 200 && $code < 300 && is_array($data), 'code' => $code, 'data' => is_array($data) ? $data : []];
}

/** Returns paid, unpaid_terminal, pending, not_found, or unknown; only Xendit's response can establish a terminal state. */
function xenditInvoiceOutcome(string $status): string
{
    $status = strtoupper(trim($status));
    if (in_array($status, ['PAID', 'SETTLED'], true)) return 'paid';
    if (in_array($status, ['EXPIRED', 'FAILED', 'CANCELED', 'CANCELLED', 'VOIDED'], true)) return 'unpaid_terminal';
    if ($status === 'PENDING') return 'pending';
    return 'unknown';
}

/**
 * Verifies by invoice ID, or recovers legacy rows using the generated external-ID prefix.
 * A missing invoice is considered terminal only after the complete matching invoice list was read successfully.
 */
function xenditResolvePaymentInvoice(array $row): array
{
    $invoiceId = trim((string)($row['invoice_id'] ?? ''));
    if ($invoiceId !== '') {
        $response = xenditInvoiceRead('/v2/invoices/' . rawurlencode($invoiceId));
        if (!$response['ok']) return ['outcome' => 'unknown', 'invoice_id' => $invoiceId, 'status' => ''];
        $status = strtoupper((string)($response['data']['status'] ?? ''));
        return ['outcome' => xenditInvoiceOutcome($status), 'invoice_id' => $invoiceId, 'status' => $status];
    }

    $inquiryId = (int)($row['inquiry_id'] ?? 0);
    $rowId = (int)($row['id'] ?? 0);
    if ($inquiryId <= 0 || $rowId <= 0 || empty($row['created_at']) || !function_exists('quoteRef')) return ['outcome' => 'unknown', 'invoice_id' => '', 'status' => ''];
    $prefix = quoteRef($inquiryId) . '-' . $rowId . '-';
    $created = new DateTimeImmutable((string)$row['created_at'], new DateTimeZone('Asia/Manila'));
    $createdAfter = $created->modify('-1 day')->setTimezone(new DateTimeZone('UTC'))->format('Y-m-d\TH:i:s\Z');
    $cursor = '';
    $matches = [];
    $complete = false;

    // Bound each run. If there are many pages, defer and retry instead of treating an incomplete search as no invoice.
    for ($page = 0; $page < 20; $page++) {
        $query = ['created_after' => $createdAfter, 'limit' => 100];
        if ($cursor !== '') $query['last_invoice'] = $cursor;
        $response = xenditInvoiceRead('/v2/invoices?' . http_build_query($query));
        if (!$response['ok']) return ['outcome' => 'unknown', 'invoice_id' => '', 'status' => ''];
        $invoices = $response['data'];
        if (isset($invoices['data']) && is_array($invoices['data'])) $invoices = $invoices['data'];
        if (!array_is_list($invoices)) return ['outcome' => 'unknown', 'invoice_id' => '', 'status' => ''];
        foreach ($invoices as $invoice) {
            if (is_array($invoice) && str_starts_with((string)($invoice['external_id'] ?? ''), $prefix)) $matches[] = $invoice;
        }
        if (count($invoices) < 100) { $complete = true; break; }
        $next = trim((string)($invoices[count($invoices) - 1]['id'] ?? ''));
        if ($next === '' || $next === $cursor) return ['outcome' => 'unknown', 'invoice_id' => '', 'status' => ''];
        $cursor = $next;
    }
    if (!$complete) return ['outcome' => 'unknown', 'invoice_id' => '', 'status' => ''];
    if (!$matches) return ['outcome' => 'not_found', 'invoice_id' => '', 'status' => ''];
    if (count($matches) !== 1) return ['outcome' => 'unknown', 'invoice_id' => '', 'status' => ''];
    $invoice = $matches[0];
    $status = strtoupper((string)($invoice['status'] ?? ''));
    return ['outcome' => xenditInvoiceOutcome($status), 'invoice_id' => (string)($invoice['id'] ?? ''), 'status' => $status];
}
