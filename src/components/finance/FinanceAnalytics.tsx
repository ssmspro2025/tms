import React, { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useAuth } from '@/contexts/AuthContext';

interface MonthlyStats {
  month: string;
  revenue: number;
  expenses: number;
  paid: number;
  dues: number;
}

const FinanceAnalytics = () => {
  const { user } = useAuth();
  const [monthlyData, setMonthlyData] = useState<MonthlyStats[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (user?.center_id) {
      fetchAnalytics();
    }
  }, [user]);

  const fetchAnalytics = async () => {
    try {
      setLoading(true);

      // Get last 12 months data
      const months: MonthlyStats[] = [];

      for (let i = 11; i >= 0; i--) {
        const date = new Date();
        date.setMonth(date.getMonth() - i);
        const monthStr = date.toLocaleString('default', { month: 'short', year: '2-digit' });
        const startDate = new Date(date.getFullYear(), date.getMonth(), 1).toISOString().split('T')[0];
        const endDate = new Date(date.getFullYear(), date.getMonth() + 1, 0).toISOString().split('T')[0];

        // Fetch invoices for this month
        const { data: invoiceData } = await supabase
          .from('invoices')
          .select('total_amount, paid_amount')
          .eq('center_id', user?.center_id)
          .gte('invoice_date', startDate)
          .lte('invoice_date', endDate);

        // Fetch expenses for this month
        const { data: expenseData } = await supabase
          .from('expenses')
          .select('amount')
          .eq('center_id', user?.center_id)
          .gte('expense_date', startDate)
          .lte('expense_date', endDate);

        let totalRevenue = 0;
        let totalPaid = 0;

        invoiceData?.forEach((inv: any) => {
          totalRevenue += inv.total_amount;
          totalPaid += inv.paid_amount;
        });

        const totalExpenses = expenseData?.reduce((sum: number, exp: any) => sum + exp.amount, 0) || 0;

        months.push({
          month: monthStr,
          revenue: totalRevenue,
          expenses: totalExpenses,
          paid: totalPaid,
          dues: totalRevenue - totalPaid,
        });
      }

      setMonthlyData(months);
    } catch (error) {
      console.error('Error fetching analytics:', error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Monthly Financial Summary</CardTitle>
          <CardDescription>Last 12 months revenue, expenses, and collections</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b">
                  <th className="text-left py-3 px-4">Month</th>
                  <th className="text-right py-3 px-4">Revenue</th>
                  <th className="text-right py-3 px-4">Collections</th>
                  <th className="text-right py-3 px-4">Dues</th>
                  <th className="text-right py-3 px-4">Expenses</th>
                  <th className="text-right py-3 px-4">Net</th>
                </tr>
              </thead>
              <tbody>
                {monthlyData.map((month, idx) => (
                  <tr key={idx} className="border-b hover:bg-gray-50">
                    <td className="py-3 px-4 font-medium">{month.month}</td>
                    <td className="text-right py-3 px-4">₹{month.revenue.toFixed(0)}</td>
                    <td className="text-right py-3 px-4 text-green-600">₹{month.paid.toFixed(0)}</td>
                    <td className="text-right py-3 px-4 text-red-600">₹{month.dues.toFixed(0)}</td>
                    <td className="text-right py-3 px-4 text-orange-600">₹{month.expenses.toFixed(0)}</td>
                    <td className="text-right py-3 px-4 font-semibold">₹{(month.paid - month.expenses).toFixed(0)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Total Revenue (12M)</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">₹{monthlyData.reduce((sum, m) => sum + m.revenue, 0).toFixed(0)}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Total Collections (12M)</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">₹{monthlyData.reduce((sum, m) => sum + m.paid, 0).toFixed(0)}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Total Expenses (12M)</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-orange-600">₹{monthlyData.reduce((sum, m) => sum + m.expenses, 0).toFixed(0)}</div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default FinanceAnalytics;
