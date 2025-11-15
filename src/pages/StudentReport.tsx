import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { CalendarIcon, Download, Brain, Loader2, BookOpen, FileText, FileUp } from "lucide-react";
import { format, startOfMonth, endOfMonth } from "date-fns";
import { toast } from "sonner";
import { Textarea } from "@/components/ui/textarea";

// Full StudentReport component
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

  const selectedStudent = students.find(s => s.id === selectedStudentId);

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

  // Fetch chapters progress
  const { data: chapterProgress = [] } = useQuery({
    queryKey: ["student-chapters", selectedStudentId, chapterSubjectFilter],
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

  // Fetch all chapters (for statistics)
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

  // Fetch test results (latest + answersheet)
  const { data: testResults = [] } = useQuery({
    queryKey: ["student-test-results", selectedStudentId, subjectFilter],
    queryFn: async () => {
      if (!selectedStudentId) return [];
      const { data, error } = await supabase
        .from("test_results")
        .select(`
          *,
          tests(*)
        `)
        .eq("student_id", selectedStudentId)
        .order("date_taken", { ascending: false });
      if (error) throw error;
      return data.filter(r => subjectFilter === "all" || r.tests?.subject === subjectFilter);
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
  const chapterCompletionPercentage = totalChaptersCount ? Math.round((completedChaptersCount / totalChaptersCount) * 100) : 0;

  const subjects = Array.from(new Set([
    ...chapterProgress.map(c => c.chapters?.subject).filter(Boolean),
    ...testResults.map(t => t.tests?.subject).filter(Boolean)
  ]));

  // AI Summary
  const generateSummaryMutation = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.functions.invoke("ai-student-summary", { body: { studentId: selectedStudentId } });
      if (error) throw error;
      return data;
    },
    onSuccess: (data: any) => {
      setAiSummary(data.summary);
      toast.success("AI summary generated");
    },
    onError: () => toast.error("Failed to generate AI summary"),
  });

  // Export CSV
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
      ["Test Name", "Subject", "Marks Obtained", "Total Marks", "Date", "Answer Sheet URL"],
      ...testResults.map(r => [
        r.tests?.name,
        r.tests?.subject,
        r.marks_obtained,
        r.tests?.total_marks,
        format(new Date(r.date_taken), "PPP"),
        r.answersheet_url ? `https://YOUR_SUPABASE_BUCKET_URL/${r.answersheet_url}` : "-"
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
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold">Student Report</h1>
        {selectedStudentId && <Button onClick={exportToCSV} variant="outline"><Download className="mr-2 h-4 w-4" />Export CSV</Button>}
      </div>

      {/* Grade & Student Selector */}
      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader><CardTitle>Select Grade</CardTitle></CardHeader>
          <CardContent>
            <Select value={selectedGrade} onValueChange={setSelectedGrade}>
              <SelectTrigger><SelectValue placeholder="All Grades" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Grades</SelectItem>
                {[...new Set(students.map(s => s.grade))].map(g => <SelectItem key={g} value={g}>{g}</SelectItem>)}
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
                {students.map(s => <SelectItem key={s.id} value={s.id}>{s.name} - Grade {s.grade}</SelectItem>)}
              </SelectContent>
            </Select>
          </CardContent>
        </Card>
      </div>

      {selectedStudent && (
        <>
          {/* Filters */}
          <div className="grid gap-4 md:grid-cols-2">
            <Card>
              <CardContent>
                <Label>Date Range</Label>
                <div className="flex gap-2">
                  <Input type="date" value={format(dateRange.from, "yyyy-MM-dd")} onChange={e => setDateRange(prev => ({ ...prev, from: new Date(e.target.value) }))} />
                  <Input type="date" value={format(dateRange.to, "yyyy-MM-dd")} onChange={e => setDateRange(prev => ({ ...prev, to: new Date(e.target.value) }))} />
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent>
                <Label>Filter Test Subject</Label>
                <Select value={subjectFilter} onValueChange={setSubjectFilter}>
                  <SelectTrigger><SelectValue placeholder="All Subjects" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Subjects</SelectItem>
                    {subjects.map(sub => <SelectItem key={sub} value={sub}>{sub}</SelectItem>)}
                  </SelectContent>
                </Select>

                <Label className="mt-2">Filter Chapter Subject</Label>
                <Select value={chapterSubjectFilter} onValueChange={setChapterSubjectFilter}>
                  <SelectTrigger><SelectValue placeholder="All Subjects" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Subjects</SelectItem>
                    {subjects.map(sub => <SelectItem key={sub} value={sub}>{sub}</SelectItem>)}
                  </SelectContent>
                </Select>
              </CardContent>
            </Card>
          </div>

          {/* Attendance */}
          <Card>
            <CardHeader><CardTitle className="flex items-center gap-2"><CalendarIcon className="h-5 w-5" />Attendance Overview</CardTitle></CardHeader>
            <CardContent>
              <div className="grid grid-cols-4 gap-4 mb-4">
                <div><p>Total Days</p><p className="text-2xl font-bold">{totalDays}</p></div>
                <div><p>Present</p><p className="text-2xl font-bold text-green-600">{presentDays}</p></div>
                <div><p>Absent</p><p className="text-2xl font-bold text-red-600">{totalDays - presentDays}</p></div>
                <div><p>Attendance %</p><p className="text-2xl font-bold">{attendancePercentage}%</p></div>
              </div>
            </CardContent>
          </Card>

          {/* Chapters */}
          <Card>
            <CardHeader><CardTitle className="flex items-center gap-2"><BookOpen className="h-5 w-5" />Chapter Progress</CardTitle></CardHeader>
            <CardContent>
              <div className="grid grid-cols-3 gap-4 mb-4">
                <div>Total Chapters: {totalChaptersCount}</div>
                <div>Completed: {completedChaptersCount}</div>
                <div>Progress: {chapterCompletionPercentage}%</div>
              </div>
              {chapterProgress.map(cp => (
                <div key={cp.id} className="flex justify-between p-2 border rounded mb-2">
                  <div>{cp.chapters?.chapter_name} - {cp.chapters?.subject}</div>
                  <div className={`px-2 rounded ${cp.completed ? "bg-green-100 text-green-800" : "bg-yellow-100 text-yellow-800"}`}>
                    {cp.completed ? "Completed" : "In Progress"}
                  </div>
                </div>
              ))}
              {chapterProgress.length === 0 && <p>No chapters recorded</p>}
            </CardContent>
          </Card>

          {/* Test Results */}
          <Card>
            <CardHeader><CardTitle className="flex items-center gap-2"><FileText className="h-5 w-5" />Test Results</CardTitle></CardHeader>
            <CardContent>
              {testResults.map(r => (
                <div key={r.id} className="flex justify-between p-3 border rounded mb-2">
                  <div>
                    <p>{r.tests?.name} - {r.tests?.subject}</p>
                    <p>{format(new Date(r.date_taken), "PPP")}</p>
                  </div>
                  <div className="text-right">
                    <p>{r.marks_obtained}/{r.tests?.total_marks}</p>
                    {r.answersheet_url && (
                      <a href={`https://YOUR_SUPABASE_BUCKET_URL/${r.answersheet_url}`} target="_blank" className="text-blue-600 underline">View Sheet</a>
                    )}
                  </div>
                </div>
              ))}
              {testResults.length === 0 && <p>No test results recorded</p>}
            </CardContent>
          </Card>

          {/* AI Summary */}
          <Card>
            <CardHeader><CardTitle className="flex items-center gap-2"><Brain className="h-5 w-5" />AI Summary</CardTitle></CardHeader>
            <CardContent>
              <Button onClick={() => generateSummaryMutation.mutate()} disabled={generateSummaryMutation.isLoading}>
                {generateSummaryMutation.isLoading ? <Loader2 className="animate-spin h-4 w-4 mr-2" /> : "Generate Summary"}
              </Button>
              <Textarea readOnly value={aiSummary} placeholder="AI summary will appear here..." className="mt-2" />
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
