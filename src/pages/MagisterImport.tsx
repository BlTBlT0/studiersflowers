import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  ClipboardPaste,
  AlertTriangle,
  Loader2,
  CheckCircle2,
  Trash2,
  Upload,
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

const KNOWN_SUBJECTS: Record<string, string> = {
  ak: "Aardrijkskunde", aardrijkskunde: "Aardrijkskunde",
  bi: "Biologie", biologie: "Biologie",
  en: "Engels", engels: "Engels",
  fa: "Frans", frans: "Frans",
  "franse taal en literatuur": "Frans",
  gr: "Grieks", grieks: "Grieks",
  gs: "Geschiedenis", geschiedenis: "Geschiedenis",
  ku: "Kunst", kunst: "Kunst", kunstonderwijs: "Kunst",
  lo: "Lichamelijke Opvoeding",
  mu: "Muziek", muziek: "Muziek",
  na: "Natuurkunde", natuurkunde: "Natuurkunde",
  ne: "Nederlands", nederlands: "Nederlands",
  "nederlandse taal en literatuur": "Nederlands",
  sk: "Scheikunde", scheikunde: "Scheikunde",
  wi: "Wiskunde", wiskunde: "Wiskunde",
  wia: "Wiskunde A", wib: "Wiskunde B", wic: "Wiskunde C", wid: "Wiskunde D",
  ec: "Economie", economie: "Economie",
  ma: "Maatschappijleer", maw: "Maatschappijwetenschappen",
  ckv: "CKV", la: "Latijn", latijn: "Latijn",
  du: "Duits", duits: "Duits", sp: "Spaans", spaans: "Spaans",
  in: "Informatica", informatica: "Informatica",
  fil: "Filosofie", filosofie: "Filosofie",
  te: "Tekenen", ht: "Handvaardigheid", txt: "Textiel",
};

function normalizeSubject(raw: string): string {
  // Clean up truncated names like "Nederlandse taal e..." or "Franse taal en liter..."
  const cleaned = raw.replace(/\.{2,}$/, "").trim();
  const lower = cleaned.toLowerCase();
  
  if (KNOWN_SUBJECTS[lower]) return KNOWN_SUBJECTS[lower];
  
  // Partial match for truncated names
  for (const [key, value] of Object.entries(KNOWN_SUBJECTS)) {
    if (key.startsWith(lower) || lower.startsWith(key)) return value;
  }
  
  return cleaned.charAt(0).toUpperCase() + cleaned.slice(1);
}

interface ParsedGrade {
  subject: string;
  grade: number;
  description: string;
  date: string;
  weight: string;
}

function parsePastedData(text: string): ParsedGrade[] {
  const lines = text.split("\n").filter((l) => l.trim());
  const grades: ParsedGrade[] = [];

  for (const line of lines) {
    // Split by tab (copy-paste from browser table uses tabs)
    const cols = line.split("\t").map((c) => c.trim());
    
    // Expected: Vak | Datum invoer | Omschrijving | Resultaat | Weegfactor
    // But also handle if header row is included
    if (cols.length < 4) continue;

    // Skip header row
    if (
      cols[0].toLowerCase().includes("vak") &&
      cols.some((c) => c.toLowerCase().includes("resultaat") || c.toLowerCase().includes("cijfer"))
    ) continue;

    // Try to find the grade value - could be in different positions
    // Magister format: Vak, Datum, Omschrijving, Resultaat, Weegfactor
    let subject = cols[0];
    let dateStr = cols[1];
    let description = cols[2];
    let gradeStr = cols[3];
    let weight = cols[4] || "1x";

    // Parse grade (handle comma as decimal separator)
    const gradeNum = parseFloat(gradeStr.replace(",", "."));
    
    // If this doesn't look like a grade, the result might be text (like "opmerking bij resultaat")
    if (isNaN(gradeNum)) continue;
    // Filter out non-numeric grades or out-of-range
    if (gradeNum < 1 || gradeNum > 10) continue;
    
    // Skip 0x weight entries (comments, not actual grades)
    if (weight === "0x") continue;

    // Parse date (DD-MM-YYYY format from Magister)
    let isoDate = new Date().toISOString().split("T")[0];
    if (dateStr) {
      const parts = dateStr.split("-");
      if (parts.length === 3) {
        const [d, m, y] = parts;
        const attempt = new Date(`${y}-${m.padStart(2, "0")}-${d.padStart(2, "0")}`);
        if (!isNaN(attempt.getTime())) {
          isoDate = attempt.toISOString().split("T")[0];
        }
      }
    }

    grades.push({
      subject: normalizeSubject(subject),
      grade: Math.round(gradeNum * 10) / 10,
      description,
      date: isoDate,
      weight,
    });
  }

  return grades;
}

