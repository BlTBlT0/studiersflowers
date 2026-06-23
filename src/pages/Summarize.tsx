import { useState } from "react";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Sparkles, Loader2, Copy } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

const Summarize = () => {
  const [text, setText] = useState("");
  const [summary, setSummary] = useState("");
  const [loading, setLoading] = useState(false);
  const [style, setStyle] = useState<"bullets" | "kort" | "uitgebreid">("bullets");

  const styleLabel = {
    bullets: "bulletpoints met kernpunten",
    kort: "één korte alinea (max 4 zinnen)",
    uitgebreid: "uitgebreide samenvatting met kopjes en bullets",
  }[style];

  const run = async () => {
    if (!text.trim()) return;
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("summarize-text", {
        body: { text, style: styleLabel },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      setSummary(data.summary || "");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Samenvatten mislukt");
    } finally {
      setLoading(false);
    }
  };

  const copy = async () => {
    await navigator.clipboard.writeText(summary);
    toast.success("Gekopieerd");
  };

  return (
    <div>
      <h1 className="mb-4 font-display text-2xl font-bold">Samenvatter</h1>
      <p className="mb-3 text-sm text-muted-foreground">
        Plak je leerstof of aantekeningen, en AI maakt een korte samenvatting.
      </p>

      <Textarea
        placeholder="Plak hier je tekst..."
        value={text}
        onChange={(e) => setText(e.target.value)}
        rows={8}
      />

      <div className="mt-3 flex flex-wrap items-center gap-2">
        <div className="flex gap-1 rounded-md border p-1 text-xs">
          {(["bullets", "kort", "uitgebreid"] as const).map((s) => (
            <button
              key={s}
              onClick={() => setStyle(s)}
              className={`rounded px-2 py-1 ${style === s ? "bg-primary text-primary-foreground" : "text-muted-foreground"}`}
            >
              {s === "bullets" ? "Bullets" : s === "kort" ? "Kort" : "Uitgebreid"}
            </button>
          ))}
        </div>
        <Button onClick={run} disabled={loading || !text.trim()} size="sm">
          {loading ? <Loader2 size={16} className="mr-1 animate-spin" /> : <Sparkles size={16} className="mr-1" />}
          Samenvat
        </Button>
      </div>

      {summary && (
        <div className="mt-6 rounded-lg border bg-card p-4">
          <div className="mb-2 flex items-center justify-between">
            <h2 className="font-semibold">Samenvatting</h2>
            <Button size="sm" variant="ghost" onClick={copy}>
              <Copy size={14} className="mr-1" /> Kopieer
            </Button>
          </div>
          <pre className="whitespace-pre-wrap font-body text-sm leading-relaxed">{summary}</pre>
        </div>
      )}
    </div>
  );
};

export default Summarize;