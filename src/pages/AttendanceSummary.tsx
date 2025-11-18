import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { format, startOfMonth, endOfMonth, eachDayOfInterval } from 'date-fns';

interface AttendanceStats {
  studentId: string;
  studentName: string;
  totalDays: number;
  presentDays: number;
  absentDays: number;
  attendancePercentage: number;
}

export default function AttendanceSummary() {
  const { user } = useAuth();
  const [selectedMonth, setSelectedMonth] = useState(new Date());
  const [selectedGrade, setSelectedGrade] = useState('all');
  const [selectedStudent, setSelectedStudent] = useState('all');

  // Fetch all students
  const { data: students = [] } = useQuery({
    queryKey: ['students', user?.center_id],
    queryFn: async () => {
      let query = supabase
        .from('students')
        .select('id, name, grade')
        .order('name');

      if (user?.role !== 'admin' && user?.center_id) {
        query = query.eq('center_id', user.center_id);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data;
    },
  });

  // Unique grades for filter
  const grades = Array.from(new Set(students.map(s => s.grade))).sort();

  // Fetch attendance records
  const { data: attendanceData = [] } = useQuery({
    queryKey: ['attendance-summary', selectedMonth.toISOString().slice(0, 7), user?.center_id],
    queryFn: async () => {
      const startDate = format(startOfMonth(selectedMonth), 'yyyy-MM-dd');
      const endDate = format(endOfMonth(selectedMonth), 'yyyy-MM-dd');

      const studentIds = students.map(s => s.id);
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

  // Filter students by selected grade
  const filteredStudents = students.filter(
    s => selectedGrade === 'all' || s.grade === selectedGrade
  );

  // Calculate statistics
  const calculateStats = (): AttendanceStats[] => {
    const statsMap = new Map<string, AttendanceStats>();

    attendanceData.forEach((record: any) => {
      // Skip students not in filtered grade
      if (!filteredStudents.some(fs => fs.id === record.student_id)) return;

      const key = record.student_id;
      if (!statsMap.has(key)) {
        statsMap.set(key, {
          studentId: key,
          studentName: record.students?.name || 'Unknown',
          totalDays: 0,
          presentDays: 0,
          absentDays: 0,
          attendancePercentage: 0,
        });
      }

      const stats = statsMap.get(key)!;
      stats.totalDays += 1;
      if (record.status === 'Present') {
        stats.presentDays += 1;
      } else {
        stats.absentDays += 1;
      }
    });

    statsMap.forEach((stats) => {
      stats.attendancePercentage = stats.totalDays > 0
        ? Math.round((stats.presentDays / stats.totalDays) * 100)
        : 0;
    });

    return Array.from(statsMap.values());
  };

  const stats = calculateStats();

  // Calendar helpers
  const daysInMonth = eachDayOfInterval({
    start: startOfMonth(selectedMonth),
    end: endOfMonth(selectedMonth),
  });

  const getAttendanceStatus = (date: string, studentId: string) => {
    const record = attendanceData.find(
      (a: any) => format(new Date(a.date), 'yyyy-MM-dd') === date && a.student_id === studentId
    );
    if (!record) return 'none';
    return record.status === 'Present' ? 'present' : 'absent';
  };

  const colors = {
    present: '#22c55e',
    absent: '#ef4444',
    none: '#e5e7eb',
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-3xl font-bold tracking-tight">Attendance Summary</h2>
        <p className="text-muted-foreground">View attendance history and statistics</p>
      </div>

      {/* Filters */}
      <Card>
        <CardHeader>
          <CardTitle>Filters</CardTitle>
        </CardHeader>
        <CardContent className="flex gap-4">
          <div className="flex-1">
            <Label>Month</Label>
            <input
              type="month"
              value={format(selectedMonth, 'yyyy-MM')}
              onChange={(e) => {
                const [year, month] = e.target.value.split('-');
                setSelectedMonth(new Date(parseInt(year), parseInt(month) - 1));
              }}
              className="w-full px-3 py-2 border rounded-md"
            />
          </div>

          <div className="flex-1">
            <Label>Grade</Label>
            <Select value={selectedGrade} onValueChange={setSelectedGrade}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Grades</SelectItem>
                {grades.map((g) => (
                  <SelectItem key={g} value={g}>{g}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="flex-1">
            <Label>Student</Label>
            <Select value={selectedStudent} onValueChange={setSelectedStudent}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Students</SelectItem>
                {filteredStudents.map((student) => (
                  <SelectItem key={student.id} value={student.id}>
                    {student.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Calendar */}
      {selectedStudent !== 'all' && (
        <Card>
          <CardHeader>
            <CardTitle>Monthly Calendar - {format(selectedMonth, 'MMMM yyyy')}</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-7 gap-2">
              {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((day) => (
                <div key={day} className="text-center font-semibold text-sm text-muted-foreground py-2">
                  {day}
                </div>
              ))}
              {daysInMonth.map((date) => {
                const status = getAttendanceStatus(format(date, 'yyyy-MM-dd'), selectedStudent);
                return (
                  <div
                    key={format(date, 'yyyy-MM-dd')}
                    className="aspect-square rounded-lg flex items-center justify-center text-sm font-medium cursor-pointer"
                    style={{
                      backgroundColor:
                        status === 'present' ? colors.present :
                        status === 'absent' ? colors.absent :
                        colors.none,
                      color: status !== 'none' ? 'white' : 'inherit',
                    }}
                    title={`${format(date, 'MMM d')} - ${status === 'present' ? 'Present' : status === 'absent' ? 'Absent' : 'No record'}`}
                  >
                    {format(date, 'd')}
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Monthly Statistics */}
      {stats.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Monthly Statistics</CardTitle>
          </CardHeader>
          <CardContent>
            {stats.map((stat) => (
              <div key={stat.studentId} className="border rounded-lg p-4 mb-4">
                <div className="flex items-center justify-between mb-2">
                  <div>
                    <h3 className="font-semibold">{stat.studentName}</h3>
                    <p className="text-sm text-muted-foreground">Attendance Rate: {stat.attendancePercentage}%</p>
                  </div>
                  <div className="text-right">
                    <p className="text-2xl font-bold text-green-600">{stat.presentDays}</p>
                    <p className="text-xs text-muted-foreground">Present</p>
                  </div>
                </div>
                <div className="w-full h-2 bg-gray-200 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-green-600 transition-all duration-300"
                    style={{ width: `${stat.attendancePercentage}%` }}
                  />
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
