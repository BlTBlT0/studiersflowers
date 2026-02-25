import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const SUBJECTS = [
  "Kunst", "Biologie", "Aardrijkskunde", "Wiskunde", "Geschiedenis",
  "Lichamelijke Opvoeding", "Engels", "Nederlands", "Grieks", "Wetenschap",
  "Muziek", "Frans", "VVV",
];

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { text } = await req.json();
    if (!text || typeof text !== "string") {
      return new Response(JSON.stringify({ error: "Tekst is verplicht" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY is not configured");

    const today = new Date().toISOString().split("T")[0];
    const dayOfWeek = new Date().toLocaleDateString("nl-NL", { weekday: "long" });

    const systemPrompt = `Je bent een assistent die huiswerk-invoer in het Nederlands omzet naar gestructureerde taken.
Vandaag is ${today} (${dayOfWeek}).

De gebruiker typt huiswerk in vrije tekst. Zet elke taak om naar JSON met deze velden:
- title: korte beschrijving van de taak
- subject: het schoolvak (kies uit: ${SUBJECTS.join(", ")})
- due_date: deadline in YYYY-MM-DD formaat. Als de gebruiker "morgen" zegt, bereken de juiste datum. "Donderdag" = eerstvolgende donderdag, etc.
- estimated_minutes: geschatte tijd in minuten (standaard 30 als niet duidelijk)
- priority: "low", "medium", of "high" (standaard "medium")
- is_daily_practice: true als het dagelijks oefenen is (bijv. "elke dag woordjes leren"), anders false

Retourneer een JSON array van taken. Alleen de JSON array, geen extra tekst.`;

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: text },
        ],
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(JSON.stringify({ error: "Te veel verzoeken, probeer het later opnieuw." }), {
          status: 429,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (response.status === 402) {
        return new Response(JSON.stringify({ error: "Krediet op, voeg credits toe in je workspace." }), {
          status: 402,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const t = await response.text();
      console.error("AI gateway error:", response.status, t);
      throw new Error("AI gateway error");
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content || "[]";

    // Extract JSON from possible markdown code blocks
    let jsonStr = content.trim();
    if (jsonStr.startsWith("```")) {
      jsonStr = jsonStr.replace(/^```(?:json)?\n?/, "").replace(/\n?```$/, "");
    }

    const tasks = JSON.parse(jsonStr);

    return new Response(JSON.stringify({ tasks }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("parse-homework error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Onbekende fout" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
