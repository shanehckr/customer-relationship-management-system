// ==========================================================================
// DownloadExport.js  -  "Export Excel" and "Download PDF" for EVERY Reports page
//
// Load order in the page shell (Navbar.html):
//   ExcelJS library  ->  pages.js  ->  DownloadExport.js
//
// ONE file is downloaded, SEPARATED PER TAB:
//   Excel : one sheet per tab  (Customer | Sales | Ticket | Activity)
//   PDF   : one section per tab, each tab starts on a NEW page
// A tab = every .tab-pane[data-report-type] inside #reportsPage.
// A report page without tabs still works (it exports as one report).
//
// It does not know anything about leads or tickets. It exports whatever
// crmReportData(pane) (in pages.js) finds in each tab: summary cards, every chart,
// and the table (if the tab has one, with its Total row).
//
// CHARTS look the same as on the page:
//   - a chart drawn horizontally on the page (class "rp-hchart") is also horizontal
//     in the PDF and in the Excel picture
//   - the layout adjusts itself automatically (no empty space on the side):
//       1 chart in a row  -> full width, chart on the left + its count table on the right
//       2 charts in a row -> side by side, each count table under its chart
//     (an odd last chart, e.g. the 3rd of 3, is the "1 chart in a row" case)
//
// Each Excel sheet, top to bottom:
//   logo + business name + report title
//   SUMMARY cards
//   charts (two per row) with their count tables
//     - a chart that is ALONE in its row gets its count table on the RIGHT side
//   the table (with a Total row when it has a footer or an "Amount" column)
//   REPORT INFORMATION (Period, Report date, Download date, Download time)
// If ExcelJS is not loaded, a plain CSV with the same data is downloaded instead.
//
// Each PDF page:
//   first page of a tab        : logo + business name + report title + "Period (Date Added): THIS MONTH", cards, charts, table
//   footer of EVERY page       : "Generated <date, time> · by <user>"   and   "Page X of Y"
//
// Needs from pages.js: crmReportData, crmSum, crmSlug, crmEscape, crmChartHTML,
//                      crmHChartHTML, CRM_REPORT_COLORS
// ==========================================================================

const CRM_BUSINESS_NAME = "Espinosilla's Kainan";
const CRM_LOGO = 'icons/espinosillas-logo.svg';   // logo path, relative to Navbar.html
const CRM_PDF_CSS = 'all-pages-css/download-export.css';

// "Leads by Stage" -> "Stage", "Tickets by Priority" -> "Priority"
const crmKeyLabel = title => (String(title).split(/ by /i)[1] || 'Stage').trim();
const crmFileName = (d, ext) => crmSlug(d.title + ' ' + d.range) + '-' + new Date().toISOString().slice(0, 10) + '.' + ext;

// Time of the download / print, from the user's own computer clock, e.g. "3:45:12 PM"
// (remove  second: '2-digit'  if you do not want seconds)
const crmNowTime = () => new Date().toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', second: '2-digit', hour12: true });

// Is this chart drawn horizontally on the page? (box class "rp-hchart")
function crmIsHChart(chart) {
  const el = chart && chart.id ? document.getElementById(chart.id) : null;
  return !!(el && el.classList.contains('rp-hchart'));
}

function crmSaveBlob(blob, name) {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = name;
  document.body.appendChild(a); a.click(); a.remove();
}

// ---- the reports to export: one per tab ----
function crmAllReports() {
  const panes = Array.from(document.querySelectorAll('#reportsPage .tab-pane[data-report-type]'));
  return panes.length ? panes.map(p => crmReportData(p)) : [crmReportData()];
}
// "Customer Report" -> "Customer" (sheet name)
const crmTabName = d => String(d.title).replace(/\s*report$/i, '').trim() || 'Report';
// FILE NAME of the download (Excel AND PDF), made from the report page itself:
//   <main id="reportsPage" data-report-title="Sales Staff Report">  ->  sales-staff-report-this-year-2026-10-25.xlsx / .pdf
// If the page has no data-report-title, the name comes from the logged-in ROLE (see crmCurrentRole below),
// and only if no role is found: "Reports" when there are several tabs, else the report's own title.
//
// ROLE -> REPORT NAME. The first row whose keyword is found inside the role text wins.
// Add / rename rows here (the left part is matched in lower case, "_" and "-" count as spaces).
const CRM_ROLE_REPORT_NAMES = [
  ['customer service', 'Customer Service Staff Report'],
  ['service',          'Customer Service Staff Report'],
  ['sales',            'Sales Staff Report'],
  ['manager',          'Manager Report'],
  ['admin',            'Admin Report']
];
// Where the role can be saved at login (localStorage / sessionStorage). Add your own key here if it is not listed.
const CRM_ROLE_KEYS = ['userRole', 'role', 'user_role', 'userType', 'user_type', 'accountType', 'position'];

function crmCurrentRole() {
  const clean = v => String(v == null ? '' : v).toLowerCase().replace(/[_\-]+/g, ' ').trim();
  const pick = text => {
    const t = clean(text);
    const hit = t && CRM_ROLE_REPORT_NAMES.find(r => t.includes(r[0]));
    return hit ? hit[1] : '';
  };
  for (const store of [localStorage, sessionStorage]) {
    for (const key of CRM_ROLE_KEYS) {
      try { const name = pick(store.getItem(key)); if (name) return name; } catch (err) { /* storage blocked */ }
    }
  }
  return pick(document.body && document.body.dataset.role) || pick(location.pathname);
}
window.crmCurrentRole = crmCurrentRole;     // test in the console (F12):  crmCurrentRole()

const crmPackTitle = list => {
  const page = document.getElementById('reportsPage');
  return (page && page.dataset.reportTitle) || crmCurrentRole() || (list.length > 1 ? 'Reports' : list[0].title);
};
const crmPackName = list => ({ title: crmPackTitle(list), range: list[0].range });
// "Period (Date Added)": which date the period filter uses. Used by the PDF AND the Excel.
// Order: the tab's own data-date-label  ->  the page's data-date-label  ->  CRM_DEFAULT_DATE_LABEL.
// So a page without tabs (e.g. the Sales Staff report) also prints "(Date Added)".
const CRM_DEFAULT_DATE_LABEL = 'Date Added';   // change here if another report filters by a different date
const crmPeriodLabel = d => {
  const page = document.getElementById('reportsPage');
  return 'Period (' + (d.dateLabel || (page && page.dataset.dateLabel) || CRM_DEFAULT_DATE_LABEL) + ')';
};

