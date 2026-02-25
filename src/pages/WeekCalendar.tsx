import { useMemo } from "react";
import { usePlanBlocks, useActivities } from "@/hooks/useSupabaseData";
import { Card, CardContent } from "@/components/ui/card";
import { CalendarDays } from "lucide-react";
import { format, startOfWeek, addDays } from "date-fns";
import { nl } from "date-fns/locale";

const HOUR_HEIGHT = 56;
const START_HOUR = 8;
const END_HOUR = 22;
const HOURS = Array.from({ length: END_HOUR - START_HOUR }, (_, i) => START_HOUR + i);

const WEEKDAY_MAP: Record<string, number> = {
  monday: 0, tuesday: 1, wednesday: 2, thursday: 3, friday: 4,
};

const SUBJECT_COLORS: Record<string, string> = {
  Wiskunde: "bg-[hsl(270,100%,65%/0.25)] border-[hsl(270,100%,65%)] text-[hsl(270,100%,80%)] shadow-[0_0_8px_hsl(270,100%,65%/0.4)]",
  Biologie: "bg-[hsl(140,100%,50%/0.2)] border-[hsl(140,100%,50%)] text-[hsl(140,100%,75%)] shadow-[0_0_8px_hsl(140,100%,50%/0.4)]",
  Engels: "bg-[hsl(45,100%,55%/0.2)] border-[hsl(45,100%,55%)] text-[hsl(45,100%,75%)] shadow-[0_0_8px_hsl(45,100%,55%/0.4)]",
  Geschiedenis: "bg-[hsl(15,100%,55%/0.25)] border-[hsl(15,100%,55%)] text-[hsl(15,100%,78%)] shadow-[0_0_8px_hsl(15,100%,55%/0.4)]",
  Nederlands: "bg-[hsl(200,100%,55%/0.2)] border-[hsl(200,100%,55%)] text-[hsl(200,100%,78%)] shadow-[0_0_8px_hsl(200,100%,55%/0.4)]",
  Frans: "bg-[hsl(320,100%,60%/0.2)] border-[hsl(320,100%,60%)] text-[hsl(320,100%,80%)] shadow-[0_0_8px_hsl(320,100%,60%/0.4)]",
  Aardrijkskunde: "bg-[hsl(175,100%,45%/0.2)] border-[hsl(175,100%,45%)] text-[hsl(175,100%,75%)] shadow-[0_0_8px_hsl(175,100%,45%/0.4)]",
};

const NEON_DOTS: Record<string, string> = {
  Wiskunde: "bg-[hsl(270,100%,65%)] shadow-[0_0_6px_hsl(270,100%,65%)]",
  Biologie: "bg-[hsl(140,100%,50%)] shadow-[0_0_6px_hsl(140,100%,50%)]",
  Engels: "bg-[hsl(45,100%,55%)] shadow-[0_0_6px_hsl(45,100%,55%)]",
  Geschiedenis: "bg-[hsl(15,100%,55%)] shadow-[0_0_6px_hsl(15,100%,55%)]",
  Nederlands: "bg-[hsl(200,100%,55%)] shadow-[0_0_6px_hsl(200,100%,55%)]",
  Frans: "bg-[hsl(320,100%,60%)] shadow-[0_0_6px_hsl(320,100%,60%)]",
  Aardrijkskunde: "bg-[hsl(175,100%,45%)] shadow-[0_0_6px_hsl(175,100%,45%)]",
};

const DEFAULT_COLOR = "bg-[hsl(210,100%,60%/0.2)] border-[hsl(210,100%,60%)] text-[hsl(210,100%,78%)] shadow-[0_0_8px_hsl(210,100%,60%/0.4)]";
const ACTIVITY_COLOR = "bg-[hsl(260,80%,70%/0.15)] border-[hsl(260,80%,70%/0.7)] text-[hsl(260,80%,82%)] shadow-[0_0_6px_hsl(260,80%,70%/0.3)]";
const BREAK_COLOR = "bg-[hsl(0,0%,40%/0.15)] border-[hsl(0,0%,50%/0.5)] text-[hsl(0,0%,65%)]";

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

  const columns = useMemo(() => {
    return weekDates.map((date, dayIndex) => {
      const dateStr = format(date, "yyyy-MM-dd");
      const blocks: Block[] = [];

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
        <CalendarDays size={24} className="text-[hsl(270,100%,70%)]" />
        <span className="bg-gradient-to-r from-[hsl(270,100%,70%)] to-[hsl(200,100%,60%)] bg-clip-text text-transparent">
          Weekkalender
        </span>
      </h1>

      {/* Legenda */}
      <div className="mb-4 flex flex-wrap gap-3 rounded-lg bg-[hsl(230,25%,12%)] px-4 py-2.5 border border-[hsl(230,20%,20%)]">
        {Object.keys(SUBJECT_COLORS).map((subject) => (
          <div key={subject} className="flex items-center gap-1.5">
            <div className={`h-2.5 w-2.5 rounded-full ${NEON_DOTS[subject]}`} />
            <span className="text-xs text-[hsl(230,15%,65%)]">{subject}</span>
          </div>
        ))}
        <div className="flex items-center gap-1.5">
          <div className="h-2.5 w-2.5 rounded-full bg-[hsl(210,100%,60%)] shadow-[0_0_6px_hsl(210,100%,60%/0.6)]" />
          <span className="text-xs text-[hsl(230,15%,65%)]">Overig</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="h-2.5 w-2.5 rounded-full bg-[hsl(260,80%,70%)] shadow-[0_0_6px_hsl(260,80%,70%/0.6)]" />
          <span className="text-xs text-[hsl(230,15%,65%)]">Activiteit</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="h-2.5 w-2.5 rounded-full bg-[hsl(0,0%,50%)]" />
          <span className="text-xs text-[hsl(230,15%,65%)]">Pauze</span>
        </div>
      </div>

      <Card className="bg-[hsl(230,25%,10%)] border-[hsl(230,20%,18%)] shadow-[0_0_30px_hsl(270,100%,50%/0.08)]">
        <CardContent className="overflow-x-auto p-0">
          <div className="min-w-[700px]">
            {/* Header row */}
            <div className="grid grid-cols-[60px_repeat(5,1fr)] border-b border-[hsl(230,20%,18%)] bg-[hsl(230,25%,12%)]">
              <div className="p-2" />
              {weekDates.map((date) => (
                <div key={date.toISOString()} className="border-l border-[hsl(230,20%,18%)] p-2 text-center">
                  <div className="text-xs font-medium text-[hsl(230,15%,55%)]">
                    {format(date, "EEE", { locale: nl })}
                  </div>
                  <div className="font-display text-sm font-semibold text-[hsl(230,15%,80%)]">
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
                    className="absolute right-2 text-[11px] text-[hsl(230,15%,40%)]"
                    style={{ top: (hour - START_HOUR) * HOUR_HEIGHT - 7 }}
                  >
                    {hour}:00
                  </div>
                ))}
              </div>

              {/* Day columns */}
              {columns.map((col) => (
                <div key={col.dateStr} className="relative border-l border-[hsl(230,20%,15%)]">
                  {/* Hour lines */}
                  {HOURS.map((hour) => (
                    <div
                      key={hour}
                      className="absolute left-0 right-0 border-t border-[hsl(230,20%,14%)]"
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
