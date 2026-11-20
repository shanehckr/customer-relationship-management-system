<?php
declare(strict_types=1);

/**
 * Menu Management API.
 *
 *   GET  ?action=list    any signed-in user (Customer too: the inquiry form "Menu & Dishes" step reads this)
 *   POST ?action=add     Admin / Manager   multipart: item_name, category, display_price, serving_specs, photo
 *   POST ?action=edit    Admin / Manager   multipart: menu_item_id + the same fields (photo is optional)
 *   POST ?action=delete  Admin / Manager   form: menu_item_id
 *
 * Run this SQL once (phpMyAdmin):
 *
 *   CREATE TABLE menu_items (
 *     menu_item_id  INT AUTO_INCREMENT PRIMARY KEY,
 *     item_name     VARCHAR(150) NOT NULL,
 *     category      VARCHAR(40)  NOT NULL,
 *     display_price VARCHAR(80)  NOT NULL,
 *     serving_specs VARCHAR(255) NOT NULL,
 *     photo_path    VARCHAR(255) NOT NULL,
 *     created_by    INT NULL,
 *     created_at    DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
 *     updated_at    DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
 *     KEY idx_menu_category (category)
 *   );
 *
 * PAX / portion tiers (new). The table below is created AUTOMATICALLY the first time this file runs,
 * so you do not have to do anything. The SQL is here only for reference:
 *
 *   CREATE TABLE IF NOT EXISTS menu_item_tiers (
 *     tier_id          INT AUTO_INCREMENT PRIMARY KEY,
 *     menu_item_id     INT NOT NULL,
 *     tier_name        VARCHAR(100) NOT NULL,
 *     price            DECIMAL(10,2) NOT NULL DEFAULT 0,
 *     pax_description  VARCHAR(150) NOT NULL DEFAULT '',
 *     sort_order       INT NOT NULL DEFAULT 0,
 *     KEY idx_tier_item (menu_item_id)
 *   );
 *
 *   GET  ?action=token   Admin / Manager   returns a fresh CSRF token (the page asks for it again when the old one is stale)
 *   add / edit also accept  tiers  = JSON text:  [{"name":"1/4 KG Portion","price":230,"pax":"Good for 2-3 PAX"}]
 *
 * Photos are saved in uploads/menu/ (created automatically, next to this file).
 */

mysqli_report(MYSQLI_REPORT_ERROR | MYSQLI_REPORT_STRICT);

// Shared session setup: secure cookie settings + 30-minute inactivity timeout (replies 401 "session_expired" as JSON).
define('SESSION_API', true);
require_once __DIR__ . '/session-init.php';

header("Content-Type: application/json; charset=utf-8");
header("Cache-Control: no-store");

const MENU_CATEGORIES = ["Best Sellers", "Bilao", "Catering Packages"];
const MENU_UPLOAD_DIR = __DIR__ . "/uploads/menu/";
const MENU_UPLOAD_URL = "uploads/menu/";
const MENU_MAX_PHOTO_BYTES = 5 * 1024 * 1024;
const MENU_MAX_TIERS = 12;
// While you are setting things up, Admin / Manager see the REAL reason of a server error under the message.
// Set to false when the system goes live.
const MENU_SHOW_ERRORS = true;
const MENU_PHOTO_TYPES = [
    "image/jpeg" => "jpg",
    "image/png" => "png",
    "image/webp" => "webp"
];

function respond(int $status, array $data): void
{
    http_response_code($status);
    echo json_encode($data, JSON_UNESCAPED_UNICODE | JSON_INVALID_UTF8_SUBSTITUTE);
    exit;
}

if (empty($_SESSION["user_id"])) {
    respond(401, ["success" => false, "message" => "Please log in to continue."]);
}

$sessionRole = (string) ($_SESSION["role_name"] ?? "");
$canManage = $sessionRole === "Admin" || $sessionRole === "Manager";
$action = $_GET["action"] ?? "";

