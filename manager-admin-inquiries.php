<?php
/**
 * manager-admin-inquiries.php - Admin + Manager > Inquiries (pages.js crmInitInquiries)
 *   GET  ?action=list     -> EVERY customer inquiry (accepted or not) + sales_staff[] for the Reassign dropdown
 *   POST ?action=reassign -> inquiry_ref, new_staff_id, new_staff_name, previous_staff, reason, reason_note
 * Put it in the SAME folder as inquiry-common.php.
 * In manager-admin-inquiries.html set:  data-api="manager-admin-inquiries.php?action=list"
 * (pages.js swaps "action=list" for "action=reassign" by itself.)
 */
// Shared session setup: secure cookie settings + 30-minute inactivity timeout (replies 401 "session_expired" as JSON).
define('SESSION_API', true);
require_once __DIR__ . '/session-init.php';

require __DIR__ . '/inquiry-common.php';
require_once __DIR__ . '/notifications-helper.php';   // bell notifications (see notifications-api.php)

/** Admin / Manager only. Accepts "Admin", "Administrator", "System Admin", "Manager", "Sales Manager", etc. */
function requireAdminManager(): array {
    $id = (int)sessionFirst(['user_id', 'id', 'staff_id', 'admin_id', 'manager_id']);
    if (!$id) fail('Please log in again.', 401);
    $rawRole = sessionFirst(['role', 'user_role', 'role_name', 'user_type', 'account_type', 'position', 'userRole']);
    $role = normRole($rawRole);
    $isAdmin   = $role !== '' && str_contains($role, 'admin');
    $isManager = $role !== '' && str_contains($role, 'manager');
    if (!$isAdmin && !$isManager) {
        // shows what the session really holds, so a wrong key/value is easy to spot
        $keys = implode(', ', array_keys($_SESSION));
        fail('You do not have access to this page. (Session role: "' . $rawRole . '". Session keys: ' . $keys . ')', 403);
    }
    $r = $isAdmin ? 'admin' : 'manager';
    return ['id' => $id, 'role' => $r, 'name' => sessionFirst(['user_name', 'name', 'full_name']) ?: ucfirst($r)];
}
$user = requireAdminManager();
$action = $_GET['action'] ?? '';

/** Sales Staff accounts for the Reassign dropdown.
 *  Looks in EVERY table of both databases that has an id + name + role column (so a newly created account is found
 *  wherever your "create user" page saves it), keeps roles that contain "sales", and removes duplicates. */
