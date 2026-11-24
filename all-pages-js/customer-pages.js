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

/**
 * New Catering Inquiry 4-step wizard.
 * Loaded once by the app shell after pages.js; the form markup lives in
 * customer-inquiries.html and stays HTML-first.
 *
 * Opens from a [data-iw-open] trigger or the crm:add-inquiry event.
 * After validation, posts the form's FormData to
 * customer-inquiries-api.php?action=create.
 */
(function () {
  "use strict";
  if (window.__crmInquiryWizardLoaded) return;
  window.__crmInquiryWizardLoaded = true;

  var IW_API = "customer-inquiries-api.php"; // update this path when the backend endpoint is added
  var MENU_API = "menu-management.php";      // the menu Admin / Manager maintain (Menu Management)
  var MODAL_ID = "inquiryWizardModal";
  var TITLES = ["Menu & Dishes", "Event Details", "Additional Info", "Review & Submit"];
  var TOTAL = TITLES.length;

  /* ---------- date and response helpers ---------- */
  function todayISO() {
    var d = new Date();
    var m = String(d.getMonth() + 1).padStart(2, "0");
    var day = String(d.getDate()).padStart(2, "0");
    return d.getFullYear() + "-" + m + "-" + day;
  }

  /* Earliest event date a customer can pick: today + 3 days (keep MIN_EVENT_LEAD_DAYS equal to CUSTOMER_MIN_DAYS_BEFORE_EVENT in booking-deadlines.php). */
  var MIN_EVENT_LEAD_DAYS = 3;
  /* 9:00 PM submission cutoff (keep equal to CUSTOMER_SUBMIT_CUTOFF_HOUR in booking-deadlines.php): from 9:00 PM the 3-day date is closed,
     because Sales Staff would have under 2 hours (they close at 11:00 PM) to prepare and send the quotation. The earliest date becomes 4 days away. */
  var SUBMIT_CUTOFF_HOUR = 21;
  function afterSubmitCutoff() { return new Date().getHours() >= SUBMIT_CUTOFF_HOUR; }
  function minEventLeadDays() { return MIN_EVENT_LEAD_DAYS + (afterSubmitCutoff() ? 1 : 0); }
  function minEventISO() {
    var d = new Date();
    d.setDate(d.getDate() + minEventLeadDays());
    var m = String(d.getMonth() + 1).padStart(2, "0");
    var day = String(d.getDate()).padStart(2, "0");
    return d.getFullYear() + "-" + m + "-" + day;
  }

  /* Pickup / Delivery / Event time: 8:00 AM - 8:00 PM (keep equal to EVENT_TIME_MIN / EVENT_TIME_MAX in inquiry-common.php). */
  var EVENT_TIME_MIN = "08:00", EVENT_TIME_MAX = "20:00";
  function earliestDateMessage() {
    return afterSubmitCutoff()
      ? "Inquiries sent at or after 9:00 PM need an event date at least " + minEventLeadDays() + " days from today (earliest: " + longDate(minEventISO()) + ")."
      : "Please choose a date at least " + MIN_EVENT_LEAD_DAYS + " days from today (earliest: " + longDate(minEventISO()) + ").";
  }
  function time12(hhmm) {
    var m = /^(\d{1,2}):(\d{2})/.exec(String(hhmm || ""));
    if (!m) return "";
    var h = Number(m[1]);
    return (h % 12 || 12) + ":" + m[2] + " " + (h >= 12 ? "PM" : "AM");
  }
  function timeLabelFor(arrangement) {
    if (/pick/i.test(arrangement)) return "Pickup time";
    if (/deliver/i.test(arrangement)) return "Delivery time";
    return "Event time";
  }

  function longDate(iso) {
    var m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(iso || ""));
    if (!m) return "\u2014";
    var d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
    return d.toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });
  }

  function readJson(response) {
    return response.text().then(function (text) {
      var json;
      try {
        json = text ? JSON.parse(text) : {};
      } catch (error) {
        var message = response.ok
          ? "The inquiry service returned an invalid response."
          : "Unable to reach the inquiry service (HTTP " + response.status + ").";
        throw new Error(message);
      }
      return { ok: response.ok, json: json };
    });
  }
  /* ---------- one wizard ---------- */
  function init(modal) {
    if (!modal || modal.getAttribute("data-iw-ready") === "1") return;

    // a stale copy from an earlier page visit: remove it so the ID stays unique
    Array.prototype.slice.call(document.querySelectorAll("#" + MODAL_ID)).forEach(function (old) {
      if (old === modal || old.parentNode !== document.body) return;
      var inst = window.bootstrap && window.bootstrap.Modal.getInstance(old);
      if (inst) inst.dispose();
      if (old.classList.contains("show")) {
        document.querySelectorAll(".modal-backdrop").forEach(function (b) { b.remove(); });
        document.body.classList.remove("modal-open");
        document.body.style.removeProperty("overflow");
        document.body.style.removeProperty("padding-right");
      }
      old.remove();
    });

    modal.setAttribute("data-iw-ready", "1");
    if (modal.parentNode !== document.body) document.body.appendChild(modal);

    var $ = function (id) { return modal.querySelector("#" + id); };
    var form = $("iwForm");
    var els = {
      title: $("iwTitle"),
      body: $("iwBody"),
      back: $("iwBack"),
      next: $("iwNext"),
      close: $("iwClose"),
      count: $("iwCount"),
      selectedItems: $("iwSelectedItems"),
      subtotal: $("iwSubtotal"),
      footerEstimate: $("iwFooterEstimate"),
      notes: $("iwNotes"),
      notesCount: $("iwNotesCount"),
      submitError: $("iwSubmitError"),
      discardModal: document.getElementById("discardInquiryChangesModal"),
      confirmKeep: document.getElementById("iwConfirmKeep"),
      confirmDiscard: document.getElementById("iwConfirmDiscard"),
      nodes: Array.prototype.slice.call(modal.querySelectorAll("[data-iw-node]")),
      panels: Array.prototype.slice.call(modal.querySelectorAll("[data-iw-step]"))
    };

    var state = { step: 1, dirty: false, busy: false, bs: null };
    var pickupLocation = "";
    var pickupLocationLoaded = false;
    var pickupLocationLoading = false;
    var pickupLocationError = "";
    var currentArrangement = null;

    function bsModal() {
      if (!state.bs) {
        if (!window.bootstrap || !window.bootstrap.Modal) {
          console.error("Inquiry form: Bootstrap JS is not loaded.");
          return null;
        }
        state.bs = new window.bootstrap.Modal(modal, { backdrop: "static", keyboard: false });
      }
      return state.bs;
    }

    function loadPickupLocation() {
      if (pickupLocationLoaded || pickupLocationLoading) return;
      pickupLocationLoading = true;
      pickupLocationError = "";
      fetch(IW_API + "?action=pickup_location", {
        method: "GET",
        credentials: "same-origin",
        headers: { Accept: "application/json" },
        cache: "no-store"
      })
        .then(readJson)
        .then(function (res) {
          if (!res.ok || !res.json || !res.json.success) throw new Error((res.json && res.json.message) || "Unable to load the pickup location.");
          pickupLocation = String(res.json.pickup_location || "").trim();
          pickupLocationLoaded = true;
        })
        .catch(function (error) {
          pickupLocationError = "Unable to load the pickup location. Please try again before submitting a pickup inquiry.";
          console.error("Inquiry pickup location failed:", error);
        })
        .finally(function () {
          pickupLocationLoading = false;
          syncArrangementFields(false);
        });
    }

    /* --- field + error helpers --- */
    function setError(inputId, errId, message) {
      // a custom dropdown keeps its value in a hidden input; the visible control is "<id>Toggle"
      var input = inputId ? ($(inputId + "Toggle") || $(inputId)) : null;
      var err = $(errId);
      if (err) {
        err.textContent = message || "";
        err.hidden = !message;
      }
      if (input) {
        if (message) {
          input.setAttribute("aria-invalid", "true");
          if (err) input.setAttribute("aria-describedby", errId);
        } else {
          input.removeAttribute("aria-invalid");
          input.removeAttribute("aria-describedby");
        }
        if (input.classList.contains("custom-dropdown-toggle")) {
          input.classList.toggle("dd-invalid", Boolean(message));
          if (err) input.setAttribute("aria-describedby", errId);
        }
      }
    }

    // "PORK ADOBO - 1/4 KG Portion (P230.00)" when the dish has a tier, otherwise just the dish name
    function dishLabel(input) {
      var wrap = input.closest ? input.closest(".iw-dish-wrap") : null;
      var tier = wrap ? wrap.querySelector(".iw-tier-opt input:checked") : null;
      var q = dishQty(wrap);
      if (!tier) {
        var item = wrap && wrap.__menuItem;
        if (item && item.category === "Bilao") {
          // This format is parsed by the existing inquiry API as a fixed-price item with a quantity.
          return input.value + " -  (" + peso(itemPrice(item)) + ") x" + q;
        }
        return input.value;
      }
      return input.value + " - " + tier.value + " (" + peso(tier.getAttribute("data-tier-price")) + ")" + (q > 1 ? " x" + q : "");
    }

    // how many of this dish the customer wants (the + / - stepper under the tiers); 1 when there is none
    function dishQty(wrap) {
      var qv = wrap ? wrap.querySelector(".iw-qty-val") : null;
      var n = qv ? parseInt(qv.value, 10) : 1;
      return n > 0 ? n : 1;
    }

    /* How many guests the ticked dishes can feed: each dish's chosen size says "20-25 PAX" -> its top number.
       Every dish is served to all guests, so the SMALLEST dish is the limit. 0 = unknown (no dish with a PAX size). */
    var paxWarnedKey = "";
    function menuCapacity() {
      var cap = 0;
      Array.prototype.slice.call(form.querySelectorAll(".iw-dish-wrap")).forEach(function (w) {
        if (!w.querySelector(".iw-dish-checkbox:checked")) return;
        var t = w.querySelector(".iw-tier-opt input:checked");
        var nums = t ? String(t.getAttribute("data-tier-pax") || "").match(/\d+/g) : null;
        if (!nums) return;
        var top = Math.max.apply(null, nums.map(Number));
        top = top * dishQty(w);   // 2 x a 25 PAX tray feeds 50
        if (top > 0 && (cap === 0 || top < cap)) cap = top;
      });
      return cap;
    }

    function checkedDishes() {
      return Array.prototype.slice.call(form.querySelectorAll('input[name="dishes"]:checked'))
        .map(dishLabel);
    }

    // ticked dishes that have PAX / portion tiers but no tier chosen yet
    function dishesMissingTier() {
      return Array.prototype.slice.call(form.querySelectorAll(".iw-dish-wrap")).filter(function (w) {
        return w.querySelector(".iw-dish-checkbox:checked") && w.querySelector(".iw-tier-opt") && !w.querySelector(".iw-tier-opt input:checked");
      });
    }

    function checkedPackage() { return ""; }

    /* --- menu (loaded from menu-management.php, grouped by category) --- */
    var MENU_ORDER = ["Lechon", "Bilao", "Viands"];
    var menuLoaded = false, menuLoading = false;
    var activeMenuCategory = "All Menu";

    function el(tag, cls, text) {
      var n = document.createElement(tag);
      if (cls) n.className = cls;
      if (text !== undefined && text !== null) n.textContent = text;
      return n;
    }

    function peso(n) {
      return "\u20B1" + Number(n || 0).toLocaleString("en-PH", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    }

    function itemPrice(item) {
      var match = String(item && item.price || "").replace(/,/g, "").match(/\d+(?:\.\d+)?/);
      return match ? Number(match[0]) : 0;
    }

    function pesoDisplay(n) {
      return "\u20B1" + Number(n || 0).toLocaleString("en-PH", { maximumFractionDigits: 2 });
    }

    function menuMessage(text, retry) {
      var box = $("iwMenu");
      box.textContent = "";
      var p = el("p", "iw-menu-state", text);
      box.appendChild(p);
      if (retry) {
        var b = el("button", "iw-menu-retry", "Try again");
        b.type = "button";
        b.addEventListener("click", function () { loadMenu(true); });
        box.appendChild(b);
      }
    }

    // Tier radios keep the existing API's tier names/prices while the quantity input stays in the form across steps.
    function buildTierPicker(it, checkbox) {
      var box = el("div", "iw-serving-config");
      box.setAttribute("role", "radiogroup");
      box.setAttribute("aria-label", (it.category === "Lechon" ? "Kilogram size" : "Serving tier") + " for " + it.name);
      box.appendChild(el("p", "iw-serving-label", it.category === "Lechon" ? "Choose kilogram size" : "Choose serving capacity"));
      var options = el("div", "iw-tier-options");
      (it.tiers || []).forEach(function (t, index) {
        var opt = el("label", "iw-tier-opt");
        var radio = document.createElement("input");
        radio.type = "radio"; radio.name = "tier_" + it.id; radio.value = t.name;
        radio.setAttribute("data-tier-price", t.price);
        radio.setAttribute("data-tier-pax", t.pax || "");
        radio.addEventListener("change", function () { if (radio.checked) checkbox.checked = true; });
        var main = el("span", "iw-tier-main");
        main.appendChild(el("b", "", t.name));
        if (t.pax && String(t.pax).toLowerCase() !== String(t.name).toLowerCase()) main.appendChild(el("span", "", t.pax));
        opt.appendChild(radio); opt.appendChild(main);
        opt.appendChild(el("span", "iw-tier-price", pesoDisplay(t.price)));
        options.appendChild(opt);
      });
      box.appendChild(options);
      var err = el("p", "iw-tier-err", "Choose a serving size for " + it.name + ".");
      err.hidden = true; err.setAttribute("role", "alert");
      box.appendChild(err);
      return box;
    }

    function buildQuantityControl(it) {
      var box = el("div", "iw-quantity-control");
      box.appendChild(el("span", "iw-quantity-label", "Quantity"));
      var stepper = el("div", "iw-qty-stepper");
      var minus = el("button", "iw-qty-btn", "−");
      minus.type = "button"; minus.setAttribute("aria-label", "Decrease quantity for " + it.name);
      var qv = document.createElement("input");
      qv.type = "number"; qv.className = "iw-qty-val"; qv.min = "1"; qv.max = "20"; qv.value = "1";
      qv.name = "qty_" + it.id; qv.setAttribute("aria-label", "Quantity for " + it.name);
      var plus = el("button", "iw-qty-btn", "+");
      plus.type = "button"; plus.setAttribute("aria-label", "Increase quantity for " + it.name);
      function refreshQuantity() {
        var count = parseInt(qv.value, 10);
        if (!(count >= 1)) count = 1;
        if (count > 20) count = 20;
        qv.value = String(count);
        state.dirty = true;
        if (typeof updateCount === "function") updateCount();
      }
      minus.addEventListener("click", function () { qv.value = String((parseInt(qv.value, 10) || 1) - 1); refreshQuantity(); });
      plus.addEventListener("click", function () { qv.value = String((parseInt(qv.value, 10) || 1) + 1); refreshQuantity(); });
      qv.addEventListener("input", refreshQuantity);
      qv.addEventListener("change", refreshQuantity);
      stepper.appendChild(minus); stepper.appendChild(qv); stepper.appendChild(plus);
      box.appendChild(stepper);
      return box;
    }

    function renderMenu(items) {
      var box = $("iwMenu");
      box.textContent = "";
      if (!items.length) { menuMessage("The menu is empty right now. Please check back soon."); return; }
      var categoryOrder = MENU_ORDER.slice();
      items.slice().sort(function (a, b) {
        var ai = categoryOrder.indexOf(a.category), bi = categoryOrder.indexOf(b.category);
        return (ai === -1 ? 99 : ai) - (bi === -1 ? 99 : bi);
      }).forEach(function (it) {
        var wrap = el("article", "iw-dish-wrap");
        wrap.setAttribute("data-category", it.category || "");
        wrap.__menuItem = it;

        var input = document.createElement("input");
        input.type = "checkbox"; input.className = "iw-dish-checkbox"; input.name = "dishes"; input.value = it.name;
        input.id = "iwDish" + it.id;
        input.setAttribute("data-id", it.id); input.setAttribute("data-category", it.category);

        var media = el("label", "iw-dish-media");
        media.htmlFor = input.id;
        var ph = el("i", "bi bi-image iw-dish-ph"); ph.setAttribute("aria-hidden", "true");
        media.appendChild(ph);
        if (it.photo) {
          var img = el("img", "iw-dish-img");
          img.src = it.photo; img.alt = ""; img.loading = "lazy"; img.decoding = "async";
          media.appendChild(img);
        } else media.classList.add("is-missing");

        var details = el("div", "iw-dish-details");
        var titleLine = el("div", "iw-dish-title-line");
        var name = el("label", "iw-dish-name", it.name);
        name.htmlFor = input.id;
        titleLine.appendChild(name);
        if (it.category === "Bilao") titleLine.appendChild(el("span", "iw-category-pill", "Bilao"));
        details.appendChild(titleLine);

        if (it.category === "Bilao") {
          details.appendChild(el("strong", "iw-dish-fixed-price", pesoDisplay(itemPrice(it))));
          if (it.specs) details.appendChild(el("p", "iw-dish-specs", it.specs));
        } else if (it.tiers && it.tiers.length) {
          details.appendChild(buildTierPicker(it, input));
        }

        wrap.appendChild(input);
        wrap.appendChild(media);
        wrap.appendChild(details);
        wrap.appendChild(buildQuantityControl(it));
        box.appendChild(wrap);
      });
      applyMenuCategory();
    }

    function applyMenuCategory() {
      Array.prototype.slice.call(form.querySelectorAll(".iw-dish-wrap")).forEach(function (item) {
        item.hidden = activeMenuCategory !== "All Menu" && item.getAttribute("data-category") !== activeMenuCategory;
      });
      modal.querySelectorAll("[data-iw-category]").forEach(function (button) {
        var active = button.getAttribute("data-iw-category") === activeMenuCategory;
        button.classList.toggle("is-active", active);
        button.setAttribute("aria-pressed", active ? "true" : "false");
      });
    }

    function clearItemTier(input) {
      var wrap = input && input.closest(".iw-dish-wrap");
      if (wrap) wrap.querySelectorAll(".iw-tier-opt input:checked").forEach(function (tier) { tier.checked = false; });
    }

    function loadMenu(force) {
      if (menuLoading || (menuLoaded && !force)) return;
      menuLoading = true;
      menuMessage("Loading menu...");
      fetch(MENU_API + "?action=list", { credentials: "same-origin", headers: { Accept: "application/json" }, cache: "no-store" })
        .then(readJson)
        .then(function (res) {
          if (!res.ok || !res.json || !res.json.success) throw new Error((res.json && res.json.message) || "Unable to load the menu.");
          renderMenu(Array.isArray(res.json.items) ? res.json.items : []);
          menuLoaded = true;
          updateCount();
        })
        .catch(function (error) {
          console.error("Menu load failed:", error);
          menuMessage("We could not load the menu right now.", true);
        })
        .then(function () { menuLoading = false; });
    }

    function selectedMenuLines() {
      return Array.prototype.slice.call(form.querySelectorAll(".iw-dish-checkbox:checked"))
        .map(function (input) {
          var wrap = input.closest(".iw-dish-wrap");
          var item = wrap && wrap.__menuItem;
          if (!item) return null;
          var tier = wrap.querySelector(".iw-tier-opt input:checked");
          var quantity = dishQty(wrap);
          var unitPrice = tier ? Number(tier.getAttribute("data-tier-price") || 0) : itemPrice(item);
          var serving = tier ? String(tier.value || "").trim() : String(item.specs || item.category || "").trim();
          var pax = tier ? String(tier.getAttribute("data-tier-pax") || "").trim() : "";
          if (pax && pax.toLowerCase() !== serving.toLowerCase()) serving += " (" + pax + ")";
          return {
            input: input,
            item: item,
            tier: tier,
            quantity: quantity,
            unitPrice: unitPrice,
            subtotal: unitPrice * quantity,
            serving: serving
          };
        })
        .filter(function (line) { return Boolean(line); });
    }

    function updateCount() {
      var selected = Array.prototype.slice.call(form.querySelectorAll(".iw-dish-checkbox:checked"));
      var lines = selectedMenuLines();
      var subtotal = 0;
      if (els.count) {
        els.count.textContent = String(selected.length);
        els.count.setAttribute("aria-label", selected.length + " selected items");
      }
      if (els.selectedItems) els.selectedItems.textContent = "";
      lines.forEach(function (line) {
        var input = line.input;
        var wrap = input.closest(".iw-dish-wrap");
        var item = line.item;
        var tier = line.tier;
        var quantity = line.quantity;
        var unitPrice = line.unitPrice;
        subtotal += line.subtotal;

        var row = el("li", "iw-selected-row");
        var media = el("span", "iw-selected-media");
        if (item.photo) {
          var image = el("img", "iw-selected-image");
          image.src = item.photo; image.alt = ""; image.loading = "lazy"; image.decoding = "async";
          media.appendChild(image);
        } else media.appendChild(el("i", "bi bi-image", ""));
        var copy = el("span", "iw-selected-copy");
        copy.appendChild(el("strong", "iw-selected-name", item.name));
        var choice = tier ? tier.value : item.category;
        copy.appendChild(el("span", "iw-selected-detail", choice + " • " + pesoDisplay(unitPrice)));
        var quantityBadge = el("span", "iw-selected-quantity", "× " + quantity);
        var remove = el("button", "iw-remove-selected", "");
        remove.type = "button"; remove.setAttribute("aria-label", "Remove " + item.name);
        remove.setAttribute("data-iw-remove", input.id);
        remove.appendChild(el("i", "bi bi-trash", ""));
        row.appendChild(media); row.appendChild(copy); row.appendChild(quantityBadge); row.appendChild(remove);
        if (els.selectedItems) els.selectedItems.appendChild(row);
      });
      if (els.subtotal) els.subtotal.textContent = pesoDisplay(subtotal);
      if (selected.length > 0) setError(null, "iwErrDishes", "");
    }

    function updateNotesCount() {
      els.notesCount.textContent = els.notes.value.length + "/300 characters";
    }

    /* --- validation (returns true when the step is OK) --- */
    function validate(step) {
      var firstBad = null;
      function bad(el) { if (!firstBad) firstBad = el; }
      function requiredText(id, errId, label, max) {
        var control = $(id);
        var value = control.value.trim();
        if (!value) {
          setError(id, errId, "Enter " + label + ".");
          bad(control);
        } else if (value.length > max) {
          setError(id, errId, label + " must be " + max + " characters or fewer.");
          bad(control);
        } else {
          setError(id, errId, "");
        }
      }

      if (step === 1) {
        if (checkedDishes().length === 0) {
          setError(null, "iwErrDishes", menuLoaded ? "Select at least one menu item to continue." : "The menu is not available yet. Please try again.");
          bad(form.querySelector('input[name="dishes"]') || $("iwMenu"));
        } else {
          setError(null, "iwErrDishes", "");
        }

        form.querySelectorAll(".iw-tier-err").forEach(function (e) { e.hidden = true; });
        var pending = dishesMissingTier();
        pending.forEach(function (w) { w.querySelector(".iw-tier-err").hidden = false; });
        if (pending.length) {
          bad(pending[0].querySelector(".iw-tier-opt input"));
          if (pending[0].scrollIntoView) pending[0].scrollIntoView({ block: "nearest" });
        }
      }

      if (step === 2) {
        var name = $("iwEventName");
        var date = $("iwEventDate");
        var arr = $("iwArrangement");
        var pickup = isPickup();
        var delivery = isDelivery();
        var onsite = isBuffet();

        if (!name.value.trim()) { setError("iwEventName", "iwErrEventName", "Enter a name for your event."); bad(name); }
        else setError("iwEventName", "iwErrEventName", "");

        if (!date.value) { setError("iwEventDate", "iwErrEventDate", "Choose the event date."); bad(date); }
        else if (date.value < minEventISO()) { setError("iwEventDate", "iwErrEventDate", earliestDateMessage()); bad(date); }
        else setError("iwEventDate", "iwErrEventDate", "");

        if (!arr.value) { setError("iwArrangement", "iwErrArrangement", "Choose a service arrangement."); bad($("iwArrangementToggle")); }
        else setError("iwArrangement", "iwErrArrangement", "");

        if (delivery) {
          [
            ["iwDeliveryAddress", "iwErrDeliveryAddress", "the delivery address", 255],
            ["iwDeliveryBarangay", "iwErrDeliveryBarangay", "the barangay", 100],
            ["iwDeliveryCity", "iwErrDeliveryCity", "the city / municipality", 100],
            ["iwDeliveryProvince", "iwErrDeliveryProvince", "the province", 100]
          ].forEach(function (field) {
            requiredText(field[0], field[1], field[2], field[3]);
          });
          var deliveryTime = $("iwDeliveryTime");
          if (!deliveryTime.value) { setError("iwDeliveryTime", "iwErrDeliveryTime", "Choose your preferred delivery time."); bad(deliveryTime); }
          else if (deliveryTime.value < EVENT_TIME_MIN || deliveryTime.value > EVENT_TIME_MAX) {
            setError("iwDeliveryTime", "iwErrDeliveryTime", "Delivery time must be between 8:00 AM and 8:00 PM."); bad(deliveryTime);
          } else setError("iwDeliveryTime", "iwErrDeliveryTime", "");
        } else if (arr.value) {
          var timeEl = pickup ? $("iwPickupTime") : $("iwEventTime");
          var timeId = pickup ? "iwPickupTime" : "iwEventTime";
          var timeErrorId = pickup ? "iwErrPickupTime" : "iwErrEventTime";
          var timeText = timeLabelFor(arr.value).toLowerCase();
          if (!timeEl.value) { setError(timeId, timeErrorId, "Choose the " + timeText + "."); bad(timeEl); }
          else if (timeEl.value < EVENT_TIME_MIN || timeEl.value > EVENT_TIME_MAX) { setError(timeId, timeErrorId, "The " + timeText + " must be between 8:00 AM and 8:00 PM."); bad(timeEl); }
          else setError(timeId, timeErrorId, "");

          if (pickup) {
            if (pickupLocationError) {
              setError("iwPickupLocation", "iwErrPickupLocation", pickupLocationError);
              bad($("iwPickupLocation"));
            } else if (!pickupLocationLoaded) {
              setError("iwPickupLocation", "iwErrPickupLocation", "Pickup location is still loading. Please try again.");
              bad($("iwPickupLocation"));
            } else if (!pickupLocation) {
              setError("iwPickupLocation", "iwErrPickupLocation", "Pickup location is not configured. Please contact the catering team before submitting.");
              bad($("iwPickupLocation"));
            } else setError("iwPickupLocation", "iwErrPickupLocation", "");
          } else {
            requiredText("iwVenue", "iwErrVenue", "the event venue / address", 255);
            [
              ["iwOnsiteBarangay", "iwErrOnsiteBarangay", "the barangay", 100],
              ["iwOnsiteCity", "iwErrOnsiteCity", "the city / municipality", 100],
              ["iwOnsiteProvince", "iwErrOnsiteProvince", "the province", 100]
            ].forEach(function (field) {
              requiredText(field[0], field[1], field[2], field[3]);
            });
          }
        } else {
          setError("iwEventTime", "iwErrEventTime", "");
          setError("iwPickupTime", "iwErrPickupTime", "");
          setError("iwDeliveryTime", "iwErrDeliveryTime", "");
          setError("iwVenue", "iwErrVenue", "");
          setError("iwPickupLocation", "iwErrPickupLocation", "");
          setError("iwPax", "iwErrPax", "");
          [
            ["iwDeliveryAddress", "iwErrDeliveryAddress"],
            ["iwDeliveryBarangay", "iwErrDeliveryBarangay"],
            ["iwDeliveryCity", "iwErrDeliveryCity"],
            ["iwDeliveryProvince", "iwErrDeliveryProvince"],
            ["iwOnsiteBarangay", "iwErrOnsiteBarangay"],
            ["iwOnsiteCity", "iwErrOnsiteCity"],
            ["iwOnsiteProvince", "iwErrOnsiteProvince"]
          ].forEach(function (field) {
            setError(field[0], field[1], "");
          });
        }

        if (onsite) {
          var paxEl = $("iwPax");
          var paxRaw = paxEl.value.trim();
          var paxNum = parseInt(paxRaw, 10);
          if (!/^\d+$/.test(paxRaw) || paxNum < 1 || paxNum > 5000) {
            setError("iwPax", "iwErrPax", "Enter how many guests (pax) the buffet is for.");
            bad(paxEl);
          } else {
            setError("iwPax", "iwErrPax", "");
            var cap = menuCapacity();
            var key = paxNum + "/" + cap;
            if (cap && paxNum > cap && paxWarnedKey !== key) {
              paxWarnedKey = key;   // warn once; pressing Continue again sends it as is
              setError("iwPax", "iwErrPax", "Your selected food is good for up to " + cap + " PAX, but you entered " + paxNum + " guests. Go back to choose a bigger size or add more dishes, or press Continue again to send it as is. Our team will adjust it in your quotation.");
              bad(paxEl);
            }
          }
        }
      }

      if (firstBad) {
        firstBad.focus();
        return false;
      }
      return true;
    }

    /* --- Service-arrangement fields: all values stay inactive until an arrangement is selected. --- */
    function isPickup() {
      return /pick/i.test($("iwArrangement").value);
    }
    function isDelivery() {
      return /deliver/i.test($("iwArrangement").value);
    }
    function isBuffet() {
      return /buffet/i.test($("iwArrangement").value);
    }

    var paxField = null;
    (function buildBuffetFields() {
      var venue = $("iwVenue");
      var venueErr = $("iwErrVenue");
      var venueField = venue.closest(".iw-field") || venue.parentElement;
      var venueLabel = venueField.querySelector("label");
      var onsiteGrid = $("iwOnsiteGrid");

      function makeField(id, errId, labelText, control) {
        var wrap = document.createElement("div");
        wrap.className = venueField.className;
        wrap.hidden = true;
        var label = document.createElement("label");
        if (venueLabel) label.className = venueLabel.className;
        label.htmlFor = id;
        label.textContent = labelText;
        control.id = id;
        control.className = venue.className;
        var err = document.createElement(venueErr ? venueErr.tagName.toLowerCase() : "div");
        if (venueErr) err.className = venueErr.className;
        err.id = errId;
        err.hidden = true;
        wrap.appendChild(label);
        wrap.appendChild(control);
        wrap.appendChild(err);
        return wrap;
      }

      var pax = document.createElement("input");
      pax.type = "number";
      pax.name = "pax";
      pax.min = "1";
      pax.max = "5000";
      pax.step = "1";
      pax.inputMode = "numeric";
      pax.placeholder = "e.g. 50";

      paxField = makeField("iwPax", "iwErrPax", "Number of guests (pax)", pax);
      paxField.classList.remove("iw-service-full-field");
      var paxLabel = paxField.querySelector("label");
      paxLabel.textContent = "Number of guests (pax) ";
      var required = document.createElement("span");
      required.className = "iw-required";
      required.setAttribute("aria-hidden", "true");
      required.textContent = "*";
      paxLabel.appendChild(required);
      onsiteGrid.insertBefore(paxField, $("iwSetupNotesField"));
    })();

    /* A date the customer may submit is still checked against minEventISO in Step 2 validation. */
    /* The earliest selectable date (greys out earlier days in the calendar) and its hint. */
    function refreshEventDateLimits() {
      var d = $("iwEventDate");
      d.min = minEventISO();
      d.title = "Events can be booked at least " + minEventLeadDays() + " days ahead (earliest: " + longDate(minEventISO()) + ")"
        + (afterSubmitCutoff() ? ". Inquiries sent at or after 9:00 PM start one day later." : ". After 9:00 PM the earliest date moves one day later.");
      // visible guide under the date field: what the grey days mean and the earliest date you can pick
      var note = $("iwDateRule");
      if (!note) {
        note = document.createElement("p");
        note.id = "iwDateRule";
        note.className = "iw-callout-text";
        var errEl = $("iwErrEventDate");
        if (errEl && errEl.parentNode) errEl.parentNode.insertBefore(note, errEl);
        else d.insertAdjacentElement("afterend", note);
      }
      note.textContent = "Earliest available date: " + longDate(minEventISO()) + ". We need at least " + MIN_EVENT_LEAD_DAYS
        + " days to prepare your quotation, so earlier dates are greyed out in the calendar."
        + (afterSubmitCutoff() ? " It is after 9:00 PM, so the earliest date moved one day later." : " After 9:00 PM the earliest date moves one day later.");
    }
    function syncTimeLabel() {
      $("iwEventTime").title = "Event time (between 8:00 AM and 8:00 PM)";
      $("iwEventTime").setAttribute("data-time-label", "Event time");
      $("iwPickupTime").title = "Pickup time (between 8:00 AM and 8:00 PM)";
      $("iwPickupTime").setAttribute("data-time-label", "Pickup time");
      $("iwDeliveryTime").title = "Preferred delivery time (between 8:00 AM and 8:00 PM)";
      $("iwDeliveryTime").setAttribute("data-time-label", "Preferred delivery time");
    }

    function syncArrangementFields(clearPreviousValues) {
      var arrangement = $("iwArrangement").value;
      var selected = Boolean(arrangement);
      var pickup = isPickup();
      var delivery = isDelivery();
      var onsite = isBuffet();
      var venue = $("iwVenue");
      var venueField = $("iwVenueField");
      var eventTime = $("iwEventTime");
      var pickupTime = $("iwPickupTime");
      var notice = $("iwPickupLocationNotice");
      var changed = currentArrangement !== null && arrangement !== currentArrangement;

      if ((clearPreviousValues && changed) || (!selected && currentArrangement !== "")) {
        venue.value = "";
        eventTime.value = "";
        pickupTime.value = "";
        $("iwPax").value = "";
        setError("iwVenue", "iwErrVenue", "");
        setError("iwEventTime", "iwErrEventTime", "");
        setError("iwPickupTime", "iwErrPickupTime", "");
        setError("iwPickupLocation", "iwErrPickupLocation", "");
        [
          "iwPickupNotes", "iwDeliveryAddress", "iwDeliveryBarangay", "iwDeliveryCity", "iwDeliveryProvince",
          "iwDeliveryLandmark", "iwDeliveryInstructions", "iwDeliveryTime", "iwOnsiteBarangay",
          "iwOnsiteCity", "iwOnsiteProvince", "iwOnsiteLandmark", "iwSetupNotes"
        ].forEach(function (id) {
          $(id).value = "";
          setError(id, "iwErr" + id.slice(2), "");
        });
        setError("iwPax", "iwErrPax", "");
      }
      currentArrangement = arrangement;

      $("iwArrangementFields").hidden = !selected;
      $("iwPickupSection").hidden = !pickup;
      $("iwDeliverySection").hidden = !delivery;
      $("iwOnsiteSection").hidden = !onsite;
      venueField.hidden = !onsite;
      venue.disabled = !onsite;
      venue.required = onsite;
      pickupTime.disabled = !pickup;
      pickupTime.required = pickup;
      $("iwPickupNotes").disabled = !pickup;
      ["iwDeliveryAddress", "iwDeliveryBarangay", "iwDeliveryCity", "iwDeliveryProvince", "iwDeliveryLandmark", "iwDeliveryInstructions"].forEach(function (id) {
        var control = $(id);
        control.disabled = !delivery;
        control.required = delivery && ["iwDeliveryAddress", "iwDeliveryBarangay", "iwDeliveryCity", "iwDeliveryProvince"].indexOf(id) !== -1;
      });
      $("iwDeliveryTime").disabled = !delivery;
      $("iwDeliveryTime").required = delivery;
      ["iwOnsiteBarangay", "iwOnsiteCity", "iwOnsiteProvince", "iwOnsiteLandmark", "iwSetupNotes"].forEach(function (id) {
        var control = $(id);
        control.disabled = !onsite;
        control.required = onsite && ["iwOnsiteBarangay", "iwOnsiteCity", "iwOnsiteProvince"].indexOf(id) !== -1;
      });
      eventTime.disabled = !onsite;
      eventTime.required = onsite;
      $("iwEventTimeField").hidden = !onsite;
      $("iwPax").disabled = !onsite;
      $("iwPax").required = onsite;
      paxField.hidden = !onsite;

      $("iwPickupLocation").value = pickupLocationLoaded && pickupLocation ? pickupLocation : "";
      $("iwPickupLocation").placeholder = pickupLocationLoading ? "Loading the business pickup location..." : (pickupLocationError ? "Unable to load the pickup location" : "Pickup location is not configured");
      notice.hidden = pickupLocationLoaded && Boolean(pickupLocation);
      notice.textContent = pickupLocationError
        ? "Unable to load the pickup location. Please try again before submitting a pickup inquiry."
        : pickupLocationLoaded
          ? "Pickup location is not configured. Please contact the catering team before submitting."
          : "Loading the business pickup location...";
      if (pickupLocationLoaded && pickupLocation) {
        setError("iwPickupLocation", "iwErrPickupLocation", "");
        $("iwPickupLocation").setAttribute("aria-describedby", "iwPickupLocationHelp");
      }
      syncTimeLabel();
    }

    /* --- review step --- */
    function collect() {
      var arrangementDetails = isDelivery() ? {
        barangay: $("iwDeliveryBarangay").value.trim(),
        city: $("iwDeliveryCity").value.trim(),
        province: $("iwDeliveryProvince").value.trim(),
        landmark: $("iwDeliveryLandmark").value.trim(),
        instructions: $("iwDeliveryInstructions").value.trim()
      } : isPickup() ? {
        pickup_notes: $("iwPickupNotes").value.trim()
      } : isBuffet() ? {
        barangay: $("iwOnsiteBarangay").value.trim(),
        city: $("iwOnsiteCity").value.trim(),
        province: $("iwOnsiteProvince").value.trim(),
        landmark: $("iwOnsiteLandmark").value.trim(),
        setup_notes: $("iwSetupNotes").value.trim()
      } : null;
      return {
        package: checkedPackage(),
        dishes: checkedDishes(),
        event_name: $("iwEventName").value.trim(),
        event_date: $("iwEventDate").value,
        event_time: isDelivery() ? $("iwDeliveryTime").value : isPickup() ? $("iwPickupTime").value : ($("iwEventTime").disabled ? "" : $("iwEventTime").value),
        venue: isDelivery() ? $("iwDeliveryAddress").value.trim() : isPickup() ? pickupLocation : ($("iwVenue").disabled ? "" : $("iwVenue").value.trim()),
        arrangement: $("iwArrangement").value,
        arrangement_details: arrangementDetails,
        delivery_details: isDelivery() ? arrangementDetails : null,
        pax: isBuffet() ? $("iwPax").value.trim() : "",
        notes: els.notes.value.trim()
      };
    }

    function fillReview() {
      var d = collect();
      $("iwRvEvent").textContent = d.event_name || "\u2014";
      $("iwRvDate").textContent = longDate(d.event_date) || "\u2014";
      $("iwRvService").textContent = isDelivery() ? "Food Delivery" : isPickup() ? "Customer Pickup" : "On-site Catering";

      var arrangementTitle = $("iwRvArrangementTitle");
      var arrangementList = $("iwRvArrangementDetails");
      var details = d.arrangement_details || {};
      var arrangementRows = [];
      if (isPickup()) {
        arrangementTitle.textContent = "Pickup Information";
        arrangementRows = [
          ["Pickup Location", d.venue || "\u2014"],
          ["Pickup Time", d.event_time ? time12(d.event_time) : "\u2014"]
        ];
        if (details.pickup_notes) arrangementRows.push(["Pickup Notes", details.pickup_notes]);
      } else if (isDelivery()) {
        arrangementTitle.textContent = "Delivery Information";
        arrangementRows = [
          ["Delivery Address", d.venue || "\u2014"],
          ["Barangay", details.barangay || "\u2014"],
          ["City / Municipality", details.city || "\u2014"],
          ["Province", details.province || "\u2014"]
        ];
        if (details.landmark) arrangementRows.push(["Nearest Landmark", details.landmark]);
        arrangementRows.push(["Delivery Time", d.event_time ? time12(d.event_time) : "\u2014"]);
        if (details.instructions) arrangementRows.push(["Delivery Instructions", details.instructions]);
      } else {
        arrangementTitle.textContent = "Venue Information";
        arrangementRows = [
          ["Event Venue / Address", d.venue || "\u2014"],
          ["Barangay", details.barangay || "\u2014"],
          ["City / Municipality", details.city || "\u2014"],
          ["Province", details.province || "\u2014"]
        ];
        if (details.landmark) arrangementRows.push(["Nearest Landmark", details.landmark]);
        arrangementRows.push(["Event Time", d.event_time ? time12(d.event_time) : "\u2014"]);
        arrangementRows.push(["Number of Guests (pax)", d.pax || "\u2014"]);
        if (details.setup_notes) arrangementRows.push(["Setup Notes", details.setup_notes]);
      }
      arrangementList.textContent = "";
      arrangementRows.forEach(function (row) {
        var field = el("div", "iw-review-detail");
        if (/address|location|instructions|notes/i.test(row[0])) field.classList.add("iw-review-detail-wide");
        field.appendChild(el("dt", "", row[0]));
        field.appendChild(el("dd", "", row[1]));
        arrangementList.appendChild(field);
      });

      var lines = selectedMenuLines();
      var menuRows = $("iwRvMenuRows");
      var menuSubtotal = lines.reduce(function (sum, line) { return sum + line.subtotal; }, 0);
      menuRows.textContent = "";
      if (!lines.length) {
        var emptyRow = el("tr");
        var emptyCell = el("td", "iw-review-empty", "No menu items selected.");
        emptyCell.colSpan = 4;
        emptyRow.appendChild(emptyCell);
        menuRows.appendChild(emptyRow);
      } else {
        lines.forEach(function (line) {
          var row = el("tr");
          row.appendChild(el("th", "iw-review-item", line.item.name || line.input.value));
          row.lastChild.scope = "row";
          row.appendChild(el("td", "", line.quantity + " \u00D7 " + (line.serving || line.item.category || "Serving")));
          row.appendChild(el("td", "iw-review-money", pesoDisplay(line.unitPrice)));
          row.appendChild(el("td", "iw-review-money", pesoDisplay(line.subtotal)));
          menuRows.appendChild(row);
        });
      }
      $("iwRvMenuSubtotal").textContent = pesoDisplay(menuSubtotal);
      $("iwRvEstimatedTotal").textContent = pesoDisplay(menuSubtotal);
      $("iwRvNotes").textContent = d.notes || "No dietary requests provided.";
    }

    /* --- custom dropdowns (markup is in the HTML; the hidden input holds the value) --- */
    var dropdowns = Array.prototype.slice.call(modal.querySelectorAll(".iw-dropdown")).map(function (root) {
      var input = root.querySelector('input[type="hidden"]');
      return { root: root, input: input, initial: input ? input.value : "" };
    });

    function setDropdown(dd, value, announce) {
      var chosen = null;
      Array.prototype.slice.call(dd.root.querySelectorAll(".custom-dropdown-item")).forEach(function (item) {
        var on = item.getAttribute("data-value") === value;
        item.setAttribute("aria-selected", on ? "true" : "false");
        if (on) chosen = item;
      });
      if (!chosen) return;
      dd.input.value = value;
      dd.root.querySelector(".iw-dd-value").textContent = chosen.textContent.trim();
      // a normal "change" so the error clears and the form is marked as edited
      if (announce) dd.input.dispatchEvent(new Event("change", { bubbles: true }));
    }

    function resetDropdowns() {
      dropdowns.forEach(function (dd) { setDropdown(dd, dd.initial, false); });
    }

    /* --- shared CRM discard confirmation modal --- */
    var discardPromptChoice = "";

    function confirmIsOpen() {
      return Boolean(els.discardModal && els.discardModal.classList.contains("show"));
    }

    function openConfirm() {
      if (!els.discardModal || !window.bootstrap || !window.bootstrap.Modal) return;
      var prompt = window.bootstrap.Modal.getOrCreateInstance(els.discardModal, { backdrop: "static", keyboard: false });
      var main = bsModal();
      if (!main) return;
      var onMainHidden = function () {
        modal.removeEventListener("hidden.bs.modal", onMainHidden);
        if (state.dirty && !state.busy) prompt.show();
      };
      modal.addEventListener("hidden.bs.modal", onMainHidden);
      main.hide();
    }
    /* --- step display --- */
    function renderStepper() {
      els.nodes.forEach(function (li, i) {
        var n = i + 1;
        var done = n < state.step;
        var current = n === state.step;
        li.classList.remove("is-done", "is-current", "is-todo");
        li.classList.add(done ? "is-done" : current ? "is-current" : "is-todo");
        if (current) li.setAttribute("aria-current", "step");
        else li.removeAttribute("aria-current");

        var node = li.querySelector(".iw-node");
        node.innerHTML = done ? '<i class="bi bi-check-lg" aria-hidden="true"></i>' : String(n);

        var hidden = li.querySelector(".visually-hidden");
        if (hidden) hidden.textContent = done ? " (completed)" : current ? " (current step)" : " (upcoming)";
      });
    }

    function renderFooter() {
      els.back.textContent = state.step === 1 ? "Cancel" : "Back";
      els.next.innerHTML = state.step === TOTAL
        ? 'Submit Inquiry'
        : 'Continue <i class="bi bi-arrow-right" aria-hidden="true"></i>';
      if (els.footerEstimate) els.footerEstimate.hidden = state.step !== 1;
    }

    function goTo(n, moveFocus) {
      state.step = Math.max(1, Math.min(TOTAL, n));
      modal.classList.toggle("iw-show-menu-step", state.step === 1);
      els.panels.forEach(function (p) {
        p.hidden = Number(p.getAttribute("data-iw-step")) !== state.step;
      });
      els.title.textContent = TITLES[state.step - 1];
      if (state.step === TOTAL) fillReview();
      renderStepper();
      renderFooter();
      els.body.scrollTop = 0;
      if (moveFocus !== false) els.title.focus();
    }

    /* --- open / close / reset --- */
    function resetForm() {
      form.reset();
      resetDropdowns(); // form.reset() does not touch a hidden input's current value
      syncArrangementFields(false);
      state.dirty = false;
      state.busy = false;
      els.next.disabled = false;
      els.back.disabled = false;
      refreshEventDateLimits();
      [
        "iwEventName", "iwEventDate", "iwEventTime", "iwPickupTime", "iwPickupLocation", "iwPickupNotes", "iwVenue", "iwArrangement",
        "iwDeliveryAddress", "iwDeliveryBarangay", "iwDeliveryCity", "iwDeliveryProvince", "iwDeliveryLandmark", "iwDeliveryInstructions",
        "iwDeliveryTime", "iwOnsiteBarangay", "iwOnsiteCity", "iwOnsiteProvince", "iwOnsiteLandmark", "iwSetupNotes"
      ].forEach(function (id) {
        setError(id, "iwErr" + id.slice(2), "");
      });
      setError(null, "iwErrDishes", "");
      els.submitError.hidden = true;
      els.submitError.textContent = "";
      activeMenuCategory = "All Menu";
      applyMenuCategory();
      updateCount();
      updateNotesCount();
      goTo(1, false);
    }

    function open() {
      var bs = bsModal();
      if (!bs) return;
      resetForm();
      loadPickupLocation();
      loadMenu(false);
      bs.show();
    }

    function requestClose() {
      if (state.busy) return;
      if (state.dirty) {
        if (!confirmIsOpen()) openConfirm();
        return;
      }
      var bs = bsModal();
      if (bs) bs.hide();
    }

    function discard() {
      state.dirty = false;
      resetForm();
    }
    /* --- submit --- */
    function setBusy(on) {
      state.busy = on;
      els.next.disabled = on;
      els.back.disabled = on;
      els.close.disabled = on;
      if (on) els.next.textContent = "Submitting...";
      else renderFooter();
    }

    function finish(data, message) {
      state.dirty = false;
      setBusy(false);
      var bs = bsModal();
      if (bs) bs.hide();
      document.dispatchEvent(new CustomEvent("crm:inquiry-submitted", { detail: Object.assign({}, data, { message: message }) }));
    }

    function showSubmitError(message) {
      els.submitError.textContent = message;
      els.submitError.hidden = false;
      setBusy(false);
    }

    function submit() {
      if (state.busy) return;
      if (!validate(1)) { goTo(1); return; }
      if (!validate(2)) { goTo(2, false); return; }

      var data = collect();
      els.submitError.hidden = true;
      setBusy(true);

      fetch(IW_API + "?action=list", {
        method: "GET",
        credentials: "same-origin",
        headers: { Accept: "application/json" },
        cache: "no-store"
      })
        .then(readJson)
        .then(function (res) {
          if (!res.ok || !res.json || !res.json.success) {
            throw new Error((res.json && res.json.message) || "Unable to prepare your inquiry.");
          }

          var csrf = res.json.csrf_token || "";
          var body = new FormData(form);
          var dishes = checkedDishes();   // includes the chosen tier, e.g. "PORK ADOBO - 1/4 KG Portion (\u20B1230.00)"
          body.delete("dishes");
          dishes.forEach(function (name) { body.append("dishes[]", name); });
          body.set("csrf_token", csrf);
          body.set("package", checkedPackage());
          body.set("event_time", data.event_time);
          body.set("event_location", data.venue);
          Array.prototype.slice.call(form.querySelectorAll('input[name="dishes"]:checked')).forEach(function (i) {
            body.append("menu_item_ids[]", i.getAttribute("data-id") || "");
          });

          return fetch(IW_API + "?action=create", {
            method: "POST",
            credentials: "same-origin",
            headers: { Accept: "application/json", "X-CSRF-Token": csrf },
            body: body
          });
        })
        .then(readJson)
        .then(function (res) {
          if (!res.ok || !res.json || !res.json.success) {
            throw new Error((res.json && res.json.message) || "Unable to submit your inquiry.");
          }
          finish(data, res.json.message || "Inquiry submitted. We will be in touch soon.");
        })
        .catch(function (error) {
          console.error("Inquiry submit failed:", error);
          showSubmitError(error.message || "Unable to submit your inquiry. Please try again.");
        });
    }
    /* --- events --- */
    els.next.addEventListener("click", function () {
      if (state.step < TOTAL) {
        if (validate(state.step)) goTo(state.step + 1);
      } else {
        submit();
      }
    });

    els.back.addEventListener("click", function () {
      if (state.step === 1) requestClose();
      else goTo(state.step - 1);
    });

    els.close.addEventListener("click", requestClose);

    // Reuse the app's shared discard template. Keep preserves the form; discard resets it.
    // Dismissing the prompt in another way returns to the still-edited wizard.
    els.confirmKeep.addEventListener("click", function () { discardPromptChoice = "keep"; });
    els.confirmDiscard.addEventListener("click", function () {
      discardPromptChoice = "discard";
      discard();
    });
    els.discardModal.addEventListener("shown.bs.modal", function () { els.confirmKeep.focus(); });
    els.discardModal.addEventListener("hidden.bs.modal", function () {
      var choice = discardPromptChoice;
      discardPromptChoice = "";
      if (choice === "keep" || choice === "discard") return;
      if (state.dirty && !state.busy) bsModal().show();
    });
    // custom dropdown: choose an option
    modal.addEventListener("click", function (e) {
      var category = e.target.closest ? e.target.closest("[data-iw-category]") : null;
      if (category) {
        activeMenuCategory = category.getAttribute("data-iw-category") || "All Menu";
        applyMenuCategory();
        return;
      }
      var remove = e.target.closest ? e.target.closest("[data-iw-remove]") : null;
      if (remove) {
        var input = $(remove.getAttribute("data-iw-remove"));
        if (input) { input.checked = false; clearItemTier(input); }
        state.dirty = true;
        updateCount();
        return;
      }
      var item = e.target.closest ? e.target.closest(".iw-dropdown .custom-dropdown-item") : null;
      if (!item) return;
      var dd = dropdowns.filter(function (d) { return d.root.contains(item); })[0];
      if (dd) setDropdown(dd, item.getAttribute("data-value"), true);
    });

    // keep the opened list inside the scrolling form body
    modal.addEventListener("shown.bs.dropdown", function (e) {
      var menu = e.target.parentNode && e.target.parentNode.querySelector(".dropdown-menu");
      if (menu && menu.scrollIntoView) menu.scrollIntoView({ block: "nearest" });
    });
    form.addEventListener("submit", function (e) { e.preventDefault(); });

    form.addEventListener("input", function (e) {
      state.dirty = true;
      if (e.target.classList && e.target.classList.contains("iw-qty-val")) updateCount();
    });
    form.addEventListener("change", function (e) {
      state.dirty = true;
      if (e.target.name === "dishes" && !e.target.checked) clearItemTier(e.target);
      if (e.target.name === "dishes" || (e.target.name && e.target.name.indexOf("tier_") === 0)) updateCount();
      if (e.target.closest && e.target.closest(".iw-serving-config")) {
        var te = e.target.closest(".iw-serving-config").querySelector(".iw-tier-err");
        if (te) te.hidden = true;
      }
    });

    els.notes.addEventListener("input", updateNotesCount);

    $("iwArrangement").addEventListener("change", function () { syncArrangementFields(true); });
    syncArrangementFields(false);
    (function wireEventDate() {
      var evDate = $("iwEventDate");
      ["focus", "mousedown"].forEach(function (ev) { evDate.addEventListener(ev, refreshEventDateLimits); });   // 9:00 PM may pass while the form is open
      refreshEventDateLimits();
    })();
    $("iwPax").addEventListener("input", function () { setError("iwPax", "iwErrPax", ""); });

    // clear a field's message as soon as the person edits it
    [
      "iwEventName", "iwEventDate", "iwEventTime", "iwPickupTime", "iwPickupNotes", "iwVenue", "iwArrangement",
      "iwDeliveryAddress", "iwDeliveryBarangay", "iwDeliveryCity", "iwDeliveryProvince", "iwDeliveryLandmark", "iwDeliveryInstructions",
      "iwDeliveryTime", "iwOnsiteBarangay", "iwOnsiteCity", "iwOnsiteProvince", "iwOnsiteLandmark", "iwSetupNotes"
    ].forEach(function (id) {
      var input = $(id);
      input.addEventListener("input", function () { setError(id, "iwErr" + id.slice(2), ""); });
      input.addEventListener("change", function () { setError(id, "iwErr" + id.slice(2), ""); });
    });

    // Enter moves forward (except inside the notes box); Escape asks to close
    modal.addEventListener("keydown", function (e) {
      if (e.key === "Escape") {
        if (confirmIsOpen()) { e.preventDefault(); return; }
        // an open dropdown list closes first (Bootstrap handles that key)
        if (modal.querySelector(".dropdown-menu.show")) return;
        e.preventDefault();
        requestClose();
        return;
      }
      if (e.key === "Enter" && e.target.tagName === "INPUT" && e.target.type !== "checkbox" && e.target.type !== "radio") {
        e.preventDefault();
        els.next.click();
      }
    });

    // a missing dish picture falls back to the grey icon (error events do not bubble, so capture)
    modal.addEventListener("error", function (e) {
      var t = e.target;
      if (t && t.classList && t.classList.contains("iw-dish-img")) {
        var media = t.closest(".iw-dish-media");
        if (media) media.classList.add("is-missing");
      }
    }, true);

    modal.addEventListener("shown.bs.modal", function () { els.title.focus(); });

    modal.addEventListener("hidden.bs.modal", function () {
      var trigger = document.querySelector("[data-iw-open]");
      if (trigger) trigger.focus();
    });

    // Load and draw the menu in the background, before anyone clicks "+ Add Inquiry".
    // Otherwise the list is fetched and drawn WHILE the window is fading in, which is the small lag on the first click.
    modal.__iwWarm = function () { loadMenu(false); };
    if (window.requestIdleCallback) window.requestIdleCallback(modal.__iwWarm, { timeout: 1500 });
    else window.setTimeout(modal.__iwWarm, 400);

    // keep a handle so the open event can find the ready wizard
    modal.__iwOpen = open;
  }

  /* ---------- start / open ---------- */
  function initAll() {
    Array.prototype.slice.call(document.querySelectorAll("#" + MODAL_ID)).forEach(init);
  }

  document.addEventListener("click", function (event) {
    var trigger = event.target && event.target.closest
      ? event.target.closest("[data-iw-open]")
      : null;
    if (!trigger) return;
    event.preventDefault();
    initAll();
    var modals = document.querySelectorAll("#" + MODAL_ID);
    var modal = modals[modals.length - 1];
    if (modal && typeof modal.__iwOpen === "function") modal.__iwOpen();
  });
  // Pointer over (or touching) "+ Add Inquiry": make sure the menu is already loading.
  document.addEventListener("pointerover", function (event) {
    var t = event.target && event.target.closest ? event.target.closest("[data-iw-open]") : null;
    if (!t) return;
    var list = document.querySelectorAll("#" + MODAL_ID);
    var m = list[list.length - 1];
    if (m && typeof m.__iwWarm === "function") m.__iwWarm();
  }, { passive: true });
  document.addEventListener("crm:add-inquiry", function () {
    initAll();
    var list = document.querySelectorAll("#" + MODAL_ID);
    var modal = list[list.length - 1];
    if (modal && typeof modal.__iwOpen === "function") modal.__iwOpen();
  });

  var queued = false;
  function schedule() {
    if (queued) return;
    queued = true;
    requestAnimationFrame(function () {
      queued = false;
      initAll();
    });
  }

  function start() {
    initAll();
    new MutationObserver(schedule).observe(document.body, { childList: true, subtree: true });
  }

  if (document.body) start();
  else document.addEventListener("DOMContentLoaded", start);
})();

