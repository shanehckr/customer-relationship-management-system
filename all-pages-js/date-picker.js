/* =============================================================================
   date-picker.js  -  one modern calendar for EVERY <input type="date">, and one matching time list for EVERY
   <input type="time">, in the system.

   TIME inputs: the browser's own time dropdown (all 12 hours, every minute) is replaced by a list of slots that
   follows the input's min / max / step (e.g. min="08:00" max="20:00" step="900" = 8:00 AM to 8:00 PM every 15 minutes).
   The input stays a normal <input type="time"> (.value is HH:MM, typing still works). Optional: data-time-label="Pickup time"
   is the title shown on top of the list. Same look as the calendar (.dp-* in all-pages.css).
   --- the date part, unchanged: ---

   The browser's own calendar popup cannot be styled with CSS, so this file swaps it for
   a custom one. Nothing else has to change:
     - the input stays a normal <input type="date"> (typing still works, .value is still yyyy-mm-dd)
     - min / max / disabled / readonly on the input are respected (read every time it opens)
     - "input" and "change" events are fired when a date is picked, so existing code keeps working
     - inputs added later (modals, cards drawn by pages.js / customer-pages.js) work automatically
   Opt out for one input with  data-native-date  on it.
   Add ONE line to the shared layout, next to all-pages.css / pages.js:
        <script src="date-picker.js" defer></script>
   The look lives at the end of all-pages.css (.dp-*).
   ============================================================================= */
