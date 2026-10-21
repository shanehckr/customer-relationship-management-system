// ==========================================================================
// navbar.js  -  theme, logout, role-based sidebar, page loader
//
// ROLES (saved at login in localStorage "userRole"):
//   admin | manager | customer service | sales staff
//
//   - Sidebar items are shown/hidden using data-role="..." in the shell HTML.
//   - Dashboard and Reports are DIFFERENT files per role (see CRM_ROLE_FILES).
//   - Contacts, Leads & Deals, Tickets, Activities are the SAME file for everyone.
//   - Only admin sees Delete buttons (CSS: html:not(.role-admin) .action-btn-delete).
//   - A role that opens a page it is not allowed to see is sent to its Dashboard.
// ==========================================================================

// ==========================================================================
// 1. ROLE SETUP (runs immediately, before the page is drawn)
// ==========================================================================

// Turns "Customer_Service", "customer service staff", "CS" ... into one clean name
function crmNormalizeRole(raw) {
  const r = String(raw || 'admin').toLowerCase().replace(/[_-]+/g, ' ').replace(/\s+/g, ' ').trim();
  if (r === 'cs' || r === 'cs staff' || r === 'customer service' || r === 'customer service staff') return 'customer service';
  if (r === 'sales' || r === 'sales staff') return 'sales staff';
  return r; // admin, manager, all
}

const CRM_ROLE = crmNormalizeRole(localStorage.getItem("userRole"));

// Adds e.g. "role-admin" / "role-manager" / "role-customer-service" / "role-sales-staff"
// to <html> so CSS can hide things (Delete buttons) for everyone except admin.
document.documentElement.classList.add("role-" + CRM_ROLE.replace(/\s+/g, "-"));

// Files that are DIFFERENT per role. Everything else is the same file for all roles.
// Create these files (same folder as the other pages). If one is missing,
// the admin version is shown instead so nothing breaks while you build them.
const CRM_ROLE_FILES = {
  "admin":            { dashboard: "adminDashboard.html",   reports: "reports.html" },
  "manager":          { dashboard: "managerDashboard.html", reports: "managerReports.html" },
  "customer service": { dashboard: "csDashboard.html",      reports: "csReports.html" },
  "sales staff":      { dashboard: "salesDashboard.html",   reports: "salesReports.html" }
};

// "adminDashboard.html" / "csReports.html" / "dashboard"  ->  "dashboard" / "reports"
// Any other page (adminContact.html ...) is returned as it is.
function crmPageKey(url) {
  for (const role in CRM_ROLE_FILES) {
    for (const key in CRM_ROLE_FILES[role]) {
      if (CRM_ROLE_FILES[role][key] === url) return key;
    }
  }
  return url;
}

// "dashboard" -> the file for the current role. Other pages stay the same.
function crmResolvePage(key) {
  const files = CRM_ROLE_FILES[CRM_ROLE] || {};
  return files[key] || key;
}

// Which sidebar pages exist, and which ones this role may open
const crmKnownPages = new Set();
const crmAllowedPages = new Set();

// Shows/hides sidebar items from their data-role="..." and remembers what is allowed
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

  // Role is applied: CSS stops hiding the sidebar text (see html:not(.role-ready) in the CSS)
  document.documentElement.classList.add("role-ready");
}

// Text shown for each role (sidebar subtitle + profile dropdown)
const CRM_ROLE_LABELS = {
  "admin": "Admin",
  "manager": "Manager",
  "customer service": "Customer Service",
  "sales staff": "Sales Staff"
};

// Fills the sidebar subtitle ("Admin" under CRM) and the profile dropdown
// (name + role) for the logged-in user.
// The name comes from localStorage "userName", saved by your login page.
// If it was not saved, the role label is shown instead of a wrong name.
function crmShowUserInfo() {
  const label = CRM_ROLE_LABELS[CRM_ROLE] || CRM_ROLE.replace(/\b\w/g, (c) => c.toUpperCase());
  const name = (localStorage.getItem("userName") || "").trim() || label;

  const subtitle = document.querySelector(".brand-subtitle");
  if (subtitle) subtitle.textContent = label;

  const nameEl = document.getElementById("dropdownUserName");
  if (nameEl) nameEl.textContent = name;

  const roleEl = document.getElementById("dropdownUserRole");
  if (roleEl) roleEl.textContent = label;
}

// Run it NOW, not after DOMContentLoaded. navbar.js is loaded at the end of <body>,
// so the sidebar already exists. This removes the "Admin menu flashes on refresh" problem.
if (document.getElementById("crmSidebar")) crmApplyRoleToSidebar();

