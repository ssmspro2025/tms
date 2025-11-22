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
import { Plus, Eye, MoreHorizontal } from 'lucide-react';
import { Invoice, InvoiceWithItems } from '@/integrations/supabase/finance-types';
import { differenceInDays, isPast } from 'date-fns';

const InvoiceManagement = () => {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [showGenerateDialog, setShowGenerateDialog] = useState(false);
  const [selectedInvoice, setSelectedInvoice] = useState<InvoiceWithItems | null>(null);
  const [showViewDialog, setShowViewDialog] = useState(false);

  const [generateForm, setGenerateForm] = useState({
    month: new Date().getMonth() + 1,
    year: new Date().getFullYear(),
    academic_year: '2024-2025',
    due_in_days: 30,
    late_fee_per_day: 10 // Example late fee: 10 INR per day
  });

  // Fetch invoices for center
  const { data: invoices = [], isLoading: invoicesLoading } = useQuery({
    queryKey: ['invoices', user?.center_id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('invoices')
        .select('*, students(name)') // Fetch student name
        .eq('center_id', user?.center_id!)
        .order('invoice_date', { ascending: false });

      if (error) throw error;
      return data as (Invoice & { students: { name: string } })[];
    },
    enabled: !!user?.center_id
  });

  // Generate monthly invoices mutation
  const generateInvoicesMutation = useMutation({
    mutationFn: async () => {
      if (!user?.center_id) throw new Error('Center ID not found');

      // Call the new SQL database function
      const { data, error } = await supabase.rpc('generate_monthly_invoices_sql', {
        p_center_id: user.center_id,
        p_month: generateForm.month,
        p_year: generateForm.year,
        p_academic_year: generateForm.academic_year,
        p_due_in_days: generateForm.due_in_days,
        p_late_fee_per_day: generateForm.late_fee_per_day
      });

      if (error) {
        // Check for the specific notice message from the SQL function
        if (error.message.includes('Invoices already exist')) {
          toast.info(`Invoices for ${generateForm.month}/${generateForm.year} already exist. No new invoices generated.`);
          return { invoicesGenerated: 0 };
        }
        throw error;
      }
      
      // The RPC function returns a table, so data will be an array of objects
      const invoicesGeneratedCount = data ? data.length : 0;

      return { invoicesGenerated: invoicesGeneratedCount };
    },
    onSuccess: (data: any) => {
      if (data.invoicesGenerated > 0) {
        toast.success(`${data.invoicesGenerated} invoices generated successfully`);
      }
      setShowGenerateDialog(false);
      queryClient.invalidateQueries({ queryKey: ['invoices'] });
      queryClient.invalidateQueries({ queryKey: ['financial-summary'] }); // Invalidate summary
    },
    onError: (error: any) => {
      toast.error(error.message || 'Failed to generate invoices');
    }
  });

  // Fetch invoice details
  const fetchInvoiceDetails = async (invoiceId: string) => {
    const { data: invoice, error: invoiceError } = await supabase
      .from('invoices')
      .select('*, students(name)') // Fetch student name
      .eq('id', invoiceId)
      .single();

    if (invoiceError) throw invoiceError;

    const { data: items, error: itemsError } = await supabase
      .from('invoice_items')
      .select('*')
      .eq('invoice_id', invoiceId);

    if (itemsError) throw itemsError;

    return { ...invoice, invoice_items: items } as InvoiceWithItems;
  };

  const handleViewInvoice = async (invoiceId: string) => {
    try {
      const details = await fetchInvoiceDetails(invoiceId);
      setSelectedInvoice(details);
      setShowViewDialog(true);
    } catch (error: any) {
      toast.error('Failed to load invoice details');
    }
  };

  const getStatusColor = (status: string) => {
    const colors: Record<string, string> = {
      draft: 'bg-gray-100 text-gray-800',
      issued: 'bg-blue-100 text-blue-800',
      partial: 'bg-yellow-100 text-yellow-800',
      paid: 'bg-green-100 text-green-800',
      overdue: 'bg-red-100 text-red-800',
      cancelled: 'bg-slate-100 text-slate-800'
    };
    return colors[status] || 'bg-gray-100 text-gray-800';
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
    }).format(amount);
  };

  const calculateLateFee = (invoice: Invoice) => {
    if (invoice.status === 'paid' || invoice.status === 'cancelled') return 0;
    const dueDate = new Date(invoice.due_date);
    const today = new Date();
    if (isPast(dueDate) && invoice.total_amount > invoice.paid_amount) {
      const daysOverdue = differenceInDays(today, dueDate);
      return daysOverdue * (invoice.late_fee_per_day || 0); // Use invoice's stored late fee
    }
    return 0;
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>Invoice Management</CardTitle>
            <Dialog open={showGenerateDialog} onOpenChange={setShowGenerateDialog}>
              <DialogTrigger asChild>
                <Button>
                  <Plus className="h-4 w-4 mr-2" />
                  Generate Monthly Invoices
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Generate Monthly Invoices</DialogTitle>
                  <DialogDescription>
                    Automatically create invoices for all students with active fee assignments.
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-4 py-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="month">Month *</Label>
                      <Input
                        id="month"
                        type="number"
                        min="1"
                        max="12"
                        value={generateForm.month}
                        onChange={(e) => setGenerateForm({ ...generateForm, month: parseInt(e.target.value) })}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="year">Year *</Label>
                      <Input
                        id="year"
                        type="number"
                        value={generateForm.year}
                        onChange={(e) => setGenerateForm({ ...generateForm, year: parseInt(e.target.value) })}
                      />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="academic_year">Academic Year *</Label>
                    <Input
                      id="academic_year"
                      value={generateForm.academic_year}
                      onChange={(e) => setGenerateForm({ ...generateForm, academic_year: e.target.value })}
                      placeholder="2024-2025"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="due_in_days">Due in Days</Label>
                    <Input
                      id="due_in_days"
                      type="number"
                      value={generateForm.due_in_days}
                      onChange={(e) => setGenerateForm({ ...generateForm, due_in_days: parseInt(e.target.value) })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="late_fee_per_day">Late Fee per Day (₹)</Label>
                    <Input
                      id="late_fee_per_day"
                      type="number"
                      step="0.01"
                      value={generateForm.late_fee_per_day}
                      onChange={(e) => setGenerateForm({ ...generateForm, late_fee_per_day: parseFloat(e.target.value) })}
                    />
                  </div>
                  <p className="text-sm text-muted-foreground">
                    This will generate invoices for all students with active fee assignments
                  </p>
                  <Button
                    onClick={() => generateInvoicesMutation.mutate()}
                    disabled={generateInvoicesMutation.isPending}
                    className="w-full"
                  >
                    {generateInvoicesMutation.isPending ? 'Generating...' : 'Generate Invoices'}
                  </Button>
                </div>
              </DialogContent>
            </Dialog>
          </div>
        </CardHeader>
        <CardContent>
          {invoicesLoading ? (
            <p>Loading invoices...</p>
          ) : invoices.length === 0 ? (
            <p className="text-muted-foreground text-center py-8">
              No invoices generated yet. Generate monthly invoices to get started.
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Invoice #</TableHead>
                  <TableHead>Student</TableHead>
                  <TableHead>Month</TableHead>
                  <TableHead>Total Amount</TableHead>
                  <TableHead>Paid Amount</TableHead>
                  <TableHead>Outstanding</TableHead>
                  <TableHead>Late Fee</TableHead>
                  <TableHead>Due Date</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {invoices.map((invoice) => {
                  const lateFee = calculateLateFee(invoice);
                  const outstandingWithLateFee = (invoice.total_amount - invoice.paid_amount) + lateFee;
                  return (
                    <TableRow key={invoice.id}>
                      <TableCell className="font-medium">{invoice.invoice_number}</TableCell>
                      <TableCell>{invoice.students?.name || 'N/A'}</TableCell>
                      <TableCell>{invoice.invoice_month}/{invoice.invoice_year}</TableCell>
                      <TableCell>{formatCurrency(invoice.total_amount)}</TableCell>
                      <TableCell>{formatCurrency(invoice.paid_amount)}</TableCell>
                      <TableCell className="font-semibold">
                        {formatCurrency(outstandingWithLateFee)}
                      </TableCell>
                      <TableCell className="text-red-600">{lateFee > 0 ? formatCurrency(lateFee) : '-'}</TableCell>
                      <TableCell>{new Date(invoice.due_date).toLocaleDateString()}</TableCell>
                      <TableCell>
                        <span className={`px-3 py-1 rounded-full text-xs font-semibold ${getStatusColor(invoice.status)}`}>
                          {invoice.status.charAt(0).toUpperCase() + invoice.status.slice(1)}
                        </span>
                      </TableCell>
                      <TableCell>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleViewInvoice(invoice.id)}
                        >
                          <Eye className="h-4 w-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Invoice Details Dialog */}
      <Dialog open={showViewDialog} onOpenChange={setShowViewDialog}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Invoice Details</DialogTitle>
            <DialogDescription>
              Detailed view of the selected invoice and its items.
            </DialogDescription>
          </DialogHeader>
          {selectedInvoice && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-sm text-muted-foreground">Invoice Number</p>
                  <p className="font-semibold">{selectedInvoice.invoice_number}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Student Name</p>
                  <p className="font-semibold">{selectedInvoice.students?.name || 'N/A'}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Status</p>
                  <span className={`px-3 py-1 rounded-full text-xs font-semibold ${getStatusColor(selectedInvoice.status)}`}>
                    {selectedInvoice.status.charAt(0).toUpperCase() + selectedInvoice.status.slice(1)}
                  </span>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Invoice Date</p>
                  <p className="font-semibold">{new Date(selectedInvoice.invoice_date).toLocaleDateString()}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Due Date</p>
                  <p className="font-semibold">{new Date(selectedInvoice.due_date).toLocaleDateString()}</p>
                </div>
              </div>

              <div className="border-t pt-4">
                <h3 className="font-semibold mb-3">Invoice Items</h3>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Description</TableHead>
                      <TableHead className="text-right">Amount</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {selectedInvoice.invoice_items?.map((item) => (
                      <TableRow key={item.id}>
                        <TableCell>{item.description}</TableCell>
                        <TableCell className="text-right">{formatCurrency(item.total_amount)}</TableCell>
                      </TableRow>
                    ))}
                    <TableRow className="font-semibold">
                      <TableCell>Subtotal</TableCell>
                      <TableCell className="text-right">{formatCurrency(selectedInvoice.total_amount)}</TableCell>
                    </TableRow>
                    {calculateLateFee(selectedInvoice) > 0 && (
                      <TableRow className="font-semibold text-red-600">
                        <TableCell>Late Fee</TableCell>
                        <TableCell className="text-right">{formatCurrency(calculateLateFee(selectedInvoice))}</TableCell>
                      </TableRow>
                    )}
                    <TableRow className="font-bold text-lg">
                      <TableCell>Total Payable</TableCell>
                      <TableCell className="text-right">{formatCurrency(selectedInvoice.total_amount + calculateLateFee(selectedInvoice))}</TableCell>
                    </TableRow>
                  </TableBody>
                </Table>
              </div>

              <div className="bg-blue-50 p-4 rounded-lg">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-sm text-muted-foreground">Total Amount</p>
                    <p className="text-lg font-semibold">{formatCurrency(selectedInvoice.total_amount)}</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Paid Amount</p>
                    <p className="text-lg font-semibold">{formatCurrency(selectedInvoice.paid_amount)}</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Outstanding</p>
                    <p className="text-lg font-semibold text-orange-600">
                      {formatCurrency(selectedInvoice.total_amount - selectedInvoice.paid_amount)}
                    </p>
                  </div>
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default InvoiceManagement;