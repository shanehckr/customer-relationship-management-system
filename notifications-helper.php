<?php
/**
 * notifications-helper.php  -  shared by every API that creates notifications
 *
 * Put it in the SAME folder as the other *-api.php files, then in an API do:
 *     require_once __DIR__ . '/notifications-helper.php';
 *     notifySend($db, [ ... ]);          // $db = PDO or mysqli, both work
 *
 * One row per person per notification (table `notifications`, created automatically),
 * so every account only ever sees, and marks as read, its OWN notifications.
 * Admin and Manager accounts are ALWAYS added to the recipients, so they see every notification.
 *
 * notifySend() never throws: a notification problem must not break the action that caused it.
 *
 * $n = [
 *   'type'            => 'ticket',                 // lead | deal | ticket | activity | customer  (picks the icon)
 *   'title'           => 'New support ticket',
 *   'message'         => 'Maria submitted TCK-0007',
 *   'page'            => 'manager-admin-ticket.html', // page opened when the notification is clicked
 *   'kind'            => 'inquiry',                // OR let the helper pick the right page per role: inquiry | available | booking | message
 *   'include_admins'  => false,                    // optional: do NOT add Admin / Manager for this call
 *   'customer'        => ['title' => '...', 'message' => '...'],   // wording for the customer
 *   'ref'             => 'TCK-0007',               // optional: record reference (opens that ticket)
 *   'user_ids'        => [12],                     // specific accounts (e.g. the customer)
 *   'roles'           => ['Customer Service Staff'], // every active account of these roles
 *   'exclude_user_id' => 5,                        // the person who did it (they are not notified)
 *   'by_role'         => ['Customer' => ['title' => '...', 'message' => '...', 'page' => 'customer-inbox.html']],
 * ]                                                // by_role = different wording / page for one role
 */

function nfRows($db, string $sql, array $params = []): array
{
    if ($db instanceof PDO) {
        $st = $db->prepare($sql);
        $st->execute($params);
        return $st->fetchAll(PDO::FETCH_ASSOC);
    }
    $st = $db->prepare($sql);
    if ($params) {
        $st->bind_param(str_repeat('s', count($params)), ...$params);
    }
    $st->execute();
    $res = $st->get_result();
    $rows = $res ? $res->fetch_all(MYSQLI_ASSOC) : [];
    $st->close();
    return $rows;
}

function nfRun($db, string $sql, array $params = []): void
{
    if ($db instanceof PDO) {
        $db->prepare($sql)->execute($params);
        return;
    }
    $st = $db->prepare($sql);
    if ($params) {
        $st->bind_param(str_repeat('s', count($params)), ...$params);
    }
    $st->execute();
    $st->close();
}

function nfEnsureTable($db): void
{
    static $done = false;
    if ($done) {
        return;
    }
    $sql = "CREATE TABLE IF NOT EXISTS notifications (
        id INT AUTO_INCREMENT PRIMARY KEY,
        user_id INT NOT NULL,
        type VARCHAR(20) NOT NULL DEFAULT 'ticket',
        title VARCHAR(120) NOT NULL,
        message VARCHAR(255) NOT NULL DEFAULT '',
        page VARCHAR(80) NOT NULL DEFAULT '',
        ref VARCHAR(60) NOT NULL DEFAULT '',
        is_read TINYINT(1) NOT NULL DEFAULT 0,
        created_at DATETIME NOT NULL,
        INDEX idx_user_read (user_id, is_read, created_at)
    ) ENGINE=InnoDB";
    if ($db instanceof PDO) {
        $db->exec($sql);
    } else {
        $db->query($sql);
    }
    $done = true;
}

function nfUserName($db, int $userId, string $fallback = 'A customer'): string
{
    try {
        $rows = nfRows($db, 'SELECT full_name FROM users WHERE user_id = ? LIMIT 1', [$userId]);
        $name = trim((string) ($rows[0]['full_name'] ?? ''));
        return $name !== '' ? $name : $fallback;
    } catch (Throwable $e) {
        return $fallback;
    }
}

/** Page a notification opens, by kind of record and the role of the person who gets it. */
function nfPageFor(string $kind, string $role): string
{
    $map = [
        'inquiry' => ['Admin' => 'manager-admin-inquiries.html', 'Manager' => 'manager-admin-inquiries.html',
                      'Sales Staff' => 'sales-inquiries.html', 'Customer' => 'customer-inquiries.html'],
        // an UNASSIGNED inquiry: Sales Staff find it in Available Inquiries, Admin / Manager in the all-inquiries page
        'available' => ['Admin' => 'manager-admin-inquiries.html', 'Manager' => 'manager-admin-inquiries.html',
                        'Sales Staff' => 'sales-available.html'],
        'booking' => ['Admin' => 'manager-admin-bookings.html', 'Manager' => 'manager-admin-bookings.html',
                      'Sales Staff' => 'sales-bookings.html', 'Customer' => 'customer-bookings.html'],
        'message' => ['Admin' => 'inbox', 'Manager' => 'inbox', 'Sales Staff' => 'inbox',
                      'Customer Service Staff' => 'inbox', 'Customer' => 'customer-inbox.html'],
    ];
    return $map[$kind][$role] ?? '';
}