if (empty($_SESSION["menu_csrf_token"])) {
    $_SESSION["menu_csrf_token"] = bin2hex(random_bytes(32));
}

/** Field text, trimmed and length-checked. */
function menu_text(string $key, int $max, string $label): string
{
    $value = $_POST[$key] ?? "";
    if (!is_string($value) || trim($value) === "") {
        respond(400, ["success" => false, "message" => "$label is required."]);
    }
    $value = trim($value);
    if (mb_strlen($value, "UTF-8") > $max) {
        respond(400, ["success" => false, "message" => "$label must be at most $max characters."]);
    }
    return $value;
}

/** Validates the uploaded photo and returns its saved relative path, or null when none was sent. */
function menu_save_photo(bool $required): ?string
{
    $file = $_FILES["photo"] ?? null;
    if ($file === null || ($file["error"] ?? UPLOAD_ERR_NO_FILE) === UPLOAD_ERR_NO_FILE) {
        if ($required) {
            respond(400, ["success" => false, "message" => "A photo is required."]);
        }
        return null;
    }
    if ($file["error"] !== UPLOAD_ERR_OK) {
        respond(400, ["success" => false, "message" => "The photo could not be uploaded. Please try again."]);
    }
    if ($file["size"] > MENU_MAX_PHOTO_BYTES) {
        respond(400, ["success" => false, "message" => "The photo must be 5 MB or smaller."]);
    }

    $mime = (new finfo(FILEINFO_MIME_TYPE))->file($file["tmp_name"]);
    if (!is_string($mime) || !isset(MENU_PHOTO_TYPES[$mime]) || @getimagesize($file["tmp_name"]) === false) {
        respond(400, ["success" => false, "message" => "Upload a PNG, JPG or WEBP photo."]);
    }

    if (!is_dir(MENU_UPLOAD_DIR) && !mkdir(MENU_UPLOAD_DIR, 0755, true) && !is_dir(MENU_UPLOAD_DIR)) {
        respond(500, ["success" => false, "message" => "The photo folder could not be created."]);
    }

    $name = bin2hex(random_bytes(16)) . "." . MENU_PHOTO_TYPES[$mime];
    if (!move_uploaded_file($file["tmp_name"], MENU_UPLOAD_DIR . $name)) {
        respond(500, ["success" => false, "message" => "The photo could not be saved."]);
    }
    return MENU_UPLOAD_URL . $name;
}

function menu_delete_photo(?string $path): void
{
    if ($path === null || strpos($path, MENU_UPLOAD_URL) !== 0) {
        return;   // only files this API saved are ever removed
    }
    $full = MENU_UPLOAD_DIR . basename($path);
    if (is_file($full)) {
        @unlink($full);
    }
}

function menu_item_json(array $row, array $tiers = []): array
{
    return [
        "id" => (int) $row["menu_item_id"],
        "name" => $row["item_name"],
        "category" => $row["category"],
        "price" => $row["display_price"],
        "specs" => $row["serving_specs"],
        "photo" => $row["photo_path"],
        "tiers" => $tiers
    ];
}

/** Creates the tiers table the first time (no manual SQL needed). */
function menu_ensure_tier_table(mysqli $conn): void
{
    $conn->query(
        "CREATE TABLE IF NOT EXISTS menu_item_tiers (
            tier_id INT AUTO_INCREMENT PRIMARY KEY,
            menu_item_id INT NOT NULL,
            tier_name VARCHAR(100) NOT NULL,
            price DECIMAL(10,2) NOT NULL DEFAULT 0,
            pax_description VARCHAR(150) NOT NULL DEFAULT '',
            sort_order INT NOT NULL DEFAULT 0,
            KEY idx_tier_item (menu_item_id)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4"
    );
}

