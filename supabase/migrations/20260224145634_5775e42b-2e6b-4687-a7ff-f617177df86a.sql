
-- Tasks table
CREATE TABLE public.tasks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  subject TEXT NOT NULL,
  due_date DATE NOT NULL,
  estimated_minutes INTEGER NOT NULL DEFAULT 30,
  priority TEXT NOT NULL DEFAULT 'medium' CHECK (priority IN ('low', 'medium', 'high')),
  completed BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Activities table
CREATE TABLE public.activities (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  weekday TEXT NOT NULL CHECK (weekday IN ('monday','tuesday','wednesday','thursday','friday')),
  start_time TIME NOT NULL,
  end_time TIME NOT NULL
);

-- Schedule settings table (one row per user)
CREATE TABLE public.schedule_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  school_end_times JSONB NOT NULL DEFAULT '{"monday":"15:30","tuesday":"15:30","wednesday":"15:30","thursday":"15:30","friday":"15:30"}'::jsonb,
  bedtime TIME NOT NULL DEFAULT '21:30',
  commute_minutes INTEGER NOT NULL DEFAULT 15
);

-- Plan blocks table
CREATE TABLE public.plan_blocks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  task_id UUID REFERENCES public.tasks(id) ON DELETE CASCADE,
  task_title TEXT NOT NULL,
  subject TEXT NOT NULL DEFAULT '',
  date DATE NOT NULL,
  start_time TIME NOT NULL,
  end_time TIME NOT NULL,
  duration_minutes INTEGER NOT NULL,
  completed BOOLEAN NOT NULL DEFAULT false,
  is_break BOOLEAN NOT NULL DEFAULT false
);

-- Time tracking table
CREATE TABLE public.time_tracking (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  task_id UUID REFERENCES public.tasks(id) ON DELETE CASCADE,
  subject TEXT NOT NULL,
  estimated_minutes INTEGER NOT NULL,
  actual_minutes INTEGER NOT NULL,
  completed_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Enable RLS on all tables
ALTER TABLE public.tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.activities ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.schedule_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.plan_blocks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.time_tracking ENABLE ROW LEVEL SECURITY;

-- RLS policies for tasks
CREATE POLICY "Users can view own tasks" ON public.tasks FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can create own tasks" ON public.tasks FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own tasks" ON public.tasks FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own tasks" ON public.tasks FOR DELETE USING (auth.uid() = user_id);

-- RLS policies for activities
CREATE POLICY "Users can view own activities" ON public.activities FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can create own activities" ON public.activities FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own activities" ON public.activities FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own activities" ON public.activities FOR DELETE USING (auth.uid() = user_id);

-- RLS policies for schedule_settings
CREATE POLICY "Users can view own settings" ON public.schedule_settings FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can create own settings" ON public.schedule_settings FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own settings" ON public.schedule_settings FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own settings" ON public.schedule_settings FOR DELETE USING (auth.uid() = user_id);

-- RLS policies for plan_blocks
CREATE POLICY "Users can view own blocks" ON public.plan_blocks FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can create own blocks" ON public.plan_blocks FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own blocks" ON public.plan_blocks FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own blocks" ON public.plan_blocks FOR DELETE USING (auth.uid() = user_id);

-- RLS policies for time_tracking
CREATE POLICY "Users can view own tracking" ON public.time_tracking FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can create own tracking" ON public.time_tracking FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own tracking" ON public.time_tracking FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own tracking" ON public.time_tracking FOR DELETE USING (auth.uid() = user_id);
