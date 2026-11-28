<?php
declare(strict_types=1);

header('Cache-Control: no-store, private');
header('Pragma: no-cache');
header('Expires: 0');
header('X-Content-Type-Options: nosniff');

require_once __DIR__ . '/session-init.php';
require_once __DIR__ . '/includes/auth.php';

requireLogin();

// Session roles are server-side, but can become stale if an account is disabled or reassigned.
// Confirm the current account state and role in the database before resolving any template.
require_once __DIR__ . '/config/database.php';
try {
    $identity = $db->prepare('SELECT u.account_status, u.role_id, r.role_name
                              FROM users u JOIN roles r ON r.role_id = u.role_id
                              WHERE u.user_id = ? LIMIT 1');
    $identity->execute([(int)$_SESSION['user_id']]);
    $account = $identity->fetch();
} catch (Throwable $e) {
    error_log('page-content: account authorization lookup failed: ' . $e->getMessage());
    http_response_code(503);
    exit('Unable to verify page permissions.');
}

if (!$account || (string)$account['account_status'] !== 'Active') {
    http_response_code(401);
    exit('Please log in again.');
}

$databaseRole = strtolower(trim((string)$account['role_name']));
$sessionRole = strtolower(trim((string)$_SESSION['role_name']));
if ((int)$account['role_id'] !== (int)$_SESSION['role_id'] || !hash_equals($databaseRole, $sessionRole)) {
    http_response_code(403);
    exit('Your account permissions have changed. Please log in again.');
}

$pageRoles = [
    'admin-dashboard.html' => ['admin'],
    'admin-manager-sales-calendar.html' => ['admin', 'manager', 'sales staff'],
    'cs-dashboard.html' => ['customer service staff'],
    'cs-inbox.html' => ['customer service staff'],
    'cs-report.html' => ['customer service staff'],
    'cs-ticket.html' => ['customer service staff'],
    'customer-bookings.html' => ['customer'],
    'customer-home.html' => ['customer'],
    'customer-inbox.html' => ['customer'],
    'customer-inquiries.html' => ['customer'],
    'customer-settings.html' => ['customer'],
    'manager-admin-bookings.html' => ['admin', 'manager'],
    'manager-admin-customers.html' => ['admin', 'manager'],
    'manager-admin-inbox.html' => ['admin', 'manager'],
    'manager-admin-inquiries.html' => ['admin', 'manager'],
    'manager-admin-menu-management.html' => ['admin', 'manager'],
    'manager-admin-report.html' => ['admin', 'manager'],
    'manager-admin-ticket.html' => ['admin', 'manager'],
    'manager-dashboard.html' => ['manager'],
    'sales-available.html' => ['sales staff'],
    'sales-bookings.html' => ['sales staff'],
    'sales-dashboard.html' => ['sales staff'],
    'sales-inbox.html' => ['sales staff'],
    'sales-inquiries.html' => ['sales staff'],
    'sales-report.html' => ['sales staff'],
    'settings-pages.html' => ['admin', 'manager'],
];

$page = $_GET['page'] ?? null;
if (!is_string($page) || !array_key_exists($page, $pageRoles)) {
    http_response_code(404);
    exit('Page not found.');
}

requireRole($pageRoles[$page]);

$filePath = __DIR__ . '/html-content-navbar/' . $page;
if (!is_file($filePath) || !is_readable($filePath)) {
    http_response_code(404);
    exit('Page not found.');
}

header('Content-Type: text/html; charset=utf-8');
readfile($filePath);