/** Reads + validates the posted tiers (JSON). Blank rows are ignored. */
function menu_read_tiers(): array
{
    $raw = $_POST["tiers"] ?? "[]";
    if (!is_string($raw) || trim($raw) === "") {
        $raw = "[]";
    }
    $list = json_decode($raw, true);
    if (!is_array($list)) {
        respond(400, ["success" => false, "message" => "The PAX / portion tiers are not valid."]);
    }
    $list = array_values($list);
    if (count($list) > MENU_MAX_TIERS) {
        respond(400, ["success" => false, "message" => "You can add up to " . MENU_MAX_TIERS . " tiers."]);
    }

    $out = [];
    foreach ($list as $i => $row) {
        if (!is_array($row)) {
            continue;
        }
        $name = trim((string) ($row["name"] ?? ""));
        $pax = trim((string) ($row["pax"] ?? ""));
        $priceRaw = $row["price"] ?? "";
        $priceRaw = is_scalar($priceRaw) ? trim((string) $priceRaw) : "";
        if ($name === "" && $pax === "" && $priceRaw === "") {
            continue;   // empty row
        }
        $n = $i + 1;
        if ($name === "") {
            respond(400, ["success" => false, "message" => "Tier $n needs a portion name."]);
        }
        if (mb_strlen($name, "UTF-8") > 100) {
            respond(400, ["success" => false, "message" => "Tier $n: the portion name must be at most 100 characters."]);
        }
        if (mb_strlen($pax, "UTF-8") > 150) {
            respond(400, ["success" => false, "message" => "Tier $n: the PAX description must be at most 150 characters."]);
        }
        $clean = str_replace([",", "\u{20B1}", " "], "", $priceRaw);
        if ($clean === "" || !is_numeric($clean) || (float) $clean < 0 || (float) $clean > 9999999.99) {
            respond(400, ["success" => false, "message" => "Tier $n needs a valid price."]);
        }
        $out[] = ["name" => $name, "price" => round((float) $clean, 2), "pax" => $pax];
    }
    return $out;
}

/** tiers of many items at once: [menu_item_id => [tier, ...]] */
function menu_load_tiers(mysqli $conn, array $ids): array
{
    if (!$ids) {
        return [];
    }
    $in = implode(",", array_map("intval", $ids));   // integers only
    $result = $conn->query(
        "SELECT menu_item_id, tier_name, price, pax_description
         FROM menu_item_tiers
         WHERE menu_item_id IN ($in)
         ORDER BY menu_item_id ASC, sort_order ASC, tier_id ASC"
    );
    $by = [];
    foreach ($result->fetch_all(MYSQLI_ASSOC) as $r) {
        $by[(int) $r["menu_item_id"]][] = [
            "name" => $r["tier_name"],
            "price" => (float) $r["price"],
            "pax" => $r["pax_description"]
        ];
    }
    return $by;
}

/** Replaces all tiers of one item. */
function menu_save_tiers(mysqli $conn, int $id, array $tiers): void
{
    if (!($GLOBALS["tiersReady"] ?? true)) {
        return;   // the tiers table is not available: the rest of the menu still works
    }
    $del = $conn->prepare("DELETE FROM menu_item_tiers WHERE menu_item_id = ?");
    $del->bind_param("i", $id);
    $del->execute();
    if (!$tiers) {
        return;
    }
    $ins = $conn->prepare(
        "INSERT INTO menu_item_tiers (menu_item_id, tier_name, price, pax_description, sort_order)
         VALUES (?, ?, ?, ?, ?)"
    );
    foreach (array_values($tiers) as $order => $t) {
        $name = $t["name"];
        $price = $t["price"];
        $pax = $t["pax"];
        $ins->bind_param("isdsi", $id, $name, $price, $pax, $order);
        $ins->execute();
    }
}

