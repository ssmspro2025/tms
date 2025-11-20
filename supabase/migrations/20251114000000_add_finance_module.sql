-- ============================================================================
-- FINANCE MODULE - Comprehensive Database Schema
-- ============================================================================
-- This migration adds a complete finance system for the TMS including:
-- - Fee management (headings, structures, assignments)
-- - Invoice generation and tracking
-- - Payment processing and tracking
-- - Ledger entries for accounting
-- - Expense management
-- - Financial reports

-- ============================================================================
-- 1. FEE HEADINGS TABLE
-- ============================================================================
-- Master list of all fee types (e.g., Tuition, Transport, Exam Fee, etc.)
CREATE TABLE IF NOT EXISTS public.fee_headings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  center_id UUID NOT NULL REFERENCES public.centers(id) ON DELETE CASCADE,
  heading_name TEXT NOT NULL,
  heading_code TEXT NOT NULL,
  description TEXT,
  is_active BOOLEAN DEFAULT true NOT NULL,
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
  UNIQUE(center_id, heading_code)
);

-- ============================================================================
-- 2. FEE STRUCTURES TABLE
-- ============================================================================
-- Defines fee amounts for each grade (e.g., Grade 1 Tuition = 5000)
CREATE TABLE IF NOT EXISTS public.fee_structures (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  center_id UUID NOT NULL REFERENCES public.centers(id) ON DELETE CASCADE,
  fee_heading_id UUID NOT NULL REFERENCES public.fee_headings(id) ON DELETE CASCADE,
  grade TEXT NOT NULL,
  amount DECIMAL(10, 2) NOT NULL,
  academic_year TEXT NOT NULL,
  effective_from DATE NOT NULL,
  effective_to DATE,
  is_active BOOLEAN DEFAULT true NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
  UNIQUE(center_id, fee_heading_id, grade, academic_year)
);

-- ============================================================================
-- 3. STUDENT FEES ASSIGNMENT TABLE
-- ============================================================================
-- Tracks which fee structures are assigned to which students
CREATE TABLE IF NOT EXISTS public.student_fee_assignments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id UUID NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
  fee_heading_id UUID NOT NULL REFERENCES public.fee_headings(id) ON DELETE CASCADE,
  fee_structure_id UUID NOT NULL REFERENCES public.fee_structures(id) ON DELETE CASCADE,
  amount DECIMAL(10, 2) NOT NULL,
  academic_year TEXT NOT NULL,
  is_active BOOLEAN DEFAULT true NOT NULL,
  assigned_date DATE NOT NULL DEFAULT CURRENT_DATE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
  UNIQUE(student_id, fee_heading_id, academic_year)
);

-- ============================================================================
-- 4. INVOICES TABLE
-- ============================================================================
-- Monthly invoices generated for students
CREATE TABLE IF NOT EXISTS public.invoices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  center_id UUID NOT NULL REFERENCES public.centers(id) ON DELETE CASCADE,
  student_id UUID NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
  invoice_number TEXT NOT NULL,
  invoice_month INTEGER NOT NULL,
  invoice_year INTEGER NOT NULL,
  invoice_date DATE NOT NULL DEFAULT CURRENT_DATE,
  due_date DATE NOT NULL,
  total_amount DECIMAL(12, 2) NOT NULL,
  paid_amount DECIMAL(12, 2) DEFAULT 0 NOT NULL,
  status TEXT DEFAULT 'draft' CHECK (status IN ('draft', 'issued', 'partial', 'paid', 'overdue', 'cancelled')),
  academic_year TEXT NOT NULL,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
  UNIQUE(center_id, invoice_number),
  UNIQUE(student_id, invoice_month, invoice_year)
);

-- ============================================================================
-- 5. INVOICE ITEMS TABLE
-- ============================================================================
-- Individual line items in each invoice
CREATE TABLE IF NOT EXISTS public.invoice_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_id UUID NOT NULL REFERENCES public.invoices(id) ON DELETE CASCADE,
  fee_heading_id UUID NOT NULL REFERENCES public.fee_headings(id) ON DELETE CASCADE,
  description TEXT NOT NULL,
  quantity INTEGER DEFAULT 1,
  unit_amount DECIMAL(10, 2) NOT NULL,
  total_amount DECIMAL(12, 2) NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL
);

