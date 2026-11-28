<?php

require_once __DIR__ . '/environment.php';

/*
 * Establishes the MySQL database connection using PHP MySQLi.
 */

mysqli_report(MYSQLI_REPORT_ERROR | MYSQLI_REPORT_STRICT);

require_once __DIR__ . "/AppDatabase.php";

$configFile = dirname(__DIR__) . "/config.local.php";

if (!is_file($configFile)) {
    error_log("Database configuration file is missing.");
    http_response_code(500);
    exit("Application configuration error.");
}

$config = require $configFile;

if (strtolower((string) ($config["username"] ?? "")) === "root") {
    error_log("The CRM database account must be a dedicated non-root user.");
    http_response_code(500);
    exit("Database configuration must use the dedicated CRM database account.");
}

try {
    $conn = new mysqli(
        $config["host"],
        $config["username"],
        $config["password"],
        $config["database"]
    );

    $conn->set_charset("utf8mb4");
    $db = new AppDatabase($conn);

} catch (mysqli_sql_exception $e) {
    error_log("Database connection failed: " . $e->getMessage());
    http_response_code(500);
    exit("A database connection error occurred.");
}
