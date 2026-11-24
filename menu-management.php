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
 * Database structure is provisioned centrally from database/catering_crm.sql.
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

const MENU_CATEGORIES = ["Lechon", "Bilao", "Viands"];
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
        "status" => $row["status"] ?? "Active",
        "tiers" => $tiers
    ];
}

function menu_base_price(string $displayPrice): ?float
{
    if (!preg_match('/\d[\d,]*(?:\.\d+)?/', $displayPrice, $match)) return null;
    return round((float)str_replace(',', '', $match[0]), 2);
}

/** Schema is provisioned centrally by database/catering_crm.sql. */
function menu_ensure_tier_table(mysqli $conn): void
{
    // Schema is installed from database/catering_crm.sql, never mutated in requests.
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
        foreach ($out as $prior) {
            if (mb_strtolower($prior["name"], "UTF-8") === mb_strtolower($name, "UTF-8")) {
                respond(400, ["success" => false, "message" => "Portion tier names must be unique for this menu item."]);
            }
        }
        $tierId = isset($row["tier_id"]) && is_numeric($row["tier_id"]) ? (int) $row["tier_id"] : 0;
        $out[] = ["tier_id" => $tierId, "name" => $name, "price" => round((float) $clean, 2), "pax" => $pax];
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
        "SELECT menu_item_id, tier_id, tier_name, price, pax_description
         FROM menu_item_tiers
         WHERE menu_item_id IN ($in) AND is_active = 1
         ORDER BY menu_item_id ASC, sort_order ASC, tier_id ASC"
    );
    $by = [];
    foreach ($result->fetch_all(MYSQLI_ASSOC) as $r) {
        $by[(int) $r["menu_item_id"]][] = [
            "tier_id" => (int) $r["tier_id"],
            "name" => $r["tier_name"],
            "price" => (float) $r["price"],
            "pax" => $r["pax_description"]
        ];
    }
    return $by;
}

