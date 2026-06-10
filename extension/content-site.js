/**
 * Incognito Companion — site content script (ISOLATED world, all sites).
 *
 * Does the page work a web app can't: find the login form, fill the single
 * credential the app handed over, and offer to save a login the user just
 * submitted. It never stores secrets and never talks to a page other than the
 * one it runs in. All vault data comes from the background → app-tab round trip.
 */
(function () {
  'use strict';

  const PASSWORD_SEL = 'input[type="password"]';
  const USERNAME_SEL = 'input[type="email"], input[type="text"], input[autocomplete="username"], input[name*="user" i], input[name*="email" i], input[id*="user" i], input[id*="email" i]';

  function findFields() {
    const password = document.querySelector(PASSWORD_SEL);
    let username = null;
    if (password) {
      // Prefer a username-ish field that appears before the password field.
      const candidates = [...document.querySelectorAll(USERNAME_SEL)].filter((el) => el.type !== 'password');
      username = candidates.find((el) => password.compareDocumentPosition(el) & Node.DOCUMENT_POSITION_PRECEDING)
        || candidates[0] || null;
    }
    const totp = document.querySelector('input[autocomplete="one-time-code"], input[name*="otp" i], input[name*="code" i]');
    return { username, password, totp };
  }

  function setValue(el, value) {
    if (!el || value == null) return;
    const proto = Object.getPrototypeOf(el);
    const setter = Object.getOwnPropertyDescriptor(proto, 'value')?.set;
    if (setter) setter.call(el, value); else el.value = value;
    el.dispatchEvent(new Event('input', { bubbles: true }));
    el.dispatchEvent(new Event('change', { bubbles: true }));
  }

  // Receive INJECT commands from the background (carrying one decrypted item).
  chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
    if (message?.kind !== 'INJECT') return false;
    const fields = findFields();
    if (message.kind === 'INJECT' && message.code) {
      setValue(fields.totp || fields.username, message.code);
    } else if (message.fill) {
      setValue(fields.username, message.fill.username);
      setValue(fields.password, message.fill.password);
      if (fields.password) fields.password.focus();
    }
    sendResponse?.({ ok: true });
    return true;
  });

  // Offer matches when the user focuses a login field.
  let offered = false;
  function maybeOfferAutofill() {
    if (offered) return;
    const { password } = findFields();
    if (!password) return;
    offered = true;
    chrome.runtime.sendMessage({ kind: 'SITE_MATCH', domain: location.hostname }, (resp) => {
      if (!resp?.ok || !resp.matches?.length) return;
      showChooser(resp.matches);
    });
  }
  document.addEventListener('focusin', (e) => {
    if (e.target?.matches?.(PASSWORD_SEL) || e.target?.matches?.(USERNAME_SEL)) maybeOfferAutofill();
  }, true);

  function showChooser(matches) {
    const { password } = findFields();
    if (!password) return;
    const box = document.createElement('div');
    box.style.cssText = 'position:absolute;z-index:2147483647;background:#1e1b2e;color:#eee;border:1px solid #6d28d9;border-radius:8px;padding:4px;font:13px system-ui;box-shadow:0 6px 24px rgba(0,0,0,.4);max-width:280px';
    const rect = password.getBoundingClientRect();
    box.style.top = `${window.scrollY + rect.bottom + 4}px`;
    box.style.left = `${window.scrollX + rect.left}px`;
    matches.slice(0, 5).forEach((m) => {
      const row = document.createElement('button');
      row.textContent = `🔐 ${m.service_name || m.url} — ${m.username || ''}`;
      row.style.cssText = 'display:block;width:100%;text-align:left;background:none;border:0;color:#eee;padding:6px 8px;border-radius:6px;cursor:pointer';
      row.onmouseenter = () => { row.style.background = '#33304a'; };
      row.onmouseleave = () => { row.style.background = 'none'; };
      row.onclick = () => {
        chrome.runtime.sendMessage({ kind: 'SITE_FILL', id: m.id });
        box.remove();
      };
      box.appendChild(row);
    });
    document.body.appendChild(box);
    const dismiss = (ev) => { if (!box.contains(ev.target)) { box.remove(); document.removeEventListener('click', dismiss, true); } };
    setTimeout(() => document.addEventListener('click', dismiss, true), 0);
  }

  // Offer to save a login on submit.
  document.addEventListener('submit', (e) => {
    const form = e.target;
    if (!(form instanceof HTMLFormElement)) return;
    const password = form.querySelector(PASSWORD_SEL);
    if (!password?.value) return;
    const username = [...form.querySelectorAll(USERNAME_SEL)].find((el) => el.type !== 'password' && el.value)?.value || '';
    chrome.runtime.sendMessage({
      kind: 'SITE_SAVE',
      payload: { url: location.origin, username, password: password.value },
    });
  }, true);
})();
