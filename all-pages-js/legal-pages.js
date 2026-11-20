/**
 * legal-pages.js - Terms & Privacy editor (Admin only).
 * Load AFTER pages.js. Page: Settings tab "Terms & Privacy" (html-content-navbar/settings-pages.html)  <->  legal-api.php
 * Pages are loaded into the main area at runtime, so this file watches for #legalPagesPage and starts itself.
 */
(() => {
  'use strict';

  const NAMES = { terms: 'Terms of Service', privacy: 'Privacy Policy' };

  function init(page) {
    if (page.dataset.ready === '1') return;
    page.dataset.ready = '1';

    const $ = (id) => page.querySelector('#' + id);
    const api = page.dataset.api || 'legal-api.php';
    const editor = $('lgEditor');
    const note = $('lgNote');
    const saveBtn = $('lgSave');
    const discardBtn = $('lgDiscard');
    const msgBox = $('lgMsg');
    const state = { type: 'terms', docs: null, csrf: '', busy: false, baseline: '', viewing: null };

    /* ---------------- small helpers ---------------- */

    const el = (tag, cls, text) => {
      const n = document.createElement(tag);
      if (cls) n.className = cls;
      if (text !== undefined && text !== null) n.textContent = text;
      return n;
    };

    function showMsg(text, kind) {
      msgBox.textContent = text;
      msgBox.className = 'lg-msg ' + (kind || 'ok');
      msgBox.hidden = false;
      clearTimeout(showMsg.t);
      if (kind !== 'err') showMsg.t = setTimeout(() => { msgBox.hidden = true; }, 5000);
    }

    function formatDate(value) {
      if (!value) return '';
      const d = new Date(String(value).replace(' ', 'T'));
      return isNaN(d) ? String(value) : d.toLocaleString('en-PH', { year: 'numeric', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
    }

    async function request(action, params, post) {
      const query = new URLSearchParams(Object.assign({ action }, post ? {} : params || {}));
      const options = { credentials: 'same-origin', cache: 'no-store', headers: { Accept: 'application/json' } };
      if (post) {
        const body = new URLSearchParams(Object.assign({}, params || {}, { csrf_token: state.csrf }));
        options.method = 'POST';
        options.body = body;
        options.headers['X-CSRF-Token'] = state.csrf;
      }
      const response = await fetch(api + '?' + query.toString(), options);
      let json = null;
      try { json = await response.json(); } catch (e) { /* not JSON */ }
      if (!response.ok || !json || !json.success) {
        const text = (json && json.message) || 'Something went wrong. Please try again.';
        const error = new Error(text + (json && json.detail ? ' [' + json.detail + ']' : ''));
        error.status = response.status;
        throw error;
      }
      return json;
    }

    // A stale token ("session expired") is fixed automatically: get a new token and try once more.
    async function call(action, params, post) {
      try {
        return await request(action, params, post);
      } catch (error) {
        if (post && error.status === 403 && /session expired/i.test(error.message)) {
          const fresh = await request('token');
          state.csrf = fresh.csrf_token || state.csrf;
          return await request(action, params, post);
        }
        throw error;
      }
    }

    /* ---------------- editor state ---------------- */

    const isDirty = () => !state.viewing && editor.innerHTML !== state.baseline;

    function setReadOnly(on) {
      editor.setAttribute('contenteditable', on ? 'false' : 'true');
      page.classList.toggle('lg-readonly', on);
      saveBtn.disabled = on;
      discardBtn.disabled = on;
      note.disabled = on;
    }

    function placeholdersLeft() {
      return Array.from(editor.querySelectorAll('span.fill')).filter((s) => /^\s*\[.*\]\s*$/.test(s.textContent)).length;
    }

    function setMeta(doc) {
      const meta = $('lgMeta');
      meta.replaceChildren();
      if (!doc) {
        meta.textContent = 'No text saved yet for the ' + NAMES[state.type] + '.';
        return;
      }
      meta.append(
        el('strong', '', 'Version ' + doc.version),
        document.createTextNode(' - last updated ' + formatDate(doc.created_at) + ' by ' + doc.author)
      );
    }

    function showCurrent() {
      const doc = state.docs && state.docs[state.type] ? state.docs[state.type].current : null;
      state.viewing = null;
      editor.innerHTML = doc ? doc.content : '';
      state.baseline = editor.innerHTML;   // the browser's own version of the HTML, so "changed?" is accurate
      note.value = '';
      $('lgViewBanner').hidden = true;
      setReadOnly(false);
      setMeta(doc);
    }

    function renderTabs() {
      page.querySelectorAll('.lg-tab').forEach((tab) => {
        const on = tab.dataset.type === state.type;
        tab.classList.toggle('is-active', on);
        tab.setAttribute('aria-pressed', on ? 'true' : 'false');
      });
    }

    function renderVersions() {
      const list = $('lgVersions');
      list.replaceChildren();
      const versions = state.docs && state.docs[state.type] ? state.docs[state.type].versions : [];
      if (!versions.length) {
        list.appendChild(el('li', 'lg-version-meta', 'No versions yet.'));
        return;
      }
      versions.forEach((v) => {
        const li = el('li', 'lg-version');
        const top = el('div', 'lg-version-top');
        top.appendChild(el('span', '', 'Version ' + v.version));
        if (v.is_current) top.appendChild(el('span', 'lg-badge', 'Current'));
        li.appendChild(top);
        li.appendChild(el('div', 'lg-version-meta', formatDate(v.created_at) + ' - ' + v.author));
        if (v.change_note) li.appendChild(el('div', 'lg-version-note', v.change_note));

        if (!v.is_current) {
          const actions = el('div', 'lg-version-actions');
          const view = el('button', 'lg-link-btn', 'View');
          view.type = 'button';
          view.addEventListener('click', () => viewVersion(v.version));
          const restore = el('button', 'lg-link-btn is-accent', 'Restore');
          restore.type = 'button';
          restore.addEventListener('click', () => restoreVersion(v.version));
          actions.append(view, restore);
          li.appendChild(actions);
        }
        list.appendChild(li);
      });
    }

    // Modals live at the bottom of the Settings page (same design as the other Settings confirmations).
    const modalRoot = page.closest('#crmSettingsPage') || document;
    const modalById = (id) => modalRoot.querySelector('#' + id);

    /** Styled confirmation. Resolves true only when the person presses the main button. */
    function askConfirm(opts) {
      const modalEl = modalById('legalConfirmModal');
      if (!modalEl || !window.bootstrap || !window.bootstrap.Modal) return Promise.resolve(window.confirm(opts.text));

      const yes = modalEl.querySelector('[data-lg-yes]');
      modalEl.querySelector('[data-lg-title]').textContent = opts.title;
      modalEl.querySelector('[data-lg-text]').textContent = opts.text;
      yes.textContent = opts.yes || 'Yes';
      yes.className = 'btn px-4 py-2 ' + (opts.danger ? 'modal-btn-danger' : 'modal-btn-save');

      return new Promise((resolve) => {
        let answer = false;
        const modal = window.bootstrap.Modal.getOrCreateInstance(modalEl);
        const onYes = () => { answer = true; modal.hide(); };
        const onHidden = () => {
          yes.removeEventListener('click', onYes);
          modalEl.removeEventListener('hidden.bs.modal', onHidden);
          resolve(answer);
        };
        yes.addEventListener('click', onYes);
        modalEl.addEventListener('hidden.bs.modal', onHidden);
        modal.show();
      });
    }

    /** Styled "link address" box. Resolves with the address, or null when cancelled. */
    function askLink() {
      const modalEl = modalById('legalLinkModal');
      if (!modalEl || !window.bootstrap || !window.bootstrap.Modal) {
        const url = window.prompt('Link address (starts with https://, mailto: or tel:)', 'https://');
        return Promise.resolve(url && /^(https?:\/\/|mailto:|tel:)/i.test(url.trim()) ? url.trim() : null);
      }

      const form = modalEl.querySelector('form');
      const input = modalEl.querySelector('[data-lg-link-input]');
      const error = modalEl.querySelector('[data-lg-link-error]');
      input.value = 'https://';
      error.classList.add('d-none');

      return new Promise((resolve) => {
        let result = null;
        const modal = window.bootstrap.Modal.getOrCreateInstance(modalEl);
        const onSubmit = (e) => {
          e.preventDefault();
          const value = input.value.trim();
          if (!/^(https?:\/\/|mailto:|tel:)\S+/i.test(value)) {
            error.textContent = 'The link must start with https://, mailto: or tel:';
            error.classList.remove('d-none');
            input.focus();
            return;
          }
          result = value;
          modal.hide();
        };
        const onShown = () => { input.focus(); input.setSelectionRange(input.value.length, input.value.length); };
        const onHidden = () => {
          form.removeEventListener('submit', onSubmit);
          modalEl.removeEventListener('shown.bs.modal', onShown);
          modalEl.removeEventListener('hidden.bs.modal', onHidden);
          resolve(result);
        };
        form.addEventListener('submit', onSubmit);
        modalEl.addEventListener('shown.bs.modal', onShown);
        modalEl.addEventListener('hidden.bs.modal', onHidden);
        modal.show();
      });
    }

    async function discardCheck() {
      if (!isDirty()) return true;
      return askConfirm({
        title: 'Discard changes?',
        text: 'You have unsaved changes to the ' + NAMES[state.type] + '. Are you sure you want to discard them?',
        yes: 'Discard Changes',
        danger: true
      });
    }

    /* ---------------- actions ---------------- */

    async function load() {
      const json = await request('list');
      state.docs = json.documents;
      state.csrf = json.csrf_token || state.csrf;
      renderTabs();
      renderVersions();
      showCurrent();
    }

    async function viewVersion(version) {
      if (!(await discardCheck())) return;
      try {
        const json = await request('version', { type: state.type, version: String(version) });
        state.viewing = version;
        editor.innerHTML = json.content;
        setReadOnly(true);
        $('lgViewText').textContent = 'Viewing version ' + version + ' (read only). Restore it from the history list, or go back.';
        $('lgViewBanner').hidden = false;
        editor.scrollTop = 0;
      } catch (error) {
        showMsg(error.message, 'err');
      }
    }

    async function restoreVersion(version) {
      if (!(await discardCheck())) return;
      const ok = await askConfirm({
        title: 'Restore version ' + version + '?',
        text: 'It will be saved as a new version of the ' + NAMES[state.type] + ' and shown to customers right away.',
        yes: 'Yes, Restore'
      });
      if (!ok) return;
      try {
        const json = await call('restore', { type: state.type, version: String(version) }, true);
        await load();
        showMsg(json.message, 'ok');
      } catch (error) {
        showMsg(error.message, 'err');
      }
    }

    async function save() {
      if (state.busy || state.viewing) return;

      if (!editor.textContent.trim()) {
        showMsg('The text is empty.', 'err');
        editor.focus();
        return;
      }
      if (!isDirty()) {
        showMsg('No changes to save.', 'err');
        return;
      }
      const changeNote = note.value.trim();
      if (!changeNote) {
        showMsg('Write a short note about what you changed.', 'err');
        note.focus();
        return;
      }
      const left = placeholdersLeft();
      if (left) {
        const ok = await askConfirm({
          title: 'Placeholders still in the text',
          text: left + ' [bracket] placeholder(s) are still in the text and customers will see them. Save anyway?',
          yes: 'Save Anyway'
        });
        if (!ok) return;
      }

      state.busy = true;
      saveBtn.disabled = true;
      saveBtn.textContent = 'Saving...';
      try {
        const json = await call('save', { type: state.type, content: editor.innerHTML, change_note: changeNote }, true);
        await load();
        showMsg(json.message + ' Customers see the new text now.', 'ok');
      } catch (error) {
        showMsg(error.message, 'err');
      } finally {
        state.busy = false;
        saveBtn.textContent = 'Save as new version';
        saveBtn.disabled = !!state.viewing;
      }
    }

    /* ---------------- events ---------------- */

    page.querySelectorAll('.lg-tab').forEach((tab) => {
      tab.addEventListener('click', async () => {
        if (tab.dataset.type === state.type || !(await discardCheck())) return;
        state.type = tab.dataset.type;
        renderTabs();
        renderVersions();
        showCurrent();
      });
    });

    page.querySelectorAll('[data-cmd]').forEach((btn) => {
      btn.addEventListener('mousedown', (e) => e.preventDefault());   // keep the text selection
      btn.addEventListener('click', async () => {
        if (editor.getAttribute('contenteditable') !== 'true') return;
        editor.focus();
        const cmd = btn.dataset.cmd;
        if (cmd === 'createLink') {
          const selection = window.getSelection();
          if (!selection || selection.isCollapsed) {
            showMsg('Select the text first, then click the link button.', 'err');
            return;
          }
          const saved = selection.getRangeAt(0).cloneRange();   // the box below steals the selection
          const url = await askLink();
          if (!url) return;
          editor.focus();
          selection.removeAllRanges();
          selection.addRange(saved);
          document.execCommand('createLink', false, url);
          return;
        }
        document.execCommand(cmd, false, btn.dataset.val || null);
      });
    });

    editor.addEventListener('focus', () => {
      try {
        document.execCommand('styleWithCSS', false, false);
        document.execCommand('defaultParagraphSeparator', false, 'p');
      } catch (e) { /* older browsers */ }
    });

    // Paste as plain text: text copied from Word or a website brings hidden styles with it.
    editor.addEventListener('paste', (e) => {
      e.preventDefault();
      const text = (e.clipboardData || window.clipboardData).getData('text/plain');
      document.execCommand('insertText', false, text);
    });

    $('lgBackToCurrent').addEventListener('click', showCurrent);
    discardBtn.addEventListener('click', async () => {
      if (!isDirty()) return;
      const ok = await askConfirm({
        title: 'Discard changes?',
        text: 'Your changes to the ' + NAMES[state.type] + ' will be lost and the saved text will come back.',
        yes: 'Discard Changes',
        danger: true
      });
      if (ok) showCurrent();
    });
    saveBtn.addEventListener('click', save);

    load().catch((error) => {
      $('lgMeta').textContent = '';
      showMsg(error.message, 'err');
    });
  }

  function scan() {
    const page = document.getElementById('legalPagesPage');
    // Admin only (the server refuses everyone else too). The same "role-admin" class settings.js uses.
    if (!document.documentElement.classList.contains('role-admin')) return;
    if (page && page.dataset.ready !== '1') init(page);
  }

  new MutationObserver(scan).observe(document.body, { childList: true, subtree: true });
  scan();
})();