/* ---------- Customer Bookings page (API-backed; no sample booking records) ---------- */
(function () {
  "use strict";

  /* My Bookings order: cancelled ones last, the rest start with the earliest event date. */
  function listText(record, keys) {
    for (var i = 0; i < keys.length; i++) {
      var v = record && record[keys[i]];
      if (v !== undefined && v !== null && String(v).trim() !== "") return String(v).trim();
    }
    return "";
  }
  /* Phase of a booking: 0 = upcoming event, 1 = date finished (completed, or the event date has passed), 2 = cancelled. */
  function bookingDay(r) { var m = /^(\d{4}-\d{2}-\d{2})/.exec(listText(r, ["event_date", "date", "event_schedule"])); return m ? m[1] : ""; }
  function todayISO() {
    var d = new Date();
    return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0");
  }
  function bookingPhase(r) {
    var st = listText(r, ["status", "booking_status"]), day = bookingDay(r);
    if (/cancel|declin/i.test(st)) return 2;
    if (/complete/i.test(st) || (day && day < todayISO())) return 1;
    return 0;
  }
  function phaseTag(phase, labels) {
    var tag = document.createElement("span");
    tag.className = "list-phase " + ["is-upcoming", "is-finished", "is-cancelled"][phase];
    tag.textContent = labels[phase];
    return tag;
  }
  function sortBookings(rows) {
    return rows.map(function (r, i) { return { r: r, i: i, k: bookingPhase(r), d: bookingDay(r) || "9999-99-99" }; }).sort(function (a, b) {
      if (a.k !== b.k) return a.k - b.k;
      if (a.d !== b.d) return a.k === 1 ? (a.d < b.d ? 1 : -1) : (a.d < b.d ? -1 : 1);   // finished: most recent first; others: earliest first
      return a.i - b.i;
    }).map(function (x) { return x.r; });
  }
  if (window.__crmBookingPageLoaded) return;
  window.__crmBookingPageLoaded = true;

  var API = "customer-bookings-api.php";
  var STEPS = ["Booking Confirmed", "Deposit Paid", "Fully Paid", "Event Day", "Completed"];
  var RATING_LABELS = ["Select a rating", "Poor", "Fair", "Good", "Very good", "Excellent"];

  function asText(value) {
    if (value === null || value === undefined || value === "") return "";
    if (typeof value === "object") {
      if (value.name !== undefined) return String(value.name);
      if (value.label !== undefined) return String(value.label);
      return "";
    }
    return String(value);
  }

  function first(object, keys) {
    for (var i = 0; object && i < keys.length; i++) {
      var value = object[keys[i]];
      if (value !== null && value !== undefined && value !== "") return value;
    }
    return "";
  }

  function parseResponse(response) {
    return response.text().then(function (body) {
      var json;
      try { json = body ? JSON.parse(body) : {}; }
      catch (error) { throw new Error("The bookings service returned an invalid response."); }
      if (!response.ok || !json || typeof json !== "object" || json.success === false) {
        throw new Error((json && json.message) || "Bookings service unavailable (HTTP " + response.status + ").");
      }
      return json;
    });
  }

  function fetchBookings() {
    var controller = typeof window.AbortController === "function" ? new AbortController() : null;
    var options = {
      method: "GET",
      credentials: "same-origin",
      headers: { Accept: "application/json" },
      cache: "no-store"
    };
    if (controller) options.signal = controller.signal;
    var timer;
    var request = fetch(API + "?action=list", options).then(parseResponse);
    var timeout = new Promise(function (resolve, reject) {
      timer = window.setTimeout(function () {
        if (controller) controller.abort();
        reject(new Error("The bookings service took too long to respond. Please try again."));
      }, 15000);
    });
    return Promise.race([request, timeout]).finally(function () { window.clearTimeout(timer); });
  }

  function init(page) {
    if (!page || page.getAttribute("data-cb-ready") === "1") return;
    var list = page.querySelector("#cbBookingList");
    var listState = page.querySelector("#cbListState");
    var count = page.querySelector("#cbBookingCount");
    var emptyState = page.querySelector("#cbEmptyState");
    var layout = page.querySelector("#cbLayout");
    var title = page.querySelector("#cbBookingTitle");
    var reference = page.querySelector("#cbBookingReference");
    var status = page.querySelector("#cbBookingStatus");
    var stepper = page.querySelector("#cbStepper");
    var form = page.querySelector("#cbFeedbackForm");
    var comments = page.querySelector("#cbComments");
    var commentsCount = page.querySelector("#cbCommentsCount");
    var bookingIdInput = page.querySelector("#cbFeedbackBookingId");
    var ratingInput = page.querySelector("#cbRatingInput");
    var ratingLabel = page.querySelector("#cbRatingLabel");
    var stars = page.querySelector("#cbStars");
    var imageInput = page.querySelector("#cbFeedbackImages");
    var imagePreviews = page.querySelector("#cbFeedbackImagePreviews");
    var imageMessage = page.querySelector("#cbFeedbackImagesMessage");
    var submitButton = page.querySelector("#cbFeedbackSubmit");
    var feedbackMessage = page.querySelector("#cbFeedbackMessage");
    var records = [];
    var selectedImages = [];
    var imagePreviewUrls = [];
    var MAX_FEEDBACK_IMAGES = 4;
    var MAX_FEEDBACK_IMAGE_BYTES = 25 * 1024 * 1024;
    var ALLOWED_FEEDBACK_IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp"];
    if (!list || !listState) return;
    page.setAttribute("data-cb-ready", "1");

    function setText(id, value, fallback) {
      var node = page.querySelector("#" + id);
      if (node) node.textContent = asText(value) || (fallback === undefined ? "—" : fallback);
    }

    function showListMessage(text, retry) {
      while (listState.firstChild) listState.removeChild(listState.firstChild);
      listState.hidden = false;
      listState.appendChild(document.createTextNode(text));
      if (retry) {
        listState.appendChild(document.createElement("br"));
        var button = document.createElement("button");
        button.type = "button";
        button.className = "cb-retry-button";
        button.textContent = "Try again";
        button.addEventListener("click", load);
        listState.appendChild(button);
      }
    }

    function showFeedbackMessage(text, kind) {
      if (!feedbackMessage) return;
      feedbackMessage.textContent = text || "";
      feedbackMessage.classList.toggle("is-success", kind === "success");
      feedbackMessage.classList.toggle("is-error", kind === "error");
    }

    function showImageMessage(text, kind) {
      if (!imageMessage) return;
      imageMessage.textContent = text || "";
      imageMessage.classList.toggle("is-error", kind === "error");
      imageMessage.classList.toggle("is-success", kind === "success");
    }

    function renderImagePreviews() {
      if (!imagePreviews) return;
      imagePreviewUrls.forEach(function (url) { URL.revokeObjectURL(url); });
      imagePreviewUrls = [];
      while (imagePreviews.firstChild) imagePreviews.removeChild(imagePreviews.firstChild);

      selectedImages.forEach(function (file, index) {
        var url = URL.createObjectURL(file);
        imagePreviewUrls.push(url);
        var card = document.createElement("div");
        card.className = "cb-image-preview";
        var image = document.createElement("img");
        image.src = url;
        image.alt = "Preview of " + file.name;
        var name = document.createElement("p");
        name.className = "cb-image-preview-name";
        name.textContent = file.name;
        var remove = document.createElement("button");
        remove.type = "button";
        remove.className = "cb-image-remove";
        remove.textContent = "×";
        remove.setAttribute("aria-label", "Remove " + file.name);
        remove.addEventListener("click", function () {
          selectedImages.splice(index, 1);
          renderImagePreviews();
          showImageMessage(selectedImages.length ? selectedImages.length + " photo(s) selected." : "", selectedImages.length ? "success" : "");
        });
        card.appendChild(image);
        card.appendChild(name);
        card.appendChild(remove);
        imagePreviews.appendChild(card);
      });
    }

    function clearFeedbackImages() {
      selectedImages = [];
      if (imageInput) imageInput.value = "";
      renderImagePreviews();
      showImageMessage("", "");
    }

    function setFeedbackEnabled(enabled) {
      if (comments) comments.disabled = !enabled;
      if (imageInput) imageInput.disabled = !enabled;
      if (stars) stars.querySelectorAll("[data-cb-rating]").forEach(function (button) {
        button.disabled = !enabled;
      });
      if (submitButton) submitButton.disabled = !enabled;
    }

    /* The Feedback tab stays hidden until the booking is Completed (the rating opens after the event). */
    var feedbackPanel = form ? form.closest(".cb-tab-panel") : null;
    var feedbackTab = feedbackPanel && feedbackPanel.id ? page.querySelector('[data-tab-target="#' + feedbackPanel.id + '"]') : null;
    if (!feedbackTab) {
      Array.prototype.forEach.call(page.querySelectorAll("[data-tab-target]"), function (tab) {
        if (!feedbackTab && /feedback/i.test(tab.textContent || "")) feedbackTab = tab;
      });
    }
    function isCompletedBooking(record) {
      return /complete/i.test(asText(first(record || {}, ["status", "booking_status"])));
    }
    function syncFeedbackTab(record) {
      if (!feedbackTab) return;
      var show = !!record && isCompletedBooking(record);
      feedbackTab.hidden = !show;
      feedbackTab.style.display = show ? "" : "none";
      if (!show && feedbackTab.classList.contains("is-active")) {
        var firstTab = page.querySelector("[data-tab-target]");
        if (firstTab && firstTab !== feedbackTab) firstTab.click();
      }
    }
    function openFeedbackTab() {
      if (feedbackTab && !feedbackTab.hidden) feedbackTab.click();
    }

    function feedbackImageError(file) {
      if (!ALLOWED_FEEDBACK_IMAGE_TYPES.includes(file.type)) {
        return "Choose JPG, PNG, or WebP images only.";
      }
      if (file.size > MAX_FEEDBACK_IMAGE_BYTES) {
        return file.name + " is larger than 25 MB.";
      }
      return "";
    }

    function updateRating(value) {
      var rating = Math.max(0, Math.min(5, Number(value) || 0));
      if (ratingInput) ratingInput.value = String(rating);
      if (ratingLabel) {
        ratingLabel.textContent = rating
          ? rating + " of 5 · " + RATING_LABELS[rating]
          : "0 of 5 · Select a rating";
      }
      if (stars) stars.querySelectorAll("[data-cb-rating]").forEach(function (button) {
        var number = Number(button.getAttribute("data-cb-rating"));
        var chosen = number <= rating;
        button.classList.toggle("is-selected", chosen);
        button.setAttribute("aria-pressed", String(number === rating));
        button.textContent = chosen ? "★" : "☆";
      });
    }

    function renderSteps(record) {
      if (!stepper) return;
      var current = 0;
      if (record && Object.keys(record).length) {
        var pay = record.payment || {};
        var paid = Number(pay.amount_paid || record.amount_paid || 0);
        var total = Number(pay.total_amount || pay.quotation_amount || 0);
        var balance = Number(pay.remaining_balance !== undefined && pay.remaining_balance !== null ? pay.remaining_balance : (total - paid));
        var payState = asText(pay.payment_status || record.payment_status).toLowerCase();
        var status = asText(first(record, ["status", "booking_status"])).toLowerCase();

        var hasDeposit = paid > 0;
        var fullyPaid = paid > 0 && (balance <= 0 || /^paid$/.test(payState));

        var d = new Date();
        var today = d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0");
        var eventDate = asText(record.event_date).slice(0, 10);
        var eventPassed = !!eventDate && eventDate < today;

        current = 2;                                   // confirmed is always done
        if (hasDeposit) current = 3;                   // waiting for full payment
        if (fullyPaid) current = 4;                    // waiting for / on event day
        if (fullyPaid && eventPassed) current = 5;     // event done, waiting to be completed
        if (/complete/.test(status)) current = (balance > 0 && !fullyPaid) ? 3 : STEPS.length + 1; // everything checked, unless a balance is still unpaid (stays on "Fully Paid")
      }
      // The server sends the steps for this service arrangement (pickup / delivery / buffet) and which one is current.
      var stepLabels = STEPS;
      if (record && record.progress && record.progress.steps && record.progress.steps.length) {
        stepLabels = record.progress.steps;
        current = Number(record.progress.current) + 1;   // server: 0-based index (steps.length = all done, -1 = cancelled)
      }
      while (stepper.firstChild) stepper.removeChild(stepper.firstChild);
      stepLabels.forEach(function (label, index) {
        var number = index + 1;
        var item = document.createElement("li");
        item.className = "cb-step " + (number < current ? "is-done" : number === current ? "is-current" : "is-todo");
        var node = document.createElement("span");
        node.className = "cb-step-node";
        node.textContent = number < current ? "\u2713" : String(number);
        var caption = document.createElement("span");
        caption.textContent = label;
        item.appendChild(node);
        item.appendChild(caption);
        if (number === current) item.setAttribute("aria-current", "step");
        stepper.appendChild(item);
      });
    }

    /* Guests (pax) only applies to Buffet with Set-up, and only when a pax number exists. */
    function showsGuests(record) {
      var arr = asText(first(record, ["arrangement", "service_arrangement", "service_type"]));
      var n = parseInt(asText(first(record, ["expected_guests", "guest_count", "guests", "number_of_guests", "pax"])), 10);
      return /buffet|set-?up|on-?site/i.test(arr) && n > 0;
    }

    /* Hide (or show) the whole label + value row that holds `id`, so the card re-flows with no gap. */
    function setRowHidden(id, anchorId, hide) {
      var node = page.querySelector("#" + id);
      if (!node) return;
      var anchor = page.querySelector("#" + anchorId);
      var row = node;
      while (row.parentElement && row.parentElement !== page && !(anchor && row.parentElement.contains(anchor))) row = row.parentElement;
      var targets = [row];
      if (row.tagName === "DD" && row.previousElementSibling && row.previousElementSibling.tagName === "DT") targets.push(row.previousElementSibling);
      targets.forEach(function (t) { t.hidden = hide; t.style.display = hide ? "none" : ""; });
    }

    function formatContactPhone(raw) {
      var original = asText(raw);
      var digits = original.replace(/\D/g, "");
      if (digits.length === 12 && digits.slice(0, 2) === "63") digits = digits.slice(2);
      if (digits.length === 11 && digits.charAt(0) === "0") digits = digits.slice(1);
      if (digits.length === 10) return "+63 " + digits.slice(0, 3) + " " + digits.slice(3, 6) + " " + digits.slice(6);
      return original;
    }

    function renderDetails(record) {
      var contact = record.contact_person || record.contact || record.customer || {};
      var schedule = asText(first(record, ["event_schedule", "schedule"]));
      if (!schedule) {
        schedule = [
          asText(first(record, ["event_date", "date"])),
          asText(first(record, ["event_time", "time"]))
        ].filter(Boolean).join(" · ");
      }
      setText("cbEventType", first(record, ["event_type", "event_type_name", "type"]));
      var guestsOn = showsGuests(record);
      setText("cbGuests", guestsOn ? first(record, ["expected_guests", "guest_count", "guests", "number_of_guests", "pax"]) + " guests" : "");
      setRowHidden("cbGuests", "cbVenue", !guestsOn);
      var arrangement = asText(first(record, ["arrangement", "service_arrangement"]));
      setText("cbArrangement", arrangement);
      var venueLabel = page.querySelector("#cbVenueLabel");
      if (venueLabel) venueLabel.textContent = /pick-?up/i.test(arrangement) ? "Pickup Location" : (/deliver/i.test(arrangement) ? "Delivery Address" : "Event Venue/Address");
      setText("cbVenue", first(record, ["venue", "venue_name", "address"]));
      setText("cbSchedule", schedule);
      setText("cbPackage", first(record, ["package_name", "package"]));
      setText("cbRequests", first(record, ["special_requests", "notes", "dietary_requirements"]));
      /* Contact Person = the customer's own details. */
      setText("cbContactName", first(contact, ["name", "full_name"]) || first(record, ["contact_name", "customer_name"]));
      setText("cbContactEmail", first(contact, ["email"]) || first(record, ["contact_email", "email"]));
      setText("cbContactPhone", formatContactPhone(first(contact, ["phone", "phone_number"]) || first(record, ["contact_phone", "phone", "phone_number"])));

      var menuCard = page.querySelector("#cbMenuCard");
      var menuList = page.querySelector("#cbMenuItems");
      var menuCount = page.querySelector("#cbMenuCount");
      var items = Array.isArray(record.items) ? record.items : (Array.isArray(record.menu_items) ? record.menu_items : []);
      if (menuList) menuList.replaceChildren();
      if (menuCount) menuCount.textContent = items.length ? "(" + items.length + (items.length === 1 ? " item)" : " items)") : "";
      if (menuCard) menuCard.hidden = !items.length;
      items.forEach(function (item) {
        var row = document.createElement("li");
        row.className = "cb-menu-item";
        var copy = document.createElement("div");
        copy.className = "cb-menu-item-copy";
        var name = document.createElement("strong");
        name.textContent = asText(first(item, ["name", "item_name", "item_name_snapshot"])) || "Menu item";
        var serving = asText(first(item, ["serving_option", "serving_size", "serving_option_snapshot"]));
        var quantity = amount(first(item, ["quantity", "qty"]));
        var details = document.createElement("span");
        details.textContent = [serving, quantity ? "Quantity " + quantity.toLocaleString("en-PH", { maximumFractionDigits: 3 }) : ""].filter(Boolean).join(" · ");
        copy.append(name, details);
        var lineTotal = document.createElement("strong");
        lineTotal.className = "cb-menu-item-total";
        lineTotal.textContent = money(first(item, ["subtotal", "line_total", "amount"]));
        row.append(copy, lineTotal);
        menuList.appendChild(row);
      });
    }

    function amount(value) {
      var parsed = typeof value === "number" ? value : Number(String(value || "").replace(/[^\d.-]/g, ""));
      return Number.isFinite(parsed) ? parsed : 0;
    }

    function money(value) {
      return "₱" + amount(value).toLocaleString("en-PH", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    }

    function renderPayment(record) {
      var payment = record.payment || record.payment_details || {};
      if (Array.isArray(record.payments) && record.payments.length) payment = record.payments[record.payments.length - 1];
      var paymentStatus = asText(first(payment, ["status", "payment_status"]) || first(record, ["payment_status"]));
      var normalized = paymentStatus.toLowerCase();
      // "Unpaid" / "Partial" must not count as paid (the word "paid" is inside "unpaid")
      var verified = payment.verified === true || payment.is_verified === true ||
        (!/un-?paid|partial|pending|balance/.test(normalized) && /verified|confirmed|paid|complete/.test(normalized));
      var balanceLeft = amount(payment.remaining_balance !== undefined && payment.remaining_balance !== null ? payment.remaining_balance : 0);
      var isCompleted = /complete/i.test(asText(first(record, ["status", "booking_status"])));
      var hasPendingRequest = !!(record.payment_request && /pending/i.test(asText(record.payment_request.status)));
      var owesAfterEvent = balanceLeft > 0 && isCompleted;
      var icon = page.querySelector("#cbPaymentIcon i");
      if (owesAfterEvent && !hasPendingRequest) {
        setText("cbPaymentBannerTitle", "Balance due");
        setText("cbPaymentBannerText", "Your event is done, but " + money(balanceLeft) + " is still unpaid. Our catering team will send you a payment request, or you can message them in your Inbox.");
      } else {
        setText("cbPaymentBannerTitle", verified ? "Payment Confirmed" : paymentStatus || "Payment status unavailable");
        setText("cbPaymentBannerText", verified
          ? "Your deposit payment has been verified."
          : (paymentStatus ? "Payment status: " + paymentStatus + "." : "No payment information is available yet."));
      }
      setText("cbPaymentVerifiedAt", first(payment, ["verified_at", "payment_date", "paid_at"]), "");
      if (icon) icon.className = (verified && !owesAfterEvent) ? "bi bi-check-lg" : "bi bi-info-circle";

      var total = amount(first(payment, ["total_amount", "booking_total", "total"]) ||
        first(record, ["total_amount", "booking_total", "quoted_total"]));
      var deposit = amount(first(payment, ["deposit_amount", "deposit"]) || first(record, ["deposit_amount"]));
      if (!deposit && total) deposit = total * 0.2;
      var paid = amount(first(payment, ["paid_amount", "amount_paid", "amount"]));
      if (!paid && verified) paid = deposit;
      var givenPercent = first(payment, ["percent_paid", "payment_percent"]);
      var percent = givenPercent !== "" ? amount(givenPercent) : (total ? paid / total * 100 : 0);
      percent = Math.max(0, Math.min(100, percent));

      setText("cbDepositAmount", money(deposit));
      setText("cbPaymentMethod", first(payment, ["method", "payment_method"]));
      setText("cbPaymentDate", first(payment, ["payment_date", "paid_at"]));
      setText("cbPaidAmount", money(paid));
      setText("cbTotalAmount", money(total));
      setText("cbPaymentProgressLabel", percent >= 100 ? "Paid in full" : (paid > 0 ? "Deposit Paid" : "No payment recorded"));
      setText("cbPaymentPercent", percent + "%");
      var bar = page.querySelector("#cbPaymentProgressBar");
      var progress = page.querySelector("#cbPaymentProgress");
      if (bar) bar.style.width = percent + "%";
      if (progress) progress.setAttribute("aria-valuenow", String(percent));
      renderPayRequest(record);

      var historyCard = page.querySelector("#cbPaymentHistoryCard");
      var historyList = page.querySelector("#cbPaymentHistory");
      var history = Array.isArray(record.payment_history) ? record.payment_history : [];
      if (historyList) historyList.replaceChildren();
      if (historyCard) historyCard.hidden = !history.length;
      history.forEach(function (entry) {
        var row = document.createElement("li");
        row.className = "cb-payment-history-item";
        var copy = document.createElement("div");
        copy.className = "cb-payment-history-copy";
        var title = document.createElement("strong");
        title.textContent = (asText(entry.type) || "Payment") + " · " + (asText(entry.status) || "Status unavailable");
        var meta = document.createElement("span");
        var dateValue = asText(first(entry, ["paid_at", "created_at"]));
        var dateText = dateValue;
        if (dateValue) {
          var parsedDate = new Date(dateValue.replace(" ", "T"));
          if (!Number.isNaN(parsedDate.getTime())) dateText = parsedDate.toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" });
        }
        meta.textContent = [asText(entry.method), dateText, asText(entry.reference) ? "Ref. " + asText(entry.reference) : ""].filter(Boolean).join(" · ");
        copy.append(title, meta);
        var total = document.createElement("strong");
        total.className = "cb-payment-history-total";
        total.textContent = money(entry.amount);
        row.append(copy, total);
        historyList.appendChild(row);
      });
    }

    /* "Request Full Payment" from the sales staff: a payment banner (same classes as the Payment tab banner) with a Pay Now button.
       Put <div id="cbPayRequest"></div> in customer-bookings.html to choose where it appears; otherwise it is added after the progress bar. */
    function renderPayRequest(record) {
      var host = page.querySelector("#cbPayRequest");
      if (!host) {
        var anchor = page.querySelector("#cbPaymentProgress");
        if (!anchor) return;
        host = document.createElement("div");
        host.id = "cbPayRequest";
        anchor.insertAdjacentElement("afterend", host);
      }
      host.replaceChildren();
      var req = record && record.payment_request;
      if (!req || req.status !== "Pending") { host.hidden = true; return; }
      host.hidden = false;
      var banner = document.createElement("div");
      banner.className = "cb-payment-banner";
      var icon = document.createElement("span");
      icon.className = "cb-payment-icon";
      icon.setAttribute("aria-hidden", "true");
      icon.innerHTML = '<i class="bi bi-cash-coin"></i>';
      var body = document.createElement("div");
      var title = document.createElement("strong");
      title.textContent = "Full payment requested";
      var text = document.createElement("p");
      text.textContent = "Please pay your remaining balance of " + money(req.amount) + (req.due_label ? " by " + req.due_label : "") + "." + (req.is_overdue ? " This payment is overdue." : "") + (req.note ? " Note from the catering team: " + req.note : "");
      body.append(title, text);
      banner.append(icon, body);
      if (req.pay_url) {
        var pay = document.createElement("button");
        pay.type = "button";
        pay.className = "ci-btn-primary";
        pay.textContent = "Pay Now";
        pay.addEventListener("click", function () { window.location.href = req.pay_url; });
        banner.append(pay);
      }
      host.append(banner);
    }

    /* Xendit sends the customer back here after a "Request Full Payment": ?pay=balance_success|balance_cancelled|balance_pending|balance_review|balance_error (&msg=...) */
    function handleBalanceReturn() {
      var params;
      try { params = new URLSearchParams(window.location.search); } catch (e) { return; }
      var result = params.get("pay") || "";
      if (result.indexOf("balance_") !== 0) return;
      var messages = {
        balance_success: "Payment received. Thank you! Your booking has been updated.",
        balance_cancelled: "Payment cancelled. You can pay anytime with the Pay Now button.",
        balance_pending: "We are still waiting for Xendit to confirm your payment. Please refresh this page in a moment.",
        balance_review: "We received your payment, but our team needs to review it. We will contact you shortly.",
        balance_error: params.get("msg") || "We could not start that payment. Please contact the catering team."
      };
      var banner = document.createElement("div");
      banner.className = "cb-banner";
      banner.setAttribute("role", "status");
      banner.textContent = messages[result] || "";
      page.insertBefore(banner, page.firstChild);
      setTimeout(function () { if (banner.parentNode) banner.remove(); }, 12000);
      params.delete("pay");
      params.delete("msg");
      var qs = params.toString();
      if (window.history && window.history.replaceState) {
        window.history.replaceState(null, "", window.location.pathname + (qs ? "?" + qs : "") + window.location.hash);
      }
    }

    function resetEmpty() {
      page.setAttribute("data-cb-view", "empty");
      if (count) count.textContent = "0 bookings";
      if (layout) layout.hidden = true;
      if (emptyState) emptyState.hidden = false;
      if (listState) listState.hidden = true;
      if (title) title.textContent = "Booking Overview";
      if (reference) { reference.textContent = ""; reference.hidden = true; }
      if (status) status.textContent = "—";
      renderSteps({});
      renderDetails({});
      renderPayment({});
      if (bookingIdInput) bookingIdInput.value = "";
      clearFeedbackImages();
      if (comments) {
        comments.value = "";
      }
      setFeedbackEnabled(false);
      syncFeedbackTab(null);
      if (commentsCount) commentsCount.textContent = "0 / 1,000";
      updateRating(0);
      showFeedbackMessage("Select a booking before submitting feedback.", "");
    }

    function selectBooking(record, index, mobileDetail) {
      // phones: "detail" shows the booking, "booking" keeps the list on screen
      page.setAttribute("data-cb-view", mobileDetail ? "detail" : "booking");
      listState.hidden = true;
      page.querySelectorAll(".cb-booking-button").forEach(function (button) {
        var active = Number(button.getAttribute("data-cb-index")) === index;
        button.classList.toggle("is-active", active);
        button.setAttribute("aria-pressed", String(active));
      });
      var eventName = first(record, ["event_name", "booking_name", "title", "event_type"]);
      if (title) title.textContent = asText(eventName) || "Booking Details";
      var bookingRef = asText(first(record, ["booking_ref", "booking_reference", "reference"]));
      if (reference) {
        reference.textContent = bookingRef ? "Booking reference · " + bookingRef : "";
        reference.hidden = !bookingRef;
      }
      if (status) status.textContent = asText(first(record, ["status", "booking_status"])) || "—";
      var bannerEl = status && status.closest(".cb-banner");
      if (bannerEl) bannerEl.classList.toggle("is-negative", /cancel|declin/i.test(asText(first(record, ["status", "booking_status"]))));   // red banner for cancelled bookings
      renderSteps(record);
      renderDetails(record);
      renderPayment(record);
      syncFeedbackTab(record);

      var id = asText(first(record, ["booking_id", "id"]));
      var feedback = record.feedback || {};
      var rating = Number(first(feedback, ["rating", "stars"]) || first(record, ["feedback_rating"])) || 0;
      var priorComments = asText(first(feedback, ["comments", "comment"]) || first(record, ["feedback_comments"]));
      if (bookingIdInput) bookingIdInput.value = id;
      if (comments) {
        comments.value = priorComments;
      }
      clearFeedbackImages();
      var alreadyRated = rating > 0;
      var isCompleted = Boolean(id) && isCompletedBooking(record);
      setFeedbackEnabled(isCompleted && !alreadyRated);
      if (commentsCount) commentsCount.textContent = comments ? comments.value.length.toLocaleString("en-PH") + " / 1,000" : "0 / 1,000";
      updateRating(rating);
      if (alreadyRated && isCompleted) {
        showFeedbackMessage("Feedback already submitted.", "success");
        if (submitButton) { submitButton.textContent = "Edit"; submitButton.disabled = false; }
      } else {
        showFeedbackMessage(id ? "" : "This booking does not include a booking_id yet.", "");
        if (submitButton) { submitButton.textContent = "Submit Feedback"; }
      }
    }

    function render(rows, preferredId) {
      while (list.firstChild) list.removeChild(list.firstChild);
      if (count) count.textContent = rows.length + (rows.length === 1 ? " booking" : " bookings");
      if (!rows.length) {
        resetEmpty();
        return;
      }
      if (emptyState) emptyState.hidden = true;
      if (layout) layout.hidden = false;
      listState.hidden = true;
      rows.forEach(function (record, index) {
        var button = document.createElement("button");
        button.type = "button";
        button.className = "cb-booking-button";
        if (/cancel|declin/i.test(asText(first(record, ["status", "booking_status"])))) button.classList.add("is-negative");   // red accent for cancelled bookings
        button.setAttribute("data-cb-index", String(index));
        button.setAttribute("aria-pressed", "false");
        var copy = document.createElement("span");
        copy.className = "cb-booking-copy";
        var name = document.createElement("span");
        name.className = "cb-booking-name";
        name.textContent = asText(first(record, ["event_name", "booking_name", "title", "event_type"])) || "Booking";
        copy.appendChild(name);
        var meta = document.createElement("span");
        meta.className = "cb-booking-meta";
        var date = document.createElement("span");
        date.textContent = asText(first(record, ["schedule", "event_schedule", "event_date", "date"])) || "—";
        meta.appendChild(date);
        var bookingRef = asText(first(record, ["booking_ref", "booking_reference", "reference"]));
        if (bookingRef) {
          var reference = document.createElement("span");
          reference.className = "cb-booking-ref-short";
          reference.textContent = bookingRef;
          meta.appendChild(reference);
        }
        var bookingStatus = asText(first(record, ["status", "booking_status"]));
        var bookingStage = bookingPhase(record);
        meta.appendChild(phaseTag(bookingStage, [bookingStatus || "Upcoming event", bookingStatus || "Event finished", bookingStatus || "Cancelled"]));
        if (showsGuests(record)) {
          var guests = document.createElement("span");
          guests.textContent = asText(first(record, ["expected_guests", "guest_count", "guests", "pax"])) + " guests";
          meta.appendChild(guests);
        }
        copy.appendChild(meta);
        var arrow = document.createElement("i");
        arrow.className = "bi bi-chevron-right cb-booking-arrow";
        arrow.setAttribute("aria-hidden", "true");
        button.appendChild(copy);
        button.appendChild(arrow);
        var item = document.createElement("li");
        item.appendChild(button);
        list.appendChild(item);
      });
      var index = 0;
      var matched = false;
      if (preferredId) {
        var match = rows.findIndex(function (record) {
          return asText(first(record, ["booking_id", "id"])) === String(preferredId);
        });
        if (match < 0) {   // the Home card had no booking id: fall back to the event name
          match = rows.findIndex(function (record) {
            return asText(first(record, ["event_title", "event_name", "title", "name"])).toLowerCase() === String(preferredId).toLowerCase();
          });
        }
        if (match >= 0) { index = match; matched = true; }
      }
      var openFeedback = matched && wantFeedbackId !== "" && String(preferredId) === wantFeedbackId;
      selectBooking(rows[index], index, openFeedback);
      var chosenBtn = list.querySelector(".cb-booking-button.is-active");
      if (matched && chosenBtn && chosenBtn.scrollIntoView) chosenBtn.scrollIntoView({ block: "nearest" });
      if (openFeedback) { openFeedbackTab(); wantFeedbackId = ""; }
    }

    function load(preferredId) {
      if (!records.length) {
        page.setAttribute("data-cb-view", "loading");
        if (layout) layout.hidden = true;
        if (emptyState) emptyState.hidden = true;
      }
      showListMessage("Loading your bookings...", false);
      fetchBookings()
        .then(function (json) {
          if (!Array.isArray(json.bookings)) throw new Error("The bookings service returned an invalid booking list.");
          var rows = json.bookings;
          rows = sortBookings(rows);   // cancelled last, earliest event date first
          records = rows;
          render(rows, preferredId);
        })
        .catch(function (error) {
          console.warn("Bookings are not available yet:", error);
          if (!records.length) {
            page.setAttribute("data-cb-view", "error");
            if (layout) layout.hidden = true;
            if (emptyState) emptyState.hidden = true;
            showListMessage(error && error.message ? error.message : "Bookings could not be loaded. Please try again.", true);
          } else {
            listState.hidden = true;
          }
        });
    }

    list.addEventListener("click", function (event) {
      var button = event.target.closest ? event.target.closest(".cb-booking-button") : null;
      if (!button) return;
      var index = Number(button.getAttribute("data-cb-index"));
      if (records[index]) selectBooking(records[index], index, true);
    });

    var cbBack = page.querySelector("#cbBack");
    if (cbBack) cbBack.addEventListener("click", function () {
      page.setAttribute("data-cb-view", "booking");
      var body = document.querySelector(".content-body");
      if (body) body.scrollTop = 0;
    });
    var cbStartInquiry = page.querySelector("#cbStartInquiry");
    if (cbStartInquiry) cbStartInquiry.addEventListener("click", function () {
      try {
        sessionStorage.setItem("crmOpenInquiryWizardOnce", "1");
        sessionStorage.removeItem("crmOpenBookingId");
        sessionStorage.removeItem("crmOpenBookingTab");
      } catch (error) {
        console.warn("Could not save the inquiry navigation state.", error);
      }
      var inquiryLink = document.querySelector(".sidebar-nav a[onclick*=\"customer-inquiries.html\"]");
      if (inquiryLink) inquiryLink.click();
      else if (typeof window.loadPage === "function") window.loadPage("customer-inquiries.html");
      else console.error("The CRM page loader is unavailable; the inquiry page could not be opened.");
    });

    page.querySelectorAll("[data-tab-target]").forEach(function (tab) {
      tab.addEventListener("click", function () {
        var target = page.querySelector(tab.getAttribute("data-tab-target"));
        if (!target) return;
        page.querySelectorAll("[data-tab-target]").forEach(function (item) {
          var active = item === tab;
          item.classList.toggle("is-active", active);
          item.setAttribute("aria-selected", String(active));
          item.tabIndex = active ? 0 : -1;
        });
        page.querySelectorAll(".cb-tab-panel").forEach(function (panel) {
          panel.hidden = panel !== target;
        });
      });
    });

    if (stars) {
      stars.addEventListener("click", function (event) {
        var star = event.target.closest ? event.target.closest("[data-cb-rating]") : null;
        if (!star || star.disabled) return;
        updateRating(star.getAttribute("data-cb-rating"));
        showFeedbackMessage("", "");
      });
      stars.addEventListener("mouseover", function (event) {
        var star = event.target.closest ? event.target.closest("[data-cb-rating]") : null;
        if (!star || star.disabled) return;
        var preview = Number(star.getAttribute("data-cb-rating"));
        stars.querySelectorAll("[data-cb-rating]").forEach(function (item) {
          item.classList.toggle("is-preview", Number(item.getAttribute("data-cb-rating")) <= preview);
        });
      });
      stars.addEventListener("mouseleave", function () {
        stars.querySelectorAll("[data-cb-rating]").forEach(function (item) { item.classList.remove("is-preview"); });
      });
    }

    if (comments && commentsCount) {
      comments.addEventListener("input", function () {
        commentsCount.textContent = comments.value.length.toLocaleString("en-PH") + " / 1,000";
      });
    }

    if (imageInput) {
      imageInput.addEventListener("change", function () {
        var incoming = Array.from(imageInput.files || []);
        imageInput.value = "";
        if (!incoming.length) return;
        var combined = selectedImages.concat(incoming);
        if (combined.length > MAX_FEEDBACK_IMAGES) {
          showImageMessage("You can attach up to 4 photos.", "error");
          return;
        }
        for (var i = 0; i < incoming.length; i++) {
          var issue = feedbackImageError(incoming[i]);
          if (issue) {
            showImageMessage(issue, "error");
            return;
          }
        }
        selectedImages = combined;
        renderImagePreviews();
        showImageMessage(selectedImages.length + " photo(s) selected.", "success");
      });
    }

    if (form) {
      form.addEventListener("submit", function (event) {
        event.preventDefault();
        // If the button currently says "Edit", switch to edit mode instead of submitting.
        if (submitButton && submitButton.textContent.trim() === "Edit") {
          setFeedbackEnabled(true);
          showFeedbackMessage("You can now update your feedback.", "");
          submitButton.textContent = "Submit Feedback";
          return;
        }
        var bookingId = bookingIdInput ? bookingIdInput.value.trim() : "";
        var rating = ratingInput ? Number(ratingInput.value) : 0;
        if (!bookingId) {
          showFeedbackMessage("Select a booking before submitting feedback.", "error");
          return;
        }
        if (rating < 1 || rating > 5) {
          showFeedbackMessage("Choose a star rating before submitting.", "error");
          return;
        }
        if (submitButton) submitButton.disabled = true;
        showFeedbackMessage("Submitting feedback...", "");
        var data = new FormData(form);
        data.set("booking_id", bookingId);
        data.set("rating", String(rating));
        data.delete("feedback_images[]");
        selectedImages.forEach(function (file) {
          data.append("feedback_images[]", file, file.name);
        });
        fetch(API + "?action=submit_feedback", {
          method: "POST",
          credentials: "same-origin",
          headers: { Accept: "application/json" },
          body: data
        })
          .then(parseResponse)
          .then(function (json) {
            showFeedbackMessage("Feedback submitted.", "success");
            clearFeedbackImages();
            setFeedbackEnabled(false);
            if (submitButton) { submitButton.textContent = "Edit"; submitButton.disabled = false; }
          })
          .catch(function (error) {
            console.error("Feedback submission failed:", error);
            showFeedbackMessage(error.message || "Unable to submit feedback. Please try again.", "error");
          })
          .finally(function () {
            // Only re-enable the button on error (success handler already sets "Edit" + enabled).
            if (submitButton && submitButton.textContent.trim() !== "Edit") {
              submitButton.disabled = !bookingIdInput || !bookingIdInput.value;
            }
          });
      });
    }

    // Console testing: crmRenderBookingsPage([ {...}, {...} ])
    window.crmRenderBookingsPage = function (rows) { records = Array.isArray(rows) ? sortBookings(rows) : []; render(records, ""); };
    handleBalanceReturn();
    // Coming from the inbox "Rate Now" card: open that booking on its Feedback tab.
    var wantFeedbackId = "";
    try {
      wantFeedbackId = sessionStorage.getItem("crmOpenFeedbackBooking") || "";
      sessionStorage.removeItem("crmOpenFeedbackBooking");
    } catch (error) { wantFeedbackId = ""; }
    // Coming from Home "Payment Details": open the Payment tab.
    var wantTab = "";
    try {
      wantTab = sessionStorage.getItem("crmOpenBookingTab") || "";
      sessionStorage.removeItem("crmOpenBookingTab");
    } catch (error) { wantTab = ""; }
    if (wantTab && !wantFeedbackId) {
      var wantedTabButton = page.querySelector('[data-tab-target="' + wantTab + '"]');
      if (wantedTabButton) wantedTabButton.click();
    }
    // Coming from the Home booking card: select that booking in the list.
    var wantBookingId = "";
    try {
      wantBookingId = sessionStorage.getItem("crmOpenBookingId") || "";
      /* keep it for a few seconds: the Home card's retry timers may still need it, then clear it so it never goes stale */
      if (wantBookingId) setTimeout(function () { try { sessionStorage.removeItem("crmOpenBookingId"); } catch (e) { /* ignore */ } }, 4000);
    } catch (error) { wantBookingId = ""; }
    /* Home -> "View Booking Details" / "Payment Details" when this page was already loaded (so the code above did not run again):
       select the booking the Home card showed. Home calls this right after it opens My Bookings. */
    window.crmApplyHomeBookingSelection = function () {
      if (!page.isConnected || !records.length) return false;
      if (page.offsetParent === null && page.getClientRects().length === 0) return false;   // old / hidden copy of the page: leave the choice for the visible one
      var id = "", tab = "";
      try { id = sessionStorage.getItem("crmOpenBookingId") || ""; tab = sessionStorage.getItem("crmOpenBookingTab") || ""; } catch (error) { return false; }
      if (!id) return false;
      var idx = records.findIndex(function (record) { return asText(first(record, ["booking_id", "id"])) === String(id); });
      if (idx < 0) idx = records.findIndex(function (record) { return asText(first(record, ["event_title", "event_name", "title", "name"])).toLowerCase() === String(id).toLowerCase(); });
      if (idx < 0) return false;
      try { sessionStorage.removeItem("crmOpenBookingTab"); } catch (error) { /* ignore */ }
      selectBooking(records[idx], idx, false);
      var activeBtn = page.querySelector(".cb-booking-button.is-active");   // make sure the chosen booking is visible in the list
      if (activeBtn && activeBtn.scrollIntoView) activeBtn.scrollIntoView({ block: "nearest" });
      var tabButton = tab ? page.querySelector('[data-tab-target="' + tab + '"]') : page.querySelector("[data-tab-target]");
      if (tabButton) tabButton.click();
      return true;
    };
    load(wantFeedbackId || wantBookingId);
  }

  function scan() {
    document.querySelectorAll("#cbPage").forEach(init);
  }

  function start() {
    scan();
    new MutationObserver(scan).observe(document.body, { childList: true, subtree: true });
  }

  if (document.body) start();
  else document.addEventListener("DOMContentLoaded", start);
})();

/* ---------- Customer My Inquiries page (API-backed; no sample records) ---------- */
(function () {
  "use strict";

  /* My Inquiries order: declined / cancelled ones last, the rest keep the server order. */
  function listText(record, keys) {
    for (var i = 0; i < keys.length; i++) {
      var v = record && record[keys[i]];
      if (v !== undefined && v !== null && String(v).trim() !== "") return String(v).trim();
    }
    return "";
  }
  /* Phase of an inquiry: 0 = upcoming event, 1 = event date has passed, 2 = declined / cancelled.
     (Stage "Completed" on an inquiry only means the deposit was paid and the booking exists, so it is NOT "finished".) */
  function inquiryDay(r) { var m = /^(\d{4}-\d{2}-\d{2})/.exec(listText(r, ["event_date", "date"])); return m ? m[1] : ""; }
  function inquiryPhase(r) {
    if (/declin|cancel/i.test(listText(r, ["status", "inquiry_status", "stage"]))) return 2;
    var d = new Date(), today = d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0");
    var day = inquiryDay(r);
    return day && day < today ? 1 : 0;
  }
  function inquiryPhaseLabels(r) {
    if (r && r.booking) return ["Booking linked", "Booking linked", "Cancelled"];
    return ["Upcoming", "Date passed", /cancel/i.test(listText(r, ["status", "inquiry_status", "stage"])) && !/declin/i.test(listText(r, ["status", "inquiry_status", "stage"])) ? "Cancelled" : "Declined"];
  }
  /* Order of My Inquiries (strict, whatever the event date):
       0 New Inquiry
       1 In Progress (incl. In Discussion, Quotation Preparation)
       2 Quotation Sent (incl. Negotiation)
       -- these three keep the server order (newest submitted first) --
       3 other upcoming inquiries, earliest event first
       4 date passed (most recent first)
       5 declined / cancelled */
  function inquiryGroup(r) {
    if (inquiryPhase(r) === 2) return 5;                                   // declined / cancelled always last
    var s = listText(r, ["stage", "status", "inquiry_status"]).toLowerCase();
    if (/new inquiry/.test(s)) return 0;
    if (/in progress|in discussion|quotation prep/.test(s)) return 1;
    if (/quotation sent|negotiation/.test(s)) return 2;
    return inquiryPhase(r) === 1 ? 4 : 3;
  }
  function sortInquiries(rows) {
    return rows.map(function (r, i) { return { r: r, i: i, k: inquiryGroup(r), d: inquiryDay(r) || "9999-99-99" }; }).sort(function (a, b) {
      if (a.k !== b.k) return a.k - b.k;
      if (a.k <= 2) return a.i - b.i;                                       // first three groups: server order
      if (a.d !== b.d) return a.k === 4 ? (a.d < b.d ? 1 : -1) : (a.d < b.d ? -1 : 1);   // date passed: most recent first; others: earliest first
      return a.i - b.i;
    }).map(function (x) { return x.r; });
  }

  if (window.__crmInquiryListLoaded) return;
  window.__crmInquiryListLoaded = true;

  var API = "customer-inquiries-api.php";
  var PAY_API = "xendit-api.php";   // xendit deposit payment (create_checkout)
  var STEP_LABELS = ["Submitted", "Under Review", "Quotation Sent", "Quotation Accepted", "Deposit Verified", "Booking Confirmed"];

  function asText(value) {
    if (value === null || value === undefined) return "";
    if (typeof value === "object") {
      if (value.name !== undefined) return String(value.name);
      if (value.label !== undefined) return String(value.label);
      return "";
    }
    return String(value);
  }

  function firstValue(object, keys) {
    for (var i = 0; i < keys.length; i++) {
      var value = object && object[keys[i]];
      if (value !== null && value !== undefined && value !== "") return value;
    }
    return "";
  }

  function parseResponse(response) {
    return response.text().then(function (text) {
      var json;
      try { json = text ? JSON.parse(text) : {}; }
      catch (error) {
        if (!response.ok) {
          throw new Error("Inquiry API request failed (HTTP " + response.status + "). Check customer-inquiries-api.php and its path.");
        }
        throw new Error("The inquiry service returned an invalid response.");
      }
      if (!response.ok) {
        throw new Error((json && json.message) || "Inquiry API request failed (HTTP " + response.status + ").");
      }
      if (!json || typeof json !== "object") throw new Error("The inquiry service returned an invalid response.");
      if (json.success === false) throw new Error(json.message || "Unable to load your inquiries.");
      return json;
    });
  }
  function empty(element) {
    while (element && element.firstChild) element.removeChild(element.firstChild);
  }

  function make(tag, className, text) {
    var element = document.createElement(tag);
    if (className) element.className = className;
    if (text !== undefined) element.textContent = text;
    return element;
  }

  function initInquiryListPage(page) {
    if (!page || page.getAttribute("data-ci-ready") === "1") return;
    var state = page.querySelector("#ciState");
    var layout = page.querySelector("#ciLayout");
    var list = page.querySelector("#ciList");
    var inquiryCount = page.querySelector("#ciInquiryCount");
    var detail = page.querySelector("#ciDetail");
    var emptyState = page.querySelector("#ciEmptyState");
    var back = page.querySelector("#ciBack");
    var heroTitle = page.querySelector("#ciHeroTitle");
    var heroDescription = page.querySelector("#ciHeroDescription");
    var heroReference = page.querySelector("#ciInquiryReference");
    var heroStatus = page.querySelector("#ciHeroStatus");
    var eventStrip = page.querySelector("#ciEventStrip");
    var stepper = page.querySelector("#ciStepper");
    var detailsPanel = page.querySelector("#ciPanelDetails");
    var quotePanel = page.querySelector("#ciPanelQuote");
    var detailsTab = page.querySelector("#ciTabDetails");
    var quoteTab = page.querySelector("#ciTabQuote");
    if (!state || !layout || !list || !detail) return;

    page.setAttribute("data-ci-ready", "1");
    page.setAttribute("data-ci-view", "list");
    var inquiries = [];
    var csrfToken = "";   // sent with Accept / Decline of a quotation
    var keepIndex = -1;    // after answering a quotation, reload the list but stay on the same inquiry + Quotation tab
    var keepTab = "";

    function showState(message, isError, canRetry) {
      empty(state);
      state.classList.toggle("is-error", !!isError);
      state.appendChild(document.createTextNode(message));
      if (canRetry) {
        state.appendChild(document.createElement("br"));
        var retry = make("button", "ci-btn-outline mt-3", "Try again");
        retry.type = "button";
        retry.addEventListener("click", loadInquiries);
        state.appendChild(retry);
      }
      state.hidden = false;
      layout.hidden = inquiries.length === 0;
      page.setAttribute("data-ci-view", inquiries.length ? "list" : "empty");
    }

    function showToast(message, ms) {
      var type = arguments.length > 2 ? arguments[2] : "success";
      if (window.crmToast) window.crmToast(message, type, { duration: ms || 4500 });
      else console.error("CRM toast component was not loaded before customer actions.");
    }

    function renderSteps(record) {
      empty(stepper);
      if (!stepper) return;
      var progress = Number(firstValue(record, ["progress_step", "current_step"]));
      if (/declin|cancel/i.test(asText(firstValue(record, ["status", "stage"])))) { stepper.hidden = true; return; }
      if (!Number.isInteger(progress) || progress < 1) progress = 1;
      if (record.booking) progress = 6;
      else if (record.quotation && record.quotation.status === "Accepted") progress = 4;
      else if (record.quotation && record.quotation.status === "Sent") progress = 3;
      progress = Math.min(progress, 6);
      empty(stepper);
      stepper.hidden = false;
      STEP_LABELS.forEach(function (label, index) {
        var number = index + 1;
        var item = make("li", "ci-step");
        item.classList.add(number < progress ? "is-done" : number === progress ? "is-current" : "is-todo");
        var node = make("span", "ci-node", number < progress ? "✓" : String(number));
        var caption = make("span", "ci-step-label", label);
        item.appendChild(node);
        item.appendChild(caption);
        if (number === progress) item.setAttribute("aria-current", "step");
        stepper.appendChild(item);
      });
    }

    function appendMeta(dl, label, value, wide) {
      var text = Array.isArray(value) ? value.map(asText).filter(Boolean).join(", ") : asText(value);
      if (!text) return;
      var item = make("div", "ci-meta-item" + (wide ? " is-wide" : ""));
      item.appendChild(make("dt", "", label));
      item.appendChild(make("dd", "", text));
      dl.appendChild(item);
    }

    /* ---- Details tab: same labels, classes and layout as the sales staff "View Details" (av-d-* in all-pages.css) ---- */
    function fmtDay(value) {
      var text = asText(value);
      if (!text) return "";
      var m = /^(\d{4})-(\d{2})-(\d{2})/.exec(text);
      var d = m ? new Date(+m[1], +m[2] - 1, +m[3]) : new Date(text);
      if (isNaN(d.getTime())) return text;
      return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
    }

    function avField(label, value, cls) {
      var box = make("div");
      box.appendChild(make("span", "av-d-label", label));
      box.appendChild(make("span", "av-d-value" + (cls ? " " + cls : ""), asText(value) || "\u2014"));
      return box;
    }

    function avCard(letter, title, right) {
      var card = make("section", "ci-box iq-detail-card av-d-card");
      var head = make("div", "av-d-card-head");
      head.appendChild(make("h3", "iq-section-title", letter + ". " + title));
      if (right) head.appendChild(right);
      card.appendChild(head);
      return card;
    }

    /* selected dishes -> [{ category, name, qty, details }]; accepts menu_items / food_orders / dishes (objects or labels) */
    function dishItems(record, hasPax) {
      var raw = record.dishes || record.selected_dishes;
      var source = [record.menu_items, record.food_orders, record.dishes, record.selected_dishes].find(Array.isArray);
      if (!source && typeof raw === "string") source = raw.split(/\s*,\s*(?!\d{3}\b)/).filter(Boolean);   // keeps "₱1,230.00" in one piece
      return (source || []).map(function (dish) {
        var o = { name: "", tier: "", price: "", pax: "", category: "", qty: "", details: "" };
        if (dish && typeof dish === "object") {
          o.name = asText(firstValue(dish, ["name", "dish_name", "item_name", "title"]));
          o.tier = asText(firstValue(dish, ["tier", "tier_name"]));
          o.price = asText(firstValue(dish, ["price", "price_label"]));
          o.pax = asText(firstValue(dish, ["pax"])).replace(/\s*PAX\s*$/i, "").trim();
          o.category = asText(firstValue(dish, ["category", "food_category", "type"]));
          o.qty = asText(firstValue(dish, ["quantity", "serving", "qty"]));
          o.details = asText(firstValue(dish, ["details", "order_details", "notes", "remarks"]));
        } else {
          var label = asText(dish).trim();
          var m = /^(.*?)\s+-\s+(.*?)\s+\(([^()]*)\)(?:\s+x(\d+))?\s*$/.exec(label);   // "PORK ADOBO - 1/4 KG Portion (₱230.00)"
          if (m) { o.name = m[1]; o.tier = m[2]; o.price = m[3]; if (m[4]) o.qty = "\u00D7 " + m[4]; } else { o.name = label; }
        }
        if (!o.qty && o.pax && hasPax) o.qty = o.pax + " PAX";
        if (!o.details) o.details = [o.tier, o.price].filter(Boolean).join(" \u00B7 ");
        return o;
      }).filter(function (o) { return o.name; });
    }

    function renderDishes(panel, record, hasPax) {
      var items = dishItems(record, hasPax);
      var tag = make("span", "av-d-tag", items.length + " Item" + (items.length === 1 ? "" : "s") + " Requested");
      var card = avCard("B", "Food Orders", tag);
      if (!items.length) {
        card.appendChild(make("p", "av-d-menu-empty", "No dishes selected."));
        panel.appendChild(card);
        return;
      }
      /* a column is only drawn when at least one dish has something for it (no rows of "—") */
      var cols = [
        { key: "category", label: "Food Category", cls: "" },
        { key: "name", label: "Menu Item / Variety", cls: "av-d-item" },
        { key: "qty", label: "Quantity / Serving", cls: "av-d-qty" },
        { key: "details", label: "Order Details", cls: "av-d-details" }
      ].filter(function (c) {
        return c.key === "name" || items.some(function (it) { return it[c.key]; });
      });
      var wrap = make("div", "av-d-table-wrap");
      var table = make("table", "av-d-table");
      var thead = document.createElement("thead");
      var hr = document.createElement("tr");
      cols.forEach(function (c) { hr.appendChild(make("th", c.key === "qty" ? "av-d-qty" : "", c.label)); });
      thead.appendChild(hr);
      table.appendChild(thead);
      var tbody = document.createElement("tbody");
      items.forEach(function (it) {
        var tr = document.createElement("tr");
        cols.forEach(function (c) {
          var td = make("td", c.cls);
          var v = it[c.key];
          if (c.key === "category" && v) td.appendChild(make("span", "av-d-cat", v));
          else td.textContent = v || "\u2014";
          tr.appendChild(td);
        });
        tbody.appendChild(tr);
      });
      table.appendChild(tbody);
      wrap.appendChild(table);
      card.appendChild(wrap);
      panel.appendChild(card);
    }

    function renderDetails(record) {
      if (!detailsPanel) return;
      var detailsContent = page.querySelector("#ciDetailsContent") || detailsPanel;
      empty(detailsContent);
      var arrangement = asText(firstValue(record, ["arrangement", "service_arrangement"]));
      var hasPax = /buffet|set-?up|on-?site/i.test(arrangement);
      if (/declin/i.test(asText(firstValue(record, ["status", "stage"])))) {
        var why = asText(record.decline_reason);
        detailsContent.appendChild(make("div", "ci-note ci-note-negative mb-3", "This inquiry was declined" + (why ? ": " + why : ".") + " You are welcome to send a new inquiry anytime."));
      }

      // A. Event Information (same fields as the staff side)
      var info = make("section", "ci-approved-card");
      info.appendChild(make("h3", "ci-approved-title", "A. Event Information"));
      [["Event Name", firstValue(record,["event_name","title"])], ["Number of Guests", hasPax ? firstValue(record,["pax","expected_guests"]) + " pax" : ""], ["Additional Notes", firstValue(record,["special_requests","notes","customer_notes"]) || "—"]].forEach(function(row) {
        if (row[1] !== "") { info.appendChild(make("span","ci-approved-label",row[0])); info.appendChild(make("div","ci-approved-value",row[1])); }
      });
      detailsContent.appendChild(info);
      var service = make("section", "ci-approved-card ci-service-card");
      service.appendChild(make("h3", "ci-approved-title", "B. Service Arrangement"));
      service.appendChild(make("span", "ci-approved-label", "Catering Arrangement"));
      service.appendChild(make("div", "ci-approved-value", arrangement || "—"));
      var arrangementDetails = record.arrangement_details || record.delivery_details;
      if (typeof arrangementDetails === "string") { try { arrangementDetails = JSON.parse(arrangementDetails); } catch (_) { arrangementDetails = null; } }
      if (!arrangementDetails || typeof arrangementDetails !== "object" || Array.isArray(arrangementDetails)) arrangementDetails = null;
      var locationLabel = asText(record.event_location_label) || (/pick-?up/i.test(arrangement) ? "Pickup Location" : (/deliver/i.test(arrangement) ? "Delivery Address" : "Event Venue / Address"));
      service.appendChild(make("span", "ci-approved-label", locationLabel));
      service.appendChild(make("div", "ci-approved-value", firstValue(record,["event_location","venue","address","location"]) || "—"));
      if (arrangementDetails) {
        var detailRows = /deliver/i.test(arrangement)
          ? [["barangay", "Barangay"], ["city", "City / Municipality"], ["province", "Province"], ["landmark", "Nearest Landmark"], ["instructions", "Delivery Instructions"]]
          : /pick-?up/i.test(arrangement)
            ? [["pickup_notes", "Pickup Notes"]]
            : hasPax ? [["barangay", "Barangay"], ["city", "City / Municipality"], ["province", "Province"], ["landmark", "Nearest Landmark"], ["setup_notes", "Setup Notes"]] : [];
        detailRows.forEach(function (entry) {
          if (arrangementDetails[entry[0]]) {
            service.appendChild(make("span", "ci-approved-label", entry[1]));
            service.appendChild(make("div", "ci-approved-value", arrangementDetails[entry[0]]));
          }
        });
      }
      if (record.event_time_display || record.event_time) { service.appendChild(make("span", "ci-approved-label", asText(record.event_time_label) || "Event time")); service.appendChild(make("div", "ci-approved-value", asText(record.event_time_display) || asText(record.event_time))); }
      detailsContent.appendChild(service);
      var menu = make("section", "ci-approved-card ci-menu-card");
      menu.appendChild(make("h3", "ci-approved-title", "C. Menu Selected"));
      var dishes = dishItems(record, hasPax);
      var table = make("div", "ci-approved-menu");
      var heading = make("div", "ci-approved-menu-head");
      ["Menu Item","Serving Size","Quantity"].forEach(function(x) { heading.appendChild(make("strong","",x)); });
      table.appendChild(heading);
      dishes.forEach(function(dish) { var row = make("div","ci-approved-menu-row"); row.appendChild(make("span","",dish.name)); row.appendChild(make("span","",dish.tier || dish.pax || "—")); row.appendChild(make("span","",dish.qty || "1")); table.appendChild(row); });
      if (!dishes.length) table.appendChild(make("div","ci-approved-menu-row","No menu items selected."));
      menu.appendChild(table);
      detailsContent.appendChild(menu);
    }

    function peso(value) {
      var n = Number(value);
      return "₱ " + (isNaN(n) ? "0.00" : n.toLocaleString("en-PH", { minimumFractionDigits: 2, maximumFractionDigits: 2 }));
    }

    /* Popups in the app's own style (same classes as the CRM confirm modal) instead of the browser's "localhost says" box */
    function openDialog(inner) {
      var el = document.createElement("div");
      el.className = "modal fade";
      el.tabIndex = -1;
      el.setAttribute("aria-hidden", "true");
      el.innerHTML = '<div class="modal-dialog modal-dialog-centered"><div class="modal-content custom-modal-card"><div class="modal-body">' + inner + "</div></div></div>";
      document.body.appendChild(el);
      var inst = new window.bootstrap.Modal(el);
      el.addEventListener("hidden.bs.modal", function () { inst.dispose(); el.remove(); });
      inst.show();
      return { el: el, inst: inst };
    }

    function confirmDialog(opts) {
      return new Promise(function (resolve) {
        if (!window.bootstrap || !window.bootstrap.Modal) { resolve(window.confirm(opts.message)); return; }
        var d = openDialog(
          '<h5 class="modal-title mb-2" data-t></h5><p class="modal-delete-text mb-4" data-m></p>' +
          '<div class="d-flex justify-content-end gap-2"><button type="button" class="btn modal-btn-white px-3" data-no>Cancel</button>' +
          '<button type="button" class="btn modal-btn-save px-3" data-ok></button></div>'
        );
        d.el.querySelector("[data-t]").textContent = opts.title;
        d.el.querySelector("[data-m]").textContent = opts.message;
        d.el.querySelector("[data-ok]").textContent = opts.confirmText;
        var answer = false;
        d.el.querySelector("[data-ok]").addEventListener("click", function () { answer = true; d.inst.hide(); });
        d.el.querySelector("[data-no]").addEventListener("click", function () { d.inst.hide(); });
        d.el.addEventListener("hidden.bs.modal", function () { resolve(answer); });
      });
    }

    // resolves with the reason text (may be empty) or null when cancelled
    function reasonDialog(opts) {
      return new Promise(function (resolve) {
        if (!window.bootstrap || !window.bootstrap.Modal) { resolve(window.prompt(opts.message, "")); return; }
        var d = openDialog(
          '<h5 class="modal-title mb-2" data-t></h5><p class="modal-delete-text mb-3" data-m></p>' +
          '<label class="modal-input-label" for="ciReason">Reason (optional)</label>' +
          '<textarea id="ciReason" class="modal-input-field" rows="3" maxlength="500"></textarea>' +
          '<div class="d-flex justify-content-end gap-2 mt-3"><button type="button" class="btn modal-btn-white px-3" data-no>Cancel</button>' +
          '<button type="button" class="btn modal-btn-danger px-3" data-ok></button></div>'
        );
        d.el.querySelector("[data-t]").textContent = opts.title;
        d.el.querySelector("[data-m]").textContent = opts.message;
        d.el.querySelector("[data-ok]").textContent = opts.confirmText;
        var answer = null;
        d.el.querySelector("[data-ok]").addEventListener("click", function () { answer = d.el.querySelector("#ciReason").value.trim(); d.inst.hide(); });
        d.el.querySelector("[data-no]").addEventListener("click", function () { d.inst.hide(); });
        d.el.addEventListener("hidden.bs.modal", function () { resolve(answer); });
      });
    }

    // like reasonDialog, but the customer must describe the change; resolves with the text or null when cancelled
    function changeDialog(opts) {
      return new Promise(function (resolve) {
        if (!window.bootstrap || !window.bootstrap.Modal) {
          var typed = window.prompt(opts.message, "");
          resolve(typed && typed.trim() ? typed.trim() : null);
          return;
        }
        var d = openDialog(
          '<h5 class="modal-title mb-2" data-t></h5><p class="modal-delete-text mb-3" data-m></p>' +
          '<label class="modal-input-label" for="ciChangeText">What would you like to change?</label>' +
          '<textarea id="ciChangeText" class="modal-input-field" rows="4" maxlength="1000" ' +
          'placeholder="e.g. Reduce the guests to 40, replace the pasta with a chicken dish, move the date..."></textarea>' +
          '<p class="text-danger small mt-2 mb-0" data-err hidden>Please describe the change you need.</p>' +
          '<div class="d-flex justify-content-end gap-2 mt-3"><button type="button" class="btn modal-btn-white px-3" data-no>Cancel</button>' +
          '<button type="button" class="btn modal-btn-save px-3" data-ok></button></div>'
        );
        d.el.querySelector("[data-t]").textContent = opts.title;
        d.el.querySelector("[data-m]").textContent = opts.message;
        d.el.querySelector("[data-ok]").textContent = opts.confirmText;
        var field = d.el.querySelector("#ciChangeText");
        var err = d.el.querySelector("[data-err]");
        var answer = null;
        field.addEventListener("input", function () { err.hidden = true; });
        d.el.querySelector("[data-ok]").addEventListener("click", function () {
          var text = field.value.trim();
          if (!text) { err.hidden = false; field.focus(); return; }
          answer = text;
          d.inst.hide();
        });
        d.el.querySelector("[data-no]").addEventListener("click", function () { d.inst.hide(); });
        d.el.addEventListener("hidden.bs.modal", function () { resolve(answer); });
      });
    }

    function respondToQuotation(quotation, decision, reason) {
      var body = new FormData();
      body.set("quotation_id", String(quotation.quotation_id));
      body.set("decision", decision);
      body.set("csrf_token", csrfToken);
      if (reason) body.set("reason", reason);
      return fetch(API + "?action=quotation_respond", {
        method: "POST",
        credentials: "same-origin",
        headers: { Accept: "application/json", "X-CSRF-Token": csrfToken },
        body: body
      }).then(parseResponse);
    }

    /* Asks xendit-api.php for a checkout page and sends the customer to it (Xendit hosted page: GCash and Maya only). */
    function startPayment(quotation) {
      var body = new FormData();
      body.set("quotation_id", String(quotation.quotation_id));
      body.set("csrf_token", csrfToken);
      return fetch(PAY_API + "?action=create_checkout", {
        method: "POST",
        credentials: "same-origin",
        headers: { Accept: "application/json", "X-CSRF-Token": csrfToken },
        body: body
      }).then(parseResponse).then(function (json) {
        if (!json.checkout_url) throw new Error("The payment page could not be opened. Please try again.");
        window.location.href = json.checkout_url;   // the redirect to Xendit
        return json;
      });
    }

    /* Xendit sends the customer back here as ?pay=success|cancelled|pending|review|error (&booking=BK-0001) */
    function handlePayReturn() {
      var params;
      try { params = new URLSearchParams(window.location.search); } catch (e) { return; }
      var result = params.get("pay");
      if (!result) return;
      var booking = params.get("booking") || "";
      var messages = {
        success: "Payment received. Your booking is confirmed. Thank you!",
        cancelled: "Payment cancelled. You can pay the deposit anytime from the Quotation tab.",
        pending: "We are still waiting for Xendit to confirm your payment. Please refresh this page in a moment.",
        review: "We received your payment, but our team needs to review it. We will contact you shortly.",
        error: "We could not find that payment. Please contact the catering team."
      };
      if (result.indexOf("balance_") === 0) return;   // a "Request Full Payment": handled on the My Bookings page (handleBalanceReturn)
      var resultType = result === "success" ? "success" : (result === "cancelled" ? "info" : (result === "pending" ? "warning" : (result === "review" ? "warning" : "error")));
      showToast(messages[result] || "", 4500, resultType);
      keepTab = "quote";
      params.delete("pay");
      params.delete("booking");
      var qs = params.toString();
      if (window.history && window.history.replaceState) {
        window.history.replaceState(null, "", window.location.pathname + (qs ? "?" + qs : "") + window.location.hash);
      }
    }

    function renderQuote(record) {
      if (!quotePanel) return;
      empty(quotePanel);
      var quotation = record.quotation || record.quote || null;
      if (!quotation) {
        /* no quotation yet: say where the inquiry is and what happens next, instead of one flat line */
        var stageNow = asText(firstValue(record, ["status", "stage"])).toLowerCase();
        var emptyTitle, emptyText;
        if (/declin|cancel/.test(stageNow)) {
          emptyTitle = "No quotation for this inquiry";
          emptyText = "This inquiry was closed, so no quotation will be prepared. You are welcome to send a new inquiry anytime.";
        } else if (/new inquiry/.test(stageNow)) {
          emptyTitle = "We received your inquiry";
          emptyText = "A member of our catering team will review it soon and prepare your quotation. You will be notified here and in your Inbox as soon as it is ready.";
        } else {
          emptyTitle = "Your quotation is being prepared";
          emptyText = "Our catering team is working on it. You will be notified here and in your Inbox as soon as it is ready. You can message the team from your Inbox if you have questions.";
        }
        var emptyBox = make("div", "ci-callout");
        emptyBox.appendChild(make("span", "ci-callout-icon", "\u20B1"));
        var emptyBody = make("div", "");
        emptyBody.appendChild(make("h4", "", emptyTitle));
        emptyBody.appendChild(make("p", "", emptyText));
        emptyBox.appendChild(emptyBody);
        quotePanel.appendChild(emptyBox);
        return;
      }
      var status = asText(quotation.status);
      var expired = quotation.is_expired === true;
      var callout = make("div", "ci-callout");
      callout.appendChild(make("span", "ci-callout-icon", "₱"));
      var intro = make("div", "");
      var heading = (asText(firstValue(quotation, ["title"])) || "Quotation") + (status ? " · " + (expired ? "Expired" : status) : "");
      intro.appendChild(make("h4", "", heading));
      var line = [quotation.validity ? "Valid until " + quotation.validity : ""].filter(Boolean).join(" · ");
      if (line) intro.appendChild(make("p", "", line));
      if (quotation.message) intro.appendChild(make("p", "", asText(quotation.message)));
      callout.appendChild(intro);
      quotePanel.appendChild(callout);

      var items = quotation.items || quotation.lines || [];
      if (Array.isArray(items) && items.length) {
        var summary = make("section", "ci-summary ci-box");
        summary.appendChild(make("h4", "", "Quotation details"));
        var lines = make("ul", "ci-lines");
        items.forEach(function (item) {
          var row = make("li", "");
          var qty = Number(item.quantity);
          var label = asText(item.description || item.name || item.label);
          if (qty && qty !== 1) label += " × " + qty + (item.unit_price !== undefined ? " @ " + peso(item.unit_price) : "");
          row.appendChild(make("span", "", label));
          var amount = item.amount !== undefined ? item.amount : item.total;
          row.appendChild(make("strong", "", amount === undefined ? "" : peso(amount)));
          lines.appendChild(row);
        });
        if (Number(quotation.extra_charge) > 0) {
          var extraLine = make("li", "");
          extraLine.appendChild(make("span", "", "Additional fee"));
          extraLine.appendChild(make("strong", "", peso(quotation.extra_charge)));
          lines.appendChild(extraLine);
        }
        if (Number(quotation.discount) > 0) {
          var discLine = make("li", "");
          discLine.appendChild(make("span", "", "Discount"));
          discLine.appendChild(make("strong", "", "\u2212" + peso(quotation.discount)));
          lines.appendChild(discLine);
        }
        var total = firstValue(quotation, ["total", "total_amount"]);
        if (total !== "") {
          var totalLine = make("li", "ci-total");
          totalLine.appendChild(make("span", "", "Total"));
          totalLine.appendChild(make("strong", "", peso(total)));
          lines.appendChild(totalLine);
        }
        if (quotation.deposit_amount && !record.booking) {
          var dep = make("li", "");
          dep.appendChild(make("span", "", "Deposit to reserve your date (" + (quotation.deposit_rate || 20) + "%)"));
          dep.appendChild(make("strong", "", peso(quotation.deposit_amount)));
          lines.appendChild(dep);
          var bal = make("li", "");
          bal.appendChild(make("span", "", "Balance after the deposit"));
          bal.appendChild(make("strong", "", peso(quotation.balance_after_deposit)));
          lines.appendChild(bal);
        }
        summary.appendChild(lines);
        quotePanel.appendChild(summary);
      }

      var actions = make("div", "ci-actions align-items-center mt-3");
      var paid = !!record.booking;
      var finishResponse = function (json) {
        keepIndex = inquiries.indexOf(record);
        keepTab = "quote";
        showToast((json && json.message) || "Done.");
        loadInquiries();
      };
      /* "Request changes": the customer changed her mind. Allowed while the quotation is Sent, or Accepted but not yet paid. */
      var addChangeButton = function () {
        var change = make("button", "ci-btn-outline", "Request changes");
        change.type = "button";
        change.addEventListener("click", function () {
          changeDialog({
            title: "Request changes to this quotation?",
            message: status === "Accepted"
              ? "You already accepted this quotation. Sending a change request cancels that acceptance, and the catering team will send you a revised quotation. Nothing has been charged yet."
              : "Tell us what you would like to adjust and the catering team will send you a revised quotation.",
            confirmText: "Send change request"
          }).then(function (text) {
            if (text === null) return;
            change.disabled = true;
            respondToQuotation(quotation, "change", text).then(finishResponse).catch(function (error) {
              change.disabled = false;
              showToast(error.message || "Could not send your change request.", 4500, "error");
            });
          });
        });
        actions.appendChild(change);
      };
      if (status === "Sent" && !expired && quotation.quotation_id) {
        var accept = make("button", "ci-btn-primary", "Accept quotation");
        accept.type = "button";
        var decline = make("button", "ci-btn-outline", "Decline");
        decline.type = "button";
        var busy = function (on) { accept.disabled = on; decline.disabled = on; };
        var finish = finishResponse;
        accept.addEventListener("click", function () {
          confirmDialog({
            title: "Accept this quotation?",
            message: "Total " + peso(quotation.total) + ". We will let the catering team know that you accept. You can then pay the " + peso(quotation.deposit_amount) + " deposit with the Pay deposit button to confirm your booking.",
            confirmText: "Accept quotation"
          }).then(function (ok) {
            if (!ok) return;
            busy(true);
            // only sends the acceptance (and the "I accept quotation..." chat message); payment is a separate step
            respondToQuotation(quotation, "accept", "").then(function (json) {
              finish({ message: (json && json.message) || "Quotation accepted. You can now pay the deposit to confirm your booking." });
            }).catch(function (error) { busy(false); showToast(error.message || "Could not accept the quotation.", 4500, "error"); });
          });
        });
        decline.addEventListener("click", function () {
          reasonDialog({
            title: "Decline this quotation?",
            message: "Let us know why so we can send you a better quotation.",
            confirmText: "Decline quotation"
          }).then(function (reason) {
            if (reason === null) return;
            busy(true);
            respondToQuotation(quotation, "decline", reason).then(finish).catch(function (error) { busy(false); showToast(error.message || "Could not decline the quotation.", 4500, "error"); });
          });
        });
        actions.appendChild(accept);
        actions.appendChild(decline);
        addChangeButton();
      } else if (status === "Sent" && expired && quotation.quotation_id) {
        addChangeButton();   // expired: she can still ask for a revised quotation
      }
      if (status === "Accepted" && !paid && quotation.quotation_id) {
        var pay = make("button", "ci-btn-primary", "Pay deposit " + peso(quotation.deposit_amount));
        pay.type = "button";
        pay.addEventListener("click", function () {
          pay.disabled = true;
          startPayment(quotation).catch(function (error) {
            pay.disabled = false;
            showToast(error.message || "Could not open the payment page.", 4500, "error");
          });
        });
        actions.appendChild(pay);
        addChangeButton();   // changed her mind after accepting, before paying
      }
      quotePanel.appendChild(actions);

      if (Array.isArray(quotation.history) && quotation.history.length > 1) {
        var history = make("details", "ci-quote-history");
        history.appendChild(make("summary", "", "Quotation history (" + quotation.history.length + " versions)"));
        quotation.history.forEach(function (version) {
          history.appendChild(make("div", "ci-quote-history-row", "Quotation v" + version.version + " · " + version.status + " · " + peso(version.amount)));
        });
        quotePanel.appendChild(history);
      }

      if (status === "Accepted" && paid) {
        var booking = record.booking;
        var payment = make("section", "ci-payment-confirmed ci-box");
        payment.appendChild(make("h4", "", "Payment Summary"));
        [["Total Amount", booking.total], ["Deposit Paid (20%)", booking.deposit_paid], ["Remaining Balance", booking.remaining_balance]].forEach(function (row) {
          var line = make("div", "ci-payment-line" + (row[0] === "Remaining Balance" ? " is-balance" : ""));
          line.appendChild(make("span", "", row[0])); line.appendChild(make("strong", "", peso(row[1]))); payment.appendChild(line);
        });
        quotePanel.appendChild(payment);
        quotePanel.appendChild(make("div", "ci-payment-verified", "✓  Deposit has been verified. Your booking is now confirmed."));
        var viewBooking = make("button", "ci-btn-primary ci-view-booking", "View Booking Details →");
        viewBooking.type = "button";
        viewBooking.addEventListener("click", function () {
          try { sessionStorage.setItem("crmOpenBookingId", String(booking.booking_id)); } catch (e) { /* continue to the bookings list */ }
          var nav = document.querySelector('a[href*="customer-bookings"], [data-page="customer-bookings.html"]');
          if (typeof window.loadPage === "function") window.loadPage("customer-bookings.html", nav || null);
          else window.location.href = "index.php#bookings";
        });
        quotePanel.appendChild(viewBooking);
      } else if (status === "Accepted") {
        quotePanel.appendChild(make("div", "ci-note", "You accepted this quotation. Pay the " + peso(quotation.deposit_amount) + " deposit online (GCash or Maya) to confirm your booking."));
      } else if (status === "Declined") {
        quotePanel.appendChild(make("div", "ci-note", "You declined this quotation or asked for changes. The catering team will send a revised version."));
      } else if (expired) {
        quotePanel.appendChild(make("div", "ci-note", "This quotation has expired. Please message the catering team for a new one."));
      }
    }

    function activateTab(name) {
      var showQuote = name === "quote";
      if (detailsPanel) detailsPanel.hidden = showQuote;
      if (quotePanel) quotePanel.hidden = !showQuote;
      if (detailsTab) {
        detailsTab.classList.toggle("active", !showQuote);
        detailsTab.setAttribute("aria-selected", String(!showQuote));
        detailsTab.tabIndex = showQuote ? -1 : 0;
      }
      if (quoteTab) {
        quoteTab.classList.toggle("active", showQuote);
        quoteTab.setAttribute("aria-selected", String(showQuote));
        quoteTab.tabIndex = showQuote ? 0 : -1;
      }
    }

    function selectInquiry(record, index, mobileDetail) {
      page.querySelectorAll(".ci-card").forEach(function (card) {
        var selected = Number(card.getAttribute("data-ci-index")) === index;
        card.classList.toggle("is-selected", selected);
        card.setAttribute("aria-pressed", String(selected));
      });
      if (heroTitle) heroTitle.textContent = asText(firstValue(record, ["event_name", "inquiry_name", "title", "subject"])) || "Catering inquiry";
      var inquiryRef = asText(firstValue(record, ["inquiry_ref", "reference", "inquiry_reference"]));
      if (heroReference) {
        heroReference.textContent = inquiryRef ? "Inquiry reference · " + inquiryRef : "";
        heroReference.hidden = !inquiryRef;
      }
      var displayStatus = record.booking ? "Converted to Booking" : (asText(firstValue(record, ["status", "inquiry_status", "stage"])) || "Submitted");
      if (heroStatus) heroStatus.textContent = displayStatus;
      if (heroStatus) heroStatus.dataset.status = displayStatus;
      if (heroDescription) heroDescription.textContent = record.booking ? "This inquiry is linked to confirmed booking " + (record.booking.booking_ref || "") + ". Its details and quotation history remain available here." : (record.quotation && record.quotation.status === "Sent" ? "Your quotation is ready for review." : (record.quotation && record.quotation.status === "Accepted" ? "Your quotation has been accepted. Pay the deposit to confirm your booking." : "Your inquiry is currently " + displayStatus.toLowerCase() + ". We’ll prepare a quotation for you soon."));
      if (heroStatus && heroStatus.closest(".ci-hero")) heroStatus.closest(".ci-hero").classList.toggle("is-negative", /declin|cancel/i.test(heroStatus.textContent));   // red banner
      if (eventStrip) {
        empty(eventStrip);
        [["bi-calendar-event","Event Date",fmtDay(firstValue(record,["event_date","date"]))], ["bi-clock","Pickup Time",asText(record.event_time_display)||asText(record.event_time)], ["bi-layers","Arrangement",asText(firstValue(record,["arrangement","service_arrangement"]))], ["bi-cake2","Event Type",asText(firstValue(record,["event_type","type"])) || "—"]].forEach(function (v) {
          var cell=make("div","ci-event-summary-item"); cell.appendChild(make("i","bi "+v[0])); var copy=make("div",""); copy.appendChild(make("strong","",v[1])); copy.appendChild(make("span","",v[2]||"—")); cell.appendChild(copy); eventStrip.appendChild(cell);
        });
      }
      renderSteps(record);
      renderDetails(record);
      renderQuote(record);
      activateTab(record.booking ? "quote" : "details");
      if (mobileDetail) page.setAttribute("data-ci-view", "detail");
    }

    function renderEmptyStructure() {
      page.setAttribute("data-ci-view", "empty");
      if (inquiryCount) inquiryCount.textContent = "0 inquiries";
      if (heroTitle) heroTitle.textContent = "Inquiry Overview";
      if (heroStatus) heroStatus.textContent = "0 inquiries";
      if (emptyState) emptyState.hidden = false;
      if (layout) layout.hidden = true;
      if (stepper) stepper.hidden = true;
    }
    function renderList(rows) {
      empty(list);
      rows = sortInquiries(rows);   // New, In Progress, Quotation Sent, other upcoming, date passed, declined / cancelled
      inquiries = rows;
      rows.forEach(function (record, index) {
        var item = document.createElement("li");
        var button = make("button", "ci-card");
        button.type = "button";
        button.setAttribute("data-ci-index", String(index));
        button.setAttribute("aria-pressed", "false");
        var body = make("span", "ci-card-body");
        body.appendChild(make("span", "ci-card-title", asText(firstValue(record, ["event_name", "inquiry_name", "title", "subject"])) || "Catering inquiry"));
        var meta = make("span", "ci-card-meta");
        var date = asText(firstValue(record, ["event_date", "date", "created_at"]));
        if (date) meta.appendChild(make("span", "", fmtDay(date) || date));
        var phase = inquiryPhase(record);
        meta.appendChild(make("span", "list-phase " + ["is-upcoming", "is-finished", "is-cancelled"][phase], inquiryPhaseLabels(record)[phase]));
        body.appendChild(meta);
        var status = make("span", "ci-pill", asText(firstValue(record, ["status", "inquiry_status"])) || "Submitted");
        if (/declin|cancel/i.test(status.textContent)) status.classList.add("ci-pill-negative");   // declined / cancelled show in red
        var chevron = make("i", "bi bi-chevron-right ci-card-chevron");
        chevron.setAttribute("aria-hidden", "true");
        button.appendChild(body);
        button.appendChild(status);
        button.appendChild(chevron);
        item.appendChild(button);
        list.appendChild(item);
      });

      if (inquiryCount) {
        inquiryCount.textContent = rows.length + (rows.length === 1 ? " inquiry" : " inquiries");
      }
      if (!rows.length) {
        renderEmptyStructure();
        showState("0 inquiries yet. Your requests will appear here.", false, false);
        return;
      }
      if (emptyState) emptyState.hidden = true;
      state.hidden = true;
      layout.hidden = false;
      page.setAttribute("data-ci-view", "list");
      var pick = keepIndex >= 0 && rows[keepIndex] ? keepIndex : 0;
      selectInquiry(rows[pick], pick, false);
      if (keepTab) { activateTab(keepTab); keepTab = ""; }
      keepIndex = -1;
    }

    function loadInquiries() {
      showState("Loading your inquiries...", false, false);
      fetch(API + "?action=list", {
        method: "GET",
        credentials: "same-origin",
        headers: { Accept: "application/json" },
        cache: "no-store"
      })
        .then(parseResponse)
        .then(function (json) {
          var rows = json.inquiries || json.data || json.items || json.records || [];
          if (!Array.isArray(rows)) throw new Error("The inquiry service returned an invalid list.");
          if (json.csrf_token) csrfToken = json.csrf_token;
          renderList(rows);
        })
        .catch(function (error) {
          console.warn("Inquiry list is not available yet:", error);
          if (!inquiries.length) {
            renderEmptyStructure();
            showState("0 inquiries available. Your records will appear here when the backend is connected.", false, true);
          } else {
            state.hidden = true;
            layout.hidden = false;
          }
        });
    }

    list.addEventListener("click", function (event) {
      var card = event.target.closest ? event.target.closest(".ci-card") : null;
      if (!card) return;
      var index = Number(card.getAttribute("data-ci-index"));
      if (inquiries[index]) selectInquiry(inquiries[index], index, true);
    });
    if (back) back.addEventListener("click", function () { page.setAttribute("data-ci-view", "list"); });
    if (detailsTab) detailsTab.addEventListener("click", function () { activateTab("details"); });
    if (quoteTab) quoteTab.addEventListener("click", function () { activateTab("quote"); });
    page.querySelector(".ci-tabs")?.addEventListener("keydown", function (event) {
      if (event.key !== "ArrowLeft" && event.key !== "ArrowRight") return;
      event.preventDefault();
      if (event.target === detailsTab) { activateTab("quote"); if (quoteTab) quoteTab.focus(); }
      else { activateTab("details"); if (detailsTab) detailsTab.focus(); }
    });
    document.addEventListener("crm:inquiry-submitted", function (event) {
      if (!document.body.contains(page)) return;
      var message = event.detail && event.detail.message;
      showToast(message || "Inquiry submitted.");
      loadInquiries();
    });

    handlePayReturn();
    loadInquiries();
  }

  function scan() {
    document.querySelectorAll("#ciPage").forEach(initInquiryListPage);
  }
  function start() {
    scan();
    new MutationObserver(scan).observe(document.body, { childList: true, subtree: true });
  }
  if (document.body) start();
  else document.addEventListener("DOMContentLoaded", start);
})();


/* Customer Inbox: DOM-only behavior; records and attachments come from customer-inbox-api.php. */
(function () {
  "use strict";

  function initCustomerInbox(page) {
    if (!page || page.dataset.cibReady === "true") return;
    page.dataset.cibReady = "true";

    var endpoint = page.dataset.apiUrl || "customer-inbox-api.php";
    var state = { conversations: [], tickets: [], conversationId: "", ticketId: "", conversationsLoaded: false, conversationsLoadFailed: false };
    var $ = function (selector) { return page.querySelector(selector); };
    var byId = function (id) { return document.getElementById(id); };

    function endpointUrl(action, params) {
      var url = new URL(endpoint, window.location.href);
      url.searchParams.set("action", action);
      Object.keys(params || {}).forEach(function (key) {
        if (params[key] !== undefined && params[key] !== null) url.searchParams.set(key, String(params[key]));
      });
      return url.toString();
    }

    async function request(action, options, params) {
      var controller = typeof window.AbortController === "function" ? new AbortController() : null;
      var timer;
      var fetchOptions = Object.assign({ credentials: "same-origin" }, options || {});
      if (controller) fetchOptions.signal = controller.signal;
      var operation = (async function () {
        var response = await fetch(endpointUrl(action, params), fetchOptions);
        var payload;
        var responseText = await response.text();
        try { payload = responseText ? JSON.parse(responseText) : {}; }
        catch (error) { throw new Error("Inbox API returned non-JSON (HTTP " + response.status + "). Check customer-inbox-api.php and its response format."); }
        if (!response.ok || !payload || typeof payload !== "object" || payload.success === false || payload.error) {
          throw new Error((payload && (payload.message || payload.error)) || "Request failed (HTTP " + response.status + ").");
        }
        return payload;
      })();
      var timeout = new Promise(function (resolve, reject) {
        timer = window.setTimeout(function () {
          if (controller) controller.abort();
          reject(new Error("The inbox service took too long to respond. Please try again."));
        }, 15000);
      });
      try { return await Promise.race([operation, timeout]); }
      finally { window.clearTimeout(timer); }
    }

    function records(payload, keys) {
      if (Array.isArray(payload)) return payload;
      for (var i = 0; i < keys.length; i += 1) if (Array.isArray(payload[keys[i]])) return payload[keys[i]];
      if (payload.data && Array.isArray(payload.data)) return payload.data;
      return [];
    }

    function value(record, keys, fallback) {
      for (var i = 0; i < keys.length; i += 1) {
        var item = record && record[keys[i]];
        if (item !== undefined && item !== null && item !== "") return item;
      }
      return fallback || "";
    }

    function setState(node, message, visible) {
      if (!node) return;
      node.textContent = message || "";
      node.hidden = !visible;
    }

    // "No results found" card (green search icon + title + hint) - same design as the Users search
    function setNoResults(node, hint) {
      if (!node) return;
      var box = document.createElement("div");
      box.className = "crm-no-results-state";
      var icon = document.createElement("i");
      icon.className = "bi bi-search";
      icon.setAttribute("aria-hidden", "true");
      var title = document.createElement("p");
      title.className = "crm-no-results-title";
      title.textContent = "No results found";
      var desc = document.createElement("p");
      desc.className = "crm-no-results-description";
      desc.textContent = hint;
      box.append(icon, title, desc);
      node.replaceChildren(box);
      node.hidden = false;
    }

    function make(tag, className, text) {
      var node = document.createElement(tag);
      if (className) node.className = className;
      if (text !== undefined && text !== null) node.textContent = String(text);
      return node;
    }

    function dateText(input) {
      if (!input) return "";
      var date = new Date(input);
      return Number.isNaN(date.getTime()) ? String(input) : date.toLocaleString();
    }

    // same time / size formats as the staff inboxes
    function parseDate(input) { return new Date(String(input || "").trim().replace(" ", "T")); }
    function listTime(input) {
      var d = parseDate(input);
      if (Number.isNaN(d.getTime())) return "";
      return d.toDateString() === new Date().toDateString()
        ? d.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" })
        : d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
    }
    function messageTime(input) {
      var d = parseDate(input);
      if (Number.isNaN(d.getTime())) return String(input || "");
      return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }) + " - " +
        d.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" });
    }
    function fileSizeText(bytes) {
      var n = Number(bytes);
      if (!n) return "";
      return n >= 1048576 ? (n / 1048576).toFixed(1) + " MB" : Math.max(1, Math.round(n / 1024)) + " KB";
    }
    function ticketStatusClass(status) {
      return /resolved|closed/i.test(status) ? "stage-new" : /progress/i.test(status) ? "stage-qualified" : /pending/i.test(status) ? "stage-proposal" : "stage-won";
    }
    function isPhone() { return window.matchMedia("(max-width: 991.98px)").matches; }
    function showError(node, error, retry) {
      setState(node, error && error.message ? error.message : "Something went wrong. Please try again.", true);
      if (node && typeof retry === "function") {
        var button = document.createElement("button");
        button.type = "button";
        button.className = "cib-retry";
        button.textContent = "Try again";
        button.addEventListener("click", retry);
        node.appendChild(button);
      }
    }

    function setActiveTab(tab) {
      var messagesActive = tab === "messages";
      $("#cibMessagesTab").setAttribute("aria-selected", String(messagesActive));
      $("#cibConcernsTab").setAttribute("aria-selected", String(!messagesActive));
      $("#cibMessagesPanel").hidden = !messagesActive;
      $("#cibConcernsPanel").hidden = messagesActive;
      $("#cibMessagesPanel").classList.toggle("is-active", messagesActive);
      $("#cibConcernsPanel").classList.toggle("is-active", !messagesActive);
      var inboxEmpty = $("#cibInboxEmpty");
      if (inboxEmpty) {
        var showEmpty = messagesActive && state.conversationsLoaded && !state.conversationsLoadFailed && state.conversations.length === 0 && !$("#cibConversationSearch").value.trim();
        var conversationEmpty = $("#cibConversationEmpty");
        inboxEmpty.hidden = !showEmpty;
        if (conversationEmpty) conversationEmpty.hidden = !showEmpty;
        $("#cibMessagesPanel").hidden = !messagesActive;
        $("#cibMessagesPanel").classList.toggle("is-active", messagesActive);
        $("#cibMessagesPanel").classList.toggle("is-empty", showEmpty);
        $("#cibThreadHeader").hidden = showEmpty;
        $("#cibMessageFeed").hidden = showEmpty;
        $("#cibMessageForm").hidden = showEmpty || !state.conversationId;
      }
    }

    /* Phone layout: the list shows first; opening a conversation / ticket shows the chat
       full height, and the Back button returns to the list. (Desktop ignores this class.) */
    function openThreadView(panelId) {
      var panel = document.getElementById(panelId);
      if (panel) panel.classList.add("is-thread-open");
    }

    function closeThreadView(panelId) {
      var panel = document.getElementById(panelId);
      if (panel) panel.classList.remove("is-thread-open");
    }

    document.querySelectorAll("#cibPage .cib-back-button").forEach(function (btn) {
      btn.addEventListener("click", function () { closeThreadView(btn.getAttribute("data-back-to")); });
      // same arrow + look as the staff inboxes
      var svg = btn.querySelector("svg");
      if (svg) { var arrow = document.createElement("i"); arrow.className = "bi bi-arrow-left"; arrow.setAttribute("aria-hidden", "true"); svg.replaceWith(arrow); }
      btn.classList.add("iq-back");
    });

    // list header like the staff inboxes: chat icon + CONVERSATIONS ... "N Unread" pill
    (function () {
      var countNode = $("#cibConversationCount");
      var header = countNode && countNode.closest(".cib-list-header");
      if (!header) return;
      var oldTitle = header.querySelector("h2");
      var row = make("div", "csi-list-title");
      var title = make("div", "iq-pool-title");
      title.innerHTML = '<i class="bi bi-chat-dots-fill" aria-hidden="true"></i>';
      title.append(document.createTextNode("Conversations"));
      row.append(title, countNode);
      if (oldTitle) oldTitle.replaceWith(row); else header.prepend(row);
    })();

    function renderConversations() {
      var list = $("#cibConversationList");
      var query = $("#cibConversationSearch").value.trim().toLowerCase();
      var conversationEmpty = $("#cibConversationEmpty");
      Array.prototype.forEach.call(list.querySelectorAll(".csi-item"), function (item) { item.remove(); });
      var inboxEmpty = $("#cibInboxEmpty");
      var showEmpty = state.conversationsLoaded && !state.conversationsLoadFailed && state.conversations.length === 0 && !query;
      if (inboxEmpty) inboxEmpty.hidden = !showEmpty;
      if (conversationEmpty) conversationEmpty.hidden = !showEmpty;
      var messagesPanel = $("#cibMessagesPanel");
      if (messagesPanel) {
        var messagesActive = $("#cibMessagesTab").getAttribute("aria-selected") === "true";
        messagesPanel.hidden = !messagesActive;
        messagesPanel.classList.toggle("is-active", messagesActive);
        messagesPanel.classList.toggle("is-empty", showEmpty);
        $("#cibThreadHeader").hidden = showEmpty;
        $("#cibMessageFeed").hidden = showEmpty;
        $("#cibMessageForm").hidden = showEmpty || !state.conversationId;
      }
      var filtered = state.conversations.filter(function (item) {
        var haystack = [value(item, ["title", "subject", "event_name", "inquiry_name"]), value(item, ["last_message", "preview"])].join(" ").toLowerCase();
        var matchesQuery = !query || haystack.includes(query);
        return matchesQuery;
      });
      var unreadTotal = state.conversations.filter(function (c) { return Number(value(c, ["unread_count", "unread"], 0)) > 0; }).length;
      var countNode = $("#cibConversationCount");
      countNode.classList.add("stage-pill", "stage-won");
      countNode.textContent = unreadTotal + " Unread";
      countNode.hidden = unreadTotal === 0;
      if (!filtered.length && query) setNoResults($("#cibConversationState"), "Try a different search term.");
      else setState($("#cibConversationState"), state.conversations.length ? "No conversations match your search." : "No conversations yet.", !filtered.length && !showEmpty);
      filtered.forEach(function (item) {
        var id = value(item, ["conversation_id", "id"]);
        if (!id) return;
        var button = make("button", "csi-item");
        button.type = "button";
        button.dataset.conversationId = String(id);
        button.setAttribute("aria-current", String(String(id) === String(state.conversationId)));
        var top = make("span", "csi-item-top");
        top.append(make("span", "csi-item-name", value(item, ["title", "subject", "event_name", "inquiry_name"], "Conversation")));
        var unreadCount = Number(value(item, ["unread_count", "unread"], 0));
        if (unreadCount > 0) { var dot = make("span", "csi-dot"); dot.setAttribute("aria-label", "Unread"); top.append(dot); }
        top.append(make("span", "csi-item-time", listTime(value(item, ["updated_at", "last_message_at"]))));
        button.append(top);
        var sender = value(item, ["team_name", "staff_name", "sender_name"]);
        if (sender) button.append(make("span", "csi-item-sender", sender));
        button.append(make("span", "csi-item-preview", value(item, ["last_message", "preview"], "")));
        button.addEventListener("click", function () { openThreadView("cibMessagesPanel"); selectConversation(String(id)); });
        list.append(button);
      });
    }

    function renderTickets() {
      var list = $("#cibTicketList");
      var query = $("#cibTicketSearch").value.trim().toLowerCase();
      list.replaceChildren();
      var filtered = state.tickets.filter(function (ticket) {
        return [value(ticket, ["subject", "title", "concern"]), value(ticket, ["status", "state"])].join(" ").toLowerCase().includes(query);
      });
      if (!filtered.length && query) setNoResults($("#cibTicketState"), "Try a different search term.");
      else setState($("#cibTicketState"), filtered.length ? "" : "You have no support tickets yet.", !filtered.length);
      filtered.forEach(function (ticket) {
        var id = value(ticket, ["ticket_id", "id"]);
        if (!id) return;
        var button = make("button", "csi-item");
        button.type = "button";
        button.dataset.ticketId = String(id);
        button.setAttribute("aria-current", String(String(id) === String(state.ticketId)));
        var top = make("span", "csi-item-top");
        top.append(make("span", "csi-item-name", value(ticket, ["subject", "title", "concern"], "Support request")));
        top.append(make("span", "csi-item-time", listTime(value(ticket, ["updated_at", "created_at"]))));
        button.append(top);
        var meta = make("span", "csi-item-meta");
        var ticketStatus = String(value(ticket, ["status", "state"], "Open"));
        meta.append(make("span", "stage-pill " + ticketStatusClass(ticketStatus), ticketStatus));
        if (Number(value(ticket, ["unread_count", "unread"], 0)) > 0) { var tdot = make("span", "csi-dot"); tdot.setAttribute("aria-label", "Unread"); meta.append(tdot); }
        button.append(meta);
        var tPreview = value(ticket, ["last_message", "preview"], "");
        if (tPreview) button.append(make("span", "csi-item-preview", tPreview));
        button.addEventListener("click", function () { openThreadView("cibConcernsPanel"); selectTicket(String(id)); });
        list.append(button);
      });
    }

    function renderQuote(quote) {
      if (!quote || typeof quote !== "object") return null;
      var card = make("article", "cib-quote");
      var head = make("div", "cib-quote-head");
      head.append(make("span", "", value(quote, ["title", "name"], "Quotation Summary")));
      card.append(head);
      var groups = Array.isArray(quote.groups) ? quote.groups : (Array.isArray(quote.sections) ? quote.sections : []);
      groups.forEach(function (group) {
        var section = make("div", "cib-quote-section");
        section.append(make("span", "", value(group, ["title", "name"], "Items")));
        if (value(group, ["total", "amount"])) section.append(make("span", "", value(group, ["total", "amount"])));
        card.append(section);
        (Array.isArray(group.items) ? group.items : []).forEach(function (line) {
          var row = make("div", "cib-quote-line");
          row.append(make("span", "", value(line, ["name", "description", "label"], "Item")));
          row.append(make("strong", "", value(line, ["amount", "total", "price"], "")));
          card.append(row);
        });
      });
      ["subtotal", "service_fee", "delivery_fee", "total", "required_deposit"].forEach(function (key) {
        if (value(quote, [key]) === "") return;
        var row = make("div", key === "total" ? "cib-quote-total" : "cib-quote-line");
        var label = key.replaceAll("_", " ").toUpperCase();
        row.append(make("span", "", label));
        row.append(make("strong", "", value(quote, [key])));
        card.append(row);
      });
      return card;
    }

    /* "Request Full Payment" card (same card classes as the quotation card): amount, due date and a Pay Now button
       that opens Xendit through xendit-api.php?action=pay_request. */
    function cibPayCard(p) {
      if (!p || typeof p !== "object") return null;
      var card = make("article", "cib-quote");
      var head = make("div", "cib-quote-head");
      head.append(make("span", "", "Full payment request"));
      head.append(make("span", "cib-tag", p.status === "Pending" ? (p.is_overdue ? "Overdue" : "Awaiting payment") : String(p.status || "")));
      card.append(head);
      var rows = [["Event", p.event_name], ["Pay by", p.due_label]];
      if (p.status === "Paid" && p.method) rows.push(["Paid via", p.method]);
      rows.forEach(function (r) {
        if (!r[1]) return;
        var row = make("div", "cib-quote-line");
        row.append(make("span", "", r[0]));
        row.append(make("strong", "", r[1]));
        card.append(row);
      });
      var total = make("div", "cib-quote-total");
      total.append(make("span", "", "AMOUNT DUE"));
      total.append(make("strong", "", p.amount_label || ""));
      card.append(total);
      if (p.status === "Pending" && p.pay_url) {
        var payRow = make("div", "cib-quote-line");
        payRow.append(make("span", "", "Pay online with GCash or Maya"));
        var pay = make("button", "cib-primary", "Pay Now");
        pay.type = "button";
        pay.addEventListener("click", function () { window.location.href = p.pay_url; });
        payRow.append(pay);
        card.append(payRow);
      }
      return card;
    }

    /* Opens My Bookings on the Feedback tab of one booking (the sidebar link is clicked, like the Home page buttons do). */
    function cibOpenFeedback(bookingId) {
      try { sessionStorage.setItem("crmOpenFeedbackBooking", String(bookingId)); } catch (error) { /* continue */ }
      var links = Array.prototype.slice.call(document.querySelectorAll("a[href], [data-page], [data-route], [data-nav], [data-home-route], button"));
      for (var i = 0; i < links.length; i += 1) {
        var link = links[i];
        if (page.contains(link)) continue;
        var href   = (link.getAttribute("href") || "").toLowerCase();
        var dpag   = (link.getAttribute("data-page") || "").toLowerCase();
        var droute = (link.getAttribute("data-route") || "").toLowerCase();
        var dnav   = (link.getAttribute("data-nav") || "").toLowerCase();
        var dhome  = (link.getAttribute("data-home-route") || "").toLowerCase();
        var label  = (link.textContent || "").trim().toLowerCase();
        var target = href + " " + dpag + " " + droute + " " + dnav + " " + dhome;
        if (target.indexOf("customer-bookings") !== -1 || target.indexOf("bookings") !== -1 ||
            label.indexOf("booking") !== -1) {
          link.click(); return;
        }
      }
      // Fallback: navigate to the main app and let the SPA router handle #bookings
      window.location.href = "index.php";
    }

    /* "Rate our service" card the catering team posts after the event is completed (feedback_request from customer-inbox-api.php). */
    function cibFeedbackCard(f) {
      if (!f || typeof f !== "object" || !f.booking_id) return null;
      var card = make("article", "cib-quote");
      var head = make("div", "cib-quote-head");
      head.append(make("span", "", "Rate our service"));
      head.append(make("span", "cib-tag", f.rated ? "Rated" : "Awaiting your rating"));
      card.append(head);
      if (f.event_name) {
        var ev = make("div", "cib-quote-line");
        ev.append(make("span", "", "Event"));
        ev.append(make("strong", "", f.event_name));
        card.append(ev);
      }
      var row = make("div", "cib-quote-line");
      var n = Math.max(0, Math.min(5, Number(f.rating) || 0));
      row.append(make("span", "", f.rated ? "Your rating: " + Array(n + 1).join("\u2605") + Array(6 - n).join("\u2606") + " " + n + "/5" : "It only takes a minute"));
      var go = make("button", "cib-primary", f.rated ? "View / Edit" : "Rate Now");
      go.type = "button";
      go.addEventListener("click", function () { cibOpenFeedback(f.booking_id); });
      row.append(go);
      card.append(row);
      return card;
    }

    function isImageFile(file, url) {
      var mime = String(value(file, ["mime_type", "type", "mime"], "")).toLowerCase();
      if (mime.indexOf("image/") === 0) return true;
      var name = String(value(file, ["name", "filename", "original_name"], "") || url).split("?")[0];
      return /\.(jpe?g|png|gif|webp|bmp|avif)$/i.test(name) || /\.(jpe?g|png|gif|webp|bmp|avif)$/i.test(String(url).split("?")[0]);
    }

    function buildFileCard(file, url, name) {
      var card = make("div", "csi-file");
      var icon = make("span", "tk-icon");
      icon.setAttribute("aria-hidden", "true");
      icon.innerHTML = '<i class="bi bi-paperclip"></i>';
      var main = make("div", "csi-file-main");
      main.append(make("span", "csi-file-name", name));
      var sizeText = fileSizeText(value(file, ["size"]));
      if (sizeText) main.append(make("span", "csi-file-size", "File size: " + sizeText));
      var link = make("a", "btn csi-outline-btn csi-download", "Download");
      link.href = url;
      link.target = "_blank";
      link.rel = "noopener noreferrer";
      link.setAttribute("download", "");
      card.append(icon, main, link);
      return card;
    }

    function appendAttachments(container, attachments) {
      if (!Array.isArray(attachments)) return;
      attachments.forEach(function (file) {
        var url = value(file, ["url", "href", "path"]);
        if (!url) return;
        var name = value(file, ["name", "filename", "original_name"], "Attachment");

        if (!isImageFile(file, url)) {
          container.append(buildFileCard(file, url, name));
          return;
        }

        /* Image: show the photo itself (click to open full size) with a Download button under it. */
        var card = make("div", "csi-image-card");
        var open = make("a", "csi-image-link");
        open.href = url;
        open.target = "_blank";
        open.rel = "noopener noreferrer";
        var img = document.createElement("img");
        img.className = "csi-image";
        img.alt = name;
        img.loading = "lazy";
        img.src = url;
        /* If the image cannot load, fall back to the normal file card so the file is still reachable. */
        img.addEventListener("error", function () {
          card.replaceWith(buildFileCard(file, url, name));
        }, { once: true });
        open.append(img);
        var bar = make("div", "csi-image-bar");
        bar.append(make("span", "csi-file-name", name));
        var link = make("a", "btn csi-outline-btn csi-download", "Download");
        link.href = url;
        link.target = "_blank";
        link.rel = "noopener noreferrer";
        link.setAttribute("download", "");
        bar.append(link);
        card.append(open, bar);
        container.append(card);
      });
    }

    /* Greeting shown right under the customer's own concern in My Concerns.
       It is only displayed here: it is not saved, staff never see it, and it does not change the ticket. */
    function withTicketGreeting(messages, ticket) {
      var ref = value(ticket, ["ticket_number", "ref"], "");
      var greeting = {
        id: "ticket-greeting",
        is_mine: false,
        sender_type: "staff",
        sender_name: "Support Team",
        message: "Thank you for contacting us! We received your concern" + (ref ? " **" + ref + "**" : "") +
                 ". Our Customer Service team will reply here as soon as possible.",
        created_at: value(ticket, ["created_at"], "")
      };
      var list = messages.slice();
      list.splice(Math.min(1, list.length), 0, greeting);   // right after the first message (the concern itself)
      return list;
    }

    function renderMessages(feed, messages) {
      feed.replaceChildren();
      if (!messages.length) {
        feed.append(make("p", "cib-state", "No messages in this conversation yet."));
        return;
      }
      messages.forEach(function (message) {
        var mine = message.is_mine === true || String(value(message, ["direction", "sender_type"], "")).toLowerCase() === "outgoing" || message.from_customer === true;
        var systemUpdate = message.is_system === true;
        var bubble = make("article", "cib-message" + (mine ? " is-mine" : "") + (systemUpdate ? " is-system" : ""));
        var content = value(message, ["message", "body", "content", "text"]);
        if (content) {
          var textBox = make("div", "cib-bubble", "");
          String(content).split(/\*\*(.+?)\*\*/g).forEach(function (part, i) {
            if (!part) return;
            if (i % 2) { var strong = document.createElement("strong"); strong.textContent = part; textBox.append(strong); }
            else textBox.append(document.createTextNode(part));
          });
          bubble.append(textBox);
        }
        appendAttachments(bubble, value(message, ["attachments", "files"], []));
        var quote = renderQuote(value(message, ["quotation", "quote", "quotation_summary"]));
        if (quote) bubble.append(quote);
        var payCard = cibPayCard(value(message, ["payment_request"]));
        if (payCard) bubble.append(payCard);
        var rateCard = cibFeedbackCard(value(message, ["feedback_request"]));
        if (rateCard) bubble.append(rateCard);
        var who = systemUpdate ? (message.system_kind === "system" ? "System update" : "Payment update") : value(message, ["sender_name", "sender", "author_name"], mine ? "You" : "");
        var sent = messageTime(value(message, ["created_at", "sent_at", "timestamp"]));
        bubble.append(make("div", "cib-message-meta", [sent, who].filter(Boolean).join(" · ")));
        feed.append(bubble);
      });
      /* The feed has a fixed height and scrolls: always show the newest message.
         Scroll again after layout and after images load, since they change the height. */
      var toBottom = function () { feed.scrollTop = feed.scrollHeight; };
      toBottom();
      requestAnimationFrame(toBottom);
      Array.prototype.forEach.call(feed.querySelectorAll("img"), function (img) {
        if (!img.complete) img.addEventListener("load", toBottom, { once: true });
      });
    }

    async function loadConversations() {
      var stateNode = $("#cibConversationState");
      setState(stateNode, "Loading conversations…", true);
      try {
        var payload = await request("list_conversations");
        if (!Array.isArray(payload.conversations)) throw new Error("The inbox service returned an invalid conversation list.");
        state.conversations = payload.conversations;
        state.conversationsLoaded = true;
        state.conversationsLoadFailed = false;
        renderConversations();
        if (!state.conversationId && state.conversations.length && !isPhone()) {
          var firstId = value(state.conversations[0], ["conversation_id", "id"]);
          if (firstId) await selectConversation(String(firstId));
        }
      } catch (error) {
        state.conversations = [];
        state.conversationsLoaded = true;
        state.conversationsLoadFailed = true;
        renderConversations();
        showError(stateNode, error, loadConversations);
        return [];
      }
      return state.conversations;
    }

    async function selectConversation(id) {
      state.conversationId = id;
      $("#cibMessageConversationId").value = id;
      $("#cibMessageText").disabled = false;
      $("#cibSendMessage").disabled = false;
      renderConversations();
      var item = state.conversations.find(function (record) { return String(value(record, ["conversation_id", "id"])) === id; }) || {};
      $("#cibThreadTitle").textContent = value(item, ["title", "subject", "event_name", "inquiry_name"], "Conversation");
      $("#cibThreadMeta").textContent = [value(item, ["contact_name", "staff_name", "customer_name"]), value(item, ["event_date", "date"])].filter(Boolean).join(" · ");
      var status = $("#cibThreadStatus");
      status.textContent = value(item, ["status"], "");
      status.hidden = !status.textContent;
      status.className = "stage-pill " + (/closed|resolved|cancel/i.test(status.textContent) ? "stage-new" : "stage-won");
      var feed = $("#cibMessageFeed");
      setState(feed, "Loading messages…", true);
      try {
        var payload = await request("messages", null, { conversation_id: id });
        var messages = records(payload, ["messages", "records"]);
        renderMessages(feed, messages);
        var latestTeamMessage = messages.slice().reverse().find(function (message) {
          var direction = String(value(message, ["direction", "sender_type"], "")).toLowerCase();
          return message.is_mine !== true && direction !== "outgoing" && message.from_customer !== true;
        });
        var teamName = value(item, ["staff_name", "team_name", "department_name"], "") ||
          (latestTeamMessage ? value(latestTeamMessage, ["sender_name", "sender", "author_name"], "") : "");
        $("#cibThreadMeta").textContent = [teamName, value(item, ["event_date", "date"])].filter(Boolean).join(" · ");
        if (item && (Number(item.unread) > 0 || Number(item.unread_count) > 0)) { item.unread = 0; item.unread_count = 0; renderConversations(); }
      } catch (error) { feed.replaceChildren(); feed.append(make("p", "cib-state", error.message)); }
    }

    async function loadTickets() {
      var stateNode = $("#cibTicketState");
      setState(stateNode, "Loading support tickets…", true);
      try {
        var payload = await request("list_tickets");
        state.tickets = records(payload, ["tickets", "records"]);
        renderTickets();
        if (!state.ticketId && state.tickets.length && !isPhone()) {
          var firstId = value(state.tickets[0], ["ticket_id", "id"]);
          if (firstId) await selectTicket(String(firstId));
        }
      } catch (error) { showError(stateNode, error, loadTickets); }
    }

    var replyPlaceholder = $("#cibTicketReplyText").getAttribute("placeholder") || "";

    /* Resolved ticket: show the Resolved badge + Reopen Ticket, lock the reply box.
       Open ticket: unlock the reply box. Only staff can mark a ticket as resolved. */
    function applyTicketState(resolved) {
      $("#cibResolvedBadge").hidden = !resolved;
      $("#cibReopenTicket").hidden = !resolved;
      var text = $("#cibTicketReplyText");
      text.disabled = resolved;
      text.placeholder = resolved ? "This ticket is marked as resolved. Click 'Reopen Ticket' to reply." : replyPlaceholder;
      $("#cibSendTicketReply").disabled = resolved;
      $("#cibReplyAttach").disabled = resolved;
    }

    async function selectTicket(id) {
      state.ticketId = id;
      $("#cibReplyTicketId").value = id;
      renderTickets();
      var ticket = state.tickets.find(function (record) { return String(value(record, ["ticket_id", "id"])) === id; }) || {};
      $("#cibTicketTitle").textContent = value(ticket, ["subject", "title", "concern"], "Support request");
      $("#cibTicketMeta").textContent = [value(ticket, ["status", "state"], "Open"), dateText(value(ticket, ["created_at"]))].filter(Boolean).join(" · ");
      applyTicketState(/resolved|closed/i.test(String(value(ticket, ["status", "state"], ""))));
      var feed = $("#cibTicketFeed");
      feed.replaceChildren(make("p", "cib-state", "Loading ticket messages…"));
      try {
        var payload = await request("ticket_messages", null, { ticket_id: id });
        renderMessages(feed, withTicketGreeting(records(payload, ["messages", "replies", "records"]), ticket));
        if (ticket && (Number(ticket.unread) > 0 || Number(ticket.unread_count) > 0)) { ticket.unread = 0; ticket.unread_count = 0; renderTickets(); }
      } catch (error) { feed.replaceChildren(make("p", "cib-state", error.message)); }
    }

    function wireAttachments(inputId, buttons, labelId) {
      var input = byId(inputId);
      var label = byId(labelId);
      buttons.forEach(function (entry) {
        byId(entry.id).addEventListener("click", function () {
          input.accept = entry.imagesOnly ? "image/*" : "image/*,.pdf,.doc,.docx,.xls,.xlsx";
          input.click();
        });
      });
      input.addEventListener("change", function () {
        if (label) label.textContent = Array.from(input.files || []).map(function (file) { return file.name; }).join(", ");
      });
    }

    $("#cibMessagesTab").addEventListener("click", function () { setActiveTab("messages"); });
    $("#cibConcernsTab").addEventListener("click", function () { setActiveTab("concerns"); });
    $("#cibConversationSearch").addEventListener("input", renderConversations);
    $("#cibTicketSearch").addEventListener("input", renderTickets);

    // Green clear "x" for the two Inbox search boxes, pinned to the right edge of the box.
    // data-clear-ready tells search-clear.js to skip these boxes (no double x).
    ["#cibConversationSearch", "#cibTicketSearch"].forEach(function (sel) {
      var input = $(sel);
      if (!input || !input.parentNode) return;
      input.setAttribute("data-clear-ready", "");
      var row = input.parentNode;
      Array.prototype.forEach.call(row.querySelectorAll(".search-clear-btn"), function (old) { old.remove(); });
      var btn = document.createElement("button");
      btn.type = "button";
      btn.className = "cib-clear-btn";
      btn.setAttribute("aria-label", "Clear search");
      btn.innerHTML = '<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M3 3l10 10M13 3L3 13" stroke="#2bb673" stroke-width="2" stroke-linecap="round" fill="none"/></svg>';
      btn.hidden = !input.value;
      row.appendChild(btn);
      input.addEventListener("input", function () { btn.hidden = !input.value; });
      btn.addEventListener("click", function () {
        input.value = "";
        btn.hidden = true;
        input.dispatchEvent(new Event("input", { bubbles: true }));
        input.focus();
      });
    });

    // The message boxes stay locked until a conversation / ticket is opened.
    // Say so in the placeholder, and restore the normal one when they unlock.
    [["cibMessageText", "Select a conversation to start typing..."], ["cibTicketReplyText", "Select a concern to start typing..."]].forEach(function (pair) {
      var box = $("#" + pair[0]);
      if (!box) return;
      var normal = box.getAttribute("placeholder") || "Type your message...";
      var sync = function () { box.setAttribute("placeholder", box.disabled ? pair[1] : normal); };
      new MutationObserver(sync).observe(box, { attributes: true, attributeFilter: ["disabled"] });
      sync();
    });

    /* Message boxes grow with the text (like Messenger) up to the CSS max-height,
       then show a scrollbar inside the box. */
    function autoGrowComposer(box) {
      if (!box) return;
      box.style.height = "auto";
      var style = window.getComputedStyle(box);
      var max = parseFloat(style.maxHeight) || 140;
      var min = parseFloat(style.minHeight) || 48;
      var chrome = box.offsetHeight - box.clientHeight;
      var wanted = box.scrollHeight + chrome;
      box.style.height = Math.max(min, Math.min(wanted, max)) + "px";
      box.style.overflowY = wanted > max ? "auto" : "hidden";
    }

    ["cibMessageText", "cibTicketReplyText"].forEach(function (id) {
      var box = $("#" + id);
      if (!box) return;
      box.addEventListener("input", function () { autoGrowComposer(box); });
      autoGrowComposer(box);
    });
    window.addEventListener("resize", function () {
      autoGrowComposer($("#cibMessageText"));
      autoGrowComposer($("#cibTicketReplyText"));
    });
    /* switching tabs un-hides a panel, so re-measure then */
    ["cibMessagesTab", "cibConcernsTab"].forEach(function (id) {
      var tab = $("#" + id);
      if (tab) tab.addEventListener("click", function () {
        window.setTimeout(function () {
          autoGrowComposer($("#cibMessageText"));
          autoGrowComposer($("#cibTicketReplyText"));
        }, 0);
      });
    });

    wireAttachments("cibMessageFiles", [{ id: "cibAttachFile" }, { id: "cibAttachImage", imagesOnly: true }], "cibMessageFileLabel");
    wireAttachments("cibReplyFiles", [{ id: "cibReplyAttach" }], "cibTicketReplyFileLabel");

    $("#cibMessageForm").addEventListener("submit", async function (event) {
      event.preventDefault();
      if (!state.conversationId) return;
      var form = event.currentTarget;
      var text = $("#cibMessageText");
      if (!text.value.trim() && !$("#cibMessageFiles").files.length) return;
      var button = $("#cibSendMessage");
      button.disabled = true;
      try {
        var data = new FormData(form);
        data.set("conversation_id", state.conversationId);
        await request("send_message", { method: "POST", body: data });
        form.reset();
        autoGrowComposer(text);
        $("#cibMessageConversationId").value = state.conversationId;
        $("#cibMessageFileLabel").textContent = "";
        await selectConversation(state.conversationId);
      } catch (error) { $("#cibThreadMeta").textContent = error.message; }
      finally { button.disabled = false; }
    });

    $("#cibTicketReplyForm").addEventListener("submit", async function (event) {
      event.preventDefault();
      if (!state.ticketId) return;
      var form = event.currentTarget;
      var text = $("#cibTicketReplyText");
      if (!text.value.trim() && !$("#cibReplyFiles").files.length) return;
      var button = $("#cibSendTicketReply");
      button.disabled = true;
      try {
        var data = new FormData(form);
        data.set("ticket_id", state.ticketId);
        await request("reply_ticket", { method: "POST", body: data });
        form.reset();
        autoGrowComposer(text);
        $("#cibReplyTicketId").value = state.ticketId;
        $("#cibTicketReplyFileLabel").textContent = "";
        await selectTicket(state.ticketId);
      } catch (error) { $("#cibTicketMeta").textContent = error.message; }
      finally { button.disabled = false; }
    });

    var modal = document.getElementById("createTicketModal");
    var ticketForm = document.getElementById("cibCreateTicketForm");
    var discardPrompt = document.getElementById("confirmTicketCloseModal");
    var ticketSubject = document.getElementById("ticketSubject");
    var ticketDescription = document.getElementById("ticketDescription");
    var modalApi = modal && window.bootstrap && window.bootstrap.Modal ? window.bootstrap.Modal.getOrCreateInstance(modal) : null;
    var ticketSnapshot = "";
    var forceTicketClose = false;
    var discardFocusReturn = null;

    /* Subject dropdown: uses the ticket form's own dropdown styles in all-pages.css
       (cib-ticket-dropdown / cib-dropdown-toggle / cib-dropdown-menu / custom-dropdown-item), so it looks like the rest of the site.
       The original #ticketSubject input stays the real field (name="subject"): the backend is unchanged.
       Choosing "Other" shows that input so the customer can type their own subject. */
    var SUBJECT_CHOICES = [
      "Payment problem",
      "Menu or package concern",
      "Delivery or setup concern",
      "Complaint about service or staff",
      "Refund request"
    ];
    var subjectChoice = "";                       // "" = nothing picked yet, "__other" = Other
    ticketSubject.required = false;               // the dropdown decides when a subject is missing (a hidden required field would block the form silently)

    var subjectDd = document.createElement("div");
    subjectDd.className = "cib-ticket-dropdown";
    var subjectToggle = document.createElement("button");
    subjectToggle.type = "button";
    subjectToggle.id = "ticketSubjectChoice";
    subjectToggle.className = "cib-dropdown-toggle";
    subjectToggle.setAttribute("aria-haspopup", "listbox");
    subjectToggle.setAttribute("aria-expanded", "false");
    var subjectLabel = document.createElement("span");
    var subjectChevron = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    subjectChevron.setAttribute("class", "cib-dropdown-chevron");
    subjectChevron.setAttribute("viewBox", "0 0 24 24");
    subjectChevron.setAttribute("aria-hidden", "true");
    subjectChevron.innerHTML = '<path d="m6 9 6 6 6-6"></path>';
    subjectToggle.append(subjectLabel, subjectChevron);

    var subjectMenu = document.createElement("div");
    subjectMenu.className = "cib-dropdown-menu";
    subjectMenu.setAttribute("role", "listbox");
    subjectMenu.hidden = true;
    subjectMenu.style.boxShadow = "none";          // no glow around the list
    var subjectItems = SUBJECT_CHOICES.map(function (label) { return [label, label]; }).concat([["__other", "Other"]]).map(function (pair) {
      var item = document.createElement("button");
      item.type = "button";
      item.className = "custom-dropdown-item";
      item.setAttribute("role", "option");
      item.setAttribute("data-value", pair[0]);
      item.textContent = pair[1];
      subjectMenu.appendChild(item);
      return item;
    });
    subjectDd.append(subjectToggle, subjectMenu);
    ticketSubject.insertAdjacentElement("beforebegin", subjectDd);

    function toggleSubjectMenu(open) {
      subjectMenu.hidden = !open;
      subjectToggle.setAttribute("aria-expanded", String(open));
      subjectChevron.style.transform = open ? "rotate(180deg)" : "";
    }

    function setSubjectChoice(choice) {
      var wasOther = subjectChoice === "__other";
      subjectChoice = choice;
      subjectLabel.textContent = choice === "" ? "Select a subject" : (choice === "__other" ? "Other" : choice);
      subjectLabel.style.opacity = choice === "" ? "0.7" : "";
      subjectToggle.removeAttribute("aria-invalid");
      subjectToggle.style.borderColor = "";
      subjectItems.forEach(function (item) { item.setAttribute("aria-selected", String(item.getAttribute("data-value") === choice)); });
      if (choice === "__other") {
        if (!wasOther) ticketSubject.value = "";
        ticketSubject.style.display = "";
        ticketSubject.style.marginTop = "10px";
        ticketSubject.placeholder = "Type your subject";
        ticketSubject.required = true;
      } else {
        ticketSubject.value = choice;             // "" until a subject is picked, so an empty subject is never sent
        ticketSubject.style.display = "none";
        ticketSubject.required = false;
      }
    }

    subjectToggle.addEventListener("click", function () { toggleSubjectMenu(subjectMenu.hidden); });
    subjectMenu.addEventListener("click", function (event) {
      var item = event.target.closest ? event.target.closest(".custom-dropdown-item") : null;
      if (!item) return;
      setSubjectChoice(item.getAttribute("data-value"));
      toggleSubjectMenu(false);
      if (subjectChoice === "__other") ticketSubject.focus(); else subjectToggle.focus();
    });
    document.addEventListener("click", function (event) { if (!subjectMenu.hidden && !subjectDd.contains(event.target)) toggleSubjectMenu(false); });
    document.addEventListener("keydown", function (event) {
      if (event.key === "Escape" && !subjectMenu.hidden) { event.stopImmediatePropagation(); toggleSubjectMenu(false); subjectToggle.focus(); }
    }, true);
    ticketForm.addEventListener("reset", function () { window.setTimeout(function () { setSubjectChoice(""); toggleSubjectMenu(false); }, 0); });
    setSubjectChoice("");

    function ticketFormSnapshot() {
      return [ticketSubject.value.trim(), ticketDescription.value.trim()].join("\u0000");
    }

    function ticketHasChanges() { return ticketFormSnapshot() !== ticketSnapshot; }

    function clearTicketForm() {
      ticketForm.reset();
      setState(document.getElementById("cibCreateTicketState"), "", false);
    }

    function showTicketModal() {
      clearTicketForm();
      ticketSnapshot = ticketFormSnapshot();
      if (modalApi) modalApi.show();
      else { modal.style.display = "block"; modal.classList.add("show"); modal.setAttribute("aria-hidden", "false"); document.body.classList.add("modal-open"); }
      window.setTimeout(function () { (subjectChoice === "__other" ? ticketSubject : subjectToggle).focus(); }, 0);
    }

    function hideTicketModal() {
      if (modalApi) modalApi.hide();
      else { modal.classList.remove("show"); modal.style.display = "none"; modal.setAttribute("aria-hidden", "true"); document.body.classList.remove("modal-open"); }
    }

    function openDiscardPrompt() {
      discardFocusReturn = document.activeElement;
      discardPrompt.hidden = false;
      document.getElementById("cibKeepTicketEditing").focus();
    }

    function closeDiscardPrompt() {
      discardPrompt.hidden = true;
      if (discardFocusReturn && discardFocusReturn.focus) discardFocusReturn.focus();
    }

    function requestTicketClose() {
      if (ticketHasChanges()) { openDiscardPrompt(); return; }
      forceTicketClose = true;
      hideTicketModal();
    }

    function finishTicketClose() {
      forceTicketClose = true;
      closeDiscardPrompt();
      hideTicketModal();
      clearTicketForm();
      ticketSnapshot = ticketFormSnapshot();
    }

    $("#cibOpenTicketModal").addEventListener("click", showTicketModal);
    document.getElementById("cibCloseTicketModal").addEventListener("click", requestTicketClose);
    document.getElementById("cibCancelTicketModal").addEventListener("click", requestTicketClose);
    document.getElementById("cibKeepTicketEditing").addEventListener("click", closeDiscardPrompt);
    document.getElementById("cibDiscardTicketChanges").addEventListener("click", finishTicketClose);
    discardPrompt.addEventListener("click", function (event) { if (event.target === discardPrompt) closeDiscardPrompt(); });

    modal.addEventListener("hide.bs.modal", function (event) {
      if (!forceTicketClose && ticketHasChanges()) { event.preventDefault(); openDiscardPrompt(); }
    });
    modal.addEventListener("hidden.bs.modal", function () {
      forceTicketClose = false;
      clearTicketForm();
      ticketSnapshot = ticketFormSnapshot();
      document.getElementById("cibOpenTicketModal").focus();
    });
    modal.addEventListener("click", function (event) {
      if (!modalApi && event.target === modal) requestTicketClose();
    });
    document.addEventListener("keydown", function (event) {
      if (event.key === "Escape" && !discardPrompt.hidden) { event.stopPropagation(); closeDiscardPrompt(); }
      if (event.key === "Escape" && !modalApi && modal.classList.contains("show")) requestTicketClose();
    }, true);

    ticketForm.addEventListener("submit", async function (event) {
      event.preventDefault();
      var button = document.getElementById("cibSubmitTicket");
      var errorNode = document.getElementById("cibCreateTicketState");
      var subject = ticketSubject.value.trim();
      var description = ticketDescription.value.trim();
      if (!subject || !description) {
        if (!subject && subjectChoice !== "__other") {
          subjectToggle.setAttribute("aria-invalid", "true");
          subjectToggle.style.borderColor = "var(--error-color, #ff4d4f)";
          setState(errorNode, "Please choose a subject.", true);
        }
        ticketForm.reportValidity();
        return;
      }
      button.disabled = true;
      setState(errorNode, "Creating ticket…", true);
      try {
        var formData = new FormData(ticketForm);
        /* The backend can use the same details as the first chat message. */
        formData.set("initial_message", description);
        formData.set("message", description);
        var created = await request("create_ticket", { method: "POST", body: formData });
        var data = created && created.data && !Array.isArray(created.data) ? created.data : created;
        var createdTicket = created.ticket || data.ticket || {};
        var createdConversation = created.conversation || data.conversation || createdTicket.conversation || {};
        var conversationId = value(created, ["conversation_id", "conversationId"], value(data, ["conversation_id", "conversationId"], value(createdConversation, ["conversation_id", "id"], value(createdTicket, ["conversation_id"], ""))));
        forceTicketClose = true;
        hideTicketModal();
        clearTicketForm();
        ticketSnapshot = ticketFormSnapshot();
        /* Stay on My Concerns: reload the tickets and open the one just created. */
        state.ticketId = "";
        setActiveTab("concerns");
        await loadTickets();
        var newTicketId = String(value(createdTicket, ["ticket_id", "id"], ""));
        var matchingTicket = state.tickets.find(function (item) {
          return newTicketId && String(value(item, ["ticket_id", "id"])) === newTicketId;
        });
        if (!matchingTicket) {
          var normalizedSubject = subject.toLowerCase();
          matchingTicket = state.tickets.find(function (item) {
            return String(value(item, ["subject", "title", "concern"], "")).trim().toLowerCase() === normalizedSubject;
          });
        }
        openThreadView("cibConcernsPanel");
        if (matchingTicket) {
          await selectTicket(String(value(matchingTicket, ["ticket_id", "id"])));
        } else {
          renderTickets();
        }
      } catch (error) { showError(errorNode, error); }
      finally { button.disabled = false; }
    });

    /* "Reopen this ticket?" question, so an accidental click does not reopen it.
       Uses the shared styled confirm (crmConfirm) when it is loaded; otherwise the same card with the same classes. */
    function confirmReopen() {
      var opts = {
        title: "Reopen this ticket?",
        message: "Do you want to reopen this ticket? Customer Service Staff will see it as open again and can reply to you.",
        confirmText: "Yes, Reopen",
        cancelText: "Cancel"
      };
      if (typeof window.crmConfirm === "function") return window.crmConfirm(opts);
      return new Promise(function (resolve) {
        if (!window.bootstrap || !window.bootstrap.Modal) { resolve(window.confirm(opts.message)); return; }
        var el = document.createElement("div");
        el.className = "modal fade";
        el.tabIndex = -1;
        el.setAttribute("aria-hidden", "true");
        el.innerHTML = '<div class="modal-dialog modal-dialog-centered"><div class="modal-content custom-modal-card"><div class="modal-body">' +
          '<h5 class="modal-title mb-2" data-t></h5><p class="modal-delete-text mb-4" data-m></p>' +
          '<div class="d-flex justify-content-end gap-2"><button type="button" class="btn modal-btn-white px-3" data-no></button>' +
          '<button type="button" class="btn modal-btn-save px-3" data-ok></button></div></div></div></div>';
        el.querySelector("[data-t]").textContent = opts.title;
        el.querySelector("[data-m]").textContent = opts.message;
        el.querySelector("[data-no]").textContent = opts.cancelText;
        el.querySelector("[data-ok]").textContent = opts.confirmText;
        document.body.appendChild(el);
        var answer = false;
        var inst = new window.bootstrap.Modal(el);
        el.querySelector("[data-ok]").addEventListener("click", function () { answer = true; inst.hide(); });
        el.querySelector("[data-no]").addEventListener("click", function () { inst.hide(); });
        el.addEventListener("hidden.bs.modal", function () { inst.dispose(); el.remove(); resolve(answer); });
        inst.show();
      });
    }

    /* Reopen Ticket: restores an accidentally closed concern (needs action=reopen_ticket in the API). */
    $("#cibReopenTicket").addEventListener("click", async function (event) {
      if (!state.ticketId) return;
      var button = event.currentTarget;
      if (!(await confirmReopen())) return;
      button.disabled = true;
      try {
        var data = new FormData();
        data.set("ticket_id", state.ticketId);
        await request("reopen_ticket", { method: "POST", body: data });
        await loadTickets();
        if (state.ticketId) await selectTicket(state.ticketId);
        $("#cibTicketReplyText").focus();
      } catch (error) { $("#cibTicketMeta").textContent = error.message; }
      finally { button.disabled = false; }
    });

    loadConversations();
    loadTickets();
  }

  function scanCustomerInbox() {
    document.querySelectorAll("#cibPage").forEach(initCustomerInbox);
  }

  if (document.body) {
    scanCustomerInbox();
    new MutationObserver(scanCustomerInbox).observe(document.body, { childList: true, subtree: true });
  } else document.addEventListener("DOMContentLoaded", scanCustomerInbox, { once: true });
})();



