import { useAuth } from '@/contexts/AuthContext';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { User, Calendar, BookOpen, FileText, LogOut } from 'lucide-react';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow
} from '@/components/ui/table';
import { useState } from 'react';
import {
  format,
  startOfMonth,
  endOfMonth,
  startOfWeek,
  endOfWeek,
  addDays,
} from 'date-fns';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Tooltip } from '@/components/ui/tooltip';

const weekdays = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

const ParentDashboard = () => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  if (!user || user.role !== 'parent' || !user.student_id) {
    navigate('/login-parent');
    return null;
  }

  // State for calendar
  const [calendarMonth, setCalendarMonth] = useState(new Date());

  // Filters for test results & chapters
  const [subjectFilter, setSubjectFilter] = useState<string>('all');
  const [chapterFilter, setChapterFilter] = useState<string>('all');
  const [monthFilter, setMonthFilter] = useState<string>('all');

  // Fetch student
  const { data: student } = useQuery({
    queryKey: ['student', user.student_id],
    queryFn: async () => {
      if (!user.student_id) return null;
      const { data, error } = await supabase.from('students').select('*').eq('id', user.student_id).single();
      if (error) throw error;
      return data;
    },
  });

  // Fetch attendance
  const { data: attendance = [] } = useQuery({
    queryKey: ['attendance', user.student_id],
    queryFn: async () => {
      if (!user.student_id) return [];
      const { data, error } = await supabase
        .from('attendance')
        .select('*')
        .eq('student_id', user.student_id)
        .order('date', { ascending: true });
      if (error) throw error;
      return data;
    },
  });

  // Fetch tests
  const { data: testResults = [] } = useQuery({
    queryKey: ['test-results', user.student_id],
    queryFn: async () => {
      if (!user.student_id) return [];
      const { data, error } = await supabase
        .from('test_results')
        .select('*, tests(*)')
        .eq('student_id', user.student_id)
        .order('date_taken', { ascending: true });
      if (error) throw error;
      return data;
    },
  });

  // Fetch chapters
  const { data: chapters = [] } = useQuery({
    queryKey: ['chapters-studied', user.student_id],
    queryFn: async () => {
      if (!user.student_id) return [];
      const { data, error } = await supabase
        .from('student_chapters')
        .select('*, chapters(*)')
        .eq('student_id', user.student_id)
        .order('date_completed', { ascending: true });
      if (error) throw error;
      return data;
    },
  });

  const totalDays = attendance.length;
  const presentDays = attendance.filter((a: any) => a.status === 'Present').length;
  const absentDays = totalDays - presentDays;
  const attendancePercentage = totalDays > 0 ? Math.round((presentDays / totalDays) * 100) : 0;

  const handleLogout = () => {
    logout();
    navigate('/login-parent');
  };

  // Prepare mini calendar data
  const firstDayOfMonth = startOfMonth(calendarMonth);
  const lastDayOfMonth = endOfMonth(calendarMonth);
  const firstDayOfCalendar = startOfWeek(firstDayOfMonth, { weekStartsOn: 0 });
  const lastDayOfCalendar = endOfWeek(lastDayOfMonth, { weekStartsOn: 0 });

  const calendarDays: Date[] = [];
  let day = firstDayOfCalendar;
  while (day <= lastDayOfCalendar) {
    calendarDays.push(day);
    day = addDays(day, 1);
  }

  // Maps
  const attendanceMap: Record<string, 'Present' | 'Absent'> = {};
  attendance.forEach(a => (attendanceMap[a.date] = a.status));

  const chaptersMap: Record<string, string[]> = {};
  chapters.forEach(c => {
    if (c.date_completed) {
      const d = c.date_completed.slice(0, 10);
      if (!chaptersMap[d]) chaptersMap[d] = [];
      chaptersMap[d].push(c.chapters?.chapter_name);
    }
  });

  const testsMap: Record<string, any[]> = {};
  testResults.forEach(t => {
    if (t.date_taken) {
      const d = t.date_taken.slice(0, 10);
      if (!testsMap[d]) testsMap[d] = [];
      testsMap[d].push({ name: t.tests?.name, marks: t.marks_obtained, total: t.tests?.total_marks });
    }
  });

  // Filtered test results & chapters
  const filteredTests = testResults.filter(t => {
    const subjectMatch = subjectFilter === 'all' || t.tests?.subject === subjectFilter;
    const monthMatch = monthFilter === 'all' || format(new Date(t.date_taken), 'yyyy-MM') === monthFilter;
    return subjectMatch && monthMatch;
  });

  const filteredChapters = chapters.filter(c => {
    const subjectMatch = subjectFilter === 'all' || c.chapters?.subject === subjectFilter;
    const chapterMatch = chapterFilter === 'all' || c.chapters?.chapter_name === chapterFilter;
    const monthMatch = monthFilter === 'all' || format(new Date(c.date_completed), 'yyyy-MM') === monthFilter;
    return subjectMatch && chapterMatch && monthMatch;
  });

  // Available subjects & chapters for dropdowns
  const subjects = Array.from(new Set([...chapters.map(c => c.chapters?.subject), ...testResults.map(t => t.tests?.subject)]).filter(Boolean));
  const chapterNames = Array.from(new Set(chapters.map(c => c.chapters?.chapter_name).filter(Boolean)));

  return (
    <div className="min-h-screen bg-background p-6">
      <div className="max-w-6xl mx-auto space-y-6">
        {/* HEADER */}
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

        {/* STUDENT INFO */}
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

        {/* MINI STANDARD CALENDAR */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Calendar className="h-5 w-5" /> Attendance Calendar
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline">Show Calendar</Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-3">
                <div className="flex justify-between items-center mb-2">
                  <Button size="sm" onClick={() => setCalendarMonth(new Date(calendarMonth.getFullYear(), calendarMonth.getMonth() - 1, 1))}>Prev</Button>
                  <span className="font-medium">{format(calendarMonth, 'MMMM yyyy')}</span>
                  <Button size="sm" onClick={() => setCalendarMonth(new Date(calendarMonth.getFullYear(), calendarMonth.getMonth() + 1, 1))}>Next</Button>
                </div>
                <div className="grid grid-cols-7 gap-0.5 text-xs text-center mb-1">
                  {weekdays.map(day => (
                    <div key={day} className="font-medium">{day}</div>
                  ))}
                </div>
                <div className="grid grid-cols-7 gap-0.5 text-xs text-center">
                  {calendarDays.map(date => {
                    const dateStr = format(date, 'yyyy-MM-dd');
                    const status = attendanceMap[dateStr];
                    const isCurrentMonth = date.getMonth() === calendarMonth.getMonth();
                    return (
                      <Tooltip
                        key={dateStr}
                        content={
                          <div className="text-xs">
                            <p><strong>{status || 'No Record'}</strong></p>
                            <p>Chapters: {chaptersMap[dateStr]?.join(', ') || '-'}</p>
                            <p>Tests: {testsMap[dateStr]?.map(t => `${t.name} (${t.marks}/${t.total})`).join(', ') || '-'}</p>
                          </div>
                        }
                      >
                        <div
                          className={`p-1 text-center rounded cursor-pointer w-6 h-6 flex items-center justify-center ${
                            !isCurrentMonth ? 'bg-gray-100 text-gray-400' :
                            status === 'Present' ? 'bg-green-700 text-white' :
                            status === 'Absent' ? 'bg-red-700 text-white' :
                            'bg-gray-200 text-black'
                          }`}
                        >
                          {format(date, 'd')}
                        </div>
                      </Tooltip>
                    );
                  })}
                </div>
              </PopoverContent>
            </Popover>
          </CardContent>
        </Card>

        {/* ATTENDANCE SUMMARY */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Calendar className="h-5 w-5" />
              Attendance Summary
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
              <div className="text-center p-4 bg-blue-50 rounded-lg">
                <p className="text-2xl font-bold text-blue-600">{totalDays}</p>
                <p className="text-sm text-muted-foreground">Total Days</p>
              </div>
              <div className="text-center p-4 bg-green-50 rounded-lg">
                <p className="text-2xl font-bold text-green-700">{presentDays}</p>
                <p className="text-sm text-muted-foreground">Present</p>
              </div>
              <div className="text-center p-4 bg-red-50 rounded-lg">
                <p className="text-2xl font-bold text-red-700">{absentDays}</p>
                <p className="text-sm text-muted-foreground">Absent</p>
              </div>
              <div className="text-center p-4 bg-purple-50 rounded-lg">
                <p className="text-2xl font-bold text-purple-600">{attendancePercentage}%</p>
                <p className="text-sm text-muted-foreground">Attendance</p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* TEST RESULTS FILTER */}
        <Card>
          <CardHeader className="flex flex-col md:flex-row md:items-center md:justify-between gap-2">
            <CardTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5" /> Test Results
            </CardTitle>
            <div className="flex gap-2 flex-wrap">
              <select value={subjectFilter} onChange={e => setSubjectFilter(e.target.value)} className="border rounded p-1 text-sm">
                <option value="all">All Subjects</option>
                {subjects.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
              <input type="month" value={monthFilter} onChange={e => setMonthFilter(e.target.value)} className="border rounded p-1 text-sm" />
            </div>
          </CardHeader>
          <CardContent>
            {filteredTests.length === 0 ? (
              <p className="text-muted-foreground text-center py-4">No test results</p>
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
                        <TableCell>{result.marks_obtained}/{result.tests?.total_marks || 0}</TableCell>
                        <TableCell className={percentage >= 75 ? 'text-green-600 font-semibold' : percentage >= 50 ? 'text-yellow-600 font-semibold' : 'text-red-600 font-semibold'}>
                          {percentage}%
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>

        {/* CHAPTERS STUDIED FILTER */}
        <Card>
          <CardHeader className="flex flex-col md:flex-row md:items-center md:justify-between gap-2">
            <CardTitle className="flex items-center gap-2">
              <BookOpen className="h-5 w-5" /> Chapters Studied
            </CardTitle>
            <div className="flex gap-2 flex-wrap">
              <select value={subjectFilter} onChange={e => setSubjectFilter(e.target.value)} className="border rounded p-1 text-sm">
                <option value="all">All Subjects</option>
                {subjects.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
              <select value={chapterFilter} onChange={e => setChapterFilter(e.target.value)} className="border rounded p-1 text-sm">
                <option value="all">All Chapters</option>
                {chapterNames.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
              <input type="month" value={monthFilter} onChange={e => setMonthFilter(e.target.value)} className="border rounded p-1 text-sm" />
            </div>
          </CardHeader>
          <CardContent>
            {filteredChapters.length === 0 ? (
              <p className="text-muted-foreground text-center py-4">No chapters recorded</p>
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
                      <TableCell>{chapter.date_completed ? new Date(chapter.date_completed).toLocaleDateString() : '-'}</TableCell>
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
