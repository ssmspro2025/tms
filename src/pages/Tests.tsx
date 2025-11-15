import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { FileUp, Plus, Trash2, Users, FileText, Loader2 } from "lucide-react";
import { format } from "date-fns";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import OCRModal from "@/components/OCRModal";
import BulkMarksEntry from "@/components/BulkMarksEntry";
import QuestionPaperViewer from "@/components/QuestionPaperViewer";

export default function Tests() {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  // UI states
  const [isAddingTest, setIsAddingTest] = useState(false);
  const [selectedTest, setSelectedTest] = useState<string>("");
  const [uploadedTestFile, setUploadedTestFile] = useState<File | null>(null);
  const [showOCRModal, setShowOCRModal] = useState(false);
  const [showBulkEntry, setShowBulkEntry] = useState(false);
  const [extractedTestContent, setExtractedTestContent] = useState("");

  // Form states for new test
  const [testName, setTestName] = useState("");
  const [testSubject, setTestSubject] = useState("");
  const [testDate, setTestDate] = useState(format(new Date(), "yyyy-MM-dd"));
  const [totalMarks, setTotalMarks] = useState("");
  const [grade, setGrade] = useState("");

  // States for individual student marks entry
  const [selectedStudentId, setSelectedStudentId] = useState("");
  const [marksObtained, setMarksObtained] = useState("");
  const [resultDate, setResultDate] = useState(format(new Date(), "yyyy-MM-dd"));
  const [resultNotes, setResultNotes] = useState("");
  const [answerSheetFile, setAnswerSheetFile] = useState<File | null>(null);

  // Grade filter for bulk entry
  const [bulkGradeFilter, setBulkGradeFilter] = useState<string>("all");

  // Fetch tests
  const { data: tests = [] } = useQuery({
    queryKey: ["tests", user?.center_id],
    queryFn: async () => {
      let query = supabase.from("tests").select("*").order("date", { ascending: false });
      if (user?.role !== "admin" && user?.center_id) query = query.eq("center_id", user.center_id);
      const { data, error } = await query;
      if (error) throw error;
      return data;
    },
  });

  // Fetch students
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

  // Filtered students for bulk entry by grade
  const filteredStudents = bulkGradeFilter === "all" ? students : students.filter(s => s.grade === bulkGradeFilter);

  // Fetch test results for selected test
  const { data: testResults = [] } = useQuery({
    queryKey: ["test-results", selectedTest],
    queryFn: async () => {
      if (!selectedTest) return [];
      const { data, error } = await supabase
        .from("test_results")
        .select("*, students(name, grade)")
        .eq("test_id", selectedTest)
        .order("marks_obtained", { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: !!selectedTest,
  });

  const selectedTestData = tests.find(t => t.id === selectedTest);

  // Create test mutation
  const createTestMutation = useMutation({
    mutationFn: async () => {
      let uploadedFileUrl: string | null = null;
      if (uploadedTestFile) {
        const fileExt = uploadedTestFile.name.split(".").pop();
        const fileName = `${Date.now()}-${Math.random().toString(36).substring(7)}.${fileExt}`;
        const { error: uploadError } = await supabase.storage.from("test-files").upload(fileName, uploadedTestFile);
        if (uploadError) throw uploadError;
        uploadedFileUrl = fileName;
      }

      const { data, error } = await supabase.from("tests").insert({
        name: testName,
        subject: testSubject,
        date: testDate,
        total_marks: parseInt(totalMarks),
        grade: grade || null,
        uploaded_file_url: uploadedFileUrl,
        center_id: user?.center_id,
      }).select().single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["tests"] });
      toast.success("Test created successfully");
      setIsAddingTest(false);
      setTestName("");
      setTestSubject("");
      setTotalMarks("");
      setGrade("");
      setUploadedTestFile(null);
    },
    onError: (error: any) => {
      console.error("Error creating test:", error);
      toast.error("Failed to create test");
    },
  });

  // Individual marks entry mutation with optional answer sheet upload
  const addResultMutation = useMutation({
    mutationFn: async () => {
      let answerSheetUrl: string | null = null;
      if (answerSheetFile) {
        const fileExt = answerSheetFile.name.split(".").pop();
        const fileName = `answersheets/${selectedTest}/${selectedStudentId}.${fileExt}`;
        const { error: uploadError } = await supabase.storage.from("answersheets").upload(fileName, answerSheetFile, { upsert: true });
        if (uploadError) throw uploadError;
        answerSheetUrl = fileName;
      }

      const { data, error } = await supabase.from("test_results").insert({
        test_id: selectedTest,
        student_id: selectedStudentId,
        marks_obtained: parseInt(marksObtained),
        date_taken: resultDate,
        notes: resultNotes || null,
        answersheet_url: answerSheetUrl,
      });
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["test-results"] });
      toast.success("Marks recorded successfully");
      setSelectedStudentId("");
      setMarksObtained("");
      setResultNotes("");
      setAnswerSheetFile(null);
    },
    onError: (error: any) => {
      if (error.code === "23505") toast.error("Marks already recorded for this student");
      else toast.error("Failed to record marks");
    },
  });

  // Bulk marks entry mutation (grade-wise)
  const bulkMarksMutation = useMutation({
    mutationFn: async (marks: Array<{ studentId: string; marks: number; file?: File }>) => {
      for (const m of marks) {
        let answerSheetUrl: string | null = null;
        if (m.file) {
          const fileExt = m.file.name.split(".").pop();
          const fileName = `answersheets/${selectedTest}/${m.studentId}.${fileExt}`;
          const { error } = await supabase.storage.from("answersheets").upload(fileName, m.file, { upsert: true });
          if (error) throw error;
          answerSheetUrl = fileName;
        }

        await supabase.from("test_results").upsert({
          test_id: selectedTest,
          student_id: m.studentId,
          marks_obtained: m.marks,
          date_taken: format(new Date(), "yyyy-MM-dd"),
          answersheet_url: answerSheetUrl,
        }, { onConflict: ["test_id", "student_id"] });
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["test-results"] });
      toast.success("Bulk marks saved successfully");
    },
    onError: () => {
      toast.error("Failed to save bulk marks");
    },
  });

  // Delete test result
  const deleteResultMutation = useMutation({
    mutationFn: async (resultId: string) => {
      const { error } = await supabase.from("test_results").delete().eq("id", resultId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["test-results"] });
      toast.success("Result deleted");
    },
  });

  // Delete test mutation
  const deleteTestMutation = useMutation({
    mutationFn: async (testId: string) => {
      const test = tests.find(t => t.id === testId);
      if (!test) throw new Error("Test not found");
      if (user?.role !== 'admin' && test.center_id !== user?.center_id) throw new Error("No permission");

      if (test.uploaded_file_url) await supabase.storage.from("test-files").remove([test.uploaded_file_url]);
      await supabase.from("test_results").delete().eq("test_id", testId);
      const { error } = await supabase.from("tests").delete().eq("id", testId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["tests"] });
      setSelectedTest("");
      toast.success("Test deleted successfully");
    },
    onError: (error: any) => {
      toast.error(error.message || "Failed to delete test");
    },
  });

  const handleTestFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) setUploadedTestFile(e.target.files[0]);
  };

  const handleAnswerSheetUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) setAnswerSheetFile(e.target.files[0]);
  };

  const testsWithFiles = tests.filter(t => t.uploaded_file_url);

  return (
    <div className="space-y-6">
      {/* OCR Upload */}
      <div className="flex gap-2">
        <Button variant="outline" onClick={() => setShowOCRModal(true)}>
          <FileUp className="mr-2 h-4 w-4" />
          Upload Test Paper (OCR)
        </Button>
        <Dialog open={isAddingTest} onOpenChange={setIsAddingTest}>
          <DialogTrigger asChild>
            <Button><Plus className="mr-2 h-4 w-4" />Create Test</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>Create Test</DialogTitle></DialogHeader>
            <div className="space-y-4">
              <Input placeholder="Test Name" value={testName} onChange={e => setTestName(e.target.value)} />
              <Input placeholder="Subject" value={testSubject} onChange={e => setTestSubject(e.target.value)} />
              <div className="grid grid-cols-2 gap-2">
                <Input type="date" value={testDate} onChange={e => setTestDate(e.target.value)} />
                <Input type="number" placeholder="Total Marks" value={totalMarks} onChange={e => setTotalMarks(e.target.value)} />
              </div>
              <Input placeholder="Grade (Optional)" value={grade} onChange={e => setGrade(e.target.value)} />
              <Input type="file" accept=".pdf,.jpg,.jpeg,.png" onChange={handleTestFileUpload} />
              {uploadedTestFile && <p>{uploadedTestFile.name}</p>}
              <Button onClick={() => createTestMutation.mutate()}>Create Test</Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {/* Test List */}
      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader><CardTitle>All Tests</CardTitle></CardHeader>
          <CardContent>
            <div className="space-y-2">
              {tests.map(test => (
                <div key={test.id} className="flex items-center gap-2">
                  <button onClick={() => setSelectedTest(test.id)} className="flex-1 text-left p-4 border rounded-lg">
                    {test.name} • {test.subject} • {format(new Date(test.date), "PPP")}
                  </button>
                  <Button variant="ghost" size="sm" onClick={() => deleteTestMutation.mutate(test.id)}><Trash2 /></Button>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Marks Entry */}
        {selectedTest && selectedTestData && (
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle>Enter Marks - {selectedTestData.name}</CardTitle>
                <div>
                  <Label>Filter Grade (Bulk)</Label>
                  <Select value={bulkGradeFilter} onValueChange={setBulkGradeFilter}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Grades</SelectItem>
                      {Array.from(new Set(students.map(s => s.grade))).map(g => (
                        <SelectItem key={g} value={g}>{g}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Button onClick={() => setShowBulkEntry(true)}><Users /> Bulk Entry</Button>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <Select value={selectedStudentId} onValueChange={setSelectedStudentId}>
                <SelectTrigger><SelectValue placeholder="Choose student" /></SelectTrigger>
                <SelectContent>
                  {students.map(s => (
                    <SelectItem key={s.id} value={s.id}>{s.name} - Grade {s.grade}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Input type="number" placeholder={`Marks out of ${selectedTestData.total_marks}`} value={marksObtained} onChange={e => setMarksObtained(e.target.value)} />
              <Input type="date" value={resultDate} onChange={e => setResultDate(e.target.value)} />
              <Textarea placeholder="Notes (Optional)" value={resultNotes} onChange={e => setResultNotes(e.target.value)} rows={2} />
              <Input type="file" accept=".pdf,.jpg,.jpeg,.png" onChange={handleAnswerSheetUpload} />
              <Button onClick={() => addResultMutation.mutate()}>Save Marks</Button>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Test Results */}
      {selectedTest && testResults.length > 0 && (
        <Card>
          <CardHeader><CardTitle>Test Results</CardTitle></CardHeader>
          <CardContent>
            <table className="w-full">
              <thead>
                <tr><th>Student</th><th>Grade</th><th>Marks</th><th>%</th><th>Answer Sheet</th><th>Action</th></tr>
              </thead>
              <tbody>
                {testResults.map(r => (
                  <tr key={r.id}>
                    <td>{r.students?.name}</td>
                    <td>{r.students?.grade}</td>
                    <td>{r.marks_obtained}/{selectedTestData.total_marks}</td>
                    <td>{Math.round((r.marks_obtained / selectedTestData.total_marks) * 100)}%</td>
                    <td>
                      {r.answersheet_url && (
                        <a href={supabase.storage.from("answersheets").getPublicUrl(r.answersheet_url).data.publicUrl} target="_blank" rel="noreferrer">View</a>
                      )}
                    </td>
                    <td><Button variant="ghost" size="sm" onClick={() => deleteResultMutation.mutate(r.id)}><Trash2 /></Button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </CardContent>
        </Card>
      )}

      <OCRModal open={showOCRModal} onOpenChange={setShowOCRModal} onSave={text => { setExtractedTestContent(text); toast.success("Test content extracted!"); }} />

      {selectedTest && selectedTestData && (
        <BulkMarksEntry
          open={showBulkEntry}
          onOpenChange={setShowBulkEntry}
          students={filteredStudents}
          testId={selectedTest}
          totalMarks={selectedTestData.total_marks}
          onSave={(marks) => bulkMarksMutation.mutate(marks)}
        />
      )}
    </div>
  );
}
