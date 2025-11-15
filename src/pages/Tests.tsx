import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { CalendarIcon, Download, Brain, BookOpen, FileText, Loader2 } from "lucide-react";
import { format, startOfMonth, endOfMonth } from "date-fns";

export default function StudentReport() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const [selectedGrade, setSelectedGrade] = useState<string>("all");
  const [selectedStudentId, setSelectedStudentId] = useState<string>("");
  const [dateRange, setDateRange] = useState<{ from: Date; to: Date }>({
    from: startOfMonth(new Date()),
    to: endOfMonth(new Date()),
  });
  const [subjectFilter, setSubjectFilter] = useState<string>("all");
  const [chapterSubjectFilter, setChapterSubjectFilter] = useState<string>("all");
  const [aiSummary, setAiSummary] = useState<string>("");

  // Fetch students
  const { data: students = [] } = useQuery({
    queryKey: ["students", user?.center_id, selectedGrade],
    queryFn: async () => {
      let query = supabase.from("students").select("*").order("name");
      if (user?.role !== "admin" && user?.center_id) query = query.eq("center_id", user.center_id);
      if (selectedGrade !== "all") query = query.eq("grade", selectedGrade);
      const { data, error } = await query;
      if (error) throw error;
      return data;
    },
  });

  const selectedStudent = students.find((s) => s.id === selectedStudentId);

  // Attendance
  const { data: attendanceData = [] } = useQuery({
    queryKey: ["attendance", selectedStudentId, dateRange],
    queryFn: async () => {
      if (!selectedStudentId) return [];
      const { data, error } = await supabase
        .from("attendance")
        .select("*")
        .eq("student_id", selectedStudentId)
        .gte("date", format(dateRange.from, "yyyy-MM-dd"))
        .lte("date", format(dateRange.to, "yyyy-MM-dd"))
        .order("date");
      if (error) throw error;
      return data;
    },
    enabled: !!selectedStudentId,
  });

  // Chapters
  const { data: chapterProgress = [] } = useQuery({
    queryKey: ["chapters", selectedStudentId, chapterSubjectFilter],
    queryFn: async () => {
      if (!selectedStudentId) return [];
      let query = supabase
        .from("student_chapters")
        .select("*, chapters(*)")
        .eq("student_id", selectedStudentId);
      if (chapterSubjectFilter !== "all") query = query.eq("chapters.subject", chapterSubjectFilter);
      const { data, error } = await query.order("date_completed", { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: !!selectedStudentId,
  });

  const { data: allChapters = [] } = useQuery({
    queryKey: ["all-chapters", user?.center_id],
    queryFn: async () => {
      let query = supabase.from("chapters").select("*");
      if (user?.role !== "admin" && user?.center_id) query = query.eq("center_id", user.center_id);
      const { data, error } = await query;
      if (error) throw error;
      return data;
    },
  });

  // Test results
  const { data: testResults = [] } = useQuery({
    queryKey: ["student-test-results", selectedStudentId, subjectFilter],
    queryFn: async () => {
      if (!selectedStudentId) return [];
      let query = supabase.from("test_results").select("*, tests(*)").eq("student_id", selectedStudentId);
      if (subjectFilter !== "all") query = query.eq("tests.subject", subjectFilter);
      const { data, error } = await query.order("date_taken", { ascending: false });
      if (error) throw error;
      // Map answersheet public URL
      return data.map(r => ({
        ...r,
        answersheet_link: r.answersheet_url
          ? supabase.storage.from("test-files").getPublicUrl(r.answersheet_url).data.publicUrl
          : null,
      }));
    },
    enabled: !!selectedStudentId,
  });

  // Statistics
  const totalDays = attendanceData.length;
  const presentDays = attendanceData.filter(a => a.status === "Present").length;
  const attendancePercentage = totalDays ? Math.round((presentDays / totalDays) * 100) : 0;

  const totalTests = testResults.length;
  const totalMarksObtained = testResults.reduce((sum, r) => sum + (r.marks_obtained || 0), 0);
  const totalMaxMarks = testResults.reduce((sum, r) => sum + (r.tests?.total_marks || 0), 0);
  const averagePercentage = totalMaxMarks ? Math.round((totalMarksObtained / totalMaxMarks) * 100) : 0;

  const completedChaptersCount = chapterProgress.filter(cp => cp.completed).length;
  const totalChaptersCount = allChapters.length;
  const chapterCompletionPercentage = totalChaptersCount
    ? Math.round((completedChaptersCount / totalChaptersCount) * 100)
    : 0;

  const subjects = Array.from(new Set([
    ...chapterProgress.map(c => c.chapters?.subject).filter(Boolean),
    ...testResults.map(t => t.tests?.subject).filter(Boolean)
  ]));

  // AI Summary
  const generateSummaryMutation = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.functions.invoke("ai-student-summary", {
        body: { studentId: selectedStudentId },
      });
      if (error) throw error;
      return data;
    },
    onSuccess: data => {
      setAiSummary(data.summary);
      toast.success("AI summary generated successfully");
    },
    onError: (error: any) => toast.error("Failed to generate AI summary"),
  });

  // Export CSV
  const exportCSV = () => {
    if (!selectedStudent) return;
    const csvContent = [
      ["Student Report"],
      ["Name", selectedStudent.name],
      ["Grade", selectedStudent.grade],
      [""],
      ["Attendance Summary"],
      ["Total Days", totalDays],
      ["Present", presentDays],
      ["Absent", totalDays - presentDays],
      ["Percentage", attendancePercentage + "%"],
      [""],
      ["Test Results"],
      ["Test Name", "Subject", "Marks Obtained", "Total Marks", "Date", "Answer Sheet"],
      ...testResults.map(r => [
        r.tests?.name,
        r.tests?.subject,
        r.marks_obtained,
        r.tests?.total_marks,
        format(new Date(r.date_taken), "PPP"),
        r.answersheet_link || ""
      ])
    ].map(row => row.join(",")).join("\n");

    const blob = new Blob([csvContent], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${selectedStudent.name}_report.csv`;
    a.click();
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold">Student Report</h1>
        {selectedStudentId && (
          <Button onClick={exportCSV} variant="outline">
            <Download className="mr-2 h-4 w-4" />
            Export CSV
          </Button>
        )}
      </div>

      {/* Filters */}
      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader><CardTitle>Select Grade</CardTitle></CardHeader>
          <CardContent>
            <Select value={selectedGrade} onValueChange={setSelectedGrade}>
              <SelectTrigger><SelectValue placeholder="All Grades" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Grades</SelectItem>
                {[...new Set(students.map(s => s.grade))].map(g => (
                  <SelectItem key={g} value={g}>{g}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle>Select Student</CardTitle></CardHeader>
          <CardContent>
            <Select value={selectedStudentId} onValueChange={setSelectedStudentId}>
              <SelectTrigger><SelectValue placeholder="Choose a student" /></SelectTrigger>
              <SelectContent>
                {students.map(s => (
                  <SelectItem key={s.id} value={s.id}>{s.name} - Grade {s.grade}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </CardContent>
        </Card>
      </div>

      {selectedStudent && (
        <>
          {/* Date & Subject Filter */}
          <div className="grid gap-4 md:grid-cols-2">
            <Card>
              <CardContent className="pt-6">
                <Label>Date Range</Label>
                <div className="flex gap-2">
                  <Input type="date" value={format(dateRange.from, "yyyy-MM-dd")}
                    onChange={e => setDateRange(prev => ({ ...prev, from: new Date(e.target.value) }))} />
                  <Input type="date" value={format(dateRange.to, "yyyy-MM-dd")}
                    onChange={e => setDateRange(prev => ({ ...prev, to: new Date(e.target.value) }))} />
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-6">
                <Label>Filter Test Subject</Label>
                <Select value={subjectFilter} onValueChange={setSubjectFilter}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Subjects</SelectItem>
                    {subjects.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                  </SelectContent>
                </Select>
              </CardContent>
            </Card>
          </div>

          {/* Attendance */}
          <Card>
            <CardHeader><CardTitle className="flex items-center gap-2"><CalendarIcon className="h-5 w-5" />Attendance Overview</CardTitle></CardHeader>
            <CardContent>
              <div className="grid gap-4 md:grid-cols-4 mb-6">
                <div className="space-y-1"><p className="text-sm text-muted-foreground">Total Days</p><p className="text-2xl font-bold">{totalDays}</p></div>
                <div className="space-y-1"><p className="text-sm text-muted-foreground">Present</p><p className="text-2xl font-bold text-green-600">{presentDays}</p></div>
                <div className="space-y-1"><p className="text-sm text-muted-foreground">Absent</p><p className="text-2xl font-bold text-red-600">{totalDays - presentDays}</p></div>
                <div className="space-y-1"><p className="text-sm text-muted-foreground">Attendance %</p><p className="text-2xl font-bold">{attendancePercentage}%</p></div>
              </div>
            </CardContent>
          </Card>

          {/* Chapter Progress */}
          <Card>
            <CardHeader><CardTitle className="flex items-center gap-2"><BookOpen className="h-5 w-5" />Chapter Progress</CardTitle></CardHeader>
            <CardContent>
              <div className="mb-4">
                <Label>Filter Chapter Subject</Label>
                <Select value={chapterSubjectFilter} onValueChange={setChapterSubjectFilter}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Subjects</SelectItem>
                    {subjects.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-4 md:grid-cols-3 mb-4">
                <div className="space-y-1"><p className="text-sm text-muted-foreground">Total Chapters</p><p className="text-2xl font-bold">{totalChaptersCount}</p></div>
                <div className="space-y-1"><p className="text-sm text-muted-foreground">Completed</p><p className="text-2xl font-bold text-green-600">{completedChaptersCount}</p></div>
                <div className="space-y-1"><p className="text-sm text-muted-foreground">Progress</p><p className="text-2xl font-bold">{chapterCompletionPercentage}%</p></div>
              </div>
              {chapterProgress.map(cp => (
                <div key={cp.id} className="flex items-center justify-between p-3 border rounded-lg">
                  <div>
                    <p className="font-medium">{cp.chapters?.chapter_name}</p>
                    <p className="text-sm text-muted-foreground">{cp.chapters?.subject} • {format(new Date(cp.date_completed), "PPP")}</p>
                  </div>
                  <div className={`px-3 py-1 rounded-full text-xs font-medium ${cp.completed ? "bg-green-100 text-green-800" : "bg-yellow-100 text-yellow-800"}`}>
                    {cp.completed ? "Completed" : "In Progress"}
                  </div>
                </div>
              ))}
              {!chapterProgress.length && <p className="text-center py-8 text-muted-foreground">No chapters recorded</p>}
            </CardContent>
          </Card>

          {/* Test Results */}
          <Card>
            <CardHeader><CardTitle className="flex items-center gap-2"><FileText className="h-5 w-5" />Test Results</CardTitle></CardHeader>
            <CardContent>
              <div className="grid gap-4 md:grid-cols-3 mb-6">
                <div className="space-y-1"><p className="text-sm text-muted-foreground">Total Tests</p><p className="text-2xl font-bold">{totalTests}</p></div>
                <div className="space-y-1"><p className="text-sm text-muted-foreground">Average Score</p><p className="text-2xl font-bold">{averagePercentage}%</p></div>
                <div className="space-y-1"><p className="text-sm text-muted-foreground">Total Marks</p><p className="text-2xl font-bold">{totalMarksObtained}/{totalMaxMarks}</p></div>
              </div>
              {testResults.map(r => (
                <div key={r.id} className="flex items-center justify-between p-4 border rounded-lg">
                  <div>
                    <p className="font-medium">{r.tests?.name}</p>
                    <p className="text-sm text-muted-foreground">{r.tests?.subject} • {format(new Date(r.date_taken), "PPP")}</p>
                  </div>
                  <div className="text-right space-y-1">
                    <p className="text-lg font-bold">{r.marks_obtained}/{r.tests?.total_marks}</p>
                    <p className="text-sm">{Math.round((r.marks_obtained / (r.tests?.total_marks || 1)) * 100)}%</p>
                    {r.answersheet_link && <a href={r.answersheet_link} target="_blank" className="text-xs text-blue-600 underline">View Answer Sheet</a>}
                  </div>
                </div>
              ))}
              {!testResults.length && <p className="text-center py-8 text-muted-foreground">No test results recorded yet</p>}
            </CardContent>
          </Card>

          {/* AI Summary */}
          <Card>
            <CardHeader><CardTitle className="flex items-center gap-2"><Brain className="h-5 w-5" />AI Summary</CardTitle></CardHeader>
            <CardContent>
              <div className="flex gap-2 mb-4">
                <Button onClick={() => generateSummaryMutation.mutate()} disabled={generateSummaryMutation.isLoading}>
                  {generateSummaryMutation.isLoading
                    ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Generating...</>
                    : "Generate Summary"}
                </Button>
              </div>
              <Textarea value={aiSummary} readOnly placeholder="AI summary will appear here..." />
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
