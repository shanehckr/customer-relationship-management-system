/**
 * cookie-consent.js - "Privacy Preference Center" modal (Accept All / Decline Non Essential / Confirm My Choices).
 *
 * Add it to a page with:
 *   <link rel="stylesheet" href="all-pages-css/cookie-consent.css">
 *   <script src="all-pages-js/cookie-consent.js" defer
 *           data-brand="Customer Management System"           (optional - text shown at the top-left)
 *           data-logo="icons/logo.svg"                        (optional - image shown instead of the text)
 *           data-privacy-url="terms.php#privacy"></script>   (optional - the "Privacy Policy" link; this is the default)
 *
 * The choice is saved in a cookie called "cookie_consent" for 180 days, so the modal does not come back.
 * Closing the modal with the X saves nothing, so it appears again on the next visit.
 *
 * Use it from your own scripts:
 *   window.cookieConsent.get()                 -> { necessary: true, functional: true|false } or null (not chosen yet)
 *   window.cookieConsent.allows('functional')  -> true if that category was accepted
 *   window.cookieConsent.open()                -> open the modal again (e.g. from a "Cookie settings" link)
 *   Any element with the attribute data-cookie-settings also opens it when clicked.
 *
 * The PHP session cookie is strictly necessary (it keeps the user logged in), so it is always set.
 * To add or rename categories, edit the CATEGORIES list below.
 */