// ==========================================================================
// CSV (fallback when ExcelJS is missing) - all tabs, one after the other
// ==========================================================================
function crmExportReportCSV() {
  const list = crmAllReports(), first = list[0];
  const q = v => '"' + String(v == null ? '' : v).replace(/"/g, '""') + '"';
  const out = [[CRM_BUSINESS_NAME.toUpperCase()], ['Downloaded by', first.user.toUpperCase()], []];

  list.forEach(d => {
    const T = d.table;
    out.push(['[' + d.title.toUpperCase() + ']'], ['SUMMARY'],
      ...d.stats.map(s => [s[0], /amount/i.test(s[0]) ? d.num(s[1]) : s[1]]), []);
    const perfCsv = after => (d.perf || []).filter(p => !!p.after === after).forEach(p => {
      out.push([p.title.toUpperCase()]);
      if (p.subtitle) out.push([p.subtitle]);
      out.push(['Measure', 'Rate', 'Detail'], ...p.items.map(i => [i.label, i.pct, i.note]), []);
    });
    perfCsv(false);
    d.charts.forEach(c => {
      out.push([c.title.toUpperCase(), 'Count'], ...c.items.map(i => [i.label, i.count]), ['Total', crmSum(c.items)], []);
    });
    perfCsv(true);
    if (T.headers.length) {
      out.push([T.title.toUpperCase()], T.headers);
      T.rows.forEach(r => out.push(r.map((v, i) => i === T.amountCol ? d.num(v) : v)));
      if (T.foot && T.rows.length) out.push(T.foot);
      if (T.amountCol > 0 && T.rows.length) {
        const total = new Array(T.headers.length).fill('');
        total[T.amountCol - 1] = 'Total';
        total[T.amountCol] = T.rows.reduce((s, r) => s + d.num(r[T.amountCol]), 0);
        out.push(total);
      }
      out.push([]);
    }
    out.push([]);
  });

  out.push(['REPORT INFORMATION'],
    ['Period', first.range], ['Report date', first.today], ['Download date', first.today], ['Download time', crmNowTime()]);

  const csv = '\ufeff' + out.map(r => r.map(q).join(',')).join('\r\n');   // \ufeff = Excel reads the file correctly
  crmSaveBlob(new Blob([csv], { type: 'text/csv;charset=utf-8' }), crmFileName(crmPackName(list), 'csv'));
}

// ==========================================================================
// EXCEL
// ==========================================================================
function crmLogoPNG(src, size) {
  return new Promise(resolve => {
    const img = new Image();
    img.onload = () => {
      try {
        const c = document.createElement('canvas');
        c.width = c.height = size;
        c.getContext('2d').drawImage(img, 0, 0, size, size);
        resolve(c.toDataURL('image/png'));
      } catch (err) { resolve(null); }
    };
    img.onerror = () => resolve(null);
    img.src = src;
  });
}

// Draws one VERTICAL bar chart on a canvas (same colors / Y axis / value labels as the page) and returns a PNG
function crmChartPNG(items, w, h) {
  const s = 2, c = document.createElement('canvas');
  c.width = w * s; c.height = h * s;
  const g = c.getContext('2d');
  g.scale(s, s);
  g.fillStyle = '#ffffff'; g.fillRect(0, 0, w, h);

  const L = 44, R = 10, T = 22, B = 48, pw = w - L - R, ph = h - T - B;
  const top = Math.max(4, ...items.map(i => Number(i.count) || 0));
  const step = Math.ceil(top / 4), max = step * 4;

  g.font = '11px Arial'; g.textAlign = 'right'; g.fillStyle = '#555555'; g.strokeStyle = '#e3e5e4'; g.lineWidth = 1;
  for (let k = 0; k <= 4; k++) {
    const y = T + ph - (k * step / max) * ph;
    g.beginPath(); g.moveTo(L, y); g.lineTo(L + pw, y); g.stroke();
    g.fillText(String(k * step), L - 8, y + 4);
  }
  g.save(); g.translate(12, T + ph / 2); g.rotate(-Math.PI / 2); g.textAlign = 'center'; g.fillText('Count', 0, 0); g.restore();

  const n = Math.max(items.length, 1), slot = pw / n, bw = Math.min(slot * 0.62, 52);
  items.forEach((it, i) => {
    const v = Number(it.count) || 0, bh = v / max * ph, x = L + i * slot + (slot - bw) / 2, y = T + ph - bh;
    g.fillStyle = it.color || CRM_REPORT_COLORS[String(it.label).toLowerCase()] || '#6B7280';
    g.fillRect(x, y, bw, bh);
    g.strokeStyle = 'rgba(0,0,0,0.15)'; g.strokeRect(x, y, bw, bh);
    g.fillStyle = '#111111'; g.font = 'bold 12px Arial'; g.textAlign = 'center';
    g.fillText(String(v), x + bw / 2, y - 5);

    g.font = '10px Arial'; g.fillStyle = '#222222';
    let line = '', ly = T + ph + 14;
    String(it.label).split(' ').forEach(word => {
      const test = line ? line + ' ' + word : word;
      if (g.measureText(test).width > slot - 4 && line) { g.fillText(line, L + i * slot + slot / 2, ly); ly += 12; line = word; }
      else line = test;
    });
    g.fillText(line, L + i * slot + slot / 2, ly);
  });
  return c.toDataURL('image/png');
}

// Draws one HORIZONTAL bar chart (like "Tickets by Assigned Staff" on the page) and returns a PNG:
// names on the left, the number at the end of each bar, 0 / step / ... scale at the bottom
function crmHChartPNG(items, w, h) {
  const s = 2, c = document.createElement('canvas');
  c.width = w * s; c.height = h * s;
  const g = c.getContext('2d');
  g.scale(s, s);
  g.fillStyle = '#ffffff'; g.fillRect(0, 0, w, h);

  const L = 100, R = 36, T = 14, B = 30, pw = w - L - R, ph = h - T - B;
  const top = Math.max(4, ...items.map(i => Number(i.count) || 0));
  const step = Math.ceil(top / 4), max = step * 4;

  // vertical grid lines + the scale under them
  g.font = '11px Arial'; g.textAlign = 'center'; g.fillStyle = '#555555'; g.strokeStyle = '#e3e5e4'; g.lineWidth = 1;
  for (let k = 0; k <= 4; k++) {
    const x = L + (k * step / max) * pw;
    g.beginPath(); g.moveTo(x, T); g.lineTo(x, T + ph); g.stroke();
    g.fillText(String(k * step), x, T + ph + 17);
  }

  const n = Math.max(items.length, 1), slot = ph / n, bh = Math.min(slot * 0.62, 32);
  items.forEach((it, i) => {
    const v = Number(it.count) || 0, bw = v / max * pw, y = T + i * slot + (slot - bh) / 2;
    g.fillStyle = it.color || CRM_REPORT_COLORS[String(it.label).toLowerCase()] || '#48B68E';
    g.fillRect(L, y, bw, bh);
    g.strokeStyle = 'rgba(0,0,0,0.15)'; g.strokeRect(L, y, bw, bh);

    g.fillStyle = '#111111'; g.font = 'bold 12px Arial'; g.textAlign = 'left';
    g.fillText(String(v), L + bw + 6, y + bh / 2 + 4);

    // the name, right aligned next to the bars (two lines if it is long)
    g.font = '10px Arial'; g.fillStyle = '#222222'; g.textAlign = 'right';
    const lines = [];
    let line = '';
    String(it.label).split(' ').forEach(word => {
      const test = line ? line + ' ' + word : word;
      if (g.measureText(test).width > L - 12 && line) { lines.push(line); line = word; }
      else line = test;
    });
    lines.push(line);
    const first = y + bh / 2 + 3 - (lines.length - 1) * 6;
    lines.forEach((t, k) => g.fillText(t, L - 8, first + k * 12));
  });
  return c.toDataURL('image/png');
}

// ==========================================================================
// ADMIN / MANAGER REPORT CHARTS  (line / donut / meter / stack / plain bars)
// The page draws these with pages.js (CRM_RP_RENDERERS). Here they are drawn again for the files:
//   Excel : canvas -> PNG pictures      PDF : vector SVG / HTML (see crmPdfChartHTML)
// Same colours, same shapes, same numbers as the page.
// ==========================================================================
const crmChartBox = c => (c && c.id ? document.getElementById(c.id) : null);
const crmChartStyle = c => { const b = crmChartBox(c); return (b && b.getAttribute('data-chart-style')) || ''; };
const crmIsSd = c => { const b = crmChartBox(c); return !!(b && b.closest('.sd-dashboard')); };
const crmHasDisplay = c => c.items.some(i => i.display != null);          // e.g. "22.1h": a total of these makes no sense
// "Leads by Stage" -> "Stage"; a trend chart -> "Week"; "Customers by Sales Staff" -> "Sales Staff"
const crmChartKeyLabel = c => (crmChartStyle(c) === 'line' || crmHasDisplay(c)) ? 'Week' : (String(c.title).split(/ by /i)[1] || 'Type').trim();
const crmN = v => Number(v) || 0;
const crmFmtN = v => Number.isInteger(v) ? String(v) : String(Math.round(v * 10) / 10);

function crmCanvas(w, h) {
  const s = 2, c = document.createElement('canvas');
  c.width = w * s; c.height = h * s;
  const g = c.getContext('2d');
  g.scale(s, s); g.fillStyle = '#ffffff'; g.fillRect(0, 0, w, h);
  return { c, g };
}
function crmRR(g, x, y, w, h, r) {            // rounded rectangle path
  r = Math.max(0, Math.min(r, w / 2, h / 2));
  g.beginPath(); g.moveTo(x + r, y);
  g.arcTo(x + w, y, x + w, y + h, r); g.arcTo(x + w, y + h, x, y + h, r);
  g.arcTo(x, y + h, x, y, r); g.arcTo(x, y, x + w, y, r); g.closePath();
}
const crmSplitWeek = l => { const m = String(l).match(/^(.*?)\s*(\(.*\))$/); return m ? [m[1], m[2]] : [String(l), '']; };
const CRM_GREEN = '#165c43';

function crmLinePNG(items, w, h) {
  const { c, g } = crmCanvas(w, h);
  const pad = { l: 38, r: 18, t: 34, b: 46 };
  const vals = items.map(i => crmN(i.count)), top = Math.max(1, ...vals), n = Math.max(items.length, 1);
  const slot = (w - pad.l - pad.r) / n, base = h - pad.b;
  const xOf = i => pad.l + slot * (i + 0.5), yOf = v => base - v / top * (base - pad.t);
  g.font = '500 10.5px Arial'; g.textAlign = 'right'; g.lineWidth = 1;
  [top, top / 2, 0].forEach(v => {
    g.strokeStyle = v === 0 ? '#cbd5e1' : '#e2e8f0'; g.setLineDash(v === 0 ? [] : [3, 4]);
    g.beginPath(); g.moveTo(pad.l, yOf(v)); g.lineTo(w - pad.r, yOf(v)); g.stroke();
    g.fillStyle = '#64748b'; g.fillText(crmFmtN(v), pad.l - 8, yOf(v) + 4);
  });
  g.setLineDash([]);
  const pts = vals.map((v, i) => [xOf(i), yOf(v)]), segs = crmRpMonotone(pts);
  if (pts.length > 1) {
    const path = () => { g.beginPath(); g.moveTo(pts[0][0], pts[0][1]); segs.forEach(s => g.bezierCurveTo(s[0], s[1], s[2], s[3], s[4], s[5])); };
    path(); g.lineTo(pts[pts.length - 1][0], base); g.lineTo(pts[0][0], base); g.closePath();
    const grad = g.createLinearGradient(0, pad.t, 0, base);
    grad.addColorStop(0, 'rgba(22,92,67,0.26)'); grad.addColorStop(1, 'rgba(22,92,67,0)');
    g.fillStyle = grad; g.fill();
    path(); g.strokeStyle = CRM_GREEN; g.lineWidth = 2.5; g.lineJoin = 'round'; g.lineCap = 'round'; g.stroke();
  }
  const peak = vals.indexOf(Math.max(...vals));
  items.forEach((it, i) => {
    const [x, y] = pts[i], v = vals[i], l = crmSplitWeek(it.label);
    if (i === peak && v > 0) { g.fillStyle = 'rgba(22,92,67,0.14)'; g.beginPath(); g.arc(x, y, 10, 0, 7); g.fill(); }
    g.fillStyle = '#ffffff'; g.strokeStyle = CRM_GREEN; g.lineWidth = 2.5;
    g.beginPath(); g.arc(x, y, 4.5, 0, 7); g.fill(); g.stroke();
    g.textAlign = 'center'; g.font = '700 11.5px Arial'; g.fillStyle = v === 0 ? '#94a3b8' : '#111827';
    g.fillText(crmFmtN(v), x, y - 13);
    g.font = '600 10.5px Arial'; g.fillStyle = '#111827'; g.fillText(l[0], x, h - 26);
    g.font = '500 9.5px Arial'; g.fillStyle = '#64748b'; g.fillText(l[1], x, h - 12);
  });
  return c.toDataURL('image/png');
}

function crmDonutPNG(items, w, h, caption) {
  const { c, g } = crmCanvas(w, h);
  const total = items.reduce((s, i) => s + crmN(i.count), 0);
  const R = Math.min(h * 0.3, 62), cx = R + 26, cy = h / 2, lw = R * 0.3;
  g.lineWidth = lw; g.lineCap = 'butt';
  if (!total) { g.strokeStyle = '#e2e8f0'; g.beginPath(); g.arc(cx, cy, R, 0, 7); g.stroke(); }
  let a = -Math.PI / 2;
  items.filter(i => crmN(i.count) > 0).forEach(it => {
    const sweep = crmN(it.count) / total * Math.PI * 2;
    g.strokeStyle = it.color || '#94a3b8'; g.beginPath(); g.arc(cx, cy, R, a, a + sweep); g.stroke(); a += sweep;
  });
  g.textAlign = 'center'; g.fillStyle = '#111827'; g.font = '800 22px Arial'; g.fillText(String(total), cx, cy + 4);
  g.fillStyle = '#64748b'; g.font = '700 8px Arial'; g.fillText(String(caption || '').toUpperCase(), cx, cy + 18);
  const x0 = cx + R + lw / 2 + 22, rowH = 26, y0 = cy - items.length * rowH / 2;
  items.forEach((it, i) => {
    const y = y0 + i * rowH, v = crmN(it.count);
    g.fillStyle = '#f1f5f9'; crmRR(g, x0, y, w - x0 - 16, rowH - 5, 6); g.fill();
    g.fillStyle = it.color || '#94a3b8'; g.beginPath(); g.arc(x0 + 12, y + (rowH - 5) / 2, 4, 0, 7); g.fill();
    g.textAlign = 'left'; g.fillStyle = '#111827'; g.font = '600 10.5px Arial'; g.fillText(it.label, x0 + 24, y + 14);
    const pct = '(' + (total ? Math.round(v / total * 100) : 0) + '%)';
    g.textAlign = 'right'; g.fillStyle = '#64748b'; g.font = '500 9.5px Arial'; g.fillText(pct, w - 26, y + 14);
    g.fillStyle = '#111827'; g.font = '700 10.5px Arial'; g.fillText(String(v), w - 26 - g.measureText(pct).width - 6 - 8, y + 14);
  });
  return c.toDataURL('image/png');
}

function crmMeterPNG(items, w, h) {
  const { c, g } = crmCanvas(w, h);
  const max = Math.max(1, ...items.map(i => crmN(i.count))), pad = 16, n = Math.max(items.length, 1);
  const rowH = Math.min(58, (h - pad * 2) / n), y0 = pad + ((h - pad * 2) - rowH * n) / 2;
  items.forEach((it, i) => {
    const y = y0 + i * rowH, v = crmN(it.count);
    g.textAlign = 'left'; g.fillStyle = '#111827'; g.font = '600 11px Arial'; g.fillText(it.label, pad, y + 12);
    g.textAlign = 'right'; g.font = '700 11px Arial'; g.fillText(String(v), w - pad, y + 12);
    g.fillStyle = '#e8edf3'; crmRR(g, pad, y + 20, w - pad * 2, 10, 5); g.fill();
    if (v > 0) { g.fillStyle = it.color || CRM_GREEN; crmRR(g, pad, y + 20, (w - pad * 2) * v / max, 10, 5); g.fill(); }
  });
  return c.toDataURL('image/png');
}

function crmStackPNG(items, w, h) {
  const { c, g } = crmCanvas(w, h);
  const pad = 16, segs0 = (items[0] && items[0].segments) || [];
  let lx = pad;
  g.font = '500 10px Arial'; g.textAlign = 'left';
  segs0.forEach(s => {
    g.fillStyle = s.color; g.beginPath(); g.arc(lx + 4, 14, 4, 0, 7); g.fill();
    g.fillStyle = '#111827'; g.fillText(s.label, lx + 12, 18); lx += 12 + g.measureText(s.label).width + 14;
  });
  const n = Math.max(items.length, 1), top = 32, rowH = Math.min(66, (h - top - 6) / n);
  items.forEach((it, i) => {
    const y = top + i * rowH, segs = it.segments || [], total = segs.reduce((s, x) => s + crmN(x.count), 0);
    g.textAlign = 'left'; g.fillStyle = '#111827'; g.font = '600 11px Arial'; g.fillText(it.label, pad, y + 11);
    g.textAlign = 'right'; g.font = '700 11px Arial'; g.fillText('Total: ' + total, w - pad, y + 11);
    g.save(); crmRR(g, pad, y + 18, w - pad * 2, 10, 5); g.clip();
    g.fillStyle = '#e8edf3'; g.fillRect(pad, y + 18, w - pad * 2, 10);
    let x = pad;
    segs.filter(s => crmN(s.count) > 0).forEach(s => { const sw = (w - pad * 2) * crmN(s.count) / total; g.fillStyle = s.color; g.fillRect(x, y + 18, sw, 10); x += sw; });
    g.restore();
    g.textAlign = 'left'; g.fillStyle = '#64748b'; g.font = '500 9.5px Arial';
    g.fillText(segs.map(s => s.label + ': ' + crmN(s.count)).join('  \u2022  '), pad, y + 42);
  });
  return c.toDataURL('image/png');
}

// plain bars (Admin / Manager): no y axis, rounded bars, grey stub for 0, tallest bar fills the chart
function crmPlainBarsPNG(items, w, h) {
  const { c, g } = crmCanvas(w, h);
  const T = 26, B = 40, L = 12, R = 12, ph = h - T - B, pw = w - L - R;
  const top = Math.max(1, ...items.map(i => crmN(i.count))), n = Math.max(items.length, 1), slot = pw / n, bw = Math.min(slot * 0.5, 46);
  g.strokeStyle = '#cbd5e1'; g.lineWidth = 1; g.beginPath(); g.moveTo(L, T + ph + 0.5); g.lineTo(w - R, T + ph + 0.5); g.stroke();
  items.forEach((it, i) => {
    const v = crmN(it.count), bh = v > 0 ? Math.max(4, v / top * ph) : 5, x = L + i * slot + (slot - bw) / 2, y = T + ph - bh;
    g.fillStyle = v > 0 ? (it.color || CRM_GREEN) : '#e2e8f0';
    crmRR(g, x, y, bw, bh + 6, 7); g.save(); g.beginPath(); g.rect(x - 1, y - 1, bw + 2, bh + 1); g.clip(); crmRR(g, x, y, bw, bh + 8, 7); g.fill(); g.restore();
    g.textAlign = 'center'; g.fillStyle = v > 0 ? '#111827' : '#94a3b8'; g.font = '700 11px Arial';
    g.fillText(it.display != null ? it.display : crmFmtN(v), x + bw / 2, y - 6);
    g.font = '600 10px Arial'; g.fillStyle = '#222222';
    let line = '', ly = T + ph + 17;
    String(it.label).split(' ').forEach(word => {
      const test = line ? line + ' ' + word : word;
      if (g.measureText(test).width > slot - 6 && line) { g.fillText(line, L + i * slot + slot / 2, ly); ly += 12; line = word; } else line = test;
    });
    g.fillText(line, L + i * slot + slot / 2, ly);
  });
  return c.toDataURL('image/png');
}

// which picture for which chart (same choice the page makes)
function crmChartImage(c, w, h) {
  const style = crmChartStyle(c);
  if (style === 'line')  return crmLinePNG(c.items, w, h);
  if (style === 'donut') return crmDonutPNG(c.items, w, h, (crmChartBox(c) || document.body).getAttribute('data-donut-caption'));
  if (style === 'meter') return crmMeterPNG(c.items, w, h);
  if (style === 'stack') return crmStackPNG(c.items, w, h);
  if (crmIsSd(c))        return crmPlainBarsPNG(c.items, w, h);
  return crmIsHChart(c) ? crmHChartPNG(c.items, w, h) : crmChartPNG(c.items, w, h);
}

// Builds ONE sheet (one tab) of the workbook.
// logoId = the id returned by wb.addImage for the logo (or null when the logo could not be loaded)
// Every Excel table starts with a "#" column (row number), like the Customer Service report.
// A table that already starts with "#" is left as it is. The footer / amount column move one place to the right.
function crmNumberedTable(T) {
  if (!T.headers.length || T.headers[0] === '#') return T;
  return {
    title: T.title,
    headers: ['#'].concat(T.headers),
    rows: T.rows.map((row, i) => [i + 1].concat(row)),
    foot: T.foot ? [''].concat(T.foot) : T.foot,
    amountCol: T.amountCol >= 0 ? T.amountCol + 1 : T.amountCol
  };
}

function crmBuildSheet(wb, d, logoId, usedNames) {
  const T = crmNumberedTable(d.table);
  const hasTable = T.headers.length > 0;            // Ticket / Activity tabs have no table
  const ncols = Math.max(6, T.headers.length);      // the sheet is as wide as the table
  const GREEN = 'FF165C43', LIGHT = 'FFE8F3EE', GREY = 'FFF6F8F7', LINE = 'FFD9DEE3';
  const fill = argb => ({ type: 'pattern', pattern: 'solid', fgColor: { argb } });
  const line = { style: 'thin', color: { argb: LINE } };
  const box = { top: line, left: line, bottom: line, right: line };

  // sheet name: tab name, max 31 characters, no  \ / ? * [ ] :
  let name = crmTabName(d).replace(/[\\\/\?\*\[\]:]/g, '').slice(0, 31) || 'Report';
  let n = 2;
  while (usedNames[name.toLowerCase()]) name = name.slice(0, 28) + ' ' + (n++);
  usedNames[name.toLowerCase()] = true;

  const ws = wb.addWorksheet(name, {
    views: [{ showGridLines: false }],
    pageSetup: { paperSize: 9, orientation: 'portrait', fitToPage: true, fitToWidth: 1, fitToHeight: 0 }
  });
  const colW = Array.from({ length: ncols }, (_, i) => [6, 34, 26, 24, 24, 18][i] || 20);
  ws.columns = colW.map(width => ({ width }));

  // ---- header: logo + business name + report title ----
  ws.mergeCells(1, 2, 2, ncols);
  ws.getCell(1, 2).value = CRM_BUSINESS_NAME.toUpperCase();
  ws.getCell(1, 2).font = { name: 'Georgia', size: 24, bold: true, color: { argb: 'FF1A1A1A' } };
  ws.getCell(1, 2).alignment = { horizontal: 'center', vertical: 'middle' };
  ws.mergeCells(3, 2, 3, ncols);
  ws.getCell(3, 2).value = d.title.toUpperCase();
  ws.getCell(3, 2).font = { name: 'Calibri', size: 15, bold: true, color: { argb: GREEN } };
  ws.getCell(3, 2).alignment = { horizontal: 'center', vertical: 'middle' };
  ws.getRow(1).height = 28; ws.getRow(2).height = 28; ws.getRow(3).height = 26;
  for (let c = 1; c <= ncols; c++) ws.getCell(4, c).border = { top: { style: 'medium', color: { argb: GREEN } } };
  // Downloaded by: right under the report title (top of the sheet)
  ws.mergeCells(4, 2, 4, ncols);
  ws.getCell(4, 2).value = 'Downloaded by: ' + d.user.toUpperCase();
  ws.getCell(4, 2).font = { name: 'Calibri', size: 11, bold: true, color: { argb: 'FF555555' } };
  ws.getCell(4, 2).alignment = { horizontal: 'center', vertical: 'middle' };
  ws.getRow(4).height = 22;

  if (logoId !== null && logoId !== undefined) {
    // The business name is centered across columns B..last. Put the logo just to the LEFT of the name
    // (like the PDF), instead of far left in column A.
    const LOGO = 92, GAP = 16;
    const colPx = colW.map(w => Math.round(w * 7 + 5));            // Excel column width -> pixels (approx.)
    const total = colPx.reduce((s, p) => s + p, 0);
    const centerX = (colPx[0] + total) / 2;                        // center of the merged title area
    const nameW = CRM_BUSINESS_NAME.length * 20;                   // approx. width of the 24pt name
    const x = Math.max(4, centerX - nameW / 2 - GAP - LOGO);       // left edge of the logo
    let px = x, colIdx = 0;                                        // pixel -> column number (with fraction)
    while (colIdx < colPx.length - 1 && px >= colPx[colIdx]) { px -= colPx[colIdx]; colIdx++; }
    // exact position in EMU (1 px = 9525 EMU). A fractional "col" would NOT follow the real column width in ExcelJS.
    ws.addImage(logoId, {
      tl: { nativeCol: colIdx, nativeColOff: Math.round(px * 9525), nativeRow: 0, nativeRowOff: Math.round(8 * 9525) },
      ext: { width: LOGO, height: LOGO }
    });
  }

  let r = 5;
  const heading = text => {
    r++;                                            // one empty row before every section
    ws.mergeCells(r, 1, r, ncols);
    const cell = ws.getCell(r, 1);
    cell.value = text; cell.fill = fill(GREEN);
    cell.font = { bold: true, size: 11, color: { argb: 'FFFFFFFF' } };
    cell.alignment = { vertical: 'middle', indent: 1 };
    ws.getRow(r).height = 22;
    r++;
  };

  // ---- summary cards (wrap to a second row if there are many) ----
  heading('SUMMARY');
  const perRow = ncols - 1;
  d.stats.forEach((s, i) => {
    const col = 2 + (i % perRow), base = r + Math.floor(i / perRow) * 2;
    const lab = ws.getCell(base, col), val = ws.getCell(base + 1, col);
    const isMoney = /amount/i.test(s[0]);
    lab.value = s[0]; lab.font = { size: 10, color: { argb: 'FF555555' } }; lab.fill = fill(GREY);
    val.value = isMoney ? d.num(s[1]) : (Number(s[1]) || s[1]);
    if (isMoney) val.numFmt = '"₱"#,##0.00';
    val.font = { size: 18, bold: true }; val.fill = fill(GREY);
    [lab, val].forEach(c => { c.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true }; });
    lab.border = { top: line, left: line, right: line };
    val.border = { bottom: line, left: line, right: line };
    ws.getRow(base + 1).height = 32;
  });
  r += Math.ceil(d.stats.length / perRow) * 2;

  // ---- rate bars (e.g. Customer Engagement: Returning rate / New customer share) ----
  const writePerf = after => (d.perf || []).filter(p => !!p.after === after).forEach(p => {
    heading(p.title.toUpperCase());
    if (p.subtitle) {
      ws.mergeCells(r, 1, r, ncols);
      ws.getCell(r, 1).value = p.subtitle;
      ws.getCell(r, 1).font = { italic: true, color: { argb: 'FF555555' } };
      r++;
    }
    ws.mergeCells(r, 1, r, 2); ws.mergeCells(r, 4, r, ncols);
    [[1, 'Measure'], [3, 'Rate'], [4, 'Detail']].forEach(h => { ws.getCell(r, h[0]).value = h[1]; });
    for (let c = 1; c <= ncols; c++) { const cell = ws.getCell(r, c); cell.fill = fill(LIGHT); cell.font = { bold: true }; cell.border = box; }
    r++;
    p.items.forEach(i => {
      ws.mergeCells(r, 1, r, 2); ws.mergeCells(r, 4, r, ncols);
      ws.getCell(r, 1).value = i.label;
      const rate = ws.getCell(r, 3);
      rate.value = i.value === null ? '\u2014' : i.value;
      if (i.value !== null) rate.numFmt = '0%';
      rate.alignment = { horizontal: 'right' }; rate.font = { bold: true };
      ws.getCell(r, 4).value = i.note;
      ws.getCell(r, 4).alignment = { wrapText: true, vertical: 'middle' };
      for (let c = 1; c <= ncols; c++) ws.getCell(r, c).border = box;
      r++;
    });
  });
  writePerf(false);

  // ---- charts, two per row, each with its count table ----
  // The count table is written starting at row `startRow`, in column `col` (1 = A).
  // Returns the first free row under the table.
  const stageTable = (chart, col, startRow) => {
    let rr = startRow;
    const noTotal = crmHasDisplay(chart);          // "22.1h" averages: a Total would be wrong
    [[crmChartKeyLabel(chart), noTotal ? 'Hours' : 'Count']]
      .concat(chart.items.map(i => [i.label, Number(i.count) || 0]))
      .concat(noTotal ? [] : [['Total', crmSum(chart.items)]])
      .forEach((row, idx, all) => {
        const a = ws.getCell(rr, col), b = ws.getCell(rr, col + 1);
        a.value = row[0]; b.value = row[1]; b.alignment = { horizontal: 'right' };
        const isHead = idx === 0, isTot = !noTotal && idx === all.length - 1;
        [a, b].forEach(c => {
          c.border = box;
          if (isHead) { c.fill = fill(LIGHT); c.font = { bold: true }; }
          if (isTot) { c.fill = fill(GREY); c.font = { bold: true }; }
        });
        rr++;
      });
    return rr;
  };

  for (let i = 0; i < d.charts.length; i += 2) {
    const pair = d.charts.slice(i, i + 2);
    heading(pair.map(c => c.title.toUpperCase()).join('  |  '));
    pair.forEach((c, k) => {
      const w = k === 0 ? 410 : 440;
      // horizontal on the page = horizontal picture in the Excel
      const png = crmChartImage(c, w, 240);
      const img = wb.addImage({ base64: png, extension: 'png' });
      ws.addImage(img, { tl: { col: k === 0 ? 1 : 3, row: r - 1 }, ext: { width: w, height: 240 } });
    });

    if (pair.length === 1) {
      // Only ONE chart in this row: use the free space, its count table goes to the RIGHT of the chart,
      // vertically in the MIDDLE of the chart (the 240 px chart is about 12 rows tall)
      const tableRows = pair[0].items.length + 2;                      // header + items + Total
      const offset = Math.max(0, Math.floor((12 - tableRows) / 2));    // empty rows above the table
      const end = stageTable(pair[0], 4, r + offset);
      r = Math.max(r + 13, end);
    } else {
      // Two charts: each count table sits under its own chart
      r += 13;
      let end = r;
      pair.forEach((c, k) => { end = Math.max(end, stageTable(c, k === 0 ? 2 : 4, r)); });
      r = end;
    }
  }

  writePerf(true);   // card that is BELOW the charts on the page

  // ---- the table (only when this tab has one) ----
  if (hasTable) {
    heading(T.title.toUpperCase());
    T.headers.forEach((t, i) => {
      const c = ws.getCell(r, i + 1);
      c.value = t; c.fill = fill(LIGHT); c.font = { bold: true }; c.border = box;
      c.alignment = { vertical: 'middle', horizontal: i === T.amountCol ? 'right' : 'left', wrapText: true };
    });
    ws.getRow(r).height = 22;
    r++;
    if (!T.rows.length) {
      ws.mergeCells(r, 1, r, T.headers.length || ncols);
      ws.getCell(r, 1).value = 'No records for this period.';
      ws.getCell(r, 1).alignment = { horizontal: 'center' };
      ws.getCell(r, 1).font = { italic: true, color: { argb: 'FF777777' } };
      r++;
    }
    T.rows.forEach(row => {
      T.headers.forEach((h, i) => {
        let v = row[i] === undefined ? '' : row[i];
        if (i === T.amountCol) v = d.num(v);
        else if (h === '#') v = Number(v) || v;       // real number: no green "text number" warning
        const c = ws.getCell(r, i + 1);
        c.value = v; c.border = box;
        c.alignment = { vertical: 'middle', horizontal: i === T.amountCol ? 'right' : 'left', wrapText: true };
        if (i === T.amountCol) c.numFmt = '"₱"#,##0.00';
      });
      r++;
    });
    if (T.foot && T.rows.length) {                    // table footer, e.g. the Customer "Total" row
      T.headers.forEach((h, i) => {
        const v = T.foot[i] === undefined ? '' : T.foot[i];
        const num = Number(v);
        const c = ws.getCell(r, i + 1);
        c.value = (v !== '' && !isNaN(num)) ? num : v;
        c.fill = fill(GREY); c.border = box; c.font = { bold: true };
        c.alignment = { vertical: 'middle', horizontal: i >= 2 ? 'right' : 'left' };
      });
      r++;
    }
    if (T.amountCol > 0 && T.rows.length) {           // Total row only when the table has an Amount column
      ws.mergeCells(r, 1, r, T.amountCol);
      ws.getCell(r, 1).value = 'Total';
      ws.getCell(r, T.amountCol + 1).value = T.rows.reduce((s, row) => s + d.num(row[T.amountCol]), 0);
      ws.getCell(r, T.amountCol + 1).numFmt = '"₱"#,##0.00';
      for (let c = 1; c <= T.headers.length; c++) {
        const cell = ws.getCell(r, c);
        cell.fill = fill(GREY); cell.border = box; cell.font = { bold: true };
        if (c === T.amountCol + 1) cell.alignment = { horizontal: 'right' };
      }
      r++;
    }
  }

  // ---- report information (at the BOTTOM of the sheet) ----
  heading('REPORT INFORMATION');
  [[crmPeriodLabel(d), d.range], ['Report date', d.today], ['Download date', d.today], ['Download time', crmNowTime()]].forEach(row => {
    ws.mergeCells(r, 1, r, 2); ws.mergeCells(r, 3, r, ncols);
    ws.getCell(r, 1).value = row[0]; ws.getCell(r, 1).font = { bold: true, color: { argb: 'FF555555' } };
    ws.getCell(r, 3).value = row[1]; ws.getCell(r, 3).font = { bold: true };
    ws.getCell(r, 3).alignment = { horizontal: 'left' };
    r++;
  });
}

