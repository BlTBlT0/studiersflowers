import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "./useAuth";
import { toast } from "sonner";
import type { Tables, TablesInsert, TablesUpdate } from "@/integrations/supabase/types";

// ---- TASKS ----
export type DbTask = Tables<"tasks">;

export function useTasks() {
  const { user } = useAuth();
  return useQuery({
    queryKey: ["tasks", user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("tasks")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as DbTask[];
    },
    enabled: !!user,
  });
}

export function useTaskMutations() {
  const qc = useQueryClient();
  const { user } = useAuth();

  const addTask = useMutation({
    mutationFn: async (task: Omit<TablesInsert<"tasks">, "user_id">) => {
      const { error } = await supabase.from("tasks").insert({ ...task, user_id: user!.id });
      if (error) throw error;
      await supabase.from("subjects").upsert(
        { name: task.subject, user_id: user!.id },
        { onConflict: "user_id,name" }
      );
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["tasks"] }),
    onError: (e) => toast.error(e.message),
  });

  const updateTask = useMutation({
    mutationFn: async ({ id, ...updates }: TablesUpdate<"tasks"> & { id: string }) => {
      const { error } = await supabase.from("tasks").update(updates).eq("id", id);
      if (error) throw error;
      if (updates.subject) {
        await supabase.from("subjects").upsert(
          { name: updates.subject, user_id: user!.id },
          { onConflict: "user_id,name" }
        );
      }
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["tasks"] }),
    onError: (e) => toast.error(e.message),
  });

  const deleteTask = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("tasks").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["tasks"] }),
    onError: (e) => toast.error(e.message),
  });

  const applyTaskScores = useMutation({
    mutationFn: async (updates: Array<TablesUpdate<"tasks"> & { id: string }>) => {
      const results = await Promise.all(
        updates.map(({ id, ...values }) => supabase.from("tasks").update(values).eq("id", id))
      );
      const failed = results.find((result) => result.error);
      if (failed?.error) throw failed.error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["tasks"] }),
    onError: (e) => toast.error(e.message),
  });

  return { addTask, updateTask, deleteTask, applyTaskScores };
}

// ---- SUBJECTS ----
export type DbSubject = Tables<"subjects">;

export function useSubjects() {
  const { user } = useAuth();
  return useQuery({
    queryKey: ["subjects", user?.id],
    queryFn: async () => {
      const { data, error } = await supabase.from("subjects").select("*").order("name");
      if (error) throw error;
      return data as DbSubject[];
    },
    enabled: !!user,
  });
}

export function useSubjectMutations() {
  const qc = useQueryClient();
  const { user } = useAuth();

  const addSubject = useMutation({
    mutationFn: async (name: string) => {
      const { error } = await supabase
        .from("subjects")
        .upsert({ name: name.trim(), user_id: user!.id }, { onConflict: "user_id,name" });
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["subjects"] }),
    onError: (e) => toast.error(e.message),
  });

  const deleteSubject = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("subjects").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["subjects"] }),
    onError: (e) => toast.error(e.message),
  });

  return { addSubject, deleteSubject };
}

// ---- ACTIVITIES ----
export type DbActivity = Tables<"activities">;

export function useActivities() {
  const { user } = useAuth();
  return useQuery({
    queryKey: ["activities", user?.id],
    queryFn: async () => {
      const { data, error } = await supabase.from("activities").select("*");
      if (error) throw error;
      return data as DbActivity[];
    },
    enabled: !!user,
  });
}

export function useActivityMutations() {
  const qc = useQueryClient();
  const { user } = useAuth();

  const addActivity = useMutation({
    mutationFn: async (act: Omit<TablesInsert<"activities">, "user_id">) => {
      const { error } = await supabase.from("activities").insert({ ...act, user_id: user!.id });
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["activities"] }),
    onError: (e) => toast.error(e.message),
  });

  const deleteActivity = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("activities").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["activities"] }),
    onError: (e) => toast.error(e.message),
  });

  return { addActivity, deleteActivity };
}

// ---- SCHEDULE SETTINGS ----
export type DbScheduleSettings = Tables<"schedule_settings">;

export function useScheduleSettings() {
  const { user } = useAuth();
  return useQuery({
    queryKey: ["schedule_settings", user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("schedule_settings")
        .select("*")
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    enabled: !!user,
  });
}

export function useScheduleSettingsMutations() {
  const qc = useQueryClient();
  const { user } = useAuth();

  const upsertSettings = useMutation({
    mutationFn: async (settings: Omit<TablesInsert<"schedule_settings">, "user_id">) => {
      const { error } = await supabase
        .from("schedule_settings")
        .upsert({ ...settings, user_id: user!.id }, { onConflict: "user_id" });
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["schedule_settings"] }),
    onError: (e) => toast.error(e.message),
  });

  return { upsertSettings };
}

// ---- PLAN BLOCKS ----
export type DbPlanBlock = Tables<"plan_blocks">;

