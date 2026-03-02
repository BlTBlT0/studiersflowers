import { useState, useRef } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  Loader2,
  CheckCircle2,
  Trash2,
  Upload,
  Lightbulb,
  FileUp,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

const KNOWN_SUBJECTS: Record<string, string> = {
  ak: "Aardrijkskunde", aard: "Aardrijkskunde", aardrijkskunde: "Aardrijkskunde",
  bi: "Biologie", bio: "Biologie", biologie: "Biologie", biol: "Biologie",
  en: "Engels", eng: "Engels", engels: "Engels", entl: "Engels",
  "engelse taal en literatuur": "Engels",
  fa: "Frans", fra: "Frans", frans: "Frans", fatl: "Frans",
  "franse taal en literatuur": "Frans",
  gr: "Grieks", grieks: "Grieks",
  gs: "Geschiedenis", gesch: "Geschiedenis", geschiedenis: "Geschiedenis",
  ku: "Kunst", kunst: "Kunst",
  lo: "Lichamelijke Opvoeding", gym: "Lichamelijke Opvoeding",
  "lichamelijke opvoeding": "Lichamelijke Opvoeding",
  mu: "Muziek", muziek: "Muziek",
  na: "Natuurkunde", nat: "Natuurkunde", natuurkunde: "Natuurkunde", nask: "Natuurkunde",
  ne: "Nederlands", ned: "Nederlands", nederlands: "Nederlands", netl: "Nederlands",
  "nederlandse taal en literatuur": "Nederlands",
  sk: "Scheikunde", schei: "Scheikunde", scheikunde: "Scheikunde",
  wi: "Wiskunde", wis: "Wiskunde", wiskunde: "Wiskunde", wisA: "Wiskunde A", wisB: "Wiskunde B",
  ec: "Economie", eco: "Economie", economie: "Economie",
  ma: "Maatschappijleer", maw: "Maatschappijwetenschappen",
  ckv: "CKV", la: "Latijn", latijn: "Latijn",
  du: "Duits", duits: "Duits", dutl: "Duits",
  "duitse taal en literatuur": "Duits",
  sp: "Spaans", spaans: "Spaans",
  in: "Informatica", info: "Informatica", informatica: "Informatica",
  fil: "Filosofie", filosofie: "Filosofie",
  te: "Tekenen", ht: "Handvaardigheid",
  bv: "Beeldende Vorming", "beeldende vorming": "Beeldende Vorming",
};

function normalizeSubject(raw: string): string {
  const lower = raw.toLowerCase().trim();
  if (KNOWN_SUBJECTS[lower]) return KNOWN_SUBJECTS[lower];
  return raw.trim().charAt(0).toUpperCase() + raw.trim().slice(1);
}

interface ParsedGrade {
  subject: string;
  grade: number;
  description: string;
  date: string;
}

// --- Text line parser ---
function parseLine(line: string): ParsedGrade | null {
  const trimmed = line.trim();
  if (!trimmed) return null;

  let date = new Date().toISOString().split("T")[0];
  let remaining = trimmed;

  const datePatternDMY = /\b(\d{1,2})-(\d{1,2})-(\d{4})\b/;
  const datePatternYMD = /\b(\d{4})-(\d{1,2})-(\d{1,2})\b/;

  const dmyMatch = remaining.match(datePatternDMY);
  if (dmyMatch) {
    const attempt = new Date(`${dmyMatch[3]}-${dmyMatch[2].padStart(2, "0")}-${dmyMatch[1].padStart(2, "0")}`);
    if (!isNaN(attempt.getTime())) date = attempt.toISOString().split("T")[0];
    remaining = remaining.replace(dmyMatch[0], "").trim();
  } else {
    const ymdMatch = remaining.match(datePatternYMD);
    if (ymdMatch) {
      const attempt = new Date(`${ymdMatch[1]}-${ymdMatch[2].padStart(2, "0")}-${ymdMatch[3].padStart(2, "0")}`);
      if (!isNaN(attempt.getTime())) date = attempt.toISOString().split("T")[0];
      remaining = remaining.replace(ymdMatch[0], "").trim();
    }
  }

  const gradeMatch = remaining.match(/\b(\d{1,2}[.,]\d{1,2}|\d{1,2})\b/);
  if (!gradeMatch) return null;

  const gradeNum = parseFloat(gradeMatch[1].replace(",", "."));
  if (isNaN(gradeNum) || gradeNum < 1 || gradeNum > 10) return null;

  const gradeIdx = remaining.indexOf(gradeMatch[0]);
  const subject = remaining.substring(0, gradeIdx).trim();
  const description = remaining.substring(gradeIdx + gradeMatch[0].length).trim();

  if (!subject) return null;

  return {
    subject: normalizeSubject(subject),
    grade: Math.round(gradeNum * 10) / 10,
    description,
    date,
  };
}

