import { useState, useRef } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Upload,
  AlertTriangle,
  Loader2,
  CheckCircle2,
  FileSpreadsheet,
  Trash2,
  X,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";
import Papa from "papaparse";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

const KNOWN_SUBJECTS: Record<string, string> = {
  ak: "Aardrijkskunde",
  bi: "Biologie",
  en: "Engels",
  fa: "Frans",
  gr: "Grieks",
  gs: "Geschiedenis",
  ku: "Kunst",
  lo: "Lichamelijke Opvoeding",
  mu: "Muziek",
  na: "Natuurkunde",
  ne: "Nederlands",
  nlt: "Natuur, Leven & Technologie",
  sk: "Scheikunde",
  wi: "Wiskunde",
  wia: "Wiskunde A",
  wib: "Wiskunde B",
  wic: "Wiskunde C",
  wid: "Wiskunde D",
  ec: "Economie",
  ma: "Maatschappijleer",
  maw: "Maatschappijwetenschappen",
  ckv: "CKV",
  beco: "Bedrijfseconomie",
  la: "Latijn",
  du: "Duits",
  sp: "Spaans",
  in: "Informatica",
  fil: "Filosofie",
  te: "Tekenen",
  ht: "Handvaardigheid",
  txt: "Textiel",
};

function normalizeSubject(raw: string): string {
  const lower = raw.trim().toLowerCase();
  if (KNOWN_SUBJECTS[lower]) return KNOWN_SUBJECTS[lower];
  // Return as-is with capitalised first letter
  return raw.trim().charAt(0).toUpperCase() + raw.trim().slice(1);
}

interface ParsedGrade {
  subject: string;
  grade: number;
  description: string;
  date: string;
}

type ColumnMapping = {
  subject: string;
  grade: string;
  description: string;
  date: string;
};

const REQUIRED_FIELDS: (keyof ColumnMapping)[] = ["subject", "grade"];

const FIELD_LABELS: Record<keyof ColumnMapping, string> = {
  subject: "Vak",
  grade: "Cijfer",
  description: "Omschrijving",
  date: "Datum",
};

function autoDetectColumn(
  headers: string[],
  field: keyof ColumnMapping
): string {
  const patterns: Record<keyof ColumnMapping, RegExp[]> = {
    subject: [/vak/i, /subject/i, /code/i, /vakcode/i],
    grade: [/cijfer/i, /grade/i, /resultaat/i, /score/i, /waarde/i],
    description: [/omschrijving/i, /desc/i, /toets/i, /kolom/i, /naam/i],
    date: [/datum/i, /date/i, /ingevoerd/i],
  };
  for (const pattern of patterns[field]) {
    const match = headers.find((h) => pattern.test(h));
    if (match) return match;
  }
  return "";
}

