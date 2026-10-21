// ==========================================================================
// pages.js  -  shared behaviour for Dashboard, Contacts, Leads & Deals, Tickets, Activities
//
// The backend prints the table rows into the HTML. This file does NOT build
// or fetch any rows. It only adds:
//   1. helpers + stage lists     5. search + filters (and dropdown clicks)
//   2. page setup                6. status badges (FIXED)
//   3. row buttons               7. modal reset + required-dropdown check
//      (View / Edit / Delete)    7b. "Discard changes?" for Edit AND Add modals
//   4. dropdown helpers          8. auto-run on page load
//                                9. phone input formatter
//                                9b. NUMBER FIELDS: digits only
//                               10. tickets page
//                               11. activities page
//                               12. dropdown auto-scroll inside modals
// ==========================================================================
window.crmSelected = null; // { kind: 'contacts' | 'leads', item: {...} } = last clicked row

// ==========================================================================
// 1. SMALL HELPERS + STAGE LISTS
// ==========================================================================
function crmEscape(value) {
  return String(value === null || value === undefined ? '' : value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function crmFormatAmount(amount) {
  if (amount === null || amount === undefined || amount === '') return '—';
  const num = Number(amount);
  if (isNaN(num)) return crmEscape(amount);
  return '₱ ' + num.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 2 });
}

function crmEmptyRow(colspan, message) {
  return `
    <tr class="empty-data-row">
      <td colspan="${colspan}" class="text-center py-5 text-muted fw-medium fs-6">${crmEscape(message)}</td>
    </tr>`;
}

// "+63 " + up to 10 digits. Accepts +63917..., 0917..., 917...
function crmFormatPhone(raw) {
  let digits = String(raw || '').replace(/^\s*\+63/, '').replace(/\D/g, '');
  if (digits.length === 12 && digits.indexOf('63') === 0) digits = digits.slice(2);
  digits = digits.replace(/^0+/, '').slice(0, 10);
  return '+63 ' + digits;
}

// ONE list of stages for every page (same names as the Dashboard).
// Ask the backend to store these exact names.
const CRM_LEAD_STAGES = ['New Inquiry', 'In Progress', 'In Discussion', 'Declined'];
const CRM_DEAL_STAGES = ['Quotation Preparation', 'Quotation Sent', 'Negotiation', 'Confirmed', 'Declined'];

const CRM_STAGE_CLASS = {
  'new inquiry': 'stage-new',
  'in progress': 'stage-qualified',
  'in discussion': 'stage-proposal',
  'quotation preparation': 'stage-new',
  'quotation sent': 'stage-proposal',
  'negotiation': 'stage-negotiation',
  'confirmed': 'stage-won',
  'declined': 'stage-loss',
  // old names kept so nothing breaks if the backend still sends them
  'qualified': 'stage-qualified',
  'unqualified': 'stage-loss',
  'proposal': 'stage-proposal',
  'closed won': 'stage-won',
  'closed loss': 'stage-loss'
};

// ==========================================================================
// 2. PAGE SETUP (runs on direct page load AND after navbar.js loads a page)
// ==========================================================================
function crmEnsureEmptyMessage(tbody, colspan, message) {
  if (!tbody) return;
  const hasRows = tbody.querySelectorAll('tr:not(.empty-data-row):not(.no-results-row)').length > 0;
  if (!hasRows) tbody.innerHTML = crmEmptyRow(colspan, message);
}

function crmSetDashboardDate() {
  const dateEl = document.getElementById('currentDashboardDate');
  if (dateEl) {
    dateEl.textContent = new Date().toLocaleDateString('en-US', {
      weekday: 'long', year: 'numeric', month: 'long', day: 'numeric'
    });
  }
}

// Dashboard "by stage" bars: width = this count compared to the biggest count
function crmFillProgressBars() {
  document.querySelectorAll('ul.stage-list').forEach(list => {
    const items = Array.from(list.querySelectorAll('li'));
    const counts = items.map(li => {
      const c = li.querySelector('.stage-count');
      return c ? (Number(c.textContent.trim()) || 0) : 0;
    });
    const max = Math.max(1, ...counts);
    items.forEach((li, i) => {
      const bar = li.querySelector('.progress-bar');
      if (bar) bar.style.width = (counts[i] / max * 100) + '%';
    });
  });
}
window.crmFillProgressBars = crmFillProgressBars; // call again if numbers are filled later by fetch()

// Remember each modal dropdown's starting text so it can be reset later
function crmInitModalDefaults() {
  document.querySelectorAll('.modal .custom-dropdown-toggle span').forEach(span => {
    if (span.dataset.defaultLabel === undefined) {
      span.dataset.defaultLabel = span.textContent.trim();
      span.dataset.wasMuted = span.classList.contains('text-muted') ? '1' : '0';
    }
  });
}

// Fill a menu with our stage list ONLY if the backend left it empty
function crmFillMenuIfEmpty(menuId, items, allLabel) {
  const menu = document.getElementById(menuId);
  if (!menu) return;
  if (menu.querySelector('li') && menu.dataset.auto !== '1') return; // backend already filled it
  window.populateDropdown(menuId, items, allLabel);
  menu.dataset.auto = '1';
}

// Rebuild the top-bar Stages filter based on the chosen Type.
// All Types shows only All Stages.
// Lead and Deal show All Stages plus the stages for the selected type.
function crmUpdateStageFilter(typeValue) {
  const menu = document.getElementById('stagesFilterDropdown');
  if (!menu) return;
  const dropdown = menu.closest('.dropdown');
  const span = dropdown ? dropdown.querySelector('.custom-dropdown-toggle span') : null;
  if (span && !span.dataset.defaultLabel) span.dataset.defaultLabel = span.textContent.trim();
  const t = String(typeValue || '').toLowerCase();
  const toggle = dropdown ? dropdown.querySelector('.custom-dropdown-toggle') : null;
  const stages = t === 'lead'
    ? CRM_LEAD_STAGES
    : t === 'deal'
      ? CRM_DEAL_STAGES
      : [];
  window.populateDropdown('stagesFilterDropdown', stages, 'All Stages');
  if (toggle) toggle.disabled = false;
  menu.dataset.auto = '1';
  // Keep the filter button label and clear any previous stage selection.
  if (span) span.textContent = span.dataset.defaultLabel;
  if (window.activeTableFilters) window.activeTableFilters.stage = 'all';
}

