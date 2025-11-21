import React, { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Plus, AlertTriangle } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';

interface DisciplineCategory {
  id: string;
  name: string;
}

interface DisciplineIssue {
  id: string;
  student_id: string;
  student_name: string;
  category_id: string;
  category_name: string;
  issue_date: string;
  description: string;
  severity: string;
  resolved: boolean;
  parent_informed: boolean;
}

const TeacherDiscipline = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [categories, setCategories] = useState<DisciplineCategory[]>([]);
  const [students, setStudents] = useState<Array<{ id: string; name: string }>>([]);
  const [issues, setIssues] = useState<DisciplineIssue[]>([]);
  const [newIssue, setNewIssue] = useState({
    student_id: '',
    category_id: '',
    issue_date: new Date().toISOString().split('T')[0],
    description: '',
    severity: 'medium',
    incident_location: '',
    witnesses: '',
  });

  useEffect(() => {
    if (user?.center_id) {
      fetchData();
    }
  }, [user]);

  const fetchData = async () => {
    try {
      // Fetch categories
      const { data: cats } = await supabase
        .from('discipline_categories')
        .select('*')
        .eq('center_id', user?.center_id)
        .eq('is_active', true);

      setCategories(cats || []);

      // Fetch students
      const { data: studs } = await supabase
        .from('students')
        .select('id, name')
        .eq('center_id', user?.center_id);

      setStudents(studs || []);

      // Fetch issues
      const { data: issuesData } = await supabase
        .from('discipline_issues')
        .select('*')
        .eq('center_id', user?.center_id)
        .order('issue_date', { ascending: false });

      if (issuesData) {
        const enriched = await Promise.all(
          issuesData.map(async (issue: any) => {
            const student = studs?.find((s: any) => s.id === issue.student_id);
            const cat = cats?.find((c: any) => c.id === issue.discipline_category_id);
            return {
              ...issue,
              student_name: student?.name || 'Unknown',
              category_name: cat?.name || 'Unknown',
            };
          })
        );
        setIssues(enriched);
      }
    } catch (error) {
      console.error('Error fetching data:', error);
    }
  };

  const handleLogIssue = async () => {
    if (!newIssue.student_id || !newIssue.category_id || !newIssue.description) {
      toast({
        title: 'Validation Error',
        description: 'Please fill all required fields',
        variant: 'destructive',
      });
      return;
    }

    try {
      const { error } = await supabase.from('discipline_issues').insert({
        center_id: user?.center_id,
        student_id: newIssue.student_id,
        discipline_category_id: newIssue.category_id,
        reported_by: user?.id,
        issue_date: newIssue.issue_date,
        description: newIssue.description,
        severity: newIssue.severity,
        incident_location: newIssue.incident_location,
        witnesses: newIssue.witnesses,
      });

      if (error) throw error;

      toast({
        title: 'Success',
        description: 'Discipline issue logged',
      });

      setNewIssue({
        student_id: '',
        category_id: '',
        issue_date: new Date().toISOString().split('T')[0],
        description: '',
        severity: 'medium',
        incident_location: '',
        witnesses: '',
      });

      fetchData();
    } catch (error) {
      console.error('Error logging issue:', error);
      toast({
        title: 'Error',
        description: 'Failed to log issue',
        variant: 'destructive',
      });
    }
  };

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'high':
        return 'text-red-600 bg-red-50';
      case 'medium':
        return 'text-yellow-600 bg-yellow-50';
      case 'low':
        return 'text-blue-600 bg-blue-50';
      default:
        return 'text-gray-600 bg-gray-50';
    }
  };

  return (
    <div className="space-y-6 p-6">
      <div>
        <h1 className="text-4xl font-bold">Discipline Management</h1>
        <p className="text-gray-600 mt-2">Log and track discipline issues</p>
      </div>

      <Dialog>
        <DialogTrigger asChild>
          <Button>
            <Plus className="mr-2 h-4 w-4" />
            Log Discipline Issue
          </Button>
        </DialogTrigger>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Log Discipline Issue</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Student *</Label>
                <select
                  className="w-full px-3 py-2 border rounded-md"
                  value={newIssue.student_id}
                  onChange={(e) => setNewIssue({ ...newIssue, student_id: e.target.value })}
                >
                  <option value="">Select Student</option>
                  {students.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <Label>Category *</Label>
                <select
                  className="w-full px-3 py-2 border rounded-md"
                  value={newIssue.category_id}
                  onChange={(e) => setNewIssue({ ...newIssue, category_id: e.target.value })}
                >
                  <option value="">Select Category</option>
                  {categories.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Date *</Label>
                <Input
                  type="date"
                  value={newIssue.issue_date}
                  onChange={(e) => setNewIssue({ ...newIssue, issue_date: e.target.value })}
                />
              </div>
              <div>
                <Label>Severity</Label>
                <select
                  className="w-full px-3 py-2 border rounded-md"
                  value={newIssue.severity}
                  onChange={(e) => setNewIssue({ ...newIssue, severity: e.target.value })}
                >
                  <option value="low">Low</option>
                  <option value="medium">Medium</option>
                  <option value="high">High</option>
                </select>
              </div>
            </div>

            <div>
              <Label>Description *</Label>
              <Textarea
                value={newIssue.description}
                onChange={(e) => setNewIssue({ ...newIssue, description: e.target.value })}
                placeholder="Detailed description of the incident"
              />
            </div>

            <div>
              <Label>Location</Label>
              <Input
                value={newIssue.incident_location}
                onChange={(e) => setNewIssue({ ...newIssue, incident_location: e.target.value })}
                placeholder="Where did the incident occur?"
              />
            </div>

            <div>
              <Label>Witnesses</Label>
              <Input
                value={newIssue.witnesses}
                onChange={(e) => setNewIssue({ ...newIssue, witnesses: e.target.value })}
                placeholder="Names of witnesses"
              />
            </div>

            <Button onClick={handleLogIssue} className="w-full">
              Log Issue
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <Card>
        <CardHeader>
          <CardTitle>Discipline Issues</CardTitle>
          <CardDescription>All logged discipline incidents</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {issues.map((issue) => (
              <div key={issue.id} className={`p-4 rounded-lg border-2 border-gray-200 ${getSeverityColor(issue.severity)}`}>
                <div className="flex justify-between items-start mb-2">
                  <div>
                    <p className="font-semibold">{issue.student_name}</p>
                    <p className="text-sm">{issue.category_name}</p>
                  </div>
                  <div className="text-right">
                    <span className={`px-3 py-1 rounded-full text-xs font-medium capitalize ${getSeverityColor(issue.severity)}`}>
                      {issue.severity}
                    </span>
                  </div>
                </div>

                <p className="text-sm mb-2">{issue.description}</p>

                <div className="text-xs space-y-1">
                  <p>Date: {issue.issue_date}</p>
                  {issue.incident_location && <p>Location: {issue.incident_location}</p>}
                  {issue.witnesses && <p>Witnesses: {issue.witnesses}</p>}
                  <div className="flex gap-4 mt-2">
                    <span className={`${issue.resolved ? 'text-green-600' : 'text-orange-600'}`}>
                      {issue.resolved ? '✓ Resolved' : '⏳ Pending'}
                    </span>
                    <span className={`${issue.parent_informed ? 'text-green-600' : 'text-orange-600'}`}>
                      {issue.parent_informed ? '✓ Parent Informed' : 'Parent Not Informed'}
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default TeacherDiscipline;
