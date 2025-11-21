-- Enable necessary extensions
create extension if not exists "pgcrypto";

-- Core tables that already exist (from previous migrations)
-- We'll add the missing columns and relationships

-- Add missing columns to existing tables
alter table students add column if not exists date_of_birth date;
alter table students add column if not exists email text;
alter table students add column if not exists address text;
alter table students add column if not exists enrollment_date date default now();
alter table students add column if not exists status text default 'active';

-- Create Finance Module Tables
-- Fee Headings
create table if not exists fee_headings (
  id uuid default gen_random_uuid() primary key,
  center_id uuid references centers(id) on delete cascade,
  heading_name text not null,
  heading_code text not null,
  description text,
  is_active boolean default true,
  sort_order integer default 0,
  created_at timestamp with time zone default now(),
  updated_at timestamp with time zone default now(),
  unique(center_id, heading_code)
);

-- Fee Structures
create table if not exists fee_structures (
  id uuid default gen_random_uuid() primary key,
  center_id uuid references centers(id) on delete cascade,
  fee_heading_id uuid references fee_headings(id) on delete cascade,
  grade text not null,
  amount decimal(10,2) not null,
  academic_year text not null,
  effective_from date not null,
  effective_to date,
  is_active boolean default true,
  created_at timestamp with time zone default now(),
  updated_at timestamp with time zone default now(),
  unique(center_id, fee_heading_id, grade, academic_year)
);

-- Student Fee Assignments
create table if not exists student_fee_assignments (
  id uuid default gen_random_uuid() primary key,
  student_id uuid references students(id) on delete cascade,
  fee_heading_id uuid references fee_headings(id) on delete cascade,
  fee_structure_id uuid references fee_structures(id) on delete cascade,
  amount decimal(10,2) not null,
  academic_year text not null,
  is_active boolean default true,
  assigned_date date default now(),
  created_at timestamp with time zone default now()
);

-- Invoices
create table if not exists invoices (
  id uuid default gen_random_uuid() primary key,
  center_id uuid references centers(id) on delete cascade,
  student_id uuid references students(id) on delete cascade,
  invoice_number text not null,
  invoice_month integer not null,
  invoice_year integer not null,
  invoice_date date not null,
  due_date date not null,
  total_amount decimal(10,2) not null default 0,
  paid_amount decimal(10,2) not null default 0,
  status text not null default 'draft', -- draft, issued, partial, paid, overdue, cancelled
  academic_year text not null,
  notes text,
  created_at timestamp with time zone default now(),
  updated_at timestamp with time zone default now(),
  unique(invoice_number)
);

-- Invoice Items
create table if not exists invoice_items (
  id uuid default gen_random_uuid() primary key,
  invoice_id uuid references invoices(id) on delete cascade,
  fee_heading_id uuid references fee_headings(id),
  description text not null,
  quantity integer not null default 1,
  unit_amount decimal(10,2) not null,
  total_amount decimal(10,2) not null,
  created_at timestamp with time zone default now()
);

-- Payments
create table if not exists payments (
  id uuid default gen_random_uuid() primary key,
  center_id uuid references centers(id) on delete cascade,
  student_id uuid references students(id) on delete cascade,
  invoice_id uuid references invoices(id) on delete set null,
  payment_date date not null,
  amount_paid decimal(10,2) not null,
  payment_method text not null, -- cash, cheque, bank_transfer, upi, card, wallet, other
  reference_number text,
  notes text,
  received_by_user_id uuid references users(id),
  created_at timestamp with time zone default now(),
  updated_at timestamp with time zone default now()
);

-- Payment Allocations (for partial payments)
create table if not exists payment_allocations (
  id uuid default gen_random_uuid() primary key,
  payment_id uuid references payments(id) on delete cascade,
  invoice_id uuid references invoices(id) on delete cascade,
  allocated_amount decimal(10,2) not null,
  created_at timestamp with time zone default now()
);

