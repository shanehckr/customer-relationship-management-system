/* ---------- Session guard: when any API answers "session expired" (401), go to the login page ---------- */
(function () {
  if (window.__crmSessionGuard || typeof window.fetch !== "function") return;
  window.__crmSessionGuard = true;
  var originalFetch = window.fetch;
  var redirecting = false;
  function goToLogin() {
    if (redirecting) return;
    redirecting = true;
    window.location.href = "login.php?timeout=1";
  }
  window.fetch = function () {
    return originalFetch.apply(this, arguments).then(function (response) {
      if (response && response.status === 401) {
        response.clone().json().then(function (data) {
          var msg = data && data.message ? String(data.message) : "";
          if (data && (data.code === "session_expired" || /log\s?in/i.test(msg))) goToLogin();
        }).catch(function () { /* not JSON: leave it to the page */ });
      }
      return response;
    });
  };
})();

/** Combined API-driven CRM behavior and Reports interactions. */

window.crmSelected = null; // Remember the selected record and its type.
/** Escapes text and turns **word** into bold (used for chat messages). */
function crmRichText(value) {
  return crmEscape(value).replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>");
}
function crmEscape(value) {
  return String(value === null || value === undefined ? "" : value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/* ---------- Shared styled dialogs (replace the browser's "localhost says" popups) ----------
 * crmConfirm(...)   -> Promise<boolean>. Same card/buttons as the "Discard changes?" modal.
 * crmOpenImage(...) -> in-page photo viewer with an X, instead of opening the raw file in a new tab. */
/* **bold** markers -> <strong>, everything else escaped */
function crmBold(text) {
  return crmEscape(text || "").replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>");
}
/* Structured confirm body: opts.details = [[label, value, isKey], ...], opts.note = sentence, opts.warning = sentence (**bold** allowed) */
function crmConfirmBody(opts) {
  // existing classes: Bootstrap utilities for the layout, .view-field-label for the labels, .modal-delete-text for the note
  const rows = opts.details.map(function (d) {
    return '<div class="crm-confirm-row d-flex justify-content-between align-items-baseline gap-3 py-2"><span class="view-field-label">' + crmEscape(d[0]) + "</span>" +
      '<strong class="text-end' + (d[2] === true ? " crm-confirm-key" : "") + '">' + crmEscape(d[1]) + "</strong></div>";
  }).join("");
  return '<div class="mb-3">' + rows + "</div>" +
    (opts.note ? '<p class="modal-delete-text mb-3">' + crmBold(opts.note) + "</p>" : "") +
    (opts.warning ? '<p class="crm-confirm-warning mb-4">' + crmBold(opts.warning) + "</p>" : "");
}

function crmConfirm(opts) {
  opts = opts || {};
  return new Promise(function (resolve) {
    if (typeof bootstrap === "undefined" || !bootstrap.Modal) {
      resolve(window.confirm(opts.message || "Are you sure?"));
      return;
    }
    const el = document.createElement("div");
    el.className = "modal fade crm-confirm-modal";
    el.tabIndex = -1;
    el.setAttribute("aria-hidden", "true");
    el.innerHTML =
      '<div class="modal-dialog modal-dialog-centered"><div class="modal-content custom-modal-card">' +
      '<div class="modal-body">' +
      '<h5 class="modal-title mb-2">' + crmEscape(opts.title || "Please confirm") + "</h5>" +
      (opts.details && opts.details.length
        ? crmConfirmBody(opts)
        : '<p class="modal-delete-text mb-4">' + crmEscape(opts.message || "") + "</p>") +
      '<div class="d-flex justify-content-end gap-2">' +
      '<button type="button" class="btn modal-btn-white px-3" data-crm-cancel>' + crmEscape(opts.cancelText || "Cancel") + "</button>" +
      '<button type="button" class="btn ' + (opts.danger ? "modal-btn-danger" : "modal-btn-save") + ' px-3" data-crm-ok>' + crmEscape(opts.confirmText || "Confirm") + "</button>" +
      "</div></div></div></div>";
    document.body.appendChild(el);
    let answer = false;
    const inst = new bootstrap.Modal(el);
    el.querySelector("[data-crm-ok]").addEventListener("click", function () { answer = true; inst.hide(); });
    el.querySelector("[data-crm-cancel]").addEventListener("click", function () { inst.hide(); });
    el.addEventListener("hidden.bs.modal", function () { inst.dispose(); el.remove(); resolve(answer); });
    inst.show();
  });
}

function crmOpenImage(url, name) {
  const old = document.getElementById("crmImageViewer");
  if (old) old.remove();
  const box = document.createElement("div");
  box.id = "crmImageViewer";
  box.className = "crm-image-viewer";
  box.setAttribute("role", "dialog");
  box.setAttribute("aria-modal", "true");
  box.innerHTML =
    '<div class="crm-image-viewer-card">' +
    '<div class="crm-image-viewer-head"><span class="crm-image-viewer-name">' + crmEscape(name || "Image") + "</span>" +
    '<a class="btn csi-outline-btn crm-image-viewer-dl" href="' + crmEscape(url) + '" download>Download</a>' +
    '<button type="button" class="btn-close crm-image-viewer-close" aria-label="Close"></button></div>' +
    '<div class="crm-image-viewer-body"><img src="' + crmEscape(url) + '" alt="' + crmEscape(name || "Image") + '"></div></div>';
  const close = function () { box.remove(); document.removeEventListener("keydown", onKey); document.body.classList.remove("crm-image-viewer-open"); };
  const onKey = function (e) { if (e.key === "Escape") close(); };
  box.addEventListener("click", function (e) { if (e.target === box || e.target.closest(".crm-image-viewer-close")) close(); });
  document.addEventListener("keydown", onKey);
  document.body.classList.add("crm-image-viewer-open");
  document.body.appendChild(box);
}
// Any photo link inside a conversation opens the viewer (Ctrl/Cmd/middle-click still opens a tab).
document.addEventListener("click", function (e) {
  const a = e.target.closest && e.target.closest("a.sbx-img, a.csi-image-link");
  if (!a || e.ctrlKey || e.metaKey || e.shiftKey || e.button !== 0) return;
  e.preventDefault();
  const img = a.querySelector("img");
  crmOpenImage(a.getAttribute("href"), img ? img.getAttribute("alt") : "Image");
});

function crmFormatAmount(amount) {
  if (amount === null || amount === undefined || amount === "") return "—";
  const num = Number(amount);
  if (isNaN(num)) return crmEscape(amount);
  return (
    "₱ " +
    num.toLocaleString("en-US", {
      minimumFractionDigits: 0,
      maximumFractionDigits: 2,
    })
  );
}

function crmEmptyRow(colspan, message) {
  return `
    <tr class="empty-data-row">
      <td colspan="${colspan}" class="text-center py-5 text-muted fw-medium fs-6">${crmEscape(message)}</td>
    </tr>`;
}

// Shared no-results component for module tables, Reports, and Settings.
function crmConfigureNoResultsRow(tbody, colspan, options = {}) {
  if (!tbody) return null;

  const columnCount = Math.max(1, Number.parseInt(colspan, 10) || 1);
  let row = tbody.querySelector(".no-results-row");
  if (!row) {
    row = document.createElement("tr");
    row.className = "no-results-row crm-no-results-row";
    row.innerHTML = `
      <td colspan="${columnCount}" class="crm-no-results-cell" role="status">
        <div class="crm-no-results-state">
          <i class="bi bi-search" aria-hidden="true"></i>
          <p class="crm-no-results-title">No results found</p>
          <p class="crm-no-results-description">Try changing your search or filters.</p>
        </div>
      </td>`;
    tbody.appendChild(row);
  }

  row.classList.add("crm-no-results-row");
  let cell = row.querySelector("td");
  if (!cell || !cell.querySelector(".crm-no-results-state")) {
    row.innerHTML = `
      <td colspan="${columnCount}" class="crm-no-results-cell" role="status">
        <div class="crm-no-results-state">
          <i class="bi bi-search" aria-hidden="true"></i>
          <p class="crm-no-results-title">No results found</p>
          <p class="crm-no-results-description">Try changing your search or filters.</p>
        </div>
      </td>`;
    cell = row.querySelector("td");
  }

  if (cell) {
    cell.colSpan = columnCount;
    cell.setAttribute("role", "status");
  }

  const icon = row.querySelector(".crm-no-results-state > i");
  const title = row.querySelector(".crm-no-results-title");
  const description = row.querySelector(".crm-no-results-description");
  const descriptionText = options.description === undefined
    ? "Try changing your search or filters."
    : options.description;
  if (icon) icon.className = `bi bi-${options.icon || "search"}`;
  if (title) title.textContent = options.title || "No results found";
  if (description) {
    description.textContent = descriptionText;
    description.hidden = !descriptionText;
  }

  return row;
}

function crmSetNoResultsRow(tbody, colspan, visible, options = {}) {
  const row = crmConfigureNoResultsRow(tbody, colspan, options);
  if (row) {
    row.hidden = false;
    row.style.display = visible ? "" : "none";
  }
  return row;
}

function crmFormatPhone(raw) {
  let digits = String(raw || "")
    .replace(/^\s*\+63/, "")
    .replace(/\D/g, "");
  if (digits.length === 12 && digits.indexOf("63") === 0)
    digits = digits.slice(2);
  digits = digits.replace(/^0+/, "").slice(0, 10);
  return "+63 " + digits;
}

// Share lead stages across pages.
// Keep these names consistent with values stored by the API.
const CRM_LEAD_STAGES = [
  "New Inquiry",
  "In Progress",
  "In Discussion",
  "Declined",
];
const CRM_DEAL_STAGES = [
  "Quotation Preparation",
  "Quotation Sent",
  "Negotiation",
  "Confirmed",
  "Declined",
];

const CRM_STAGE_CLASS = {
  "new inquiry": "stage-new",
  "in progress": "stage-qualified",
  "in discussion": "stage-proposal",
  "quotation preparation": "stage-new",
  "quotation sent": "stage-proposal",
  negotiation: "stage-negotiation",
  confirmed: "stage-won",
  declined: "stage-loss",
  // Accept legacy stage names returned by the API.
  qualified: "stage-qualified",
  unqualified: "stage-loss",
  proposal: "stage-proposal",
  "closed won": "stage-won",
  "closed loss": "stage-loss",
};

// Initialize direct loads and pages inserted by navbar.js.
function crmEnsureEmptyMessage(tbody, colspan, message) {
  if (!tbody) return;
  const hasRows =
    tbody.querySelectorAll("tr:not(.empty-data-row):not(.no-results-row)")
      .length > 0;
  if (!hasRows) tbody.innerHTML = crmEmptyRow(colspan, message);
}

function crmSetDashboardDate() {
  const dateEl = document.getElementById("currentDashboardDate");
  if (dateEl) {
    dateEl.textContent = new Date().toLocaleDateString("en-US", {
      weekday: "long",
      year: "numeric",
      month: "long",
      day: "numeric",
    });
  }
}

// Scale each stage bar against the largest count.
function crmFillProgressBars() {
  document.querySelectorAll("ul.stage-list").forEach((list) => {
    const items = Array.from(list.querySelectorAll("li"));
    const counts = items.map((li) => {
      const c = li.querySelector(".stage-count");
      return c ? Number(c.textContent.trim()) || 0 : 0;
    });
    const max = Math.max(1, ...counts);
    items.forEach((li, i) => {
      const bar = li.querySelector(".progress-bar");
      if (bar) bar.style.width = (counts[i] / max) * 100 + "%";
    });
  });
}
window.crmFillProgressBars = crmFillProgressBars; // Call again after fetched data arrives.
function crmDashboardDate(value) {
  if (!value) return "—";
  const date = new Date(String(value).replace(" ", "T"));
  return Number.isNaN(date.getTime())
    ? String(value)
    : date.toLocaleDateString("en-US", {
        year: "numeric",
        month: "short",
        day: "numeric",
      });
}

function crmDashboardBadge(value, type) {
  const text = String(value ?? "");
  const key = text.toLowerCase();
  const classes = {
    open: "dashboard-badge--open",
    pending: "dashboard-badge--pending",
    resolved: "dashboard-badge--resolved",
    upcoming: "dashboard-badge--upcoming",
    "in progress": "dashboard-badge--pending",
    completed: "dashboard-badge--resolved",
    cancelled: "dashboard-badge--open",
    high: "dashboard-badge--open",
    medium: "dashboard-badge--pending",
    low: "dashboard-badge--resolved",
  };
  if (type === "stage") {
    const stageClass = CRM_STAGE_CLASS[key] || "stage-new";
    return `<span class="stage-pill ${stageClass}">${crmEscape(text)}</span>`;
  }
  return `<span class="crm-dashboard-badge ${classes[key] || ""}">${crmEscape(text || "—")}</span>`;
}
function crmDashboardRenderTable(root, name, rows, columns, emptyMessage) {
  const body = root.querySelector(`[data-dashboard-table="${name}"]`);
  if (!body) return;
  body.replaceChildren();
  if (!Array.isArray(rows) || rows.length === 0) {
    body.innerHTML = crmEmptyRow(columns.length, emptyMessage);
    return;
  }
  rows.forEach((record) => {
    const row = document.createElement("tr");
    columns.forEach((column) => {
      const cell = document.createElement("td");
      const value = record[column.key];
      if (column.type === "date") {
        cell.textContent = crmDashboardDate(value);
      } else if (column.type === "amount") {
        cell.textContent = crmFormatAmount(value);
      } else if (column.type === "ticket") {
        cell.textContent = `TKT-${String(value ?? "").padStart(4, "0")}`;
      } else if (column.type === "badge" || column.type === "stage") {
        cell.innerHTML = crmDashboardBadge(value, column.type);
      } else {
        cell.textContent =
          value === null || value === undefined || value === ""
            ? "—"
            : String(value);
      }
      row.appendChild(cell);
    });
    body.appendChild(row);
  });
}

// ---------- Sales Staff dashboard (cards, 2 charts, lists) ----------
function crmSdSvgEl(w, h, inner) {
  return '<svg class="sd-svg" viewBox="0 0 ' + w + " " + h + '" preserveAspectRatio="xMidYMid meet" aria-hidden="true">' + inner + "</svg>";
}
function crmSdAxis(max) {
  // Nice whole-number axis: 0..max in 1, 2, 5, 10... steps (never more than ~6 lines).
  const top = Math.max(1, Math.ceil(max));
  let step = 1;
  while (top / step > 6) step = step < 2 ? 2 : step < 5 ? 5 : step * 2;
  const ticks = [];
  for (let v = 0; ; v += step) { ticks.push(v); if (v >= top) break; }
  return ticks;
}
function crmSdGrid(ticks, W, H, pad, top) {
  const yOf = (v) => H - pad.b - (v / top) * (H - pad.t - pad.b);
  return ticks.map((v) => '<line class="sd-grid" x1="' + pad.l + '" x2="' + (W - pad.r) + '" y1="' + yOf(v) + '" y2="' + yOf(v) + '"/><text class="sd-axis" x="' + (pad.l - 10) + '" y="' + (yOf(v) + 4) + '" text-anchor="end">' + v + "</text>").join("");
}
function crmSdBarChart(items) {
  const W = 560, H = 270, pad = { l: 36, r: 4, t: 8, b: 30 };
  const ticks = crmSdAxis(Math.max(0, ...items.map((i) => i.count)));
  const top = ticks[ticks.length - 1];
  const slot = (W - pad.l - pad.r) / items.length;
  const bw = Math.min(128, slot * 0.72);
  let out = crmSdGrid(ticks, W, H, pad, top);
  items.forEach((it, i) => {
    const cx = pad.l + slot * i + slot / 2;
    const bh = (it.count / top) * (H - pad.t - pad.b);
    out += '<line class="sd-grid" x1="' + (pad.l + slot * i) + '" x2="' + (pad.l + slot * i) + '" y1="' + pad.t + '" y2="' + (H - pad.b) + '"/>';
    if (it.count > 0) out += '<path class="sd-bar" d="M' + (cx - bw / 2) + " " + (H - pad.b) + "V" + (H - pad.b - bh + 6) + "a6 6 0 0 1 6 -6h" + (bw - 12) + "a6 6 0 0 1 6 6V" + (H - pad.b) + 'z"><title>' + crmEscape(it.label) + ": " + it.count + "</title></path>";
    out += '<text class="sd-axis" x="' + cx + '" y="' + (H - 8) + '" text-anchor="middle">' + crmEscape(it.label) + "</text>";
  });
  out += '<line class="sd-grid" x1="' + (W - pad.r) + '" x2="' + (W - pad.r) + '" y1="' + pad.t + '" y2="' + (H - pad.b) + '"/>';
  return crmSdSvgEl(W, H, out);
}
function crmSdLineChart(items) {
  const W = 560, H = 270, pad = { l: 36, r: 14, t: 8, b: 30 };
  const ticks = crmSdAxis(Math.max(0, ...items.map((i) => i.count)));
  const top = ticks[ticks.length - 1];
  const n = items.length;
  const xOf = (i) => (n === 1 ? (pad.l + W - pad.r) / 2 : pad.l + 8 + (i * (W - pad.l - pad.r - 16)) / (n - 1));
  const yOf = (v) => H - pad.b - (v / top) * (H - pad.t - pad.b);
  const pts = items.map((it, i) => [xOf(i), yOf(it.count)]);
  // Smooth curve (Catmull-Rom converted to Bezier), clamped so it never dips under the axis.
  let d = "M" + pts[0][0] + " " + pts[0][1];
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[i - 1] || pts[i], p1 = pts[i], p2 = pts[i + 1], p3 = pts[i + 2] || p2;
    const c = (v) => Math.min(H - pad.b, Math.max(pad.t, v));
    d += "C" + (p1[0] + (p2[0] - p0[0]) / 6) + " " + c(p1[1] + (p2[1] - p0[1]) / 6) + " " + (p2[0] - (p3[0] - p1[0]) / 6) + " " + c(p2[1] - (p3[1] - p1[1]) / 6) + " " + p2[0] + " " + p2[1];
  }
  let out = crmSdGrid(ticks, W, H, pad, top);
  items.forEach((it, i) => {
    out += '<line class="sd-grid" x1="' + pts[i][0] + '" x2="' + pts[i][0] + '" y1="' + pad.t + '" y2="' + (H - pad.b) + '"/>';
    out += '<text class="sd-axis" x="' + pts[i][0] + '" y="' + (H - 8) + '" text-anchor="' + (i === 0 ? "start" : i === n - 1 ? "end" : "middle") + '">' + crmEscape(it.label) + "</text>";
  });
  out += '<path class="sd-area" d="' + d + "L" + pts[n - 1][0] + " " + (H - pad.b) + "L" + pts[0][0] + " " + (H - pad.b) + 'z"/><path class="sd-line" d="' + d + '"/>';
  pts.forEach((p, i) => { out += '<circle class="sd-dot" cx="' + p[0] + '" cy="' + p[1] + '" r="3.5"><title>' + crmEscape(items[i].label) + ": " + items[i].count + "</title></circle>"; });
  return crmSdSvgEl(W, H, out);
}
function crmSdTimeLabel(c) {
  if (c.time_label) return String(c.time_label);
  const d = c.sent_at ? new Date(String(c.sent_at).replace(" ", "T")) : null;
  if (!d || Number.isNaN(d.getTime())) return "";
  const startOf = (x) => new Date(x.getFullYear(), x.getMonth(), x.getDate()).getTime();
  const days = Math.round((startOf(new Date()) - startOf(d)) / 86400000);
  if (days <= 0) return d.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" });
  if (days === 1) return "Yesterday";
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}
// ---- Customer profile photo in avatar circles --------------------------------------------------------------
// A customer who uploaded a photo (Customer > Settings) is shown with it; no photo = their initials, as before.
// Staff (Admin / Manager / Sales Staff) never have photos, so they are never passed through here.
function crmSafePhoto(url) {
  const u = String(url || "").trim();
  return u && !/^\s*(javascript|data|vbscript):/i.test(u) ? u : "";
}
function crmAvatarHTML(initials, photo, extraClass) {
  const cls = "iq-avatar" + (extraClass ? " " + extraClass : "");
  const url = crmSafePhoto(photo);
  if (!url) return '<span class="' + cls + '" aria-hidden="true">' + crmEscape(initials) + "</span>";
  return '<span class="' + cls + ' has-photo" aria-hidden="true"><img src="' + crmEscape(url) + '" alt="" loading="lazy" data-i="' + crmEscape(initials) + '"></span>';
}
// For an avatar element that already exists (chat thread header): photo or initials.
function crmSetAvatar(el, initials, photo) {
  if (!el) return;
  const url = crmSafePhoto(photo);
  el.classList.remove("has-photo");
  el.textContent = initials;
  if (!url) return;
  const img = document.createElement("img");
  img.alt = "";
  img.dataset.i = initials;
  img.src = url;
  el.textContent = "";
  el.appendChild(img);
  el.classList.add("has-photo");
}
// A photo that fails to load (file deleted, offline) falls back to the initials.
if (!window.crmAvatarFallbackReady) {
  window.crmAvatarFallbackReady = true;
  document.addEventListener("error", function (e) {
    const img = e.target;
    if (!img || img.tagName !== "IMG" || !img.parentNode || !img.parentNode.classList || !img.parentNode.classList.contains("has-photo")) return;
    const box = img.parentNode;
    box.classList.remove("has-photo");
    box.textContent = img.dataset.i || "?";
  }, true);
}
function crmSdInitials(name) {
  const parts = String(name || "?").trim().split(/\s+/).filter(Boolean);
  return ((parts[0] || "?")[0] + (parts.length > 1 ? parts[parts.length > 2 ? 1 : parts.length - 1][0] : "")).toUpperCase();
}
function crmRenderSalesDashboard(root, data) {
  const $ = (s) => root.querySelector(s);
  const list = (v) => (Array.isArray(v) ? v : []);

  // Name in "Operational summary for ..."
  const staff = data.staff_name || data.user_name || data.full_name || (data.user && data.user.name) || "";
  if (staff && $("#sdStaffWrap")) { $("#sdStaffName").textContent = staff; $("#sdStaffWrap").hidden = false; }

  // My Inquiries by Stage
  const stageSrc = data.inquiry_stages || data.lead_stages || {};
  const stages = ["New Inquiry", "In Progress", "Declined"].map((label) => ({ label, count: Number(stageSrc[label]) || 0 }));
  $("#sdStageTotal").textContent = stages.reduce((a, s) => a + s.count, 0) + " Total";
  $("#sdStageChart").innerHTML = crmSdBarChart(stages);

  // Inquiry Submission Trend (Weekly / Monthly / Yearly)
  const trend = Array.isArray(data.inquiry_trend) ? { monthly: data.inquiry_trend } : data.inquiry_trend || {};
  const dd = $("#sdTrendRange");
  const drawTrend = () => {
    const rows = list(trend[dd.dataset.range]).map((r) => ({ label: String(r.label ?? r.month ?? ""), count: Number(r.count ?? r.total ?? 0) || 0 }));
    $("#sdTrendChart").innerHTML = rows.length ? crmSdLineChart(rows) : '<p class="sd-empty-note">No inquiries received for this period yet.</p>';
  };
  if (dd) drawTrend();

  // Inquiries Requiring Attention
  const attention = list(data.attention_inquiries);
  $("#sdAttentionCount").textContent = attention.length + " Pending";
  $("#sdAttentionList").innerHTML = attention.length
    ? attention.map((a) => '<div class="sd-attn"><span class="iq-ref">' + crmEscape(a.inquiry_ref || "—") + '</span><div class="sd-attn-main"><strong>' + crmEscape(a.event_name || a.customer_name || "—") + "</strong><span>" + crmEscape([a.customer_name, a.reason].filter(Boolean).join(" · ")) + "</span></div></div>").join("")
    : '<div class="sd-empty"><strong>All caught up!</strong><span>No assigned inquiries require immediate staff action.</span></div>';

  // Upcoming Confirmed Bookings
  const bookings = list(data.upcoming_bookings);
  $("#sdBookingCount").textContent = bookings.length + " Active";
  $("#sdBookingRows").innerHTML = bookings.length
    ? bookings.map((b) => {
        const key = crmCalArrangementKey(b.arrangement);
        const arr = CRM_CAL_ARRANGEMENTS[key];
        return '<tr><td class="sd-ref">' + crmEscape(b.booking_ref || "—") + "</td><td class=\"fw-semibold\">" + crmEscape(b.customer_name || "—") + "</td><td>" + crmEscape(crmDashboardDate(b.event_date)) + '</td><td><span class="cal-arr-pill is-' + key + ' sd-arr">' + crmEscape(b.arrangement || arr.label) + '</span></td><td class="sd-pax">' + (crmArrangementHasPax(b.arrangement) ? crmEscape(b.pax ?? b.guests ?? "—") : "—") + '</td><td class="text-end"><button type="button" class="sd-view-btn" data-sd-booking="' + crmEscape(b.booking_ref || "") + '">View</button></td></tr>';
      }).join("")
    : crmEmptyRow(6, "No upcoming confirmed bookings");

  // Recent Customer Conversations
  const convos = list(data.recent_conversations);
  $("#sdConvos").innerHTML = convos.length
    ? convos.map((c) => '<article class="sd-convo">' + crmAvatarHTML(crmSdInitials(c.customer_name), c.customer_photo, "sd-avatar") + '<div class="sd-convo-main"><div class="sd-convo-top"><strong>' + crmEscape(c.customer_name || "—") + '</strong><time>' + crmEscape(crmSdTimeLabel(c)) + '</time></div><div class="sd-convo-tags"><span class="sd-convo-ref">' + crmEscape(c.inquiry_ref || "") + "</span>" + (Number(c.unread) > 0 ? '<span class="sd-unread">' + Number(c.unread) + " UNREAD</span>" : "") + '</div><p class="sd-convo-msg">' + crmEscape(c.message || "") + "</p></div></article>").join("")
    : '<p class="sd-empty-note">No conversations yet.</p>';

  // Clicks (set once per load; root is replaced when the page is reopened)
  root.onclick = (event) => {
    // Weekly / Monthly / Yearly (same custom dropdown as the other pages)
    const opt = event.target.closest("#sdTrendRange .custom-dropdown-item");
    if (opt) {
      event.preventDefault();
      event.stopPropagation();
      dd.dataset.range = opt.dataset.value;
      dd.querySelector(".custom-dropdown-toggle span").textContent = opt.textContent.trim();
      dd.querySelectorAll(".custom-dropdown-item").forEach((a) => a.removeAttribute("aria-selected"));
      opt.setAttribute("aria-selected", "true");
      const toggle = dd.querySelector('[data-bs-toggle="dropdown"]');
      if (toggle && window.bootstrap) bootstrap.Dropdown.getOrCreateInstance(toggle).hide();
      drawTrend();
      return;
    }
    if (event.target.closest("#sdViewInbox")) { if (typeof loadPage === "function") loadPage("inbox"); return; }
    const view = event.target.closest("[data-sd-booking]");
    if (view) {
      // The calendar opens this booking's details straight away (View Booking Details).
      try { sessionStorage.setItem("crmOpenBooking", view.dataset.sdBooking); } catch (e) {}
      if (typeof window.loadPage === "function") window.loadPage("admin-manager-sales-calendar.html");
    }
  };
}

// ---------- Admin / Manager dashboard (cards, 3 charts, 3 recent lists) ----------
// ONE chart palette for every dashboard + report (same meaning = same color). Change a color HERE only.
// red = open / urgent / declined, blue = in progress, amber = pending / waiting, orange = high, yellow = medium,
// green = resolved / confirmed / low, teal = completed, purple = scheduled, slate / grey = new / closed / none.
const CRM_PALETTE = { green: "#2bb673", blue: "#3b82f6", amber: "#f59e0b", orange: "#f97316", yellow: "#eab308", red: "#ef4444", teal: "#14b8a6", purple: "#8b5cf6", grey: "#94a3b8", slate: "#64748b" };
const CRM_OPS_INQUIRY = [["New Inquiry", CRM_PALETTE.slate], ["In Progress", CRM_PALETTE.blue], ["Declined", CRM_PALETTE.red]];
const CRM_OPS_BOOKING = [["Confirmed", CRM_PALETTE.green], ["In Progress", CRM_PALETTE.blue], ["Completed", CRM_PALETTE.teal], ["Cancelled", CRM_PALETTE.red]];
const CRM_OPS_TICKET = [["Open", CRM_PALETTE.red], ["In Progress", CRM_PALETTE.blue], ["Waiting", CRM_PALETTE.amber], ["Resolved", CRM_PALETTE.green], ["Closed", CRM_PALETTE.slate]];
const CRM_OPS_STATUS_CLASS = { "in progress": "stage-qualified", confirmed: "stage-won", completed: "stage-won", cancelled: "stage-loss", declined: "stage-loss", "new inquiry": "stage-qualified", open: "stage-new", waiting: "stage-proposal", resolved: "stage-won", closed: "stage-new" };
const CRM_OPS_PRIORITY_CLASS = { urgent: "stage-loss", high: "stage-proposal", medium: "stage-qualified", low: "stage-new" };

// Bar chart reusing the Sales dashboard grid / axis; every bar can carry its own colour and be clicked to filter.
function crmOpsBarChart(items, chart) {
  const W = 560, H = 270, pad = { l: 36, r: 4, t: 18, b: 30 };
  // Axis always has at least 4 steps, so small counts (0 or 1) still sit on a readable grid.
  const ticks = crmSdAxis(Math.max(4, ...items.map((i) => i.count)));
  const top = ticks[ticks.length - 1];
  const slot = (W - pad.l - pad.r) / items.length;
  const bw = Math.min(40, slot * 0.5);
  let out = crmSdGrid(ticks, W, H, pad, top);
  items.forEach((it, i) => {
    const cx = pad.l + slot * i + slot / 2;
    const bh = (it.count / top) * (H - pad.t - pad.b);
    // vertical divider between columns (same lines as the Sales dashboard chart)
    out += '<line class="sd-grid" x1="' + (pad.l + slot * i) + '" x2="' + (pad.l + slot * i) + '" y1="' + pad.t + '" y2="' + (H - pad.b) + '"/>';
    const attrs = ' data-ops-chart="' + chart + '" data-ops-value="' + crmEscape(it.label) + '"';
    out += '<g class="ops-hit"' + attrs + ">";
    out += '<rect x="' + (cx - slot / 2) + '" y="' + pad.t + '" width="' + slot + '" height="' + (H - pad.t - pad.b) + '" fill="transparent"/>';
    out += '<rect class="ops-bar" x="' + (cx - bw / 2) + '" y="' + (H - pad.b - Math.max(bh, 3)) + '" width="' + bw + '" height="' + Math.max(bh, 3) + '" rx="3" fill="' + (it.count > 0 ? it.color : "rgba(148,163,184,0.35)") + '"><title>' + crmEscape(it.label) + ": " + it.count + "</title></rect>";
    out += '<text class="ops-bar-num" x="' + cx + '" y="' + (H - pad.b - Math.max(bh, 3) - 6) + '" text-anchor="middle">' + it.count + "</text>";
    out += '<text class="sd-axis ops-bar-label" x="' + cx + '" y="' + (H - 8) + '" text-anchor="middle">' + crmEscape(it.label) + "</text></g>";
  });
  out += '<line class="sd-grid" x1="' + (W - pad.r) + '" x2="' + (W - pad.r) + '" y1="' + pad.t + '" y2="' + (H - pad.b) + '"/>';
  return crmSdSvgEl(W, H, out);
}

function crmOpsDonut(items, chart, opts) {
  opts = opts || {};
  const caption = opts.caption === undefined ? "BOOKINGS" : opts.caption;
  const total = items.reduce((a, i) => a + i.count, 0);
  const R = 46, C = 2 * Math.PI * R;
  let offset = 0;
  const segs = total
    ? items.filter((i) => i.count > 0).map((it) => {
        const len = (it.count / total) * C;
        const seg = '<circle class="ops-seg ops-hit" data-ops-chart="' + chart + '" data-ops-value="' + crmEscape(it.label) + '" cx="60" cy="60" r="' + R + '" fill="none" stroke="' + it.color + '" stroke-width="16" stroke-dasharray="' + len + " " + (C - len) + '" stroke-dashoffset="' + -offset + '" transform="rotate(-90 60 60)"><title>' + crmEscape(it.label) + ": " + it.count + "</title></circle>";
        offset += len;
        return seg;
      }).join("")
    : '<circle cx="60" cy="60" r="' + R + '" fill="none" stroke="rgba(148,163,184,0.35)" stroke-width="16"/>';
  const svg = '<svg class="ops-donut" viewBox="0 0 120 120" aria-hidden="true">' + segs + '<text class="ops-donut-num" x="60" y="62" text-anchor="middle">' + total + '</text><text class="ops-donut-cap" x="60" y="76" text-anchor="middle">' + crmEscape(caption) + '</text></svg>';
  const legend = items.map((it) => '<li class="ops-hit" data-ops-chart="' + chart + '" data-ops-value="' + crmEscape(it.label) + '"><span class="ops-swatch" style="background:' + it.color + '"></span><span>' + crmEscape(it.label) + '</span><b>' + it.count + "</b>" + (opts.pct ? '<em class="ops-pct">(' + (total ? Math.round(it.count / total * 100) : 0) + "%)</em>" : "") + "</li>").join("");
  if (opts.noLegend) return svg;
  return svg + '<ul class="ops-legend">' + legend + "</ul>";
}

function crmOpsPill(text, map) {
  const key = String(text || "").toLowerCase();
  const cls = map[key] || map[Object.keys(map).find((k) => key.startsWith(k))] || "stage-new";
  return '<span class="stage-pill ' + cls + '">' + crmEscape(text || "—") + "</span>";
}
const crmOpsStaff = (name) => name
  ? '<span class="ops-staff"><i class="bi bi-person" aria-hidden="true"></i>' + crmEscape(name) + "</span>"
  : '<span class="stage-pill stage-proposal">Unassigned</span>';

function crmRenderOpsDashboard(root, data) {
  const $ = (s) => root.querySelector(s);
  const list = (v) => (Array.isArray(v) ? v : []);
  const count = (src, label) => Number((src || {})[label]) || 0;
  const filters = { inquiries: "", bookings: "", tickets: "" };

  const series = (table, src) => table.map(([label, color]) => ({ label, color, count: count(src, label) }));
  const stages = series(CRM_OPS_INQUIRY, data.inquiry_stages || data.lead_stages);
  const bookings = series(CRM_OPS_BOOKING, data.booking_statuses);
  const tickets = series(CRM_OPS_TICKET, data.ticket_statuses);

  const inquiries = list(data.recent_inquiries);
  const upcoming = list(data.upcoming_bookings);
  const recentTickets = list(data.recent_tickets);

  const matches = (value, filter) => !filter || String(value || "").toLowerCase().startsWith(filter.toLowerCase());
  const empty = (title, text) => '<div class="sd-empty"><strong>' + title + "</strong><span>" + text + "</span></div>";

  function draw() {
    $("#opsInquiryChart").innerHTML = crmOpsBarChart(stages, "inquiries");
    $("#opsBookingChart").innerHTML = crmOpsDonut(bookings, "bookings");
    $("#opsTicketChart").innerHTML = crmOpsBarChart(tickets, "tickets");

    // mark the active bar / segment
    root.querySelectorAll("[data-ops-chart]").forEach((el) => {
      const f = filters[el.dataset.opsChart];
      el.classList.toggle("is-active", !!f && el.dataset.opsValue === f);
      el.classList.toggle("is-dim", !!f && el.dataset.opsValue !== f);
    });
    const active = Object.values(filters).filter(Boolean);
    $("#opsFilterNote").textContent = active.length ? "Filtering by " + active.join(", ") + " (click again to clear)" : "Select a chart bar or segment to filter records";

    const inq = inquiries.filter((r) => matches(r.stage, filters.inquiries));
    $("#opsInquiryList").innerHTML = inq.length ? inq.map((r) =>
      '<div class="ops-row"><div class="ops-main"><div class="ops-title"><strong>' + crmEscape(r.customer_name || "—") + '</strong><span class="ops-dot"></span><span>' + crmEscape(r.event_name || "—") + '</span></div>' +
      '<div class="ops-meta"><span class="iq-ref">' + crmEscape(r.inquiry_ref || "—") + "</span><span>Event Date: <b>" + crmEscape(crmDashboardDate(r.event_date)) + "</b></span></div></div>" +
      '<div class="ops-side">' + crmOpsStaff(r.assigned_staff) + crmOpsPill(r.stage, CRM_OPS_STATUS_CLASS) +
      '<button type="button" class="ops-link" data-ops-page="manager-admin-inquiries.html">View Details</button></div></div>').join("")
      : empty(filters.inquiries ? "No matching inquiries" : "No inquiries yet", filters.inquiries ? "Try another bar or clear the filter." : "New customer inquiries will appear here.");

    const bk = upcoming.filter((r) => matches(r.status, filters.bookings));
    $("#opsBookingList").innerHTML = bk.length ? bk.map((r) =>
      '<div class="ops-row"><div class="ops-main"><div class="ops-title"><strong>' + crmEscape(r.event_name || "—") + '</strong><span class="ops-date">' + crmEscape(r.event_date ? String(r.event_date).slice(0, 10) : "—") + "</span></div>" +
      '<div class="ops-meta"><span class="iq-ref">' + crmEscape(r.booking_ref || "—") + "</span><span>Customer: <b>" + crmEscape(r.customer_name || "—") + "</b></span>" +
      (r.arrangement ? "<span>" + crmEscape(r.arrangement) + (r.pax && crmArrangementHasPax(r.arrangement) ? " &bull; <b>" + crmEscape(r.pax) + " PAX</b>" : "") + "</span>" : "") + "</div></div>" +
      '<div class="ops-side">' + crmOpsStaff(r.assigned_staff) + crmOpsPill(r.status, CRM_OPS_STATUS_CLASS) +
      '<button type="button" class="ops-link" data-ops-page="manager-admin-bookings.html">View Details</button></div></div>').join("")
      : empty(filters.bookings ? "No matching bookings" : "No upcoming bookings", filters.bookings ? "Try another segment or clear the filter." : "Confirmed catering events will appear here.");

    const tk = recentTickets.filter((r) => matches(r.status, filters.tickets));
    $("#opsTicketList").innerHTML = tk.length ? tk.map((r) =>
      '<div class="ops-row"><div class="ops-main"><div class="ops-title"><strong>' + crmEscape(r.subject || "—") + "</strong></div>" +
      '<div class="ops-meta"><span class="iq-ref">' + crmEscape(r.ticket_number || "—") + "</span><span>Customer: <b>" + crmEscape(r.customer_name || "—") + "</b></span><span>Updated: " + crmEscape(r.updated_at ? crmDashboardDate(r.updated_at) : "—") + "</span></div></div>" +
      '<div class="ops-side">' + crmOpsPill(r.priority, CRM_OPS_PRIORITY_CLASS) + crmOpsPill(r.status, CRM_OPS_STATUS_CLASS) +
      '<button type="button" class="ops-link" data-ops-page="manager-admin-ticket.html">View Ticket</button></div></div>').join("")
      : empty(filters.tickets ? "No matching tickets" : "No support tickets", filters.tickets ? "Try another bar or clear the filter." : "Customer support tickets will appear here.");
  }
  draw();

  root.onclick = (event) => {
    const hit = event.target.closest("[data-ops-chart]");
    if (hit) {
      const chart = hit.dataset.opsChart;
      filters[chart] = filters[chart] === hit.dataset.opsValue ? "" : hit.dataset.opsValue;
      draw();
      return;
    }
    const link = event.target.closest("[data-ops-page]");
    if (link && typeof window.loadPage === "function") window.loadPage(link.dataset.opsPage);
  };
}

// ---------- Dashboards (Admin / Manager / Sales / Customer Service): one renderer, data from dashboard-api.php ----------
// Page names used by the buttons. Edit here if a file name differs in your project.
const DASH_PAGES = { inbox: "inbox", calendar: "admin-manager-sales-calendar.html", salesInquiries: "sales-inquiries.html", tickets: "ticket.html" };

const DASH_BOOKING_COLORS = [["Confirmed", CRM_PALETTE.green], ["Preparing", CRM_PALETTE.blue], ["Ready for Pickup", CRM_PALETTE.teal], ["Out for Delivery", CRM_PALETTE.amber], ["Service Scheduled", CRM_PALETTE.purple], ["Completed", CRM_PALETTE.slate]];
// The 3 booking services shown in the Admin "Bookings by Service" donut (bright colours so every dot is visible in dark and light mode)
const DASH_SERVICE_COLORS = [["Customer Pickup", CRM_PALETTE.amber], ["Food Delivery", CRM_PALETTE.green], ["Buffet with Setup", CRM_PALETTE.blue]];
const DASH_BOOKING_CLASS = { confirmed: "stage-won", preparing: "stage-qualified", "ready for pickup": "stage-won", "out for delivery": "stage-proposal", "service scheduled": "stage-negotiation", completed: "stage-new", cancelled: "stage-loss" };
const DASH_SUB = {
  admin: (n) => "Welcome back" + (n ? ", " + n.split(" ")[0] : "") + ". Here is what is happening across the business today.",
  manager: (n) => "Welcome back" + (n ? ", " + n.split(" ")[0] : "") + ". Catering operations and sales activity at a glance.",
  sales: (n) => "Welcome back" + (n ? ", " + n.split(" ")[0] : "") + ". Your inquiries and upcoming bookings.",
  "customer-service": (n) => "Welcome back" + (n ? ", " + n.split(" ")[0] : "") + ". Your support tickets and conversations.",
};

// "2026-11-15 16:42:00" -> "Nov 15 · 4:42 PM" (year only when it is not this year). Parsed by hand: no time-zone shift.
function dashStamp(v) {
  const m = String(v || "").match(/^(\d{4})-(\d{2})-(\d{2})[ T](\d{2}):(\d{2})/);
  if (!m) return v ? crmEscape(crmDashboardDate(v)) : "—";
  const d = new Date(+m[1], +m[2] - 1, +m[3], +m[4], +m[5]);
  const day = d.toLocaleDateString("en-US", d.getFullYear() === new Date().getFullYear() ? { month: "short", day: "numeric" } : { month: "short", day: "numeric", year: "numeric" });
  return day + " · " + d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
}
function dashDay(v) {
  const m = String(v || "").match(/^(\d{4})-(\d{2})-(\d{2})/);
  return m ? new Date(+m[1], +m[2] - 1, +m[3]).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }) : "—";
}
const dashEmpty = (title, text) => '<div class="sd-empty"><strong>' + title + "</strong><span>" + text + "</span></div>";
const dashRef = (v) => (v ? '<span class="iq-ref">' + crmEscape(v) + "</span>" : "");

function dashBookingsTable(rows, { staff }) {
  if (!rows.length) return dashEmpty("No upcoming events", "Confirmed catering events will appear here.");
  const head = ["Event", "Date", "Service"].concat(staff ? ["Sales Staff"] : [], ["Status"]);
  const body = rows.map((r) => {
    const pax = crmArrangementHasPax(r.arrangement) && r.pax ? " · " + crmEscape(r.pax) + " PAX" : "";
    return '<tr class="dash-row-link" data-dash-booking="' + crmEscape(r.booking_ref || "") + '" title="Open in calendar">' +
      '<td><div class="dash-cell-title">' + crmEscape(r.event_name || "—") + '</div><div class="dash-cell-sub">' + crmEscape([r.booking_ref, r.customer_name].filter(Boolean).join(" · ")) + "</div></td>" +
      '<td class="text-nowrap">' + crmEscape(dashDay(r.event_date)) + "</td>" +
      "<td>" + crmEscape(r.arrangement || "—") + '<span class="dash-muted">' + pax + "</span></td>" +
      (staff ? "<td>" + crmEscape(r.assigned_staff || "Unassigned") + "</td>" : "") +
      "<td>" + crmOpsPill(r.status, DASH_BOOKING_CLASS) + "</td></tr>";
  }).join("");
  return '<div class="table-responsive"><table class="table align-middle mb-0 dash-table"><thead><tr>' + head.map((h) => "<th>" + h + "</th>").join("") + "</tr></thead><tbody>" + body + "</tbody></table></div>";
}

function dashFeed(rows, prefix) {
  if (!rows.length) return dashEmpty("Nothing yet", "Updates will appear here as they happen.");
  const icon = (t) => {
    t = String(t || "").toLowerCase();
    return /message/.test(t) ? "bi-chat-left-text" : /payment|paid/.test(t) ? "bi-check2-circle" : /quotation/.test(t) ? "bi-send" : /assigned/.test(t) ? "bi-person-check" : /booking|confirmed/.test(t) ? "bi-calendar-check" : "bi-file-earmark-text";
  };
  return '<ul class="dash-feed">' + rows.slice(0, 5).map((r) => {
    const who = [r.source_name, r.source_role ? "(" + r.source_role + ")" : ""].filter(Boolean).join(" ");
    return '<li><div class="dash-feed-main">' +
      '<div class="dash-feed-text" title="' + crmEscape(r.text) + '">' + crmEscape(r.text || "—") + "</div>" +
      '<div class="dash-feed-sub">' + crmEscape(prefix + who) + (r.ref ? " · " + crmEscape(r.ref) : "") + " · " + dashStamp(r.at) + "</div></div></li>";
  }).join("") + "</ul>";
}

// Donut + one legend row per item (zero values included, so every stage/status is always listed).
function dashDonut(items, caption) {
  return '<div class="ops-donut-wrap">' + crmOpsDonut(items, "dash", { caption, pct: true }) + "</div>";
}

function dashMeters(counts, order, colors, total) {
  const max = Math.max(1, ...order.map((k) => counts[k] || 0));
  return order.map((k) => {
    const n = counts[k] || 0, pct = total ? Math.round((n / total) * 100) : 0;
    return '<div class="dash-meter"><div class="dash-meter-head"><span>' + k + "</span><span><b>" + n + "</b> <small>" + pct + '%</small></span></div><div class="dash-meter-track"><span style="width:' + (n / max) * 100 + "%;background:" + colors[k] + '"></span></div></div>';
  }).join("");
}

// one attention row (card): tags line, title + customer, optional quote, time, one small button on the right
function dashAttnRow(title, who, tags, quote, when, btn) {
  return '<div class="dash-attn"><div class="dash-attn-main">' +
    '<div class="dash-attn-meta">' + tags + "</div>" +
    '<div class="dash-attn-title"><strong>' + crmEscape(title || "—") + "</strong>" + (who ? '<span class="dash-attn-who">' + crmEscape(who) + "</span>" : "") + "</div>" +
    (quote ? '<p class="dash-quote">“' + crmEscape(quote) + "”</p>" : "") +
    (when ? '<div class="dash-attn-time"><i class="bi bi-clock" aria-hidden="true"></i> ' + when + "</div>" : "") +
    "</div>" + btn + "</div>";
}

function crmRenderDashboard(root, data) {
  const role = root.dataset.dashboardRole;
  // The tickets page has a different file per role (there is no plain "ticket.html"):
  //   Customer Service Staff -> cs-ticket.html     Admin / Manager -> manager-admin-ticket.html
  DASH_PAGES.tickets = role === "customer-service" ? "cs-ticket.html" : "manager-admin-ticket.html";
  const list = (v) => (Array.isArray(v) ? v : []);
  const $ = (id) => root.querySelector("#" + id);
  const set = (id, html) => { const el = $(id); if (el) el.innerHTML = html; };
  const num = (src, k) => Number((src || {})[k]) || 0;
  const go = (page, label, ref, kind) => '<button type="button" class="dash-btn-outline" data-dash-page="' + crmEscape(page) + '"' + (ref ? ' data-dash-' + (kind || "ticket") + '="' + crmEscape(ref) + '"' : "") + ">" + label + "</button>";

  const sub = $("dashSub");
  if (sub && DASH_SUB[role]) sub.textContent = DASH_SUB[role](data.user_name || "");

  // ---- donuts / pipeline
  const stages = CRM_OPS_INQUIRY.map(([label, color]) => ({ label, color, count: num(data.inquiry_stages, label) }));
  set("dashInquiryChart", dashDonut(stages, role === "sales" ? "ASSIGNED" : "INQUIRIES"));
  const books = DASH_SERVICE_COLORS.map(([label, color]) => ({ label, color, count: num(data.booking_services, label) }));
  set("dashBookingChart", dashDonut(books, "BOOKINGS"));

  // ---- Admin: needs attention
  const pend = list(data.pending_actions);
  if (pend.length) {
    set("dashPending", '<ul class="dash-actions">' + pend.map((p) =>
      '<li class="' + (Number(p.count) ? "" : "is-zero") + '"><span class="dash-dot"></span><span class="dash-action-label">' + crmEscape(p.label) + '</span><span class="dash-count">' + (Number(p.count) || 0) + "</span>" + go(p.page, crmEscape(p.button)) + "</li>").join("") + "</ul>");
  }

  // ---- Manager: workload + needs attention
  const wl = list(data.sales_workload);
  set("dashWorkload", wl.length
    ? '<table class="table align-middle mb-0 dash-table"><thead><tr><th>Staff</th><th class="text-center">Inquiries</th><th class="text-center">Events</th></tr></thead><tbody>' +
      wl.map((w) => '<tr><td><span class="iq-avatar dash-mini-avatar">' + crmEscape(crmSdInitials(w.name)) + "</span>" + crmEscape(w.name) + '</td><td class="text-center"><b>' + (Number(w.active_inquiries) || 0) + '</b></td><td class="text-center"><b>' + (Number(w.upcoming_bookings) || 0) + "</b></td></tr>").join("") + "</tbody></table>"
    : dashEmpty("No sales staff", "Active Sales Staff accounts will appear here."));
  if (role === "manager") {
    set("dashAttention", '<ul class="dash-actions is-two-line">' + list(data.attention).map((a) =>
      '<li class="' + (Number(a.count) ? "" : "is-zero") + '"><span class="dash-dot"></span><div class="dash-action-main"><span class="dash-action-label">' + crmEscape(a.label) + "</span><small>" + crmEscape(a.hint) + '</small></div><span class="dash-count">' + (Number(a.count) || 0) + "</span>" + go(a.page, "View") + "</li>").join("") + "</ul>");
  }

  // ---- Sales: needs attention
  if (role === "sales") {
    const a = list(data.attention);
    const chip = $("dashAttentionChip"); if (chip) chip.textContent = a.length ? a.length + " item" + (a.length > 1 ? "s" : "") : "";
    set("dashAttention", a.length ? a.map((r) => {
      const unread = r.kind === "unread";
      return dashAttnRow(r.event_name, r.customer_name,
        dashRef(r.inquiry_ref) + '<span class="dash-tag ' + (unread ? "is-amber" : "is-blue") + '">' + (unread ? "Customer replied" : "New — not started") + "</span>",
        r.message, dashStamp(r.at), go(unread ? DASH_PAGES.inbox : DASH_PAGES.salesInquiries, unread ? "Open chat" : "View", r.inquiry_ref, unread ? "chat" : "inquiry"));
    }).join("") : dashEmpty("All caught up!", "No inquiries need your action right now."));
  }

  // ---- Customer Service
  if (role === "customer-service") {
    const t = list(data.attention).slice(0, 4);
    const chip = $("dashAttentionChip"); if (chip) chip.textContent = t.length ? t.length + " ticket" + (t.length > 1 ? "s" : "") : "";
    set("dashAttention", t.length ? t.map((r) => {
      const wait = Number(r.awaiting_staff);
      return dashAttnRow(r.subject, r.customer_name,
        dashRef(r.ticket_number) + crmOpsPill(r.priority, CRM_TICKET_PRIORITY_CLASS) + (wait ? '<span class="dash-tag is-amber">Awaiting reply</span>' : ""),
        r.last_message, dashStamp(r.updated_at), go(wait ? DASH_PAGES.inbox : DASH_PAGES.tickets, wait ? "Reply" : "View", r.ticket_number));
    }).join("") : dashEmpty("All caught up!", "No tickets need a reply right now."));

    const st = data.ticket_statuses || {}, pr = data.ticket_priorities || {};
    const sTot = Object.values(st).reduce((a, b) => a + (Number(b) || 0), 0), pTot = Object.values(pr).reduce((a, b) => a + (Number(b) || 0), 0);
    const ST = [["Open", CRM_PALETTE.red], ["In Progress", CRM_PALETTE.blue], ["Pending", CRM_PALETTE.amber], ["Resolved", CRM_PALETTE.green]];
    const PR = [["Urgent", CRM_PALETTE.red], ["High", CRM_PALETTE.orange], ["Medium", CRM_PALETTE.yellow], ["Low", CRM_PALETTE.green]];
    set("dashStatusMeters", dashDonut(ST.map(([label, color]) => ({ label, color, count: Number(st[label]) || 0 })), "TICKETS"));
    set("dashPriorityMeters", dashDonut(PR.map(([label, color]) => ({ label, color, count: Number(pr[label]) || 0 })), "TICKETS"));
    const a = $("dashStatusTotal"); if (a) a.textContent = sTot + " total";
    const b = $("dashPriorityTotal"); if (b) b.textContent = pTot + " total";

    const rec = list(data.recent_tickets);
    set("dashRecent", rec.length ? '<div class="table-responsive"><table class="table align-middle mb-0 dash-table"><thead><tr><th>Ticket</th><th>Customer</th><th>Priority</th><th>Status</th><th>Updated</th></tr></thead><tbody>' +
      rec.map((r) => '<tr class="dash-row-link" data-dash-page="' + DASH_PAGES.tickets + '" data-dash-ticket="' + crmEscape(r.ticket_number) + '"><td><div class="dash-cell-title">' + crmEscape(r.subject) + '</div><div class="dash-cell-sub">' + crmEscape(r.ticket_number) + "</div></td><td>" + crmEscape(r.customer_name || "—") + "</td><td>" + crmOpsPill(r.priority, CRM_TICKET_PRIORITY_CLASS) + "</td><td>" + crmOpsPill(r.status, CRM_TICKET_STATUS_CLASS) + '</td><td class="text-nowrap">' + dashStamp(r.updated_at) + "</td></tr>").join("") + "</tbody></table></div>"
      : dashEmpty("No tickets yet", "Support tickets will appear here."));
  }

  // ---- bookings + activity (Admin / Manager / Sales)
  if ($("dashBookings")) set("dashBookings", dashBookingsTable(list(data.upcoming_bookings), { staff: role !== "sales" }));
  if ($("dashActivity")) set("dashActivity", dashFeed(list(data.activity), role === "admin" ? "By " : ""));

  // ---- clicks (one handler; root is replaced when the page is reopened)
  root.onclick = (event) => {
    const bk = event.target.closest("[data-dash-booking]");
    if (bk) {
      try { sessionStorage.setItem("crmOpenBooking", bk.dataset.dashBooking); } catch (e) {}
      if (typeof window.loadPage === "function") window.loadPage(DASH_PAGES.calendar);
      return;
    }
    const page = event.target.closest("[data-dash-page]");
    if (page && typeof window.loadPage === "function") {
      // a ticket row / Reply button: the Inbox opens that conversation, the Tickets page opens that ticket
      const ticket = page.dataset.dashTicket;
      if (ticket) {
        if (page.dataset.dashPage === DASH_PAGES.inbox) window.crmPendingInboxTicket = ticket;
        else window.crmPendingTicketRef = ticket;
      }
      // Sales Staff: Open chat -> that inquiry's conversation in the Inbox; View -> that inquiry on the Inquiries page
      if (page.dataset.dashChat) window.crmPendingChatRef = page.dataset.dashChat;
      if (page.dataset.dashInquiry) window.crmPendingInquiryRef = page.dataset.dashInquiry;
      window.loadPage(page.dataset.dashPage);
    }
  };
}

async function crmLoadRoleDashboard(root) {
  try {
    const response = await fetch("dashboard-api.php", {
      method: "GET",
      credentials: "same-origin",
      headers: { Accept: "application/json" },
      cache: "no-store",
    });
    const data = await response.json();
    if (!response.ok || !data.success || !data.metrics) {
      throw new Error(data.message || "Unable to load dashboard data.");
    }
    root.querySelectorAll("[data-metric]").forEach((element) => {
      const value = data.metrics[element.dataset.metric];
      element.textContent =
        value === undefined || value === null ? "0" : String(value);
    });
    root.querySelectorAll("[data-stage-group]").forEach((group) => {
      const groupName = group.dataset.stageGroup;
      const counts = data[groupName] || {};
      group.querySelectorAll("[data-stage-count]").forEach((element) => {
        const stage = element.dataset.stageCount;
        element.textContent = String(counts[stage] ?? 0);
      });
    });
    crmFillProgressBars();
    crmRenderDashboard(root, data);
  } catch (error) {
    console.error("Unable to load dashboard data:", error);
    root.querySelectorAll("[data-dashboard-table]").forEach((body) => {
      const table = body.closest("table");
      const columnCount = table ? table.querySelectorAll("thead th").length : 1;
      body.innerHTML = crmEmptyRow(
        columnCount,
        "Dashboard data is unavailable. Refresh to try again.",
      );
    });
    root.querySelectorAll("[data-metric]").forEach((element) => {
      element.textContent = "—";
    });
    root.querySelectorAll('[id^="dash"]').forEach((box) => {
      if (box.id === "dashSub") return;
      box.innerHTML = '<p class="sd-empty-note">Dashboard data is unavailable. Refresh to try again.</p>';
    });
  }
}
// Save each dropdown's initial label for resets.
function crmInitModalDefaults() {
  document
    .querySelectorAll(".modal .custom-dropdown-toggle span")
    .forEach((span) => {
      if (span.dataset.defaultLabel === undefined) {
        span.dataset.defaultLabel = span.textContent.trim();
        span.dataset.wasMuted = span.classList.contains("text-muted")
          ? "1"
          : "0";
      }
    });
}
// Fill the stage menu only when the API left it empty.

// Rebuild the stage filter when the selected type changes.
function crmUpdateStageFilter(typeValue) {
  const menu = document.getElementById("stagesFilterDropdown");
  if (!menu) return;
  const dropdown = menu.closest(".dropdown");
  const span = dropdown
    ? dropdown.querySelector(".custom-dropdown-toggle span")
    : null;
  if (span && !span.dataset.defaultLabel)
    span.dataset.defaultLabel = span.textContent.trim();
  const t = String(typeValue || "").toLowerCase();
  const toggle = dropdown
    ? dropdown.querySelector(".custom-dropdown-toggle")
    : null;
  const stages =
    t === "lead" ? CRM_LEAD_STAGES : t === "deal" ? CRM_DEAL_STAGES : [];
  window.populateDropdown("stagesFilterDropdown", stages, "All Stages");
  if (toggle) toggle.disabled = false;
  menu.dataset.auto = "1";
  // Reset the filter label and selection.
  if (span) span.textContent = span.dataset.defaultLabel;
  if (window.activeTableFilters) window.activeTableFilters.stage = "all";
}

// Admin + Manager Inquiries page (manager-admin-inquiries.html).
// The cards are built here from the backend list, so nothing is typed in the HTML.
// Backend contract: GET inquiries-api.php?action=list ->
//   { success: true, inquiries: [ { inquiry_ref, customer_name, event_title, event_date,
//     arrangement, submitted_at, expected_guests, assigned_staff, stage, customer_notes } ] }
// You can also call window.crmRenderInquiries(list) yourself.
// Optional: "sales_staff": [ { id, name } ] (or plain names) = who can be picked in Reassign.
// View  -> opens the detail view inside this page (also fires "crm:view-inquiry").
// Reassign (Admin + Manager) -> POST inquiries-api.php?action=reassign with
//   inquiry_ref, new_staff_id, new_staff_name, previous_staff, reason, reason_note.
//   On success the card shows the new staff and "crm:reassign-inquiry" is fired.
// Delete: turned off on purpose. Inquiries are never deleted from this page (canDelete = false below).
const CRM_INQUIRY_STAGES = [
  "New Inquiry",
  "In Progress",
  "In Discussion",
  "Quotation Preparation",
  "Quotation Sent",
  "Negotiation",
  "Confirmed",
  "Declined",
];

// Stage filter on the Sales Staff Inquiries page: only these 4 stages (the manager page keeps CRM_INQUIRY_STAGES above).
const CRM_SALES_FILTER_STAGES = ["New Inquiry", "In Progress", "Declined", "Completed"];

function crmInquiryPick(record, keys) {
  for (const key of keys) {
    const value = record && record[key];
    if (value !== undefined && value !== null && String(value).trim() !== "")
      return String(value).trim();
  }
  return "";
}

function crmInquiryDate(value) {
  if (!value) return "—";
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(value));
  const d = m ? new Date(+m[1], +m[2] - 1, +m[3]) : new Date(value);
  if (isNaN(d.getTime())) return String(value);
  return d.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

// PAX / guest count only applies to Buffet with Setup (on-site). Pickup and Delivery have no PAX.
function crmArrangementHasPax(text) {
  return /buffet|set-?up|on-?site/i.test(String(text || ""));
}

// Pickup / Delivery / Event time (8:00 AM - 8:00 PM). Accepts "14:30", "14:30:00" or "2:30 PM"; returns "2:30 PM" or "" when there is none.
function crmTimeText(raw) {
  const t = String(raw || "").trim();
  if (!t) return "";
  if (/[ap]\.?m/i.test(t)) return t.toUpperCase().replace(/\./g, "");
  const m = /^(\d{1,2}):(\d{2})/.exec(t);
  if (!m || +m[1] > 23 || +m[2] > 59) return "";
  const h = +m[1];
  return (h % 12 || 12) + ":" + m[2] + " " + (h >= 12 ? "PM" : "AM");
}
/* Deadline = date + time set by Sales Staff (quotation "valid until", payment "pay by"): 8:00 AM - 8:00 PM.
   crmDeadlineProblem() mirrors deadlineCheck() in quotations-schema.php (the server checks again). */
function crmDeadlineLabel(date, time) {
  const d = new Date(String(date || "").slice(0, 10) + "T00:00:00");
  const day = isNaN(d) ? String(date || "") : d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
  const t = crmTimeText(time);
  if (!String(date || "").trim()) return "";
  const iso = String(date).slice(0, 10), tm = new Date();
  tm.setDate(tm.getDate() + 1);
  const tomorrowIso = tm.getFullYear() + "-" + String(tm.getMonth() + 1).padStart(2, "0") + "-" + String(tm.getDate()).padStart(2, "0");
  const when = iso === crmTodayIso() ? "today, " : iso === tomorrowIso ? "tomorrow, " : "";   // from the day after tomorrow on, just the date
  return when + (t ? day + ", " + t : day + ", 11:59 PM");   // no time chosen = the end of that day
}
function crmDeadlineProblem(date, time, what) {
  const n = new Date();
  const today = n.getFullYear() + "-" + String(n.getMonth() + 1).padStart(2, "0") + "-" + String(n.getDate()).padStart(2, "0");
  if (!date) return "Choose the date.";
  if (date < today) return "The date cannot be in the past.";
  if (time && (time < "08:00" || time > "20:00")) return "The time must be between 8:00 AM and 8:00 PM.";
  if (date === today) {
    if (!time) return "The date is today, so choose a time for the " + what + " (between 8:00 AM and 8:00 PM).";
    if (new Date(date + "T" + time + ":00").getTime() < Date.now() + 3600000) return "The time must be at least 1 hour from now (and no later than 8:00 PM). Choose a later time.";
  }
  return "";
}
/* Quotation "valid until" (Sales Staff): 8:00 AM - 11:00 PM (11:00 PM included), always on the hour or half hour (7:00, 7:30).
   When the date is today the time must be at least 1 hour from now, rounded up to the next :00 / :30 (7:10 PM -> earliest 8:30 PM).
   Later days start at 8:00 AM. Mirrors quoteDeadlineCheck() in quotations-schema.php.
   Payment "pay by" keeps crmDeadlineProblem() above (8:00 AM - 8:00 PM). */
const CRM_QUOTE_TIME_MIN = "08:00", CRM_QUOTE_TIME_MAX = "23:00", CRM_QUOTE_BUFFER_MIN = 60, CRM_QUOTE_STEP_MIN = 30;
function crmQuoteMinTime(date) {
  const n = new Date();
  const today = n.getFullYear() + "-" + String(n.getMonth() + 1).padStart(2, "0") + "-" + String(n.getDate()).padStart(2, "0");
  if (date !== today) return CRM_QUOTE_TIME_MIN;
  let m = n.getHours() * 60 + n.getMinutes() + CRM_QUOTE_BUFFER_MIN;
  m = Math.ceil(m / CRM_QUOTE_STEP_MIN) * CRM_QUOTE_STEP_MIN;            // next :00 / :30
  if (m >= 24 * 60) return "23:59";
  const t = String(Math.floor(m / 60)).padStart(2, "0") + ":" + String(m % 60).padStart(2, "0");
  return t < CRM_QUOTE_TIME_MIN ? CRM_QUOTE_TIME_MIN : t;
}
function crmTodayIso() {
  const n = new Date();
  return n.getFullYear() + "-" + String(n.getMonth() + 1).padStart(2, "0") + "-" + String(n.getDate()).padStart(2, "0");
}
/* Rush event = 3 days away or less (4 after 9:00 PM, like the customer rule). Only rush events ask for a deadline time; later ones end at 11:59 PM. */
function crmIsRushEvent(eventDate) {
  const day = String(eventDate || "").slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(day)) return false;
  const days = Math.round((new Date(day + "T00:00:00") - new Date(crmTodayIso() + "T00:00:00")) / 86400000);
  return days <= 3 + (new Date().getHours() >= 21 ? 1 : 0);
}
function crmQuoteDeadlineProblem(date, time, what, rush) {
  const n = new Date();
  const today = n.getFullYear() + "-" + String(n.getMonth() + 1).padStart(2, "0") + "-" + String(n.getDate()).padStart(2, "0");
  if (!date) return "Choose the date.";
  if (date < today) return "The date cannot be in the past.";
  if (rush === false) return "";   // not a rush event: no time, the deadline is 11:59 PM of that day (even when the date is today)
  if (time && (time < CRM_QUOTE_TIME_MIN || time > CRM_QUOTE_TIME_MAX)) return "The time must be between 8:00 AM and 11:00 PM.";
  if (time && +time.slice(3, 5) % CRM_QUOTE_STEP_MIN !== 0) return "Choose a time on the hour or half hour (for example 7:00 PM or 7:30 PM).";
  if (date === today) {
    if (!time) return "The date is today, so choose a time for the " + what + " (between 8:00 AM and 11:00 PM).";
    const min = crmQuoteMinTime(date);
    if (min > CRM_QUOTE_TIME_MAX) return "It is too late to set a " + what + " for today (it must be at least 1 hour from now and no later than 11:00 PM). Choose a later date if the event allows it.";
    if (time < min) return "The time must be at least 1 hour from now (earliest: " + crmTimeText(min) + ") and no later than 11:00 PM. Choose a later time.";
  }
  return "";
}
function crmTimeLabel(arrangement) {
  const a = String(arrangement || "");
  if (/pick/i.test(a)) return "Pickup Time";
  if (/deliver/i.test(a)) return "Delivery Time";
  return "Event Time";
}

// Inquiry order: 0 Unassigned (event within 7 days first, then oldest submitted)
//   -> 1 Active (unread first, then nearest event) -> 2 Confirmed -> 3 Declined (bottom, newest first)
function crmInquirySort(list) {
  const iso = (d) => d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0");
  const now = new Date(); now.setHours(0, 0, 0, 0);
  const today = iso(now);
  const week = new Date(now); week.setDate(week.getDate() + 7);
  const weekIso = iso(week);
  const info = (r) => {
    const stage = String(r.stage || r.status || "").toLowerCase();
    const staff = String(r.assigned_staff || "").trim();
    const date = String(r.event_date || "").slice(0, 10);
    let tier = 1;
    if (/declin|cancel/.test(stage)) tier = 3;       // checked first, so an unassigned Declined one goes to the bottom
    else if (!staff) tier = 0;
    else if (stage === "confirmed") tier = 2;
    return { r, tier, date, created: String(r.created_at || ""), unread: Number(r.unread_count) || 0,
             urgent: !!date && date >= today && date <= weekIso };
  };
  return list.map(info).sort((a, b) => {
    if (a.tier !== b.tier) return a.tier - b.tier;
    if (a.tier === 0) return (b.urgent - a.urgent) || a.created.localeCompare(b.created);
    if (a.tier === 3) return b.created.localeCompare(a.created);
    if (a.tier === 1 && (a.unread > 0) !== (b.unread > 0)) return b.unread > 0 ? 1 : -1;
    return (a.date || "9999").localeCompare(b.date || "9999") || b.created.localeCompare(a.created);
  }).map((x) => x.r);
}

// One normalized view of a record, shared by the card and the detail view.
function crmInquiryFields(record) {
  const guestsRaw = crmInquiryPick(record, ["expected_guests", "guests", "pax"]);
  const hasPax = crmArrangementHasPax(crmInquiryPick(record, ["arrangement", "service_type", "service"]));
  const guestsNum = hasPax ? guestsRaw.replace(/\s*(pax|guests?)$/i, "") : "";
  const rawArrangementDetails = record && (record.arrangement_details || record.delivery_details);
  let arrangementDetails = rawArrangementDetails && typeof rawArrangementDetails === "object" ? rawArrangementDetails : null;
  if (!arrangementDetails && typeof rawArrangementDetails === "string") {
    try { arrangementDetails = JSON.parse(rawArrangementDetails); } catch (_) { arrangementDetails = null; }
  }
  if (!arrangementDetails || typeof arrangementDetails !== "object" || Array.isArray(arrangementDetails)) arrangementDetails = null;
  const arrangement = crmInquiryPick(record, ["arrangement", "service_type", "service"]);
  return {
    customer: crmInquiryPick(record, ["customer_name", "customer", "client_name"]) || "Customer",
    ref: crmInquiryPick(record, ["inquiry_ref", "inquiry_code", "reference", "inquiry_id", "id"]),
    title: crmInquiryPick(record, ["event_title", "event_name", "inquiry_event_name", "title"]) || "—",
    arrangement: arrangement || "—",
    locationLabel: /pick-?up/i.test(arrangement) ? "Pickup Location" : (/deliver/i.test(arrangement) ? "Delivery Address" : "Event Venue / Address"),
    arrangementDetails,
    stage: crmInquiryPick(record, ["stage", "status", "inquiry_status"]) || "New Inquiry",
    staff: crmInquiryPick(record, ["assigned_staff", "assigned_to", "staff_name"]) || "Unassigned",
    eventDate: crmInquiryDate(crmInquiryPick(record, ["event_date", "date"])),
    eventTime: crmInquiryPick(record, ["event_time_display"]) || crmTimeText(crmInquiryPick(record, ["event_time", "time"])),
    timeLabel: crmTimeLabel(crmInquiryPick(record, ["arrangement", "service_type", "service"])),
    submitted: crmInquiryDate(crmInquiryPick(record, ["submitted_at", "created_at"])),
    guestsNum,
    hasPax,
    notes: crmInquiryPick(record, ["customer_notes", "notes", "requirements", "special_requests"]),
    photo: crmInquiryPick(record, ["customer_photo", "photo_url"]),
  };
}

function crmInquiryCardHTML(record, canDelete, index, canReassign) {
  const f = crmInquiryFields(record);
  const guests = f.guestsNum ? f.guestsNum + " PAX" : "—";
  const initials =
    f.customer.split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0]).join("") || "?";
  const stageClass = CRM_STAGE_CLASS[f.stage.toLowerCase()] || "stage-new";
  const refAttr = crmEscape(f.ref);

  return (
    '<article class="card iq-card" data-index="' + index + '" data-ref="' + refAttr + '"' +
    ' data-stage="' + crmEscape(f.stage.toLowerCase()) + '"' +
    ' data-staff="' + crmEscape(f.staff.toLowerCase()) + '">' +
      '<div class="iq-card-head">' +
        crmAvatarHTML(initials, f.photo) +
        '<div class="iq-head-main">' +
          '<h4 class="iq-customer">' + crmEscape(f.customer) + "</h4>" +
          '<span class="iq-ref">' + refAttr + "</span>" +
        "</div>" +
        '<span class="stage-pill ' + stageClass + '">' + crmEscape(f.stage) + "</span>" +
      "</div>" +
      '<ul class="iq-lines">' +
        '<li><i class="bi bi-calendar4" aria-hidden="true"></i>Event Date: ' + crmEscape(f.eventDate + (f.eventTime ? " \u2022 " + f.eventTime : "")) + "</li>" +
        '<li><i class="bi bi-layers-fill" aria-hidden="true"></i>Arrangement: ' + crmEscape(f.arrangement) + "</li>" +
        '<li><i class="bi bi-clock" aria-hidden="true"></i>Submitted: ' + crmEscape(f.submitted) + "</li>" +
      "</ul>" +
      '<div class="iq-facts">' +
        (f.hasPax ? '<div><span class="stat-label">Expected Guests</span><span class="iq-fact-value is-green">' + crmEscape(guests) + "</span></div>" : "") +
        '<div><span class="stat-label">Assigned Staff</span><span class="iq-fact-value">' + crmEscape(f.staff) + "</span></div>" +
      "</div>" +
      '<div class="iq-event"><span class="stat-label">Event Title</span><span class="iq-fact-value">' + crmEscape(f.title) + "</span></div>" +
      '<div class="iq-actions">' +
        (canDelete
          ? '<button type="button" class="action-btn-delete iq-delete" data-iq-action="delete" aria-label="Delete inquiry ' + refAttr + '"><i class="bi bi-trash3-fill" aria-hidden="true"></i></button>'
          : "") +
        (canReassign
          ? '<button type="button" class="btn modal-btn-cancel iq-reassign" data-iq-action="reassign"><i class="bi bi-arrow-left-right" aria-hidden="true"></i>Reassign</button>'
          : "") +
        '<button type="button" class="btn modal-btn-save iq-view" data-iq-action="view"><i class="bi bi-arrow-right" aria-hidden="true"></i>View</button>' +
      "</div>" +
    "</article>"
  );
}

function crmInquiryDetailHTML(record) {
  const f = crmInquiryFields(record);
  const { dash, head, field, value, person } = crmDetailKit();
  const stageClass = CRM_STAGE_CLASS[f.stage.toLowerCase()] || "stage-new";
  const guests = f.guestsNum ? f.guestsNum + " Guests" : "";
  const phone = crmInquiryPick(record, ["customer_phone", "customer_contact", "customer_contact_number", "customer_mobile", "contact_number", "contact_no", "contact", "mobile", "phone", "phone_number"]);
  const email = crmInquiryPick(record, ["customer_email", "customer_email_address", "customer_gmail", "email", "email_address", "gmail"]);
  const assigned = crmAvDateTime(crmInquiryPick(record, ["assigned_at", "assignment_date", "claimed_at", "assigned_date"]));
  const staffPhoto = crmInquiryPick(record, ["staff_photo", "assigned_staff_photo"]);
  return (
    '<button type="button" class="iq-back" data-iq-action="back"><i class="bi bi-arrow-left" aria-hidden="true"></i>Back to Inquiries List</button>' +
    '<div class="iq-detail-head">' +
      '<div class="iq-detail-ref" role="heading" aria-level="2">' + crmEscape(f.ref || "Inquiry") + "</div>" +
      '<span class="stage-pill ' + stageClass + '">' + crmEscape(f.stage) + "</span>" +
    "</div>" +
    '<div class="iq-detail-col">' +
      '<section class="card iq-detail-card">' + head("Event Specifications") +
        '<div class="tk-contact-grid">' +
          field("Event Name", value(f.title)) +
          field("Requested Event Date", value(f.eventDate)) +
          (f.eventTime ? field("Requested " + f.timeLabel, value(f.eventTime)) : "") +
          field("Date Submitted", value(f.submitted)) +
          (f.hasPax ? field("Expected Guests", '<span class="iq-value is-green">' + dash(guests) + "</span>") : "") +
          field("Catering Arrangement", value(f.arrangement)) +
          field("Assigned Staff", '<span class="iq-value">' + person(f.staff, staffPhoto, "Unassigned") + "</span>") +
          (assigned !== "—" ? field("Assignment Date", value(assigned)) : "") +
        "</div>" +
      "</section>" +
      '<section class="card iq-detail-card">' + head("Customer Information") +
        '<div class="tk-contact-grid">' +
          field("Full Name", '<span class="iq-value">' + person(f.customer, f.photo) + "</span>") +
          field("Contact Number", value(phone)) +
          field("Email Address", value(email)) +
        "</div>" +
      "</section>" +
      '<section class="card iq-detail-card">' + head("Customer Notes &amp; Requirements") +
        '<div class="iq-notes">' + (f.notes ? crmEscape(f.notes) : "No notes were added.") + "</div>" +
      "</section>" +
    "</div>"
  );
}


function crmInitManagerInquiries(root) {
  const listView = root.querySelector("#iqListView");
  const detailView = root.querySelector("#iqDetailView");
  const grid = root.querySelector("#iqGrid");
  const state = root.querySelector("#iqState");
  const noResults = root.querySelector("#iqNoResults");
  const input = root.querySelector("#iqSearchInput");
  const deleteModalEl = root.querySelector("#deleteInquiryModal");
  const deleteName = root.querySelector("#iqDeleteName");
  const deleteConfirm = root.querySelector("#iqDeleteConfirm");
  const reassignModalEl = root.querySelector("#reassignInquiryModal");
  if (!grid || !listView || !detailView) return;

  // Inquiries cannot be deleted by anyone (Admin or Manager): the delete button is not shown.
  const canDelete = false;
  // Admin and Manager can reassign an inquiry to another Sales Staff member.
  const canReassign =
    !!reassignModalEl &&
    typeof CRM_ROLE !== "undefined" &&
    (CRM_ROLE === "admin" || CRM_ROLE === "manager");

  const filters = { search: "", stage: "all", staff: "all" };
  let records = [];
  let pendingDelete = -1;
  let pendingReassign = -1;
  let salesStaff = []; // [{ id, name }] from the backend (optional)

  function applyFilters() {
    const term = input ? input.value.trim().toLowerCase() : "";
    const cards = Array.from(grid.querySelectorAll(".iq-card"));
    let visible = 0;
    cards.forEach((card) => {
      const match =
        (term === "" || card.textContent.toLowerCase().includes(term)) &&
        (filters.stage === "all" || card.dataset.stage === filters.stage) &&
        (filters.staff === "all" || card.dataset.staff === filters.staff);
      card.style.display = match ? "" : "none";
      if (match) visible++;
    });
    // Cards exist but search / filters hid them all -> shared "No results found" box.
    // No cards at all -> plain "No inquiries yet." message.
    if (noResults) noResults.hidden = !(cards.length > 0 && visible === 0);
    if (state) {
      state.hidden = cards.length > 0;
      if (cards.length === 0) state.textContent = "No inquiries yet.";
    }
  }

  // Reuse the shared dropdown click handler: it updates these filters, then calls applyTableFilters.
  window.activeTableFilters = filters;
  window.applyTableFilters = applyFilters;

  window.populateDropdown("stagesFilterDropdown", CRM_INQUIRY_STAGES, "All Stages");

  function render(list) {
    records = Array.isArray(list) ? crmInquirySort(list) : [];
    grid.innerHTML = records.map((r, i) => crmInquiryCardHTML(r, canDelete, i, canReassign)).join("");
    const staffNames = [];
    records.forEach((r) => {
      const name = crmInquiryFields(r).staff;
      if (!staffNames.includes(name)) staffNames.push(name);
    });
    window.populateDropdown("staffFilterDropdownList", staffNames, "All Staff");
    applyFilters();
    // coming from the Inbox ("Open Inquiry Details"): open that inquiry straight away
    const wantInquiry = window.crmPendingInquiryRef;
    if (wantInquiry && records.length) {
      window.crmPendingInquiryRef = null;
      const at = records.findIndex((r) => String(crmInquiryFields(r).ref) === String(wantInquiry));
      if (at >= 0) showDetail(at);
    }
  }
  window.crmRenderInquiries = render;

  function showList() {
    detailView.hidden = true;
    detailView.innerHTML = "";
    listView.hidden = false;
    const body = document.querySelector(".content-body");
    if (body) body.scrollTop = 0;
  }

  function showDetail(index) {
    const record = records[index];
    if (!record) return;
    detailView.innerHTML = crmInquiryDetailHTML(record);
    listView.hidden = true;
    detailView.hidden = false;
    const body = document.querySelector(".content-body");
    if (body) body.scrollTop = 0;
  }

  if (input) input.oninput = applyFilters;

  grid.onclick = (event) => {
    const button = event.target.closest("[data-iq-action]");
    if (!button) return;
    const card = button.closest(".iq-card");
    if (!card) return;
    const index = Number(card.dataset.index);
    const ref = card.dataset.ref;

    if (button.dataset.iqAction === "view") {
      document.dispatchEvent(new CustomEvent("crm:view-inquiry", { detail: { ref, card } }));
      showDetail(index);
    } else if (button.dataset.iqAction === "reassign" && canReassign) {
      openReassign(index);
    } else if (button.dataset.iqAction === "delete" && canDelete) {
      pendingDelete = index;
      if (deleteName) deleteName.textContent = ref || crmInquiryFields(records[index]).customer;
      if (deleteModalEl && window.bootstrap)
        bootstrap.Modal.getOrCreateInstance(deleteModalEl).show();
    }
  };

  // ---- Reassign (Admin + Manager) ----
  // Uses the shared modal dropdowns: .dropdown[data-field] fills a hidden input with the picked value.
  const rq = (sel) => (reassignModalEl ? reassignModalEl.querySelector(sel) : null);
  const ddValue = (dd) => {
    const h = dd ? dd.querySelector('input[type="hidden"]') : null;
    return h ? h.value : "";
  };

  function resetReassignForm() {
    if (!reassignModalEl) return;
    reassignModalEl
      .querySelectorAll('.dropdown[data-field] input[type="hidden"]')
      .forEach((h) => h.remove());
    reassignModalEl.querySelectorAll(".custom-dropdown-toggle").forEach((t) => {
      t.classList.remove("dd-invalid");
      const s = t.querySelector("span");
      if (s && s.dataset.defaultLabel === undefined) s.dataset.defaultLabel = s.textContent.trim();
      if (s) s.textContent = s.dataset.defaultLabel;
    });
    const note = rq("#iqReassignNote");
    const noteWrap = rq("#iqReassignNoteWrap");
    if (note) note.value = "";
    if (noteWrap) noteWrap.hidden = true;
    const err = rq("#iqReassignError");
    if (err) { err.hidden = true; err.textContent = ""; }
    const confirm = rq("#iqReassignConfirm");
    if (confirm) { confirm.disabled = false; confirm.textContent = "Confirm Reassignment"; }
  }

  function reassignChoices(currentStaff) {
    let list = salesStaff.slice();
    if (list.length === 0) {
      // No list from the backend: use the staff already seen on the cards.
      records.forEach((r) => {
        const name = crmInquiryFields(r).staff;
        if (name && name !== "Unassigned" && !list.some((s) => s.name === name))
          list.push({ id: name, name: name });
      });
    }
    const current = String(currentStaff || "").trim().toLowerCase();
    return list
      .filter((s) => s.name.trim().toLowerCase() !== current)
      .map((s) => ({ text: s.name, value: s.id }));
  }

  function openReassign(index) {
    const record = records[index];
    if (!record || !reassignModalEl) return;
    pendingReassign = index;
    const f = crmInquiryFields(record);
    const stageClass = CRM_STAGE_CLASS[f.stage.toLowerCase()] || "stage-new";
    const set = (sel, text) => { const el = rq(sel); if (el) el.textContent = text; };
    set("#iqReassignRef", f.ref || "—");
    set("#iqReassignEvent", f.title);
    set("#iqReassignCustomer", f.customer);
    set("#iqReassignPrevious", f.staff);
    const pill = rq("#iqReassignStage");
    if (pill) { pill.className = "stage-pill " + stageClass; pill.textContent = f.stage; }

    resetReassignForm();
    const choices = reassignChoices(f.staff);
    window.populateDropdown("iqReassignStaffMenu", choices);
    const empty = rq("#iqReassignEmpty");
    if (empty) empty.hidden = choices.length > 0;
    if (window.bootstrap) bootstrap.Modal.getOrCreateInstance(reassignModalEl).show();
  }

  if (reassignModalEl) {
    // "Other" asks for a short explanation.
    reassignModalEl.addEventListener("click", (event) => {
      const item = event.target.closest('.dropdown[data-field="reassign_reason"] .custom-dropdown-item');
      if (!item) return;
      const wrap = rq("#iqReassignNoteWrap");
      if (wrap) wrap.hidden = item.textContent.trim().toLowerCase() !== "other";
    });

    const confirmBtn = rq("#iqReassignConfirm");
    if (confirmBtn)
      confirmBtn.onclick = () => {
        if (!canReassign || pendingReassign < 0 || !records[pendingReassign]) return;
        const record = records[pendingReassign];
        const f = crmInquiryFields(record);
        const staffDd = rq('.dropdown[data-field="new_staff"]');
        const reasonDd = rq('.dropdown[data-field="reassign_reason"]');
        const staffId = ddValue(staffDd);
        const reason = ddValue(reasonDd);
        const staffName = staffDd ? staffDd.querySelector(".custom-dropdown-toggle span").textContent.trim() : "";
        const noteEl = rq("#iqReassignNote");
        const note = noteEl ? noteEl.value.trim() : "";
        const err = rq("#iqReassignError");
        const showError = (text) => { if (err) { err.textContent = text; err.hidden = false; } };

        if (err) err.hidden = true;
        let ok = true;
        [[staffDd, staffId], [reasonDd, reason]].forEach(([dd, value]) => {
          const toggle = dd && dd.querySelector(".custom-dropdown-toggle");
          if (toggle) toggle.classList.toggle("dd-invalid", value === "");
          if (value === "") ok = false;
        });
        if (!ok) return showError("Please select the new Sales Staff member and the reassignment reason.");
        if (reason.toLowerCase() === "other" && note === "")
          return showError("Please tell us the reason for reassigning.");

        const form = new FormData();
        form.append("inquiry_ref", f.ref);
        form.append("new_staff_id", staffId);
        form.append("new_staff_name", staffName);
        form.append("previous_staff", f.staff);
        form.append("reason", reason);
        form.append("reason_note", note);

        const url = (root.dataset.reassignApi || root.dataset.api || "").replace(/action=[^&]*/, "action=reassign");
        confirmBtn.disabled = true;
        confirmBtn.textContent = "Reassigning...";
        fetch(url, {
          method: "POST",
          credentials: "same-origin",
          headers: { Accept: "application/json" },
          body: form,
        })
          .then((response) => response.json().then((data) => ({ response, data })))
          .then(({ response, data }) => {
            if (!response.ok || !data || data.success === false)
              throw new Error((data && data.message) || "Unable to reassign this inquiry.");
            let wrote = false;
            ["assigned_staff", "assigned_to", "staff_name"].forEach((key) => {
              if (key in record) { record[key] = staffName; wrote = true; }
            });
            if (!wrote) record.assigned_staff = staffName;
            if (window.bootstrap) bootstrap.Modal.getOrCreateInstance(reassignModalEl).hide();
            pendingReassign = -1;
            render(records);
            document.dispatchEvent(new CustomEvent("crm:reassign-inquiry", {
              detail: { ref: f.ref, record, from: f.staff, to: staffName, staffId, reason, note },
            }));
          })
          .catch((error) => {
            confirmBtn.disabled = false;
            confirmBtn.textContent = "Confirm Reassignment";
            showError(error.message || "Unable to reassign this inquiry.");
          });
      };
  }


  detailView.onclick = (event) => {
    if (event.target.closest('[data-iq-action="back"]')) showList();
  };

  if (deleteConfirm)
    deleteConfirm.onclick = () => {
      if (!canDelete || pendingDelete < 0 || !records[pendingDelete]) return;
      const removed = records[pendingDelete];
      const ref = crmInquiryFields(removed).ref;
      records.splice(pendingDelete, 1);
      pendingDelete = -1;
      if (deleteModalEl && window.bootstrap)
        bootstrap.Modal.getOrCreateInstance(deleteModalEl).hide();
      render(records);
      document.dispatchEvent(new CustomEvent("crm:delete-inquiry", { detail: { ref, record: removed } }));
    };

  // Load the list automatically.
  const url = root.dataset.api;
  if (!url) return render([]);
  if (state) { state.hidden = false; state.textContent = "Loading inquiries..."; }
  fetch(url, {
    method: "GET",
    credentials: "same-origin",
    headers: { Accept: "application/json" },
    cache: "no-store",
  })
    .then((response) => response.json().then((data) => ({ response, data })))
    .then(({ response, data }) => {
      if (document.getElementById("managerInquiriesPage") !== root) return;
      if (!response.ok || !data || !Array.isArray(data.inquiries))
        throw new Error((data && data.message) || "Unable to load inquiries.");
      salesStaff = (Array.isArray(data.sales_staff) ? data.sales_staff : Array.isArray(data.staff) ? data.staff : [])
        .map((s) => (s && typeof s === "object"
          ? { id: String(s.id !== undefined ? s.id : s.staff_id !== undefined ? s.staff_id : s.name || s.full_name || ""), name: String(s.name || s.full_name || s.staff_name || "").trim() }
          : { id: String(s), name: String(s).trim() }))
        .filter((s) => s.name !== "");
      render(data.inquiries);
    })
    .catch((error) => {
      console.warn("Inquiries could not be loaded:", error);
      if (document.getElementById("managerInquiriesPage") !== root) return;
      render([]);
      if (state) {
        state.hidden = false;
        const why = error && error.message && !/JSON|Unexpected token/i.test(error.message) ? error.message : "The server did not return valid JSON. Check that data-api points to manager-admin-inquiries.php?action=list.";
        state.textContent = "Unable to load inquiries. " + why;
      }
    });
}

// Sales Staff: Available Inquiries (sales-available.html).
// Backend contract: GET inquiries-api.php?action=available -> { success: true, inquiries: [ { inquiry_ref,
//   customer_name, event_title, event_date, arrangement, event_location, submitted_at, expected_guests, stage } ] }
// Claim (inside View Details) -> POST inquiries-api.php?action=claim with inquiry_ref; on success the card
//   leaves the list and "crm:claim-inquiry" is fired (detail.ref).
function crmAvDateTime(value) {
  if (!value) return "—";
  const d = new Date(String(value).replace(" ", "T"));
  if (isNaN(d.getTime())) return String(value);
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }) + " · " + d.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" });
}
function crmAvCardHTML(record, index, mine) {
  const f = crmInquiryFields(record);
  const guests = f.guestsNum ? f.guestsNum + " PAX" : "—";
  const location = crmInquiryPick(record, ["event_location", "location", "venue", "venue_address"]) || "—";
  const submittedRaw = crmInquiryPick(record, ["submitted_at", "created_at"]);
  const dateRaw = crmInquiryPick(record, ["event_date", "date"]).slice(0, 10);
  const ts = Date.parse(String(submittedRaw).replace(" ", "T")) || 0;
  const key = crmCalArrangementKey(f.arrangement);
  const stageClass = CRM_STAGE_CLASS[f.stage.toLowerCase()] || "stage-new";
  // "My Inquiries" (data-mode="mine"): the card also gets an Open Chat button with the unread count.
  const unread = Number(crmInquiryPick(record, ["unread_count", "unread", "unread_messages"])) || 0;
  const actions = mine
    ? '<div class="av-actions">' +
        '<button type="button" class="btn modal-btn-save av-view" data-av-action="view">View Details</button>' +
        '<button type="button" class="btn csi-outline-btn av-chat" data-av-action="chat"><i class="bi bi-chat" aria-hidden="true"></i>Open Chat' + (unread > 0 ? " (" + unread + ")" : "") + "</button>" +
      "</div>"
    : '<button type="button" class="btn modal-btn-save av-view" data-av-action="view">View Details</button>';
  return (
    '<article class="card av-card" data-index="' + index + '" data-ref="' + crmEscape(f.ref) + '" data-arr="' + key + '" data-stage="' + crmEscape(f.stage.toLowerCase()) + '" data-date="' + crmEscape(dateRaw) + '" data-ts="' + ts + '">' +
      '<div class="iq-card-head">' +
        crmAvatarHTML(crmTicketInitials(f.customer), f.photo) +
        '<div class="iq-head-main">' +
          '<h4 class="iq-customer">' + crmEscape(f.customer) + "</h4>" +
          '<span class="iq-ref">' + crmEscape(f.ref) + "</span>" +
        "</div>" +
        '<span class="stage-pill ' + stageClass + '">' + crmEscape(f.stage) + "</span>" +
      "</div>" +
      '<div class="av-title-row"><h4 class="av-title">' + crmEscape(f.title) + "</h4>" +
        '<time class="av-time">' + crmEscape(mine ? crmInquiryDate(submittedRaw) : crmAvDateTime(submittedRaw)) + "</time></div>" +
      '<div class="av-facts">' +
        '<div><span class="stat-label">Event Date</span><span class="av-fact">' + crmEscape(f.eventDate) + "</span></div>" +
        (f.eventTime ? '<div><span class="stat-label">' + crmEscape(f.timeLabel) + '</span><span class="av-fact">' + crmEscape(f.eventTime) + "</span></div>" : "") +
        (f.hasPax ? '<div><span class="stat-label">Guests (PAX)</span><span class="av-fact is-green">' + crmEscape(guests) + "</span></div>" : "") +
        '<div><span class="stat-label">Catering Arrangement</span><span class="av-fact">' + crmEscape(f.arrangement) + "</span></div>" +
        '<div><span class="stat-label">' + crmEscape(f.locationLabel) + '</span><span class="av-fact av-loc" title="' + crmEscape(location) + '">' + crmEscape(location) + "</span></div>" +
      "</div>" +
      actions +
    "</article>"
  );
}
function crmAvMoney(value) {
  if (value === undefined || value === null || String(value).trim() === "") return "—";
  const n = Number(String(value).replace(/[^0-9.\-]/g, ""));
  return Number.isNaN(n) ? String(value) : "₱" + n.toLocaleString("en-US", { maximumFractionDigits: 2 });
}
// Details screen of an available inquiry (View Details). Extra fields are shown when the backend sends them:
//   estimated_budget, special_requests, event_location, customer_email, customer_phone,
//   menu_items: [ { name, price_per_pax, pax, total } ]
function crmAvDetailHTML(record, mine) {
  if (mine) return crmAvMineDetailHTML(record);
  const f = crmInquiryFields(record);
  const pick = (keys) => crmInquiryPick(record, keys);
  const dash = (v) => crmEscape(v || "—");
  const stageClass = CRM_STAGE_CLASS[f.stage.toLowerCase()] || "stage-new";
  const unassigned = !mine && (!f.staff || f.staff === "Unassigned");
  const assignment = unassigned ? "Available / Unassigned" : mine ? (f.staff && f.staff !== "Unassigned" ? f.staff : "Assigned to me") : f.staff;
  const items = [record.menu_items, record.food_orders, record.items].find(Array.isArray) || [];
  const menu = items.length
    ? items.map((it) => {
        const name = crmInquiryPick(it, ["name", "item_name", "menu_name", "title"]) || "—";
        const tier = crmInquiryPick(it, ["tier", "portion", "portion_name"]);
        const pax = crmInquiryPick(it, ["pax", "pax_label", "quantity", "qty", "guests"]);
        const price = crmInquiryPick(it, ["price", "price_label", "price_per_pax", "unit_price"]);
        const image = crmInquiryPick(it, ["photo", "image", "image_url"]);
        const sub = [tier, pax && f.hasPax ? (/pax/i.test(String(pax)) ? pax : pax + " PAX") : "", price ? (/[^0-9.\s]/.test(String(price)) ? price : crmAvMoney(price)) : ""].filter(Boolean).join(" · ");
        // newer API rows carry ready-made lines: quantity = "× 2 · serves 50 PAX", details = "LARGE · ₱3,000.00 each · ₱6,000.00 total"
        const qtyLine = crmInquiryPick(it, ["quantity"]);
        const detailLine = crmInquiryPick(it, ["details"]);
        const lines = (qtyLine || detailLine) ? [qtyLine, detailLine || sub] : [sub];
        return '<li class="av-d-menu-row justify-content-start">' +
          (image ? '<img src="' + crmEscape(image) + '" alt="" style="width:56px;height:56px;object-fit:cover;border-radius:12px;margin-right:12px;">' : "") +
          '<div><strong>' + crmEscape(name) + "</strong>" + lines.filter(Boolean).map((t) => "<span>" + crmEscape(t) + "</span>").join("") + "</div></li>";
      }).join("")
    : '<li class="av-d-menu-empty">No menu items were selected.</li>';
  const field = (label, value, cls) => '<div><span class="av-d-label">' + label + '</span><span class="av-d-value' + (cls ? " " + cls : "") + '">' + value + "</span></div>";
  const detailRows = /deliver/i.test(f.arrangement)
    ? [["barangay", "Barangay"], ["city", "City / Municipality"], ["province", "Province"], ["landmark", "Nearest Landmark"], ["instructions", "Delivery Instructions"]]
    : /pick-?up/i.test(f.arrangement)
      ? [["pickup_notes", "Pickup Notes"]]
      : f.hasPax ? [["barangay", "Barangay"], ["city", "City / Municipality"], ["province", "Province"], ["landmark", "Nearest Landmark"], ["setup_notes", "Setup Notes"]] : [];
  const arrangementFields = f.arrangementDetails ? detailRows
    .filter(([key]) => f.arrangementDetails[key]).map(([key, label]) => field(label, dash(f.arrangementDetails[key]))).join("") : "";
  return (
    '<button type="button" class="iq-back" data-iq-action="back"><i class="bi bi-arrow-left" aria-hidden="true"></i>' + (mine ? "Back to My Inquiries" : "Back to Available Inquiries") + "</button>" +
    '<div class="av-d-head">' +
      '<div class="av-d-head-main">' +
        '<div class="iq-detail-ref" role="heading" aria-level="2">' + dash(f.ref) + "</div>" +
        '<span class="stage-pill ' + stageClass + '">' + crmEscape(f.stage) + "</span>" +
        '<span class="av-d-pill' + (unassigned ? " is-warn" : "") + '">' + crmEscape(assignment) + "</span>" +
      "</div>" +
      (mine
        ? '<div class="av-d-claim"><button type="button" class="btn csi-outline-btn av-chat" data-av-action="chat"><i class="bi bi-chat" aria-hidden="true"></i>Open Chat</button></div>'
        : '<div class="av-d-claim"><button type="button" class="btn modal-btn-save av-claim" data-av-action="claim">Claim Inquiry</button><span class="av-claim-msg" id="avClaimMsg" role="status" hidden></span></div>') +
    "</div>" +
    '<section class="card iq-detail-card av-d-card">' +
      '<div class="av-d-card-head"><h3 class="iq-section-title">Event Details</h3><span class="av-d-tag">' + (mine ? "Assigned Inquiry Record" : "Available Inquiry Record") + '</span></div>' +
      '<div class="av-d-grid av-d-even">' +
        field("Event Name", dash(f.title)) +
        field("Event Date", dash(f.eventDate)) +
        (f.eventTime ? field(f.timeLabel, dash(f.eventTime)) : "") +
        field("Catering Arrangement", dash(f.arrangement)) +
        (f.hasPax ? field("Number of Guests (PAX)", dash(f.guestsNum ? f.guestsNum + " Guests" : ""), "is-green") : "") +
      "</div>" +
      '<div class="av-d-addr">' +
        '<div class="av-d-subhead">' + crmEscape(f.locationLabel) + "</div>" +
        '<div class="av-d-grid av-d-even av-d-addr-grid">' +
          field(/deliver/i.test(f.arrangement) ? "Street / Address" : /pick-?up/i.test(f.arrangement) ? "Pickup Location" : "Venue / Address", dash(pick(["event_location", "location", "venue", "venue_address"]))) + arrangementFields +
        "</div>" +
      "</div>" +
      '<div class="av-d-addr"><span class="av-d-label">Special Requests</span><div class="av-d-note">' + dash(pick(["special_requests", "customer_notes", "notes", "requirements"])) + "</div></div>" +
    "</section>" +
    '<section class="card iq-detail-card av-d-card">' +
      '<div class="av-d-card-head"><h3 class="iq-section-title">Customer Information</h3></div>' +
      '<div class="av-d-grid">' +
        field("Customer Name", dash(f.customer), "is-wide") +
        field("Email Address", dash(pick(["customer_email", "email", "email_address"]))) +
        field("Contact Number", dash(pick(["customer_phone", "contact_number", "phone", "phone_number"]))) +
      "</div>" +
    "</section>" +
    '<section class="card iq-detail-card av-d-card">' +
      '<div class="av-d-card-head"><h3 class="iq-section-title">Inquiry Information</h3></div>' +
      '<div class="av-d-grid">' +
        field("Inquiry ID", dash(f.ref), "is-green") +
        field("Date Submitted", crmEscape(crmAvDateTime(pick(["submitted_at", "created_at"])))) +
        field("Current Stage", crmEscape(f.stage), "is-green") +
        field("Assignment Status", crmEscape(assignment)) +
      "</div>" +
    "</section>" +
    '<section class="card iq-detail-card av-d-card">' +
      '<div class="av-d-card-head"><h3 class="iq-section-title">Selected Menu Items</h3></div>' +
      '<ul class="av-d-menu">' + menu + "</ul>" +
    "</section>"
  );
}
// Stages a sales staff can pick by hand in View Details (no numbering, same custom dropdown as the filters).
const CRM_INQUIRY_PICKABLE_STAGES = ["New Inquiry", "In Progress", "Declined"];

// Details screen of an assigned inquiry (Sales Staff > My Inquiries). Everything is read from the API record:
//   inquiry: customer_email, customer_phone, estimated_budget, special_requests, event_location,
//            submitted_at, assigned_staff, assigned_at
//   food_orders / menu_items: [ { category, name, quantity | pax, details } ]
//   quotation: { reference, version, status, amount, prepared_at, sent_at, prepared_by,
//                history: [ { version, status, recipient, prepared_by, amount } ] }   (flat quotation_* keys also work)
//   booking:   { reference, status }   (flat booking_ref / booking_status also work)
function crmAvMineDetailHTML(record) {
  const f = crmInquiryFields(record);
  const pick = (keys) => crmInquiryPick(record, keys);
  const dash = (v) => crmEscape(v || "—");
  const stageClass = CRM_STAGE_CLASS[f.stage.toLowerCase()] || "stage-new";
  const staff = f.staff && f.staff !== "Unassigned" ? f.staff : "";
  const guests = f.guestsNum ? f.guestsNum + " Guests" : "—";
  const field = (label, value, cls) => '<div><span class="av-d-label">' + label + '</span><span class="av-d-value' + (cls ? " " + cls : "") + '">' + value + "</span></div>";
  const detailRows = /deliver/i.test(f.arrangement)
    ? [["barangay", "Barangay"], ["city", "City / Municipality"], ["province", "Province"], ["landmark", "Nearest Landmark"], ["instructions", "Delivery Instructions"]]
    : /pick-?up/i.test(f.arrangement)
      ? [["pickup_notes", "Pickup Notes"]]
      : f.hasPax ? [["barangay", "Barangay"], ["city", "City / Municipality"], ["province", "Province"], ["landmark", "Nearest Landmark"], ["setup_notes", "Setup Notes"]] : [];
  const arrangementFields = f.arrangementDetails ? detailRows
    .filter(([key]) => f.arrangementDetails[key]).map(([key, label]) => field(label, dash(f.arrangementDetails[key]))).join("") : "";
  const card = (letter, title, headRight, body, extra) =>
    '<section class="card iq-detail-card av-d-card' + (extra ? " " + extra : "") + '">' +
      '<div class="av-d-card-head"><h3 class="iq-section-title">' + letter + ". " + title + "</h3>" + (headRight || "") + "</div>" + body +
    "</section>";

  // A. Inquiry Information (+ stage update dropdown)
  const stages = CRM_INQUIRY_PICKABLE_STAGES.slice();
  if (!stages.some((s) => s.toLowerCase() === f.stage.toLowerCase())) stages.push(f.stage);
  const stageItems = stages.map((s) =>
    '<li><a class="dropdown-item custom-dropdown-item py-2 px-3" href="#" data-value="' + crmEscape(s) + '"' + (s.toLowerCase() === f.stage.toLowerCase() ? ' aria-selected="true"' : "") + ">" + crmEscape(s) + "</a></li>").join("");
  const stageUpdate =
    '<div class="av-d-stage-update">' +
      '<span class="av-d-label">Update Inquiry Stage</span>' +
      '<div class="av-d-stage-row">' +
        '<div class="dropdown av-d-stage-dd" data-av-stage-dd data-value="' + crmEscape(f.stage) + '">' +
          '<button type="button" class="btn custom-dropdown-toggle d-flex justify-content-between align-items-center w-100" data-bs-toggle="dropdown" aria-expanded="false">' +
            "<span>" + crmEscape(f.stage) + '</span><i class="bi bi-chevron-down ms-2" aria-hidden="true"></i>' +
          "</button>" +
          '<ul class="dropdown-menu custom-dropdown-menu">' + stageItems + "</ul>" +
        "</div>" +
        '<button type="button" class="btn modal-btn-save av-d-stage-save" data-av-action="save-stage" disabled>Save Stage Update</button>' +
      "</div>" +
      '<span class="av-claim-msg" id="avStageMsg" role="status" hidden></span>' +
    "</div>";
  const secA = card("A", "Inquiry Information", '<span class="stage-pill ' + stageClass + '" data-av-stage-pill>' + crmEscape(f.stage) + "</span>",
    '<div class="av-d-grid av-d-grid-3">' +
      field("Inquiry ID", dash(f.ref), "is-green") +
      field("Date Submitted", crmEscape(crmInquiryDate(pick(["submitted_at", "created_at"])) || "—")) +
      field("Current Inquiry Stage", '<span data-av-stage-text>' + crmEscape(f.stage) + "</span>") +
    "</div>" + stageUpdate);

  // B. Customer Information
  const secB = card("B", "Customer Information", "",
    '<div class="av-d-grid av-d-grid-3">' +
      field("Customer Name", '<span class="av-cust">' + crmAvatarHTML(crmTicketInitials(f.customer), f.photo) + "<span>" + crmEscape(f.customer) + "</span></span>") +
      field("Email Address", dash(pick(["customer_email", "email", "email_address"]))) +
      field("Contact Number", dash(pick(["customer_phone", "contact_number", "phone", "phone_number"]))) +
    "</div>");

  // C. Event Information (ONE card: event facts on top, address below, special requests last)
  const addrTitle = f.locationLabel;
  const addrLabel = /deliver/i.test(f.arrangement) ? "Street / Address" : /pick-?up/i.test(f.arrangement) ? "Pickup Location" : "Venue / Address";
  const secC = card("C", "Event Information", "",
    '<div class="av-d-grid av-d-even">' +
      field("Event Name", dash(f.title)) +
      field("Event Date", dash(f.eventDate)) +
      (f.eventTime ? field(f.timeLabel, dash(f.eventTime)) : "") +
      field("Catering Arrangement", dash(f.arrangement)) +
      (f.hasPax ? field("Number of Guests (PAX)", crmEscape(guests), "is-green") : "") +
    "</div>" +
    '<div class="av-d-addr">' +
      '<div class="av-d-subhead">' + crmEscape(addrTitle) + "</div>" +
      '<div class="av-d-grid av-d-even av-d-addr-grid">' +
        field(addrLabel, dash(pick(["event_location", "location", "venue", "venue_address"]))) + arrangementFields +
      "</div>" +
    "</div>" +
    '<div class="av-d-addr"><span class="av-d-label">Special Requests</span><div class="av-d-note">' + dash(pick(["special_requests", "customer_notes", "notes", "requirements"])) + "</div></div>");

  // D. Food Orders
  const items = [record.food_orders, record.menu_items, record.items].find(Array.isArray) || [];
  const rows = items.map((it) => {
    const pax = crmInquiryPick(it, ["pax"]);
    const qty = crmInquiryPick(it, ["quantity", "serving", "qty"]) || (pax && f.hasPax ? (/pax/i.test(pax) ? pax : pax + " PAX") : "");
    return "<tr>" +
      '<td><span class="av-d-cat">' + dash(crmInquiryPick(it, ["category", "food_category", "type"])) + "</span></td>" +
      '<td class="av-d-item">' + dash(crmInquiryPick(it, ["name", "item_name", "menu_name", "title"])) + "</td>" +
      '<td class="av-d-qty">' + dash(qty) + "</td>" +
      '<td class="av-d-details">' + dash(crmInquiryPick(it, ["details", "order_details", "notes", "remarks"]) || [crmInquiryPick(it, ["tier"]), crmInquiryPick(it, ["price"])].filter(Boolean).join(" · ")) + "</td>" +
    "</tr>";
  }).join("");
  const secD = card("D", "Food Orders", '<span class="av-d-tag">' + items.length + " Item" + (items.length === 1 ? "" : "s") + " Requested</span>",
    items.length
      ? '<div class="av-d-table-wrap"><table class="av-d-table"><thead><tr><th>Food Category</th><th>Menu Item / Variety</th><th class="av-d-qty">Quantity / Serving</th><th>Order Details</th></tr></thead><tbody>' + rows + "</tbody></table></div>"
      : '<p class="av-d-menu-empty">No menu items were requested.</p>');

  // F. Quotation Information
  const q = record.quotation && typeof record.quotation === "object" ? record.quotation : {};
  const qp = (keys, flat) => crmInquiryPick(q, keys) || pick(flat);
  const qRef = qp(["reference", "ref", "quotation_ref"], ["quotation_ref", "quotation_reference"]);
  const qVersion = qp(["version"], ["quotation_version"]);
  const qStatus = qp(["status"], ["quotation_status"]);
  const qAmountRaw = qp(["amount", "total"], ["quotation_amount"]);
  const qHistory = Array.isArray(q.history) ? q.history : Array.isArray(record.quotation_history) ? record.quotation_history : [];
  const hasQuote = !!(qRef || qVersion || qStatus || qAmountRaw);
  const qStatusClass = /sent|accepted|approved/i.test(qStatus) ? "stage-won" : /declin|reject|expire/i.test(qStatus) ? "stage-loss" : "stage-proposal";
  const history = qHistory.map((h) =>
    '<div class="av-d-version"><div><strong>' + crmEscape(["v" + String(crmInquiryPick(h, ["version"])).replace(/^v/i, ""), crmInquiryPick(h, ["status"]), crmInquiryPick(h, ["recipient", "customer"])].filter((x) => x && x !== "v").join(" · ")) + "</strong>" +
    (crmInquiryPick(h, ["prepared_by"]) ? "<span>Prepared by " + crmEscape(crmInquiryPick(h, ["prepared_by"])) + "</span>" : "") + "</div>" +
    '<span class="av-d-version-amt">' + crmEscape(crmAvMoney(crmInquiryPick(h, ["amount", "total"]))) + "</span></div>").join("");
  // Once a quotation has been sent (or otherwise finalised) it can no longer be prepared or sent again:
  // only Preview + Prepare Revised Version remain. Drafts / withdrawn quotations keep the normal buttons.
  const quoteLocked = hasQuote && !/^(draft|withdrawn)$/i.test(String(qStatus || "").trim());
  const quoteBtns =
    '<div class="av-d-actions">' +
      (quoteLocked
        ? '<button type="button" class="btn csi-outline-btn av-d-btn" data-av-action="quotation-preview">Preview Quotation</button>' +
          '<button type="button" class="btn av-d-btn av-d-btn-warn" data-av-action="quotation-revise">Prepare Revised Version</button>'
        : '<button type="button" class="btn csi-outline-btn av-d-btn" data-av-action="quotation-prepare">Prepare Quotation</button>' +
          (hasQuote
            ? '<button type="button" class="btn csi-outline-btn av-d-btn" data-av-action="quotation-preview">Preview Quotation</button>' +
              '<button type="button" class="btn modal-btn-save av-d-btn" data-av-action="quotation-send">Send Quotation</button>' +
              '<button type="button" class="btn av-d-btn av-d-btn-warn" data-av-action="quotation-revise">Prepare Revised Version</button>'
            : "")) +
    "</div>";
  const secF = card("E", "Quotation Information",
    (qStatus ? '<span class="stage-pill ' + qStatusClass + ' av-d-head-pill">' + crmEscape(qStatus) + "</span>" : "") +
      (hasQuote ? '<span class="av-d-total">' + crmEscape(crmAvMoney(qAmountRaw)) + "</span>" : ""),
    (hasQuote
      ? '<div class="av-d-grid av-d-grid-3">' +
          field("Quotation Reference", dash(qRef)) +
          field("Quotation Version", dash(qVersion), "is-green") +
          field("Quotation Status", dash(qStatus)) +
          field("Date Prepared", crmEscape(crmAvDateTime(qp(["prepared_at", "date_prepared"], ["quotation_prepared_at"])))) +
          field("Date Sent", crmEscape(crmAvDateTime(qp(["sent_at", "date_sent"], ["quotation_sent_at"])))) +
          field("Quotation Amount", crmEscape(crmAvMoney(qAmountRaw)), "is-green") +
        "</div>" +
        (history ? '<div class="av-d-split"><div><span class="av-d-label">Quotation Version History</span><div class="av-d-versions">' + history + "</div></div></div>" : "")
      : '<p class="av-d-menu-empty">No quotation has been prepared yet.</p>') + quoteBtns);

  // G. Linked Booking (only when a booking exists)
  const b = record.booking && typeof record.booking === "object" ? record.booking : {};
  const bRef = crmInquiryPick(b, ["reference", "booking_ref", "ref"]) || pick(["booking_ref", "booking_reference", "linked_booking"]);
  const bStatus = crmInquiryPick(b, ["status", "booking_status"]) || pick(["booking_status"]);
  const secG = bRef
    ? card("F", "Linked Booking", '<span class="av-d-head-pill-ok stage-pill stage-won">Booking Created</span><span class="av-d-ref">' + crmEscape(bRef) + "</span>",
        '<div class="av-d-grid">' +
          field("Booking Reference", dash(bRef), "is-green") +
          field("Booking Status", dash(bStatus)) +
        "</div>" +
        '<div class="av-d-actions"><button type="button" class="btn modal-btn-save av-d-btn" data-av-action="view-booking" data-ref="' + crmEscape(bRef) + '">View Booking Details <i class="bi bi-arrow-right" aria-hidden="true"></i></button></div>',
        "av-d-booking")
    : "";

  return (
    '<button type="button" class="iq-back" data-iq-action="back"><i class="bi bi-arrow-left" aria-hidden="true"></i>Back to Inquiries</button>' +
    '<div class="av-d-head">' +
      '<div class="av-d-head-main">' +
        '<div class="iq-detail-ref" role="heading" aria-level="2">' + dash(f.ref) + "</div>" +
        '<span class="stage-pill ' + stageClass + '" data-av-stage-pill>' + crmEscape(f.stage) + "</span>" +
        '<span class="av-d-pill">Assigned</span>' +
      "</div>" +
      '<div class="av-d-claim"><button type="button" class="btn csi-outline-btn av-chat" data-av-action="chat"><i class="bi bi-chat" aria-hidden="true"></i>Open Chat</button></div>' +
    "</div>" +
    secA + secB + secC + secD + secF + secG
  );
}
function crmInitSalesAvailable(root) {
  const $ = (s) => root.querySelector(s);
  const listView = $("#avListView"), detailView = $("#avDetailView"), grid = $("#avGrid");
  const state = $("#avState"), noResults = $("#avNoResults"), count = $("#avCount");
  const input = $("#avSearchInput"), dateInput = $("#avDate");
  if (!grid || !listView || !detailView) return;
  // data-mode="mine" = Sales Staff > My Inquiries (the inquiries already assigned to me):
  // same cards and filters as Available Inquiries, plus a Stage filter and an Open Chat button.
  const mine = root.dataset.mode === "mine";
  const filters = { arrangement: "all", stage: "all", sort: "newest" };
  let records = [];
  let openIndex = -1;
  const toTop = () => { const b = document.querySelector(".content-body"); if (b) b.scrollTop = 0; };

  function applyFilters() {
    const term = input ? input.value.trim().toLowerCase() : "";
    const day = dateInput ? dateInput.value : "";
    const cards = Array.from(grid.querySelectorAll(".av-card"));
    let visible = 0;
    cards.forEach((card) => {
      const match =
        (term === "" || card.textContent.toLowerCase().includes(term)) &&
        (filters.arrangement === "all" || card.dataset.arr === filters.arrangement) &&
        (filters.stage === "all" || card.dataset.stage === filters.stage) &&
        (!day || card.dataset.date === day);
      card.style.display = match ? "" : "none";
      if (match) visible++;
    });
    // Sort (just reorders the cards)
    const by = { newest: (a, b) => b.dataset.ts - a.dataset.ts, oldest: (a, b) => a.dataset.ts - b.dataset.ts, event: (a, b) => (a.dataset.date || "9").localeCompare(b.dataset.date || "9") };
    if (!mine) cards.sort(by[filters.sort] || by.newest).forEach((c) => grid.appendChild(c)); // My Inquiries keeps the backend order
    if (count) count.textContent = visible + (mine ? " Assigned" : " Available");
    if (noResults) noResults.hidden = !(cards.length > 0 && visible === 0);
    if (state && cards.length === 0 && !state.dataset.error) { state.hidden = false; state.textContent = mine ? "No assigned inquiries yet." : "No available inquiries right now."; }
    else if (state && cards.length > 0) state.hidden = true;
  }
  function render(list) {
    records = Array.isArray(list) ? (mine ? crmInquirySort(list) : list.slice()) : [];
    grid.innerHTML = records.map((r, i) => crmAvCardHTML(r, i, mine)).join("");
    applyFilters();
  }
  window.crmRenderAvailableInquiries = render;

  function showList() { detailView.hidden = true; detailView.innerHTML = ""; listView.hidden = false; toTop(); }
  function showDetail(index) {
    const record = records[index];
    if (!record) return;
    openIndex = index;
    detailView.innerHTML = crmAvDetailHTML(record, mine);
    listView.hidden = true;
    detailView.hidden = false;
    toTop();
  }

  const stageMenu = $("#avStageMenu");
  if (stageMenu)
    stageMenu.innerHTML = [["all", "All Stages"]].concat(CRM_SALES_FILTER_STAGES.map((n) => [n.toLowerCase(), n]))
      .map(([value, text]) => '<li><a class="dropdown-item custom-dropdown-item py-2 px-3" href="#" data-value="' + crmEscape(value) + '">' + crmEscape(text) + "</a></li>").join("");

  if (input) input.oninput = applyFilters;
  if (dateInput) dateInput.onchange = applyFilters;

  // Open Chat: go to the Inbox and open this inquiry's conversation.
  function openChat(ref) {
    window.crmPendingChatRef = String(ref || "");
    document.dispatchEvent(new CustomEvent("crm:open-chat", { detail: { ref } }));
    const links = Array.from(document.querySelectorAll(".sidebar-nav a[onclick*=\"'inbox'\"]"));
    const link = links.find((a) => a.offsetParent !== null) || links[0] || null;
    if (typeof window.loadPage === "function") window.loadPage("inbox", link);
  }

  root.onclick = (event) => {
    // Service Arrangement + Sort dropdowns (same custom dropdown as the other pages)
    const item = event.target.closest(".av-page .custom-dropdown-item");
    if (item && item.closest("[data-av-filter]")) {
      event.preventDefault();
      event.stopPropagation();
      const dd = item.closest("[data-av-filter]");
      const label = dd.querySelector(".custom-dropdown-toggle span");
      if (label && !label.dataset.defaultLabel) label.dataset.defaultLabel = label.textContent.trim();
      const value = item.dataset.value;
      filters[dd.dataset.avFilter] = value;
      label.textContent = value === "all" ? label.dataset.defaultLabel : item.textContent.trim();
      dd.querySelectorAll(".custom-dropdown-item").forEach((a) => a.removeAttribute("aria-selected"));
      if (value !== "all") item.setAttribute("aria-selected", "true");
      const toggle = dd.querySelector('[data-bs-toggle="dropdown"]');
      if (toggle && window.bootstrap) bootstrap.Dropdown.getOrCreateInstance(toggle).hide();
      applyFilters();
      return;
    }
    if (event.target.closest("#avClear")) {
      if (input) input.value = "";
      if (dateInput) dateInput.value = "";
      filters.arrangement = "all";
      filters.stage = "all";
      filters.sort = "newest";
      root.querySelectorAll("[data-av-filter] .custom-dropdown-toggle span").forEach((s) => { if (s.dataset.defaultLabel) s.textContent = s.dataset.defaultLabel; });
      const sortLabel = root.querySelector('[data-av-filter="sort"] .custom-dropdown-toggle span');
      if (sortLabel) sortLabel.textContent = "Newest First";
      root.querySelectorAll("[data-av-filter] .custom-dropdown-item").forEach((a) => a.removeAttribute("aria-selected"));
      const first = root.querySelector('[data-av-filter="sort"] .custom-dropdown-item');
      if (first) first.setAttribute("aria-selected", "true");
      applyFilters();
      return;
    }
    const chat = event.target.closest('[data-av-action="chat"]');
    if (chat) {
      const card = chat.closest(".av-card");
      const record = card ? records[Number(card.dataset.index)] : records[openIndex];
      if (record) openChat(crmInquiryFields(record).ref);
      return;
    }
    const view = event.target.closest('[data-av-action="view"]');
    if (view) {
      const card = view.closest(".av-card");
      document.dispatchEvent(new CustomEvent("crm:view-inquiry", { detail: { ref: card.dataset.ref, card } }));
      showDetail(Number(card.dataset.index));
      return;
    }
    // View Details > Update Inquiry Stage dropdown (same custom dropdown as the filters)
    const stageItem = event.target.closest("[data-av-stage-dd] .custom-dropdown-item");
    if (stageItem) {
      event.preventDefault();
      event.stopPropagation();
      const dd = stageItem.closest("[data-av-stage-dd]");
      dd.dataset.value = stageItem.dataset.value;
      dd.querySelector(".custom-dropdown-toggle span").textContent = stageItem.textContent.trim();
      dd.querySelectorAll(".custom-dropdown-item").forEach((a) => a.removeAttribute("aria-selected"));
      stageItem.setAttribute("aria-selected", "true");
      const toggle = dd.querySelector('[data-bs-toggle="dropdown"]');
      if (toggle && window.bootstrap) bootstrap.Dropdown.getOrCreateInstance(toggle).hide();
      const current = records[openIndex] ? crmInquiryFields(records[openIndex]).stage : "";
      const saveBtn = $('[data-av-action="save-stage"]');
      if (saveBtn) saveBtn.disabled = dd.dataset.value.toLowerCase() === current.toLowerCase();
      return;
    }
    const saveStage = event.target.closest('[data-av-action="save-stage"]');
    if (saveStage) {
      const record = records[openIndex];
      const dd = $("[data-av-stage-dd]");
      if (!record || !dd) return;
      const ref = crmInquiryFields(record).ref;
      const stage = dd.dataset.value;
      const msg = $("#avStageMsg");
      const url = (root.dataset.stageApi || root.dataset.api || "").replace(/action=[^&]*/, "action=update_stage");
      const run = (reason) => {
        const form = new FormData();
        form.append("inquiry_ref", ref);
        form.append("stage", stage);
        if (reason) form.append("reason", reason);
        saveStage.disabled = true;
        if (msg) msg.hidden = true;
        fetch(url, { method: "POST", credentials: "same-origin", headers: { Accept: "application/json" }, body: form })
          .then((response) => response.json().then((data) => ({ response, data })))
          .then(({ response, data }) => {
            if (!response.ok || !data || data.success === false) throw new Error((data && data.message) || "Unable to update the stage.");
            const key = ["stage", "status", "inquiry_status"].find((k) => record[k] !== undefined) || "stage";
            record[key] = stage;
            if (data.quotation !== undefined) {   // declining withdraws open quotations: keep the Quotation block in step
              record.quotation = data.quotation;
              if (data.quotation) { record.quotation_status = data.quotation.status; record.quotation_amount = data.quotation.total; }
            }
            detailView.innerHTML = crmAvDetailHTML(record, mine);
            render(records);
            document.dispatchEvent(new CustomEvent("crm:update-inquiry-stage", { detail: { ref, stage } }));
            const doneMsg = $("#avStageMsg");
            if (doneMsg) { doneMsg.textContent = data.message || "Stage updated."; doneMsg.hidden = false; }
          })
          .catch((error) => {
            saveStage.disabled = false;
            if (msg) { msg.textContent = error.message || "Unable to update the stage."; msg.hidden = false; }
          });
      };
      if (stage.toLowerCase() === "declined" && typeof window.crmAskReason === "function") {
        window.crmAskReason({
          title: "Decline this inquiry?",
          message: "The customer will see this reason in their chat and on their inquiry. Any open quotation will be withdrawn.",
          placeholder: "e.g. We are fully booked on that date.",
          confirmText: "Decline inquiry",
        }).then((reason) => { if (reason !== null) run(reason); });
      } else {
        run("");
      }
      return;
    }
    // Quotation buttons + Linked Booking: the backend / quotation screens listen to these events.
    const qAction = event.target.closest('[data-av-action^="quotation-"]');
    if (qAction) {
      const record = records[openIndex];
      // refresh() redraws this details screen (and the list cards) after the quotation changes
      const refresh = () => { detailView.innerHTML = crmAvDetailHTML(record, mine); render(records); };
      if (record) document.dispatchEvent(new CustomEvent("crm:" + qAction.dataset.avAction, { detail: { ref: crmInquiryFields(record).ref, record, refresh } }));
      return;
    }
    const viewBooking = event.target.closest('[data-av-action="view-booking"]');
    if (viewBooking) {
      window.crmPendingBookingRef = viewBooking.dataset.ref || "";
      document.dispatchEvent(new CustomEvent("crm:view-booking", { detail: { ref: viewBooking.dataset.ref } }));
      return;
    }
    if (event.target.closest('[data-iq-action="back"]')) return showList();
    const claim = event.target.closest('[data-av-action="claim"]');
    if (claim) {
      const record = records[openIndex];
      if (!record) return;
      const ref = crmInquiryFields(record).ref;
      const msg = $("#avClaimMsg");
      const form = new FormData();
      form.append("inquiry_ref", ref);
      const url = (root.dataset.claimApi || root.dataset.api || "").replace(/action=[^&]*/, "action=claim");
      claim.disabled = true;
      fetch(url, { method: "POST", credentials: "same-origin", headers: { Accept: "application/json" }, body: form })
        .then((response) => response.json().then((data) => ({ response, data })))
        .then(({ response, data }) => {
          if (!response.ok || !data || data.success === false) throw new Error((data && data.message) || "Unable to claim this inquiry.");
          records.splice(openIndex, 1);
          openIndex = -1;
          showList();
          render(records);
          if (state) {
            state.textContent = data.message || "Inquiry claimed successfully. It is now in My Inquiries.";
            state.classList.add("is-success");
            state.hidden = false;
          }
          document.dispatchEvent(new CustomEvent("crm:claim-inquiry", { detail: { ref } }));
        })
        .catch((error) => {
          claim.disabled = false;
          if (msg) { msg.textContent = error.message || "Unable to claim this inquiry."; msg.hidden = false; }
        });
    }
  };

  // Load the list automatically.
  const url = root.dataset.api;
  if (!url) { render([]); return; }
  if (state) { state.hidden = false; state.textContent = "Loading inquiries..."; }
  fetch(url, { method: "GET", credentials: "same-origin", headers: { Accept: "application/json" }, cache: "no-store" })
    .then((response) => response.json().then((data) => ({ response, data })))
    .then(({ response, data }) => {
      if (document.getElementById("salesAvailablePage") !== root) return;
      if (!response.ok || !data || !Array.isArray(data.inquiries)) throw new Error((data && data.message) || "Unable to load inquiries.");
      render(data.inquiries);
    })
    .catch((error) => {
      console.warn("Available inquiries could not be loaded:", error);
      if (document.getElementById("salesAvailablePage") !== root) return;
      if (state) { state.dataset.error = "1"; }
      render([]);
      if (state) { state.hidden = false; state.textContent = "Unable to load inquiries."; }
    });
}

// Admin + Manager Bookings page (manager-admin-bookings.html).
// Same process as Inquiries: the cards are built here from the backend list.
// Backend contract: GET bookings-api.php?action=list ->
//   { success: true, bookings: [ { booking_ref, customer_name, event_title, event_date,
//     event_time, location, arrangement, expected_guests, quotation_amount, amount_paid,
//     remaining_balance, payment_status, assigned_staff, booking_status } ] }
// You can also call window.crmRenderBookings(list) yourself.
// View -> opens the detail view inside this page (also fires "crm:view-booking").
const CRM_BOOKING_STATUSES = ["Confirmed", "In Progress", "Completed", "Cancelled"];
const CRM_BOOKING_PAYMENTS = ["Unpaid", "Partially Paid", "Paid"];

function crmBookingMoney(value) {
  if (value === undefined || value === null || String(value).trim() === "") return "—";
  const n = Number(String(value).replace(/[₱,\s]/g, ""));
  if (isNaN(n)) return String(value);
  return "₱" + n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function crmBookingNumber(value) {
  const n = Number(String(value === undefined || value === null ? "" : value).replace(/[₱,\s]/g, ""));
  return String(value === undefined || value === null ? "" : value).trim() === "" || isNaN(n) ? null : n;
}

function crmBookingStatusClass(status) {
  const s = String(status || "").toLowerCase();
  if (s === "confirmed" || s === "completed") return "stage-won";
  if (s === "in progress" || s === "ongoing") return "stage-qualified";
  if (s === "pending") return "stage-proposal";
  if (s === "cancelled" || s === "canceled") return "stage-loss";
  return "stage-new";
}

function crmBookingPaymentClass(payment) {
  const p = String(payment || "").toLowerCase();
  if (p === "paid") return "ticket-resolved";
  if (p === "partially paid" || p === "partial") return "ticket-pending";
  return "ticket-high";
}

function crmBookingFields(record) {
  const pick = (keys) => crmInquiryPick(record, keys);
  const guestsRaw = pick(["expected_guests", "guests", "pax"]);
  const totalRaw = pick(["quotation_amount", "total_quote", "total_amount", "quotation"]);
  const paidRaw = pick(["amount_paid", "paid_amount", "deposit_paid"]);
  let balanceRaw = pick(["remaining_balance", "balance"]);
  const total = crmBookingNumber(totalRaw);
  const paid = crmBookingNumber(paidRaw);
  if (balanceRaw === "" && total !== null && paid !== null) balanceRaw = String(total - paid);
  let payment = pick(["payment_status", "payment"]);
  if (!payment) {
    if (total !== null && paid !== null && total > 0 && paid >= total) payment = "Paid";
    else if (paid !== null && paid > 0) payment = "Partially Paid";
    else payment = "Unpaid";
  }
  const dateRaw = pick(["event_date", "date"]);
  const time = pick(["event_time", "time"]);
  const eventDate = crmInquiryDate(dateRaw);
  const eventTime = crmTimeText(time);
  return {
    customer: pick(["customer_name", "customer", "client_name"]) || "Customer",
    photo: pick(["customer_photo", "photo_url"]),
    staffPhoto: pick(["staff_photo", "assigned_staff_photo"]),
    balanceNum: crmBookingNumber(balanceRaw),
    ref: pick(["booking_ref", "booking_code", "reference", "booking_id", "id"]),
    title: pick(["event_title", "event_name", "title"]) || "—",
    status: pick(["booking_status", "status"]) || "Confirmed",
    staff: pick(["assigned_staff", "assigned_to", "staff_name"]) || "Unassigned",
    location: pick(["location", "venue", "venue_address", "address"]) || "—",
    arrangement: pick(["arrangement", "service_type", "service"]) || "—",
    hasPax: crmArrangementHasPax(pick(["arrangement", "service_type", "service"])),
    guestsNum: crmArrangementHasPax(pick(["arrangement", "service_type", "service"])) ? guestsRaw.replace(/\s*(pax|guests?)$/i, "") : "",
    dateIso: /^\d{4}-\d{2}-\d{2}/.test(dateRaw) ? dateRaw.slice(0, 10) : "",
    eventDate: eventDate,
    eventTime: eventTime,
    timeLabel: crmTimeLabel(pick(["arrangement", "service_type", "service"])),
    eventDateTime: eventTime && eventDate !== "—" ? eventDate + " \u2022 " + eventTime : eventDate,
    total: crmBookingMoney(totalRaw),
    paid: crmBookingMoney(paidRaw),
    balance: crmBookingMoney(balanceRaw),
    payment: payment,
  };
}

/* Small rating row for the Bookings cards (Admin / Manager / Sales Staff): stars + score once the event is Completed,
   so the rating is visible without opening View. Uses record.feedback (see booking-feedback.php). */
function crmBookingCardRatingHTML(record, status) {
  if (!/complete/i.test(String(status || ""))) return "";
  const fb = record && record.feedback;
  const rating = Math.max(0, Math.min(5, Math.round(Number(fb && fb.rating) || 0)));
  if (!rating) {
    return '<div class="iq-event"><span class="stat-label">Customer Rating</span><span class="iq-fact-value" style="opacity:.6;font-weight:500">No rating yet</span></div>';
  }
  const stars = [1, 2, 3, 4, 5].map((n) => '<i class="bi ' + (n <= rating ? "bi-star-fill" : "bi-star") + '" aria-hidden="true"></i>').join("");
  return '<div class="iq-event"><span class="stat-label">Customer Rating</span>' +
    '<span class="iq-fact-value"><span class="fb-stars" style="color:#f5b301;letter-spacing:2px" role="img" aria-label="' + rating + ' out of 5">' + stars + "</span> " + rating + "/5</span></div>";
}

function crmBookingCardHTML(record, index) {
  const f = crmBookingFields(record);
  const initials =
    f.customer.split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0]).join("") || "?";
  const service = f.arrangement + (f.guestsNum ? " (" + f.guestsNum + " PAX)" : "");
  const refAttr = crmEscape(f.ref);

  return (
    '<article class="card iq-card" data-index="' + index + '" data-ref="' + refAttr + '"' +
    ' data-status="' + crmEscape(f.status.toLowerCase()) + '"' +
    ' data-payment="' + crmEscape(f.payment.toLowerCase()) + '"' +
    ' data-staff="' + crmEscape(f.staff.toLowerCase()) + '"' +
    ' data-date="' + crmEscape(f.dateIso) + '">' +
      '<div class="iq-card-head">' +
        crmAvatarHTML(initials, f.photo) +
        '<div class="iq-head-main">' +
          '<h4 class="iq-customer">' + crmEscape(f.customer) + "</h4>" +
          '<span class="iq-ref">' + refAttr + "</span>" +
        "</div>" +
        '<span class="stage-pill ' + crmBookingStatusClass(f.status) + '">' + crmEscape(f.status) + "</span>" +
      "</div>" +
      '<ul class="iq-lines">' +
        '<li><i class="bi bi-calendar4" aria-hidden="true"></i>Event Date: ' + crmEscape(f.eventDate + (f.eventTime ? " \u2022 " + f.eventTime : "")) + "</li>" +
        '<li><i class="bi bi-geo-alt-fill" aria-hidden="true"></i>' + crmEscape(f.location) + "</li>" +
        '<li><i class="bi bi-truck" aria-hidden="true"></i>' + crmEscape(service) + "</li>" +
      "</ul>" +
      '<div class="iq-facts">' +
        '<div><span class="stat-label">Quotation</span><span class="iq-fact-value is-green">' + crmEscape(f.total) + "</span></div>" +
        '<div><span class="stat-label">Payment</span><span class="iq-fact-pill"><span class="ticket-badge ' + crmBookingPaymentClass(f.payment) + '">' + crmEscape(f.payment) + "</span></span></div>" +
      "</div>" +
      '<div class="iq-event"><span class="stat-label">Event Title</span><span class="iq-fact-value">' + crmEscape(f.title) + "</span></div>" +
      crmBookingCardRatingHTML(record, f.status) +
      '<div class="iq-actions bk-actions">' +
        '<div class="bk-staff"><span class="stat-label">Staff</span><span class="iq-fact-value">' + crmEscape(f.staff) + "</span></div>" +
        '<button type="button" class="btn modal-btn-save iq-view" data-bk-action="view"><i class="bi bi-arrow-right" aria-hidden="true"></i>View</button>' +
      "</div>" +
    "</article>"
  );
}

/* Sales Staff > Bookings > View: "Request Full Payment" (asks the customer to pay the whole remaining balance; the API posts the Pay Now card in the customer's inbox) */
function crmBookingPaymentRequestHTML(record, f) {
  // Uses the same card / label / value / button classes as the rest of the booking detail screen (no extra CSS).
  const pr = record.payment_request || null;
  const card = (body) => '<section class="card iq-detail-card bk-payreq"><h3 class="iq-section-title">Payment Request</h3>' + body + "</section>";
  const field = (label, value) => '<div class="iq-contact-field"><span class="iq-label is-caps">' + label + "</span>" + value + "</div>";
  if (pr && pr.status === "Pending") {
    return card(
      field("Status", '<span class="ticket-badge ticket-pending">' + (pr.is_overdue ? "Overdue" : "Awaiting payment") + "</span>") +
      field("Amount Requested", '<span class="iq-value is-green">' + crmEscape(crmBookingMoney(pr.amount)) + "</span>") +
      field("Pay By", '<span class="iq-value">' + (crmEscape(pr.due_label) || "—") + "</span>") +
      (pr.note ? field("Note", '<span class="iq-value">' + crmEscape(pr.note) + "</span>") : "") +
      '<p class="iq-state" id="bkPayState" hidden></p>' +
      '<div class="iq-actions"><button type="button" class="btn csi-outline-btn" data-bk-action="payreq-cancel" data-request-id="' + crmEscape(pr.payment_request_id) + '">Cancel Request</button></div>'
    );
  }
  if (!record.can_request_payment) {
    return pr && pr.status === "Paid"
      ? card(field("Status", '<span class="ticket-badge ticket-resolved">Paid</span>'))
      : "";
  }
  const today = new Date();
  const minDate = today.getFullYear() + "-" + String(today.getMonth() + 1).padStart(2, "0") + "-" + String(today.getDate()).padStart(2, "0");
  const eventDay = /^\d{4}-\d{2}-\d{2}/.test(String(record.event_date || "")) ? String(record.event_date).slice(0, 10) : "";
  // Full payment is due at least 1 day before the event: the picker stops the day before (or today when the event is that close).
  let lastDay = "";
  if (eventDay) {
    const dd = new Date(eventDay + "T00:00:00");
    dd.setDate(dd.getDate() - 1);
    const before = dd.getFullYear() + "-" + String(dd.getMonth() + 1).padStart(2, "0") + "-" + String(dd.getDate()).padStart(2, "0");
    lastDay = before < minDate ? minDate : before;
  }
  const max = lastDay ? ' max="' + crmEscape(lastDay) + '"' : "";
  const mark = eventDay ? ' data-mark-date="' + crmEscape(eventDay) + '" data-mark-label="Event date"' : "";
  let defDue = String(record.default_due_date || "");
  if (!defDue || defDue < minDate || (lastDay && defDue > lastDay)) defDue = lastDay || minDate;
  const payRush = crmIsRushEvent(eventDay);
  const payShowTime = payRush;   // the time is only asked for a rush event; otherwise the deadline is 11:59 PM of the chosen date (also when it is today)
  return card(
    field("Amount To Request", '<span class="iq-value is-green">' + crmEscape(f.balance) + '</span><span class="iq-label mt-1">Full remaining balance</span>') +
    '<div class="iq-contact-field"><label class="iq-label is-caps" for="bkPayDue">Pay By</label><input type="date" id="bkPayDue" class="modal-input-field" min="' + minDate + '"' + max + mark + ' value="' + crmEscape(defDue) + '">' +
    (lastDay ? '<span class="iq-label mt-1">Latest date: ' + crmEscape(crmDeadlineLabel(lastDay, "")) + ' (full payment is due at least 1 day before the event).</span>' : "") +
    '<span class="iq-label mt-1" id="bkPayEndNote"' + (payShowTime ? ' style="display:none"' : "") + '>No time needed: the deadline is 11:59 PM of that day.</span></div>' +
    // Pay-by time: same rules as the quotation "Valid until time" (8:00 AM - 11:00 PM, on the hour / half hour, today = at least 1 hour from now)
    '<div class="iq-contact-field" id="bkPayTimeWrap" data-rush="' + (payRush ? "1" : "0") + '"' + (payShowTime ? "" : ' style="display:none"') + '><label class="iq-label is-caps" for="bkPayTime">Pay By Time</label><input type="time" id="bkPayTime" class="modal-input-field" data-time-label="Pay by time" min="' + crmQuoteMinTime(defDue) + '" max="' + CRM_QUOTE_TIME_MAX + '" step="1800" value="' + (payShowTime && defDue === minDate ? crmQuoteMinTime(defDue) : "") + '">' +
    '<span class="iq-label mt-1">The customer must pay before this date and time (8:00 AM to 11:00 PM). Required when the date is today (at least 1 hour from now, on the hour or half hour). For a later date, leave it empty and the deadline is 11:59 PM of that day.</span></div>' +
    '<div class="iq-contact-field"><label class="iq-label is-caps" for="bkPayNote">Note To Customer (Optional)</label><textarea id="bkPayNote" class="modal-input-field" rows="3" maxlength="300" placeholder="e.g. Please pay before the final headcount."></textarea></div>' +
    '<p class="iq-state" id="bkPayState" hidden></p>' +
    '<div class="iq-actions"><button type="button" class="btn modal-btn-save" data-bk-action="payreq-send"><i class="bi bi-cash-coin me-2" aria-hidden="true"></i>Request Full Payment</button></div>'
  );
}

/* Bookings > View: "Booking Progress" (food + service). The steps change with the service arrangement; only the assigned Sales Staff gets the button. */
function crmBookingProgressHTML(record) {
  const p = record.progress;
  if (!p || !Array.isArray(p.steps) || !p.steps.length) return "";
  const cur = Number(p.current);
  const items = p.steps.map((label, i) => {
    const cls = i < cur ? "is-done" : i === cur ? "is-current" : "is-todo";
    return '<li class="bk-prog-step ' + cls + '"' + (i === cur ? ' aria-current="step"' : "") + '><span class="bk-prog-dot">' + (i < cur ? "&#10003;" : i + 1) + '</span><span class="bk-prog-label">' + crmEscape(label) + "</span></li>";
  }).join("");
  let action = "";
  if (cur < 0) {
    action = '<p class="iq-state">This booking is cancelled.</p>';
  } else if (record.can_update_progress && p.next) {
    action = '<p class="iq-state" id="bkProgState" hidden></p><div class="iq-actions"><button type="button" class="btn modal-btn-save" data-bk-action="progress-next" data-status="' + crmEscape(p.next.key) + '"><i class="bi bi-check2-circle me-2" aria-hidden="true"></i>' + crmEscape(p.next.button) + "</button></div>";
  } else if (p.next && p.blocked) {
    action = '<p class="iq-state" id="bkProgState">' + crmEscape(p.blocked) + "</p>";
  }
  return '<section class="card iq-detail-card bk-progress"><h3 class="iq-section-title">Booking Progress</h3><ol class="bk-prog-list">' + items + "</ol>" + action + "</section>";
}

function crmBookingDetailHTML(record, showStaff) {
  const f = crmBookingFields(record);
  const { dash, head, field, value, tile, person } = crmDetailKit();
  const phone = crmInquiryPick(record, ["customer_phone", "customer_contact", "customer_contact_number", "customer_mobile", "contact_number", "contact_no", "contact", "mobile", "phone", "phone_number"]);
  const email = crmInquiryPick(record, ["customer_email", "customer_email_address", "customer_gmail", "email", "email_address", "gmail"]);
  const guests = f.guestsNum ? f.guestsNum + " Guests" : "";
  const assigned = crmAvDateTime(crmInquiryPick(record, ["assigned_at", "assignment_date", "claimed_at", "assigned_date"]));
  return (
    '<button type="button" class="iq-back" data-bk-action="back"><i class="bi bi-arrow-left" aria-hidden="true"></i>Back to Bookings List</button>' +
    '<div class="iq-detail-head">' +
      '<div class="iq-detail-ref" role="heading" aria-level="2">' + crmEscape(f.ref || "Booking") + "</div>" +
      '<span class="stage-pill ' + crmBookingStatusClass(f.status) + '">' + crmEscape(f.status) + "</span>" +
      (showStaff ? "" : '<span class="iq-chip">' + crmEscape(f.staff) + "</span>") +
    "</div>" +
    '<div class="iq-detail-col">' +
      '<section class="card iq-detail-card">' + head("Event Details") +
        '<div class="tk-contact-grid">' +
          field("Event Name", value(f.title)) +
          field("Schedule", value(f.eventDateTime)) +
          (f.hasPax ? field("Expected Guests", '<span class="iq-value is-green">' + dash(guests) + "</span>") : "") +
          field("Service Arrangement", value(f.arrangement)) +
          (showStaff ? field("Assigned Staff", '<span class="iq-value">' + person(f.staff, f.staffPhoto, "Unassigned") + "</span>") : "") +
          (showStaff && assigned !== "—" ? field("Assignment Date", value(assigned)) : "") +
          field("Venue Address", value(f.location), f.hasPax ? "tk-span-all" : "") +
        "</div>" +
      "</section>" +
      '<section class="card iq-detail-card">' + head("Customer Information") +
        '<div class="tk-contact-grid">' +
          field("Full Name", '<span class="iq-value">' + person(f.customer, f.photo) + "</span>") +
          field("Contact Number", value(phone)) +
          field("Email Address", value(email)) +
        "</div>" +
      "</section>" +
      '<section class="card iq-detail-card">' + head("Financial Overview") +
        '<div class="iq-spec-grid tk-cols-4">' +
          tile("Total Quote", crmEscape(f.total), "is-activity") +
          tile("Amount Paid", crmEscape(f.paid)) +
          tile("Remaining Balance", crmEscape(f.balance), (f.balanceNum || 0) > 0 ? "is-due" : "is-activity") +
          tile("Payment Status", '<span class="ticket-badge ' + crmBookingPaymentClass(f.payment) + '">' + crmEscape(f.payment) + "</span>") +
        "</div>" +
      "</section>" +
      crmBookingPaymentRequestHTML(record, f) +
      crmBookingProgressHTML(record) +
      crmBookingFeedbackHTML(record.feedback) +
    "</div>"
  );
}


function crmInitManagerBookings(root) {
  const listView = root.querySelector("#bkListView");
  const detailView = root.querySelector("#bkDetailView");
  const grid = root.querySelector("#bkGrid");
  const state = root.querySelector("#bkState");
  const noResults = root.querySelector("#bkNoResults");
  const input = root.querySelector("#bkSearchInput");
  const dateInput = root.querySelector("#bkDate");
  const dateFrom = root.querySelector("#bkDateFrom");   // optional date range (Sales Staff Bookings)
  const dateTo = root.querySelector("#bkDateTo");
  if (!grid || !listView || !detailView) return;
  // Sales Staff Bookings hides the "Assigned Sales Staff" card: put data-hide-staff="true" on #managerBookingsPage
  // (also detected automatically from a "sales" api url or the From/To date range).
  const hideStaffCard = root.hasAttribute("data-hide-staff") || /sales/i.test(root.dataset.api || "") || !!dateFrom;

  const filters = { status: "all", payment: "all", staff: "all" };
  let records = [];

  function applyFilters() {
    const term = input ? input.value.trim().toLowerCase() : "";
    const day = dateInput ? dateInput.value : "";   // one date: show bookings on that event date
    const from = dateFrom ? dateFrom.value : "";    // range: event date between From and To
    const to = dateTo ? dateTo.value : "";
    const cards = Array.from(grid.querySelectorAll(".iq-card"));
    let visible = 0;
    cards.forEach((card) => {
      const date = card.dataset.date || "";
      const match =
        (term === "" || card.textContent.toLowerCase().includes(term)) &&
        (filters.status === "all" || card.dataset.status === filters.status) &&
        (filters.payment === "all" || card.dataset.payment === filters.payment) &&
        (filters.staff === "all" || card.dataset.staff === filters.staff) &&
        (!day || date === day) &&
        (!from || (date && date >= from)) &&
        (!to || (date && date <= to));
      card.style.display = match ? "" : "none";
      if (match) visible++;
    });
    if (noResults) noResults.hidden = !(cards.length > 0 && visible === 0);
    if (state) {
      state.hidden = cards.length > 0;
      if (cards.length === 0) state.textContent = "No bookings yet.";
    }
  }

  window.populateDropdown("bkStatusMenu", CRM_BOOKING_STATUSES, "All Status");
  window.populateDropdown("bkPaymentMenu", CRM_BOOKING_PAYMENTS, "All Payments");

  /* ---------- Feedback tab: "All Bookings | Feedback" (Admin / Manager / Sales Staff) ----------
     Built here, so the two Bookings HTML pages need no change. Lists the Completed bookings the customer rated
     (record.feedback from the API): average, filter by stars, comments and photos. */
  if (!document.getElementById("bkFbStyle")) {
    const fbStyle = document.createElement("style");
    fbStyle.id = "bkFbStyle";
    fbStyle.textContent =
      ".bk-tabs{display:flex;gap:6px;margin:0 0 18px;border-bottom:1px solid rgba(128,128,128,.35)}" +
      ".bk-tab{background:none;border:0;border-bottom:3px solid transparent;color:inherit;opacity:.65;padding:10px 18px;font-weight:600;cursor:pointer;margin-bottom:-1px}" +
      ".bk-tab:hover{opacity:.9}.bk-tab.is-active{opacity:1;border-bottom-color:#2bb673}" +
      ".bk-tab-count{display:inline-block;min-width:22px;padding:1px 7px;margin-left:6px;border-radius:999px;background:rgba(43,182,115,.2);font-size:.78em;text-align:center}" +
      "#bkListView.bk-fb-mode .bk-search-row,#bkListView.bk-fb-mode .bk-filters,#bkListView.bk-fb-mode .iq-pool-head," +
      "#bkListView.bk-fb-mode #bkGrid,#bkListView.bk-fb-mode #bkState,#bkListView.bk-fb-mode #bkNoResults{display:none!important}" +
      ".bk-fb-summary{display:grid;grid-template-columns:minmax(170px,230px) 1fr;gap:20px 36px;align-items:center;padding:22px 28px;margin-bottom:16px;text-align:left}" +
      ".bk-fb-scorebox{display:flex;flex-direction:column;align-items:center;justify-content:center;gap:6px;padding-right:32px;border-right:1px solid rgba(128,128,128,.28)}" +
      ".bk-fb-avg{font-size:3.4rem;font-weight:700;line-height:1}.bk-fb-avg small{font-size:1.05rem;font-weight:500;opacity:.6;margin-left:4px}" +
      ".bk-fb-scorebox .fb-stars{font-size:1.15rem}.bk-fb-sub{opacity:.7;font-size:.88rem}" +
      ".bk-fb-bars{display:flex;flex-direction:column;gap:9px;min-width:0}" +
      ".bk-fb-row{display:grid;grid-template-columns:34px 1fr 28px;align-items:center;gap:12px;font-size:.9rem}" +
      ".bk-fb-lbl{display:flex;align-items:center;gap:5px;font-weight:600}.bk-fb-lbl i{color:#f5b301;font-size:.8rem}" +
      ".bk-fb-track{height:9px;border-radius:999px;background:rgba(128,128,128,.25);overflow:hidden}" +
      ".bk-fb-fill{height:100%;border-radius:999px;background:#f5b301}" +
      ".bk-fb-cnt{text-align:right;opacity:.75;font-variant-numeric:tabular-nums}" +
      ".bk-fb-note{display:flex;align-items:center;gap:8px;margin-top:6px;padding-top:12px;border-top:1px solid rgba(128,128,128,.22);opacity:.75;font-size:.86rem}" +
      "@media (max-width:640px){.bk-fb-summary{grid-template-columns:1fr}.bk-fb-scorebox{padding:0 0 16px;border-right:0;border-bottom:1px solid rgba(128,128,128,.28)}}" +
      ".bk-fb-chips{display:flex;flex-wrap:wrap;gap:8px;margin-bottom:16px}" +
      ".bk-chip{background:none;color:inherit;border:1px solid rgba(128,128,128,.45);border-radius:999px;padding:6px 14px;font-weight:600;font-size:.88rem;cursor:pointer}" +
      ".bk-chip.is-active{background:#2bb673;border-color:#2bb673;color:#04210f}" +
      ".bk-fb-top{display:flex;align-items:center;gap:12px}.bk-fb-top .iq-head-main{flex:1;min-width:0}" +
      ".bk-fb-score{white-space:nowrap;font-weight:700}" +
      ".bk-fb-meta{display:flex;flex-wrap:wrap;gap:4px 16px;opacity:.8;font-size:.9rem;margin:10px 0}" +
      ".bk-fb-comment{margin:8px 0 0;white-space:pre-wrap;word-break:break-word}.bk-fb-comment.is-empty{opacity:.55;font-style:italic}" +
      ".bk-fb-foot{display:flex;align-items:center;justify-content:space-between;gap:12px;margin-top:14px;padding-top:12px;border-top:1px solid rgba(128,128,128,.25);font-size:.85rem;opacity:.9}" +
      ".bk-fb-empty{text-align:center;opacity:.7;padding:36px 12px}";
    document.head.appendChild(fbStyle);
  }
  const fbTabs = document.createElement("div");
  fbTabs.className = "bk-tabs";
  fbTabs.setAttribute("role", "tablist");
  fbTabs.innerHTML =
    '<button type="button" class="bk-tab is-active" role="tab" aria-selected="true" data-bk-tab="all">All Bookings</button>' +
    '<button type="button" class="bk-tab" role="tab" aria-selected="false" data-bk-tab="feedback"><i class="bi bi-star-fill" aria-hidden="true"></i> Feedback<span class="bk-tab-count">0</span></button>';
  const fbPanel = document.createElement("div");
  fbPanel.id = "bkFeedbackView";
  fbPanel.hidden = true;
  const fbSearchRow = listView.querySelector(".bk-search-row");
  if (fbSearchRow && fbSearchRow.parentNode) fbSearchRow.parentNode.insertBefore(fbTabs, fbSearchRow);
  else listView.insertBefore(fbTabs, listView.firstChild);
  listView.appendChild(fbPanel);
  let fbFilter = "all";

  function setBookingTab(name) {
    listView.classList.toggle("bk-fb-mode", name === "feedback");
    fbPanel.hidden = name !== "feedback";
    fbTabs.querySelectorAll("[data-bk-tab]").forEach((b) => {
      const on = b.dataset.bkTab === name;
      b.classList.toggle("is-active", on);
      b.setAttribute("aria-selected", on ? "true" : "false");
    });
  }
  fbTabs.onclick = (event) => {
    const b = event.target.closest("[data-bk-tab]");
    if (b) setBookingTab(b.dataset.bkTab);
  };

  function fbStars(n) {
    return [1, 2, 3, 4, 5].map((k) => '<i class="bi ' + (k <= n ? "bi-star-fill" : "bi-star") + '" aria-hidden="true"></i>').join("");
  }

  function renderFeedback() {
    const done = [];
    records.forEach((r, i) => {
      const f = crmBookingFields(r);
      if (!/complete/i.test(String(f.status))) return;
      const fb = r.feedback || null;
      const rating = Math.max(0, Math.min(5, Math.round(Number(fb && fb.rating) || 0)));
      done.push({ i, f, fb, rating });
    });
    const rated = done.filter((x) => x.rating > 0);
    const unrated = done.filter((x) => !x.rating);
    const avg = rated.length ? rated.reduce((s, x) => s + x.rating, 0) / rated.length : 0;
    const countEl = fbTabs.querySelector(".bk-tab-count");
    if (countEl) countEl.textContent = String(rated.length);

    const groups = {
      all: rated,
      "5": rated.filter((x) => x.rating === 5),
      "34": rated.filter((x) => x.rating === 3 || x.rating === 4),
      "12": rated.filter((x) => x.rating <= 2),
      none: unrated,
    };
    if (!groups[fbFilter]) fbFilter = "all";
    const chips = [["all", "All ratings"], ["5", "5 stars"], ["34", "3\u20134 stars"], ["12", "1\u20132 stars"], ["none", "No rating yet"]]
      .map((c) => '<button type="button" class="bk-chip' + (fbFilter === c[0] ? " is-active" : "") + '" data-fb-filter="' + c[0] + '">' + c[1] + " (" + groups[c[0]].length + ")</button>").join("");

    const list = groups[fbFilter].slice();
    if (fbFilter !== "none") list.sort((a, b) => String((b.fb && b.fb.created_at) || "").localeCompare(String((a.fb && a.fb.created_at) || "")));

    const items = list.map((x) => {
      const f = x.f;
      const initials = f.customer.split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0]).join("") || "?";
      const photos = x.fb && Array.isArray(x.fb.images)
        ? x.fb.images.filter((p) => p && p.url).map((p) =>
            '<a href="' + crmEscape(p.url) + '" target="_blank" rel="noopener"><img src="' + crmEscape(p.url) + '" alt="' + crmEscape(p.name || "Customer photo") + '" loading="lazy"></a>').join("")
        : "";
      const comment = x.fb ? String(x.fb.comments || "").trim() : "";
      return '<article class="card iq-card bk-fb-item">' +
        '<div class="bk-fb-top">' + crmAvatarHTML(initials, f.photo) +
          '<div class="iq-head-main"><h4 class="iq-customer">' + crmEscape(f.customer) + '</h4><span class="iq-ref">' + crmEscape(f.ref) + "</span></div>" +
          (x.rating
            ? '<span class="bk-fb-score"><span class="fb-stars" style="color:#f5b301;letter-spacing:2px" role="img" aria-label="' + x.rating + ' out of 5">' + fbStars(x.rating) + "</span> " + x.rating + "/5</span>"
            : '<span class="bk-fb-score" style="opacity:.6;font-weight:500">No rating yet</span>') +
        "</div>" +
        '<div class="bk-fb-meta"><span><i class="bi bi-balloon" aria-hidden="true"></i> ' + crmEscape(f.title) + "</span>" +
          '<span><i class="bi bi-calendar4" aria-hidden="true"></i> ' + crmEscape(f.eventDate) + "</span>" +
          (hideStaffCard ? "" : '<span><i class="bi bi-person" aria-hidden="true"></i> ' + crmEscape(f.staff) + "</span>") + "</div>" +
        (x.rating ? '<p class="bk-fb-comment' + (comment ? "" : " is-empty") + '">' + (comment ? crmEscape(comment) : "No comments.") + "</p>" : "") +
        (photos ? '<div class="fb-photos">' + photos + "</div>" : "") +
        '<div class="bk-fb-foot"><span>' + (x.fb && x.fb.created_at ? "Submitted " + crmEscape(crmAvDateTime(x.fb.created_at)) : "Waiting for the customer\u2019s feedback") + "</span>" +
          '<button type="button" class="btn modal-btn-save" style="width:auto;flex:0 0 auto;padding:8px 22px" data-fb-view="' + x.i + '"><i class="bi bi-arrow-right" aria-hidden="true"></i> View</button></div>' +
      "</article>";
    }).join("");

    fbPanel.innerHTML =
      '<div class="card bk-fb-summary">' +
        (rated.length
          ? '<div class="bk-fb-scorebox"><div class="bk-fb-avg">' + avg.toFixed(1) + "<small>/ 5</small></div>" +
            '<span class="fb-stars" style="color:#f5b301;letter-spacing:3px" role="img" aria-label="Average ' + avg.toFixed(1) + ' out of 5">' + fbStars(Math.round(avg)) + "</span>" +
            '<div class="bk-fb-sub">Based on ' + rated.length + " rating" + (rated.length === 1 ? "" : "s") + "</div></div>" +
            '<div class="bk-fb-bars">' +
              [5, 4, 3, 2, 1].map((n) => {
                const c = rated.filter((x) => x.rating === n).length;
                return '<div class="bk-fb-row"><span class="bk-fb-lbl">' + n + ' <i class="bi bi-star-fill" aria-hidden="true"></i></span>' +
                  '<div class="bk-fb-track"><div class="bk-fb-fill" style="width:' + Math.round((c / rated.length) * 100) + '%"></div></div>' +
                  '<span class="bk-fb-cnt">' + c + "</span></div>";
              }).join("") +
              '<div class="bk-fb-note"><i class="bi bi-hourglass-split" aria-hidden="true"></i>' + unrated.length + " completed booking" + (unrated.length === 1 ? "" : "s") + " waiting for feedback</div>" +
            "</div>"
          : '<div class="bk-fb-sub" style="grid-column:1/-1;text-align:center">No customer ratings yet. Ratings appear here once a customer rates a completed booking.</div>') +
      "</div>" +
      '<div class="bk-fb-chips">' + chips + "</div>" +
      (items ? '<div class="iq-grid">' + items + "</div>" : '<p class="bk-fb-empty">Nothing to show for this filter.</p>');
  }
  // View on a feedback item: the rating screen (stars, comments, photos) with a short booking summary.
  // "View full booking" opens the normal booking details.
  function showFeedbackDetail(index) {
    const record = records[index];
    if (!record) return;
    currentIndex = index;
    const f = crmBookingFields(record);
    const kit = crmDetailKit();
    detailView.innerHTML =
      '<button type="button" class="iq-back" data-bk-action="back"><i class="bi bi-arrow-left" aria-hidden="true"></i>Back to Feedback</button>' +
      '<div class="iq-detail-head">' +
        '<div class="iq-detail-ref" role="heading" aria-level="2">' + crmEscape(f.ref || "Booking") + "</div>" +
        '<span class="stage-pill ' + crmBookingStatusClass(f.status) + '">' + crmEscape(f.status) + "</span>" +
      "</div>" +
      '<div class="iq-detail-col">' +
        crmBookingFeedbackHTML(record.feedback) +
        '<section class="card iq-detail-card">' + kit.head("Booking") +
          '<div class="tk-contact-grid">' +
            kit.field("Customer", kit.value(f.customer)) +
            kit.field("Event Name", kit.value(f.title)) +
            kit.field("Event Date", kit.value(f.eventDate)) +
            (f.eventTime ? kit.field(f.timeLabel, kit.value(f.eventTime)) : "") +
            (hideStaffCard ? "" : kit.field("Assigned Staff", kit.value(f.staff))) +
          "</div>" +
        "</section>" +
        '<div><button type="button" class="btn modal-btn-save" style="width:auto;padding:10px 22px" data-bk-action="open-booking"><i class="bi bi-arrow-right" aria-hidden="true"></i> View full booking</button></div>' +
      "</div>";
    listView.hidden = true;
    detailView.hidden = false;
    toTop();
  }
  fbPanel.onclick = (event) => {
    const chip = event.target.closest("[data-fb-filter]");
    if (chip) { fbFilter = chip.dataset.fbFilter; renderFeedback(); return; }
    const view = event.target.closest("[data-fb-view]");
    if (view) showFeedbackDetail(Number(view.dataset.fbView));
  };

  function render(list) {
    records = Array.isArray(list) ? list.slice() : [];
    // Order: 0 Overdue (event date passed, not Completed/Cancelled) -> 1 Active, nearest event first
    //        -> 2 Completed, newest first -> 3 Cancelled, newest first (bottom). Ties keep the server's order (stable sort).
    const today = new Date(); today.setHours(0, 0, 0, 0);
    const todayIso = today.getFullYear() + "-" + String(today.getMonth() + 1).padStart(2, "0") + "-" + String(today.getDate()).padStart(2, "0");
    const bkSortInfo = (r) => {
      const f = crmBookingFields(r);
      const s = String(f.status).toLowerCase();
      const date = f.dateIso || "";
      let tier = 1;
      if (/cancel/.test(s)) tier = 3;
      else if (/complete/.test(s)) tier = 2;
      else if (date && date < todayIso) tier = 0;
      return { tier, date };
    };
    records = records.map((r) => ({ r, k: bkSortInfo(r) })).sort((a, b) => {
      if (a.k.tier !== b.k.tier) return a.k.tier - b.k.tier;
      if (a.k.tier <= 1) return (a.k.date || "9999-99-99").localeCompare(b.k.date || "9999-99-99"); // nearest event first (overdue: oldest first)
      return (b.k.date || "").localeCompare(a.k.date || ""); // Completed / Cancelled: most recent event first
    }).map((x) => x.r);
    grid.innerHTML = records.map((r, i) => crmBookingCardHTML(r, i)).join("");
    const staffNames = [];
    records.forEach((r) => {
      const name = crmBookingFields(r).staff;
      if (!staffNames.includes(name)) staffNames.push(name);
    });
    window.populateDropdown("bkStaffMenu", staffNames, "All Staff");
    renderFeedback();
    applyFilters();
  }
  window.crmRenderBookings = render;

  // Filter dropdowns: handled here (the click does not reach the shared handler).
  root.addEventListener("click", (event) => {
    const item = event.target.closest(".bk-filters .custom-dropdown-menu .custom-dropdown-item");
    if (!item) return;
    event.preventDefault();
    event.stopPropagation();
    const menu = item.closest(".custom-dropdown-menu");
    const dropdown = item.closest(".dropdown");
    const label = dropdown.querySelector(".custom-dropdown-toggle span");
    if (label && !label.dataset.defaultLabel) label.dataset.defaultLabel = label.textContent.trim();
    const isAll = item.parentElement === menu.firstElementChild;
    if (label) label.textContent = isAll ? label.dataset.defaultLabel : item.textContent.trim();
    filters[menu.dataset.filter] = isAll ? "all" : item.textContent.trim().toLowerCase();
    const toggle = dropdown.querySelector('[data-bs-toggle="dropdown"]');
    if (toggle && window.bootstrap) bootstrap.Dropdown.getOrCreateInstance(toggle).hide();
    applyFilters();
  });

  if (input) input.oninput = applyFilters;
  if (dateInput) dateInput.onchange = applyFilters;
  if (dateFrom) dateFrom.onchange = applyFilters;
  if (dateTo) dateTo.onchange = applyFilters;

  const calendarBtn = root.querySelector("#bkCalendarBtn");
  if (calendarBtn)
    calendarBtn.onclick = () => {
      // data-calendar-page lets another role (Sales Staff) point View Calendar at its own calendar page.
      const page = root.dataset.calendarPage || "admin-manager-sales-calendar.html";
      const links = Array.from(document.querySelectorAll('.sidebar-nav a[onclick*="' + page + '"]'));
      const link = links.find((a) => a.offsetParent !== null) || links[0] || null;
      if (typeof window.loadPage === "function") window.loadPage(page, link);
    };

  function toTop() {
    const body = document.querySelector(".content-body");
    if (body) body.scrollTop = 0;
  }

  function showList() {
    detailView.hidden = true;
    detailView.innerHTML = "";
    listView.hidden = false;
    toTop();
  }

  let currentIndex = -1;
  function showDetail(index, keepScroll) {
    const record = records[index];
    if (!record) return;
    currentIndex = index;
    const body = document.querySelector(".content-body");
    const savedTop = body ? body.scrollTop : 0;   // keepScroll: redraw in place (after Mark as preparing, payment request...) without jumping to the top
    detailView.innerHTML = crmBookingDetailHTML(record, !hideStaffCard);
    listView.hidden = true;
    detailView.hidden = false;
    if (keepScroll && body) body.scrollTop = savedTop;
    else toTop();
  }

  grid.onclick = (event) => {
    const button = event.target.closest('[data-bk-action="view"]');
    const card = button ? button.closest(".iq-card") : null;
    if (!card) return;
    document.dispatchEvent(new CustomEvent("crm:view-booking", { detail: { ref: card.dataset.ref, card } }));
    showDetail(Number(card.dataset.index));
  };

  // Request Full Payment: POST to the same API file as the list (sales-bookings-api.php?action=request_payment / cancel_request)
  const payApi = (root.dataset.api || "").split("?")[0];
  async function payCall(action, fields) {
    const body = new FormData();
    Object.keys(fields).forEach((k) => body.set(k, fields[k]));
    const response = await fetch(payApi + "?action=" + action, { method: "POST", credentials: "same-origin", headers: { Accept: "application/json" }, body });
    let data = {};
    try { data = await response.json(); } catch (e) { /* not JSON */ }
    if (!response.ok || data.success === false) throw new Error(data.message || "Request failed (HTTP " + response.status + ").");
    return data;
  }

  // Pay By Time follows the Pay By date: today -> earliest is 1 hour from now (next :00 / :30), any other day -> 8:00 AM
  const payTimeSync = () => {
    const d = detailView.querySelector("#bkPayDue"), t = detailView.querySelector("#bkPayTime");
    if (!d || !t || !d.value) return;
    const wrap = detailView.querySelector("#bkPayTimeWrap"), endNote = detailView.querySelector("#bkPayEndNote");
    const isToday = d.value === crmTodayIso();
    const showTime = !!(wrap && wrap.dataset.rush === "1");   // only rush events have a time; later events: date-only deadline (11:59 PM)
    if (wrap) wrap.style.display = showTime ? "" : "none";
    if (endNote) endNote.style.display = showTime ? "none" : "";
    if (!showTime) { t.value = ""; delete t.dataset.auto; return; }
    const min = crmQuoteMinTime(d.value);
    t.min = min;
    if (isToday) {
      if (min <= CRM_QUOTE_TIME_MAX && (!t.value || t.value < min)) { t.value = min; t.dataset.auto = min; }
    } else if (t.dataset.auto && t.value === t.dataset.auto) {   // the time was filled in for "today": a later date goes back to empty (11:59 PM)
      t.value = ""; delete t.dataset.auto;
    }
  };
  detailView.onchange = (event) => { if (event.target && event.target.id === "bkPayDue") payTimeSync(); };
  detailView.oninput = (event) => { if (event.target && event.target.id === "bkPayDue") payTimeSync(); };
  detailView.addEventListener("focusin", (event) => { if (event.target && event.target.id === "bkPayTime") payTimeSync(); });   // the clock keeps moving while the form is open
  detailView.addEventListener("mousedown", (event) => { if (event.target && event.target.id === "bkPayTime") payTimeSync(); });

  detailView.onclick = (event) => {
    const btn = event.target.closest("[data-bk-action]");
    if (!btn) return;
    const act = btn.dataset.bkAction;
    if (act === "back") return showList();
    if (act === "open-booking") return showDetail(currentIndex);
    const msg = detailView.querySelector("#bkPayState");
    const say = (text) => { if (msg) { msg.hidden = !text; msg.textContent = text || ""; } };
    const record = records[currentIndex];
    if (!record) return;
    if (act === "progress-next") {
      const pmsg = detailView.querySelector("#bkProgState");
      const psay = (text) => { if (pmsg) { pmsg.hidden = !text; pmsg.textContent = text || ""; } };
      btn.disabled = true;
      psay("Updating the progress...");
      payCall("update_progress", { booking_id: record.booking_id, status: btn.dataset.status })
        .then((data) => {
          record.progress = data.progress;
          record.fulfillment_status = data.fulfillment_status;
          record.booking_status = data.booking_status || record.booking_status;
          record.can_update_progress = data.can_update_progress === true;
          showDetail(currentIndex, true);
        })
        .catch((error) => { btn.disabled = false; psay(error.message); });
      return;
    }
    if (act === "payreq-send") {
      const due = detailView.querySelector("#bkPayDue");
      const note = detailView.querySelector("#bkPayNote");
      const dueValue = due ? due.value : "";
      const dueTimeEl = detailView.querySelector("#bkPayTime");
      const dueTime = dueTimeEl ? dueTimeEl.value : "";
      const payWrap = detailView.querySelector("#bkPayTimeWrap");
      const problem = crmQuoteDeadlineProblem(dueValue, dueTime, "payment deadline", !!(payWrap && payWrap.dataset.rush === "1"));
      if (problem) { say(problem); return; }
      say("");
      const bf = crmBookingFields(record);
      crmConfirm({
        title: "Send payment request?",
        details: [
          ["Customer", bf.customer],
          ["Event", bf.title],
          ["Event date", bf.eventDateTime],
          ["Pay by", crmDeadlineLabel(dueValue, dueTime || "23:59")],
          ["Amount to request", bf.balance, true]
        ],
        note: "Please check that everything is correct. The customer gets this in their inbox **right away** with a **Pay Now** button.",
        warning: "If it is not paid by the deadline, the booking is **cancelled automatically** and the deposit is **non-refundable**.",
        message: "Customer: " + bf.customer + "\nEvent: " + bf.title + "\nEvent date: " + bf.eventDateTime + "\nPay by: " + crmDeadlineLabel(dueValue, dueTime || "23:59") + "\nAmount to request: " + bf.balance,   // plain-text fallback if Bootstrap is missing
        confirmText: "Send request"
      }).then((ok) => {
        if (!ok) return;
        btn.disabled = true;
        say("Sending the payment request...");
        payCall("request_payment", { booking_id: record.booking_id, due_date: dueValue, due_time: dueTime, note: note ? note.value.trim() : "" })
          .then((data) => {
            record.payment_request = data.payment_request;
            record.can_request_payment = false;
            showDetail(currentIndex, true);
          })
          .catch((error) => { btn.disabled = false; say(error.message); });
      });
    }
    if (act === "payreq-cancel") {
      btn.disabled = true;
      payCall("cancel_request", { request_id: btn.dataset.requestId })
        .then((data) => {
          record.payment_request = null;
          record.can_request_payment = data.can_request_payment !== false;
          showDetail(currentIndex, true);
        })
        .catch((error) => { btn.disabled = false; say(error.message); });
    }
  };

  // Load the list automatically.
  const url = root.dataset.api;
  if (!url) return render([]);
  if (state) { state.hidden = false; state.textContent = "Loading bookings..."; }
  fetch(url, {
    method: "GET",
    credentials: "same-origin",
    headers: { Accept: "application/json" },
    cache: "no-store",
  })
    .then((response) => response.json().then((data) => ({ response, data })))
    .then(({ response, data }) => {
      if (document.getElementById("managerBookingsPage") !== root) return;
      if (!response.ok || !data || !Array.isArray(data.bookings))
        throw new Error((data && data.message) || "Unable to load bookings.");
      render(data.bookings);
    })
    .catch((error) => {
      console.warn("Bookings could not be loaded:", error);
      if (document.getElementById("managerBookingsPage") !== root) return;
      render([]);
      if (state) { state.hidden = false; state.textContent = "Unable to load bookings."; }
    });
}

// ---- Customer Service Staff: Inbox (cs-inbox.html) ----
// Support tickets only (inquiry conversations belong to Sales Staff).
// Backend: cs-inbox-api.php  (list_tickets, ticket_messages, reply_ticket) - same tables as the customer inbox.
// "View Ticket Details" opens the Tickets page on that ticket; the ticket's "Open Conversation" button
// opens this inbox on that ticket (window.crmPendingTicketRef / window.crmPendingInboxTicket).
function crmInitCsInbox(root) {
  if (!root || root.dataset.csiReady === "true") return;
  root.dataset.csiReady = "true";

  const api = root.dataset.api || "cs-inbox-api.php";
  const $ = (selector) => root.querySelector(selector);
  const el = {
    shell: $("#csiShell"), list: $("#csiList"), listState: $("#csiListState"), noResults: $("#csiNoResults"),
    search: $("#csiSearch"), unread: $("#csiUnreadCount"), empty: $("#csiEmpty"), thread: $("#csiThread"),
    feed: $("#csiFeed"), form: $("#csiForm"), text: $("#csiText"), send: $("#csiSend"), files: $("#csiFiles"),
    attach: $("#csiAttach"), fileLabel: $("#csiFileLabel"), avatar: $("#csiAvatar"), name: $("#csiName"),
    ref: $("#csiRef"), subject: $("#csiSubject"), priority: $("#csiPriority"), status: $("#csiStatus"),
    view: $("#csiViewTicket"), back: $("#csiBack"),
  };
  const composerPlaceholder = el.text.getAttribute("placeholder") || "";
  const st = { tickets: [], id: "", signature: "" };

  async function call(action, options, params) {
    const url = new URL(api, window.location.href);
    url.searchParams.set("action", action);
    Object.keys(params || {}).forEach((key) => url.searchParams.set(key, params[key]));
    const response = await fetch(url.toString(), Object.assign({ credentials: "same-origin", cache: "no-store" }, options || {}));
    const raw = await response.text();
    let data;
    try { data = raw ? JSON.parse(raw) : {}; }
    catch (error) { throw new Error("Inbox API returned non-JSON (HTTP " + response.status + "). Check cs-inbox-api.php."); }
    if (!response.ok || data.success === false) throw new Error(data.message || "Request failed (HTTP " + response.status + ").");
    return data;
  }

  const toDate = (value) => new Date(String(value || "").trim().replace(" ", "T"));
  function listTime(value) {
    const d = toDate(value);
    if (isNaN(d.getTime())) return "";
    return d.toDateString() === new Date().toDateString()
      ? d.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" })
      : d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
  }
  function messageTime(value) {
    const d = toDate(value);
    if (isNaN(d.getTime())) return "";
    return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }) + " - " +
      d.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" });
  }
  const fileSize = (bytes) => {
    const n = Number(bytes);
    if (!n) return "";
    return n >= 1048576 ? (n / 1048576).toFixed(1) + " MB" : Math.max(1, Math.round(n / 1024)) + " KB";
  };
  const isImage = (f) => /^image\//i.test(String(f.mime_type || "")) || /\.(jpe?g|png|gif|webp)$/i.test(String(f.name || f.url || ""));
  const isResolved = (ticket) => /resolved|closed/i.test(String(ticket && ticket.status));
  const current = () => st.tickets.find((t) => String(t.id) === st.id) || null;

  function renderList() {
    const term = el.search.value.trim().toLowerCase();
    const rows = st.tickets.filter((t) =>
      !term || [t.customer_name, t.ticket_number, t.subject].join(" ").toLowerCase().includes(term));
    const unread = st.tickets.filter((t) => Number(t.unread) > 0).length;
    el.unread.hidden = unread === 0;
    el.unread.textContent = unread + " Unread";

    el.list.innerHTML = rows.map((t) =>
      '<button type="button" class="csi-item" data-id="' + crmEscape(t.id) + '"' +
      (String(t.id) === st.id ? ' aria-current="true"' : "") + ">" +
        '<span class="csi-item-top">' +
          crmAvatarHTML(crmTicketInitials(t.customer_name), t.customer_photo, "csi-item-avatar") +
          '<span class="csi-item-name">' + crmEscape(t.customer_name) + "</span>" +
          '<span class="csi-item-time">' + crmEscape(listTime(t.last_message_at)) + "</span>" +
        "</span>" +
        '<span class="csi-item-meta"><span class="csi-ref">' + crmEscape(t.ticket_number) + "</span>" +
          (Number(t.unread) > 0 ? '<span class="csi-dot" aria-label="Unread"></span>' : "") + "</span>" +
        '<span class="csi-item-preview">' + crmEscape(t.last_message || t.subject) + "</span>" +
      "</button>"
    ).join("");

    el.noResults.hidden = !(st.tickets.length > 0 && rows.length === 0);
    el.listState.hidden = st.tickets.length > 0;
    if (st.tickets.length === 0 && !el.listState.dataset.error) el.listState.textContent = "No support conversations yet.";
  }

  function renderHeader(t) {
    crmSetAvatar(el.avatar, crmTicketInitials(t.customer_name), t.customer_photo);
    el.name.textContent = t.customer_name;
    el.ref.textContent = t.ticket_number;
    el.subject.textContent = t.subject;
    el.priority.textContent = t.priority;
    el.priority.className = "stage-pill " + (CRM_TICKET_PRIORITY_CLASS[String(t.priority).toLowerCase()] || "stage-new");
    el.status.textContent = t.status;
    el.status.className = "stage-pill " + (CRM_TICKET_STATUS_CLASS[String(t.status).toLowerCase()] || "stage-new");
    const locked = isResolved(t);
    el.text.disabled = locked;
    el.attach.disabled = locked;
    el.send.disabled = locked;
    el.text.placeholder = locked ? "This ticket is resolved. Replies are turned off." : composerPlaceholder;
  }

  function renderMessages(messages) {
    const signature = messages.map((m) => m.id).join(",");
    if (signature === st.signature) return;
    st.signature = signature;
    if (!messages.length) {
      el.feed.innerHTML = '<p class="iq-state">No messages in this conversation yet.</p>';
      return;
    }
    el.feed.innerHTML = messages.map((m) => {
      // Photos are shown as photos (click to enlarge, same look as the other inboxes); other files keep the file card + Download.
      const files = (Array.isArray(m.attachments) ? m.attachments : []).filter((f) => f && f.url).map((f) =>
        isImage(f)
          ? '<div class="sbx-att"><a class="sbx-img" href="' + crmEscape(f.url) + '" target="_blank" rel="noopener noreferrer">' +
            '<img src="' + crmEscape(f.url) + '" alt="' + crmEscape(f.name || "Image") + '" loading="lazy"></a></div>'
          : '<div class="csi-file"><span class="tk-icon" aria-hidden="true"><i class="bi bi-paperclip"></i></span>' +
            '<div class="csi-file-main"><span class="csi-file-name">' + crmEscape(f.name || "Attachment") + "</span>" +
            (fileSize(f.size) ? '<span class="csi-file-size">File size: ' + crmEscape(fileSize(f.size)) + "</span>" : "") + "</div>" +
            '<a class="btn csi-outline-btn csi-download" href="' + crmEscape(f.url) + '" download target="_blank" rel="noopener noreferrer">Download</a></div>'
      ).join("");
      // Same layout as the customer inbox: bubble, then attachments, then one small "time · name" line underneath.
      return '<article class="csi-msg' + (m.is_mine ? " is-mine" : "") + '">' +
        (m.message ? '<div class="csi-bubble"><p>' + crmEscape(m.message) + "</p></div>" : "") + files +
        '<div class="csi-msg-meta">' + crmEscape([messageTime(m.created_at), m.sender_name].filter(Boolean).join(" · ")) + "</div></article>";
    }).join("");
    const toBottom = () => { el.feed.scrollTop = el.feed.scrollHeight; };
    toBottom();
    requestAnimationFrame(toBottom);
  }

  async function select(id, quiet) {
    st.id = String(id);
    if (!quiet) st.signature = "";
    el.shell.classList.add("is-thread-open");
    el.empty.hidden = true;
    el.thread.hidden = false;
    const known = current();
    if (known) renderHeader(known);
    if (!quiet) el.feed.innerHTML = '<p class="iq-state">Loading messages...</p>';
    try {
      const data = await call("ticket_messages", null, { ticket_id: st.id });
      if (String(st.id) !== String(id)) return;
      const index = st.tickets.findIndex((t) => String(t.id) === String(id));
      if (index >= 0) st.tickets[index] = data.ticket; else st.tickets.unshift(data.ticket);
      renderHeader(data.ticket);
      renderMessages(Array.isArray(data.messages) ? data.messages : []);
      renderList();
    } catch (error) {
      if (!quiet) el.feed.innerHTML = '<p class="iq-state">' + crmEscape(error.message) + "</p>";
    }
  }

  async function loadList(quiet) {
    try {
      const data = await call("list_tickets");
      st.tickets = Array.isArray(data.tickets) ? data.tickets : [];
      delete el.listState.dataset.error;
      renderList();
      const want = window.crmPendingInboxTicket;
      if (want) {
        window.crmPendingInboxTicket = null;
        const hit = st.tickets.find((t) => String(t.ticket_number) === String(want) || String(t.id) === String(want));
        if (hit) { el.search.value = ""; await select(hit.id); }
      }
    } catch (error) {
      if (quiet) return;
      el.listState.dataset.error = "1";
      el.listState.hidden = false;
      el.listState.textContent = error.message;
    }
  }

  // events
  el.list.addEventListener("click", (event) => {
    const item = event.target.closest(".csi-item");
    if (item) select(item.dataset.id);
  });
  el.search.addEventListener("input", renderList);
  el.back.addEventListener("click", () => el.shell.classList.remove("is-thread-open"));
  el.view.addEventListener("click", () => {
    const t = current();
    if (!t) return;
    window.crmPendingTicketRef = t.ticket_number;
    if (typeof loadPage === "function") loadPage("tickets");
  });
  // The response box grows with the text (like Messenger) up to the CSS max-height, then scrolls inside.
  const autoGrow = () => {
    const box = el.text;
    box.style.height = "auto";
    const style = window.getComputedStyle(box);
    const max = parseFloat(style.maxHeight) || 140;
    const min = parseFloat(style.minHeight) || 40;
    const wanted = box.scrollHeight + (box.offsetHeight - box.clientHeight);
    box.style.height = Math.max(min, Math.min(wanted, max)) + "px";
    box.style.overflowY = wanted > max ? "auto" : "hidden";
  };
  el.text.addEventListener("input", autoGrow);
  el.attach.addEventListener("click", () => el.files.click());
  el.files.addEventListener("change", () => {
    el.fileLabel.textContent = Array.from(el.files.files || []).map((f) => f.name).join(", ");
  });
  el.text.addEventListener("keydown", (event) => {
    if (event.key === "Enter" && !event.shiftKey) { event.preventDefault(); el.form.requestSubmit(); }
  });
  el.form.addEventListener("submit", async (event) => {
    event.preventDefault();
    if (!st.id || el.send.disabled) return;
    if (!el.text.value.trim() && !el.files.files.length) return;
    el.send.disabled = true;
    try {
      const body = new FormData(el.form);
      body.set("ticket_id", st.id);
      await call("reply_ticket", { method: "POST", body });
      el.form.reset();
      autoGrow();
      el.fileLabel.textContent = "";
      st.signature = "";
      await select(st.id, true);
    } catch (error) {
      el.fileLabel.textContent = error.message;
    } finally {
      const t = current();
      el.send.disabled = !!(t && isResolved(t));
    }
  });

  loadList();
  // keep the inbox fresh: new customer messages appear without a refresh
  const timer = setInterval(() => {
    if (document.getElementById("csInboxPage") !== root) return clearInterval(timer);
    if (document.hidden) return;
    loadList(true);
    if (st.id) select(st.id, true);
  }, 15000);
}

// ---- Admin + Manager: Inbox (manager-admin-inbox.html) ----
// READ ONLY. Sales Conversations tab = every Sales Staff conversation, Support Tickets tab = every Customer Service
// ticket. There is no reply box: Admin and Manager can only watch. Same two-pane layout as the CS inbox (.csi-*).
// Backend: manager-admin-api.php (list_conversations, conversation_messages, list_tickets, ticket_messages).
// "Open Inquiry Details" opens the Inquiries page on that inquiry (window.crmPendingInquiryRef);
// "View Ticket Details" opens the Tickets page on that ticket (window.crmPendingTicketRef).
// Optional fields a message / conversation may carry (shown only when the API sends them):
//   conversation.event_date, message.quotation = { reference, version, status, amount, date, validity, url }
function crmInitManagerInbox(root) {
  if (!root || root.dataset.miReady === "true") return;
  root.dataset.miReady = "true";

  const api = root.dataset.api || "manager-admin-api.php";
  const $ = (selector) => root.querySelector(selector);
  const el = {
    shell: $("#miShell"), list: $("#miList"), listState: $("#miListState"), noResults: $("#miNoResults"),
    search: $("#miSearch"), unread: $("#miUnread"), unreadToggle: $("#miUnreadToggle"), all: $("#miAll"), listCount: $("#miListCount"), listTitle: $("#miListTitle"),
    staffMenu: $("#miStaffMenu"), staffLabel: $("#miStaffLabel"), readMenu: $("#miReadMenu"), readLabel: $("#miReadLabel"),
    clear: $("#miClear"), empty: $("#miEmpty"), thread: $("#miThread"), feed: $("#miFeed"),
    avatar: $("#miAvatar"), name: $("#miName"), ref: $("#miRef"), subject: $("#miSubject"),
    priority: $("#miPriority"), status: $("#miStatus"), open: $("#miOpen"), openLabel: $("#miOpenLabel"), back: $("#miBack"),
    role: $("#miRole"), role2: $("#miRole2"), handled: $("#miHandled"), responsible: $("#miResponsible"),
    salesCount: $("#miSalesCount"), supportCount: $("#miSupportCount"),
  };

  // "N Unread" pill on the right of the list header (same pill as the Sales / CS inbox)
  const unreadPill = document.createElement("span");
  unreadPill.className = "stage-pill stage-won mi-unread-pill";
  unreadPill.hidden = true;
  const pillRow = el.listTitle && (el.listTitle.closest(".csi-list-title") || el.listTitle.parentElement);
  if (pillRow) pillRow.appendChild(unreadPill);

  // One config per tab, so both tabs share the same code.
  const TABS = {
    sales: {
      list: "list_conversations", listKey: "conversations", messages: "conversation_messages", idParam: "conversation_id", itemKey: "conversation",
      title: "Conversations", search: "Search customer, inquiry, or message...", allStaff: "All Sales Staff", staffWord: "Sales",
      empty: "No sales conversations yet.", openLabel: "Open Inquiry Details", openIcon: "bi-folder2-open",
      handled: "Customer replies are handled by assigned Sales Staff.", responsible: "Responsible Sales Staff",
    },
    support: {
      list: "list_tickets", listKey: "tickets", messages: "ticket_messages", idParam: "ticket_id", itemKey: "ticket",
      title: "Support Tickets", search: "Search customer or ticket ID...", allStaff: "All Customer Service Staff", staffWord: "CS",
      empty: "No support tickets yet.", openLabel: "View Ticket Details", openIcon: "bi-ticket-detailed",
      handled: "Customer replies are handled by assigned Customer Service Staff.", responsible: "Responsible Customer Service Staff",
    },
  };
  const st = { tab: "sales", sales: [], support: [], id: "", signature: "", staff: "all", read: "all", error: "" };

  async function call(action, params) {
    const url = new URL(api, window.location.href);
    url.searchParams.set("action", action);
    Object.keys(params || {}).forEach((key) => url.searchParams.set(key, params[key]));
    const response = await fetch(url.toString(), { credentials: "same-origin", cache: "no-store" });
    const raw = await response.text();
    let data;
    try { data = raw ? JSON.parse(raw) : {}; }
    catch (error) { throw new Error("Inbox API returned non-JSON (HTTP " + response.status + "). Check manager-admin-api.php."); }
    if (!response.ok || data.success === false) throw new Error(data.message || "Request failed (HTTP " + response.status + ").");
    return data;
  }

  const toDate = (value) => new Date(String(value || "").trim().replace(" ", "T"));
  function listTime(value) {
    const d = toDate(value);
    if (isNaN(d.getTime())) return "";
    return d.toDateString() === new Date().toDateString()
      ? d.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" })
      : d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
  }
  function messageTime(value) {
    const d = toDate(value);
    if (isNaN(d.getTime())) return "";
    return d.toLocaleDateString("en-US", { month: "short", day: "2-digit", year: "numeric" }) + " - " +
      d.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" });
  }
  const fileSize = (bytes) => {
    const n = Number(bytes);
    if (!n) return "";
    return n >= 1048576 ? (n / 1048576).toFixed(1) + " MB" : Math.max(1, Math.round(n / 1024)) + " KB";
  };
  const money = (value) => {
    const n = Number(String(value).replace(/[^0-9.-]/g, ""));
    return isNaN(n) || value === "" || value === null || value === undefined
      ? String(value || "")
      : "\u20B1" + n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  };

  // The API rows look a little different per tab: turn them into one shape.
  function normalize(tab, r) {
    return {
      id: String(r.id),
      ref: String(tab === "support" ? (r.ticket_number || r.reference) : r.reference || ""),
      name: r.customer_name || "Customer",
      photo: r.customer_photo || "",
      subject: r.subject || "",
      status: r.status || "",
      priority: r.priority || "",
      staff: String(r.staff_name || "").trim(),
      lastMessage: r.last_message || "",
      lastAt: r.last_message_at || r.created_at || "",
      unread: Number(r.unread) || 0,
      eventDate: r.event_date || "",
    };
  }
  const items = (tab) => st[tab || st.tab];
  const current = () => items().find((t) => t.id === st.id) || null;
  const cfg = () => TABS[st.tab];

  function visibleRows() {
    const term = el.search.value.trim().toLowerCase();
    return items().filter((t) => {
      if (term && ![t.name, t.ref, t.subject].join(" ").toLowerCase().includes(term)) return false;
      if (st.staff !== "all" && (t.staff || "Unassigned") !== st.staff) return false;
      if (st.read === "unread" && t.unread === 0) return false;
      if (st.read === "read" && t.unread > 0) return false;
      return true;
    });
  }

  function dropdownItems(values, selected) {
    return values.map((v) =>
      '<li><a class="dropdown-item custom-dropdown-item py-2 px-3" href="#" data-value="' + crmEscape(v.value) + '"' +
      (v.value === selected ? ' aria-selected="true"' : "") + ">" + crmEscape(v.label) + "</a></li>").join("");
  }
  function renderFilters() {
    // Support tab: only one CS staff, so the staff filter is useless there. Hide it (the Sales tab keeps it).
    const staffToggle = el.staffLabel.closest("button, [data-bs-toggle]") || el.staffLabel;
    const staffBox = staffToggle.parentElement && staffToggle.parentElement.contains(el.staffMenu) ? staffToggle.parentElement : staffToggle;
    staffBox.hidden = st.tab === "support";
    staffBox.style.display = st.tab === "support" ? "none" : "";
    if (st.tab === "support") st.staff = "all";
    const names = [];
    items().forEach((t) => { const n = t.staff || "Unassigned"; if (!names.includes(n)) names.push(n); });
    names.sort((a, b) => a.localeCompare(b));
    if (st.staff !== "all" && !names.includes(st.staff)) st.staff = "all";
    el.staffMenu.innerHTML = dropdownItems([{ value: "all", label: cfg().allStaff }].concat(names.map((n) => ({ value: n, label: n }))), st.staff);
    el.staffLabel.textContent = st.staff === "all" ? cfg().allStaff : st.staff;
    el.readLabel.textContent = { all: "All Messages", unread: "Unread", read: "Read" }[st.read];
    el.unreadToggle.setAttribute("aria-pressed", st.read === "unread" ? "true" : "false");
    el.all.classList.toggle("is-active", st.staff === "all" && st.read === "all" && !el.search.value.trim());
    el.all.setAttribute("aria-pressed", st.staff === "all" && st.read === "all" && !el.search.value.trim() ? "true" : "false");
    el.readMenu.querySelectorAll(".custom-dropdown-item").forEach((a) =>
      a.toggleAttribute("aria-selected", a.dataset.value === st.read));
  }

  function renderCounts() {
    const set = (node, list) => {
      const n = list.filter((t) => t.unread > 0).length;
      node.hidden = n === 0;
      node.textContent = String(n);
    };
    set(el.salesCount, st.sales);
    set(el.supportCount, st.support);
  }

  function renderList() {
    const rows = visibleRows();
    const unread = items().filter((t) => t.unread > 0).length;
    el.unread.hidden = unread === 0;
    el.unread.textContent = String(unread);
    unreadPill.hidden = unread === 0;
    unreadPill.textContent = unread + " Unread";

    el.list.innerHTML = rows.map((t) =>
      '<button type="button" class="csi-item' + (t.unread > 0 ? " is-unread" : "") + '" data-id="' + crmEscape(t.id) + '"' +
      (t.id === st.id ? ' aria-current="true"' : "") + ">" +
        crmAvatarHTML(crmTicketInitials(t.name), t.photo, "csi-item-avatar") +
        '<span class="mi-item-main">' +
          '<span class="mi-item-line mi-item-sub"><span class="csi-ref">' + crmEscape(t.ref) + "</span>" +
            '<span class="mi-item-staff' + (t.staff ? "" : " is-unassigned") + '"><i class="bi bi-person" aria-hidden="true"></i><span>' + crmEscape(t.staff || "Unassigned") + "</span></span></span>" +
          '<span class="mi-item-line"><span class="csi-item-name">' + crmEscape(t.name) + "</span>" +
            '<span class="csi-item-time">' + crmEscape(listTime(t.lastAt)) + "</span></span>" +
          '<span class="mi-item-line"><span class="csi-item-preview">' + crmEscape(t.lastMessage || t.subject) + "</span>" +
            (t.unread > 0 ? '<span class="csi-dot" aria-label="Unread"></span>' : "") + "</span>" +
        "</span>" +
      "</button>"
    ).join("");

    const total = items().length;
    el.listCount.textContent = String(total);
    el.noResults.hidden = !(total > 0 && rows.length === 0);
    el.listState.hidden = total > 0;
    if (total === 0) el.listState.textContent = st.error || cfg().empty;
  }

  function renderHeader(t) {
    const c = cfg();
    crmSetAvatar(el.avatar, crmTicketInitials(t.name), t.photo);
    el.name.textContent = t.name;
    el.ref.textContent = t.ref;
    // "Event title * Event: date * Sales: staff"
    const staff = t.staff || "Unassigned";
    el.subject.innerHTML = [
      t.subject ? crmEscape(t.subject) : "",
      t.eventDate ? "Event: " + crmEscape(t.eventDate) : "",
      crmEscape(c.staffWord) + ": <strong class=\"mi-staff-name\">" + crmEscape(staff) + "</strong>",
    ].filter(Boolean).join(" \u2022 ");
    if (st.tab === "support") {
      el.priority.hidden = !t.priority;
      el.priority.textContent = t.priority;
      el.priority.className = "stage-pill " + (CRM_TICKET_PRIORITY_CLASS[String(t.priority).toLowerCase()] || "stage-new");
      el.status.className = "stage-pill " + (CRM_TICKET_STATUS_CLASS[String(t.status).toLowerCase()] || "stage-new");
    } else {
      el.priority.hidden = true;
      el.status.className = "stage-pill " + (CRM_STAGE_CLASS[String(t.status).toLowerCase()] || "stage-new");
    }
    el.status.textContent = t.status;
    el.status.hidden = !t.status;
    el.openLabel.textContent = c.openLabel;
    el.open.querySelector("i").className = "bi " + c.openIcon;
    el.handled.textContent = c.handled;
    el.responsible.innerHTML = crmEscape(c.responsible) + ": <strong>" + crmEscape(staff) + "</strong>";
  }

  function quotationCard(q) {
    if (!q || typeof q !== "object") return "";
    const label = (text, value) => '<div><span class="mi-q-label">' + text + '</span><span class="mi-q-value">' + crmEscape(value || "-") + "</span></div>";
    return '<div class="mi-quote">' +
      '<div class="mi-quote-head"><span class="mi-quote-title"><i class="bi bi-file-earmark-text" aria-hidden="true"></i>' +
        crmEscape([q.reference, q.version ? "(" + q.version + ")" : ""].filter(Boolean).join(" ")) + "</span>" +
        (q.status ? '<span class="mi-quote-status">' + crmEscape(q.status) + "</span>" : "") + "</div>" +
      '<div class="mi-quote-grid">' +
        '<div><span class="mi-q-label">Quotation Amount</span><span class="mi-q-amount">' + crmEscape(money(q.amount)) + "</span></div>" +
        label("Quotation Date", q.date) + label("Validity Date", q.validity) + "</div>" +
      (q.url ? '<a class="btn csi-outline-btn mi-quote-btn" href="' + crmEscape(q.url) + '" target="_blank" rel="noopener noreferrer"><i class="bi bi-box-arrow-up-right" aria-hidden="true"></i>View Quotation</a>' : "") +
    "</div>";
  }

  function paymentRequestCard(p) {
    if (!p || typeof p !== "object") return "";
    const cls = p.status === "Paid" ? "ticket-resolved" : p.status === "Pending" ? "ticket-pending" : "ticket-high";
    const label = (text, value) => '<div><span class="mi-q-label">' + text + '</span><span class="mi-q-value">' + crmEscape(value || "-") + "</span></div>";
    return '<div class="mi-quote">' +
      '<div class="mi-quote-head"><span class="mi-quote-title"><i class="bi bi-cash-coin" aria-hidden="true"></i>Full payment request</span>' +
        '<span class="ticket-badge ' + cls + '">' + crmEscape(p.status === "Pending" ? "Awaiting payment" : p.status) + "</span></div>" +
      '<div class="mi-quote-grid">' +
        '<div><span class="mi-q-label">Amount</span><span class="mi-q-amount">' + crmEscape(p.amount_label || "") + "</span></div>" +
        label("Pay by", p.due_label) + label(p.status === "Paid" ? "Paid via" : "Booking", p.status === "Paid" ? p.method : p.booking_ref) + "</div>" +
    "</div>";
  }

  function renderMessages(messages) {
    const signature = messages.map((m) => m.id).join(",");
    if (signature === st.signature) return;
    st.signature = signature;
    if (!messages.length) {
      el.feed.innerHTML = '<p class="iq-state">No messages in this conversation yet.</p>';
      return;
    }
    // Photos are shown on their own under the message (no bubble around them), the same clean look as the other inboxes.
    // Other files keep the file card + Download inside the bubble.
    const isManagerImage = (f) => /^image\//i.test(String(f.mime_type || "")) || /\.(jpe?g|png|gif|webp)$/i.test(String(f.name || f.url || ""));
    el.feed.innerHTML = messages.map((m) => {
      const when = messageTime(m.created_at);
      const atts = (Array.isArray(m.attachments) ? m.attachments : []).filter((f) => f && f.url);
      const photos = atts.filter(isManagerImage).map((f) =>
        '<div class="sbx-att"><a class="sbx-img" href="' + crmEscape(f.url) + '" target="_blank" rel="noopener noreferrer">' +
        '<img src="' + crmEscape(f.url) + '" alt="' + crmEscape(f.name || "Image") + '" loading="lazy"></a></div>'
      ).join("");
      const files = atts.filter((f) => !isManagerImage(f)).map((f) =>
        '<div class="csi-file"><span class="tk-icon" aria-hidden="true"><i class="bi bi-paperclip"></i></span>' +
        '<div class="csi-file-main"><span class="csi-file-name">' + crmEscape(f.name || "Attachment") + "</span>" +
        (fileSize(f.size) ? '<span class="csi-file-size">File size: ' + crmEscape(fileSize(f.size)) + "</span>" : "") + "</div>" +
        '<a class="btn csi-outline-btn csi-download" href="' + crmEscape(f.url) + '" download target="_blank" rel="noopener noreferrer">Download</a></div>'
      ).join("");
      // Name + time ABOVE the bubble (customer on the left, staff on the right).
      const who = '<strong class="mi-sender">' + crmEscape(m.sender_name || "") + "</strong>";
      const whenTag = '<span class="mi-time">' + crmEscape(when) + "</span>";
      const messageAvatar = !m.is_mine
        ? crmAvatarHTML(crmTicketInitials(m.sender_name || ""), "", "mi-message-avatar")
        : "";
      const bubbleBody = (m.message ? "<p>" + crmRichText(m.message) + "</p>" : "") + (quotationCard(m.quotation) || "") + (paymentRequestCard(m.payment_request) || "") + files;
      return '<article class="csi-msg mi-msg' + (m.is_mine ? " is-mine" : "") + '">' +
        messageAvatar +
        '<div class="csi-msg-meta mi-meta">' + (m.is_mine ? whenTag + who : who + whenTag) + "</div>" +
        (bubbleBody ? '<div class="csi-bubble">' + bubbleBody + "</div>" : "") + photos +
      "</article>";
    }).join("");
    const toBottom = () => { el.feed.scrollTop = el.feed.scrollHeight; };
    toBottom();
    requestAnimationFrame(toBottom);
  }

  function showEmpty() {
    st.id = "";
    st.signature = "";
    el.shell.classList.remove("is-thread-open");
    el.thread.hidden = true;
    el.empty.hidden = false;
  }

  async function select(id, quiet) {
    const tab = st.tab;
    st.id = String(id);
    if (!quiet) st.signature = "";
    el.shell.classList.add("is-thread-open");
    el.empty.hidden = true;
    el.thread.hidden = false;
    const known = current();
    if (known) renderHeader(known);
    if (!quiet) el.feed.innerHTML = '<p class="iq-state">Loading messages...</p>';
    try {
      const c = TABS[tab];
      const params = {};
      params[c.idParam] = st.id;
      const data = await call(c.messages, params);
      if (st.tab !== tab || st.id !== String(id)) return;
      const fresh = normalize(tab, data[c.itemKey] || {});
      const index = st[tab].findIndex((t) => t.id === String(id));
      if (index >= 0) st[tab][index] = fresh;
      renderHeader(fresh);
      renderMessages(Array.isArray(data.messages) ? data.messages : []);
      renderList();
      renderCounts();
    } catch (error) {
      if (!quiet) el.feed.innerHTML = '<p class="iq-state">' + crmEscape(error.message) + "</p>";
    }
  }

  function applyRole(data) {
    const role = (data && data.viewer_role) || localStorage.getItem("userRole") || "Admin";
    if (el.role) el.role.textContent = role;
    if (el.role2) el.role2.textContent = role;
  }

  // Load both lists, so both tab badges are right.
  async function loadAll(quiet) {
    const jobs = ["sales", "support"].map((tab) =>
      call(TABS[tab].list).then((data) => {
        st[tab] = (Array.isArray(data[TABS[tab].listKey]) ? data[TABS[tab].listKey] : []).map((r) => normalize(tab, r));
        applyRole(data);
        return null;
      }));
    const results = await Promise.allSettled(jobs);
    const failed = results.find((r) => r.status === "rejected");
    st.error = failed && !quiet ? failed.reason.message : "";
    if (failed && quiet) return;
    renderCounts();
    renderFilters();
    renderList();
    // coming from another page: open this conversation / ticket straight away
    const want = window.crmPendingInboxConversation;
    if (want) {
      window.crmPendingInboxConversation = null;
      ["sales", "support"].some((tab) => {
        const hit = st[tab].find((t) => t.ref === String(want) || t.id === String(want));
        if (!hit) return false;
        switchTab(tab);
        select(hit.id);
        return true;
      });
    }
  }

  function switchTab(tab) {
    if (!TABS[tab]) return;
    st.tab = tab;
    st.staff = "all";
    st.read = "all";
    el.search.value = "";
    root.querySelectorAll("[data-mi-tab]").forEach((b) => {
      const on = b.dataset.miTab === tab;
      b.classList.toggle("active", on);
      b.setAttribute("aria-selected", on ? "true" : "false");
    });
    el.listTitle.textContent = cfg().title;
    el.search.placeholder = cfg().search;
    showEmpty();
    renderFilters();
    renderList();
  }

  function goTo(page, pendingKey, ref) {
    window[pendingKey] = ref;
    const links = Array.from(document.querySelectorAll('.sidebar-nav a[onclick*="' + page + '"]'));
    const link = links.find((a) => a.offsetParent !== null) || links[0] || null;
    if (typeof window.loadPage === "function") window.loadPage(page, link);
  }

  // ---- events ----
  root.querySelectorAll("[data-mi-tab]").forEach((b) => b.addEventListener("click", () => switchTab(b.dataset.miTab)));
  el.list.addEventListener("click", (event) => {
    const item = event.target.closest(".csi-item");
    if (item) select(item.dataset.id);
  });
  el.search.addEventListener("input", () => { renderFilters(); renderList(); });
  el.unreadToggle.addEventListener("click", () => {
    st.read = st.read === "unread" ? "all" : "unread";
    renderFilters();
    renderList();
  });
  el.all.addEventListener("click", () => {
    el.search.value = "";
    st.staff = "all";
    st.read = "all";
    renderFilters();
    renderList();
  });
  el.back.addEventListener("click", () => el.shell.classList.remove("is-thread-open"));
  el.clear.addEventListener("click", () => {
    el.search.value = "";
    st.staff = "all";
    st.read = "all";
    renderFilters();
    renderList();
  });
  [el.staffMenu, el.readMenu].forEach((menu) => menu.addEventListener("click", (event) => {
    const option = event.target.closest(".custom-dropdown-item");
    if (!option) return;
    event.preventDefault();
    st[menu.dataset.miFilter] = option.dataset.value;
    const toggle = menu.parentElement.querySelector('[data-bs-toggle="dropdown"]');
    if (toggle && window.bootstrap) bootstrap.Dropdown.getOrCreateInstance(toggle).hide();
    renderFilters();
    renderList();
  }));
  el.open.addEventListener("click", () => {
    const t = current();
    if (!t) return;
    if (st.tab === "support") goTo("manager-admin-ticket.html", "crmPendingTicketRef", t.ref);
    else goTo("manager-admin-inquiries.html", "crmPendingInquiryRef", t.ref);
  });

  applyRole(null);
  loadAll(false);
  // keep it fresh: new customer / staff messages appear without a refresh
  const timer = setInterval(() => {
    if (document.getElementById("managerInboxPage") !== root) return clearInterval(timer);
    if (document.hidden) return;
    loadAll(true);
    if (st.id) select(st.id, true);
  }, 15000);
}

// ---- Sales Staff: Inbox (sales inbox page, "Customer Conversation Inbox") ----
// Backend: sales-inbox-api.php (list_conversations, messages, send_message).
// This finds the page's parts by their visible text/placeholder, so it does not depend on element ids.
function crmFindSalesInbox() {
  const leaf = (re) => Array.from(document.querySelectorAll("body *")).find((n) =>
    n.children.length === 0 && re.test((n.textContent || "").replace(/\s+/g, " ").trim()));
  const search = document.querySelector('input[placeholder*="inquiry ID" i]');
  if (!search) return null;
  const state = leaf(/^loading conversations|^no (inquiry )?conversations/i);
  const empty = leaf(/^select a conversation to view its messages/i);
  if (!state || !empty) return null;
  return { search, state, empty };
}

function crmInitSalesInbox(parts) {
  if (!parts || parts.state.dataset.sbxReady === "true") return;
  parts.state.dataset.sbxReady = "true";
  const api = "sales-inbox-api.php";
  const state = parts.state, search = parts.search;

  // find the two panes + shell, and give them the same classes the Customer Service inbox uses,
  // so the Sales inbox looks and behaves exactly like it (CSS is in all-pages.css: .csi-*)
  const emptyBox = parts.empty.parentElement;
  let shell = state.closest(".csi-shell");
  if (!shell) { let n = state; while (n && !n.contains(emptyBox)) n = n.parentElement; shell = n; }
  const paneOf = (node) => { let n = node; while (n && n.parentElement !== shell) n = n.parentElement; return n; };
  const leftPane = shell ? paneOf(state) : null, rightPane = shell ? paneOf(emptyBox) : null;
  const noResults = (leftPane || shell || document).querySelector("#csiNoResults");
  if (shell && !shell.closest(".csi-page")) shell.classList.add("csi-page");
  if (shell && !shell.classList.contains("csi-shell")) shell.classList.add("csi-shell");
  if (leftPane && !leftPane.classList.contains("csi-list-pane")) leftPane.classList.add("csi-list-pane");
  if (rightPane && !rightPane.classList.contains("csi-thread")) rightPane.classList.add("csi-thread");

  if (!document.getElementById("sbxStyle")) {
    const css = document.createElement("style");
    css.id = "sbxStyle";
    css.textContent = "" +
      ".sbx-mark-link{display:block;margin:4px 2px 0;padding:0;border:0;background:none;color:inherit;opacity:.65;font-size:12px;text-decoration:underline;cursor:pointer}" +
      ".sbx-mark-link:hover{opacity:1}" +
      ".sbx-fields{display:grid;grid-template-columns:repeat(auto-fit,minmax(120px,1fr));gap:10px;margin:8px 0}" +
      ".sbx-fields label{display:flex;flex-direction:column;gap:4px;font-size:12px;opacity:.95}" +
      ".sbx-fields input,.sbx-fields select{width:100%;padding:6px 8px;border-radius:8px;border:1px solid rgba(127,127,127,.45);background:transparent;color:inherit;font:inherit;font-size:14px;font-weight:600}" +
      ".sbx-fields select option{color:#111}" +
      /* same sizes as the Customer Service inbox header */
      ".sbx-body .iq-customer{font-size:17px !important;font-weight:600 !important;line-height:1.25 !important;margin:0 0 2px !important}" +
      ".sbx-body .csi-subject{font-size:15px !important;font-weight:400 !important;line-height:1.3 !important}" +
      "@media (max-width:991.98px){.sbx-body .iq-customer{font-size:15px !important}.sbx-body .csi-subject{font-size:13px !important}}";
    document.head.appendChild(css);
  }

  // "3 Unread" pill in the list header (same as the CS inbox)
  const ownText = (n) => Array.from(n.childNodes).filter((c) => c.nodeType === 3).map((c) => c.textContent).join("").trim();
  const titleEl = Array.from((leftPane || document).querySelectorAll("*")).find((n) => /^conversations$/i.test(ownText(n)));
  const unreadPill = document.createElement("span");
  unreadPill.className = "stage-pill stage-won";
  unreadPill.style.marginLeft = "auto";
  unreadPill.hidden = true;
  if (titleEl) {
    const row = titleEl.closest(".csi-list-title") || titleEl.parentElement;
    if (!row.classList.contains("csi-list-title")) {
      row.style.display = "flex"; row.style.alignItems = "center"; row.style.justifyContent = "space-between"; row.style.gap = "12px";
    }
    row.appendChild(unreadPill);
  } else {
    state.insertAdjacentElement("beforebegin", unreadPill);
  }

  const list = document.createElement("div");
  list.className = "csi-list";
  state.classList.add("iq-state");
  state.insertAdjacentElement("afterend", list);

  const thread = document.createElement("div");
  thread.className = "csi-thread-body sbx-body";
  thread.hidden = true;
  thread.innerHTML =
    '<div class="csi-thread-head">' +
      '<button type="button" class="iq-back csi-back"><i class="bi bi-arrow-left"></i> Conversations</button>' +
      '<span class="iq-avatar" data-r="avatar" aria-hidden="true"></span>' +
      '<div class="iq-head-main"><div class="iq-customer"><span data-r="name"></span><span class="csi-ref" data-r="ref"></span></div>' +
      '<span class="csi-subject" data-r="subject"></span></div>' +
      '<div class="csi-head-actions"><span class="stage-pill stage-new" data-r="status"></span></div>' +
    "</div>" +
    '<div class="csi-feed" data-r="feed"></div>' +
    '<form class="csi-composer"><input type="file" name="attachments[]" multiple hidden data-r="files">' +
      '<button type="button" class="csi-icon-btn" data-r="attach" title="Attach file" aria-label="Attach file"><i class="bi bi-paperclip"></i></button>' +
      '<div class="csi-composer-copy"><span class="csi-file-label" data-r="fileLabel"></span>' +
      '<textarea name="message" rows="1" data-r="text" placeholder="Type your response to the customer..."></textarea></div>' +
      '<button type="submit" class="csi-icon-btn" data-r="send" title="Send" aria-label="Send"><i class="bi bi-send-fill"></i></button>' +
    "</form>";
  emptyBox.insertAdjacentElement("afterend", thread);
  const el = { form: thread.querySelector("form"), back: thread.querySelector(".csi-back") };
  thread.querySelectorAll("[data-r]").forEach((n) => { el[n.dataset.r] = n; });
  const composerPlaceholder = el.text.getAttribute("placeholder");
  const st = { items: [], id: "", signature: "", open: false };

  // phone / tablet: one pane at a time (list, or the conversation with a back button)
  const mobile = window.matchMedia("(max-width: 991.98px)");
  function showThreadPane(open) {
    if (!shell || !leftPane || !rightPane || leftPane === rightPane) return;
    if (open && mobile.matches) {
      shell.classList.add("is-thread-open");
      leftPane.style.setProperty("display", "none", "important");
      rightPane.style.setProperty("display", "flex", "important");
    } else {
      shell.classList.remove("is-thread-open");
      leftPane.style.removeProperty("display");
      rightPane.style.removeProperty("display");
    }
  }
  if (mobile.addEventListener) mobile.addEventListener("change", () => showThreadPane(st.open));

  async function call(action, options, params) {
    const url = new URL(api, window.location.href);
    url.searchParams.set("action", action);
    Object.keys(params || {}).forEach((k) => url.searchParams.set(k, params[k]));
    const response = await fetch(url.toString(), Object.assign({ credentials: "same-origin", cache: "no-store" }, options || {}));
    const raw = await response.text();
    let data;
    try { data = raw ? JSON.parse(raw) : {}; }
    catch (e) { console.error("sales-inbox-api.php returned:", raw); throw new Error("sales-inbox-api.php did not return JSON (HTTP " + response.status + "). Check the file path / PHP error."); }
    if (!response.ok || data.success === false) throw new Error(data.message || "Request failed (HTTP " + response.status + ").");
    return data;
  }

  const toDate = (v) => new Date(String(v || "").trim().replace(" ", "T"));
  function listTime(v) {
    const d = toDate(v);
    if (isNaN(d.getTime())) return "";
    return d.toDateString() === new Date().toDateString()
      ? d.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" })
      : d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
  }
  function messageTime(v) {
    const d = toDate(v);
    if (isNaN(d.getTime())) return "";
    return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }) + " - " +
      d.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" });
  }
  const fileSize = (bytes) => {
    const n = Number(bytes);
    if (!n) return "";
    return n >= 1048576 ? (n / 1048576).toFixed(1) + " MB" : Math.max(1, Math.round(n / 1024)) + " KB";
  };
  const isClosed = (c) => /closed|resolved|cancel/i.test(String(c && c.status));
  const statusClass = (s) => /closed|cancel|resolved/i.test(s) ? "stage-new" : /active|open|confirmed/i.test(s) ? "stage-won" : "stage-qualified";
  const current = () => st.items.find((c) => String(c.id) === st.id) || null;

  function renderList() {
    const term = search.value.trim().toLowerCase();
    const rows = st.items.filter((c) => !term || [c.customer_name, c.reference, c.subject].join(" ").toLowerCase().includes(term));
    const unread = st.items.filter((c) => Number(c.unread) > 0).length;
    unreadPill.hidden = unread === 0;
    unreadPill.textContent = unread + " Unread";

    list.innerHTML = rows.map((c) =>
      '<button type="button" class="csi-item" data-id="' + crmEscape(c.id) + '"' + (String(c.id) === st.id ? ' aria-current="true"' : "") + ">" +
        '<span class="csi-item-top">' +
          crmAvatarHTML(crmTicketInitials(c.customer_name), c.customer_photo, "csi-item-avatar") +
          '<span class="csi-item-name">' + crmEscape(c.customer_name) + "</span>" +
          '<span class="csi-item-time">' + crmEscape(listTime(c.last_message_at)) + "</span>" +
        "</span>" +
        '<span class="csi-item-meta"><span class="csi-ref">' + crmEscape(c.reference) + "</span>" +
          (Number(c.unread) > 0 ? '<span class="csi-dot" aria-label="Unread"></span>' : "") + "</span>" +
        '<span class="csi-item-preview">' + crmEscape(c.last_message || c.subject) + "</span>" +
      "</button>").join("");

    // Search found nothing: show the shared "No results found" box (#csiNoResults), same as the other inboxes.
    // The small text line is only for loading / "no conversations yet" / errors.
    const noMatch = st.items.length > 0 && rows.length === 0;
    if (noResults) {
      noResults.hidden = !noMatch;
      state.hidden = st.items.length > 0;
      if (!st.items.length && !state.dataset.error) state.textContent = "No inquiry conversations yet.";
    } else {
      state.hidden = rows.length > 0;
      if (!rows.length && !state.dataset.error) state.textContent = st.items.length ? "No matching conversations." : "No inquiry conversations yet.";
    }
  }

  function renderHeader(c) {
    crmSetAvatar(el.avatar, crmTicketInitials(c.customer_name), c.customer_photo);
    el.name.textContent = c.customer_name;
    el.ref.textContent = c.reference;
    el.subject.textContent = c.subject;
    el.status.textContent = c.status;
    el.status.className = "stage-pill " + statusClass(c.status);
    const locked = isClosed(c);
    el.text.disabled = el.attach.disabled = el.send.disabled = locked;
    el.text.placeholder = locked ? "This conversation is closed. Replies are turned off." : composerPlaceholder;
  }

  /* ---------- Attachments ----------
   * Payments now go through PayMongo (xendit-api.php) and the booking is created automatically,
   * so chat images are shown as plain inline images. No receipt card, no confirm button. */
  const isImg = (f) => /^image\//i.test(String(f.mime_type || "")) || /\.(jpe?g|png|gif|webp)$/i.test(String(f.name || f.url || ""));
  const peso = (n) => "\u20B1" + Number(n || 0).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  function imageHTML(f, when) {
    return '<a class="sbx-img" href="' + crmEscape(f.url) + '" target="_blank" rel="noopener noreferrer">' +
      '<img src="' + crmEscape(f.url) + '" alt="' + crmEscape(f.name || "Image") + '" loading="lazy"></a>';
  }
  function attachmentHTML(f, when) {
    if (isImg(f)) return '<div class="sbx-att">' + imageHTML(f, when) + "</div>";
    return '<div class="csi-file"><span class="tk-icon" aria-hidden="true"><i class="bi bi-paperclip"></i></span>' +
      '<div class="csi-file-main"><span class="csi-file-name">' + crmEscape(f.name || "Attachment") + "</span>" +
      (fileSize(f.size) ? '<span class="csi-file-size">File size: ' + crmEscape(fileSize(f.size)) + "</span>" : "") + "</div>" +
      '<a class="btn csi-outline-btn csi-download" href="' + crmEscape(f.url) + '" download target="_blank" rel="noopener noreferrer">Download</a></div>';
  }

  function renderMessages(messages) {
    const sig = messages.map((m) => m.id).join(",");
    if (sig === st.signature) return;
    st.signature = sig;
    if (!messages.length) { el.feed.innerHTML = '<p class="iq-state">No messages in this conversation yet.</p>'; return; }
    el.feed.innerHTML = messages.map((m) => {
      const when = messageTime(m.created_at);
      const files = (Array.isArray(m.attachments) ? m.attachments : []).filter((f) => f && f.url).map((f) => attachmentHTML(f, when)).join("");
      return '<article class="csi-msg' + (m.is_mine ? " is-mine" : "") + '">' +
        (m.message ? '<div class="csi-bubble"><p>' + crmRichText(m.message) + "</p></div>" : "") + files +
        '<div class="csi-msg-meta">' + crmEscape([when, m.sender_name].filter(Boolean).join(" \u00B7 ")) + "</div></article>";
    }).join("");
    const toBottom = () => { el.feed.scrollTop = el.feed.scrollHeight; };
    toBottom();
    requestAnimationFrame(toBottom);
  }

  async function select(id, quiet) {
    st.id = String(id);
    if (!quiet) { st.signature = ""; st.open = true; showThreadPane(true); }
    emptyBox.hidden = true;
    thread.hidden = false;
    const known = current();
    if (known) renderHeader(known);
    if (!quiet) el.feed.innerHTML = '<p class="iq-state">Loading messages...</p>';
    try {
      const data = await call("messages", null, { conversation_id: st.id });
      if (String(st.id) !== String(id)) return;
      const i = st.items.findIndex((c) => String(c.id) === String(id));
      if (i >= 0) st.items[i] = data.conversation; else st.items.unshift(data.conversation);
      renderHeader(data.conversation);
      renderMessages(Array.isArray(data.messages) ? data.messages : []);
      renderList();
    } catch (e) {
      if (!quiet) el.feed.innerHTML = '<p class="iq-state">' + crmEscape(e.message) + "</p>";
    }
  }

  async function loadList(quiet) {
    try {
      const data = await call("list_conversations");
      st.items = Array.isArray(data.conversations) ? data.conversations : [];
      delete state.dataset.error;
      renderList();
      // Coming from My Inquiries > Open Chat: open that inquiry's conversation.
      if (window.crmPendingChatRef) {
        const want = String(window.crmPendingChatRef).toLowerCase();
        window.crmPendingChatRef = "";
        const hit = st.items.find((c) => String(c.reference || "").toLowerCase() === want);
        if (hit) select(hit.id);
      }
    } catch (e) {
      console.error("Sales inbox:", e);
      if (quiet) return;
      state.dataset.error = "1";
      state.hidden = false;
      state.textContent = e.message;
    }
  }

  list.addEventListener("click", (ev) => { const b = ev.target.closest(".csi-item"); if (b) select(b.dataset.id); });
  search.addEventListener("input", renderList);
  el.back.addEventListener("click", () => { st.open = false; showThreadPane(false); });
  // the response box grows with the text up to the CSS max-height, then scrolls inside
  const autoGrow = () => {
    const box = el.text;
    box.style.height = "auto";
    const style = window.getComputedStyle(box);
    const max = parseFloat(style.maxHeight) || 140;
    const min = parseFloat(style.minHeight) || 40;
    const wanted = box.scrollHeight + (box.offsetHeight - box.clientHeight);
    box.style.height = Math.max(min, Math.min(wanted, max)) + "px";
    box.style.overflowY = wanted > max ? "auto" : "hidden";
  };
  el.text.addEventListener("input", autoGrow);
  el.attach.addEventListener("click", () => el.files.click());
  el.files.addEventListener("change", () => {
    el.fileLabel.textContent = Array.from(el.files.files || []).map((f) => f.name).join(", ");
  });
  el.text.addEventListener("keydown", (ev) => {
    if (ev.key === "Enter" && !ev.shiftKey) { ev.preventDefault(); el.form.requestSubmit(); }
  });
  el.form.addEventListener("submit", async (ev) => {
    ev.preventDefault();
    if (!st.id || el.send.disabled) return;
    if (!el.text.value.trim() && !el.files.files.length) return;
    el.send.disabled = true;
    try {
      const body = new FormData(el.form);
      body.set("conversation_id", st.id);
      await call("send_message", { method: "POST", body });
      el.form.reset();
      autoGrow();
      el.fileLabel.textContent = "";
      st.signature = "";
      await select(st.id, true);
    } catch (e) {
      el.fileLabel.textContent = e.message;
    } finally {
      const c = current();
      el.send.disabled = !!(c && isClosed(c));
    }
  });

  loadList();
  const timer = setInterval(() => {
    if (!document.body.contains(thread)) return clearInterval(timer);
    if (document.hidden) return;
    loadList(true);
    if (st.id) select(st.id, true);
  }, 15000);
}

// Calendar page (admin-manager-sales-calendar.html): ONE page for Admin, Manager and Sales Staff.

// The Month / Week / Day / Agenda views are drawn here from the backend list.

// Backend contract: GET calendar-api.php?action=list ->

//   { success: true, events: [ { booking_ref, event_title, customer_name, event_date (YYYY-MM-DD),

//     event_time ("08:00" or "8:00 AM"), expected_guests, arrangement, location, assigned_staff } ] }

// "arrangement" containing pickup / deliver is drawn amber / green; anything else is On-site (indigo).

// A day with 3 or more events shows "Potential Conflict" (or send  conflict: true  on an event).

// You can also call window.crmRenderCalendar(list) yourself.

const CRM_CAL_ARRANGEMENTS = {

  pickup: { label: "Customer Pickup", icon: "bi-bag" },

  delivery: { label: "Food Delivery", icon: "bi-truck" },

  onsite: { label: "On-site Catering", icon: "bi-people" },

};

const CRM_CAL_CONFLICT_AT = 3; // events in one day that count as a "Potential Conflict"

const CRM_CAL_MONTH_LIMIT = 2; // events shown in a month cell before "+ N more event"

const CRM_CAL_DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];



function crmCalIso(d) {

  return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0");

}



function crmCalParseIso(iso) {

  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(iso || ""));

  return m ? new Date(+m[1], +m[2] - 1, +m[3]) : null;

}



function crmCalMinutes(raw) {

  const m = /^\s*(\d{1,2})(?::(\d{2}))?(?::\d{2})?\s*([ap]m)?\s*$/i.exec(String(raw || ""));

  if (!m) return null;

  let h = +m[1];

  const min = +(m[2] || 0);

  const ap = (m[3] || "").toLowerCase();

  if (ap === "pm" && h < 12) h += 12;

  if (ap === "am" && h === 12) h = 0;

  return h > 23 || min > 59 ? null : h * 60 + min;

}



function crmCalTimeLabel(minutes) {

  if (minutes === null) return "ALL DAY";

  const h = Math.floor(minutes / 60);

  const ap = h >= 12 ? "PM" : "AM";

  const h12 = h % 12 === 0 ? 12 : h % 12;

  return String(h12).padStart(2, "0") + ":" + String(minutes % 60).padStart(2, "0") + " " + ap;

}



function crmCalArrangementKey(text) {

  const t = String(text || "").toLowerCase();

  if (t.indexOf("pickup") !== -1 || t.indexOf("pick-up") !== -1 || t.indexOf("pick up") !== -1) return "pickup";

  if (t.indexOf("deliver") !== -1) return "delivery";

  return "onsite";

}



function crmCalEvent(record) {

  const pick = (keys) => crmInquiryPick(record, keys);

  const iso = (pick(["event_date", "date"]).match(/^\d{4}-\d{2}-\d{2}/) || [""])[0];

  const minutes = crmCalMinutes(pick(["event_time", "time", "start_time"]));

  const arrangementText = pick(["arrangement", "service_type", "service"]);

  return {

    iso,

    minutes,

    time: crmCalTimeLabel(minutes),

    title: pick(["event_title", "event_name", "title"]) || "Event",

    customer: pick(["customer_name", "customer", "client_name"]),

    hasPax: crmArrangementHasPax(arrangementText),
    guests: crmArrangementHasPax(arrangementText) ? pick(["expected_guests", "guests", "pax"]).replace(/\s*(pax|guests?)$/i, "") : "",

    arrangement: arrangementText,
    locationLabel: /pick-?up/i.test(arrangementText) ? "Pickup Location" : (/deliver/i.test(arrangementText) ? "Delivery Address" : "Event Venue / Address"),

    key: crmCalArrangementKey(arrangementText),

    location: pick(["location", "venue", "venue_address", "address"]),

    staff: pick(["assigned_staff", "assigned_to", "staff_name"]),
    staffPhoto: pick(["staff_photo", "assigned_staff_photo"]),
    customerPhoto: pick(["customer_photo", "photo_url"]),
    paid: pick(["amount_paid", "paid_amount"]),
    balance: pick(["remaining_balance", "balance"]),

    ref: pick(["booking_ref", "booking_code", "reference", "booking_id", "id"]),

    endMinutes: crmCalMinutes(pick(["event_end_time", "end_time"])),

    status: pick(["status", "booking_status"]),

    phone: pick(["customer_phone", "phone", "contact_number", "phone_number"]),

    email: pick(["customer_email", "email", "email_address"]),

    payment: pick(["payment_status", "payment"]),

    total: pick(["quotation_amount", "total_quote", "total_amount", "total", "amount"]),
    conflict: record && (record.conflict === true || record.conflict === 1 || record.conflict === "1"),

  };

}



function crmCalChipHTML(ev, index, full) {

  const arr = CRM_CAL_ARRANGEMENTS[ev.key];

  return (

    '<button type="button" class="cal-event is-' + ev.key + (full ? " is-full" : "") + '" data-cal-i="' + index + '"' +

    ' title="' + crmEscape(ev.title + " - " + arr.label) + '">' +

      '<span class="cal-event-row"><span class="cal-event-time">' + crmEscape(ev.time) + "</span>" +

      (ev.guests ? '<span class="cal-event-pax">' + crmEscape(ev.guests) + " PAX</span>" : "") + "</span>" +

      '<span class="cal-event-title">' + crmEscape(ev.title) + "</span>" +

      (ev.customer ? '<span class="cal-event-sub">' + crmEscape(ev.customer) + "</span>" : "") +

      (full ? '<span class="cal-arr-pill is-' + ev.key + '"><i class="bi ' + arr.icon + '" aria-hidden="true"></i>' + crmEscape(arr.label) + "</span>" : "") +

    "</button>"

  );

}



// Time text for the event windows: "11:00 AM - 01:00 PM" (or just the start time / "All day").
function crmCalTimeRange(ev) {
  if (ev.minutes === null) return "All day";
  return ev.endMinutes === null ? ev.time : ev.time + " - " + crmCalTimeLabel(ev.endMinutes);
}

// Small builders shared by the Calendar and Bookings detail screens (same markup as the Support Ticket view).
function crmDetailKit() {
  const dash = (v) => crmEscape(v || "—");
  return {
    dash,
    head: (title) => '<div class="tk-section-head"><h3 class="iq-section-title">' + title + "</h3></div>",
    field: (label, valueHTML, extra) =>
      "<div" + (extra ? ' class="' + extra + '"' : "") + '><span class="iq-label is-caps">' + label + "</span>" + valueHTML + "</div>",
    value: (v) => '<span class="iq-value">' + dash(v) + "</span>",
    tile: (label, html, extra) =>
      '<div class="tk-date-tile' + (extra ? " " + extra : "") + '"><span class="iq-label is-caps">' + label + '</span><span class="iq-value">' + html + "</span></div>",
    person: (name, photo, fallback) =>
      '<span class="av-cust">' + crmAvatarHTML(crmSdInitials(name || "?"), photo) + "<span>" + crmEscape(name || fallback || "—") + "</span></span>",
  };
}

// Customer feedback (rating + comments + photos) inside the staff booking details (Calendar and Bookings pages,
// Admin / Manager / Sales Staff). Data comes from record.feedback = { rating, comments, images: [{url, name}], created_at }
// (saved by customer-bookings-api.php -> booking_feedback). null / rating 0 = the customer has not rated yet.
const CRM_RATING_LABELS = ["", "Poor", "Fair", "Good", "Very good", "Excellent"];
function crmBookingFeedbackHTML(feedback) {
  const { head, field, value } = crmDetailKit();
  const rating = Math.max(0, Math.min(5, Math.round(Number(feedback && feedback.rating) || 0)));
  if (!rating) {
    return '<section class="card iq-detail-card">' + head("Customer Feedback") +
      '<p class="tk-log-empty">The customer has not left feedback for this booking yet.</p></section>';
  }
  const stars = [1, 2, 3, 4, 5].map((n) => '<i class="bi ' + (n <= rating ? "bi-star-fill" : "bi-star") + '" aria-hidden="true"></i>').join("");
  const photos = (Array.isArray(feedback.images) ? feedback.images : []).filter((i) => i && i.url).map((i) =>
    '<a href="' + crmEscape(i.url) + '" target="_blank" rel="noopener"><img src="' + crmEscape(i.url) + '" alt="' + crmEscape(i.name || "Customer photo") + '" loading="lazy"></a>').join("");
  return '<section class="card iq-detail-card">' + head("Customer Feedback") +
    '<div class="tk-contact-grid">' +
      field("Overall Rating", '<span class="iq-value"><span class="fb-stars" role="img" aria-label="' + rating + ' out of 5">' + stars + "</span> " + rating + " of 5 \u00B7 " + CRM_RATING_LABELS[rating] + "</span>") +
      field("Submitted", value(crmAvDateTime(feedback.created_at || ""))) +
      field("Comments", value(String(feedback.comments || "").trim() || "No comments."), "tk-span-all") +
    "</div>" +
    (photos ? '<div class="fb-photos">' + photos + "</div>" : "") +
  "</section>";
}

// Booking details screen (opened from the calendar's event window). Same layout as the Support Ticket view:
// full-width stacked cards (.card.iq-detail-card) with a lined green title (.tk-section-head). Read-only.
function crmCalBookingHTML(ev) {
  const arr = CRM_CAL_ARRANGEMENTS[ev.key];
  const { dash, head, field, value, tile, person } = crmDetailKit();
  const d = crmCalParseIso(ev.iso);
  const status = ev.status ? '<span class="stage-pill ' + crmBookingStatusClass(ev.status) + '">' + crmEscape(ev.status) + "</span>" : "";
  return (
    '<button type="button" class="iq-back" data-cal-back><i class="bi bi-arrow-left" aria-hidden="true"></i>Back to Calendar</button>' +
    '<div class="iq-detail-head"><div class="iq-detail-ref">' + dash(ev.ref) + "</div>" + status + "</div>" +
    '<div class="iq-detail-col">' +
      '<section class="card iq-detail-card">' + head("Event Details") +
        '<div class="tk-contact-grid">' +
          field("Event Name", value(ev.title)) +
          field("Event Date", value(d ? ev.iso : "")) +
          field("Event Time", value(crmCalTimeRange(ev))) +
          (ev.hasPax ? field("Guest Count (PAX)", value(ev.guests ? ev.guests + " Guests" : "")) : "") +
          field("Catering Arrangement", '<span class="cal-arr-pill is-' + ev.key + '"><i class="bi ' + arr.icon + '" aria-hidden="true"></i>' + crmEscape(ev.arrangement || arr.label) + "</span>") +
          field("Assigned Staff", '<span class="iq-value">' + person(ev.staff, ev.staffPhoto, "Unassigned") + "</span>") +
          field(ev.locationLabel, value(ev.location), ev.hasPax ? "tk-span-all" : "") +
        "</div>" +
      "</section>" +
      '<section class="card iq-detail-card">' + head("Customer Information") +
        '<div class="tk-contact-grid">' +
          field("Customer Name", '<span class="iq-value">' + person(ev.customer, ev.customerPhoto) + "</span>") +
          field("Email Address", value(ev.email)) +
          field("Phone Number", value(ev.phone)) +
        "</div>" +
      "</section>" +
      '<section class="card iq-detail-card">' + head("Payment &amp; Quotation") +
        '<div class="iq-spec-grid tk-cols-4">' +
          tile("Payment Status", dash(ev.payment)) +
          tile("Confirmed Quotation Amount", crmEscape(crmBookingMoney(ev.total)), "is-activity") +
          tile("Amount Paid", crmEscape(crmBookingMoney(ev.paid || 0))) +
          tile("Remaining Balance", crmEscape(crmBookingMoney(ev.balance || 0)), (crmBookingNumber(ev.balance) || 0) > 0 ? "is-due" : "is-activity") +
        "</div>" +
      "</section>" +
      '<div class="tk-notice"><i class="bi bi-eye-fill" aria-hidden="true"></i><span>This is a read-only administrative summary of booking reference <strong>' + dash(ev.ref) + "</strong>. Kitchen operations, chef notes, and inventory checklists are managed separately.</span></div>" +
    "</div>"
  );
}


function crmInitCalendar(root) {

  const body = root.querySelector("#calBody");

  const state = root.querySelector("#calState");

  const label = root.querySelector("#calLabel");

  const modalEl = root.querySelector("#calEventModal");

  if (!body || !label) return;



  let events = []; // sorted

  let byDate = {}; // iso -> [index, ...]

  let view = "month";

  const today = new Date();

  const todayIso = crmCalIso(today);

  let cursor = new Date(today.getFullYear(), today.getMonth(), today.getDate());



  const monthName = (d) => d.toLocaleDateString("en-US", { month: "long", year: "numeric" });

  const longDate = (d) => d.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric", year: "numeric" });

  const mondayOf = (d) => new Date(d.getFullYear(), d.getMonth(), d.getDate() - ((d.getDay() + 6) % 7));

  const addDays = (d, n) => new Date(d.getFullYear(), d.getMonth(), d.getDate() + n);

  const eventsOn = (iso) => byDate[iso] || [];

  const isConflict = (iso) => {

    const list = eventsOn(iso);

    return list.length >= CRM_CAL_CONFLICT_AT || list.some((i) => events[i].conflict);

  };

  const conflictBadge = (iso) =>

    isConflict(iso)

      ? '<span class="cal-conflict"><i class="bi bi-exclamation-triangle" aria-hidden="true"></i>Potential Conflict</span>'

      : "";



  function dayHead(d, iso, outside) {

    return (

      '<div class="cal-cell-head">' +

        '<button type="button" class="cal-daynum' + (iso === todayIso ? " is-today" : "") + (outside ? " is-outside" : "") + '" data-cal-day="' + iso + '" aria-label="Open ' + crmEscape(longDate(d)) + '">' + d.getDate() + "</button>" +

        conflictBadge(iso) +

      "</div>"

    );

  }



  function monthHTML() {

    const first = new Date(cursor.getFullYear(), cursor.getMonth(), 1);

    const start = mondayOf(first);

    const last = new Date(cursor.getFullYear(), cursor.getMonth() + 1, 0);

    const weeks = Math.round((mondayOf(last) - start) / 86400000 / 7) + 1;

    let html = '<div class="cal-grid"><div class="cal-weekdays">' +

      CRM_CAL_DAYS.map((n, i) => '<div class="cal-weekday' + (i > 4 ? " is-weekend" : "") + '">' + n + "</div>").join("") + "</div>";

    for (let w = 0; w < weeks; w++) {

      html += '<div class="cal-week">';

      for (let i = 0; i < 7; i++) {

        const d = addDays(start, w * 7 + i);

        const iso = crmCalIso(d);

        const outside = d.getMonth() !== cursor.getMonth();

        const list = eventsOn(iso);

        const shown = list.slice(0, CRM_CAL_MONTH_LIMIT);

        const more = list.length - shown.length;

        html += '<div class="cal-cell' + (outside ? " is-outside" : "") + (iso === todayIso ? " is-today" : "") + '" data-date="' + iso + '">' +

          dayHead(d, iso, outside) +

          '<div class="cal-cell-events">' + shown.map((i) => crmCalChipHTML(events[i], i, false)).join("") +

          (more > 0 ? '<button type="button" class="cal-more" data-cal-day="' + iso + '">+ ' + more + " more event" + (more > 1 ? "s" : "") + "</button>" : "") +

          "</div></div>";

      }

      html += "</div>";

    }

    return html + "</div>";

  }



  function weekHTML() {

    const start = mondayOf(cursor);

    let html = '<div class="cal-weekview">';

    for (let i = 0; i < 7; i++) {

      const d = addDays(start, i);

      const iso = crmCalIso(d);

      const list = eventsOn(iso);

      html += '<section class="cal-weekcol' + (iso === todayIso ? " is-today" : "") + '">' +

        '<header class="cal-weekcol-head"><button type="button" class="cal-weekcol-day" data-cal-day="' + iso + '">' +

        '<span class="cal-weekday' + (i > 4 ? " is-weekend" : "") + '">' + CRM_CAL_DAYS[i] + '</span><span class="cal-daynum' + (iso === todayIso ? " is-today" : "") + '">' + d.getDate() + "</span></button>" +

        conflictBadge(iso) + "</header>" +

        '<div class="cal-cell-events">' + (list.length ? list.map((n) => crmCalChipHTML(events[n], n, false)).join("") : '<p class="cal-empty-small">No events</p>') + "</div></section>";

    }

    return html + "</div>";

  }



  function dayHTML() {

    const iso = crmCalIso(cursor);

    const list = eventsOn(iso);

    return '<div class="cal-dayview"><div class="cal-dayview-head"><h3>' + crmEscape(longDate(cursor)) + "</h3>" + conflictBadge(iso) + "</div>" +

      (list.length

        ? '<div class="cal-dayview-list">' + list.map((n) => crmCalChipHTML(events[n], n, true)).join("") + "</div>"

        : '<p class="cal-empty">No events scheduled for this day.</p>') + "</div>";

  }



  function agendaHTML() {

    const y = cursor.getFullYear();

    const m = cursor.getMonth();

    const days = Object.keys(byDate).filter((iso) => { const d = crmCalParseIso(iso); return d && d.getFullYear() === y && d.getMonth() === m; }).sort();

    if (!days.length) return '<div class="cal-agenda"><p class="cal-empty">No events in ' + crmEscape(monthName(cursor)) + ".</p></div>";

    return '<div class="cal-agenda">' + days.map((iso) => {

      const d = crmCalParseIso(iso);

      return '<section class="cal-agenda-day"><header><button type="button" class="cal-agenda-date' + (iso === todayIso ? " is-today" : "") + '" data-cal-day="' + iso + '">' + crmEscape(longDate(d)) + "</button>" + conflictBadge(iso) + "</header>" +

        '<div class="cal-agenda-list">' + eventsOn(iso).map((n) => crmCalChipHTML(events[n], n, true)).join("") + "</div></section>";

    }).join("") + "</div>";

  }



  function render() {

    if (view === "month") label.textContent = monthName(cursor);

    else if (view === "week") {

      const s = mondayOf(cursor);

      const e = addDays(s, 6);

      const sameMonth = s.getMonth() === e.getMonth();

      label.textContent = s.toLocaleDateString("en-US", { month: "short", day: "numeric" }) + " – " +

        (sameMonth ? e.getDate() : e.toLocaleDateString("en-US", { month: "short", day: "numeric" })) + ", " + e.getFullYear();

    } else if (view === "day") label.textContent = cursor.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });

    else label.textContent = monthName(cursor);



    body.className = "cal-body is-" + view;

    body.innerHTML = view === "month" ? monthHTML() : view === "week" ? weekHTML() : view === "day" ? dayHTML() : agendaHTML();

    root.querySelectorAll("[data-cal-view]").forEach((b) => {

      const on = b.dataset.calView === view;

      b.classList.toggle("is-active", on);

      b.setAttribute("aria-pressed", on ? "true" : "false");

    });

  }



  function setEvents(list) {

    events = (Array.isArray(list) ? list : []).map(crmCalEvent).filter((e) => e.iso);

    events.sort((a, b) => a.iso.localeCompare(b.iso) || (a.minutes === null ? -1 : a.minutes) - (b.minutes === null ? -1 : b.minutes) || a.title.localeCompare(b.title));

    byDate = {};

    events.forEach((e, i) => { (byDate[e.iso] = byDate[e.iso] || []).push(i); });

    render();

  }

  window.crmRenderCalendar = setEvents;



  function step(dir) {

    if (view === "month" || view === "agenda") cursor = new Date(cursor.getFullYear(), cursor.getMonth() + dir, 1);

    else cursor = addDays(cursor, dir * (view === "week" ? 7 : 1));

    render();

  }



  let openIndex = -1;
  const listView = root.querySelector("#calListView");
  const bookingView = root.querySelector("#calBookingView");
  const toTop = () => { const b = document.querySelector(".content-body"); if (b) b.scrollTop = 0; };

  // View Booking Details: close the event window, show the booking page in place of the calendar.
  function showBooking() {
    const ev = events[openIndex];
    if (!ev || !bookingView || !listView) return;
    if (window.bootstrap && modalEl) bootstrap.Modal.getOrCreateInstance(modalEl).hide();
    document.dispatchEvent(new CustomEvent("crm:view-booking", { detail: { ref: ev.ref } }));
    bookingView.innerHTML = crmCalBookingHTML(ev);
    listView.hidden = true;
    bookingView.hidden = false;
    toTop();
  }

  // Back to Calendar: same month / view / day as before.
  function showCalendar() {
    if (!bookingView || !listView) return;
    bookingView.hidden = true;
    bookingView.innerHTML = "";
    listView.hidden = false;
    toTop();
  }

  function openEvent(i) {

    const ev = events[i];

    if (!ev || !modalEl) return;

    const arr = CRM_CAL_ARRANGEMENTS[ev.key];

    const set = (id, text) => { const el = root.querySelector(id); if (el) el.textContent = text || "—"; };

    set("#calDetailRef", ev.ref);

    set("#calDetailTitle", ev.title);

    set("#calDetailCustomer", ev.customer);
    crmSetAvatar(root.querySelector("#calDetailCustomerAvatar"), crmSdInitials(ev.customer || "?"), ev.customerPhoto);
    set("#calDetailStaff", ev.staff || "Unassigned");
    crmSetAvatar(root.querySelector("#calDetailStaffAvatar"), crmSdInitials(ev.staff || "?"), ev.staffPhoto);

    set("#calDetailDate", ev.iso);

    set("#calDetailTime", crmCalTimeRange(ev));

    set("#calDetailGuests", ev.guests ? ev.guests + " Guests" : "");

    const statusEl = root.querySelector("#calDetailStatus");
    if (statusEl) {
      statusEl.hidden = !ev.status;
      statusEl.className = "stage-pill " + crmBookingStatusClass(ev.status) + " cal-pop-status";
      statusEl.innerHTML = '<i class="bi bi-check-circle" aria-hidden="true"></i>' + crmEscape(ev.status);
    }

    openIndex = i;

    set("#calDetailLocation", ev.location);
    set("#calDetailLocationLabel", ev.locationLabel);

    const pill = root.querySelector("#calDetailArrangement");

    if (pill) {

      pill.className = "cal-arr-pill is-" + ev.key;

      pill.innerHTML = '<i class="bi ' + arr.icon + '" aria-hidden="true"></i>' + crmEscape(ev.arrangement || arr.label);

    }

    if (window.bootstrap) bootstrap.Modal.getOrCreateInstance(modalEl).show();

  }



  root.onclick = (event) => {

    const t = event.target;

    if (t.closest("#calViewBooking")) return showBooking();

    if (t.closest("[data-cal-back]")) return showCalendar();

    const viewBtn = t.closest("[data-cal-view]");

    if (viewBtn) { view = viewBtn.dataset.calView; render(); return; }

    if (t.closest("#calPrev")) return step(-1);

    if (t.closest("#calNext")) return step(1);

    if (t.closest("#calToday")) { cursor = new Date(today.getFullYear(), today.getMonth(), today.getDate()); render(); return; }

    const chip = t.closest("[data-cal-i]");

    if (chip) return openEvent(Number(chip.dataset.calI));

    const dayBtn = t.closest("[data-cal-day]");

    if (dayBtn) {

      const d = crmCalParseIso(dayBtn.dataset.calDay);

      if (d) { cursor = d; view = "day"; render(); }

    }

  };



  // Load the events automatically.

  render();

  const url = root.dataset.api;

  if (!url) { if (state) state.hidden = true; return; }

  if (state) { state.hidden = false; state.textContent = "Loading calendar..."; }

  fetch(url, { method: "GET", credentials: "same-origin", headers: { Accept: "application/json" }, cache: "no-store" })

    .then((response) => response.json().then((data) => ({ response, data })))

    .then(({ response, data }) => {

      if (document.getElementById("calendarPage") !== root) return;

      const list = data && (Array.isArray(data.events) ? data.events : Array.isArray(data.bookings) ? data.bookings : null);

      if (!response.ok || !list) throw new Error((data && data.message) || "Unable to load the calendar.");

      if (state) state.hidden = true;
      setEvents(list);
      let pending = "";
      try { pending = sessionStorage.getItem("crmOpenBooking") || ""; sessionStorage.removeItem("crmOpenBooking"); } catch (e) {}
      if (pending) {
        const at = events.findIndex((ev) => String(ev.ref) === pending);
        if (at >= 0) { openIndex = at; showBooking(); }
      }

    })

    .catch((error) => {

      console.warn("Calendar could not be loaded:", error);

      if (document.getElementById("calendarPage") !== root) return;

      if (state) { state.hidden = false; state.textContent = "Unable to load the calendar."; }

    });

}



window.loadCrmPageData = function () {
  const roleDashboard = document.querySelector("[data-crm-dashboard]");
  const dashActivities = document.getElementById("upcomingActivitiesTable");
  const dashCustomers = document.getElementById("recentCustomersTable");
  const ticketsTable = document.getElementById("ticketsTable");
  const ticketsPage = document.getElementById("ticketsPage");
  const csInboxPage = document.getElementById("csInboxPage");
  const managerInboxPage = document.getElementById("managerInboxPage");
  const salesInboxParts = (csInboxPage || managerInboxPage) ? null : crmFindSalesInbox();
  const reportsPage = document.getElementById("reportsPage");
  const menuManagementPage = document.getElementById("menuManagementPage");
  const managerInquiriesPage = document.getElementById("managerInquiriesPage");
  const salesAvailablePage = document.getElementById("salesAvailablePage");
  const managerBookingsPage = document.getElementById("managerBookingsPage");
  const calendarPage = document.getElementById("calendarPage");
  const customersPage = document.getElementById("customersPage");

  renderStaticStatusBadges();
  crmInitModalDefaults();

  if (roleDashboard) {
    crmSetDashboardDate();
    crmLoadRoleDashboard(roleDashboard);
    return;
  } else if (managerInboxPage) {
    crmInitManagerInbox(managerInboxPage);
    return;
  } else if (csInboxPage) {
    crmInitCsInbox(csInboxPage);
    return;
  } else if (salesInboxParts) {
    crmInitSalesInbox(salesInboxParts);
    return;
  } else if (ticketsPage) {
    crmInitTicketCards(ticketsPage);
    return;
  } else if (ticketsTable) {
    crmRenderTicketBadges();
    crmLoadTickets(ticketsTable);
    return;
  } else if (reportsPage) {
    crmRenderReports();
    return;
  } else if (menuManagementPage) {
    crmInitMenuManagement(menuManagementPage);
    return;
  } else if (salesAvailablePage) {
    crmInitSalesAvailable(salesAvailablePage);
    return;
  } else if (managerInquiriesPage) {
    crmInitManagerInquiries(managerInquiriesPage);
    return;
  } else if (managerBookingsPage) {
    crmInitManagerBookings(managerBookingsPage);
    return;
  } else if (customersPage) {
    crmInitCustomers(customersPage);
    return;
  } else if (calendarPage) {
    crmInitCalendar(calendarPage);
    return;
  } else if (dashActivities || dashCustomers) {
    crmSetDashboardDate();
    crmFillProgressBars();
    crmEnsureEmptyMessage(dashActivities, 5, "No upcoming activities");
    crmEnsureEmptyMessage(dashCustomers, 4, "No customers yet");
  }

  window.initTableSearchAndFilters();
};

function crmAppendDropdownState(menu, message) {
  const item = document.createElement("span");
  item.className = "dropdown-item custom-dropdown-item py-2 px-3 text-muted";
  item.textContent = message;
  item.dataset.dropdownState = "true";
  item.setAttribute("aria-disabled", "true");
  const row = document.createElement("li");
  row.append(item);
  menu.append(row);
}
async function crmLoadTickets(table) {
  const tbody = table.querySelector("tbody");
  if (!tbody || table.dataset.ticketsLoading === "true") return;
  table.dataset.ticketsLoading = "true";
  tbody.replaceChildren();
  crmAppendTicketState(tbody, "Loading tickets...", "text-muted");
  try {
    const response = await fetch("tickets-api.php?action=list", {
      method: "GET",
      credentials: "same-origin",
      headers: { Accept: "application/json" },
      cache: "no-store",
    });
    const data = await response.json();
    if (
      !response.ok ||
      !data.success ||
      !Array.isArray(data.tickets) ||
      !Array.isArray(data.contacts) ||
      !Array.isArray(data.staff) ||
      typeof data.csrf_token !== "string" ||
      data.csrf_token === ""
    ) {
      throw new Error(data.message || "Unable to load tickets.");
    }
    if (document.getElementById("ticketsTable") !== table) return;
    table.dataset.csrfToken = data.csrf_token;
    table.dataset.currentRole = data.role || "";
    window.crmTicketStaff = data.staff;
    const contactOptions = data.contacts.map((contact) => ({
      value: contact.contact_id,
      text: contact.customer_name || "",
    }));
    const staffOptions = data.staff.map((staff) => ({
      value: staff.user_id,
      text: staff.full_name || "",
    }));
    window.populateDropdown("addTicketCustomerDropdown", contactOptions);
    window.populateDropdown("addTicketStaffDropdown", staffOptions);
    window.populateDropdown("editTicketStaffDropdown", staffOptions);
    tbody.replaceChildren();
    if (data.tickets.length === 0) {
      crmAppendTicketState(tbody, "No tickets yet.", "text-muted");
    } else {
      data.tickets.forEach((ticket) => {
        const row = document.createElement("tr");
        row.dataset.id = String(ticket.ticket_id ?? "");
        row.dataset.customerId = String(ticket.contact_id ?? "");
        row.dataset.staffId = String(ticket.assigned_user_id ?? "");
        row.dataset.desc = ticket.description || "";
        const ticketNoCell = document.createElement("td");
        ticketNoCell.textContent = `TKT-${String(ticket.ticket_id).padStart(4, "0")}`;
        const nameCell = document.createElement("td");
        nameCell.className = "fw-semibold";
        nameCell.textContent = ticket.ticket_name || "";
        const customerCell = document.createElement("td");
        customerCell.textContent = ticket.customer_name || "";
        const statusCell = document.createElement("td");
        statusCell.dataset.ticketStatus = ticket.status || "";
        statusCell.textContent = ticket.status || "";
        const priorityCell = document.createElement("td");
        priorityCell.dataset.ticketPriority = ticket.priority || "";
        priorityCell.textContent = ticket.priority || "";
        const staffCell = document.createElement("td");
        staffCell.textContent = ticket.assigned_staff_name || "";
        const actionsCell = document.createElement("td");
        const actions = document.createElement("div");
        actions.className = "d-flex align-items-center gap-3";
        [
          ["Edit", "action-btn-edit", "#editTicketModal"],
          ["View", "action-btn-view", "#viewTicketModal"],
        ].forEach(([label, actionClass, target]) => {
          const button = document.createElement("button");
          button.type = "button";
          button.className = `btn btn-link p-0 text-decoration-none ${actionClass}`;
          button.dataset.bsToggle = "modal";
          button.dataset.bsTarget = target;
          button.textContent = label;
          actions.append(button);
        });
        if (data.role === "Admin") {
          const deleteButton = document.createElement("button");
          deleteButton.type = "button";
          deleteButton.className =
            "btn btn-link p-0 text-decoration-none action-btn-delete";
          deleteButton.textContent = "Delete";
          actions.append(deleteButton);
        }
        actionsCell.append(actions);
        row.append(
          ticketNoCell,
          nameCell,
          customerCell,
          statusCell,
          priorityCell,
          staffCell,
          actionsCell,
        );
        tbody.append(row);
      });
      crmRenderTicketBadges();
    }
    if (document.getElementById("ticketsTable") === table) {
      window.initTableSearchAndFilters();
    }
  } catch (error) {
    console.error("Ticket loading failed:", error);
    tbody.replaceChildren();
    crmAppendTicketState(
      tbody,
      error.message ||
        "Unable to load tickets. Refresh the page and try again.",
      "text-danger",
    );
    if (document.getElementById("ticketsTable") === table) {
      window.initTableSearchAndFilters();
    }
  } finally {
    delete table.dataset.ticketsLoading;
  }
}
function crmAppendTicketState(tbody, message, textClass) {
  const row = document.createElement("tr");
  row.className = "empty-data-row";
  const cell = document.createElement("td");
  cell.colSpan = 7;
  cell.className = `text-center py-4 ${textClass}`;
  cell.textContent = message;
  row.append(cell);
  tbody.append(row);
}
// ---- Tickets (card layout): manager-admin-ticket.html ----
// Same process as Inquiries: the cards are built here from the backend list.
// Backend contract: GET tickets-api.php?action=list ->
//   { success: true, can_manage, csrf_token, tickets: [ { ticket_id, ticket_no, customer_name, customer_email,
//     customer_phone, created_at, updated_at, status, priority, ticket_name, description, last_activity,
//     action_needed, activity: [...], internal_notes: [...] } ] }
//   Changes (Customer Service Staff only): POST tickets-api.php?action=update_status | update_priority | resolve | add_note
// You can also call window.crmRenderTickets(list) yourself.
// View -> opens the detail view inside this page (also fires "crm:ticket-view" with { id, ticket }).
// The detail view shows only what the ticket record contains; optional extra fields:
//   updated_at, last_activity, action_needed, activity: [ { action, performed_by, performed_by_role, created_at } ]
const CRM_TICKET_STATUSES = ["Open", "In Progress", "Pending", "Resolved"];
const CRM_TICKET_PRIORITIES = ["Urgent", "High", "Medium", "Low"];

// Pills reuse the .stage-* colors.
const CRM_TICKET_STATUS_CLASS = {
  "open": "stage-won",
  "in progress": "stage-qualified",
  "pending": "stage-proposal",
  "resolved": "stage-won",
  "closed": "stage-new",
};
const CRM_TICKET_PRIORITY_CLASS = {
  "urgent": "stage-loss",
  "high": "stage-proposal",
  "medium": "stage-qualified",
  "low": "stage-new",
};

function crmTicketFields(t) {
  const pick = (keys) => crmInquiryPick(t, keys);
  const id = pick(["ticket_id", "id"]);
  return {
    id,
    ref: pick(["ticket_no", "ticket_ref"]) || (id ? "TCK-" + String(id).padStart(4, "0") : ""),
    customer: pick(["customer_name", "customer", "client_name"]) || "Customer",
    photo: pick(["customer_photo", "photo_url"]),
    email: pick(["customer_email", "email"]) || "—",
    phone: pick(["customer_phone", "phone"]) || "—",
    status: pick(["status", "ticket_status"]) || "Open",
    priority: pick(["priority"]) || "Medium",
    subject: pick(["ticket_name", "subject"]) || "—",
    description: pick(["description", "message", "concern", "details"]),
    date: pick(["created_at", "submitted_at"]).slice(0, 10),
    // read from the ticket the backend returns; "—" when missing
    created: pick(["created_at", "submitted_at"]),
    updated: pick(["updated_at", "last_updated", "modified_at"]),
    lastActivity: pick(["last_activity", "last_activity_text"]),
    action: pick(["action_needed", "next_action"]),
    activity: crmTicketActivityList(t),
    notes: crmTicketNoteList(t),
  };
}

// Activity history = whatever list the backend sends with the ticket (never made up here).
function crmTicketActivityList(t) {
  const list = t && (t.activity || t.activities || t.history || t.audit_trail || t.activity_log);
  return Array.isArray(list) ? list : [];
}

// Internal notes = whatever list the backend sends: [ { note, created_by, created_by_role, created_at } ]
function crmTicketNoteList(t) {
  const list = t && (t.internal_notes || t.notes);
  return Array.isArray(list) ? list : [];
}

// "November 1, 2026, 9:15 AM"  (sep = ", " for the date tiles, " - " for the activity log)
function crmTicketDateTime(value, sep) {
  if (!value) return "—";
  const d = new Date(String(value).trim().replace(" ", "T"));
  if (isNaN(d.getTime())) return String(value);
  const day = d.toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });
  const time = d.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" });
  return day + (sep || ", ") + time;
}

function crmTicketInitials(name) {
  return String(name || "").split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0]).join("") || "?";
}

// "Action Needed" pill colour, chosen from the wording the backend sends.
function crmTicketActionClass(text) {
  const a = String(text || "").toLowerCase();
  if (a.includes("no action")) return "stage-won";
  if (a.includes("waiting")) return "stage-negotiation";
  if (a.includes("respond")) return "stage-qualified";
  if (a.includes("review")) return "stage-proposal";
  return "stage-new";
}

// last activity: the backend text, else the newest entry of the activity history
function crmTicketLastActivity(f) {
  const newest = f.activity.length ? f.activity[f.activity.length - 1] : null;
  return f.lastActivity ||
    (newest ? crmInquiryPick(newest, ["action", "title", "description", "activity", "event"]) : "") || "—";
}

function crmTicketCardHTML(record, index) {
  const f = crmTicketFields(record);
  const statusClass = CRM_TICKET_STATUS_CLASS[f.status.toLowerCase()] || "stage-new";
  const priorityClass = CRM_TICKET_PRIORITY_CLASS[f.priority.toLowerCase()] || "stage-new";
  const refAttr = crmEscape(f.ref);

  return (
    '<article class="card iq-card" data-index="' + index + '" data-ref="' + refAttr + '"' +
    ' data-status="' + crmEscape(f.status.toLowerCase()) + '"' +
    ' data-priority="' + crmEscape(f.priority.toLowerCase()) + '"' +
    ' data-date="' + crmEscape(f.date) + '">' +
      '<div class="iq-card-head">' +
        crmAvatarHTML(crmTicketInitials(f.customer), f.photo) +
        '<div class="iq-head-main">' +
          '<h4 class="iq-customer">' + crmEscape(f.customer) + "</h4>" +
          '<span class="iq-ref">' + refAttr + "</span>" +
        "</div>" +
        '<span class="stage-pill ' + statusClass + '">' + crmEscape(f.status) + "</span>" +
      "</div>" +
      '<ul class="tk-rows">' +
        "<li><span>Date Submitted:</span><strong>" + crmEscape(crmTicketDateTime(f.created)) + "</strong></li>" +
        "<li><span>Last Activity:</span><strong>" + crmEscape(crmTicketLastActivity(f)) + "</strong></li>" +
      "</ul>" +
      '<div class="iq-facts tk-facts">' +
        '<div><span class="stat-label">Priority</span><span class="iq-fact-pill"><span class="stage-pill ' + priorityClass + '">' + crmEscape(f.priority) + "</span></span></div>" +
        '<div><span class="stat-label">Action Needed</span><span class="iq-fact-pill">' +
          (f.action ? '<span class="stage-pill tk-action-pill ' + crmTicketActionClass(f.action) + '">' + crmEscape(f.action) + "</span>" : '<span class="iq-fact-value">—</span>') +
        "</span></div>" +
      "</div>" +
      '<div class="iq-event"><span class="stat-label">Subject Concern</span><span class="iq-fact-value">' + crmEscape(f.subject) + "</span></div>" +
      '<div class="iq-actions">' +
        '<button type="button" class="btn modal-btn-save iq-view" data-tk-action="view"><i class="bi bi-arrow-right" aria-hidden="true"></i>View Details</button>' +
      "</div>" +
    "</article>"
  );
}

// Text of the notice at the bottom of the detail view for view-only roles (Admin, Manager).
const CRM_TICKET_ADMIN_NOTICE =
  "You are viewing this ticket in read-only mode. Customer support conversations are handled by Customer Service Staff.";

// Ticket detail view. ONE layout for every role; `canManage` (sent by tickets-api.php: true only for Customer Service Staff)
// switches on the controls: Open Conversation, Respond to Customer, status / priority dropdowns, Add Note, Resolve Ticket.
// Admin and Manager get the same page without those controls (view only). Nothing here is hard-coded data.
function crmTicketDetailHTML(record, canManage) {
  const f = crmTicketFields(record);
  const statusClass = CRM_TICKET_STATUS_CLASS[f.status.toLowerCase()] || "stage-new";
  const priorityClass = CRM_TICKET_PRIORITY_CLASS[f.priority.toLowerCase()] || "stage-new";
  const pick = (entry, keys) => crmInquiryPick(entry, keys);
  const head = (title, note) =>
    '<div class="tk-section-head"><h3 class="iq-section-title">' + title + "</h3>" + (note || "") + "</div>";
  const field = (label, valueHTML, extra) =>
    "<div" + (extra ? ' class="' + extra + '"' : "") + '><span class="iq-label is-caps">' + label + "</span>" + valueHTML + "</div>";
  const tile = (label, value, extra) =>
    '<div class="tk-date-tile' + (extra ? " " + extra : "") + '"><span class="iq-label is-caps">' + label +
    '</span><span class="iq-value">' + crmEscape(value) + "</span></div>";
  // Same custom dropdown as the list filters. data-dropdown-state="true" keeps the shared filter handler away from it.
  const dropdown = (id, fieldName, list, current) =>
    '<div class="dropdown tk-dd" data-tk-field="' + fieldName + '">' +
      '<button type="button" id="' + id + '" class="btn custom-dropdown-toggle d-flex justify-content-between align-items-center w-100" data-bs-toggle="dropdown" aria-expanded="false">' +
        "<span>" + crmEscape(current) + '</span><i class="bi bi-chevron-down ms-2" aria-hidden="true"></i></button>' +
      '<ul class="dropdown-menu custom-dropdown-menu">' +
      list.map((o) =>
        '<li><a class="dropdown-item custom-dropdown-item py-2 px-3" href="#" data-dropdown-state="true" data-value="' + crmEscape(o) + '"' +
        (o.toLowerCase() === String(current).toLowerCase() ? ' aria-selected="true"' : "") + ">" + crmEscape(o) + "</a></li>"
      ).join("") + "</ul></div>";
  const entryList = (items, kind) => {
    const isNote = kind === "note";
    return '<ul class="tk-log' + (isNote ? " tk-notes" : "") + '">' +
      items.map((entry) => {
        const what = isNote
          ? pick(entry, ["note", "text", "content", "message"]) || "—"
          : pick(entry, ["action", "title", "description", "activity", "event"]) || "—";
        const who = pick(entry, isNote ? ["created_by", "performed_by", "user_name", "by"] : ["performed_by", "actor", "user_name", "by"]);
        const role = pick(entry, isNote ? ["created_by_role", "performed_by_role", "role"] : ["performed_by_role", "actor_role", "role"]);
        const when = pick(entry, ["created_at", "timestamp", "date", "performed_at"]);
        const byLine = isNote
          ? "Internal Note" + (who ? " by " + crmEscape(who) : "") + (role ? " (" + crmEscape(role) + ")" : "")
          : who ? "Performed by " + crmEscape(who) + (role ? " (" + crmEscape(role) + ")" : "") : "";
        return (
          '<li class="tk-log-item"><div><span class="tk-log-title">' + crmEscape(what) + "</span>" +
          (byLine ? '<span class="tk-log-by">' + byLine + "</span>" : "") +
          '</div><span class="tk-log-time">' + crmEscape(crmTicketDateTime(when, " - ")) + "</span></li>"
        );
      }).join("") + "</ul>";
  };

  const log = f.activity.length
    ? entryList(f.activity, "activity")
    : '<p class="tk-log-empty">No activity recorded for this ticket yet.</p>';
  const closed = /^(resolved|closed)$/i.test(f.status);

  const statusPriority = canManage
    ? '<div class="tk-dates tk-dates-2">' +
        field("Ticket Status", dropdown("tkStatusSelect", "status", CRM_TICKET_STATUSES, f.status)) +
        field("Priority", dropdown("tkPrioritySelect", "priority", CRM_TICKET_PRIORITIES, f.priority)) +
      "</div>"
    : '<div class="tk-dates tk-dates-2">' +
        field("Ticket Status", '<span class="stage-pill ' + statusClass + '">' + crmEscape(f.status) + "</span>") +
        field("Priority", '<span class="stage-pill ' + priorityClass + '">' + crmEscape(f.priority) + "</span>") +
      "</div>";

  return (
    '<button type="button" class="iq-back" data-tk-action="back"><i class="bi bi-arrow-left" aria-hidden="true"></i>Back to Support Tickets</button>' +
    '<div class="iq-detail-head" data-ticket-ref="' + crmEscape(f.ref) + '">' +
      '<div class="iq-detail-ref tk-ref" role="heading" aria-level="2">' + crmEscape(f.ref || "Ticket") + "</div>" +
      '<span class="stage-pill ' + priorityClass + '">' + crmEscape(f.priority) + " Priority</span>" +
      '<span class="stage-pill ' + statusClass + '">' + crmEscape(f.status) + "</span>" +
      (canManage
        ? '<button type="button" class="btn modal-btn-save tk-head-action" data-tk-action="open-conversation"><i class="bi bi-chat-dots-fill" aria-hidden="true"></i>Open Conversation</button>'
        : "") +
    "</div>" +
    '<div class="iq-detail-col">' +
      '<section class="card iq-detail-card">' +
        head("Original Customer Concern",
          canManage && !closed
            ? '<button type="button" class="stage-pill stage-qualified tk-respond-pill" data-tk-action="open-conversation">Respond to Customer</button>'
            : "") +
        field("Subject", '<span class="tk-concern-title">' + crmEscape(f.subject) + "</span>") +
        field("Description", '<div class="tk-date-tile tk-concern">' + crmEscape(f.description || "—") + "</div>") +
      "</section>" +
      '<section class="card iq-detail-card">' + head("Customer Information") +
        '<div class="tk-contact-grid">' +
          field("Customer Name", '<span class="iq-value">' + crmEscape(f.customer) + "</span>", "tk-span-all") +
          field("Email Address", '<span class="iq-value">' + crmEscape(f.email) + "</span>") +
          field("Contact Number", '<span class="iq-value">' + crmEscape(f.phone) + "</span>") +
        "</div>" +
      "</section>" +
      '<section class="card iq-detail-card tk-manage">' + head("Ticket Management &amp; Timestamps") +
        '<div class="tk-dates tk-dates-2">' +
          tile("Date Submitted", crmTicketDateTime(f.created)) +
          tile("Last Updated", crmTicketDateTime(f.updated)) +
        "</div>" +
        tile("Last Activity", crmTicketLastActivity(f), "is-activity tk-block") +
        '<div class="tk-block">' + statusPriority + "</div>" +
      "</section>" +
      '<section class="card iq-detail-card">' + head("Ticket Activity History", '<span class="tk-section-note">Operational Audit Trail</span>') + log + "</section>" +
      (canManage
        ? '<div class="tk-note-actions"><button type="button" class="btn modal-btn-save tk-resolve" data-tk-action="resolve"' +
            (closed ? " disabled" : "") + ">Resolve Ticket</button></div>"
        : '<div class="tk-notice"><i class="bi bi-eye-fill" aria-hidden="true"></i><span>' + crmEscape(CRM_TICKET_ADMIN_NOTICE) + "</span></div>") +
    "</div>"
  );
}

function crmInitTicketCards(root) {
  const grid = root.querySelector("#ticketsGrid");
  const state = root.querySelector("#ticketsState");
  const noResults = root.querySelector("#ticketsNoResults");
  const input = root.querySelector("#ticketsSearchInput");
  const dateInput = root.querySelector("#ticketsDateFilter");
  const listView = root.querySelector("#tkListView");
  const detailView = root.querySelector("#tkDetailView");
  if (!grid) return;

  const filters = { search: "", status: "all", priority: "all" };
  let records = [];
  let canManage = false; // Customer Service Staff only (tickets-api.php says so)
  let csrfToken = "";

  function applyFilters() {
    const term = input ? input.value.trim().toLowerCase() : "";
    const date = dateInput ? dateInput.value : "";
    const cards = Array.from(grid.querySelectorAll(".iq-card"));
    let visible = 0;
    cards.forEach((card) => {
      const match =
        (term === "" || card.textContent.toLowerCase().includes(term)) &&
        (filters.status === "all" || card.dataset.status === filters.status) &&
        (filters.priority === "all" || card.dataset.priority === filters.priority) &&
        (date === "" || card.dataset.date === date);
      card.style.display = match ? "" : "none";
      if (match) visible++;
    });
    if (noResults) noResults.hidden = !(cards.length > 0 && visible === 0);
    if (state) {
      state.hidden = cards.length > 0;
      if (cards.length === 0) state.textContent = "No tickets yet.";
    }
  }

  // Reuse the shared dropdown click handler (it knows statusFilterDropdown / priorityFilterDropdown).
  window.activeTableFilters = filters;
  window.applyTableFilters = applyFilters;

  window.populateDropdown("statusFilterDropdown", CRM_TICKET_STATUSES, "All Status");
  window.populateDropdown("priorityFilterDropdown", CRM_TICKET_PRIORITIES, "All Priority");

  function render(list) {
    records = Array.isArray(list) ? list.slice() : [];
    grid.innerHTML = records.map((r, i) => crmTicketCardHTML(r, i)).join("");
    applyFilters();
    // coming from the Inbox ("View Ticket Details"): open that ticket straight away
    const want = window.crmPendingTicketRef;
    if (want && records.length) {
      window.crmPendingTicketRef = null;
      const hit = records.find((r) => {
        const f = crmTicketFields(r);
        return String(f.ref) === String(want) || String(f.id) === String(want);
      });
      if (hit) showDetail(hit);
    }
  }
  window.crmRenderTickets = render;

  if (input) input.oninput = applyFilters;
  if (dateInput) dateInput.onchange = applyFilters;

  function showList() {
    if (!listView || !detailView) return;
    detailView.hidden = true;
    detailView.innerHTML = "";
    listView.hidden = false;
    const body = document.querySelector(".content-body");
    if (body) body.scrollTop = 0;
  }

  function showDetail(ticket) {
    if (!listView || !detailView) return;
    detailView.innerHTML = crmTicketDetailHTML(ticket, canManage);
    listView.hidden = true;
    detailView.hidden = false;
    const body = document.querySelector(".content-body");
    if (body) body.scrollTop = 0;
  }

  grid.onclick = (event) => {
    const button = event.target.closest('[data-tk-action="view"]');
    if (!button) return;
    const card = button.closest(".iq-card");
    const ticket = card && records[Number(card.dataset.index)];
    if (!ticket) return;
    document.dispatchEvent(
      new CustomEvent("crm:ticket-view", { detail: { id: ticket.ticket_id, ticket, card } })
    );
    showDetail(ticket);
  };

  // Detail view actions (Customer Service Staff only; Admin / Manager get no controls and the server refuses changes).
  // Each change is sent to tickets-api.php, which answers with the refreshed ticket; the card and detail are redrawn from it.
  // The page also announces every action as "crm:ticket-action" for anything else that wants to listen.
  if (detailView) {
    const currentTicket = () => {
      const ref = detailView.querySelector("[data-ticket-ref]");
      return records.find((r) => crmTicketFields(r).ref === (ref && ref.dataset.ticketRef)) || null;
    };
    const announce = (action, extra) =>
      document.dispatchEvent(new CustomEvent("crm:ticket-action", {
        detail: Object.assign({ action, ticket: currentTicket() }, extra || {}),
      }));
    const setDd = (dd, value) => {
      if (!dd) return;
      const label = dd.querySelector(".custom-dropdown-toggle span");
      if (label) label.textContent = value;
      dd.querySelectorAll(".custom-dropdown-item").forEach((a) => {
        if (a.dataset.value === value) a.setAttribute("aria-selected", "true");
        else a.removeAttribute("aria-selected");
      });
    };
    // POST one change; on success swap in the refreshed ticket and redraw the card + detail.
    const send = async (apiAction, fields) => {
      const ticket = currentTicket();
      if (!ticket) return false;
      const body = new URLSearchParams(Object.assign({ id: String(ticket.ticket_id), csrf_token: csrfToken }, fields));
      try {
        const response = await fetch("tickets-api.php?action=" + encodeURIComponent(apiAction), {
          method: "POST",
          credentials: "same-origin",
          headers: { Accept: "application/json", "X-CSRF-Token": csrfToken },
          body,
        });
        const data = await response.json();
        if (!response.ok || !data || !data.success || !data.ticket) throw new Error((data && data.message) || "Unable to update this ticket.");
        const index = records.indexOf(ticket);
        records[index] = data.ticket;
        grid.innerHTML = records.map((r, i) => crmTicketCardHTML(r, i)).join("");
        applyFilters();
        showDetail(data.ticket);
        return true;
      } catch (error) {
        if (window.crmToast) window.crmToast(error.message || "Unable to update this ticket.", "error");
        else console.error("CRM toast component was not loaded before ticket updates.");
        showDetail(ticket); // put the dropdowns back to what is saved
        return false;
      }
    };
    detailView.onclick = (event) => {
      const opt = event.target.closest(".tk-dd .custom-dropdown-item");
      if (opt) {
        event.preventDefault();
        if (!canManage) return;
        const dd = opt.closest(".tk-dd");
        const fieldName = dd.dataset.tkField;
        setDd(dd, opt.dataset.value);
        announce("update-" + fieldName, { value: opt.dataset.value });
        send(fieldName === "status" ? "update_status" : "update_priority", { [fieldName]: opt.dataset.value });
        return;
      }
      const btn = event.target.closest("[data-tk-action]");
      if (!btn || btn.disabled) return;
      const action = btn.dataset.tkAction;
      if (action === "back") return showList();
      if (!canManage) return;
      if (action === "resolve") {
        btn.disabled = true;
        announce("resolve");
        send("resolve", {});
        return;
      }
      if (action === "open-conversation") {
        const t = currentTicket();
        if (t) window.crmPendingInboxTicket = crmTicketFields(t).ref;
        if (typeof loadPage === "function") loadPage("inbox");
        announce(action);
      }
    };
  }

  // Load the list automatically.
  const url = root.dataset.api;
  if (!url) return render([]);
  if (state) { state.hidden = false; state.textContent = "Loading tickets..."; }
  fetch(url, {
    method: "GET",
    credentials: "same-origin",
    headers: { Accept: "application/json" },
    cache: "no-store",
  })
    .then((response) => response.json().then((data) => ({ response, data })))
    .then(({ response, data }) => {
      if (document.getElementById("ticketsPage") !== root) return;
      if (!response.ok || !data || !Array.isArray(data.tickets))
        throw new Error((data && data.message) || "Unable to load tickets.");
      canManage = data.can_manage === true;
      csrfToken = typeof data.csrf_token === "string" ? data.csrf_token : "";
      render(data.tickets);
    })
    .catch((error) => {
      console.warn("Tickets could not be loaded:", error);
      if (document.getElementById("ticketsPage") !== root) return;
      render([]);
      if (state) { state.hidden = false; state.textContent = "Unable to load tickets."; }
    });
}

// Custom dropdown helpers.
function crmSetHidden(dropdown, value) {
  const field = dropdown.getAttribute("data-field");
  if (!field) return;
  let hidden = dropdown.querySelector('input[type="hidden"]');
  if (!hidden) {
    hidden = document.createElement("input");
    hidden.type = "hidden";
    hidden.name = field;
    dropdown.appendChild(hidden);
  }
  hidden.value = value;
}

// Select a modal option by ID or visible text.
function crmSelectDropdown(dropdown, text, valueHint) {
  if (!dropdown) return;
  const span = dropdown.querySelector(".custom-dropdown-toggle span");
  const items = Array.from(dropdown.querySelectorAll(".custom-dropdown-item"));
  let match = null;
  if (valueHint)
    match = items.find(
      (a) => a.getAttribute("data-value") === String(valueHint),
    );
  if (!match && text) {
    const wanted = String(text).trim().toLowerCase();
    match = items.find((a) => a.textContent.trim().toLowerCase() === wanted);
  }
  const label = match ? match.textContent.trim() : text || "";
  if (span) {
    span.textContent = label || span.dataset.defaultLabel || "Select";
    span.classList.toggle("text-muted", !label);
  }
  const v = match ? match.getAttribute("data-value") : null;
  crmSetHidden(dropdown, v !== null ? v : label);
  const toggle = dropdown.querySelector(".custom-dropdown-toggle");
  if (toggle) toggle.classList.remove("dd-invalid");
}

// Build dropdown items from text or option objects.
window.populateDropdown = function (menuId, items, allLabel) {
  const menu = document.getElementById(menuId);
  if (!menu) return;
  const list = (allLabel ? [allLabel] : []).concat(items || []);
  menu.innerHTML = list
    .map((it) => {
      const o = it && typeof it === "object" ? it : { text: it };
      const v =
        o.value !== undefined ? ' data-value="' + crmEscape(o.value) + '"' : "";
      const c =
        o.customerId !== undefined
          ? ' data-customer-id="' + crmEscape(o.customerId) + '"'
          : "";
      const em =
        o.email !== undefined ? ' data-email="' + crmEscape(o.email) + '"' : "";
      const ph =
        o.phone !== undefined ? ' data-phone="' + crmEscape(o.phone) + '"' : "";
      const name =
        o.name !== undefined ? ' data-name="' + crmEscape(o.name) + '"' : "";
      return (
        '<li><a class="dropdown-item custom-dropdown-item py-2 px-3" href="#"' +
        v +
        c +
        em +
        ph +
        name +
        ">" +
        crmEscape(o.text) +
        "</a></li>"
      );
    })
    .join("");
};


// Handle table row actions.
function crmSetText2(selector, text) {
  const el = document.querySelector(selector);
  if (el) el.textContent = text;
}

function crmSetValue(modal, name, value) {
  const el = modal.querySelector('[name="' + name + '"]');
  if (el) el.value = value === null || value === undefined ? "" : value;
}


// Search and filter page tables.
window.initTableSearchAndFilters = function () {
  // Search and filters apply to the Tickets table.
  const table =
    document.getElementById("leadsDealsTable") ||
    document.getElementById("contactsTable") ||
    document.getElementById("ticketsTable") ||
    document.getElementById("activitiesTable");
  if (!table) return;

  const searchInput =
    document.getElementById("leadsSearchInput") ||
    document.getElementById("contactsSearchInput") ||
    document.getElementById("ticketsSearchInput") ||
    document.getElementById("activitiesSearchInput");

  const tbody = table.querySelector("tbody");
  if (!tbody) return;

  const isContactsPage = table.id === "contactsTable";
  const isTicketsPage = table.id === "ticketsTable";
  const isActivitiesPage = table.id === "activitiesTable";
  // Table column indexes are zero-based.
  const staffCol = isContactsPage
    ? 3
    : isTicketsPage
      ? 5
      : isActivitiesPage
        ? 6
        : 4; // Assigned staff column.
  const typeCol = isActivitiesPage ? 3 : 2; // Type column.
  const statusCol = isActivitiesPage ? 5 : 3; // Status column.
  const hasStatus = isTicketsPage || isActivitiesPage;

  window.activeTableFilters = {
    search: "",
    type: "all",
    stage: "all",
    staff: "all",
    status: "all",
    priority: "all",
  };

  function ensureNoResultsRow(visible = false) {
    const colCount = table.querySelectorAll("thead th").length || 6;
    return crmSetNoResultsRow(tbody, colCount, visible);
  }

  function applyFilters() {
    const dataRows = tbody.querySelectorAll(
      "tr:not(.no-results-row):not(.empty-data-row)",
    );
    ensureNoResultsRow();
    const filters = window.activeTableFilters;
    let visibleCount = 0;

    dataRows.forEach((row) => {
      // Exclude the final action column from search.
      const searchText = Array.from(row.cells)
        .slice(0, -1)
        .map((c) => c.textContent)
        .join(" ")
        .toLowerCase();
      const typeText = row.cells[typeCol]
        ? row.cells[typeCol].textContent.trim().toLowerCase()
        : "";
      const stageText = row.cells[3]
        ? row.cells[3].textContent.trim().toLowerCase()
        : "";
      const staffText = row.cells[staffCol]
        ? row.cells[staffCol].textContent.trim().toLowerCase()
        : "";
      const statusText = row.cells[statusCol]
        ? row.cells[statusCol].textContent.trim().toLowerCase()
        : "";
      const priorityText = row.cells[4]
        ? row.cells[4].textContent.trim().toLowerCase()
        : "";
      const matchesSearch =
        filters.search === "" || searchText.includes(filters.search);
      const matchesType =
        isContactsPage || filters.type === "all" || typeText === filters.type;
      const matchesStage =
        isContactsPage ||
        isActivitiesPage ||
        filters.stage === "all" ||
        stageText === filters.stage;
      let matchesStaff = filters.staff === "all" || staffText === filters.staff;
      if (isContactsPage && filters.staff !== "all") {
        const assignedNames = JSON.parse(row.dataset.staffNames || "[]");
        matchesStaff = assignedNames.includes(filters.staff);
      }
      const matchesStatus =
        !hasStatus || filters.status === "all" || statusText === filters.status;
      const matchesPriority =
        !isTicketsPage ||
        filters.priority === "all" ||
        priorityText === filters.priority;
      if (
        matchesSearch &&
        matchesType &&
        matchesStage &&
        matchesStaff &&
        matchesStatus &&
        matchesPriority
      ) {
        row.style.display = "";
        visibleCount++;
      } else {
        row.style.display = "none";
      }
    });

    ensureNoResultsRow(dataRows.length > 0 && visibleCount === 0);
  }

  if (searchInput) {
    searchInput.oninput = function (e) {
      window.activeTableFilters.search = e.target.value.trim().toLowerCase();
      applyFilters();
    };
  }

  window.applyTableFilters = applyFilters;
  applyFilters();
};

// Handle dropdown selections, including dynamically added options.
// Custom options use this dropdown-item structure:
// Use data-value to submit an ID instead of the option text.
// Use populateDropdown() to create options programmatically.
if (!window.__crmFilterDropdownBound) {
  window.__crmFilterDropdownBound = true;
  document.addEventListener("click", function (e) {
    const item = e.target.closest(
      ".custom-dropdown-menu .custom-dropdown-item",
    );
    if (!item) return;
    e.preventDefault();
    if (item.dataset.dropdownState === "true") return;

    const menu = item.closest(".custom-dropdown-menu");
    const dropdown = item.closest(".dropdown");
    if (!menu || !dropdown) return;

    const labelSpan = dropdown.querySelector(".custom-dropdown-toggle span");
    const selectedText = item.textContent.trim();
    const selectedLower = selectedText.toLowerCase();
    const isAll = /^all (types|stages|staff|status|priority)$/i.test(
      selectedText,
    );

    // Save the initial label so it can be restored.
    if (labelSpan && !labelSpan.dataset.defaultLabel) {
      labelSpan.dataset.defaultLabel = labelSpan.textContent.trim();
    }

    // Modal dropdowns update the label and hidden input.
    if (item.closest(".modal")) {
      if (labelSpan) {
        labelSpan.textContent = selectedText;
        labelSpan.classList.remove("text-muted");
      }
      const v = item.getAttribute("data-value");
      const value = v !== null ? v : selectedText;
      const field = dropdown.getAttribute("data-field");
      if (field) crmSetHidden(dropdown, value);
      const toggle = dropdown.querySelector(".custom-dropdown-toggle");
      if (toggle) toggle.classList.remove("dd-invalid");
      return;
    }

    // Restore the default label when clearing a filter.
    if (labelSpan) {
      labelSpan.textContent = isAll
        ? labelSpan.dataset.defaultLabel || selectedText
        : selectedText;
      labelSpan.classList.remove("text-muted");
    }

    if (
      !window.activeTableFilters ||
      typeof window.applyTableFilters !== "function"
    )
      return;

    let key;
    if (menu.id === "typesFilterDropdown") key = "type";
    else if (menu.id === "statusFilterDropdown") key = "status";
    else if (menu.id === "priorityFilterDropdown") key = "priority";
    else if (menu.id === "stagesFilterDropdown") key = "stage";
    else if (
      menu.id === "staffFilterDropdownList" ||
      dropdown.classList.contains("staff-filter-dropdown")
    )
      key = "staff";
    else
      key =
        selectedLower === "lead" || selectedLower === "deal" ? "type" : "stage";
    // Clear search before applying the new filter.
    const activeSearchInput =
      document.getElementById("leadsSearchInput") ||
      document.getElementById("contactsSearchInput") ||
      document.getElementById("ticketsSearchInput") ||
      document.getElementById("activitiesSearchInput");
    if (activeSearchInput) activeSearchInput.value = "";
    window.activeTableFilters.search = "";
    // Rebuild the stage options when the type changes.
    if (key === "type") crmUpdateStageFilter(isAll ? "all" : selectedLower);
    window.activeTableFilters[key] = isAll ? "all" : selectedLower;
    window.applyTableFilters();
  });
}

function getStatusBadgeHTML(statusText) {
  if (!statusText) return "";
  const normalized = String(statusText).trim().toLowerCase();
  let statusClass = "";

  switch (normalized) {
    case "upcoming":
    case "new inquiry":
    case "pending":
      statusClass = "status-upcoming";
      break;
    case "in progress":
    case "in discussion":
    case "quotation sent":
    case "negotiation":
      statusClass = "status-in-progress";
      break;
    case "cancelled":
    case "declined":
    case "closed":
      statusClass = "status-cancelled";
      break;
    case "completed":
    case "confirmed":
    case "resolved":
      statusClass = "status-completed";
      break;
    default:
      statusClass = "status-upcoming";
  }

  return `<span class="status-badge ${statusClass}">${crmEscape(String(statusText).trim())}</span>`;
}

function renderStaticStatusBadges() {
  // Convert API-provided status spans to styled badges.
  document.querySelectorAll("[data-status], .tablebadge").forEach((el) => {
    if (el.classList.contains("status-badge")) return; // Skip existing badges.
    if (el.tagName === "TR" || el.tagName === "TABLE") return;
    const raw = el.getAttribute("data-status") || el.textContent;
    const html = getStatusBadgeHTML(raw);
    if (!html) return;
    if (el.tagName === "TD")
      el.innerHTML = html; // Preserve the table cell.
    else el.outerHTML = html;
  });
}
window.renderStaticStatusBadges = renderStaticStatusBadges; // Expose this helper to the page loader.

// Reset forms and validate required dropdowns.
// Reset Add forms, including their dropdown selections.
function crmResetModal(m) {
  m.querySelectorAll("form").forEach((f) => f.reset());

  // Remove only hidden inputs created by the dropdown helper.
  m.querySelectorAll('.dropdown[data-field] input[type="hidden"]').forEach(
    (h) => h.remove(),
  );

  m.querySelectorAll(".custom-dropdown-toggle").forEach((t) => {
    t.classList.remove("dd-invalid");
    const s = t.querySelector("span");
    if (!s || s.dataset.defaultLabel === undefined) return;
    s.textContent = s.dataset.defaultLabel;
    s.classList.toggle("text-muted", s.dataset.wasMuted === "1");
  });

  const rel = m.querySelector(
    '.dropdown[data-field="related_lead_id"] .custom-dropdown-toggle',
  );
  if (rel) rel.disabled = true;
  m.querySelectorAll(".custom-dropdown-menu li").forEach((li) => {
    li.style.display = "";
  });

  delete m.dataset.snapshot;
  m.dataset.keepState = "0";

  m.querySelectorAll("textarea[maxlength]").forEach(crmUpdateCharCount);
}

if (!window.__crmModalResetBound) {
  window.__crmModalResetBound = true;

  // Reset Add forms when they close.
  document.addEventListener("hidden.bs.modal", function (e) {
    const m = e.target;
    if (!m.id || m.id.indexOf("add") !== 0) return;
    // Keep the form values while the discard prompt is open.
    if (m.dataset.keepState === "1") {
      m.dataset.keepState = "0";
      return;
    }
    crmResetModal(m);
  });

  document.addEventListener("shown.bs.modal", function (e) {
    const m = e.target;
    m.dataset.pendingDiscard = "0";
    if (m.id && m.id.indexOf("add") === 0 && !m.dataset.snapshot)
      crmTakeSnapshot(m.id);
  });

  // Require a selection for dropdowns marked data-required="true".
  document.addEventListener(
    "submit",
    function (e) {
      const form = e.target;
      if (!form || !form.closest || !form.closest(".modal")) return;
      let ok = true;
      form.querySelectorAll('.dropdown[data-required="true"]').forEach((dd) => {
        const h = dd.querySelector('input[type="hidden"]');
        const toggle = dd.querySelector(".custom-dropdown-toggle");
        const empty = !h || h.value === "";
        if (toggle) toggle.classList.toggle("dd-invalid", empty);
        if (empty) ok = false;
      });
      if (!ok) e.preventDefault();
    },
    true,
  );
}
// Confirm before closing forms with unsaved changes.
// Ask before closing Add or Edit forms with unsaved changes.
// Find the prompt from data-discard-modal on the Cancel button,
// or use a modal whose ID contains "discard".
function crmFormState(modal) {
  const fields = Array.from(modal.querySelectorAll("input, textarea, select"))
    .filter((el) => el.type !== "button" && el.type !== "submit")
    .map((el) => [
      el.name || el.id || "",
      el.type === "checkbox" || el.type === "radio" ? el.checked : el.value,
    ]);
  const labels = Array.from(
    modal.querySelectorAll(".custom-dropdown-toggle span"),
  ).map((s) => s.textContent.trim());
  return JSON.stringify([fields, labels]);
}

function crmTakeSnapshot(modalId) {
  const modal = document.getElementById(modalId);
  if (modal) modal.dataset.snapshot = crmFormState(modal);
}

// Run the callback after this modal closes.
function crmAfterHidden(el, fn) {
  const h = function (ev) {
    if (ev.target !== el) return;
    el.removeEventListener("hidden.bs.modal", h);
    fn();
  };
  el.addEventListener("hidden.bs.modal", h);
}

function crmFindDiscardModal(btn, modalEl) {
  const id =
    (btn && btn.dataset && btn.dataset.discardModal) ||
    modalEl.dataset.discardModal;
  if (id && document.getElementById(id)) return document.getElementById(id);
  return document.querySelector('.modal[id*="iscard"]');
}

function crmCancelModal(modalEl, btn) {
  const modal = bootstrap.Modal.getOrCreateInstance(modalEl);
  const changed =
    modalEl.dataset.snapshot !== undefined &&
    crmFormState(modalEl) !== modalEl.dataset.snapshot;

  if (!changed) {
    modal.hide();
    return;
  } // Close immediately when nothing changed.

  const discardEl = crmFindDiscardModal(btn, modalEl);

  // Use a browser confirmation if no discard modal exists.
  if (!discardEl) {
    crmConfirm({
      title: "Discard changes?",
      message: "You have unsaved information in this form. If you leave now, it will be lost.",
      confirmText: "Discard",
      cancelText: "Back to Edit",
      danger: true,
    }).then((ok) => {
      if (ok) modal.hide(); // The Add form resets when hidden.
    });
    return;
  }

  // Return to the source modal when the user chooses Keep Edit.
  const keepBtn = discardEl.querySelector('[data-bs-toggle="modal"]');
  if (keepBtn) keepBtn.setAttribute("data-bs-target", "#" + modalEl.id);

  if (/^add/i.test(modalEl.id)) {
    const strong = discardEl.querySelector("strong.text-highlight");
    if (strong) {
      const nameInput = modalEl.querySelector(
        'input[type="text"]:not([readonly])',
      );
      strong.textContent = (nameInput && nameInput.value.trim()) || "this form";
    }
    modalEl.dataset.keepState = "1"; // Keep the Add form while the prompt is open.
    modalEl.dataset.pendingDiscard = "1"; // Reset it if the user discards changes.
  }

  // Close the form before showing the discard prompt.
  crmAfterHidden(modalEl, function () {
    bootstrap.Modal.getOrCreateInstance(discardEl).show();
  });
  modal.hide();
}

if (!window.__crmEditCancelBound) {
  window.__crmEditCancelBound = true;

  // Capture the cancel click before Bootstrap dismisses the modal.
  document.addEventListener(
    "click",
    function (e) {
      let modalEl = null,
        btn = null;
      const jsBtn = e.target.closest(".js-edit-cancel"); // Handle Edit cancel buttons.
      if (jsBtn) {
        btn = jsBtn;
        modalEl = document.getElementById(jsBtn.dataset.editModal);
      } else {
        const dismiss = e.target.closest('[data-bs-dismiss="modal"]');
        const host = dismiss ? dismiss.closest(".modal") : null;
        // The close button bypasses the discard prompt.
        const isX = dismiss && dismiss.classList.contains("btn-close");
        if (
          host &&
          !isX &&
          /^add/i.test(host.id) &&
          dismiss.type !== "submit"
        ) {
          btn = dismiss;
          modalEl = host;
        }
      }
      if (!modalEl) return;

      e.preventDefault();
      e.stopPropagation();
      crmCancelModal(modalEl, btn);
    },
    true,
  );

  // Handle the discard prompt buttons.
  document.addEventListener("click", function (e) {
    const b = e.target.closest('.modal[id*="iscard"] button');
    if (!b) return;
    const isKeep = b.hasAttribute("data-bs-toggle"); // Keep Edit reopens the form.
    document
      .querySelectorAll('.modal[data-pending-discard="1"]')
      .forEach((m) => {
        m.dataset.pendingDiscard = "0";
        if (!isKeep) crmResetModal(m); // Discard resets the Add form.
      });
  });

  // Treat Escape or an outside click as discard.
  document.addEventListener("hidden.bs.modal", function (e) {
    if (!/iscard/.test(e.target.id)) return;
    document
      .querySelectorAll('.modal[data-pending-discard="1"]')
      .forEach((m) => {
        m.dataset.pendingDiscard = "0";
        crmResetModal(m);
      });
  });
}

// Initialize direct page loads; the shell initializes injected pages.
document.addEventListener("DOMContentLoaded", () => {
  window.loadCrmPageData();
});

// Format phone number inputs.
document.addEventListener("DOMContentLoaded", () => {
  document.addEventListener("input", function (e) {
    if (e.target && e.target.classList.contains("phone-input-field")) {
      e.target.value = crmFormatPhone(e.target.value);
    }
  });

  // Prevent Backspace from removing the +63 prefix.
  document.addEventListener("keydown", function (e) {
    if (
      e.target &&
      e.target.classList.contains("phone-input-field") &&
      e.key === "Backspace"
    ) {
      const el = e.target;
      if (el.selectionStart === el.selectionEnd && el.selectionStart <= 4)
        e.preventDefault();
    }
  });
});

// ==========================================================================
// MENU MANAGEMENT (Admin + Manager)  -  menu-management.html  <->  menu-management.php
// The same menu is what customers pick from in the inquiry form (customer-pages.js).
// ==========================================================================
function crmInitMenuManagement(page) {
  const $ = (id) => page.querySelector('#' + id);
  const api = page.dataset.api || 'menu-management.php';
  const state = { items: [], cat: 'all', q: '', sort: 'default', csrf: '', editId: null, deleteId: null, busy: false };

  const el = (tag, cls, text) => {
    const n = document.createElement(tag);
    if (cls) n.className = cls;
    if (text !== undefined && text !== null) n.textContent = text;
    return n;
  };
  const icon = (cls) => { const i = el('i', 'bi ' + cls); i.setAttribute('aria-hidden', 'true'); return i; };
  const modal = (id) => (window.bootstrap ? window.bootstrap.Modal.getOrCreateInstance($(id)) : null);
  const firstNumber = (price) => { const m = String(price || '').replace(/,/g, '').match(/\d+(\.\d+)?/); return m ? Number(m[0]) : 0; };

  function toast(message) {
    if (window.crmToast) window.crmToast(message, "success");
    else console.error("CRM toast component was not loaded before menu management.");
  }

  const peso = (n) => '\u20B1' + Number(n || 0).toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  async function send(action, body) {
    const options = { credentials: 'same-origin', headers: { Accept: 'application/json' }, cache: 'no-store' };
    if (body) {
      body.set('csrf_token', state.csrf);                    // always the newest token we have
      options.method = 'POST'; options.body = body; options.headers['X-CSRF-Token'] = state.csrf;
    }
    const response = await fetch(api + '?action=' + action, options);
    let json = null;
    try { json = await response.json(); } catch (e) { /* not JSON */ }
    if (!response.ok || !json || !json.success) {
      const error = new Error(((json && json.message) || 'Something went wrong. Please try again.') + (json && json.detail ? ' [' + json.detail + ']' : ''));
      error.status = response.status;
      throw error;
    }
    return json;
  }

  // asks the server for a fresh CSRF token (Admin / Manager only)
  async function refreshToken() {
    try {
      const json = await send('token');
      if (json.csrf_token) { state.csrf = json.csrf_token; return true; }
    } catch (e) { /* not allowed / offline */ }
    return false;
  }

  // A stale token ("session expired") is fixed automatically: get a new token and try ONCE more.
  async function call(action, body) {
    if (body && !state.csrf) await refreshToken();
    try {
      return await send(action, body);
    } catch (error) {
      if (body && error.status === 403 && /session expired/i.test(error.message) && (await refreshToken())) return await send(action, body);
      throw error;
    }
  }

  // ---------- list ----------
  function visibleItems() {
    const q = state.q.trim().toLowerCase();
    let list = state.items.filter((it) =>
      (state.cat === 'all' || it.category === state.cat) &&
      (!q || [it.name, it.category, it.price, it.specs].concat((it.tiers || []).map((t) => t.name + ' ' + t.pax)).some((v) => String(v || '').toLowerCase().includes(q))));
    if (state.sort === 'name-asc') list.sort((a, b) => a.name.localeCompare(b.name));
    if (state.sort === 'name-desc') list.sort((a, b) => b.name.localeCompare(a.name));
    if (state.sort === 'price-asc') list.sort((a, b) => firstNumber(a.price) - firstNumber(b.price));
    if (state.sort === 'price-desc') list.sort((a, b) => firstNumber(b.price) - firstNumber(a.price));
    return list;
  }

  function photoBox(item) {
    const media = el('div', 'mm-media');
    const ph = icon('bi-image mm-media-ph');
    media.appendChild(ph);
    if (item.photo) {
      const img = el('img', 'mm-media-img');
      img.src = item.photo; img.alt = item.name; img.loading = 'lazy'; img.decoding = 'async';
      img.addEventListener('error', () => { img.remove(); media.classList.add('is-missing'); });
      media.appendChild(img);
    } else media.classList.add('is-missing');
    media.appendChild(el('span', 'mm-price', item.price));
    return media;
  }

  function render() {
    ['all', 'Lechon', 'Bilao', 'Viands'].forEach((c) => {
      const n = c === 'all' ? state.items.length : state.items.filter((i) => i.category === c).length;
      const badge = page.querySelector('[data-count="' + c + '"]');
      if (badge) badge.textContent = n;
    });
    page.querySelectorAll('.mm-tab').forEach((t) => t.classList.toggle('active', t.dataset.cat === state.cat));

    const grid = $('mmGrid');
    const list = visibleItems();
    grid.textContent = '';
    $('mmState').hidden = list.length > 0;
    if (!list.length) {
      const searching = state.items.length > 0;
      const box = el('div', 'crm-no-results-state');
      box.append(
        icon(searching ? 'bi-search' : 'bi-journal-plus'),
        el('p', 'crm-no-results-title', searching ? 'No results found' : 'No menu items yet'),
        el('p', 'crm-no-results-description', searching ? 'Try changing your search or category.' : 'Click "Add Menu Item" to create the first one.')
      );
      $('mmState').textContent = '';
      $('mmState').appendChild(box);
    }

    list.forEach((item) => {
      const card = el('article', 'mm-card');
      card.appendChild(photoBox(item));
      const body = el('div', 'mm-card-body');
      body.appendChild(el('span', 'mm-tag', item.category));
      body.appendChild(el('h3', 'mm-name', item.name));
      body.appendChild(el('p', 'mm-specs', item.specs || 'Serving capacity not provided'));
      body.appendChild(el('span', 'mm-availability', item.status || 'Active'));
      if (item.tiers && item.tiers.length) body.appendChild(el('p', 'mm-tier-count', item.tiers.length + (item.tiers.length === 1 ? ' portion tier' : ' portion tiers')));
      card.appendChild(body);

      const actions = el('div', 'mm-actions');
      const view = el('button', 'btn mm-view-btn', 'View Details');
      view.type = 'button'; view.dataset.mmView = item.id;
      const edit = el('button', 'mm-icon-btn');
      edit.type = 'button'; edit.dataset.mmEdit = item.id;
      edit.setAttribute('aria-label', 'Edit ' + item.name); edit.title = 'Edit';
      edit.appendChild(icon('bi-pencil-square'));
      const del = el('button', 'mm-icon-btn mm-icon-danger');
      del.type = 'button'; del.dataset.mmDelete = item.id;
      del.setAttribute('aria-label', 'Archive ' + item.name); del.title = 'Archive';
      del.appendChild(icon('bi-archive'));
      actions.append(view, edit, del);
      card.appendChild(actions);
      grid.appendChild(card);
    });
  }

  async function load() {
    $('mmState').hidden = false;
    $('mmState').textContent = 'Loading menu...';
    try {
      const data = await call('list');
      state.items = Array.isArray(data.items) ? data.items : [];
      state.csrf = data.csrf_token || '';
      render();
    } catch (error) {
      console.error('[Menu] load failed:', error);
      $('mmState').hidden = false;
      $('mmState').textContent = error.message || 'The menu could not be loaded.';
    }
  }

  // ---------- view ----------
  function openView(item) {
    $('mmViewCat').textContent = item.category;
    $('mmViewName').textContent = item.name;
    $('mmViewPrice').textContent = item.price;
    $('mmViewSpecs').textContent = item.specs;
    const tiers = item.tiers || [], tierList = $('mmViewTiers');
    tierList.textContent = '';
    tiers.forEach((t) => {
      const li = el('li', 'mm-view-tier');
      const left = el('div', 'mm-view-tier-main');
      left.appendChild(el('strong', '', t.name));
      if (t.pax) left.appendChild(el('span', '', t.pax));
      li.append(left, el('b', 'mm-view-tier-price', peso(t.price)));
      tierList.appendChild(li);
    });
    $('mmViewTiersBox').hidden = !tiers.length;
    const img = $('mmViewImg');
    img.hidden = !item.photo; $('mmViewPh').hidden = !!item.photo;
    if (item.photo) { img.src = item.photo; img.alt = item.name; img.onerror = () => { img.hidden = true; $('mmViewPh').hidden = false; }; }
    modal('mmViewModal').show();
  }

  // ---------- add / edit ----------
  const form = $('mmForm');
  function fieldError(name, message) {
    const err = form.querySelector('[data-err="' + name + '"]');
    if (!err) return;
    err.textContent = message || ''; err.hidden = !message;
    const input = form.elements[name];
    if (input && input.classList) input.classList.toggle('is-invalid', Boolean(message));
  }
  function setPreview(src) {
    const img = $('mmPreview');
    img.hidden = !src; $('mmDropEmpty').hidden = Boolean(src);
    if (src) img.src = src; else img.removeAttribute('src');
  }
  // ----- custom dropdowns (same markup / classes as the rest of the CRM; a hidden input holds the value) -----
  function setDd(root, value, announce) {
    if (!root) return;
    let chosen = null;
    root.querySelectorAll('.custom-dropdown-item').forEach((i) => {
      const on = i.getAttribute('data-value') === value;
      i.setAttribute('aria-selected', on ? 'true' : 'false');
      if (on) chosen = i;
    });
    if (!chosen) return;
    const hidden = root.querySelector('input[type="hidden"]');
    hidden.value = value;
    root.querySelector('.mm-dd-value').textContent = chosen.textContent.trim();
    if (announce) hidden.dispatchEvent(new Event('change', { bubbles: true }));
  }

  // ----- PAX / portion tiers -----
  const MAX_TIERS = 12;
  let tierSeq = 0;
  const tierBox = () => $('mmTierRows');
  function updateTierButton() { $('mmAddTier').disabled = tierBox().children.length >= MAX_TIERS; }
  function tierField(cls, labelText, input) {
    const wrap = el('div', 'mm-tier-field ' + cls);
    const id = 'mmTier' + (++tierSeq);
    const label = el('label', 'mm-tier-label', labelText); label.htmlFor = id; input.id = id;
    wrap.append(label, input);
    return wrap;
  }
  function addTierRow(t) {
    t = t || {};
    const row = el('div', 'mm-tier');
    row.dataset.tierId = t.tier_id || t.id || '';
    const name = el('input', 'mm-input mm-tier-input'); name.type = 'text'; name.maxLength = 100; name.placeholder = 'e.g. 1/4 KG Portion'; name.autocomplete = 'off'; name.dataset.tier = 'name'; name.value = t.name || '';
    const price = el('input', 'mm-input mm-tier-input'); price.type = 'text'; price.inputMode = 'decimal'; price.maxLength = 14; price.placeholder = '230'; price.autocomplete = 'off'; price.dataset.tier = 'price';
    price.value = t.price !== undefined && t.price !== null && t.price !== '' ? commaNumber(String(Number(t.price))) : '';
    const pax = el('input', 'mm-input mm-tier-input'); pax.type = 'text'; pax.maxLength = 150; pax.placeholder = 'e.g. Good for 2-3 PAX'; pax.autocomplete = 'off'; pax.dataset.tier = 'pax'; pax.value = t.pax || '';
    const del = el('button', 'mm-tier-del'); del.type = 'button'; del.setAttribute('aria-label', 'Remove tier'); del.title = 'Remove tier'; del.appendChild(icon('bi-trash3'));
    const top = el('div', 'mm-tier-top');
    top.append(tierField('mm-tier-name', 'Tier / Portion Name', name), tierField('mm-tier-price mm-tier-money', 'Price', price), del);
    row.append(top, tierField('mm-tier-pax', 'PAX Description', pax));
    tierBox().appendChild(row);
    updateTierButton();
  }
  function renderTierRows(list) {
    tierBox().textContent = '';
    (list && list.length ? list : [{}]).forEach(addTierRow);
    updateTierButton();
  }
  // reads the rows: blank rows are ignored; returns { tiers, error }
  function readTiers() {
    const tiers = []; let error = '';
    tierBox().querySelectorAll('.mm-tier').forEach((row, i) => {
      const get = (k) => row.querySelector('[data-tier="' + k + '"]');
      const name = get('name').value.trim(), pax = get('pax').value.trim(), raw = get('price').value.trim();
      [get('name'), get('price')].forEach((x) => x.classList.remove('is-invalid'));
      if (!name && !pax && !raw) return;
      const num = Number(raw.replace(/[,\u20B1\s]/g, ''));
      if (!name) { get('name').classList.add('is-invalid'); error = error || 'Tier ' + (i + 1) + ': enter the portion name.'; }
      if (!raw || !isFinite(num) || num < 0) { get('price').classList.add('is-invalid'); error = error || 'Tier ' + (i + 1) + ': enter a valid price.'; }
      tiers.push({ tier_id: Number(row.dataset.tierId) || null, name, price: isFinite(num) ? num : 0, pax });
    });
    return { tiers, error };
  }

  // ----- auto peso sign (display price) and PAX word (serving specs) -----
  function formatPesoText(raw) {
    const parts = String(raw || '').replace(/[\u20B1\s]/g, '').split(/[-\u2013\u2014]/);
    const out = parts.slice(0, 2).map((p) => {
      const clean = p.replace(/[^\d.]/g, '').replace(/(\..*)\./g, '$1');
      if (!clean) return '';
      const [whole, dec] = clean.split('.');
      return '\u20B1' + Number(whole || 0).toLocaleString('en-PH') + (dec !== undefined ? '.' + dec.slice(0, 2) : '');
    });
    const hasDash = parts.length > 1;
    if (!out[0] && !hasDash) return '';
    return hasDash ? (out[0] || '\u20B1') + ' \u2013 ' + (out[1] || '') : out[0];
  }
  function formatPaxText(raw, final) {
    const text = String(raw || '').replace(/\s*PAX\s*$/i, '').replace(/\s+/g, ' ');
    if (!text.trim()) return { value: '', caret: 0 };
    const simple = /^[\d\s\u2013\u2014-]*\d[\d\s\u2013\u2014-]*$/.test(text);
    if (simple) {
      const v = text.replace(/\s*[-\u2013\u2014]\s*/g, '\u2013').trim();
      return { value: v + ' PAX', caret: v.length };
    }
    if (final && /\d/.test(text) && !/pax/i.test(text)) return { value: text.trim() + ' PAX', caret: text.trim().length };
    return { value: String(raw), caret: null };
  }
  // tier price: thousands commas while typing, keeps the caret in place
  function commaNumber(raw) {
    const clean = String(raw || '').replace(/[^\d.]/g, '').replace(/(\..*)\./g, '$1');
    if (!clean) return '';
    const [whole, dec] = clean.split('.');
    const w = (whole || '0').replace(/^0+(?=\d)/, '').replace(/\B(?=(\d{3})+(?!\d))/g, ',');
    return w + (dec !== undefined ? '.' + dec.slice(0, 2) : '');
  }
  function formatTierPrice(input) {
    const pos = input.selectionStart == null ? input.value.length : input.selectionStart;
    const keep = input.value.slice(0, pos).replace(/[^\d.]/g, '').length;
    input.value = commaNumber(input.value);
    let seen = 0, caret = input.value.length;
    if (keep === 0) caret = 0;
    else for (let i = 0; i < input.value.length; i++) { if (/[\d.]/.test(input.value[i]) && ++seen === keep) { caret = i + 1; break; } }
    try { input.setSelectionRange(caret, caret); } catch (e) { /* not focused */ }
  }
  // tier PAX description: "2-3" becomes "Good for 2-3 PAX"
  function formatTierPax(input, final) {
    const raw = input.value;
    const core = raw.replace(/^\s*good for\s*/i, '').replace(/\s*PAX\s*$/i, '').replace(/\s+/g, ' ').trim();
    if (!core) { if (!final || !raw.trim() || /\d/.test(raw)) input.value = ''; return; }
    const simple = /^\d[\d\s\u2013\u2014-]*$/.test(core);
    if (simple) {
      const v = core.replace(/\s*[-\u2013\u2014]\s*/g, '-');
      const out = 'Good for ' + v + ' PAX';
      if (input.value !== out) { input.value = out; const c = 'Good for '.length + v.length; input.setSelectionRange(c, c); }
    } else if (final && /\d/.test(core)) {
      input.value = (/^good for/i.test(raw.trim()) ? '' : 'Good for ') + raw.trim().replace(/\s*PAX\s*$/i, '') + ' PAX';
    }
  }
  function bindMoneyAndPax() {
    const price = form.elements.display_price, specs = form.elements.serving_specs;
    price.addEventListener('input', () => { price.value = formatPesoText(price.value); });
    price.addEventListener('blur', () => { price.value = price.value.replace(/[\s\u2013]+$/, ''); });
    specs.addEventListener('input', () => {
      const r = formatPaxText(specs.value, false);
      if (r.caret === null) return;
      specs.value = r.value; specs.setSelectionRange(r.caret, r.caret);
    });
    specs.addEventListener('blur', () => { specs.value = formatPaxText(specs.value, true).value; });
    // tier rows: price keeps digits only (the peso sign is drawn by CSS), PAX description gets the word PAX
    tierBox().addEventListener('input', (e) => {
      if (e.target.dataset.tier === 'price') formatTierPrice(e.target);
      if (e.target.dataset.tier === 'pax' && e.inputType !== 'deleteContentBackward' && e.inputType !== 'deleteContentForward') formatTierPax(e.target, false);
    });
    tierBox().addEventListener('focusout', (e) => {
      if (e.target.dataset.tier === 'pax') formatTierPax(e.target, true);
    });
  }

  // ----- unsaved changes: Back to Edit / Discard -----
  const formModalEl = $('mmFormModal'), discardEl = $('mmDiscardModal');
  function formSnapshot() {
    const file = form.elements.photo.files[0];
    return JSON.stringify([
      form.elements.item_name.value, form.elements.category.value, form.elements.display_price.value, form.elements.serving_specs.value,
      Array.from(tierBox().querySelectorAll('input')).map((i) => i.value),
      file ? file.name + ':' + file.size : ''
    ]);
  }
  const isDirty = () => state.snapshot !== undefined && formSnapshot() !== state.snapshot;
  function askDiscard() {
    $('mmDiscardName').textContent = form.elements.item_name.value.trim() || 'this menu item';
    state.forceClose = true;
    crmAfterHidden(formModalEl, () => { state.forceClose = false; modal('mmDiscardModal').show(); });
    modal('mmFormModal').hide();
  }
  formModalEl.addEventListener('hide.bs.modal', (e) => {   // X, Cancel, Esc and outside click all land here
    if (state.forceClose || !isDirty()) return;
    e.preventDefault();
    askDiscard();
  });
  formModalEl.addEventListener('hidden.bs.modal', () => { if (!discardEl.classList.contains('show')) state.forceClose = false; });
  $('mmDiscardBack').addEventListener('click', () => {
    crmAfterHidden(discardEl, () => modal('mmFormModal').show());
    modal('mmDiscardModal').hide();
  });

  // Portion tiers are available for every category (Bilao may still use a single price instead).
  function syncTierPanel(category) {
    const cat = category || form.elements.category.value;
    $('mmTiers').hidden = false;
    $('mmPrice').placeholder = cat === 'Bilao' ? 'e.g. 1,150 (or add portion tiers below)' : 'Tier prices are entered below';
  }
  function resetForm(item) {
    form.reset();
    ['item_name', 'category', 'display_price', 'serving_specs', 'tiers', 'photo'].forEach((n) => fieldError(n, ''));
      setDd($('mmCategoryDd'), item ? item.category : 'Lechon', false);
      syncTierPanel();
    $('mmFormError').hidden = true;
    state.editId = item ? item.id : null;
    $('mmFormTitle').textContent = item ? 'Edit Menu Item' : 'Add New Menu Item';
    $('mmSave').textContent = item ? 'Save Changes' : 'Save Menu Item';
    if (item) {
      form.elements.item_name.value = item.name;
      form.elements.display_price.value = item.price;
      form.elements.serving_specs.value = item.specs;
    }
    renderTierRows(item ? item.tiers : []);
    setPreview(item && item.photo ? item.photo : '');
    state.snapshot = formSnapshot();
  }
  function validate() {
    let ok = true;
    const category = form.elements.category.value;
    const need = { item_name: 'Enter the item name.' };
    Object.keys(need).forEach((n) => {
      const empty = !form.elements[n].value.trim();
      fieldError(n, empty ? need[n] : ''); if (empty) ok = false;
    });
    const tierCheck = readTiers();
    fieldError('tiers', tierCheck.error);
    if (tierCheck.error) ok = false;
    if (category !== 'Bilao' && !tierCheck.tiers.length) { fieldError('tiers', 'Add at least one price tier.'); ok = false; }
    // Bilao: either portion tiers or one item price
    if (category === 'Bilao' && !tierCheck.tiers.length && !form.elements.display_price.value.trim()) {
      fieldError('display_price', 'Add a portion tier below or enter the item price.'); ok = false;
    }
    const file = form.elements.photo.files[0];
    if (!file && !state.editId) { fieldError('photo', 'Upload a photo of the item.'); ok = false; }
    else if (file && !/^image\/(png|jpe?g|webp)$/.test(file.type)) { fieldError('photo', 'Use a PNG, JPG or WEBP photo.'); ok = false; }
    else if (file && file.size > 5 * 1024 * 1024) { fieldError('photo', 'The photo must be 5 MB or smaller.'); ok = false; }
    else fieldError('photo', '');
    return ok;
  }
  // Shrinks a big photo (max 1400px, WEBP) before upload, so saving a menu item is fast and the cards load fast.
  // Returns null when it cannot (the original file is then uploaded as before).
  async function shrinkPhoto(file) {
    try {
      if (!file || file.size < 300 * 1024 || !window.createImageBitmap) return null;
      const bmp = await createImageBitmap(file);
      const scale = Math.min(1, 1400 / Math.max(bmp.width, bmp.height));
      const w = Math.max(1, Math.round(bmp.width * scale)), h = Math.max(1, Math.round(bmp.height * scale));
      const canvas = document.createElement('canvas');
      canvas.width = w; canvas.height = h;
      canvas.getContext('2d').drawImage(bmp, 0, 0, w, h);
      if (bmp.close) bmp.close();
      const blob = await new Promise((resolve) => canvas.toBlob(resolve, 'image/webp', 0.82));
      if (!blob || blob.type !== 'image/webp' || blob.size >= file.size) return null;
      return new File([blob], file.name.replace(/\.[^.]+$/, '') + '.webp', { type: 'image/webp' });
    } catch (e) { return null; }
  }
  function takeFile(file) {
    if (!file) return;
    const transfer = new DataTransfer(); transfer.items.add(file);
    form.elements.photo.files = transfer.files;
    setPreview(URL.createObjectURL(file));
    fieldError('photo', '');
  }

  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    if (state.busy || !validate()) return;
    state.busy = true; $('mmSave').disabled = true; $('mmFormError').hidden = true;
    try {
      const body = new FormData(form);
      const pickedPhoto = form.elements.photo.files[0];
      if (pickedPhoto) { const small = await shrinkPhoto(pickedPhoto); if (small) body.set('photo', small, small.name); }
      body.set('csrf_token', state.csrf);
      body.set('tiers', JSON.stringify(readTiers().tiers));
      if (state.editId) body.set('menu_item_id', state.editId);
      const data = await call(state.editId ? 'edit' : 'add', body);
      if (state.editId) state.items = state.items.map((i) => (i.id === data.item.id ? data.item : i));
      else state.items.push(data.item);
      render();
      state.forceClose = true;
      modal('mmFormModal').hide();
      toast(data.message || 'Saved.');
    } catch (error) {
      $('mmFormError').textContent = error.message; $('mmFormError').hidden = false;
    } finally {
      state.busy = false; $('mmSave').disabled = false;
    }
  });

  bindMoneyAndPax();
  form.elements.photo.addEventListener('change', () => takeFile(form.elements.photo.files[0]));
  const drop = $('mmDrop');
  ['dragenter', 'dragover'].forEach((t) => drop.addEventListener(t, (e) => { e.preventDefault(); drop.classList.add('is-over'); }));
  ['dragleave', 'drop'].forEach((t) => drop.addEventListener(t, (e) => { e.preventDefault(); drop.classList.remove('is-over'); }));
  drop.addEventListener('drop', (e) => takeFile(e.dataTransfer && e.dataTransfer.files[0]));
  form.addEventListener('input', (e) => { if (e.target.name) fieldError(e.target.name, ''); });

  // ---------- delete ----------
  $('mmDeleteConfirm').addEventListener('click', async () => {
    if (state.busy || state.deleteId === null) return;
    state.busy = true; $('mmDeleteConfirm').disabled = true; $('mmDeleteError').hidden = true;
    try {
      const body = new FormData();
      body.set('menu_item_id', state.deleteId); body.set('csrf_token', state.csrf);
      const data = await call('delete', body);
      state.items = state.items.filter((i) => i.id !== state.deleteId);
      render();
      modal('mmDeleteModal').hide();
      toast(data.message || 'Deleted.');
    } catch (error) {
      $('mmDeleteError').textContent = error.message; $('mmDeleteError').hidden = false;
    } finally {
      state.busy = false; $('mmDeleteConfirm').disabled = false;
    }
  });

  // ---------- page events ----------
  $('mmAddBtn').addEventListener('click', () => { resetForm(null); modal('mmFormModal').show(); });
  $('mmTabs').addEventListener('click', (e) => {
    const tab = e.target.closest('.mm-tab');
    if (tab) { state.cat = tab.dataset.cat; render(); }
  });
  let mmSearchTimer = 0;
  $('mmSearch').addEventListener('input', (e) => { state.q = e.target.value; clearTimeout(mmSearchTimer); mmSearchTimer = setTimeout(render, 150); });
  $('mmSort').addEventListener('change', (e) => { state.sort = e.target.value; render(); });

  // custom dropdowns: choose an option (stopPropagation keeps the CRM's table-filter handler out of this page)
  page.addEventListener('click', (e) => {
    const item = e.target.closest('.mm-dropdown .custom-dropdown-item');
    if (!item) return;
    e.preventDefault(); e.stopPropagation();
    const root = item.closest('.mm-dropdown');
    setDd(root, item.getAttribute('data-value'), true);
    const toggle = root.querySelector('.custom-dropdown-toggle');
    if (toggle && window.bootstrap) window.bootstrap.Dropdown.getOrCreateInstance(toggle).hide();
  });
  // keep an opened list inside the scrolling form
  page.addEventListener('shown.bs.dropdown', (e) => {
    const menu = e.target.parentNode && e.target.parentNode.querySelector('.dropdown-menu');
    if (menu && menu.scrollIntoView) menu.scrollIntoView({ block: 'nearest' });
  });

  // tiers: add / remove a row
  $('mmCategoryDd').addEventListener('click', (e) => {
    const option = e.target.closest('.custom-dropdown-item');
    if (!option) return;
    syncTierPanel(option.dataset.value);
  });
  $('mmAddTier').addEventListener('click', () => {
    if (tierBox().children.length >= MAX_TIERS) return;
    addTierRow({});
    const last = tierBox().lastElementChild; if (last) last.querySelector('input').focus();
  });
  tierBox().addEventListener('click', (e) => {
    const del = e.target.closest('.mm-tier-del');
    if (!del) return;
    del.closest('.mm-tier').remove();
    if (!tierBox().children.length) addTierRow({});
    updateTierButton();
  });
  tierBox().addEventListener('input', (e) => { e.target.classList.remove('is-invalid'); fieldError('tiers', ''); });
  $('mmGrid').addEventListener('click', (e) => {
    const find = (attr) => { const b = e.target.closest('[' + attr + ']'); return b ? state.items.find((i) => i.id === Number(b.getAttribute(attr))) : null; };
    const view = find('data-mm-view'), edit = find('data-mm-edit'), del = find('data-mm-delete');
    if (view) openView(view);
    if (edit) { resetForm(edit); modal('mmFormModal').show(); }
    if (del) {
      state.deleteId = del.id; $('mmDeleteName').textContent = del.name; $('mmDeleteError').hidden = true;
      modal('mmDeleteModal').show();
    }
  });

  load();
}
window.crmInitMenuManagement = crmInitMenuManagement;

// ==========================================================================
// SHARED REPORTS CODE
//
// ONE code path for every Reports page: Sales Staff, Customer Service Staff,
// Manager, Admin ... Each report page only needs this HTML contract:
//
//   <main id="reportsPage" data-report-type="tickets" data-report-title="Customer Service Staff Report">
//   - summary cards   : <span class="stat-label">..</span> + <div class="stat-number">..</div> inside a .card
//   - vertical charts : <div class="rp-chart"  id=".." data-report-chart="Tickets by Status" data-items='[{"label":"Open","count":4}]'>
//   - horizontal chart: <div class="rp-hchart" id=".." data-report-chart="Tickets by Assigned Staff" data-items='[{"label":"Jordan Lee","count":1}]'>
//   - the table       : <table data-report-table="Customer Service Tickets"> (optional data-empty-text="...")
//   - date label      : <span id="reportDateLabel">This Year</span>
//   - buttons         : #exportCsvBtn (Excel) and #downloadPdfBtn
//
// data-report-type is only used by the console number check:
//   "tickets"        -> Total Tickets / Open / Pending / Resolved
//   anything else    -> sales: Total Leads / Total Deals / Confirmed Deals
// ==========================================================================

// Exact colors (same name on every page = same color)
const CRM_REPORT_COLORS = {
  // sales
  'new inquiry': '#6B7280',
  'in progress': CRM_PALETTE.blue,
  'in discussion': '#F97316',
  'quotation preparation': '#1E40AF',
  'quotation sent': '#FEF08A',
  'negotiation': '#7C3AED',
  'confirmed': CRM_PALETTE.green,
  'declined': CRM_PALETTE.red,
  // customer service: status
  'open': CRM_PALETTE.red,
  'pending': CRM_PALETTE.amber,
  'resolved': CRM_PALETTE.green,
  // customer service: priority
  'high': CRM_PALETTE.orange,
  'medium': CRM_PALETTE.yellow,
  'low': CRM_PALETTE.green
};

// ---- vertical chart markup (used by the page, the PDF and the Excel pictures) ----
function crmChartHTML(items, opts) {
  items = items || [];
  opts = opts || {};
  // opts.fit (Admin / Manager reports): the tallest bar fills the chart, like the mockups
  const top = Math.max(opts.fit ? 1 : 4, ...items.map(i => Number(i.count) || 0));
  const step = opts.fit ? top / 4 : Math.ceil(top / 4);
  const max = step * 4;
  const ticks = [0, 1, 2, 3, 4].map(n => n * step);
  const n = Math.max(items.length, 1);
  return '<div class="rp-ytitle">Count</div><div class="rp-area">' +
    ticks.map(t => '<i class="rp-grid" style="bottom:' + (t / max * 100) + '%"></i>' +
                   '<span class="rp-ytick" style="bottom:' + (t / max * 100) + '%">' + t + '</span>').join('') +
    '<div class="rp-cols" style="--n:' + n + '">' +
      items.map(i => {
        const c = Number(i.count) || 0;
        const color = i.color || CRM_REPORT_COLORS[String(i.label).toLowerCase()] || '#6B7280';
        return '<div class="rp-col"><span class="rp-val">' + (i.display != null ? crmEscape(i.display) : c) + '</span>' +
               '<div class="rp-bar' + (c === 0 ? ' is-zero' : '') + '" style="height:' + (c / max * 100) + '%;background:' + color + '"></div></div>';
      }).join('') +
    '</div></div>' +
    '<div class="rp-xlabels" style="--n:' + n + '">' +
      items.map(i => '<span>' + crmEscape(i.label) + '</span>').join('') + '</div>';
}

// ---- horizontal chart markup (Tickets by Assigned Staff) ----
// One green bar per staff member, the number sits at the end of the bar.
function crmHChartHTML(items) {
  items = items || [];
  const top = Math.max(4, ...items.map(i => Number(i.count) || 0));
  const step = Math.ceil(top / 4);
  const max = step * 4;
  const ticks = [0, 1, 2, 3, 4].map(n => n * step);
  return items.map(i => {
    const c = Number(i.count) || 0;
    const color = i.color || CRM_PALETTE.green;
    return '<div class="rp-hrow"><div class="rp-hname">' + crmEscape(i.label) + '</div>' +
           '<div class="rp-htrack"><div class="rp-hbar" style="width:calc((100% - 30px) * ' + (c / max) + ');background:' + color + '"></div>' +
           '<span class="rp-hval">' + c + '</span></div></div>';
  }).join('') +
  '<div class="rp-haxis">' + ticks.map(t => '<span>' + t + '</span>').join('') + '</div>';
}

// Default colors for the Activities by Status chart (its names clash with the Sales colors,
// e.g. "In Progress" is light blue for leads but yellow for activities).
// An explicit "color" in an item always wins over these defaults.
const CRM_ACTIVITY_COLORS = { 'upcoming': CRM_PALETTE.purple, 'in progress': CRM_PALETTE.blue, 'completed': CRM_PALETTE.green, 'cancelled': CRM_PALETTE.red };

// Draw a bar chart. boxIdOrElement = 'ticketsByStatusChart' or the element itself.
// items = [{ label: 'Open', count: 4 }, ...]   (a backend can call this after a date change)
// A box with class "rp-hchart" is drawn horizontally, a box with class "rp-chart" vertically.
//
// COLORS: the color is decided HERE and saved into box._items, so the page, the PDF and the
// Excel all use the same color. Order:
//   1. an explicit "color" in the item
//   2. Activities by Status colors (CRM_ACTIVITY_COLORS)
//   3. a known status / stage / priority name (CRM_REPORT_COLORS)
//   4. anything else (staff names, activity types ...) = green, never grey
function crmDrawChart(boxIdOrElement, items) {
  const box = typeof boxIdOrElement === 'string' ? document.getElementById(boxIdOrElement) : boxIdOrElement;
  if (!box) return;
  const style = box.getAttribute('data-chart-style');
  if (style && CRM_RP_RENDERERS[style]) {            // line / donut / meter / stack (Admin + Manager reports)
    box._items = items || [];
    box._w = Math.round(box.clientWidth);
    box.innerHTML = CRM_RP_RENDERERS[style](box._items, box);
    if (style === 'line' && !box._ro && window.ResizeObserver) {
      box._ro = new ResizeObserver(() => {
        const w = Math.round(box.clientWidth);
        if (w && Math.abs(w - (box._w || 0)) > 6) crmDrawChart(box, box._items);
      });
      box._ro.observe(box);
    }
    return;
  }
  box._items = (items || []).map(i => {
    const key = String(i.label).toLowerCase();
    let c = i.color;
    if (!c && box.id === 'activitiesByStatusChart') c = CRM_ACTIVITY_COLORS[key];
    if (!c && !CRM_REPORT_COLORS[key]) c = CRM_PALETTE.green;
    return c ? Object.assign({}, i, { color: c }) : i;
  });
  box.innerHTML = box.classList.contains('rp-hchart') ? crmHChartHTML(box._items) : crmChartHTML(box._items, { fit: !!box.closest('.sd-dashboard') });
}
window.crmDrawChart = crmDrawChart;

// ==========================================================================
// ADMIN / MANAGER REPORTS  (manager-admin-report.html)
// Same look as the Admin / Manager dashboard: the donut (crmOpsDonut), colour tables (CRM_OPS_*) and
// pills (crmOpsPill) are REUSED. Only four drawings are new: line, meter (progress bars), stack, plus
// the plain bar chart without axis. Each box picks its drawing from data-chart-style="line|donut|meter|stack".
// ==========================================================================
const CRM_RP_COLORS = {
  green: CRM_PALETTE.green, blue: CRM_PALETTE.blue, orange: CRM_PALETTE.amber, teal: CRM_PALETTE.teal, grey: CRM_PALETTE.grey, slate: CRM_PALETTE.slate, red: CRM_PALETTE.red,
  customerMix: { 'new customers': CRM_PALETTE.green, 'returning customers': CRM_PALETTE.blue },
  arrangement: { 'customer pickup': CRM_PALETTE.amber, 'food delivery': CRM_PALETTE.green, 'on-site catering': CRM_PALETTE.blue, 'buffet with setup': CRM_PALETTE.blue },
  priority: { low: CRM_PALETTE.green, medium: CRM_PALETTE.yellow, high: CRM_PALETTE.orange, urgent: CRM_PALETTE.red },
  ticketStatus: { 'open': CRM_PALETTE.red, 'in progress': CRM_PALETTE.blue, 'waiting for customer': CRM_PALETTE.amber, 'resolved': CRM_PALETTE.green, 'closed': CRM_PALETTE.slate },
  stage: { 'new inquiry': CRM_PALETTE.slate, 'in progress': CRM_PALETTE.blue, 'declined': CRM_PALETTE.red }
};

function crmRpFmt(v) { return Number.isInteger(v) ? String(v) : String(Math.round(v * 10) / 10); }

function crmRpEmpty() { return '<div class="sd-empty"><strong>No data yet</strong><span>Nothing recorded for this period.</span></div>'; }

// ---- line chart: smooth curve, soft gradient area, value above every point, 3 grid lines (0, half, max) ----
// Drawn at the REAL width of its card (so text is never stretched); redrawn when the card is resized or its tab is opened.
function crmRpMonotone(pts) {            // smooth curve that never overshoots (monotone cubic), returns bezier segments
  const n = pts.length, segs = [];
  if (n < 2) return segs;
  const dx = [], m = [], t = [];
  for (let i = 0; i < n - 1; i++) { dx[i] = pts[i + 1][0] - pts[i][0]; m[i] = dx[i] ? (pts[i + 1][1] - pts[i][1]) / dx[i] : 0; }
  t[0] = m[0]; t[n - 1] = m[n - 2];
  for (let i = 1; i < n - 1; i++) {
    if (m[i - 1] * m[i] <= 0) t[i] = 0;
    else { const lim = 3 * Math.min(Math.abs(m[i - 1]), Math.abs(m[i])); t[i] = Math.sign(m[i]) * Math.min(Math.abs((m[i - 1] + m[i]) / 2), lim); }
  }
  for (let i = 0; i < n - 1; i++)
    segs.push([pts[i][0] + dx[i] / 3, pts[i][1] + t[i] * dx[i] / 3, pts[i + 1][0] - dx[i] / 3, pts[i + 1][1] - t[i + 1] * dx[i] / 3, pts[i + 1][0], pts[i + 1][1]]);
  return segs;
}
window.crmRpMonotone = crmRpMonotone;
const crmRpSplitLabel = l => { const m = String(l).match(/^(.*?)\s*(\(.*\))$/); return m ? [m[1], m[2]] : [String(l), '']; };   // "Wk 1 (Nov 1)" -> ["Wk 1","(Nov 1)"]

function crmRpLineChart(items, box, o) {
  if (!items.length) return crmRpEmpty();
  o = o || {};
  const W = Math.max(260, Math.round(o.width || (box && box.clientWidth) || 640)), H = o.height || 236;
  const pad = { l: 38, r: 22, t: 38, b: 50 };
  const vals = items.map(i => Number(i.count) || 0);
  const top = Math.max(1, ...vals), n = items.length;
  const slot = (W - pad.l - pad.r) / n;
  const xOf = i => pad.l + slot * (i + 0.5);
  const yOf = v => H - pad.b - v / top * (H - pad.t - pad.b);
  const base = H - pad.b, gid = 'rpg' + String((box && box.id) || 'x').replace(/\W/g, '');
  let out = '<defs><linearGradient id="' + gid + '" x1="0" y1="0" x2="0" y2="1">' +
    '<stop offset="0" style="stop-color:var(--sd-green,#165c43)" stop-opacity="0.24"/><stop offset="1" style="stop-color:var(--sd-green,#165c43)" stop-opacity="0"/></linearGradient></defs>';
  [top, top / 2, 0].forEach(v => {
    out += '<line class="sd-grid' + (v === 0 ? '' : ' rp-dash') + '" x1="' + pad.l + '" x2="' + (W - pad.r) + '" y1="' + yOf(v) + '" y2="' + yOf(v) + '"/>' +
           '<text class="sd-axis" x="' + (pad.l - 10) + '" y="' + (yOf(v) + 4) + '" text-anchor="end">' + crmRpFmt(v) + '</text>';
  });
  const pts = vals.map((v, i) => [xOf(i), yOf(v)]);
  const segs = crmRpMonotone(pts);
  const curve = segs.map(s => 'C' + s.map(x => Math.round(x * 100) / 100).join(' ')).join('');
  const start = 'M' + pts[0][0] + ' ' + pts[0][1];
  if (n > 1) out += '<path class="rp-line-area" fill="url(#' + gid + ')" d="' + start + curve + 'L' + pts[n - 1][0] + ' ' + base + 'L' + pts[0][0] + ' ' + base + 'z"/>' +
                    '<path class="sd-line rp-line-path" d="' + start + curve + '"/>';
  const peak = vals.indexOf(Math.max(...vals));
  items.forEach((it, i) => {
    const v = vals[i], p = pts[i], l = crmRpSplitLabel(it.label);
    if (i === peak && v > 0) out += '<circle class="rp-halo" cx="' + p[0] + '" cy="' + p[1] + '" r="10"/>';
    out += '<circle class="rp-dot" cx="' + p[0] + '" cy="' + p[1] + '" r="4.5"><title>' + crmEscape(it.label) + ': ' + v + '</title></circle>' +
           '<text class="rp-line-val' + (v === 0 ? ' is-zero' : '') + '" x="' + p[0] + '" y="' + (p[1] - 14) + '" text-anchor="middle">' + crmRpFmt(v) + '</text>' +
           '<text class="rp-xlab" x="' + p[0] + '" y="' + (H - 27) + '" text-anchor="middle">' + crmEscape(l[0]) + '</text>' +
           (l[1] ? '<text class="rp-xlab2" x="' + p[0] + '" y="' + (H - 12) + '" text-anchor="middle">' + crmEscape(l[1]) + '</text>' : '');
  });
  return '<div class="rp-line">' + '<svg class="sd-svg" width="' + W + '" height="' + H + '" viewBox="0 0 ' + W + ' ' + H + '" aria-hidden="true">' + out + '</svg></div>';
}

// ---- meter: name + number on one line, a rounded track with a coloured fill underneath ----
function crmRpMeterHTML(items) {
  if (!items.length) return crmRpEmpty();
  const max = Math.max(1, ...items.map(i => Number(i.count) || 0));
  return '<div class="rp-meter">' + items.map(i => {
    const c = Number(i.count) || 0;
    return '<div class="rp-meter-row"><div class="rp-meter-head"><span>' + crmEscape(i.label) + '</span><b>' + c + '</b></div>' +
           '<div class="rp-meter-track"><i class="rp-fill" style="width:' + (c / max * 100) + '%;background:' + (i.color || CRM_RP_COLORS.green) + '"></i></div></div>';
  }).join('') + '</div>';
}

// ---- stack: one full-width bar per staff, split by stage. item = { label, segments:[{label,count,color}] } ----
function crmRpStackHTML(items) {
  if (!items.length) return crmRpEmpty();
  const first = items[0].segments || [];
  const legend = first.map(s => '<span><i class="ops-swatch" style="background:' + s.color + '"></i>' + crmEscape(s.label) + '</span>').join('');
  const rows = items.map(it => {
    const segs = it.segments || [];
    const total = segs.reduce((a, s) => a + (Number(s.count) || 0), 0);
    const text = segs.map(s => crmEscape(s.label) + ': <b>' + (Number(s.count) || 0) + '</b>').join(' &bull; ') + ' (Total: <b>' + total + '</b>)';
    const bar = segs.filter(s => Number(s.count) > 0).map(s =>
      '<i class="rp-fill" style="width:' + (s.count / total * 100) + '%;background:' + s.color + '" title="' + crmEscape(s.label) + ': ' + s.count + '"></i>').join('');
    return '<div class="rp-meter-row"><div class="rp-meter-head"><span>' + crmEscape(it.label) + '</span><small>' + text + '</small></div>' +
           '<div class="rp-meter-track rp-stack">' + bar + '</div></div>';
  }).join('');
  return '<div class="rp-legend">' + legend + '</div><div class="rp-meter">' + rows + '</div>';
}

const CRM_RP_RENDERERS = {
  line:  (items, box, o) => crmRpLineChart(items, box, o),
  meter: (items) => crmRpMeterHTML(items),
  stack: (items) => crmRpStackHTML(items),
  donut: (items, box, o) => '<div class="ops-donut-wrap">' + crmOpsDonut(items.map(i => Object.assign({ color: CRM_RP_COLORS.grey }, i)), box.id, { caption: box.getAttribute('data-donut-caption') || '', pct: true, noLegend: !!(o && o.noLegend) }) + '</div>'
};

// ---- period text ("November 2026" / "Nov 9 - Nov 15, 2026" / "2026") for every {period} subtitle ----
function crmRpPeriodText(rangeText, start, end) {
  const r = String(rangeText || '').toLowerCase(), now = new Date();
  if (r.startsWith('custom')) {
    const f = v => { const d = new Date(v + 'T00:00:00'); return isNaN(d) ? '' : d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }); };
    return (start && end) ? f(start) + ' - ' + f(end) : 'Custom Date Range';
  }
  if (r.startsWith('year')) return String(now.getFullYear());
  if (r.startsWith('week')) {
    const a = new Date(now); a.setDate(now.getDate() - ((now.getDay() + 6) % 7));
    const b = new Date(a); b.setDate(a.getDate() + 6);
    const f = d => d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    return f(a) + ' - ' + f(b) + ', ' + b.getFullYear();
  }
  return now.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
}
function crmRpApplyPeriod(page, period) {
  page.querySelectorAll('.rp-sub[data-sub]').forEach(p => { p.textContent = p.getAttribute('data-sub').replace('{period}', period); });
}

// ==========================================================================
// FILL THE ADMIN / MANAGER REPORT FROM reports-api.php?range=weekly|monthly|yearly|custom
// (manager-admin-report.html: Customer Report, Sales Report, Ticket Report, Feedback Report)
//
// JSON contract (every part is optional, a missing list just draws "No data yet"):
// {
//   "scope_role": "Organization-Wide Analytics ( Admin )",
//   "range":    { "from": "2026-11-01", "to": "2026-11-30" },
//   "customer": { "total":13, "new":7, "returning":4,
//                 "trend":[{"label":"Nov 1-7","count":2}],
//                 "by_staff":[{"label":"Priya Nair","count":7},{"label":"Unassigned","count":1}] },
//   "sales":    { "inquiries":12, "quotations":10, "confirmed_bookings":6, "verified_revenue":39020,
//                 "stages":[{"label":"New Inquiry","count":2},{"label":"In Progress","count":7},{"label":"Declined","count":3}],
//                 "arrangement":[{"label":"On-site Catering","count":3},{"label":"Food Delivery","count":2},{"label":"Customer Pickup","count":1}],
//                 "finance":{ "quotation_value":87900, "booking_value":62700, "verified_payments":39020, "outstanding":34800 } },
//   "ticket":   { "total":10, "open":3, "in_progress":3, "resolved":3,
//                 "statuses":[{"label":"Open","count":3}, ...], "priority":[{"label":"High","count":3}, ...] },
//   "feedback": { "total":8, "average":4.38, "satisfied":7, "low":1, "requested":12, "responded":8,
//                 "distribution":[{"label":"5 Stars","count":5}, ... {"label":"1 Star","count":1}],
//                 "trend":[{"label":"Nov 1-7","count":4.5}],            // count = average rating of that bucket
//                 "recent":[{"date":"2026-11-10","booking":"BK-0012","customer":"Ana Reyes","event":"Wedding","rating":5,"comment":"...","photos":2,"staff":"Priya Nair"}] }
// }
// ==========================================================================
function crmFillReports(data) {
  const page = document.getElementById('reportsPage');
  if (!page) return;
  data = data || {};
  const $ = id => document.getElementById(id);
  const num = v => Number(v) || 0;
  const list = v => Array.isArray(v) ? v : [];
  const setText = (id, v) => { const el = $(id); if (el) el.textContent = v; };
  const draw = (id, items) => crmDrawChart($(id), items);
  const peso = v => '\u20B1' + num(v).toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const C = { dark: CRM_PALETTE.green, mid: CRM_PALETTE.green, orange: CRM_PALETTE.amber, blue: CRM_PALETTE.blue, grey: CRM_PALETTE.grey, slate: CRM_PALETTE.slate, red: CRM_PALETTE.red };
  const paint = (map, def) => i => Object.assign({}, i, { count: num(i.count), color: i.color || map[String(i.label).toLowerCase()] || def });

  const sc = data.scope, scopeEl = $('reportScopeRole');   // "My Assigned Sales Records \u2014 Priya Nair ( Sales Staff )"
  if (scopeEl && sc && sc.label) scopeEl.innerHTML = crmEscape(sc.label) + (sc.name ? ' \u2014 <strong>' + crmEscape(sc.name) + '</strong>' : '') + (sc.role ? ' ( ' + crmEscape(sc.role) + ' )' : '');
  else if (data.scope_role) setText('reportScopeRole', data.scope_role);
  const dayText = v => { const d = new Date(v + 'T00:00:00'); return isNaN(d) ? '' : d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }); };
  const r = data.range || {};
  setText('reportRangeText', (r.from && r.to) ? dayText(r.from) + ' \u2013 ' + dayText(r.to) : (data.period || ''));

  // ---------- Customer Report ----------
  const c = data.customer || {};
  setText('totalCustomers', num(c.total)); setText('newCustomers', num(c.new)); setText('returningCustomers', num(c.returning));
  draw('customerTrendChart', list(c.trend).map(i => ({ label: i.label, count: num(i.count) })));
  draw('customersByStaffChart', list(c.by_staff).map(i => ({ label: i.label || 'Unassigned', count: num(i.count), color: (i.label && i.label !== 'Unassigned') ? C.dark : C.grey })));

  // ---------- Sales Report ----------
  const s = data.sales || {};
  setText('inquiriesSubmitted', num(s.inquiries)); setText('quotationsSent', num(s.quotations));
  setText('confirmedBookings', num(s.confirmed_bookings)); setText('verifiedRevenue', peso(s.verified_revenue)); setText('outstandingBalance', peso(((s.finance || {}).outstanding)));
  draw('inquiryStageChart', list(s.stages).map(paint({ 'new inquiry': CRM_PALETTE.slate, 'in progress': CRM_PALETTE.blue, 'declined': CRM_PALETTE.red }, CRM_PALETTE.grey)));
  draw('bookingArrangementChart', list(s.arrangement).map(paint({ 'on-site catering': CRM_PALETTE.blue, 'buffet with setup': CRM_PALETTE.blue, 'food delivery': CRM_PALETTE.green, 'customer pickup': CRM_PALETTE.amber }, CRM_PALETTE.grey)));
  const f = s.finance || {};
  const finRows = [['Quotation Value Sent', f.quotation_value, ''], ['Confirmed Booking Value', f.booking_value, ''],
                   ['Verified Payments Received', f.verified_payments, 'rp-fin-ok'], ['Outstanding Balance', f.outstanding, 'rp-fin-warn']];
  const fin = $('financialSummaryTable');
  if (fin) fin.querySelector('tbody').innerHTML = finRows.map(x =>
    '<tr class="' + x[2] + '"><td>' + crmEscape(x[0]) + '</td><td class="text-end">' + peso(x[1]) + '</td></tr>').join('');

  // ---------- Ticket Report ----------
  const t = data.ticket || {};
  setText('totalTickets', num(t.total)); setText('openTicketsCount', num(t.open));
  setText('inProgressTickets', num(t.in_progress)); setText('resolvedTickets', num(t.resolved));
  draw('ticketsByStatusChart', list(t.statuses).map(paint({ open: CRM_PALETTE.red, 'in progress': CRM_PALETTE.blue, waiting: CRM_PALETTE.amber, 'waiting for customer': CRM_PALETTE.amber, pending: CRM_PALETTE.amber, resolved: CRM_PALETTE.green, closed: CRM_PALETTE.slate, cancelled: CRM_PALETTE.grey }, CRM_PALETTE.grey)));
  draw('ticketsByPriorityChart', list(t.priority).map(paint({ urgent: CRM_PALETTE.red, high: CRM_PALETTE.orange, medium: CRM_PALETTE.yellow, low: CRM_PALETTE.green }, CRM_PALETTE.grey)));

  // ---------- Feedback Report ----------
  const fb = data.feedback || {};
  const fbN = num(fb.total);
  setText('feedbackTotal', fbN); setText('feedbackAverage', fbN ? num(fb.average).toFixed(1) + ' / 5' : '\u2014');
  setText('feedbackSatisfied', num(fb.satisfied)); setText('feedbackLow', num(fb.low));
  const starColor = { '5': CRM_PALETTE.green, '4': CRM_PALETTE.teal, '3': CRM_PALETTE.yellow, '2': CRM_PALETTE.orange, '1': CRM_PALETTE.red };
  draw('ratingTrendChart', list(fb.trend).map(i => ({ label: i.label, count: num(i.count) })));
  draw('ratingDistributionChart', list(fb.distribution).map(i => ({ label: i.label, count: num(i.count), color: starColor[String(i.label).charAt(0)] || CRM_PALETTE.grey })));
  const fbTable = $('feedbackTable');
  if (fbTable) {
    const stars = n => '\u2605'.repeat(n) + '\u2606'.repeat(Math.max(0, 5 - n));
    const rows = list(fb.recent);
    fbTable.querySelector('tbody').innerHTML = rows.length ? rows.map(x =>
      '<tr><td>' + crmEscape(dayText(x.date)) + '</td><td>' + crmEscape(x.booking || '') + '</td><td>' + crmEscape(x.customer || '\u2014') + '</td><td>' + crmEscape(x.event || '\u2014') + '</td>' +
      '<td><span style="color:' + CRM_PALETTE.amber + ';white-space:nowrap" title="' + num(x.rating) + ' out of 5">' + stars(num(x.rating)) + '</span> ' + num(x.rating) + '/5</td>' +
      '<td style="min-width:220px;white-space:normal">' + crmEscape(x.comment || '\u2014') + '</td><td>' + (num(x.photos) || '\u2014') + '</td><td>' + crmEscape(x.staff || '\u2014') + '</td></tr>').join('')
      : crmEmptyRow(8, fbTable.dataset.emptyText || 'No feedback for this period yet');
  }

  // ---------- change vs the previous period + rate bars ----------
  crmFillDeltas(page, data);
  const perf = (id, rows) => { const el = $(id); if (el) el.innerHTML = crmPerfHTML(rows); };
  perf('customerPerfGrid', [
    { label: 'Returning rate', num: num(c.returning), den: num(c.total), note: num(c.returning) + ' of ' + num(c.total) + ' customers came back with a new inquiry' },
    { label: 'New customer share', num: num(c.new), den: num(c.total), note: num(c.new) + ' of ' + num(c.total) + ' customers registered in this period' }]);
  perf('salesPerfGrid', [
    { label: 'Quotation rate', num: num(s.quotations), den: num(s.inquiries), note: num(s.quotations) + ' quotations sent for ' + num(s.inquiries) + ' inquiries' },
    { label: 'Booking conversion', num: num(s.confirmed_bookings), den: num(s.inquiries), note: num(s.confirmed_bookings) + ' confirmed bookings from ' + num(s.inquiries) + ' inquiries' },
    { label: 'Collection rate', num: num(f.verified_payments), den: num(f.booking_value), note: peso(f.verified_payments) + ' collected of ' + peso(f.booking_value), extra: num(f.outstanding) > 0 ? peso(f.outstanding) + ' outstanding' : '', cls: 'is-collect' }]);
  perf('feedbackPerfGrid', [
    { label: 'Response rate', num: num(fb.responded), den: num(fb.requested), note: num(fb.responded) + ' of ' + num(fb.requested) + ' rating requests answered' },
    { label: 'Satisfaction rate', num: num(fb.satisfied), den: fbN, note: num(fb.satisfied) + ' of ' + fbN + ' ratings were 4 or 5 stars' },
    { label: 'Low rating share', num: num(fb.low), den: fbN, note: num(fb.low) + ' of ' + fbN + ' ratings were 1 or 2 stars' }]);
  perf('ticketPerfGrid', [
    { label: 'Resolution rate', num: num(t.resolved), den: num(t.total), note: num(t.resolved) + ' of ' + num(t.total) + ' tickets resolved' },
    { label: 'Still open', num: num(t.open), den: num(t.total), note: num(t.open) + ' of ' + num(t.total) + ' tickets waiting for a first reply' }]);

  crmCheckReportNumbers();
}
window.crmFillReports = crmFillReports;

// "+12% vs last month" under a number card. Card markup: <div class="rp-delta" data-delta="sales.inquiries" data-good="up|down|neutral"></div>
// data.previous (from reports-api.php) holds the same numbers for the period before. Missing numbers = the line stays hidden.
function crmFillDeltas(page, data) {
  const prev = data.previous || {};
  const label = 'vs ' + (prev.label || 'last period');
  page.querySelectorAll('[data-delta]').forEach(el => {
    const path = el.getAttribute('data-delta').split('.');
    const old = (prev[path[0]] || {})[path[1]];
    const cur = (data[path[0]] || {})[path[1]];
    if (old === undefined || old === null || cur === undefined || cur === null) { el.innerHTML = ''; return; }
    const a = Number(cur) || 0, b = Number(old) || 0;
    let dir = 'flat', text = 'No change';
    if (b === 0 && a > 0) { dir = 'up'; text = 'New'; }
    else if (b !== 0) {
      const pct = Math.round((a - b) / b * 100);
      dir = pct > 0 ? 'up' : (pct < 0 ? 'down' : 'flat');
      text = (pct > 0 ? '+' : '') + pct + '%';
    }
    const good = el.getAttribute('data-good') || 'up';
    const tone = (dir === 'flat' || good === 'neutral') ? 'is-flat' : (dir === good ? 'is-good' : 'is-bad');
    const arrow = dir === 'up' ? '\u25B2 ' : (dir === 'down' ? '\u25BC ' : '');
    const was = path[1] === 'verified_revenue' ? '\u20B1' + b.toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : b;
    el.innerHTML = '<span class="rp-delta-chip ' + tone + '" title="' + crmEscape(String(prev.label || 'Previous period') + ': ' + was) + '">' + arrow + text + '</span>' +
                   '<span class="rp-delta-note">' + crmEscape(label) + '</span>';
  });
}

// Rate bars ("Booking conversion 63%"). rows: [{label, num, den, note}]. No data (den = 0) shows a dash and an empty bar.
function crmPerfHTML(rows) {
  return rows.map(r => {
    const has = r.den > 0;
    const pct = has ? Math.round(r.num / r.den * 100) : 0;
    return '<div class="rp-perf-item' + (r.cls ? ' ' + r.cls : '') + '"><div class="rp-perf-top"><span class="rp-perf-label">' + crmEscape(r.label) + '</span><b class="rp-perf-pct">' + (has ? pct + '%' : '\u2014') + '</b></div>' +
           '<div class="rp-meter-track"><i class="rp-fill" style="width:' + Math.min(100, pct) + '%"></i></div>' +
           '<div class="rp-perf-note">' + crmEscape(has ? r.note : 'No data in this period yet') + (has && r.extra ? ' &middot; <span class="rp-perf-due">' + crmEscape(r.extra) + '</span>' : '') + '</div></div>';
  }).join('');
}

// Loads the numbers for the chosen date range and fills the page. rangeText = "Weekly" | "Monthly" | "Yearly".
function crmLoadReportsData(rangeText) {
  const page = document.getElementById('reportsPage');
  if (!page || !page.dataset.api) return Promise.resolve();
  const label = document.getElementById('reportDateLabel');
  const range = String(rangeText || (label && label.textContent) || 'Monthly').trim().toLowerCase();
  const key = range.startsWith('week') ? 'weekly' : range.startsWith('custom') ? 'custom' : range.startsWith('year') ? 'yearly' : 'monthly';
  let url = page.dataset.api + '?range=' + key, start = '', end = '';
  if (key === 'custom') {
    start = (document.getElementById('reportStartDate') || {}).value || '';
    end = (document.getElementById('reportEndDate') || {}).value || '';
    if (!start || !end || start > end) return Promise.resolve();   // wait until both dates are valid
    url += '&start=' + encodeURIComponent(start) + '&end=' + encodeURIComponent(end);
  }
  const period = crmRpPeriodText(key, start, end);
  crmRpApplyPeriod(page, period);
  return fetch(url, { credentials: 'same-origin', headers: { 'Accept': 'application/json' } })
    .then(r => { if (!r.ok) throw new Error('HTTP ' + r.status); return r.json(); })
    .then(data => crmFillReports(Object.assign({ period: period }, data)))
    .catch(err => { console.warn('[Reports] could not load ' + page.dataset.api, err); crmFillReports({ period: period }); });
}
window.crmLoadReportsData = crmLoadReportsData;
if (typeof window.onReportRangeChange !== 'function') window.onReportRangeChange = function (range) { crmLoadReportsData(range); };

// Runs when a Reports page is shown: draws EVERY chart on the page from its data-items,
// adds the "no rows" message to empty tables, then checks the numbers.
function crmRenderReports() {
  const page = document.getElementById('reportsPage');
  if (!page) return;

  page.querySelectorAll('.rp-chart, .rp-hchart').forEach(box => {
    let items = [];
    try { items = JSON.parse(box.getAttribute('data-items') || '[]'); }
    catch (err) { console.warn('[Reports] Bad data-items on', box.id || box); }
    crmDrawChart(box, items);
  });

  page.querySelectorAll('table').forEach(t => {
    const cols = t.querySelectorAll('thead th').length || 6;
    const msg = t.dataset.emptyText || (t.id === 'confirmedDealsTable' ? 'No confirmed deals yet' : 'No records for this period yet');
    crmEnsureEmptyMessage(t.querySelector('tbody'), cols, msg);
  });

  crmBadgeReportTables(page);
  crmUpdateCompletionRate();   // Activity tab donut
  const adminReports = /reports-api\.php/.test(page.dataset.api || '');   // Admin / Manager (3 tabs), Sales Staff and CS Staff (1 report) all load reports-api.php
  if (!adminReports) crmCheckReportNumbers();   // the Admin / Manager page is checked after its data arrives (crmFillReports)

  // Admin / Manager reports: fetch reports-api.php for the chosen date range
  if (adminReports) crmLoadReportsData();
}
window.crmRenderReports = crmRenderReports;

// Status / Priority cells get the same colored pills as the Tickets page.
// Plain text is enough in the HTML: <td>Open</td>. Only known values are colored
// (Open, Pending, Resolved / High, Medium, Low). Call it again after rows are added later:
//   crmBadgeReportTables();
function crmBadgeReportTables(root) {
  const STATUS = ['open', 'pending', 'resolved'], PRIORITY = ['high', 'medium', 'low'];
  (root || document).querySelectorAll('table').forEach(table => {
    const heads = Array.from(table.querySelectorAll('thead th')).map(th => th.textContent.trim().toLowerCase());
    const sCol = heads.indexOf('status'), pCol = heads.indexOf('priority');
    if (sCol < 0 && pCol < 0) return;
    table.querySelectorAll('tbody tr:not(.empty-data-row):not(.no-results-row)').forEach(tr => {
      [[sCol, STATUS], [pCol, PRIORITY]].forEach(pair => {
        const td = pair[0] >= 0 ? tr.cells[pair[0]] : null;
        if (!td || td.querySelector('.ticket-badge, .stage-pill')) return;
        const v = td.textContent.trim();
        if (pair[1].includes(v.toLowerCase())) td.innerHTML = crmTicketBadgeHTML(v);
      });
    });
  });
}
window.crmBadgeReportTables = crmBadgeReportTables;

// ==========================================================================
// ACTIVITY TAB: COMPLETION RATE DONUT
// Completion rate = Completed / Total Activities, read from the two summary cards.
// Updates the donut ring (--pct), the % inside it and the big % next to it.
// Called automatically by crmRenderReports() and crmApplyReportData().
// ==========================================================================
function crmUpdateCompletionRate() {
  const donut = document.getElementById('completionDonut');
  if (!donut) return;
  const read = id => {
    const el = document.getElementById(id);
    return el ? (Number(el.textContent.replace(/[^0-9.]/g, '')) || 0) : 0;
  };
  const total = read('totalActivities');
  const pct = total ? Math.round(read('completedActivities') / total * 100) : 0;
  donut.style.setProperty('--pct', pct);
  ['completionDonutText', 'completionRate'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.textContent = pct + '%';
  });
}
window.crmUpdateCompletionRate = crmUpdateCompletionRate;

// ==========================================================================
// REFRESH A REPORT WITH NEW NUMBERS (this is what makes the Date filter "work")
// The Date dropdown only changes the label and calls window.onReportRangeChange(rangeText).
// Whoever defines that function (your backend) loads the numbers for that range and calls:
//
//   crmApplyReportData({
//     stats:  ['8', '4', '2', '2'],                 // same order as the cards (or { 'Total Tickets': 8, ... })
//     charts: { ticketsByStatusChart: [{label:'Open',count:4}, ...], ticketsByPriorityChart: [...] },   // by chart id (or data-report-chart title)
//     rows:   [['T-001','Late delivery','Lara Cruz','Open','High','Ana Reyes'], ...]    // "#" column is added automatically
//   });
//
//   window.onReportRangeChange = function (range) {
//     fetch('report_data.php?range=' + encodeURIComponent(range)).then(r => r.json()).then(crmApplyReportData);
//   };
// ==========================================================================
function crmApplyReportData(data) {
  const page = document.getElementById('reportsPage');
  if (!page || !data) return;

  // summary cards
  page.querySelectorAll('.stat-number').forEach((n, i) => {
    let v;
    if (Array.isArray(data.stats)) v = data.stats[i];
    else if (data.stats) {
      const lab = (n.closest('.card') || document).querySelector('.stat-label');
      v = data.stats[lab ? lab.textContent.trim() : ''];
    }
    if (v !== undefined && v !== null) n.textContent = v;
  });

  // charts (vertical AND horizontal)
  page.querySelectorAll('.rp-chart, .rp-hchart').forEach(box => {
    const c = data.charts || {};
    const items = c[box.id] || c[box.getAttribute('data-report-chart')];
    if (items) crmDrawChart(box, items);
  });

  // table rows
  if (Array.isArray(data.rows)) {
    const table = page.querySelector('table[data-report-table]') || page.querySelector('#confirmedDealsTable') || page.querySelector('table');
    const tbody = table && table.querySelector('tbody');
    if (tbody) {
      const cols = table.querySelectorAll('thead th').length;
      const numbered = (table.querySelector('thead th') || {}).textContent === '#';
      tbody.innerHTML = data.rows.map((r, i) => {
        const cells = (numbered && r.length === cols - 1) ? [i + 1].concat(r) : r;
        return '<tr>' + cells.map(v => '<td>' + crmEscape(v) + '</td>').join('') + '</tr>';
      }).join('');
      page.querySelectorAll('.table-search-input').forEach(inp => { inp.value = ''; });
      crmEnsureEmptyMessage(tbody, cols || 6, table.dataset.emptyText || 'No records for this period yet');
    }
  }

  crmBadgeReportTables(page);
  crmUpdateCompletionRate();   // Activity tab donut
  crmCheckReportNumbers();
}
window.crmApplyReportData = crmApplyReportData;

// ---- everything the PDF and the Excel need, read from the page ----
// crmReportData()      -> everything on the page (old behaviour)
// crmReportData(pane)  -> only ONE tab (a .tab-pane): its cards, charts and table.
//                         Used by DownloadExport.js to export every tab separately.
function crmReportData(pane) {
  const el = id => document.getElementById(id);
  const text = n => (n ? n.textContent.trim() : '');
  const page = el('reportsPage');
  const scope = pane || page;
  const user = el('dropdownUserName');
  const num = s => Number(String(s).replace(/[^0-9.]/g, '')) || 0;

  // summary cards: [label, value]
  const stats = Array.from(scope ? scope.querySelectorAll('.stat-number') : []).map(n => {
    const card = n.closest('.card');
    return [text(card && card.querySelector('.stat-label')), text(n)];
  });
  // Activity tab: the completion rate (donut) is exported as one more summary card
  const rateEl = scope && scope.querySelector('#completionRate');
  if (rateEl) stats.push(['Completion Rate', text(rateEl)]);

  // charts: { title, items }  (vertical AND horizontal)
  // items come from crmDrawChart (box._items). A chart drawn another way (line, donut, meter, stacked: the
  // Admin / Manager reports) keeps its numbers in data-items, so read that when _items is empty.
  const itemsOf = box => {
    if (box._items && box._items.length) return box._items;
    try {
      const v = JSON.parse(box.getAttribute('data-items') || '[]');
      return Array.isArray(v) ? v : [];
    } catch (err) { return []; }
  };
  const charts = Array.from(scope ? scope.querySelectorAll('.rp-chart, .rp-hchart') : []).map(box => {
    const card = box.closest('.card');
    return {
      id: box.id,
      title: box.getAttribute('data-report-chart') || text(card && card.querySelector('h5')) || 'Chart',
      items: itemsOf(box)
    };
  });

  // rate bars ("Customer Engagement": Returning rate 0%, New customer share 100%, ...)
  // Every  <div id="...PerfGrid">  inside the tab is read: { title, subtitle, items: [{ label, pct, value, note }] }
  const PERF_TITLES = { customerPerfGrid: 'Customer Engagement', salesPerfGrid: 'Sales Performance', ticketPerfGrid: 'Ticket Performance', feedbackPerfGrid: 'Customer Satisfaction' };
  const perf = Array.from(scope ? scope.querySelectorAll('[id$="PerfGrid"]') : []).map(grid => {
    const card = grid.closest('.card');
    const head = card && card.querySelector('h5, h4, h6, .card-title');
    let sub = '';
    if (card) {
      const s = Array.from(card.querySelectorAll('p, small, .text-muted, [class*="sub"]')).find(n => !grid.contains(n) && n !== head && !n.contains(grid) && text(n));
      sub = s ? text(s) : '';
    }
    const boxes = scope ? Array.from(scope.querySelectorAll('.rp-chart, .rp-hchart')) : [];
    const lastBox = boxes[boxes.length - 1];
    return {
      after: !!(lastBox && (lastBox.compareDocumentPosition(grid) & Node.DOCUMENT_POSITION_FOLLOWING)),   // card is BELOW the charts on the page
      title: text(head) || PERF_TITLES[grid.id] || 'Performance',
      subtitle: sub,
      items: Array.from(grid.querySelectorAll('.rp-perf-item')).map(it => {
        const pctText = text(it.querySelector('.rp-perf-pct'));
        return { label: text(it.querySelector('.rp-perf-label')), pct: pctText, value: /\d/.test(pctText) ? num(pctText) / 100 : null, note: text(it.querySelector('.rp-perf-note')) };
      })
    };
  }).filter(p => p.items.length);

  // the table: { title, headers, rows, amountCol }
  const tableEl = scope && (scope.querySelector('table[data-report-table]') || scope.querySelector('#confirmedDealsTable') || scope.querySelector('table'));
  const tableCard = tableEl && tableEl.closest('.card');
  const headers = tableEl ? Array.from(tableEl.querySelectorAll('thead th')).map(th => th.textContent.trim()) : [];
  const footRow = tableEl && tableEl.querySelector('tfoot tr');       // e.g. the Customer "Total" row
  const footCells = footRow ? Array.from(footRow.cells).map(td => td.textContent.trim()) : null;
  const table = {
    title: (tableEl && (tableEl.getAttribute('data-report-table') ||
            (tableEl.id === 'confirmedDealsTable' ? 'Confirmed Deals' : text(tableCard && tableCard.querySelector('h5'))))) || 'Records',
    headers: headers,
    foot: footCells,
    amountCol: headers.findIndex(h => /amount/i.test(h)),          // -1 = no money column
    rows: tableEl
      ? Array.from(tableEl.querySelectorAll('tbody tr:not(.empty-data-row):not(.no-results-row)'))   // ALL rows, even if the search hides some
          .map(tr => Array.from(tr.cells).map(td => td.textContent.trim()))
      : []
  };

  return {
    title: (pane && pane.dataset.reportTitle) || (page && page.dataset.reportTitle) || 'Report',
    type: (pane && pane.dataset.reportType) || (page && page.dataset.reportType) || 'sales',
    dateLabel: (pane && pane.dataset.dateLabel) || '',
    range: text(el('reportDateLabel')) || text(document.querySelector('#reportDateDropdown .custom-dropdown-toggle')) || 'All dates',
    today: new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' }),
    user: localStorage.getItem('userName') || text(user) || 'Unknown',   // saves the real name as localStorage 'userName' at login
    stats: stats,
    charts: charts,
    perf: perf,
    table: table,
    num: num
  };
}

const crmSum = items => items.reduce((s, i) => s + (Number(i.count) || 0), 0);
const crmSlug = s => String(s).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

// ==========================================================================
// NUMBER CHECK
// The cards, the charts and the table must tell the same story.
// This only WARNS in the console (F12) so the wrong number is easy to find.
// ==========================================================================
function crmCheckReportNumbers() {
  const panes = Array.from(document.querySelectorAll('#reportsPage .tab-pane[data-report-type]'));
  if (!panes.length) return crmCheckOneReport(crmReportData());
  panes.forEach(p => crmCheckOneReport(crmReportData(p)));   // each tab is checked with its own type
}

function crmCheckOneReport(d) {
  const card = label => {
    const s = d.stats.find(x => x[0].toLowerCase() === label.toLowerCase());
    return s ? d.num(s[1]) : null;
  };
  const chart = re => d.charts.find(c => re.test(c.title));
  const bar = (c, label) => {
    const b = c && c.items.find(i => String(i.label).toLowerCase() === label.toLowerCase());
    return b ? Number(b.count) : null;
  };
  const rows = d.table.rows.length;
  const msgs = [];
  const same = (what, a, b, whatB) => {
    if (a !== null && b !== null && a !== b) msgs.push(what + ' = ' + a + ' but ' + whatB + ' = ' + b);
  };

  if (d.type === 'feedback') {
    const dist = chart(/distribution/i);
    same('Feedback Received card', card('Feedback Received'), dist ? crmSum(dist.items) : null, 'Rating Distribution adds up to');
    if (rows && card('Feedback Received') <= 100) same('Feedback Received card', card('Feedback Received'), rows, 'the Customer Feedback table rows');
  } else if (d.type === 'tickets') {
    const status = chart(/status/i), priority = chart(/priority/i);
    same('Total Tickets card', card('Total Tickets'), status ? crmSum(status.items) : null, 'Tickets by Status adds up to');
    same('Total Tickets card', card('Total Tickets'), priority ? crmSum(priority.items) : null, 'Tickets by Priority adds up to');
    same('Open Tickets card', card('Open Tickets'), bar(status, 'Open'), 'the Open bar');
    same('Pending Tickets card', card('Pending Tickets'), bar(status, 'Pending'), 'the Pending bar');
    same('Resolved Tickets card', card('Resolved Tickets'), bar(status, 'Resolved'), 'the Resolved bar');
    if (rows) same('Total Tickets card', card('Total Tickets'), rows, 'the table rows');
  } else {
    const leads = chart(/lead/i), deals = chart(/deal/i);
    same('Total Leads card', card('Total Leads'), leads ? crmSum(leads.items) : null, 'Leads by Stage adds up to');
    same('Total Deals card', card('Total Deals'), deals ? crmSum(deals.items) : null, 'Deals by Stage adds up to');
    same('Confirmed Deals card', card('Confirmed Deals'), bar(deals, 'Confirmed'), 'the Confirmed bar');
    same('Confirmed Deals card', card('Confirmed Deals'), rows, 'the Confirmed Deals table rows');
  }
  msgs.forEach(m => console.warn('[Reports] ' + d.title + ': ' + m));
}

// ==========================================================================
// REPORT INTERACTIONS (date range hook + table search), shared by every report page.
// Delegated handlers keep working when navbar.js replaces the page content.
// ==========================================================================
if (!window.__crmReportInteractionsBound) {
  window.__crmReportInteractionsBound = true;

  document.addEventListener('click', function (e) {
    // Backend hook: define window.onReportRangeChange = function (rangeText) { ... reload numbers + charts ... }
    const range = e.target.closest('#reportDateMenu .custom-dropdown-item');
    if (range) {
      const isCustom = range.textContent.trim().toLowerCase().startsWith('custom');
      const box = document.getElementById('reportCustomDates');
      if (box) box.classList.toggle('d-none', !isCustom);
      if (isCustom) {   // default to the current month the first time
        const s = document.getElementById('reportStartDate'), en = document.getElementById('reportEndDate');
        const iso = d => d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
        const n = new Date();
        if (s && !s.value) s.value = iso(new Date(n.getFullYear(), n.getMonth(), 1));
        if (en && !en.value) en.value = iso(new Date(n.getFullYear(), n.getMonth() + 1, 0));
      }
    }
    if (range && typeof window.onReportRangeChange === 'function') {
      window.onReportRangeChange(range.textContent.trim());
    }
  });

  // Custom Date Range: reload when Start / End date changes
  document.addEventListener('change', function (e) {
    if (!e.target.matches || !e.target.matches('#reportStartDate, #reportEndDate')) return;
    const s = document.getElementById('reportStartDate'), en = document.getElementById('reportEndDate');
    if (s.value && en.value && s.value > en.value) { en.classList.add('dd-invalid'); return; }
    en.classList.remove('dd-invalid');
    if (typeof window.onReportRangeChange === 'function') window.onReportRangeChange('Custom Date Range');
  });

  // Any search box inside a report card filters the table of that same card
  document.addEventListener('input', function (e) {
    const input = e.target;
    if (!input.matches || !input.matches('#reportsPage .table-search-input, #confirmedSearchInput')) return;
    const card = input.closest('.card');
    const table = card && card.querySelector('table');
    if (!table) return;
    const q = input.value.trim().toLowerCase();
    const rows = Array.from(table.querySelectorAll('tbody tr:not(.empty-data-row):not(.no-results-row)'));
    let visible = 0;
    rows.forEach(tr => {
      const show = tr.textContent.toLowerCase().includes(q);
      tr.style.display = show ? '' : 'none';
      if (show) visible++;
    });
    const colspan = table.querySelectorAll('thead th').length || 6;
    crmSetNoResultsRow(table.querySelector('tbody'), colspan, rows.length > 0 && visible === 0);
  });
}

// Restrict numeric input to digits and an optional decimal point.
function crmCleanNumber(value, integerOnly) {
  let v = String(value).replace(integerOnly ? /[^\d]/g : /[^\d.]/g, "");
  if (!integerOnly) {
    const i = v.indexOf(".");
    if (i !== -1) v = v.slice(0, i + 1) + v.slice(i + 1).replace(/\./g, ""); // Keep only the first decimal point.
  }
  return v;
}

if (!window.__crmNumberInputBound) {
  window.__crmNumberInputBound = true;

  // Block invalid numeric keys.
  document.addEventListener("keydown", function (e) {
    const el = e.target;
    if (!el || el.type !== "number") return;
    const integerOnly = el.dataset.integer === "true";
    const blocked = ["e", "E", "+", "-"];
    if (integerOnly) blocked.push(".", ",");
    if (blocked.includes(e.key)) e.preventDefault();
  });

  // Remove invalid characters from pasted values.
  document.addEventListener("paste", function (e) {
    const el = e.target;
    if (!el || el.type !== "number") return;
    e.preventDefault();
    const text = (e.clipboardData || window.clipboardData).getData("text");
    const cleaned = crmCleanNumber(text, el.dataset.integer === "true");
    if (cleaned) {
      el.value = cleaned;
      el.dispatchEvent(new Event("input", { bubbles: true }));
    }
  });

  // Prevent the mouse wheel from changing numeric values.
  document.addEventListener(
    "wheel",
    function (e) {
      if (
        e.target &&
        e.target.type === "number" &&
        document.activeElement === e.target
      )
        e.target.blur();
    },
    { passive: true },
  );
}

// Ticket page handlers.
function crmTicketBadgeHTML(text) {
  const value = String(text || "").trim();
  if (!value) return "";
  return `<span class="ticket-badge ticket-${crmEscape(value.toLowerCase())}">${crmEscape(value)}</span>`;
}

function crmRenderTicketBadges() {
  document
    .querySelectorAll("[data-ticket-status], [data-ticket-priority]")
    .forEach((el) => {
      const text =
        el.getAttribute("data-ticket-status") ||
        el.getAttribute("data-ticket-priority");
      el.innerHTML = crmTicketBadgeHTML(text);
    });
}

// Update the character count when a form opens.
function crmUpdateCharCount(textarea) {
  const counter = textarea.parentElement.querySelector(".char-count");
  if (counter)
    counter.textContent =
      textarea.value.length +
      "/" +
      (textarea.maxLength > 0 ? textarea.maxLength : 150) +
      " characters";
}
function crmShowTicketNotice(message, type) {
  const table = document.getElementById("ticketsTable");
  const main = table && table.closest("main");
  if (!main) return;
  let notice = main.querySelector(".tickets-api-notice");
  if (!notice) {
    notice = document.createElement("div");
    notice.className = "tickets-api-notice alert d-none";
    notice.setAttribute("role", "alert");
    const card = table.closest(".card");
    if (card) main.insertBefore(notice, card);
  }
  notice.className = `tickets-api-notice alert alert-${type}`;
  notice.textContent = message;
}
function crmShowTicketFormMessage(form, message, type) {
  let notice = form.parentElement.querySelector(".ticket-api-form-notice");
  if (!notice) {
    notice = document.createElement("div");
    notice.className = "ticket-api-form-notice alert mb-3";
    notice.setAttribute("role", "alert");
    form.parentElement.insertBefore(notice, form);
  }
  notice.className = `ticket-api-form-notice alert alert-${type} mb-3`;
  notice.textContent = message;
}
async function crmGetTicketCsrfToken(table) {
  const response = await fetch("tickets-api.php?action=list", {
    method: "GET",
    credentials: "same-origin",
    headers: { Accept: "application/json" },
    cache: "no-store",
  });
  const data = await response.json();
  if (
    !response.ok ||
    !data.success ||
    typeof data.csrf_token !== "string" ||
    !data.csrf_token
  ) {
    throw new Error(
      data.message || "Unable to verify the Tickets security token.",
    );
  }
  table.dataset.csrfToken = data.csrf_token;
  return data.csrf_token;
}
async function crmSendTicketAction(action, formData, table) {
  const csrfToken = await crmGetTicketCsrfToken(table);
  formData.set("csrf_token", csrfToken);
  const response = await fetch(
    `tickets-api.php?action=${encodeURIComponent(action)}`,
    {
      method: "POST",
      credentials: "same-origin",
      headers: {
        Accept: "application/json",
        "X-CSRF-Token": csrfToken,
      },
      body: formData,
    },
  );
  const data = await response.json();
  return { response, data };
}
async function crmDeleteTicket(ticketId, ticketName, button) {
  const table = document.getElementById("ticketsTable");
  if (!table || !ticketId) {
    crmShowTicketNotice(
      "The selected ticket could not be identified.",
      "danger",
    );
    return;
  }
  if (
    !(await crmConfirm({
      title: "Delete ticket?",
      message: `Delete ticket "${ticketName}"? This action cannot be undone.`,
      confirmText: "Delete",
      cancelText: "Cancel",
      danger: true,
    }))
  )
    return;
  const previousDisabled = button.disabled;
  button.disabled = true;
  try {
    const formData = new FormData();
    formData.set("id", ticketId);
    const { response, data } = await crmSendTicketAction(
      "delete",
      formData,
      table,
    );
    if (!response.ok || !data.success) {
      throw new Error(data.message || "Unable to delete this ticket.");
    }
    crmShowTicketNotice(
      data.message || "Ticket deleted successfully.",
      "success",
    );
    await crmLoadTickets(table);
  } catch (error) {
    console.error("Ticket deletion failed:", error);
    crmShowTicketNotice(
      error.message || "Unable to delete this ticket. Please try again.",
      "danger",
    );
  } finally {
    button.disabled = previousDisabled;
  }
}
if (!window.__crmTicketFormsBound) {
  window.__crmTicketFormsBound = true;
  document.addEventListener("shown.bs.modal", (event) => {
    if (!["addTicketModal", "editTicketModal"].includes(event.target.id))
      return;
    event.target
      .querySelectorAll(".ticket-api-form-notice")
      .forEach((notice) => notice.remove());
  });
  document.addEventListener("submit", async (event) => {
    const form = event.target;
    const formId = form && form.getAttribute && form.getAttribute("id");
    if (!["addTicketForm", "editTicketForm"].includes(formId)) return;
    event.preventDefault();
    if (form.dataset.submitting === "true") return;
    const table = document.getElementById("ticketsTable");
    if (!table) {
      crmShowTicketFormMessage(
        form,
        "The Tickets page is no longer available. Reopen it and try again.",
        "danger",
      );
      return;
    }
    const missingDropdown = Array.from(
      form.querySelectorAll('.dropdown[data-required="true"]'),
    ).find((dropdown) => {
      const input = dropdown.querySelector('input[type="hidden"]');
      const toggle = dropdown.querySelector(".custom-dropdown-toggle");
      const missing = !input || !input.value;
      if (toggle) toggle.classList.toggle("dd-invalid", missing);
      return missing;
    });
    if (!form.checkValidity() || missingDropdown) {
      form.reportValidity();
      crmShowTicketFormMessage(
        form,
        missingDropdown &&
          missingDropdown.dataset.field === "staff_id" &&
          (!Array.isArray(window.crmTicketStaff) ||
            window.crmTicketStaff.length === 0)
          ? "No active Customer Service Staff users are available. Add or activate one in Settings > Users before saving a ticket."
          : missingDropdown
            ? "Select a customer, status, priority, and assigned staff member."
            : "Complete the required ticket fields before saving.",
        "warning",
      );
      return;
    }
    form.dataset.submitting = "true";
    const submitButton = document.querySelector(
      `[form="${formId}"][type="submit"]`,
    );
    if (submitButton) submitButton.disabled = true;
    const priorNotice = form.parentElement.querySelector(
      ".ticket-api-form-notice",
    );
    if (priorNotice) priorNotice.remove();
    try {
      const action = formId === "addTicketForm" ? "create" : "update";
      const { response, data } = await crmSendTicketAction(
        action,
        new FormData(form),
        table,
      );
      if (!response.ok || !data.success) {
        throw new Error(data.message || "Unable to save this ticket.");
      }
      if (document.getElementById("ticketsTable") !== table) return;
      const modal = form.closest(".modal");
      if (modal) {
        crmResetModal(modal);
        if (window.bootstrap && window.bootstrap.Modal) {
          window.bootstrap.Modal.getOrCreateInstance(modal).hide();
        }
      }
      crmShowTicketNotice(
        data.message || "Ticket saved successfully.",
        "success",
      );
      await crmLoadTickets(table);
    } catch (error) {
      console.error("Ticket save failed:", error);
      crmShowTicketFormMessage(
        form,
        error.message || "Unable to save this ticket. Please try again.",
        "danger",
      );
    } finally {
      delete form.dataset.submitting;
      if (submitButton) submitButton.disabled = false;
    }
  });
}

if (!window.__crmCharCountBound) {
  window.__crmCharCountBound = true;
  document.addEventListener("input", (e) => {
    if (e.target.matches("textarea[maxlength]")) crmUpdateCharCount(e.target);
  });
  document.addEventListener("shown.bs.modal", (e) =>
    e.target
      .querySelectorAll("textarea[maxlength]")
      .forEach(crmUpdateCharCount),
  );
}

// Ticket row actions use the row data below.
// Ticket rows include record, customer, staff, and description attributes.
if (!window.__crmTicketButtonsBound) {
  window.__crmTicketButtonsBound = true;
  document.addEventListener("click", function (e) {
    const btn = e.target.closest(
      "#ticketsTable .action-btn-view, #ticketsTable .action-btn-edit, #ticketsTable .action-btn-delete",
    );
    if (!btn) return;
    const row = btn.closest("tr");
    if (!row) return;

    const t = (i) => (row.cells[i] ? row.cells[i].textContent.trim() : "");
    const d = row.dataset;
    const item = {
      id: d.id || "",
      no: t(0),
      name: t(1),
      customer: t(2),
      status: t(3),
      priority: t(4),
      staff: t(5),
      desc: d.desc || "",
      customerId: d.customerId,
      staffId: d.staffId,
    };
    if (btn.classList.contains("action-btn-delete")) {
      crmDeleteTicket(item.id, item.name, btn);
      return;
    }
    if (btn.classList.contains("action-btn-view")) {
      const set = (id, value) => {
        const el = document.getElementById(id);
        if (el) el.textContent = value || "-";
      };
      set("viewTicketNo", item.no);
      set("viewTicketName", item.name);
      set("viewTicketDesc", item.desc);
      set("viewTicketCustomer", item.customer);
      set("viewTicketStaff", item.staff);
      [
        ["viewTicketStatus", item.status],
        ["viewTicketPriority", item.priority],
      ].forEach(([id, value]) => {
        const el = document.getElementById(id);
        if (!el) return;
        const badge = document.createElement("span");
        badge.className = `ticket-badge ticket-${String(value || "").toLowerCase()}`;
        badge.textContent = value || "-";
        el.replaceChildren(badge);
      });
    } else {
      const modal = document.getElementById("editTicketModal");
      if (!modal) return;
      crmSetValue(modal, "id", item.id);
      crmSetValue(modal, "ticket_name", item.name);
      crmSetValue(modal, "description", item.desc);
      crmSetText2("#editTicketNo", item.no);
      const customerDisplay = modal.querySelector("#editTicketCustomerName");
      if (customerDisplay) customerDisplay.value = item.customer;
      crmSelectDropdown(
        modal.querySelector('.dropdown[data-field="status"]'),
        item.status,
      );
      crmSelectDropdown(
        modal.querySelector('.dropdown[data-field="priority"]'),
        item.priority,
      );
      crmSelectDropdown(
        modal.querySelector('.dropdown[data-field="staff_id"]'),
        item.staff,
        item.staffId,
      );
      const descriptionField = modal.querySelector('[name="description"]');
      if (descriptionField) crmUpdateCharCount(descriptionField);
      crmTakeSnapshot("editTicketModal");
      crmSetText2(
        "#discardTicketChangesModal strong.text-highlight",
        item.name || "",
      );
    }
  });
}

// Keep opened dropdown lists visible inside modals.
if (!window.__crmDropdownAutoScrollBound) {
  window.__crmDropdownAutoScrollBound = true;

  // Bootstrap emits shown.bs.dropdown after the menu opens.
  document.addEventListener("shown.bs.dropdown", function (e) {
    const dropdown = e.target.closest ? e.target.closest(".dropdown") : null;
    if (!dropdown) return;
    const menu = dropdown.querySelector(".dropdown-menu");
    // Modal dropdowns scroll the modal body; the ticket detail dropdowns (.tk-dd) scroll the page body.
    const body = menu
      ? menu.closest(".modal-body") ||
        (dropdown.classList.contains("tk-dd") ? menu.closest(".content-body") : null)
      : null;
    if (!body) return; // Limit scrolling to modal and ticket detail dropdowns.

    // Wait one frame for the menu to finish sizing.
    requestAnimationFrame(function () {
      const gap = 12; // Leave space below the menu.
      const menuBox = menu.getBoundingClientRect();
      const bodyBox = body.getBoundingClientRect();
      const toggleBox = e.target.getBoundingClientRect();

      let amount = menuBox.bottom - bodyBox.bottom + gap; // Hidden menu height.
      if (amount <= 0) return; // The menu is already visible.

      // Keep the dropdown button visible while scrolling.
      amount = Math.min(amount, toggleBox.top - bodyBox.top - 8);
      if (amount > 0) body.scrollBy({ top: amount, behavior: "smooth" });
    });
  });
}

;
/** Handles frontend interactions for administrative settings and user management.*/

(() => {
  const roles = [
    { value: "admin", label: "Admin" },
    { value: "manager", label: "Manager" },
    { value: "sales staff", label: "Sales Staff" },
    { value: "customer service", label: "Customer Service Staff" }
  ];

  function normalizeRole(role) {
    const normalized = role.toLowerCase().replace(/[_-]+/g, " ").replace(/\s+/g, " ").trim();
    if (normalized === "cs" || normalized === "cs staff" || normalized === "customer service staff") {
      return "customer service";
    }
    if (normalized === "sales") return "sales staff";
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

  function setPasswordVisibility(button, visible, settingsRoot) {
    const selector = button.getAttribute("data-password-toggle");
    const input = selector ? settingsRoot.querySelector(selector) : null;
    const icon = button.querySelector("i");
    if (!input || !icon) return;

    input.type = visible ? "text" : "password";
    icon.classList.toggle("bi-eye", !visible);
    icon.classList.toggle("bi-eye-slash", visible);
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
    settingsRoot.querySelectorAll("#createAccountModal [data-password-toggle]").forEach((button) => {
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

        actionsCell.append(viewButton, editButton);
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

    settingsRoot.querySelector("#createAccountModal")?.addEventListener("hidden.bs.modal", () => {
      clearPasswordFields(settingsRoot);
    });

    settingsRoot.querySelectorAll("#createAccountModal [data-password-toggle]").forEach((button) => {
      button.setAttribute("aria-label", "Show password");
      button.setAttribute("title", "Show password");
    });
  }

  window.initCrmSettingsPage = initCrmSettingsPage;
})();

// ==========================================================================
// SEARCH BARS: every search box gets the same green "X" clear button
// (Contacts, Leads & Deals, Tickets, Activities, Reports, Settings).
// Pages are swapped in by navbar.js, so new search boxes are upgraded as they appear.
// The look of the X is in adminpages.css (::-webkit-search-cancel-button).
// ==========================================================================
(function () {
  if (window.__crmSearchClearBound) return;
  window.__crmSearchClearBound = true;

  const SELECTOR = ".table-search-input, #confirmedSearchInput, #settings-user-search";
  let queued = false;

  function upgradeSearchInputs() {
    queued = false;
    document.querySelectorAll(SELECTOR).forEach((input) => {
      // type="search" is what makes the browser show the X once something is typed.
      if (input.tagName === "INPUT" && input.type !== "search") input.type = "search";
    });
  }

  function queueUpgrade() {
    if (queued) return;
    queued = true;
    requestAnimationFrame(upgradeSearchInputs);
  }

  function start() {
    upgradeSearchInputs();
    new MutationObserver(queueUpgrade).observe(document.body, { childList: true, subtree: true });
  }

  if (document.body) start();
  else document.addEventListener("DOMContentLoaded", start);
})();

// ==========================================================================
// NO BROWSER AUTOFILL: removes Chrome's saved-address / email dropdown
// from every form field on every page and modal.
// ==========================================================================
(function () {
  if (window.__crmNoAutofillBound) return;
  window.__crmNoAutofillBound = true;

  const SKIP = ["hidden", "checkbox", "radio", "submit", "button", "reset", "file", "range", "color"];
  // Chrome often ignores autocomplete="off" on name / email / phone fields,
  // so those get a value it does not treat as an address field.
  const ADDRESS_LIKE = /name|email|phone|tel|address|username/i;
  let queued = false;

  function applyNoAutofill() {
    queued = false;
    document.querySelectorAll("form").forEach((form) => {
      if (form.getAttribute("autocomplete") !== "off") form.setAttribute("autocomplete", "off");
    });
    document.querySelectorAll("input, textarea").forEach((el) => {
      if (SKIP.includes(el.type)) return;
      let value;
      if (el.type === "password") value = "new-password";
      else if (el.type === "email" || el.type === "tel" || ADDRESS_LIKE.test((el.name || "") + " " + (el.id || ""))) value = "new-password";
      else value = "off";
      if (el.getAttribute("autocomplete") !== value) el.setAttribute("autocomplete", value);
      el.setAttribute("autocorrect", "off");
      el.setAttribute("spellcheck", "false");
    });
  }

  function queue() {
    if (queued) return;
    queued = true;
    requestAnimationFrame(applyNoAutofill);
  }

  function start() {
    applyNoAutofill();
    new MutationObserver(queue).observe(document.body, { childList: true, subtree: true });
    document.addEventListener("shown.bs.modal", applyNoAutofill);
  }

  if (document.body) start();
  else document.addEventListener("DOMContentLoaded", start);
})();

/* ============================================================================================
   Sales Staff > My Inquiries > View Details > F. Quotation Information
   Answers the crm:quotation-* events fired by the four buttons (Prepare Quotation, Preview,
   Send, Prepare Revised Version) using sales-inquiries.php (quotation_save / quotation_send).
   Deposit = 20% of the total. No CSS here: it only uses classes that already exist in all-pages.css
   (custom-modal-card, iw-dialog, modal-input-field, modal-input-label, modal-btn-*, csi-outline-btn,
   ci-food, ci-summary, ci-lines, ci-note, stage-pill, and Bootstrap utilities.
   ============================================================================================ */
(function () {
  if (window.__crmQuotationUi) return;
  window.__crmQuotationUi = true;

  const API = "sales-inquiries.php";
  const DEPOSIT_RATE = 0.2;
  const esc = (v) => crmEscape(v);
  const peso = (n) => "₱\u00A0" + (Number(n) || 0).toLocaleString("en-PH", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const ymd = (d) => d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0");
  const inDays = (n) => { const d = new Date(); d.setDate(d.getDate() + n); return ymd(d); };
  const qty = (n) => String(Number(n) || 0);
  // "₱230.00" -> 230. A range or several prices ("₱1,800 / ₱2,300") is ambiguous, so return 0 and let staff type it.
  function singlePrice(text) {
    const found = String(text || "").match(/\d[\d,]*(?:\.\d+)?/g) || [];
    return found.length === 1 ? parseFloat(found[0].replace(/,/g, "")) || 0 : 0;
  }

  function toast(message, type) {
    if (window.crmToast) window.crmToast(message, type || "success");
    else console.error("CRM toast component was not loaded before quotation actions.");
  }

  function post(action, fields) {
    const body = new FormData();
    Object.keys(fields).forEach((k) => body.append(k, fields[k]));
    return fetch(API + "?action=" + action, { method: "POST", credentials: "same-origin", headers: { Accept: "application/json" }, body })
      .then((r) => r.text().then((text) => {
        let data = null;
        try { data = JSON.parse(text); } catch (e) { /* not JSON */ }
        if (!r.ok || !data || data.success === false) throw new Error((data && data.message) || "Request failed (HTTP " + r.status + ").");
        return data;
      }));
  }

  // same Bootstrap modal + card the other CRM modals use; iw-dialog is the existing 780px-wide dialog
  function openModal(innerHTML, small) {
    const el = document.createElement("div");
    el.className = "modal fade";
    el.tabIndex = -1;
    el.setAttribute("aria-hidden", "true");
    el.innerHTML = '<div class="modal-dialog modal-dialog-centered' + (small ? "" : " iw-dialog") + '"><div class="modal-content custom-modal-card">' + innerHTML + "</div></div>";
    document.body.appendChild(el);
    const inst = new bootstrap.Modal(el, { backdrop: "static" });
    el.addEventListener("hidden.bs.modal", () => { inst.dispose(); el.remove(); });
    inst.show();
    return { el, inst };
  }

  // keep the in-memory record in step with the server, then redraw the open details screen
  function applyResult(ctx, data) {
    const rec = ctx.record;
    if (data.quotation) {
      rec.quotation = data.quotation;
      rec.quotation_ref = data.quotation.reference;
      rec.quotation_version = data.quotation.version;
      rec.quotation_status = data.quotation.status;
      rec.quotation_amount = data.quotation.total;
    }
    if (data.stage) { rec.stage = data.stage; rec.status = data.stage; }
    if (typeof ctx.refresh === "function") ctx.refresh();
  }

  // opens the new full-page 2-step editor (quotation-page.js); falls back to the old modal if that script / template is not on the page
  function openEditor(c) {
    c.post = post; c.toast = toast; c.applyResult = applyResult; c.peso = peso;
    if (typeof window.crmOpenQuotationPage === "function" && window.crmOpenQuotationPage(c)) return;
    openForm(c);
  }

  function startingRows(record, base) {
    if (base && Array.isArray(base.items) && base.items.length) return base.items.map((i) => ({ description: i.description, quantity: i.quantity, unit_price: i.unit_price }));
    const menu = Array.isArray(record.menu_items) ? record.menu_items : [];
    const rows = menu.map((m) => ({
      description: [m.name, m.tier || m.pax].filter(Boolean).join(" - "),
      quantity: Math.max(1, parseInt(m.qty_n, 10) || 1),   // how many the customer ordered
      unit_price: singlePrice(m.price),
    })).filter((r) => r.description);
    return rows.length ? rows : [{ description: "", quantity: 1, unit_price: 0 }];
  }

  /* ---------- Prepare / edit / revise form ---------- */
  function openForm(ctx) {
    const base = ctx.base || null;
    const revise = ctx.mode === "revise";
    const nextVersion = base ? (base.status === "Draft" ? base.version : base.version + 1) : 1;
    const f = crmInquiryFields(ctx.record);
    let rows = startingRows(ctx.record, base);
    const validDefault = base && base.valid_until && base.valid_until >= ymd(new Date()) ? base.valid_until : inDays(14);
    const title = (revise ? "Prepare Revised Version" : base && base.status === "Draft" ? "Edit Quotation Draft" : "Prepare Quotation") + " (v" + nextVersion + ")";

    const { el, inst } = openModal(
      '<div class="modal-header border-0 pb-0"><div><h5 class="modal-title">' + esc(title) + "</h5>" +
        '<p class="text-muted mb-0">' + esc(f.title) + " &middot; " + esc(f.ref) + "</p></div>" +
        '<button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Close"></button></div>' +
      '<div class="modal-body">' +
        '<div class="row g-2 d-none d-md-flex mb-1"><div class="col-md-4"><span class="modal-input-label">Description</span></div><div class="col-md-2"><span class="modal-input-label">Qty</span></div>' +
          '<div class="col-md-2"><span class="modal-input-label">Unit price</span></div><div class="col-md-3 text-end"><span class="modal-input-label">Amount</span></div><div class="col-md-1"></div></div>' +
        '<div data-qt-rows></div>' +
        '<button type="button" class="btn csi-outline-btn mt-1" data-qt="add">+ Add item</button>' +
        '<div class="row g-3 mt-2"><div class="col-md-6"><label class="modal-input-label" for="qtValid">Valid until</label>' +
          '<input type="date" id="qtValid" class="modal-input-field" min="' + ymd(new Date()) + '" value="' + esc(validDefault) + '"></div></div>' +
        '<div class="mt-3"><label class="modal-input-label" for="qtNotes">Message to the customer (optional)</label>' +
          '<textarea id="qtNotes" class="modal-input-field" rows="3" maxlength="2000" placeholder="Inclusions, payment reminders, special arrangements...">' + esc(base ? base.notes : "") + "</textarea></div>" +
        '<div class="mt-4"><div class="d-flex justify-content-between"><span class="text-muted">Total</span><strong data-qt-total></strong></div>' +
          '<div class="d-flex justify-content-between"><span class="text-muted">Deposit to reserve the date (' + Math.round(DEPOSIT_RATE * 100) + '%)</span><strong data-qt-deposit></strong></div>' +
          '<div class="d-flex justify-content-between"><span class="text-muted">Balance after the deposit</span><strong data-qt-balance></strong></div></div>' +
        '<p class="text-danger mt-3 mb-0" data-qt-err hidden></p>' +
      "</div>" +
      '<div class="modal-footer border-0 pt-0">' +
        '<button type="button" class="btn modal-btn-white px-3" data-bs-dismiss="modal">Cancel</button>' +
        '<button type="button" class="btn csi-outline-btn px-3" data-qt="draft">Save draft</button>' +
        '<button type="button" class="btn modal-btn-save px-3" data-qt="send">Save &amp; send to customer</button></div>'
    );

    const $ = (s) => el.querySelector(s);
    const box = $("[data-qt-rows]");

    function recalc() {
      let total = 0;
      box.querySelectorAll("[data-i]").forEach((row) => {
        const amt = (Number(row.querySelector("[data-f=quantity]").value) || 0) * (Number(row.querySelector("[data-f=unit_price]").value) || 0);
        row.querySelector("[data-amt]").textContent = peso(amt);
        total += Math.round(amt * 100) / 100;
      });
      $("[data-qt-total]").textContent = peso(total);
      $("[data-qt-deposit]").textContent = peso(total * DEPOSIT_RATE);
      $("[data-qt-balance]").textContent = peso(total - total * DEPOSIT_RATE);
    }
    function drawRows() {
      box.innerHTML = rows.map((r, i) =>
        '<div class="row g-2 align-items-center mb-2" data-i="' + i + '">' +
          '<div class="col-12 col-md-4"><input class="modal-input-field" data-f="description" maxlength="200" value="' + esc(r.description) + '" placeholder="e.g. Pork Belly - 20-25 pax"></div>' +
          '<div class="col-5 col-md-2"><input type="number" class="modal-input-field" data-f="quantity" min="0.01" step="any" value="' + esc(r.quantity) + '"></div>' +
          '<div class="col-7 col-md-2"><input type="number" class="modal-input-field" data-f="unit_price" min="0" step="any" value="' + esc(r.unit_price) + '"></div>' +
          '<div class="col-8 col-md-3 text-end fw-bold text-nowrap" data-amt></div>' +
          '<div class="col-1 text-end"><button type="button" class="btn-close" data-qt="remove" aria-label="Remove item"></button></div></div>').join("");
      recalc();
    }
    function readRows() {
      return Array.from(box.querySelectorAll("[data-i]")).map((row) => ({
        description: row.querySelector("[data-f=description]").value.trim(),
        quantity: row.querySelector("[data-f=quantity]").value,
        unit_price: row.querySelector("[data-f=unit_price]").value,
      }));
    }
    function showErr(msg) { const e = $("[data-qt-err]"); e.textContent = msg; e.hidden = !msg; }

    function save(thenSend) {
      showErr("");
      const items = readRows().filter((r) => r.description || Number(r.unit_price) > 0);
      if (!items.length) return showErr("Add at least one item.");
      if (items.some((r) => !r.description)) return showErr("Every item needs a description.");
      const valid = $("#qtValid").value;
      if (!valid) return showErr("Choose the valid-until date.");
      const buttons = el.querySelectorAll("button");
      buttons.forEach((b) => { b.disabled = true; });
      post("quotation_save", { inquiry_ref: ctx.ref, mode: ctx.mode, items: JSON.stringify(items), valid_until: valid, notes: $("#qtNotes").value.trim() })
        .then((saved) => {
          applyResult(ctx, saved);
          if (!thenSend) { inst.hide(); toast("Quotation draft saved."); return null; }
          return post("quotation_send", { inquiry_ref: ctx.ref }).then((sent) => { applyResult(ctx, sent); inst.hide(); toast(sent.message || "Quotation sent."); });
        })
        .catch((err) => { buttons.forEach((b) => { b.disabled = false; }); showErr(err.message); });
    }

    el.addEventListener("input", (e) => { if (e.target.matches("[data-f]")) recalc(); });
    el.addEventListener("click", (e) => {
      const btn = e.target.closest("[data-qt]");
      if (!btn) return;
      const what = btn.dataset.qt;
      if (what === "add") { rows = readRows(); rows.push({ description: "", quantity: 1, unit_price: 0 }); drawRows(); }
      else if (what === "remove") { rows = readRows(); rows.splice(Number(btn.closest("[data-i]").dataset.i), 1); if (!rows.length) rows.push({ description: "", quantity: 1, unit_price: 0 }); drawRows(); }
      else if (what === "draft") save(false);
      else if (what === "send") save(true);
    });
    drawRows();
  }

  /* ---------- Preview (read-only) ---------- */
  function openPreview(q, record) {
    const f = crmInquiryFields(record);
    const pill = /sent|accepted/i.test(q.status) ? "stage-won" : /declin|expire/i.test(q.status) ? "stage-loss" : "stage-proposal";
    const lines = (q.items || []).map((i) =>
      "<tr><td>" + esc(i.description) + "</td><td>" + esc(qty(i.quantity)) + "</td><td>" + esc(peso(i.unit_price)) + "</td><td>" + esc(peso(i.amount)) + "</td></tr>").join("");
    openModal(
      '<div class="modal-header border-0 pb-0"><div><h5 class="modal-title">Quotation preview</h5>' +
        '<p class="text-muted mb-0">' + esc(q.reference) + " &middot; v" + esc(q.version) + " &middot; " + esc(f.title) + "</p></div>" +
        '<button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Close"></button></div>' +
      '<div class="modal-body"><div class="ci-page">' +
        '<p><span class="stage-pill ' + pill + '">' + esc(q.status) + "</span> " +
          '<span class="text-muted">' + (q.validity ? "Valid until " + esc(q.validity) : "") + "</span></p>" +
        '<div class="ci-table-wrap"><table class="ci-food"><thead><tr><th>Description</th><th>Qty</th><th>Unit price</th><th>Amount</th></tr></thead><tbody>' + lines + "</tbody></table></div>" +
        '<div class="ci-box ci-summary"><ul class="ci-lines">' +
          '<li class="ci-total"><span>Total</span><strong>' + esc(peso(q.total)) + "</strong></li>" +
          "<li><span>Deposit to reserve the date (" + esc(q.deposit_rate) + "%)</span><strong>" + esc(peso(q.deposit_amount)) + "</strong></li>" +
          "<li><span>Balance after the deposit</span><strong>" + esc(peso(q.balance_after_deposit)) + "</strong></li></ul></div>" +
        (q.notes ? '<div class="ci-note mt-3">' + esc(q.notes) + "</div>" : "") +
      "</div></div>" +
      '<div class="modal-footer border-0 pt-0"><button type="button" class="btn modal-btn-white px-3" data-bs-dismiss="modal">Close</button></div>'
    );
  }

  const ctxOf = (e) => ({ ref: e.detail.ref, record: e.detail.record, refresh: e.detail.refresh });
  const isDeclined = (record) => /declin/i.test(String(crmInquiryFields(record).stage || ""));
  const DECLINED_MSG = "This inquiry is declined. Move it back to In Progress to reopen it first.";

  /* "Why are you declining?" popup used by the Save Stage Update button (returns the reason, or null if cancelled) */
  window.crmAskReason = function (opts) {
    opts = opts || {};
    return new Promise((resolve) => {
      let answer = null;
      const { el, inst } = openModal(
        '<div class="modal-body">' +
          '<h5 class="modal-title mb-2">' + esc(opts.title || "Reason") + "</h5>" +
          '<p class="modal-delete-text mb-3">' + esc(opts.message || "") + "</p>" +
          '<label class="modal-input-label" for="qtReason">Reason</label>' +
          '<textarea id="qtReason" class="modal-input-field" rows="3" maxlength="500" placeholder="' + esc(opts.placeholder || "") + '"></textarea>' +
          '<p class="text-danger mt-2 mb-0" data-qt-err hidden></p>' +
          '<div class="d-flex justify-content-end gap-2 mt-3">' +
            '<button type="button" class="btn modal-btn-white px-3" data-bs-dismiss="modal">Cancel</button>' +
            '<button type="button" class="btn modal-btn-danger px-3" data-qt-ok>' + esc(opts.confirmText || "Confirm") + "</button></div></div>",
        true
      );
      el.querySelector("[data-qt-ok]").addEventListener("click", () => {
        const value = el.querySelector("#qtReason").value.trim();
        if (value.length < 3) {
          const err = el.querySelector("[data-qt-err]");
          err.textContent = "Please write a short reason (at least 3 characters).";
          err.hidden = false;
          return;
        }
        answer = value;
        inst.hide();
      });
      el.addEventListener("hidden.bs.modal", () => resolve(answer));
    });
  };

  document.addEventListener("crm:quotation-prepare", (e) => {
    const ctx = ctxOf(e);
    const q = ctx.record && ctx.record.quotation;
    if (isDeclined(ctx.record)) return toast(DECLINED_MSG, "warning");
    if (q && q.status === "Accepted") return toast("The customer already accepted this quotation.", "warning");
    if (q && q.status !== "Draft" && q.status !== "Withdrawn") return toast("A quotation was already sent. Use “Prepare Revised Version” to change it.", "warning");
    openEditor(Object.assign(ctx, { mode: "save", base: q || null }));
  });

  document.addEventListener("crm:quotation-revise", (e) => {
    const ctx = ctxOf(e);
    const q = ctx.record && ctx.record.quotation;
    if (isDeclined(ctx.record)) return toast(DECLINED_MSG, "warning");
    if (!q || q.status === "Draft") return openEditor(Object.assign(ctx, { mode: "save", base: q || null }));
    if (q.status === "Accepted") return toast("The customer already accepted this quotation, so it can no longer be revised.", "warning");
    openEditor(Object.assign(ctx, { mode: "revise", base: q }));
  });

  document.addEventListener("crm:quotation-preview", (e) => {
    const q = e.detail.record && e.detail.record.quotation;
    if (!q) return toast("Prepare a quotation first.", "warning");
    openPreview(q, e.detail.record);
  });

  document.addEventListener("crm:quotation-send", (e) => {
    const ctx = ctxOf(e);
    const q = ctx.record && ctx.record.quotation;
    if (isDeclined(ctx.record)) return toast(DECLINED_MSG, "warning");
    if (!q) return toast("Prepare a quotation first.", "warning");
    if (q.status !== "Draft") return toast("This version was already " + String(q.status).toLowerCase() + ". Use “Prepare Revised Version” to send a new one.", "warning");
    crmConfirm({
      title: "Send quotation?",
      message: [
        "Quotation: " + q.reference + " (v" + q.version + ")",
        "Event date: " + (ctx.record && ctx.record.event_date ? String(ctx.record.event_date).slice(0, 10) : "\u2014") + (ctx.record && ctx.record.event_time_display ? ", " + ctx.record.event_time_display : ""),
        "Total: " + peso(q.total) + "   Deposit: " + peso(q.deposit_amount),
        "Valid until: " + (q.validity || "\u2014"),
        "",
        "Please check that everything is correct. The customer is notified right away."
      ].join("\n"),
      confirmText: "Send"
    })
      .then((ok) => {
        if (!ok) return null;
        return post("quotation_send", { inquiry_ref: ctx.ref }).then((data) => { applyResult(ctx, data); toast(data.message || "Sent."); });
      })
      .catch((err) => toast(err.message, "error"));
  });
})();

/* ============================================================================================
   quotation-page.js - Sales Staff > Inquiries > View Details > Prepare Quotation
   Full-page 2-step editor: 1 Fill Out, 2 Review & Confirm (customer-facing preview).

   Same quotation for Buffet with Setup, Customer Pickup and Delivery.
   - The dishes the customer chose on the inquiry are already in the "Selected Food Items" table.
   - "Edit Items" turns on edit mode. PAX label is preserved as stored in the menu (e.g. "20-25 PAX").
     The Portion field is pill buttons (one per tier) + an editable text input — no locked dropdown.
     Staff can remove items and add ANY item from the official menu via an image card picker.
   - Additional fee, filled in automatically (record.service_fee_default): Customer Pickup none,
     Delivery 450, Buffet with Setup by the customer's PAX bracket. Staff can edit it.

   Markup lives in sales-inquiries.html (#avQuoteView + <template id="qpTemplate">); this file only
   fills the [data-qp-*] hooks with textContent, so no data is ever written into markup.
   pages.js calls window.crmOpenQuotationPage(ctx) and falls back to its old modal if this returns false.
   ============================================================================================ */
(function () {
  "use strict";
  if (window.__crmQuotationPage) return;
  window.__crmQuotationPage = true;

  var MENU_API = "sales-inquiries.php?action=menu";
  var menuPromise = null;

  function loadMenu(force) {
    if (menuPromise && !force) return menuPromise;
    menuPromise = fetch(MENU_API, { credentials: "same-origin", headers: { Accept: "application/json" }, cache: "no-store" })
      .then(function (r) {
        return r.text().then(function (t) {
          var j = null;
          try { j = JSON.parse(t); } catch (e) { /* not JSON */ }
          if (!r.ok || !j || j.success === false) throw new Error((j && j.message) || "Could not load the menu.");
          return Array.isArray(j.items) ? j.items : [];
        });
      })
      .catch(function (e) { menuPromise = null; throw e; });
    return menuPromise;
  }

  function peso(n) {
    return "\u20B1" + (Number(n) || 0).toLocaleString("en-PH", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  }
  function num(v) { var n = parseFloat(String(v === undefined || v === null ? "" : v).replace(/,/g, "")); return isFinite(n) ? n : 0; }
  function ymd(d) { return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0"); }
  function inDays(n) { var d = new Date(); d.setDate(d.getDate() + n); return ymd(d); }
  /* Quotation "Valid until": the deposit is due QUOTE_DEPOSIT_DAYS_BEFORE_EVENT days before the event, so this date is filled in
     automatically as that day. Staff can choose an earlier date, never a later one.
     Keep this equal to DEADLINE_DEPOSIT_DAYS_BEFORE_EVENT in booking-deadlines.php. */
  var QUOTE_DEPOSIT_DAYS_BEFORE_EVENT = 3;
  function quoteValidRange(eventDate) {
    var today = ymd(new Date()), tomorrow = inDays(1), ev = String(eventDate || "").slice(0, 10);
    /* Sales Staff work until 11:00 PM and a same-day deadline must be at least 1 hour away: when no time is left today, the first day to choose is tomorrow. */
    var first = crmQuoteMinTime(today) > CRM_QUOTE_TIME_MAX ? tomorrow : today;
    if (!/^\d{4}-\d{2}-\d{2}$/.test(ev)) return { min: first, max: "", def: inDays(14) };
    var before = function (n) { var d = new Date(ev + "T00:00:00"); d.setDate(d.getDate() - n); return ymd(d); };
    var max = before(QUOTE_DEPOSIT_DAYS_BEFORE_EVENT), def = max;
    if (max < first) return { min: first, max: "", def: first };   /* event is very close: no upper limit, staff decide */
    return { min: first, max: max, def: def };
  }
  function longDate(v) {
    if (!v) return "";
    var d = new Date(String(v).slice(0, 10) + "T00:00:00");
    return isNaN(d) ? String(v) : d.toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });
  }
  function pad4(n) { return String(parseInt(n, 10) || 0).padStart(4, "0"); }
  function el(tag, cls, text) {
    var n = document.createElement(tag);
    if (cls) n.className = cls;
    if (text !== undefined && text !== null) n.textContent = text;
    return n;
  }
  function norm(s) { return String(s || "").toLowerCase().replace(/\s+/g, " ").trim(); }
  function arrKey(a) {
    a = norm(a);
    if (/pick/.test(a)) return "pickup";
    if (/deliver/.test(a)) return "delivery";
    return "onsite";
  }

  window.crmOpenQuotationPage = function (ctx) {
    var host = document.getElementById("avQuoteView");
    var tpl = document.getElementById("qpTemplate");
    var detail = document.getElementById("avDetailView");
    if (!host || !tpl || !tpl.content || !detail || !ctx || !ctx.record) return false;
    start(ctx, host, tpl, detail);
    return true;
  };

  function start(ctx, host, tpl, detail) {
    var rec = ctx.record;
    var base = ctx.base || null;
    var revise = ctx.mode === "revise";
    var version = base ? (base.status === "Draft" ? base.version : base.version + 1) : 1;
    var inquiryRef = rec.inquiry_ref || rec.reference || ctx.ref || "";
    var inquiryId = rec.lead_id || rec.id || inquiryRef.replace(/\D/g, "");
    var quoteCode = "QT-" + pad4(inquiryId);

    var state = { rows: [], skipped: [], menu: [], cats: [], byId: {}, itemId: 0, tier: "", step: 1, dirty: false, busy: false, edit: false };

    host.textContent = "";
    host.appendChild(tpl.content.cloneNode(true));
    var root = host.firstElementChild;
    var q = function (sel) { return root.querySelector(sel); };
    var qa = function (sel) { return Array.prototype.slice.call(root.querySelectorAll(sel)); };
    var hook = function (name) { return q('[data-qp="' + name + '"]'); };
    var out = function (name, text) { qa('[data-qp-out="' + name + '"]').forEach(function (n) { n.textContent = text; }); };

    /* ---------- static fill ---------- */
    var arrLabel = rec.arrangement || "";
    out("page-title", (revise ? "Prepare Revised " : base && base.status === "Draft" ? "Edit " : "Create ") + "Quotation");
    out("mode", "Mode: " + (revise ? "Revised" : "New") + " Quotation");
    out("inquiry-ref", inquiryRef);
    out("customer", rec.customer_name || "");
    out("event", rec.event_name || rec.event_title || "");
    out("date", longDate(rec.event_date));
    out("location", rec.event_location || rec.venue || "");
    out("arrangement", arrLabel);
    out("doc-version", "Quotation \u2014 Version V" + version);
    out("doc-ref", quoteCode);
    out("doc-v", "V" + version);
    out("issue", longDate(ymd(new Date())));
    out("menu-hint", "These are the dishes the customer chose. If the customer wants changes, press Edit Items to change the portion or quantity, remove an item, or add any item from the official menu.");
    var back = rec.inquiry_ref || rec.reference || "";
    out("back-label", "Back to Inquiry Details" + (back ? " (" + back + ")" : ""));
    var key = arrKey(arrLabel);
    qa("[data-arr]").forEach(function (c) { c.classList.toggle("is-on", c.getAttribute("data-arr") === key); });

    /* additional fee: filled in automatically, editable except on Customer Pickup */
    var feeEditable = rec.service_fee_editable !== false && key !== "pickup";
    var feeDefault = feeEditable ? Number(rec.service_fee_default) || 0 : 0;
    var paxNum = Number(rec.expected_guests || rec.pax) || 0;
    var feeNote = String(rec.service_fee_note || (key === "pickup" ? "Customer pickup has no additional fee." : "")).replace(/[.\s]+$/, "");
    out("charge-hint", (feeNote ? feeNote + ". " : "") + (feeEditable ? "Filled in automatically; you can edit it." : ""));
    hook("pax-wrap").hidden = key !== "onsite";
    /* Food Delivery: show the customer's delivery address next to the fee, since the fee depends on it */
    var addrWrap = hook("addr-wrap");
    if (addrWrap) addrWrap.hidden = key !== "delivery";
    out("addr", rec.event_location || rec.venue || rec.venue_address || "\u2014");
    hook("bracket-wrap").hidden = key !== "onsite";
    out("pax", paxNum ? paxNum + " PAX" : "Not provided");
    out("bracket", rec.service_fee_bracket || "\u2014");

    var validEl = hook("valid"), validTimeEl = null, rateEl = hook("rate"), discEl = hook("discount"), extraEl = hook("extra"), notesEl = hook("notes");
    /* Valid until: filled in from the event date (editable), limited to the last day to pay the deposit */
    var vr = quoteValidRange(rec.event_date);
    /* mark the event date inside the calendar (date-picker.js reads data-mark-date) */
    var markDay = String(rec.event_date || "").slice(0, 10);
    if (/^\d{4}-\d{2}-\d{2}$/.test(markDay)) { validEl.setAttribute("data-mark-date", markDay); validEl.setAttribute("data-mark-label", "Event date"); }
    validEl.min = vr.min;
    if (vr.max) validEl.max = vr.max; else validEl.removeAttribute("max");
    /* only an unsent DRAFT keeps its own deadline; a revision starts again from the automatic date (the old one is usually past or about to pass) */
    var useBaseDeadline = !!(base && base.status === "Draft" && base.valid_until && base.valid_until >= vr.min && (!vr.max || base.valid_until <= vr.max));
    validEl.value = useBaseDeadline ? base.valid_until : vr.def;
    var validWrap = hook("valid-wrap");
    if (validWrap && vr.max) {
      var validHint = document.createElement("div");
      validHint.style.cssText = "font-size:12px;opacity:.75;margin-top:6px;";
      validHint.textContent = "Filled in automatically: the deposit is due " + QUOTE_DEPOSIT_DAYS_BEFORE_EVENT + " days before the event (" + (longDate(vr.max) || vr.max) + "). You can choose an earlier date, but not a later one.";
      validWrap.appendChild(validHint);
    }
    /* Valid-until TIME (8:00 AM - 8:00 PM). Required when the date is today; for a later date it defaults to 8:00 PM. */
    /* Rush events only: the time of the deadline is shown when the event is 3 days away or less (or when the valid-until date is today).
       Further events get a date-only deadline, with no time field. */
    var timeWrap = null;
    var rushEvent = (function () {
      var evDay = String(rec.event_date || "").slice(0, 10);
      if (!/^\d{4}-\d{2}-\d{2}$/.test(evDay)) return false;
      var days = Math.round((new Date(evDay + "T00:00:00") - new Date(ymd(new Date()) + "T00:00:00")) / 86400000);
      /* same rule as customers: after 9:00 PM the earliest event date they can pick moves 1 day later (3 days -> 4 days), so that date is a rush too */
      return days <= 3 + (new Date().getHours() >= 21 ? 1 : 0);
    })();
    (function () {
      var host = validWrap || validEl.parentNode;
      var wrap = document.createElement("div");
      timeWrap = wrap;
      wrap.style.marginTop = "12px";
      var lab = document.createElement("label");
      var firstLabel = host.querySelector("label");
      lab.className = firstLabel ? firstLabel.className : "modal-input-label";
      lab.htmlFor = "qtValidTime";
      lab.textContent = "Valid until time";
      validTimeEl = document.createElement("input");
      validTimeEl.type = "time";
      validTimeEl.id = "qtValidTime";
      validTimeEl.className = validEl.className;
      validTimeEl.min = crmQuoteMinTime(validEl.value);
      validTimeEl.max = CRM_QUOTE_TIME_MAX;
      validTimeEl.step = "1800";   // 8:00, 8:30 ... 11:00 PM
      validTimeEl.required = true;
      validTimeEl.setAttribute("data-time-label", "Valid until time");
      validTimeEl.value = useBaseDeadline && base.valid_until_time && String(base.valid_until_time).slice(0, 5) !== "23:59" ? String(base.valid_until_time).slice(0, 5) : "";   // empty = 11:59 PM of that day
      var tHint = document.createElement("div");
      tHint.style.cssText = "font-size:12px;opacity:.75;margin-top:6px;";
      tHint.textContent = "The customer must accept the quotation before this date and time (8:00 AM to 11:00 PM). Required when the date is today (at least 1 hour from now, on the hour or half hour). For a later date, leave it empty and the deadline is 11:59 PM of that day.";
      wrap.appendChild(lab);
      wrap.appendChild(validTimeEl);
      wrap.appendChild(tHint);
      host.appendChild(wrap);
    })();
    var clampValid = function () {
      if (vr.max && validEl.value > vr.max) validEl.value = vr.max;
      if (validEl.value && validEl.value < vr.min) validEl.value = vr.min;
    };
    validEl.addEventListener("change", clampValid);
    validEl.addEventListener("blur", clampValid);
    /* the time list follows the date: today starts 1 hour from now (next :00 / :30), any other day starts at 8:00 AM */
    var syncValidTime = function () {
      if (!validTimeEl) return;
      var showTime = rushEvent;   // only a rush event has a deadline time; otherwise the deadline is 11:59 PM of the chosen date (also when it is today)
      if (timeWrap) timeWrap.style.display = showTime ? "" : "none";
      var isToday = validEl.value === ymd(new Date());
      validTimeEl.required = isToday && rushEvent;   // rush event + today: a time is required; otherwise empty = 11:59 PM of that day
      if (!showTime) { validTimeEl.value = ""; delete validTimeEl.dataset.auto; return; }
      var min = crmQuoteMinTime(validEl.value);
      validTimeEl.min = min;
      if (isToday) {
        if (!validTimeEl.value) { validTimeEl.value = min; validTimeEl.dataset.auto = min; }
      } else if (validTimeEl.dataset.auto && validTimeEl.value === validTimeEl.dataset.auto) {
        validTimeEl.value = ""; delete validTimeEl.dataset.auto;   // filled in for "today": a later date goes back to empty
      }
      if (validTimeEl.value && validTimeEl.value < min) validTimeEl.value = min;
    };
    validEl.addEventListener("change", syncValidTime);
    validEl.addEventListener("input", syncValidTime);
    if (validTimeEl) {
      validTimeEl.addEventListener("focus", syncValidTime);       // the clock keeps moving while the form is open
      validTimeEl.addEventListener("mousedown", syncValidTime);
    }
    syncValidTime();
    rateEl.value = base && base.deposit_rate ? base.deposit_rate : 20;
    discEl.value = base && base.discount ? base.discount : 0;
    extraEl.value = base ? (base.extra_charge || 0) : feeDefault;
    /* editable unless Customer Pickup: clear any readonly / disabled left on the field by the page template */
    extraEl.disabled = !feeEditable;
    extraEl.readOnly = !feeEditable;
    if (feeEditable) {
      extraEl.removeAttribute("readonly");
      extraEl.removeAttribute("disabled");
      /* plain text box with a decimal keypad: the shared number-field key/wheel handlers no longer touch it */
      extraEl.type = "text"; extraEl.inputMode = "decimal"; extraEl.autocomplete = "off";
      extraEl.removeAttribute("min"); extraEl.removeAttribute("step");
      extraEl.style.pointerEvents = "auto";
      extraEl.addEventListener("input", function () {
        var v = extraEl.value.replace(/[^\d.]/g, "");
        var i = v.indexOf(".");
        if (i !== -1) v = v.slice(0, i + 1) + v.slice(i + 1).replace(/\./g, "");
        if (v !== extraEl.value) extraEl.value = v;
      });
      extraEl.addEventListener("focus", function () { extraEl.select(); });
    }
    notesEl.value = base && base.notes ? base.notes : "";
    var resetBtn = hook("fee-reset");
    function syncFeeReset() {
      resetBtn.hidden = !feeEditable || !state.feeEdit || Math.abs(num(extraEl.value) - feeDefault) < 0.005;
      resetBtn.textContent = "Reset to " + peso(feeDefault);
    }
    resetBtn.addEventListener("click", function () { extraEl.value = feeDefault; state.dirty = true; syncFeeReset(); refreshTotals(); });
    extraEl.addEventListener("input", syncFeeReset);
    syncFeeReset();

    /* ---- Additional fee section: plain text normally, typed boxes after "Edit" (same idea as Edit Items) ----
       Event guests (PAX) and the service-fee bracket only exist on Buffet with Setup.
       Typing a guest count fills the bracket and the fee; typing a bracket (e.g. 51-75) fills the fee;
       the fee itself can always be typed over. Brackets mirror BUFFET_FEE_BRACKETS in inquiry-common.php. */
    (function () {
      var BR = [[25, 1000], [50, 1500], [75, 2000], [100, 2500], [150, 3500], [200, 4500]];
      function bracketIndex(p) {
        if (!(p >= 1)) return -1;
        for (var i = 0; i < BR.length; i++) if (p <= BR[i][0]) return i;
        return BR.length;
      }
      function lo(i) { return i === 0 ? 1 : BR[i - 1][0] + 1; }
      function feeFor(i) { return i >= 0 && i < BR.length ? BR[i][1] : 0; }
      function bracketLabel(i) {
        if (i < 0) return "";
        if (i >= BR.length) return "Over 200 PAX";
        return lo(i) + "-" + BR[i][0] + " PAX";
      }
      function noteFor(i) {
        if (i < 0) return "No guest count: enter the setup fee";
        if (i >= BR.length) return "More than 200 PAX: enter the setup fee";
        return bracketLabel(i) + " bracket";
      }

      var onsite = key === "onsite";
      var section = hook("extra").closest("section");
      var head = section && section.querySelector(".av-d-card-head");
      var feeBox = hook("extra").closest(".qp-fee-input");
      var feeLabel = feeBox.querySelector("label");
      var paxBox = hook("pax-wrap"), brBox = hook("bracket-wrap");
      var paxText = paxBox.querySelector('[data-qp-out="pax"]');
      var brText = brBox.querySelector('[data-qp-out="bracket"]');
      var paxVal = paxNum, brVal = onsite ? (rec.service_fee_bracket || "") : "";

      /* the fee box looks like the other two boxes; its label uses the same small caps label */
      feeBox.classList.add("qp-info");
      if (feeLabel) { feeLabel.classList.remove("modal-input-label"); feeLabel.classList.add("av-d-label"); }
      extraEl.classList.add("qp-fee-edit");
      var feeText = el("span", "av-d-value");
      feeBox.insertBefore(feeText, extraEl);

      var paxIn = el("input", "modal-input-field qp-fee-edit");
      paxIn.type = "text"; paxIn.inputMode = "numeric"; paxIn.autocomplete = "off"; paxIn.placeholder = "e.g. 30";
      paxIn.setAttribute("aria-label", "Event guests (PAX)");
      paxBox.appendChild(paxIn);
      var brIn = el("input", "modal-input-field qp-fee-edit");
      brIn.type = "text"; brIn.autocomplete = "off"; brIn.placeholder = "e.g. 26-50 PAX";
      brIn.setAttribute("aria-label", "Service-fee bracket");
      brBox.appendChild(brIn);

      function render() {
        var on = !!state.feeEdit;
        paxText.textContent = paxVal ? paxVal + " PAX" : "Not provided";
        brText.textContent = brVal || "\u2014";
        feeText.textContent = peso(num(extraEl.value));
        paxText.style.display = brText.style.display = feeText.style.display = on ? "none" : "";
        paxIn.style.display = brIn.style.display = extraEl.style.display = on ? "" : "none";
        if (document.activeElement !== paxIn) paxIn.value = paxVal ? String(paxVal) : "";
        if (document.activeElement !== brIn) brIn.value = brVal;
        syncFeeReset();
      }
      function setFee(f, note) {
        feeDefault = f;
        extraEl.value = f;
        if (note) out("charge-hint", note + ". Filled in automatically; you can edit it.");
        state.dirty = true;
        render();
        refreshTotals();
      }

      paxIn.addEventListener("input", function () {
        var v = paxIn.value.replace(/\D/g, "").slice(0, 5);
        if (v !== paxIn.value) paxIn.value = v;
        paxVal = parseInt(v, 10) || 0;
        var i = bracketIndex(paxVal);
        brVal = bracketLabel(i);
        brIn.value = brVal;
        setFee(feeFor(i), noteFor(i));
      });
      brIn.addEventListener("input", function () {
        brVal = brIn.value;
        var nums = brVal.match(/\d+/g);
        var hi = nums ? parseInt(nums[nums.length - 1], 10) : 0;
        if (hi >= 1 && hi <= BR[BR.length - 1][0]) {         /* a recognised bracket: use its fee */
          var i = bracketIndex(hi);
          setFee(feeFor(i), noteFor(i));
        } else { state.dirty = true; render(); }              /* custom text: leave the fee as it is */
      });
      extraEl.addEventListener("input", render);
      resetBtn.addEventListener("click", render);

      /* Edit / Done Editing button next to the arrangement chips (hidden when nothing is editable: Customer Pickup) */
      if (feeEditable && head) {
        var chips = head.querySelector(".qp-chips");
        var right = el("div", "csi-head-actions");
        var btn = el("button", "btn csi-outline-btn qp-edit");
        btn.type = "button";
        var ic = el("i", "bi bi-pencil"); ic.setAttribute("aria-hidden", "true");
        var lab = el("span", "", "Edit");
        btn.appendChild(ic); btn.appendChild(document.createTextNode(" ")); btn.appendChild(lab);
        if (chips) right.appendChild(chips);
        right.appendChild(btn);
        head.appendChild(right);
        btn.addEventListener("click", function () {
          state.feeEdit = !state.feeEdit;
          lab.textContent = state.feeEdit ? "Done Editing" : "Edit";
          ic.className = "bi " + (state.feeEdit ? "bi-check-lg" : "bi-pencil");
          render();
          if (state.feeEdit) (onsite ? paxIn : extraEl).focus();
        });
      }
      render();
    })();

    function showError(msg) {
      var e = hook("error");
      e.textContent = msg || "";
      e.hidden = !msg;
      if (msg && e.scrollIntoView) e.scrollIntoView({ block: "center", behavior: "smooth" });
    }

    /* ---------- menu helpers ---------- */
    function currentItem() { return state.byId[state.itemId] || null; }
    function tierOf(item, name) {
      if (!item) return null;
      for (var i = 0; i < item.tiers.length; i++) if (norm(item.tiers[i].name) === norm(name)) return item.tiers[i];
      return null;
    }
    function priceFor(item, tier) { return tier ? tier.price : item && item.base_price !== null ? item.base_price : null; }
    function isRangePrice(item, tier) { return !!item && !tier && !!item.price_range; }
    function catClass(c) { var i = state.cats.indexOf(c); return "av-d-cat qp-cat-" + (i < 0 ? 0 : i % 5); }

    /* ---------- image card menu picker ---------- */
    function buildItemSelect() {
      /* Keep the original hidden <select data-qp="item"> for compatibility with the change event */
      var sel = hook("item");
      sel.textContent = "";
      sel.style.display = "none";
      state.cats.forEach(function (c) {
        var g = el("optgroup"); g.label = c || "Other";
        state.menu.filter(function (m) { return m.category === c; }).forEach(function (m) {
          var o = el("option", "", m.name); o.value = m.id; g.appendChild(o);
        });
        sel.appendChild(g);
      });

      /* Build the visual image-card picker widget */
      var addPanel = hook("add-panel");
      if (!addPanel) return;
      var oldPicker = addPanel.querySelector(".qp-item-picker-wrap");
      if (oldPicker) oldPicker.remove();

      var pickerWrap = el("div", "qp-item-picker-wrap");

      /* Toggle button — shows selected item thumbnail + name */
      var toggleBtn = el("button", "qp-item-toggle modal-input-field");
      toggleBtn.type = "button";
      toggleBtn.setAttribute("data-qp", "item-toggle");
      toggleBtn.setAttribute("aria-expanded", "false");
      toggleBtn.setAttribute("aria-haspopup", "listbox");
      pickerWrap.appendChild(toggleBtn);

      /* Dropdown card panel */
      var panel = el("div", "qp-item-panel");
      panel.setAttribute("data-qp", "item-picker");
      panel.setAttribute("role", "listbox");
      panel.hidden = true;

      /* Search box */
      var searchBox = el("input", "qp-item-search modal-input-field");
      searchBox.type = "search";
      searchBox.placeholder = "Search menu\u2026";
      searchBox.setAttribute("aria-label", "Search menu items");
      panel.appendChild(searchBox);

      /* Card grid container */
      var grid = el("div", "qp-item-grid");
      panel.appendChild(grid);

      function renderCards(filter) {
        grid.textContent = "";
        var f = norm(filter || "");
        var anyShown = false;
        state.cats.forEach(function (c) {
          var items = state.menu.filter(function (m) {
            return m.category === c && (!f || norm(m.name).indexOf(f) > -1 || norm(m.category).indexOf(f) > -1);
          });
          if (!items.length) return;
          anyShown = true;
          /* one section per category: the heading sits on its own row, the cards get their own grid */
          var section = el("div", "qp-item-section");
          /* same coloured category badge as the tables (.av-d-cat) and the same count chip as Menu Management (.mm-count) */
          var catHead = el("div", "qp-item-cat-head");
          catHead.appendChild(el("span", catClass(c), c || "Other"));
          catHead.appendChild(el("span", "mm-count", String(items.length)));
          section.appendChild(catHead);
          var cards = el("div", "qp-item-cards");
          section.appendChild(cards);
          grid.appendChild(section);
          items.forEach(function (m) {
            var card = el("div", "qp-item-card" + (m.id === state.itemId ? " is-selected" : ""));
            card.setAttribute("data-mid", String(m.id));
            card.setAttribute("role", "option");
            card.setAttribute("aria-selected", String(m.id === state.itemId));

            /* Photo or placeholder */
            if (m.photo) {
              var img = el("img");
              img.src = m.photo; img.alt = m.name; img.className = "qp-item-img";
              img.onerror = function () { this.parentNode.replaceChild(makePlaceholder(), this); };
              card.appendChild(img);
            } else {
              card.appendChild(makePlaceholder());
            }

            /* Info block */
            var info = el("div", "qp-item-info");
            var nm = el("div", "qp-item-name"); nm.textContent = m.name; info.appendChild(nm);
            if (m.price_text) { var pr = el("div", "qp-item-price"); pr.textContent = m.price_text; info.appendChild(pr); }
            if (m.tiers && m.tiers.length) {
              var ti = el("div", "qp-item-tiers");
              ti.textContent = m.tiers.map(function (t) { return t.name; }).join(" \u00B7 ");
              info.appendChild(ti);
            } else if (m.specs) {
              var sp = el("div", "qp-item-tiers"); sp.textContent = m.specs; info.appendChild(sp);
            }
            card.appendChild(info);

            card.addEventListener("click", function () {
              state.itemId = m.id;
              sel.value = m.id;
              /* update selected visuals */
              grid.querySelectorAll(".qp-item-card").forEach(function (x) {
                var on = Number(x.getAttribute("data-mid")) === m.id;
                x.classList.toggle("is-selected", on);
                x.setAttribute("aria-selected", String(on));
              });
              updateToggleBtn();
              selectItem(m.id, true /* from picker */);
              closePanel();
            });
            cards.appendChild(card);
          });
        });
        if (!anyShown) {
          var empty = el("div", "crm-no-results-state qp-item-empty");
          empty.setAttribute("role", "status");
          empty.innerHTML = '<i class="bi bi-search" aria-hidden="true"></i>' +
            '<p class="crm-no-results-title">No results found</p>' +
            '<p class="crm-no-results-description">Try changing your search or filters.</p>';
          grid.appendChild(empty);
        }
      }

      function makePlaceholder() {
        var ph = el("div", "qp-item-img qp-item-img-ph");
        var ic = el("i", "bi bi-image"); ph.appendChild(ic);
        return ph;
      }

      function updateToggleBtn() {
        var item = state.byId[state.itemId];
        toggleBtn.textContent = "";
        if (item && item.photo) {
          var tImg = el("img"); tImg.src = item.photo; tImg.alt = item.name;
          tImg.className = "qp-toggle-img";
          tImg.onerror = function () { this.style.display = "none"; };
          toggleBtn.appendChild(tImg);
        }
        var tName = el("span", "qp-toggle-name");
        tName.textContent = item ? item.name : "\u2014 Choose a menu item \u2014";
        toggleBtn.appendChild(tName);
        var tChev = el("i", "bi bi-chevron-down qp-toggle-chev");
        toggleBtn.appendChild(tChev);
      }

      function openPanel() {
        panel.hidden = false;
        toggleBtn.setAttribute("aria-expanded", "true");
        searchBox.value = "";
        renderCards("");
        searchBox.focus();
      }

      function closePanel() {
        panel.hidden = true;
        toggleBtn.setAttribute("aria-expanded", "false");
      }

      toggleBtn.addEventListener("click", function (e) {
        e.stopPropagation();
        panel.hidden ? openPanel() : closePanel();
      });

      searchBox.addEventListener("input", function () { renderCards(searchBox.value); });
      searchBox.addEventListener("keydown", function (e) {
        if (e.key === "Escape") { closePanel(); toggleBtn.focus(); }
      });

      /* Close on outside click */
      document.addEventListener("click", function (ev) {
        if (!panel.hidden && !pickerWrap.contains(ev.target)) closePanel();
      }, true);

      pickerWrap.appendChild(panel);
      /* Insert the picker wrap before the existing (now hidden) select */
      sel.parentNode.insertBefore(pickerWrap, sel);

      if (state.menu.length) {
        state.itemId = state.menu[0].id;
        sel.value = state.itemId;
      }
      updateToggleBtn();
      renderCards("");
      selectItem(state.itemId, true);
    }

    /* ---------- portion: pill buttons + editable text input ---------- */
    function selectItem(id, fromPicker) {
      state.itemId = Number(id) || 0;
      var item = currentItem();
      /* Auto-select first tier; keep state.tier if the same item was re-selected */
      if (!fromPicker || state.itemId !== Number(id)) {
        state.tier = item && item.tiers.length ? item.tiers[0].name : (item ? (item.specs || "") : "");
      } else {
        state.tier = item && item.tiers.length ? item.tiers[0].name : (item ? (item.specs || "") : "");
      }
      renderPortion();
    }

    function renderPortion() {
      var item = currentItem();
      /* Find or create the portion wrapper next to [data-qp="portion"] */
      var portionInput = hook("portion");
      if (!portionInput) { updateAddInfo(); return; }
      var wrap = portionInput.parentNode;

      /* If the template gave us a <select>, replace it with an <input> FIRST
         (setting .type on a <select> throws "only a getter") */
      if (portionInput.tagName === "SELECT") {
        var inp = document.createElement("input");
        inp.className = "modal-input-field qp-portion-input";
        inp.setAttribute("data-qp", "portion");
        inp.type = "text";
        portionInput.parentNode.replaceChild(inp, portionInput);
        portionInput = inp;
      } else {
        if (portionInput.className.indexOf("qp-portion-input") === -1) {
          portionInput.className += " qp-portion-input";
        }
      }

      /* Clear any previously-built pill row (safe to do after swap) */
      var oldRow = wrap.querySelector(".qp-tier-btns");
      if (oldRow) oldRow.remove();
      var oldLabel = wrap.querySelector(".qp-portion-tier-label");
      if (oldLabel) oldLabel.remove();

      portionInput.readOnly = false;
      portionInput.placeholder = "e.g. 20-25 PAX";

      if (item && item.tiers.length) {
        /* Pill buttons row */
        var tierLabel = el("div", "qp-portion-tier-label"); tierLabel.textContent = "Choose portion:";
        var btnRow = el("div", "qp-tier-btns");
        item.tiers.forEach(function (t) {
          var b = el("button", "qp-tier-btn" + (norm(t.name) === norm(state.tier) ? " is-active" : ""), t.name);
          b.type = "button";
          b.setAttribute("data-tier", t.name);
          b.addEventListener("click", function () {
            state.tier = t.name;
            /* sync active pill */
            btnRow.querySelectorAll(".qp-tier-btn").forEach(function (x) {
              x.classList.toggle("is-active", x.getAttribute("data-tier") === t.name);
            });
            /* sync editable input */
            var pi = wrap.querySelector('[data-qp="portion"]');
            if (pi) pi.value = t.name;
            updateAddInfo();
          });
          btnRow.appendChild(b);
        });
        wrap.insertBefore(tierLabel, portionInput);
        wrap.insertBefore(btnRow, portionInput);
        /* editable input pre-filled with current tier name, labelled "or type custom" */
        portionInput.value = state.tier;
        portionInput.placeholder = "or type a custom portion\u2026";
      } else {
        /* No tiers — pre-fill from item.specs (now carries "20-25 PAX") */
        portionInput.value = item ? (item.specs || "") : "";
      }

      /* Sync state.tier when staff edits the text directly */
      portionInput.oninput = function () { state.tier = portionInput.value; updateAddInfo(); };
      updateAddInfo();
    }

    /* serving size + price — PAX label is now preserved from the menu */
    function updateAddInfo() {
      var item = currentItem();
      var tier = tierOf(item, state.tier);
      var price = priceFor(item, tier);
      var qty = Math.max(0, Math.floor(num(hook("qty").value)));
      /* pax label: use the tier's pax_description (now "20-25 PAX") or item.specs */
      var paxLabel = tier ? tier.pax : (item ? (item.specs || "") : "");
      out("add-serving", paxLabel || (tier ? tier.name : "") || "\u2014");
      out("add-price", price === null ? "No price in menu" : (isRangePrice(item, tier) ? "from " : "") + peso(price));
      out("add-line", price === null ? "\u2014" : peso(price * qty));
    }

    function addRow() {
      showError("");
      var item = currentItem();
      if (!item) return showError("Choose a menu item first.");
      var tier = tierOf(item, state.tier);
      if (item.tiers.length && !tier) return showError("Choose a portion for " + item.name + ".");
      var price = priceFor(item, tier);
      if (price === null) return showError(item.name + " has no price in the menu yet. Set it in Menu Management first.");
      var qty = Math.floor(num(hook("qty").value));
      if (qty < 1) return showError("Quantity must be at least 1.");

      /* Use the editable portion input value as the pax label (may have been customised) */
      var portionInput = hook("portion");
      var editedPax = portionInput ? portionInput.value.trim() : "";
      var autoPax = tier ? tier.pax : (item.specs || "");
      var finalPax = editedPax || autoPax;

      var hit = state.rows.filter(function (r) {
        return r.menu_item_id === item.id && norm(r.tier) === norm(tier ? tier.name : "");
      })[0];
      if (hit) {
        hit.quantity += qty;
        /* also update pax if staff edited it */
        if (editedPax) hit.pax = editedPax;
      } else {
        state.rows.push({
          menu_item_id: item.id, name: item.name, category: item.category,
          tier: tier ? tier.name : "", pax: finalPax,
          quantity: qty, unit_price: price, range: isRangePrice(item, tier)
        });
      }
      hook("qty").value = 1;
      updateAddInfo();
      state.dirty = true;
      renderRows();
    }

    /* ---------- selected items table: read mode / edit mode ---------- */
    function rowAmount(r) { return Math.round((Number(r.quantity) || 0) * (Number(r.unit_price) || 0) * 100) / 100; }
    function subtotal() { return state.rows.reduce(function (s, r) { return s + rowAmount(r); }, 0); }
    function totals() {
      var sub = subtotal();
      var extra = feeEditable ? Math.max(0, num(extraEl.value)) : 0;
      var disc = Math.max(0, num(discEl.value));
      var total = Math.round((sub + extra - disc) * 100) / 100;
      var rate = Math.floor(num(rateEl.value));
      var dep = Math.round(total * rate) / 100;
      return { sub: sub, extra: extra, disc: disc, total: total, rate: rate, dep: dep, bal: Math.round((total - dep) * 100) / 100 };
    }

    function setEdit(on) {
      state.edit = !!on;
      hook("table").classList.toggle("is-edit", state.edit);
      hook("add-panel").hidden = !state.edit || !state.menu.length;
      out("edit-label", state.edit ? "Done Editing" : "Edit Items");
      var icon = hook("edit-toggle").querySelector("i");
      if (icon) icon.className = "bi " + (state.edit ? "bi-check-lg" : "bi-pencil");
      renderRows();
    }

    function renderRows() {
      var body = hook("rows");
      body.textContent = "";
      state.rows.forEach(function (r, i) {
        var item = state.byId[r.menu_item_id];
        var tr = el("tr");
        var c1 = el("td");
        c1.appendChild(el("span", catClass(r.category), r.category || "Item"));
        c1.appendChild(document.createTextNode(" "));
        c1.appendChild(el("b", "", r.name || r.description));
        tr.appendChild(c1);

        var c2 = el("td");   /* PAX label — now shows "20-25 PAX" as stored */
        c2.appendChild(el("span", "qp-pill", r.pax || r.tier || "\u2014"));
        tr.appendChild(c2);

        var c3 = el("td", "qp-c-qty");
        var amt;
        if (state.edit) {
          var qin = el("input", "modal-input-field qp-mini qp-qty");
          qin.type = "number"; qin.min = "1"; qin.step = "1"; qin.value = r.quantity;
          qin.setAttribute("aria-label", "Quantity of " + (r.name || "item"));
          qin.addEventListener("input", function () { r.quantity = Math.max(0, num(qin.value)); state.dirty = true; amt.textContent = peso(rowAmount(r)); refreshTotals(); });
          c3.appendChild(qin);
        } else c3.appendChild(el("span", "qp-qty-text", String(r.quantity)));
        tr.appendChild(c3);

        tr.appendChild(el("td", "qp-num", (r.range ? "from " : "") + peso(r.unit_price)));

        amt = el("td", "qp-num qp-strong", peso(rowAmount(r)));
        tr.appendChild(amt);

        var c6 = el("td", "qp-col-action");
        var del = el("button", "qp-del");
        del.type = "button"; del.setAttribute("aria-label", "Remove " + (r.name || "item"));
        var ic = el("i", "bi bi-trash"); ic.setAttribute("aria-hidden", "true"); del.appendChild(ic);
        del.addEventListener("click", function () { state.rows.splice(i, 1); state.dirty = true; renderRows(); });
        c6.appendChild(del);
        tr.appendChild(c6);
        body.appendChild(tr);
      });
      hook("rows-empty").hidden = state.rows.length > 0;
      var ranged = state.rows.filter(function (r) { return r.range; }).map(function (r) { return r.name; });
      var notes = [];
      if (ranged.length) notes.push(ranged.join(", ") + " use" + (ranged.length === 1 ? "s" : "") + " the starting price of the menu range. Add portion prices in Menu Management for an exact price.");
      if (state.skipped && state.skipped.length) notes.push(state.skipped.join(", ") + " could not be added because the menu has no price for " + (state.skipped.length === 1 ? "it" : "them") + ".");
      var rn = hook("range-note");
      rn.textContent = notes.join(" ");
      rn.hidden = !notes.length;
      out("count", String(state.rows.length));
      refreshTotals();
    }

    function refreshTotals() { out("subtotal", peso(totals().sub)); }

    /* ---------- validate + preview ---------- */
    function validate() {
      if (!state.rows.length) return "Add at least one food item (press Edit Items).";
      for (var i = 0; i < state.rows.length; i++) {
        var r = state.rows[i], item = state.byId[r.menu_item_id];
        if (!(r.quantity >= 1)) return "Every quantity must be at least 1.";
        if (item && item.tiers.length && !tierOf(item, r.tier)) return "Choose a portion for " + r.name + ".";
        if (!(Number(r.unit_price) > 0)) return (r.name || "An item") + " has no price in the menu. Remove it or set its price in Menu Management.";
      }
      var t = totals();
      if (!validEl.value || validEl.value < ymd(new Date())) return "Choose a valid-until date that is today or later.";
      if (validEl.value < vr.min) return "It is too late to set a deadline for today (the time must be at least 1 hour from now and no later than 11:00 PM). Choose " + (longDate(vr.min) || vr.min) + " or later.";
      if (vr.max && validEl.value > vr.max) return "The valid-until date cannot be after " + (longDate(vr.max) || vr.max) + ", the last day to pay the deposit before the event.";
      var timeProblem = crmQuoteDeadlineProblem(validEl.value, validTimeEl ? validTimeEl.value : "", "quotation deadline", rushEvent);
      if (timeProblem) return timeProblem;
      if (!(t.rate >= 1 && t.rate <= 100)) return "The deposit percentage must be between 1 and 100.";
      if (t.disc > t.sub + t.extra) return "The discount cannot be more than the order total.";
      if (t.total <= 0) return "The total must be greater than zero.";
      return "";
    }

    function renderPreview() {
      var t = totals();
      var body = hook("prev-rows");
      body.textContent = "";
      state.rows.forEach(function (r) {
        var tr = el("tr");
        var c0 = el("td"); c0.appendChild(el("span", catClass(r.category), r.category || "Item")); tr.appendChild(c0);
        tr.appendChild(el("td", "qp-strong", r.name || r.description));
        var c2 = el("td"); c2.appendChild(el("span", "qp-pill", r.pax || r.tier || "\u2014")); tr.appendChild(c2);
        tr.appendChild(el("td", "qp-num", String(r.quantity)));
        tr.appendChild(el("td", "qp-num", peso(r.unit_price)));
        tr.appendChild(el("td", "qp-num qp-strong", peso(rowAmount(r))));
        body.appendChild(tr);
      });
      var validLong = longDate(validEl.value) || validEl.value;
      out("valid-out", validLong);
      if (validEl.value) { validLong += ", " + (validTimeEl && validTimeEl.value ? (crmTimeText(validTimeEl.value) || validTimeEl.value) : "11:59 PM"); out("valid-out", validLong); }
      out("terms-line", "Quotation Valid Until: " + validLong + "  \u00B7  Deposit Requirement: " + t.rate + "% upon acceptance");
      out("terms-text", "This quotation is valid until the date stated above. Issuing or sending a quotation does not reserve the event date; event scheduling is confirmed only upon customer acceptance and deposit verification.");
      var msg = notesEl.value.trim();
      var m = q('[data-qp-out="message"]');
      m.textContent = msg; m.hidden = !msg;
      out("s-sub", peso(t.sub));
      out("s-extra", peso(t.extra));
      out("s-discount", "\u2212" + peso(t.disc));
      hook("s-discount-row").hidden = t.disc <= 0;
      out("s-total", peso(t.total));
      out("s-dep-label", "Required Deposit (" + t.rate + "%)");
      out("s-dep", peso(t.dep));
      hook("s-bal-row").hidden = t.bal <= 0;
      out("s-bal", peso(t.bal));
    }

    function goStep(n) {
      state.step = n;
      qa("[data-qp-step]").forEach(function (s) { s.hidden = s.getAttribute("data-qp-step") !== String(n); });
      qa("[data-qp-stepper]").forEach(function (s) {
        var k = Number(s.getAttribute("data-qp-stepper"));
        s.classList.toggle("is-current", k === n);
        s.classList.toggle("is-done", k < n);
      });
      if (n === 2) renderPreview();
      if (root.scrollIntoView) root.scrollIntoView({ block: "start" });
    }

    /* ---------- save / send ---------- */
    function payload() {
      var t = totals();
      return {
        inquiry_ref: ctx.ref,
        mode: revise ? "revise" : "save",
        items: JSON.stringify(state.rows.map(function (r) {
          return { menu_item_id: r.menu_item_id || "", name: r.name || "", category: r.category || "", tier: r.tier || "", pax: r.pax || "",
            description: r.menu_item_id ? (r.name + (r.tier ? " - " + r.tier : "")) : (r.description || r.name || ""), quantity: r.quantity, unit_price: r.unit_price };
        })),
        valid_until: validEl.value, valid_until_time: validTimeEl ? validTimeEl.value : "", deposit_rate: t.rate, discount: t.disc, extra_charge: t.extra, notes: notesEl.value.trim()
      };
    }
    function busy(on) { state.busy = on; qa("[data-qp=save-draft],[data-qp=send],[data-qp=back-edit]").forEach(function (b) { b.disabled = on; }); }
    function close() { host.textContent = ""; host.hidden = true; detail.hidden = false; if (detail.scrollIntoView) detail.scrollIntoView({ block: "start" }); }

    function save(thenSend) {
      var err = validate();
      if (err) { goStep(1); return showError(err); }
      showError("");
      busy(true);
      ctx.post("quotation_save", payload()).then(function (data) {
        ctx.applyResult(ctx, data);
        if (!thenSend) { ctx.toast(data.message || "Saved as a draft."); state.dirty = false; close(); return null; }
        return ctx.post("quotation_send", { inquiry_ref: ctx.ref }).then(function (sent) {
          ctx.applyResult(ctx, sent);
          ctx.toast(sent.message || "Sent to the customer.");
          state.dirty = false; close();
        });
      }).catch(function (e) { busy(false); showError(e.message || "Something went wrong. Please try again."); });
    }

    /* ---------- events ---------- */
    hook("back").addEventListener("click", function () {
      if (!state.dirty || typeof window.crmConfirm !== "function") return close();
      window.crmConfirm({ title: "Leave this page?", message: "Your changes have not been saved. Leave without saving?", confirmText: "Leave" }).then(function (ok) { if (ok) close(); });
    });
    hook("edit-toggle").addEventListener("click", function () { setEdit(!state.edit); });
    hook("add").addEventListener("click", addRow);
    hook("item").addEventListener("change", function (e) { selectItem(e.target.value); });
    /* portion listener is wired inside renderPortion() — no static listener needed here */
    hook("qty").addEventListener("input", updateAddInfo);
    [validEl, validTimeEl, rateEl, discEl, extraEl, notesEl].forEach(function (n) { n.addEventListener("input", function () { state.dirty = true; refreshTotals(); }); });
    hook("to-review").addEventListener("click", function () {
      var err = validate();
      if (err) return showError(err);
      showError(""); goStep(2);
    });
    hook("back-edit").addEventListener("click", function () { goStep(1); });
    hook("save-draft").addEventListener("click", function () { if (!state.busy) save(false); });
    hook("send").addEventListener("click", function () {
      if (state.busy) return;
      var err = validate();
      if (err) { goStep(1); return showError(err); }
      save(true);
    });

    /* ---------- go ---------- */
    detail.hidden = true;
    host.hidden = false;
    renderRows();
    goStep(1);
    loadMenu().then(function (items) {
      state.menu = items;
      state.byId = {};
      state.cats = [];
      items.forEach(function (m) { state.byId[m.id] = m; if (state.cats.indexOf(m.category) === -1) state.cats.push(m.category); });
      var st = hook("menu-state");
      if (!items.length) { st.hidden = false; st.textContent = "The menu is empty. Add items in Menu Management first."; return; }
      st.hidden = true;
      buildItemSelect();
      seedRows();
      setEdit(!state.rows.length);
    }).catch(function (e) {
      var st = hook("menu-state");
      st.hidden = false;
      st.textContent = ((e && e.message) || "Could not load the menu.") + " The saved items can still be reviewed, but items cannot be edited until the menu loads.";
    });

    /* Start from the saved draft / last version, otherwise from the dishes the customer picked on the inquiry. */
    function seedRows() {
      var saved = Array.isArray(base && base.items) && base.items.length ? base.items : null;
      if (saved) {
        saved.forEach(function (i) {
          var item = state.byId[i.menu_item_id] || findByLabel(i.description);
          if (item) {
            var tier = tierOf(item, i.tier) || tierFromLabel(item, i.description);
            state.rows.push({ menu_item_id: item.id, name: item.name, category: item.category, tier: tier ? tier.name : "", pax: tier ? tier.pax : item.specs,
              quantity: Number(i.quantity) || 1, unit_price: Number(i.unit_price) || 0, range: isRangePrice(item, tier) });
          } else state.rows.push({ menu_item_id: 0, name: i.description, description: i.description, category: i.category || "Custom", tier: "", pax: "",
            quantity: Number(i.quantity) || 1, unit_price: Number(i.unit_price) || 0 });
        });
        return;
      }
      (Array.isArray(rec.menu_items) ? rec.menu_items : []).forEach(function (m) {
        var item = state.menu.filter(function (x) { return norm(x.name) === norm(m.name); })[0];
        if (!item) { state.skipped.push(m.name); return; }
        var tier = tierOf(item, m.tier) || (item.tiers.length ? item.tiers[0] : null);
        var price = priceFor(item, tier);
        if (price === null) { state.skipped.push(item.name); return; }
        state.rows.push({ menu_item_id: item.id, name: item.name, category: item.category, tier: tier ? tier.name : "", pax: tier ? tier.pax : item.specs,
          quantity: Math.max(1, parseInt(m.qty_n, 10) || 1), unit_price: price, range: isRangePrice(item, tier) });   // qty_n = how many the customer ordered
      });
    }
    function findByLabel(label) {
      var l = norm(label);
      return state.menu.filter(function (m) { return l === norm(m.name) || l.indexOf(norm(m.name) + " - ") === 0; })[0] || null;
    }
    function tierFromLabel(item, label) {
      var l = norm(label);
      return item.tiers.filter(function (t) { return l === norm(item.name) + " - " + norm(t.name); })[0] || null;
    }
  }
})();

/* =====================================================================================================
   ADMIN + MANAGER > CUSTOMERS   (html-content-navbar/customer-page.html  +  customers-api.php)
   PASTE THIS WHOLE BLOCK AT THE VERY END OF pages.js  (after everything else).

   Then add ONE hook inside window.loadCrmPageData (see the two small edits in the instructions):
     1) next to the other page constants:   const customersPage = document.getElementById("customersPage");
     2) next to the other "else if" pages:  } else if (customersPage) { crmInitCustomers(customersPage); return;

   Backend contract (customers-api.php, read only):
     GET ?action=list&q=&registered=all|today|7d|30d|month|year  -> { customers: [ { customer_id, customer_code, full_name, email, phone, registered_label } ], total }
     GET ?action=detail&id=3 -> { customer, counts, linked_records, deletion_note, inquiries[], bookings[], payments[], tickets[] }
   ===================================================================================================== */

function crmCustMoney(value) {
  return "₱ " + Number(value || 0).toLocaleString("en-PH", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

// "2026-11-12" or "2026-11-12 13:57:18" -> "November 12, 2026" (parsed by hand so the time zone never shifts the day)
function crmCustDate(value) {
  const m = String(value || "").match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!m) return "—";
  return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3])).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });
}

// Pill colours reuse the shared .stage-pill classes and the maps already defined above in pages.js.
const CRM_CUST_STATUS_CLASS = Object.assign({}, CRM_OPS_STATUS_CLASS, {
  pending: "stage-proposal",
  "in discussion": "stage-qualified",
  "quotation preparation": "stage-qualified",
  "quotation sent": "stage-proposal",
  negotiation: "stage-proposal",
});
const CRM_CUST_PAYMENT_CLASS = {
  paid: "stage-won",
  "partially paid": "stage-proposal",
  partial: "stage-proposal",
  "deposit paid": "stage-proposal",
  unpaid: "stage-new",
};

// Same card as the Inquiries page: .iq-card > .iq-card-head (avatar + name + ref) > .iq-lines > .iq-actions
function crmCustCardHTML(c) {
  const dash = (v) => crmEscape(v || "—");
  const initials = String(c.full_name || "").split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0]).join("") || "?";
  return (
    '<article class="card iq-card" data-id="' + crmEscape(c.customer_id) + '">' +
      '<div class="iq-card-head">' +
        crmAvatarHTML(initials, c.customer_photo || c.photo_url) +
        '<div class="iq-head-main">' +
          '<h4 class="iq-customer">' + dash(c.full_name) + "</h4>" +
          '<span class="iq-ref">' + crmEscape(c.customer_code) + "</span>" +
        "</div>" +
      "</div>" +
      '<ul class="iq-lines">' +
        '<li><i class="bi bi-envelope" aria-hidden="true"></i>' + dash(c.email) + "</li>" +
        '<li><i class="bi bi-telephone" aria-hidden="true"></i>' + dash(c.phone) + "</li>" +
        '<li><i class="bi bi-calendar4" aria-hidden="true"></i>Registered: ' + crmEscape(c.registered_label || crmCustDate(c.registered_at)) + "</li>" +
      "</ul>" +
      '<div class="iq-actions">' +
        '<button type="button" class="btn modal-btn-save iq-view" data-cust-view="' + crmEscape(c.customer_id) + '"><i class="bi bi-arrow-right" aria-hidden="true"></i>View Details</button>' +
      "</div>" +
    "</article>"
  );
}

// Same detail layout as the Inquiries page: .iq-back, .iq-detail-head, .iq-detail-card, .iq-section-title, .iq-label / .iq-value
function crmCustDetailHTML(d) {
  const c = d.customer || {};
  const n = d.counts || {};
  const dash = (v) => crmEscape(v || "—");
  const field = (label, value) => '<div><span class="iq-label">' + label + '</span><span class="iq-value">' + value + "</span></div>";
  const stat = (label, value) => '<div class="card p-3"><span class="stat-label">' + label + '</span><div class="stat-number">' + Number(value || 0) + "</div></div>";
  const td = (v) => "<td>" + v + "</td>";
  const table = (heads, rows, empty) =>
    rows.length
      ? '<div class="table-responsive"><table class="table align-middle mb-0"><thead><tr>' + heads.map((h) => "<th>" + h + "</th>").join("") +
        "</tr></thead><tbody>" + rows.join("") + "</tbody></table></div>"
      : '<p class="iq-state m-0">' + empty + "</p>";

  const inquiryRows = (d.inquiries || []).map((r) => "<tr>" +
    td('<span class="iq-ref">' + dash(r.inquiry_ref) + "</span>") + td(dash(r.event_name)) + td(crmCustDate(r.event_date)) + td(dash(r.arrangement)) +
    td(crmOpsPill(r.stage, CRM_CUST_STATUS_CLASS)) + td(dash(r.assigned_staff || "Unassigned")) + td(crmCustDate(r.submitted_at)) + "</tr>");

  const bookingRows = (d.bookings || []).map((r) => "<tr>" +
    td('<span class="iq-ref">' + dash(r.booking_ref) + "</span>") + td(dash(r.event_title)) + td(crmCustDate(r.event_date)) + td(dash(r.arrangement)) +
    td(crmCustMoney(r.total_amount)) + td(crmCustMoney(r.amount_paid)) + td(crmCustMoney(r.remaining_balance)) +
    td(crmOpsPill(r.payment_status, CRM_CUST_PAYMENT_CLASS)) + td(crmOpsPill(r.booking_status, CRM_CUST_STATUS_CLASS)) + "</tr>");

  const paymentRows = (d.payments || []).map((r) => "<tr>" +
    td('<span class="iq-ref">' + dash(r.booking_ref) + "</span>") + td(dash(r.event_title)) + td(crmCustMoney(r.amount_paid)) +
    td(dash(r.payment_method)) + td(dash(r.payment_reference)) + td(crmOpsPill(r.payment_status, CRM_CUST_PAYMENT_CLASS)) +
    td(crmCustDate(r.paid_at)) + "</tr>");

  const ticketRows = (d.tickets || []).map((r) => "<tr>" +
    td('<span class="iq-ref">' + dash(r.ticket_number) + "</span>") + td(dash(r.subject)) +
    td(crmOpsPill(r.priority, CRM_OPS_PRIORITY_CLASS)) + td(crmOpsPill(r.status, CRM_CUST_STATUS_CLASS)) +
    td(crmCustDate(r.created_at)) + td(crmCustDate(r.updated_at)) + "</tr>");

  const tabs = [["overview", "Overview"], ["inquiries", "Inquiries"], ["bookings", "Bookings"], ["payments", "Payments"], ["tickets", "Tickets"]];
  const panes = {
    overview: '<div class="iq-spec-grid tk-cols-4">' + stat("Inquiries", n.inquiries) + stat("Bookings", n.bookings) + stat("Payments", n.payments) + stat("Tickets", n.tickets) + "</div>",
    inquiries: table(["Inquiry ID", "Event", "Event Date", "Arrangement", "Stage", "Assigned Staff", "Submitted"], inquiryRows, "No inquiries from this customer yet."),
    bookings: table(["Booking ID", "Event", "Event Date", "Arrangement", "Total", "Paid", "Balance", "Payment", "Status"], bookingRows, "No bookings from this customer yet."),
    payments: table(["Booking ID", "Event", "Amount Paid", "Method", "Reference", "Status", "Date Paid"], paymentRows, "No payments from this customer yet."),
    tickets: table(["Ticket ID", "Subject", "Priority", "Status", "Created", "Last Updated"], ticketRows, "No support tickets from this customer yet."),
  };

  return (
    '<div class="cust-detail-top">' +
      '<button type="button" class="iq-back" data-cust-back><i class="bi bi-arrow-left" aria-hidden="true"></i>Back to Customers</button>' +
      (d.deletion_note ? '<span class="cust-detail-note"><i class="bi bi-lock-fill" aria-hidden="true"></i>' + crmEscape(d.deletion_note) + "</span>" : "") +
    "</div>" +
    '<div class="card iq-detail-card cust-detail-head">' +
      '<div class="cust-detail-id">' +
        '<span class="iq-ref">' + crmEscape(c.customer_code) + "</span>" +
        '<div class="cust-detail-name" role="heading" aria-level="2">' + dash(c.full_name) + "</div>" +
      "</div>" +
      '<div class="cust-detail-reg">' +
        '<span class="av-d-label">Date Registered</span>' +
        '<span class="av-d-value">' + crmEscape(c.registered_label || crmCustDate(c.registered_at)) + "</span>" +
      "</div>" +
    "</div>" +
    '<div class="iq-detail-col">' +
      '<section class="card iq-detail-card"><h3 class="iq-section-title">Customer Information</h3>' +
        '<div class="iq-spec-grid">' + field("Full Name", dash(c.full_name)) + field("Email Address", dash(c.email)) + field("Phone Number", dash(c.phone)) + "</div></section>" +
      '<section class="card iq-detail-card">' +
        '<ul class="nav nav-tabs settings-tabs" role="tablist">' +
          tabs.map((t, i) => '<li class="nav-item" role="presentation"><button type="button" class="nav-link' + (i === 0 ? " active" : "") + '" data-cust-tab="' + t[0] + '" role="tab">' + t[1] + "</button></li>").join("") +
        "</ul>" +
        tabs.map((t, i) => '<div class="cust-pane mt-4" data-cust-pane="' + t[0] + '"' + (i === 0 ? "" : " hidden") + ">" + panes[t[0]] + "</div>").join("") +
      "</section>" +
    "</div>"
  );
}

function crmInitCustomers(root) {
  const api = root.dataset.api || "customers-api.php";
  const $ = (sel) => root.querySelector(sel);
  const listView = $("#custListView");
  const detailView = $("#custDetailView");
  const grid = $("#custGrid");
  const state = $("#custState");
  const count = $("#custCount");
  const input = $("#custSearch");
  const regMenu = $("#custRegMenu");
  const regLabel = $("#custRegLabel");
  const noResults = $("#custNoResults");
  if (!listView || !detailView || !grid) return;

  let reg = "all";   // all | today | 7d | 30d | month | year
  let seq = 0;       // ignore answers that arrive after a newer request
  let timer = null;

  // The shared dropdown handler (further up in this file) also listens to .custom-dropdown-item clicks and calls these two.
  // This page does its own filtering, so give it harmless stand-ins and it leaves the page alone.
  window.activeTableFilters = { search: "", stage: "all" };
  window.applyTableFilters = function () {};

  async function getJson(params) {
    const url = new URL(api, window.location.href);
    Object.keys(params).forEach((k) => url.searchParams.set(k, params[k]));
    const response = await fetch(url.toString(), { credentials: "same-origin", cache: "no-store", headers: { Accept: "application/json" } });
    let data = null;
    try { data = await response.json(); } catch (e) { /* not JSON */ }
    if (!response.ok || !data || data.success === false) {
      throw new Error((data && data.message) || "Request failed (" + response.status + ").");
    }
    return data;
  }

  function render(list, total) {
    grid.innerHTML = list.map(crmCustCardHTML).join("");
    const n = Number.isFinite(total) ? total : list.length;
    count.textContent = n + (n === 1 ? " customer" : " customers");
    const filtering = input.value.trim() !== "" || reg !== "all";
    // Search / filter matched nothing -> shared "No results found" box; no customers at all -> plain message.
    if (noResults) noResults.hidden = !(filtering && list.length === 0);
    state.hidden = list.length > 0 || (filtering && !!noResults);
    if (!list.length && !(filtering && noResults)) state.textContent = filtering ? "No results found." : "No customers yet.";
  }

  async function load() {
    const mine = ++seq;
    if (!grid.children.length) { if (noResults) noResults.hidden = true; state.hidden = false; state.textContent = "Loading customers..."; }
    try {
      const data = await getJson({ action: "list", q: input.value.trim(), registered: reg });
      if (mine !== seq) return;
      render(Array.isArray(data.customers) ? data.customers : [], Number(data.total));
    } catch (error) {
      if (mine !== seq) return;
      grid.innerHTML = "";
      count.textContent = "";
      if (noResults) noResults.hidden = true;
      state.hidden = false;
      state.textContent = error.message;
    }
  }

  function setReg(value) {
    reg = value || "all";
    regMenu.querySelectorAll(".custom-dropdown-item").forEach((a) => {
      const on = (a.dataset.value || "all") === reg;
      a.toggleAttribute("aria-selected", on);
      if (on && regLabel) regLabel.textContent = a.textContent.trim();
    });
    load();
  }

  input.addEventListener("input", () => { clearTimeout(timer); timer = setTimeout(load, 250); });
  input.addEventListener("search", () => { clearTimeout(timer); timer = setTimeout(load, 50); });
  regMenu.addEventListener("click", (event) => {
    const item = event.target.closest(".custom-dropdown-item");
    if (!item) return;
    event.preventDefault();
    setReg(item.dataset.value);
  });

  function showList() {
    detailView.hidden = true;
    detailView.innerHTML = "";
    listView.hidden = false;
    const body = document.querySelector(".content-body");
    if (body) body.scrollTop = 0;
  }

  async function showDetail(id) {
    try {
      const data = await getJson({ action: "detail", id: id });
      detailView.innerHTML = crmCustDetailHTML(data);
      listView.hidden = true;
      detailView.hidden = false;
      const body = document.querySelector(".content-body");
      if (body) body.scrollTop = 0;
    } catch (error) {
      state.hidden = false;
      state.textContent = error.message;
    }
  }

  grid.addEventListener("click", (event) => {
    const button = event.target.closest("[data-cust-view]");
    if (button) showDetail(button.dataset.custView);
  });

  detailView.addEventListener("click", (event) => {
    if (event.target.closest("[data-cust-back]")) { showList(); return; }
    const tab = event.target.closest("[data-cust-tab]");
    if (!tab) return;
    detailView.querySelectorAll("[data-cust-tab]").forEach((b) => b.classList.toggle("active", b === tab));
    detailView.querySelectorAll("[data-cust-pane]").forEach((p) => { p.hidden = p.dataset.custPane !== tab.dataset.custTab; });
  });

  load();
}

/* Feedback photos: open in an in-page viewer (with an X button) instead of a new browser tab.
   Works for every <a> inside .fb-photos (Bookings > Feedback list and the booking details). */
(function () {
  if (window.__crmPhotoViewerLoaded) return;
  window.__crmPhotoViewerLoaded = true;
  var overlay = null;
  function close() {
    if (!overlay) return;
    overlay.remove();
    overlay = null;
    document.removeEventListener("keydown", onKey, true);
    document.body.classList.remove("crm-photo-open");
  }
  function onKey(e) { if (e.key === "Escape") { e.preventDefault(); close(); } }
  function open(url, alt) {
    close();
    overlay = document.createElement("div");
    overlay.className = "crm-photo-viewer";
    overlay.setAttribute("role", "dialog");
    overlay.setAttribute("aria-modal", "true");
    overlay.setAttribute("aria-label", "Photo preview");
    var btn = document.createElement("button");
    btn.type = "button";
    btn.className = "crm-photo-close";
    btn.setAttribute("aria-label", "Close photo");
    btn.innerHTML = '<i class="bi bi-x-lg" aria-hidden="true"></i>';
    var img = document.createElement("img");
    img.src = url;
    img.alt = alt || "Customer photo";
    overlay.appendChild(btn);
    overlay.appendChild(img);
    overlay.addEventListener("click", function (e) { if (e.target !== img) close(); });
    document.body.appendChild(overlay);
    document.body.classList.add("crm-photo-open");
    document.addEventListener("keydown", onKey, true);
    btn.focus();
  }
  document.addEventListener("click", function (e) {
    var a = e.target.closest ? e.target.closest(".fb-photos a") : null;
    if (!a) return;
    e.preventDefault();
    var img = a.querySelector("img");
    open(a.getAttribute("href"), img ? img.getAttribute("alt") : "");
  });
})();