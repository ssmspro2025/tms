# School Management ERP - Complete Implementation Guide

## 📋 Overview

This guide covers the complete implementation of 5 major modules:
1. **Finance Module** - Invoices, Payments, Fee Structures, Expenses
2. **Lesson Plans** - Teacher lesson plan creation and mapping to chapters
3. **Homework Management** - Assignment creation, submission tracking, feedback
4. **Preschool Activities** - Activity tracking with participation ratings
5. **Discipline Management** - Issue logging and action tracking

---

## 🗄️ DATABASE SETUP

### Step 1: Execute SQL Migrations

Copy and paste the SQL code from these migration files into your Supabase SQL editor:

1. **Finance Module**: `supabase/migrations/001_finance_module.sql`
   - Creates tables for fee headings, structures, invoices, payments, expenses

2. **Lesson Plans**: `supabase/migrations/002_lesson_plans.sql`
   - Creates lesson plan and student lesson record tables

3. **Homework**: `supabase/migrations/003_homework.sql`
   - Creates homework, submission, and feedback tables

4. **Preschool Activities**: `supabase/migrations/004_preschool_activities.sql`
   - Creates activity type and student activity participation tables

5. **Discipline**: `supabase/migrations/005_discipline.sql`
   - Creates discipline issue and action tables

### Step 2: Storage Buckets

Create the following storage buckets in Supabase:
- `lesson-plans` - For lesson plan PDF/Documents
- `homework` - For homework attachments
- `activity-photos` - For activity media

---

## 🚀 EDGE FUNCTIONS

Deploy these Edge Functions to Supabase:

### 1. Finance - Generate Monthly Invoices
```
File: supabase/functions/finance-generate-invoices/index.ts
Function: POST /functions/v1/finance-generate-invoices
Body: { centerId, month, year }
```

### 2. Process Payment
```
File: supabase/functions/process-payment/index.ts
Function: POST /functions/v1/process-payment
Body: { invoiceId, studentId, centerId, amount, paymentMethod, referenceNumber }
```

---

## 📁 REACT COMPONENTS

### Finance Module Components

**Admin Pages:**
- `src/pages/FinanceDashboard.tsx` - Main finance dashboard with stats
- `src/components/finance/FeeStructureManager.tsx` - Create fee headings and structures
- `src/components/finance/InvoiceManager.tsx` - Create and manage invoices
- `src/components/finance/PaymentManager.tsx` - Record payments
- `src/components/finance/ExpenseManager.tsx` - Manage expenses
- `src/components/finance/FinanceAnalytics.tsx` - 12-month financial analytics

### Lesson Plans
- `src/pages/TeacherLessonPlans.tsx` - Teacher creates lesson plans
  - Upload PDF/documents
  - Link to subject, chapter, topic, grade, date
  - Stored in database with file references

### Homework
- `src/pages/TeacherHomework.tsx` - Teacher creates and manages homework
  - Create assignments with due dates
  - Track student submissions
  - Mark as checked/completed
  - Add teacher feedback

### Preschool Activities
- `src/pages/TeacherActivities.tsx` - Teacher logs activities
  - Activity types (art, music, play, etc.)
  - Record student participation
  - Rate involvement (1-5 scale)
  - Participation ratings (excellent, good, fair, needs improvement)

### Discipline
- `src/pages/TeacherDiscipline.tsx` - Teacher logs discipline issues
  - Category-based logging
  - Severity levels (low, medium, high)
  - Track resolution status
  - Parent communication status

---

## 🔗 ROUTING SETUP

Add these routes to your `src/App.tsx` (in the appropriate role-based sections):

```typescript
// Admin Routes
<Route path="/admin/finance" element={<FinanceDashboard />} />

// Teacher Routes
<Route path="/teacher/lesson-plans" element={<TeacherLessonPlans />} />
<Route path="/teacher/homework" element={<TeacherHomework />} />
<Route path="/teacher/activities" element={<TeacherActivities />} />
<Route path="/teacher/discipline" element={<TeacherDiscipline />} />
```

---

## 📊 STUDENT REPORT INTEGRATION

The StudentReport page should display:

1. **Finance Section**
   - Total fees invoiced
   - Total paid
   - Outstanding dues
   - Recent invoices
   - Payment history

2. **Lesson Plan Section**
   - Lessons completed
   - Chapters covered
   - Lesson files (if available)

3. **Homework Section**
   - Pending homework
   - Submitted homework
   - Marks received
   - Teacher feedback

4. **Activities Section** (Preschool)
   - Activities attended
   - Participation ratings
   - Involvement scores
   - Teacher notes

5. **Discipline Section**
   - Open issues
   - Issue history
   - Actions taken

---

## 👨‍👩‍👧 PARENT DASHBOARD INTEGRATION

Parent Dashboard should include:

1. **Finance Panel**
   - List of invoices (due, partial, paid)
   - Payment button (link to payment gateway)
   - Download invoice PDF
   - Payment history

