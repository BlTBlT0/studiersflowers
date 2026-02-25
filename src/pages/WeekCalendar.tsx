import { useMemo } from "react";
import { usePlanBlocks, useActivities } from "@/hooks/useSupabaseData";
import { Card, CardContent } from "@/components/ui/card";
import { CalendarDays } from "lucide-react";
import { format, startOfWeek, addDays, parseISO, isWithinInterval } from "date-fns";
import { nl } from "date-fns/locale";

const HOUR_HEIGHT = 56; // px per hour
const START_HOUR = 8;
const END_HOUR = 22;
const HOURS = Array.from({ length: END_HOUR - START_HOUR }, (_, i) => START_HOUR + i);

const WEEKDAY_MAP: Record<string, number> = {
  monday: 0, tuesday: 1, wednesday: 2, thursday: 3, friday: 4,
};

const SUBJECT_COLORS: Record<string, string> = {
  Wiskunde: "bg-[hsl(250,65%,60%/0.2)] border-[hsl(250,65%,60%/0.5)] text-[hsl(250,65%,60%)]",
  Biologie: "bg-[hsl(90,60%,45%/0.2)] border-[hsl(90,60%,45%/0.5)] text-[hsl(90,60%,45%)]",
  Engels: "bg-[hsl(35,92%,55%/0.2)] border-[hsl(35,92%,55%/0.5)] text-[hsl(35,92%,55%)]",
  Geschiedenis: "bg-[hsl(15,75%,50%/0.2)] border-[hsl(15,75%,50%/0.5)] text-[hsl(15,75%,50%)]",
  Nederlands: "bg-[hsl(210,85%,50%/0.2)] border-[hsl(210,85%,50%/0.5)] text-[hsl(210,85%,50%)]",
  Frans: "bg-[hsl(330,60%,55%/0.2)] border-[hsl(330,60%,55%/0.5)] text-[hsl(330,60%,55%)]",
  Aardrijkskunde: "bg-[hsl(180,50%,45%/0.2)] border-[hsl(180,50%,45%/0.5)] text-[hsl(180,50%,45%)]",
};

const DEFAULT_COLOR = "bg-primary/10 border-primary/30 text-primary";
const ACTIVITY_COLOR = "bg-accent/15 border-accent/40 text-accent-foreground";
const BREAK_COLOR = "bg-muted border-muted-foreground/20 text-muted-foreground";

function timeToMinutes(time: string) {
  const [h, m] = time.slice(0, 5).split(":").map(Number);
  return h * 60 + m;
}

interface Block {
  id: string;
  title: string;
  subtitle?: string;
  startMin: number;
  endMin: number;
  colorClass: string;
  completed?: boolean;
}

const WeekCalendar = () => {
  const { data: planBlocks = [] } = usePlanBlocks();
  const { data: activities = [] } = useActivities();

  const weekStart = useMemo(() => startOfWeek(new Date(), { weekStartsOn: 1 }), []);
  const weekDates = useMemo(() => Array.from({ length: 5 }, (_, i) => addDays(weekStart, i)), [weekStart]);

  // Build columns
  const columns = useMemo(() => {
    return weekDates.map((date, dayIndex) => {
      const dateStr = format(date, "yyyy-MM-dd");
      const blocks: Block[] = [];

      // Plan blocks for this date
      for (const pb of planBlocks) {
        if (pb.date !== dateStr) continue;
        const colorClass = pb.is_break
          ? BREAK_COLOR
          : SUBJECT_COLORS[pb.subject] || DEFAULT_COLOR;
        blocks.push({
          id: pb.id,
          title: pb.is_break ? "Pauze" : pb.task_title,
          subtitle: pb.is_break ? undefined : pb.subject,
          startMin: timeToMinutes(pb.start_time),
          endMin: timeToMinutes(pb.end_time),
          colorClass,
          completed: pb.completed,
        });
      }

      // Activities for this weekday
      const weekdayName = Object.keys(WEEKDAY_MAP).find((k) => WEEKDAY_MAP[k] === dayIndex);
      for (const act of activities) {
        if (act.weekday !== weekdayName) continue;
        blocks.push({
          id: `act-${act.id}`,
          title: act.name,
          startMin: timeToMinutes(act.start_time),
          endMin: timeToMinutes(act.end_time),
          colorClass: ACTIVITY_COLOR,
        });
      }

      return { date, dateStr, blocks };
    });
  }, [weekDates, planBlocks, activities]);

  return (
    <div>
      <h1 className="mb-6 font-display text-2xl font-bold flex items-center gap-2">
        <CalendarDays size={24} className="text-primary" />
        Weekkalender
      </h1>

      <Card>
        <CardContent className="overflow-x-auto p-0">
          <div className="min-w-[700px]">
            {/* Header row */}
            <div className="grid grid-cols-[60px_repeat(5,1fr)] border-b bg-muted/30">
              <div className="p-2" />
              {weekDates.map((date) => (
                <div key={date.toISOString()} className="border-l p-2 text-center">
                  <div className="text-xs font-medium text-muted-foreground">
                    {format(date, "EEE", { locale: nl })}
                  </div>
                  <div className="font-display text-sm font-semibold">
                    {format(date, "d MMM", { locale: nl })}
                  </div>
                </div>
              ))}
            </div>

            {/* Time grid */}
            <div className="relative grid grid-cols-[60px_repeat(5,1fr)]" style={{ height: HOURS.length * HOUR_HEIGHT }}>
              {/* Hour labels */}
              <div className="relative">
                {HOURS.map((hour) => (
                  <div
                    key={hour}
                    className="absolute right-2 text-[11px] text-muted-foreground"
                    style={{ top: (hour - START_HOUR) * HOUR_HEIGHT - 7 }}
                  >
                    {hour}:00
                  </div>
                ))}
              </div>

              {/* Day columns */}
              {columns.map((col, colIdx) => (
                <div key={col.dateStr} className="relative border-l">
                  {/* Hour lines */}
                  {HOURS.map((hour) => (
                    <div
                      key={hour}
                      className="absolute left-0 right-0 border-t border-border/40"
                      style={{ top: (hour - START_HOUR) * HOUR_HEIGHT }}
                    />
                  ))}

                  {/* Blocks */}
                  {col.blocks.map((block) => {
                    const top = ((block.startMin / 60) - START_HOUR) * HOUR_HEIGHT;
                    const height = ((block.endMin - block.startMin) / 60) * HOUR_HEIGHT;
                    if (top < 0 || height <= 0) return null;
                    return (
                      <div
                        key={block.id}
                        className={`absolute left-1 right-1 overflow-hidden rounded-md border px-1.5 py-0.5 text-[11px] leading-tight ${block.colorClass} ${block.completed ? "opacity-50 line-through" : ""}`}
                        style={{ top, height: Math.max(height, 18) }}
                        title={`${block.title}${block.subtitle ? ` — ${block.subtitle}` : ""}`}
                      >
                        <div className="font-medium truncate">{block.title}</div>
                        {block.subtitle && height > 28 && (
                          <div className="truncate opacity-70">{block.subtitle}</div>
                        )}
                      </div>
                    );
                  })}
                </div>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default WeekCalendar;