/* Customer Home dashboard: data is supplied by customer-home-api.php. */
(function () {
  "use strict";

  var ARRANGEMENTS = {
    "customer pickup": "Customer Pickup",
    "pickup": "Customer Pickup",
    "delivery": "Delivery",
    "buffet with setup": "Buffet set-up",
    "buffet set-up": "Buffet set-up",
    "buffet service": "Buffet set-up",
    "buffet setup": "Buffet set-up"
  };

  function firstValue(object, keys) {
    if (!object || typeof object !== "object") return "";
    for (var i = 0; i < keys.length; i += 1) {
      var value = object[keys[i]];
      if (value !== undefined && value !== null && String(value).trim() !== "") return value;
    }
    return "";
  }

  function text(page, id, value) {
    var node = page.querySelector("#" + id);
    if (node) node.textContent = value === undefined || value === null || value === "" ? "—" : String(value);
  }

  function normalizeStatus(value) {
    return String(value || "").trim().toLowerCase().replace(/[_-]+/g, " ");
  }

  function isConfirmed(item) {
    var status = normalizeStatus(firstValue(item, ["status", "booking_status", "bookingStatus"]));
    return item && (item.is_confirmed === true || item.isConfirmed === true || item.confirmed === true || status.indexOf("confirm") !== -1);
  }

  function isActiveInquiry(item) {
    var status = normalizeStatus(firstValue(item, ["status", "inquiry_status", "inquiryStatus"]));
    return status.indexOf("submit") !== -1 || status.indexOf("review") !== -1 || status.indexOf("quotation") !== -1 || status.indexOf("in progress") !== -1;
  }

  function pickRecord(data, singularKeys, listKeys, predicate) {
    for (var i = 0; i < singularKeys.length; i += 1) {
      var record = data && data[singularKeys[i]];
      if (record && typeof record === "object" && !Array.isArray(record) && (!predicate || predicate(record))) return record;
    }
    for (var j = 0; j < listKeys.length; j += 1) {
      var list = data && data[listKeys[j]];
      if (Array.isArray(list)) {
        for (var k = 0; k < list.length; k += 1) if (list[k] && (!predicate || predicate(list[k]))) return list[k];
      }
    }
    return null;
  }

  function arrangement(value) {
    var key = String(value || "").trim().toLowerCase().replace(/\s+/g, " ");
    return ARRANGEMENTS[key] || "—";
  }

  function formatDate(value) {
    if (!value) return "—";
    var raw = String(value).trim();
    // A date-only value (2026-11-20) is read as local time, so it never shifts a day.
    var dateOnly = /^(\d{4})-(\d{2})-(\d{2})$/.exec(raw);
    var date = dateOnly ? new Date(Number(dateOnly[1]), Number(dateOnly[2]) - 1, Number(dateOnly[3])) : new Date(raw);
    if (isNaN(date.getTime())) return raw;
    // Show the time only when there is one (midnight means "no time given").
    var hasTime = !dateOnly && (date.getHours() !== 0 || date.getMinutes() !== 0);
    var options = { month: "short", day: "numeric", year: "numeric" };
    if (hasTime) { options.hour = "numeric"; options.minute = "2-digit"; }
    try {
      return new Intl.DateTimeFormat(undefined, options).format(date);
    } catch (error) {
      return raw;
    }
  }

  function guestCount(value) {
    if (value === 0 || value === "0") return "0 PAX";
    if (!value) return "—";
    var str = String(value).trim();
    return /^\d+(\.\d+)?$/.test(str) ? str + " PAX" : str;
  }

  // Booking progress: 0 Inquiry Received, 1 In Progress, 2 Quotation Sent,
  // 3 Awaiting Your Response, 4 Booking Confirmation.
  function stepFor(status, booking) {
    var value = normalizeStatus(status);
    if (value.indexOf("complete") !== -1) return 4;
    if (value.indexOf("await") !== -1 || value.indexOf("response") !== -1 || value.indexOf("payment pending") !== -1) return 3;
    if (value.indexOf("confirm") !== -1) return 4;
    if (value.indexOf("quotation") !== -1 || value.indexOf("quote") !== -1) return 2;
    if (value.indexOf("review") !== -1 || value.indexOf("progress") !== -1 || value.indexOf("preparation") !== -1 || value.indexOf("delivery") !== -1) return 1;
    return 0;
  }

  /* Inquiry card progress bar: 3 steps -> Inquiry Sent / Quotation in Preparation / Quotation Sent */
  var INQUIRY_STEPS = ["Inquiry Sent", "Quotation in Preparation", "Quotation Sent"];

  function buildInquiryStepper(page) {
    var list = page.querySelector("#homeInquiryStepper");
    if (!list || list.getAttribute("data-built") === "3") return;
    list.setAttribute("data-built", "3");
    list.innerHTML = "";
    INQUIRY_STEPS.forEach(function (label, index) {
      var item = document.createElement("li");
      item.setAttribute("data-step-index", String(index));
      var dot = document.createElement("span");
      dot.className = "ch-step-dot";
      dot.textContent = String(index + 1);
      var name = document.createElement("span");
      name.className = "ch-step-label";
      name.textContent = label;
      item.appendChild(dot);
      item.appendChild(name);
      list.appendChild(item);
    });
  }

  /* Home booking card: the steps come from the server (they change with pickup / delivery / buffet). */
  function buildBookingStepper(page, labels) {
    var list = page.querySelector("#homeBookingStepper");
    if (!list) return;
    var signature = labels.join("|");
    if (list.getAttribute("data-built") === signature) return;
    list.setAttribute("data-built", signature);
    list.innerHTML = "";
    labels.forEach(function (label, index) {
      var item = document.createElement("li");
      item.setAttribute("data-step-index", String(index));
      var dot = document.createElement("span");
      dot.className = "ch-step-dot";
      dot.textContent = String(index + 1);
      var name = document.createElement("span");
      name.className = "ch-step-label";
      name.textContent = label;
      item.appendChild(dot);
      item.appendChild(name);
      list.appendChild(item);
    });
  }

  // 0 = Inquiry Sent is current, 1 = Quotation in Preparation, 2 = Quotation Sent
  // (a submitted inquiry is already "sent", so the current stage is the quotation being prepared)
  function inquiryStepFor(status) {
    var value = normalizeStatus(status);
    if (value.indexOf("accept") !== -1) return 3;
    if (value.indexOf("prepar") !== -1) return 1;
    if (value.indexOf("complete") !== -1 || value.indexOf("confirm") !== -1 || value.indexOf("await") !== -1 || value.indexOf("response") !== -1 || value.indexOf("sent") !== -1 || value.indexOf("quotation") !== -1 || value.indexOf("quote") !== -1) return 2;
    return 1;
  }

  function paintStepper(page, id, current) {
    var steps = page.querySelectorAll("#" + id + " [data-step-index]");
    steps.forEach(function (step) {
      var index = Number(step.getAttribute("data-step-index"));
      step.classList.toggle("is-complete", index < current);
      step.classList.toggle("is-current", index === current);
      if (index === current) step.setAttribute("aria-current", "step");
      else step.removeAttribute("aria-current");
    });
  }

  /* ---- greeting + date: always shown, name = the customer who is logged in ---- */
  function knownCustomerName(page) {
    // 1) set by the server on the page: <main ... data-customer-name="Maria Santos">
    var fromPage = page && page.getAttribute("data-customer-name");
    if (fromPage) return fromPage;
    // 2) the logged-in user's name from the PHP session. app-layout.php refreshes it on every
    //    page load, so it is always the current user (never a name left over from someone else).
    try { return (localStorage.getItem("userName") || "").trim(); } catch (error) { return ""; }
  }

  function setGreeting(page, name) {
    var who = name || knownCustomerName(page);
    var hour = new Date().getHours();
    var greeting = hour < 12 ? "Good morning" : hour < 18 ? "Good afternoon" : "Good evening";
    var first = who ? String(who).trim().split(/\s+/)[0] : "";
    var node = page.querySelector("#homeGreeting");
    if (node) node.textContent = first ? greeting + ", " + first + "!" : "Welcome back!";
    var dateNode = page.querySelector("#homeTodayDate");
    var dateLabel = page.querySelector("#homeTodayDateLabel") || dateNode;
    if (dateLabel) dateLabel.textContent = new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", year: "numeric" }).format(new Date());
  }

  function renderRecord(page, record, kind) {
    var booking = kind === "booking";
    var prefix = booking ? "homeBooking" : "homeInquiry";
    var title = firstValue(record, ["event_name", "eventName", "inquiry_name", "inquiryName", "title", "subject", "name"]);
    var status = firstValue(record, ["status", "booking_status", "bookingStatus", "inquiry_status", "inquiryStatus"]);
    var date = firstValue(record, ["event_datetime", "eventDateTime", "event_date", "eventDate", "preferred_date", "preferredDate", "schedule", "date"]);
    var guests = firstValue(record, ["expected_guests", "expectedGuests", "guest_count", "guestCount", "pax", "guests"]);
    var venue = firstValue(record, ["venue", "event_venue", "eventVenue", "location"]);
    var service = firstValue(record, ["service_arrangement", "serviceArrangement", "arrangement", "service_type", "serviceType"]);

    text(page, prefix + "Title", title);
    text(page, prefix + "Status", booking ? (status || "Confirmed") : status);
    text(page, prefix + "Date", formatDate(date));
    if (booking) {
      // Guests only for Buffet with Set-up that has a pax number; otherwise the whole row is removed.
      var guestsOn = /buffet|set-?up|on-?site/i.test(String(service || "")) && parseInt(guests, 10) > 0;
      text(page, prefix + "Guests", guestsOn ? guestCount(guests) : "");
      var gNode = page.querySelector("#" + prefix + "Guests");
      var vNode = page.querySelector("#" + prefix + "Venue");
      if (gNode) {
        var gRow = gNode;
        while (gRow.parentElement && gRow.parentElement !== page && !(vNode && gRow.parentElement.contains(vNode))) gRow = gRow.parentElement;
        var gTargets = [gRow];
        if (gRow.tagName === "DD" && gRow.previousElementSibling && gRow.previousElementSibling.tagName === "DT") gTargets.push(gRow.previousElementSibling);
        gTargets.forEach(function (t) { t.hidden = !guestsOn; t.style.display = guestsOn ? "" : "none"; });
      }
    }
    text(page, prefix + "Venue", venue);
    text(page, booking ? "homeBookingServiceArrangement" : "homeServiceArrangement", arrangement(service));
    /* customers see the event name only: hide the reference field (and its label) */
    var refNode = page.querySelector("#" + prefix + "Reference");
    if (refNode) {
      refNode.textContent = "";
      refNode.hidden = true;
      var refHolder = refNode.parentElement;
      if (refHolder && /^\s*[A-Za-z ]*reference[A-Za-z ]*:?\s*$/i.test(refHolder.textContent || "")) refHolder.hidden = true;
    }
    if (booking) {
      if (record.progress && record.progress.steps && record.progress.steps.length) {
        buildBookingStepper(page, record.progress.steps);
        paintStepper(page, "homeBookingStepper", Number(record.progress.current));
        if (record.progress.status_label && !record.progress.is_done) text(page, "homeBookingStatus", record.progress.status_label);
      } else {
        paintStepper(page, "homeBookingStepper", stepFor(status, booking));
      }
    } else {
      buildInquiryStepper(page);
      paintStepper(page, "homeInquiryStepper", inquiryStepFor(status));
    }
    var section = page.querySelector(booking ? "#homeBookingState" : "#homeInquiryState");
    if (section) section.hidden = false;
  }

  function renderHome(page, payload) {
    var data = payload && payload.data && typeof payload.data === "object" ? payload.data : payload;
    var customer = data && (data.customer || data.user) || {};
    var name = firstValue(customer, ["full_name", "fullName", "name", "customer_name", "customerName"]) || firstValue(data, ["customer_name", "customerName", "full_name", "fullName"]);
    setGreeting(page, name);

    var booking = pickRecord(data, ["confirmed_booking", "confirmedBooking", "active_booking", "activeBooking", "booking"], ["bookings", "confirmed_bookings", "confirmedBookings"], isConfirmed);
    var inquiry = pickRecord(data, ["active_inquiry", "activeInquiry", "inquiry"], ["active_inquiries", "activeInquiries", "inquiries"], isActiveInquiry);
    var declined = data && data.declined_inquiry;
    var inquiryRecord = inquiry || declined;
    var inquiryState = page.querySelector("#homeInquirySummaryState");
    var inquiryDescription = page.querySelector("#homeInquirySummaryDescription");
    var bookingState = page.querySelector("#homeBookingSummaryState");
    var bookingDescription = page.querySelector("#homeBookingSummaryDescription");
    if (inquiryState) inquiryState.textContent = inquiryRecord
      ? (firstValue(inquiryRecord, ["event_name", "eventName", "title", "name"]) || "Your latest catering inquiry")
      : "No inquiries yet.";
    if (inquiryDescription) inquiryDescription.textContent = inquiryRecord
      ? [firstValue(inquiryRecord, ["status", "stage", "inquiry_status"]), (function () { var date = firstValue(inquiryRecord, ["event_datetime", "event_date", "eventDate"]); return date ? formatDate(date) : ""; })()].filter(Boolean).join(" · ") || "Your submitted catering request is shown here."
      : "Your submitted catering requests will appear here.";
    if (bookingState) bookingState.textContent = booking
      ? (firstValue(booking, ["event_name", "eventName", "title", "name"]) || "Your confirmed catering event")
      : "No bookings yet.";
    if (bookingDescription) bookingDescription.textContent = booking
      ? [firstValue(booking, ["status", "booking_status", "bookingStatus"]), (function () { var date = firstValue(booking, ["event_datetime", "event_date", "eventDate"]); return date ? formatDate(date) : ""; })()].filter(Boolean).join(" · ") || "Your confirmed catering event is shown here."
      : "Your confirmed catering events will appear here.";
    /* remember WHICH booking the card shows, so "View Booking Details" / "Payment Details" open that one (not the first in the list) */
    page.dataset.homeBookingKey = booking ? String(firstValue(booking, ["booking_id", "bookingId", "id"]) || firstValue(booking, ["event_name", "eventName", "event_title", "title", "name"]) || "") : "";
    var empty = page.querySelector("#homeEmptyState");
    if (booking) renderRecord(page, booking, "booking");
    else if (inquiry) renderRecord(page, inquiry, "inquiry");
    else if (empty) {
      var declined = data && data.declined_inquiry;
      var emptyTitle = empty.querySelector("#homeEmptyTitle");
      var emptyText = empty.querySelector("p");
      if (emptyTitle) emptyTitle.textContent = declined ? "Your inquiry was declined" : "No upcoming bookings yet";
      if (emptyText) emptyText.textContent = declined
        ? String(declined.event_name || "Your inquiry") + " was declined" + (declined.reason ? ": " + String(declined.reason) : ".") + " You are welcome to send a new inquiry anytime."
        : "Once your booking is confirmed, you can track its progress here.";
      empty.hidden = false;
    }
    adaptHomeExtras(page);
  }

  /* New customers see the first-event prompt + "How it works".
     Customers who already have a booking/inquiry see "Planning another event?" and no tutorial. */
  function adaptHomeExtras(page) {
    var how = page.querySelector(".ch-how-it-works");
    if (how) { how.hidden = false; how.style.display = ""; }
  }

  function routeFor(root, route) {
    var file = route === "inquiries" || route === "new-inquiry" ? "customer-inquiries.html" : route === "inbox" ? "customer-inbox.html" : "customer-bookings.html";
    var links = Array.prototype.slice.call(document.querySelectorAll("a[href], [data-page], [data-route]"));
    for (var i = 0; i < links.length; i += 1) {
      var link = links[i];
      if (root.contains(link)) continue;
      // only the sidebar menu counts (not notification-bell items, header links, etc.)
      if (!link.closest("aside, nav, .sidebar, #sidebar, [class*='sidebar'], [class*='navbar-menu']")) continue;
      if (link.closest("header, .topbar, [class*='notif'], [class*='dropdown']")) continue;
      var href = link.getAttribute("href") || "";
      var pageName = link.getAttribute("data-page") || link.getAttribute("data-route") || "";
      var label = (link.textContent || "").trim().toLowerCase();
      if (href.indexOf(file) !== -1 || pageName.indexOf(file.replace(".html", "")) !== -1 || (route.indexOf("inquir") !== -1 && label.indexOf("inquir") !== -1) || (route.indexOf("inbox") !== -1 && label.indexOf("inbox") !== -1) || (route.indexOf("book") !== -1 && label.indexOf("book") !== -1)) return link;
    }
    return null;
  }

  function tryOpenInquiryWizard() {
    try {
      if (sessionStorage.getItem("crmOpenInquiryWizardOnce") !== "1") return;
      var modal = document.querySelector("#inquiryWizardModal");
      if (!modal) return;
      sessionStorage.removeItem("crmOpenInquiryWizardOnce");
      // Open through the wizard itself. It sets up the modal first (moves it to <body>,
      // wires the X / Cancel buttons, creates the one Bootstrap instance it controls).
      // Calling bootstrap.Modal.getOrCreateInstance(modal).show() here made a second,
      // separate instance, so the wizard's close buttons could not close it.
      document.dispatchEvent(new CustomEvent("crm:add-inquiry"));
    } catch (error) { /* Storage can be unavailable in restricted browser contexts. */ }
  }

  function initCustomerHome(page) {
    if (!page || page.dataset.homeInitialized === "true") return;
    page.dataset.homeInitialized = "true";
    setGreeting(page); // greeting + date show right away, even if the API is down
    var statusNode = page.querySelector("#homeDashboardStatus");
    var retry = page.querySelector("#homeRetryButton");
    var empty = page.querySelector("#homeEmptyState");
    var inquiry = page.querySelector("#homeInquiryState");
    var booking = page.querySelector("#homeBookingState");
    var errorCard = page.querySelector("#homeErrorState");
    var errorMessage = page.querySelector("#homeErrorMessage");

    function load() {
      page.setAttribute("aria-busy", "true");
      if (statusNode) { statusNode.hidden = false; statusNode.textContent = "Loading dashboard..."; }
      if (errorCard) errorCard.hidden = true;
      if (empty) empty.hidden = true;
      if (inquiry) inquiry.hidden = true;
      if (booking) booking.hidden = true;
      fetch(page.getAttribute("data-api-url") || "customer-home-api.php?action=summary", { credentials: "same-origin", headers: { Accept: "application/json" } })
        .then(function (response) {
          if (!response.ok) throw new Error("Dashboard request failed (" + response.status + ").");
          return response.json();
        })
        .then(function (payload) {
          if (payload && payload.success === false) throw new Error(payload.message || "Dashboard data could not be loaded.");
          renderHome(page, payload || {});
          page.classList.remove("is-load-error");
          if (statusNode) statusNode.hidden = true;
          page.setAttribute("aria-busy", "false");
        })
        .catch(function () {
          if (statusNode) statusNode.hidden = true;
          if (errorMessage) errorMessage.textContent = "Dashboard data could not be loaded. Check the Home API and try again.";
          if (errorCard) errorCard.hidden = false;
          page.classList.add("is-load-error");
          page.setAttribute("aria-busy", "false");
        });
    }

    if (retry) retry.addEventListener("click", load);
    /* ANY button or link of the booking card ("View Booking Details", "Payment Details", ...) opens THAT booking in My Bookings.
       This runs in the CAPTURE phase (and on pointerdown too), so it still runs when another handler (the sidebar navigation, a plain link)
       takes over the click and changes the page before a normal click handler would run. */
    function rememberHomeBooking(event) {
      var key = page.dataset.homeBookingKey;
      if (!key || !event.target || !event.target.closest) return;
      var el = event.target.closest("a, button, [data-home-route]");
      if (!el || !page.contains(el)) return;
      var label = String(el.textContent || "").toLowerCase();
      var route = String(el.getAttribute("data-home-route") || "").toLowerCase();
      var isBookingControl = !!el.closest("#homeBookingState") || /booking/.test(route) || /booking details|payment details|view details/.test(label);
      if (!isBookingControl || /inquir|inbox/.test(route)) return;
      try { sessionStorage.setItem("crmOpenBookingId", key); } catch (error) { /* Storage can be unavailable in restricted browser contexts. */ }
      /* "View Booking Details" may be a plain link without data-home-route, so the handler below never sees it: select the booking from here too */
      if (event.type === "click") {
        if (!/payment/.test(route + " " + label)) { try { sessionStorage.removeItem("crmOpenBookingTab"); } catch (error) { /* ignore */ } }
        [60, 400, 1200, 2500].forEach(function (ms) {
          setTimeout(function () { if (typeof window.crmApplyHomeBookingSelection === "function") window.crmApplyHomeBookingSelection(); }, ms);
        });
      }
    }
    ["pointerdown", "click"].forEach(function (name) { page.addEventListener(name, rememberHomeBooking, true); });
    page.addEventListener("click", function (event) {
      var button = event.target.closest("[data-home-route]");
      if (!button) return;
      var route = button.getAttribute("data-home-route");
      if (route === "new-inquiry") {
        try { sessionStorage.setItem("crmOpenInquiryWizardOnce", "1"); } catch (error) { /* Continue to inquiry page. */ }
      }
      // "Payment Details" opens My Bookings on the Payment tab; "View Booking Details" opens the normal first tab.
      try {
        if (route === "booking-payment") sessionStorage.setItem("crmOpenBookingTab", "#tab-payment-details");
        else sessionStorage.removeItem("crmOpenBookingTab");
        // buttons that are not on the booking card and lead away from bookings must not carry an old booking id
        if (/inquir|inbox/.test(route) && !event.target.closest("#homeBookingState")) sessionStorage.removeItem("crmOpenBookingId");
      } catch (error) { /* Continue to bookings page. */ }
      var link = routeFor(page, route);
      if (link) {
        event.preventDefault();
        link.click();
        if (route !== "new-inquiry" && !/inquir|inbox/.test(route)) {
          [60, 400, 1200].forEach(function (ms) {
            setTimeout(function () { if (typeof window.crmApplyHomeBookingSelection === "function") window.crmApplyHomeBookingSelection(); }, ms);
          });
        }
      } else if (route === "new-inquiry") {
        window.location.href = "html-content-navbar/customer-inquiries.html#inquiryWizardModal";
      }
    });
    load();
  }

  // Console testing: crmRenderHome({ inquiries: [...], bookings: [...] })
  window.crmRenderHome = function (payload) {
    var page = document.querySelector("#customerHomePage");
    if (!page) return;
    ["#homeEmptyState", "#homeInquiryState", "#homeBookingState", "#homeErrorState", "#homeDashboardStatus"].forEach(function (sel) {
      var node = page.querySelector(sel);
      if (node) node.hidden = true;
    });
    renderHome(page, payload || {});
    page.setAttribute("aria-busy", "false");
  };
  function scanCustomerHome() {
    document.querySelectorAll("#customerHomePage").forEach(initCustomerHome);
    tryOpenInquiryWizard();
  }

  if (document.body) {
    scanCustomerHome();
    new MutationObserver(scanCustomerHome).observe(document.body, { childList: true, subtree: true });
  } else document.addEventListener("DOMContentLoaded", scanCustomerHome, { once: true });
})();