-- Ledger Entries
create table if not exists ledger_entries (
  id uuid default gen_random_uuid() primary key,
  center_id uuid references centers(id) on delete cascade,
  transaction_date date not null,
  transaction_type text not null, -- fee_invoice, payment_received, expense, refund, adjustment, bank_charge, other
  reference_type text, -- invoice, payment, expense
  reference_id uuid, -- id of the referenced record
  account_code text not null,
  account_name text not null,
  debit_amount decimal(10,2) not null default 0,
  credit_amount decimal(10,2) not null default 0,
  running_balance decimal(12,2),
  description text,
  created_by_user_id uuid references users(id),
  created_at timestamp with time zone default now()
);

-- Expenses
create table if not exists expenses (
  id uuid default gen_random_uuid() primary key,
  center_id uuid references centers(id) on delete cascade,
  expense_category text not null, -- salaries, rent, utilities, materials, maintenance, transport, admin, other
  description text not null,
  amount decimal(10,2) not null,
  expense_date date not null,
  payment_method text, -- cash, cheque, bank_transfer, card, other
  reference_number text,
  approved_by_user_id uuid references users(id),
  is_approved boolean default false,
  notes text,
  created_by_user_id uuid references users(id),
  created_at timestamp with time zone default now(),
  updated_at timestamp with time zone default now()
);

-- Financial Summaries
create table if not exists financial_summaries (
  id uuid default gen_random_uuid() primary key,
  center_id uuid references centers(id) on delete cascade,
  summary_month integer not null,
  summary_year integer not null,
  total_invoiced decimal(12,2) not null default 0,
  total_collected decimal(12,2) not null default 0,
  total_outstanding decimal(12,2) not null default 0,
  total_expenses decimal(12,2) not null default 0,
  net_balance decimal(12,2) not null default 0,
  generated_at timestamp with time zone default now(),
  last_updated timestamp with time zone default now(),
  unique(center_id, summary_month, summary_year)
);

-- Lesson Plans Module
create table if not exists lesson_plans (
  id uuid default gen_random_uuid() primary key,
  center_id uuid references centers(id) on delete cascade,
  subject text not null,
  chapter text not null,
  topic text not null,
  grade text,
  lesson_date date not null,
  description text,
  notes text,
  lesson_file_url text,
  file_name text,
  file_size integer,
  is_active boolean default true,
  created_by uuid references users(id),
  created_at timestamp with time zone default now(),
  updated_at timestamp with time zone default now()
);

-- Student Lesson Records
create table if not exists student_lesson_records (
  id uuid default gen_random_uuid() primary key,
  student_id uuid references students(id) on delete cascade,
  lesson_plan_id uuid references lesson_plans(id) on delete cascade,
  taught_date date not null,
  completion_status text default 'not_started', -- not_started, in_progress, completed
  teacher_remarks text,
  created_at timestamp with time zone default now(),
  updated_at timestamp with time zone default now()
);

-- Homework Module
create table if not exists homework (
  id uuid default gen_random_uuid() primary key,
  center_id uuid references centers(id) on delete cascade,
  subject text not null,
  title text not null,
  description text,
  grade text,
  assignment_date date not null,
  due_date date not null,
  attachment_url text,
  attachment_name text,
  status text default 'assigned', -- assigned, in_progress, completed
  created_by uuid references users(id),
  created_at timestamp with time zone default now(),
  updated_at timestamp with time zone default now()
);

-- Student Homework Records
create table if not exists student_homework_records (
  id uuid default gen_random_uuid() primary key,
  homework_id uuid references homework(id) on delete cascade,
  student_id uuid references students(id) on delete cascade,
  submission_date date,
  status text default 'assigned', -- assigned, submitted, checked, completed
  teacher_remarks text,
  teacher_rating integer, -- 1-5 stars
  created_at timestamp with time zone default now(),
  updated_at timestamp with time zone default now()
);

-- Activity Types
create table if not exists activity_types (
  id uuid default gen_random_uuid() primary key,
  center_id uuid references centers(id) on delete cascade,
  name text not null,
  description text,
  is_active boolean default true,
  created_at timestamp with time zone default now(),
  updated_at timestamp with time zone default now()
);

