import { useState } from "react";
import { ScheduleSettings, Activity, DEFAULT_SCHEDULE, WEEKDAYS, WEEKDAY_LABELS, Weekday } from "@/types";
import { useLocalStorage } from "@/hooks/useLocalStorage";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Plus, Trash2, Clock } from "lucide-react";
import { cn } from "@/lib/utils";

const Schedule = () => {
  const [schedule, setSchedule] = useLocalStorage<ScheduleSettings>("studyflow-schedule", DEFAULT_SCHEDULE);
  const [activities, setActivities] = useLocalStorage<Activity[]>("studyflow-activities", []);
  const [actOpen, setActOpen] = useState(false);
  const [actName, setActName] = useState("");
  const [actDay, setActDay] = useState<Weekday>("monday");
  const [actStart, setActStart] = useState("16:00");
  const [actEnd, setActEnd] = useState("17:00");

  const updateSchoolEnd = (day: Weekday, time: string) => {
    setSchedule((prev) => ({
      ...prev,
      schoolEndTimes: { ...prev.schoolEndTimes, [day]: time },
    }));
  };

  const addActivity = (e: React.FormEvent) => {
    e.preventDefault();
    if (!actName) return;
    setActivities((prev) => [
      ...prev,
      { id: crypto.randomUUID(), name: actName, weekday: actDay, startTime: actStart, endTime: actEnd },
    ]);
    setActOpen(false);
    setActName("");
  };

  const deleteActivity = (id: string) => {
    setActivities((prev) => prev.filter((a) => a.id !== id));
  };

  return (
    <div>
      <h1 className="mb-6 font-display text-2xl font-bold">Schedule</h1>

      {/* School end times */}
      <div className="mb-8">
        <h2 className="mb-3 flex items-center gap-2 font-display text-lg font-semibold">
          <Clock size={18} className="text-primary" />
          School End Times
        </h2>
        <div className="grid gap-3 sm:grid-cols-5">
          {WEEKDAYS.map((day) => (
            <div key={day} className="rounded-xl border bg-card p-3">
              <Label className="text-xs text-muted-foreground">{WEEKDAY_LABELS[day]}</Label>
              <Input
                type="time"
                value={schedule.schoolEndTimes[day]}
                onChange={(e) => updateSchoolEnd(day, e.target.value)}
                className="mt-1"
              />
            </div>
          ))}
        </div>
      </div>

      {/* Bedtime */}
      <div className="mb-8">
        <h2 className="mb-3 font-display text-lg font-semibold">Bedtime</h2>
        <div className="max-w-xs rounded-xl border bg-card p-3">
          <Label className="text-xs text-muted-foreground">Study ends at</Label>
          <Input
            type="time"
            value={schedule.bedtime}
            onChange={(e) => setSchedule((prev) => ({ ...prev, bedtime: e.target.value }))}
            className="mt-1"
          />
        </div>
      </div>

      {/* Activities */}
      <div>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="font-display text-lg font-semibold">After-School Activities</h2>
          <Dialog open={actOpen} onOpenChange={setActOpen}>
            <DialogTrigger asChild>
              <Button size="sm" variant="outline" className="gap-1">
                <Plus size={14} /> Add
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-md">
              <DialogHeader>
                <DialogTitle>Add Activity</DialogTitle>
              </DialogHeader>
              <form onSubmit={addActivity} className="flex flex-col gap-4">
                <div>
                  <Label>Name</Label>
                  <Input value={actName} onChange={(e) => setActName(e.target.value)} placeholder="Soccer practice" required />
                </div>
                <div>
                  <Label>Day</Label>
                  <Select value={actDay} onValueChange={(v) => setActDay(v as Weekday)}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {WEEKDAYS.map((d) => (
                        <SelectItem key={d} value={d}>{WEEKDAY_LABELS[d]}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label>Start</Label>
                    <Input type="time" value={actStart} onChange={(e) => setActStart(e.target.value)} />
                  </div>
                  <div>
                    <Label>End</Label>
                    <Input type="time" value={actEnd} onChange={(e) => setActEnd(e.target.value)} />
                  </div>
                </div>
                <Button type="submit">Add Activity</Button>
              </form>
            </DialogContent>
          </Dialog>
        </div>

        {WEEKDAYS.map((day) => {
          const dayActivities = activities.filter((a) => a.weekday === day);
          if (dayActivities.length === 0) return null;
          return (
            <div key={day} className="mb-3">
              <h3 className="mb-1 text-sm font-medium text-muted-foreground">{WEEKDAY_LABELS[day]}</h3>
              <div className="flex flex-col gap-1">
                {dayActivities.map((act) => (
                  <div
                    key={act.id}
                    className="flex items-center justify-between rounded-lg border bg-card px-3 py-2 animate-fade-in"
                  >
                    <div>
                      <span className="text-sm font-medium">{act.name}</span>
                      <span className="ml-2 text-xs text-muted-foreground">
                        {act.startTime} – {act.endTime}
                      </span>
                    </div>
                    <button
                      onClick={() => deleteActivity(act.id)}
                      className="rounded p-1 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          );
        })}

        {activities.length === 0 && (
          <p className="py-8 text-center text-sm text-muted-foreground">No activities added yet</p>
        )}
      </div>
    </div>
  );
};

export default Schedule;
