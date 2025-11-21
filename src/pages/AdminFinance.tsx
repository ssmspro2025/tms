import { useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { FinancialSummary as FinancialSummaryType } from '@/integrations/supabase/finance-types';
import { DollarSign, TrendingUp, TrendingDown, Wallet, AlertCircle, FileText, ArrowLeft } from 'lucide-react';
import FeeManagement from '@/components/finance/FeeManagement';
import InvoiceManagement from '@/components/finance/InvoiceManagement';
import PaymentTracking from '@/components/finance/PaymentTracking';
import ExpenseManagement from '@/components/finance/ExpenseManagement';
import FinanceReports from '@/components/finance/FinanceReports';

const AdminFinance = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth() + 1);
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());

  // Check admin permission
  if (user?.role !== 'admin') {
    navigate('/');
    return null;
  }

  // Fetch current month financial summary
  const { data: summary, isLoading: summaryLoading } = useQuery({
    queryKey: ['financial-summary', selectedMonth, selectedYear],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('financial_summaries')
        .select('*')
        .eq('summary_month', selectedMonth)
        .eq('summary_year', selectedYear)
        .single();

      if (error && error.code !== 'PGRST116') throw error; // PGRST116 = no rows found
      return data as FinancialSummaryType;
    }
  });

  // Fetch overdue invoices count
  const { data: overdueCount = 0 } = useQuery({
    queryKey: ['overdue-invoices'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('invoices')
        .select('id', { count: 'exact' })
        .eq('status', 'overdue');

      if (error) throw error;
      return data?.length || 0;
    }
  });

  // Fetch unpaid invoices count
  const { data: unpaidCount = 0 } = useQuery({
    queryKey: ['unpaid-invoices'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('invoices')
        .select('id', { count: 'exact' })
        .in('status', ['issued', 'overdue', 'partial']);

      if (error) throw error;
      return data?.length || 0;
    }
  });

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
    }).format(amount || 0);
  };

  return (
    <div className="min-h-screen bg-background p-6">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-4xl font-bold mb-2">Finance Management</h1>
            <p className="text-muted-foreground">Manage fees, invoices, payments, and financial reports</p>
          </div>
          <Button variant="outline" onClick={() => navigate('/admin-dashboard')}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Dashboard
          </Button>
        </div>

        {/* Summary Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
          {/* Total Invoiced */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Invoiced</CardTitle>
              <FileText className="h-4 w-4 text-blue-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {formatCurrency(summary?.total_invoiced || 0)}
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                {selectedMonth}/{selectedYear}
              </p>
            </CardContent>
          </Card>

          {/* Total Collected */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Collected</CardTitle>
              <TrendingUp className="h-4 w-4 text-green-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {formatCurrency(summary?.total_collected || 0)}
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                {summary?.total_invoiced ? 
                  `${Math.round((((summary.total_collected || 0) / summary.total_invoiced) * 100))}% collected` 
                  : 'No invoices'
                }
              </p>
            </CardContent>
          </Card>

          {/* Outstanding Amount */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Outstanding</CardTitle>
              <AlertCircle className="h-4 w-4 text-orange-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {formatCurrency(summary?.total_outstanding || 0)}
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                {unpaidCount} unpaid invoices
              </p>
            </CardContent>
          </Card>

          {/* Net Balance */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Net Balance</CardTitle>
              <Wallet className="h-4 w-4 text-purple-600" />
            </CardHeader>
            <CardContent>
              <div className={`text-2xl font-bold ${(summary?.net_balance || 0) >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                {formatCurrency(summary?.net_balance || 0)}
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                After expenses
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Alert for Overdue Invoices */}
        {overdueCount > 0 && (
          <Card className="mb-6 border-orange-200 bg-orange-50">
            <CardContent className="flex items-center gap-3 pt-6">
              <AlertCircle className="h-5 w-5 text-orange-600" />
              <div>
                <p className="font-semibold text-orange-900">
                  {overdueCount} overdue invoices
                </p>
                <p className="text-sm text-orange-700">
                  These invoices require immediate attention
                </p>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Tabs for Finance Sections */}
        <Tabs defaultValue="invoices" className="space-y-6">
          <TabsList className="grid w-full grid-cols-5">
            <TabsTrigger value="invoices">Invoices</TabsTrigger>
            <TabsTrigger value="fees">Fees</TabsTrigger>
            <TabsTrigger value="payments">Payments</TabsTrigger>
            <TabsTrigger value="expenses">Expenses</TabsTrigger>
            <TabsTrigger value="reports">Reports</TabsTrigger>
          </TabsList>

          <TabsContent value="invoices">
            <InvoiceManagement />
          </TabsContent>

          <TabsContent value="fees">
            <FeeManagement />
          </TabsContent>

          <TabsContent value="payments">
            <PaymentTracking />
          </TabsContent>

          <TabsContent value="expenses">
            <ExpenseManagement />
          </TabsContent>

          <TabsContent value="reports">
            <FinanceReports />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
};

export default AdminFinance;
