<?php
declare(strict_types=1);

/** Handles administrative settings and user account management.*/

mysqli_report(MYSQLI_REPORT_ERROR | MYSQLI_REPORT_STRICT);

// Shared session setup: secure cookie settings + 30-minute inactivity timeout (replies 401 "session_expired" as JSON).
define('SESSION_API', true);
require_once __DIR__ . '/session-init.php';

header("Content-Type: application/json; charset=utf-8");
header("Cache-Control: no-store");

function respond(int $status, array $data): void
{
    http_response_code($status);
    echo json_encode(
        $data,
        JSON_UNESCAPED_UNICODE | JSON_INVALID_UTF8_SUBSTITUTE
    );
    exit;
}

if (empty($_SESSION["user_id"])) {
    respond(401, [
        "success" => false,
        "message" => "Please log in to continue."
    ]);
}

// Admin: everything. Manager: list + Activate / Deactivate (no Edit, no Delete).
$sessionRole = (string) ($_SESSION["role_name"] ?? "");
$isAdminSession = $sessionRole === "Admin";
$isManagerSession = $sessionRole === "Manager";

if (!$isAdminSession && !$isManagerSession) {
    respond(403, [
        "success" => false,
        "message" => "You are not authorized to access account management."
    ]);
}

$action = $_GET["action"] ?? "";

// Edit and Delete are Admin only. (Activate / Deactivate uses action=status, open to Manager.)
if (!$isAdminSession && ($action === "edit" || $action === "delete")) {
    respond(403, [
        "success" => false,
        "message" => "Only an Admin can " . ($action === "delete" ? "delete" : "edit") . " accounts."
    ]);
}

// "Created Info" needs users.created_by (the id of the user who made the account).
// If that column does not exist yet, the list still works and just leaves "by ..." out.
function users_has_created_by(mysqli $conn): bool
{
    $result = $conn->query("SHOW COLUMNS FROM users LIKE 'created_by'");
    return $result instanceof mysqli_result && $result->num_rows > 0;
}

if ($_SERVER["REQUEST_METHOD"] === "GET" && $action === "list") {
    try {
        require_once __DIR__ . "/config/database.php";

        if (empty($_SESSION["settings_csrf_token"])) {
            $_SESSION["settings_csrf_token"] = bin2hex(random_bytes(32));
        }

        $hasCreatedBy = users_has_created_by($conn);
        $createdSelect = $hasCreatedBy
            ? "u.created_by, cb.full_name AS created_by_name, cr.role_name AS created_by_role"
            : "NULL AS created_by, NULL AS created_by_name, NULL AS created_by_role";
        $createdJoin = $hasCreatedBy
            ? "LEFT JOIN users AS cb ON cb.user_id = u.created_by
               LEFT JOIN roles AS cr ON cr.role_id = cb.role_id"
            : "";

        // A Manager never sees Admin accounts (Admin sees everyone).
        $whereClause = $isAdminSession ? "" : "WHERE r.role_name <> 'Admin'";

        $result = $conn->query(
            "SELECT
                u.user_id,
                u.full_name,
                u.username,
                u.email,
                u.role_id,
                r.role_name,
                u.status,
                u.created_at,
                $createdSelect
             FROM users AS u
             INNER JOIN roles AS r ON r.role_id = u.role_id
             $createdJoin
             $whereClause
             ORDER BY u.created_at DESC, u.user_id DESC"
        );

        $users = [];
        foreach ($result->fetch_all(MYSQLI_ASSOC) as $user) {
            // "Admin (Shane Admin)"; accounts with no creator show "System Root".
            if (!$hasCreatedBy) {
                $user["created_by_label"] = null;
            } elseif ($user["created_by_name"] !== null) {
                $user["created_by_label"] = trim(($user["created_by_role"] ?? "") . " (" . $user["created_by_name"] . ")");
            } else {
                $user["created_by_label"] = "System Root";
            }
            // A Manager may not change Admin accounts.
            $user["can_status"] = $isAdminSession || $user["role_name"] !== "Admin";
            unset($user["created_by_name"], $user["created_by_role"]);
            $users[] = $user;
        }

        respond(200, [
            "success" => true,
            "users" => $users,
            "can_edit" => $isAdminSession,
            "can_delete" => $isAdminSession,
            "csrf_token" => $_SESSION["settings_csrf_token"]
        ]);
    } catch (Throwable $e) {
        error_log("Settings API list error: " . $e->getMessage());
        respond(500, [
            "success" => false,
            "message" => "Unable to retrieve user accounts. Please try again."
        ]);
    }
}

