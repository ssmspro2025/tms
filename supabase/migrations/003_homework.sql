-- ========================================
-- HOMEWORK MODULE MIGRATION
-- ========================================

-- Homework
CREATE TABLE homework (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  center_id UUID NOT NULL REFERENCES centers(id) ON DELETE CASCADE,
  created_by UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  subject VARCHAR(255) NOT NULL,
  title VARCHAR(255) NOT NULL,
  description TEXT,
  grade VARCHAR(50) NOT NULL,
  assignment_date DATE NOT NULL,
  due_date DATE NOT NULL,
  instructions TEXT,
  attachment_url TEXT,
  attachment_name VARCHAR(255),
  status VARCHAR(50) DEFAULT 'assigned', -- assigned, in_review, completed
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_homework_center_id ON homework(center_id);
CREATE INDEX idx_homework_created_by ON homework(created_by);
CREATE INDEX idx_homework_subject ON homework(subject);
CREATE INDEX idx_homework_grade ON homework(grade);
CREATE INDEX idx_homework_due_date ON homework(due_date);
CREATE INDEX idx_homework_status ON homework(status);

-- Homework Submissions
CREATE TABLE homework_submissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  homework_id UUID NOT NULL REFERENCES homework(id) ON DELETE CASCADE,
  student_id UUID NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  submission_date TIMESTAMP,
  status VARCHAR(50) DEFAULT 'pending', -- pending, submitted, checked
  submission_file_url TEXT,
  submission_file_name VARCHAR(255),
  submission_text TEXT,
  submitted_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_homework_submissions_homework_id ON homework_submissions(homework_id);
CREATE INDEX idx_homework_submissions_student_id ON homework_submissions(student_id);
CREATE INDEX idx_homework_submissions_status ON homework_submissions(status);
CREATE UNIQUE INDEX idx_homework_submissions_unique ON homework_submissions(homework_id, student_id);

-- Homework Feedback/Remarks
CREATE TABLE homework_feedback (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  submission_id UUID NOT NULL REFERENCES homework_submissions(id) ON DELETE CASCADE,
  teacher_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  marks_obtained INT,
  total_marks INT,
  remarks TEXT,
  feedback_file_url TEXT,
  feedback_file_name VARCHAR(255),
  feedback_date TIMESTAMP DEFAULT NOW(),
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_homework_feedback_submission_id ON homework_feedback(submission_id);
CREATE INDEX idx_homework_feedback_teacher_id ON homework_feedback(teacher_id);

-- Homework Attachments (supporting files)
CREATE TABLE homework_attachments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  homework_id UUID NOT NULL REFERENCES homework(id) ON DELETE CASCADE,
  file_url TEXT NOT NULL,
  file_name VARCHAR(255),
  file_type VARCHAR(50),
  file_size INT,
  uploaded_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_homework_attachments_homework_id ON homework_attachments(homework_id);