window.loadCrmPageData = function () {
  const contactsTable = document.getElementById('contactsTable');
  const leadsTable = document.getElementById('leadsDealsTable');
  const dashActivities = document.getElementById('upcomingActivitiesTable');
  const dashCustomers = document.getElementById('recentCustomersTable');
  const ticketsTable = document.getElementById('ticketsTable');
  const activitiesTable = document.getElementById('activitiesTable');

  renderStaticStatusBadges();
  crmInitModalDefaults();

  if (contactsTable) {
    crmEnsureEmptyMessage(contactsTable.querySelector('tbody'), 5, 'No contacts yet');
  } else if (leadsTable) {
    crmEnsureEmptyMessage(leadsTable.querySelector('tbody'), 7, 'No leads or deals yet');
    crmFillMenuIfEmpty('addLeadStageDropdown', CRM_LEAD_STAGES);
    crmFillMenuIfEmpty('addDealStageDropdown', CRM_DEAL_STAGES);
    crmFillMenuIfEmpty('editLeadDealStageDropdown', CRM_LEAD_STAGES);
    crmUpdateStageFilter('all'); // Stages stays empty until a Type is picked
  } else if (ticketsTable) {
    crmRenderTicketBadges();
    crmEnsureEmptyMessage(ticketsTable.querySelector('tbody'), 7, 'No tickets yet');
  } else if (activitiesTable) {
    crmEnsureEmptyMessage(activitiesTable.querySelector('tbody'), 8, 'No activities yet');
  } else if (dashActivities || dashCustomers) {
    crmSetDashboardDate();
    crmFillProgressBars();
    crmEnsureEmptyMessage(dashActivities, 5, 'No upcoming activities');
    crmEnsureEmptyMessage(dashCustomers, 4, 'No customers yet');
  }

  // Start search + filters once the rows exist (Contacts / Leads / Tickets / Activities pages)
  window.initTableSearchAndFilters();
};

// ==========================================================================
// 3. DROPDOWN HELPERS (hidden input so the form submits the choice)
// ==========================================================================
function crmSetHidden(dropdown, value) {
  const field = dropdown.getAttribute('data-field');
  if (!field) return;
  let hidden = dropdown.querySelector('input[type="hidden"]');
  if (!hidden) {
    hidden = document.createElement('input');
    hidden.type = 'hidden';
    hidden.name = field;
    dropdown.appendChild(hidden);
  }
  hidden.value = value;
}

// Select an option in a modal dropdown by id (data-value) or by visible text
function crmSelectDropdown(dropdown, text, valueHint) {
  if (!dropdown) return;
  const span = dropdown.querySelector('.custom-dropdown-toggle span');
  const items = Array.from(dropdown.querySelectorAll('.custom-dropdown-item'));
  let match = null;
  if (valueHint) match = items.find(a => a.getAttribute('data-value') === String(valueHint));
  if (!match && text) {
    const wanted = String(text).trim().toLowerCase();
    match = items.find(a => a.textContent.trim().toLowerCase() === wanted);
  }
  const label = match ? match.textContent.trim() : (text || '');
  if (span) {
    span.textContent = label || span.dataset.defaultLabel || 'Select';
    span.classList.toggle('text-muted', !label);
  }
  const v = match ? match.getAttribute('data-value') : null;
  crmSetHidden(dropdown, v !== null ? v : label);
  const toggle = dropdown.querySelector('.custom-dropdown-toggle');
  if (toggle) toggle.classList.remove('dd-invalid');
}

// Build <li> items. items can be 'Text' or { text, value, customerId }
window.populateDropdown = function (menuId, items, allLabel) {
  const menu = document.getElementById(menuId);
  if (!menu) return;
  const list = (allLabel ? [allLabel] : []).concat(items || []);
  menu.innerHTML = list.map(it => {
    const o = (it && typeof it === 'object') ? it : { text: it };
    const v = o.value !== undefined ? ' data-value="' + crmEscape(o.value) + '"' : '';
    const c = o.customerId !== undefined ? ' data-customer-id="' + crmEscape(o.customerId) + '"' : '';
    const em = o.email !== undefined ? ' data-email="' + crmEscape(o.email) + '"' : '';
    const ph = o.phone !== undefined ? ' data-phone="' + crmEscape(o.phone) + '"' : '';
    return '<li><a class="dropdown-item custom-dropdown-item py-2 px-3" href="#"' + v + c + em + ph + '>' + crmEscape(o.text) + '</a></li>';
  }).join('');
};

// Add Deal: after a customer is picked, show only that customer's leads.
// Backend: print each related lead as
//   <li><a class="dropdown-item custom-dropdown-item py-2 px-3" href="#" data-value="LEAD_ID" data-customer-id="CUSTOMER_ID">Name</a></li>
function crmFilterRelatedLeads(customerId) {
  const dd = document.querySelector('#addDealModal .dropdown[data-field="related_lead_id"]');
  if (!dd) return;
  const toggle = dd.querySelector('.custom-dropdown-toggle');
  const span = toggle.querySelector('span');
  const menu = dd.querySelector('.custom-dropdown-menu');
  if (!menu.querySelector('a[data-none]')) {
    const li = document.createElement('li');
    li.innerHTML = '<a class="dropdown-item custom-dropdown-item py-2 px-3" href="#" data-value="" data-none="1">None</a>';
    menu.insertBefore(li, menu.firstChild);
  }
  let shown = 0;
  menu.querySelectorAll('li').forEach(li => {
    const a = li.querySelector('a');
    if (!a) return;
    if (a.hasAttribute('data-none')) { li.style.display = ''; return; }
    const match = a.getAttribute('data-customer-id') === String(customerId);
    li.style.display = match ? '' : 'none';
    if (match) shown++;
  });
  crmSetHidden(dd, '');
  toggle.disabled = false;
  span.textContent = shown ? 'Select related lead' : 'No leads for this customer';
  span.classList.add('text-muted');
}

// Add Lead / Add Deal: when a customer is picked, fill the CUSTOMER INFORMATION
// fields (name, email, contact number). The fields stay editable.
// The customer option can carry data-email="..." and data-phone="...".
function crmFillCustomerInfo(modalEl, optionEl) {
  if (!modalEl || !optionEl) return;
  const setField = (name, value) => {
    const f = modalEl.querySelector('[name="' + name + '"]');
    if (f) f.value = value;
  };
  setField('customer_name', optionEl.textContent.trim());
  setField('customer_email', optionEl.getAttribute('data-email') || '');
  setField('customer_phone', crmFormatPhone(optionEl.getAttribute('data-phone') || ''));
}