(function () {
  'use strict';

  var COOKIE_NAME = 'cookie_consent';
  var MAX_AGE = 60 * 60 * 24 * 180; // 180 days

  var script = document.currentScript;
  var BRAND = (script && script.getAttribute('data-brand')) || 'Customer Management System';
  var LOGO = (script && script.getAttribute('data-logo')) || '';
  var PRIVACY_URL = (script && script.getAttribute('data-privacy-url')) || 'terms.php#privacy';

  // "necessary" is always on. Every other category becomes a switch the user can turn on or off.
  var CATEGORIES = [
    {
      id: 'necessary',
      title: 'Strictly Necessary Cookies',
      locked: true,
      text: 'These cookies are required for the system to work. They keep you logged in, protect your ' +
            'account and remember your session. They cannot be switched off.'
    },
    {
      id: 'functional',
      title: 'Functional Cookies',
      locked: false,
      text: 'These cookies remember your choices, such as your display preferences, so the system feels ' +
            'the way you left it the next time you visit.'
    }
  ];

  /* ------------------------------------------------------------------ storage */
  function readCookie() {
    var match = document.cookie.match(new RegExp('(?:^|; )' + COOKIE_NAME + '=([^;]*)'));
    return match ? decodeURIComponent(match[1]) : null;
  }

  function getConsent() {
    var raw = readCookie();
    if (!raw) return null;
    try {
      var data = JSON.parse(raw);
      if (data && typeof data === 'object') {
        data.necessary = true;
        return data;
      }
    } catch (e) { /* not valid JSON: treat as no choice yet */ }
    return null;
  }

  function saveConsent(choices) {
    var data = { necessary: true };
    CATEGORIES.forEach(function (c) {
      if (!c.locked) data[c.id] = !!choices[c.id];
    });
    document.cookie =
      COOKIE_NAME + '=' + encodeURIComponent(JSON.stringify(data)) +
      '; max-age=' + MAX_AGE +
      '; path=/; SameSite=Lax' +
      (location.protocol === 'https:' ? '; Secure' : '');
    document.dispatchEvent(new CustomEvent('cookieconsent:change', { detail: data }));
  }

  /* ------------------------------------------------------------------ tiny DOM helper */
  function el(tag, className, text) {
    var node = document.createElement(tag);
    if (className) node.className = className;
    if (text !== undefined) node.textContent = text;
    return node;
  }

  /* ------------------------------------------------------------------ modal */
  var overlay = null;
  var lastFocused = null;

  function closeModal() {
    if (!overlay) return;
    var node = overlay;
    overlay = null;
    node.classList.remove('is-visible');
    document.documentElement.classList.remove('cc-lock');
    document.removeEventListener('keydown', onKeydown, true);
    setTimeout(function () {
      if (node.parentNode) node.parentNode.removeChild(node);
    }, 200);
    if (lastFocused && lastFocused.focus) lastFocused.focus();
  }

  function onKeydown(e) {
    if (!overlay) return;
    if (e.key === 'Escape') {
      closeModal();
      return;
    }
    if (e.key !== 'Tab') return;
    // Keep keyboard focus inside the modal.
    var focusable = overlay.querySelectorAll('button:not([disabled]), a[href], input:not([disabled])');
    if (!focusable.length) return;
    var first = focusable[0];
    var last = focusable[focusable.length - 1];
    if (e.shiftKey && document.activeElement === first) {
      e.preventDefault();
      last.focus();
    } else if (!e.shiftKey && document.activeElement === last) {
      e.preventDefault();
      first.focus();
    }
  }

  function buildCategory(category, current) {
    var item = el('div', 'cc-cat');
    var head = el('div', 'cc-cat__head');

    var toggleBtn = el('button', 'cc-cat__toggle');
    toggleBtn.type = 'button';
    toggleBtn.setAttribute('aria-expanded', 'false');
    var chevron = el('span', 'cc-cat__chevron');
    chevron.setAttribute('aria-hidden', 'true');
    toggleBtn.appendChild(chevron);
    toggleBtn.appendChild(el('span', 'cc-cat__title', category.title));

    var control;
    if (category.locked) {
      control = el('span', 'cc-cat__always', 'Always Active');
    } else {
      var label = el('label', 'cc-switch');
      var input = document.createElement('input');
      input.type = 'checkbox';
      input.checked = current ? !!current[category.id] : false;
      input.setAttribute('data-category', category.id);
      input.setAttribute('aria-label', category.title);
      label.appendChild(input);
      label.appendChild(el('span', 'cc-switch__slider'));
      control = label;
    }

    head.appendChild(toggleBtn);
    head.appendChild(control);

    var body = el('div', 'cc-cat__body', category.text);
    body.hidden = true;

    toggleBtn.addEventListener('click', function () {
      var open = toggleBtn.getAttribute('aria-expanded') === 'true';
      toggleBtn.setAttribute('aria-expanded', open ? 'false' : 'true');
      item.classList.toggle('is-open', !open);
      body.hidden = open;
    });

    item.appendChild(head);
    item.appendChild(body);
    return item;
  }

  function readSwitches() {
    var choices = {};
    overlay.querySelectorAll('input[data-category]').forEach(function (input) {
      choices[input.getAttribute('data-category')] = input.checked;
    });
    return choices;
  }

  function openModal() {
    if (overlay) return;
    lastFocused = document.activeElement;
    var current = getConsent();

    overlay = el('div', 'cc-overlay');

    var dialog = el('div', 'cc-dialog');
    dialog.setAttribute('role', 'dialog');
    dialog.setAttribute('aria-modal', 'true');
    dialog.setAttribute('aria-labelledby', 'ccTitle');

    /* header: logo / brand + close button */
    var header = el('div', 'cc-header');
    if (LOGO) {
      var logo = document.createElement('img');
      logo.className = 'cc-header__logo';
      logo.src = LOGO;
      logo.alt = BRAND;
      header.appendChild(logo);
    } else {
      header.appendChild(el('span', 'cc-header__brand', BRAND));
    }
    var closeBtn = el('button', 'cc-close');
    closeBtn.type = 'button';
    closeBtn.setAttribute('aria-label', 'Close');
    closeBtn.innerHTML = '&times;';
    closeBtn.addEventListener('click', closeModal);
    header.appendChild(closeBtn);

    /* scrollable content */
    var content = el('div', 'cc-content');

    var title = el('h2', 'cc-title', 'Privacy Preference Center');
    title.id = 'ccTitle';
    content.appendChild(title);

    var intro = el('p', 'cc-intro',
      'When you visit this website, it may store or retrieve information in your browser, mostly in the ' +
      'form of cookies. This information is mostly used to make the site work the way you expect. You can ' +
      'choose not to allow some types of cookies. Select a category below to find out more and change the ' +
      'default settings. Blocking some types of cookies may affect your experience of the site.');
    if (PRIVACY_URL) {
      intro.appendChild(document.createTextNode(' '));
      var policy = el('a', 'cc-link', 'Privacy Policy');
      policy.href = PRIVACY_URL;
      policy.target = '_blank';
      policy.rel = 'noopener';
      intro.appendChild(policy);
    }
    content.appendChild(intro);

    var acceptAll = el('button', 'cc-btn', 'Accept All');
    acceptAll.type = 'button';
    acceptAll.addEventListener('click', function () {
      var all = {};
      CATEGORIES.forEach(function (c) { all[c.id] = true; });
      saveConsent(all);
      closeModal();
    });
    content.appendChild(acceptAll);

    content.appendChild(el('h3', 'cc-subtitle', 'Manage Consent Preferences'));

    var list = el('div', 'cc-cats');
    CATEGORIES.forEach(function (c) { list.appendChild(buildCategory(c, current)); });
    content.appendChild(list);

    /* footer */
    var footer = el('div', 'cc-footer');

    var decline = el('button', 'cc-btn', 'Decline Non Essential Cookies');
    decline.type = 'button';
    decline.addEventListener('click', function () {
      saveConsent({});
      closeModal();
    });

    var confirm = el('button', 'cc-btn', 'Confirm My Choices');
    confirm.type = 'button';
    confirm.addEventListener('click', function () {
      saveConsent(readSwitches());
      closeModal();
    });

    footer.appendChild(decline);
    footer.appendChild(confirm);

    dialog.appendChild(header);
    dialog.appendChild(content);
    dialog.appendChild(footer);
    overlay.appendChild(dialog);
    document.body.appendChild(overlay);

    document.documentElement.classList.add('cc-lock');
    document.addEventListener('keydown', onKeydown, true);

    requestAnimationFrame(function () {
      overlay.classList.add('is-visible');
      acceptAll.focus();
    });
  }

  /* ------------------------------------------------------------------ public API */
  window.cookieConsent = {
    get: getConsent,
    allows: function (categoryId) {
      var data = getConsent();
      return !!(data && data[categoryId]);
    },
    open: openModal
  };

  function init() {
    // Any "Cookie settings" link/button on the page can reopen the modal.
    document.addEventListener('click', function (e) {
      var trigger = e.target.closest ? e.target.closest('[data-cookie-settings]') : null;
      if (trigger) {
        e.preventDefault();
        openModal();
      }
    });

    if (getConsent() === null) openModal();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();