function salesStaffList(PDO $db): array {
    global $DB_CRM, $DB_CATERING;
    $found = [];   // key (lowercase name) => ['id' => .., 'name' => ..]
    $add = function ($id, $name) use (&$found) {
        $name = trim((string)$name);
        if ($name === '' || !(int)$id) return;
        $key = strtolower($name);
        if (!isset($found[$key])) $found[$key] = ['id' => (string)$id, 'name' => $name];
    };
    $pickCol = function (array $cols, array $cands) {
        foreach ($cands as $x) if (in_array($x, $cols, true)) return $x;
        return null;
    };

    // 1) users table that stores the role as a NUMBER (role_id), e.g. catering_crm.users: user_id, full_name, role_id, status
    foreach (array_unique([$DB_CATERING, $DB_CRM]) as $schema) {
        try { $uCols = array_column($db->query("SHOW COLUMNS FROM `$schema`.`users`")->fetchAll(), 'Field'); }
        catch (PDOException $e) { continue; }
        if (!in_array('role_id', $uCols, true)) continue;
        $uId   = $pickCol($uCols, ['user_id', 'id']);
        $uName = $pickCol($uCols, ['full_name', 'name', 'username']);
        if (!$uId || !$uName) continue;
        $uStat = $pickCol($uCols, ['status', 'account_status']);

        // which role_id(s) mean "Sales Staff": read the roles table...
        $salesRoleIds = [];
        foreach (array_unique([$schema, $DB_CATERING, $DB_CRM]) as $rs) {
            foreach (['roles', 'user_roles', 'role'] as $rt) {
                try { $rCols = array_column($db->query("SHOW COLUMNS FROM `$rs`.`$rt`")->fetchAll(), 'Field'); }
                catch (PDOException $e) { continue; }
                $rId   = $pickCol($rCols, ['role_id', 'id']);
                $rName = $pickCol($rCols, ['role_name', 'name', 'role', 'title']);
                if (!$rId || !$rName) continue;
                foreach ($db->query("SELECT `$rId` AS id, `$rName` AS name FROM `$rs`.`$rt`")->fetchAll() as $r) {
                    if (str_contains(normRole($r['name']), 'sales')) $salesRoleIds[(int)$r['id']] = true;
                }
                if ($salesRoleIds) break 2;
            }
        }
        // ...and if there is no readable roles table, use the role_id of staff who already own inquiries
        if (!$salesRoleIds) {
            try {
                foreach ($db->query("SELECT DISTINCT u.role_id FROM `$schema`.`users` u
                                     JOIN leads l ON l.assigned_staff_id = u.`$uId`")->fetchAll(PDO::FETCH_COLUMN) as $rid) $salesRoleIds[(int)$rid] = true;
            } catch (PDOException $e) { /* ignore */ }
        }
        if (!$salesRoleIds) continue;

        $in = implode(',', array_map('intval', array_keys($salesRoleIds)));
        $rows = $db->query("SELECT `$uId` AS id, `$uName` AS name" . ($uStat ? ", `$uStat` AS status" : ", 'Active' AS status")
            . " FROM `$schema`.`users` WHERE role_id IN ($in) ORDER BY `$uName`")->fetchAll();
        foreach ($rows as $r) {
            if (in_array(strtolower(trim((string)$r['status'])), ['inactive', 'disabled', 'deleted', 'deactivated'], true)) continue;
            $add($r['id'], $r['name']);
        }
    }

    // 2) other tables that store the role as text
    foreach (array_unique([$DB_CRM, $DB_CATERING]) as $schema) {
        try { $tables = $db->query("SHOW TABLES FROM `$schema`")->fetchAll(PDO::FETCH_COLUMN); }
        catch (PDOException $e) { continue; }
        // usual account tables first, so their ids win when the same person appears twice
        usort($tables, function ($a, $b) {
            $pri = ['users' => 0, 'staff' => 1, 'employees' => 2, 'accounts' => 3];
            return ($pri[$a] ?? 9) <=> ($pri[$b] ?? 9);
        });
        foreach ($tables as $table) {
            if (preg_match('/^(leads|cib_|menu_)/', $table)) continue;
            try { $cols = array_column($db->query("SHOW COLUMNS FROM `$schema`.`$table`")->fetchAll(), 'Field'); }
            catch (PDOException $e) { continue; }
            $idCol     = $pickCol($cols, ['id', 'user_id', 'staff_id', 'employee_id']);
            $nameCol   = $pickCol($cols, ['full_name', 'name', 'staff_name', 'user_name', 'username']);
            $roleCol   = $pickCol($cols, ['role', 'user_role', 'role_name', 'user_type', 'account_type', 'position']);
            $statusCol = $pickCol($cols, ['status', 'account_status']);
            if (!$idCol || !$nameCol || !$roleCol) continue;
            try {
                $rows = $db->query("SELECT `$idCol` AS id, `$nameCol` AS name, `$roleCol` AS role"
                    . ($statusCol ? ", `$statusCol` AS status" : ", '' AS status")
                    . " FROM `$schema`.`$table` ORDER BY `$nameCol`")->fetchAll();
            } catch (PDOException $e) { continue; }
            foreach ($rows as $r) {
                if (!str_contains(normRole($r['role']), 'sales')) continue;
                if (in_array(strtolower(trim((string)$r['status'])), ['inactive', 'disabled', 'deleted', 'deactivated'], true)) continue;
                $add($r['id'], $r['name']);
            }
        }
    }

    // also anyone who already owns an inquiry (covers older accounts)
    try {
        foreach ($db->query("SELECT DISTINCT assigned_staff_id AS id, assigned_staff_name AS name FROM leads
                             WHERE assigned_staff_id IS NOT NULL AND assigned_staff_name <> ''")->fetchAll() as $r) $add($r['id'], $r['name']);
    } catch (PDOException $e) { /* ignore */ }

    $list = array_values($found);
    usort($list, fn($a, $b) => strcasecmp($a['name'], $b['name']));
    return $list;
}

if ($action === 'list') {
    // NO assigned_staff filter: unaccepted (assigned_staff_id IS NULL) inquiries show too, as "Unassigned".
    $rows = $db->query("SELECT l.* FROM leads l ORDER BY l.created_at DESC, l.`$LEAD_PK` DESC")->fetchAll();
    out(['success' => true, 'inquiries' => enrichLeads($db, $DB_CRM, $rows), 'sales_staff' => salesStaffList($db)]);
}

if ($action === 'reassign') {
    if ($_SERVER['REQUEST_METHOD'] !== 'POST') fail('POST required.', 405);
    $id = leadIdFromRef((string)($_POST['inquiry_ref'] ?? ''));
    $newId = (int)($_POST['new_staff_id'] ?? 0);
    $newName = trim((string)($_POST['new_staff_name'] ?? ''));
    if (!$id) fail('Inquiry not found.', 404);
    if (!$newId || $newName === '') fail('Please choose the new Sales Staff member.');

    $db->exec("CREATE TABLE IF NOT EXISTS inquiry_assignment_history (
        id INT AUTO_INCREMENT PRIMARY KEY, lead_id INT NOT NULL, previous_staff_id INT NULL, previous_staff_name VARCHAR(120) NULL,
        new_staff_id INT NOT NULL, new_staff_name VARCHAR(120) NOT NULL, reason VARCHAR(120) NULL, reason_note TEXT NULL,
        changed_by_id INT NULL, changed_by_name VARCHAR(120) NULL, created_at DATETIME NOT NULL, INDEX (lead_id)
    ) ENGINE=InnoDB");

    $db->beginTransaction();
    try {
        $cur = $db->prepare("SELECT event_name, inquiry_ref, customer_id, customer_name, notes, assigned_staff_id, assigned_staff_name
                             FROM leads WHERE `$LEAD_PK` = ? FOR UPDATE");
        $cur->execute([$id]);
        $lead = $cur->fetch();
        if (!$lead) { $db->rollBack(); fail('Inquiry not found.', 404); }

        // an inquiry nobody accepted yet moves to "In Progress" once a staff member is given; other stages stay as they are
        $db->prepare("UPDATE leads SET assigned_staff_id = ?, assigned_staff_name = ?, claimed_at = ?,
                      stage = IF(stage = ?, ?, stage) WHERE `$LEAD_PK` = ?")
           ->execute([$newId, $newName, now(), STAGE_NEW, STAGE_PROGRESS, $id]);

        $db->prepare("INSERT INTO inquiry_assignment_history (lead_id, previous_staff_id, previous_staff_name, new_staff_id, new_staff_name,
                      reason, reason_note, changed_by_id, changed_by_name, created_at) VALUES (?,?,?,?,?,?,?,?,?,?)")
           ->execute([$id, $lead['assigned_staff_id'], $lead['assigned_staff_name'], $newId, $newName,
                      trim((string)($_POST['reason'] ?? '')), trim((string)($_POST['reason_note'] ?? '')), $user['id'], $user['name'], now()]);

        // first time anyone owns it -> open the customer's chat (same as Accept)
        $has = $db->prepare("SELECT id FROM `$DB_CRM`.cib_conversations WHERE inquiry_id = ?");
        $has->execute([$id]);
        if (!empty($lead['customer_id']) && !$has->fetch()) {
            $ref = $lead['inquiry_ref'] ?: 'INQ-' . str_pad((string)$id, 4, '0', STR_PAD_LEFT);
            $db->prepare("INSERT INTO `$DB_CRM`.cib_conversations (customer_id, title, reference, status, created_at, updated_at, inquiry_id)
                          VALUES (?,?,?,?,?,?,?)")
               ->execute([$lead['customer_id'], $lead['event_name'], $ref, 'Active', now(), now(), $id]);
            $convId = (int)$db->lastInsertId();
            if (trim((string)$lead['notes']) !== '') {
                $db->prepare("INSERT INTO `$DB_CRM`.cib_messages (conversation_id, sender_type, sender_name, message, created_at) VALUES (?,?,?,?,?)")
                   ->execute([$convId, 'customer', $lead['customer_name'] ?: 'Customer', $lead['notes'], now()]);
            }
            // Welcome: the first thing the customer sees in the new chat.
            $db->prepare("INSERT INTO `$DB_CRM`.cib_messages (conversation_id, sender_type, sender_name, message, created_at) VALUES (?,?,?,?,?)")
               ->execute([$convId, 'staff', $newName, nfWelcomeMessage((string)($lead['event_name'] ?? ''), $newName), now()]);
        }
        $db->commit();
    } catch (Throwable $e) {
        if ($db->inTransaction()) $db->rollBack();
        throw $e;
    }
    // Bell: the new Sales Staff, the one who lost it, the customer, and the other Admin / Manager.
    $nfRef = !empty($lead['inquiry_ref']) ? $lead['inquiry_ref'] : 'INQ-' . str_pad((string)$id, 4, '0', STR_PAD_LEFT);
    $nfEvent = trim((string)($lead['event_name'] ?? '')) !== '' ? $lead['event_name'] : 'an event';
    $nfPrevId = (int)($lead['assigned_staff_id'] ?? 0);
    $nfPrevName = trim((string)($lead['assigned_staff_name'] ?? ''));
    $nfBase = ['type' => 'lead', 'kind' => 'inquiry', 'ref' => $nfRef, 'exclude_user_id' => $user['id']];
    notifySend($db, $nfBase + [
        'title' => 'Inquiry assigned to you',
        'message' => $user['name'] . ' assigned ' . $nfRef . ' (' . $nfEvent . ') to you.',
        'user_ids' => [$newId], 'include_admins' => false,
    ]);
    if ($nfPrevId && $nfPrevId !== $newId) {
        notifySend($db, $nfBase + [
            'title' => 'Inquiry reassigned',
            'message' => $nfRef . ' (' . $nfEvent . ') was moved from you to ' . $newName . '.',
            'user_ids' => [$nfPrevId], 'include_admins' => false,
        ]);
    }
    notifySend($db, $nfBase + [
        'title' => 'Inquiry reassigned',
        'message' => $user['name'] . ' assigned ' . $nfRef . ' (' . $nfEvent . ') to ' . $newName . ($nfPrevName !== '' ? ' (from ' . $nfPrevName . ')' : '') . '.',
        'user_ids' => !empty($lead['customer_id']) ? [(int)$lead['customer_id']] : [],
        'customer' => [
            'title' => 'Your inquiry has a new contact',
            'message' => $newName . ' is now handling your inquiry for ' . $nfEvent . '.',
        ],
    ]);
    out(['success' => true, 'message' => 'Inquiry reassigned.']);
}

fail('Unknown action.', 400);