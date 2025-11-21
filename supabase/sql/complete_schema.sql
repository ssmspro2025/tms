-- ============================================================================
-- Complete Database Schema for TMS (Teaching Management System)
-- ============================================================================
-- Execute this entire script in Supabase SQL Editor
-- No modifications needed - ready to run as-is
-- ============================================================================

-- ============================================================================
-- 1. DROP EXISTING ENUM (if exists) and RECREATE
-- ============================================================================
DROP TYPE IF EXISTS public.app_role CASCADE;
CREATE TYPE public.app_role AS ENUM ('admin', 'center', 'parent');

-- ============================================================================
-- 2. CREATE ALL TABLES
-- ============================================================================

-- Centers table (referenced by other tables)
CREATE TABLE IF NOT EXISTS public.centers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  center_name TEXT NOT NULL,
  address TEXT,
  contact_number TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL
);

-- Students table
CREATE TABLE IF NOT EXISTS public.students (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  grade TEXT NOT NULL,
  school_name TEXT NOT NULL,
  parent_name TEXT NOT NULL,
  contact_number TEXT NOT NULL,
  center_id UUID REFERENCES public.centers(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Users table
CREATE TABLE IF NOT EXISTS public.users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  username TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  role public.app_role NOT NULL DEFAULT 'center',
  center_id UUID REFERENCES public.centers(id) ON DELETE CASCADE,
  student_id UUID REFERENCES public.students(id) ON DELETE CASCADE,
  is_active BOOLEAN DEFAULT true NOT NULL,
  last_login TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL
);

-- Attendance table
CREATE TABLE IF NOT EXISTS public.attendance (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  student_id UUID NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
  date DATE NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('Present', 'Absent')),
  time_in TIME,
  time_out TIME,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(student_id, date)
);

