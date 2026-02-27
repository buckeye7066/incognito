#!/usr/bin/env node

// Manage Privacy.com subscriptions via CLI.
// Usage: node manageSubscriptions.js [cards|subscriptions <cardToken>|close <cardToken>|pause <cardToken>]

const API_BASE = 'https://api.privacy.com/v1';
const apiKey = process.env.PRIVACY_COM_API_KEY;
if (!apiKey) {
  console.error('Please set PRIVACY_COM_API_KEY in your environment');
  process.exit(1);
}

// Fetch wrapper with default headers
async function apiFetch(path, options = {}) {
  return fetch(`${API_BASE}${path}`, {
    headers: {
      Authorization: `api-key ${apiKey}`,
      'Content-Type': 'application/json',
    },
    ...options,
  }).then((res) => res.json());
}

async function listCards() {
  const data = await apiFetch('/cards');
  const rows = data.data.map((card) => ({
    token: card.token,
    last_four: card.last_four,
    memo: card.memo,
    state: card.state,
    spend_limit: card.spend_limit,
  }));
  console.table(rows);
}

async function listSubscriptions(cardToken) {
  let url = '/transactions?page_size=100';
  if (cardToken) {
    url += `&card_token=${encodeURIComponent(cardToken)}`;
  }
  const data = await apiFetch(url);
  const groups = {};
  data.data.forEach((tx) => {
    const merchant = tx.acceptor_id || (tx.acceptor && tx.acceptor.merchant_descriptor) || tx.description || 'Unknown';
    const key = `${tx.card_token}:${merchant}`;
    if (!groups[key]) {
      groups[key] = { count: 0, total: 0, first: null, last: null };
    }
    const g = groups[key];
    g.count += 1;
    g.total += tx.amount;
    const date = new Date(tx.transaction_time);
    if (!g.first || date < g.first) g.first = date;
    if (!g.last || date > g.last) g.last = date;
  });
  const results = [];
  Object.keys(groups).forEach((key) => {
    const g = groups[key];
    if (g.count >= 2) {
      const [token, merchant] = key.split(':');
      const intervalMs = g.last - g.first;
      const avgIntervalDays = (intervalMs / ((g.count - 1) || 1)) / (24 * 3600 * 1000);
      results.push({
        card_token: token,
        merchant,
        charges: g.count,
        total_spent: (g.total / 100).toFixed(2),
        average_interval_days: avgIntervalDays.toFixed(2),
        first_charge: g.first.toISOString(),
        last_charge: g.last.toISOString(),
      });
    }
  });
  console.table(results);
}

async function closeCard(cardToken) {
  if (!cardToken) {
    console.error('Please provide a card token to close');
    return;
  }
  const data = await apiFetch(`/cards/${cardToken}`, {
    method: 'PATCH',
    body: JSON.stringify({ state: 'CLOSED' }),
  });
  console.log(data);
}

async function pauseCard(cardToken) {
  if (!cardToken) {
    console.error('Please provide a card token to pause');
    return;
  }
  const data = await apiFetch(`/cards/${cardToken}`, {
    method: 'PATCH',
    body: JSON.stringify({ state: 'PAUSED' }),
  });
  console.log(data);
}

async function main() {
  const args = process.argv.slice(2);
  const command = args[0];
  if (!command) {
    console.log('Commands:');
    console.log('  cards                  List all cards');
    console.log('  subscriptions [token]  List potential subscriptions for a card');
    console.log('  close <token>          Close a card (prevent further charges)');
    console.log('  pause <token>          Pause a card (temporarily block charges)');
    return;
  }
  switch (command) {
    case 'cards':
      await listCards();
      break;
    case 'subscriptions':
      await listSubscriptions(args[1]);
      break;
    case 'close':
      await closeCard(args[1]);
      break;
    case 'pause':
      await pauseCard(args[1]);
      break;
    default:
      console.log('Unknown command:', command);
  }
}

main().catch((err) => {
  console.error('Error:', err);
});
