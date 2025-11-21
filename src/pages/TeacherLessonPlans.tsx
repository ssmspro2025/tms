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
import { Plus, FileText, Trash2 } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';

interface LessonPlan {
  id: string;
  subject: string;
  chapter: string;
  topic: string;
  grade: string;
  lesson_date: string;
  description: string;
  file_name: string;
  notes: string;
  created_at: string;
}

const TeacherLessonPlans = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [lessonPlans, setLessonPlans] = useState<LessonPlan[]>([]);
  const [loading, setLoading] = useState(false);
  const [newPlan, setNewPlan] = useState({
    subject: '',
    chapter: '',
    topic: '',
    grade: '',
    lesson_date: new Date().toISOString().split('T')[0],
    description: '',
    notes: '',
  });
  const [uploadFile, setUploadFile] = useState<File | null>(null);

  useEffect(() => {
    if (user?.center_id) {
      fetchLessonPlans();
    }
  }, [user]);

  const fetchLessonPlans = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('lesson_plans')
        .select('*')
        .eq('center_id', user?.center_id)
        .eq('created_by', user?.id)
        .order('lesson_date', { ascending: false });

      if (error) throw error;
      setLessonPlans(data || []);
    } catch (error) {
      console.error('Error fetching lesson plans:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateLessonPlan = async () => {
    if (
      !newPlan.subject ||
      !newPlan.chapter ||
      !newPlan.topic ||
      !newPlan.grade ||
      !newPlan.lesson_date ||
      !user?.center_id ||
      !user?.id
    ) {
      toast({
        title: 'Validation Error',
        description: 'Please fill all required fields',
        variant: 'destructive',
      });
      return;
    }

    try {
      let fileUrl = null;
      let fileName = null;

      if (uploadFile) {
        const fileExt = uploadFile.name.split('.').pop();
        const filePath = `${user.center_id}/${Date.now()}.${fileExt}`;

        const { error: uploadError } = await supabase.storage
          .from('lesson-plans')
          .upload(filePath, uploadFile);

        if (uploadError) throw uploadError;

        const { data: urlData } = supabase.storage.from('lesson-plans').getPublicUrl(filePath);
        fileUrl = urlData.publicUrl;
        fileName = uploadFile.name;
      }

      const { error } = await supabase.from('lesson_plans').insert({
        center_id: user.center_id,
        created_by: user.id,
        subject: newPlan.subject,
        chapter: newPlan.chapter,
        topic: newPlan.topic,
        grade: newPlan.grade,
        lesson_date: newPlan.lesson_date,
        description: newPlan.description,
        notes: newPlan.notes,
        lesson_file_url: fileUrl,
        file_name: fileName,
      });

      if (error) throw error;

      toast({
        title: 'Success',
        description: 'Lesson plan created successfully',
      });

      setNewPlan({
        subject: '',
        chapter: '',
        topic: '',
        grade: '',
        lesson_date: new Date().toISOString().split('T')[0],
        description: '',
        notes: '',
      });
      setUploadFile(null);
      fetchLessonPlans();
    } catch (error) {
      console.error('Error creating lesson plan:', error);
      toast({
        title: 'Error',
        description: 'Failed to create lesson plan',
        variant: 'destructive',
      });
    }
  };

  const handleDeleteLessonPlan = async (id: string) => {
    try {
      const { error } = await supabase.from('lesson_plans').delete().eq('id', id);
      if (error) throw error;

      toast({
        title: 'Success',
        description: 'Lesson plan deleted',
      });

      fetchLessonPlans();
    } catch (error) {
      console.error('Error deleting:', error);
    }
  };

  return (
    <div className="space-y-6 p-6">
      <div>
        <h1 className="text-4xl font-bold">Lesson Plans</h1>
        <p className="text-gray-600 mt-2">Create and manage lesson plans</p>
      </div>

      <Dialog>
        <DialogTrigger asChild>
          <Button className="mb-4">
            <Plus className="mr-2 h-4 w-4" />
            Create Lesson Plan
          </Button>
        </DialogTrigger>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Create Lesson Plan</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Subject *</Label>
                <Input
                  value={newPlan.subject}
                  onChange={(e) => setNewPlan({ ...newPlan, subject: e.target.value })}
                  placeholder="e.g., Mathematics"
                />
              </div>
              <div>
                <Label>Grade *</Label>
                <Input
                  value={newPlan.grade}
                  onChange={(e) => setNewPlan({ ...newPlan, grade: e.target.value })}
                  placeholder="e.g., Class 5"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Chapter *</Label>
                <Input
                  value={newPlan.chapter}
                  onChange={(e) => setNewPlan({ ...newPlan, chapter: e.target.value })}
                  placeholder="e.g., Fractions"
                />
              </div>
              <div>
                <Label>Topic *</Label>
                <Input
                  value={newPlan.topic}
                  onChange={(e) => setNewPlan({ ...newPlan, topic: e.target.value })}
                  placeholder="e.g., Adding Fractions"
                />
              </div>
            </div>

            <div>
              <Label>Lesson Date *</Label>
              <Input
                type="date"
                value={newPlan.lesson_date}
                onChange={(e) => setNewPlan({ ...newPlan, lesson_date: e.target.value })}
              />
            </div>

            <div>
              <Label>Description</Label>
              <Textarea
                value={newPlan.description}
                onChange={(e) => setNewPlan({ ...newPlan, description: e.target.value })}
                placeholder="Lesson description"
              />
            </div>

            <div>
              <Label>Lesson Plan File (PDF/DOC)</Label>
              <Input
                type="file"
                accept=".pdf,.doc,.docx"
                onChange={(e) => setUploadFile(e.target.files?.[0] || null)}
              />
            </div>

            <div>
              <Label>Teacher Notes</Label>
              <Textarea
                value={newPlan.notes}
                onChange={(e) => setNewPlan({ ...newPlan, notes: e.target.value })}
                placeholder="Additional notes"
              />
            </div>

            <Button onClick={handleCreateLessonPlan} className="w-full">
              Save Lesson Plan
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {lessonPlans.map((plan) => (
          <Card key={plan.id}>
            <CardHeader>
              <div className="flex justify-between items-start">
                <div className="flex-1">
                  <CardTitle className="text-lg">{plan.chapter} - {plan.topic}</CardTitle>
                  <CardDescription>{plan.subject} | {plan.grade}</CardDescription>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => handleDeleteLessonPlan(plan.id)}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <p className="text-sm text-gray-600">Date: {plan.lesson_date}</p>
                <p className="text-sm text-gray-600">Created: {new Date(plan.created_at).toLocaleDateString()}</p>
              </div>

              {plan.description && (
                <div>
                  <p className="text-sm font-medium">Description</p>
                  <p className="text-sm text-gray-600">{plan.description}</p>
                </div>
              )}

              {plan.notes && (
                <div>
                  <p className="text-sm font-medium">Notes</p>
                  <p className="text-sm text-gray-600">{plan.notes}</p>
                </div>
              )}

              {plan.file_name && (
                <a href={`#`} className="inline-flex items-center gap-2 text-blue-600 text-sm font-medium hover:underline">
                  <FileText className="h-4 w-4" />
                  {plan.file_name}
                </a>
              )}
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
};

export default TeacherLessonPlans;
