CREATE TABLE public.teacher_feature_permissions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    teacher_id UUID NOT NULL REFERENCES public.teachers(id) ON DELETE CASCADE,
    feature_name TEXT NOT NULL,
    is_enabled BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

    UNIQUE (teacher_id, feature_name)
);

ALTER TABLE public.teacher_feature_permissions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Enable read access for all users" ON public.teacher_feature_permissions
FOR SELECT USING (TRUE);

CREATE POLICY "Enable insert for authenticated users" ON public.teacher_feature_permissions
FOR INSERT WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "Enable update for authenticated users" ON public.teacher_feature_permissions
FOR UPDATE USING (auth.role() = 'authenticated');

-- Optional: Add a trigger for updated_at
CREATE TRIGGER update_teacher_feature_permissions_updated_at
BEFORE UPDATE ON public.teacher_feature_permissions
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();