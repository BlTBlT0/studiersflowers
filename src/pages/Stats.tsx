import { useMemo } from "react";
import { useTimeTracking, usePlanBlocks, useTasks } from "@/hooks/useSupabaseData";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend } from "recharts";
import { BarChart3, Flame, CheckCircle2, Clock } from "lucide-react";
import { format, parseISO, isAfter, subDays, startOfDay } from "date-fns";

const COLORS = [
  "hsl(210, 85%, 50%)",
  "hsl(90, 60%, 45%)",
  "hsl(35, 92%, 55%)",
  "hsl(250, 65%, 60%)",
  "hsl(15, 75%, 50%)",
  "hsl(180, 50%, 45%)",
  "hsl(330, 60%, 55%)",
  "hsl(60, 70%, 45%)",
];

const Stats = () => {
  const { data: tracking = [] } = useTimeTracking();
  const { data: planBlocks = [] } = usePlanBlocks();
  const { data: tasks = [] } = useTasks();

  // Study time per subject
  const subjectTime = useMemo(() => {
    const map: Record<string, { estimated: number; actual: number }> = {};
    for (const t of tracking) {
      if (!map[t.subject]) map[t.subject] = { estimated: 0, actual: 0 };
      map[t.subject].estimated += t.estimated_minutes;
      map[t.subject].actual += t.actual_minutes;
    }
    return Object.entries(map)
      .map(([subject, v]) => ({ subject, ...v }))
      .sort((a, b) => b.actual - a.actual);
  }, [tracking]);

  // Total stats
  const totalActual = tracking.reduce((s, t) => s + t.actual_minutes, 0);
  const totalEstimated = tracking.reduce((s, t) => s + t.estimated_minutes, 0);

  // Blocks completed vs planned
  const blocksCompleted = planBlocks.filter((b) => b.completed && !b.is_break).length;
  const blocksTotal = planBlocks.filter((b) => !b.is_break).length;

  // Streak calculation: consecutive days with at least one completed block
  const streak = useMemo(() => {
    const completedDates = new Set(
      planBlocks.filter((b) => b.completed && !b.is_break).map((b) => b.date)
    );
    let count = 0;
    let day = startOfDay(new Date());
    // Check today and go backwards
    while (true) {
      const dateStr = format(day, "yyyy-MM-dd");
      if (completedDates.has(dateStr)) {
        count++;
        day = subDays(day, 1);
      } else {
        break;
      }
    }
    return count;
  }, [planBlocks]);

  // Tasks completed
  const tasksCompleted = tasks.filter((t) => t.completed).length;

  // Pie chart: subject distribution
  const pieData = subjectTime.map((s) => ({ name: s.subject, value: s.actual }));

  return (
    <div>
      <h1 className="mb-6 font-display text-2xl font-bold">Statistieken</h1>

      {/* Summary cards */}
      <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Card>
          <CardContent className="flex flex-col items-center gap-1 p-4">
            <Clock size={20} className="text-primary" />
            <span className="text-2xl font-bold">{totalActual}</span>
            <span className="text-xs text-muted-foreground">Minuten gestudeerd</span>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex flex-col items-center gap-1 p-4">
            <Flame size={20} className="text-destructive" />
            <span className="text-2xl font-bold">{streak}</span>
            <span className="text-xs text-muted-foreground">Dagen streak</span>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex flex-col items-center gap-1 p-4">
            <CheckCircle2 size={20} className="text-accent" />
            <span className="text-2xl font-bold">{tasksCompleted}/{tasks.length}</span>
            <span className="text-xs text-muted-foreground">Taken voltooid</span>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex flex-col items-center gap-1 p-4">
            <BarChart3 size={20} className="text-primary" />
            <span className="text-2xl font-bold">{blocksCompleted}/{blocksTotal}</span>
            <span className="text-xs text-muted-foreground">Blokken afgerond</span>
          </CardContent>
        </Card>
      </div>

      {/* Estimated vs Actual bar chart */}
      {subjectTime.length > 0 ? (
        <div className="grid gap-6 md:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Geschat vs Werkelijk (min)</CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={280}>
                <BarChart data={subjectTime} layout="vertical">
                  <XAxis type="number" />
                  <YAxis type="category" dataKey="subject" width={90} tick={{ fontSize: 12 }} />
                  <Tooltip />
                  <Bar dataKey="estimated" name="Geschat" fill="hsl(210, 85%, 50%)" radius={[0, 4, 4, 0]} />
                  <Bar dataKey="actual" name="Werkelijk" fill="hsl(90, 60%, 45%)" radius={[0, 4, 4, 0]} />
                  <Legend />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Studietijd per vak</CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={280}>
                <PieChart>
                  <Pie
                    data={pieData}
                    dataKey="value"
                    nameKey="name"
                    cx="50%"
                    cy="50%"
                    outerRadius={100}
                    label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                  >
                    {pieData.map((_, i) => (
                      <Cell key={i} fill={COLORS[i % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </div>
      ) : (
        <Card>
          <CardContent className="flex flex-col items-center py-12 text-center">
            <BarChart3 size={40} className="mb-3 text-primary/40" />
            <h3 className="font-display text-lg font-semibold">Nog geen data</h3>
            <p className="mt-1 max-w-xs text-sm text-muted-foreground">
              Rond studieblokken af met de timer in de Planner om hier je statistieken te zien.
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default Stats;
