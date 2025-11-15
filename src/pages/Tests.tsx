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

  // States for creating test
  const [isAddingTest, setIsAddingTest] = useState(false);
  const [testName, setTestName] = useState("");
  const [testSubject, setTestSubject] = useState("");
  const [testDate, setTestDate] = useState(format(new Date(), "yyyy-MM-dd"));
  const [totalMarks, setTotalMarks] = useState("");
  const [grade, setGrade] = useState("");
  const [uploadedFile, setUploadedFile] = useState<File | null>(null);

  // States for selecting test and marks
  const [selectedTest, setSelectedTest] = useState<string>("");
  const [selectedStudentId, setSelectedStudentId] = useState("");
  const [marksObtained, setMarksObtained] = useState("");
  const [resultDate, setResultDate] = useState(format(new Date(), "yyyy-MM-dd"));
  const [resultNotes, setResultNotes] = useState("");
  const [showOCRModal, setShowOCRModal] = useState(false);
  const [showBulkEntry, setShowBulkEntry] = useState(false);
  const [extractedTestContent, setExtractedTestContent] = useState("");

  // Filters for created tests list
  const [filterGrade, setFilterGrade] = useState("all");
  const [filterSubject, setFilterSubject] = useState("all");

  // Fetch all tests
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

  // Fetch test results for selected test
  const { data: testResults = [] } = useQuery({
    queryKey: ["test-results", selectedTest],
    queryFn: async () => {
      if (!selectedTest) return [];
      const { data, error } = await supabase
        .from("test_results")
        .select("*, students(name, grade), answer_sheets(*)")
        .eq("test_id", selectedTest)
        .order("marks_obtained", { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: !!selectedTest,
  });

  // Create test mutation
  const createTestMutation = useMutation({
    mutationFn: async () => {
      let uploadedFileUrl = null;
      if (uploadedFile) {
        const fileExt = uploadedFile.name.split(".").pop();
        const fileName = `${Date.now()}-${Math.random().toString(36).substring(7)}.${fileExt}`;
        const { error: uploadError } = await supabase.storage.from("test-files").upload(fileName, uploadedFile);
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
      setTestName(""); setTestSubject(""); setTotalMarks(""); setGrade(""); setUploadedFile(null);
    },
    onError: (error: any) => { toast.error("Failed to create test"); console.error(error); },
  });

  // Add single student result mutation
  const addResultMutation = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.from("test_results").insert({
        test_id: selectedTest,
        student_id: selectedStudentId,
        marks_obtained: parseInt(marksObtained),
        date_taken: resultDate,
        notes: resultNotes || null,
      });
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["test-results"] });
      toast.success("Marks recorded successfully");
      setSelectedStudentId(""); setMarksObtained(""); setResultNotes("");
    },
    onError: (error: any) => {
      if (error.code === "23505") toast.error("Marks already recorded for this student");
      else toast.error("Failed to record marks");
    },
  });

  // Bulk marks mutation with optional answersheet upload
  const bulkMarksMutation = useMutation({
    mutationFn: async (marks: Array<{ studentId: string; marks: number; file?: File }>) => {
      const records = [];
      for (const m of marks) {
        let fileUrl = null;
        if (m.file) {
          const ext = m.file.name.split(".").pop();
          const name = `answersheet-${selectedTest}-${m.studentId}-${Date.now()}.${ext}`;
          const { error: uploadError } = await supabase.storage.from("test-files").upload(name, m.file);
          if (uploadError) throw uploadError;
          fileUrl = name;
        }
        records.push({
          test_id: selectedTest,
          student_id: m.studentId,
          marks_obtained: m.marks,
          date_taken: format(new Date(), "yyyy-MM-dd"),
          answersheet_url: fileUrl,
        });
      }
      const studentIds = marks.map(m => m.studentId);
      await supabase.from("test_results").delete().eq("test_id", selectedTest).in("student_id", studentIds);
      const { error } = await supabase.from("test_results").insert(records);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["test-results"] });
      toast.success("Bulk marks saved successfully");
    },
    onError: () => toast.error("Failed to save bulk marks"),
  });

  // Delete single result
  const deleteResultMutation = useMutation({
    mutationFn: async (resultId: string) => {
      const { error } = await supabase.from("test_results").delete().eq("id", resultId);
      if (error) throw error;
    },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["test-results"] }); toast.success("Result deleted"); },
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
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["tests"] }); setSelectedTest(""); toast.success("Test deleted successfully"); },
    onError: (error: any) => toast.error(error.message || "Failed to delete test"),
  });

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) setUploadedFile(e.target.files[0]);
  };

  const selectedTestData = tests.find(t => t.id === selectedTest);
  const filteredTests = tests.filter(t =>
    (filterGrade === "all" || t.grade === filterGrade) &&
    (filterSubject === "all" || t.subject === filterSubject)
  );

  const gradesList = Array.from(new Set(students.map(s => s.grade).filter(Boolean)));
  const subjectsList = Array.from(new Set(tests.map(t => t.subject).filter(Boolean)));

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold">Test Management</h1>
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
              <DialogHeader><DialogTitle>Create New Test</DialogTitle></DialogHeader>
              <div className="space-y-4">
                <div><Label>Test Name</Label><Input value={testName} onChange={e => setTestName(e.target.value)} placeholder="Mid-term Math" /></div>
                <div><Label>Subject</Label><Input value={testSubject} onChange={e => setTestSubject(e.target.value)} placeholder="Mathematics" /></div>
                <div className="grid grid-cols-2 gap-4">
                  <div><Label>Date</Label><Input type="date" value={testDate} onChange={e => setTestDate(e.target.value)} /></div>
                  <div><Label>Total Marks</Label><Input type="number" value={totalMarks} onChange={e => setTotalMarks(e.target.value)} /></div>
                </div>
                <div><Label>Grade (Optional)</Label><Input value={grade} onChange={e => setGrade(e.target.value)} placeholder="10th" /></div>
                <div>
                  <Label>Upload Test File (Optional)</Label>
                  <Input type="file" accept=".pdf,.jpg,.jpeg,.png" onChange={handleFileUpload} />
                  {uploadedFile && <p className="text-sm text-muted-foreground mt-1">Selected: {uploadedFile.name}</p>}
                </div>
                <Button onClick={() => createTestMutation.mutate()} disabled={!testName || !testSubject || !totalMarks || createTestMutation.isPending} className="w-full">Create Test</Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* Filters for created tests */}
      <div className="flex gap-4">
        <Select value={filterGrade} onValueChange={setFilterGrade}>
          <SelectTrigger><SelectValue placeholder="Filter by Grade" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Grades</SelectItem>
            {gradesList.map(g => <SelectItem key={g} value={g}>{g}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={filterSubject} onValueChange={setFilterSubject}>
          <SelectTrigger><SelectValue placeholder="Filter by Subject" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Subjects</SelectItem>
            {subjectsList.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      {/* Created Tests */}
      <Card>
        <CardHeader><CardTitle>All Tests</CardTitle></CardHeader>
        <CardContent>
          <div className="space-y-2">
            {filteredTests.map(test => (
              <div key={test.id} className="flex items-center gap-2">
                <button className={`flex-1 text-left p-4 border rounded-lg ${selectedTest===test.id?'bg-primary text-primary-foreground':'hover:bg-accent'}`} onClick={()=>setSelectedTest(test.id)}>
                  <div className="font-medium">{test.name}</div>
                  <div className="text-sm opacity-80">{test.subject} • {format(new Date(test.date),"PPP")} • {test.total_marks} marks • {test.grade || "-"}</div>
                </button>
                <Button variant="ghost" size="sm" onClick={()=>{if(confirm(`Delete ${test.name}?`)) deleteTestMutation.mutate(test.id)}}><Trash2 className="h-4 w-4 text-destructive"/></Button>
              </div>
            ))}
            {filteredTests.length===0 && <p className="text-muted-foreground text-center py-8">No tests found</p>}
          </div>
        </CardContent>
      </Card>

      {/* Single Student Marks Entry */}
      {selectedTest && selectedTestData && (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle>Enter Marks - {selectedTestData.name}</CardTitle>
              <Button variant="outline" size="sm" onClick={()=>setShowBulkEntry(true)}><Users className="mr-2 h-4 w-4"/>Bulk Entry</Button>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label>Select Student</Label>
              <Select value={selectedStudentId} onValueChange={setSelectedStudentId}>
                <SelectTrigger><SelectValue placeholder="Choose student"/></SelectTrigger>
                <SelectContent>
                  {students.map(s=><SelectItem key={s.id} value={s.id}>{s.name} - Grade {s.grade}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Marks Obtained (out of {selectedTestData.total_marks})</Label>
              <Input type="number" value={marksObtained} onChange={e=>setMarksObtained(e.target.value)} max={selectedTestData.total_marks}/>
            </div>
            <div>
              <Label>Test Date</Label>
              <Input type="date" value={resultDate} onChange={e=>setResultDate(e.target.value)}/>
            </div>
            <div>
              <Label>Notes (Optional)</Label>
              <Textarea value={resultNotes} onChange={e=>setResultNotes(e.target.value)} rows={2}/>
            </div>
            <Button onClick={()=>addResultMutation.mutate()} disabled={!selectedStudentId || !marksObtained || addResultMutation.isPending} className="w-full">Save Marks</Button>
          </CardContent>
        </Card>
      )}

      {/* Bulk Marks Entry */}
      {selectedTest && selectedTestData && (
        <BulkMarksEntry
          open={showBulkEntry}
          onOpenChange={setShowBulkEntry}
          students={students}
          testId={selectedTest}
          totalMarks={selectedTestData.total_marks}
          onSave={marks => bulkMarksMutation.mutate(marks)}
          gradeFilter
        />
      )}

      {/* OCR Modal */}
      <OCRModal
        open={showOCRModal}
        onOpenChange={setShowOCRModal}
        onSave={text => { setExtractedTestContent(text); toast.success("Test content extracted!"); }}
      />

      {/* Test Results Table */}
      {selectedTest && testResults.length>0 && (
        <Card>
          <CardHeader><CardTitle>Test Results</CardTitle></CardHeader>
          <CardContent>
            <div className="border rounded-lg overflow-hidden">
              <table className="w-full">
                <thead className="bg-muted">
                  <tr>
                    <th className="px-4 py-2 text-left">Student</th>
                    <th className="px-4 py-2 text-left">Grade</th>
                    <th className="px-4 py-2 text-right">Marks</th>
                    <th className="px-4 py-2 text-right">Percentage</th>
                    <th className="px-4 py-2 text-left">Answer Sheet</th>
                    <th className="px-4 py-2 text-center">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {testResults.map(r=>(
                    <tr key={r.id} className="border-t">
                      <td className="px-4 py-2">{r.students?.name}</td>
                      <td className="px-4 py-2">{r.students?.grade}</td>
                      <td className="px-4 py-2 text-right">{r.marks_obtained}/{selectedTestData.total_marks}</td>
                      <td className="px-4 py-2 text-right">{Math.round((r.marks_obtained/(selectedTestData.total_marks||1))*100)}%</td>
                      <td className="px-4 py-2 text-left">
                        {r.answersheet_url ? <a href={supabase.storage.from("test-files").getPublicUrl(r.answersheet_url).data.publicUrl} target="_blank" className="text-blue-600">View</a> : "—"}
                      </td>
                      <td className="px-4 py-2 text-center">
                        <Button variant="ghost" size="sm" onClick={()=>deleteResultMutation.mutate(r.id)}><Trash2 className="h-4 w-4"/></Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
