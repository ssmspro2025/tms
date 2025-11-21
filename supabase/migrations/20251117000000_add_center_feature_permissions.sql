CREATE TABLE public.center_feature_permissions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    center_id UUID NOT NULL REFERENCES public.centers(id) ON DELETE CASCADE,
    feature_name TEXT NOT NULL,
    is_enabled BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

    UNIQUE (center_id, feature_name)
);

ALTER TABLE public.center_feature_permissions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Enable read access for all users" ON public.center_feature_permissions
FOR SELECT USING (TRUE);

CREATE POLICY "Enable insert for authenticated users" ON public.center_feature_permissions
FOR INSERT WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "Enable update for authenticated users" ON public.center_feature_permissions
FOR UPDATE USING (auth.role() = 'authenticated');

-- Optional: Add a trigger for updated_at
CREATE TRIGGER update_center_feature_permissions_updated_at
BEFORE UPDATE ON public.center_feature_permissions
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Seed initial default permissions for existing centers
INSERT INTO public.center_feature_permissions (center_id, feature_name, is_enabled)
SELECT
    c.id,
    unnest(ARRAY[
        'register_student',
        'take_attendance',
        'attendance_summary',
        'lesson_plans',
        'lesson_tracking',
        'homework',
        'activities',
        'discipline',
        'teachers',
        'teacher_attendance',
        'tests',
        'student_report',
        'ai_insights',
        'view_records',
        'summary',
        'finance'
    ]) AS feature,
    TRUE
FROM public.centers c
ON CONFLICT (center_id, feature_name) DO NOTHING;