import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.80.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { centerId, month, year, academicYear, dueInDays = 30 } = await req.json();

    if (!centerId || !month || !year || !academicYear) {
      return new Response(
        JSON.stringify({ error: 'Missing required parameters: centerId, month, year, academicYear' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
      );
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Check if invoices already exist for this month
    const { data: existingInvoices, error: checkError } = await supabase
      .from('invoices')
      .select('id')
      .eq('center_id', centerId)
      .eq('invoice_month', month)
      .eq('invoice_year', year);

    if (checkError) throw checkError;

    if (existingInvoices && existingInvoices.length > 0) {
      return new Response(
        JSON.stringify({
          success: true,
          message: `Invoices already exist for ${month}/${year}. Skipping generation.`,
          invoicesGenerated: 0
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get all active students for this center
    const { data: students, error: studentsError } = await supabase
      .from('students')
      .select('id, name, parent_name, contact_number, grade, center_id')
      .eq('center_id', centerId);

    if (studentsError) throw studentsError;
    if (!students || students.length === 0) {
      return new Response(
        JSON.stringify({
          success: true,
          message: 'No students found for this center',
          invoicesGenerated: 0
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const invoiceDate = new Date();
    invoiceDate.setMonth(month - 1); // month is 1-indexed
    invoiceDate.setFullYear(year);
    invoiceDate.setDate(1);

    const dueDate = new Date(invoiceDate);
    dueDate.setDate(dueDate.getDate() + dueInDays);

    const invoiceList = [];
    let invoiceCounter = 1;

    // Generate invoice for each student
    for (const student of students) {
      try {
        // Get active fee assignments for this student
        const { data: feeAssignments, error: feeError } = await supabase
          .from('student_fee_assignments')
          .select('*, fee_headings(id, heading_name, heading_code)')
          .eq('student_id', student.id)
          .eq('academic_year', academicYear)
          .eq('is_active', true);

        if (feeError) throw feeError;

        if (!feeAssignments || feeAssignments.length === 0) {
          console.log(`No fee assignments for student ${student.id}`);
          continue;
        }

        // Calculate total invoice amount
        let totalAmount = 0;
        for (const fee of feeAssignments) {
          totalAmount += Number(fee.amount);
        }

        // Create invoice number
        const invoiceNumber = `INV-${centerId.slice(0, 4).toUpperCase()}-${year}${String(month).padStart(2, '0')}-${String(invoiceCounter).padStart(4, '0')}`;

        // Insert invoice
        const { data: invoice, error: invoiceError } = await supabase
          .from('invoices')
          .insert({
            center_id: centerId,
            student_id: student.id,
            invoice_number: invoiceNumber,
            invoice_month: month,
            invoice_year: year,
            invoice_date: invoiceDate.toISOString().split('T')[0],
            due_date: dueDate.toISOString().split('T')[0],
            total_amount: totalAmount,
            paid_amount: 0,
            status: 'issued',
            academic_year: academicYear,
            notes: `Monthly invoice for ${invoiceDate.toLocaleString('default', { month: 'long', year: 'numeric' })}`
          })
          .select()
          .single();

        if (invoiceError) throw invoiceError;

        // Insert invoice items
        const items = [];
        for (const fee of feeAssignments) {
          items.push({
            invoice_id: invoice.id,
            fee_heading_id: fee.fee_heading_id,
            description: (fee.fee_headings as any)?.heading_name || 'Fee',
            quantity: 1,
            unit_amount: fee.amount,
            total_amount: fee.amount
          });
        }

        const { error: itemsError } = await supabase
          .from('invoice_items')
          .insert(items);

        if (itemsError) throw itemsError;

        // Create ledger entry for invoice
        const { error: ledgerError } = await supabase
          .from('ledger_entries')
          .insert({
            center_id: centerId,
            transaction_date: invoiceDate.toISOString().split('T')[0],
            transaction_type: 'fee_invoice',
            reference_type: 'invoice',
            reference_id: invoice.id,
            account_code: '1301', // Accounts Receivable
            account_name: 'Accounts Receivable',
            debit_amount: totalAmount,
            credit_amount: 0,
            description: `Invoice ${invoiceNumber} for ${student.name}`
          });

        if (ledgerError) throw ledgerError;

        // Revenue recognition entry
        const { error: revenueError } = await supabase
          .from('ledger_entries')
          .insert({
            center_id: centerId,
            transaction_date: invoiceDate.toISOString().split('T')[0],
            transaction_type: 'fee_invoice',
            reference_type: 'invoice',
            reference_id: invoice.id,
            account_code: '4101', // Tuition Fee Revenue (simplified)
            account_name: 'Fee Revenue',
            debit_amount: 0,
            credit_amount: totalAmount,
            description: `Revenue from invoice ${invoiceNumber} for ${student.name}`
          });

        if (revenueError) throw revenueError;

        invoiceList.push({
          invoiceId: invoice.id,
          invoiceNumber: invoiceNumber,
          studentId: student.id,
          studentName: student.name,
          totalAmount: totalAmount
        });

        invoiceCounter++;
      } catch (studentError) {
        console.error(`Error processing student ${student.id}:`, studentError);
        continue;
      }
    }

    // Update or create financial summary for this month
    const { data: existingSummary } = await supabase
      .from('financial_summaries')
      .select('id')
      .eq('center_id', centerId)
      .eq('summary_month', month)
      .eq('summary_year', year)
      .single();

    if (existingSummary) {
      // Update existing summary
      const totalInvoiced = invoiceList.reduce((sum, inv) => sum + inv.totalAmount, 0);
      await supabase
        .from('financial_summaries')
        .update({
          total_invoiced: totalInvoiced,
          last_updated: new Date().toISOString()
        })
        .eq('id', existingSummary.id);
    } else {
      // Create new summary
      const totalInvoiced = invoiceList.reduce((sum, inv) => sum + inv.totalAmount, 0);
      await supabase
        .from('financial_summaries')
        .insert({
          center_id: centerId,
          summary_month: month,
          summary_year: year,
          total_invoiced: totalInvoiced,
          total_collected: 0,
          total_outstanding: totalInvoiced,
          total_expenses: 0,
          net_balance: -totalInvoiced
        });
    }

    return new Response(
      JSON.stringify({
        success: true,
        message: `Successfully generated ${invoiceList.length} invoices for ${month}/${year}`,
        invoicesGenerated: invoiceList.length,
        invoices: invoiceList
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error: any) {
    console.error('Invoice generation error:', error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error.message || 'Failed to generate invoices'
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
    );
  }
});