function menu_require_manager(bool $canManage): void
{
    if (!$canManage) {
        respond(403, ["success" => false, "message" => "Only an Admin or Manager can change the menu."]);
    }
    if ($_SERVER["REQUEST_METHOD"] !== "POST") {
        respond(405, ["success" => false, "message" => "Method not allowed."]);
    }
    $token = $_POST["csrf_token"] ?? "";
    if (!is_string($token) || $token === "") {
        $token = $_SERVER["HTTP_X_CSRF_TOKEN"] ?? "";   // an EMPTY posted token must not hide the header
    }
    if (!is_string($token) || !hash_equals((string) $_SESSION["menu_csrf_token"], $token)) {
        error_log("menu-management.php: CSRF mismatch (token sent: " . (is_string($token) && $token !== "" ? "yes" : "no") . ", session id: " . substr(session_id(), 0, 6) . ")");
        respond(403, ["success" => false, "message" => "Your session expired. Refresh Menu Management and try again."]);
    }
}

try {
    require_once __DIR__ . "/config/database.php";
    $tiersReady = true;
    try {
        menu_ensure_tier_table($conn);
    } catch (Throwable $tierError) {
        $tiersReady = false;     // menu still works, only the tiers are off
        error_log("menu-management.php: tiers table: " . $tierError->getMessage());
    }

    // ---------- FRESH CSRF TOKEN (the page calls this when its token is stale) ----------
    if ($_SERVER["REQUEST_METHOD"] === "GET" && $action === "token") {
        if (!$canManage) {
            respond(403, ["success" => false, "message" => "Only an Admin or Manager can change the menu."]);
        }
        respond(200, ["success" => true, "csrf_token" => $_SESSION["menu_csrf_token"]]);
    }

    // ---------- LIST ----------
    if ($_SERVER["REQUEST_METHOD"] === "GET" && $action === "list") {
        $result = $conn->query(
            "SELECT menu_item_id, item_name, category, display_price, serving_specs, photo_path
             FROM menu_items
             ORDER BY menu_item_id ASC"
        );
        $rows = $result->fetch_all(MYSQLI_ASSOC);
        $tiersById = $tiersReady ? menu_load_tiers($conn, array_column($rows, "menu_item_id")) : [];
        $items = array_map(
            fn(array $row): array => menu_item_json($row, $tiersById[(int) $row["menu_item_id"]] ?? []),
            $rows
        );

        respond(200, [
            "success" => true,
            "items" => $items,
            "categories" => MENU_CATEGORIES,
            "can_manage" => $canManage,
            "csrf_token" => $canManage ? $_SESSION["menu_csrf_token"] : ""
        ]);
    }

    // ---------- ADD ----------
    if ($action === "add") {
        menu_require_manager($canManage);

        $name = menu_text("item_name", 150, "Item name");
        $category = menu_text("category", 40, "Category");
        $price = menu_text("display_price", 80, "Display price");
        $specs = menu_text("serving_specs", 255, "Serving / PAX specs");
        if (!in_array($category, MENU_CATEGORIES, true)) {
            respond(400, ["success" => false, "message" => "Choose a valid category."]);
        }
        $tiers = menu_read_tiers();          // validate BEFORE the photo is saved
        if ($tiers && !$tiersReady) {
            respond(500, ["success" => false, "message" => "The tiers table could not be created. Give the database user CREATE permission, or save without tiers."]);
        }
        $photo = menu_save_photo(true);
        $userId = (int) $_SESSION["user_id"];

        $conn->begin_transaction();
        $stmt = $conn->prepare(
            "INSERT INTO menu_items (item_name, category, display_price, serving_specs, photo_path, created_by)
             VALUES (?, ?, ?, ?, ?, ?)"
        );
        $stmt->bind_param("sssssi", $name, $category, $price, $specs, $photo, $userId);
        $stmt->execute();
        $id = (int) $conn->insert_id;
        menu_save_tiers($conn, $id, $tiers);
        $conn->commit();

        respond(201, [
            "success" => true,
            "message" => "Menu item added.",
            "item" => menu_item_json([
                "menu_item_id" => $id, "item_name" => $name, "category" => $category,
                "display_price" => $price, "serving_specs" => $specs, "photo_path" => $photo
            ], $tiers)
        ]);
    }

    // ---------- EDIT ----------
    if ($action === "edit") {
        menu_require_manager($canManage);

        $id = (int) ($_POST["menu_item_id"] ?? 0);
        $name = menu_text("item_name", 150, "Item name");
        $category = menu_text("category", 40, "Category");
        $price = menu_text("display_price", 80, "Display price");
        $specs = menu_text("serving_specs", 255, "Serving / PAX specs");
        if ($id < 1) {
            respond(400, ["success" => false, "message" => "Menu item not found."]);
        }
        if (!in_array($category, MENU_CATEGORIES, true)) {
            respond(400, ["success" => false, "message" => "Choose a valid category."]);
        }

        $find = $conn->prepare("SELECT photo_path FROM menu_items WHERE menu_item_id = ? LIMIT 1");
        $find->bind_param("i", $id);
        $find->execute();
        $row = $find->get_result()->fetch_assoc();
        if (!$row) {
            respond(404, ["success" => false, "message" => "Menu item not found."]);
        }

        $tiers = menu_read_tiers();          // validate BEFORE the photo is saved
        if ($tiers && !$tiersReady) {
            respond(500, ["success" => false, "message" => "The tiers table could not be created. Give the database user CREATE permission, or save without tiers."]);
        }
        $newPhoto = menu_save_photo(false);
        $photo = $newPhoto ?? $row["photo_path"];

        $conn->begin_transaction();
        $stmt = $conn->prepare(
            "UPDATE menu_items
             SET item_name = ?, category = ?, display_price = ?, serving_specs = ?, photo_path = ?
             WHERE menu_item_id = ?"
        );
        $stmt->bind_param("sssssi", $name, $category, $price, $specs, $photo, $id);
        $stmt->execute();
        menu_save_tiers($conn, $id, $tiers);
        $conn->commit();

        if ($newPhoto !== null) {
            menu_delete_photo($row["photo_path"]);
        }

        respond(200, [
            "success" => true,
            "message" => "Menu item updated.",
            "item" => menu_item_json([
                "menu_item_id" => $id, "item_name" => $name, "category" => $category,
                "display_price" => $price, "serving_specs" => $specs, "photo_path" => $photo
            ], $tiers)
        ]);
    }

    // ---------- DELETE ----------
    if ($action === "delete") {
        menu_require_manager($canManage);

        $id = (int) ($_POST["menu_item_id"] ?? 0);
        $find = $conn->prepare("SELECT photo_path FROM menu_items WHERE menu_item_id = ? LIMIT 1");
        $find->bind_param("i", $id);
        $find->execute();
        $row = $find->get_result()->fetch_assoc();
        if (!$row) {
            respond(404, ["success" => false, "message" => "Menu item not found."]);
        }

        $conn->begin_transaction();
        $stmt = $conn->prepare("DELETE FROM menu_items WHERE menu_item_id = ?");
        $stmt->bind_param("i", $id);
        $stmt->execute();
        menu_save_tiers($conn, $id, []);     // removes its tiers
        $conn->commit();
        menu_delete_photo($row["photo_path"]);

        respond(200, ["success" => true, "message" => "Menu item deleted."]);
    }

    respond(400, ["success" => false, "message" => "Unknown action."]);
} catch (Throwable $e) {
    if (isset($conn) && $conn instanceof mysqli) {
        try { $conn->rollback(); } catch (Throwable $ignored) { /* nothing open */ }
    }
    error_log("menu-management.php: " . $e->getMessage() . " @ line " . $e->getLine());
    respond(500, [
        "success" => false,
        "message" => "The menu could not be processed. Please try again.",
        // the real reason, only for Admin / Manager and only while MENU_SHOW_ERRORS is true
        "detail" => (MENU_SHOW_ERRORS && $canManage) ? $e->getMessage() . " (line " . $e->getLine() . ")" : ""
    ]);
}