import { serve } from "https://deno.land/std/http/server.ts";

// Sample bills data (in real implementation, fetch from storage or database)
const bills = [
  {
    id: "bill1",
    merchant: "Electric Company",
    amount: 100.50,
    dueDate: "2026-03-15",
    status: "unpaid",
    description: "Electric bill for March"
  },
  {
    id: "bill2",
    merchant: "Water Utility",
    amount: 45.25,
    dueDate: "2026-03-20",
    status: "unpaid",
    description: "Water bill for March"
  }
];

serve(async (req: Request) => {
  // Return list of bills on GET request
  if (req.method === "GET") {
    return new Response(JSON.stringify(bills), {
      headers: { "Content-Type": "application/json" }
    });
  }
  return new Response("Method Not Allowed", { status: 405 });
});
