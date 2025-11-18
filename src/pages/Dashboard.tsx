import React, { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Download, Users, CheckCircle2, XCircle, TrendingUp } from "lucide-react";
import { format } from "date-fns";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";

export default function Dashboard() {
  const { user, loading } = useAuth();
  const today = new Date().toISOString().split("T")[0];
  const centerId = user?.center_id;
  const role = user?.role;

  const [gradeFilter, setGradeFilter] = useState<string>("all");
  const [selectedStudent, setSelectedStudent] = useState<any>(null);

  // Fetch students
  const { data: students = [] } = useQuery({
    queryKey: ["students", centerId],
    queryFn: async () => {
      let query = supabase.from("students").select("*").order("name");
      if (role !== "admin" && centerId) query = query.eq("center_id", centerId);
      const { data, error } = await query;
      if (error) throw error;
      return data || [];
    },
    enabled: !!user && !loading,
  });

  // Filtered students by grade
  const filteredStudents = students.filter(
    (s) => gradeFilter === "all" || s.grade === gradeFilter
  );

  // Fetch attendance
  const { data: allAttendance = [] } = useQuery({
    queryKey: ["attendance", centerId],
    queryFn: async () => {
      const studentIds = students.map((s) => s.id);
      if (!studentIds.length) return [];
      const { data, error } = await supabase
        .from("attendance")
        .select("*")
        .in("student_id", studentIds);
      if (error) throw error;
      return data || [];
    },
    enabled: students.length > 0,
  });

  // Compute statistics
  const presentToday = students.filter((student) =>
    allAttendance.some(
      (att) =>
        att.student_id === student.id &&
        att.date === today &&
        att.status === "Present"
    )
  );

  const absentToday = students.filter((student) =>
    allAttendance.some(
      (att) =>
        att.student_id === student.id &&
        att.date === today &&
        att.status === "Absent"
    )
  );

  const totalStudents = students.length;
  const presentCount = presentToday.length;
  const absentCount = absentToday.length;
  const absentRate = totalStudents
    ? Math.round((absentCount / totalStudents) * 100)
    : 0;

  // Prepare data for Highest Absentee Table
  const studentAttendanceSummary = students.map((student) => {
    const studentAttendance = allAttendance.filter(
      (a) => a.student_id === student.id
    );
    const present = studentAttendance.filter((a) => a.status === "Present")
      .length;
    const absent = studentAttendance.filter((a) => a.status === "Absent")
      .length;
    const total = present + absent;
    const percentage = total > 0 ? Math.round((absent / total) * 100) : 0;
    return { ...student, present, absent, total, percentage };
  });

  const highestAbsentees = [...studentAttendanceSummary]
    .sort((a, b) => b.percentage - a.percentage)
    .filter((s) => gradeFilter === "all" || s.grade === gradeFilter);

  // Grades for filter
  const grades = [...new Set(students.map((s) => s.grade))];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h2 className="text-3xl font-bold tracking-tight">Dashboard</h2>
        <p className="text-muted-foreground">
          Welcome back! Here's today's attendance overview.
        </p>
      </div>

      {/* Stats Cards */}
      <div className="grid gap-4 md:grid-cols-4">
        {[
          {
            title: "Total Students",
            value: totalStudents,
            icon: Users,
            color: "text-primary",
            bgColor: "bg-primary/10",
          },
          {
            title: "Present Today",
            value: presentCount,
            icon: CheckCircle2,
            color: "text-secondary",
            bgColor: "bg-secondary/10",
          },
          {
            title: "Absent Today",
            value: absentCount,
            icon: XCircle,
            color: "text-destructive",
            bgColor: "bg-destructive/10",
          },
          {
            title: "Absent Rate",
            value: `${absentRate}%`,
            icon: TrendingUp,
            color: "text-accent",
            bgColor: "bg-accent/10",
          },
        ].map((stat) => {
          const Icon = stat.icon;
          return (
            <Card key={stat.title} className="transition-all hover:shadow-md">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
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
      <div className="flex gap-4 items-center">
        <Select value={gradeFilter} onValueChange={setGradeFilter}>
          <SelectTrigger className="w-[150px]">
            <SelectValue placeholder="All Grades" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Grades</SelectItem>
            {grades.map((grade) => (
              <SelectItem key={grade} value={grade}>
                {grade}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Tables */}
      <div className="flex gap-6 overflow-x-auto">
        {/* Absent Today Table */}
        <Card className="flex-1">
          <CardHeader>
            <CardTitle>Absent Today</CardTitle>
          </CardHeader>
          <CardContent className="max-h-[400px] overflow-y-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Grade</TableHead>
                  <TableHead className="text-center">Absent Today</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {absentToday.map((student) => (
                  <TableRow
                    key={student.id}
                    className="cursor-pointer hover:bg-muted"
                    onClick={() => setSelectedStudent(student)}
                  >
                    <TableCell>{student.name}</TableCell>
                    <TableCell>{student.grade}</TableCell>
                    <TableCell className="text-center">
                      {allAttendance.filter(
                        (a) =>
                          a.student_id === student.id &&
                          a.date === today &&
                          a.status === "Absent"
                      ).length}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        {/* Highest Absentee Table */}
        <Card className="flex-1">
          <CardHeader>
            <CardTitle>Highest Absentee</CardTitle>
          </CardHeader>
          <CardContent className="max-h-[400px] overflow-y-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Grade</TableHead>
                  <TableHead className="text-center">Absent %</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {highestAbsentees.map((student) => (
                  <TableRow
                    key={student.id}
                    className="cursor-pointer hover:bg-muted"
                    onClick={() => setSelectedStudent(student)}
                  >
                    <TableCell>{student.name}</TableCell>
                    <TableCell>{student.grade}</TableCell>
                    <TableCell className="text-center">{student.percentage}%</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>

      {/* Student Modal */}
      {selectedStudent && (
        <Dialog open={!!selectedStudent} onOpenChange={() => setSelectedStudent(null)}>
          <DialogContent className="max-w-xl">
            <DialogHeader>
              <DialogTitle>{selectedStudent.name} - Grade {selectedStudent.grade}</DialogTitle>
            </DialogHeader>
            <div className="grid grid-cols-2 gap-4">
              <Card className="p-2">
                <CardTitle className="text-sm">Total Days</CardTitle>
                <CardContent>{studentAttendanceSummary.find(s => s.id === selectedStudent.id)?.total || 0}</CardContent>
              </Card>
              <Card className="p-2">
                <CardTitle className="text-sm">Present</CardTitle>
                <CardContent>{studentAttendanceSummary.find(s => s.id === selectedStudent.id)?.present || 0}</CardContent>
              </Card>
              <Card className="p-2">
                <CardTitle className="text-sm">Absent</CardTitle>
                <CardContent>{studentAttendanceSummary.find(s => s.id === selectedStudent.id)?.absent || 0}</CardContent>
              </Card>
              <Card className="p-2">
                <CardTitle className="text-sm">Absent %</CardTitle>
                <CardContent>{studentAttendanceSummary.find(s => s.id === selectedStudent.id)?.percentage || 0}%</CardContent>
              </Card>
            </div>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}