if ($_SERVER["REQUEST_METHOD"] === "POST" && $action === "create") {
    $submittedToken = $_SERVER["HTTP_X_CSRF_TOKEN"] ?? "";
    $sessionToken = $_SESSION["settings_csrf_token"] ?? "";

    if (
        !is_string($submittedToken) ||
        !is_string($sessionToken) ||
        $sessionToken === "" ||
        !hash_equals($sessionToken, $submittedToken)
    ) {
        respond(403, [
            "success" => false,
            "message" => "Your session expired. Refresh Settings and try again."
        ]);
    }

    $fullName = $_POST["full_name"] ?? "";
    $username = $_POST["username"] ?? "";
    $email = $_POST["email"] ?? "";
    $roleName = $_POST["role"] ?? "";
    $password = $_POST["password"] ?? "";
    $confirmPassword = $_POST["confirm_password"] ?? "";

    if (
        !is_string($fullName) ||
        !is_string($username) ||
        !is_string($email) ||
        !is_string($roleName) ||
        !is_string($password) ||
        !is_string($confirmPassword)
    ) {
        respond(400, [
            "success" => false,
            "message" => "All account fields must be valid text."
        ]);
    }

    $fullName = trim($fullName);
    $username = trim($username);
    $email = trim($email);
    $roleName = trim($roleName);

    if (
        $fullName === "" ||
        $username === "" ||
        $email === "" ||
        $roleName === "" ||
        $password === "" ||
        $confirmPassword === ""
    ) {
        respond(400, [
            "success" => false,
            "message" => "All fields are required."
        ]);
    }

    if (mb_strlen($fullName, "UTF-8") > 100 || mb_strlen($username, "UTF-8") > 50) {
        respond(400, [
            "success" => false,
            "message" => "Full name must be at most 100 characters and username at most 50."
        ]);
    }

    if (mb_strlen($email, "UTF-8") > 150 || !filter_var($email, FILTER_VALIDATE_EMAIL)) {
        respond(400, [
            "success" => false,
            "message" => "Enter a valid email address no longer than 150 characters."
        ]);
    }

    if (mb_strlen($roleName, "UTF-8") > 50) {
        respond(400, [
            "success" => false,
            "message" => "Select a valid role."
        ]);
    }

    if (mb_strlen($password, "UTF-8") < 12 || strlen($password) > 72) {
        respond(400, [
            "success" => false,
            "message" => "Password must be at least 12 characters and no more than 72 bytes."
        ]);
    }

    if ($password !== $confirmPassword) {
        respond(400, [
            "success" => false,
            "message" => "The passwords do not match."
        ]);
    }

    try {
        require_once __DIR__ . "/config/database.php";

        $roleQuery = $conn->prepare(
            "SELECT role_id FROM roles WHERE role_name = ? LIMIT 1"
        );
        $roleQuery->bind_param("s", $roleName);
        $roleQuery->execute();
        $role = $roleQuery->get_result()->fetch_assoc();
        $roleQuery->close();

        if (!$role) {
            respond(400, [
                "success" => false,
                "message" => "Select a role that exists in the system."
            ]);
        }

        if (!$isAdminSession && $roleName === "Admin") {
            respond(403, [
                "success" => false,
                "message" => "Only an Admin can create an Admin account."
            ]);
        }

        // Customers sign up on their own; nobody creates a Customer account from Settings (Admin included).
        if (strcasecmp(trim((string) $roleName), "Customer") === 0) {
            respond(403, [
                "success" => false,
                "message" => "Customer accounts cannot be created here. Customers sign up on their own."
            ]);
        }

        $duplicateQuery = $conn->prepare(
            "SELECT user_id FROM users WHERE username = ? OR email = ? LIMIT 1"
        );
        $duplicateQuery->bind_param("ss", $username, $email);
        $duplicateQuery->execute();
        $duplicate = $duplicateQuery->get_result()->fetch_assoc();
        $duplicateQuery->close();

        if ($duplicate) {
            respond(409, [
                "success" => false,
                "message" => "That username or email is already in use."
            ]);
        }

        $passwordHash = password_hash($password, PASSWORD_DEFAULT);
        if ($passwordHash === false) {
            throw new RuntimeException("Password hashing failed.");
        }

        $roleId = (int) $role["role_id"];
        $status = "Active";
        if (users_has_created_by($conn)) {
            $createdBy = (int) $_SESSION["user_id"];
            $insert = $conn->prepare(
                "INSERT INTO users
                    (full_name, username, email, role_id, password_hash, status, created_by)
                 VALUES (?, ?, ?, ?, ?, ?, ?)"
            );
            $insert->bind_param(
                "sssissi",
                $fullName,
                $username,
                $email,
                $roleId,
                $passwordHash,
                $status,
                $createdBy
            );
        } else {
            $insert = $conn->prepare(
                "INSERT INTO users
                    (full_name, username, email, role_id, password_hash, status)
                 VALUES (?, ?, ?, ?, ?, ?)"
            );
            $insert->bind_param(
                "sssiss",
                $fullName,
                $username,
                $email,
                $roleId,
                $passwordHash,
                $status
            );
        }
        $insert->execute();
        $userId = $insert->insert_id;
        $insert->close();

        respond(201, [
            "success" => true,
            "message" => "Account created successfully.",
            "user_id" => $userId
        ]);
    } catch (mysqli_sql_exception $e) {
        if ((int) $e->getCode() === 1062) {
            respond(409, [
                "success" => false,
                "message" => "That username or email is already in use."
            ]);
        }

        error_log("Settings API account creation error: " . $e->getMessage());
        respond(500, [
            "success" => false,
            "message" => "Unable to create the account. Please try again."
        ]);
    } catch (Throwable $e) {
        error_log("Settings API account creation error: " . $e->getMessage());
        respond(500, [
            "success" => false,
            "message" => "Unable to create the account. Please try again."
        ]);
    }
}

