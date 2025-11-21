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
import { Plus, Trash2, Star } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';

interface Activity {
  id: string;
  title: string;
  activity_type_id: string;
  activity_type_name: string;
  activity_date: string;
  grade: string;
  created_at: string;
}

interface StudentActivity {
  id: string;
  student_id: string;
  student_name: string;
  involvement_score: number;
  participation_rating: string;
  teacher_notes: string;
}

const TeacherActivities = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [activityTypes, setActivityTypes] = useState<Array<{ id: string; name: string }>>([]);
  const [activities, setActivities] = useState<Activity[]>([]);
  const [students, setStudents] = useState<Array<{ id: string; name: string }>>([]);
  const [selectedActivity, setSelectedActivity] = useState<Activity | null>(null);
  const [studentParticipation, setStudentParticipation] = useState<StudentActivity[]>([]);
  const [newActivity, setNewActivity] = useState({
    activity_type_id: '',
    title: '',
    description: '',
    activity_date: new Date().toISOString().split('T')[0],
    duration_minutes: '',
    grade: '',
    notes: '',
  });

  useEffect(() => {
    if (user?.center_id) {
      fetchData();
    }
  }, [user]);

  useEffect(() => {
    if (selectedActivity) {
      fetchParticipation(selectedActivity.id);
    }
  }, [selectedActivity]);

  const fetchData = async () => {
    try {
      // Fetch activity types
      const { data: types } = await supabase
        .from('activity_types')
        .select('id, name')
        .eq('center_id', user?.center_id)
        .eq('is_active', true);

      setActivityTypes(types || []);

      // Fetch activities
      const { data: activitiesData } = await supabase
        .from('activities')
        .select('*, activity_types(name)')
        .eq('center_id', user?.center_id)
        .eq('created_by', user?.id)
        .order('activity_date', { ascending: false });

      const enriched = activitiesData?.map((act: any) => ({
        ...act,
        activity_type_name: act.activity_types?.name || 'Unknown',
      })) || [];

      setActivities(enriched);

      // Fetch students
      const { data: studentsData } = await supabase
        .from('students')
        .select('id, name')
        .eq('center_id', user?.center_id);

      setStudents(studentsData || []);
    } catch (error) {
      console.error('Error fetching data:', error);
    }
  };

  const fetchParticipation = async (activityId: string) => {
    try {
      const { data, error } = await supabase
        .from('student_activities')
        .select('*, students(name)')
        .eq('activity_id', activityId);

      if (error) throw error;

      const enriched = data?.map((sa: any) => ({
        ...sa,
        student_name: sa.students?.name || 'Unknown',
      })) || [];

      setStudentParticipation(enriched);
    } catch (error) {
      console.error('Error fetching participation:', error);
    }
  };

  const handleCreateActivity = async () => {
    if (!newActivity.activity_type_id || !newActivity.title || !newActivity.activity_date) {
      toast({
        title: 'Validation Error',
        description: 'Please fill all required fields',
        variant: 'destructive',
      });
      return;
    }

    try {
      const { error } = await supabase.from('activities').insert({
        center_id: user?.center_id,
        activity_type_id: newActivity.activity_type_id,
        created_by: user?.id,
        title: newActivity.title,
        description: newActivity.description,
        activity_date: newActivity.activity_date,
        duration_minutes: newActivity.duration_minutes ? parseInt(newActivity.duration_minutes) : null,
        grade: newActivity.grade || null,
        notes: newActivity.notes,
      });

      if (error) throw error;

      toast({
        title: 'Success',
        description: 'Activity created successfully',
      });

      setNewActivity({
        activity_type_id: '',
        title: '',
        description: '',
        activity_date: new Date().toISOString().split('T')[0],
        duration_minutes: '',
        grade: '',
        notes: '',
      });

      fetchData();
    } catch (error) {
      console.error('Error creating activity:', error);
      toast({
        title: 'Error',
        description: 'Failed to create activity',
        variant: 'destructive',
      });
    }
  };

  const handleRecordParticipation = async (studentId: string) => {
    try {
      if (!selectedActivity) return;

      const { error } = await supabase.from('student_activities').insert({
        activity_id: selectedActivity.id,
        student_id: studentId,
        participation_rating: 'good',
        involvement_score: 3,
        completed: true,
      });

      if (error) {
        if (error.code === '23505') {
          toast({
            title: 'Already recorded',
            description: 'This student already has a record for this activity',
            variant: 'destructive',
          });
          return;
        }
        throw error;
      }

      toast({
        title: 'Success',
        description: 'Participation recorded',
      });

      fetchParticipation(selectedActivity.id);
    } catch (error) {
      console.error('Error:', error);
    }
  };

  const updateParticipation = async (participationId: string, score: number, rating: string) => {
    try {
      const { error } = await supabase
        .from('student_activities')
        .update({
          involvement_score: score,
          participation_rating: rating,
        })
        .eq('id', participationId);

      if (error) throw error;

      if (selectedActivity) {
        fetchParticipation(selectedActivity.id);
      }
    } catch (error) {
      console.error('Error updating:', error);
    }
  };

  return (
    <div className="space-y-6 p-6">
      <div>
        <h1 className="text-4xl font-bold">Preschool Activities</h1>
        <p className="text-gray-600 mt-2">Track child development through activities</p>
      </div>

      <Dialog>
        <DialogTrigger asChild>
          <Button>
            <Plus className="mr-2 h-4 w-4" />
            Create Activity
          </Button>
        </DialogTrigger>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Create Activity</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Activity Type *</Label>
                <select
                  className="w-full px-3 py-2 border rounded-md"
                  value={newActivity.activity_type_id}
                  onChange={(e) => setNewActivity({ ...newActivity, activity_type_id: e.target.value })}
                >
                  <option value="">Select Type</option>
                  {activityTypes.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.name}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <Label>Grade</Label>
                <Input
                  value={newActivity.grade}
                  onChange={(e) => setNewActivity({ ...newActivity, grade: e.target.value })}
                  placeholder="e.g., Nursery"
                />
              </div>
            </div>

            <div>
              <Label>Title *</Label>
              <Input
                value={newActivity.title}
                onChange={(e) => setNewActivity({ ...newActivity, title: e.target.value })}
                placeholder="Activity title"
              />
            </div>

            <div>
              <Label>Description</Label>
              <Textarea
                value={newActivity.description}
                onChange={(e) => setNewActivity({ ...newActivity, description: e.target.value })}
                placeholder="What is the activity about?"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Date *</Label>
                <Input
                  type="date"
                  value={newActivity.activity_date}
                  onChange={(e) => setNewActivity({ ...newActivity, activity_date: e.target.value })}
                />
              </div>
              <div>
                <Label>Duration (minutes)</Label>
                <Input
                  type="number"
                  value={newActivity.duration_minutes}
                  onChange={(e) => setNewActivity({ ...newActivity, duration_minutes: e.target.value })}
                />
              </div>
            </div>

            <div>
              <Label>Notes</Label>
              <Textarea
                value={newActivity.notes}
                onChange={(e) => setNewActivity({ ...newActivity, notes: e.target.value })}
                placeholder="Teacher notes"
              />
            </div>

            <Button onClick={handleCreateActivity} className="w-full">
              Create Activity
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Activities List */}
        <div className="lg:col-span-1">
          <Card>
            <CardHeader>
              <CardTitle>Activities</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {activities.map((act) => (
                <button
                  key={act.id}
                  onClick={() => setSelectedActivity(act)}
                  className={`w-full text-left p-3 rounded-lg border-2 transition-colors ${
                    selectedActivity?.id === act.id
                      ? 'border-blue-500 bg-blue-50'
                      : 'border-gray-200 hover:border-blue-200'
                  }`}
                >
                  <p className="font-medium text-sm">{act.title}</p>
                  <p className="text-xs text-gray-600">{act.activity_type_name}</p>
                  <p className="text-xs text-gray-500">{act.activity_date}</p>
                </button>
              ))}
            </CardContent>
          </Card>
        </div>

        {/* Participation Details */}
        <div className="lg:col-span-2">
          {selectedActivity ? (
            <Card>
              <CardHeader>
                <CardTitle>{selectedActivity.title}</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="mb-4">
                  <Label>Add Student Participation</Label>
                  <div className="flex gap-2 mt-2">
                    <select
                      id="student-select"
                      className="flex-1 px-3 py-2 border rounded-md text-sm"
                    >
                      <option value="">Select student</option>
                      {students.map((s) => (
                        <option key={s.id} value={s.id}>
                          {s.name}
                        </option>
                      ))}
                    </select>
                    <Button
                      size="sm"
                      onClick={() => {
                        const select = document.getElementById('student-select') as HTMLSelectElement;
                        if (select.value) {
                          handleRecordParticipation(select.value);
                          select.value = '';
                        }
                      }}
                    >
                      Add
                    </Button>
                  </div>
                </div>

                <div className="space-y-3">
                  {studentParticipation.map((sp) => (
                    <div key={sp.id} className="border rounded-lg p-4">
                      <p className="font-medium">{sp.student_name}</p>
                      <div className="mt-2 space-y-2">
                        <div>
                          <Label className="text-xs">Involvement Score (1-5)</Label>
                          <select
                            className="w-full px-2 py-1 border rounded text-sm"
                            value={sp.involvement_score || 3}
                            onChange={(e) => updateParticipation(sp.id, parseInt(e.target.value), sp.participation_rating)}
                          >
                            <option value="1">1 - Minimal</option>
                            <option value="2">2 - Low</option>
                            <option value="3">3 - Good</option>
                            <option value="4">4 - Very Good</option>
                            <option value="5">5 - Excellent</option>
                          </select>
                        </div>
                        <div>
                          <Label className="text-xs">Rating</Label>
                          <select
                            className="w-full px-2 py-1 border rounded text-sm"
                            value={sp.participation_rating || 'good'}
                            onChange={(e) => updateParticipation(sp.id, sp.involvement_score, e.target.value)}
                          >
                            <option value="excellent">Excellent</option>
                            <option value="good">Good</option>
                            <option value="fair">Fair</option>
                            <option value="needs_improvement">Needs Improvement</option>
                          </select>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          ) : (
            <Card>
              <CardContent className="pt-8 text-center text-gray-500">
                Select an activity to record student participation
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
};

export default TeacherActivities;
