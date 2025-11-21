// ============================================================================
// FINANCE MODULE TYPES
// ============================================================================

export type FeeHeading = {
  id: string;
  center_id: string;
  heading_name: string;
  heading_code: string;
  description?: string;
  is_active: boolean;
  sort_order: number;
  created_at: string;
  updated_at: string;
};

export type FeeStructure = {
  id: string;
  center_id: string;
  fee_heading_id: string;
  grade: string;
  amount: number;
  academic_year: string;
  effective_from: string;
  effective_to?: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
};

export type StudentFeeAssignment = {
  id: string;
  student_id: string;
  fee_heading_id: string;
  fee_structure_id: string;
  amount: number;
  academic_year: string;
  is_active: boolean;
  assigned_date: string;
  created_at: string;
};

export type InvoiceStatus = 'draft' | 'issued' | 'partial' | 'paid' | 'overdue' | 'cancelled';

export type Invoice = {
  id: string;
  center_id: string;
  student_id: string;
  invoice_number: string;
  invoice_month: number;
  invoice_year: number;
  invoice_date: string;
  due_date: string;
  total_amount: number;
  paid_amount: number;
  status: InvoiceStatus;
  academic_year: string;
  notes?: string;
  created_at: string;
  updated_at: string;
};

export type InvoiceItem = {
  id: string;
  invoice_id: string;
  fee_heading_id: string;
  description: string;
  quantity: number;
  unit_amount: number;
  total_amount: number;
  created_at: string;
};

export type PaymentMethod = 'cash' | 'cheque' | 'bank_transfer' | 'upi' | 'card' | 'wallet' | 'other';

export type Payment = {
  id: string;
  center_id: string;
  student_id: string;
  invoice_id?: string;
  payment_date: string;
  amount_paid: number;
  payment_method: PaymentMethod;
  reference_number?: string;
  notes?: string;
  received_by_user_id?: string;
  created_at: string;
  updated_at: string;
};

export type TransactionType = 'fee_invoice' | 'payment_received' | 'expense' | 'refund' | 'adjustment' | 'bank_charge' | 'other';

export type LedgerEntry = {
  id: string;
  center_id: string;
  transaction_date: string;
  transaction_type: TransactionType;
  reference_type?: string;
  reference_id?: string;
  account_code: string;
  account_name: string;
  debit_amount: number;
  credit_amount: number;
  running_balance?: number;
  description?: string;
  created_by_user_id?: string;
  created_at: string;
};

export type ExpenseCategory = 'salaries' | 'rent' | 'utilities' | 'materials' | 'maintenance' | 'transport' | 'admin' | 'other';

export type Expense = {
  id: string;
  center_id: string;
  expense_category: ExpenseCategory;
  description: string;
  amount: number;
  expense_date: string;
  payment_method?: PaymentMethod;
  reference_number?: string;
  approved_by_user_id?: string;
  is_approved: boolean;
  notes?: string;
  created_by_user_id?: string;
  created_at: string;
  updated_at: string;
};

export type FinancialSummary = {
  id: string;
  center_id: string;
  summary_month: number;
  summary_year: number;
  total_invoiced: number;
  total_collected: number;
  total_outstanding: number;
  total_expenses: number;
  net_balance: number;
  generated_at: string;
  last_updated: string;
};

export type PaymentAllocation = {
  id: string;
  payment_id: string;
  invoice_id: string;
  allocated_amount: number;
  created_at: string;
};

// ============================================================================
// COMPOSITE TYPES & RESPONSES
// ============================================================================

export type InvoiceWithItems = Invoice & {
  invoice_items: InvoiceItem[];
  student?: {
    id: string;
    name: string;
    parent_name: string;
    contact_number: string;
  };
};

export type StudentFinanceSummary = {
  student_id: string;
  student_name: string;
  parent_name: string;
  total_fees: number;
  total_paid: number;
  total_due: number;
  overdue_amount: number;
  last_payment_date?: string;
  next_due_date?: string;
  invoice_count: number;
  paid_invoice_count: number;
};

export type CenterFinancialDashboard = {
  summary: FinancialSummary;
  total_students: number;
  students_with_pending_fees: number;
  revenue_trend: Array<{
    month: number;
    year: number;
    collected: number;
    invoiced: number;
  }>;
  pending_payments: Array<{
    student_id: string;
    student_name: string;
    due_amount: number;
    days_overdue: number;
  }>;
  expense_breakdown: Array<{
    category: ExpenseCategory;
    amount: number;
    percentage: number;
  }>;
};

export type CreateInvoiceRequest = {
  student_id: string;
  invoice_month: number;
  invoice_year: number;
  due_days?: number; // Days from invoice date for due date
  academic_year: string;
};

export type RecordPaymentRequest = {
  student_id: string;
  invoice_id?: string;
  amount_paid: number;
  payment_method: PaymentMethod;
  payment_date?: string;
  reference_number?: string;
  notes?: string;
};

export type CreateExpenseRequest = {
  center_id: string;
  expense_category: ExpenseCategory;
  description: string;
  amount: number;
  expense_date?: string;
  payment_method?: PaymentMethod;
  reference_number?: string;
  notes?: string;
};

// ============================================================================
// LEDGER ACCOUNT CODES (Chart of Accounts)
// ============================================================================
export const ACCOUNT_CODES = {
  REVENUE: {
    TUITION_FEE: '4101',
    TRANSPORT_FEE: '4102',
    EXAM_FEE: '4103',
    OTHER_FEE: '4199',
  },
  ASSETS: {
    CASH: '1001',
    BANK: '1002',
    RECEIVABLE: '1301',
  },
  EXPENSES: {
    SALARIES: '5101',
    RENT: '5102',
    UTILITIES: '5103',
    MATERIALS: '5104',
    MAINTENANCE: '5105',
    TRANSPORT: '5106',
    ADMIN: '5107',
    OTHER: '5199',
  },
  LIABILITIES: {
    PAYABLE: '2101',
  },
} as const;

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

export const calculateInvoiceDueDate = (invoiceDate: string, dueDays: number = 30): string => {
  const date = new Date(invoiceDate);
  date.setDate(date.getDate() + dueDays);
  return date.toISOString().split('T')[0];
};

export const getInvoiceNumber = (centerId: string, month: number, year: number, sequence: number): string => {
  const monthStr = String(month).padStart(2, '0');
  const seqStr = String(sequence).padStart(4, '0');
  return `INV-${centerId.slice(0, 4).toUpperCase()}-${year}${monthStr}-${seqStr}`;
};

export const isInvoiceOverdue = (dueDate: string): boolean => {
  return new Date(dueDate) < new Date();
};

export const calculateOutstandingAmount = (totalAmount: number, paidAmount: number): number => {
  return Math.max(0, totalAmount - paidAmount);
};

export const getInvoiceStatus = (
  totalAmount: number,
  paidAmount: number,
  dueDate: string
): InvoiceStatus => {
  if (paidAmount === 0) {
    return isInvoiceOverdue(dueDate) ? 'overdue' : 'issued';
  }
  if (paidAmount >= totalAmount) {
    return 'paid';
  }
  if (paidAmount > 0) {
    return 'partial';
  }
  return 'draft';
};

export const formatCurrency = (amount: number): string => {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
  }).format(amount);
};