// --- .stgrades file parser ---
function parseStGradesFile(jsonStr: string): { grades: ParsedGrade[]; finalGrades: ParsedGrade[] } {
  try {
    const data = JSON.parse(jsonStr);
    const grades: ParsedGrade[] = [];
    const finalGrades: ParsedGrade[] = [];

    if (!data.grades || !Array.isArray(data.grades)) return { grades: [], finalGrades: [] };

    for (const g of data.grades) {
      if (!g.TeltMee) continue;

      const gradeStr = g.CijferStr?.replace(",", ".");
      const gradeNum = parseFloat(gradeStr);
      if (isNaN(gradeNum) || gradeNum < 1 || gradeNum > 10) continue;

      const subjectRaw = g.Vak?.Omschrijving || g.Vak?.Afkorting || "";
      if (!subjectRaw) continue;

      const kolomSoort = g.CijferKolom?.KolomSoort;
      const kolomOmschrijving = (g.CijferKolom?.KolomOmschrijving || "").toLowerCase();

      const isCalculated = kolomSoort === 2 ||
        kolomOmschrijving.includes("eindcijfer") ||
        kolomOmschrijving.includes("voortschrijdend") ||
        kolomOmschrijving.includes("gemiddelde");

      const dateStr = g.DatumIngevoerd
        ? new Date(g.DatumIngevoerd).toISOString().split("T")[0]
        : new Date().toISOString().split("T")[0];

      const description = g.CijferKolom?.KolomOmschrijving || g.CijferKolom?.KolomKop || "";

      const parsed: ParsedGrade = {
        subject: normalizeSubject(subjectRaw),
        grade: Math.round(gradeNum * 10) / 10,
        description,
        date: dateStr,
      };

      if (isCalculated) {
        finalGrades.push(parsed);
      } else {
        grades.push(parsed);
      }
    }

    return { grades, finalGrades };
  } catch {
    return { grades: [], finalGrades: [] };
  }
}

const EXAMPLE = `wi 7,2 Poduo
ne 7,8 Boekpitch
kunst 8,0 Kleurensplash
ak 7,1 Poster Burgers Zoo
gs 6,7 Duo-toets Grieken en Romeinen`;

