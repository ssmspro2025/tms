import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { CalendarIcon, Download, Brain, Loader2, BookOpen, FileText, Filter } from "lucide-react";
import { format } from "date-fns";
import { toast } from "sonner";

export default function StudentReport() {
  const { user } = useAuth();

  const [selectedStudentId, setSelectedStudentId] = useState<string>("");
  const [dateRange, setDateRange] = useState<{ from: Date; to: Date }>({
    from: new Date(new Date().getFullYear(), new Date().getMonth(), 1),
    to: new Date(),
  });
  const [subjectFilter, setSubjectFilter] = useState<string>("all");
  const [gradeFilter, setGradeFilter] = useState<string>("all");
  const [aiSummary, setAiSummary] = useState<string>("");

  // Fetch students (center-specific)
  const { data: students = [] } = useQuery({
    queryKey: ["students", user?.center_id],
    queryFn: async () => {
      let query = supabase.from("students").select("*").order("name");
      if (user?.role !== "admin" && user?.center_id) query = query.eq("center_id", user.center_id);
      const { data, error } = await query;
      if (error) throw error;
      return data;
    },
  });

  const filteredStudents = students.filter(s => gradeFilter === "all" || s.grade === gradeFilter);

  // Fetch attendance
  const { data: attendanceData = [] } = useQuery({
    queryKey: ["student-attendance", selectedStudentId, dateRange],
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

  // Fetch student chapters
  const { data: studentChapters = [] } = useQuery({
    queryKey: ["student-chapters", selectedStudentId, subjectFilter],
    queryFn: async () => {
      if (!selectedStudentId) return [];
      let query = supabase.from("student_chapters").select("*, chapters(*)").eq("student_id", selectedStudentId);
      if (subjectFilter !== "all") query = query.eq("chapters.subject", subjectFilter);
      const { data, error } = await query.order("date_completed", { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: !!selectedStudentId,
  });

  // Fetch chapters for selected student & filters
  const { data: allChapters = [] } = useQuery({
    queryKey: ["all-chapters", user?.center_id, subjectFilter],
    queryFn: async () => {
      let query = supabase.from("chapters").select("*");
      if (user?.role !== "admin" && user?.center_id) query = query.eq("center_id", user.center_id);
      if (subjectFilter !== "all") query = query.eq("subject", subjectFilter);
      const { data, error } = await query;
      if (error) throw error;
      return data;
    },
  });

  // Fetch test results
  const { data: testResults = [] } = useQuery({
    queryKey: ["student-test-results", selectedStudentId, subjectFilter],
    queryFn: async () => {
      if (!selectedStudentId) return [];
      let query = supabase.from("test_results").select("*, tests(*)").eq("student_id", selectedStudentId);
      if (subjectFilter !== "all") query = query.eq("tests.subject", subjectFilter);
      const { data, error } = await query.order("date_taken", { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: !!selectedStudentId,
  });

  // Stats
  const totalDays = attendanceData.length;
  const presentDays = attendanceData.filter(a => a.status === "Present").length;
  const attendancePercentage = totalDays > 0 ? Math.round((presentDays / totalDays) * 100) : 0;

  const totalTests = testResults.length;
  const totalMarksObtained = testResults.reduce((sum, r) => sum + r.marks_obtained, 0);
  const totalMaxMarks = testResults.reduce((sum, r) => sum + (r.tests?.total_marks || 0), 0);
  const averagePercentage = totalMaxMarks > 0 ? Math.round((totalMarksObtained / totalMaxMarks) * 100) : 0;

  // Correct chapter progress counting
  const completedChaptersCount = studentChapters.filter(cp => cp.completed).length;
  const totalChaptersCount = allChapters.length;
  const chapterCompletionPercentage = totalChaptersCount > 0
    ? Math.min(100, Math.round((completedChaptersCount / totalChaptersCount) * 100))
    : 0;

  const subjects = Array.from(new Set([
    ...studentChapters.map(c => c.chapters?.subject).filter(Boolean),
    ...testResults.map(t => t.tests?.subject).filter(Boolean)
  ]));

  const selectedStudent = students.find(s => s.id === selectedStudentId);

  // AI Summary mutation
  const generateSummaryMutation = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.functions.invoke("ai-student-summary", { body: { studentId: selectedStudentId } });
      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      setAiSummary(data.summary);
      toast.success("AI summary generated successfully");
    },
    onError: (error: any) => {
      console.error(error);
      if (error.message?.includes("429")) toast.error("Rate limit exceeded");
      else if (error.message?.includes("402")) toast.error("AI credits depleted");
      else toast.error("Failed to generate AI summary");
    },
  });

  const exportToCSV = () => {
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
      ["Test Name", "Subject", "Marks Obtained", "Total Marks", "Date"],
      ...testResults.map(r => [
        r.tests?.name,
        r.tests?.subject,
        r.marks_obtained,
        r.tests?.total_marks,
        format(new Date(r.date_taken), "PPP")
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
      {/* Header & Export */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <h1 className="text-3xl font-bold">Student Report</h1>
        {selectedStudentId && (
          <Button onClick={exportToCSV} variant="outline" size="sm">
            <Download className="mr-2 h-4 w-4" /> Export CSV
          </Button>
        )}
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-4 items-center">
        <Select value={gradeFilter} onValueChange={setGradeFilter}>
          <SelectTrigger className="w-[140px]">
            <SelectValue placeholder="Grade" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Grades</SelectItem>
            {Array.from(new Set(students.map(s => s.grade))).map(g => (
              <SelectItem key={g} value={g}>{g}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={selectedStudentId} onValueChange={setSelectedStudentId}>
          <SelectTrigger className="w-[200px]">
            <SelectValue placeholder="Select Student" />
          </SelectTrigger>
          <SelectContent>
            {filteredStudents.map(s => (
              <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={subjectFilter} onValueChange={setSubjectFilter}>
          <SelectTrigger className="w-[160px]">
            <SelectValue placeholder="Subject" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Subjects</SelectItem>
            {subjects.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
          </SelectContent>
        </Select>

        <div className="flex gap-2">
          <Input
            type="date"
            value={format(dateRange.from, "yyyy-MM-dd")}
            onChange={e => setDateRange(prev => ({ ...prev, from: new Date(e.target.value) }))}
            className="w-[140px]"
          />
          <Input
            type="date"
            value={format(dateRange.to, "yyyy-MM-dd")}
            onChange={e => setDateRange(prev => ({ ...prev, to: new Date(e.target.value) }))}
            className="w-[140px]"
          />
        </div>
      </div>

      {selectedStudent && (
        <>
          {/* Attendance Overview */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <CalendarIcon className="h-5 w-5" /> Attendance
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-4 gap-4 mb-4">
                <div className="space-y-1"><p className="text-sm text-muted-foreground">Total Days</p><p className="text-2xl font-bold">{totalDays}</p></div>
                <div className="space-y-1"><p className="text-sm text-muted-foreground">Present</p><p className="text-2xl font-bold text-green-600">{presentDays}</p></div>
                <div className="space-y-1"><p className="text-sm text-muted-foreground">Absent</p><p className="text-2xl font-bold text-red-600">{totalDays - presentDays}</p></div>
                <div className="space-y-1"><p className="text-sm text-muted-foreground">Attendance %</p><p className="text-2xl font-bold">{attendancePercentage}%</p></div>
              </div>

              <div className="overflow-x-auto max-h-64">
                <table className="w-full table-auto border-collapse">
                  <thead className="bg-muted">
                    <tr>
                      <th className="px-3 py-2 text-left">Date</th>
                      <th className="px-3 py-2 text-left">Status</th>
                      <th className="px-3 py-2 text-left">Time In</th>
                      <th className="px-3 py-2 text-left">Time Out</th>
                    </tr>
                  </thead>
                  <tbody>
                    {attendanceData.map(a => (
                      <tr key={a.id} className="border-t">
                        <td className="px-3 py-1">{format(new Date(a.date), "PPP")}</td>
                        <td className="px-3 py-1">
                          <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${a.status === "Present" ? "bg-green-100 text-green-800" : "bg-red-100 text-red-800"}`}>
                            {a.status}
                          </span>
                        </td>
                        <td className="px-3 py-1">{a.time_in || "-"}</td>
                        <td className="px-3 py-1">{a.time_out || "-"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>

          {/* Chapter Progress */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2"><BookOpen className="h-5 w-5" /> Chapters</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-3 gap-4 mb-4">
                <div className="space-y-1"><p className="text-sm text-muted-foreground">Total</p><p className="text-2xl font-bold">{totalChaptersCount}</p></div>
                <div className="space-y-1"><p className="text-sm text-muted-foreground">Completed</p><p className="text-2xl font-bold text-green-600">{completedChaptersCount}</p></div>
                <div className="space-y-1"><p className="text-sm text-muted-foreground">Progress</p><p className="text-2xl font-bold">{chapterCompletionPercentage}%</p></div>
              </div>

              <div className="space-y-2">
                {studentChapters.map(c => (
                  <div key={c.id} className="flex items-center justify-between p-2 border rounded-lg">
                    <div className="flex-1">
                      <p className="font-medium">{c.chapters?.chapter_name}</p>
                      <p className="text-sm text-muted-foreground">{c.chapters?.subject} • {format(new Date(c.date_completed), "PPP")}</p>
                    </div>
                    <div className={`px-2 py-1 rounded-full text-xs font-medium ${c.completed ? "bg-green-100 text-green-800" : "bg-yellow-100 text-yellow-800"}`}>
                      {c.completed ? "Completed" : "In Progress"}
                    </div>
                  </div>
                ))}
                {studentChapters.length === 0 && <p className="text-center py-4 text-muted-foreground">No chapters recorded yet</p>}
              </div>
            </CardContent>
          </Card>

          {/* Test Results */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2"><FileText className="h-5 w-5" /> Tests</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-3 gap-4 mb-4">
                <div className="space-y-1"><p className="text-sm text-muted-foreground">Total Tests</p><p className="text-2xl font-bold">{totalTests}</p></div>
                <div className="space-y-1"><p className="text-sm text-muted-foreground">Average</p><p className="text-2xl font-bold">{averagePercentage}%</p></div>
                <div className="space-y-1"><p className="text-sm text-muted-foreground">Marks</p><p className="text-2xl font-bold">{totalMarksObtained}/{totalMaxMarks}</p></div>
              </div>

              <div className="space-y-2">
                {testResults.map(r => (
                  <div key={r.id} className="flex items-center justify-between p-2 border rounded-lg">
                    <div className="flex-1">
                      <p className="font-medium">{r.tests?.name}</p>
                      <p className="text-sm text-muted-foreground">{r.tests?.subject} • {format(new Date(r.date_taken), "PPP")}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-lg font-bold">{r.marks_obtained}/{r.tests?.total_marks}</p>
                      <p className="text-sm text-muted-foreground">{Math.round((r.marks_obtained / (r.tests?.total_marks || 1)) * 100)}%</p>
                    </div>
                  </div>
                ))}
                {testResults.length === 0 && <p className="text-center py-4 text-muted-foreground">No test results recorded yet</p>}
              </div>
            </CardContent>
          </Card>

          {/* AI Summary */}
          <Card>
            <CardHeader className="flex justify-between items-center">
              <CardTitle className="flex items-center gap-2"><Brain className="h-5 w-5" /> AI Summary</CardTitle>
              <Button onClick={() => generateSummaryMutation.mutate()} disabled={generateSummaryMutation.isPending} size="sm">
                {generateSummaryMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Brain className="h-4 w-4 mr-2" />}
                Generate
              </Button>
            </CardHeader>
            <CardContent>
              {aiSummary ? (
                <Textarea value={aiSummary} onChange={e => setAiSummary(e.target.value)} rows={10} className="resize-none" />
              ) : (
                <p className="text-center py-8 text-muted-foreground">Click "Generate" to get AI summary</p>
              )}
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