2. **Homework Panel**
   - Today's homework
   - Upcoming homework
   - Completed homework
   - Teacher feedback

3. **Discipline Alerts**
   - Recent discipline issues
   - Action status
   - Parent meeting schedules

---

## 🔐 PERMISSIONS & SECURITY

### Role-Based Access:

**Admin:**
- View/manage all financial data
- Generate invoices
- View all students' records
- Financial analytics

**Center Staff/Teacher:**
- Create lesson plans (subject they teach)
- Create homework for their classes
- Log discipline issues
- Record activities
- Cannot access financial management

**Parent:**
- View own child's invoices and fees
- View payment history
- Submit online payments
- View homework and feedback
- View discipline alerts

**Student:**
- View own homework
- Submit homework
- View discipline records

### RLS Policies:
All tables should have Row-Level Security policies enforcing:
- Admin: Full access
- Center staff: Access to their center's data
- Teachers: Access to their own created records
- Parents: Access to their child's records only

---

## 💳 PAYMENT GATEWAY INTEGRATION

For parent online payments, integrate with:
- **Razorpay** (recommended for India)
- **Stripe**
- **PayPal**

Steps:
1. Create payment intent in frontend
2. Call payment gateway API
3. On successful payment, trigger `process-payment` Edge Function
4. Update invoice status to "partial" or "paid"
5. Create ledger entry automatically

---

## 📧 AUTOMATED WORKFLOWS

### Email Notifications:

1. **Invoice Generated**
   - Send to parent's email with PDF

2. **Payment Received**
   - Send receipt and thank you email

3. **Homework Due Tomorrow**
   - Notification to student/parent

4. **Discipline Issue Logged**
   - Notify parent (if parent_informed = true)

Use Supabase Edge Functions or third-party service (SendGrid, Mailgun)

---

## 📈 MONTHLY INVOICE GENERATION

Automate using Supabase Cron Jobs or external scheduler:

```
Trigger: 1st day of each month
Function: finance-generate-invoices
Parameters: {
  centerId: current_center,
  month: current_month,
  year: current_year
}
```

Result: Automatically creates invoices for all active students based on their fee structures.

---

## 📱 PARENT PAYMENT FLOW

1. Parent logs in → Parent Dashboard
2. View Invoices tab → See list of due invoices
3. Click "Pay Now" on invoice
4. System redirects to payment gateway
5. Parent enters payment details
6. Success → Creates payment record
7. Invoice status updated
8. Receipt generated and emailed

---

## 🧪 TESTING CHECKLIST

- [ ] Create fee headings
- [ ] Create fee structure for a grade
- [ ] Assign fee structure to student
- [ ] Manually create invoice
- [ ] Auto-generate invoices for a month
- [ ] Record payment
- [ ] Verify invoice status updates
- [ ] View finance analytics
- [ ] Create lesson plan with file
- [ ] Create homework
- [ ] Submit homework as student
- [ ] Mark homework as checked
- [ ] Create activity
- [ ] Record student participation
- [ ] Log discipline issue
- [ ] View student report (all sections)

---

## 🐛 TROUBLESHOOTING

### Issue: "Failed to fetch" on Edge Function
- Solution: Deploy Edge Functions and verify they're accessible

### Issue: File uploads not working
- Solution: Ensure storage buckets are created with public access

### Issue: Invoice not generating
- Solution: Verify fee structure is assigned to student and is_active = true

### Issue: Parent can't view invoices
- Solution: Check RLS policies and parent_id assignment

---

## 🔄 DATABASE RELATIONSHIPS

```
students
  ├── student_fee_assignments → fee_structures
  │   └── fee_structure_items → fee_headings
  ├── invoices
  │   └── invoice_items → fee_headings
  ├── payments → invoices
  ├── discipline_issues → discipline_categories
  │   └── discipline_actions
  ├── lesson_plans → lesson_plan_media
  ├── homework_submissions → homework
  │   └── homework_feedback
  └── student_activities → activities
      └── activity_types
```

---

## 📚 API ENDPOINTS SUMMARY

| Module | Endpoint | Method | Purpose |
|--------|----------|--------|---------|
| Finance | `/finance-generate-invoices` | POST | Generate monthly invoices |
| Finance | `/process-payment` | POST | Record payment |
| Lesson Plans | `/lesson-plans` | POST/GET | CRUD operations |
| Homework | `/homework` | POST/GET | CRUD operations |
| Activities | `/activities` | POST/GET | CRUD operations |
| Discipline | `/discipline-issues` | POST/GET | CRUD operations |

---

## ✅ DEPLOYMENT CHECKLIST

- [ ] SQL migrations executed
- [ ] Storage buckets created
- [ ] Edge Functions deployed
- [ ] Routes added to App.tsx
- [ ] Components imported
- [ ] RLS policies configured
- [ ] Email service configured
- [ ] Payment gateway API keys added
- [ ] Test with sample data
- [ ] Verify parent access
- [ ] Monitor error logs

---

**Last Updated:** 2024
**Version:** 1.0