if ($_SERVER["REQUEST_METHOD"] === "POST" && $action === "edit") {
    $submittedToken = $_SERVER["HTTP_X_CSRF_TOKEN"] ?? "";
    $sessionToken = $_SESSION["settings_csrf_token"] ?? "";

    if (
        !is_string($submittedToken) ||
        !is_string($sessionToken) ||
        $sessionToken === "" ||
        !hash_equals($sessionToken, $submittedToken)
    ) {
        respond(403, [
            "success" => false,
            "message" => "Your session expired. Refresh Settings and try again."
        ]);
    }

    $userIdValue = $_POST["user_id"] ?? "";
    $fullName = $_POST["full_name"] ?? "";
    $email = $_POST["email"] ?? "";
    $roleName = $_POST["role"] ?? "";
    $status = $_POST["status"] ?? "";

    if (
        !is_string($userIdValue) ||
        !is_string($fullName) ||
        !is_string($email) ||
        !is_string($roleName) ||
        !is_string($status)
    ) {
        respond(400, [
            "success" => false,
            "message" => "All account fields must be valid."
        ]);
    }

    $fullName = trim($fullName);
    $email = trim($email);
    $roleName = trim($roleName);
    $status = trim($status);

    $userId = filter_var($userIdValue, FILTER_VALIDATE_INT, [
        "options" => ["min_range" => 1]
    ]);
    if ($userId === false) {
        respond(400, [
            "success" => false,
            "message" => "Select a valid account to update."
        ]);
    }

    if ($fullName === "" || $email === "" || $roleName === "" || $status === "") {
        respond(400, [
            "success" => false,
            "message" => "Full name, email, role, and status are required."
        ]);
    }

    if (mb_strlen($fullName, "UTF-8") > 100) {
        respond(400, [
            "success" => false,
            "message" => "Full name must be at most 100 characters."
        ]);
    }

    if (mb_strlen($email, "UTF-8") > 150 || !filter_var($email, FILTER_VALIDATE_EMAIL)) {
        respond(400, [
            "success" => false,
            "message" => "Enter a valid email address no longer than 150 characters."
        ]);
    }

    if ($status !== "Active" && $status !== "Inactive") {
        respond(400, [
            "success" => false,
            "message" => "Select a valid account status."
        ]);
    }

    try {
        require_once __DIR__ . "/config/database.php";
        $conn->begin_transaction();

        // Lock user rows while checking whether another active Admin exists.
        $lockUsers = $conn->query("SELECT user_id FROM users ORDER BY user_id FOR UPDATE");
        $lockUsers->free();

        $accountQuery = $conn->prepare(
            "SELECT u.user_id, u.role_id, u.status, r.role_name
             FROM users AS u
             INNER JOIN roles AS r ON r.role_id = u.role_id
             WHERE u.user_id = ?
             LIMIT 1"
        );
        $accountQuery->bind_param("i", $userId);
        $accountQuery->execute();
        $account = $accountQuery->get_result()->fetch_assoc();
        $accountQuery->close();

        if (!$account) {
            $conn->rollback();
            respond(404, [
                "success" => false,
                "message" => "The selected account was not found."
            ]);
        }

        $roleQuery = $conn->prepare(
            "SELECT role_id, role_name FROM roles WHERE role_name = ? LIMIT 1"
        );
        $roleQuery->bind_param("s", $roleName);
        $roleQuery->execute();
        $role = $roleQuery->get_result()->fetch_assoc();
        $roleQuery->close();

        if (!$role) {
            $conn->rollback();
            respond(400, [
                "success" => false,
                "message" => "Select a role that exists in the system."
            ]);
        }

        $duplicateQuery = $conn->prepare(
            "SELECT user_id FROM users WHERE email = ? AND user_id <> ? LIMIT 1"
        );
        $duplicateQuery->bind_param("si", $email, $userId);
        $duplicateQuery->execute();
        $duplicate = $duplicateQuery->get_result()->fetch_assoc();
        $duplicateQuery->close();

        if ($duplicate) {
            $conn->rollback();
            respond(409, [
                "success" => false,
                "message" => "That email address is already in use."
            ]);
        }

        $roleId = (int) $role["role_id"];
        $roleName = $role["role_name"];
        $isAdmin = $account["role_name"] === "Admin";
        $willDemote = $isAdmin && $roleName !== "Admin";
        $willDeactivate = $isAdmin &&
            $account["status"] === "Active" &&
            $status === "Inactive";

        if (
            (int) $userId === (int) $_SESSION["user_id"] &&
            $status === "Inactive"
        ) {
            $conn->rollback();
            respond(400, [
                "success" => false,
                "message" => "You cannot deactivate your own Admin account."
            ]);
        }

        if ($account["role_name"] === "Admin" && $account["status"] === "Active" && ($willDemote || $willDeactivate)) {
            $activeAdminQuery = $conn->prepare(
                "SELECT COUNT(*) AS active_admin_count
                 FROM users AS u
                 INNER JOIN roles AS r ON r.role_id = u.role_id
                 WHERE r.role_name = 'Admin' AND u.status = 'Active'"
            );
            $activeAdminQuery->execute();
            $activeAdminCount = (int) $activeAdminQuery->get_result()->fetch_assoc()["active_admin_count"];
            $activeAdminQuery->close();

            if ($activeAdminCount <= 1) {
                $conn->rollback();
                respond(400, [
                    "success" => false,
                    "message" => "The last active Admin cannot be deactivated or demoted."
                ]);
            }
        }

        $update = $conn->prepare(
            "UPDATE users
             SET full_name = ?, email = ?, role_id = ?, status = ?
             WHERE user_id = ?"
        );
        $update->bind_param("ssisi", $fullName, $email, $roleId, $status, $userId);
        $update->execute();
        $updated = $update->affected_rows;
        $update->close();

        $conn->commit();

        respond(200, [
            "success" => true,
            "message" => "Account updated successfully.",
            "user_id" => (int) $userId,
            "unchanged" => $updated === 0
        ]);
    } catch (mysqli_sql_exception $e) {
        try {
            $conn->rollback();
        } catch (Throwable $rollbackError) {
            error_log("Settings API rollback error: " . $rollbackError->getMessage());
        }

        if ((int) $e->getCode() === 1062) {
            respond(409, [
                "success" => false,
                "message" => "That email address is already in use."
            ]);
        }

        error_log("Settings API account update error: " . $e->getMessage());
        respond(500, [
            "success" => false,
            "message" => "Unable to update the account. Please try again."
        ]);
    } catch (Throwable $e) {
        try {
            $conn->rollback();
        } catch (Throwable $rollbackError) {
            error_log("Settings API rollback error: " . $rollbackError->getMessage());
        }
        error_log("Settings API account update error: " . $e->getMessage());
        respond(500, [
            "success" => false,
            "message" => "Unable to update the account. Please try again."
        ]);
    }
}

