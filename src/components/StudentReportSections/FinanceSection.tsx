import React, { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { DollarSign, AlertCircle } from 'lucide-react';

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

interface FinanceSectionProps {
  studentId: string;
}

const FinanceSection: React.FC<FinanceSectionProps> = ({ studentId }) => {
  const [invoices, setInvoices] = useState<InvoiceData[]>([]);
  const [loading, setLoading] = useState(false);
  const [stats, setStats] = useState({
    totalInvoiced: 0,
    totalPaid: 0,
    outstanding: 0,
  });

  useEffect(() => {
    if (studentId) {
      fetchFinanceData();
    }
  }, [studentId]);

  const fetchFinanceData = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('invoices')
        .select('*')
        .eq('student_id', studentId)
        .order('invoice_date', { ascending: false });

      if (error) throw error;

      setInvoices(data || []);

      // Calculate stats
      let totalInvoiced = 0;
      let totalPaid = 0;

      data?.forEach((inv: InvoiceData) => {
        totalInvoiced += inv.total_amount;
        totalPaid += inv.paid_amount;
      });

      setStats({
        totalInvoiced,
        totalPaid,
        outstanding: totalInvoiced - totalPaid,
      });
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

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <DollarSign className="h-5 w-5" />
          Fee & Finance Summary
        </CardTitle>
        <CardDescription>Invoice and payment history</CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Finance Stats */}
        <div className="grid grid-cols-3 gap-4">
          <div className="p-4 bg-blue-50 rounded-lg">
            <p className="text-sm text-gray-600">Total Invoiced</p>
            <p className="text-2xl font-bold">₹{stats.totalInvoiced.toFixed(2)}</p>
          </div>
          <div className="p-4 bg-green-50 rounded-lg">
            <p className="text-sm text-gray-600">Total Paid</p>
            <p className="text-2xl font-bold text-green-600">₹{stats.totalPaid.toFixed(2)}</p>
          </div>
          <div className={`p-4 ${stats.outstanding > 0 ? 'bg-red-50' : 'bg-green-50'} rounded-lg`}>
            <p className="text-sm text-gray-600">Outstanding</p>
            <p className={`text-2xl font-bold ${stats.outstanding > 0 ? 'text-red-600' : 'text-green-600'}`}>
              ₹{stats.outstanding.toFixed(2)}
            </p>
          </div>
        </div>

        {/* Invoices Table */}
        {invoices.length > 0 ? (
          <div>
            <h3 className="font-semibold mb-3">Recent Invoices</h3>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b">
                    <th className="text-left py-2">Invoice #</th>
                    <th className="text-left py-2">Date</th>
                    <th className="text-right py-2">Amount</th>
                    <th className="text-right py-2">Paid</th>
                    <th className="text-left py-2">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {invoices.slice(0, 5).map((inv) => (
                    <tr key={inv.id} className="border-b hover:bg-gray-50">
                      <td className="py-2 font-medium">{inv.invoice_number}</td>
                      <td className="py-2">{inv.invoice_date}</td>
                      <td className="text-right py-2">₹{inv.total_amount.toFixed(2)}</td>
                      <td className="text-right py-2">₹{inv.paid_amount.toFixed(2)}</td>
                      <td className="py-2">
                        <span className={`px-2 py-1 rounded text-xs font-medium ${getStatusColor(inv.status)}`}>
                          {inv.status}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        ) : (
          <p className="text-gray-600 text-sm">No invoices found</p>
        )}
      </CardContent>
    </Card>
  );
};

export default FinanceSection;
