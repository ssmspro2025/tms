# Finance Module - Complete Implementation Guide

## Overview

This guide provides a comprehensive implementation of a Finance Management System for your TMS (Teaching Management System) following industry best practices for school ERP systems.

## 📋 Table of Contents

1. [Database Schema](#database-schema)
2. [Core Components](#core-components)
3. [API Endpoints & Edge Functions](#api-endpoints--edge-functions)
4. [Workflow & Processes](#workflow--processes)
5. [Best Practices](#best-practices)
6. [Integration Steps](#integration-steps)
7. [Automation & Cron Jobs](#automation--cron-jobs)

---

## Database Schema

### Table Relationships

```
centers (1) ──┬── (N) fee_headings
              ├── (N) fee_structures
              ├── (N) invoices
              ├── (N) expenses
              └── (N) ledger_entries

students (1) ──┬── (N) student_fee_assignments
               ├── (N) invoices
               ├── (N) payments
               └── (N) test_results

fee_structures (1) ── (N) student_fee_assignments

invoices (1) ──┬── (N) invoice_items
               ├── (N) payments
               ├── (N) payment_allocations
               └── (N) ledger_entries

fee_headings (1) ──┬── (N) fee_structures
                   ├── (N) invoice_items
                   └── (N) student_fee_assignments
```

### Key Tables

#### 1. **fee_headings** - Fee Types Master
- Master list of all fee types (Tuition, Transport, Exam, etc.)
- Center-scoped with unique codes
- Active/Inactive status for workflow control

#### 2. **fee_structures** - Grade-wise Fee Amounts
- Defines fee amounts per grade and academic year
- Supports different pricing for different grades
- Effective date ranges for historical tracking

#### 3. **student_fee_assignments** - Student → Fee Mapping
- Links students to fee structures
- Tracks which fees are assigned to which students
- Academic year scoped

#### 4. **invoices** - Monthly Invoices
- Generated automatically for each student monthly
- Status tracking: draft → issued → partial/paid/overdue
- Atomic record of fee demand

#### 5. **invoice_items** - Line Items in Invoices
- Individual fee components in each invoice
- Tracks fee heading, quantity, unit amount, total

#### 6. **payments** - Payment Records
- Every payment received from parents/students
- Supports partial payments
- Multiple payment methods tracking

#### 7. **ledger_entries** - Double-Entry Accounting
- Complete audit trail of all financial transactions
- Debit/Credit model for accounting accuracy
- Account codes for chart of accounts
- Transaction references for traceability

#### 8. **payment_allocations** - Partial Payment Tracking
- How payments are allocated to invoices
- Essential for partial payment workflows

#### 9. **expenses** - Center Operating Expenses
- Salary, rent, utilities, materials, etc.
- Approval workflow (pending/approved)
- Category-based expense tracking

#### 10. **financial_summaries** - Monthly Aggregated Data
- Pre-calculated summaries for dashboard performance
- Total invoiced, collected, outstanding, net balance
- Updated monthly via automation

---

## Core Components

### Admin Finance Dashboard (src/pages/AdminFinance.tsx)

**Features:**
- Overview cards: Total Invoiced, Collected, Outstanding, Net Balance
- Alert for overdue invoices
- Tabbed interface for different sections

**Key Sections:**

#### 1. Fee Management
- Create fee headings (Tuition, Transport, etc.)
- Define fee structures for each grade
- Academic year-based fee structure management

**Operations:**
```typescript
// Create Fee Heading
await supabase.from('fee_headings').insert({
  center_id,
  heading_name: 'Tuition Fee',
  heading_code: 'TF',
  description: 'Monthly tuition'
});

// Create Fee Structure
await supabase.from('fee_structures').insert({
  center_id,
  fee_heading_id,
  grade: 'Grade 1',
  amount: 5000,
  academic_year: '2024-2025'
});

// Assign Fees to Student
await supabase.from('student_fee_assignments').insert({
  student_id,
  fee_heading_id,
  fee_structure_id,
  amount,
  academic_year: '2024-2025'
});
```

#### 2. Invoice Management
- Generate monthly invoices automatically
- View invoice details and status
- Track payment status

**Invoice Generation Workflow:**
```
1. User clicks "Generate Monthly Invoices"
2. System fetches all students with active fee assignments
3. For each student:
   - Create invoice record
   - Add invoice items for each assigned fee
   - Create ledger entries (AR debit, Revenue credit)
4. Update financial summary for the month
```

**API Call:**
```typescript
const { data } = await supabase.functions.invoke('generate-monthly-invoices', {
  body: {
    centerId: user.center_id,
    month: 1,
    year: 2025,
    academicYear: '2024-2025',
    dueInDays: 30
  }
});
```

#### 3. Payment Tracking
- Record payments (full, partial, multiple methods)
- Support multiple payment methods (Cash, Cheque, UPI, Bank, Card)
- Payment allocation to invoices

**Payment Recording:**
```typescript
// Record payment
const { error } = await supabase.from('payments').insert({
  center_id,
  student_id,
  invoice_id,
  amount_paid: 2500,
  payment_method: 'bank_transfer',
  payment_date: today,
  reference_number: 'TXN-123456'
});

// Create allocation for partial payment
await supabase.from('payment_allocations').insert({
  payment_id,
  invoice_id,
  allocated_amount: 2500
});

// Update invoice status and paid amount
await supabase.from('invoices').update({
  paid_amount: invoice.paid_amount + 2500,
  status: calculateStatus(...)
}).eq('id', invoice_id);

// Create ledger entries
// Debit: Cash Account
// Credit: Accounts Receivable
```

#### 4. Expense Management
- Record operating expenses
- Approval workflow
- Expense categorization

**Expense Categories:**
- Salaries
- Rent
- Utilities
- Materials
- Maintenance
- Transport
- Admin
- Other

#### 5. Financial Reports
- Revenue trend charts (12-month view)
- Expense breakdown by category
- Collection rate analysis
- Outstanding amount tracking

---

## API Endpoints & Edge Functions

### 1. Monthly Invoice Generation

**Function:** `generate-monthly-invoices`

**Endpoint:** `supabase.functions.invoke('generate-monthly-invoices')`

**Request:**
```typescript
{
  centerId: string;        // Center ID
  month: number;           // 1-12
  year: number;            // 2025
  academicYear: string;    // '2024-2025'
  dueInDays?: number;      // Default 30
}
```

**Response:**
```typescript
{
  success: boolean;
  invoicesGenerated: number;
  invoices: Array<{
    invoiceId: string;
    invoiceNumber: string;
    studentId: string;
    studentName: string;
    totalAmount: number;
  }>;
}
```

**Logic:**
1. Check if invoices already exist for month/year (prevent duplicates)
2. Fetch all active students for center
3. For each student:
   - Get active fee assignments for academic year
   - Calculate total invoice amount
   - Create invoice record with auto-generated number
   - Create invoice items for each fee
   - Create ledger entries (AR and Revenue)
4. Create/update financial summary

### 2. Record Payment

**Function:** Direct client-side implementation (no Edge Function needed)

**Process:**
1. Insert into `payments` table
2. Insert into `payment_allocations` if partial payment
3. Update `invoices` table (paid_amount, status)
4. Create ledger entries:
   - Debit: Cash/Bank Account
   - Credit: Accounts Receivable (AR)

**Ledger Entry Logic:**
```typescript
// When payment received
const debitAccount = {
  account_code: '1001', // Cash Account
  account_name: 'Cash',
  debit_amount: payment_amount,
  credit_amount: 0
};

const creditAccount = {
  account_code: '1301', // Accounts Receivable
  account_name: 'Accounts Receivable',
  debit_amount: 0,
  credit_amount: payment_amount
};
```

### 3. Generate Financial Summary

**Trigger:** Monthly automation or on-demand

**Calculation:**
```typescript
const summary = {
  total_invoiced: sum(all invoices for month),
  total_collected: sum(all payments for month),
  total_outstanding: total_invoiced - total_collected,
  total_expenses: sum(all approved expenses for month),
  net_balance: total_collected - total_expenses
};
```

---

## Workflow & Processes

### Monthly Invoice Generation Workflow

```
START
  ↓
User clicks "Generate Monthly Invoices" (Admin Finance → Invoices)
  ↓
Input: Month, Year, Academic Year, Due Days
  ↓
System validates:
  - No existing invoices for this month/year
  - Fee structures defined for academic year
  ↓
For Each Student (with active fee assignments):
  ├─ Calculate invoice amount
  ├─ Create Invoice record
  ├─ Add Invoice Items for each fee
  ├─ Create Ledger Entries:
  │  ├─ Debit: Accounts Receivable
  │  └─ Credit: Fee Revenue
  └─ Send notification to parent
  ↓
Update Financial Summary
  ↓
Display: "X invoices generated successfully"
  ↓
END
```

### Payment Collection Workflow

```
START
  ↓
Parent makes payment
  ↓
Center staff records payment (Admin Finance → Payments)
  ├─ Amount, Date, Method, Reference
  ├─ Select Invoice(s) to allocate to
  ↓
System processes:
  ├─ Create Payment record
  ├─ Create Payment Allocations
  ├─ Update Invoice:
  │  ├─ Increment paid_amount
  │  ├─ Calculate new status
  │  └─ Update status
  ├─ Create Ledger Entries:
  │  ├─ Debit: Cash/Bank
  │  └─ Credit: Accounts Receivable
  └─ Update Financial Summary
  ↓
Display confirmation with receipt
  ↓
END
```

### Expense Recording Workflow

```
START
  ↓
Staff creates expense (Admin Finance → Expenses)
  ├─ Category, Description, Amount, Date
  ├─ Payment Method, Reference
  ↓
System records in PENDING status
  ↓
Admin reviews and approves
  ↓
Upon approval:
  ├─ Create Ledger Entry:
  │  ├─ Debit: Expense Account
  │  └─ Credit: Cash/Bank
  └─ Update Financial Summary
  ↓
END
```

---

## Best Practices

### 1. Double-Entry Accounting
Every financial transaction creates two ledger entries:
- **Debit:** Where money comes from
- **Credit:** Where money goes to

**Example - Invoice Creation:**
```
Debit:  Accounts Receivable (Asset)    ₹5000
Credit: Tuition Fee Revenue (Income)             ₹5000
```

**Example - Payment Received:**
```
Debit:  Cash/Bank (Asset)              ₹5000
Credit: Accounts Receivable (Asset)             ₹5000
```

### 2. Audit Trail
- Every transaction logged with timestamp
- User who performed action tracked
- Transaction references for traceability
- Immutable records (never delete, mark as cancelled if needed)

### 3. Invoice Numbering
Format: `INV-{CENTER_CODE}-{YEAR}{MONTH}-{SEQUENCE}`

Example: `INV-CRLN-202501-0001`

Benefits:
- Unique per center
- Chronological tracking
- Easy to identify month/year

### 4. Student Status Tracking
Invoice statuses represent payment progress:
- **Draft:** Created but not yet issued
- **Issued:** Sent to parent, awaiting payment
- **Partial:** Some amount received
- **Paid:** Fully paid
- **Overdue:** Past due date, not fully paid
- **Cancelled:** Cancelled or voided

### 5. Partial Payment Handling
- `payment_allocations` table tracks which invoices a payment applies to
- A single payment can pay multiple invoices
- A single invoice can receive multiple payments
- Automatic status updates based on total paid

### 6. Data Integrity
- Foreign key constraints ensure referential integrity
- Unique constraints prevent duplicates
- Check constraints validate data (e.g., amount > 0)
- RLS policies control access

### 7. Performance Optimization
- Indexes on frequently queried columns
- Financial summaries cached monthly
- Aggregated data for dashboard
- Lazy-load detailed records

### 8. Rounding Precision
- Use DECIMAL(12, 2) for all amounts
- Handle rounding in application, not database
- Currency in lowest denominator (paise for INR)

---

## Integration Steps

### Step 1: Apply Database Migration

```bash
# Run the migration to create finance tables
supabase db push
```

This creates all finance tables with proper relationships and indexes.

### Step 2: Deploy Edge Function

```bash
# Make sure generate-monthly-invoices function is in supabase/functions/
supabase functions deploy generate-monthly-invoices
```

### Step 3: Add Admin Finance Page to Routing

**File: src/App.tsx**

```typescript
import AdminFinance from './pages/AdminFinance';

// In routes:
{
  path: '/admin/finance',
  element: <ProtectedRoute><AdminFinance /></ProtectedRoute>
}
```

### Step 4: Update Navigation

**File: src/components/Layout.tsx**

Add to navigation:
```typescript
<NavLink to="/admin/finance" icon={DollarSign}>
  Finance Management
</NavLink>
```

### Step 5: Create Type Definitions

Copy `src/integrations/supabase/finance-types.ts` to your project.

### Step 6: Add Finance Components

Place all finance components in `src/components/finance/`:
- FeeManagement.tsx
- InvoiceManagement.tsx
- PaymentTracking.tsx
- ExpenseManagement.tsx
- FinanceReports.tsx

### Step 7: Install Chart Library (for Reports)

```bash
npm install recharts
```

---

## Automation & Cron Jobs

### Monthly Invoice Generation Automation

**Option 1: Database Functions (PostgreSQL)**

Create a stored procedure in Supabase that runs monthly:

```sql
-- Create function
CREATE OR REPLACE FUNCTION public.generate_monthly_invoices()
RETURNS void AS $$
DECLARE
  v_center_id UUID;
  v_month INT;
  v_year INT;
BEGIN
  -- Get current month/year
  v_month := EXTRACT(MONTH FROM CURRENT_DATE);
  v_year := EXTRACT(YEAR FROM CURRENT_DATE);
  
  -- For each center
  FOR v_center_id IN
    SELECT DISTINCT center_id FROM centers
  LOOP
    -- Call invoice generation logic
    PERFORM generate_center_invoices(v_center_id, v_month, v_year, '2024-2025');
  END LOOP;
END;
$$ LANGUAGE plpgsql;

-- Schedule via pg_cron (if available)
SELECT cron.schedule(
  'generate-monthly-invoices',
  '0 0 1 * *', -- 00:00 on 1st of each month
  'SELECT public.generate_monthly_invoices()'
);
```

**Option 2: External Cron Service + API**

Use services like:
- **Vercel Cron Functions**
- **AWS Lambda + EventBridge**
- **Google Cloud Scheduler**
- **Easycron**

Example with Node.js:
```javascript
// Runs on 1st of each month at 00:00
const schedule = '0 0 1 * *'; // crontab format

app.post('/api/cron/generate-invoices', async (req, res) => {
  const supabase = createClient(url, serviceRoleKey);
  
  const { data } = await supabase.functions.invoke('generate-monthly-invoices', {
    body: {
      centerId: allCenters,
      month: new Date().getMonth() + 1,
      year: new Date().getFullYear(),
      academicYear: getCurrentAcademicYear()
    }
  });
  
  res.json(data);
});
```

### Financial Summary Update

Update monthly after invoice generation:

```sql
-- Triggered after invoices created
AFTER INSERT ON invoices
FOR EACH ROW
EXECUTE FUNCTION update_financial_summary();
```

### Payment Reminders

Send automated reminders for:
- Overdue invoices (7 days past due)
- Upcoming due dates (3 days before due)
- Payment confirmation (upon receipt)

---

## Parent Dashboard Integration

### Parent Finance Tab

Add to ParentDashboard:

```typescript
// New tab in parent dashboard
<Tabs>
  <TabsTrigger value="finance">Finance</TabsTrigger>
</Tabs>

// In TabsContent:
<ParentFinanceTab studentId={user.student_id} />
```

### Features:

1. **Invoice List**
   - All outstanding invoices
   - Paid invoices (history)
   - Due dates and payment status

2. **Payment Page**
   - Amount to pay
   - Payment method selection
   - UPI/Bank transfer details
   - Payment history

3. **Reports**
   - Payment history
   - Outstanding balance
   - Fee structure details

**Implementation:**
```typescript
// Fetch parent's student invoices
const { data: invoices } = await supabase
  .from('invoices')
  .select('*')
  .eq('student_id', user.student_id)
  .in('status', ['issued', 'partial', 'overdue']);
```

---

## Troubleshooting

### Issue: Invoices showing wrong amount

**Solution:** Check `student_fee_assignments` are active and have correct amounts for academic year

### Issue: Payment not updating invoice status

**Solution:** Ensure `payment_allocations` record created and `invoices.paid_amount` field updated

### Issue: Ledger entries not balanced

**Solution:** Verify each transaction has matching debit/credit amounts

### Issue: Performance degradation

**Solution:**
- Check indexes are created
- Use financial_summaries instead of calculating from raw data
- Archive old transactions

---

## Sample Queries

### Get Student Outstanding Balance
```sql
SELECT 
  s.id, s.name,
  SUM(i.total_amount) as total_invoiced,
  SUM(i.paid_amount) as total_paid,
  SUM(i.total_amount - i.paid_amount) as outstanding
FROM students s
LEFT JOIN invoices i ON s.id = i.student_id
WHERE s.center_id = $1
GROUP BY s.id;
```

### Get Monthly Financial Summary
```sql
SELECT 
  DATE_TRUNC('month', i.invoice_date) as month,
  COUNT(DISTINCT i.id) as invoice_count,
  SUM(i.total_amount) as total_invoiced,
  SUM(i.paid_amount) as total_collected,
  SUM(e.amount) as total_expenses
FROM invoices i
LEFT JOIN expenses e ON i.center_id = e.center_id
WHERE i.center_id = $1
GROUP BY DATE_TRUNC('month', i.invoice_date);
```

### Ledger Trial Balance
```sql
SELECT 
  account_code, account_name,
  SUM(debit_amount) as total_debit,
  SUM(credit_amount) as total_credit,
  SUM(debit_amount) - SUM(credit_amount) as balance
FROM ledger_entries
WHERE center_id = $1
GROUP BY account_code, account_name;
```

---

## Next Steps

1. **Apply migration** - Deploy finance schema
2. **Configure automation** - Set up monthly invoice generation
3. **Add admin pages** - Integrate finance management pages
4. **Add parent dashboard** - Let parents view invoices and make payments
5. **Integrate payment gateway** - Add online payment support (Razorpay, PayU)
6. **Create reports** - Build detailed financial reports
7. **Audit & testing** - Test all workflows end-to-end

---

## Support & Documentation

- Supabase Docs: https://supabase.com/docs
- PostgreSQL: https://www.postgresql.org/docs/
- Accounting Standards: https://www.icai.org/ (for India)