if ($_SERVER["REQUEST_METHOD"] === "POST" && $action === "status") {
    // Activate / Deactivate an account. Open to Admin and Manager.
    $submittedToken = $_SERVER["HTTP_X_CSRF_TOKEN"] ?? "";
    $sessionToken = $_SESSION["settings_csrf_token"] ?? "";

    if (
        !is_string($submittedToken) ||
        !is_string($sessionToken) ||
        $sessionToken === "" ||
        !hash_equals($sessionToken, $submittedToken)
    ) {
        respond(403, [
            "success" => false,
            "message" => "Your session expired. Refresh Settings and try again."
        ]);
    }

    $userIdValue = $_POST["user_id"] ?? "";
    $status = $_POST["status"] ?? "";
    $userId = is_string($userIdValue)
        ? filter_var($userIdValue, FILTER_VALIDATE_INT, ["options" => ["min_range" => 1]])
        : false;

    if ($userId === false) {
        respond(400, [
            "success" => false,
            "message" => "Select a valid account to update."
        ]);
    }

    if (!is_string($status) || ($status !== "Active" && $status !== "Inactive")) {
        respond(400, [
            "success" => false,
            "message" => "Select a valid account status."
        ]);
    }

    try {
        require_once __DIR__ . "/config/database.php";
        $conn->begin_transaction();

        // Lock user rows while checking whether another active Admin exists.
        $lockUsers = $conn->query("SELECT user_id FROM users ORDER BY user_id FOR UPDATE");
        $lockUsers->free();

        $accountQuery = $conn->prepare(
            "SELECT u.user_id, u.status, r.role_name
             FROM users AS u
             INNER JOIN roles AS r ON r.role_id = u.role_id
             WHERE u.user_id = ?
             LIMIT 1"
        );
        $accountQuery->bind_param("i", $userId);
        $accountQuery->execute();
        $account = $accountQuery->get_result()->fetch_assoc();
        $accountQuery->close();

        if (!$account) {
            $conn->rollback();
            respond(404, [
                "success" => false,
                "message" => "The selected account was not found."
            ]);
        }

        if (!$isAdminSession && $account["role_name"] === "Admin") {
            $conn->rollback();
            respond(403, [
                "success" => false,
                "message" => "Only an Admin can change an Admin account."
            ]);
        }

        if ((int) $userId === (int) $_SESSION["user_id"] && $status === "Inactive") {
            $conn->rollback();
            respond(400, [
                "success" => false,
                "message" => "You cannot deactivate your own account."
            ]);
        }

        if (
            $account["role_name"] === "Admin" &&
            $account["status"] === "Active" &&
            $status === "Inactive"
        ) {
            $activeAdminQuery = $conn->prepare(
                "SELECT COUNT(*) AS active_admin_count
                 FROM users AS u
                 INNER JOIN roles AS r ON r.role_id = u.role_id
                 WHERE r.role_name = 'Admin' AND u.status = 'Active'"
            );
            $activeAdminQuery->execute();
            $activeAdminCount = (int) $activeAdminQuery->get_result()->fetch_assoc()["active_admin_count"];
            $activeAdminQuery->close();

            if ($activeAdminCount <= 1) {
                $conn->rollback();
                respond(400, [
                    "success" => false,
                    "message" => "The last active Admin cannot be deactivated."
                ]);
            }
        }

        $update = $conn->prepare("UPDATE users SET status = ? WHERE user_id = ?");
        $update->bind_param("si", $status, $userId);
        $update->execute();
        $update->close();

        $conn->commit();

        respond(200, [
            "success" => true,
            "message" => $status === "Active"
                ? "Account activated successfully."
                : "Account deactivated successfully.",
            "user_id" => (int) $userId
        ]);
    } catch (Throwable $e) {
        try {
            $conn->rollback();
        } catch (Throwable $rollbackError) {
            error_log("Settings API rollback error: " . $rollbackError->getMessage());
        }
        error_log("Settings API status change error: " . $e->getMessage());
        respond(500, [
            "success" => false,
            "message" => "Unable to update the account. Please try again."
        ]);
    }
}

