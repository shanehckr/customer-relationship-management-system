/* Central transient CRM notifications. Does not interact with the in-app notification feed. */
(function () {
  "use strict";
  if (window.crmToast) return;
  var recent = new Map();
  var icons = { success: "✓", error: "!", warning: "!", info: "i" };
  var labels = { success: "Success", error: "Error", warning: "Warning", info: "Information" };

  function host() {
    var el = document.getElementById("crmToastViewport");
    if (!el) {
      el = document.createElement("div");
      el.id = "crmToastViewport";
      el.setAttribute("aria-live", "polite");
      el.setAttribute("aria-relevant", "additions");
      el.setAttribute("aria-atomic", "false");
      document.body.appendChild(el);
    }
    return el;
  }

  function notify(message, type, options) {
    message = String(message == null ? "" : message).trim();
    if (!message) return null;
    type = Object.prototype.hasOwnProperty.call(icons, type) ? type : "info";
    options = options || {};
    var key = type + "\u0000" + message;
    var now = Date.now();
    var previous = recent.get(key);
    if (previous && now - previous.time < 1800) return previous.node || null;
    recent.forEach(function (entry, item) { if (now - entry.time > 10000) recent.delete(item); });

    var item = document.createElement("div");
    item.className = "crm-toast crm-toast--" + type;
    item.setAttribute("role", type === "error" ? "alert" : "status");
    item.setAttribute("aria-label", labels[type]);
    var icon = document.createElement("span");
    icon.className = "crm-toast__icon";
    icon.setAttribute("aria-hidden", "true");
    icon.textContent = icons[type];
    var text = document.createElement("span");
    text.className = "crm-toast__message";
    text.textContent = message;
    var close = document.createElement("button");
    close.type = "button";
    close.className = "crm-toast__close";
    close.setAttribute("aria-label", "Dismiss notification");
    close.textContent = "×";
    item.append(icon, text, close);
    var viewport = host();
    viewport.appendChild(item);
    while (viewport.children.length > 3) viewport.firstElementChild.remove();
    recent.set(key, { time: now, node: item });

    var timer, remaining = Number(options.duration) || 4500, started = Date.now();
    function dismiss() {
      if (!item.isConnected || item.classList.contains("is-leaving")) return;
      clearTimeout(timer);
      item.classList.add("is-leaving");
      item.classList.remove("is-visible");
      window.setTimeout(function () { item.remove(); }, 240);
    }
    function resume() { started = Date.now(); timer = window.setTimeout(dismiss, remaining); }
    function pause() { clearTimeout(timer); remaining = Math.max(250, remaining - (Date.now() - started)); }
    close.addEventListener("click", dismiss);
    item.addEventListener("mouseenter", pause);
    item.addEventListener("mouseleave", resume);
    item.addEventListener("focusin", pause);
    item.addEventListener("focusout", resume);
    requestAnimationFrame(function () { item.classList.add("is-visible"); });
    resume();
    return item;
  }
  notify.dismissAll = function () {
    var el = document.getElementById("crmToastViewport");
    if (el) el.querySelectorAll(".crm-toast").forEach(function (toast) { toast.remove(); });
  };
  window.crmToast = notify;

  function renderServerMessages() {
    document.querySelectorAll("[data-crm-toast]").forEach(function (node) {
      notify(node.textContent, node.getAttribute("data-crm-toast"));
      node.remove();
    });
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", renderServerMessages);
  else renderServerMessages();
})();
