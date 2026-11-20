<?php
declare(strict_types=1);

/**
 * Legal Pages API (Terms of Service + Privacy Policy). Admin only.
 *
 *   GET  ?action=token                      fresh CSRF token
 *   GET  ?action=list                       current text + version history of both documents
 *   GET  ?action=version&type=terms&version=3   the text of one old version (read only)
 *   POST ?action=save     type, content, change_note, csrf_token   -> new version
 *   POST ?action=restore  type, version, csrf_token                -> old text saved as a NEW version
 *
 * Needs the tables from legal-schema.sql. Nothing is ever overwritten or deleted:
 * every save and every restore adds a new row, so the history is complete.
 */

mysqli_report(MYSQLI_REPORT_ERROR | MYSQLI_REPORT_STRICT);
date_default_timezone_set("Asia/Manila");

// Shared session setup: secure cookie settings + 30-minute inactivity timeout (replies 401 "session_expired" as JSON).
define('SESSION_API', true);
require_once __DIR__ . '/session-init.php';

header("Content-Type: application/json; charset=utf-8");
header("Cache-Control: no-store");

const LEGAL_TYPES = ["terms", "privacy"];
const LEGAL_MAX_BYTES = 400000;
// While you set things up, Admin / Manager see the real reason of a server error. Set to false when you go live.
const LEGAL_SHOW_ERRORS = true;

