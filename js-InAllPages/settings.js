/**
 * settings-page.js
 * Load this AFTER pages.js. It defines window.initCrmSettingsPage, so pages.js
 * no longer contains any Settings code.
 * Adds: Deactivate / Activate with confirmation, and "Discard changes?" on Create Account.
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

  function getModulePermissions() {
    return Array.from(document.querySelectorAll("#crmSidebar .sidebar-nav .nav-item[data-role]"))
      .map((item) => {
        const moduleName = item.querySelector(".nav-text")?.textContent.trim();
        const rawRoles = item.getAttribute("data-role");
        if (!moduleName || !rawRoles) return null;
        return {
          name: moduleName,
          roles: rawRoles.split(",").map(normalizeRole)
        };
      })
      .filter(Boolean);
  }

  function renderPermissions(settingsRoot, modulePermissions, selectedRole) {
    const rows = settingsRoot.querySelector("#settings-permission-rows");
    if (!rows) return;

    rows.replaceChildren();

    if (modulePermissions.length === 0) {
      const row = document.createElement("tr");
      row.innerHTML = '<td colspan="2" class="text-center py-4">Role navigation rules are unavailable.</td>';
      rows.append(row);
      return;
    }

    modulePermissions.forEach((module) => {
      const allowed = module.roles.includes("all") || module.roles.includes(selectedRole);
      const row = document.createElement("tr");
      const nameCell = document.createElement("td");
      const accessCell = document.createElement("td");
      const badge = document.createElement("span");

      nameCell.textContent = module.name;
      badge.className = allowed ? "settings-access-badge" : "settings-denied-badge";
      badge.textContent = allowed ? "Allowed" : "Not allowed";
      accessCell.append(badge);
      row.append(nameCell, accessCell);
      rows.append(row);
    });
  }

  function showFormMessage(element, message) {
    if (!element) return;
    element.textContent = message;
    element.classList.remove("d-none");
  }

  // Message at the top of the Settings page (used after Activate / Deactivate).
  let pageNoticeTimer = null;
  function showPageNotice(settingsRoot, message, type) {
    const notice = settingsRoot.querySelector("#settings-page-notice");
    if (!notice) return;
    notice.className = `alert alert-${type} mb-3`;
    notice.textContent = message;
    clearTimeout(pageNoticeTimer);
    pageNoticeTimer = setTimeout(() => notice.classList.add("d-none"), 5000);
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
    crmSetNoResultsRow(rows, 6, true, {
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

    const message = settingsRoot.querySelector("#create-account-message");
    if (message) {
      message.textContent = "";
      message.classList.add("d-none");
    }
  }

  function fillAccountDetails(settingsRoot, row) {
    const fields = {
      name: row.dataset.name || "",
      email: row.dataset.email || "",
      role: row.dataset.role || "",
      status: row.dataset.status || ""
    };

    Object.entries(fields).forEach(([field, value]) => {
      const element = settingsRoot.querySelector(`[data-account-detail="${field}"]`);
      if (element) element.textContent = value;
    });

    const editForm = settingsRoot.querySelector("#edit-account-form");
    if (!editForm) return;
    editForm.elements.user_id.value = row.dataset.userId || "";
    editForm.elements.full_name.value = fields.name;
    editForm.elements.email.value = fields.email;
    editForm.elements.role.value = fields.role;
    editForm.elements.status.value = fields.status;
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
    loadingCell.colSpan = 6;
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

      data.users.forEach((user) => {
        const row = document.createElement("tr");

        row.dataset.accountRow = "";
        row.dataset.userId = String(user.user_id);
        row.dataset.name = user.full_name || "";
        row.dataset.username = user.username || "";
        row.dataset.email = user.email || "";
        row.dataset.role = user.role_name || "";
        row.dataset.status = user.status || "";

        [user.username, user.full_name, user.email, user.role_name, user.status]
          .forEach((value, index) => {
            const cell = document.createElement("td");
            cell.textContent = value ?? "";

            if (index === 4) {
              const badge = document.createElement("span");
              badge.className =
                user.status === "Active"
                  ? "badge text-bg-success"
                  : "badge text-bg-secondary";
              badge.textContent = user.status || "Unknown";
              cell.replaceChildren(badge);
            }

            row.append(cell);
          });

        const actionsCell = document.createElement("td");
        actionsCell.className = "text-end";

        const viewButton = document.createElement("button");
        viewButton.type = "button";
        viewButton.className = "btn btn-sm btn-outline-secondary me-2";
        viewButton.dataset.accountAction = "view";
        viewButton.textContent = "View";
        viewButton.setAttribute("aria-label", `View ${user.full_name || user.username}`);

        const editButton = document.createElement("button");
        editButton.type = "button";
        editButton.className = "btn btn-sm btn-outline-success";
        editButton.dataset.accountAction = "edit";
        editButton.textContent = "Edit";
        editButton.setAttribute("aria-label", `Edit ${user.full_name || user.username}`);

        // Deactivate (red) for active accounts, Activate (green) for inactive ones.
        const isActive = user.status === "Active";
        const statusButton = document.createElement("button");
        statusButton.type = "button";
        statusButton.className = `btn btn-sm ${isActive ? "action-btn-deactivate" : "action-btn-activate"}`;
        statusButton.dataset.accountAction = "status";
        statusButton.textContent = isActive ? "Deactivate" : "Activate";
        statusButton.setAttribute(
          "aria-label",
          `${isActive ? "Deactivate" : "Activate"} ${user.full_name || user.username}`
        );

        actionsCell.append(viewButton, editButton, statusButton);
        row.append(actionsCell);
        rows.append(row);
      });

      filterUsers(settingsRoot);

    } catch (error) {
      console.error("Settings user loading failed:", error);

      rows.replaceChildren();

      const errorRow = document.createElement("tr");
      const errorCell = document.createElement("td");

      errorRow.className = "settings-load-error-row";
      errorCell.colSpan = 6;
      errorCell.className = "text-center text-danger py-4";
      errorCell.textContent =
        "Unable to load user accounts. Refresh the page and try again.";

      errorRow.append(errorCell);
      rows.append(errorRow);
    }
  }

  // ------------------------------------------------------------------
  // ACTIVATE / DEACTIVATE ACCOUNT
  // The row's Activate / Deactivate link opens #accountStatusModal.
  // "Yes" sends the same fields the Edit form sends (action=edit) with the new status.
  // ------------------------------------------------------------------
  let pendingStatusRow = null;

  function openStatusModal(settingsRoot, row) {
    const modalElement = settingsRoot.querySelector("#accountStatusModal");
    if (!modalElement || !window.bootstrap?.Modal) return;

    const willActivate = row.dataset.status !== "Active";
    pendingStatusRow = row;
    modalElement.dataset.nextStatus = willActivate ? "Active" : "Inactive";

    modalElement.querySelector("#accountStatusModalTitle").textContent =
      willActivate ? "Activate account?" : "Deactivate account?";
    modalElement.querySelector("[data-status-action-word]").textContent =
      willActivate ? "activate" : "deactivate";
    modalElement.querySelector("[data-status-name]").textContent =
      row.dataset.name || row.dataset.username || "this account";
    modalElement.querySelector("[data-status-note]").textContent = willActivate
      ? "The account status will be set to Active."
      : "The account status will be set to Inactive.";

    // Green button to activate, red button to deactivate.
    const confirmButton = modalElement.querySelector("#accountStatusConfirmBtn");
    confirmButton.textContent = willActivate ? "Yes, Activate" : "Yes, Deactivate";
    confirmButton.classList.toggle("modal-btn-save", willActivate);
    confirmButton.classList.toggle("modal-btn-danger", !willActivate);
    confirmButton.disabled = false;

    const message = modalElement.querySelector("#account-status-message");
    if (message) {
      message.textContent = "";
      message.classList.add("d-none");
    }

    window.bootstrap.Modal.getOrCreateInstance(modalElement).show();
  }

  async function confirmStatusChange(settingsRoot) {
    const modalElement = settingsRoot.querySelector("#accountStatusModal");
    const confirmButton = settingsRoot.querySelector("#accountStatusConfirmBtn");
    const message = settingsRoot.querySelector("#account-status-message");
    const row = pendingStatusRow;
    if (!modalElement || !confirmButton || !row) return;

    const nextStatus = modalElement.dataset.nextStatus;

    if (!settingsRoot.dataset.csrfToken) {
      message.className = "alert alert-danger mb-3";
      showFormMessage(message, "Security token is unavailable. Refresh Settings and try again.");
      return;
    }

    confirmButton.disabled = true;

    const formData = new FormData();
    formData.set("user_id", row.dataset.userId || "");
    formData.set("full_name", row.dataset.name || "");
    formData.set("email", row.dataset.email || "");
    formData.set("role", row.dataset.role || "");
    formData.set("status", nextStatus);

    try {
      const response = await fetch(`${SETTINGS_API_URL}?action=edit`, {
        method: "POST",
        credentials: "same-origin",
        headers: {
          Accept: "application/json",
          "X-CSRF-Token": settingsRoot.dataset.csrfToken
        },
        body: formData
      });

      const data = await response.json();
      if (!response.ok || !data.success) {
        throw new Error(
          data.message ||
          (nextStatus === "Active"
            ? "Unable to activate this account."
            : "Unable to deactivate this account.")
        );
      }

      window.bootstrap.Modal.getOrCreateInstance(modalElement).hide();
      showPageNotice(
        settingsRoot,
        nextStatus === "Active"
          ? "Account activated successfully."
          : "Account deactivated successfully.",
        "success"
      );
      await loadSettingsUsers(settingsRoot);
    } catch (error) {
      console.error("Settings account status change failed:", error);
      message.className = "alert alert-danger mb-3";
      showFormMessage(
        message,
        error instanceof Error ? error.message : "Unable to update this account. Please try again."
      );
      confirmButton.disabled = false;
    }
  }

  function initCrmSettingsPage() {
    const settingsRoot = document.getElementById("crmSettingsPage");
    if (!settingsRoot || settingsRoot.dataset.initialized === "true") return;
    settingsRoot.dataset.initialized = "true";

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
        message.className = "alert alert-success";
        showFormMessage(message, data.message || "Account created successfully.");
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

    settingsRoot.querySelectorAll("#addAccountModal [data-password-toggle]").forEach((button) => {
      button.setAttribute("aria-label", "Show password");
      button.setAttribute("title", "Show password");
    });

    // Activate / Deactivate confirmation.
    settingsRoot.querySelector("#accountStatusConfirmBtn")?.addEventListener("click", () => {
      confirmStatusChange(settingsRoot);
    });
    settingsRoot.querySelector("#accountStatusModal")?.addEventListener("hidden.bs.modal", () => {
      pendingStatusRow = null;
    });
  }

  window.initCrmSettingsPage = initCrmSettingsPage;
})();