/** Update current tiers in place; retain referenced removed tiers as inactive history. */
function menu_save_tiers(mysqli $conn, int $id, array $tiers): void
{
    if (!($GLOBALS["tiersReady"] ?? true)) {
        return;   // the tiers table is not available: the rest of the menu still works
    }
    $existing = $conn->prepare("SELECT tier_id FROM menu_item_tiers WHERE menu_item_id = ? AND is_active = 1");
    $existing->bind_param("i", $id);
    $existing->execute();
    $existingIds = array_map('intval', array_column($existing->get_result()->fetch_all(MYSQLI_ASSOC), 'tier_id'));
    $submittedIds = [];
    foreach ($tiers as $tier) {
        if ($tier['tier_id'] > 0) {
            if (!in_array($tier['tier_id'], $existingIds, true)) {
                throw new RuntimeException("A submitted menu tier does not belong to this item.");
            }
            $submittedIds[] = $tier['tier_id'];
        }
    }
    if (count(array_unique($submittedIds)) !== count($submittedIds)) {
        throw new RuntimeException("A menu tier was submitted more than once.");
    }

    $removedIds = array_values(array_diff($existingIds, $submittedIds));
    foreach ($removedIds as $tierId) {
        $refs = $conn->prepare(
            "SELECT (SELECT COUNT(*) FROM inquiry_items WHERE tier_id = ?) +
                    (SELECT COUNT(*) FROM quotation_items WHERE tier_id = ?) +
                    (SELECT COUNT(*) FROM booking_items WHERE tier_id = ?) AS ref_count"
        );
        $refs->bind_param("iii", $tierId, $tierId, $tierId);
        $refs->execute();
        $referenced = (int) ($refs->get_result()->fetch_assoc()['ref_count'] ?? 0) > 0;
        if ($referenced) {
            $deactivate = $conn->prepare("UPDATE menu_item_tiers SET is_active = 0 WHERE tier_id = ? AND menu_item_id = ?");
            $deactivate->bind_param("ii", $tierId, $id);
            $deactivate->execute();
        } else {
            $delete = $conn->prepare("DELETE FROM menu_item_tiers WHERE tier_id = ? AND menu_item_id = ?");
            $delete->bind_param("ii", $tierId, $id);
            $delete->execute();
        }
    }

    $upd = $conn->prepare(
        "UPDATE menu_item_tiers SET tier_name = ?, price = ?, pax_description = ?, sort_order = ?, is_active = 1
         WHERE tier_id = ? AND menu_item_id = ?"
    );
    $restore = $conn->prepare("SELECT tier_id FROM menu_item_tiers WHERE menu_item_id = ? AND tier_name = ? AND is_active = 0 LIMIT 1");
    $ins = $conn->prepare(
        "INSERT INTO menu_item_tiers (menu_item_id, tier_name, price, pax_description, sort_order, is_active)
         VALUES (?, ?, ?, ?, ?, 1)"
    );
    foreach (array_values($tiers) as $order => $t) {
        $name = $t["name"];
        $price = $t["price"];
        $pax = $t["pax"];
        if ($t['tier_id'] > 0) {
            $tierId = $t['tier_id'];
            $upd->bind_param("sdsiii", $name, $price, $pax, $order, $tierId, $id);
            $upd->execute();
        } else {
            $restore->bind_param("is", $id, $name);
            $restore->execute();
            $archived = $restore->get_result()->fetch_assoc();
            if ($archived) {
                $tierId = (int) $archived['tier_id'];
                $upd->bind_param("sdsiii", $name, $price, $pax, $order, $tierId, $id);
                $upd->execute();
            } else {
                $ins->bind_param("isdsi", $id, $name, $price, $pax, $order);
                $ins->execute();
            }
        }
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
            "SELECT menu_item_id, item_name, category, display_price, serving_specs, photo_path, status
             FROM menu_items
             WHERE status = 'Active' AND category IN ('Lechon', 'Bilao', 'Viands')
             ORDER BY FIELD(category, 'Lechon', 'Bilao', 'Viands'), menu_item_id ASC"
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
        $price = trim((string) ($_POST["display_price"] ?? ""));
        $specs = trim((string) ($_POST["serving_specs"] ?? ""));
        if (mb_strlen($specs, "UTF-8") > 255) respond(400, ["success" => false, "message" => "Serving / PAX specs must be at most 255 characters."]);
        if (!in_array($category, MENU_CATEGORIES, true)) {
            respond(400, ["success" => false, "message" => "Choose a valid category."]);
        }
        $tiers = menu_read_tiers();          // validate BEFORE the photo is saved
        if (($category === "Bilao" && $tiers) || ($category !== "Bilao" && !$tiers)) respond(400, ["success" => false, "message" => "Bilao items use one item price; Lechon and Viands use pricing tiers."]);
        if ($category === "Bilao" && $price === "") respond(400, ["success" => false, "message" => "Bilao needs an item price."]);
        $tierPrices = array_column($tiers, "price");
        if ($category !== "Bilao") $price = "₱" . number_format(min($tierPrices), 2) . (min($tierPrices) !== max($tierPrices) ? " – ₱" . number_format(max($tierPrices), 2) : "");
        $basePrice = $category === "Bilao" ? menu_base_price($price) : null;
        if ($category === "Bilao" && $basePrice === null) respond(400, ["success" => false, "message" => "Bilao needs a valid item price."]);
        if ($tiers && !$tiersReady) {
            respond(500, ["success" => false, "message" => "The menu tiers table is missing. Install database/catering_crm.sql and try again."]);
        }
        $photo = menu_save_photo(true);
        $userId = (int) $_SESSION["user_id"];

        $conn->begin_transaction();
        $stmt = $conn->prepare(
            "INSERT INTO menu_items (item_name, category, base_price, display_price, serving_specs, photo_path, created_by)
             VALUES (?, ?, ?, ?, ?, ?, ?)"
        );
        $stmt->bind_param("ssssssi", $name, $category, $basePrice, $price, $specs, $photo, $userId);
        $stmt->execute();
        $id = (int) $conn->insert_id;
        menu_save_tiers($conn, $id, $tiers);
        $conn->commit();
        $tiers = menu_load_tiers($conn, [$id])[$id] ?? [];

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
        $price = trim((string) ($_POST["display_price"] ?? ""));
        $specs = trim((string) ($_POST["serving_specs"] ?? ""));
        if (mb_strlen($specs, "UTF-8") > 255) respond(400, ["success" => false, "message" => "Serving / PAX specs must be at most 255 characters."]);
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
        if (($category === "Bilao" && $tiers) || ($category !== "Bilao" && !$tiers)) respond(400, ["success" => false, "message" => "Bilao items use one item price; Lechon and Viands use pricing tiers."]);
        if ($category === "Bilao" && $price === "") respond(400, ["success" => false, "message" => "Bilao needs an item price."]);
        $tierPrices = array_column($tiers, "price");
        if ($category !== "Bilao") $price = "₱" . number_format(min($tierPrices), 2) . (min($tierPrices) !== max($tierPrices) ? " – ₱" . number_format(max($tierPrices), 2) : "");
        $basePrice = $category === "Bilao" ? menu_base_price($price) : null;
        if ($category === "Bilao" && $basePrice === null) respond(400, ["success" => false, "message" => "Bilao needs a valid item price."]);
        if ($tiers && !$tiersReady) {
            respond(500, ["success" => false, "message" => "The menu tiers table is missing. Install database/catering_crm.sql and try again."]);
        }
        $newPhoto = menu_save_photo(false);
        $photo = $newPhoto ?? $row["photo_path"];

        $conn->begin_transaction();
        $stmt = $conn->prepare(
            "UPDATE menu_items
             SET item_name = ?, category = ?, base_price = ?, display_price = ?, serving_specs = ?, photo_path = ?
             WHERE menu_item_id = ?"
        );
        $stmt->bind_param("ssssssi", $name, $category, $basePrice, $price, $specs, $photo, $id);
        $stmt->execute();
        menu_save_tiers($conn, $id, $tiers);
        $conn->commit();
        $tiers = menu_load_tiers($conn, [$id])[$id] ?? [];

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

    // ---------- ARCHIVE (preserves all historical references) ----------
    if ($action === "delete" || $action === "archive") {
        menu_require_manager($canManage);
        $id = (int) ($_POST["menu_item_id"] ?? 0);
        $stmt = $conn->prepare("UPDATE menu_items SET status = 'Archived', archived_at = CURRENT_TIMESTAMP WHERE menu_item_id = ? AND status = 'Active'");
        $stmt->bind_param("i", $id);
        $stmt->execute();
        if ($stmt->affected_rows < 1) respond(404, ["success" => false, "message" => "Active menu item not found."]);
        respond(200, ["success" => true, "message" => "Menu item archived."]);
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
