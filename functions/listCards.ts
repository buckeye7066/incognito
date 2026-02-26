import { serve } from "https://deno.land/std@0.131.0/http/server.ts";

const API_KEY = Deno.env.get("PRIVACY_COM_API_KEY");

serve(async (req) => {
  if (req.method !== "GET") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), { status: 405, headers: { "Content-Type": "application/json" } });
  }
  const resp = await fetch("https://api.privacy.com/v1/cards?page_size=100", {
    headers: {
      Authorization: `api-key ${API_KEY}`,
      "Content-Type": "application/json",
    },
  });
  if (!resp.ok) {
    const errText = await resp.text();
    return new Response(JSON.stringify({ error: errText }), { status: resp.status, headers: { "Content-Type": "application/json" } });
  }
  const data = await resp.json();
  const simplified = (data.data || []).map((card) => ({
    token: card.token,
    last_four: card.last_four,
    memo: card.memo,
    state: card.state,
    spend_limit: card.spend_limit,
    spend_limit_duration: card.spend_limit_duration,
    created: card.created,
    closed: card.closed,
  }));
  return new Response(JSON.stringify(simplified), {
    headers: { "Content-Type": "application/json" },
  });
});
