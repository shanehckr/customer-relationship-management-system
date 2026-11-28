/**
 * settings-page.js
 * Load this AFTER pages.js. It defines window.initCrmSettingsPage, so pages.js
 * no longer contains any Settings code.
 * Adds: Deactivate / Activate with confirmation, Delete with confirmation (Admin only, account must be Inactive first),
 * and "Discard changes?" on Create Account.
 * Admin sees View, Edit, Deactivate/Activate, Delete. Manager sees View and Deactivate/Activate only
 * (the API sends can_edit / can_delete, so the buttons follow the server rules).
 */

/** Handles frontend interactions for administrative settings and user management.*/

(() => {
  const roles = [
    { value: "admin", label: "Admin" },
    { value: "manager", label: "Manager" },
    { value: "sales staff", label: "Sales Staff" },
    { value: "customer service", label: "Customer Service Staff" },
    { value: "customer", label: "Customer" }
  ];

  function normalizeRole(role) {
    const normalized = role.toLowerCase().replace(/[_-]+/g, " ").replace(/\s+/g, " ").trim();
    if (normalized === "cs" || normalized === "cs staff" || normalized === "customer service staff") {
      return "customer service";
    }
    if (normalized === "sales") return "sales staff";
    if (normalized === "customer") return "customer";
    return normalized;
  }

  // Settings has no sidebar sub-items, but its tabs are what the Admin / Manager rules apply to.
  // Manager sees Users (without Admin accounts) and can only View / Deactivate; Roles & Permissions, Admin accounts and Edit / Delete are Admin only.
  const SETTINGS_SUBMODULES = [
    { name: "Users", roles: ["admin", "manager"], alwaysShow: true },
    { name: "Role & Permissions", roles: ["admin"], alwaysShow: true },
    { name: "Admin Accounts", roles: ["admin"], alwaysShow: true },
    { name: "Edit & Delete Accounts", roles: ["admin"], alwaysShow: true }
  ];

  const parseRoles = (rawRoles) => (rawRoles || "").split(",").map(normalizeRole).filter(Boolean);
  const mergeRoles = (a, b) => Array.from(new Set([...(a || []), ...(b || [])]));

  // Reads the real sidebar (#crmSidebar): top-level links and dropdown groups with their sub-links.
  // Same name = same module, so duplicates (e.g. the Manager Inbox and the Staff Inbox) are merged.
  function getModulePermissions() {
    const list = document.querySelector("#crmSidebar .sidebar-nav > ul");
    if (!list) return [];

    const modules = [];
    const byName = new Map();

    Array.from(list.children).forEach((item, itemIndex) => {
      if (!item.matches("li.nav-item[data-role]")) return;
      const roles = parseRoles(item.getAttribute("data-role"));
      const isGroup = item.classList.contains("nav-group");
      const name = (isGroup
        ? item.querySelector(".nav-group-toggle .nav-text")
        : item.querySelector(".nav-text"))?.textContent.trim();
      if (!name || roles.length === 0) return;

      let module = byName.get(name);
      if (!module) {
        module = { name, roles: [], children: [], order: {}, firstIndex: itemIndex };
        byName.set(name, module);
        modules.push(module);
      }
      module.roles = mergeRoles(module.roles, roles);
      // Remember where this item sits in the sidebar for each role, so every role's table
      // follows that role's own sidebar order (a merged name like Inbox no longer jumps to the top).
      roles.forEach((role) => {
        if (!(role in module.order) || itemIndex < module.order[role]) module.order[role] = itemIndex;
      });

      if (isGroup) {
        item.querySelectorAll(".nav-submenu-list > li.nav-item[data-role]").forEach((sub, subIndex) => {
          const subName = sub.querySelector(".nav-sub-text")?.textContent.trim();
          if (!subName) return;
          const subRoles = parseRoles(sub.getAttribute("data-role"));
          let existing = module.children.find((child) => child.name === subName);
          if (existing) existing.roles = mergeRoles(existing.roles, subRoles);
          else {
            existing = { name: subName, roles: subRoles, order: {}, firstIndex: module.children.length };
            module.children.push(existing);
          }
          subRoles.forEach((role) => {
            if (!(role in existing.order) || subIndex < existing.order[role]) existing.order[role] = subIndex;
          });
        });
      }

      if (name === "Settings") {
        module.children = SETTINGS_SUBMODULES.map((sub, index) => ({ ...sub, order: {}, firstIndex: index }));
      }
    });

    modules.forEach((module) => { module.hadChildren = module.children.length > 0; });
    return modules;
  }

  function permissionBadge(allowed) {
    const badge = document.createElement("span");
    badge.className = allowed ? "settings-access-badge" : "settings-denied-badge";
    badge.textContent = allowed ? "Allowed" : "Restricted";
    return badge;
  }

  const hasAccess = (roles, selectedRole) => roles.includes("all") || roles.includes(selectedRole);

  function renderPermissions(settingsRoot, modulePermissions, selectedRole) {
    const rows = settingsRoot.querySelector("#settings-permission-rows");
    if (!rows) return;

    rows.replaceChildren();

    const firstHeading = rows.closest("table")?.querySelector("thead th");
    if (firstHeading) firstHeading.textContent = "Module / Submodule";

    if (modulePermissions.length === 0) {
      const row = document.createElement("tr");
      row.innerHTML = '<td colspan="2" class="text-center py-4">Role navigation rules are unavailable.</td>';
      rows.append(row);
      return;
    }

    // Only show what the selected role can use, so another role's pages (customer pages, Sales-only
    // items) don't appear as "Restricted" clutter. The Settings rows always show, because the
    // Admin-only ones (Admin Accounts, Edit & Delete) are the point of the Manager view.
    const visibleModules = modulePermissions
      .map((module) => ({
        ...module,
        children: module.children.filter((child) => child.alwaysShow || hasAccess(child.roles, selectedRole))
      }))
      .filter((module) => module.children.length > 0 || (module.hadChildren ? false : hasAccess(module.roles, selectedRole)));

    // Follow the selected role's own sidebar order. Rows the role cannot use (Settings > Restricted) go last.
    const orderOf = (item) => (selectedRole in (item.order || {}) ? item.order[selectedRole] : 1000 + (item.firstIndex || 0));
    visibleModules.sort((a, b) => orderOf(a) - orderOf(b));
    visibleModules.forEach((module) => module.children.sort((a, b) => orderOf(a) - orderOf(b)));

    visibleModules.forEach((module) => {
      if (module.children.length > 0) {
        // Group: heading row, then its submodules (bullet + indent)
        const groupRow = document.createElement("tr");
        groupRow.className = "settings-permission-group";
        const groupCell = document.createElement("td");
        groupCell.colSpan = 2;
        groupCell.textContent = module.name;
        groupRow.append(groupCell);
        rows.append(groupRow);

        module.children.forEach((child) => {
          const row = document.createElement("tr");
          row.className = "settings-permission-sub";
          const nameCell = document.createElement("td");
          const accessCell = document.createElement("td");
          nameCell.textContent = child.name;
          accessCell.append(permissionBadge(hasAccess(child.roles, selectedRole)));
          row.append(nameCell, accessCell);
          rows.append(row);
        });
        return;
      }

      const row = document.createElement("tr");
      const nameCell = document.createElement("td");
      const accessCell = document.createElement("td");
      nameCell.textContent = module.name;
      accessCell.append(permissionBadge(hasAccess(module.roles, selectedRole)));
      row.append(nameCell, accessCell);
      rows.append(row);
    });
  }

  function showFormMessage(element, message) {
    if (!element) return;
    element.textContent = message;
    element.classList.remove("d-none");
  }

  // Account status/delete feedback uses the shared transient notification component.
  function showPageNotice(settingsRoot, message, type, options) {
    const toastType = type === "success" ? "success" : type === "warning" ? "warning" : type === "danger" ? "error" : "info";
    if (window.crmToast) window.crmToast(message, toastType, options);
    else console.error("CRM toast component was not loaded before Settings feedback.");
  }

  // Same icons as the login page: slashed eye = password hidden, open eye = password visible.
  function setPasswordVisibility(button, visible, settingsRoot) {
    const selector = button.getAttribute("data-password-toggle");
    const input = selector ? settingsRoot.querySelector(selector) : null;
    const icon = button.querySelector("i");
    if (!input || !icon) return;

    input.type = visible ? "text" : "password";
    icon.classList.toggle("bi-eye", visible);          // password visible -> open eye
    icon.classList.toggle("bi-eye-slash", !visible);   // password hidden  -> slashed eye
    button.setAttribute("aria-label", visible ? "Hide password" : "Show password");
    button.setAttribute("title", visible ? "Hide password" : "Show password");
  }

  function updateSettingsEmptyRow(settingsRoot, hasFilters) {
    const rows = settingsRoot.querySelector("#settings-user-rows");
    if (!rows) return;
    crmSetNoResultsRow(rows, 7, true, {
      icon: hasFilters ? "search" : "people",
      title: hasFilters ? "No results found" : "No user accounts found",
      description: hasFilters
        ? "Try changing your search or filters."
        : "User accounts will appear here when they are added."
    });
  }

  function filterUsers(settingsRoot) {
    const rows = settingsRoot.querySelector("#settings-user-rows");
    if (!rows || rows.querySelector(".settings-loading-row, .settings-load-error-row")) return;

    const searchValue = settingsRoot.querySelector("#settings-user-search")?.value.trim().toLowerCase() || "";
    const roleValue = settingsRoot.querySelector("#settings-role-filter")?.value || "";
    const statusValue = settingsRoot.querySelector("#settings-status-filter")?.value || "";
    const userRows = Array.from(rows.querySelectorAll("tr[data-account-row]"));
    const hasFilters = Boolean(searchValue || roleValue || statusValue);
    let visibleCount = 0;

    userRows.forEach((row) => {
      const matchesSearch = `${row.dataset.name || ""} ${row.dataset.username || ""} ${row.dataset.email || ""}`
        .toLowerCase()
        .includes(searchValue);
      const matchesRole = !roleValue || row.dataset.role === roleValue;
      const matchesStatus = !statusValue || row.dataset.status === statusValue;
      const visible = matchesSearch && matchesRole && matchesStatus;
      row.hidden = !visible;
      if (visible) visibleCount += 1;
    });

    if (visibleCount === 0) {
      updateSettingsEmptyRow(settingsRoot, hasFilters);
      return;
    }

    rows.querySelector(".no-results-row")?.remove();
  }

  function clearPasswordFields(settingsRoot) {
    settingsRoot.querySelectorAll("#addAccountModal [data-password-toggle]").forEach((button) => {
      setPasswordVisibility(button, false, settingsRoot);
    });
    const form = settingsRoot.querySelector("#create-account-form");
    if (form) form.reset();
    clearFieldErrors(form);

    const message = settingsRoot.querySelector("#create-account-message");
    if (message) {
      message.textContent = "";
      message.classList.add("d-none");
    }
  }

  // Email check: format, placeholder/fake domains, and common typos.
  const FAKE_EMAIL_DOMAINS = [
    "example.com", "example.org", "example.net",
    "test.com", "domain.com", "sample.com", "yourdomain.com", "email.com"
  ];
  const EMAIL_TYPO_FIXES = {
    "gmial.com": "gmail.com", "gmai.com": "gmail.com", "gamil.com": "gmail.com",
    "gmail.con": "gmail.com", "gmail.co": "gmail.com",
    "yaho.com": "yahoo.com", "yahoo.con": "yahoo.com",
    "hotmial.com": "hotmail.com", "hotmail.con": "hotmail.com",
    "outlok.com": "outlook.com", "outlook.con": "outlook.com"
  };

  function getEmailProblem(value) {
    const email = value.trim().toLowerCase();
    if (!email) return "";
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) {
      return "Enter a valid email address.";
    }
    const [name, domain] = email.split("@");
    if (FAKE_EMAIL_DOMAINS.includes(domain) || /\.(test|invalid|localhost|example)$/.test(domain)) {
      return "This looks like a placeholder email. Please use a real email address (e.g. gmail.com).";
    }
    if (EMAIL_TYPO_FIXES[domain]) {
      return `Did you mean ${name}@${EMAIL_TYPO_FIXES[domain]}?`;
    }
    return "";
  }

  // ---- Inline field errors: replaces the browser's white pop-up bubble ----
  // Uses the existing .cs-error text style and .is-invalid red border (see all-pages.css).
  function getFieldErrorBox(field, create) {
    const anchor = field.parentElement?.querySelector("[data-password-toggle]") ? field.parentElement : field;
    let box = anchor.nextElementSibling;
    if (box && box.hasAttribute("data-field-error")) return box;
    if (!create) return null;
    box = document.createElement("div");
    box.className = "cs-error";
    box.setAttribute("data-field-error", "");
    box.setAttribute("role", "alert");
    anchor.insertAdjacentElement("afterend", box);
    return box;
  }

  function fieldErrorText(field) {
    const v = field.validity;
    if (v.customError) return field.validationMessage;
    if (v.valueMissing) return "This field is required.";
    if (v.tooShort) return `Use at least ${field.minLength} characters.`;
    if (v.typeMismatch && field.type === "email") return "Enter a valid email address.";
    return field.validationMessage;
  }

  function validateField(field) {
    const valid = field.checkValidity();
    const box = getFieldErrorBox(field, !valid);
    if (box) box.textContent = valid ? "" : fieldErrorText(field);
    field.classList.toggle("is-invalid", !valid);
    return valid;
  }

  function clearFieldErrors(form) {
    if (!form) return;
    form.querySelectorAll("[data-field-error]").forEach((box) => { box.textContent = ""; });
    form.querySelectorAll(".is-invalid").forEach((field) => field.classList.remove("is-invalid"));
  }

  // Email rule + "passwords must match" as custom validity, so they flow through the same inline display.
  function setCustomChecks(form) {
    const email = form.elements.email;
    if (email) email.setCustomValidity(getEmailProblem(email.value));
    const password = form.elements.password;
    const confirmPassword = form.elements.confirm_password;
    if (password && confirmPassword) {
      confirmPassword.setCustomValidity(
        confirmPassword.value && password.value !== confirmPassword.value ? "Passwords must match." : ""
      );
    }
  }

  function validateFormInline(form) {
    setCustomChecks(form);
    let firstInvalid = null;
    form.querySelectorAll("input, textarea").forEach((field) => {
      if (!field.willValidate || field.type === "hidden") return;
      if (!validateField(field) && !firstInvalid) firstInvalid = field;
    });
    if (firstInvalid) firstInvalid.focus();
    return !firstInvalid;
  }

  function bindInlineValidation(form) {
    if (!form || form.dataset.inlineValidation === "1") return;
    form.dataset.inlineValidation = "1";
    form.setAttribute("novalidate", "");

    // Typing clears (or updates) a field's error as soon as it becomes valid.
    form.addEventListener("input", (event) => {
      const field = event.target;
      if (!(field instanceof HTMLInputElement)) return;
      setCustomChecks(form);
      if (field.classList.contains("is-invalid")) validateField(field);
      if (field.name === "password" && form.elements.confirm_password?.classList.contains("is-invalid")) {
        validateField(form.elements.confirm_password);
      }
    });

    // Leaving the email box checks it right away.
    form.addEventListener("focusout", (event) => {
      const field = event.target;
      if (field === form.elements.email && field.value.trim()) {
        setCustomChecks(form);
        validateField(field);
      }
    });
  }

  function fillAccountDetails(settingsRoot, row) {
    const fields = {
      name: row.dataset.name || "",
      username: row.dataset.username || "",
      email: row.dataset.email || "",
      role: row.dataset.role || "",
      status: row.dataset.status || "",
      created: [row.dataset.createdDate, row.dataset.createdBy ? `by ${row.dataset.createdBy}` : ""]
        .filter(Boolean).join(" ") || "—"
    };

    Object.entries(fields).forEach(([field, value]) => {
      const element = settingsRoot.querySelector(`[data-account-detail="${field}"]`);
      if (element) element.textContent = value;
    });

    const editForm = settingsRoot.querySelector("#edit-account-form");
    if (!editForm || !editForm.elements.user_id) return;
    editForm.elements.user_id.value = row.dataset.userId || "";
    editForm.elements.full_name.value = fields.name;
    editForm.elements.email.value = fields.email;
    editForm.elements.role.value = fields.role;
    editForm.elements.status.value = fields.status;

    const employeeRoles = ["Manager", "Sales Staff", "Customer Service Staff"];
    const editableRoles = fields.role === "Customer"
      ? ["Customer"]
      : fields.role === "Admin" ? ["Admin", ...employeeRoles] : employeeRoles;
    const roleDropdown = editForm.elements.role.closest(".dropdown");
    roleDropdown?.querySelectorAll('[data-settings-select="edit-account-role"]').forEach((item) => {
      item.closest("li").hidden = !editableRoles.includes(item.dataset.value);
    });
    editForm.elements.role.querySelectorAll("option").forEach((option) => {
      option.hidden = !editableRoles.includes(option.value);
    });
    const roleToggle = roleDropdown?.querySelector("#edit-account-role-toggle");
    if (roleToggle) roleToggle.disabled = fields.role === "Customer";

    [editForm.elements.role, editForm.elements.status].forEach((select) => {
      const dropdown = select.closest(".dropdown");
      const label = dropdown?.querySelector("[data-select-label]");
      if (label) label.textContent = select.selectedOptions[0]?.textContent.trim() || "";
      dropdown?.querySelectorAll("[data-settings-select]").forEach((item) => {
        item.setAttribute("aria-selected", item.dataset.value === select.value ? "true" : "false");
      });
    });
  }

  const SETTINGS_API_URL = "settings-api.php";

  async function loadSettingsUsers(settingsRoot) {
    const rows = settingsRoot.querySelector("#settings-user-rows");
    const notice = settingsRoot.querySelector(".settings-ui-notice");

    if (!rows) return;

    rows.replaceChildren();

    const loadingRow = document.createElement("tr");
    const loadingCell = document.createElement("td");
    loadingCell.colSpan = 7;
    loadingCell.className = "text-center py-4";
    loadingCell.textContent = "Loading user accounts...";
    loadingRow.className = "settings-loading-row";
    loadingRow.append(loadingCell);
    rows.append(loadingRow);

    try {
      const response = await fetch(
        `${SETTINGS_API_URL}?action=list`,
        {
          method: "GET",
          credentials: "same-origin",
          headers: { Accept: "application/json" }
        }
      );

      const data = await response.json();

      if (
        !response.ok ||
        !data.success ||
        !Array.isArray(data.users) ||
        typeof data.csrf_token !== "string"
      ) {
        throw new Error(data.message || "Unable to load user accounts.");
      }

      settingsRoot.dataset.csrfToken = data.csrf_token;
      rows.replaceChildren();

      if (notice) notice.classList.add("d-none");

      if (data.users.length === 0) {
        filterUsers(settingsRoot);
        return;
      }

      // The API says what this signed-in role may do (Admin: everything, Manager: no Edit / Delete).
      const isAdminRole = document.documentElement.classList.contains("role-admin");
      const canEdit = isAdminRole && (typeof data.can_edit === "boolean" ? data.can_edit : true);
      const canDelete = isAdminRole && (typeof data.can_delete === "boolean" ? data.can_delete : true);

      const makeCell = (className) => {
        const cell = document.createElement("td");
        if (className) cell.className = className;
        return cell;
      };
      // Plain text action link (same markup the other tables use).
      const makeAction = (label, action, className, user) => {
        const button = document.createElement("button");
        button.type = "button";
        button.className = `btn btn-sm ${className}`;
        button.dataset.accountAction = action;
        button.textContent = label;
        button.setAttribute("aria-label", `${label} ${user.full_name || user.username}`);
        return button;
      };

      data.users.forEach((user) => {
        // Manager does not see Admin accounts (the API also leaves them out).
        if (!isAdminRole && user.role_name === "Admin") return;

        const row = document.createElement("tr");
        const createdDate = String(user.created_at || "").slice(0, 10);
        const createdBy = user.created_by_label || "";

        row.dataset.accountRow = "";
        row.dataset.userId = String(user.user_id);
        row.dataset.name = user.full_name || "";
        row.dataset.username = user.username || "";
        row.dataset.email = user.email || "";
        row.dataset.role = user.role_name || "";
        row.dataset.status = user.status || "";
        row.dataset.createdDate = createdDate;
        row.dataset.createdBy = createdBy;

        const nameCell = makeCell("settings-user-name");
        nameCell.textContent = user.full_name || "";
        const usernameCell = makeCell();
        usernameCell.textContent = user.username || "";
        const emailCell = makeCell("settings-user-email");
        emailCell.textContent = user.email || "";
        const roleCell = makeCell();
        roleCell.textContent = user.role_name || "";
        // CREATED INFO: date, and "by Role (Name)" under it when the API knows who created it
        const createdCell = makeCell("settings-created");
        const dateLine = document.createElement("span");
        dateLine.className = "settings-created-date";
        dateLine.textContent = createdDate || "—";
        createdCell.append(dateLine);
        if (createdBy) {
          const byLine = document.createElement("span");
          byLine.className = "settings-created-by";
          byLine.textContent = `by ${createdBy}`;
          createdCell.append(byLine);
        }
        // STATUS: pill badge (same .status-badge class the other tables use)
        const statusCell = makeCell("settings-status-cell");
        const statusBadge = document.createElement("span");
        const statusText = user.status || "Unknown";
        statusBadge.className = `status-badge status-${statusText.toLowerCase()}`;
        statusBadge.textContent = statusText;
        statusCell.append(statusBadge);

        // ACTION: View, Edit | Deactivate / Activate, Delete
        const actionsCell = makeCell("text-end");
        const actions = document.createElement("div");
        actions.className = "settings-actions";

        const isActive = user.status === "Active";
        const canStatus = user.can_status !== false;
        const first = [makeAction("View", "view", "action-btn-view", user)];
        if (canEdit) first.push(makeAction("Edit", "edit", "action-btn-edit", user));
        const second = [];
        if (canStatus) {
          second.push(makeAction(
            isActive ? "Deactivate" : "Activate",
            "status",
            isActive ? "action-btn-deactivate" : "action-btn-activate",
            user
          ));
        }
        if (canDelete && user.can_delete === true) {
          const deleteButton = makeAction("Delete", "delete", "action-btn-delete", user);
          second.push(deleteButton);
        }

        actions.append(...first);
        if (second.length) {
          const divider = document.createElement("span");
          divider.className = "settings-action-divider";
          divider.setAttribute("aria-hidden", "true");
          actions.append(divider, ...second);
        }
        actionsCell.append(actions);

        row.append(nameCell, usernameCell, emailCell, roleCell, createdCell, statusCell, actionsCell);
        rows.append(row);
      });

      filterUsers(settingsRoot);

    } catch (error) {
      console.error("Settings user loading failed:", error);

      rows.replaceChildren();

      const errorRow = document.createElement("tr");
      const errorCell = document.createElement("td");

      errorRow.className = "settings-load-error-row";
      errorCell.colSpan = 7;
      errorCell.className = "text-center text-danger py-4";
      errorCell.textContent =
        "Unable to load user accounts. Refresh the page and try again.";

      errorRow.append(errorCell);
      rows.append(errorRow);
    }
  }

  // ACTIVATE / DEACTIVATE / DELETE ACCOUNT
  // Uses the shared crmConfirm() popup from pages.js (the same card and buttons as "Discard changes?"),
  // so no extra modal HTML is needed in the Settings page.
  //  - Activate / Deactivate (Admin and Manager) -> settings-api.php?action=status
  //  - Delete (Admin only)                       -> settings-api.php?action=delete
  //    The API independently checks whether protected records reference the account.
  async function postAccountAction(settingsRoot, action, fields, fallbackError) {
    if (!settingsRoot.dataset.csrfToken) {
      throw new Error("Security token is unavailable. Refresh Settings and try again.");
    }

    const formData = new FormData();
    Object.entries(fields).forEach(([key, value]) => formData.set(key, value));

    const response = await fetch(`${SETTINGS_API_URL}?action=${action}`, {
      method: "POST",
      credentials: "same-origin",
      headers: {
        Accept: "application/json",
        "X-CSRF-Token": settingsRoot.dataset.csrfToken
      },
      body: formData
    });

    let data = {};
    try {
      data = await response.json();
    } catch (error) {
      data = {};
    }
    if (!response.ok || !data.success) {
      const error = new Error(data.message || fallbackError);
      error.code = data.code || "";
      throw error;
    }
    return data;
  }

  async function openStatusModal(settingsRoot, row) {
    const willActivate = row.dataset.status !== "Active";
    const name = row.dataset.name || row.dataset.username || "this account";
    const nextStatus = willActivate ? "Active" : "Inactive";

    const confirmed = await crmConfirm({
      title: willActivate ? "Activate account?" : "Deactivate account?",
      message: willActivate
        ? `Are you sure you want to activate ${name}? The account status will be set to Active.`
        : `Are you sure you want to deactivate ${name}? The account status will be set to Inactive and the user will no longer be able to sign in.`,
      confirmText: willActivate ? "Activate" : "Deactivate",
      cancelText: "Cancel",
      danger: !willActivate
    });
    if (!confirmed) return;

    try {
      await postAccountAction(
        settingsRoot,
        "status",
        { user_id: row.dataset.userId || "", status: nextStatus },
        willActivate ? "Unable to activate this account." : "Unable to deactivate this account."
      );
      showPageNotice(
        settingsRoot,
        willActivate ? "Account activated successfully." : "Account deactivated successfully.",
        "success"
      );
      await loadSettingsUsers(settingsRoot);
    } catch (error) {
      console.error("Settings account status change failed:", error);
      showPageNotice(
        settingsRoot,
        error instanceof Error ? error.message : "Unable to update this account. Please try again.",
        "danger"
      );
    }
  }

  async function openDeleteModal(settingsRoot, row) {
    const name = row.dataset.name || row.dataset.username || "this account";

    const confirmed = await crmConfirm({
      title: "Delete account?",
      message: `Are you sure you want to delete ${name}? This permanently removes the account and cannot be undone.`,
      confirmText: "Delete",
      cancelText: "Cancel",
      danger: true
    });
    if (!confirmed) return;

    try {
      const data = await postAccountAction(
        settingsRoot,
        "delete",
        { user_id: row.dataset.userId || "" },
        "Unable to delete this account."
      );
      showPageNotice(settingsRoot, data.message || "Account deleted successfully.", "success");
      await loadSettingsUsers(settingsRoot);
    } catch (error) {
      console.error("Settings account delete failed:", error);
      const isActive = row.dataset.status === "Active";
      const protectedRecords = error instanceof Error && error.code === "protected_records";
      showPageNotice(
        settingsRoot,
        protectedRecords
          ? isActive
            ? "This account has associated records that must be retained. You can deactivate it instead."
            : "This account has associated records that must be retained. It will remain deactivated."
          : error instanceof Error ? error.message : "Unable to delete this account. Please try again.",
        "danger",
        protectedRecords ? { title: "Account Cannot Be Deleted" } : undefined
      );
    }
  }

  // Removes the given role names from role dropdowns (the <select>, its styled list items and the shown label).
  function removeRoleOptions(settingsRoot, ids, blocked) {
    const isBlocked = (value) => blocked.includes(String(value || "").trim().toLowerCase());

    ids.forEach((id) => {
      const select = settingsRoot.querySelector(`#${id}`);
      if (!select) return;
      const dropdown = select.closest(".dropdown");

      select.querySelectorAll("option").forEach((option) => {
        if (isBlocked(option.value)) option.remove();
      });
      dropdown?.querySelectorAll("[data-filter-value], [data-value]").forEach((item) => {
        if (isBlocked(item.dataset.filterValue ?? item.dataset.value)) item.closest("li")?.remove();
      });

      // The first remaining option becomes the shown / selected one (All Roles stays All Roles).
      if (select.selectedIndex < 0 || isBlocked(select.selectedOptions[0]?.value)) {
        select.selectedIndex = 0;
      } else {
        select.value = select.value;
      }
      const label = dropdown?.querySelector("[data-select-label], [data-settings-filter-label]");
      if (label) label.textContent = select.selectedOptions[0]?.textContent.trim() || "";
      dropdown?.querySelectorAll("[data-settings-select], [data-settings-filter]").forEach((item) => {
        const value = item.dataset.value ?? item.dataset.filterValue;
        item.setAttribute("aria-selected", value === select.value ? "true" : "false");
      });
    });
  }

  // Managers manage employee roles; customers self-register, and only Admin can manage Admin accounts.
  function removeAdminRoleOptions(settingsRoot) {
    if (!document.documentElement.classList.contains("role-admin")) {
      removeRoleOptions(settingsRoot, ["settings-role-filter", "new-account-role", "edit-account-role", "settings-permission-role"], ["admin"]);
      removeRoleOptions(settingsRoot, ["settings-role-filter"], ["customer"]);
    }
    removeRoleOptions(settingsRoot, ["new-account-role"], ["customer"]);
  }

  // Roles & Permissions and Terms & Privacy are Admin only: the Manager gets no tab and no page for them.
  function hideRolesTabForNonAdmin(settingsRoot) {
    if (document.documentElement.classList.contains("role-admin")) return;

    const pane = settingsRoot.querySelector("#settings-permission-rows")?.closest('.tab-pane, [role="tabpanel"]');
    const tabs = Array.from(settingsRoot.querySelectorAll('[data-bs-toggle="tab"], [data-bs-toggle="pill"], [role="tab"], .settings-tab'));
    const trigger = tabs.find((el) =>
      (pane?.id && (el.getAttribute("data-bs-target") === `#${pane.id}` || el.getAttribute("href") === `#${pane.id}` || el.getAttribute("aria-controls") === pane.id)) ||
      /roles?\s*(&|and)\s*permissions?/i.test(el.textContent || "")
    );

    const item = trigger?.closest("li");
    (item && item.parentElement?.children.length > 1 ? item : trigger)?.remove();
    pane?.remove();

    // Terms & Privacy is Admin only too: the Manager gets no tab, no editor and none of its pop-ups.
    settingsRoot.querySelector("#settings-legal-tab")?.closest("li")?.remove();
    settingsRoot.querySelector("#settings-legal-panel")?.remove();
    settingsRoot.querySelector("#legalConfirmModal")?.remove();
    settingsRoot.querySelector("#legalLinkModal")?.remove();

    // Make sure the Users tab is the one showing.
    const remaining = Array.from(settingsRoot.querySelectorAll('[data-bs-toggle="tab"], [data-bs-toggle="pill"], [role="tab"]'));
    if (remaining[0] && window.bootstrap?.Tab) bootstrap.Tab.getOrCreateInstance(remaining[0]).show();

    // Only one page left (Users): a tab bar with a single tab is pointless, so the whole bar is hidden.
    if (remaining.length <= 1) {
      const bar = (remaining[0] || trigger)?.closest('.settings-tabs, [role="tablist"], .nav-tabs, .nav') || settingsRoot.querySelector('.settings-tabs, [role="tablist"], .nav-tabs');
      if (bar) bar.style.display = "none";
    }
  }

  function initCrmSettingsPage() {
    const settingsRoot = document.getElementById("crmSettingsPage");
    if (!settingsRoot || settingsRoot.dataset.initialized === "true") return;
    settingsRoot.dataset.initialized = "true";

    removeAdminRoleOptions(settingsRoot);
    hideRolesTabForNonAdmin(settingsRoot);

    const modulePermissions = getModulePermissions();
    const roleSelect = settingsRoot.querySelector("#settings-permission-role");
    renderPermissions(settingsRoot, modulePermissions, normalizeRole(roleSelect?.value || "admin"));
    loadSettingsUsers(settingsRoot);

    roleSelect?.addEventListener("change", () => {
      renderPermissions(settingsRoot, modulePermissions, normalizeRole(roleSelect.value));
    });

    // Keep the styled dropdowns and filter selects in sync.
    settingsRoot.querySelectorAll("[data-settings-filter]").forEach((item) => {
      const select = settingsRoot.querySelector(`#${item.dataset.settingsFilter}`);
      const dropdown = item.closest(".settings-filter-dropdown");
      const toggleLabel = dropdown?.querySelector("[data-settings-filter-label]");
      if (item.dataset.filterValue === select?.value) {
        item.setAttribute("aria-selected", "true");
      }
      if (select && toggleLabel && item.dataset.filterValue === select.value) {
        toggleLabel.textContent = item.textContent.trim();
      }
    });

    settingsRoot.querySelectorAll(".settings-filter-value").forEach((select) => {
      select.addEventListener("change", () => {
        const dropdown = select.closest(".settings-filter-dropdown");
        const toggleLabel = dropdown?.querySelector("[data-settings-filter-label]");
        if (toggleLabel) {
          toggleLabel.textContent = select.selectedOptions[0]?.textContent.trim() || "";
        }

        dropdown?.querySelectorAll("[data-settings-filter]").forEach((item) => {
          item.setAttribute(
            "aria-selected",
            item.dataset.filterValue === select.value ? "true" : "false"
          );
        });
      });
    });

    settingsRoot.querySelector("#settings-user-search")?.addEventListener("input", () => filterUsers(settingsRoot));
    settingsRoot.querySelector("#settings-role-filter")?.addEventListener("change", () => filterUsers(settingsRoot));
    settingsRoot.querySelector("#settings-status-filter")?.addEventListener("change", () => filterUsers(settingsRoot));

    settingsRoot.addEventListener("click", (event) => {
      const filterItem = event.target.closest("[data-settings-filter]");
      if (filterItem) {
        const select = settingsRoot.querySelector(`#${filterItem.dataset.settingsFilter}`);
        if (select && select.value !== filterItem.dataset.filterValue) {
          select.value = filterItem.dataset.filterValue;
          select.dispatchEvent(new Event("change", { bubbles: true }));
        }
        return;
      }

      const toggleButton = event.target.closest("[data-password-toggle]");
      if (toggleButton) {
        const selector = toggleButton.getAttribute("data-password-toggle");
        const input = selector ? settingsRoot.querySelector(selector) : null;
        if (input) setPasswordVisibility(toggleButton, input.type === "password", settingsRoot);
        return;
      }

      const selectItem = event.target.closest("[data-settings-select]");
      if (selectItem) {
        const select = settingsRoot.querySelector(`#${selectItem.dataset.settingsSelect}`);
        if (select && select.value !== selectItem.dataset.value) {
          select.value = selectItem.dataset.value;
          const dropdown = select.closest(".dropdown");
          const label = dropdown?.querySelector("[data-select-label]");
          if (label) label.textContent = select.selectedOptions[0]?.textContent.trim() || "";
          dropdown?.querySelectorAll("[data-settings-select]").forEach((item) => {
            item.setAttribute("aria-selected", item.dataset.value === select.value ? "true" : "false");
          });
          select.dispatchEvent(new Event("change", { bubbles: true }));
        }
        return;
      }

      const actionButton = event.target.closest("[data-account-action]");
      if (!actionButton) return;

      const row = actionButton.closest("[data-account-row]");
      if (!row) return;

      // Activate / Deactivate: ask first.
      if (actionButton.dataset.accountAction === "status") {
        openStatusModal(settingsRoot, row);
        return;
      }

      // Delete (Admin only): ask first.
      if (actionButton.dataset.accountAction === "delete") {
        openDeleteModal(settingsRoot, row);
        return;
      }

      fillAccountDetails(settingsRoot, row);

      const modalId = actionButton.dataset.accountAction === "view" ? "#viewAccountModal" : "#editAccountModal";
      const modalElement = settingsRoot.querySelector(modalId);
      if (modalElement && window.bootstrap?.Modal) {
        if (modalElement.id === "editAccountModal") {
          const discardName = settingsRoot.querySelector("#discardAccountChangesModal strong.text-highlight");
          if (discardName) discardName.textContent = row.dataset.name || row.dataset.username || "this account";
          if (typeof window.crmTakeSnapshot === "function") window.crmTakeSnapshot(modalElement.id);
        }
        window.bootstrap.Modal.getOrCreateInstance(modalElement).show();
      }
    });

    settingsRoot.querySelector("#create-account-form")?.addEventListener("submit", async (event) => {
      event.preventDefault();
      const form = event.currentTarget;
      const password = form.elements.password;
      const confirmPassword = form.elements.confirm_password;
      const message = settingsRoot.querySelector("#create-account-message");
      const submitButton = form.querySelector('[type="submit"]');

      confirmPassword.setCustomValidity("");
      confirmPassword.setCustomValidity(
        password.value === confirmPassword.value ? "" : "Passwords must match."
      );

      // Inline errors under each field (no browser pop-up). reportValidity stays as a fallback for the role dropdown.
      if (!validateFormInline(form)) return;
      if (!form.reportValidity()) return;

      if (!settingsRoot.dataset.csrfToken) {
        message.className = "alert alert-danger";
        showFormMessage(message, "Security token is unavailable. Refresh Settings and try again.");
        return;
      }

      if (submitButton) submitButton.disabled = true;
      message.className = "alert alert-info";
      showFormMessage(message, "Creating account...");

      try {
        const response = await fetch(`${SETTINGS_API_URL}?action=create`, {
          method: "POST",
          credentials: "same-origin",
          headers: {
            Accept: "application/json",
            "X-CSRF-Token": settingsRoot.dataset.csrfToken
          },
          body: new FormData(form)
        });

        const data = await response.json();
        if (!response.ok || !data.success) {
          throw new Error(data.message || "Unable to create the account.");
        }

        form.reset();
        // Created: close the "Create New Account" window by itself and confirm with the shared toast
        // (the inline message would vanish with the window). Closing from code skips the "Discard changes?" prompt.
        const createModal = settingsRoot.querySelector("#addAccountModal");
        if (createModal && window.bootstrap?.Modal) window.bootstrap.Modal.getOrCreateInstance(createModal).hide();
        showPageNotice(settingsRoot, data.message || "Account created successfully.", "success");
        await loadSettingsUsers(settingsRoot);
      } catch (error) {
        console.error("Settings account creation failed:", error);
        message.className = "alert alert-danger";
        showFormMessage(
          message,
          error instanceof Error ? error.message : "Unable to create the account. Please try again."
        );
      } finally {
        if (submitButton) submitButton.disabled = false;
      }
    });

    settingsRoot.querySelector("#edit-account-form")?.addEventListener("submit", async (event) => {
      event.preventDefault();
      const form = event.currentTarget;
      const message = settingsRoot.querySelector("#edit-account-message");
      const submitButton = form.querySelector('[type="submit"]');

      if (!form.reportValidity()) return;

      if (!settingsRoot.dataset.csrfToken) {
        message.className = "alert alert-danger";
        showFormMessage(message, "Security token is unavailable. Refresh Settings and try again.");
        return;
      }

      if (submitButton) submitButton.disabled = true;
      message.className = "alert alert-info";
      showFormMessage(message, "Saving account changes...");

      try {
        const response = await fetch(`${SETTINGS_API_URL}?action=edit`, {
          method: "POST",
          credentials: "same-origin",
          headers: {
            Accept: "application/json",
            "X-CSRF-Token": settingsRoot.dataset.csrfToken
          },
          body: new FormData(form)
        });

        const data = await response.json();
        if (!response.ok || !data.success) {
          throw new Error(data.message || "Unable to update the account.");
        }

        message.className = "alert alert-success";
        showFormMessage(message, data.message || "Account updated successfully.");
        if (typeof window.crmTakeSnapshot === "function") window.crmTakeSnapshot("editAccountModal");
        await loadSettingsUsers(settingsRoot);
      } catch (error) {
        console.error("Settings account update failed:", error);
        message.className = "alert alert-danger";
        showFormMessage(
          message,
          error instanceof Error ? error.message : "Unable to update the account. Please try again."
        );
      } finally {
        if (submitButton) submitButton.disabled = false;
      }
    });

    // Create account modal. Its ID starts with "add", so pages.js asks "Discard changes?" on Cancel.
    const addAccountModal = settingsRoot.querySelector("#addAccountModal");
    if (addAccountModal) {
      // Closing clears the form, except while the "Discard changes?" prompt is open (Keep Editing needs the text).
      addAccountModal.addEventListener("hidden.bs.modal", () => {
        if (addAccountModal.dataset.keepState === "1") return;
        clearPasswordFields(settingsRoot);
      });

      // Fresh open (not "Keep Editing"): empty form, hidden passwords, no old message.
      addAccountModal.addEventListener("shown.bs.modal", () => {
        if (!addAccountModal.dataset.snapshot) clearPasswordFields(settingsRoot);
      });
    }

    bindInlineValidation(settingsRoot.querySelector("#create-account-form"));

    settingsRoot.querySelectorAll("#addAccountModal [data-password-toggle]").forEach((button) => {
      button.setAttribute("aria-label", "Show password");
      button.setAttribute("title", "Show password");
    });
  }

  window.initCrmSettingsPage = initCrmSettingsPage;
})();
