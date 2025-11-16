import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { format, startOfMonth, endOfMonth, eachDayOfInterval } from 'date-fns';

interface AttendanceStats {
  studentId: string;
  studentName: string;
  studentGrade: string;
  totalDays: number;
  presentDays: number;
  absentDays: number;
  attendancePercentage: number;
}

export default function AttendanceSummary() {
  const { user } = useAuth();
  const [selectedMonth, setSelectedMonth] = useState(new Date());
  const [selectedStudent, setSelectedStudent] = useState('all');
  const [selectedGrade, setSelectedGrade] = useState('all');

  // Fetch unique grades for filter dropdown
  const { data: grades = [] } = useQuery({
    queryKey: ['grades', user?.center_id],
    queryFn: async () => {
      let query = supabase.from('students').select('grade').order('grade');

      if (user?.role !== 'admin' && user?.center_id) {
        query = query.eq('center_id', user.center_id);
      }

      const { data, error } = await query;
      if (error) throw error;

      const unique = Array.from(new Set(data.map((x) => x.grade).filter(Boolean)));
      return unique;
    },
  });

  // Fetch students (with grade filter)
  const { data: students = [] } = useQuery({
    queryKey: ['students', user?.center_id, selectedGrade],
    queryFn: async () => {
      let query = supabase
        .from('students')
        .select('id, name, grade')
        .order('name');

      if (user?.role !== 'admin' && user?.center_id) {
        query = query.eq('center_id', user.center_id);
      }

      if (selectedGrade !== 'all') {
        query = query.eq('grade', selectedGrade);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data;
    },
  });

  // Fetch attendance
  const { data: attendanceData = [] } = useQuery({
    queryKey: ['attendance-summary', selectedMonth.toISOString().slice(0, 7), user?.center_id, selectedGrade],
    queryFn: async () => {
      const startDate = format(startOfMonth(selectedMonth), 'yyyy-MM-dd');
      const endDate = format(endOfMonth(selectedMonth), 'yyyy-MM-dd');

      const studentIds = students.map((s) => s.id);
      if (studentIds.length === 0) return [];

      const { data, error } = await supabase
        .from('attendance')
        .select('*, students(name, grade)')
        .in('student_id', studentIds)
        .gte('date', startDate)
        .lte('date', endDate)
        .order('date');

      if (error) throw error;
      return data;
    },
    enabled: students.length > 0,
  });

  const calculateStats = (): AttendanceStats[] => {
    const statsMap = new Map<string, AttendanceStats>();

    attendanceData.forEach((r: any) => {
      const key = r.student_id;

      if (!statsMap.has(key)) {
        statsMap.set(key, {
          studentId: key,
          studentName: r.students?.name || 'Unknown',
          studentGrade: r.students?.grade || '-',
          totalDays: 0,
          presentDays: 0,
          absentDays: 0,
          attendancePercentage: 0,
        });
      }

      const s = statsMap.get(key)!;
      s.totalDays += 1;
      if (r.status === 'Present') s.presentDays++;
      else s.absentDays++;
    });

    statsMap.forEach((s) => {
      s.attendancePercentage = s.totalDays
        ? Math.round((s.presentDays / s.totalDays) * 100)
        : 0;
    });

    return Array.from(statsMap.values());
  };

  const getMonthlyCalendarData = () => {
    const daysInMonth = eachDayOfInterval({
      start: startOfMonth(selectedMonth),
      end: endOfMonth(selectedMonth),
    });

    const selectedStudentId = selectedStudent === 'all' ? null : selectedStudent;

    const stats = calculateStats();
    const filtered = selectedStudentId
      ? stats.filter((s) => s.studentId === selectedStudentId)
      : stats;

    return { daysInMonth, stats: filtered };
  };

  const { data: allTime = [] } = useQuery({
    queryKey: ['all-time-attendance', user?.center_id, selectedGrade],
    queryFn: async () => {
      const studentIds = students.map((s) => s.id);
      if (studentIds.length === 0) return [];

      const { data, error } = await supabase
        .from('attendance')
        .select('*, students(name, grade)')
        .in('student_id', studentIds)
        .order('date');

      if (error) throw error;
      return data;
    },
    enabled: students.length > 0,
  });

  const calculateAllTime = (): AttendanceStats[] => {
    const statsMap = new Map<string, AttendanceStats>();

    allTime.forEach((r: any) => {
      const key = r.student_id;

      if (!statsMap.has(key)) {
        statsMap.set(key, {
          studentId: key,
          studentName: r.students?.name || 'Unknown',
          studentGrade: r.students?.grade || '-',
          totalDays: 0,
          presentDays: 0,
          absentDays: 0,
          attendancePercentage: 0,
        });
      }

      const s = statsMap.get(key)!;
      s.totalDays++;
      if (r.status === 'Present') s.presentDays++;
      else s.absentDays++;
    });

    statsMap.forEach((s) => {
      s.attendancePercentage = s.totalDays
        ? Math.round((s.presentDays / s.totalDays) * 100)
        : 0;
    });

    return Array.from(statsMap.values());
  };

  const { daysInMonth, stats } = getMonthlyCalendarData();
  const allTimeStats = calculateAllTime();

  const getAttendanceStatus = (date: string, studentId: string) => {
    const r = attendanceData.find(
      (a: any) =>
        format(new Date(a.date), 'yyyy-MM-dd') === date &&
        a.student_id === studentId
    );
    if (!r) return 'none';
    return r.status === 'Present' ? 'present' : 'absent';
  };

  const colors = {
    present: '#22c55e',
    absent: '#ef4444',
    none: '#e5e7eb',
  };

  return (
    <div className="space-y-6">
      <h2 className="text-3xl font-bold">Attendance Summary</h2>

      {/* FILTERS */}
      <Card>
        <CardHeader>
          <CardTitle>Filters</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-1 md:grid-cols-3 gap-4">

          {/* MONTH */}
          <div>
            <Label>Month</Label>
            <input
              type="month"
              value={format(selectedMonth, 'yyyy-MM')}
              onChange={(e) => {
                const [year, month] = e.target.value.split('-');
                setSelectedMonth(new Date(+year, +month - 1));
              }}
              className="w-full border px-3 py-2 rounded-md"
            />
          </div>

          {/* STUDENT */}
          <div>
            <Label>Student</Label>
            <Select value={selectedStudent} onValueChange={setSelectedStudent}>
              <SelectTrigger>
                <SelectValue placeholder="Select Student" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Students</SelectItem>
                {students.map((s) => (
                  <SelectItem key={s.id} value={s.id}>
                    {s.name} • Grade {s.grade}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* GRADE FILTER */}
          <div>
            <Label>Grade</Label>
            <Select value={selectedGrade} onValueChange={setSelectedGrade}>
              <SelectTrigger>
                <SelectValue placeholder="Select Grade" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Grades</SelectItem>
                {grades.map((g) => (
                  <SelectItem key={g} value={g}>
                    Grade {g}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

        </CardContent>
      </Card>

      {/* MONTHLY STATS */}
      {stats.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Monthly Statistics</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4">

            {stats.map((s) => (
              <div key={s.studentId} className="border rounded-lg p-4">
                <div className="flex items-center justify-between mb-4">
                  
                  <div>
                    <h3 className="font-semibold text-xl flex items-center gap-2">
                      {s.studentName}
                      <Badge variant="secondary">Grade {s.studentGrade}</Badge>
                    </h3>
                    <p className="text-sm text-muted-foreground">
                      Attendance Rate: {s.attendancePercentage}%
                    </p>
                  </div>

                  <div className="text-right">
                    <p className="text-2xl font-bold text-green-600">
                      {s.presentDays}
                    </p>
                    <p className="text-xs text-muted-foreground">Present</p>
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-4 mb-4">
                  <div className="text-center bg-blue-50 p-3 rounded-lg">
                    <p className="text-xl font-bold text-blue-600">{s.totalDays}</p>
                    <p className="text-xs">Total Days</p>
                  </div>
                  <div className="text-center bg-green-50 p-3 rounded-lg">
                    <p className="text-xl font-bold text-green-600">{s.presentDays}</p>
                    <p className="text-xs">Present</p>
                  </div>
                  <div className="text-center bg-red-50 p-3 rounded-lg">
                    <p className="text-xl font-bold text-red-600">{s.absentDays}</p>
                    <p className="text-xs">Absent</p>
                  </div>
                </div>

                <div className="h-2 w-full bg-gray-200 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-green-600"
                    style={{ width: `${s.attendancePercentage}%` }}
                  />
                </div>
              </div>
            ))}

          </CardContent>
        </Card>
      )}

      {/* OVERALL SUMMARY */}
      <Card>
        <CardHeader>
          <CardTitle>Overall Attendance Summary</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="border-b font-semibold">
                <tr>
                  <th className="text-left px-4 py-2">Student</th>
                  <th className="text-left px-4 py-2">Grade</th>
                  <th className="text-right px-4 py-2">Total</th>
                  <th className="text-right px-4 py-2">Present</th>
                  <th className="text-right px-4 py-2">Absent</th>
                  <th className="text-right px-4 py-2">%</th>
                </tr>
              </thead>
              <tbody>
                {allTimeStats.map((s) => (
                  <tr key={s.studentId} className="border-b">
                    <td className="px-4 py-3 font-medium flex items-center gap-2">
                      {s.studentName}
                      <Badge variant="outline">G{s.studentGrade}</Badge>
                    </td>
                    <td className="px-4 py-3">{s.studentGrade}</td>
                    <td className="px-4 py-3 text-right">{s.totalDays}</td>
                    <td className="px-4 py-3 text-right text-green-600 font-semibold">
                      {s.presentDays}
                    </td>
                    <td className="px-4 py-3 text-right text-red-600 font-semibold">
                      {s.absentDays}
                    </td>
                    <td className="px-4 py-3 text-right font-bold">
                      {s.attendancePercentage}%
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
