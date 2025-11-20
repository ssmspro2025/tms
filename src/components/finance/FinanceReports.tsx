import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { FinancialSummary } from '@/integrations/supabase/finance-types';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';

const FinanceReports = () => {
  const { user } = useAuth();

  // Fetch financial summaries for trend
  const { data: summaries = [], isLoading: summariesLoading } = useQuery({
    queryKey: ['financial-summaries-trend', user?.center_id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('financial_summaries')
        .select('*')
        .eq('center_id', user?.center_id!)
        .order('summary_year', { ascending: false })
        .order('summary_month', { ascending: false })
        .limit(12);

      if (error) throw error;
      return data as FinancialSummary[];
    },
    enabled: !!user?.center_id
  });

  // Fetch expense breakdown
  const { data: expenses = [], isLoading: expensesLoading } = useQuery({
    queryKey: ['expense-breakdown', user?.center_id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('expenses')
        .select('expense_category, amount')
        .eq('center_id', user?.center_id!);

      if (error) throw error;

      // Group by category
      const grouped: Record<string, number> = {};
      data?.forEach((expense: any) => {
        grouped[expense.expense_category] = (grouped[expense.expense_category] || 0) + parseFloat(expense.amount);
      });

      return Object.entries(grouped).map(([category, amount]) => ({
        name: category.replace('_', ' ').toUpperCase(),
        value: amount
      }));
    },
    enabled: !!user?.center_id
  });

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
    }).format(amount);
  };

  const COLORS = ['#ef4444', '#f97316', '#eab308', '#22c55e', '#3b82f6', '#8b5cf6', '#ec4899', '#06b6d4'];

  // Prepare chart data
  const trendData = summaries.reverse().map(s => ({
    month: `${s.summary_month}/${s.summary_year}`,
    collected: parseFloat(s.total_collected.toString()),
    invoiced: parseFloat(s.total_invoiced.toString()),
    expenses: parseFloat(s.total_expenses.toString())
  }));

  return (
    <div className="space-y-6">
      {/* Revenue Trend */}
      <Card>
        <CardHeader>
          <CardTitle>Revenue Trend (Last 12 Months)</CardTitle>
        </CardHeader>
        <CardContent>
          {summariesLoading ? (
            <p>Loading trend data...</p>
          ) : trendData.length === 0 ? (
            <p className="text-muted-foreground text-center py-8">No data available</p>
          ) : (
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={trendData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="month" />
                <YAxis />
                <Tooltip formatter={(value) => formatCurrency(value as number)} />
                <Legend />
                <Bar dataKey="invoiced" fill="#3b82f6" name="Invoiced" />
                <Bar dataKey="collected" fill="#10b981" name="Collected" />
                <Bar dataKey="expenses" fill="#ef4444" name="Expenses" />
              </BarChart>
            </ResponsiveContainer>
          )}
        </CardContent>
      </Card>

      {/* Expense Breakdown */}
      <Card>
        <CardHeader>
          <CardTitle>Expense Breakdown</CardTitle>
        </CardHeader>
        <CardContent>
          {expensesLoading ? (
            <p>Loading expense data...</p>
          ) : expenses.length === 0 ? (
            <p className="text-muted-foreground text-center py-8">No expenses recorded</p>
          ) : (
            <div className="flex flex-col lg:flex-row gap-8">
              <ResponsiveContainer width={300} height={300}>
                <PieChart>
                  <Pie
                    data={expenses}
                    cx={150}
                    cy={150}
                    labelLine={false}
                    label={({ name, value }) => `${name}: ${formatCurrency(value)}`}
                    outerRadius={80}
                    fill="#8884d8"
                    dataKey="value"
                  >
                    {expenses.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(value) => formatCurrency(value as number)} />
                </PieChart>
              </ResponsiveContainer>
              <div className="flex-1">
                <h3 className="font-semibold mb-4">Expense Summary</h3>
                <div className="space-y-3">
                  {expenses.map((expense, index) => (
                    <div key={index} className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <div
                          className="w-3 h-3 rounded-full"
                          style={{ backgroundColor: COLORS[index % COLORS.length] }}
                        />
                        <span className="text-sm">{expense.name}</span>
                      </div>
                      <span className="font-semibold">{formatCurrency(expense.value)}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Summary Statistics */}
      {summaries.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">Total Invoiced (Current Period)</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {formatCurrency(summaries[0].total_invoiced)}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">Total Collected (Current Period)</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-green-600">
                {formatCurrency(summaries[0].total_collected)}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">Collection Rate</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {summaries[0].total_invoiced > 0
                  ? `${Math.round((summaries[0].total_collected / summaries[0].total_invoiced) * 100)}%`
                  : 'N/A'}
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
};

export default FinanceReports;
