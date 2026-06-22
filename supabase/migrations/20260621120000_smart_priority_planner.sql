-- Smart Priority Planner: additive, backward-compatible schema changes.

CREATE TABLE public.subjects (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, name)
);

ALTER TABLE public.subjects ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own subjects"
  ON public.subjects FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can create own subjects"
  ON public.subjects FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own subjects"
  ON public.subjects FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own subjects"
  ON public.subjects FOR DELETE USING (auth.uid() = user_id);

INSERT INTO public.subjects (user_id, name)
SELECT DISTINCT user_id, subject FROM public.tasks WHERE subject <> ''
ON CONFLICT (user_id, name) DO NOTHING;

INSERT INTO public.subjects (user_id, name)
SELECT DISTINCT user_id, subject FROM public.grades WHERE subject <> ''
ON CONFLICT (user_id, name) DO NOTHING;

ALTER TABLE public.tasks
  ADD COLUMN task_type TEXT NOT NULL DEFAULT 'homework'
    CHECK (task_type IN ('homework', 'test', 'project', 'revision')),
  ADD COLUMN is_missing BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN priority_mode TEXT NOT NULL DEFAULT 'automatic'
    CHECK (priority_mode IN ('automatic', 'low', 'medium', 'high')),
  ADD COLUMN priority_score INTEGER NOT NULL DEFAULT 50
    CHECK (priority_score BETWEEN 1 AND 100),
  ADD COLUMN priority_explanation TEXT NOT NULL DEFAULT '',
  ADD COLUMN smart_planning_enabled BOOLEAN NOT NULL DEFAULT true;

-- Old priority choices were explicitly selected by users, so retain them.
UPDATE public.tasks
SET
  priority_mode = priority,
  priority_score = CASE priority
    WHEN 'low' THEN 25
    WHEN 'high' THEN 85
    ELSE 55
  END;

ALTER TABLE public.plan_blocks
  ADD COLUMN is_locked BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN is_manual BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN smart_explanation TEXT NOT NULL DEFAULT '',
  ADD COLUMN weather_impact JSONB;

ALTER TABLE public.schedule_settings
  ADD COLUMN smart_priority_enabled BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN grade_based_planning_enabled BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN weather_planning_enabled BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN weekday_study_start TIME NOT NULL DEFAULT '16:00',
  ADD COLUMN weekday_study_end TIME NOT NULL DEFAULT '21:30',
  ADD COLUMN weekend_study_start TIME NOT NULL DEFAULT '10:00',
  ADD COLUMN weekend_study_end TIME NOT NULL DEFAULT '18:00',
  ADD COLUMN wake_time TIME NOT NULL DEFAULT '07:00',
  ADD COLUMN max_study_minutes_per_day INTEGER NOT NULL DEFAULT 90
    CHECK (max_study_minutes_per_day BETWEEN 15 AND 480),
  ADD COLUMN break_length_minutes INTEGER NOT NULL DEFAULT 10
    CHECK (break_length_minutes BETWEEN 5 AND 60),
  ADD COLUMN outdoor_preference TEXT NOT NULL DEFAULT 'balanced'
    CHECK (outdoor_preference IN ('low', 'balanced', 'high'));

ALTER TABLE public.activities DROP CONSTRAINT IF EXISTS activities_weekday_check;
ALTER TABLE public.activities
  ADD CONSTRAINT activities_weekday_check
  CHECK (weekday IN (
    'monday', 'tuesday', 'wednesday', 'thursday',
    'friday', 'saturday', 'sunday'
  ));