if ($_SERVER["REQUEST_METHOD"] === "POST" && $action === "delete") {
    // Delete an account. Admin only (checked at the top of this file).
    $submittedToken = $_SERVER["HTTP_X_CSRF_TOKEN"] ?? "";
    $sessionToken = $_SESSION["settings_csrf_token"] ?? "";

    if (
        !is_string($submittedToken) ||
        !is_string($sessionToken) ||
        $sessionToken === "" ||
        !hash_equals($sessionToken, $submittedToken)
    ) {
        respond(403, [
            "success" => false,
            "message" => "Your session expired. Refresh Settings and try again."
        ]);
    }

    $userIdValue = $_POST["user_id"] ?? "";
    $userId = is_string($userIdValue)
        ? filter_var($userIdValue, FILTER_VALIDATE_INT, ["options" => ["min_range" => 1]])
        : false;

    if ($userId === false) {
        respond(400, [
            "success" => false,
            "message" => "Select a valid account to delete."
        ]);
    }

    if ((int) $userId === (int) $_SESSION["user_id"]) {
        respond(400, [
            "success" => false,
            "message" => "You cannot delete your own account."
        ]);
    }

    try {
        require_once __DIR__ . "/config/database.php";
        $conn->begin_transaction();

        $lockUsers = $conn->query("SELECT user_id FROM users ORDER BY user_id FOR UPDATE");
        $lockUsers->free();

        $accountQuery = $conn->prepare(
            "SELECT u.user_id, u.status, r.role_name
             FROM users AS u
             INNER JOIN roles AS r ON r.role_id = u.role_id
             WHERE u.user_id = ?
             LIMIT 1"
        );
        $accountQuery->bind_param("i", $userId);
        $accountQuery->execute();
        $account = $accountQuery->get_result()->fetch_assoc();
        $accountQuery->close();

        if (!$account) {
            $conn->rollback();
            respond(404, [
                "success" => false,
                "message" => "The selected account was not found."
            ]);
        }

        // An account must be deactivated before it can be deleted.
        if ($account["status"] === "Active") {
            $conn->rollback();
            respond(400, [
                "success" => false,
                "message" => "Deactivate this account first before deleting it."
            ]);
        }

        if ($account["role_name"] === "Admin" && $account["status"] === "Active") {
            $activeAdminQuery = $conn->prepare(
                "SELECT COUNT(*) AS active_admin_count
                 FROM users AS u
                 INNER JOIN roles AS r ON r.role_id = u.role_id
                 WHERE r.role_name = 'Admin' AND u.status = 'Active'"
            );
            $activeAdminQuery->execute();
            $activeAdminCount = (int) $activeAdminQuery->get_result()->fetch_assoc()["active_admin_count"];
            $activeAdminQuery->close();

            if ($activeAdminCount <= 1) {
                $conn->rollback();
                respond(400, [
                    "success" => false,
                    "message" => "The last active Admin cannot be deleted."
                ]);
            }
        }

        $delete = $conn->prepare("DELETE FROM users WHERE user_id = ?");
        $delete->bind_param("i", $userId);
        $delete->execute();
        $delete->close();

        $conn->commit();

        respond(200, [
            "success" => true,
            "message" => "Account deleted successfully.",
            "user_id" => (int) $userId
        ]);
    } catch (mysqli_sql_exception $e) {
        try {
            $conn->rollback();
        } catch (Throwable $rollbackError) {
            error_log("Settings API rollback error: " . $rollbackError->getMessage());
        }

        // 1451 = the account is used by other records (inquiries, bookings, ...).
        if ((int) $e->getCode() === 1451) {
            respond(409, [
                "success" => false,
                "message" => "This account has related records and cannot be deleted. Deactivate it instead."
            ]);
        }

        error_log("Settings API account delete error: " . $e->getMessage());
        respond(500, [
            "success" => false,
            "message" => "Unable to delete the account. Please try again."
        ]);
    } catch (Throwable $e) {
        try {
            $conn->rollback();
        } catch (Throwable $rollbackError) {
            error_log("Settings API rollback error: " . $rollbackError->getMessage());
        }
        error_log("Settings API account delete error: " . $e->getMessage());
        respond(500, [
            "success" => false,
            "message" => "Unable to delete the account. Please try again."
        ]);
    }
}

if ($_SERVER["REQUEST_METHOD"] !== "GET" && $_SERVER["REQUEST_METHOD"] !== "POST") {
    header("Allow: GET, POST");
    respond(405, [
        "success" => false,
        "message" => "This request method is not supported."
    ]);
}

respond(400, [
    "success" => false,
    "message" => "Invalid or unsupported action."
]);