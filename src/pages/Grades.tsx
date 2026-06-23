import { useGrades, useGradeMutations } from "@/hooks/useSupabaseData";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Trash2, TrendingUp, TrendingDown, Minus, Award } from "lucide-react";
import { format } from "date-fns";
import { nl } from "date-fns/locale";
import { BarChart, Bar, XAxis, YAxis, ResponsiveContainer, CartesianGrid, Cell } from "recharts";
import { useState } from "react";

const Grades = () => {
  const { data: grades = [], isLoading } = useGrades(false);
  const { data: finalGrades = [], isLoading: finalLoading } = useGrades(true);
  const { addGrade, deleteGrade } = useGradeMutations();
  const [filterSubject, setFilterSubject] = useState<string>("all");

  // Compute averages per subject
  const subjectMap = new Map<string, number[]>();
  grades.forEach((g) => {
    if (!subjectMap.has(g.subject)) subjectMap.set(g.subject, []);
    subjectMap.get(g.subject)!.push(Number(g.grade));
  });

  const averages = Array.from(subjectMap.entries())
    .map(([subj, vals]) => ({
      subject: subj,
      average: Math.round((vals.reduce((a, b) => a + b, 0) / vals.length) * 10) / 10,
      count: vals.length,
    }))
    .sort((a, b) => a.subject.localeCompare(b.subject));

  const overallAvg = grades.length > 0
    ? Math.round((grades.reduce((s, g) => s + Number(g.grade), 0) / grades.length) * 10) / 10
    : 0;

  // Trend per subject (last 2 grades)
  const getTrend = (subj: string) => {
    const subjectGrades = grades
      .filter((g) => g.subject === subj)
      .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
    if (subjectGrades.length < 2) return "neutral";
    const last = Number(subjectGrades[subjectGrades.length - 1].grade);
    const prev = Number(subjectGrades[subjectGrades.length - 2].grade);
    if (last > prev) return "up";
    if (last < prev) return "down";
    return "neutral";
  };

  const filtered = filterSubject === "all" ? grades : grades.filter((g) => g.subject === filterSubject);
  const sortedFiltered = [...filtered].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

  if (isLoading || finalLoading) return <div className="py-16 text-center text-muted-foreground">Laden...</div>;

  // Build final grades by subject (deduplicate, keep latest)
  const finalBySubject = new Map<string, { grade: number; description: string; date: string; id: string }>();
  finalGrades.forEach((g) => {
    const existing = finalBySubject.get(g.subject);
    if (!existing || new Date(g.date) > new Date(existing.date)) {
      finalBySubject.set(g.subject, { grade: Number(g.grade), description: g.description || "", date: g.date, id: g.id });
    }
  });
  const sortedFinal = Array.from(finalBySubject.entries()).sort((a, b) => a[0].localeCompare(b[0]));

  return (
    <div>
      <div className="mb-6">
        <h1 className="font-display text-2xl font-bold">Cijfers</h1>
      </div>

      {/* Overview cards */}
      <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Card>
          <CardContent className="p-4 text-center">
            <p className="text-xs text-muted-foreground">Gemiddeld</p>
            <p className="text-2xl font-bold">{overallAvg || "–"}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <p className="text-xs text-muted-foreground">Vakken</p>
            <p className="text-2xl font-bold">{subjectMap.size}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <p className="text-xs text-muted-foreground">Totaal cijfers</p>
            <p className="text-2xl font-bold">{grades.length}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <p className="text-xs text-muted-foreground">Hoogste</p>
            <p className="text-2xl font-bold">{grades.length > 0 ? Math.max(...grades.map((g) => Number(g.grade))) : "–"}</p>
          </CardContent>
        </Card>
      </div>

      {/* Eindcijfers */}
      {sortedFinal.length > 0 && (
        <Card className="mb-6">
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <Award size={16} className="text-primary" />
              Eindcijfers
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-4">
              {sortedFinal.map(([subj, data]) => (
                <div
                  key={subj}
                  className={`rounded-lg p-3 text-center ${data.grade >= 5.5 ? "bg-primary/10" : "bg-destructive/10"}`}
                >
                  <p className="text-xs text-muted-foreground truncate">{subj}</p>
                  <p className={`text-xl font-bold ${data.grade >= 5.5 ? "text-primary" : "text-destructive"}`}>
                    {data.grade}
                  </p>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Bar chart of averages */}
      {averages.length > 0 && (
        <Card className="mb-6">
          <CardHeader className="pb-2"><CardTitle className="text-base">Gemiddelde per vak</CardTitle></CardHeader>
          <CardContent>
            <div className="h-48">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={averages} margin={{ top: 5, right: 5, bottom: 40, left: -10 }}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                  <XAxis dataKey="subject" tick={{ fontSize: 10 }} className="fill-muted-foreground" angle={-45} textAnchor="end" interval={0} />
                  <YAxis domain={[0, 10]} tick={{ fontSize: 11 }} className="fill-muted-foreground" />
                  <Bar dataKey="average" radius={[4, 4, 0, 0]}>
                    {averages.map((entry) => (
                      <Cell key={entry.subject} className={entry.average >= 5.5 ? "fill-primary" : "fill-destructive"} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Filter + list */}
      <div className="mb-3 flex items-center gap-2">
        <Select value={filterSubject} onValueChange={setFilterSubject}>
          <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Alle vakken</SelectItem>
            {Array.from(subjectMap.keys()).sort().map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      <div className="flex flex-col gap-2">
        {sortedFiltered.map((g) => {
          const trend = getTrend(g.subject);
          return (
            <Card key={g.id} className="group">
              <CardContent className="flex items-center gap-3 p-3">
                <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg text-lg font-bold ${Number(g.grade) >= 5.5 ? "bg-primary/10 text-primary" : "bg-destructive/10 text-destructive"}`}>
                  {Number(g.grade)}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium">{g.subject}</p>
                  <p className="truncate text-xs text-muted-foreground">
                    {format(new Date(g.date), "d MMM yyyy", { locale: nl })}
                    {g.description && ` · ${g.description}`}
                  </p>
                </div>
                {trend === "up" && <TrendingUp size={16} className="text-primary" />}
                {trend === "down" && <TrendingDown size={16} className="text-destructive" />}
                {trend === "neutral" && <Minus size={16} className="text-muted-foreground" />}
                <Button variant="ghost" size="icon" className="opacity-0 group-hover:opacity-100" onClick={() => deleteGrade.mutate(g.id)}>
                  <Trash2 size={14} />
                </Button>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {grades.length === 0 && (
        <div className="py-16 text-center text-muted-foreground">
          <p className="text-lg">Nog geen cijfers</p>
          <p className="text-sm">Klik op "Cijfer toevoegen" om te beginnen</p>
        </div>
      )}
    </div>
  );
};

export default Grades;