// Add Deal > SERVICE DETAILS: the chosen "Service Arrangement" shows its own fields.
//   Customer Pickup  -> pickup date + pickup time
//   Food Delivery    -> delivery address + delivery date + delivery time
//   On-site Catering -> event venue + start time + end time + setup requirements
// The option is recognised by its TEXT (Pickup / Delivery / Catering), so it works
// even if the backend uses database ids in data-value.
function crmServiceKey(text) {
  const t = String(text || '').toLowerCase();
  if (t.includes('pickup') || t.includes('pick up') || t.includes('pick-up')) return 'pickup';
  if (t.includes('delivery')) return 'delivery';
  if (t.includes('catering') || t.includes('on-site') || t.includes('onsite')) return 'onsite';
  return '';
}

// Shows the box that matches `key` ('pickup' | 'delivery' | 'onsite' | '' = none).
// Hidden boxes are DISABLED and cleared, so their required fields never block the form
// and old values are never submitted.
function crmShowServiceFields(modalEl, key) {
  if (!modalEl) return;
  modalEl.querySelectorAll('.service-fields').forEach(box => {
    const on = box.dataset.service === key;
    box.classList.toggle('d-none', !on);
    box.querySelectorAll('input, textarea, select').forEach(el => {
      el.disabled = !on;
      if (!on) {
        el.value = '';
        if (el.setCustomValidity) el.setCustomValidity('');
      }
    });
  });
}

// On-site Catering: the end time must be after the start time
if (!window.__crmServiceTimeBound) {
  window.__crmServiceTimeBound = true;
  document.addEventListener('input', function (e) {
    const el = e.target;
    if (!el || (el.name !== 'event_start_time' && el.name !== 'event_end_time')) return;
    const box = el.closest('.service-fields');
    if (!box) return;
    const start = box.querySelector('[name="event_start_time"]');
    const end = box.querySelector('[name="event_end_time"]');
    if (!start || !end) return;
    end.setCustomValidity(start.value && end.value && end.value <= start.value
      ? 'Event end time must be after the start time.' : '');
  });
}

// ==========================================================================
// 4. ROW BUTTONS (View / Edit / Delete) - one click handler for all rows
// ==========================================================================
function crmSetText2(selector, text) {
  const el = document.querySelector(selector);
  if (el) el.textContent = text;
}

function crmSetValue(modal, name, value) {
  const el = modal.querySelector('[name="' + name + '"]');
  if (el) el.value = value === null || value === undefined ? '' : value;
}

function crmFillContactModal(d) {
  const modal = document.getElementById('editCustomerModal');
  if (!modal) return;
  crmSetValue(modal, 'id', d.id);
  crmSetValue(modal, 'customer_name', d.name);
  crmSetValue(modal, 'email', d.email);
  crmSetValue(modal, 'phone', crmFormatPhone(d.phone));
  crmSelectDropdown(modal.querySelector('.dropdown[data-field="staff_id"]'), d.staff, d.staffId);
}

function crmFillLeadDealModal(d) {
  const modal = document.getElementById('editLeadDealModal');
  if (!modal) return;
  const isDeal = String(d.type || '').toLowerCase() === 'deal';
  const title = document.getElementById('editLeadDealModalLabel');
  if (title) title.textContent = isDeal ? 'Edit Deal' : 'Edit Lead';
  crmSetValue(modal, 'id', d.id);
  crmSetValue(modal, 'event_name', d.name);
  crmSetValue(modal, 'customer_name', d.customer);
  crmSetValue(modal, 'quotation_amount', d.amount);
  crmFillMenuIfEmpty('editLeadDealStageDropdown', isDeal ? CRM_DEAL_STAGES : CRM_LEAD_STAGES);
  crmSelectDropdown(modal.querySelector('.dropdown[data-field="stage"]'), d.stage);
  crmSelectDropdown(modal.querySelector('.dropdown[data-field="staff_id"]'), d.staff, d.staffId);
}

// Reads the data of a clicked row straight from its cells.
// The backend prints on the <tr>:  data-id="..."  data-staff-id="..."
function crmGetRowItem(kind, row) {
  const t = (i) => row.cells[i] ? row.cells[i].textContent.trim() : '';
  const d = row.dataset || {};
  if (kind === 'contacts') {
    return { id: d.id || '', name: t(0), email: d.email || t(1), phone: d.phone || t(2), staff: t(3), staffId: d.staffId || '' };
  }
  const amountText = t(5);
  return {
    id: d.id || '',
    name: t(0),
    customer: t(1),
    type: t(2),
    stage: t(3),
    staff: t(4),
    staffId: d.staffId || '',
    amount: (amountText === '—' || amountText === '') ? null : amountText.replace(/[₱,\s]/g, '')
  };
}

if (!window.__crmRowButtonsBound) {
  window.__crmRowButtonsBound = true;
  document.addEventListener('click', function (e) {
    const btn = e.target.closest('.action-btn-view, .action-btn-edit, .action-btn-delete');
    if (!btn) return;
    const row = btn.closest('tr:not(.empty-data-row)');
    if (!row) return;
    const table = row.closest('table');
    if (!table) return;
    const kind = table.id === 'contactsTable' ? 'contacts'
               : table.id === 'leadsDealsTable' ? 'leads'
               : null;
    if (!kind) return;

    const item = crmGetRowItem(kind, row);
    window.crmSelected = { kind: kind, item: item };

    // ---------- CONTACTS PAGE ----------
    if (kind === 'contacts') {
      if (btn.classList.contains('action-btn-delete')) {
        crmSetText2('#deleteContactModal strong', item.name || '');
        const idInput = document.querySelector('#deleteContactModal input[name="id"]');
        if (idInput) idInput.value = item.id;
      } else {
        crmFillContactModal(item);
        crmTakeSnapshot('editCustomerModal');
        crmSetText2('#discardChangesModal strong.text-highlight', item.name || '');
      }
      return;
    }

    // ---------- LEADS & DEALS PAGE ----------
    const isDeal = String(item.type || '').toLowerCase() === 'deal';
    if (btn.classList.contains('action-btn-view')) {
      const stageClass = CRM_STAGE_CLASS[String(item.stage || '').toLowerCase()] || 'stage-new';
      const set = (id, text) => { const el = document.getElementById(id); if (el) el.textContent = text; };
      set('viewEventName', item.name || '-');
      set('viewCustomerName', item.customer || '-');
      set('viewStaffName', item.staff || '-');
      set('viewQuotationAmount', crmFormatAmount(item.amount));
      const typeBox = document.getElementById('viewTypeBadge');
      if (typeBox) typeBox.innerHTML = `<span class="type-pill ${isDeal ? 'type-deal' : 'type-lead'}">${isDeal ? 'Deal' : 'Lead'}</span>`;
      const stageBox = document.getElementById('viewStageBadge');
      if (stageBox) stageBox.innerHTML = `<span class="stage-pill ${stageClass}">${crmEscape(item.stage)}</span>`;
      const title = document.getElementById('viewLeadDealModalLabel');
      if (title) title.textContent = isDeal ? 'Deal Details' : 'Lead Details';
    } else if (btn.classList.contains('action-btn-delete')) {
      crmSetText2('#deleteDealModal strong', item.name || '');
      crmSetText2('#deleteDealModalLabel', isDeal ? 'Delete Deal' : 'Delete Lead');
      const idInput = document.querySelector('#deleteDealModal input[name="id"]');
      if (idInput) idInput.value = item.id;
    } else {
      crmFillLeadDealModal(item);
      crmTakeSnapshot('editLeadDealModal');
    }
  });
}

