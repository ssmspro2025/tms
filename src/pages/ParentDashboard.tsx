import { useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { User, Calendar, BookOpen, FileText, LogOut } from 'lucide-react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { format } from 'date-fns';

const ParentDashboard = () => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  // Redirect if not parent or missing student_id
  if (!user || user.role !== 'parent' || !user.student_id) {
    navigate('/login-parent');
    return null;
  }

  // Fetch student
  const { data: student } = useQuery({
    queryKey: ['student', user.student_id],
    queryFn: async () => {
      if (!user.student_id) return null;
      const { data, error } = await supabase
        .from('students')
        .select('*')
        .eq('id', user.student_id)
        .single();
      if (error) throw error;
      return data;
    },
  });

  // Attendance
  const { data: attendance = [] } = useQuery({
    queryKey: ['attendance', user.student_id],
    queryFn: async () => {
      if (!user.student_id) return [];
      const { data, error } = await supabase
        .from('attendance')
        .select('*')
        .eq('student_id', user.student_id)
        .order('date', { ascending: false });
      if (error) throw error;
      return data || [];
    },
  });

  // Test results
  const { data: testResults = [] } = useQuery({
    queryKey: ['test-results', user.student_id],
    queryFn: async () => {
      if (!user.student_id) return [];
      const { data, error } = await supabase
        .from('test_results')
        .select('*, tests(*)')
        .eq('student_id', user.student_id)
        .order('date_taken', { ascending: false });
      if (error) throw error;
      return data || [];
    },
  });

  // Chapters
  const { data: chapters = [] } = useQuery({
    queryKey: ['chapters-studied', user.student_id],
    queryFn: async () => {
      if (!user.student_id) return [];
      const { data, error } = await supabase
        .from('student_chapters')
        .select('*, chapters(*)')
        .eq('student_id', user.student_id)
        .order('date_completed', { ascending: false });
      if (error) throw error;
      return data || [];
    },
  });

  // Attendance stats
  const totalDays = (attendance || []).length;
  const presentDays = (attendance || []).filter((a: any) => a.status === 'Present').length;
  const absentDays = totalDays - presentDays;
  const attendancePercentage = totalDays > 0 ? Math.round((presentDays / totalDays) * 100) : 0;

  // Filters
  const [monthFilter, setMonthFilter] = useState('all');
  const [subjectFilter, setSubjectFilter] = useState('all');
  const [chapterFilter, setChapterFilter] = useState('all');
  const [showMiniCalendar, setShowMiniCalendar] = useState(false);

  // Get subjects and chapters safely
  const subjects = Array.from(
    new Set([
      ...(chapters || []).map(c => c.chapters?.subject),
      ...(testResults || []).map(t => t.tests?.subject),
    ].filter(Boolean))
  );

  const chapterNames = Array.from(
    new Set((chapters || []).map(c => c.chapters?.chapter_name).filter(Boolean))
  );

  // Filtered tests & chapters
  const filteredTests = (testResults || []).filter(t => {
    const subjectMatch = subjectFilter === 'all' || t.tests?.subject === subjectFilter;
    const monthMatch = monthFilter === 'all' || format(new Date(t.date_taken), 'yyyy-MM') === monthFilter;
    return subjectMatch && monthMatch;
  });

  const filteredChapters = (chapters || []).filter(c => {
    const subjectMatch = subjectFilter === 'all' || c.chapters?.subject === subjectFilter;
    const chapterMatch = chapterFilter === 'all' || c.chapters?.chapter_name === chapterFilter;
    const monthMatch = monthFilter === 'all' || format(new Date(c.date_completed), 'yyyy-MM') === monthFilter;
    return subjectMatch && chapterMatch && monthMatch;
  });

  const handleLogout = () => {
    logout();
    navigate('/login-parent');
  };

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

        {/* Student Info */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <User className="h-5 w-5" />
              Student Information
            </CardTitle>
          </CardHeader>
          <CardContent>
            {student ? (
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div>
                  <p className="text-sm text-muted-foreground">Name</p>
                  <p className="font-semibold">{student.name}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Grade</p>
                  <p className="font-semibold">{student.grade}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">School</p>
                  <p className="font-semibold">{student.school_name}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Contact</p>
                  <p className="font-semibold">{student.contact_number}</p>
                </div>
              </div>
            ) : (
              <p className="text-muted-foreground">No student data available</p>
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

            {/* Mini Calendar Toggle */}
            <div className="mt-4">
              <Button size="sm" onClick={() => setShowMiniCalendar(prev => !prev)}>
                {showMiniCalendar ? 'Hide Calendar' : 'Show Calendar'}
              </Button>
              {showMiniCalendar && (
                <div className="mt-3 border rounded p-2 w-64 h-64 overflow-auto">
                  <p className="text-sm font-semibold mb-2">Mini Attendance Calendar</p>
                  {/* Mini calendar: simplified month view */}
                  {attendance.map((a: any) => {
                    const date = format(new Date(a.date), 'MMM d');
                    return (
                      <div
                        key={a.date}
                        className={`p-1 rounded mb-1 text-white text-sm ${
                          a.status === 'Present' ? 'bg-green-700' : 'bg-red-700'
                        }`}
                        title={`Status: ${a.status}`}
                      >
                        {date}
                      </div>
                    );
                  })}
                </div>
              )}
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
            <div className="flex gap-2 mb-4">
              <select
                value={subjectFilter}
                onChange={(e) => setSubjectFilter(e.target.value)}
                className="border rounded p-1"
              >
                <option value="all">All Subjects</option>
                {subjects.map(sub => <option key={sub} value={sub}>{sub}</option>)}
              </select>
              <input
                type="month"
                value={monthFilter === 'all' ? '' : monthFilter}
                onChange={(e) => setMonthFilter(e.target.value || 'all')}
                className="border rounded p-1"
              />
            </div>
            {filteredTests.length === 0 ? (
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
                  {filteredTests.map((result: any) => {
                    const percentage = result.tests?.total_marks
                      ? Math.round((result.marks_obtained / result.tests.total_marks) * 100)
                      : 0;
                    return (
                      <TableRow key={result.id}>
                        <TableCell>{result.tests?.name || '-'}</TableCell>
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

        {/* Chapters Studied */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <BookOpen className="h-5 w-5" />
              Chapters Studied
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex gap-2 mb-4">
              <select
                value={subjectFilter}
                onChange={(e) => setSubjectFilter(e.target.value)}
                className="border rounded p-1"
              >
                <option value="all">All Subjects</option>
                {subjects.map(sub => <option key={sub} value={sub}>{sub}</option>)}
              </select>
              <select
                value={chapterFilter}
                onChange={(e) => setChapterFilter(e.target.value)}
                className="border rounded p-1"
              >
                <option value="all">All Chapters</option>
                {chapterNames.map(ch => <option key={ch} value={ch}>{ch}</option>)}
              </select>
              <input
                type="month"
                value={monthFilter === 'all' ? '' : monthFilter}
                onChange={(e) => setMonthFilter(e.target.value || 'all')}
                className="border rounded p-1"
              />
            </div>
            {filteredChapters.length === 0 ? (
              <p className="text-muted-foreground text-center py-8">No chapters recorded</p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Subject</TableHead>
                    <TableHead>Chapter Name</TableHead>
                    <TableHead>Date Completed</TableHead>
                    <TableHead>Notes</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredChapters.map((chapter: any) => (
                    <TableRow key={chapter.id}>
                      <TableCell>{chapter.chapters?.subject || '-'}</TableCell>
                      <TableCell>{chapter.chapters?.chapter_name || '-'}</TableCell>
                      <TableCell>
                        {chapter.date_completed
                          ? new Date(chapter.date_completed).toLocaleDateString()
                          : '-'}
                      </TableCell>
                      <TableCell>{chapter.chapters?.notes || '-'}</TableCell>
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