// ExcelJS is normally loaded by the page shell (app-layout.php). If it is not there, load it now,
// so "Export Excel" gives a real .xlsx file instead of silently falling back to CSV.
const CRM_EXCELJS_URL = 'https://cdn.jsdelivr.net/npm/exceljs@4.4.0/dist/exceljs.min.js';
function crmLoadExcelJS() {
  return new Promise(resolve => {
    if (typeof ExcelJS !== 'undefined') return resolve(true);
    const s = document.createElement('script');
    s.src = CRM_EXCELJS_URL;
    s.onload = () => resolve(typeof ExcelJS !== 'undefined');
    s.onerror = () => resolve(false);
    document.head.appendChild(s);
  });
}

async function crmExportReportExcel() {
  if (!(await crmLoadExcelJS())) {                  // library could not be loaded (offline?) -> plain CSV
    console.warn('ExcelJS could not be loaded, downloading CSV instead.');
    return crmExportReportCSV();
  }
  const list = crmAllReports();
  const wb = new ExcelJS.Workbook();

  // the logo is loaded once and reused on every sheet
  const logo = await crmLogoPNG(new URL(CRM_LOGO, document.baseURI).href, 256);
  const logoId = logo ? wb.addImage({ base64: logo, extension: 'png' }) : null;

  const used = {};
  list.forEach(d => crmBuildSheet(wb, d, logoId, used));   // one sheet per tab

  const buf = await wb.xlsx.writeBuffer();
  crmSaveBlob(new Blob([buf], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }), crmFileName(crmPackName(list), 'xlsx'));
}

