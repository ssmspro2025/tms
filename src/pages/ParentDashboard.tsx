import { useAuth } from '@/contexts/AuthContext';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { User, Calendar, BookOpen, FileText, LogOut } from 'lucide-react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useState } from 'react';

const ParentDashboard = () => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [selectedChildId, setSelectedChildId] = useState<string | null>(null);

  // 🧭 Redirect if not parent
  if (user?.role !== 'parent') {
    navigate('/login-parent');
    return null;
  }

  // 🧩 Handle 1 or multiple children
  const childIds = Array.isArray(user?.student_ids)
    ? user.student_ids
    : user?.student_id
    ? [user.student_id]
    : [];

  // If parent has no child linked
  if (childIds.length === 0) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center">
        <p className="text-lg text-muted-foreground">No student linked to this parent account.</p>
        <Button onClick={() => navigate('/login-parent')} className="mt-4">Back to Login</Button>
      </div>
    );
  }

  // Default to first child
  const activeChildId = selectedChildId || childIds[0];

  /** 🧩 Fetch children info */
  const { data: students = [] } = useQuery({
    queryKey: ['students', childIds],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('students')
        .select('*')
        .in('id', childIds);
      if (error) throw error;
      return data;
    },
  });

  /** 🧩 Fetch attendance */
  const { data: attendance = [] } = useQuery({
    queryKey: ['attendance', activeChildId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('attendance')
        .select('*')
        .eq('student_id', activeChildId)
        .order('date', { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: !!activeChildId,
  });

  /** 🧩 Fetch test results */
  const { data: testResults = [] } = useQuery({
    queryKey: ['test-results', activeChildId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('test_results')
        .select('*, tests(*)')
        .eq('student_id', activeChildId)
        .order('date_taken', { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: !!activeChildId,
  });

  /** 🧩 Fetch chapters studied */
  const { data: chapters = [] } = useQuery({
    queryKey: ['student_chapters', activeChildId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('student_chapters')
        .select(`
          id,
          student_id,
          chapter_id,
          completed,
          date_completed,
          created_at,
          chapters (name, subject)
        `)
        .eq('student_id', activeChildId)
        .order('date_completed', { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: !!activeChildId,
  });

  /** 🧩 Attendance statistics */
  const totalDays = attendance.length;
  const presentDays = attendance.filter((a: any) => a.status === 'Present').length;
  const absentDays = totalDays - presentDays;
  const attendancePercentage = totalDays > 0 ? Math.round((presentDays / totalDays) * 100) : 0;

  /** 🧩 Logout handler */
  const handleLogout = () => {
    logout();
    navigate('/login-parent');
  };

  const activeStudent = students.find((s: any) => s.id === activeChildId);

  return (
    <div className="min-h-screen bg-background p-6">
      <div className="max-w-6xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <User className="h-8 w-8 text-primary" />
            <div>
              <h1 className="text-3xl font-bold">Parent Dashboard</h1>
              <p className="text-muted-foreground">Welcome, {user.username}</p>
            </div>
          </div>
          <Button variant="outline" onClick={handleLogout}>
            <LogOut className="h-4 w-4 mr-2" />
            Logout
          </Button>
        </div>

        {/* Child Selector (if multiple) */}
        {students.length > 1 && (
          <div className="flex gap-2 items-center">
            <label className="text-sm font-medium">Select Child:</label>
            <select
              className="border border-gray-300 rounded-md p-2 text-sm"
              value={activeChildId}
              onChange={(e) => setSelectedChildId(e.target.value)}
            >
              {students.map((s: any) => (
                <option key={s.id} value={s.id}>
                  {s.name} ({s.grade})
                </option>
              ))}
            </select>
          </div>
        )}

        {/* Student Info */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <User className="h-5 w-5" />
              Student Information
            </CardTitle>
          </CardHeader>
          <CardContent>
            {activeStudent ? (
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div>
                  <p className="text-sm text-muted-foreground">Name</p>
                  <p className="font-semibold">{activeStudent.name}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Grade</p>
                  <p className="font-semibold">{activeStudent.grade}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">School</p>
                  <p className="font-semibold">{activeStudent.school_name}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Contact</p>
                  <p className="font-semibold">{activeStudent.contact_number}</p>
                </div>
              </div>
            ) : (
              <p className="text-muted-foreground">Loading student info...</p>
            )}
          </CardContent>
        </Card>

        {/* Attendance Summary */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Calendar className="h-5 w-5" />
              Attendance Summary
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
              <div className="text-center p-4 bg-blue-50 dark:bg-blue-950/20 rounded-lg">
                <p className="text-2xl font-bold text-blue-600">{totalDays}</p>
                <p className="text-sm text-muted-foreground">Total Days</p>
              </div>
              <div className="text-center p-4 bg-green-50 dark:bg-green-950/20 rounded-lg">
                <p className="text-2xl font-bold text-green-600">{presentDays}</p>
                <p className="text-sm text-muted-foreground">Present</p>
              </div>
              <div className="text-center p-4 bg-red-50 dark:bg-red-950/20 rounded-lg">
                <p className="text-2xl font-bold text-red-600">{absentDays}</p>
                <p className="text-sm text-muted-foreground">Absent</p>
              </div>
              <div className="text-center p-4 bg-purple-50 dark:bg-purple-950/20 rounded-lg">
                <p className="text-2xl font-bold text-purple-600">{attendancePercentage}%</p>
                <p className="text-sm text-muted-foreground">Attendance</p>
              </div>
            </div>
            <div className="w-full h-2 bg-gray-200 rounded-full overflow-hidden">
              <div
                className="h-full bg-green-600 transition-all duration-300"
                style={{ width: `${attendancePercentage}%` }}
              />
            </div>
          </CardContent>
        </Card>

        {/* Test Results */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5" />
              Test Results
            </CardTitle>
          </CardHeader>
          <CardContent>
            {testResults.length === 0 ? (
              <p className="text-muted-foreground text-center py-8">No test results available</p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Test Name</TableHead>
                    <TableHead>Subject</TableHead>
                    <TableHead>Date</TableHead>
                    <TableHead>Marks</TableHead>
                    <TableHead>Percentage</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {testResults.map((result: any) => {
                    const percentage = result.tests?.total_marks
                      ? Math.round((result.marks_obtained / result.tests.total_marks) * 100)
                      : 0;
                    return (
                      <TableRow key={result.id}>
                        <TableCell className="font-medium">{result.tests?.name || '-'}</TableCell>
                        <TableCell>{result.tests?.subject || '-'}</TableCell>
                        <TableCell>{new Date(result.date_taken).toLocaleDateString()}</TableCell>
                        <TableCell>
                          {result.marks_obtained}/{result.tests?.total_marks || 0}
                        </TableCell>
                        <TableCell>
                          <span
                            className={`font-semibold ${
                              percentage >= 75
                                ? 'text-green-600'
                                : percentage >= 50
                                ? 'text-yellow-600'
                                : 'text-red-600'
                            }`}
                          >
                            {percentage}%
                          </span>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>

        {/* ✅ Chapters Studied — Secure */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <BookOpen className="h-5 w-5" />
              Chapters Studied
            </CardTitle>
          </CardHeader>
          <CardContent>
            {chapters.length === 0 ? (
              <p className="text-muted-foreground text-center py-8">No chapters recorded</p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Subject</TableHead>
                    <TableHead>Chapter Name</TableHead>
                    <TableHead>Date Completed</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {chapters.map((chapter: any) => (
                    <TableRow key={chapter.id}>
                      <TableCell className="font-medium">{chapter.chapters?.subject || '-'}</TableCell>
                      <TableCell>{chapter.chapters?.name || chapter.chapter_id}</TableCell>
                      <TableCell>
                        {chapter.date_completed
                          ? new Date(chapter.date_completed).toLocaleDateString()
                          : '-'}
                      </TableCell>
                      <TableCell>
                        {chapter.completed ? (
                          <span className="text-green-600 font-semibold">✅ Completed</span>
                        ) : (
                          <span className="text-yellow-600 font-semibold">⏳ Pending</span>
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
    </div>
  );
};

export default ParentDashboard;