const MagisterImport = () => {
  const [file, setFile] = useState<File | null>(null);
  const [headers, setHeaders] = useState<string[]>([]);
  const [rows, setRows] = useState<Record<string, string>[]>([]);
  const [mapping, setMapping] = useState<ColumnMapping>({
    subject: "",
    grade: "",
    description: "",
    date: "",
  });
  const [parsedGrades, setParsedGrades] = useState<ParsedGrade[]>([]);
  const [importing, setImporting] = useState(false);
  const [result, setResult] = useState<number | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const qc = useQueryClient();

  const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f) return;
    setFile(f);
    setResult(null);
    setParsedGrades([]);

    Papa.parse(f, {
      header: true,
      skipEmptyLines: true,
      encoding: "utf-8",
      complete: (results) => {
        const h = results.meta.fields || [];
        const r = results.data as Record<string, string>[];
        setHeaders(h);
        setRows(r);

        // Auto-detect column mappings
        const auto: ColumnMapping = {
          subject: autoDetectColumn(h, "subject"),
          grade: autoDetectColumn(h, "grade"),
          description: autoDetectColumn(h, "description"),
          date: autoDetectColumn(h, "date"),
        };
        setMapping(auto);
      },
      error: () => {
        toast.error("Kan het bestand niet lezen. Is het een geldig CSV-bestand?");
      },
    });
  };

  const clearFile = () => {
    setFile(null);
    setHeaders([]);
    setRows([]);
    setMapping({ subject: "", grade: "", description: "", date: "" });
    setParsedGrades([]);
    setResult(null);
    if (fileRef.current) fileRef.current.value = "";
  };

  const handlePreview = () => {
    if (!mapping.subject || !mapping.grade) {
      toast.error("Selecteer minstens de kolommen voor Vak en Cijfer");
      return;
    }

    const grades: ParsedGrade[] = [];
    for (const row of rows) {
      const rawGrade = row[mapping.grade]?.replace(",", ".").trim();
      const num = parseFloat(rawGrade);
      if (isNaN(num) || num < 1 || num > 10) continue;

      const rawSubject = row[mapping.subject]?.trim();
      if (!rawSubject) continue;

      let date = new Date().toISOString().split("T")[0];
      if (mapping.date && row[mapping.date]) {
        // Try parsing various date formats
        const raw = row[mapping.date].trim();
        const parsed = new Date(raw);
        if (!isNaN(parsed.getTime())) {
          date = parsed.toISOString().split("T")[0];
        } else {
          // Try DD-MM-YYYY
          const parts = raw.split(/[-/]/);
          if (parts.length === 3) {
            const [d, m, y] = parts;
            const attempt = new Date(`${y}-${m.padStart(2, "0")}-${d.padStart(2, "0")}`);
            if (!isNaN(attempt.getTime())) date = attempt.toISOString().split("T")[0];
          }
        }
      }

      grades.push({
        subject: normalizeSubject(rawSubject),
        grade: Math.round(num * 10) / 10,
        description: mapping.description ? (row[mapping.description]?.trim() || "") : "",
        date,
      });
    }

    if (grades.length === 0) {
      toast.error("Geen geldige cijfers gevonden. Controleer de kolomkoppeling.");
      return;
    }

    setParsedGrades(grades);
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

      // Insert in batches of 100
      for (let i = 0; i < gradeRows.length; i += 100) {
        const batch = gradeRows.slice(i, i + 100);
        const { error } = await supabase.from("grades").insert(batch);
        if (error) throw error;
      }

      setResult(parsedGrades.length);
      toast.success(`${parsedGrades.length} cijfer(s) geïmporteerd!`);
      qc.invalidateQueries({ queryKey: ["grades"] });
      setParsedGrades([]);
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
          Importeer je cijfers vanuit een CSV-bestand (export vanuit Magister)
        </p>
      </div>

      <Card className="mb-6 border-amber-500/30 bg-amber-500/5">
        <CardContent className="flex items-start gap-3 p-4">
          <AlertTriangle size={20} className="mt-0.5 shrink-0 text-amber-500" />
          <div className="text-sm">
            <p className="font-medium text-amber-500">Hoe exporteer je cijfers uit Magister?</p>
            <ol className="mt-1 list-decimal pl-4 text-muted-foreground space-y-1">
              <li>Open Magister in je browser en ga naar <strong>Cijfers → Cijferoverzicht</strong></li>
              <li>Klik rechtsboven op het <strong>export/download</strong> icoon</li>
              <li>Kies <strong>CSV</strong> of <strong>Excel</strong> als formaat</li>
              <li>Upload het gedownloade bestand hieronder</li>
            </ol>
          </div>
        </CardContent>
      </Card>

      {/* File upload */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle className="text-base">1. Bestand uploaden</CardTitle>
        </CardHeader>
        <CardContent>
          {!file ? (
            <label
              htmlFor="csv-upload"
              className="flex flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed border-muted-foreground/25 p-8 cursor-pointer hover:border-primary/50 hover:bg-muted/30 transition-colors"
            >
              <Upload size={32} className="text-muted-foreground" />
              <p className="text-sm font-medium">Klik om een CSV-bestand te selecteren</p>
              <p className="text-xs text-muted-foreground">CSV-bestanden (.csv)</p>
              <input
                ref={fileRef}
                id="csv-upload"
                type="file"
                accept=".csv"
                className="hidden"
                onChange={handleFile}
              />
            </label>
          ) : (
            <div className="flex items-center gap-3 rounded-lg border p-3">
              <FileSpreadsheet size={20} className="text-primary" />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate">{file.name}</p>
                <p className="text-xs text-muted-foreground">
                  {rows.length} rij(en) gevonden, {headers.length} kolom(men)
                </p>
              </div>
              <Button variant="ghost" size="icon" onClick={clearFile}>
                <X size={16} />
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Column mapping */}
      {headers.length > 0 && (
        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="text-base">2. Kolommen koppelen</CardTitle>
          </CardHeader>
          <CardContent className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {(Object.keys(FIELD_LABELS) as (keyof ColumnMapping)[]).map((field) => (
              <div key={field}>
                <Label className="mb-1.5 block text-sm">
                  {FIELD_LABELS[field]}
                  {REQUIRED_FIELDS.includes(field) && (
                    <span className="text-destructive ml-1">*</span>
                  )}
                </Label>
                <Select
                  value={mapping[field]}
                  onValueChange={(v) =>
                    setMapping((prev) => ({ ...prev, [field]: v === "__none__" ? "" : v }))
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Selecteer kolom..." />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none__">— Niet gebruiken —</SelectItem>
                    {headers.map((h) => (
                      <SelectItem key={h} value={h}>
                        {h}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            ))}
            <div className="sm:col-span-2">
              <Button onClick={handlePreview} className="w-full">
                Voorbeeld bekijken
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Preview */}
      {parsedGrades.length > 0 && (
        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="text-base">
              3. Controleer ({parsedGrades.length} cijfers)
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
                  {parsedGrades.slice(0, 100).map((g, i) => (
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
            {parsedGrades.length > 100 && (
              <p className="text-xs text-muted-foreground mt-2">
                Toont eerste 100 van {parsedGrades.length} cijfers
              </p>
            )}

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