-- Activities
create table if not exists activities (
  id uuid default gen_random_uuid() primary key,
  center_id uuid references centers(id) on delete cascade,
  activity_type_id uuid references activity_types(id) on delete cascade,
  title text not null,
  description text,
  activity_date date not null,
  duration_minutes integer,
  grade text,
  notes text,
  created_by uuid references users(id),
  is_active boolean default true,
  created_at timestamp with time zone default now(),
  updated_at timestamp with time zone default now()
);

-- Student Activity Records
create table if not exists student_activity_records (
  id uuid default gen_random_uuid() primary key,
  activity_id uuid references activities(id) on delete cascade,
  student_id uuid references students(id) on delete cascade,
  involvement_rating integer, -- 1-5 stars
  teacher_notes text,
  media_urls text[], -- Array of media URLs
  created_at timestamp with time zone default now()
);

-- Discipline Categories
create table if not exists discipline_categories (
  id uuid default gen_random_uuid() primary key,
  center_id uuid references centers(id) on delete cascade,
  name text not null,
  description text,
  default_severity text default 'minor', -- minor, moderate, major, severe
  is_active boolean default true,
  created_at timestamp with time zone default now(),
  updated_at timestamp with time zone default now()
);

-- Discipline Issues
create table if not exists discipline_issues (
  id uuid default gen_random_uuid() primary key,
  center_id uuid references centers(id) on delete cascade,
  student_id uuid references students(id) on delete cascade,
  discipline_category_id uuid references discipline_categories(id) on delete cascade,
  issue_date date not null,
  description text not null,
  severity text not null, -- minor, moderate, major, severe
  incident_location text,
  witnesses text,
  action_taken text,
  action_date date,
  resolved boolean default false,
  reported_by uuid references users(id),
  created_at timestamp with time zone default now(),
  updated_at timestamp with time zone default now()
);

-- Storage buckets
insert into storage.buckets (id, name, public) 
values 
  ('lesson-plan-files', 'lesson-plan-files', false),
  ('homework-files', 'homework-files', false),
  ('activity-media', 'activity-media', false)
on conflict (id) do nothing;

-- RLS Policies
-- Finance tables
alter table fee_headings enable row level security;
alter table fee_structures enable row level security;
alter table student_fee_assignments enable row level security;
alter table invoices enable row level security;
alter table invoice_items enable row level security;
alter table payments enable row level security;
alter table payment_allocations enable row level security;
alter table ledger_entries enable row level security;
alter table expenses enable row level security;
alter table financial_summaries enable row level security;

-- Lesson plan tables
alter table lesson_plans enable row level security;
alter table student_lesson_records enable row level security;

-- Homework tables
alter table homework enable row level security;
alter table student_homework_records enable row level security;

-- Activity tables
alter table activity_types enable row level security;
alter table activities enable row level security;
alter table student_activity_records enable row level security;

-- Discipline tables
alter table discipline_categories enable row level security;
alter table discipline_issues enable row level security;

-- Finance RLS Policies
create policy "Users can view fee headings for their center" on fee_headings
  for select using (center_id = (select center_id from users where id = auth.uid()));

create policy "Users can insert fee headings for their center" on fee_headings
  for insert with check (center_id = (select center_id from users where id = auth.uid()));

create policy "Users can update fee headings for their center" on fee_headings
  for update using (center_id = (select center_id from users where id = auth.uid()));

create policy "Users can delete fee headings for their center" on fee_headings
  for delete using (center_id = (select center_id from users where id = auth.uid()));

-- Similar policies for other finance tables
create policy "Users can view fee structures for their center" on fee_structures
  for select using (center_id = (select center_id from users where id = auth.uid()));

create policy "Users can view student fee assignments for their center" on student_fee_assignments
  for select using (exists (select 1 from students s where s.id = student_id and s.center_id = (select center_id from users where id = auth.uid())));

create policy "Users can view invoices for their center" on invoices
  for select using (center_id = (select center_id from users where id = auth.uid()));

create policy "Users can view payments for their center" on payments
  for select using (center_id = (select center_id from users where id = auth.uid()));