// ==========================================================================
// 5. MASTER SEARCH & MULTI-FILTER ENGINE (Page-Scoped & Isolated)
// ==========================================================================
window.initTableSearchAndFilters = function () {
  // Only the Contacts, Leads & Deals, Tickets and Activities pages have search + filters
  const table = document.getElementById('leadsDealsTable') ||
                document.getElementById('contactsTable') ||
                document.getElementById('ticketsTable') ||
                document.getElementById('activitiesTable');
  if (!table) return;

  const searchInput = document.getElementById('leadsSearchInput') ||
                      document.getElementById('contactsSearchInput') ||
                      document.getElementById('ticketsSearchInput') ||
                      document.getElementById('activitiesSearchInput');

  const tbody = table.querySelector('tbody');
  if (!tbody) return;

  const isContactsPage = table.id === 'contactsTable';
  const isTicketsPage = table.id === 'ticketsTable';
  const isActivitiesPage = table.id === 'activitiesTable';

  // Column numbers (0 = first column)
  const staffCol  = isContactsPage ? 3 : isTicketsPage ? 5 : isActivitiesPage ? 6 : 4; // Assigned Staff
  const typeCol   = isActivitiesPage ? 3 : 2;   // Type
  const statusCol = isActivitiesPage ? 5 : 3;   // Status
  const hasStatus = isTicketsPage || isActivitiesPage;

  window.activeTableFilters = { search: '', type: 'all', stage: 'all', staff: 'all', status: 'all', priority: 'all' };

  function ensureNoResultsRow() {
    let noResultsRow = tbody.querySelector('.no-results-row');
    if (!noResultsRow) {
      const colCount = table.querySelectorAll('thead th').length || 6;
      noResultsRow = document.createElement('tr');
      noResultsRow.className = 'no-results-row';
      noResultsRow.style.display = 'none';
      noResultsRow.innerHTML = `
        <td colspan="${colCount}" class="text-center py-5 text-muted fw-medium fs-6">
          <div class="d-flex flex-column align-items-center justify-content-center gap-2">
            <i class="bi bi-search fs-3 opacity-50"></i>
            <span>No results found</span>
          </div>
        </td>
      `;
      tbody.appendChild(noResultsRow);
    }
    return noResultsRow;
  }

  function applyFilters() {
    const dataRows = tbody.querySelectorAll('tr:not(.no-results-row):not(.empty-data-row)');
    const noResultsRow = ensureNoResultsRow();
    const filters = window.activeTableFilters;
    let visibleCount = 0;

    dataRows.forEach(row => {
      // Search every cell EXCEPT the last one (View / Edit / Delete buttons)
      const searchText = Array.from(row.cells).slice(0, -1)
        .map(c => c.textContent).join(' ').toLowerCase();

      const typeText = row.cells[typeCol] ? row.cells[typeCol].textContent.trim().toLowerCase() : '';
      const stageText = row.cells[3] ? row.cells[3].textContent.trim().toLowerCase() : '';
      const staffText = row.cells[staffCol] ? row.cells[staffCol].textContent.trim().toLowerCase() : '';
      const statusText = row.cells[statusCol] ? row.cells[statusCol].textContent.trim().toLowerCase() : '';
      const priorityText = row.cells[4] ? row.cells[4].textContent.trim().toLowerCase() : '';

      const matchesSearch = filters.search === '' || searchText.includes(filters.search);
      const matchesType = isContactsPage || filters.type === 'all' || typeText === filters.type;
      const matchesStage = isContactsPage || isActivitiesPage || filters.stage === 'all' || stageText === filters.stage;
      const matchesStaff = filters.staff === 'all' || staffText === filters.staff;
      const matchesStatus = !hasStatus || filters.status === 'all' || statusText === filters.status;
      const matchesPriority = !isTicketsPage || filters.priority === 'all' || priorityText === filters.priority;

      if (matchesSearch && matchesType && matchesStage && matchesStaff && matchesStatus && matchesPriority) {
        row.style.display = '';
        visibleCount++;
      } else {
        row.style.display = 'none';
      }
    });

    noResultsRow.style.display = (dataRows.length > 0 && visibleCount === 0) ? '' : 'none';
  }

  if (searchInput) {
    searchInput.oninput = function (e) {
      window.activeTableFilters.search = e.target.value.trim().toLowerCase();
      applyFilters();
    };
  }

  // Expose so the dropdown click handler can re-run the filters
  window.applyTableFilters = applyFilters;
  applyFilters();
};

