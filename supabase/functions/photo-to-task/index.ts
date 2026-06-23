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
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { image } = await req.json();
    if (!image || typeof image !== "string") {
      return new Response(JSON.stringify({ error: "Afbeelding is verplicht" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY niet geconfigureerd");

    const today = new Date().toISOString().split("T")[0];
    const dayOfWeek = new Date().toLocaleDateString("nl-NL", { weekday: "long" });

    const systemPrompt = `Je bent een assistent die foto's van schoolagenda's, schoolborden, schriften of huiswerkbriefjes analyseert.
Vandaag is ${today} (${dayOfWeek}).
Lees ALLE zichtbare huiswerktaken uit de afbeelding en zet ze om naar JSON.
Velden per taak:
- title: korte beschrijving
- subject: schoolvak (kies uit: ${SUBJECTS.join(", ")})
- due_date: YYYY-MM-DD (interpreteer "morgen", "donderdag", etc. relatief tot vandaag)
- estimated_minutes: schatting in minuten (standaard 30)
- priority: "low" | "medium" | "high"
- is_daily_practice: boolean
Retourneer ALLEEN een JSON array, geen extra tekst.`;

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${LOVABLE_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: [
            { type: "text", text: "Lees alle huiswerk uit deze foto." },
            { type: "image_url", image_url: { url: image } },
          ]},
        ],
      }),
    });

    if (!response.ok) {
      if (response.status === 429) return new Response(JSON.stringify({ error: "Te veel verzoeken." }), { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      if (response.status === 402) return new Response(JSON.stringify({ error: "Krediet op." }), { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      const t = await response.text();
      console.error("AI gateway error:", response.status, t);
      throw new Error("AI gateway error");
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content || "[]";
    let jsonStr = content.trim();
    if (jsonStr.startsWith("```")) jsonStr = jsonStr.replace(/^```(?:json)?\n?/, "").replace(/\n?```$/, "");
    const tasks = JSON.parse(jsonStr);

    return new Response(JSON.stringify({ tasks }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("photo-to-task error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Onbekende fout" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});