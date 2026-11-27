// Handle role-based navigation, page loading, and logout.
// Role-specific pages are mapped in CRM_ROLE_FILES below.
// Normalize the role names saved by the login flow.

function crmNormalizeRole(raw) {
  const r = String(raw || 'admin').toLowerCase().replace(/[_-]+/g, ' ').replace(/\s+/g, ' ').trim();
  if (r === 'cs' || r === 'cs staff' || r === 'customer service' || r === 'customer service staff') return 'customer service';
  if (r === 'sales' || r === 'sales staff') return 'sales staff';
  return r;
}

const CRM_ROLE = crmNormalizeRole(localStorage.getItem("userRole"));

// Add the role class used by CSS to control visibility.
document.documentElement.classList.add("role-" + CRM_ROLE.replace(/\s+/g, "-"));

// Map dashboard and report pages to their role-specific files.
const CRM_ROLE_FILES = {
  "admin":            { dashboard: "admin-dashboard.html",   reports: "manager-admin-report.html", inbox: "manager-admin-inbox.html", tickets: "manager-admin-ticket.html" },
  "manager":          { dashboard: "manager-dashboard.html", reports: "manager-admin-report.html", inbox: "manager-admin-inbox.html", tickets: "manager-admin-ticket.html" },
  "customer service": { dashboard: "cs-dashboard.html",      reports: "cs-report.html",    inbox: "cs-inbox.html", tickets: "cs-ticket.html" },
  "sales staff":      { dashboard: "sales-dashboard.html",   reports: "sales-report.html", inbox: "sales-inbox.html" },
};

// Convert a role-specific filename back to its shared page key.
function crmPageKey(url) {
  for (const role in CRM_ROLE_FILES) {
    for (const key in CRM_ROLE_FILES[role]) {
      if (CRM_ROLE_FILES[role][key] === url) return key;
    }
  }
  return url;
}

// Resolve a shared page key to this role's file.
function crmResolvePage(key) {
  const files = CRM_ROLE_FILES[CRM_ROLE] || {};
  return files[key] || key;
}

// Track known sidebar pages and those allowed for this role.
const crmKnownPages = new Set();
const crmAllowedPages = new Set();

// Show only sidebar items allowed for this role.
function crmApplyRoleToSidebar() {
  crmKnownPages.clear();
  crmAllowedPages.clear();

  document.querySelectorAll(".sidebar-nav .nav-item[data-role]").forEach((item) => {
    const roles = item.getAttribute("data-role").split(",").map((r) => crmNormalizeRole(r));
    const allowed = roles.includes("all") || roles.includes(CRM_ROLE);
    item.style.display = allowed ? "" : "none";

    const link = item.querySelector("a");
    const match = link ? (link.getAttribute("onclick") || "").match(/loadPage\('([^']+)'/) : null;
    if (match) {
      const key = crmPageKey(match[1]);
      crmKnownPages.add(key);
      if (allowed) crmAllowedPages.add(key);
    }
  });

  crmShowUserInfo();

  // Let CSS show role-dependent text after the role is applied.
  document.documentElement.classList.add("role-ready");
}

// ---- Dropdown groups in the sidebar (e.g. Sales Staff > Catering Operations) ----

// True when the sidebar shows icons only (collapsed, or a phone-size screen).
function crmSidebarIsCompact() {
  // The phone drawer shows full labels, so it is not "compact" while it is open.
  if (document.documentElement.classList.contains("crm-drawer-open")) return false;
  const sidebar = document.getElementById("crmSidebar");
  return !!(sidebar && sidebar.classList.contains("collapsed")) ||
    document.documentElement.classList.contains("sidebar-is-collapsed") ||
    window.matchMedia("(max-width: 768px)").matches;
}

// Open or close one group. In icon-only mode the list is a flyout next to the icon.
function crmSetGroupOpen(group, open) {
  group.classList.toggle("open", open);
  const toggle = group.querySelector(".nav-group-toggle");
  if (toggle) toggle.setAttribute("aria-expanded", open ? "true" : "false");
  if (open && toggle && crmSidebarIsCompact()) {
    const menu = group.querySelector(".nav-submenu");
    if (menu) menu.style.setProperty("--flyout-top", toggle.getBoundingClientRect().top + "px");
  }
}

