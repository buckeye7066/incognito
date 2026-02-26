import { serve } from "https://deno.land/std@0.131.0/http/server.ts";

const API_KEY = Deno.env.get("PRIVACY_COM_API_KEY");

function avgInterval(dates) {
  const intervals = [];
  for (let i = 1; i < dates.length; i++) {
    const diff = (new Date(dates[i]).getTime() - new Date(dates[i - 1]).getTime()) / (1000 * 60 * 60 * 24);
    intervals.push(diff);
  }
  return intervals.length ? intervals.reduce((a, b) => a + b) / intervals.length : null;
}

serve(async (req) => {
  let cardToken;
  if (req.method === "POST") {
    try {
      const body = await req.json();
      cardToken = body.cardToken;
    } catch {}
  }
  const params = new URLSearchParams();
  params.set("page_size", "100");
  if (cardToken) params.set("card_token", cardToken);
  const resp = await fetch(`https://api.privacy.com/v1/transactions?${params.toString()}`, {
    headers: { Authorization: `api-key ${API_KEY}` },
  });
  if (!resp.ok) {
    const errText = await resp.text();
    return new Response(JSON.stringify({ error: errText }), { status: resp.status, headers: { "Content-Type": "application/json" } });
  }
  const { data } = await resp.json();
  const groups = {};
  for (const tx of data || []) {
    const merchant = tx.descriptor || tx.acceptor_id;
    const key = `${tx.card_token}_${merchant}`;
    if (!groups[key]) {
      groups[key] = { card_token: tx.card_token, merchant, count: 0, total: 0, dates: [] };
    }
    groups[key].count++;
    groups[key].total += tx.amount;
    groups[key].dates.push(tx.transacted_at);
  }
  const subscriptions = [];
  for (const key in groups) {
    const g = groups[key];
    if (g.count > 1) {
      g.dates.sort();
      const avg = avgInterval(g.dates);
      subscriptions.push({
        card_token: g.card_token,
        merchant: g.merchant,
        count: g.count,
        total: g.total,
        first_transaction: g.dates[0],
        last_transaction: g.dates[g.dates.length - 1],
        estimated_interval_days: avg,
      });
    }
  }
  return new Response(JSON.stringify(subscriptions), {
    headers: { "Content-Type": "application/json" },
  });
});