// ==========================================================================
// PDF  (opens the browser print window: choose "Save as PDF")
//
// Layout:
//   - Every tab is its own <table class="page sec"> and starts on a NEW page.
//   - No running header text. The <thead> of that table is only an empty spacer, so every
//     page of the tab gets white space at the top.
//   - The page TOP margin is 0, so the browser has no room to print its own date / title line.
//     White space comes from the spacer row + the side padding of the cells.
//   - Footer on every page:  "Generated <date, time> · by <user>"  and  "Page X of Y".
//     These two use the @page bottom margin boxes (Chrome / Edge; Firefox ignores them).
// ==========================================================================
// FIT ON ONE PAGE: a tab whose content is only slightly taller than one A4 page (and whose table is small)
// is scaled down a little so it fits on ONE page. Bigger tabs flow to the next page as before.
// A small table is never split: it moves to the next page whole, so a lone "Total" row is never left behind.
function crmFitSections(doc) {
  const mm = 96 / 25.4;                               // CSS px per mm
  const avail = (297 - 14 - 12) * mm * 0.97;          // A4 height - bottom margin - top gap (small safety)
  doc.querySelectorAll('.fit[data-fit="1"]').forEach(box => {
    const h = box.offsetHeight;
    if (h > avail && avail / h >= 0.72) box.style.zoom = String(avail / h);
  });
}
function crmPrintHTML(html, fileName) {
  const f = document.createElement('iframe');
  f.style.cssText = 'position:fixed;left:-10000px;top:0;width:210mm;height:297mm;border:0;visibility:hidden;';   // real A4 width, so the layout can be measured
  document.body.appendChild(f);
  const doc = f.contentWindow.document;
  doc.open(); doc.write(html); doc.close();
  const waits = Array.from(doc.images).map(i => i.complete ? 1 : new Promise(r => { i.onload = i.onerror = r; }));
  Promise.all(waits).then(() => setTimeout(() => {
    // The browser names the saved PDF after the title of the MAIN page (e.g. "Admin Dashboard"),
    // not the title of this hidden print window. So the main page gets the report name while
    // the print window is open, then its own title comes back.
    crmFitSections(doc);
    const oldTitle = document.title;
    if (fileName) document.title = fileName;
    const restore = () => { document.title = oldTitle; };
    f.contentWindow.addEventListener('afterprint', restore, { once: true });
    f.contentWindow.focus();
    f.contentWindow.print();
    setTimeout(() => { restore(); f.remove(); }, 1500);
  }, 200));
}

