<?php
/**
 * cron-booking-deadlines.php - sends the payment reminders and applies the deadlines (see booking-deadlines.php).
 * Run it EVERY 10 MINUTES from the command line (Windows Task Scheduler on XAMPP: Trigger > Repeat task every 10 minutes, for a duration of Indefinitely).
 * It does not send a message every 10 minutes: it only checks the clock, so the 8:00 AM reminder goes out around 8:00 AM, the last call on time,
 * and an unpaid deposit / balance is closed or cancelled right at its deadline. Each reminder is sent once.
 *   Program:   C:\xampp\php\php.exe
 *   Arguments: C:\xampp\htdocs\customer-relationship-management-system\cron-booking-deadlines.php
 * Put it in the SAME folder as inquiry-common.php.
 */
if (PHP_SAPI !== 'cli') { http_response_code(403); exit('Run this file from the command line.'); }
define('SESSION_API', true);
require __DIR__ . '/inquiry-common.php';
require_once __DIR__ . '/booking-deadlines.php';
$result = runBookingDeadlines($db, $DB_CRM ?? '');
fwrite(STDERR, date('Y-m-d H:i:s') . ' ' . json_encode($result) . PHP_EOL);