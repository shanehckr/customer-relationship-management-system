// Render the notification bell and its dropdown panel.
(function () {
  'use strict';

  // Configure the feed URL, refresh interval, and icon path prefix.
  var API_URL = 'notifications-api.php';
  var NOTIFICATIONS_URL = API_URL + '?action=list';
  var REFRESH_MS = 30000;
  var ICON_FOLDER = '';

  var MIN = 60 * 1000;

  // Map notification types to their icons.
  var ICON_FILES = {
    lead:     'icons/leads-and-deals-icon.svg',
    deal:     'icons/leads-and-deals-icon.svg',
    ticket:   'icons/tickets-icon.svg',
    activity: 'icons/activity-icon.svg',
    customer: 'icons/contacts-icon.svg'
  };
  var DEFAULT_ICON = 'dashboard icon.svg';

  var items = [];
  var panel = null;
  var nextId = 1000;

  function esc(v) {
    return String(v === null || v === undefined ? '' : v)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }

  function iconSrc(type) {
    return encodeURI(ICON_FOLDER + (ICON_FILES[type] || DEFAULT_ICON));
  }

  function timeAgo(item) {
    if (item.time) return item.time;
    var t = new Date(item.createdAt).getTime();
    if (isNaN(t)) return '';
    var mins = Math.floor((Date.now() - t) / MIN);
    if (mins < 1) return 'Just now';
    if (mins < 60) return mins + ' min ago';
    var hrs = Math.floor(mins / 60);
    if (hrs < 24) return hrs + ' hr ago';
    var days = Math.floor(hrs / 24);
    return days + (days === 1 ? ' day ago' : ' days ago');
  }

  function unreadCount() {
    return items.filter(function (n) { return !n.read; }).length;
  }

  // Update the unread indicator on the bell.
  function updateDot() {
    var dot = document.getElementById('notificationDot');
    if (!dot) return;
    var n = unreadCount();
    dot.style.display = '';
    dot.textContent = n > 9 ? '9+' : (n || '');   // number of unread notifications on the bell
    dot.classList.toggle('active', n > 0);
    var bell = document.getElementById('notificationBell');
    if (bell) bell.setAttribute('aria-label', n ? 'Notifications, ' + n + ' unread' : 'Notifications');
  }

  // Build the notification panel once.
  function buildPanel() {
    panel = document.createElement('div');
    panel.className = 'notif-panel';
    panel.id = 'notificationPanel';
    panel.setAttribute('role', 'dialog');
    panel.setAttribute('aria-label', 'Notifications');
    panel.innerHTML =
      '<div class="notif-header">' +
        '<h6 class="notif-title">Notifications <span class="notif-count" id="notifCount"></span></h6>' +
        '<button type="button" class="notif-mark-all" id="notifMarkAll">Mark all as read</button>' +
      '</div>' +
      '<ul class="notif-list" id="notifList"></ul>';
    document.body.appendChild(panel);

    panel.querySelector('#notifMarkAll').addEventListener('click', markAllRead);
    panel.querySelector('#notifList').addEventListener('click', onItemClick);
  }

  function render() {
    if (!panel) return;
    var list = panel.querySelector('#notifList');
    var count = unreadCount();
    panel.querySelector('#notifCount').textContent = count ? '(' + count + ' new)' : '';
    panel.querySelector('#notifMarkAll').style.visibility = count ? 'visible' : 'hidden';

    if (!items.length) {
      list.innerHTML = '<li class="notif-empty">No notifications</li>';
      return;
    }
    list.innerHTML = items.map(function (n) {
      return '<li class="notif-item' + (n.read ? '' : ' unread') + '" data-id="' + esc(n.id) + '">' +
        '<div class="notif-icon"><img src="' + esc(iconSrc(n.type)) + '" alt=""></div>' +
        '<div class="notif-body">' +
          '<p class="notif-item-title">' + esc(n.title) + '</p>' +
          '<p class="notif-item-msg">' + esc(n.message) + '</p>' +
          '<span class="notif-time">' + esc(timeAgo(n)) + '</span>' +
        '</div>' +
      '</li>';
    }).join('');
  }

  function position() {
    var bell = document.getElementById('notificationBell');
    if (!bell || !panel) return;
    var r = bell.getBoundingClientRect();
    panel.style.top = (r.bottom + 10) + 'px';
    var right = Math.max(12, window.innerWidth - r.right - 8);
    panel.style.right = right + 'px';
  }

  function isOpen() { return panel && panel.classList.contains('open'); }

  function open() {
    if (!panel) buildPanel();
    render();
    position();
    loadFromServer();   // fresh list every time the bell is opened
    panel.classList.add('open');
    var bell = document.getElementById('notificationBell');
    if (bell) bell.setAttribute('aria-expanded', 'true');
  }

  function close() {
    if (!panel) return;
    panel.classList.remove('open');
    var bell = document.getElementById('notificationBell');
    if (bell) bell.setAttribute('aria-expanded', 'false');
  }

  // Update notification state in the current page.
  // Save a read change on the server so it is still read after a refresh (and on the next device).
  function saveRead(action, id) {
    if (!API_URL) return;
    fetch(API_URL + '?action=' + action, {
      method: 'POST',
      credentials: 'same-origin',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded', 'X-Requested-With': 'XMLHttpRequest' },
      body: id === undefined ? '' : 'id=' + encodeURIComponent(id)
    })
      .then(function (res) { if (!res.ok) throw new Error('HTTP ' + res.status); })
      .catch(function (err) { console.warn('Could not save notification state', err); loadFromServer(); });
  }

  function markRead(id) {
    items.forEach(function (n) { if (String(n.id) === String(id)) n.read = true; });
    render();
    updateDot();
    saveRead('mark_read', id);
  }

  function markAllRead() {
    items.forEach(function (n) { n.read = true; });
    render();
    updateDot();
    saveRead('mark_all_read');
  }

  function openPage(page) {
    if (!page || typeof window.loadPage !== 'function') return;
    var link = document.querySelector('.sidebar-nav a[onclick*="' + page + '"]');
    try { window.loadPage(page, link); } catch (err) { console.warn('Could not open', page, err); }
  }

  window.crmNavigationUnavailable = function (kind) {
    var label = ({ inquiry: 'inquiry', booking: 'booking', feedback: 'feedback', ticket: 'ticket', conversation: 'conversation' })[kind] || 'record';
    if (typeof window.crmToast === 'function') window.crmToast('That ' + label + ' is unavailable or you do not have access to it.', 'error');
  };

  function prepareDeepLink(item) {
    if (!item || !item.ref) return;
    var ref = String(item.ref).trim();
    var page = String(item.page || '').toLowerCase();
    var title = String(item.title || '').toLowerCase();
    var role = typeof window.crmNormalizeRole === 'function'
      ? window.crmNormalizeRole(localStorage.getItem('userRole'))
      : String(localStorage.getItem('userRole') || '').toLowerCase();
    var isTicket = /^TCK-/i.test(ref) || /ticket/.test(page) || item.type === 'ticket';
    var isBooking = /^BK-/i.test(ref) || /booking/.test(page);
    var isInquiry = /^INQ-/i.test(ref) || /inquir/.test(page);

    if (isTicket) {
      if (page === 'inbox' || page === 'customer-inbox.html') {
        if (role === 'customer') window.crmPendingCustomerTicketRef = ref;
        else if (role === 'customer service') window.crmPendingInboxTicket = ref;
        else window.crmPendingInboxConversation = ref;
      } else window.crmPendingTicketRef = ref;
      return;
    }
    if (isBooking) {
      if (/feedback/.test(title)) window.crmPendingFeedbackBookingRef = ref;
      else window.crmPendingBookingRef = ref;
      if (role === 'customer' && /payment|deposit|balance|paid/.test(title)) {
        try { sessionStorage.setItem('crmOpenBookingTab', '#tab-payment-details'); } catch (_) {}
      }
      return;
    }
    if (page === 'inbox' || page === 'customer-inbox.html') {
      if (role === 'customer') window.crmPendingCustomerConversationRef = ref;
      else if (role === 'manager' || role === 'admin') window.crmPendingInboxConversation = ref;
      else window.crmPendingChatRef = ref;
      return;
    }
    if (isInquiry) {
      window.crmPendingInquiryRef = ref;
      if (role === 'customer' && /quotation/.test(title)) window.crmPendingInquiryTab = 'quote';
      return;
    }
  }

  function onItemClick(e) {
    var li = e.target.closest('.notif-item');
    if (!li) return;
    var id = li.getAttribute('data-id');
    var item = items.filter(function (n) { return String(n.id) === String(id); })[0];
    markRead(id);
    close();
    prepareDeepLink(item);
    if (item) openPage(item.page);
  }

  function normalize(n) {
    return {
      id: n.id !== undefined ? n.id : nextId++,
      type: n.type || 'bell',
      title: n.title || 'New notification',
      message: n.message || '',
      createdAt: n.createdAt || Date.now(),
      time: n.time,
      read: !!n.read,
      page: n.page,
      ref: n.ref
    };
  }

  function add(n) {
    items.unshift(normalize(n || {}));
    render();
    updateDot();
  }

  function setAll(list) {
    items = (list || []).map(normalize);
    render();
    updateDot();
  }

  // Load notifications when a feed URL is configured.
  function loadFromServer() {
    if (!NOTIFICATIONS_URL) return;
    fetch(NOTIFICATIONS_URL, { credentials: 'same-origin' })
      .then(function (res) { return res.json(); })
      .then(function (data) {
        setAll(Array.isArray(data) ? data : (data && data.notifications) || []);
      })
      .catch(function (err) { console.warn('Could not load notifications', err); });
  }

  // Expose notification controls for other scripts.
  window.crmNotifications = {
    add: add, setAll: setAll, markAllRead: markAllRead, open: open, close: close, reload: loadFromServer
  };

  // Handle bell clicks and dismiss the panel.
  document.addEventListener('click', function (e) {
    if (e.target.closest('#notificationBell')) {
      e.preventDefault();
      if (isOpen()) close(); else open();
      return;
    }
    if (isOpen() && !e.target.closest('#notificationPanel')) close();
  });

  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape' && isOpen()) close();
  });

  window.addEventListener('resize', function () { if (isOpen()) position(); });

  function init() {
    updateDot();
    loadFromServer();
    if (NOTIFICATIONS_URL) setInterval(loadFromServer, REFRESH_MS);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
