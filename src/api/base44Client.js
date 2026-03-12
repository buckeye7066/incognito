const STORAGE_PREFIX = 'incognito_entity_';

function generateId() {
  return Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 9);
}

function createEntityStore(entityName) {
  const storageKey = STORAGE_PREFIX + entityName;

  function getAll() {
    try {
      const raw = localStorage.getItem(storageKey);
      return raw ? JSON.parse(raw) : [];
    } catch {
      return [];
    }
  }

  function saveAll(items) {
    localStorage.setItem(storageKey, JSON.stringify(items));
  }

  return {
    async list(sortField, limit) {
      let items = getAll();
      if (sortField && typeof sortField === 'string') {
        const desc = sortField.startsWith('-');
        const field = desc ? sortField.slice(1) : sortField;
        items.sort((a, b) => {
          const aVal = a[field] ?? '';
          const bVal = b[field] ?? '';
          if (aVal < bVal) return desc ? 1 : -1;
          if (aVal > bVal) return desc ? -1 : 1;
          return 0;
        });
      }
      if (typeof limit === 'number' && limit > 0) {
        items = items.slice(0, limit);
      }
      return items;
    },

    async create(data) {
      const items = getAll();
      const now = new Date().toISOString();
      const newItem = {
        id: generateId(),
        ...data,
        created_date: now,
        updated_date: now,
      };
      items.push(newItem);
      saveAll(items);
      console.log(`[${entityName}] Created:`, newItem.id);
      return newItem;
    },

    async update(id, data) {
      const items = getAll();
      const idx = items.findIndex((item) => item.id === id);
      if (idx === -1) {
        console.warn(`[${entityName}] Update failed: id ${id} not found`);
        return null;
      }
      items[idx] = {
        ...items[idx],
        ...data,
        id,
        updated_date: new Date().toISOString(),
      };
      saveAll(items);
      console.log(`[${entityName}] Updated:`, id);
      return items[idx];
    },

    async delete(id) {
      const items = getAll();
      const filtered = items.filter((item) => item.id !== id);
      if (filtered.length === items.length) {
        console.warn(`[${entityName}] Delete failed: id ${id} not found`);
        return false;
      }
      saveAll(filtered);
      console.log(`[${entityName}] Deleted:`, id);
      return true;
    },
  };
}

const ENTITY_NAMES = [
  'Profile',
  'PersonalData',
  'ScanResult',
  'SocialMediaFinding',
  'SocialMediaProfile',
  'SocialMediaMention',
  'ExposureFixLog',
  'FinancialAccount',
  'SuspiciousActivity',
  'UserPreferences',
  'SpamIncident',
  'NotificationAlert',
  'MonitoredAccount',
  'DisposableCredential',
  'DeletionRequest',
  'DeletionEmailResponse',
  'AIInsight',
  'DigitalFootprintReport',
  'SearchQueryFinding',
];

const entities = {};
for (const name of ENTITY_NAMES) {
  entities[name] = createEntityStore(name);
}

export const base44 = {
  auth: {
    me: async () => ({ id: 'local_user', name: 'Local User' }),
    requireUser: () => ({ id: 'local_user', name: 'Local User' }),
    signOut: async () => {},
    logout: () => {},
    redirectToLogin: () => {},
  },
  entities,
};

/**
 * One-time migration: pull data from Base44 cloud into local storage.
 * Reads base44_app_id, base44_server_url, base44_access_token from
 * browser localStorage (left behind by the old SDK) and fetches all
 * entity data, then stores it locally. Runs only once per browser.
 */
export async function migrateFromBase44() {
  const MIGRATION_KEY = 'incognito_base44_migration_done';
  if (localStorage.getItem(MIGRATION_KEY)) return;

  const appId = localStorage.getItem('base44_app_id');
  const serverUrl = localStorage.getItem('base44_server_url') || 'https://base44.app';
  const token = localStorage.getItem('base44_access_token');

  if (!appId || !token) {
    console.log('[Migration] No Base44 credentials found in localStorage, skipping.');
    localStorage.setItem(MIGRATION_KEY, 'skipped');
    return;
  }

  console.log('[Migration] Found Base44 credentials. Attempting to recover data...');
  console.log('[Migration] App ID:', appId, '| Server:', serverUrl);

  let totalRecovered = 0;

  for (const entityName of ENTITY_NAMES) {
    const localKey = STORAGE_PREFIX + entityName;
    const existing = localStorage.getItem(localKey);
    if (existing && JSON.parse(existing).length > 0) {
      console.log(`[Migration] ${entityName}: already has local data, skipping.`);
      continue;
    }

    try {
      const url = `${serverUrl}/api/apps/${appId}/entities/${entityName}`;
      const resp = await fetch(url, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'X-App-Id': appId,
        },
      });

      if (!resp.ok) {
        console.warn(`[Migration] ${entityName}: HTTP ${resp.status}`);
        continue;
      }

      const data = await resp.json();
      const items = Array.isArray(data) ? data : (data?.results || data?.items || []);

      if (items.length > 0) {
        localStorage.setItem(localKey, JSON.stringify(items));
        totalRecovered += items.length;
        console.log(`[Migration] ${entityName}: recovered ${items.length} items`);
      } else {
        console.log(`[Migration] ${entityName}: 0 items on server`);
      }
    } catch (err) {
      console.warn(`[Migration] ${entityName}: fetch failed -`, err.message);
    }
  }

  localStorage.setItem(MIGRATION_KEY, new Date().toISOString());
  console.log(`[Migration] Complete. Total items recovered: ${totalRecovered}`);

  if (totalRecovered > 0) {
    window.location.reload();
  }
}

export default base44;
