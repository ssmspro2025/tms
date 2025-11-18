import React, { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { XCircle, CheckCircle2, Users, TrendingUp, CalendarIcon, BookOpen, FileText } from "lucide-react";
import { format, startOfMonth, endOfMonth } from "date-fns";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";

interface Student {
  id: string;
  name: string;
  grade: string;
  center_id: string;
}

interface Attendance {
  id: string;
  student_id: string;
  date: string;
  status: "Present" | "Absent";
  time_in?: string;
  time_out?: string;
}

interface ChapterProgress {
  id: string;
  student_id: string;
  chapters: { chapter_name: string; subject: string };
  completed: boolean;
  date_completed: string;
}

interface TestResult {
  id: string;
  student_id: string;
  tests: { name: string; subject: string; total_marks: number };
  marks_obtained: number;
  date_taken: string;
}

export default function Dashboard() {
  const { user, loading } = useAuth();
  const today = new Date().toISOString().split("T")[0];
  const centerId = user?.center_id;
  const role = user?.role;

  const [gradeFilter, setGradeFilter] = useState<string>("all");
  const [selectedStudent, setSelectedStudent] = useState<Student | null>(null);

  // Fetch students
  const { data: students = [] } = useQuery({
    queryKey: ["students", centerId],
    queryFn: async () => {
      let query = supabase.from("students").select("*").order("name");
      if (role !== "admin" && centerId) query = query.eq("center_id", centerId);
      const { data, error } = await query;
      if (error) throw error;
      return data as Student[];
    },
  });

  const filteredStudents = students.filter(s => gradeFilter === "all" || s.grade === gradeFilter);

  // Fetch attendance
  const { data: attendance = [] } = useQuery({
    queryKey: ["attendance", centerId],
    queryFn: async () => {
      const studentIds = students.map(s => s.id);
      if (studentIds.length === 0) return [];
      const { data, error } = await supabase
        .from("attendance")
        .select("*")
        .in("student_id", studentIds);
      if (error) throw error;
      return data as Attendance[];
    },
    enabled: students.length > 0,
  });

  // Fetch chapter progress
  const { data: chapterProgress = [] } = useQuery({
    queryKey: ["chapterProgress", centerId],
    queryFn: async () => {
      const studentIds = students.map(s => s.id);
      if (studentIds.length === 0) return [];
      const { data, error } = await supabase
        .from("student_chapters")
        .select("*, chapters(*)")
        .in("student_id", studentIds);
      if (error) throw error;
      return data as ChapterProgress[];
    },
    enabled: students.length > 0,
  });

  // Fetch test results
  const { data: testResults = [] } = useQuery({
    queryKey: ["testResults", centerId],
    queryFn: async () => {
      const studentIds = students.map(s => s.id);
      if (studentIds.length === 0) return [];
      const { data, error } = await supabase
        .from("test_results")
        .select("*, tests(*)")
        .in("student_id", studentIds);
      if (error) throw error;
      return data as TestResult[];
    },
    enabled: students.length > 0,
  });

  // Calculations for cards
  const totalStudents = filteredStudents.length;
  const presentToday = attendance.filter(a => a.date === today && a.status === "Present").length;
  const absentToday = totalStudents - presentToday;
  const absentRate = totalStudents ? Math.round((absentToday / totalStudents) * 100) : 0;

  const stats = [
    { title: "Total Students", value: totalStudents, icon: Users, color: "text-primary", bgColor: "bg-primary/10" },
    { title: "Present Today", value: presentToday, icon: CheckCircle2, color: "text-secondary", bgColor: "bg-secondary/10" },
    { title: "Absent Today", value: absentToday, icon: XCircle, color: "text-destructive", bgColor: "bg-destructive/10" },
    { title: "Absent Rate", value: `${absentRate}%`, icon: TrendingUp, color: "text-accent", bgColor: "bg-accent/10" },
  ];

  // Highest absentee calculation
  const studentSummary = filteredStudents.map(student => {
    const studentAttendance = attendance.filter(a => a.student_id === student.id);
    const present = studentAttendance.filter(a => a.status === "Present").length;
    const absent = studentAttendance.filter(a => a.status === "Absent").length;
    const total = present + absent;
    const percentage = total > 0 ? Math.round((absent / total) * 100) : 0;
    return { ...student, absent, total, absentPercentage: percentage };
  });

  const highestAbsentees = [...studentSummary].sort((a, b) => b.absentPercentage - a.absentPercentage);

  if (loading) return <p>Loading dashboard...</p>;

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-3xl font-bold">Dashboard</h2>
        <p className="text-muted-foreground">Welcome back! Here's today's attendance overview.</p>
      </div>

      {/* Cards */}
      <div className="grid gap-4 md:grid-cols-4">
        {stats.map((stat) => {
          const Icon = stat.icon;
          return (
            <Card key={stat.title} className="transition-all hover:shadow-md">
              <CardHeader className="flex items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium">{stat.title}</CardTitle>
                <div className={`rounded-lg p-2 ${stat.bgColor}`}>
                  <Icon className={`h-4 w-4 ${stat.color}`} />
                </div>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{stat.value}</div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Grade Filter */}
      <Card>
        <CardHeader>
          <CardTitle>Filter by Grade</CardTitle>
        </CardHeader>
        <CardContent>
          <Select value={gradeFilter} onValueChange={setGradeFilter}>
            <SelectTrigger className="w-[200px]">
              <SelectValue placeholder="Select grade" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Grades</SelectItem>
              {Array.from(new Set(students.map(s => s.grade))).map(g => (
                <SelectItem key={g} value={g}>{g}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </CardContent>
      </Card>

      {/* Tables */}
      <div className="flex gap-4">
        {/* Absent Today Table */}
        <div className="flex-1 overflow-y-auto max-h-[400px] border rounded-lg">
          <table className="w-full">
            <thead className="bg-muted">
              <tr>
                <th className="px-4 py-2 text-left">Student</th>
                <th className="px-4 py-2 text-left">Grade</th>
                <th className="px-4 py-2 text-center">Absent Today</th>
              </tr>
            </thead>
            <tbody>
              {studentSummary.filter(s => attendance.some(a => a.student_id === s.id && a.date === today && a.status === "Absent"))
                .map(student => (
                  <tr key={student.id} className="border-t hover:bg-gray-50 cursor-pointer"
                      onClick={() => setSelectedStudent(student)}>
                    <td className="px-4 py-2 font-medium">{student.name}</td>
                    <td className="px-4 py-2">{student.grade}</td>
                    <td className="px-4 py-2 text-center">
                      <Badge variant="destructive">{student.absent}</Badge>
                    </td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>

        {/* Highest Absentee Table */}
        <div className="flex-1 overflow-y-auto max-h-[400px] border rounded-lg">
          <table className="w-full">
            <thead className="bg-muted">
              <tr>
                <th className="px-4 py-2 text-left">Student</th>
                <th className="px-4 py-2 text-left">Grade</th>
                <th className="px-4 py-2 text-center">Absent Rate %</th>
              </tr>
            </thead>
            <tbody>
              {highestAbsentees.map(student => (
                <tr key={student.id} className="border-t hover:bg-gray-50 cursor-pointer"
                    onClick={() => setSelectedStudent(student)}>
                  <td className="px-4 py-2 font-medium">{student.name}</td>
                  <td className="px-4 py-2">{student.grade}</td>
                  <td className="px-4 py-2 text-center">
                    <Badge variant={student.absentPercentage > 50 ? "destructive" : "default"}>
                      {student.absentPercentage}%
                    </Badge>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Student Report Modal */}
      <Dialog open={!!selectedStudent} onOpenChange={() => setSelectedStudent(null)}>
        <DialogContent className="max-w-4xl w-full overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{selectedStudent?.name} - Grade {selectedStudent?.grade}</DialogTitle>
          </DialogHeader>
          <Card className="mt-2">
            <CardContent>
              {/* Attendance Overview */}
              <div className="grid gap-4 md:grid-cols-4 mb-4">
                <div className="space-y-1">
                  <p className="text-sm text-muted-foreground">Total Days</p>
                  <p className="text-lg font-bold">
                    {attendance.filter(a => a.student_id === selectedStudent?.id).length}
                  </p>
                </div>
                <div className="space-y-1">
                  <p className="text-sm text-muted-foreground">Present</p>
                  <p className="text-lg font-bold text-green-600">
                    {attendance.filter(a => a.student_id === selectedStudent?.id && a.status === "Present").length}
                  </p>
                </div>
                <div className="space-y-1">
                  <p className="text-sm text-muted-foreground">Absent</p>
                  <p className="text-lg font-bold text-red-600">
                    {attendance.filter(a => a.student_id === selectedStudent?.id && a.status === "Absent").length}
                  </p>
                </div>
                <div className="space-y-1">
                  <p className="text-sm text-muted-foreground">Attendance %</p>
                  <p className="text-lg font-bold">
                    {(() => {
                      const total = attendance.filter(a => a.student_id === selectedStudent?.id).length;
                      const present = attendance.filter(a => a.student_id === selectedStudent?.id && a.status === "Present").length;
                      return total > 0 ? Math.round((present / total) * 100) : 0;
                    })()}%
                  </p>
                </div>
              </div>

              {/* Chapter Progress */}
              <div className="mb-4">
                <h4 className="font-semibold mb-2 flex items-center gap-2"><BookOpen className="h-4 w-4"/> Chapter Progress</h4>
                <div className="space-y-2 max-h-60 overflow-y-auto">
                  {chapterProgress.filter(cp => cp.student_id === selectedStudent?.id).map(cp => (
                    <div key={cp.id} className="flex justify-between p-2 border rounded">
                      <p>{cp.chapters.chapter_name} ({cp.chapters.subject})</p>
                      <Badge variant={cp.completed ? "default" : "secondary"}>{cp.completed ? "Completed" : "In Progress"}</Badge>
                    </div>
                  ))}
                </div>
              </div>

              {/* Test Results */}
              <div>
                <h4 className="font-semibold mb-2 flex items-center gap-2"><FileText className="h-4 w-4"/> Test Results</h4>
                <div className="space-y-2 max-h-60 overflow-y-auto">
                  {testResults.filter(tr => tr.student_id === selectedStudent?.id).map(tr => (
                    <div key={tr.id} className="flex justify-between p-2 border rounded">
                      <div>
                        <p className="font-medium">{tr.tests.name} ({tr.tests.subject})</p>
                        <p className="text-sm text-muted-foreground">{format(new Date(tr.date_taken), "PPP")}</p>
                      </div>
                      <div className="text-right">
                        <Badge variant="default">{tr.marks_obtained}/{tr.tests.total_marks}</Badge>
                        <p className="text-sm">{Math.round((tr.marks_obtained / tr.tests.total_marks) * 100)}%</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </CardContent>
          </Card>
        </DialogContent>
      </Dialog>
    </div>
  );
}