function crmCloseAllGroups() {
  document.querySelectorAll(".sidebar-nav .nav-group.open").forEach((group) => crmSetGroupOpen(group, false));
}

// Mark and open the group that holds the active page. Sales Staff keeps Catering Operations
// expanded as a compact-sidebar flyout too; other compact-sidebar groups retain their behavior.
function crmSyncNavGroups() {
  const compact = crmSidebarIsCompact();
  document.querySelectorAll(".sidebar-nav .nav-group").forEach((group) => {
    const hasActive = !!group.querySelector(".nav-sublink.active");
    const isSalesCatering = group.dataset.role === "sales staff";
    group.classList.toggle("has-active", hasActive);
    crmSetGroupOpen(group, hasActive && (!compact || isSalesCatering));
  });
}

// Labels used in the sidebar and profile menu.
const CRM_ROLE_LABELS = {
  "admin": "Admin",
  "manager": "Manager",
  "customer service": "Customer Service",
  "sales staff": "Sales Staff",
  "customer": "Customer"
};

// Fill the sidebar subtitle and profile details from local storage.
function crmShowUserInfo() {
  const label = CRM_ROLE_LABELS[CRM_ROLE] || CRM_ROLE.replace(/\b\w/g, (c) => c.toUpperCase());
  const name = (localStorage.getItem("userName") || "").trim() || label;

  const subtitle = document.querySelector(".brand-subtitle");
  if (subtitle) subtitle.textContent = label;

  const nameEl = document.getElementById("dropdownUserName");
  if (nameEl) nameEl.textContent = name;

  const roleEl = document.getElementById("dropdownUserRole");
  if (roleEl) roleEl.textContent = label;

  // Header avatar: first letter of the first name (like a Google account).
  const initialEl = document.getElementById("userAvatarInitial");
  if (initialEl) {
    const first = name.split(/\s+/).filter(Boolean)[0] || "";
    initialEl.textContent = (Array.from(first)[0] || "?").toUpperCase();
  }

  // Only customers can have a profile photo (set in Profile Settings). Staff keep the letter.
  if (CRM_ROLE === "customer" && !window.crmHeaderPhotoRequested) {
    window.crmHeaderPhotoRequested = true;
    fetch("customer-account-api.php?action=get", { credentials: "same-origin" })
      .then((res) => res.json())
      .then((data) => { if (data && data.success && data.profile) window.crmSetHeaderPhoto(data.profile.photo_url); })
      .catch(() => {});
  }
}

// Show (or clear) the customer's photo on the header avatar button. Falls back to the letter when there is none.
window.crmSetHeaderPhoto = function (url) {
  const button = document.getElementById("userMenuDropdown");
  if (!button) return;
  button.querySelector(".user-avatar-photo")?.remove();
  button.classList.remove("has-photo");
  const safe = String(url || "").trim();
  if (!safe || /^\s*(javascript|data):/i.test(safe)) return;
  const img = document.createElement("img");
  img.className = "user-avatar-photo";
  img.alt = "";
  img.addEventListener("error", () => { img.remove(); button.classList.remove("has-photo"); });
  img.src = safe;
  button.append(img);
  button.classList.add("has-photo");
};

// Apply the role immediately when the sidebar is already in the DOM.
if (document.getElementById("crmSidebar")) crmApplyRoleToSidebar();

