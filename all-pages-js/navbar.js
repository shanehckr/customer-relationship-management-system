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

  // Restore the last page, or open this role's dashboard.
  const activePage = localStorage.getItem("activePage") || "dashboard";
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