// ==========================================================================
// 5b. DROPDOWN CLICK HANDLER (works for items added later by the backend)
// ==========================================================================
// Any menu item must look like this to be styled and clickable:
//   <li><a class="dropdown-item custom-dropdown-item py-2 px-3" href="#">Name</a></li>
// Modal dropdowns: add data-value="ID" so the id is submitted (else the text is).
// Or let this helper build them for you (see populateDropdown in section 3):
//   populateDropdown('stagesFilterDropdown', ['Qualified'], 'All Stages');
//   populateDropdown('addDealCustomerDropdown', [{ value: 12, text: 'Juan Santos', email: 'j@mail.com', phone: '09171234567' }]);
if (!window.__crmFilterDropdownBound) {
  window.__crmFilterDropdownBound = true;
  document.addEventListener('click', function (e) {
    const item = e.target.closest('.custom-dropdown-menu .custom-dropdown-item');
    if (!item) return;
    e.preventDefault();

    const menu = item.closest('.custom-dropdown-menu');
    const dropdown = item.closest('.dropdown');
    if (!menu || !dropdown) return;

    const labelSpan = dropdown.querySelector('.custom-dropdown-toggle span');
    const selectedText = item.textContent.trim();
    const selectedLower = selectedText.toLowerCase();
    const isAll = /^all (types|stages|staff|status|priority)$/i.test(selectedText);

    // Remember the original button text ("Types", "Stages", "Staff", "Status", "Priority")
    if (labelSpan && !labelSpan.dataset.defaultLabel) {
      labelSpan.dataset.defaultLabel = labelSpan.textContent.trim();
    }

    // ----- Dropdowns inside a modal: change label AND fill a hidden input -----
    if (item.closest('.modal')) {
      if (labelSpan) {
        labelSpan.textContent = selectedText;
        labelSpan.classList.remove('text-muted');
      }
      const v = item.getAttribute('data-value');
      const value = (v !== null) ? v : selectedText;
      const field = dropdown.getAttribute('data-field');
      if (field) crmSetHidden(dropdown, value);
      const toggle = dropdown.querySelector('.custom-dropdown-toggle');
      if (toggle) toggle.classList.remove('dd-invalid');

      // Add Deal: customer picked -> show only that customer's leads
      if (field === 'customer_id' && item.closest('#addDealModal')) crmFilterRelatedLeads(value);

      // Add Deal: service arrangement picked -> show that arrangement's input fields
      if (field === 'service_arrangement') crmShowServiceFields(item.closest('.modal'), crmServiceKey(selectedText));

      // Add Lead / Add Deal: customer picked -> fill CUSTOMER INFORMATION (name, email, phone)
      if (field === 'customer_id') {
        const addModal = item.closest('#addDealModal, #addLeadModal');
        if (addModal) crmFillCustomerInfo(addModal, item);
      }
      return;
    }

    // ----- Top-bar filter: "All ..." goes back to the original button text -----
    if (labelSpan) {
      labelSpan.textContent = isAll ? (labelSpan.dataset.defaultLabel || selectedText) : selectedText;
      labelSpan.classList.remove('text-muted');
    }

    if (!window.activeTableFilters || typeof window.applyTableFilters !== 'function') return;

    let key;
    if (menu.id === 'typesFilterDropdown') key = 'type';
    else if (menu.id === 'statusFilterDropdown') key = 'status';
    else if (menu.id === 'priorityFilterDropdown') key = 'priority';
    else if (menu.id === 'stagesFilterDropdown') key = 'stage';
    else if (menu.id === 'staffFilterDropdownList' || dropdown.classList.contains('staff-filter-dropdown')) key = 'staff';
    else key = (selectedLower === 'lead' || selectedLower === 'deal') ? 'type' : 'stage';

    // Clear the search box so the filter result is not mixed with old search text
    const activeSearchInput = document.getElementById('leadsSearchInput') ||
                              document.getElementById('contactsSearchInput') ||
                              document.getElementById('ticketsSearchInput') ||
                              document.getElementById('activitiesSearchInput');
    if (activeSearchInput) activeSearchInput.value = '';
    window.activeTableFilters.search = '';

    // Type changed -> rebuild the Stages list (and reset the stage filter)
    if (key === 'type') crmUpdateStageFilter(isAll ? 'all' : selectedLower);

    window.activeTableFilters[key] = isAll ? 'all' : selectedLower;
    window.applyTableFilters();
  });
}

// ==========================================================================
// 6. STATUS BADGES  (FIXED)
//    - Colors come from adminpages.css (.status-badge.status-*)
//    - Works for backend spans (data-status / .tablebadge)
//    - ALSO works when the Activities STATUS cell is plain text
//    - Never replaces a <td> / <tr> by mistake
// ==========================================================================
function getStatusBadgeHTML(statusText) {
  if (!statusText) return '';
  const normalized = String(statusText).trim().toLowerCase();
  let statusClass = '';

  switch (normalized) {
    case 'upcoming':
    case 'new inquiry':
    case 'pending':
      statusClass = 'status-upcoming';
      break;
    case 'in progress':
    case 'in discussion':
    case 'quotation sent':
    case 'negotiation':
      statusClass = 'status-in-progress';
      break;
    case 'cancelled':
    case 'declined':
    case 'closed':
      statusClass = 'status-cancelled';
      break;
    case 'completed':
    case 'confirmed':
    case 'resolved':
      statusClass = 'status-completed';
      break;
    default:
      statusClass = 'status-upcoming';
  }

  return `<span class="status-badge ${statusClass}">${crmEscape(String(statusText).trim())}</span>`;
}

function renderStaticStatusBadges() {
  // 1) Elements marked by the backend: <span class="tablebadge" data-status="...">
  document.querySelectorAll('[data-status], .tablebadge').forEach(el => {
    if (el.classList.contains('status-badge')) return;      // already a badge
    if (el.tagName === 'TR' || el.tagName === 'TABLE') return;
    const raw = el.getAttribute('data-status') || el.textContent;
    const html = getStatusBadgeHTML(raw);
    if (!html) return;
    if (el.tagName === 'TD') el.innerHTML = html;            // never replace a <td> itself
    else el.outerHTML = html;
  });

  // 2) Activities table: badge the STATUS column (6th column) even if it is plain text
  document.querySelectorAll('#activitiesTable tbody tr:not(.empty-data-row):not(.no-results-row)').forEach(row => {
    const cell = row.cells[5];
    if (!cell || cell.querySelector('.status-badge')) return;
    const text = cell.textContent.trim();
    if (text) cell.innerHTML = getStatusBadgeHTML(text);
  });
}
window.renderStaticStatusBadges = renderStaticStatusBadges; // callable from navbar.js / console

// ==========================================================================
// 7. MODAL RESET + REQUIRED-DROPDOWN CHECK
// ==========================================================================
// Puts an "Add" modal back to empty (typed text, picked dropdowns, snapshot).
function crmResetModal(m) {
  m.querySelectorAll('form').forEach(f => f.reset());

  // Add Deal: hide + clear the service arrangement fields
  crmShowServiceFields(m, '');

  // only remove OUR dropdown hidden inputs (never e.g. a csrf token)
  m.querySelectorAll('.dropdown[data-field] input[type="hidden"]').forEach(h => h.remove());

  m.querySelectorAll('.custom-dropdown-toggle').forEach(t => {
    t.classList.remove('dd-invalid');
    const s = t.querySelector('span');
    if (!s || s.dataset.defaultLabel === undefined) return;
    s.textContent = s.dataset.defaultLabel;
    s.classList.toggle('text-muted', s.dataset.wasMuted === '1');
  });

  const rel = m.querySelector('.dropdown[data-field="related_lead_id"] .custom-dropdown-toggle');
  if (rel) rel.disabled = true;
  m.querySelectorAll('.custom-dropdown-menu li').forEach(li => { li.style.display = ''; });

  // forget the old snapshot so the next open takes a fresh "empty" one
  delete m.dataset.snapshot;
  m.dataset.keepState = '0';

  // update char counters (e.g. "0/150 characters")
  m.querySelectorAll('textarea[maxlength]').forEach(crmUpdateCharCount);
}

