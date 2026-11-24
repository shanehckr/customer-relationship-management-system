<?php
declare(strict_types=1);

if (!function_exists('crmLoadEnvironment')) {
    /**
     * Load project environment variables without overriding values supplied by the server.
     */
    function crmLoadEnvironment(string $projectRoot): void
    {
    $envFile = rtrim($projectRoot, DIRECTORY_SEPARATOR) . DIRECTORY_SEPARATOR . '.env';
    if (!is_file($envFile) || !is_readable($envFile)) {
        return;
    }

    $lines = file($envFile, FILE_IGNORE_NEW_LINES);
    if ($lines === false) {
        return;
    }

    foreach ($lines as $rawLine) {
        $line = ltrim($rawLine);
        if ($line === '' || str_starts_with($line, '#')) continue;
        if (str_starts_with($line, 'export ')) {
            $line = ltrim(substr($line, 7));
        }

        $separator = strpos($line, '=');
        if ($separator === false) continue;

        $key = trim(substr($line, 0, $separator));
        if (!preg_match('/^[A-Za-z_][A-Za-z0-9_]*$/', $key)) continue;

        $value = trim(substr($line, $separator + 1));
        if ($value !== '' && ($value[0] === '"' || $value[0] === "'")) {
            $quote = $value[0];
            $closing = 1;
            while ($closing < strlen($value)) {
                if ($value[$closing] === $quote
                    && ($quote === "'" || $closing === 1 || $value[$closing - 1] !== '\\')) {
                    break;
                }
                $closing++;
            }
            if ($closing < strlen($value)) {
                $value = substr($value, 1, $closing - 1);
                if ($quote === '"') {
                    $value = str_replace(
                        ['\\n', '\\r', '\\t', '\\\"', '\\\\'],
                        ["\n", "\r", "\t", '"', '\\'],
                        $value
                    );
                }
            } else {
                $value = substr($value, 1);
            }
        } else {
            if (preg_match('/\s+#/', $value, $match, PREG_OFFSET_CAPTURE)) {
                $value = rtrim(substr($value, 0, (int) $match[0][1]));
            }
        }

        $providedByProcess = getenv($key) !== false
            || array_key_exists($key, $_ENV)
            || array_key_exists($key, $_SERVER);
        if ($providedByProcess) {
            if (getenv($key) === false) {
                $existing = array_key_exists($key, $_ENV)
                    ? $_ENV[$key]
                    : ($_SERVER[$key] ?? null);
                if (is_scalar($existing)) {
                    putenv($key . '=' . (string) $existing);
                }
            }
            continue;
        }

        putenv($key . '=' . $value);
        $_ENV[$key] = $value;
        $_SERVER[$key] = $value;
    }
    }
}

crmLoadEnvironment(dirname(__DIR__));