-- ============================================================================
-- 6. PAYMENTS TABLE
-- ============================================================================
-- Track all payments received from parents/students
CREATE TABLE IF NOT EXISTS public.payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  center_id UUID NOT NULL REFERENCES public.centers(id) ON DELETE CASCADE,
  student_id UUID NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
  invoice_id UUID REFERENCES public.invoices(id) ON DELETE SET NULL,
  payment_date DATE NOT NULL DEFAULT CURRENT_DATE,
  amount_paid DECIMAL(12, 2) NOT NULL,
  payment_method TEXT NOT NULL CHECK (payment_method IN ('cash', 'cheque', 'bank_transfer', 'upi', 'card', 'wallet', 'other')),
  reference_number TEXT,
  notes TEXT,
  received_by_user_id UUID REFERENCES public.users(id) ON DELETE SET NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL
);

-- ============================================================================
-- 7. LEDGER ENTRIES TABLE (Double-Entry Accounting)
-- ============================================================================
-- Comprehensive ledger for all financial transactions
CREATE TABLE IF NOT EXISTS public.ledger_entries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  center_id UUID NOT NULL REFERENCES public.centers(id) ON DELETE CASCADE,
  transaction_date DATE NOT NULL DEFAULT CURRENT_DATE,
  transaction_type TEXT NOT NULL CHECK (transaction_type IN ('fee_invoice', 'payment_received', 'expense', 'refund', 'adjustment', 'bank_charge', 'other')),
  reference_type TEXT,
  reference_id UUID,
  account_code TEXT NOT NULL,
  account_name TEXT NOT NULL,
  debit_amount DECIMAL(12, 2) DEFAULT 0,
  credit_amount DECIMAL(12, 2) DEFAULT 0,
  running_balance DECIMAL(12, 2),
  description TEXT,
  created_by_user_id UUID REFERENCES public.users(id) ON DELETE SET NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
  CONSTRAINT valid_entry CHECK (
    (debit_amount > 0 AND credit_amount = 0) OR 
    (credit_amount > 0 AND debit_amount = 0) OR
    (debit_amount = 0 AND credit_amount = 0)
  )
);

-- ============================================================================
-- 8. EXPENSES TABLE
-- ============================================================================
-- Track center-level expenses
CREATE TABLE IF NOT EXISTS public.expenses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  center_id UUID NOT NULL REFERENCES public.centers(id) ON DELETE CASCADE,
  expense_category TEXT NOT NULL CHECK (expense_category IN ('salaries', 'rent', 'utilities', 'materials', 'maintenance', 'transport', 'admin', 'other')),
  description TEXT NOT NULL,
  amount DECIMAL(12, 2) NOT NULL,
  expense_date DATE NOT NULL DEFAULT CURRENT_DATE,
  payment_method TEXT CHECK (payment_method IN ('cash', 'cheque', 'bank_transfer', 'card', 'other')),
  reference_number TEXT,
  approved_by_user_id UUID REFERENCES public.users(id) ON DELETE SET NULL,
  is_approved BOOLEAN DEFAULT false,
  notes TEXT,
  created_by_user_id UUID REFERENCES public.users(id) ON DELETE SET NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL
);

-- ============================================================================
-- 9. FINANCIAL REPORTS TABLE (Cached Summary)
-- ============================================================================
-- Pre-calculated financial summaries for quick access
CREATE TABLE IF NOT EXISTS public.financial_summaries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  center_id UUID NOT NULL REFERENCES public.centers(id) ON DELETE CASCADE,
  summary_month INTEGER NOT NULL,
  summary_year INTEGER NOT NULL,
  total_invoiced DECIMAL(12, 2) DEFAULT 0,
  total_collected DECIMAL(12, 2) DEFAULT 0,
  total_outstanding DECIMAL(12, 2) DEFAULT 0,
  total_expenses DECIMAL(12, 2) DEFAULT 0,
  net_balance DECIMAL(12, 2) DEFAULT 0,
  generated_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
  last_updated TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
  UNIQUE(center_id, summary_month, summary_year)
);