if (!window.__crmModalResetBound) {
  window.__crmModalResetBound = true;

  // "Add" modals go back to empty when they close...
  document.addEventListener('hidden.bs.modal', function (e) {
    const m = e.target;
    if (!m.id || m.id.indexOf('add') !== 0) return;
    // ...EXCEPT when it was closed only to show "Discard changes?"
    if (m.dataset.keepState === '1') { m.dataset.keepState = '0'; return; }
    crmResetModal(m);
  });

  // Take the "empty" snapshot when an Add modal opens (only once, so coming
  // back from "Keep Edit" does not overwrite it with the typed values)
  document.addEventListener('shown.bs.modal', function (e) {
    const m = e.target;
    m.dataset.pendingDiscard = '0';
    if (m.id && m.id.indexOf('add') === 0 && !m.dataset.snapshot) crmTakeSnapshot(m.id);
  });

  // Dropdowns marked data-required="true" must have a choice before submit
  document.addEventListener('submit', function (e) {
    const form = e.target;
    if (!form || !form.closest || !form.closest('.modal')) return;
    let ok = true;
    form.querySelectorAll('.dropdown[data-required="true"]').forEach(dd => {
      const h = dd.querySelector('input[type="hidden"]');
      const toggle = dd.querySelector('.custom-dropdown-toggle');
      const empty = !h || h.value === '';
      if (toggle) toggle.classList.toggle('dd-invalid', empty);
      if (empty) ok = false;
    });
    if (!ok) e.preventDefault();
  }, true);
}

// ==========================================================================
// 7b. CANCEL ONLY ASKS "Discard changes?" IF SOMETHING CHANGED
//     (Edit modals AND Add modals - no HTML changes needed)
// ==========================================================================
// Same idea as the original Edit cancel, now also for Add Lead / Add Deal / Add Ticket / Add Activity:
//   - Edit modal: snapshot of the form is taken when the row's Edit is clicked.
//   - Add modal (id starts with "add"): snapshot is taken when it opens (section 7).
//   - Cancel button (the X button just closes, no question):
//       nothing changed -> just close
//       changed         -> close it, then show the page's "Discard changes?" modal
//   - The "Keep Edit" button is pointed at the modal you came from right before the
//     prompt shows, so Bootstrap itself reopens the correct form (Add OR Edit).
//   - "Discard" (or Esc / click outside the prompt) clears the Add form.
//
// The "Discard changes?" modal is found by: data-discard-modal="ID" on the Cancel button,
// else any modal on the page whose id contains "discard".
function crmFormState(modal) {
  const fields = Array.from(modal.querySelectorAll('input, textarea, select'))
    .filter(el => el.type !== 'button' && el.type !== 'submit')
    .map(el => [el.name || el.id || '', (el.type === 'checkbox' || el.type === 'radio') ? el.checked : el.value]);
  const labels = Array.from(modal.querySelectorAll('.custom-dropdown-toggle span'))
    .map(s => s.textContent.trim());
  return JSON.stringify([fields, labels]);
}

function crmTakeSnapshot(modalId) {
  const modal = document.getElementById(modalId);
  if (modal) modal.dataset.snapshot = crmFormState(modal);
}

// Run fn once THIS modal (and no other) has finished hiding
function crmAfterHidden(el, fn) {
  const h = function (ev) {
    if (ev.target !== el) return;
    el.removeEventListener('hidden.bs.modal', h);
    fn();
  };
  el.addEventListener('hidden.bs.modal', h);
}

function crmFindDiscardModal(btn, modalEl) {
  const id = (btn && btn.dataset && btn.dataset.discardModal) || modalEl.dataset.discardModal;
  if (id && document.getElementById(id)) return document.getElementById(id);
  return document.querySelector('.modal[id*="iscard"]');
}

function crmCancelModal(modalEl, btn) {
  const modal = bootstrap.Modal.getOrCreateInstance(modalEl);
  const changed = modalEl.dataset.snapshot !== undefined &&
                  crmFormState(modalEl) !== modalEl.dataset.snapshot;

  if (!changed) { modal.hide(); return; }   // nothing changed: just close

  const discardEl = crmFindDiscardModal(btn, modalEl);

  // No "Discard changes?" modal on the page -> plain browser question
  if (!discardEl) {
    if (window.confirm('You have unsaved information in this form. Are you sure you want to discard it?')) {
      modal.hide();                          // Add modals reset themselves when hidden
    }
    return;
  }

  // "Keep Edit" must come back to THIS modal (its HTML points at the Edit modal)
  const keepBtn = discardEl.querySelector('[data-bs-toggle="modal"]');
  if (keepBtn) keepBtn.setAttribute('data-bs-target', '#' + modalEl.id);

  if (/^add/i.test(modalEl.id)) {
    // text like "unsaved changes to <name>"
    const strong = discardEl.querySelector('strong.text-highlight');
    if (strong) {
      const nameInput = modalEl.querySelector('input[type="text"]:not([readonly])');
      strong.textContent = (nameInput && nameInput.value.trim()) || 'this form';
    }
    modalEl.dataset.keepState = '1';         // do NOT wipe the Add form while the prompt is open
    modalEl.dataset.pendingDiscard = '1';    // clear it later if the user discards
  }

  // close this modal, then show "Discard changes?"
  crmAfterHidden(modalEl, function () {
    bootstrap.Modal.getOrCreateInstance(discardEl).show();
  });
  modal.hide();
}

