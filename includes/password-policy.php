<?php
declare(strict_types=1);

function passwordPolicyError(string $password): ?string
{
    if (!mb_check_encoding($password, "UTF-8")) {
        return "Password must contain valid text.";
    }
    if (mb_strlen($password, "UTF-8") < 12) {
        return "Password must be at least 12 characters.";
    }
    if (strlen($password) > 72) {
        return "Password must be no more than 72 bytes.";
    }
    if (strpos($password, "\0") !== false) {
        return "Password cannot contain a null character.";
    }
    if (!preg_match('/[A-Z]/', $password)) {
        return "Password must include at least one uppercase letter (A-Z).";
    }
    if (!preg_match('/[a-z]/', $password)) {
        return "Password must include at least one lowercase letter (a-z).";
    }
    if (!preg_match('/[0-9]/', $password)) {
        return "Password must include at least one number (0-9).";
    }
    if (!preg_match('/[^A-Za-z0-9\s]/', $password)) {
        return "Password must include at least one special character.";
    }

    $normalized = strtolower(preg_replace(
        '/[^A-Za-z0-9]/',
        '',
        strtr($password, ["@" => "a", "$" => "s"])
    ) ?? "");
    $leetNormalized = strtr($normalized, ["0" => "o", "1" => "i", "3" => "e", "5" => "s", "7" => "t"]);
    $commonPasswords = [
        "password", "password1", "password12", "password123", "passw0rd",
        "passw0rd1", "passw0rd123", "qwerty", "qwerty123", "123456",
        "123456789", "1234567890", "111111", "000000", "abc123",
        "letmein", "welcome", "welcome1", "admin", "admin123", "iloveyou",
        "sunshine", "monkey", "dragon", "football", "master", "changeme",
        "trustno1", "secret", "login", "princess", "baseball", "asdfghjkl",
        "zxcvbnm", "access", "freedom", "hello", "whatever", "starwars",
    ];
    if (in_array($normalized, $commonPasswords, true) || in_array($leetNormalized, $commonPasswords, true)) {
        return "Choose a password that is not commonly used.";
    }

    return null;
}
