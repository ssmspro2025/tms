-- ========================================
-- FINANCE MODULE MIGRATION
-- ========================================

-- Fee Categories/Headings
CREATE TABLE fee_headings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  center_id UUID NOT NULL REFERENCES centers(id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL,
  description TEXT,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_fee_headings_center_id ON fee_headings(center_id);

-- Fee Structure Template (Grade-wise)
CREATE TABLE fee_structures (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  center_id UUID NOT NULL REFERENCES centers(id) ON DELETE CASCADE,
  grade VARCHAR(50) NOT NULL,
  name VARCHAR(255) NOT NULL,
  description TEXT,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_fee_structures_center_id ON fee_structures(center_id);
CREATE INDEX idx_fee_structures_grade ON fee_structures(grade);
CREATE UNIQUE INDEX idx_fee_structures_center_grade ON fee_structures(center_id, grade);

-- Fee Structure Items (linking headings to structures with amounts)
CREATE TABLE fee_structure_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  fee_structure_id UUID NOT NULL REFERENCES fee_structures(id) ON DELETE CASCADE,
  fee_heading_id UUID NOT NULL REFERENCES fee_headings(id) ON DELETE CASCADE,
  amount DECIMAL(10, 2) NOT NULL,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_fee_structure_items_fee_structure_id ON fee_structure_items(fee_structure_id);
CREATE INDEX idx_fee_structure_items_fee_heading_id ON fee_structure_items(fee_heading_id);

-- Student Fee Structure Assignment (override per student)
CREATE TABLE student_fee_assignments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id UUID NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  fee_structure_id UUID NOT NULL REFERENCES fee_structures(id) ON DELETE CASCADE,
  assigned_date TIMESTAMP DEFAULT NOW(),
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_student_fee_assignments_student_id ON student_fee_assignments(student_id);
CREATE INDEX idx_student_fee_assignments_fee_structure_id ON student_fee_assignments(fee_structure_id);
CREATE UNIQUE INDEX idx_student_fee_assignments_unique ON student_fee_assignments(student_id);

-- Student Custom Fee Items (for overrides at student level)
CREATE TABLE student_custom_fees (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id UUID NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  fee_heading_id UUID NOT NULL REFERENCES fee_headings(id) ON DELETE CASCADE,
  amount DECIMAL(10, 2) NOT NULL,
  effective_from DATE,
  effective_to DATE,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_student_custom_fees_student_id ON student_custom_fees(student_id);
CREATE INDEX idx_student_custom_fees_fee_heading_id ON student_custom_fees(fee_heading_id);

-- Invoices
CREATE TABLE invoices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  center_id UUID NOT NULL REFERENCES centers(id) ON DELETE CASCADE,
  student_id UUID NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  invoice_number VARCHAR(50) UNIQUE NOT NULL,
  invoice_date DATE NOT NULL,
  due_date DATE NOT NULL,
  status VARCHAR(50) DEFAULT 'due', -- due, paid, partial, overdue
  total_amount DECIMAL(10, 2) NOT NULL,
  paid_amount DECIMAL(10, 2) DEFAULT 0,
  remaining_amount DECIMAL(10, 2) NOT NULL,
  late_fee DECIMAL(10, 2) DEFAULT 0,
  notes TEXT,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_invoices_center_id ON invoices(center_id);
CREATE INDEX idx_invoices_student_id ON invoices(student_id);
CREATE INDEX idx_invoices_status ON invoices(status);
CREATE INDEX idx_invoices_due_date ON invoices(due_date);
CREATE INDEX idx_invoices_invoice_date ON invoices(invoice_date);

-- Invoice Items (line items on invoice)
CREATE TABLE invoice_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_id UUID NOT NULL REFERENCES invoices(id) ON DELETE CASCADE,
  fee_heading_id UUID NOT NULL REFERENCES fee_headings(id) ON DELETE CASCADE,
  amount DECIMAL(10, 2) NOT NULL,
  quantity INT DEFAULT 1,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_invoice_items_invoice_id ON invoice_items(invoice_id);
CREATE INDEX idx_invoice_items_fee_heading_id ON invoice_items(fee_heading_id);

-- Payments
CREATE TABLE payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  center_id UUID NOT NULL REFERENCES centers(id) ON DELETE CASCADE,
  student_id UUID NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  invoice_id UUID REFERENCES invoices(id) ON DELETE CASCADE,
  reference_number VARCHAR(100),
  payment_date DATE NOT NULL,
  amount DECIMAL(10, 2) NOT NULL,
  payment_method VARCHAR(50) NOT NULL, -- cash, check, online, bank_transfer
  payment_status VARCHAR(50) DEFAULT 'completed', -- pending, completed, failed, refunded
  notes TEXT,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_payments_center_id ON payments(center_id);
CREATE INDEX idx_payments_student_id ON payments(student_id);
CREATE INDEX idx_payments_invoice_id ON payments(invoice_id);
CREATE INDEX idx_payments_payment_date ON payments(payment_date);

-- Ledger Entries (for accounting)
CREATE TABLE ledger_entries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  center_id UUID NOT NULL REFERENCES centers(id) ON DELETE CASCADE,
  student_id UUID REFERENCES students(id) ON DELETE CASCADE,
  entry_type VARCHAR(50) NOT NULL, -- invoice, payment, expense, refund
  reference_id UUID,
  reference_table VARCHAR(100),
  amount DECIMAL(10, 2) NOT NULL,
  entry_date DATE NOT NULL,
  description TEXT,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_ledger_entries_center_id ON ledger_entries(center_id);
CREATE INDEX idx_ledger_entries_student_id ON ledger_entries(student_id);
CREATE INDEX idx_ledger_entries_entry_date ON ledger_entries(entry_date);
CREATE INDEX idx_ledger_entries_entry_type ON ledger_entries(entry_type);

-- Expense Categories
CREATE TABLE expense_categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  center_id UUID NOT NULL REFERENCES centers(id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL,
  description TEXT,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_expense_categories_center_id ON expense_categories(center_id);
CREATE UNIQUE INDEX idx_expense_categories_name ON expense_categories(center_id, name);

-- Expenses
CREATE TABLE expenses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  center_id UUID NOT NULL REFERENCES centers(id) ON DELETE CASCADE,
  expense_category_id UUID NOT NULL REFERENCES expense_categories(id) ON DELETE CASCADE,
  expense_date DATE NOT NULL,
  amount DECIMAL(10, 2) NOT NULL,
  description TEXT,
  reference_number VARCHAR(100),
  payment_method VARCHAR(50),
  created_by UUID REFERENCES users(id),
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_expenses_center_id ON expenses(center_id);
CREATE INDEX idx_expenses_expense_category_id ON expenses(expense_category_id);
CREATE INDEX idx_expenses_expense_date ON expenses(expense_date);

-- Auto-generate invoices monthly (tracking table)
CREATE TABLE invoice_generation_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  center_id UUID NOT NULL REFERENCES centers(id) ON DELETE CASCADE,
  generation_date DATE NOT NULL,
  invoices_generated INT,
  status VARCHAR(50), -- success, failed, partial
  error_message TEXT,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_invoice_generation_logs_center_id ON invoice_generation_logs(center_id);
CREATE INDEX idx_invoice_generation_logs_generation_date ON invoice_generation_logs(generation_date);