function notifySend($db, array $n): void
{
    try {
        nfEnsureTable($db);
        // 'customer' => [title, message] is shorthand for different wording for the Customer role.
        if (isset($n['customer'])) {
            $n['by_role']['Customer'] = ($n['by_role']['Customer'] ?? []) + $n['customer'];
        }

        $ids = array_map('intval', $n['user_ids'] ?? []);
        $roles = $n['roles'] ?? [];
        if (($n['include_admins'] ?? true) !== false) {      // Admin and Manager see everything, unless a call says otherwise
            $roles = array_merge($roles, ['Admin', 'Manager']);
        }
        $roles = array_values(array_unique($roles));
        if ($roles) {
            $marks = implode(',', array_fill(0, count($roles), '?'));
            foreach (nfRows(
                $db,
                "SELECT u.user_id FROM users u INNER JOIN roles r ON r.role_id = u.role_id
                 WHERE u.status = 'Active' AND r.role_name IN ($marks)",
                $roles
            ) as $row) {
                $ids[] = (int) $row['user_id'];
            }
        }
        $ids = array_values(array_unique(array_filter($ids, fn($i) => $i > 0)));
        if (!empty($n['exclude_user_id'])) {
            $ids = array_values(array_diff($ids, [(int) $n['exclude_user_id']]));
        }
        if (!$ids) {
            return;
        }

        $roleOf = [];
        foreach (nfRows(
            $db,
            "SELECT u.user_id, r.role_name FROM users u INNER JOIN roles r ON r.role_id = u.role_id
             WHERE u.user_id IN (" . implode(',', $ids) . ")"
        ) as $row) {
            $roleOf[(int) $row['user_id']] = $row['role_name'];
        }

        $now = date('Y-m-d H:i:s');
        foreach ($ids as $id) {
            if (!isset($roleOf[$id])) {
                continue;   // account no longer exists
            }
            $o = ($n['by_role'][$roleOf[$id]] ?? []) + $n;   // role-specific wording wins
            $page = (string) ($o['page'] ?? '');
            if ($page === '' && !empty($n['kind'])) {
                $page = nfPageFor((string) $n['kind'], $roleOf[$id]);   // 'kind' => 'inquiry' | 'booking'
            }
            nfRun(
                $db,
                "INSERT INTO notifications (user_id, type, title, message, page, ref, is_read, created_at)
                 VALUES (?,?,?,?,?,?,0,?)",
                [
                    $id,
                    (string) ($o['type'] ?? 'ticket'),
                    mb_substr((string) ($o['title'] ?? 'New notification'), 0, 120),
                    mb_substr((string) ($o['message'] ?? ''), 0, 250),
                    mb_substr($page, 0, 80),
                    mb_substr((string) ($o['ref'] ?? ''), 0, 60),
                    $now,
                ]
            );
        }
    } catch (Throwable $e) {
        error_log('notifySend failed: ' . $e->getMessage());
    }
}

/** Ticket reference as shown in the CRM: TCK-0007. */
function nfTicketRef(array $ticket): string
{
    $ref = (string) ($ticket['ticket_number'] ?? '');
    return $ref !== '' ? $ref : 'TCK-' . str_pad((string) ($ticket['id'] ?? 0), 4, '0', STR_PAD_LEFT);
}

/** Something the CUSTOMER did on a ticket -> Customer Service Staff + Admin + Manager. */
function notifyTicketStaff($db, array $ticket, int $customerId, string $title, string $verb): void
{
    $ref = nfTicketRef($ticket);
    notifySend($db, [
        'type' => 'ticket',
        'title' => $title,
        'message' => nfUserName($db, $customerId) . ' ' . $verb . ' ' . $ref . ': ' . ($ticket['subject'] ?? ''),
        'page' => 'manager-admin-ticket.html',
        'ref' => $ref,
        'roles' => ['Customer Service Staff'],
        'exclude_user_id' => $customerId,
    ]);
}


/** First chat message when a Sales Staff takes an inquiry (used by sales-available.php and manager-admin-inquiries.php). */
function nfWelcomeMessage(string $event, string $staffName): string
{
    $event = trim($event) !== '' ? trim($event) : 'your event';
    return 'Hi! Thank you for your inquiry for **' . $event . '**. I\'m ' . $staffName
         . ' from our catering team and I\'ll be helping you with it. Feel free to message me here if you have any questions.';
}