import React, { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { DollarSign, CreditCard } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';

interface InvoiceData {
  id: string;
  invoice_number: string;
  invoice_date: string;
  due_date: string;
  total_amount: number;
  paid_amount: number;
  remaining_amount: number;
  status: string;
}

interface PaymentData {
  id: string;
  invoice_id: string;
  amount: number;
  payment_date: string;
  payment_method: string;
  reference_number: string;
}

const ParentFinancePanel = () => {
  const { user } = useAuth();
  const [invoices, setInvoices] = useState<InvoiceData[]>([]);
  const [payments, setPayments] = useState<PaymentData[]>([]);
  const [loading, setLoading] = useState(false);
  const [studentId, setStudentId] = useState<string>('');

  useEffect(() => {
    if (user?.student_id) {
      setStudentId(user.student_id);
      fetchFinanceData(user.student_id);
    }
  }, [user]);

  const fetchFinanceData = async (studId: string) => {
    try {
      setLoading(true);

      // Fetch invoices
      const { data: invoiceData, error: invError } = await supabase
        .from('invoices')
        .select('*')
        .eq('student_id', studId)
        .order('invoice_date', { ascending: false });

      if (invError) throw invError;
      setInvoices(invoiceData || []);

      // Fetch payments
      const { data: paymentData, error: payError } = await supabase
        .from('payments')
        .select('*')
        .eq('student_id', studId)
        .order('payment_date', { ascending: false });

      if (payError) throw payError;
      setPayments(paymentData || []);
    } catch (error) {
      console.error('Error fetching finance data:', error);
    } finally {
      setLoading(false);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'paid':
        return 'bg-green-100 text-green-800';
      case 'partial':
        return 'bg-blue-100 text-blue-800';
      case 'due':
        return 'bg-yellow-100 text-yellow-800';
      case 'overdue':
        return 'bg-red-100 text-red-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const totalDues = invoices.reduce((sum, inv) => sum + inv.remaining_amount, 0);
  const totalPaid = invoices.reduce((sum, inv) => sum + inv.paid_amount, 0);

  return (
    <div className="space-y-6">
      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-600">Total Paid</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-green-600">₹{totalPaid.toFixed(2)}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-600">Outstanding Dues</CardTitle>
          </CardHeader>
          <CardContent>
            <div className={`text-3xl font-bold ${totalDues > 0 ? 'text-red-600' : 'text-green-600'}`}>
              ₹{totalDues.toFixed(2)}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-600">Total Invoices</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{invoices.length}</div>
          </CardContent>
        </Card>
      </div>

      {/* Invoices */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <DollarSign className="h-5 w-5" />
            Invoices
          </CardTitle>
          <CardDescription>View and pay your invoices</CardDescription>
        </CardHeader>
        <CardContent>
          {invoices.length > 0 ? (
            <div className="space-y-4">
              {invoices.map((invoice) => (
                <div key={invoice.id} className="border rounded-lg p-4">
                  <div className="flex justify-between items-start mb-3">
                    <div>
                      <p className="font-semibold text-lg">{invoice.invoice_number}</p>
                      <p className="text-sm text-gray-600">
                        Issued: {invoice.invoice_date} | Due: {invoice.due_date}
                      </p>
                    </div>
                    <span className={`px-3 py-1 rounded-full text-sm font-medium ${getStatusColor(invoice.status)}`}>
                      {invoice.status.toUpperCase()}
                    </span>
                  </div>

                  <div className="grid grid-cols-3 gap-4 mb-4">
                    <div>
                      <p className="text-sm text-gray-600">Total Amount</p>
                      <p className="text-xl font-semibold">₹{invoice.total_amount.toFixed(2)}</p>
                    </div>
                    <div>
                      <p className="text-sm text-gray-600">Paid</p>
                      <p className="text-xl font-semibold text-green-600">₹{invoice.paid_amount.toFixed(2)}</p>
                    </div>
                    <div>
                      <p className="text-sm text-gray-600">Remaining</p>
                      <p className={`text-xl font-semibold ${invoice.remaining_amount > 0 ? 'text-red-600' : 'text-green-600'}`}>
                        ₹{invoice.remaining_amount.toFixed(2)}
                      </p>
                    </div>
                  </div>

                  {invoice.status !== 'paid' && invoice.remaining_amount > 0 && (
                    <Button className="w-full">
                      <CreditCard className="h-4 w-4 mr-2" />
                      Pay Now (₹{invoice.remaining_amount.toFixed(2)})
                    </Button>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <p className="text-gray-600 text-center py-8">No invoices found</p>
          )}
        </CardContent>
      </Card>

      {/* Payment History */}
      {payments.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Payment History</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b">
                    <th className="text-left py-3 px-4">Date</th>
                    <th className="text-left py-3 px-4">Amount</th>
                    <th className="text-left py-3 px-4">Method</th>
                    <th className="text-left py-3 px-4">Reference</th>
                  </tr>
                </thead>
                <tbody>
                  {payments.map((payment) => (
                    <tr key={payment.id} className="border-b">
                      <td className="py-3 px-4">{payment.payment_date}</td>
                      <td className="py-3 px-4 font-semibold">₹{payment.amount.toFixed(2)}</td>
                      <td className="py-3 px-4 capitalize">{payment.payment_method}</td>
                      <td className="py-3 px-4">{payment.reference_number || '-'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default ParentFinancePanel;