// ==========================================================================
// 2. THEME, LOGOUT, LINKS, FIRST PAGE
// ==========================================================================
document.addEventListener("DOMContentLoaded", () => {
  const root = document.documentElement;
  const themeToggleBtn = document.getElementById("themeToggle");
  const logoutBtn = document.getElementById("logoutBtn");

  // Apply Theme Logic
  function applyTheme(theme) {
    if (theme === "light-mode") {
      root.classList.remove("dark-mode");
      root.classList.add("light-mode");
      root.style.backgroundColor = "#ffffff";
    } else {
      root.classList.remove("light-mode");
      root.classList.add("dark-mode");
      root.style.backgroundColor = "#050d0a";
    }
  }

  function initTheme() {
    const savedTheme = localStorage.getItem("theme");
    if (savedTheme) {
      applyTheme(savedTheme);
    } else {
      const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
      applyTheme(prefersDark ? "dark-mode" : "light-mode");
    }
  }
  initTheme();

  // Listen for device theme preference changes
  const colorSchemeQuery = window.matchMedia("(prefers-color-scheme: dark)");
  colorSchemeQuery.addEventListener("change", (e) => {
    localStorage.removeItem("theme");
    applyTheme(e.matches ? "dark-mode" : "light-mode");
  });

  // Theme Toggle Button Listener
  if (themeToggleBtn) {
    themeToggleBtn.addEventListener("click", () => {
      const isDark = root.classList.contains("dark-mode");
      const newTheme = isDark ? "light-mode" : "dark-mode";
      applyTheme(newTheme);
      localStorage.setItem("theme", newTheme);
    });
  }

  // NOTE: the notification bell, red dot and notification list are handled
  // by notifications.js (old notification code was removed from this file).

  // Logout Listener
  if (logoutBtn) {
    logoutBtn.addEventListener("click", () => {
      localStorage.removeItem("userRole");
      localStorage.removeItem("userName");
      localStorage.removeItem("userToken");
      localStorage.removeItem("activePage");
    });
  }

  // ==========================================
  // KEEP THE NAVBAR: open "View All" (and any other .html link
  // inside the page area) inside the shell instead of leaving it
  // ==========================================
  document.addEventListener("click", (e) => {
    const link = e.target.closest("#mainContentArea a[href]");
    if (!link) return;

    const href = link.getAttribute("href");
    if (!href || href.startsWith("#") || !href.endsWith(".html")) return;

    e.preventDefault();
    loadPage(href);
  });

  // Hide / show sidebar items for this role FIRST, so the page guard knows what is allowed
  crmApplyRoleToSidebar();

  // Load last active page from localStorage or default to the role's dashboard
  const activePage = localStorage.getItem("activePage") || "dashboard";
  loadPage(activePage);
});

// ==========================================================================
// 3. PAGE LOADER
// ==========================================================================

// Fetches a page. If the role file is missing, tries the fallback (admin version).
const PAGES_FOLDER = 'html-contentLoadsInNavbar/';
function crmFetchPage(file, fallback) {
  return fetch(PAGES_FOLDER + file)
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
 * Loads content pages dynamically into #mainContentArea and syncs sidebar active pill.
 * pageUrl can be "dashboard" / "reports" (picked per role) or a normal file name.
 */
function loadPage(pageUrl, clickedElement = null) {
  let key = crmPageKey(pageUrl);

  // 0. Role guard: a page that exists in the sidebar but is hidden for this role -> Dashboard
  if (crmKnownPages.has(key) && !crmAllowedPages.has(key)) {
    key = "dashboard";
    clickedElement = null;
  }

  const file = crmResolvePage(key);
  const fallbackFile = (CRM_ROLE_FILES.admin && CRM_ROLE_FILES.admin[key]) || key;

  // 1. Immediately update active sidebar pill class
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

  // 2. Save active page to localStorage (the KEY, so it also works after a role change)
  localStorage.setItem("activePage", key);

  // 3. Fetch content
  crmFetchPage(file, fallbackFile)
    .then((html) => {
      const container = document.getElementById("mainContentArea");
      if (container) {
       // Only inject the page's <body>. The <head> links/scripts/theme-sync belong to the
// shell (Navbar.html), which already loads the CSS, Bootstrap and the JS files.
const doc = new DOMParser().parseFromString(html, "text/html");
doc.querySelectorAll("script, link").forEach((n) => n.remove());
container.innerHTML = doc.body.innerHTML;

        // Re-run status badge renderer if present
        if (typeof renderStaticStatusBadges === "function") {
          renderStaticStatusBadges();
        }

        // Load table data from the backend, then start search and filters
        if (typeof window.loadCrmPageData === "function") {
          window.loadCrmPageData();
        } else if (typeof window.initTableSearchAndFilters === "function") {
          window.initTableSearchAndFilters();
        }
      }
    })
    .catch((error) => console.error("Error loading page:", error));
}