if (!window.__crmEditCancelBound) {
  window.__crmEditCancelBound = true;

  // Capture phase = runs BEFORE Bootstrap's data-bs-dismiss on the Add modals' Cancel button
  document.addEventListener('click', function (e) {
    let modalEl = null, btn = null;

    const jsBtn = e.target.closest('.js-edit-cancel');   // Edit modals' Cancel (as before)
    if (jsBtn) {
      btn = jsBtn;
      modalEl = document.getElementById(jsBtn.dataset.editModal);
    } else {
      const dismiss = e.target.closest('[data-bs-dismiss="modal"]');
      const host = dismiss ? dismiss.closest('.modal') : null;
      // X button (.btn-close) is NOT intercepted: it just closes the modal
      const isX = dismiss && dismiss.classList.contains('btn-close');
      if (host && !isX && /^add/i.test(host.id) && dismiss.type !== 'submit') { btn = dismiss; modalEl = host; }
    }
    if (!modalEl) return;

    e.preventDefault();
    e.stopPropagation();
    crmCancelModal(modalEl, btn);
  }, true);

  // Buttons inside the "Discard changes?" modal (Bootstrap still does its own thing too)
  document.addEventListener('click', function (e) {
    const b = e.target.closest('.modal[id*="iscard"] button');
    if (!b) return;
    const isKeep = b.hasAttribute('data-bs-toggle');     // "Keep Edit"
    document.querySelectorAll('.modal[data-pending-discard="1"]').forEach(m => {
      m.dataset.pendingDiscard = '0';
      if (!isKeep) crmResetModal(m);                      // "Discard": clear the Add form
    });
  });

  // Prompt closed some other way (Esc / click outside) = treat as discard
  document.addEventListener('hidden.bs.modal', function (e) {
    if (!/iscard/.test(e.target.id)) return;
    document.querySelectorAll('.modal[data-pending-discard="1"]').forEach(m => {
      m.dataset.pendingDiscard = '0';
      crmResetModal(m);
    });
  });
}

// ==========================================================================
// 8. AUTO-RUN ON DIRECT PAGE LOAD
//    (When pages are loaded through navbar.js, navbar.js calls
//     window.loadCrmPageData() itself after injecting the page.)
// ==========================================================================
document.addEventListener("DOMContentLoaded", () => {
  window.loadCrmPageData();
});

// ==========================================================================
// 9. PHONE NUMBER INPUT FORMATTER (+63 and numbers only)
// ==========================================================================
document.addEventListener("DOMContentLoaded", () => {
  document.addEventListener('input', function (e) {
    if (e.target && e.target.classList.contains('phone-input-field')) {
      e.target.value = crmFormatPhone(e.target.value);
    }
  });

  // Do not let the "+63 " start be erased with Backspace
  document.addEventListener('keydown', function (e) {
    if (e.target && e.target.classList.contains('phone-input-field') && e.key === 'Backspace') {
      const el = e.target;
      if (el.selectionStart === el.selectionEnd && el.selectionStart <= 4) e.preventDefault();
    }
  });
});

// ==========================================================================
// 9b. NUMBER FIELDS: digits only
//     <input type="number"> normally lets you type e, E, + and -  (they are
//     valid in scientific notation). This blocks them on EVERY number field
//     on every page (Number of Guests, Quotation Amount, ...).
//       - normal number field: digits and ONE decimal point allowed
//       - data-integer="true": whole numbers only (no decimal point either)
// ==========================================================================
function crmCleanNumber(value, integerOnly) {
  let v = String(value).replace(integerOnly ? /[^\d]/g : /[^\d.]/g, '');
  if (!integerOnly) {
    const i = v.indexOf('.');
    if (i !== -1) v = v.slice(0, i + 1) + v.slice(i + 1).replace(/\./g, ''); // keep only the first "."
  }
  return v;
}

if (!window.__crmNumberInputBound) {
  window.__crmNumberInputBound = true;

  // Block the bad keys while typing
  document.addEventListener('keydown', function (e) {
    const el = e.target;
    if (!el || el.type !== 'number') return;
    const integerOnly = el.dataset.integer === 'true';
    const blocked = ['e', 'E', '+', '-'];
    if (integerOnly) blocked.push('.', ',');
    if (blocked.includes(e.key)) e.preventDefault();
  });

  // Clean pasted text (e.g. pasting "1e5" or "-20")
  document.addEventListener('paste', function (e) {
    const el = e.target;
    if (!el || el.type !== 'number') return;
    e.preventDefault();
    const text = (e.clipboardData || window.clipboardData).getData('text');
    const cleaned = crmCleanNumber(text, el.dataset.integer === 'true');
    if (cleaned) {
      el.value = cleaned;
      el.dispatchEvent(new Event('input', { bubbles: true }));
    }
  });

  // Block the mouse wheel from changing the value by accident
  document.addEventListener('wheel', function (e) {
    if (e.target && e.target.type === 'number' && document.activeElement === e.target) e.target.blur();
  }, { passive: true });
}

// ==========================================================================
// 10. TICKETS PAGE
// ==========================================================================
function crmTicketBadgeHTML(text) {
  const value = String(text || '').trim();
  if (!value) return '';
  return `<span class="ticket-badge ticket-${crmEscape(value.toLowerCase())}">${crmEscape(value)}</span>`;
}

// Backend prints: <td data-ticket-status="Open">Open</td>  and  <td data-ticket-priority="High">High</td>
function crmRenderTicketBadges() {
  document.querySelectorAll('[data-ticket-status], [data-ticket-priority]').forEach(el => {
    const text = el.getAttribute('data-ticket-status') || el.getAttribute('data-ticket-priority');
    el.innerHTML = crmTicketBadgeHTML(text);
  });
}

// "0/150 characters" counter (counts on open too, so Edit shows the real number)
function crmUpdateCharCount(textarea) {
  const counter = textarea.parentElement.querySelector('.char-count');
  if (counter) counter.textContent = textarea.value.length + '/' + (textarea.maxLength > 0 ? textarea.maxLength : 150) + ' characters';
}

if (!window.__crmCharCountBound) {
  window.__crmCharCountBound = true;
  document.addEventListener('input', e => { if (e.target.matches('textarea[maxlength]')) crmUpdateCharCount(e.target); });
  document.addEventListener('shown.bs.modal', e => e.target.querySelectorAll('textarea[maxlength]').forEach(crmUpdateCharCount));
}

