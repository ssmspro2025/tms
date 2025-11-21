-- ========================================
-- LESSON PLANS MODULE MIGRATION
-- ========================================

-- Lesson Plans
CREATE TABLE lesson_plans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  center_id UUID NOT NULL REFERENCES centers(id) ON DELETE CASCADE,
  created_by UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  subject VARCHAR(255) NOT NULL,
  chapter VARCHAR(255) NOT NULL,
  topic VARCHAR(255) NOT NULL,
  grade VARCHAR(50) NOT NULL,
  lesson_date DATE NOT NULL,
  description TEXT,
  lesson_file_url TEXT,
  file_name VARCHAR(255),
  file_size INT,
  notes TEXT,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_lesson_plans_center_id ON lesson_plans(center_id);
CREATE INDEX idx_lesson_plans_created_by ON lesson_plans(created_by);
CREATE INDEX idx_lesson_plans_subject ON lesson_plans(subject);
CREATE INDEX idx_lesson_plans_grade ON lesson_plans(grade);
CREATE INDEX idx_lesson_plans_lesson_date ON lesson_plans(lesson_date);

-- Lesson Plan Media/Attachments
CREATE TABLE lesson_plan_media (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lesson_plan_id UUID NOT NULL REFERENCES lesson_plans(id) ON DELETE CASCADE,
  media_type VARCHAR(50) NOT NULL, -- image, video, document
  media_url TEXT NOT NULL,
  file_name VARCHAR(255),
  file_size INT,
  uploaded_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_lesson_plan_media_lesson_plan_id ON lesson_plan_media(lesson_plan_id);

-- Lesson Plan to Student Mapping (when lesson plan is taught to student)
CREATE TABLE student_lesson_records (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id UUID NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  lesson_plan_id UUID NOT NULL REFERENCES lesson_plans(id) ON DELETE CASCADE,
  taught_date DATE NOT NULL,
  completion_status VARCHAR(50) DEFAULT 'completed', -- in_progress, completed, missed
  teacher_remarks TEXT,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_student_lesson_records_student_id ON student_lesson_records(student_id);
CREATE INDEX idx_student_lesson_records_lesson_plan_id ON student_lesson_records(lesson_plan_id);
CREATE UNIQUE INDEX idx_student_lesson_records_unique ON student_lesson_records(student_id, lesson_plan_id);