// Handle logout, page links, and the initial page.
document.addEventListener("DOMContentLoaded", () => {
  const logoutConfirmBtn = document.getElementById("logoutConfirmBtn");

  // Clear locally stored user data when the user confirms logout.
  if (logoutConfirmBtn) {
    logoutConfirmBtn.addEventListener("click", () => {
      localStorage.removeItem("userRole");
      localStorage.removeItem("userName");
      localStorage.removeItem("userToken");
      localStorage.removeItem("activePage");
    });
  }

  // Keep links in the page area inside the application shell.
  document.addEventListener("click", (e) => {
    const link = e.target.closest("#mainContentArea a[href]");
    if (!link) return;

    const href = link.getAttribute("href");
    if (!href || href.startsWith("#") || !href.endsWith(".html")) return;

    e.preventDefault();
    loadPage(href);
  });

  // Dropdown groups: click the group to open or close it.
  document.querySelectorAll(".sidebar-nav .nav-group-toggle").forEach((toggle) => {
    toggle.addEventListener("click", () => {
      const group = toggle.closest(".nav-group");
      const willOpen = !group.classList.contains("open");
      crmCloseAllGroups(); /* only one dropdown open at a time */
      crmSetGroupOpen(group, willOpen);
    });
  });

  // Icon-only mode: close the flyout when clicking elsewhere or pressing Escape.
  document.addEventListener("click", (e) => {
    if (crmSidebarIsCompact() && !e.target.closest(".nav-group")) crmCloseAllGroups();
  });
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && crmSidebarIsCompact()) crmCloseAllGroups();
  });

  // Re-sync after the sidebar is collapsed/expanded or the window is resized.
  const burger = document.getElementById("burgerToggle");
  if (burger) burger.addEventListener("click", () => setTimeout(crmSyncNavGroups, 0));
  window.addEventListener("resize", crmSyncNavGroups);

  // Set allowed pages before applying the page guard.
  crmApplyRoleToSidebar();

  // Email links may request an existing customer page. Resolve only known customer pages here.
  const emailParams = new URLSearchParams(window.location.search);
  const emailPage = emailParams.get("crm_page");
  const customerEmailPages = new Set(["customer-home.html", "customer-inquiries.html", "customer-bookings.html", "customer-inbox.html"]);
  const requestedCustomerPage = CRM_ROLE === "customer" && customerEmailPages.has(emailPage) ? emailPage : "";
  if (requestedCustomerPage === "customer-bookings.html") {
    const bookingId = emailParams.get("booking_id") || "";
    if (/^[1-9][0-9]*$/.test(bookingId)) {
      try { sessionStorage.setItem("crmOpenBookingId", bookingId); } catch (error) { /* booking list remains available */ }
    }
  }

  // Restore the last page, or open this role's dashboard, unless an email requested a customer page.
  const activePage = requestedCustomerPage || localStorage.getItem("activePage") || "dashboard";
  loadPage(activePage);
});

// Load page content into the application shell.

// Fetch a page, then try the configured fallback if the request fails.
const PAGES_FOLDER = 'html-content-navbar/';
function crmFetchPage(file, fallback) {
  const fetchOptions = file === "settings-pages.html" || file === "ticket-pages.html" || file === "manager-admin-customers.html"
    ? { cache: "no-store" }
    : undefined;
  return fetch(PAGES_FOLDER + file, fetchOptions)
    .then((response) => {
      if (!response.ok) throw new Error("Could not fetch page: " + file);
      return response.text();
    })
    .catch((error) => {
      if (fallback && fallback !== file) {
        console.warn(file + " was not found, showing " + fallback + " instead.");
        return crmFetchPage(fallback);
      }
      throw error;
    });
}

/**
 * Load a page into #mainContentArea and update the active sidebar link.
 * pageUrl may be a shared page key or a filename.
 */
// Old page names that were renamed: a browser that saved the old name still opens the right page.
const CRM_PAGE_ALIASES = { "sales-available-inquiries.html": "sales-inquiries.html", "manager-inbox.html": "inbox" };

