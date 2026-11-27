<?php
declare(strict_types=1);

final class EmailTemplateRenderer
{
    private const TEMPLATE_FILES = [
        'password_reset' => 'password-reset.php',
        'payment_received' => 'payment-received.php',
        'notification' => 'notification.php',
        'system_test' => 'system-test.php',
        'email_verification' => 'email-verification.php',
    ];

    /** @return array{html:string,text:string} */
    public function render(string $templateKey, array $data): array
    {
        $file = self::TEMPLATE_FILES[$templateKey] ?? null;
        if ($file === null) {
            throw new InvalidArgumentException('Unknown email template.');
        }
        $path = __DIR__ . '/Templates/' . $file;
        $render = static function (string $__path, array $data): array {
            return require $__path;
        };
        $result = $render($path, $data);
        if (!is_array($result) || !isset($result['html'], $result['text'])) {
            throw new RuntimeException('Email template did not return HTML and plain text.');
        }
        return ['html' => (string) $result['html'], 'text' => (string) $result['text']];
    }
}
