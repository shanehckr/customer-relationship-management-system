<?php
declare(strict_types=1);

require_once __DIR__ . '/environment.php';

/** Runtime mail settings. SMTP credentials are loaded only from the protected file outside htdocs. */
$env = static function (string $key, string $default = ''): string {
    $value = getenv($key);
    return $value === false ? $default : trim((string) $value);
};

$identities = [
    'crm_notifications' => [
        'email' => $env('CRM_MAIL_CRM_FROM_EMAIL', ''),
        'name' => $env('CRM_MAIL_CRM_FROM_NAME', ''),
        'username' => $env('CRM_MAIL_CRM_USERNAME', ''),
        'password' => '',
    ],
    'customer_service' => [
        'email' => $env('CRM_MAIL_CS_FROM_EMAIL', ''),
        'name' => $env('CRM_MAIL_CS_FROM_NAME', ''),
        'username' => $env('CRM_MAIL_CS_USERNAME', ''),
        'password' => '',
    ],
    'john' => [
        'email' => $env('CRM_MAIL_JOHN_FROM_EMAIL', ''),
        'name' => $env('CRM_MAIL_JOHN_FROM_NAME', ''),
        'username' => $env('CRM_MAIL_JOHN_USERNAME', ''),
        'password' => '',
    ],
    'lara' => [
        'email' => $env('CRM_MAIL_LARA_FROM_EMAIL', ''),
        'name' => $env('CRM_MAIL_LARA_FROM_NAME', ''),
        'username' => $env('CRM_MAIL_LARA_USERNAME', ''),
        'password' => '',
    ],
];

$defaultProtectedPath = PHP_OS_FAMILY === 'Windows'
    ? 'C:/xampp/crm-secrets/mail-config.php'
    : dirname(__DIR__, 2) . '/../crm-secrets/mail-config.php';
$configuredProtectedPath = $env('CRM_MAIL_CONFIG_PATH', '');
$protectedPath = $configuredProtectedPath !== '' ? $configuredProtectedPath : $defaultProtectedPath;

if (is_file($protectedPath)) {
    $realProtectedPath = realpath($protectedPath);
    $documentRoot = isset($_SERVER['DOCUMENT_ROOT']) ? realpath((string) $_SERVER['DOCUMENT_ROOT']) : false;
    $insideDocumentRoot = $realProtectedPath !== false
        && $documentRoot !== false
        && str_starts_with(
            strtolower($realProtectedPath . DIRECTORY_SEPARATOR),
            strtolower(rtrim($documentRoot, DIRECTORY_SEPARATOR) . DIRECTORY_SEPARATOR)
        );

    if ($realProtectedPath === false || $insideDocumentRoot) {
        error_log('Protected mail configuration is unavailable or located outside the permitted area.');
    } else {
        try {
            $protected = require $realProtectedPath;
            $smtpValid = is_array($protected)
                && ($protected['smtp']['host'] ?? null) === 'smtp.gmail.com'
                && (int) ($protected['smtp']['port'] ?? 0) === 587
                && strtoupper((string) ($protected['smtp']['encryption'] ?? '')) === 'STARTTLS'
                && ($protected['smtp']['authentication'] ?? null) === true;

            if (!$smtpValid) {
                error_log('Protected mail SMTP configuration is invalid.');
            } else {
                foreach ($identities as $key => &$identity) {
                    $credential = is_array($protected['identities'] ?? null)
                        ? ($protected['identities'][$key] ?? null)
                        : null;
                    if (!is_array($credential)
                        || !is_string($credential['email'] ?? null)
                        || !filter_var(trim((string) $credential['email']), FILTER_VALIDATE_EMAIL)
                        || !is_string($credential['username'] ?? null)
                        || strcasecmp(trim((string) $credential['username']), trim((string) $credential['email'])) !== 0
                        || !is_string($credential['password'] ?? null)) {
                        continue;
                    }

                    $identity['email'] = trim((string) $credential['email']);
                    $identity['username'] = trim((string) $credential['username']);
                    $identity['password'] = trim((string) $credential['password']);
                    if (isset($credential['from_name']) && is_string($credential['from_name']) && trim($credential['from_name']) !== '') {
                        $identity['name'] = trim($credential['from_name']);
                    }
                }
                unset($identity);
            }
        } catch (Throwable $e) {
            error_log('Protected mail configuration could not be loaded.');
        }
    }
}
foreach ($identities as &$identity) {
    $identity['available'] = filter_var((string) ($identity['email'] ?? ''), FILTER_VALIDATE_EMAIL) !== false
        && trim((string) ($identity['username'] ?? '')) !== ''
        && trim((string) ($identity['password'] ?? '')) !== '';
}
unset($identity);

$encodedQueueKey = $env('CRM_MAIL_QUEUE_KEY');
$queueKey = $encodedQueueKey !== '' ? base64_decode($encodedQueueKey, true) : false;

return [
    'host' => 'smtp.gmail.com',
    'port' => 587,
    'encryption' => 'STARTTLS',
    'smtp_auth' => true,
    'protected_config_path' => $protectedPath,
    'timeout' => 20,
    // Initial operation requires only the primary CRM Notifications SMTP account.
    'enabled' => filter_var($env('CRM_MAIL_ENABLED', '0'), FILTER_VALIDATE_BOOLEAN)
        && ($identities['crm_notifications']['available'] ?? false),
    'identities' => $identities,
    'queue_encryption_key' => is_string($queueKey) && strlen($queueKey) === 32 ? $queueKey : null,
    'max_attempts' => 5,
    'retry_base_seconds' => 30,
    'retry_max_seconds' => 3600,
    'claim_seconds' => 300,
    'batch_limit' => 25,
    'base_url' => crmApplicationBaseUrl(),
    'token_minutes' => 30,
];
