-- Create tests table
CREATE TABLE public.tests (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  subject TEXT NOT NULL,
  date DATE NOT NULL,
  total_marks INTEGER NOT NULL,
  grade TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create test_results table
CREATE TABLE public.test_results (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  test_id UUID NOT NULL REFERENCES public.tests(id) ON DELETE CASCADE,
  student_id UUID NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
  marks_obtained INTEGER NOT NULL,
  date_taken DATE NOT NULL DEFAULT CURRENT_DATE,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(test_id, student_id)
);

-- Create chapters master table
CREATE TABLE public.chapters (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  subject TEXT NOT NULL,
  chapter_name TEXT NOT NULL,
  date_taught DATE NOT NULL,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create student_chapters linking table
CREATE TABLE public.student_chapters (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  student_id UUID NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
  chapter_id UUID NOT NULL REFERENCES public.chapters(id) ON DELETE CASCADE,
  completed BOOLEAN NOT NULL DEFAULT true,
  date_completed DATE NOT NULL DEFAULT CURRENT_DATE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(student_id, chapter_id)
);

-- Enable RLS on all tables
ALTER TABLE public.tests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.test_results ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.chapters ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.student_chapters ENABLE ROW LEVEL SECURITY;

-- Create policies
CREATE POLICY "Allow all operations on tests"
ON public.tests FOR ALL USING (true) WITH CHECK (true);

CREATE POLICY "Allow all operations on test_results"
ON public.test_results FOR ALL USING (true) WITH CHECK (true);

CREATE POLICY "Allow all operations on chapters"
ON public.chapters FOR ALL USING (true) WITH CHECK (true);

CREATE POLICY "Allow all operations on student_chapters"
ON public.student_chapters FOR ALL USING (true) WITH CHECK (true);

-- Create indexes
CREATE INDEX idx_test_results_student ON public.test_results(student_id);
CREATE INDEX idx_test_results_test ON public.test_results(test_id);
CREATE INDEX idx_student_chapters_student ON public.student_chapters(student_id);
CREATE INDEX idx_student_chapters_chapter ON public.student_chapters(chapter_id);
CREATE INDEX idx_chapters_subject ON public.chapters(subject);
CREATE INDEX idx_tests_date ON public.tests(date);

-- Create storage bucket for test files
INSERT INTO storage.buckets (id, name, public) VALUES ('test-files', 'test-files', false);

-- Create storage policies
CREATE POLICY "Allow authenticated uploads to test-files"
ON storage.objects FOR INSERT
WITH CHECK (bucket_id = 'test-files');

CREATE POLICY "Allow authenticated read from test-files"
ON storage.objects FOR SELECT
USING (bucket_id = 'test-files');

CREATE POLICY "Allow authenticated delete from test-files"
ON storage.objects FOR DELETE
USING (bucket_id = 'test-files');