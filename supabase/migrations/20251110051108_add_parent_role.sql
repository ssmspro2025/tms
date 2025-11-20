-- Add 'parent' role to app_role enum
ALTER TYPE public.app_role ADD VALUE 'parent';

-- Add student_id column to users table if not exists
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS student_id UUID REFERENCES public.students(id) ON DELETE CASCADE;