// Edit / View buttons on the tickets table
// Backend prints on each <tr>: data-id, data-customer-id, data-staff-id, data-desc
if (!window.__crmTicketButtonsBound) {
  window.__crmTicketButtonsBound = true;
  document.addEventListener('click', function (e) {
    const btn = e.target.closest('#ticketsTable .action-btn-view, #ticketsTable .action-btn-edit');
    if (!btn) return;
    const row = btn.closest('tr');
    if (!row) return;

    const t = i => row.cells[i] ? row.cells[i].textContent.trim() : '';
    const d = row.dataset;
    const item = { id: d.id || '', no: t(0), name: t(1), customer: t(2), status: t(3), priority: t(4),
                   staff: t(5), desc: d.desc || '', customerId: d.customerId, staffId: d.staffId };

    if (btn.classList.contains('action-btn-view')) {
      const set = (id, html) => { const el = document.getElementById(id); if (el) el.innerHTML = html; };
      set('viewTicketNo', crmEscape(item.no));
      set('viewTicketName', crmEscape(item.name));
      set('viewTicketDesc', crmEscape(item.desc) || '-');
      set('viewTicketCustomer', crmEscape(item.customer));
      set('viewTicketStatus', crmTicketBadgeHTML(item.status));
      set('viewTicketPriority', crmTicketBadgeHTML(item.priority));
      set('viewTicketStaff', crmEscape(item.staff));
    } else {
      const modal = document.getElementById('editTicketModal');
      if (!modal) return;
      crmSetValue(modal, 'id', item.id);
      crmSetValue(modal, 'ticket_name', item.name);
      crmSetValue(modal, 'description', item.desc);
      crmSetText2('#editTicketNo', item.no);
      crmSelectDropdown(modal.querySelector('.dropdown[data-field="customer_id"]'), item.customer, item.customerId);
      crmSelectDropdown(modal.querySelector('.dropdown[data-field="status"]'), item.status);
      crmSelectDropdown(modal.querySelector('.dropdown[data-field="priority"]'), item.priority);
      crmSelectDropdown(modal.querySelector('.dropdown[data-field="staff_id"]'), item.staff, item.staffId);
      crmTakeSnapshot('editTicketModal');
      crmSetText2('#discardTicketChangesModal strong.text-highlight', item.name || '');
    }
  });
}

// ==========================================================================
// 11. ACTIVITIES PAGE
//     View / Edit / Delete buttons on the activities table.
//     Backend prints on each <tr>:
//       data-id, data-customer-id, data-lead-deal-id, data-ticket-id,
//       data-ticket (ticket label), data-staff-id, data-date (YYYY-MM-DD), data-notes
//     Status cell: <span class="tablebadge" data-status="Upcoming">Upcoming</span>
//     (data-status goes on the <span> only, never on the <td> / <tr>)
// ==========================================================================
if (!window.__crmActivityButtonsBound) {
  window.__crmActivityButtonsBound = true;
  document.addEventListener('click', function (e) {
    const btn = e.target.closest('#activitiesTable .action-btn-view, #activitiesTable .action-btn-edit, #activitiesTable .action-btn-delete');
    if (!btn) return;
    const row = btn.closest('tr:not(.empty-data-row)');
    if (!row) return;

    const t = i => row.cells[i] ? row.cells[i].textContent.trim() : '';
    // Empty / dash means "not linked"
    const linked = v => (!v || v === '—' || v === '-') ? 'Not linked' : v;
    const d = row.dataset;

    const item = {
      id: d.id || '',
      name: t(0),
      customer: t(1),
      leadDeal: linked(t(2)),
      type: t(3),
      dateText: t(4),
      date: d.date || '',
      status: t(5),
      staff: t(6),
      customerId: d.customerId || '',
      leadDealId: d.leadDealId || '',
      ticket: linked(d.ticket || ''),
      ticketId: d.ticketId || '',
      staffId: d.staffId || '',
      notes: d.notes || ''
    };

    // ---------- VIEW ----------
    if (btn.classList.contains('action-btn-view')) {
      const set = (id, text) => { const el = document.getElementById(id); if (el) el.textContent = text || '-'; };
      set('viewActivityName', item.name);
      set('viewActivityType', item.type);
      set('viewActivityDate', item.dateText);
      set('viewActivityNotes', item.notes);
      set('viewActivityCustomer', item.customer);
      set('viewActivityLeadDeal', item.leadDeal);
      set('viewActivityTicket', item.ticket);
      set('viewActivityStaff', item.staff);
      const statusBox = document.getElementById('viewActivityStatus');
      if (statusBox) statusBox.innerHTML = getStatusBadgeHTML(item.status) || '-';
      return;
    }

    // ---------- DELETE ----------
    if (btn.classList.contains('action-btn-delete')) {
      crmSetText2('#deleteActivityModal strong', item.name || '');
      const idInput = document.querySelector('#deleteActivityModal input[name="id"]');
      if (idInput) idInput.value = item.id;
      return;
    }

    // ---------- EDIT ----------
    const modal = document.getElementById('editActivityModal');
    if (!modal) return;
    const dd = field => modal.querySelector('.dropdown[data-field="' + field + '"]');

    crmSetValue(modal, 'id', item.id);
    crmSetValue(modal, 'activity_name', item.name);
    crmSetValue(modal, 'due_date', item.date);
    crmSetValue(modal, 'notes', item.notes);
    crmSelectDropdown(dd('customer_id'), item.customer, item.customerId);
    crmSelectDropdown(dd('lead_deal_id'), item.leadDeal, item.leadDealId);
    crmSelectDropdown(dd('ticket_id'), item.ticket, item.ticketId);
    crmSelectDropdown(dd('activity_type'), item.type);
    crmSelectDropdown(dd('staff_id'), item.staff, item.staffId);
    crmSelectDropdown(dd('status'), item.status);
    modal.querySelectorAll('textarea[maxlength]').forEach(crmUpdateCharCount);
    crmTakeSnapshot('editActivityModal');
    crmSetText2('#discardActivityChangesModal strong.text-highlight', item.name || '');
  });
}

// ==========================================================================
// 12. DROPDOWNS INSIDE MODALS: AUTO-SCROLL SO ALL CHOICES ARE VISIBLE
//     When a dropdown is opened near the bottom of a modal form, the form
//     scrolls down by itself until the whole list can be seen.
//     Works for every modal dropdown (Add / Edit, all pages). No HTML changes.
// ==========================================================================
if (!window.__crmDropdownAutoScrollBound) {
  window.__crmDropdownAutoScrollBound = true;

  // Bootstrap fires "shown.bs.dropdown" on the toggle button after the list opens
  document.addEventListener('shown.bs.dropdown', function (e) {
    const dropdown = e.target.closest ? e.target.closest('.dropdown') : null;
    if (!dropdown) return;
    const menu = dropdown.querySelector('.dropdown-menu');
    const body = menu ? menu.closest('.modal-body') : null;
    if (!body) return;                                   // only dropdowns inside a modal form

    // wait one frame so the list has its final size
    requestAnimationFrame(function () {
      const gap = 12;                                    // small space under the list
      const menuBox = menu.getBoundingClientRect();
      const bodyBox = body.getBoundingClientRect();
      const toggleBox = e.target.getBoundingClientRect();

      let amount = menuBox.bottom - bodyBox.bottom + gap;   // how much of the list is hidden
      if (amount <= 0) return;                               // already fully visible

      // never scroll so far that the dropdown button itself goes out of view
      amount = Math.min(amount, toggleBox.top - bodyBox.top - 8);
      if (amount > 0) body.scrollBy({ top: amount, behavior: 'smooth' });
    });
  });
}