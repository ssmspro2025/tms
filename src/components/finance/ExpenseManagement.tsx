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
import { Expense, ExpenseCategory } from '@/integrations/supabase/finance-types';

const ExpenseManagement = () => {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [showExpenseDialog, setShowExpenseDialog] = useState(false);

  const [expenseForm, setExpenseForm] = useState({
    expense_category: 'admin' as ExpenseCategory,
    description: '',
    amount: '',
    payment_method: 'cash',
    reference_number: '',
    notes: ''
  });

  // Fetch expenses
  const { data: expenses = [], isLoading: expensesLoading } = useQuery({
    queryKey: ['expenses', user?.center_id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('expenses')
        .select('*')
        .eq('center_id', user?.center_id!)
        .order('expense_date', { ascending: false });

      if (error) throw error;
      return data as Expense[];
    },
    enabled: !!user?.center_id
  });

  // Create expense mutation
  const createExpenseMutation = useMutation({
    mutationFn: async () => {
      if (!user?.center_id) throw new Error('Center ID not found');

      const { error } = await supabase
        .from('expenses')
        .insert({
          center_id: user.center_id,
          expense_category: expenseForm.expense_category,
          description: expenseForm.description,
          amount: parseFloat(expenseForm.amount),
          expense_date: new Date().toISOString().split('T')[0],
          payment_method: expenseForm.payment_method,
          reference_number: expenseForm.reference_number || null,
          notes: expenseForm.notes || null,
          is_approved: false,
          created_by_user_id: user.id
        });

      if (error) throw error;
    },
    onSuccess: () => {
      toast.success('Expense recorded successfully');
      setShowExpenseDialog(false);
      setExpenseForm({
        expense_category: 'admin',
        description: '',
        amount: '',
        payment_method: 'cash',
        reference_number: '',
        notes: ''
      });
      queryClient.invalidateQueries({ queryKey: ['expenses'] });
    },
    onError: (error: any) => {
      toast.error(error.message || 'Failed to record expense');
    }
  });

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
    }).format(amount);
  };

  const getCategoryColor = (category: ExpenseCategory) => {
    const colors: Record<ExpenseCategory, string> = {
      salaries: 'bg-red-100 text-red-800',
      rent: 'bg-orange-100 text-orange-800',
      utilities: 'bg-yellow-100 text-yellow-800',
      materials: 'bg-blue-100 text-blue-800',
      maintenance: 'bg-purple-100 text-purple-800',
      transport: 'bg-green-100 text-green-800',
      admin: 'bg-slate-100 text-slate-800',
      other: 'bg-gray-100 text-gray-800'
    };
    return colors[category] || 'bg-gray-100 text-gray-800';
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>Expense Records</CardTitle>
            <Dialog open={showExpenseDialog} onOpenChange={setShowExpenseDialog}>
              <DialogTrigger asChild>
                <Button>
                  <Plus className="h-4 w-4 mr-2" />
                  Record Expense
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Record Expense</DialogTitle>
                  <DialogDescription>
                    Enter details for a new operating expense.
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-4 py-4">
                  <div className="space-y-2">
                    <Label htmlFor="category">Category *</Label>
                    <select
                      id="category"
                      value={expenseForm.expense_category}
                      onChange={(e) => setExpenseForm({ ...expenseForm, expense_category: e.target.value as ExpenseCategory })}
                      className="w-full px-3 py-2 border rounded-md"
                    >
                      <option value="salaries">Salaries</option>
                      <option value="rent">Rent</option>
                      <option value="utilities">Utilities</option>
                      <option value="materials">Materials</option>
                      <option value="maintenance">Maintenance</option>
                      <option value="transport">Transport</option>
                      <option value="admin">Admin</option>
                      <option value="other">Other</option>
                    </select>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="description">Description *</Label>
                    <Input
                      id="description"
                      value={expenseForm.description}
                      onChange={(e) => setExpenseForm({ ...expenseForm, description: e.target.value })}
                      placeholder="e.g., Monthly office rent"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="amount">Amount (₹) *</Label>
                    <Input
                      id="amount"
                      type="number"
                      step="0.01"
                      value={expenseForm.amount}
                      onChange={(e) => setExpenseForm({ ...expenseForm, amount: e.target.value })}
                      placeholder="0.00"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="payment_method">Payment Method</Label>
                    <select
                      id="payment_method"
                      value={expenseForm.payment_method}
                      onChange={(e) => setExpenseForm({ ...expenseForm, payment_method: e.target.value })}
                      className="w-full px-3 py-2 border rounded-md"
                    >
                      <option value="cash">Cash</option>
                      <option value="cheque">Cheque</option>
                      <option value="bank_transfer">Bank Transfer</option>
                      <option value="card">Card</option>
                      <option value="other">Other</option>
                    </select>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="ref_number">Reference Number</Label>
                    <Input
                      id="ref_number"
                      value={expenseForm.reference_number}
                      onChange={(e) => setExpenseForm({ ...expenseForm, reference_number: e.target.value })}
                      placeholder="e.g., CHQ-12345"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="exp_notes">Notes</Label>
                    <Input
                      id="exp_notes"
                      value={expenseForm.notes}
                      onChange={(e) => setExpenseForm({ ...expenseForm, notes: e.target.value })}
                      placeholder="Additional notes"
                    />
                  </div>
                  <Button
                    onClick={() => createExpenseMutation.mutate()}
                    disabled={!expenseForm.description || !expenseForm.amount || createExpenseMutation.isPending}
                    className="w-full"
                  >
                    {createExpenseMutation.isPending ? 'Recording...' : 'Record Expense'}
                  </Button>
                </div>
              </DialogContent>
            </Dialog>
          </div>
        </CardHeader>
        <CardContent>
          {expensesLoading ? (
            <p>Loading expenses...</p>
          ) : expenses.length === 0 ? (
            <p className="text-muted-foreground text-center py-8">No expenses recorded yet</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Description</TableHead>
                  <TableHead>Category</TableHead>
                  <TableHead>Amount</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {expenses.map((expense) => (
                  <TableRow key={expense.id}>
                    <TableCell className="font-medium">{expense.description}</TableCell>
                    <TableCell>
                      <span className={`px-3 py-1 rounded-full text-xs font-semibold ${getCategoryColor(expense.expense_category)}`}>
                        {expense.expense_category.replace('_', ' ')}
                      </span>
                    </TableCell>
                    <TableCell>{formatCurrency(expense.amount)}</TableCell>
                    <TableCell>{new Date(expense.expense_date).toLocaleDateString()}</TableCell>
                    <TableCell>
                      {expense.is_approved ? (
                        <span className="text-green-600 flex items-center gap-1">
                          <Check className="h-4 w-4" />
                          Approved
                        </span>
                      ) : (
                        <span className="text-orange-600">Pending</span>
                      )}
                    </TableCell>
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

export default ExpenseManagement;