(function () {
  "use strict";
  if (window.__crmDatePicker) return;
  window.__crmDatePicker = true;

  var MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
  var WEEK = ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"];
  var ICON = {
    prev: '<svg viewBox="0 0 16 16" width="16" height="16" aria-hidden="true"><path d="M10 3 5 8l5 5" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>',
    next: '<svg viewBox="0 0 16 16" width="16" height="16" aria-hidden="true"><path d="m6 3 5 5-5 5" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>',
    caret: '<svg viewBox="0 0 12 12" width="10" height="10" aria-hidden="true"><path d="m3 4.5 3 3 3-3" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/></svg>'
  };

  var pop = null;        // the popup element (created once, reused)
  var input = null;      // the input the popup is open for
  var view = "days";     // days | months | years
  var shown = { y: 0, m: 0 };   // month being displayed
  var rafId = 0;
  var mode = "date";     // date | time  (what the popup shows for the current input)

  /* ---------- date helpers (local time only, never UTC, so no off-by-one day) ---------- */
  function pad(n) { return (n < 10 ? "0" : "") + n; }
  function ymd(y, m, d) { return y + "-" + pad(m + 1) + "-" + pad(d); }
  function parse(v) {
    var m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(v || "");
    if (!m) return null;
    var y = +m[1], mo = +m[2] - 1, d = +m[3];
    var t = new Date(y, mo, d);
    return t.getFullYear() === y && t.getMonth() === mo && t.getDate() === d ? { y: y, m: mo, d: d } : null;
  }
  function today() { var t = new Date(); return { y: t.getFullYear(), m: t.getMonth(), d: t.getDate() }; }
  function daysIn(y, m) { return new Date(y, m + 1, 0).getDate(); }
  /* ---------- time helpers ---------- */
  function toMin(v, fallback) {
    var m = /^(\d{1,2}):(\d{2})/.exec(v || "");
    return m ? (+m[1]) * 60 + (+m[2]) : fallback;
  }
  function hhmm(min) { return pad(Math.floor(min / 60)) + ":" + pad(min % 60); }
  function label12(min) {
    var h = Math.floor(min / 60);
    return (h % 12 || 12) + ":" + pad(min % 60) + " " + (h >= 12 ? "PM" : "AM");
  }
  function limits() {
    return { min: input && input.min ? input.min : "", max: input && input.max ? input.max : "" };
  }
  function blocked(str) {
    var l = limits();
    return (l.min && str < l.min) || (l.max && str > l.max);
  }
  // 6 rows x 7 columns, Sunday first, always 42 cells so the popup never changes height
  function grid(y, m) {
    var first = new Date(y, m, 1).getDay(), cells = [], i, d;
    var prevDays = daysIn(y, m - 1), cur = daysIn(y, m);
    for (i = first - 1; i >= 0; i--) cells.push({ y: m ? y : y - 1, m: (m + 11) % 12, d: prevDays - i, out: true });
    for (d = 1; d <= cur; d++) cells.push({ y: y, m: m, d: d, out: false });
    for (d = 1; cells.length < 42; d++) cells.push({ y: m === 11 ? y + 1 : y, m: (m + 1) % 12, d: d, out: true });
    return cells;
  }

  /* ---------- popup ---------- */
  function build() {
    pop = document.createElement("div");
    pop.className = "dp-pop";
    pop.setAttribute("role", "dialog");
    pop.setAttribute("aria-label", "Choose a date");
    pop.hidden = true;
    // keep focus on the input while the mouse works the popup (also keeps Bootstrap modals happy)
    pop.addEventListener("mousedown", function (e) { e.preventDefault(); });
    pop.addEventListener("click", onPopClick);
    document.body.appendChild(pop);
  }

  function renderTime() {
    pop.className = "dp-pop dp-pop-time";
    var a = toMin(input.min, 480), z = toMin(input.max, 1200);        // default 8:00 AM - 8:00 PM
    var step = Math.max(1, Math.round((parseInt(input.step, 10) || 900) / 60));
    var cur = (input.value || "").slice(0, 5);
    var title = input.getAttribute("data-time-label") || "Choose a time";
    var html = '<div class="dp-head"><span class="dp-title" data-act="none">' + title + "</span></div>" +
      '<div class="dp-times" role="listbox" aria-label="' + title + '">';
    for (var m = a; m <= z; m += step) {
      var v = hhmm(m);
      html += '<button type="button" class="dp-cell' + (v === cur ? " is-selected" : "") + '" data-time="' + v + '" role="option"' +
        (v === cur ? ' aria-selected="true"' : "") + ">" + label12(m) + "</button>";
    }
    html += '</div><div class="dp-legend">Available ' + label12(a) + " to " + label12(z) + "</div>";
    if (!input.required) html += '<div class="dp-foot"><button type="button" class="dp-link" data-act="clear">Clear</button><span></span></div>';
    pop.innerHTML = html;
  }
  function scrollTimes() {
    var box = pop && pop.querySelector(".dp-times"), on = box && box.querySelector(".is-selected");
    if (box && on) box.scrollTop = on.offsetTop - box.clientHeight / 2 + on.offsetHeight / 2;
  }

  function render() {
    if (!pop || !input) return;
    if (mode === "time") { renderTime(); return; }
    pop.className = "dp-pop";
    var sel = parse(input.value), t = today(), l = limits(), html = "", i;
    // optional: the input can mark one day (e.g. the event date) with  data-mark-date="yyyy-mm-dd"  and  data-mark-label="Event date"
    var mark = parse(input.getAttribute("data-mark-date") || ""), markLabel = input.getAttribute("data-mark-label") || "Marked date";

    if (view === "days") {
      html += head(MONTHS[shown.m] + " " + shown.y, "month");
      html += '<div class="dp-week">' + WEEK.map(function (w) { return "<span>" + w + "</span>"; }).join("") + "</div>";
      html += '<div class="dp-days" role="grid">';
      grid(shown.y, shown.m).forEach(function (c) {
        var s = ymd(c.y, c.m, c.d), cls = "dp-day";
        if (c.out) cls += " is-out";
        if (c.y === t.y && c.m === t.m && c.d === t.d) cls += " is-today";
        if (sel && c.y === sel.y && c.m === sel.m && c.d === sel.d) cls += " is-selected";
        var isMark = mark && c.y === mark.y && c.m === mark.m && c.d === mark.d;
        if (isMark) cls += " is-mark";
        var off = blocked(s);
        html += '<button type="button" class="' + cls + '" data-date="' + s + '"' + (off ? " disabled" : "") +
          (cls.indexOf("is-selected") > -1 ? ' aria-pressed="true"' : "") + (isMark ? ' title="' + markLabel + '" aria-label="' + markLabel + " " + c.d + '"' : "") + ">" + c.d + "</button>";
      });
      html += "</div>";
      if (mark) html += '<div class="dp-legend"><span class="dp-legend-dot"></span>' + markLabel + ": " + MONTHS[mark.m].slice(0, 3) + " " + mark.d + ", " + mark.y + "</div>";
    } else if (view === "months") {
      html += head(String(shown.y), "year");
      html += '<div class="dp-grid">';
      for (i = 0; i < 12; i++) {
        var off2 = (l.min && ymd(shown.y, i, daysIn(shown.y, i)) < l.min) || (l.max && ymd(shown.y, i, 1) > l.max);
        var on = sel && sel.y === shown.y && sel.m === i, now = t.y === shown.y && t.m === i;
        html += '<button type="button" class="dp-cell' + (on ? " is-selected" : "") + (now ? " is-today" : "") + '" data-month="' + i + '"' +
          (off2 ? " disabled" : "") + ">" + MONTHS[i].slice(0, 3) + "</button>";
      }
      html += "</div>";
    } else {
      var start = shown.y - (shown.y % 12);
      html += head(start + " - " + (start + 11), "");
      html += '<div class="dp-grid">';
      for (i = 0; i < 12; i++) {
        var yr = start + i;
        var off3 = (l.min && ymd(yr, 11, 31) < l.min) || (l.max && ymd(yr, 0, 1) > l.max);
        html += '<button type="button" class="dp-cell' + (sel && sel.y === yr ? " is-selected" : "") + (t.y === yr ? " is-today" : "") +
          '" data-year="' + yr + '"' + (off3 ? " disabled" : "") + ">" + yr + "</button>";
      }
      html += "</div>";
    }

    var tStr = ymd(t.y, t.m, t.d);
    html += '<div class="dp-foot">' +
      (input.required ? "<span></span>" : '<button type="button" class="dp-link" data-act="clear">Clear</button>') +
      '<button type="button" class="dp-link" data-act="today"' + (blocked(tStr) ? " disabled" : "") + ">Today</button></div>";
    pop.innerHTML = html;
  }

  function head(label, next) {
    return '<div class="dp-head">' +
      '<button type="button" class="dp-title" data-act="' + (next ? "up" : "none") + '"' + (next ? "" : " tabindex=\"-1\"") + ">" + label +
      (next ? '<span class="dp-caret">' + ICON.caret + "</span>" : "") + "</button>" +
      '<div class="dp-nav">' +
      '<button type="button" class="dp-arrow" data-act="prev" aria-label="Previous">' + ICON.prev + "</button>" +
      '<button type="button" class="dp-arrow" data-act="next" aria-label="Next">' + ICON.next + "</button>" +
      "</div></div>";
  }

  function onPopClick(e) {
    var b = e.target.closest("button");
    if (!b || b.disabled || !input) return;
    var act = b.getAttribute("data-act");

    if (b.hasAttribute("data-date")) { pick(b.getAttribute("data-date")); return; }
    if (b.hasAttribute("data-time")) { pick(b.getAttribute("data-time")); return; }
    if (b.hasAttribute("data-month")) { shown.m = +b.getAttribute("data-month"); view = "days"; render(); return; }
    if (b.hasAttribute("data-year")) { shown.y = +b.getAttribute("data-year"); view = "months"; render(); return; }

    if (act === "prev" || act === "next") {
      var dir = act === "next" ? 1 : -1;
      if (view === "days") { shown.m += dir; if (shown.m < 0) { shown.m = 11; shown.y--; } if (shown.m > 11) { shown.m = 0; shown.y++; } }
      else if (view === "months") shown.y += dir;
      else shown.y += dir * 12;
      render();
    } else if (act === "up") {
      view = view === "days" ? "months" : "years";
      render();
    } else if (act === "today") {
      var t = today(); pick(ymd(t.y, t.m, t.d));
    } else if (act === "clear") {
      pick("");
    }
  }

  function pick(str) {
    if (!input) return;
    var el = input;
    if (el.value !== str) {
      el.value = str;
      el.dispatchEvent(new Event("input", { bubbles: true }));
      el.dispatchEvent(new Event("change", { bubbles: true }));
    }
    close();
    try { el.focus({ preventScroll: true }); } catch (err) { /* ignore */ }
  }

  function place() {
    if (!pop || pop.hidden || !input) return;
    if (!input.isConnected) { close(); return; }
    var r = input.getBoundingClientRect(), w = pop.offsetWidth, h = pop.offsetHeight;
    var vw = document.documentElement.clientWidth, vh = document.documentElement.clientHeight;
    // the field the person sees is usually its wrapper (e.g. the booking date range), not the bare input
    var host = input.closest(".bk-date-range, .modal-input-field, .form-control") || input;
    var hr = host.getBoundingClientRect();
    r = hr.width >= r.width ? hr : r;
    var left = Math.min(Math.max(8, r.left), Math.max(8, vw - w - 8));
    var top = r.bottom + 8;
    if (top + h > vh - 8 && r.top - h - 8 >= 8) top = r.top - h - 8;     // not enough room below: open above
    top = Math.max(8, Math.min(top, vh - h - 8));
    pop.style.left = left + "px";
    pop.style.top = top + "px";
  }
  function schedulePlace() {
    if (rafId) return;
    rafId = requestAnimationFrame(function () { rafId = 0; place(); });
  }

  function open(el) {
    if (!el || el.disabled || el.readOnly || el.hasAttribute("data-native-date")) return;
    if (!pop) build();
    if (input === el && !pop.hidden) return;
    input = el;
    mode = el.type === "time" ? "time" : "date";
    if (mode === "time") {
      render();
      pop.hidden = false;
      place();
      scrollTimes();
      return;
    }
    var sel = parse(el.value), t = today(), l = limits();
    var base = sel || (l.min && parse(l.min) && l.min > ymd(t.y, t.m, t.d) ? parse(l.min) : t);
    shown = { y: base.y, m: base.m };
    view = "days";
    render();
    pop.hidden = false;
    place();
  }

  function close() {
    if (pop) pop.hidden = true;
    input = null;
  }

  /* ---------- wiring (document level, so inputs created later work too) ---------- */
  function isDate(el) { return el && el.tagName === "INPUT" && (el.type === "date" || el.type === "time") && !el.hasAttribute("data-native-date"); }

  // Click on the field (or its calendar icon): stop the browser's own popup, open ours.
  document.addEventListener("click", function (e) {
    var el = e.target;
    if (!isDate(el)) return;
    e.preventDefault();
    if (input === el && pop && !pop.hidden) { close(); return; }
    open(el);
  }, true);

  // Click anywhere else closes it.
  document.addEventListener("mousedown", function (e) {
    if (!pop || pop.hidden) return;
    if (pop.contains(e.target) || e.target === input) return;
    close();
  }, true);

  document.addEventListener("keydown", function (e) {
    var el = e.target;
    if (pop && !pop.hidden && (e.key === "Escape" || e.key === "Tab")) {
      var stay = e.key === "Escape";
      close();
      if (stay) { e.stopPropagation(); e.preventDefault(); }   // Esc closes the popup only, not the modal behind it
      return;
    }
    if (isDate(el) && (e.key === " " || e.code === "Space" || e.key === "F4" || (e.altKey && e.key === "ArrowDown"))) {
      e.preventDefault();                                   // stops the browser's own calendar
      if (input === el && pop && !pop.hidden) close();      // Space again closes ours
      else open(el);
    }
  }, true);

  // Typing in the field while the popup is open: keep the popup on the same date.
  document.addEventListener("input", function (e) {
    if (e.target !== input || !pop || pop.hidden) return;
    if (mode === "time") { render(); scrollTimes(); return; }
    var s = parse(input.value);
    if (s) { shown = { y: s.y, m: s.m }; }
    render();
  });

  window.addEventListener("resize", schedulePlace);
  window.addEventListener("scroll", schedulePlace, true);

  window.crmDatePicker = { open: open, close: close };
})();