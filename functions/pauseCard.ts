import { serve } from "https://deno.land/std@0.193.0/http/server.ts";

const API_KEY = Deno.env.get("PRIVACY_COM_API_KEY");

serve(async (req: Request) => {
  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { "Content-Type": "application/json" },
    });
  }
  let cardToken;
  try {
    const body = await req.json();
    cardToken = body.cardToken;
  } catch {
    return new Response(JSON.stringify({ error: "Invalid JSON body" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }
  if (!cardToken) {
    return new Response(JSON.stringify({ error: "Missing cardToken" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }
  const resp = await fetch(`https://api.privacy.com/v1/cards/${cardToken}`, {
    method: "PATCH",
    headers: {
      Authorization: `api-key ${API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ state: "PAUSED" }),
  });
  const respBody = await resp.json();
  return new Response(JSON.stringify(respBody), {
    status: resp.status,
    headers: { "Content-Type": "application/json" },
  });
});
