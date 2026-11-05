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

    function checkedDishes() {
      return Array.prototype.slice.call(form.querySelectorAll('input[name="dishes"]:checked'))
        .map(function (i) { return i.value; });
    }

    function checkedPackage() {
      var p = form.querySelector('input[name="package"]:checked');
      return p ? p.value : "";
    }

    function updateCount() {
      var n = checkedDishes().length;
      els.count.textContent = n + " selected";
      if (n > 0) setError(null, "iwErrDishes", "");
    }

    function updateNotesCount() {
      els.notesCount.textContent = els.notes.value.length + "/300 characters";
    }

    /* --- validation (returns true when the step is OK) --- */
    function validate(step) {
      var firstBad = null;
      function bad(el) { if (!firstBad) firstBad = el; }

      if (step === 1) {
        if (checkedDishes().length === 0) {
          setError(null, "iwErrDishes", "Select at least one dish to continue.");
          bad(form.querySelector('input[name="dishes"]'));
        } else {
          setError(null, "iwErrDishes", "");
        }
      }

      if (step === 2) {
        var name = $("iwEventName");
        var date = $("iwEventDate");
        var guests = $("iwGuests");
        var venue = $("iwVenue");
        var arr = $("iwArrangement");

        if (!name.value.trim()) { setError("iwEventName", "iwErrEventName", "Enter a name for your event."); bad(name); }
        else setError("iwEventName", "iwErrEventName", "");

        if (!date.value) { setError("iwEventDate", "iwErrEventDate", "Choose the event date."); bad(date); }
        else if (date.value < todayISO()) { setError("iwEventDate", "iwErrEventDate", "Choose today or a future date."); bad(date); }
        else setError("iwEventDate", "iwErrEventDate", "");

        var g = Number(guests.value);
        if (guests.value === "" || !Number.isInteger(g) || g < 1 || g > 5000) {
          setError("iwGuests", "iwErrGuests", "Enter a whole number from 1 to 5,000.");
          bad(guests);
        } else setError("iwGuests", "iwErrGuests", "");

        if (!venue.value.trim()) { setError("iwVenue", "iwErrVenue", "Enter the venue or delivery address."); bad(venue); }
        else setError("iwVenue", "iwErrVenue", "");

        if (!arr.value) { setError("iwArrangement", "iwErrArrangement", "Choose a service arrangement."); bad($("iwArrangementToggle")); }
        else setError("iwArrangement", "iwErrArrangement", "");
      }

      if (firstBad) {
        firstBad.focus();
        return false;
      }
      return true;
    }

    /* --- review step --- */
    function collect() {
      var guests = Number($("iwGuests").value);
      return {
        package: checkedPackage(),
        dishes: checkedDishes(),
        event_name: $("iwEventName").value.trim(),
        event_date: $("iwEventDate").value,
        guests: guests,
        venue: $("iwVenue").value.trim(),
        arrangement: $("iwArrangement").value,
        notes: els.notes.value.trim()
      };
    }

    function fillReview() {
      var d = collect();
      $("iwRvEvent").textContent = d.event_name || "\u2014";
      $("iwRvDateGuests").textContent = longDate(d.event_date) + " \u2022 " + d.guests + (d.guests === 1 ? " guest" : " guests");
      $("iwRvVenue").textContent = d.venue || "\u2014";
      $("iwRvService").textContent = d.arrangement || "\u2014";
      $("iwRvPackage").textContent = d.package || "\u2014";
      $("iwRvDishes").textContent = d.dishes.length ? d.dishes.join(", ") : "\u2014";
      $("iwRvNotes").textContent = d.notes || "No additional information provided.";
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
    }

    function goTo(n, moveFocus) {
      state.step = Math.max(1, Math.min(TOTAL, n));
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
      state.dirty = false;
      state.busy = false;
      els.next.disabled = false;
      els.back.disabled = false;
      $("iwEventDate").min = todayISO();
      ["iwEventName", "iwEventDate", "iwGuests", "iwVenue", "iwArrangement"].forEach(function (id) {
        setError(id, "iwErr" + id.slice(2), "");
      });
      setError(null, "iwErrDishes", "");
      els.submitError.hidden = true;
      els.submitError.textContent = "";
      updateCount();
      updateNotesCount();
      goTo(1, false);
    }

    function open() {
      var bs = bsModal();
      if (!bs) return;
      resetForm();
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
          var dishes = body.getAll("dishes");
          body.delete("dishes");
          dishes.forEach(function (name) { body.append("dishes[]", name); });
          body.set("csrf_token", csrf);

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

    form.addEventListener("input", function () { state.dirty = true; });
    form.addEventListener("change", function (e) {
      state.dirty = true;
      if (e.target.name === "dishes") updateCount();
    });

    els.notes.addEventListener("input", updateNotesCount);

    // clear a field's message as soon as the person edits it
    ["iwEventName", "iwEventDate", "iwGuests", "iwVenue", "iwArrangement"].forEach(function (id) {
      var input = $(id);
      input.addEventListener("input", function () { setError(id, "iwErr" + id.slice(2), ""); });
      input.addEventListener("change", function () { setError(id, "iwErr" + id.slice(2), ""); });
    });

    // whole numbers only for guests
    $("iwGuests").addEventListener("keydown", function (e) {
      if (["e", "E", "+", "-", ".", ","].indexOf(e.key) !== -1) e.preventDefault();
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
  if (window.__crmBookingPageLoaded) return;
  window.__crmBookingPageLoaded = true;

  var API = "customer-bookings-api.php";
  var STEPS = ["Inquiry Received", "In Progress", "Quotation Sent", "Awaiting Your Response", "Booking Confirmation"];
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

  function init(page) {
    if (!page || page.getAttribute("data-cb-ready") === "1") return;
    var list = page.querySelector("#cbBookingList");
    var listState = page.querySelector("#cbListState");
    var count = page.querySelector("#cbBookingCount");
    var title = page.querySelector("#cbBookingTitle");
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
        current = Number(first(record, ["progress_step", "current_step", "booking_step"]));
        if (!Number.isInteger(current) || current < 1 || current > STEPS.length) {
          var state = asText(first(record, ["status", "booking_status", "progress_status"])).toLowerCase();
          if (/confirm|complete/.test(state)) current = 5;
          else if (/await|response|pending/.test(state)) current = 4;
          else if (/quotation|quote/.test(state)) current = 3;
          else if (/progress|review/.test(state)) current = 2;
          else current = 1;
        }
      }
      while (stepper.firstChild) stepper.removeChild(stepper.firstChild);
      STEPS.forEach(function (label, index) {
        var number = index + 1;
        var item = document.createElement("li");
        item.className = "cb-step " + (number < current ? "is-done" : number === current ? "is-current" : "is-todo");
        var node = document.createElement("span");
        node.className = "cb-step-node";
        node.textContent = number < current ? "✓" : String(number);
        var caption = document.createElement("span");
        caption.textContent = label;
        item.appendChild(node);
        item.appendChild(caption);
        if (number === current) item.setAttribute("aria-current", "step");
        stepper.appendChild(item);
      });
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
      setText("cbGuests", first(record, ["expected_guests", "guest_count", "guests", "number_of_guests", "pax"]), "0");
      setText("cbVenue", first(record, ["venue", "venue_name", "address"]));
      setText("cbSchedule", schedule);
      setText("cbPackage", first(record, ["package_name", "package"]));
      setText("cbRequests", first(record, ["special_requests", "notes", "dietary_requirements"]));
      setText("cbContactName", first(record, ["contact_name", "customer_name", "name"]) || first(contact, ["name", "full_name"]));
      setText("cbContactEmail", first(record, ["contact_email", "email"]) || first(contact, ["email"]));
      setText("cbContactPhone", first(record, ["contact_phone", "phone", "phone_number"]) || first(contact, ["phone", "phone_number"]));
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
      var verified = payment.verified === true || payment.is_verified === true || /verified|confirmed|paid|complete/.test(normalized);
      var icon = page.querySelector("#cbPaymentIcon i");
      setText("cbPaymentBannerTitle", verified ? "Payment Confirmed" : paymentStatus || "Payment status unavailable");
      setText("cbPaymentBannerText", verified
        ? "Your deposit payment has been verified."
        : (paymentStatus ? "Payment status: " + paymentStatus + "." : "No payment information is available yet."));
      setText("cbPaymentVerifiedAt", first(payment, ["verified_at", "payment_date", "paid_at"]), "");
      if (icon) icon.className = verified ? "bi bi-check-lg" : "bi bi-info-circle";

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
    }

    function resetEmpty() {
      page.setAttribute("data-cb-view", "empty");
      if (count) count.textContent = "0 bookings";
      if (title) title.textContent = "Booking overview";
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
      if (title) title.textContent = asText(eventName) || "Booking details";
      if (status) status.textContent = asText(first(record, ["status", "booking_status"])) || "—";
      renderSteps(record);
      renderDetails(record);
      renderPayment(record);

      var id = asText(first(record, ["booking_id", "id"]));
      var feedback = record.feedback || {};
      var rating = Number(first(feedback, ["rating", "stars"]) || first(record, ["feedback_rating"])) || 0;
      var priorComments = asText(first(feedback, ["comments", "comment"]) || first(record, ["feedback_comments"]));
      if (bookingIdInput) bookingIdInput.value = id;
      if (comments) {
        comments.value = priorComments;
      }
      clearFeedbackImages();
      setFeedbackEnabled(Boolean(id));
      if (commentsCount) commentsCount.textContent = comments ? comments.value.length.toLocaleString("en-PH") + " / 1,000" : "0 / 1,000";
      updateRating(rating);
      showFeedbackMessage(id ? "" : "This booking does not include a booking_id yet.", "");
    }

    function render(rows, preferredId) {
      while (list.firstChild) list.removeChild(list.firstChild);
      if (count) count.textContent = rows.length + (rows.length === 1 ? " booking" : " bookings");
      if (!rows.length) {
        resetEmpty();
        showListMessage("0 bookings. Your bookings will appear here when available.", false);
        return;
      }
      listState.hidden = true;
      rows.forEach(function (record, index) {
        var button = document.createElement("button");
        button.type = "button";
        button.className = "cb-booking-button";
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
        date.textContent = asText(first(record, ["event_schedule", "event_date", "date"])) || "—";
        var guests = document.createElement("span");
        guests.textContent = (asText(first(record, ["expected_guests", "guest_count", "guests", "pax"])) || "0") + " guests";
        meta.appendChild(date);
        meta.appendChild(guests);
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
      if (preferredId) {
        var match = rows.findIndex(function (record) {
          return asText(first(record, ["booking_id", "id"])) === String(preferredId);
        });
        if (match >= 0) index = match;
      }
      selectBooking(rows[index], index);
    }

    function load(preferredId) {
      showListMessage("Loading your bookings...", false);
      fetch(API + "?action=list", {
        method: "GET",
        credentials: "same-origin",
        headers: { Accept: "application/json" },
        cache: "no-store"
      })
        .then(parseResponse)
        .then(function (json) {
          var rows = json.bookings || json.data || json.items || json.records || [];
          if (!Array.isArray(rows)) throw new Error("The bookings service returned an invalid list.");
          records = rows;
          render(rows, preferredId);
        })
        .catch(function (error) {
          console.warn("Bookings are not available yet:", error);
          if (!records.length) {
            resetEmpty();
            showListMessage("0 bookings available. Booking data will appear here when the backend is connected.", true);
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
            showFeedbackMessage(json.message || "Feedback submitted.", "success");
            clearFeedbackImages();
          })
          .catch(function (error) {
            console.error("Feedback submission failed:", error);
            showFeedbackMessage(error.message || "Unable to submit feedback. Please try again.", "error");
          })
          .finally(function () {
            if (submitButton) submitButton.disabled = !bookingIdInput || !bookingIdInput.value;
          });
      });
    }

    load();
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
  if (window.__crmInquiryListLoaded) return;
  window.__crmInquiryListLoaded = true;

  var API = "customer-inquiries-api.php";
  var STEP_LABELS = ["Submitted", "Under review", "Quotation", "Confirmation", "Completed"];

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
    var back = page.querySelector("#ciBack");
    var heroTitle = page.querySelector("#ciHeroTitle");
    var heroStatus = page.querySelector("#ciHeroStatus");
    var stepper = page.querySelector("#ciStepper");
    var detailsPanel = page.querySelector("#ciPanelDetails");
    var quotePanel = page.querySelector("#ciPanelQuote");
    var toast = page.querySelector("#ciToast");
    var detailsTab = page.querySelector("#ciTabDetails");
    var quoteTab = page.querySelector("#ciTabQuote");
    if (!state || !layout || !list || !detail) return;

    page.setAttribute("data-ci-ready", "1");
    page.setAttribute("data-ci-view", "list");
    var inquiries = [];
    var toastTimer = null;

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
      layout.hidden = false;
      page.setAttribute("data-ci-view", inquiries.length ? "list" : "empty");
    }

    function showToast(message) {
      if (!toast || !message) return;
      toast.textContent = message;
      toast.hidden = false;
      if (toastTimer) window.clearTimeout(toastTimer);
      toastTimer = window.setTimeout(function () { toast.hidden = true; }, 4000);
    }

    function renderSteps(record) {
      empty(stepper);
      if (!stepper) return;
      var progress = Number(firstValue(record, ["progress_step", "current_step"]));
      if (!Number.isInteger(progress) || progress < 1 || progress > STEP_LABELS.length) {
        stepper.hidden = true;
        return;
      }
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

    function renderDishes(panel, record) {
      var dishes = record.dishes || record.selected_dishes;
      if (typeof dishes === "string") dishes = dishes.split(/\s*,\s*/).filter(Boolean);
      if (!Array.isArray(dishes) || !dishes.length) return;
      panel.appendChild(make("h4", "ci-section-title", "Selected dishes"));
      var wrap = make("div", "ci-table-wrap");
      var table = make("table", "ci-food");
      var head = document.createElement("thead");
      var headRow = document.createElement("tr");
      headRow.appendChild(make("th", "", "Dish"));
      headRow.appendChild(make("th", "", "Category"));
      head.appendChild(headRow);
      table.appendChild(head);
      var body = document.createElement("tbody");
      dishes.forEach(function (dish) {
        var row = document.createElement("tr");
        row.appendChild(make("td", "", typeof dish === "object" ? asText(dish.name || dish.dish_name) : asText(dish)));
        row.appendChild(make("td", "", typeof dish === "object" ? asText(dish.category) : ""));
        body.appendChild(row);
      });
      table.appendChild(body);
      wrap.appendChild(table);
      panel.appendChild(wrap);
    }

    function renderDetails(record) {
      if (!detailsPanel) return;
      empty(detailsPanel);
      var box = make("section", "ci-box ci-panel");
      var head = make("div", "ci-panel-head");
      head.appendChild(make("h4", "", "Event details"));
      box.appendChild(head);
      var title = asText(firstValue(record, ["event_name", "inquiry_name", "title", "subject"])) || "Catering inquiry";
      box.appendChild(make("h3", "ci-event-title", title));
      var meta = make("dl", "ci-meta");
      appendMeta(meta, "Event date", firstValue(record, ["event_date", "date"]));
      appendMeta(meta, "Expected guests", firstValue(record, ["guests", "guest_count", "number_of_guests"]));
      appendMeta(meta, "Venue", firstValue(record, ["venue", "address"]), true);
      appendMeta(meta, "Service arrangement", firstValue(record, ["arrangement", "service_arrangement"]));
      appendMeta(meta, "Package", firstValue(record, ["package", "package_name"]));
      appendMeta(meta, "Dietary requirements", firstValue(record, ["notes", "dietary_requirements"]), true);
      box.appendChild(meta);
      renderDishes(box, record);
      detailsPanel.appendChild(box);
    }

    function renderQuote(record) {
      if (!quotePanel) return;
      empty(quotePanel);
      var quotation = record.quotation || record.quote || null;
      if (!quotation) {
        var pending = make("div", "ci-note", "A quotation has not been added to this inquiry yet.");
        quotePanel.appendChild(pending);
        return;
      }
      var callout = make("div", "ci-callout");
      callout.appendChild(make("span", "ci-callout-icon", "₱"));
      var intro = make("div", "");
      var title = asText(firstValue(quotation, ["title", "status"])) || "Quotation";
      intro.appendChild(make("h4", "", title));
      var message = asText(firstValue(quotation, ["message", "notes", "valid_until"]));
      if (message) intro.appendChild(make("p", "", message));
      callout.appendChild(intro);
      quotePanel.appendChild(callout);

      var items = quotation.items || quotation.lines || [];
      if (Array.isArray(items) && items.length) {
        var summary = make("section", "ci-summary ci-box");
        summary.appendChild(make("h4", "", "Quotation details"));
        var lines = make("ul", "ci-lines");
        items.forEach(function (item) {
          var line = make("li", "");
          line.appendChild(make("span", "", asText(item.description || item.name || item.label)));
          var amount = item.amount !== undefined ? item.amount : item.total;
          line.appendChild(make("strong", "", amount === undefined ? "" : "₱ " + Number(amount).toLocaleString("en-PH")));
          lines.appendChild(line);
        });
        var total = firstValue(quotation, ["total", "total_amount"]);
        if (total !== "") {
          var totalLine = make("li", "ci-total");
          totalLine.appendChild(make("span", "", "Total"));
          totalLine.appendChild(make("strong", "", "₱ " + Number(total).toLocaleString("en-PH")));
          lines.appendChild(totalLine);
        }
        summary.appendChild(lines);
        quotePanel.appendChild(summary);
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
      if (heroStatus) heroStatus.textContent = asText(firstValue(record, ["status", "inquiry_status"])) || "Submitted";
      renderSteps(record);
      renderDetails(record);
      renderQuote(record);
      activateTab("details");
      if (mobileDetail) page.setAttribute("data-ci-view", "detail");
    }

    function renderEmptyStructure() {
      page.setAttribute("data-ci-view", "empty");
      if (inquiryCount) inquiryCount.textContent = "0 inquiries";
      if (heroTitle) heroTitle.textContent = "Inquiry overview";
      if (heroStatus) heroStatus.textContent = "0 inquiries";

      if (stepper) {
        empty(stepper);
        stepper.hidden = false;
        STEP_LABELS.forEach(function (label, index) {
          var item = make("li", "ci-step is-todo");
          item.appendChild(make("span", "ci-node", String(index + 1)));
          item.appendChild(make("span", "ci-step-label", label));
          stepper.appendChild(item);
        });
      }

      if (detailsPanel) {
        empty(detailsPanel);
        var box = make("section", "ci-box ci-panel");
        var head = make("div", "ci-panel-head");
        head.appendChild(make("h4", "", "Event details"));
        box.appendChild(head);
        box.appendChild(make("h3", "ci-event-title", "No inquiry selected"));

        var meta = make("dl", "ci-meta");
        appendMeta(meta, "Event date", "—");
        appendMeta(meta, "Expected guests", "0");
        appendMeta(meta, "Venue", "—", true);
        appendMeta(meta, "Service arrangement", "—");
        appendMeta(meta, "Package", "—");
        box.appendChild(meta);

        var dishesHeading = make("h4", "ci-section-title", "Selected dishes ");
        dishesHeading.appendChild(make("span", "ci-zero-count", "0"));
        box.appendChild(dishesHeading);
        box.appendChild(make("div", "ci-note", "No dishes selected."));
        detailsPanel.appendChild(box);
      }

      if (quotePanel) {
        empty(quotePanel);
        quotePanel.appendChild(make("div", "ci-note", "0 quotations. No quotation is available yet."));
      }
      activateTab("details");
    }
    function renderList(rows) {
      empty(list);
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
        if (date) meta.appendChild(make("span", "", date));
        var guests = asText(firstValue(record, ["guests", "guest_count", "number_of_guests"]));
        if (guests) meta.appendChild(make("span", "", guests + " guests"));
        body.appendChild(meta);
        var status = make("span", "ci-pill", asText(firstValue(record, ["status", "inquiry_status"])) || "Submitted");
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
      state.hidden = true;
      layout.hidden = false;
      page.setAttribute("data-ci-view", "list");
      selectInquiry(rows[0], 0, false);
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
    var state = { conversations: [], tickets: [], conversationId: "", ticketId: "" };
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
      var response = await fetch(endpointUrl(action, params), Object.assign({ credentials: "same-origin" }, options || {}));
      var payload;
      var responseText = await response.text();
      try { payload = responseText ? JSON.parse(responseText) : {}; }
      catch (error) { throw new Error("Inbox API returned non-JSON (HTTP " + response.status + "). Check customer-inbox-api.php and its response format."); }
      if (!response.ok || payload.success === false || payload.error) {
        throw new Error(payload.message || payload.error || "Request failed (HTTP " + response.status + ").");
      }
      return payload;
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

    function showError(node, error) {
      setState(node, error && error.message ? error.message : "Something went wrong. Please try again.", true);
    }

    function setActiveTab(tab) {
      var messagesActive = tab === "messages";
      $("#cibMessagesTab").setAttribute("aria-selected", String(messagesActive));
      $("#cibConcernsTab").setAttribute("aria-selected", String(!messagesActive));
      $("#cibMessagesPanel").hidden = !messagesActive;
      $("#cibConcernsPanel").hidden = messagesActive;
      $("#cibMessagesPanel").classList.toggle("is-active", messagesActive);
      $("#cibConcernsPanel").classList.toggle("is-active", !messagesActive);
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
    });

    function renderConversations() {
      var list = $("#cibConversationList");
      var query = $("#cibConversationSearch").value.trim().toLowerCase();
      list.replaceChildren();
      var filtered = state.conversations.filter(function (item) {
        var haystack = [value(item, ["title", "subject", "event_name", "inquiry_name"]), value(item, ["last_message", "preview"])].join(" ").toLowerCase();
        var matchesQuery = !query || haystack.includes(query);
        return matchesQuery;
      });
      $("#cibConversationCount").textContent = String(filtered.length);
      if (!filtered.length && query) setNoResults($("#cibConversationState"), "Try a different search term.");
      else setState($("#cibConversationState"), filtered.length ? "" : "No conversations yet.", !filtered.length);
      filtered.forEach(function (item) {
        var id = value(item, ["conversation_id", "id"]);
        if (!id) return;
        var button = make("button", "cib-list-item");
        button.type = "button";
        button.dataset.conversationId = String(id);
        button.setAttribute("aria-current", String(String(id) === String(state.conversationId)));
        var top = make("span", "cib-list-item-top");
        top.append(make("span", "cib-list-item-title", value(item, ["title", "subject", "event_name", "inquiry_name"], "Conversation")));
        top.append(make("span", "cib-list-meta", dateText(value(item, ["updated_at", "last_message_at"]))));
        button.append(top);
        button.append(make("span", "cib-list-preview", value(item, ["last_message", "preview"], "")));
        var meta = make("span", "cib-list-meta");
        var unreadCount = Number(value(item, ["unread_count", "unread"], 0));
        if (unreadCount > 0) meta.append(make("span", "cib-unread", unreadCount));
        button.append(meta);
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
        var button = make("button", "cib-list-item");
        button.type = "button";
        button.dataset.ticketId = String(id);
        button.setAttribute("aria-current", String(String(id) === String(state.ticketId)));
        var top = make("span", "cib-list-item-top");
        top.append(make("span", "cib-list-item-title", value(ticket, ["subject", "title", "concern"], "Support request")));
        top.append(make("span", "cib-tag", value(ticket, ["status", "state"], "Open")));
        button.append(top);
        button.append(make("span", "cib-list-meta", dateText(value(ticket, ["updated_at", "created_at"]))));
        button.addEventListener("click", function () { openThreadView("cibConcernsPanel"); selectTicket(String(id)); });
        list.append(button);
      });
    }

    function renderQuote(quote) {
      if (!quote || typeof quote !== "object") return null;
      var card = make("article", "cib-quote");
      var head = make("div", "cib-quote-head");
      head.append(make("span", "", value(quote, ["title", "name"], "Quotation Summary")));
      head.append(make("span", "", value(quote, ["reference", "booking_number"], "")));
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

    function appendAttachments(container, attachments) {
      if (!Array.isArray(attachments)) return;
      attachments.forEach(function (file) {
        var url = value(file, ["url", "href", "path"]);
        if (!url) return;
        var name = value(file, ["name", "filename", "original_name"], "Attachment");
        var link = make("a", "cib-attachment");
        link.href = url;
        link.target = "_blank";
        link.rel = "noopener noreferrer";
        var type = String(value(file, ["mime_type", "type"], "")).toLowerCase();
        if (type.startsWith("image/")) {
          var image = document.createElement("img");
          image.src = url;
          image.alt = name;
          link.append(image);
        }
        link.append(make("span", "", name));
        container.append(link);
      });
    }

    function renderMessages(feed, messages) {
      feed.replaceChildren();
      if (!messages.length) {
        feed.append(make("p", "cib-state", "No messages in this conversation yet."));
        return;
      }
      messages.forEach(function (message) {
        var mine = message.is_mine === true || String(value(message, ["direction", "sender_type"], "")).toLowerCase() === "outgoing" || message.from_customer === true;
        var bubble = make("article", "cib-message" + (mine ? " is-mine" : ""));
        var content = value(message, ["message", "body", "content", "text"]);
        if (content) bubble.append(make("div", "cib-bubble", content));
        appendAttachments(bubble, value(message, ["attachments", "files"], []));
        var quote = renderQuote(value(message, ["quotation", "quote", "quotation_summary"]));
        if (quote) bubble.append(quote);
        var who = value(message, ["sender_name", "sender", "author_name"], mine ? "You" : "Catering team");
        var sent = dateText(value(message, ["created_at", "sent_at", "timestamp"]));
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
        state.conversations = records(payload, ["conversations", "records"]);
        renderConversations();
        if (!state.conversationId && state.conversations.length) {
          var firstId = value(state.conversations[0], ["conversation_id", "id"]);
          if (firstId) await selectConversation(String(firstId));
        }
      } catch (error) { state.conversations = []; renderConversations(); showError(stateNode, error); return []; }
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
      status.textContent = value(item, ["status"], "Active");
      status.hidden = !status.textContent;
      var feed = $("#cibMessageFeed");
      setState(feed, "Loading messages…", true);
      try {
        var payload = await request("messages", null, { conversation_id: id });
        renderMessages(feed, records(payload, ["messages", "records"]));
      } catch (error) { feed.replaceChildren(); feed.append(make("p", "cib-state", error.message)); }
    }

    async function loadTickets() {
      var stateNode = $("#cibTicketState");
      setState(stateNode, "Loading support tickets…", true);
      try {
        var payload = await request("list_tickets");
        state.tickets = records(payload, ["tickets", "records"]);
        renderTickets();
        if (!state.ticketId && state.tickets.length) {
          var firstId = value(state.tickets[0], ["ticket_id", "id"]);
          if (firstId) await selectTicket(String(firstId));
        }
      } catch (error) { showError(stateNode, error); }
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
        renderMessages(feed, records(payload, ["messages", "replies", "records"]));
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
      window.setTimeout(function () { ticketSubject.focus(); }, 0);
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
      if (!subject || !description) { ticketForm.reportValidity(); return; }
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
        state.conversationId = "";
        setActiveTab("messages");
        await loadConversations();
        var matchingConversation = state.conversations.find(function (item) {
          return String(value(item, ["conversation_id", "id"])) === String(conversationId);
        });
        if (!matchingConversation) {
          var normalizedSubject = subject.toLowerCase();
          matchingConversation = state.conversations.slice().reverse().find(function (item) {
            return String(value(item, ["title", "subject", "event_name", "inquiry_name"], "")).trim().toLowerCase() === normalizedSubject;
          });
        }
        openThreadView("cibMessagesPanel");
        if (conversationId || matchingConversation) {
          await selectConversation(String(conversationId || value(matchingConversation, ["conversation_id", "id"])));
        } else {
          state.conversationId = "";
          renderConversations();
          $("#cibThreadTitle").textContent = subject;
          $("#cibThreadMeta").textContent = "Support ticket created";
          $("#cibMessageText").disabled = true;
          $("#cibSendMessage").disabled = true;
          $("#cibMessageFeed").replaceChildren(make("p", "cib-state", "The ticket was created, but the API did not return a linked conversation. The backend should create the conversation with the first message and return its conversation_id."));
        }
      } catch (error) { showError(errorNode, error); }
      finally { button.disabled = false; }
    });

    /* Reopen Ticket: restores an accidentally closed concern (needs action=reopen_ticket in the API). */
    $("#cibReopenTicket").addEventListener("click", async function (event) {
      if (!state.ticketId) return;
      var button = event.currentTarget;
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
    "buffet with setup": "Buffet with setup",
    "buffet service": "Buffet with setup",
    "buffet setup": "Buffet with setup"
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
    var raw = String(value);
    var date = new Date(raw);
    if (isNaN(date.getTime())) return raw;
    try {
      return new Intl.DateTimeFormat(undefined, { month: "short", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit" }).format(date);
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

  function stepFor(status, booking) {
    var value = normalizeStatus(status);
    if (value.indexOf("complete") !== -1) return 4;
    if (value.indexOf("confirm") !== -1 || value.indexOf("await") !== -1 || value.indexOf("response") !== -1 || value.indexOf("payment pending") !== -1) return booking ? 3 : 3;
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

  // 0 = Inquiry Sent is current, 1 = Quotation in Preparation, 2 = Quotation Sent
  // (a submitted inquiry is already "sent", so the current stage is the quotation being prepared)
  function inquiryStepFor(status) {
    var value = normalizeStatus(status);
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
    if (node) node.textContent = first ? greeting + ", " + first + "." : "Welcome back.";
    var dateNode = page.querySelector("#homeTodayDate");
    if (dateNode) dateNode.textContent = new Intl.DateTimeFormat(undefined, { weekday: "long", month: "long", day: "numeric", year: "numeric" }).format(new Date());
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
    var reference = firstValue(record, ["reference", "reference_no", "referenceNo", "booking_reference", "bookingReference", "inquiry_reference", "inquiryReference", "booking_id", "bookingId", "inquiry_id", "inquiryId"]);

    text(page, prefix + "Title", title);
    text(page, prefix + "Status", booking ? (status || "Confirmed") : status);
    text(page, prefix + "Date", formatDate(date));
    text(page, prefix + "Guests", guestCount(guests));
    text(page, prefix + "Venue", venue);
    text(page, booking ? "homeBookingServiceArrangement" : "homeServiceArrangement", arrangement(service));
    text(page, prefix + "Reference", reference);
    if (booking) {
      paintStepper(page, "homeBookingStepper", stepFor(status, booking));
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
    var empty = page.querySelector("#homeEmptyState");
    if (booking) renderRecord(page, booking, "booking");
    else if (inquiry) renderRecord(page, inquiry, "inquiry");
    else if (empty) empty.hidden = false;
  }

  function routeFor(root, route) {
    var file = route === "inquiries" || route === "new-inquiry" ? "customer-inquiries.html" : route === "inbox" ? "customer-inbox.html" : "customer-bookings.html";
    var links = Array.prototype.slice.call(document.querySelectorAll("a[href], [data-page], [data-route]"));
    for (var i = 0; i < links.length; i += 1) {
      var link = links[i];
      if (root.contains(link)) continue;
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
          if (statusNode) statusNode.hidden = true;
          page.setAttribute("aria-busy", "false");
        })
        .catch(function () {
          if (statusNode) statusNode.hidden = true;
          if (errorMessage) errorMessage.textContent = "Dashboard data could not be loaded. Check the Home API and try again.";
          if (errorCard) errorCard.hidden = false;
          page.setAttribute("aria-busy", "false");
        });
    }

    if (retry) retry.addEventListener("click", load);
    page.addEventListener("click", function (event) {
      var button = event.target.closest("[data-home-route]");
      if (!button) return;
      var route = button.getAttribute("data-home-route");
      if (route === "new-inquiry") {
        try { sessionStorage.setItem("crmOpenInquiryWizardOnce", "1"); } catch (error) { /* Continue to inquiry page. */ }
      }
      var link = routeFor(page, route);
      if (link) {
        event.preventDefault();
        link.click();
      } else if (route === "new-inquiry") {
        window.location.href = "html-contentLoadsInNavbar/customer-inquiries.html#inquiryWizardModal";
      }
    });
    load();
  }

  function scanCustomerHome() {
    document.querySelectorAll("#customerHomePage").forEach(initCustomerHome);
    tryOpenInquiryWizard();
  }

  if (document.body) {
    scanCustomerHome();
    new MutationObserver(scanCustomerHome).observe(document.body, { childList: true, subtree: true });
  } else document.addEventListener("DOMContentLoaded", scanCustomerHome, { once: true });
})();