function loadPage(pageUrl, clickedElement = null) {
  let key = crmPageKey(pageUrl);
  key = CRM_PAGE_ALIASES[key] || key;

  // Redirect to the dashboard if this role cannot open a known page.
  if (crmKnownPages.has(key) && !crmAllowedPages.has(key)) {
    key = "dashboard";
    clickedElement = null;
  }

  // Customers have no separate dashboard file: their "dashboard" is the Home page.
  // This also covers a first login or an old saved page that this role cannot open.
  if (CRM_ROLE === "customer" && key === "dashboard") {
    key = "customer-home.html";
    clickedElement = null;
  }

  const file = crmResolvePage(key);
  const fallbackFile = key === "dashboard"
    ? null
    : (CRM_ROLE_FILES.admin && CRM_ROLE_FILES.admin[key]) || key;

  // Update the active sidebar link.
  const navLinks = document.querySelectorAll(".sidebar-nav .nav-link");
  navLinks.forEach((link) => {
    link.classList.remove("active");
    const onclickAttr = link.getAttribute("onclick") || "";
    if (clickedElement && link === clickedElement) {
      link.classList.add("active");
    } else if (!clickedElement && onclickAttr.includes("'" + key + "'")) {
      link.classList.add("active");
    }
  });

  // Keep dropdown groups in step with the active page.
  crmSyncNavGroups();

  // Save the shared key so it remains valid if the role changes.
  localStorage.setItem("activePage", key);

  // Fetch and render the page.
  crmFetchPage(file, fallbackFile)
    .then((html) => {
      const container = document.getElementById("mainContentArea");
      if (container) {
        // Keep shared styles and scripts in the authenticated app shell.
const doc = new DOMParser().parseFromString(html, "text/html");
doc.querySelectorAll("script, link").forEach((n) => n.remove());
container.innerHTML = doc.body.innerHTML;

        // Initialize page-specific behavior after inserting its markup.
        if (key === "settings-pages.html" && typeof window.initCrmSettingsPage === "function") {
          window.initCrmSettingsPage();
        }
        // Render status badges if the helper is available.
        if (typeof renderStaticStatusBadges === "function") {
          renderStaticStatusBadges();
        }

        // Load page data and initialize table filters.
        if (typeof window.loadCrmPageData === "function") {
          window.loadCrmPageData();
        } else if (typeof window.initTableSearchAndFilters === "function") {
          window.initTableSearchAndFilters();
        }
      }
    })
    .catch((error) => {
      console.error("Error loading page:", error);
      // Forget a saved page that cannot be opened, so a refresh goes back to the dashboard.
      if (localStorage.getItem("activePage") === key) localStorage.removeItem("activePage");
      const container = document.getElementById("mainContentArea");
      if (container) {
        // Name the file (and the reason) so a missing page file is easy to spot.
        const alertBox = document.createElement("div");
        alertBox.className = "alert alert-danger";
        alertBox.setAttribute("role", "alert");
        alertBox.textContent = "This page could not be loaded (" + PAGES_FOLDER + file + "). " +
          "Check that the file exists in that folder, then refresh the application. " +
          (error && error.message ? "Details: " + error.message : "");
        container.replaceChildren(alertBox);
      }
    });
}

