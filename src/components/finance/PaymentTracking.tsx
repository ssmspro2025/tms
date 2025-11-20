import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { toast } from 'sonner';
import { Plus, Check } from 'lucide-react';
import { Payment, PaymentMethod } from '@/integrations/supabase/finance-types';

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

  // Fetch payments
  const { data: payments = [], isLoading: paymentsLoading } = useQuery({
    queryKey: ['payments', user?.center_id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('payments')
        .select('*')
        .eq('center_id', user?.center_id!)
        .order('payment_date', { ascending: false });

      if (error) throw error;
      return data as Payment[];
    },
    enabled: !!user?.center_id
  });

  // Record payment mutation
  const recordPaymentMutation = useMutation({
    mutationFn: async () => {
      if (!user?.center_id || !paymentForm.student_id) throw new Error('Missing required fields');

      const { error } = await supabase
        .from('payments')
        .insert({
          center_id: user.center_id,
          student_id: paymentForm.student_id,
          invoice_id: paymentForm.invoice_id || null,
          amount_paid: parseFloat(paymentForm.amount_paid),
          payment_method: paymentForm.payment_method,
          reference_number: paymentForm.reference_number || null,
          notes: paymentForm.notes || null,
          payment_date: new Date().toISOString().split('T')[0],
          received_by_user_id: user.id
        });

      if (error) throw error;
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
      cheque: '���',
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
                </DialogHeader>
                <div className="space-y-4 py-4">
                  <div className="space-y-2">
                    <Label htmlFor="student">Student ID *</Label>
                    <Input
                      id="student"
                      value={paymentForm.student_id}
                      onChange={(e) => setPaymentForm({ ...paymentForm, student_id: e.target.value })}
                      placeholder="Enter student ID"
                    />
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
                    <select
                      id="method"
                      value={paymentForm.payment_method}
                      onChange={(e) => setPaymentForm({ ...paymentForm, payment_method: e.target.value as PaymentMethod })}
                      className="w-full px-3 py-2 border rounded-md"
                    >
                      <option value="cash">Cash</option>
                      <option value="cheque">Cheque</option>
                      <option value="bank_transfer">Bank Transfer</option>
                      <option value="upi">UPI</option>
                      <option value="card">Card</option>
                      <option value="wallet">Wallet</option>
                      <option value="other">Other</option>
                    </select>
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
                  <TableHead>Student ID</TableHead>
                  <TableHead>Amount</TableHead>
                  <TableHead>Method</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead>Reference</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {payments.map((payment) => (
                  <TableRow key={payment.id}>
                    <TableCell className="font-medium">{payment.student_id}</TableCell>
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
