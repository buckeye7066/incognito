/**
 * Password CSV import for the family password manager.
 *
 * Pure + dependency-free: parse a CSV export from a common manager, detect the
 * format from its header, normalize rows to a common shape, and flag duplicates
 * against what's already in the vault. No network, no storage — the page shows a
 * preview and the user confirms before anything is written (and encrypted).
 */

/**
 * Minimal RFC-4180-ish CSV parser (handles quoted fields, escaped "" quotes,
 * and embedded commas/newlines). Returns an array of string[] rows.
 */
export function parseCsv(text) {
  const rows = [];
  let row = [];
  let field = '';
  let inQuotes = false;
  const s = String(text ?? '').replace(/\r\n/g, '\n').replace(/\r/g, '\n');
  for (let i = 0; i < s.length; i++) {
    const c = s[i];
    if (inQuotes) {
      if (c === '"') {
        if (s[i + 1] === '"') { field += '"'; i++; }
        else inQuotes = false;
      } else field += c;
    } else if (c === '"') {
      inQuotes = true;
    } else if (c === ',') {
      row.push(field); field = '';
    } else if (c === '\n') {
      row.push(field); rows.push(row); row = []; field = '';
    } else {
      field += c;
    }
  }
  // flush trailing field/row unless the input ended on a clean newline
  if (field !== '' || row.length > 0) { row.push(field); rows.push(row); }
  return rows.filter((r) => !(r.length === 1 && r[0].trim() === ''));
}

// Header signatures → format id. Order matters (most specific first).
const FORMATS = {
  bitwarden:  ['name', 'login_uri', 'login_username', 'login_password'],
  onepassword:['title', 'url', 'username', 'password'],
  lastpass:   ['url', 'username', 'password', 'name'],
  dashlane:   ['username', 'password', 'url', 'title'],
  keeper:     ['folder', 'title', 'login', 'password', 'website address'],
  chrome:     ['name', 'url', 'username', 'password'],
};

// Map a detected format's row (by header index) to the normalized entry.
const FIELD_ALIASES = {
  title: ['name', 'title'],
  url: ['url', 'login_uri', 'website address', 'website', 'login_url'],
  username: ['username', 'login', 'login_username', 'user', 'email'],
  password: ['password', 'login_password'],
  notes: ['notes', 'note', 'comments'],
  totp: ['totp', 'login_totp', 'otpauth', '2fa', 'authenticator'],
};

function norm(h) { return String(h || '').trim().toLowerCase(); }

/** Detect format from header columns; returns a format id or 'generic'. */
export function detectFormat(header) {
  const cols = header.map(norm);
  const has = (names) => names.every((n) => cols.includes(n));
  for (const [id, sig] of Object.entries(FORMATS)) {
    if (has(sig)) return id;
  }
  // Generic fallback: needs at least a password-ish and username-ish column.
  const hasPw = cols.some((c) => FIELD_ALIASES.password.includes(c));
  const hasUser = cols.some((c) => FIELD_ALIASES.username.includes(c));
  return hasPw && hasUser ? 'generic' : 'unknown';
}

function indexFor(cols, aliases) {
  for (const a of aliases) {
    const idx = cols.indexOf(a);
    if (idx !== -1) return idx;
  }
  return -1;
}

export function hostnameOf(url) {
  if (!url) return '';
  try { return new URL(url.includes('://') ? url : `https://${url}`).hostname.replace(/^www\./, ''); }
  catch { return String(url).toLowerCase().replace(/^https?:\/\//, '').replace(/^www\./, '').split('/')[0]; }
}

/**
 * Parse a password CSV export.
 * @returns {{ format: string, entries: object[], skipped: number, total: number }}
 */
export function parsePasswordCsv(text) {
  const rows = parseCsv(text);
  if (rows.length < 2) return { format: 'unknown', entries: [], skipped: 0, total: 0 };
  const header = rows[0];
  const cols = header.map(norm);
  const format = detectFormat(header);
  if (format === 'unknown') return { format, entries: [], skipped: rows.length - 1, total: rows.length - 1 };

  const idx = {
    title: indexFor(cols, FIELD_ALIASES.title),
    url: indexFor(cols, FIELD_ALIASES.url),
    username: indexFor(cols, FIELD_ALIASES.username),
    password: indexFor(cols, FIELD_ALIASES.password),
    notes: indexFor(cols, FIELD_ALIASES.notes),
    totp: indexFor(cols, FIELD_ALIASES.totp),
  };

  const entries = [];
  let skipped = 0;
  for (let r = 1; r < rows.length; r++) {
    const row = rows[r];
    const get = (k) => (idx[k] >= 0 ? (row[idx[k]] ?? '').trim() : '');
    const password = get('password');
    const username = get('username');
    if (!password && !username) { skipped++; continue; } // junk row
    const url = get('url');
    entries.push({
      site: get('title') || hostnameOf(url) || 'Untitled',
      url,
      domain: hostnameOf(url),
      username,
      password,
      notes: get('notes'),
      totp_secret: get('totp'),
    });
  }
  return { format, entries, skipped, total: rows.length - 1 };
}

/** Stable identity for duplicate detection. */
function dedupeKey(e) {
  return `${(e.domain || hostnameOf(e.url) || '').toLowerCase()}|${(e.username || '').toLowerCase()}`;
}

/**
 * Partition imported entries into new vs duplicate (vs already-in-vault and
 * vs each other). `existing` is the current vault password list.
 * @returns {{ fresh: object[], duplicates: object[] }}
 */
export function findDuplicates(entries, existing = []) {
  const seen = new Set(existing.map((e) => dedupeKey({
    domain: e.domain, url: e.url, username: e.username,
  })));
  const fresh = [];
  const duplicates = [];
  for (const e of entries) {
    const key = dedupeKey(e);
    if (seen.has(key)) { duplicates.push(e); }
    else { seen.add(key); fresh.push(e); }
  }
  return { fresh, duplicates };
}