// Makes a safe CSS string for the  content:  property of a page margin box
const crmCssStr = s => '"' + String(s == null ? '' : s)
  .replace(/\\/g, '\\\\').replace(/"/g, '\\"').replace(/[\r\n]+/g, ' ') + '"';

// ---- PDF drawings for the Admin / Manager charts (vector, no dependence on download-export.css) ----
function crmPdfBarSVG(items) {
  const W = 420, H = 200, L = 10, R = 10, T = 28, B = 44, ph = H - T - B, pw = W - L - R;
  const top = Math.max(1, ...items.map(i => crmN(i.count))), n = Math.max(items.length, 1), slot = pw / n, bw = Math.min(slot * 0.5, 52);
  const F = 'font-family="Arial,Helvetica,sans-serif" text-anchor="middle"';
  let out = '<line x1="' + L + '" x2="' + (W - R) + '" y1="' + (T + ph) + '" y2="' + (T + ph) + '" stroke="#cbd5e1"/>';
  items.forEach((it, i) => {
    const v = crmN(it.count), bh = v > 0 ? Math.max(4, v / top * ph) : 5, x = L + i * slot + (slot - bw) / 2, y = T + ph - bh, cx = x + bw / 2;
    out += '<path d="M' + x + ' ' + (T + ph) + 'V' + (y + 7) + 'a7 7 0 0 1 7 -7h' + (bw - 14) + 'a7 7 0 0 1 7 7V' + (T + ph) + 'z" fill="' + (v > 0 ? (it.color || CRM_GREEN) : '#e2e8f0') + '"/>' +
           '<text ' + F + ' x="' + cx + '" y="' + (y - 7) + '" font-size="12" font-weight="700" fill="' + (v > 0 ? '#111827' : '#94a3b8') + '">' + crmEscape(it.display != null ? it.display : crmFmtN(v)) + '</text>';
    const words = String(it.label).split(' '), lines = []; let cur = '';
    words.forEach(wd => { const t = cur ? cur + ' ' + wd : wd; if (t.length * 5.6 > slot - 6 && cur) { lines.push(cur); cur = wd; } else cur = t; });
    lines.push(cur);
    lines.forEach((t, k) => { out += '<text ' + F + ' x="' + (L + i * slot + slot / 2) + '" y="' + (T + ph + 17 + k * 12) + '" font-size="10.5" font-weight="600" fill="#222">' + crmEscape(t) + '</text>'; });
  });
  return '<svg viewBox="0 0 ' + W + ' ' + H + '">' + out + '</svg>';
}

function crmPdfChartHTML(c) {
  const style = crmChartStyle(c), box = crmChartBox(c);
  const fake = { id: c.id, getAttribute: k => (box ? box.getAttribute(k) : null), clientWidth: 420 };
  if (style && typeof CRM_RP_RENDERERS !== 'undefined' && CRM_RP_RENDERERS[style])
    return '<div class="sdx">' + CRM_RP_RENDERERS[style](c.items, fake, { width: 420, height: 220, noLegend: true }) + '</div>';
  if (crmIsSd(c)) return '<div class="sdx">' + crmPdfBarSVG(c.items) + '</div>';
  return crmIsHChart(c) ? '<div class="rp-hchart">' + crmHChartHTML(c.items) + '</div>' : '<div class="rp-chart">' + crmChartHTML(c.items) + '</div>';
}

// extra PDF styles for the Admin / Manager charts (added after download-export.css, concrete colours only)
const CRM_PDF_EXTRA_CSS = `
*{-webkit-print-color-adjust:exact;print-color-adjust:exact}
.sdx{width:100%}
.sdx svg{display:block;width:100%;height:auto}
.sdx .sd-grid{stroke:#e2e8f0;stroke-width:1}
.sdx .rp-dash{stroke-dasharray:3 4}
.sdx .sd-axis{fill:#64748b;font:500 10px Arial,Helvetica,sans-serif}
.sdx .sd-line{fill:none;stroke:#165c43;stroke-width:2.5;stroke-linecap:round;stroke-linejoin:round}
.sdx .rp-dot{fill:#fff;stroke:#165c43;stroke-width:2.5}
.sdx .rp-halo{fill:#165c43;fill-opacity:.14}
.sdx .rp-line-val{fill:#111827;font:700 12px Arial,Helvetica,sans-serif}
.sdx .rp-line-val.is-zero{fill:#94a3b8}
.sdx .rp-xlab{fill:#111827;font:600 11px Arial,Helvetica,sans-serif}
.sdx .rp-xlab2{fill:#64748b;font:500 10px Arial,Helvetica,sans-serif}
.sdx .ops-donut-wrap{display:flex;justify-content:center;padding:6px 0}
.sdx .ops-donut{width:160px;height:160px}
.sdx .ops-donut-num{fill:#111827;font:800 20px Arial,Helvetica,sans-serif}
.sdx .ops-donut-cap{fill:#64748b;font:700 7px Arial,Helvetica,sans-serif;letter-spacing:.08em}
.sdx .rp-meter-row{margin-bottom:12px}
.sdx .rp-meter-head{display:flex;justify-content:space-between;gap:8px;font:600 11px Arial,Helvetica,sans-serif;color:#111827;margin-bottom:4px}
.sdx .rp-meter-head small{font:500 9.5px Arial,Helvetica,sans-serif;color:#64748b}
.sdx .rp-meter-head small b{color:#111827}
.sdx .rp-meter-track{display:flex;height:10px;border-radius:99px;overflow:hidden;background:#e8edf3}
.sdx .rp-fill{display:block;height:100%}
.sdx .rp-meter-track:not(.rp-stack) .rp-fill{border-radius:99px}
.sdx .rp-legend{display:flex;flex-wrap:wrap;gap:4px 14px;margin-bottom:10px;font:10px Arial,Helvetica,sans-serif;color:#111827}
.sdx .ops-swatch{display:inline-block;width:8px;height:8px;border-radius:50%;margin-right:5px}
.sdx .sd-empty{padding:30px 0;text-align:center;font:12px Arial,sans-serif;color:#64748b}
`;

// rate bars (e.g. Customer Engagement) as one card
function crmPdfPerfHTML(d, after) {
  const e = crmEscape;
  return (d.perf || []).filter(p => !!p.after === after).map(p =>
    '<div class="perf"><h3>' + e(p.title) + '</h3>' + (p.subtitle ? '<p class="perf-sub">' + e(p.subtitle) + '</p>' : '') +
    '<div class="perf-grid">' + p.items.map(i => {
      const w = i.value === null ? 0 : Math.min(100, Math.round(i.value * 100));
      return '<div class="perf-item"><div class="perf-top"><span>' + e(i.label) + '</span><b>' + e(i.pct) + '</b></div>' +
        '<div class="perf-track"><i style="width:' + w + '%"></i></div><div class="perf-note">' + e(i.note) + '</div></div>';
    }).join('') + '</div></div>').join('');
}

// HTML of ONE tab (one block of the PDF)
function crmPdfSection(d, logo) {
  const T = d.table, e = crmEscape;
  const hasTable = T.headers.length > 0;

  // count table under / beside a chart: Stage | Count | %
  const mini = c => {
    if (crmHasDisplay(c)) {                          // averages ("22.1h"): label + value only, no total / %
      return '<table class="mini"><tr><th>' + e(crmChartKeyLabel(c)) + '</th><th>Hours</th></tr>' +
        c.items.map(i => '<tr><td>' + e(i.label) + '</td><td>' + e(i.display != null ? i.display : i.count) + '</td></tr>').join('') + '</table>';
    }
    const total = crmSum(c.items);
    const pct = n => total ? Math.round(n / total * 100) + '%' : '0%';
    return '<table class="mini"><tr><th>' + e(crmChartKeyLabel(c)) + '</th><th>Count</th><th>%</th></tr>' +
      c.items.map(i => '<tr><td>' + e(i.label) + '</td><td>' + e(i.count) + '</td><td>' + pct(Number(i.count) || 0) + '</td></tr>').join('') +
      '<tr class="tot"><td>Total</td><td>' + total + '</td><td>' + (total ? '100%' : '0%') + '</td></tr></table>';
  };

  let tableHTML = '';
  if (hasTable) {
    const cols = T.headers.length || 1;
    let body;
    if (!T.rows.length) {
      body = '<tr><td colspan="' + cols + '" class="none">No records for this period.</td></tr>';
    } else {
      body = T.rows.map(r => '<tr>' + T.headers.map((_, i) => '<td>' + e(r[i] || '') + '</td>').join('') + '</tr>').join('');
      if (T.foot) {                                  // table footer, e.g. the Customer "Total" row
        body += '<tr class="tot">' + T.headers.map((_, i) => '<td>' + e(T.foot[i] || '') + '</td>').join('') + '</tr>';
      }
      if (T.amountCol > 0) {
        const total = T.rows.reduce((s, r) => s + d.num(r[T.amountCol]), 0);
        const rest = cols - T.amountCol - 1;
        body += '<tr class="tot"><td colspan="' + T.amountCol + '">Total</td><td>₱' + total.toLocaleString('en-US') + '</td>' +
                (rest > 0 ? '<td colspan="' + rest + '"></td>' : '') + '</tr>';
      }
    }
    tableHTML = (T.rows.length <= 14 ? '<div class="keep">' : '<div>') + '<h3>' + e(T.title) + '</h3>' +
      '<table class="data"><thead><tr>' + T.headers.map(h => '<th>' + e(h) + '</th>').join('') + '</tr></thead><tbody>' + body + '</tbody></table></div>';
  }

  // AUTOMATIC CHART LAYOUT: charts go two per row; a chart that would be alone in its row
  // (the only chart, or the odd last one) becomes "wide": full width, chart left + count table right.
  const n = d.charts.length;
  const chartsHTML = d.charts.map((c, i) => {
    const wide = (i === n - 1 && n % 2 === 1);
    // same direction as on the page: horizontal chart stays horizontal
    const chartBox = crmPdfChartHTML(c);
    return '<section' + (wide ? ' class="wide"' : '') + '><h3>' + e(c.title) + '</h3>' + chartBox + mini(c) + '</section>';
  }).join('');

  // thead = an empty spacer row, repeated at the top of every page of this tab (the page top margin is 0)
  return '<table class="page sec">' +
    '<thead><tr><td><div class="gap"></div></td></tr></thead>' +
    '<tbody><tr><td><div class="fit" data-fit="' + (!hasTable || T.rows.length <= 14 ? 1 : 0) + '">' +
      '<div class="brand"><img src="' + e(logo) + '" alt=""><h1>' + e(CRM_BUSINESS_NAME) + '</h1></div>' +
      '<h2>' + e(d.title) + '</h2>' +
      '<p class="period">' + e(crmPeriodLabel(d)) + ': <b>' + e(d.range) + '</b></p>' +
      crmPdfStatsHTML(d.stats) +
      crmPdfPerfHTML(d, false) +
      '<div class="charts">' + chartsHTML + '</div>' +
      crmPdfPerfHTML(d, true) +
      tableHTML +
    '</div></td></tr></tbody>' +
    '</table>';
}

// Summary cards: balanced rows (max 4 per row, e.g. 5 cards = 3 + 2) and every card stretches
// so each row fills the full width (12-column grid, a card spans 12 / cards-in-its-row).
function crmPdfStatsHTML(stats) {
  const e = crmEscape, n = stats.length;
  const rowCount = Math.max(1, Math.ceil(n / 4));
  const spans = [];
  let left = n;
  for (let r = 0; r < rowCount; r++) {
    const size = Math.ceil(left / (rowCount - r));
    for (let k = 0; k < size; k++) spans.push(12 / size);
    left -= size;
  }
  return '<div class="stats" style="grid-template-columns:repeat(12,1fr)">' + stats.map((s, i) =>
    '<div class="st" style="grid-column:span ' + spans[i] + '"><span>' + e(s[0]) + '</span><b>' + e(s[1]) + '</b></div>').join('') + '</div>';
}

// Load the PDF layout from its CSS file and insert only the generated footer text.
async function crmLoadPdfStylesheet(generated) {
  const response = await fetch(new URL(CRM_PDF_CSS, document.baseURI), { cache: 'no-store' });
  if (!response.ok) throw new Error('Could not load PDF CSS (' + response.status + ').');
  const css = await response.text();
  const footerToken = '"__CRM_PDF_GENERATED_FOOTER__"';
  if (!css.includes(footerToken)) throw new Error('The PDF CSS footer placeholder is missing.');
  return css.replace(footerToken, crmCssStr(generated));
}
async function crmDownloadReportPDF() {
  const list = crmAllReports(), e = crmEscape;
  const logo = new URL(CRM_LOGO, document.baseURI).href;
  const first = list[0];
  // each tab sizes its own summary cards (max 4 per row) so they always fill the full width
  const maxStats = Math.max(1, ...list.map(d => d.stats.length));

  // ONE footer line for the whole document (the time is the moment of the download)
  const generated = 'Generated ' + first.today + ', ' + crmNowTime() + '  \u00b7  by ' + first.user;
  const statCols = Math.min(maxStats, 4);
  let pdfCss;
  try {
    pdfCss = await crmLoadPdfStylesheet(generated);
  } catch (error) {
    console.error('Unable to load PDF stylesheet:', error);
    if (window.crmToast) window.crmToast('Could not load the PDF stylesheet. Check that DownloadExport.css is in all-pages-css and try again.', 'error');
    return;
  }
  const title = crmFileName(crmPackName(list), 'pdf').replace(/\.pdf$/, '');

  const html = '<!DOCTYPE html><html><head><meta charset="utf-8"><title>' + e(title) + '</title><style>' + pdfCss + CRM_PDF_EXTRA_CSS + '</style></head><body style="--stat-cols:' + statCols + '">' +
    list.map(d => crmPdfSection(d, logo)).join('') +
    '</body></html>';

  crmPrintHTML(html, title);
}

// ==========================================================================
// BUTTONS (work on every Reports page; the id of the Excel button is still "exportCsvBtn")
// ==========================================================================
if (!window.__crmDownloadExportBound) {
  window.__crmDownloadExportBound = true;
  document.addEventListener('click', function (e) {
    if (e.target.closest('#exportCsvBtn')) crmExportReportExcel();
    if (e.target.closest('#downloadPdfBtn')) crmDownloadReportPDF();
  });
}