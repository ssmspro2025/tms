-- Enable uuid-ossp extension if not already enabled
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Create lesson_plans table if it doesn't exist
CREATE TABLE IF NOT EXISTS public.lesson_plans (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    center_id UUID NOT NULL REFERENCES public.centers(id) ON DELETE CASCADE,
    subject TEXT NOT NULL,
    chapter TEXT NOT NULL,
    topic TEXT NOT NULL,
    lesson_date DATE NOT NULL,
    notes TEXT,
    file_url TEXT,
    media_url TEXT,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Add indexes for performance
CREATE INDEX IF NOT EXISTS idx_lesson_plans_center_id ON public.lesson_plans (center_id);
CREATE INDEX IF NOT EXISTS idx_lesson_plans_subject ON public.lesson_plans (subject);
CREATE INDEX IF NOT EXISTS idx_lesson_plans_lesson_date ON public.lesson_plans (lesson_date);

-- Enable Row Level Security
ALTER TABLE public.lesson_plans ENABLE ROW LEVEL SECURITY;

-- Policy for center users to manage their own lesson plans
DROP POLICY IF EXISTS "Allow center users to manage their lesson plans" ON public.lesson_plans;
CREATE POLICY "Allow center users to manage their lesson plans"
ON public.lesson_plans
FOR ALL
USING (
    EXISTS (
        SELECT 1
        FROM public.users
        WHERE
            users.id = auth.uid() AND
            users.role = 'center' AND
            users.center_id = lesson_plans.center_id
    )
);

-- Policy for admin to view all lesson plans
DROP POLICY IF EXISTS "Allow admin to view all lesson plans" ON public.lesson_plans;
CREATE POLICY "Allow admin to view all lesson plans"
ON public.lesson_plans
FOR SELECT
TO authenticated
USING (
    EXISTS (
        SELECT 1
        FROM public.users
        WHERE
            users.id = auth.uid() AND
            users.role = 'admin'
    )
);

-- Policy for teachers to view and manage their center's lesson plans
DROP POLICY IF EXISTS "Allow teachers to view and manage their center's lesson plans" ON public.lesson_plans;
CREATE POLICY "Allow teachers to view and manage their center's lesson plans"
ON public.lesson_plans
FOR ALL
USING (
    EXISTS (
        SELECT 1
        FROM public.users
        WHERE
            users.id = auth.uid() AND
            users.role = 'teacher' AND
            users.center_id = lesson_plans.center_id
    )
);

-- Update the student_chapters table to reference lesson_plans
-- First, check if the old foreign key constraint exists and drop it
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'student_chapters_chapter_id_fkey') THEN
        ALTER TABLE public.student_chapters DROP CONSTRAINT student_chapters_chapter_id_fkey;
    END IF;
END
$$;

-- Rename chapter_id to lesson_plan_id if it exists and is not already named lesson_plan_id
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'student_chapters' AND column_name = 'chapter_id') THEN
        ALTER TABLE public.student_chapters RENAME COLUMN chapter_id TO lesson_plan_id;
    END IF;
END
$$;

-- Add new foreign key constraint to lesson_plans
ALTER TABLE public.student_chapters
ADD CONSTRAINT student_chapters_lesson_plan_id_fkey
FOREIGN KEY (lesson_plan_id) REFERENCES public.lesson_plans(id) ON DELETE CASCADE;