// ---- Tooltip for the icon-only sidebar (and the burger when collapsed) ----
// Shown on hover / keyboard focus, or on tap / long-press for touch screens.
// It is one fixed-position bubble, so the sidebar's overflow: hidden cannot clip it.
(function () {
  let tip = null;
  let hideTimer = null;
  const TARGETS = ".sidebar-nav .nav-link:not(.nav-sublink), #burgerToggle";

  function getTip() {
    if (!tip) {
      tip = document.createElement("div");
      tip.className = "crm-nav-tip";
      tip.setAttribute("role", "tooltip");
      document.body.appendChild(tip);
    }
    return tip;
  }

  function hasCollapsedClass() {
    const sidebar = document.getElementById("crmSidebar");
    return !!(sidebar && sidebar.classList.contains("collapsed")) ||
      document.documentElement.classList.contains("sidebar-is-collapsed");
  }

  // Text for one target. Group toggles keep their title in data-tip so the browser's own
  // tooltip does not appear on top of ours.
  function labelFor(el) {
    if (el.id === "burgerToggle") return hasCollapsedClass() ? "Expand menu" : "";
    if (!crmSidebarIsCompact()) return "";
    if (el.hasAttribute("title")) {
      el.dataset.tip = el.getAttribute("title");
      el.removeAttribute("title");
    }
    const text = el.querySelector(".nav-text");
    return (el.dataset.tip || (text ? text.textContent : "") || "").trim();
  }

  function hideTip() {
    clearTimeout(hideTimer);
    if (tip) tip.classList.remove("show");
  }

  function showTip(el, autoHideMs) {
    const label = labelFor(el);
    if (!label) return hideTip();

    // do not cover an open flyout list
    const group = el.closest(".nav-group");
    if (group && group.classList.contains("open") && crmSidebarIsCompact()) return hideTip();

    const t = getTip();
    t.textContent = label;
    const r = el.getBoundingClientRect();
    const tr = t.getBoundingClientRect();
    const top = Math.max(8, Math.min(window.innerHeight - tr.height - 8, r.top + r.height / 2 - tr.height / 2));
    t.style.top = top + "px";
    t.style.left = (r.right + 12) + "px";
    t.classList.add("show");

    clearTimeout(hideTimer);
    if (autoHideMs) hideTimer = setTimeout(hideTip, autoHideMs);
  }

  document.addEventListener("pointerover", (e) => {
    if (e.pointerType === "touch") return;
    const el = e.target.closest(TARGETS);
    if (el) showTip(el);
  });
  document.addEventListener("pointerout", (e) => {
    if (e.pointerType === "touch") return;
    if (e.target.closest(TARGETS)) hideTip();
  });
  document.addEventListener("focusin", (e) => {
    const el = e.target.closest && e.target.closest(TARGETS);
    if (el && el.matches(":focus-visible")) showTip(el);
  });
  document.addEventListener("focusout", hideTip);

  // Touch: a tap shows the label for a moment (the tap still opens the page).
  document.addEventListener("pointerdown", (e) => {
    if (e.pointerType !== "touch") return;
    const el = e.target.closest(TARGETS);
    if (el) showTip(el, 1400);
    else hideTip();
  });

  document.addEventListener("keydown", (e) => { if (e.key === "Escape") hideTip(); });
  window.addEventListener("resize", hideTip);
  document.addEventListener("click", (e) => {
    if (e.target.closest("#burgerToggle")) hideTip();
  });
})();


