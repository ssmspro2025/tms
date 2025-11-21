-- ========================================
-- PRESCHOOL ACTIVITIES MODULE MIGRATION
-- ========================================

-- Activity Types/Categories
CREATE TABLE activity_types (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  center_id UUID NOT NULL REFERENCES centers(id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL,
  description TEXT,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_activity_types_center_id ON activity_types(center_id);
CREATE UNIQUE INDEX idx_activity_types_name ON activity_types(center_id, name);

-- Activities
CREATE TABLE activities (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  center_id UUID NOT NULL REFERENCES centers(id) ON DELETE CASCADE,
  activity_type_id UUID NOT NULL REFERENCES activity_types(id) ON DELETE CASCADE,
  created_by UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title VARCHAR(255) NOT NULL,
  description TEXT,
  activity_date DATE NOT NULL,
  duration_minutes INT,
  grade VARCHAR(50),
  photo_url TEXT,
  video_url TEXT,
  notes TEXT,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_activities_center_id ON activities(center_id);
CREATE INDEX idx_activities_activity_type_id ON activities(activity_type_id);
CREATE INDEX idx_activities_created_by ON activities(created_by);
CREATE INDEX idx_activities_activity_date ON activities(activity_date);
CREATE INDEX idx_activities_grade ON activities(grade);

-- Student Activity Participation
CREATE TABLE student_activities (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  activity_id UUID NOT NULL REFERENCES activities(id) ON DELETE CASCADE,
  student_id UUID NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  participation_rating VARCHAR(50), -- excellent, good, fair, needs_improvement
  involvement_score INT CHECK (involvement_score >= 1 AND involvement_score <= 5), -- 1-5 rating
  teacher_notes TEXT,
  completed BOOLEAN DEFAULT true,
  attended_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_student_activities_activity_id ON student_activities(activity_id);
CREATE INDEX idx_student_activities_student_id ON student_activities(student_id);
CREATE UNIQUE INDEX idx_student_activities_unique ON student_activities(activity_id, student_id);

-- Activity Media (photos, videos)
CREATE TABLE activity_media (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  activity_id UUID NOT NULL REFERENCES activities(id) ON DELETE CASCADE,
  media_type VARCHAR(50) NOT NULL, -- photo, video
  media_url TEXT NOT NULL,
  file_name VARCHAR(255),
  file_size INT,
  uploaded_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_activity_media_activity_id ON activity_media(activity_id);
