/**
 * Incognito optional backend — tiny, dependency-free Node HTTP server.
 *
 * OFF by default; the web app runs without it. Single household only. Stores
 * minimal webhook event metadata in events.json (swap for SQLite on a VPS).
 * No vault secrets, no public signup, no multi-tenant data.
 */
import http from 'node:http';
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { verifyTwilioSignature, smsToEvent, voiceScreeningTwiml } from './twilioWebhook.js';
import { verifyEmailWebhook, emailToEvent } from './emailWebhook.js';

const PORT = process.env.PORT || 8787;
const AUTH_TOKEN = process.env.TWILIO_AUTH_TOKEN || '';
const PUBLIC_BASE_URL = process.env.PUBLIC_BASE_URL || `http://localhost:${PORT}`;
const SHARED_SECRET = process.env.WEBHOOK_SHARED_SECRET || '';
const APP_ORIGIN = process.env.APP_ORIGIN || '*';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const STORE = path.join(__dirname, '..', 'events.json');
const MAX_EVENTS = 1000;

function loadEvents() {
  try { return existsSync(STORE) ? JSON.parse(readFileSync(STORE, 'utf-8')) : []; }
  catch { return []; }
}
function appendEvent(evt) {
  const events = loadEvents();
  events.push({ id: Date.now().toString(36), ...evt });
  if (events.length > MAX_EVENTS) events.splice(0, events.length - MAX_EVENTS);
  writeFileSync(STORE, JSON.stringify(events));
}

function parseForm(body) {
  return Object.fromEntries(new URLSearchParams(body));
}
function send(res, status, body, headers = {}) {
  res.writeHead(status, { 'Access-Control-Allow-Origin': APP_ORIGIN, ...headers });
  res.end(body);
}

const server = http.createServer((req, res) => {
  let body = '';
  req.on('data', (c) => { body += c; if (body.length > 1e6) req.destroy(); });
  req.on('end', () => {
    const url = new URL(req.url, PUBLIC_BASE_URL);
    if (req.method === 'GET' && url.pathname === '/health') {
      return send(res, 200, JSON.stringify({ ok: true }), { 'Content-Type': 'application/json' });
    }

    if (req.method === 'POST' && url.pathname === '/webhooks/twilio/sms') {
      const params = parseForm(body);
      const ok = verifyTwilioSignature({
        authToken: AUTH_TOKEN, url: `${PUBLIC_BASE_URL}/webhooks/twilio/sms`,
        params, signature: req.headers['x-twilio-signature'],
      });
      if (!ok) return send(res, 403, 'bad signature');
      appendEvent(smsToEvent(params));
      return send(res, 200, '<Response/>', { 'Content-Type': 'text/xml' });
    }

    if (req.method === 'POST' && url.pathname === '/webhooks/twilio/voice') {
      const params = parseForm(body);
      const ok = verifyTwilioSignature({
        authToken: AUTH_TOKEN, url: `${PUBLIC_BASE_URL}/webhooks/twilio/voice`,
        params, signature: req.headers['x-twilio-signature'],
      });
      if (!ok) return send(res, 403, 'bad signature');
      appendEvent({ type: 'call_inbound', from: params.From || '', received_at: new Date().toISOString() });
      return send(res, 200, voiceScreeningTwiml(), { 'Content-Type': 'text/xml' });
    }

    if (req.method === 'POST' && url.pathname === '/webhooks/email') {
      if (!verifyEmailWebhook(req.headers['x-incognito-secret'], SHARED_SECRET)) {
        return send(res, 403, 'forbidden');
      }
      appendEvent(emailToEvent(parseForm(body)));
      return send(res, 200, JSON.stringify({ ok: true }), { 'Content-Type': 'application/json' });
    }

    if (req.method === 'GET' && url.pathname === '/events') {
      if (!verifyEmailWebhook(req.headers['x-incognito-secret'], SHARED_SECRET)) {
        return send(res, 403, 'forbidden');
      }
      const since = Number(url.searchParams.get('since') || 0);
      const events = loadEvents().filter((e) => Date.parse(e.received_at || 0) > since);
      return send(res, 200, JSON.stringify(events), { 'Content-Type': 'application/json' });
    }

    return send(res, 404, 'not found');
  });
});

// Only listen when run directly (not when imported by tests).
if (process.argv[1] && process.argv[1].endsWith('index.js')) {
  server.listen(PORT, () => console.log(`[incognito-backend] listening on :${PORT} (household-only)`));
}

export { server };