/** Tags and attributes that may stay in the saved text. Everything else is removed. */
const LEGAL_ALLOWED = [
    "p" => [], "br" => [], "hr" => [],
    "strong" => [], "b" => [], "em" => [], "i" => [], "u" => [],
    "h2" => [], "h3" => [], "h4" => [],
    "ul" => [], "ol" => [], "li" => [], "blockquote" => [],
    "a" => ["href", "target", "rel"],
    "table" => [], "thead" => [], "tbody" => [], "tr" => [],
    "th" => ["colspan", "rowspan"], "td" => ["colspan", "rowspan"],
    "div" => ["class"], "span" => ["class"],
];
/** Removed together with everything inside them. */
const LEGAL_DROP = [
    "script", "style", "iframe", "object", "embed", "form", "input", "button", "textarea", "select",
    "option", "svg", "math", "link", "meta", "noscript", "template", "base", "frame", "frameset",
    "applet", "audio", "video", "img", "head", "title",
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

$sessionRole = strtolower(trim((string) ($_SESSION["role_name"] ?? "")));
if ($sessionRole !== "admin") {
    respond(403, ["success" => false, "message" => "Only an Admin can edit the Terms and Privacy Policy."]);
}

$action = (string) ($_GET["action"] ?? "");

if (empty($_SESSION["legal_csrf_token"])) {
    $_SESSION["legal_csrf_token"] = bin2hex(random_bytes(32));
}

/* ---------------- helpers ---------------- */

function legal_type($raw): string
{
    $type = is_string($raw) ? strtolower(trim($raw)) : "";
    if (!in_array($type, LEGAL_TYPES, true)) {
        respond(400, ["success" => false, "message" => "Choose Terms of Service or Privacy Policy."]);
    }
    return $type;
}

function legal_require_post(): void
{
    if ($_SERVER["REQUEST_METHOD"] !== "POST") {
        respond(405, ["success" => false, "message" => "Method not allowed."]);
    }
    $token = $_POST["csrf_token"] ?? "";
    if (!is_string($token) || $token === "") {
        $token = $_SERVER["HTTP_X_CSRF_TOKEN"] ?? "";
    }
    if (!is_string($token) || !hash_equals((string) $_SESSION["legal_csrf_token"], $token)) {
        respond(403, ["success" => false, "message" => "Your session expired. Refresh the page and try again."]);
    }
}

function legal_unwrap(DOMNode $parent, DOMNode $child): void
{
    while ($child->firstChild) {
        $parent->insertBefore($child->firstChild, $child);
    }
    $parent->removeChild($child);
}

function legal_clean_children(DOMNode $parent, DOMDocument $dom): void
{
    foreach (iterator_to_array($parent->childNodes) as $child) {
        if ($child instanceof DOMText) {
            continue;
        }
        if (!($child instanceof DOMElement)) {
            $parent->removeChild($child);      // comments, processing instructions
            continue;
        }

        $tag = strtolower($child->nodeName);
        if (in_array($tag, LEGAL_DROP, true)) {
            $parent->removeChild($child);
            continue;
        }

        legal_clean_children($child, $dom);    // clean the inside first

        if (!isset(LEGAL_ALLOWED[$tag])) {
            legal_unwrap($parent, $child);     // keep the text, drop the unknown tag (font, section, ...)
            continue;
        }

        foreach (iterator_to_array($child->attributes) as $attr) {
            if (!in_array(strtolower($attr->nodeName), LEGAL_ALLOWED[$tag], true)) {
                $child->removeAttributeNode($attr);   // style, onclick, id, ...
            }
        }

        if ($tag === "span") {
            // only a [bracket] placeholder keeps its yellow highlight; once it is filled in, the highlight goes
            $isPlaceholder = trim($child->getAttribute("class")) === "fill"
                && preg_match('/^\s*\[.*\]\s*$/su', $child->textContent) === 1;
            if (!$isPlaceholder) {
                legal_unwrap($parent, $child);
            }
            continue;
        }

        if ($tag === "div") {
            if (trim($child->getAttribute("class")) === "table-wrap") {
                continue;
            }
            $p = $dom->createElement("p");     // a plain div made by the editor becomes a paragraph
            while ($child->firstChild) {
                $p->appendChild($child->firstChild);
            }
            $parent->replaceChild($p, $child);
            continue;
        }

        if ($tag === "a") {
            $href = trim($child->getAttribute("href"));
            if ($href === "" || preg_match('~^(https?://|mailto:|tel:|#)~i', $href) !== 1) {
                legal_unwrap($parent, $child); // javascript: and similar links are removed
                continue;
            }
            if ($href[0] === "#") {
                $child->removeAttribute("target");
                $child->removeAttribute("rel");
            } else {
                $child->setAttribute("target", "_blank");
                $child->setAttribute("rel", "noopener noreferrer");
            }
        }
    }
}

/** Returns safe HTML: only the allowed tags and attributes above. */
function legal_clean_html(string $html): string
{
    $html = trim($html);
    if ($html === "") {
        return "";
    }

    $previous = libxml_use_internal_errors(true);
    $dom = new DOMDocument("1.0", "UTF-8");
    $dom->loadHTML(
        '<?xml encoding="UTF-8"><div id="legal-root">' . $html . '</div>',
        LIBXML_HTML_NOIMPLIED | LIBXML_HTML_NODEFDTD
    );
    libxml_clear_errors();
    libxml_use_internal_errors($previous);

    $root = (new DOMXPath($dom))->query('//div[@id="legal-root"]')->item(0);
    if (!$root) {
        return "";
    }

    legal_clean_children($root, $dom);

    $out = "";
    foreach ($root->childNodes as $node) {
        $out .= $dom->saveHTML($node);
    }
    return trim($out);
}

/**
 * Adds a new version and makes it the current one.
 * Returns the new version number, or 0 when the text is identical to the current version.
 */
function legal_publish(mysqli $conn, string $type, string $content, string $note, int $userId): int
{
    $conn->begin_transaction();

    $stmt = $conn->prepare(
        "SELECT version, content FROM legal_documents WHERE doc_type = ? ORDER BY version DESC LIMIT 1 FOR UPDATE"
    );
    $stmt->bind_param("s", $type);
    $stmt->execute();
    $latest = $stmt->get_result()->fetch_assoc();
    $stmt->close();

    if ($latest && trim((string) $latest["content"]) === $content) {
        $conn->rollback();
        return 0;
    }

    $next = $latest ? (int) $latest["version"] + 1 : 1;
    $today = date("Y-m-d");

    $stmt = $conn->prepare("UPDATE legal_documents SET is_current = 0 WHERE doc_type = ?");
    $stmt->bind_param("s", $type);
    $stmt->execute();
    $stmt->close();

    $stmt = $conn->prepare(
        "INSERT INTO legal_documents (doc_type, version, content, change_note, effective_date, is_current, created_by)
         VALUES (?, ?, ?, ?, ?, 1, ?)"
    );
    $stmt->bind_param("sisssi", $type, $next, $content, $note, $today, $userId);
    $stmt->execute();
    $stmt->close();

    $conn->commit();
    return $next;
}

/* ---------------- actions ---------------- */

try {
    require_once __DIR__ . "/config/database.php";

    // ---------- fresh CSRF token ----------
    if ($_SERVER["REQUEST_METHOD"] === "GET" && $action === "token") {
        respond(200, ["success" => true, "csrf_token" => $_SESSION["legal_csrf_token"]]);
    }

    // ---------- list ----------
    if ($_SERVER["REQUEST_METHOD"] === "GET" && $action === "list") {
        $result = $conn->query(
            "SELECT d.doc_type, d.version, d.change_note, d.effective_date, d.is_current, d.created_at,
                    u.full_name AS author,
                    IF(d.is_current = 1, d.content, NULL) AS content
             FROM legal_documents d
             LEFT JOIN users u ON u.user_id = d.created_by
             ORDER BY d.doc_type ASC, d.version DESC"
        );

        $documents = [];
        foreach (LEGAL_TYPES as $type) {
            $documents[$type] = ["current" => null, "versions" => []];
        }
        foreach ($result->fetch_all(MYSQLI_ASSOC) as $row) {
            $item = [
                "version" => (int) $row["version"],
                "change_note" => (string) ($row["change_note"] ?? ""),
                "effective_date" => $row["effective_date"],
                "created_at" => $row["created_at"],
                "author" => $row["author"] ?? "System",
                "is_current" => (int) $row["is_current"] === 1,
            ];
            $documents[$row["doc_type"]]["versions"][] = $item;
            if ($item["is_current"]) {
                $documents[$row["doc_type"]]["current"] = $item + ["content" => (string) $row["content"]];
            }
        }

        respond(200, [
            "success" => true,
            "documents" => $documents,
            "csrf_token" => $_SESSION["legal_csrf_token"],
        ]);
    }

    // ---------- one old version (read only) ----------
    if ($_SERVER["REQUEST_METHOD"] === "GET" && $action === "version") {
        $type = legal_type($_GET["type"] ?? "");
        $version = (int) ($_GET["version"] ?? 0);

        $stmt = $conn->prepare(
            "SELECT version, content, change_note, effective_date, created_at
             FROM legal_documents WHERE doc_type = ? AND version = ? LIMIT 1"
        );
        $stmt->bind_param("si", $type, $version);
        $stmt->execute();
        $row = $stmt->get_result()->fetch_assoc();
        $stmt->close();
        if (!$row) {
            respond(404, ["success" => false, "message" => "That version was not found."]);
        }
        respond(200, ["success" => true, "version" => (int) $row["version"], "content" => (string) $row["content"]]);
    }

    // ---------- save = new version ----------
    if ($action === "save") {
        legal_require_post();

        $type = legal_type($_POST["type"] ?? "");
        $rawContent = (string) ($_POST["content"] ?? "");
        if (strlen($rawContent) > LEGAL_MAX_BYTES) {
            respond(400, ["success" => false, "message" => "The text is too long."]);
        }
        $content = legal_clean_html($rawContent);
        if (trim(strip_tags($content)) === "") {
            respond(400, ["success" => false, "message" => "The text is empty."]);
        }

        $note = trim((string) ($_POST["change_note"] ?? ""));
        if ($note === "") {
            respond(400, ["success" => false, "message" => "Write a short note about what you changed."]);
        }
        if (mb_strlen($note, "UTF-8") > 255) {
            respond(400, ["success" => false, "message" => "The note must be at most 255 characters."]);
        }

        $version = legal_publish($conn, $type, $content, $note, (int) $_SESSION["user_id"]);
        if ($version === 0) {
            respond(409, ["success" => false, "message" => "No changes to save: the text is the same as the current version."]);
        }
        respond(201, ["success" => true, "message" => "Saved as version $version.", "version" => $version]);
    }

    // ---------- restore an old version (saved as a NEW version) ----------
    if ($action === "restore") {
        legal_require_post();

        $type = legal_type($_POST["type"] ?? "");
        $old = (int) ($_POST["version"] ?? 0);

        $stmt = $conn->prepare("SELECT content FROM legal_documents WHERE doc_type = ? AND version = ? LIMIT 1");
        $stmt->bind_param("si", $type, $old);
        $stmt->execute();
        $row = $stmt->get_result()->fetch_assoc();
        $stmt->close();
        if (!$row) {
            respond(404, ["success" => false, "message" => "That version was not found."]);
        }

        $version = legal_publish($conn, $type, trim((string) $row["content"]), "Restored version $old", (int) $_SESSION["user_id"]);
        if ($version === 0) {
            respond(409, ["success" => false, "message" => "That is already the current text."]);
        }
        respond(201, ["success" => true, "message" => "Version $old restored as version $version.", "version" => $version]);
    }

    respond(400, ["success" => false, "message" => "Unknown action."]);
} catch (Throwable $e) {
    if (isset($conn) && $conn instanceof mysqli) {
        try { $conn->rollback(); } catch (Throwable $ignored) { /* nothing open */ }
    }
    error_log("legal-api.php: " . $e->getMessage() . " @ line " . $e->getLine());
    respond(500, [
        "success" => false,
        "message" => "The legal pages could not be processed. Please try again.",
        "detail" => LEGAL_SHOW_ERRORS ? $e->getMessage() . " (line " . $e->getLine() . ")" : "",
    ]);
}