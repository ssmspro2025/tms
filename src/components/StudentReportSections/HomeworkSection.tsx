import React, { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { BookOpen } from 'lucide-react';

interface HomeworkData {
  id: string;
  homework_id: string;
  title: string;
  subject: string;
  due_date: string;
  submission_status: string;
  marks_obtained: number;
  total_marks: number;
  remarks: string;
}

interface HomeworkSectionProps {
  studentId: string;
}

const HomeworkSection: React.FC<HomeworkSectionProps> = ({ studentId }) => {
  const [homework, setHomework] = useState<HomeworkData[]>([]);
  const [loading, setLoading] = useState(false);
  const [stats, setStats] = useState({
    total: 0,
    submitted: 0,
    pending: 0,
  });

  useEffect(() => {
    if (studentId) {
      fetchHomeworkData();
    }
  }, [studentId]);

  const fetchHomeworkData = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('homework_submissions')
        .select('id, homework_id, homework(title, subject, due_date), status, homework_feedback(marks_obtained, total_marks, remarks)')
        .eq('student_id', studentId)
        .order('homework(due_date)', { ascending: false });

      if (error) throw error;

      const enriched = data?.map((sub: any) => ({
        id: sub.id,
        homework_id: sub.homework_id,
        title: sub.homework?.title || 'Unknown',
        subject: sub.homework?.subject || 'Unknown',
        due_date: sub.homework?.due_date || 'N/A',
        submission_status: sub.status,
        marks_obtained: sub.homework_feedback?.[0]?.marks_obtained || null,
        total_marks: sub.homework_feedback?.[0]?.total_marks || null,
        remarks: sub.homework_feedback?.[0]?.remarks || '',
      })) || [];

      setHomework(enriched);

      // Calculate stats
      setStats({
        total: enriched.length,
        submitted: enriched.filter((h: any) => h.submission_status === 'submitted' || h.submission_status === 'checked').length,
        pending: enriched.filter((h: any) => h.submission_status === 'pending').length,
      });
    } catch (error) {
      console.error('Error fetching homework data:', error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <BookOpen className="h-5 w-5" />
          Homework Status
        </CardTitle>
        <CardDescription>Assignment submission and feedback</CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Stats */}
        <div className="grid grid-cols-3 gap-4">
          <div className="p-4 bg-blue-50 rounded-lg">
            <p className="text-sm text-gray-600">Total Assignments</p>
            <p className="text-2xl font-bold">{stats.total}</p>
          </div>
          <div className="p-4 bg-green-50 rounded-lg">
            <p className="text-sm text-gray-600">Submitted</p>
            <p className="text-2xl font-bold text-green-600">{stats.submitted}</p>
          </div>
          <div className="p-4 bg-yellow-50 rounded-lg">
            <p className="text-sm text-gray-600">Pending</p>
            <p className="text-2xl font-bold text-yellow-600">{stats.pending}</p>
          </div>
        </div>

        {/* Homework List */}
        {homework.length > 0 ? (
          <div className="space-y-3">
            {homework.map((hw) => (
              <div key={hw.id} className="border rounded-lg p-4">
                <div className="flex justify-between items-start mb-2">
                  <div>
                    <p className="font-semibold">{hw.title}</p>
                    <p className="text-sm text-gray-600">{hw.subject} | Due: {hw.due_date}</p>
                  </div>
                  <span
                    className={`px-3 py-1 rounded-full text-xs font-medium ${
                      hw.submission_status === 'checked'
                        ? 'bg-green-100 text-green-800'
                        : hw.submission_status === 'submitted'
                        ? 'bg-blue-100 text-blue-800'
                        : 'bg-yellow-100 text-yellow-800'
                    }`}
                  >
                    {hw.submission_status === 'checked' ? '✓ Checked' : hw.submission_status === 'submitted' ? 'Submitted' : 'Pending'}
                  </span>
                </div>

                {hw.marks_obtained !== null && (
                  <div className="mt-2 p-2 bg-gray-50 rounded">
                    <p className="text-sm">
                      Marks: <span className="font-semibold">{hw.marks_obtained}/{hw.total_marks}</span>
                    </p>
                    {hw.remarks && <p className="text-sm text-gray-600 mt-1">Teacher feedback: {hw.remarks}</p>}
                  </div>
                )}
              </div>
            ))}
          </div>
        ) : (
          <p className="text-gray-600 text-sm">No homework assignments found</p>
        )}
      </CardContent>
    </Card>
  );
};

export default HomeworkSection;
