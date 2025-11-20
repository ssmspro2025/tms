import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { toast } from 'sonner';
import { Plus, Edit, Trash2, Check } from 'lucide-react';
import { FeeHeading, FeeStructure } from '@/integrations/supabase/finance-types';

const FeeManagement = () => {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [showHeadingDialog, setShowHeadingDialog] = useState(false);
  const [showStructureDialog, setShowStructureDialog] = useState(false);
  const [editingHeading, setEditingHeading] = useState<FeeHeading | null>(null);
  const [editingStructure, setEditingStructure] = useState<FeeStructure | null>(null);
  const [selectedHeading, setSelectedHeading] = useState<string>('');
  const [academicYear, setAcademicYear] = useState(new Date().getFullYear().toString());

  const [headingForm, setHeadingForm] = useState({
    heading_name: '',
    heading_code: '',
    description: ''
  });

  const [structureForm, setStructureForm] = useState({
    fee_heading_id: '',
    grade: '',
    amount: '',
    effective_from: new Date().toISOString().split('T')[0]
  });

  // Fetch fee headings
  const { data: headings = [], isLoading: headingsLoading } = useQuery({
    queryKey: ['fee-headings', user?.center_id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('fee_headings')
        .select('*')
        .eq('center_id', user?.center_id!)
        .order('sort_order');

      if (error) throw error;
      return data as FeeHeading[];
    },
    enabled: !!user?.center_id
  });

  // Fetch fee structures
  const { data: structures = [], isLoading: structuresLoading } = useQuery({
    queryKey: ['fee-structures', selectedHeading, academicYear],
    queryFn: async () => {
      let query = supabase
        .from('fee_structures')
        .select('*')
        .eq('center_id', user?.center_id!)
        .eq('academic_year', academicYear);

      if (selectedHeading) {
        query = query.eq('fee_heading_id', selectedHeading);
      }

      const { data, error } = await query.order('grade');
      if (error) throw error;
      return data as FeeStructure[];
    },
    enabled: !!user?.center_id
  });

  // Create heading mutation
  const createHeadingMutation = useMutation({
    mutationFn: async () => {
      if (!user?.center_id) throw new Error('Center ID not found');

      const { error } = await supabase
        .from('fee_headings')
        .insert({
          center_id: user.center_id,
          heading_name: headingForm.heading_name,
          heading_code: headingForm.heading_code,
          description: headingForm.description || null,
          is_active: true,
          sort_order: headings.length
        });

      if (error) throw error;
    },
    onSuccess: () => {
      toast.success('Fee heading created successfully');
      setShowHeadingDialog(false);
      setHeadingForm({ heading_name: '', heading_code: '', description: '' });
      queryClient.invalidateQueries({ queryKey: ['fee-headings'] });
    },
    onError: (error: any) => {
      toast.error(error.message || 'Failed to create fee heading');
    }
  });

  // Create structure mutation
  const createStructureMutation = useMutation({
    mutationFn: async () => {
      if (!user?.center_id) throw new Error('Center ID not found');

      const { error } = await supabase
        .from('fee_structures')
        .insert({
          center_id: user.center_id,
          fee_heading_id: structureForm.fee_heading_id,
          grade: structureForm.grade,
          amount: parseFloat(structureForm.amount),
          academic_year: academicYear,
          effective_from: structureForm.effective_from,
          is_active: true
        });

      if (error) throw error;
    },
    onSuccess: () => {
      toast.success('Fee structure created successfully');
      setShowStructureDialog(false);
      setStructureForm({ fee_heading_id: '', grade: '', amount: '', effective_from: new Date().toISOString().split('T')[0] });
      queryClient.invalidateQueries({ queryKey: ['fee-structures'] });
    },
    onError: (error: any) => {
      toast.error(error.message || 'Failed to create fee structure');
    }
  });

  // Delete heading mutation
  const deleteHeadingMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('fee_headings')
        .delete()
        .eq('id', id);

      if (error) throw error;
    },
    onSuccess: () => {
      toast.success('Fee heading deleted');
      queryClient.invalidateQueries({ queryKey: ['fee-headings'] });
    },
    onError: (error: any) => {
      toast.error(error.message || 'Failed to delete');
    }
  });

  return (
    <div className="space-y-6">
      {/* Fee Headings Section */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>Fee Headings</CardTitle>
            <Dialog open={showHeadingDialog} onOpenChange={setShowHeadingDialog}>
              <DialogTrigger asChild>
                <Button>
                  <Plus className="h-4 w-4 mr-2" />
                  New Heading
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Create Fee Heading</DialogTitle>
                </DialogHeader>
                <div className="space-y-4 py-4">
                  <div className="space-y-2">
                    <Label htmlFor="heading_name">Heading Name *</Label>
                    <Input
                      id="heading_name"
                      value={headingForm.heading_name}
                      onChange={(e) => setHeadingForm({ ...headingForm, heading_name: e.target.value })}
                      placeholder="e.g., Tuition Fee"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="heading_code">Heading Code *</Label>
                    <Input
                      id="heading_code"
                      value={headingForm.heading_code}
                      onChange={(e) => setHeadingForm({ ...headingForm, heading_code: e.target.value })}
                      placeholder="e.g., TF"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="description">Description</Label>
                    <Input
                      id="description"
                      value={headingForm.description}
                      onChange={(e) => setHeadingForm({ ...headingForm, description: e.target.value })}
                      placeholder="Optional description"
                    />
                  </div>
                  <Button
                    onClick={() => createHeadingMutation.mutate()}
                    disabled={!headingForm.heading_name || !headingForm.heading_code || createHeadingMutation.isPending}
                    className="w-full"
                  >
                    {createHeadingMutation.isPending ? 'Creating...' : 'Create'}
                  </Button>
                </div>
              </DialogContent>
            </Dialog>
          </div>
        </CardHeader>
        <CardContent>
          {headingsLoading ? (
            <p>Loading fee headings...</p>
          ) : headings.length === 0 ? (
            <p className="text-muted-foreground text-center py-4">No fee headings created yet</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Code</TableHead>
                  <TableHead>Description</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {headings.map((heading) => (
                  <TableRow key={heading.id}>
                    <TableCell className="font-medium">{heading.heading_name}</TableCell>
                    <TableCell>{heading.heading_code}</TableCell>
                    <TableCell>{heading.description || '-'}</TableCell>
                    <TableCell>
                      {heading.is_active ? (
                        <span className="text-green-600 flex items-center gap-1">
                          <Check className="h-4 w-4" />
                          Active
                        </span>
                      ) : (
                        <span className="text-red-600">Inactive</span>
                      )}
                    </TableCell>
                    <TableCell>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => deleteHeadingMutation.mutate(heading.id)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Fee Structures Section */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>Fee Structures</CardTitle>
            <Dialog open={showStructureDialog} onOpenChange={setShowStructureDialog}>
              <DialogTrigger asChild>
                <Button disabled={headings.length === 0}>
                  <Plus className="h-4 w-4 mr-2" />
                  New Structure
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Create Fee Structure</DialogTitle>
                  <DialogDescription>
                    Define fee amounts for each grade
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-4 py-4">
                  <div className="space-y-2">
                    <Label htmlFor="fee_heading">Fee Heading *</Label>
                    <select
                      id="fee_heading"
                      value={structureForm.fee_heading_id}
                      onChange={(e) => setStructureForm({ ...structureForm, fee_heading_id: e.target.value })}
                      className="w-full px-3 py-2 border rounded-md"
                    >
                      <option value="">Select Heading</option>
                      {headings.map((h) => (
                        <option key={h.id} value={h.id}>
                          {h.heading_name}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="grade">Grade *</Label>
                    <Input
                      id="grade"
                      value={structureForm.grade}
                      onChange={(e) => setStructureForm({ ...structureForm, grade: e.target.value })}
                      placeholder="e.g., Grade 1"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="amount">Amount (₹) *</Label>
                    <Input
                      id="amount"
                      type="number"
                      step="0.01"
                      value={structureForm.amount}
                      onChange={(e) => setStructureForm({ ...structureForm, amount: e.target.value })}
                      placeholder="0.00"
                    />
                  </div>
                  <Button
                    onClick={() => createStructureMutation.mutate()}
                    disabled={!structureForm.fee_heading_id || !structureForm.grade || !structureForm.amount || createStructureMutation.isPending}
                    className="w-full"
                  >
                    {createStructureMutation.isPending ? 'Creating...' : 'Create'}
                  </Button>
                </div>
              </DialogContent>
            </Dialog>
          </div>
        </CardHeader>
        <CardContent>
          <div className="mb-4 flex gap-4">
            <div className="space-y-2">
              <Label htmlFor="academic_year">Academic Year</Label>
              <Input
                id="academic_year"
                value={academicYear}
                onChange={(e) => setAcademicYear(e.target.value)}
                placeholder="2024-2025"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="filter_heading">Fee Heading</Label>
              <select
                id="filter_heading"
                value={selectedHeading}
                onChange={(e) => setSelectedHeading(e.target.value)}
                className="px-3 py-2 border rounded-md"
              >
                <option value="">All Headings</option>
                {headings.map((h) => (
                  <option key={h.id} value={h.id}>
                    {h.heading_name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {structuresLoading ? (
            <p>Loading fee structures...</p>
          ) : structures.length === 0 ? (
            <p className="text-muted-foreground text-center py-4">No fee structures created yet</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Fee Heading</TableHead>
                  <TableHead>Grade</TableHead>
                  <TableHead>Amount</TableHead>
                  <TableHead>Academic Year</TableHead>
                  <TableHead>Effective From</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {structures.map((structure) => {
                  const heading = headings.find(h => h.id === structure.fee_heading_id);
                  return (
                    <TableRow key={structure.id}>
                      <TableCell className="font-medium">{heading?.heading_name}</TableCell>
                      <TableCell>{structure.grade}</TableCell>
                      <TableCell>₹{structure.amount.toLocaleString('en-IN')}</TableCell>
                      <TableCell>{structure.academic_year}</TableCell>
                      <TableCell>{new Date(structure.effective_from).toLocaleDateString()}</TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default FeeManagement;
