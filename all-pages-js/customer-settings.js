/* customer-settings.js - Customer > Settings page (html-content-navbar/customer-settings.html).
   Talks to customer-account-api.php. The shell inserts the page markup, so this script watches for #csPage
   (same pattern customer-pages.js uses) and wires it up each time the page is opened. */
(function () {
  "use strict";

  var API = "customer-account-api.php";

  function init(page) {
    var csrf = "";
    var user = null;                 // last profile saved on the server
    var pendingEmail = "";           // new email waiting for its code

    function $(sel) { return page.querySelector(sel); }
    function $all(sel) { return Array.prototype.slice.call(page.querySelectorAll(sel)); }

    /* ---------- small helpers ---------- */
    var toastTimer = null;
    function toast(message, isError) {
      var el = $("#csToast");
      if (!el) return;
      el.textContent = message;
      el.classList.toggle("is-error", !!isError);
      el.classList.add("show");
      clearTimeout(toastTimer);
      toastTimer = setTimeout(function () { el.classList.remove("show"); }, 3500);
    }

    function request(action, formData) {
      var opts = { credentials: "same-origin", headers: {} };
      if (formData) {
        opts.method = "POST";
        opts.body = formData;
        opts.headers["X-CSRF-Token"] = csrf;
      }
      return fetch(API + "?action=" + action, opts).then(function (res) {
        return res.json().catch(function () {
          throw new Error("The server sent an unexpected answer (HTTP " + res.status + "). Check customer-account-api.php.");
        }).then(function (data) {
          if (!data.success) {
            var err = new Error(data.message || "Something went wrong.");
            err.field = data.field || "";
            throw err;
          }
          return data;
        });
      });
    }

    function form(obj) {
      var fd = new FormData();
      Object.keys(obj).forEach(function (k) { fd.append(k, obj[k]); });
      return fd;
    }

    function clearErrors(scope) {
      $all(scope + " [data-cs-err]").forEach(function (n) { n.textContent = ""; });
      $all(scope + " .modal-input-field").forEach(function (n) { n.classList.remove("is-invalid"); });
    }

    var FIELD_INPUT = {
      full_name: "#csFullName", email: "#csEmail", phone: "#csPhone", code: "#csVerifyCode",
      current_password: "#csCurrentPass", new_password: "#csNewPass", confirm_password: "#csConfirmPass"
    };
    function fieldError(field, message) {
      var holder = $('[data-cs-err="' + field + '"]');
      var input = FIELD_INPUT[field] ? $(FIELD_INPUT[field]) : null;
      if (holder) holder.textContent = message;
      if (input) { input.classList.add("is-invalid"); input.focus(); }
      return !!holder;
    }

    function initials(name) {
      var parts = String(name || "").trim().split(/\s+/).filter(Boolean);
      if (!parts.length) return "?";
      return (parts[0].charAt(0) + (parts.length > 1 ? parts[parts.length - 1].charAt(0) : "")).toUpperCase();
    }

    /* ---------- views ---------- */
    function show(view) {
      $all("[data-cs-view]").forEach(function (v) { v.classList.toggle("is-active", v.getAttribute("data-cs-view") === view); });
      var scroller = document.getElementById("mainContentArea");
      if (scroller) scroller.scrollTop = 0;
    }

    /* ---------- fill the page from the profile ---------- */
    function paint(profile) {
      user = profile;
      $all("[data-cs-avatar]").forEach(function (box) {
        box.textContent = "";
        if (profile.photo_url) {
          var img = document.createElement("img");
          img.alt = "";
          img.src = profile.photo_url;
          box.appendChild(img);
        } else {
          var span = document.createElement("span");
          span.textContent = initials(profile.full_name);
          box.appendChild(span);
        }
      });
      $("[data-cs-name]").textContent = profile.full_name;
      $("[data-cs-email]").textContent = profile.email;
      $("#csPhotoRemove").style.display = profile.photo_url ? "" : "none";
      resetPersonalForm();

      // keep the header menu in step with the saved name
      try { localStorage.setItem("userName", profile.full_name); } catch (e) { /* storage blocked */ }
      var nameEl = document.getElementById("dropdownUserName");
      if (nameEl) nameEl.textContent = profile.full_name;
      var initialEl = document.getElementById("userAvatarInitial");
      if (initialEl) initialEl.textContent = (Array.from(String(profile.full_name || "").trim().split(/\s+/)[0] || "?")[0] || "?").toUpperCase();
      if (typeof window.crmSetHeaderPhoto === "function") window.crmSetHeaderPhoto(profile.photo_url);
    }

    function resetPersonalForm() {
      if (!user) return;
      $("#csFullName").value = user.full_name;
      $("#csEmail").value = user.email;
      $("#csPhone").value = user.phone;
      closeVerify();
      clearErrors("#csPersonalForm");
      hideAlert("#csPersonalAlert");
    }

    function showAlert(sel, message) {
      var a = $(sel);
      a.textContent = message;
      a.classList.add("is-error");
    }
    function hideAlert(sel) {
      var a = $(sel);
      a.textContent = "";
      a.classList.remove("is-error");
    }

    /* ---------- navigation ---------- */
    $all("[data-cs-go]").forEach(function (btn) {
      btn.addEventListener("click", function () {
        var target = btn.getAttribute("data-cs-go");
        if (target === "home" && personalDirty() && !window.confirm("You have unsaved changes. Discard them?")) return;
        if (target === "home") { resetPersonalForm(); resetPasswordForm(); }
        show(target);
      });
    });

    /* ---------- personal information ---------- */
    function personalDirty() {
      if (!user) return false;
      return $("#csFullName").value.trim() !== user.full_name ||
             $("#csEmail").value.trim().toLowerCase() !== user.email.toLowerCase() ||
             $("#csPhone").value.trim() !== user.phone;
    }

    $("#csPersonalCancel").addEventListener("click", function () {
      if (personalDirty() && !window.confirm("You have unsaved changes. Discard them?")) return;
      resetPersonalForm();
      show("home");
    });

    function openVerify(email) {
      pendingEmail = email;
      $("#csVerifyEmail").textContent = email;
      $("#csVerifyBox").classList.add("is-open");
      $("#csVerifyCode").value = "";
      $("#csVerifyCode").focus();
    }
    function closeVerify() {
      pendingEmail = "";
      $("#csVerifyBox").classList.remove("is-open");
    }

    function sendEmailCode(email) {
      return request("email_request", form({ email: email })).then(function (data) {
        openVerify(data.email);
        toast(data.message);
      });
    }

    $("#csPersonalForm").addEventListener("submit", function (ev) {
      ev.preventDefault();
      clearErrors("#csPersonalForm");
      hideAlert("#csPersonalAlert");

      var name = $("#csFullName").value.trim();
      var email = $("#csEmail").value.trim().toLowerCase();
      var phone = $("#csPhone").value.trim();
      if (!name) return void fieldError("full_name", "Enter your full name.");
      if (!/^\S+@\S+\.\S+$/.test(email)) return void fieldError("email", "Enter a valid email address.");
      if (!phone) return void fieldError("phone", "Enter your contact number.");

      var save = $("#csPersonalSave");
      save.disabled = true;
      var emailChanged = email !== user.email.toLowerCase();

      request("update_profile", form({ full_name: name, phone: phone }))
        .then(function (data) {
          var keepEmail = $("#csEmail").value;
          paint(data.profile);
          if (!emailChanged) { toast("Your details were saved."); return null; }
          $("#csEmail").value = keepEmail;                 // paint() reset it; keep what the customer typed
          return sendEmailCode(email);
        })
        .catch(function (err) {
          if (!err.field || !fieldError(err.field, err.message)) showAlert("#csPersonalAlert", err.message);
        })
        .then(function () { save.disabled = false; });
    });

    $("#csVerifyBtn").addEventListener("click", function () {
      var code = $("#csVerifyCode").value.replace(/\D+/g, "");
      clearErrors("#csVerifyBox");
      if (code.length !== 6) return void fieldError("code", "Enter the 6-digit code.");
      var btn = $("#csVerifyBtn");
      btn.disabled = true;
      request("email_verify", form({ code: code }))
        .then(function (data) { paint(data.profile); toast(data.message); })
        .catch(function (err) { fieldError("code", err.message); })
        .then(function () { btn.disabled = false; });
    });

    $("#csResendBtn").addEventListener("click", function () {
      if (!pendingEmail) return;
      var btn = $("#csResendBtn");
      btn.disabled = true;
      sendEmailCode(pendingEmail)
        .catch(function (err) { fieldError("code", err.message); })
        .then(function () { setTimeout(function () { btn.disabled = false; }, 45000); });
    });

    $("#csVerifyCancel").addEventListener("click", function () {
      closeVerify();
      $("#csEmail").value = user.email;
      clearErrors("#csVerifyBox");
    });

    /* ---------- profile photo ---------- */
    $("#csPhotoBtn").addEventListener("click", function () { $("#csPhotoInput").click(); });

    $("#csPhotoInput").addEventListener("change", function () {
      var file = this.files && this.files[0];
      this.value = "";
      if (!file) return;
      if (["image/jpeg", "image/png", "image/webp"].indexOf(file.type) === -1) return void toast("Use a JPG, PNG or WEBP photo.", true);
      if (file.size > 2 * 1024 * 1024) return void toast("The photo must be 2 MB or smaller.", true);
      var fd = new FormData();
      fd.append("photo", file);
      request("photo_upload", fd)
        .then(function (data) { paint(data.profile); toast(data.message); })
        .catch(function (err) { toast(err.message, true); });
    });

    $("#csPhotoRemove").addEventListener("click", function () {
      if (!window.confirm("Remove your profile photo?")) return;
      request("photo_remove", new FormData())
        .then(function (data) { paint(data.profile); toast(data.message); })
        .catch(function (err) { toast(err.message, true); });
    });

    /* ---------- password & security ---------- */
    $all("[data-cs-eye]").forEach(function (btn) {
      btn.addEventListener("click", function () {
        var input = $("#" + btn.getAttribute("data-cs-eye"));
        var visible = input.type === "text";
        input.type = visible ? "password" : "text";
        btn.setAttribute("aria-label", visible ? "Show password" : "Hide password");
        var icon = btn.querySelector("i");
        if (icon) icon.className = visible ? "bi bi-eye-slash" : "bi bi-eye";
      });
    });

    function rules() {
      var cur = $("#csCurrentPass").value, pw = $("#csNewPass").value;
      return {
        len: pw.length >= 8,
        "case": /[a-z]/.test(pw) && /[A-Z]/.test(pw),
        num: /\d/.test(pw),
        diff: pw !== "" && pw !== cur
      };
    }
    function paintRules() {
      var r = rules();
      $all("[data-cs-rule]").forEach(function (li) { li.classList.toggle("is-ok", !!r[li.getAttribute("data-cs-rule")]); });
    }
    ["#csCurrentPass", "#csNewPass"].forEach(function (s) { $(s).addEventListener("input", paintRules); });

    function resetPasswordForm() {
      $("#csPasswordForm").reset();
      $all("#csPasswordForm input").forEach(function (i) { if (i.id) i.type = "password"; });
      $all("#csPasswordForm .settings-password-toggle i").forEach(function (ic) { ic.className = "bi bi-eye-slash"; });
      clearErrors("#csPasswordForm");
      hideAlert("#csPasswordAlert");
      paintRules();
    }

    $("#csPasswordCancel").addEventListener("click", function () { resetPasswordForm(); show("home"); });

    $("#csPasswordForm").addEventListener("submit", function (ev) {
      ev.preventDefault();
      clearErrors("#csPasswordForm");
      hideAlert("#csPasswordAlert");
      var cur = $("#csCurrentPass").value, pw = $("#csNewPass").value, cf = $("#csConfirmPass").value;
      var r = rules();
      if (!cur) return void fieldError("current_password", "Enter your current password.");
      if (!r.len || !r["case"] || !r.num) return void fieldError("new_password", "The new password does not meet the requirements.");
      if (!r.diff) return void fieldError("new_password", "The new password must be different from your current password.");
      if (pw !== cf) return void fieldError("confirm_password", "The new passwords do not match.");

      var btn = $("#csPasswordSave");
      btn.disabled = true;
      request("change_password", form({ current_password: cur, new_password: pw, confirm_password: cf }))
        .then(function (data) { resetPasswordForm(); show("home"); toast(data.message); })
        .catch(function (err) {
          if (!err.field || !fieldError(err.field, err.message)) showAlert("#csPasswordAlert", err.message);
        })
        .then(function () { btn.disabled = false; });
    });

    /* ---------- first load ---------- */
    paintRules();
    request("get")
      .then(function (data) { csrf = data.csrf_token; paint(data.profile); })
      .catch(function (err) {
        $("[data-cs-name]").textContent = "Could not load your account";
        $("[data-cs-email]").textContent = err.message;
      });
  }

  function scan() {
    var page = document.getElementById("csPage");
    if (page && !page.dataset.csReady) {
      page.dataset.csReady = "1";
      init(page);
    }
  }

  if (document.body) new MutationObserver(scan).observe(document.body, { childList: true, subtree: true });
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", scan, { once: true });
  else scan();
})();