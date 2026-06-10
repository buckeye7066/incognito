/**
 * Incognito Companion — popup. Shows logins that match the current tab and
 * fills on click. All data is fetched live from an open, unlocked app tab; if
 * none is open it says so honestly rather than showing a blank list.
 */
const statusEl = document.getElementById('status');
const matchesEl = document.getElementById('matches');

async function main() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  let domain = '';
  try { domain = new URL(tab.url).hostname; } catch { /* not a web page */ }

  if (!domain) {
    statusEl.textContent = 'Open a website to see matching logins.';
    return;
  }
  statusEl.textContent = `Matches for ${domain}`;

  chrome.runtime.sendMessage({ kind: 'SITE_MATCH', domain }, (resp) => {
    if (!resp) { statusEl.textContent = 'Could not reach the extension.'; return; }
    if (!resp.ok) {
      statusEl.textContent = resp.error || 'Open Incognito and unlock the vault to autofill.';
      return;
    }
    matchesEl.replaceChildren();
    if (!resp.matches?.length) {
      const empty = document.createElement('div');
      empty.className = 'empty';
      empty.textContent = `No saved logins match ${domain}.`;
      matchesEl.appendChild(empty);
      return;
    }
    // Build rows with textContent only — vault fields are untrusted (a captured
    // service_name could contain markup), so never interpolate them into HTML.
    resp.matches.forEach((m) => {
      const row = document.createElement('div');
      row.className = 'match';

      const left = document.createElement('span');
      const title = document.createElement('div');
      title.textContent = `🔐 ${m.service_name || m.url || ''}`;
      const user = document.createElement('small');
      user.textContent = m.username || '';
      left.append(title, user);

      const pill = document.createElement('span');
      pill.className = 'pill';
      pill.textContent = m.tier === 'exact' ? 'exact' : 'site';

      row.append(left, pill);
      row.onclick = () => {
        chrome.runtime.sendMessage({ kind: 'SITE_FILL', id: m.id }, () => window.close());
      };
      matchesEl.appendChild(row);
    });
  });
}

main();
