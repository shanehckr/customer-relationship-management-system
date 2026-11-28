<?php
/**
 * cron-booking-deadlines.php - sends the payment reminders and applies the deadlines (see booking-deadlines.php).
 * CLI worker. Install scripts/install-deposit-reminder-task.ps1 to schedule it every minute.
 * Put it in the SAME folder as inquiry-common.php.
 */
if (PHP_SAPI !== 'cli') { http_response_code(403); exit('Run this file from the command line.'); }
define('SESSION_API', true);
require __DIR__ . '/inquiry-common.php';
require_once __DIR__ . '/booking-deadlines.php';
try {
    $result = runBookingDeadlines($db, $DB_CRM ?? '');
    fwrite(STDOUT, date('Y-m-d H:i:s') . ' ' . json_encode($result, JSON_UNESCAPED_SLASHES) . PHP_EOL);
    exit(!empty($result['errors']) ? 1 : 0);
} catch (Throwable $e) {
    error_log('booking-deadlines CLI failed: ' . get_class($e) . ' (' . (int)$e->getCode() . ')');
    exit(1);
}
