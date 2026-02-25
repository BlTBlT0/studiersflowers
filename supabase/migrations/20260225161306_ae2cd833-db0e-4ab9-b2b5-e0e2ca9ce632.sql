
-- Create grades table
CREATE TABLE public.grades (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  subject TEXT NOT NULL,
  grade NUMERIC(4,2) NOT NULL,
  date DATE NOT NULL DEFAULT CURRENT_DATE,
  description TEXT DEFAULT '',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.grades ENABLE ROW LEVEL SECURITY;

-- RLS policies
CREATE POLICY "Users can view own grades" ON public.grades FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can create own grades" ON public.grades FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own grades" ON public.grades FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own grades" ON public.grades FOR DELETE USING (auth.uid() = user_id);