-- ============================================================================
-- 10. PAYMENT ALLOCATIONS TABLE (for partial payments)
-- ============================================================================
-- Track how payments are allocated to multiple invoices
CREATE TABLE IF NOT EXISTS public.payment_allocations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  payment_id UUID NOT NULL REFERENCES public.payments(id) ON DELETE CASCADE,
  invoice_id UUID NOT NULL REFERENCES public.invoices(id) ON DELETE CASCADE,
  allocated_amount DECIMAL(12, 2) NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- ============================================================================
-- 11. ENABLE ROW LEVEL SECURITY
-- ============================================================================
ALTER TABLE public.fee_headings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.fee_structures ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.student_fee_assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.invoices ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.invoice_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ledger_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.expenses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.financial_summaries ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payment_allocations ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- 12. CREATE RLS POLICIES
-- ============================================================================

-- Fee Headings - Allow all operations
DROP POLICY IF EXISTS "Allow all operations on fee_headings" ON public.fee_headings;
CREATE POLICY "Allow all operations on fee_headings"
ON public.fee_headings FOR ALL USING (true) WITH CHECK (true);

-- Fee Structures - Allow all operations
DROP POLICY IF EXISTS "Allow all operations on fee_structures" ON public.fee_structures;
CREATE POLICY "Allow all operations on fee_structures"
ON public.fee_structures FOR ALL USING (true) WITH CHECK (true);

-- Student Fee Assignments - Allow all operations
DROP POLICY IF EXISTS "Allow all operations on student_fee_assignments" ON public.student_fee_assignments;
CREATE POLICY "Allow all operations on student_fee_assignments"
ON public.student_fee_assignments FOR ALL USING (true) WITH CHECK (true);

-- Invoices - Allow all operations
DROP POLICY IF EXISTS "Allow all operations on invoices" ON public.invoices;
CREATE POLICY "Allow all operations on invoices"
ON public.invoices FOR ALL USING (true) WITH CHECK (true);

-- Invoice Items - Allow all operations
DROP POLICY IF EXISTS "Allow all operations on invoice_items" ON public.invoice_items;
CREATE POLICY "Allow all operations on invoice_items"
ON public.invoice_items FOR ALL USING (true) WITH CHECK (true);

-- Payments - Allow all operations
DROP POLICY IF EXISTS "Allow all operations on payments" ON public.payments;
CREATE POLICY "Allow all operations on payments"
ON public.payments FOR ALL USING (true) WITH CHECK (true);

-- Ledger Entries - Allow all operations
DROP POLICY IF EXISTS "Allow all operations on ledger_entries" ON public.ledger_entries;
CREATE POLICY "Allow all operations on ledger_entries"
ON public.ledger_entries FOR ALL USING (true) WITH CHECK (true);

-- Expenses - Allow all operations
DROP POLICY IF EXISTS "Allow all operations on expenses" ON public.expenses;
CREATE POLICY "Allow all operations on expenses"
ON public.expenses FOR ALL USING (true) WITH CHECK (true);

-- Financial Summaries - Allow all operations
DROP POLICY IF EXISTS "Allow all operations on financial_summaries" ON public.financial_summaries;
CREATE POLICY "Allow all operations on financial_summaries"
ON public.financial_summaries FOR ALL USING (true) WITH CHECK (true);

-- Payment Allocations - Allow all operations
DROP POLICY IF EXISTS "Allow all operations on payment_allocations" ON public.payment_allocations;
CREATE POLICY "Allow all operations on payment_allocations"
ON public.payment_allocations FOR ALL USING (true) WITH CHECK (true);

-- ============================================================================
-- 13. CREATE INDEXES FOR PERFORMANCE
-- ============================================================================

-- Fee Headings indexes
CREATE INDEX IF NOT EXISTS idx_fee_headings_center ON public.fee_headings(center_id);
CREATE INDEX IF NOT EXISTS idx_fee_headings_active ON public.fee_headings(center_id, is_active);

