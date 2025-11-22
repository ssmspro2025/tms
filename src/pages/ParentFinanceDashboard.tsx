import { useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Invoice, Payment } from '@/integrations/supabase/finance-types';
import { AlertCircle, Download, Eye, ArrowLeft, CreditCard } from 'lucide-react';
import { isPast } from 'date-fns';

const ParentFinanceDashboard = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [selectedInvoice, setSelectedInvoice] = useState<Invoice | null>(null);
  const [showInvoiceDialog, setShowInvoiceDialog] = useState(false);

  // Check if user is parent with student
  if (user?.role !== 'parent' || !user?.student_id) {
    navigate('/login-parent');
    return null;
  }

  // Fetch student details
  const { data: student, isLoading: studentLoading } = useQuery({
    queryKey: ['student', user.student_id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('students')
        .select('*')
        .eq('id', user.student_id!)
        .single();

      if (error) throw error;
      return data;
    }
  });

  // Fetch student's invoices
  const { data: invoices = [], isLoading: invoicesLoading } = useQuery({
    queryKey: ['student-invoices', user.student_id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('invoices')
        .select('*')
        .eq('student_id', user.student_id!)
        .order('invoice_date', { ascending: false });

      if (error) throw error;
      return data as Invoice[];
    }
  });

  // Calculate summary
  const summary = {
    total_invoiced: invoices.reduce((sum, inv) => sum + inv.total_amount, 0),
    total_paid: invoices.reduce((sum, inv) => sum + inv.paid_amount, 0),
    total_outstanding: invoices.reduce((sum, inv) => sum + (inv.total_amount - inv.paid_amount), 0),
    overdue_count: invoices.filter(inv => 
      inv.status === 'overdue' || 
      (isPast(new Date(inv.due_date)) && ['issued', 'partial'].includes(inv.status))
    ).length
  };

  // Fetch payment history
  const { data: payments = [], isLoading: paymentsLoading } = useQuery({
    queryKey: ['student-payments', user.student_id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('payments')
        .select('*')
        .eq('student_id', user.student_id!)
        .order('payment_date', { ascending: false });

      if (error) throw error;
      return data;
    }
  });

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
    }).format(amount);
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

  const handleViewInvoice = (invoice: Invoice) => {
    setSelectedInvoice(invoice);
    setShowInvoiceDialog(true);
  };

  const handleOnlinePayment = (invoiceId: string, amount: number) => {
    // Placeholder for online payment integration
    alert(`Initiating online payment for Invoice ID: ${invoiceId}, Amount: ${formatCurrency(amount)}. (Integration not yet implemented)`);
    console.log("Online payment initiated for:", { invoiceId, amount });
  };

  const handleDownloadPdf = (invoiceId: string) => {
    // Placeholder for PDF generation
    alert(`Generating PDF for Invoice ID: ${invoiceId}. (PDF generation not yet implemented)`);
    console.log("PDF download initiated for:", { invoiceId });
  };

  if (studentLoading) {
    return <div className="p-6">Loading...</div>;
  }

  return (
    <div className="min-h-screen bg-background p-6">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-4xl font-bold mb-2">Finance & Invoices</h1>
            <p className="text-muted-foreground">
              Student: <span className="font-semibold">{student?.name}</span>
            </p>
          </div>
          <Button variant="outline" onClick={() => navigate('/parent-dashboard')}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Dashboard
          </Button>
        </div>

        {/* Alert for Overdue */}
        {summary.overdue_count > 0 && (
          <Card className="mb-6 border-red-200 bg-red-50">
            <CardContent className="flex items-center gap-3 pt-6">
              <AlertCircle className="h-5 w-5 text-red-600" />
              <div>
                <p className="font-semibold text-red-900">
                  {summary.overdue_count} overdue invoice{summary.overdue_count > 1 ? 's' : ''}
                </p>
                <p className="text-sm text-red-700">
                  These invoices require immediate attention
                </p>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Summary Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Total Invoiced
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{formatCurrency(summary.total_invoiced)}</div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Total Paid
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-green-600">{formatCurrency(summary.total_paid)}</div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Outstanding
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className={`text-2xl font-bold ${summary.total_outstanding > 0 ? 'text-orange-600' : 'text-green-600'}`}>
                {formatCurrency(summary.total_outstanding)}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Collection Rate
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {summary.total_invoiced > 0 
                  ? `${Math.round((summary.total_paid / summary.total_invoiced) * 100)}%`
                  : 'N/A'
                }
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Tabs */}
        <Tabs defaultValue="invoices" className="space-y-6">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="invoices">Invoices</TabsTrigger>
            <TabsTrigger value="payments">Payment History</TabsTrigger>
          </TabsList>

          <TabsContent value="invoices">
            <Card>
              <CardHeader>
                <CardTitle>Your Invoices</CardTitle>
              </CardHeader>
              <CardContent>
                {invoicesLoading ? (
                  <p>Loading invoices...</p>
                ) : invoices.length === 0 ? (
                  <p className="text-muted-foreground text-center py-8">No invoices</p>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Invoice #</TableHead>
                        <TableHead>Month</TableHead>
                        <TableHead>Total</TableHead>
                        <TableHead>Paid</TableHead>
                        <TableHead>Outstanding</TableHead>
                        <TableHead>Due Date</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Action</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {invoices.map((invoice) => (
                        <TableRow key={invoice.id}>
                          <TableCell className="font-medium">{invoice.invoice_number}</TableCell>
                          <TableCell>{invoice.invoice_month}/{invoice.invoice_year}</TableCell>
                          <TableCell>{formatCurrency(invoice.total_amount)}</TableCell>
                          <TableCell>{formatCurrency(invoice.paid_amount)}</TableCell>
                          <TableCell className="font-semibold">
                            {formatCurrency(invoice.total_amount - invoice.paid_amount)}
                          </TableCell>
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
                              onClick={() => handleViewInvoice(invoice)}
                            >
                              <Eye className="h-4 w-4" />
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="payments">
            <Card>
              <CardHeader>
                <CardTitle>Payment History</CardTitle>
              </CardHeader>
              <CardContent>
                {paymentsLoading ? (
                  <p>Loading payment history...</p>
                ) : payments.length === 0 ? (
                  <p className="text-muted-foreground text-center py-8">No payments recorded</p>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Date</TableHead>
                        <TableHead>Amount</TableHead>
                        <TableHead>Method</TableHead>
                        <TableHead>Reference</TableHead>
                        <TableHead>Status</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {payments.map((payment: any) => (
                        <TableRow key={payment.id}>
                          <TableCell>{new Date(payment.payment_date).toLocaleDateString()}</TableCell>
                          <TableCell className="font-semibold">{formatCurrency(payment.amount_paid)}</TableCell>
                          <TableCell>
                            {payment.payment_method.replace('_', ' ').toUpperCase()}
                          </TableCell>
                          <TableCell>{payment.reference_number || '-'}</TableCell>
                          <TableCell>
                            <span className="px-3 py-1 rounded-full text-xs font-semibold bg-green-100 text-green-800">
                              Completed
                            </span>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        {/* Invoice Details Dialog */}
        <Dialog open={showInvoiceDialog} onOpenChange={setShowInvoiceDialog}>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>Invoice Details</DialogTitle>
              <DialogDescription>
                View the full details of this invoice, including line items and payment status.
              </DialogDescription>
            </DialogHeader>
            {selectedInvoice && (
              <div className="space-y-6">
                {/* Invoice Header */}
                <div className="border-b pb-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <p className="text-sm text-muted-foreground">Invoice Number</p>
                      <p className="font-semibold text-lg">{selectedInvoice.invoice_number}</p>
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">Invoice Date</p>
                      <p className="font-semibold">{new Date(selectedInvoice.invoice_date).toLocaleDateString()}</p>
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">Due Date</p>
                      <p className="font-semibold">{new Date(selectedInvoice.due_date).toLocaleDateString()}</p>
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">Status</p>
                      <span className={`px-3 py-1 rounded-full text-xs font-semibold inline-block ${getStatusColor(selectedInvoice.status)}`}>
                        {selectedInvoice.status.toUpperCase()}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Amount Summary */}
                <div className="bg-blue-50 p-4 rounded-lg border border-blue-200">
                  <div className="grid grid-cols-3 gap-4">
                    <div>
                      <p className="text-sm text-muted-foreground">Total Amount</p>
                      <p className="text-xl font-bold">{formatCurrency(selectedInvoice.total_amount)}</p>
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">Amount Paid</p>
                      <p className="text-xl font-bold text-green-600">{formatCurrency(selectedInvoice.paid_amount)}</p>
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">Outstanding</p>
                      <p className="text-xl font-bold text-orange-600">
                        {formatCurrency(selectedInvoice.total_amount - selectedInvoice.paid_amount)}
                      </p>
                    </div>
                  </div>
                </div>

                {/* Invoice Items */}
                {selectedInvoice.notes && (
                  <div>
                    <p className="text-sm font-semibold mb-2">Notes</p>
                    <p className="text-sm text-muted-foreground">{selectedInvoice.notes}</p>
                  </div>
                )}

                {/* Action Buttons */}
                <div className="flex gap-3">
                  <Button className="flex-1" variant="outline" onClick={() => handleDownloadPdf(selectedInvoice.id)}>
                    <Download className="h-4 w-4 mr-2" />
                    Download PDF
                  </Button>
                  {selectedInvoice.status !== 'paid' && (
                    <Button className="flex-1" onClick={() => handleOnlinePayment(selectedInvoice.id, selectedInvoice.total_amount - selectedInvoice.paid_amount)}>
                      <CreditCard className="h-4 w-4 mr-2" /> Make Payment
                    </Button>
                  )}
                </div>
              </div>
            )}
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
};

export default ParentFinanceDashboard;