create policy "Users can view expenses for their center" on expenses
  for select using (center_id = (select center_id from users where id = auth.uid()));

create policy "Users can view financial summaries for their center" on financial_summaries
  for select using (center_id = (select center_id from users where id = auth.uid()));

-- Lesson Plan RLS Policies
create policy "Users can view lesson plans for their center" on lesson_plans
  for select using (center_id = (select center_id from users where id = auth.uid()));

create policy "Users can insert lesson plans for their center" on lesson_plans
  for insert with check (center_id = (select center_id from users where id = auth.uid()));

create policy "Users can update lesson plans for their center" on lesson_plans
  for update using (center_id = (select center_id from users where id = auth.uid()));

create policy "Users can delete lesson plans for their center" on lesson_plans
  for delete using (center_id = (select center_id from users where id = auth.uid()));

-- Student Lesson Records RLS Policies
create policy "Users can view student lesson records for their center" on student_lesson_records
  for select using (exists (select 1 from students s where s.id = student_id and s.center_id = (select center_id from users where id = auth.uid())));

-- Homework RLS Policies
create policy "Users can view homework for their center" on homework
  for select using (center_id = (select center_id from users where id = auth.uid()));

create policy "Users can insert homework for their center" on homework
  for insert with check (center_id = (select center_id from users where id = auth.uid()));

create policy "Users can update homework for their center" on homework
  for update using (center_id = (select center_id from users where id = auth.uid()));

-- Student Homework Records RLS Policies
create policy "Users can view student homework records for their center" on student_homework_records
  for select using (exists (select 1 from students s where s.id = student_id and s.center_id = (select center_id from users where id = auth.uid())));

-- Activity RLS Policies
create policy "Users can view activity types for their center" on activity_types
  for select using (center_id = (select center_id from users where id = auth.uid()));

create policy "Users can insert activity types for their center" on activity_types
  for insert with check (center_id = (select center_id from users where id = auth.uid()));

create policy "Users can view activities for their center" on activities
  for select using (center_id = (select center_id from users where id = auth.uid()));

create policy "Users can insert activities for their center" on activities
  for insert with check (center_id = (select center_id from users where id = auth.uid()));

create policy "Users can view student activity records for their center" on student_activity_records
  for select using (exists (select 1 from students s where s.id = student_id and s.center_id = (select center_id from users where id = auth.uid())));

-- Discipline RLS Policies
create policy "Users can view discipline categories for their center" on discipline_categories
  for select using (center_id = (select center_id from users where id = auth.uid()));

create policy "Users can insert discipline categories for their center" on discipline_categories
  for insert with check (center_id = (select center_id from users where id = auth.uid()));

create policy "Users can view discipline issues for their center" on discipline_issues
  for select using (center_id = (select center_id from users where id = auth.uid()));

create policy "Users can insert discipline issues for their center" on discipline_issues
  for insert with check (center_id = (select center_id from users where id = auth.uid()));

-- Indexes for performance
create index if not exists idx_fee_headings_center on fee_headings(center_id);
create index if not exists idx_fee_structures_center on fee_structures(center_id);
create index if not exists idx_student_fee_assignments_student on student_fee_assignments(student_id);
create index if not exists idx_invoices_center on invoices(center_id);
create index if not exists idx_invoices_student on invoices(student_id);
create index if not exists idx_payments_center on payments(center_id);
create index if not exists idx_payments_student on payments(student_id);
create index if not exists idx_ledger_entries_center on ledger_entries(center_id);
create index if not exists idx_expenses_center on expenses(center_id);
create index if not exists idx_lesson_plans_center on lesson_plans(center_id);
create index if not exists idx_student_lesson_records_student on student_lesson_records(student_id);
create index if not exists idx_homework_center on homework(center_id);
create index if not exists idx_student_homework_records_homework on student_homework_records(homework_id);
create index if not exists idx_activities_center on activities(center_id);
create index if not exists idx_student_activity_records_activity on student_activity_records(activity_id);
create index if not exists idx_discipline_issues_center on discipline_issues(center_id);
create index if not exists idx_discipline_issues_student on discipline_issues(student_id);