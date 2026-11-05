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
const CRM_PDF_CSS = 'css-InAllPages/downloadExport.css';

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
    d.charts.forEach(c => {
      out.push([c.title.toUpperCase(), 'Count'], ...c.items.map(i => [i.label, i.count]), ['Total', crmSum(c.items)], []);
    });
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

// Builds ONE sheet (one tab) of the workbook.
// logoId = the id returned by wb.addImage for the logo (or null when the logo could not be loaded)
function crmBuildSheet(wb, d, logoId, usedNames) {
  const T = d.table;
  const hasTable = T.headers.length > 0;            // Ticket / Activity tabs have no table
  const ncols = Math.max(6, T.headers.length);      // the sheet is as wide as the table
  const GREEN = 'FF0F3D2E', LIGHT = 'FFE7F1EC', GREY = 'FFF8F9F8', LINE = 'FFD5D9D7';
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

  // ---- charts, two per row, each with its count table ----
  // The count table is written starting at row `startRow`, in column `col` (1 = A).
  // Returns the first free row under the table.
  const stageTable = (chart, col, startRow) => {
    let rr = startRow;
    [[crmKeyLabel(chart.title), 'Count']]
      .concat(chart.items.map(i => [i.label, Number(i.count) || 0]))
      .concat([['Total', crmSum(chart.items)]])
      .forEach((row, idx, all) => {
        const a = ws.getCell(rr, col), b = ws.getCell(rr, col + 1);
        a.value = row[0]; b.value = row[1]; b.alignment = { horizontal: 'right' };
        const isHead = idx === 0, isTot = idx === all.length - 1;
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
      const png = crmIsHChart(c) ? crmHChartPNG(c.items, w, 240) : crmChartPNG(c.items, w, 240);
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

async function crmExportReportExcel() {
  if (typeof ExcelJS === 'undefined') {            // library not loaded -> plain CSV
    console.warn('ExcelJS is not loaded, downloading CSV instead.');
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
function crmPrintHTML(html, fileName) {
  const f = document.createElement('iframe');
  f.style.cssText = 'position:fixed;right:0;bottom:0;width:0;height:0;border:0;';
  document.body.appendChild(f);
  const doc = f.contentWindow.document;
  doc.open(); doc.write(html); doc.close();
  const waits = Array.from(doc.images).map(i => i.complete ? 1 : new Promise(r => { i.onload = i.onerror = r; }));
  Promise.all(waits).then(() => setTimeout(() => {
    // The browser names the saved PDF after the title of the MAIN page (e.g. "Admin Dashboard"),
    // not the title of this hidden print window. So the main page gets the report name while
    // the print window is open, then its own title comes back.
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

// HTML of ONE tab (one block of the PDF)
function crmPdfSection(d, logo) {
  const T = d.table, e = crmEscape;
  const hasTable = T.headers.length > 0;

  // count table under / beside a chart: Stage | Count | %
  const mini = c => {
    const total = crmSum(c.items);
    const pct = n => total ? Math.round(n / total * 100) + '%' : '0%';
    return '<table class="mini"><tr><th>' + e(crmKeyLabel(c.title)) + '</th><th>Count</th><th>%</th></tr>' +
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
    tableHTML = '<h3>' + e(T.title) + '</h3>' +
      '<table class="data"><thead><tr>' + T.headers.map(h => '<th>' + e(h) + '</th>').join('') + '</tr></thead><tbody>' + body + '</tbody></table>';
  }

  // AUTOMATIC CHART LAYOUT: charts go two per row; a chart that would be alone in its row
  // (the only chart, or the odd last one) becomes "wide": full width, chart left + count table right.
  const n = d.charts.length;
  const chartsHTML = d.charts.map((c, i) => {
    const wide = (i === n - 1 && n % 2 === 1);
    // same direction as on the page: horizontal chart stays horizontal
    const chartBox = crmIsHChart(c)
      ? '<div class="rp-hchart">' + crmHChartHTML(c.items) + '</div>'
      : '<div class="rp-chart">' + crmChartHTML(c.items) + '</div>';
    return '<section' + (wide ? ' class="wide"' : '') + '><h3>' + e(c.title) + '</h3>' + chartBox + mini(c) + '</section>';
  }).join('');

  // thead = an empty spacer row, repeated at the top of every page of this tab (the page top margin is 0)
  return '<table class="page sec">' +
    '<thead><tr><td><div class="gap"></div></td></tr></thead>' +
    '<tbody><tr><td>' +
      '<div class="brand"><img src="' + e(logo) + '" alt=""><h1>' + e(CRM_BUSINESS_NAME) + '</h1></div>' +
      '<h2>' + e(d.title) + '</h2>' +
      '<p class="period">' + e(crmPeriodLabel(d)) + ': <b>' + e(d.range) + '</b></p>' +
      '<div class="stats">' + d.stats.map(s => '<div class="st"><span>' + e(s[0]) + '</span><b>' + e(s[1]) + '</b></div>').join('') + '</div>' +
      '<div class="charts">' + chartsHTML + '</div>' +
      tableHTML +
    '</td></tr></tbody>' +
    '</table>';
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
  // most summary cards on any tab (max 4 per row) so every tab uses the same card width
  const maxStats = Math.max(1, ...list.map(d => d.stats.length));

  // ONE footer line for the whole document (the time is the moment of the download)
  const generated = 'Generated ' + first.today + ', ' + crmNowTime() + '  \u00b7  by ' + first.user;
  const statCols = Math.min(maxStats, 4);
  let pdfCss;
  try {
    pdfCss = await crmLoadPdfStylesheet(generated);
  } catch (error) {
    console.error('Unable to load PDF stylesheet:', error);
    window.alert('Could not load the PDF stylesheet. Check that DownloadExport.css is in css-InAllPages and try again.');
    return;
  }
  const title = crmFileName(crmPackName(list), 'pdf').replace(/\.pdf$/, '');

  const html = '<!DOCTYPE html><html><head><meta charset="utf-8"><title>' + e(title) + '</title><style>' + pdfCss + '</style></head><body style="--stat-cols:' + statCols + '">' +
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