const MagisterImport = () => {
  const [pasteValue, setPasteValue] = useState("");
  const [parsedGrades, setParsedGrades] = useState<ParsedGrade[]>([]);
  const [importing, setImporting] = useState(false);
  const [result, setResult] = useState<number | null>(null);
  const qc = useQueryClient();

  const handleParse = () => {
    if (!pasteValue.trim()) {
      toast.error("Plak eerst je cijfers in het tekstveld");
      return;
    }
    const grades = parsePastedData(pasteValue);
    if (grades.length === 0) {
      toast.error("Geen geldige cijfers gevonden. Heb je de tabel goed gekopieerd?");
      return;
    }
    setParsedGrades(grades);
    setResult(null);
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
      setPasteValue("");
    } catch (err: any) {
      toast.error(err.message || "Import mislukt");
    } finally {
      setImporting(false);
    }
  };

  const removeGrade = (idx: number) => {
    setParsedGrades((prev) => prev.filter((_, i) => i !== idx));
  };

  return (
    <div>
      <div className="mb-6">
        <h1 className="font-display text-2xl font-bold">Cijfers Importeren</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Kopieer en plak je cijfers vanuit Magister
        </p>
      </div>

      <Card className="mb-6 border-amber-500/30 bg-amber-500/5">
        <CardContent className="flex items-start gap-3 p-4">
          <AlertTriangle size={20} className="mt-0.5 shrink-0 text-amber-500" />
          <div className="text-sm">
            <p className="font-medium text-amber-500">Zo werkt het</p>
            <ol className="mt-1 list-decimal pl-4 text-muted-foreground space-y-1">
              <li>Open Magister → <strong>Cijfers</strong> → <strong>Laatste cijfers</strong></li>
              <li>Selecteer alle rijen in de tabel (klik op de eerste rij, dan Shift+klik op de laatste)</li>
              <li>Kopieer met <strong>⌘+C</strong> (Mac) of <strong>Ctrl+C</strong> (Windows)</li>
              <li>Plak hieronder met <strong>⌘+V</strong> of <strong>Ctrl+V</strong></li>
            </ol>
          </div>
        </CardContent>
      </Card>

      {/* Paste area */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <ClipboardPaste size={18} />
            Plak je cijfers
          </CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          <Textarea
            placeholder={"Nederlandse taal e...\t02-03-2026\tBoekpitch\t7,8\t1x\nkunstonderwijs\t06-02-2026\tKoraal\t7,3\t1x\n..."}
            value={pasteValue}
            onChange={(e) => setPasteValue(e.target.value)}
            rows={6}
            className="font-mono text-xs"
          />
          <Button onClick={handleParse} disabled={!pasteValue.trim()}>
            <ClipboardPaste size={16} className="mr-2" />
            Cijfers herkennen
          </Button>
        </CardContent>
      </Card>

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
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7"
                          onClick={() => removeGrade(i)}
                        >
                          <Trash2 size={14} />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>

            <Button
              onClick={handleImport}
              disabled={importing}
              className="w-full mt-4"
            >
              {importing ? (
                <>
                  <Loader2 size={16} className="mr-2 animate-spin" />
                  Importeren...
                </>
              ) : (
                <>
                  <Upload size={16} className="mr-2" />
                  {parsedGrades.length} cijfer(s) importeren
                </>
              )}
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Result */}
      {result !== null && (
        <Card className="border-primary/30 bg-primary/5">
          <CardContent className="p-4">
            <div className="flex items-center gap-2">
              <CheckCircle2 size={18} className="text-primary" />
              <p className="font-medium text-sm">
                {result} cijfer(s) succesvol geïmporteerd!
              </p>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default MagisterImport;
