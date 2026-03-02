import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Download, AlertTriangle, Loader2, CheckCircle2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";

const MagisterImport = () => {
  const [school, setSchool] = useState("");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [importGrades, setImportGrades] = useState(true);
  const [importHomework, setImportHomework] = useState(true);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<{ gradesImported: number; homeworkImported: number } | null>(null);
  const qc = useQueryClient();

  const handleImport = async () => {
    if (!school || !username || !password) {
      toast.error("Vul alle velden in");
      return;
    }
    if (!importGrades && !importHomework) {
      toast.error("Selecteer minstens één optie om te importeren");
      return;
    }

    setLoading(true);
    setResult(null);

    try {
      const { data, error } = await supabase.functions.invoke("magister-import", {
        body: { school, username, password, importGrades, importHomework },
      });

      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      setResult(data);
      toast.success("Import succesvol!");
      qc.invalidateQueries({ queryKey: ["grades"] });
      qc.invalidateQueries({ queryKey: ["tasks"] });

      // Clear sensitive fields
      setPassword("");
    } catch (err: any) {
      toast.error(err.message || "Import mislukt");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div>
      <div className="mb-6">
        <h1 className="font-display text-2xl font-bold">Magister Import</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Importeer je cijfers en huiswerk vanuit Magister
        </p>
      </div>

      <Card className="mb-6 border-amber-500/30 bg-amber-500/5">
        <CardContent className="flex items-start gap-3 p-4">
          <AlertTriangle size={20} className="mt-0.5 shrink-0 text-amber-500" />
          <div className="text-sm">
            <p className="font-medium text-amber-500">Let op</p>
            <ul className="mt-1 list-disc pl-4 text-muted-foreground space-y-1">
              <li>Dit gebruikt de onofficiële Magister API — het kan stoppen met werken als Magister iets verandert</li>
              <li>Je wachtwoord wordt <strong>niet</strong> opgeslagen, alleen eenmalig gebruikt om in te loggen</li>
              <li>Niet alle scholen worden ondersteund</li>
            </ul>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Inloggen bij Magister</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <div>
            <Label htmlFor="school" className="mb-1.5 block">School</Label>
            <Input
              id="school"
              placeholder="schoolnaam (of schoolnaam.magister.net)"
              value={school}
              onChange={(e) => setSchool(e.target.value)}
              disabled={loading}
            />
            <p className="text-xs text-muted-foreground mt-1">
              Bijv. "erasmuscollege" of "erasmuscollege.magister.net"
            </p>
          </div>

          <div>
            <Label htmlFor="username" className="mb-1.5 block">Gebruikersnaam / Leerlingnummer</Label>
            <Input
              id="username"
              placeholder="Je Magister gebruikersnaam"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              disabled={loading}
            />
          </div>

          <div>
            <Label htmlFor="password" className="mb-1.5 block">Wachtwoord</Label>
            <Input
              id="password"
              type="password"
              placeholder="Je Magister wachtwoord"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              disabled={loading}
            />
          </div>

          <div className="flex flex-col gap-3 rounded-lg border p-3">
            <p className="text-sm font-medium">Wat wil je importeren?</p>
            <div className="flex items-center gap-2">
              <Checkbox
                id="importGrades"
                checked={importGrades}
                onCheckedChange={(v) => setImportGrades(!!v)}
                disabled={loading}
              />
              <Label htmlFor="importGrades" className="cursor-pointer">Cijfers</Label>
            </div>
            <div className="flex items-center gap-2">
              <Checkbox
                id="importHomework"
                checked={importHomework}
                onCheckedChange={(v) => setImportHomework(!!v)}
                disabled={loading}
              />
              <Label htmlFor="importHomework" className="cursor-pointer">Huiswerk (komende 30 dagen)</Label>
            </div>
          </div>

          <Button onClick={handleImport} disabled={loading} className="w-full">
            {loading ? (
              <>
                <Loader2 size={16} className="mr-2 animate-spin" />
                Importeren...
              </>
            ) : (
              <>
                <Download size={16} className="mr-2" />
                Importeren vanuit Magister
              </>
            )}
          </Button>

          {result && (
            <div className="rounded-lg border border-primary/30 bg-primary/5 p-4">
              <div className="flex items-center gap-2 mb-2">
                <CheckCircle2 size={18} className="text-primary" />
                <p className="font-medium text-sm">Import voltooid!</p>
              </div>
              <ul className="text-sm text-muted-foreground space-y-1">
                {result.gradesImported > 0 && (
                  <li>✓ {result.gradesImported} cijfer(s) geïmporteerd</li>
                )}
                {result.homeworkImported > 0 && (
                  <li>✓ {result.homeworkImported} huiswerkopdracht(en) geïmporteerd</li>
                )}
                {result.gradesImported === 0 && result.homeworkImported === 0 && (
                  <li>Geen nieuwe data gevonden om te importeren</li>
                )}
              </ul>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default MagisterImport;