-- Fee Structures indexes
CREATE INDEX IF NOT EXISTS idx_fee_structures_center ON public.fee_structures(center_id);
CREATE INDEX IF NOT EXISTS idx_fee_structures_heading ON public.fee_structures(fee_heading_id);
CREATE INDEX IF NOT EXISTS idx_fee_structures_grade ON public.fee_structures(grade);
CREATE INDEX IF NOT EXISTS idx_fee_structures_year ON public.fee_structures(academic_year);

-- Student Fee Assignments indexes
CREATE INDEX IF NOT EXISTS idx_student_fee_assignments_student ON public.student_fee_assignments(student_id);
CREATE INDEX IF NOT EXISTS idx_student_fee_assignments_heading ON public.student_fee_assignments(fee_heading_id);
CREATE INDEX IF NOT EXISTS idx_student_fee_assignments_year ON public.student_fee_assignments(academic_year);

-- Invoices indexes
CREATE INDEX IF NOT EXISTS idx_invoices_center ON public.invoices(center_id);
CREATE INDEX IF NOT EXISTS idx_invoices_student ON public.invoices(student_id);
CREATE INDEX IF NOT EXISTS idx_invoices_status ON public.invoices(status);
CREATE INDEX IF NOT EXISTS idx_invoices_date ON public.invoices(invoice_date);
CREATE INDEX IF NOT EXISTS idx_invoices_month_year ON public.invoices(invoice_month, invoice_year);
CREATE INDEX IF NOT EXISTS idx_invoices_due_date ON public.invoices(due_date);

-- Invoice Items indexes
CREATE INDEX IF NOT EXISTS idx_invoice_items_invoice ON public.invoice_items(invoice_id);
CREATE INDEX IF NOT EXISTS idx_invoice_items_heading ON public.invoice_items(fee_heading_id);

-- Payments indexes
CREATE INDEX IF NOT EXISTS idx_payments_center ON public.payments(center_id);
CREATE INDEX IF NOT EXISTS idx_payments_student ON public.payments(student_id);
CREATE INDEX IF NOT EXISTS idx_payments_invoice ON public.payments(invoice_id);
CREATE INDEX IF NOT EXISTS idx_payments_date ON public.payments(payment_date);
CREATE INDEX IF NOT EXISTS idx_payments_method ON public.payments(payment_method);

-- Ledger indexes
CREATE INDEX IF NOT EXISTS idx_ledger_center ON public.ledger_entries(center_id);
CREATE INDEX IF NOT EXISTS idx_ledger_date ON public.ledger_entries(transaction_date);
CREATE INDEX IF NOT EXISTS idx_ledger_type ON public.ledger_entries(transaction_type);
CREATE INDEX IF NOT EXISTS idx_ledger_account ON public.ledger_entries(account_code);
CREATE INDEX IF NOT EXISTS idx_ledger_reference ON public.ledger_entries(reference_type, reference_id);

-- Expenses indexes
CREATE INDEX IF NOT EXISTS idx_expenses_center ON public.expenses(center_id);
CREATE INDEX IF NOT EXISTS idx_expenses_category ON public.expenses(expense_category);
CREATE INDEX IF NOT EXISTS idx_expenses_date ON public.expenses(expense_date);
CREATE INDEX IF NOT EXISTS idx_expenses_approved ON public.expenses(is_approved);

-- Financial Summaries indexes
CREATE INDEX IF NOT EXISTS idx_financial_summaries_center ON public.financial_summaries(center_id);
CREATE INDEX IF NOT EXISTS idx_financial_summaries_period ON public.financial_summaries(summary_month, summary_year);

-- Payment Allocations indexes
CREATE INDEX IF NOT EXISTS idx_payment_allocations_payment ON public.payment_allocations(payment_id);
CREATE INDEX IF NOT EXISTS idx_payment_allocations_invoice ON public.payment_allocations(invoice_id);

-- ============================================================================
-- FINANCE MODULE SCHEMA COMPLETE
-- ============================================================================