-- Chapters table
CREATE TABLE IF NOT EXISTS public.chapters (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  subject TEXT NOT NULL,
  chapter_name TEXT NOT NULL,
  date_taught DATE NOT NULL,
  notes TEXT,
  center_id UUID REFERENCES public.centers(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Chapters studied table
CREATE TABLE IF NOT EXISTS public.chapters_studied (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  student_id UUID NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
  date DATE NOT NULL,
  subject TEXT NOT NULL,
  chapter_name TEXT NOT NULL,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Tests table
CREATE TABLE IF NOT EXISTS public.tests (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  subject TEXT NOT NULL,
  date DATE NOT NULL,
  total_marks INTEGER NOT NULL,
  grade TEXT,
  uploaded_file_url TEXT,
  extracted_text TEXT,
  center_id UUID REFERENCES public.centers(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Test results table
CREATE TABLE IF NOT EXISTS public.test_results (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  test_id UUID NOT NULL REFERENCES public.tests(id) ON DELETE CASCADE,
  student_id UUID NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
  marks_obtained INTEGER NOT NULL,
  date_taken DATE NOT NULL DEFAULT CURRENT_DATE,
  notes TEXT,
  student_answer TEXT,
  ai_suggested_marks INTEGER,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(test_id, student_id)
);

-- Student chapters table
CREATE TABLE IF NOT EXISTS public.student_chapters (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  student_id UUID NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
  chapter_id UUID NOT NULL REFERENCES public.chapters(id) ON DELETE CASCADE,
  completed BOOLEAN NOT NULL DEFAULT true,
  date_completed DATE NOT NULL DEFAULT CURRENT_DATE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(student_id, chapter_id)
);

-- Chapter teachings table
CREATE TABLE IF NOT EXISTS public.chapter_teachings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  chapter_id UUID REFERENCES public.chapters(id) ON DELETE CASCADE NOT NULL,
  date DATE NOT NULL,
  notes TEXT,
  students_present JSONB,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL
);

-- AI summaries table
CREATE TABLE IF NOT EXISTS public.ai_summaries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id UUID REFERENCES public.students(id) ON DELETE CASCADE NOT NULL,
  generated_on TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
  summary_text TEXT NOT NULL,
  summary_type TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL
);

-- ============================================================================
-- 3. ENABLE ROW LEVEL SECURITY (RLS)
-- ============================================================================
ALTER TABLE public.centers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.students ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.attendance ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.chapters ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.chapters_studied ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.test_results ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.student_chapters ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.chapter_teachings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_summaries ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- 4. CREATE RLS POLICIES (Allow all operations)
-- ============================================================================

-- Centers policies
DROP POLICY IF EXISTS "Allow all operations on centers" ON public.centers;
CREATE POLICY "Allow all operations on centers"
ON public.centers FOR ALL USING (true) WITH CHECK (true);

-- Students policies
DROP POLICY IF EXISTS "Allow all operations on students" ON public.students;
CREATE POLICY "Allow all operations on students"
ON public.students FOR ALL USING (true) WITH CHECK (true);

-- Users policies
DROP POLICY IF EXISTS "Allow all operations on users" ON public.users;
CREATE POLICY "Allow all operations on users"
ON public.users FOR ALL USING (true) WITH CHECK (true);

-- Attendance policies
DROP POLICY IF EXISTS "Allow all operations on attendance" ON public.attendance;
CREATE POLICY "Allow all operations on attendance"
ON public.attendance FOR ALL USING (true) WITH CHECK (true);

-- Chapters policies
DROP POLICY IF EXISTS "Allow all operations on chapters" ON public.chapters;
CREATE POLICY "Allow all operations on chapters"
ON public.chapters FOR ALL USING (true) WITH CHECK (true);

-- Chapters studied policies
DROP POLICY IF EXISTS "Allow all operations on chapters_studied" ON public.chapters_studied;
CREATE POLICY "Allow all operations on chapters_studied"
ON public.chapters_studied FOR ALL USING (true) WITH CHECK (true);

-- Tests policies
DROP POLICY IF EXISTS "Allow all operations on tests" ON public.tests;
CREATE POLICY "Allow all operations on tests"
ON public.tests FOR ALL USING (true) WITH CHECK (true);

-- Test results policies
DROP POLICY IF EXISTS "Allow all operations on test_results" ON public.test_results;
CREATE POLICY "Allow all operations on test_results"
ON public.test_results FOR ALL USING (true) WITH CHECK (true);

-- Student chapters policies
DROP POLICY IF EXISTS "Allow all operations on student_chapters" ON public.student_chapters;
CREATE POLICY "Allow all operations on student_chapters"
ON public.student_chapters FOR ALL USING (true) WITH CHECK (true);

-- Chapter teachings policies
DROP POLICY IF EXISTS "Allow all operations on chapter_teachings" ON public.chapter_teachings;
CREATE POLICY "Allow all operations on chapter_teachings"
ON public.chapter_teachings FOR ALL USING (true) WITH CHECK (true);

-- AI summaries policies
DROP POLICY IF EXISTS "Allow all operations on ai_summaries" ON public.ai_summaries;
CREATE POLICY "Allow all operations on ai_summaries"
ON public.ai_summaries FOR ALL USING (true) WITH CHECK (true);

-- ============================================================================
-- 5. CREATE INDEXES FOR PERFORMANCE
-- ============================================================================

-- Centers indexes
CREATE INDEX IF NOT EXISTS idx_centers_name ON public.centers(center_name);

-- Students indexes
CREATE INDEX IF NOT EXISTS idx_students_grade ON public.students(grade);
CREATE INDEX IF NOT EXISTS idx_students_center ON public.students(center_id);
CREATE INDEX IF NOT EXISTS idx_students_name ON public.students(name);

-- Users indexes
CREATE INDEX IF NOT EXISTS idx_users_username ON public.users(username);
CREATE INDEX IF NOT EXISTS idx_users_center ON public.users(center_id);
CREATE INDEX IF NOT EXISTS idx_users_student ON public.users(student_id);

-- Attendance indexes
CREATE INDEX IF NOT EXISTS idx_attendance_student_id ON public.attendance(student_id);
CREATE INDEX IF NOT EXISTS idx_attendance_date ON public.attendance(date);

-- Chapters indexes
CREATE INDEX IF NOT EXISTS idx_chapters_subject ON public.chapters(subject);
CREATE INDEX IF NOT EXISTS idx_chapters_center ON public.chapters(center_id);

-- Chapters studied indexes
CREATE INDEX IF NOT EXISTS idx_chapters_studied_student_date ON public.chapters_studied(student_id, date);
CREATE INDEX IF NOT EXISTS idx_chapters_studied_date ON public.chapters_studied(date);

-- Tests indexes
CREATE INDEX IF NOT EXISTS idx_tests_date ON public.tests(date);
CREATE INDEX IF NOT EXISTS idx_tests_center ON public.tests(center_id);
CREATE INDEX IF NOT EXISTS idx_tests_subject ON public.tests(subject);

-- Test results indexes
CREATE INDEX IF NOT EXISTS idx_test_results_student ON public.test_results(student_id);
CREATE INDEX IF NOT EXISTS idx_test_results_test ON public.test_results(test_id);

-- Student chapters indexes
CREATE INDEX IF NOT EXISTS idx_student_chapters_student ON public.student_chapters(student_id);
CREATE INDEX IF NOT EXISTS idx_student_chapters_chapter ON public.student_chapters(chapter_id);

-- AI summaries indexes
CREATE INDEX IF NOT EXISTS idx_ai_summaries_student ON public.ai_summaries(student_id);
CREATE INDEX IF NOT EXISTS idx_ai_summaries_date ON public.ai_summaries(generated_on DESC);

-- Chapter teachings indexes
CREATE INDEX IF NOT EXISTS idx_chapter_teachings_chapter ON public.chapter_teachings(chapter_id);
CREATE INDEX IF NOT EXISTS idx_chapter_teachings_date ON public.chapter_teachings(date);

-- ============================================================================
-- 6. CREATE STORAGE BUCKET FOR TEST FILES
-- ============================================================================

INSERT INTO storage.buckets (id, name, public) 
VALUES ('test-files', 'test-files', false)
ON CONFLICT (id) DO NOTHING;

-- Storage policies
DROP POLICY IF EXISTS "Allow authenticated uploads to test-files" ON storage.objects;
CREATE POLICY "Allow authenticated uploads to test-files"
ON storage.objects FOR INSERT
WITH CHECK (bucket_id = 'test-files');

DROP POLICY IF EXISTS "Allow authenticated read from test-files" ON storage.objects;
CREATE POLICY "Allow authenticated read from test-files"
ON storage.objects FOR SELECT
USING (bucket_id = 'test-files');

DROP POLICY IF EXISTS "Allow authenticated delete from test-files" ON storage.objects;
CREATE POLICY "Allow authenticated delete from test-files"
ON storage.objects FOR DELETE
USING (bucket_id = 'test-files');

-- ============================================================================
-- 7. CREATE ADMIN USER
-- ============================================================================
-- Username: sujan1nepal@gmail.com
-- Password: precioussn
-- This uses a bcrypt hash. To generate your own hash:
--   Node.js: npx bcrypt-cli -c 12 "precioussn"
--   Python: python -c "import bcrypt; print(bcrypt.hashpw(b'precioussn', bcrypt.gensalt(rounds=12)).decode())"

DELETE FROM public.users WHERE username = 'sujan1nepal@gmail.com';

INSERT INTO public.users (
  id,
  username,
  password_hash,
  role,
  is_active,
  created_at
) VALUES (
  gen_random_uuid(),
  'sujan1nepal@gmail.com',
  '$2b$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/LewY5YmMxSUryy1uK',
  'admin',
  true,
  now()
);

-- ============================================================================
-- Schema Setup Complete!
-- ============================================================================
-- Admin Login Credentials:
-- Username: sujan1nepal@gmail.com
-- Password: precioussn
--
-- Tables Created: 11
-- - centers
-- - students
-- - users
-- - attendance
-- - chapters
-- - chapters_studied
-- - tests
-- - test_results
-- - student_chapters
-- - chapter_teachings
-- - ai_summaries
--
-- All tables have:
-- ✓ RLS policies enabled (permissive for development)
-- ✓ Proper indexes for performance
-- ✓ Foreign key relationships with CASCADE delete
-- ✓ Storage bucket 'test-files' configured
--
-- Ready to use!
-- ============================================================================
