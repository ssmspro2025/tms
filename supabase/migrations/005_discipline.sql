-- ========================================
-- DISCIPLINE ISSUES MODULE MIGRATION
-- ========================================

-- Discipline Issue Categories
CREATE TABLE discipline_categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  center_id UUID NOT NULL REFERENCES centers(id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL,
  description TEXT,
  default_severity VARCHAR(50), -- low, medium, high
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_discipline_categories_center_id ON discipline_categories(center_id);
CREATE UNIQUE INDEX idx_discipline_categories_name ON discipline_categories(center_id, name);

-- Discipline Issues
CREATE TABLE discipline_issues (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  center_id UUID NOT NULL REFERENCES centers(id) ON DELETE CASCADE,
  student_id UUID NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  reported_by UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  discipline_category_id UUID NOT NULL REFERENCES discipline_categories(id) ON DELETE CASCADE,
  issue_date DATE NOT NULL,
  description TEXT NOT NULL,
  severity VARCHAR(50) NOT NULL, -- low, medium, high
  incident_location VARCHAR(255),
  witnesses TEXT,
  parent_informed BOOLEAN DEFAULT false,
  parent_informed_date TIMESTAMP,
  resolved BOOLEAN DEFAULT false,
  resolved_date TIMESTAMP,
  resolution_notes TEXT,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_discipline_issues_center_id ON discipline_issues(center_id);
CREATE INDEX idx_discipline_issues_student_id ON discipline_issues(student_id);
CREATE INDEX idx_discipline_issues_reported_by ON discipline_issues(reported_by);
CREATE INDEX idx_discipline_issues_discipline_category_id ON discipline_issues(discipline_category_id);
CREATE INDEX idx_discipline_issues_issue_date ON discipline_issues(issue_date);
CREATE INDEX idx_discipline_issues_severity ON discipline_issues(severity);

-- Discipline Actions/Consequences
CREATE TABLE discipline_actions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  discipline_issue_id UUID NOT NULL REFERENCES discipline_issues(id) ON DELETE CASCADE,
  action_type VARCHAR(50) NOT NULL, -- warning, detention, suspension, parent_meeting, other
  action_description TEXT,
  action_date DATE NOT NULL,
  action_taken_by UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  due_date DATE,
  status VARCHAR(50) DEFAULT 'pending', -- pending, completed, cancelled
  evidence_document_url TEXT,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_discipline_actions_discipline_issue_id ON discipline_actions(discipline_issue_id);
CREATE INDEX idx_discipline_actions_action_taken_by ON discipline_actions(action_taken_by);
CREATE INDEX idx_discipline_actions_action_date ON discipline_actions(action_date);
CREATE INDEX idx_discipline_actions_status ON discipline_actions(status);

-- Discipline Follow-up
CREATE TABLE discipline_followups (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  discipline_issue_id UUID NOT NULL REFERENCES discipline_issues(id) ON DELETE CASCADE,
  followup_date DATE NOT NULL,
  followup_type VARCHAR(50) NOT NULL, -- parent_call, student_meeting, behavior_review
  notes TEXT,
  conducted_by UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  outcome VARCHAR(50), -- improved, unchanged, worsened
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_discipline_followups_discipline_issue_id ON discipline_followups(discipline_issue_id);
CREATE INDEX idx_discipline_followups_followup_date ON discipline_followups(followup_date);
