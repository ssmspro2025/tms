import React, { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { BookOpen, CheckCircle, Clock } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';

interface HomeworkData {
  id: string;
  homework_title: string;
  subject: string;
  due_date: string;
  submission_status: string;
  marks: string;
  teacher_remarks: string;
  assignment_date: string;
}

const ParentHomeworkPanel = () => {
  const { user } = useAuth();
  const [homework, setHomework] = useState<HomeworkData[]>([]);
  const [loading, setLoading] = useState(false);
  const [filter, setFilter] = useState('all'); // all, pending, completed

  useEffect(() => {
    if (user?.student_id) {
      fetchHomeworkData();
    }
  }, [user]);

  const fetchHomeworkData = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('homework_submissions')
        .select(
          'id, homework(title, subject, due_date, assignment_date), status, homework_feedback(marks_obtained, total_marks, remarks)'
        )
        .eq('student_id', user?.student_id)
        .order('homework(due_date)', { ascending: true });

      if (error) throw error;

      const enriched = data?.map((sub: any) => ({
        id: sub.id,
        homework_title: sub.homework?.title || 'Unknown',
        subject: sub.homework?.subject || 'Unknown',
        due_date: sub.homework?.due_date || 'N/A',
        assignment_date: sub.homework?.assignment_date || 'N/A',
        submission_status: sub.status,
        marks: sub.homework_feedback?.[0]
          ? `${sub.homework_feedback[0].marks_obtained}/${sub.homework_feedback[0].total_marks}`
          : null,
        teacher_remarks: sub.homework_feedback?.[0]?.remarks || '',
      })) || [];

      setHomework(enriched);
    } catch (error) {
      console.error('Error fetching homework:', error);
    } finally {
      setLoading(false);
    }
  };

  const getStatusIcon = (status: string) => {
    if (status === 'checked') {
      return <CheckCircle className="h-5 w-5 text-green-600" />;
    } else if (status === 'submitted') {
      return <Clock className="h-5 w-5 text-blue-600" />;
    } else {
      return <Clock className="h-5 w-5 text-yellow-600" />;
    }
  };

  const getStatusLabel = (status: string) => {
    switch (status) {
      case 'checked':
        return 'Checked';
      case 'submitted':
        return 'Submitted';
      case 'pending':
        return 'Pending';
      default:
        return status;
    }
  };

  const filterHomework = () => {
    if (filter === 'pending') {
      return homework.filter((h) => h.submission_status === 'pending');
    } else if (filter === 'completed') {
      return homework.filter((h) => h.submission_status === 'checked' || h.submission_status === 'submitted');
    }
    return homework;
  };

  const filtered = filterHomework();
  const stats = {
    total: homework.length,
    pending: homework.filter((h) => h.submission_status === 'pending').length,
    completed: homework.filter((h) => h.submission_status === 'checked' || h.submission_status === 'submitted').length,
  };

  return (
    <div className="space-y-6">
      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-600">Total Assignments</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{stats.total}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-600">Pending</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-yellow-600">{stats.pending}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-600">Completed</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-green-600">{stats.completed}</div>
          </CardContent>
        </Card>
      </div>

      {/* Homework List */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <BookOpen className="h-5 w-5" />
            Homework Assignments
          </CardTitle>
        </CardHeader>
        <CardContent>
          {/* Filter Tabs */}
          <div className="flex gap-4 mb-6">
            <button
              onClick={() => setFilter('all')}
              className={`px-4 py-2 rounded-lg ${filter === 'all' ? 'bg-blue-100 text-blue-600 font-medium' : 'text-gray-600'}`}
            >
              All
            </button>
            <button
              onClick={() => setFilter('pending')}
              className={`px-4 py-2 rounded-lg ${filter === 'pending' ? 'bg-yellow-100 text-yellow-600 font-medium' : 'text-gray-600'}`}
            >
              Pending
            </button>
            <button
              onClick={() => setFilter('completed')}
              className={`px-4 py-2 rounded-lg ${filter === 'completed' ? 'bg-green-100 text-green-600 font-medium' : 'text-gray-600'}`}
            >
              Completed
            </button>
          </div>

          {/* Homework Items */}
          <div className="space-y-4">
            {filtered.length > 0 ? (
              filtered.map((hw) => (
                <div key={hw.id} className="border rounded-lg p-4 hover:bg-gray-50 transition-colors">
                  <div className="flex items-start justify-between mb-3">
                    <div>
                      <h3 className="font-semibold text-lg">{hw.homework_title}</h3>
                      <p className="text-sm text-gray-600">{hw.subject}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      {getStatusIcon(hw.submission_status)}
                      <span className="text-sm font-medium">{getStatusLabel(hw.submission_status)}</span>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4 mb-3">
                    <div>
                      <p className="text-xs text-gray-600">Assigned</p>
                      <p className="text-sm font-medium">{hw.assignment_date}</p>
                    </div>
                    <div>
                      <p className="text-xs text-gray-600">Due Date</p>
                      <p className="text-sm font-medium">{hw.due_date}</p>
                    </div>
                  </div>

                  {hw.marks && (
                    <div className="mb-2 p-3 bg-blue-50 rounded">
                      <p className="text-sm">
                        <span className="font-medium">Marks Obtained:</span> <span className="font-bold">{hw.marks}</span>
                      </p>
                    </div>
                  )}

                  {hw.teacher_remarks && (
                    <div className="p-3 bg-gray-50 rounded">
                      <p className="text-sm">
                        <span className="font-medium">Teacher Feedback:</span>{' '}
                        <span className="text-gray-700">{hw.teacher_remarks}</span>
                      </p>
                    </div>
                  )}
                </div>
              ))
            ) : (
              <p className="text-gray-600 text-center py-8">No homework assignments found</p>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default ParentHomeworkPanel;
