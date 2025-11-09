-- Create AI summaries table
CREATE TABLE IF NOT EXISTS public.ai_summaries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id UUID REFERENCES public.students(id) ON DELETE CASCADE NOT NULL,
  generated_on TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
  summary_text TEXT NOT NULL,
  summary_type TEXT NOT NULL, -- 'performance', 'insights', etc.
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL
);

-- Enable RLS
ALTER TABLE public.ai_summaries ENABLE ROW LEVEL SECURITY;

-- Create policy
CREATE POLICY "Allow all operations on ai_summaries"
ON public.ai_summaries
FOR ALL
USING (true)
WITH CHECK (true);

-- Add index for faster queries
CREATE INDEX idx_ai_summaries_student ON public.ai_summaries(student_id);
CREATE INDEX idx_ai_summaries_date ON public.ai_summaries(generated_on DESC);

-- Add ai_suggested_marks column to test_results
ALTER TABLE public.test_results 
ADD COLUMN IF NOT EXISTS ai_suggested_marks INTEGER,
ADD COLUMN IF NOT EXISTS student_answer TEXT;