export function usePlanBlocks() {
  const { user } = useAuth();
  return useQuery({
    queryKey: ["plan_blocks", user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("plan_blocks")
        .select("*")
        .order("date")
        .order("start_time");
      if (error) throw error;
      return data as DbPlanBlock[];
    },
    enabled: !!user,
  });
}

export function usePlanBlockMutations() {
  const qc = useQueryClient();
  const { user } = useAuth();

  const savePlan = useMutation({
    mutationFn: async (blocks: Omit<TablesInsert<"plan_blocks">, "user_id">[]) => {
      const today = new Date().toISOString().slice(0, 10);
      // Regeneration only replaces future generated work. User decisions remain intact.
      const { error: delError } = await supabase
        .from("plan_blocks")
        .delete()
        .eq("user_id", user!.id)
        .eq("is_locked", false)
        .eq("is_manual", false)
        .eq("completed", false)
        .gte("date", today);
      if (delError) throw delError;
      if (blocks.length > 0) {
        const { error } = await supabase
          .from("plan_blocks")
          .insert(blocks.map((b) => ({ ...b, user_id: user!.id })));
        if (error) throw error;
      }
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["plan_blocks"] }),
    onError: (e) => toast.error(e.message),
  });

  const updateBlock = useMutation({
    mutationFn: async ({ id, ...updates }: TablesUpdate<"plan_blocks"> & { id: string }) => {
      const { error } = await supabase.from("plan_blocks").update(updates).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["plan_blocks"] }),
    onError: (e) => toast.error(e.message),
  });

  const addBlock = useMutation({
    mutationFn: async (block: Omit<TablesInsert<"plan_blocks">, "user_id">) => {
      const { error } = await supabase
        .from("plan_blocks")
        .insert({ ...block, user_id: user!.id });
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["plan_blocks"] }),
    onError: (e) => toast.error(e.message),
  });

  return { savePlan, updateBlock, addBlock };
}

// ---- TIME TRACKING ----
export type DbTimeTracking = Tables<"time_tracking">;

export function useTimeTracking() {
  const { user } = useAuth();
  return useQuery({
    queryKey: ["time_tracking", user?.id],
    queryFn: async () => {
      const { data, error } = await supabase.from("time_tracking").select("*");
      if (error) throw error;
      return data as DbTimeTracking[];
    },
    enabled: !!user,
  });
}

export function useTimeTrackingMutations() {
  const qc = useQueryClient();
  const { user } = useAuth();

  const addTracking = useMutation({
    mutationFn: async (entry: Omit<TablesInsert<"time_tracking">, "user_id">) => {
      const { error } = await supabase.from("time_tracking").insert({ ...entry, user_id: user!.id });
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["time_tracking"] }),
    onError: (e) => toast.error(e.message),
  });

  return { addTracking };
}

// ---- GRADES ----
export type DbGrade = Tables<"grades">;

export function useGrades(finalOnly?: boolean) {
  const { user } = useAuth();
  return useQuery({
    queryKey: ["grades", user?.id, finalOnly ? "final" : "regular"],
    queryFn: async () => {
      let query = supabase
        .from("grades")
        .select("*")
        .order("date", { ascending: false });
      
      if (finalOnly === true) {
        query = query.eq("is_final_grade", true);
      } else if (finalOnly === false) {
        query = query.eq("is_final_grade", false);
      }
      
      const { data, error } = await query;
      if (error) throw error;
      return data as DbGrade[];
    },
    enabled: !!user,
  });
}

export function useGradeMutations() {
  const qc = useQueryClient();
  const { user } = useAuth();

  const addGrade = useMutation({
    mutationFn: async (grade: Omit<TablesInsert<"grades">, "user_id">) => {
      const { error } = await supabase.from("grades").insert({ ...grade, user_id: user!.id });
      if (error) throw error;
      await supabase.from("subjects").upsert(
        { name: grade.subject, user_id: user!.id },
        { onConflict: "user_id,name" }
      );
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["grades"] });
      toast.success("Cijfer opgeslagen");
    },
    onError: (e) => toast.error(e.message),
  });

  const deleteGrade = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("grades").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["grades"] }),
    onError: (e) => toast.error(e.message),
  });

  const updateGrade = useMutation({
    mutationFn: async ({ id, ...updates }: TablesUpdate<"grades"> & { id: string }) => {
      const { error } = await supabase.from("grades").update(updates).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["grades"] });
      toast.success("Cijfer bijgewerkt");
    },
    onError: (e) => toast.error(e.message),
  });

  return { addGrade, updateGrade, deleteGrade };
}

// Helper: get average actual minutes per subject from tracking data
export function getSubjectAverages(tracking: DbTimeTracking[]): Record<string, number> {
  const bySubject: Record<string, { total: number; count: number }> = {};
  for (const t of tracking) {
    if (!bySubject[t.subject]) bySubject[t.subject] = { total: 0, count: 0 };
    bySubject[t.subject].total += t.actual_minutes;
    bySubject[t.subject].count++;
  }
  const result: Record<string, number> = {};
  for (const [subj, { total, count }] of Object.entries(bySubject)) {
    result[subj] = Math.round(total / count);
  }
  return result;
}
