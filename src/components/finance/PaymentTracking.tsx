import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogDescription } from '@/components/ui/dialog';
import { toast } from 'sonner';
import { Plus, Check } from 'lucide-react';
import { Payment, PaymentMethod, Invoice, LedgerEntry, ACCOUNT_CODES, getInvoiceStatus } from '@/integrations/supabase/finance-types';
import { Tables } from '@/integrations/supabase/types';

type Student = Tables<'students'>;

const PaymentTracking = () => {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [showPaymentDialog, setShowPaymentDialog] = useState(false);

  const [paymentForm, setPaymentForm] = useState({
    student_id: '',
    invoice_id: '',
    amount_paid: '',
    payment_method: 'cash' as PaymentMethod,
    reference_number: '',
    notes: ''
  });

  // Fetch students for dropdown
  const { data: students = [] } = useQuery({
    queryKey: ['students-for-payments', user?.center_id],
    queryFn: async () => {
      if (!user?.center_id) return [];
      const { data, error } = await supabase
        .from('students')
        .select('id, name, grade')
        .eq('center_id', user.center_id)
        .order('name');
      if (error) throw error;
      return data;
    },
    enabled: !!user?.center_id,
  });

  // Fetch invoices for selected student
  const { data: studentInvoices = [] } = useQuery({
    queryKey: ['student-invoices-for-payment', paymentForm.student_id],
    queryFn: async () => {
      if (!paymentForm.student_id) return [];
      const { data, error } = await supabase
        .from('invoices')
        .select('*')
        .eq('student_id', paymentForm.student_id)
        .in('status', ['issued', 'partial', 'overdue']) // Only show outstanding invoices
        .order('due_date', { ascending: true });
      if (error) throw error;
      return data as Invoice[];
    },
    enabled: !!paymentForm.student_id,
  });

  // Fetch payments
  const { data: payments = [], isLoading: paymentsLoading } = useQuery({
    queryKey: ['payments', user?.center_id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('payments')
        .select('*, students(name)')
        .eq('center_id', user?.center_id!)
        .order('payment_date', { ascending: false });

      if (error) throw error;
      return data as (Payment & { students: { name: string } })[];
    },
    enabled: !!user?.center_id
  });

  // Record payment mutation
  const recordPaymentMutation = useMutation({
    mutationFn: async () => {
      if (!user?.center_id || !paymentForm.student_id || !paymentForm.amount_paid) throw new Error('Missing required fields');

      const amountPaid = parseFloat(paymentForm.amount_paid);
      if (isNaN(amountPaid) || amountPaid <= 0) throw new Error('Invalid amount paid');

      // 1. Record the payment
      const { data: newPayment, error: paymentError } = await supabase
        .from('payments')
        .insert({
          center_id: user.center_id,
          student_id: paymentForm.student_id,
          invoice_id: paymentForm.invoice_id || null,
          amount_paid: amountPaid,
          payment_method: paymentForm.payment_method,
          reference_number: paymentForm.reference_number || null,
          notes: paymentForm.notes || null,
          payment_date: new Date().toISOString().split('T')[0],
          received_by_user_id: user.id
        })
        .select()
        .single();

      if (paymentError) throw paymentError;

      // 2. Update the associated invoice (if any)
      if (paymentForm.invoice_id) {
        const currentInvoice = studentInvoices.find(inv => inv.id === paymentForm.invoice_id);
        if (currentInvoice) {
          const updatedPaidAmount = currentInvoice.paid_amount + amountPaid;
          const newStatus = getInvoiceStatus(currentInvoice.total_amount, updatedPaidAmount, currentInvoice.due_date);

          const { error: invoiceUpdateError } = await supabase
            .from('invoices')
            .update({
              paid_amount: updatedPaidAmount,
              status: newStatus,
              updated_at: new Date().toISOString()
            })
            .eq('id', paymentForm.invoice_id);

          if (invoiceUpdateError) throw invoiceUpdateError;

          // 3. Create ledger entries for payment and invoice update
          const ledgerEntries: Tables<'ledger_entries'>[] = [
            // Debit: Cash/Bank Account
            {
              center_id: user.center_id,
              transaction_date: newPayment.payment_date,
              transaction_type: 'payment_received',
              reference_type: 'payment',
              reference_id: newPayment.id,
              account_code: ACCOUNT_CODES.ASSETS.CASH, // Assuming cash for simplicity, could be dynamic
              account_name: 'Cash/Bank',
              debit_amount: amountPaid,
              credit_amount: 0,
              description: `Payment received from student ${paymentForm.student_id} for invoice ${currentInvoice.invoice_number}`
            },
            // Credit: Accounts Receivable
            {
              center_id: user.center_id,
              transaction_date: newPayment.payment_date,
              transaction_type: 'payment_received',
              reference_type: 'payment',
              reference_id: newPayment.id,
              account_code: ACCOUNT_CODES.ASSETS.RECEIVABLE,
              account_name: 'Accounts Receivable',
              debit_amount: 0,
              credit_amount: amountPaid,
              description: `Reduction in Accounts Receivable for invoice ${currentInvoice.invoice_number}`
            }
          ];

          const { error: ledgerError } = await supabase.from('ledger_entries').insert(ledgerEntries);
          if (ledgerError) throw ledgerError;
        }
      }
    },
    onSuccess: () => {
      toast.success('Payment recorded successfully');
      setShowPaymentDialog(false);
      setPaymentForm({
        student_id: '',
        invoice_id: '',
        amount_paid: '',
        payment_method: 'cash',
        reference_number: '',
        notes: ''
      });
      queryClient.invalidateQueries({ queryKey: ['payments'] });
      queryClient.invalidateQueries({ queryKey: ['invoices'] }); // Invalidate invoices to reflect status change
      queryClient.invalidateQueries({ queryKey: ['financial-summary'] }); // Invalidate summary
    },
    onError: (error: any) => {
      toast.error(error.message || 'Failed to record payment');
    }
  });

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
    }).format(amount);
  };

  const getPaymentMethodIcon = (method: PaymentMethod) => {
    const icons: Record<PaymentMethod, string> = {
      cash: '💵',
      cheque: ' cheques',
      bank_transfer: '🏦',
      upi: '📱',
      card: '💳',
      wallet: '👛',
      other: '📄'
    };
    return icons[method] || '📄';
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>Payment Records</CardTitle>
            <Dialog open={showPaymentDialog} onOpenChange={setShowPaymentDialog}>
              <DialogTrigger asChild>
                <Button>
                  <Plus className="h-4 w-4 mr-2" />
                  Record Payment
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Record Payment</DialogTitle>
                  <DialogDescription>
                    Enter details for a payment received from a student.
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-4 py-4">
                  <div className="space-y-2">
                    <Label htmlFor="student">Student *</Label>
                    <Select value={paymentForm.student_id} onValueChange={(value) => setPaymentForm({ ...paymentForm, student_id: value, invoice_id: '' })}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select Student" />
                      </SelectTrigger>
                      <SelectContent>
                        {students.map((s) => (
                          <SelectItem key={s.id} value={s.id}>
                            {s.name} - {s.grade}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="invoice">Allocate to Invoice (Optional)</Label>
                    <Select value={paymentForm.invoice_id} onValueChange={(value) => setPaymentForm({ ...paymentForm, invoice_id: value })}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select Invoice" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="">Do not allocate</SelectItem>
                        {studentInvoices.map((inv) => (
                          <SelectItem key={inv.id} value={inv.id}>
                            {inv.invoice_number} (Outstanding: {formatCurrency(inv.total_amount - inv.paid_amount)})
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="amount">Amount (₹) *</Label>
                    <Input
                      id="amount"
                      type="number"
                      step="0.01"
                      value={paymentForm.amount_paid}
                      onChange={(e) => setPaymentForm({ ...paymentForm, amount_paid: e.target.value })}
                      placeholder="0.00"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="method">Payment Method *</Label>
                    <Select
                      value={paymentForm.payment_method}
                      onValueChange={(value: PaymentMethod) => setPaymentForm({ ...paymentForm, payment_method: value })}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select Method" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="cash">Cash</SelectItem>
                        <SelectItem value="cheque">Cheque</SelectItem>
                        <SelectItem value="bank_transfer">Bank Transfer</SelectItem>
                        <SelectItem value="upi">UPI</SelectItem>
                        <SelectItem value="card">Card</SelectItem>
                        <SelectItem value="wallet">Wallet</SelectItem>
                        <SelectItem value="other">Other</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="reference">Reference Number</Label>
                    <Input
                      id="reference"
                      value={paymentForm.reference_number}
                      onChange={(e) => setPaymentForm({ ...paymentForm, reference_number: e.target.value })}
                      placeholder="e.g., CHQ-12345"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="notes">Notes</Label>
                    <Input
                      id="notes"
                      value={paymentForm.notes}
                      onChange={(e) => setPaymentForm({ ...paymentForm, notes: e.target.value })}
                      placeholder="Additional notes"
                    />
                  </div>
                  <Button
                    onClick={() => recordPaymentMutation.mutate()}
                    disabled={!paymentForm.student_id || !paymentForm.amount_paid || recordPaymentMutation.isPending}
                    className="w-full"
                  >
                    {recordPaymentMutation.isPending ? 'Recording...' : 'Record Payment'}
                  </Button>
                </div>
              </DialogContent>
            </Dialog>
          </div>
        </CardHeader>
        <CardContent>
          {paymentsLoading ? (
            <p>Loading payments...</p>
          ) : payments.length === 0 ? (
            <p className="text-muted-foreground text-center py-8">No payments recorded yet</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Student</TableHead>
                  <TableHead>Amount</TableHead>
                  <TableHead>Method</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead>Reference</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {payments.map((payment) => (
                  <TableRow key={payment.id}>
                    <TableCell className="font-medium">{payment.students?.name || 'N/A'}</TableCell>
                    <TableCell>{formatCurrency(payment.amount_paid)}</TableCell>
                    <TableCell>{getPaymentMethodIcon(payment.payment_method)} {payment.payment_method}</TableCell>
                    <TableCell>{new Date(payment.payment_date).toLocaleDateString()}</TableCell>
                    <TableCell>{payment.reference_number || '-'}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default PaymentTracking;