// ---- Red dot on the sidebar Inbox icon while there are unread messages (every role) ----
// Same lists the inbox pages use: customer (conversations + tickets), sales staff (conversations),
// customer service (tickets), admin / manager (conversations + tickets). An item is unread when
// its unread / unread_count is above 0. The dot replaces the white dot of the Inbox icon.
(function () {
  const FEEDS = {
    "customer":         [["customer-inbox-api.php", "list_conversations", "conversations"], ["customer-inbox-api.php", "list_tickets", "tickets"]],
    "sales staff":      [["sales-inbox-api.php", "list_conversations", "conversations"]],
    "customer service": [["cs-inbox-api.php", "list_tickets", "tickets"]],
    "manager":          [["manager-admin-inbox-api.php", "list_conversations", "conversations"], ["manager-admin-inbox-api.php", "list_tickets", "tickets"]],
    "admin":            [["manager-admin-inbox-api.php", "list_conversations", "conversations"], ["manager-admin-inbox-api.php", "list_tickets", "tickets"]],
  };
  const feeds = FEEDS[CRM_ROLE];
  if (!feeds) return;

  const isUnread = (item) => !!item && (
    ["unread_count", "unread", "unread_messages", "unread_total"].some((key) => Number(item[key]) > 0) ||
    item.has_unread === true || item.is_unread === true || item.has_unread === 1 || item.is_unread === 1);
  // Admin / Manager cannot mark a message as read on the server (their inbox is read-only), so the browser remembers
  // which conversations they already opened: the dot clears once they opened the newest message, and comes back on a newer one.
  const WATCHER = CRM_ROLE === "admin" || CRM_ROLE === "manager";
  const SEEN_KEY = "crmInboxSeen:" + CRM_ROLE;
  let seen = {};
  try { seen = JSON.parse(localStorage.getItem(SEEN_KEY) || "{}") || {}; } catch (e) { seen = {}; }
  const seenKey = (kind, id) => kind + ":" + id;
  const unreadFor = (kind, item) => isUnread(item) && !(WATCHER && seen[seenKey(kind, item.id)] && String(item.last_message_at || "") <= seen[seenKey(kind, item.id)]);
  if (WATCHER && window.fetch) {
    const nativeFetch = window.fetch.bind(window);
    window.fetch = function (input, init) {
      const p = nativeFetch(input, init);
      try {
        const url = String(typeof input === "string" ? input : (input && input.url) || "");
        const m = /manager-admin-inbox-api\.php\?.*action=(conversation_messages|ticket_messages)/.exec(url);
        if (m) {
          p.then((res) => res.clone().json()).then((data) => {
            const item = data && (data.conversation || data.ticket);
            if (!item || item.id == null) return;
            seen[seenKey(m[1] === "ticket_messages" ? "tickets" : "conversations", item.id)] = String(item.last_message_at || "9999");
            try { localStorage.setItem(SEEN_KEY, JSON.stringify(seen)); } catch (e) { /* storage blocked */ }
            if (window.crmRefreshInboxDot) window.crmRefreshInboxDot();
          }).catch(() => {});
        }
      } catch (e) { /* never break the page */ }
      return p;
    };
  }
  const CACHE_KEY = "crmInboxUnread:" + CRM_ROLE;
  let cached = null;
  try { cached = sessionStorage.getItem(CACHE_KEY); } catch (e) { /* storage blocked */ }
  let hasUnread = cached === "1", busy = false, again = false, refreshTimer = 0;

  const inboxLinks = () => Array.from(document.querySelectorAll(".sidebar-nav .nav-link"))
    .filter((a) => /loadPage\(\s*['"][^'"]*inbox/i.test(a.getAttribute("onclick") || "") ||
      /^inbox$/i.test(((a.querySelector(".nav-text") || a).textContent || "").trim()));

  // The dot is drawn on top of the icon's own white dot (works for <svg>, <img> and icon fonts).
  function placeDot(link) {
    const icon = link.querySelector(".sidebar-icon") || link.querySelector("svg, img, i");
    const dot = link.querySelector(":scope > .crm-unread-dot");
    if (!icon || !dot) return;
    const lr = link.getBoundingClientRect(), ir = icon.getBoundingClientRect();
    if (!lr.width || !ir.width) return;
    const scale = link.offsetWidth ? lr.width / link.offsetWidth : 1;   // the page runs at a zoom, so convert back to CSS px
    dot.style.left = ((ir.right - lr.left) / scale - link.clientLeft - 6.5) + "px";
    dot.style.top = ((ir.top - lr.top) / scale - link.clientTop - 2.5) + "px";
  }

  // Clean chat icon without the baked-in white dot (black line; the sidebar's own filter makes it white / the right colour).
  const INBOX_ICON = "data:image/svg+xml," + encodeURIComponent(
    '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#000" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M4 20V6a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H8z"/></svg>');

  function paint() {
    inboxLinks().forEach((link) => {
      const img = link.querySelector("img.sidebar-icon");
      if (img && img.getAttribute("data-crm-inbox-icon") !== "1") {
        img.setAttribute("data-crm-inbox-icon", "1");
        img.src = INBOX_ICON;
      }
      if (getComputedStyle(link).position === "static") link.style.position = "relative";
      let dot = link.querySelector(":scope > .crm-unread-dot");
      if (!dot) {
        dot = document.createElement("span");
        dot.className = "crm-unread-dot";
        dot.setAttribute("aria-hidden", "true");
        link.appendChild(dot);
      }
      link.classList.add("crm-inbox-link");
      link.classList.toggle("has-unread", hasUnread);
      link.setAttribute("data-unread", hasUnread ? "true" : "false");
      placeDot(link);
    });
  }
  const repaint = () => requestAnimationFrame(paint);

  async function refresh() {
    if (document.hidden) return;
    if (busy) { again = true; return; }
    busy = true;
    try {
      const results = await Promise.all(feeds.map((feed) =>
        fetch(feed[0] + "?action=" + feed[1], { credentials: "same-origin", cache: "no-store", headers: { Accept: "application/json" } })
          .then((r) => (r.ok ? r.json() : null))
          .then((data) => {
            const list = data && (data[feed[2]] || (data.data && data.data[feed[2]]) || data.data);
            return Array.isArray(list) ? list : null;
          })
          .catch(() => null)));
      const lists = results.filter(Boolean);
      const anyUnread = results.some((l, i) => l && l.some((item) => unreadFor(feeds[i][2], item)));
      window.crmInboxDotInfo = { role: CRM_ROLE, links: inboxLinks().length, lists: results.map((l) => (l ? l.length : null)), unread: results.map((l, i) => (l ? l.filter((item) => unreadFor(feeds[i][2], item)).length : null)) };
      if (anyUnread) hasUnread = true;
      else if (lists.length === results.length) hasUnread = false;   // only clear it when every list answered
      try { sessionStorage.setItem(CACHE_KEY, hasUnread ? "1" : "0"); } catch (e) { /* storage blocked */ }
      paint();
    } finally {
      busy = false;
      if (again) { again = false; refresh(); }
    }
  }
  const refreshSoon = (ms) => { clearTimeout(refreshTimer); refreshTimer = setTimeout(refresh, ms == null ? 300 : ms); };
  window.crmRefreshInboxDot = () => refreshSoon(0);   // other scripts can call this after sending / reading a message

  document.addEventListener("DOMContentLoaded", () => {
    repaint();          // instantly, from the last known state
    refresh();          // then check the server right away
    setInterval(refresh, 5000);
    document.addEventListener("visibilitychange", () => { if (!document.hidden) refresh(); });
    window.addEventListener("focus", refresh);

    // opening another page, or reading a conversation, can clear the dot
    const main = document.getElementById("mainContentArea");
    if (main) new MutationObserver(() => refreshSoon(300)).observe(main, { childList: true });
    document.addEventListener("click", (e) => {
      if (!e.target.closest("#managerInboxPage, #cibPage, .csi-shell, .csi-page")) return;
      refreshSoon(350);                                  // the server has marked it read
      setTimeout(refresh, 1500);                         // safety re-check for a slow save
    });

    // keep the dot on the icon when the sidebar collapses / expands or the window changes
    window.addEventListener("resize", repaint);
    const burger = document.getElementById("burgerToggle");
    if (burger) burger.addEventListener("click", () => { setTimeout(repaint, 50); setTimeout(repaint, 400); });
    const sidebar = document.getElementById("crmSidebar");
    if (sidebar) {
      if (window.ResizeObserver) new ResizeObserver(repaint).observe(sidebar);
      new MutationObserver(repaint).observe(sidebar, { attributes: true, attributeFilter: ["class"] });
    }
    repaint();
  });
})();

// ---- Phone drawer: the burger opens the full sidebar (with labels) over the page ----
// Reuses the existing #burgerToggle and #crmSidebar. On a phone the burger no longer
// collapses/expands the desktop sidebar, so the saved desktop preference is not touched.
(function () {
  const root = document.documentElement;
  const phone = window.matchMedia("(max-width: 768px)");

  function setDrawer(open) {
    root.classList.toggle("crm-drawer-open", open);
    const burger = document.getElementById("burgerToggle");
    if (burger) burger.setAttribute("aria-expanded", open ? "true" : "false");
    if (typeof crmSyncNavGroups === "function") crmSyncNavGroups();   // inline list in the drawer, flyout in the rail
    if (window.crmRefreshInboxDot) window.crmRefreshInboxDot();       // re-place the unread dot
  }

  // Capture phase: runs before the other burger handlers, so they are skipped on a phone.
  document.addEventListener("click", (e) => {
    if (e.target.closest("#burgerToggle") && phone.matches) {
      e.preventDefault();
      e.stopImmediatePropagation();
      setDrawer(!root.classList.contains("crm-drawer-open"));
      return;
    }
    if (!root.classList.contains("crm-drawer-open")) return;
    const insideSidebar = e.target.closest("#crmSidebar");
    const isPageLink = e.target.closest("#crmSidebar .nav-link:not(.nav-group-toggle)");
    if (!insideSidebar || isPageLink) setDrawer(false);   // backdrop tap or page chosen
  }, true);

  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && root.classList.contains("crm-drawer-open")) setDrawer(false);
  });

  // Rotating to a wider screen: drop the drawer state.
  phone.addEventListener("change", () => { if (!phone.matches) setDrawer(false); });
})();