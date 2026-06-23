
-- Add missing columns to tasks
ALTER TABLE public.tasks
  ADD COLUMN IF NOT EXISTS priority_mode text NOT NULL DEFAULT 'automatic',
  ADD COLUMN IF NOT EXISTS task_type text NOT NULL DEFAULT 'homework',
  ADD COLUMN IF NOT EXISTS is_missing boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS smart_planning_enabled boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS priority_score integer,
  ADD COLUMN IF NOT EXISTS priority_explanation text;

-- Add missing columns to plan_blocks
ALTER TABLE public.plan_blocks
  ADD COLUMN IF NOT EXISTS is_locked boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS is_manual boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS smart_explanation text,
  ADD COLUMN IF NOT EXISTS weather_impact jsonb;

-- Add missing columns to schedule_settings
ALTER TABLE public.schedule_settings
  ADD COLUMN IF NOT EXISTS smart_priority_enabled boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS grade_based_planning_enabled boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS weekday_study_start time NOT NULL DEFAULT '16:00',
  ADD COLUMN IF NOT EXISTS weekday_study_end time NOT NULL DEFAULT '21:30',
  ADD COLUMN IF NOT EXISTS weekend_study_start time NOT NULL DEFAULT '10:00',
  ADD COLUMN IF NOT EXISTS weekend_study_end time NOT NULL DEFAULT '18:00',
  ADD COLUMN IF NOT EXISTS wake_time time NOT NULL DEFAULT '07:00',
  ADD COLUMN IF NOT EXISTS max_study_minutes_per_day integer NOT NULL DEFAULT 90,
  ADD COLUMN IF NOT EXISTS break_length_minutes integer NOT NULL DEFAULT 10,
  ADD COLUMN IF NOT EXISTS outdoor_preference text NOT NULL DEFAULT 'balanced',
  ADD COLUMN IF NOT EXISTS weather_planning_enabled boolean NOT NULL DEFAULT false;

-- Add missing columns to grades for duplicate detection
ALTER TABLE public.grades
  ADD COLUMN IF NOT EXISTS description text DEFAULT '';

-- Create subjects table (referenced in useSupabaseData)
CREATE TABLE IF NOT EXISTS public.subjects (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  name text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, name)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.subjects TO authenticated;
GRANT ALL ON public.subjects TO service_role;

ALTER TABLE public.subjects ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  CREATE POLICY "Users manage own subjects" ON public.subjects
    FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- final_grades table for Magister import (per earlier feature)
CREATE TABLE IF NOT EXISTS public.final_grades (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  subject text NOT NULL,
  grade numeric NOT NULL,
  period text,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.final_grades TO authenticated;
GRANT ALL ON public.final_grades TO service_role;

ALTER TABLE public.final_grades ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  CREATE POLICY "Users manage own final grades" ON public.final_grades
    FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