const MagisterImport = () => {
  const [text, setText] = useState("");
  const [parsedGrades, setParsedGrades] = useState<ParsedGrade[]>([]);
  const [parsedFinalGrades, setParsedFinalGrades] = useState<ParsedGrade[]>([]);
  const [importing, setImporting] = useState(false);
  const [result, setResult] = useState<number | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const qc = useQueryClient();

  const handleParse = () => {
    if (!text.trim()) {
      toast.error("Typ eerst je cijfers in het tekstveld");
      return;
    }
    const grades = text
      .split("\n")
      .map(parseLine)
      .filter((g): g is ParsedGrade => g !== null);

    if (grades.length === 0) {
      toast.error("Geen geldige cijfers gevonden. Gebruik het formaat: vak cijfer omschrijving");
      return;
    }
    setParsedGrades(grades);
    setResult(null);
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (ev) => {
      const content = ev.target?.result as string;
      const { grades, summary } = parseStGradesFile(content);
      if (grades.length === 0) {
        toast.error("Geen geldige cijfers gevonden in dit bestand");
        return;
      }
      setParsedGrades(grades);
      setFileSummary(summary);
      setResult(null);
      toast.success(`${grades.length} cijfer(s) herkend uit bestand`);
    };
    reader.readAsText(file);
    // Reset so same file can be selected again
    e.target.value = "";
  };

  const handleImport = async () => {
    if (parsedGrades.length === 0) return;
    setImporting(true);

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Je moet ingelogd zijn");

      const gradeRows = parsedGrades.map((g) => ({
        user_id: user.id,
        subject: g.subject,
        grade: g.grade,
        description: g.description,
        date: g.date,
      }));

      for (let i = 0; i < gradeRows.length; i += 100) {
        const batch = gradeRows.slice(i, i + 100);
        const { error } = await supabase.from("grades").insert(batch);
        if (error) throw error;
      }

      setResult(parsedGrades.length);
      toast.success(`${parsedGrades.length} cijfer(s) geïmporteerd!`);
      qc.invalidateQueries({ queryKey: ["grades"] });
      setParsedGrades([]);
      setText("");
    } catch (err: any) {
      toast.error(err.message || "Import mislukt");
    } finally {
      setImporting(false);
    }
  };

  const removeGrade = (idx: number) => {
    setParsedGrades((prev) => prev.filter((_, i) => i !== idx));
  };

  const fillExample = () => {
    setText(EXAMPLE);
    setParsedGrades([]);
    setResult(null);
  };

  return (
    <div>
      <div className="mb-6">
        <h1 className="font-display text-2xl font-bold">Cijfer Import</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Importeer cijfers via tekst of een backup-bestand
        </p>
      </div>

      <Tabs defaultValue="text" className="mb-6">
        <TabsList className="w-full">
          <TabsTrigger value="text" className="flex-1">Tekst invoer</TabsTrigger>
          <TabsTrigger value="file" className="flex-1">Bestand uploaden</TabsTrigger>
        </TabsList>

        <TabsContent value="text">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Typ je cijfers</CardTitle>
              <p className="text-xs text-muted-foreground">
                Formaat per regel: <span className="font-mono bg-muted px-1 py-0.5 rounded">vak cijfer omschrijving</span>
                {" "}— datum optioneel (DD-MM-YYYY)
              </p>
            </CardHeader>
            <CardContent className="flex flex-col gap-3">
              <Textarea
                placeholder={"wi 7,2 Poduo\nne 7,8 Boekpitch\nkunst 8,0 Kleurensplash 26-01-2026"}
                value={text}
                onChange={(e) => { setText(e.target.value); setParsedGrades([]); setResult(null); }}
                rows={8}
                className="font-mono text-sm leading-relaxed"
              />
              <div className="flex gap-2">
                <Button onClick={handleParse} disabled={!text.trim()} className="flex-1">
                  Cijfers herkennen
                </Button>
                <Button variant="outline" size="icon" onClick={fillExample} title="Vul voorbeeld in">
                  <Lightbulb size={16} />
                </Button>
              </div>
              <p className="text-xs text-muted-foreground">
                💡 Afkortingen werken: <span className="font-mono">wi</span> = Wiskunde, <span className="font-mono">ne</span> = Nederlands, <span className="font-mono">en</span> = Engels, <span className="font-mono">ak</span> = Aardrijkskunde, etc.
              </p>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="file">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Upload .stgrades bestand</CardTitle>
              <p className="text-xs text-muted-foreground">
                Exporteer je cijfers vanuit de Magister-app als backup en upload het <span className="font-mono bg-muted px-1 py-0.5 rounded">.stgrades</span> bestand hier
              </p>
            </CardHeader>
            <CardContent className="flex flex-col gap-3">
              <input
                ref={fileInputRef}
                type="file"
                accept=".stgrades,.json"
                onChange={handleFileUpload}
                className="hidden"
              />
              <Button
                variant="outline"
                className="h-24 border-dashed flex flex-col gap-2"
                onClick={() => fileInputRef.current?.click()}
              >
                <FileUp size={24} className="text-muted-foreground" />
                <span className="text-sm text-muted-foreground">Klik om een .stgrades bestand te selecteren</span>
              </Button>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Preview */}
      {parsedGrades.length > 0 && (
        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="text-base">
              Controleer ({parsedGrades.length} cijfers)
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="rounded-lg border overflow-auto max-h-80">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Vak</TableHead>
                    <TableHead>Cijfer</TableHead>
                    <TableHead className="hidden sm:table-cell">Omschrijving</TableHead>
                    <TableHead className="hidden sm:table-cell">Datum</TableHead>
                    <TableHead className="w-10" />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {parsedGrades.map((g, i) => (
                    <TableRow key={i}>
                      <TableCell className="font-medium">{g.subject}</TableCell>
                      <TableCell>{g.grade}</TableCell>
                      <TableCell className="hidden sm:table-cell text-muted-foreground truncate max-w-[200px]">
                        {g.description || "—"}
                      </TableCell>
                      <TableCell className="hidden sm:table-cell text-muted-foreground">
                        {g.date}
                      </TableCell>
                      <TableCell>
                        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => removeGrade(i)}>
                          <Trash2 size={14} />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>

            <Button onClick={handleImport} disabled={importing} className="w-full mt-4">
              {importing ? (
                <><Loader2 size={16} className="mr-2 animate-spin" />Importeren...</>
              ) : (
                <><Upload size={16} className="mr-2" />{parsedGrades.length} cijfer(s) importeren</>
              )}
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Summary of skipped calculated grades */}
      {fileSummary.length > 0 && parsedGrades.length > 0 && (
        <Card className="mb-6">
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Overgeslagen (berekend)</CardTitle>
            <p className="text-xs text-muted-foreground">
              Eindcijfers en gemiddelden worden niet geïmporteerd
            </p>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-2">
              {fileSummary.map((s, i) => (
                <div key={i} className="rounded-md bg-muted px-2.5 py-1 text-xs">
                  <span className="font-medium">{s.subject}</span>{" "}
                  <span className="text-muted-foreground">{s.grade} · {s.type}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Result */}
      {result !== null && (
        <Card className="border-primary/30 bg-primary/5">
          <CardContent className="p-4">
            <div className="flex items-center gap-2">
              <CheckCircle2 size={18} className="text-primary" />
              <p className="font-medium text-sm">{result} cijfer(s) succesvol geïmporteerd!</p>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default MagisterImport;
