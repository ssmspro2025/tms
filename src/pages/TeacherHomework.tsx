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
import { Plus, CheckCircle, MoreVertical } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';

interface Homework {
  id: string;
  subject: string;
  title: string;
  grade: string;
  due_date: string;
  status: string;
  created_at: string;
}

interface HomeworkSubmission {
  id: string;
  student_id: string;
  student_name: string;
  status: string;
  submitted_at: string;
  submission_text: string;
}

const TeacherHomework = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [homework, setHomework] = useState<Homework[]>([]);
  const [submissions, setSubmissions] = useState<HomeworkSubmission[]>([]);
  const [selectedHomework, setSelectedHomework] = useState<Homework | null>(null);
  const [loading, setLoading] = useState(false);
  const [newHomework, setNewHomework] = useState({
    subject: '',
    title: '',
    description: '',
    grade: '',
    assignment_date: new Date().toISOString().split('T')[0],
    due_date: '',
    instructions: '',
  });
  const [uploadFile, setUploadFile] = useState<File | null>(null);

  useEffect(() => {
    if (user?.center_id) {
      fetchHomework();
    }
  }, [user]);

  useEffect(() => {
    if (selectedHomework) {
      fetchSubmissions(selectedHomework.id);
    }
  }, [selectedHomework]);

  const fetchHomework = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('homework')
        .select('*')
        .eq('center_id', user?.center_id)
        .eq('created_by', user?.id)
        .order('due_date', { ascending: true });

      if (error) throw error;
      setHomework(data || []);
    } catch (error) {
      console.error('Error fetching homework:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchSubmissions = async (homeworkId: string) => {
    try {
      const { data, error } = await supabase
        .from('homework_submissions')
        .select('*, students(name)')
        .eq('homework_id', homeworkId);

      if (error) throw error;

      const enriched = data?.map((sub: any) => ({
        ...sub,
        student_name: sub.students?.name || 'Unknown',
      })) || [];

      setSubmissions(enriched);
    } catch (error) {
      console.error('Error fetching submissions:', error);
    }
  };

  const handleCreateHomework = async () => {
    if (!newHomework.subject || !newHomework.title || !newHomework.grade || !newHomework.due_date) {
      toast({
        title: 'Validation Error',
        description: 'Please fill all required fields',
        variant: 'destructive',
      });
      return;
    }

    try {
      let fileUrl = null;

      if (uploadFile) {
        const fileExt = uploadFile.name.split('.').pop();
        const filePath = `homework/${user?.center_id}/${Date.now()}.${fileExt}`;

        const { error: uploadError } = await supabase.storage
          .from('homework')
          .upload(filePath, uploadFile);

        if (uploadError) throw uploadError;

        const { data: urlData } = supabase.storage.from('homework').getPublicUrl(filePath);
        fileUrl = urlData.publicUrl;
      }

      const { error } = await supabase.from('homework').insert({
        center_id: user?.center_id,
        created_by: user?.id,
        subject: newHomework.subject,
        title: newHomework.title,
        description: newHomework.description,
        grade: newHomework.grade,
        assignment_date: newHomework.assignment_date,
        due_date: newHomework.due_date,
        instructions: newHomework.instructions,
        attachment_url: fileUrl,
        status: 'assigned',
      });

      if (error) throw error;

      toast({
        title: 'Success',
        description: 'Homework created successfully',
      });

      setNewHomework({
        subject: '',
        title: '',
        description: '',
        grade: '',
        assignment_date: new Date().toISOString().split('T')[0],
        due_date: '',
        instructions: '',
      });
      setUploadFile(null);
      fetchHomework();
    } catch (error) {
      console.error('Error creating homework:', error);
      toast({
        title: 'Error',
        description: 'Failed to create homework',
        variant: 'destructive',
      });
    }
  };

  const markSubmissionAsChecked = async (submissionId: string) => {
    try {
      const { error } = await supabase
        .from('homework_submissions')
        .update({ status: 'checked' })
        .eq('id', submissionId);

      if (error) throw error;

      toast({
        title: 'Success',
        description: 'Submission marked as checked',
      });

      if (selectedHomework) {
        fetchSubmissions(selectedHomework.id);
      }
    } catch (error) {
      console.error('Error:', error);
    }
  };

  return (
    <div className="space-y-6 p-6">
      <div>
        <h1 className="text-4xl font-bold">Homework Management</h1>
        <p className="text-gray-600 mt-2">Create and manage homework assignments</p>
      </div>

      <Dialog>
        <DialogTrigger asChild>
          <Button>
            <Plus className="mr-2 h-4 w-4" />
            Create Homework
          </Button>
        </DialogTrigger>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Create Homework Assignment</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Subject *</Label>
                <Input
                  value={newHomework.subject}
                  onChange={(e) => setNewHomework({ ...newHomework, subject: e.target.value })}
                  placeholder="e.g., Mathematics"
                />
              </div>
              <div>
                <Label>Grade *</Label>
                <Input
                  value={newHomework.grade}
                  onChange={(e) => setNewHomework({ ...newHomework, grade: e.target.value })}
                  placeholder="e.g., Class 5"
                />
              </div>
            </div>

            <div>
              <Label>Title *</Label>
              <Input
                value={newHomework.title}
                onChange={(e) => setNewHomework({ ...newHomework, title: e.target.value })}
                placeholder="Homework title"
              />
            </div>

            <div>
              <Label>Description</Label>
              <Textarea
                value={newHomework.description}
                onChange={(e) => setNewHomework({ ...newHomework, description: e.target.value })}
                placeholder="Assignment description"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Assignment Date</Label>
                <Input
                  type="date"
                  value={newHomework.assignment_date}
                  onChange={(e) => setNewHomework({ ...newHomework, assignment_date: e.target.value })}
                />
              </div>
              <div>
                <Label>Due Date *</Label>
                <Input
                  type="date"
                  value={newHomework.due_date}
                  onChange={(e) => setNewHomework({ ...newHomework, due_date: e.target.value })}
                />
              </div>
            </div>

            <div>
              <Label>Instructions</Label>
              <Textarea
                value={newHomework.instructions}
                onChange={(e) => setNewHomework({ ...newHomework, instructions: e.target.value })}
                placeholder="Detailed instructions"
              />
            </div>

            <div>
              <Label>Attachment (PDF/Image)</Label>
              <Input
                type="file"
                onChange={(e) => setUploadFile(e.target.files?.[0] || null)}
              />
            </div>

            <Button onClick={handleCreateHomework} className="w-full">
              Create Homework
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Homework List */}
        <div className="lg:col-span-1">
          <Card>
            <CardHeader>
              <CardTitle>Assignments</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {homework.map((hw) => (
                <button
                  key={hw.id}
                  onClick={() => setSelectedHomework(hw)}
                  className={`w-full text-left p-3 rounded-lg border-2 transition-colors ${
                    selectedHomework?.id === hw.id
                      ? 'border-blue-500 bg-blue-50'
                      : 'border-gray-200 hover:border-blue-200'
                  }`}
                >
                  <p className="font-medium text-sm">{hw.title}</p>
                  <p className="text-xs text-gray-600">{hw.subject} | {hw.grade}</p>
                  <p className="text-xs text-gray-500">Due: {hw.due_date}</p>
                </button>
              ))}
            </CardContent>
          </Card>
        </div>

        {/* Submissions */}
        <div className="lg:col-span-2">
          {selectedHomework ? (
            <Card>
              <CardHeader>
                <CardTitle>{selectedHomework.title}</CardTitle>
                <CardDescription>Submissions ({submissions.length})</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {submissions.map((sub) => (
                    <div key={sub.id} className="border rounded-lg p-4">
                      <div className="flex justify-between items-start mb-2">
                        <div>
                          <p className="font-medium">{sub.student_name}</p>
                          <p className="text-sm text-gray-600">
                            {sub.status === 'submitted' ? 'Submitted' : sub.status === 'checked' ? 'Checked' : 'Pending'}
                          </p>
                        </div>
                        {sub.status === 'submitted' && (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => markSubmissionAsChecked(sub.id)}
                          >
                            <CheckCircle className="h-4 w-4 mr-2" />
                            Mark Checked
                          </Button>
                        )}
                      </div>
                      {sub.submission_text && (
                        <p className="text-sm text-gray-600">{sub.submission_text}</p>
                      )}
                      {sub.submitted_at && (
                        <p className="text-xs text-gray-500 mt-2">
                          Submitted: {new Date(sub.submitted_at).toLocaleString()}
                        </p>
                      )}
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          ) : (
            <Card>
              <CardContent className="pt-8 text-center text-gray-500">
                Select a homework assignment to view submissions
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
};

export default TeacherHomework;
