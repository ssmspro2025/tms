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
import { FileUp, Plus, Trash2, Edit, Users, X, FileText, Bot, SquarePen } from "lucide-react";
import { format } from "date-fns";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogDescription } from "@/components/ui/dialog";
import OCRModal from "@/components/OCRModal";
import BulkMarksEntry from "@/components/BulkMarksEntry";
import QuestionPaperViewer from "@/components/QuestionPaperViewer";
import { Tables } from "@/integrations/supabase/types";

type Test = Tables<'tests'>;
type TestResult = Tables<'test_results'>;
type Student = Tables<'students'>;

interface Question {
  id: string;
  questionText: string;
  maxMarks: number;
  correctAnswer?: string;
}

interface QuestionMark {
  questionId: string;
  marksObtained: number;
  studentAnswer?: string;
  feedback?: string;
  aiSuggestedMarks?: number;
}

export default function Tests() {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const [isAddingTest, setIsAddingTest] = useState(false);
  const [selectedTest, setSelectedTest] = useState<string>("");
  const [uploadedFile, setUploadedFile] = useState<File | null>(null);
  const [showOCRModal, setShowOCRModal] = useState(false);
  const [showBulkEntry, setShowBulkEntry] = useState(false);
  const [extractedTestContent, setExtractedTestContent] = useState("");

  // Form states for new test
  const [testName, setTestName] = useState("");
  const [testSubject, setTestSubject] = useState("");
  const [testDate, setTestDate] = useState(format(new Date(), "yyyy-MM-dd"));
  const [totalMarks, setTotalMarks] = useState("");
  const [grade, setGrade] = useState("");
  const [questions, setQuestions] = useState<Question[]>([]); // For question-wise entry

  // States for entering marks
  const [selectedStudentId, setSelectedStudentId] = useState("");
  const [marksObtained, setMarksObtained] = useState(""); // Overall marks
  const [questionMarks, setQuestionMarks] = useState<QuestionMark[]>([]); // Question-wise marks
  const [studentAnswer, setStudentAnswer] = useState(""); // For AI grading
  const [resultDate, setResultDate] = useState(format(new Date(), "yyyy-MM-dd"));
  const [resultNotes, setResultNotes] = useState("");

  // Fetch tests
  const { data: tests = [] } = useQuery({
    queryKey: ["tests", user?.center_id],
    queryFn: async () => {
      let query = supabase
        .from("tests")
        .select("*")
        .order("date", { ascending: false });
      
      if (user?.role !== 'admin' && user?.center_id) {
        query = query.eq('center_id', user.center_id);
      }
      
      const { data, error } = await query;
      if (error) throw error;
      return data;
    },
  });

  // Fetch students
  const { data: students = [] } = useQuery({
    queryKey: ["students", user?.center_id],
    queryFn: async () => {
      let query = supabase
        .from("students")
        .select("*")
        .order("name");
      
      if (user?.role !== 'admin' && user?.center_id) {
        query = query.eq('center_id', user.center_id);
      }
      
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
        .select("*, students(name, grade)")
        .eq("test_id", selectedTest)
        .order("marks_obtained", { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: !!selectedTest,
  });

  // Effect to update questionMarks when selectedTest changes
  useEffect(() => {
    const test = tests.find(t => t.id === selectedTest);
    if (test && test.questions) {
      const parsedQuestions = test.questions as Question[];
      setQuestions(parsedQuestions);
      setQuestionMarks(parsedQuestions.map(q => ({
        questionId: q.id,
        marksObtained: 0,
        studentAnswer: '',
        feedback: '',
      })));
    } else {
      setQuestions([]);
      setQuestionMarks([]);
    }
  }, [selectedTest, tests]);

  // Create test mutation
  const createTestMutation = useMutation({
    mutationFn: async () => {
      let uploadedFileUrl = null;

      if (uploadedFile) {
        const fileExt = uploadedFile.name.split(".").pop();
        const fileName = `${Date.now()}-${Math.random().toString(36).substring(7)}.${fileExt}`;
        const { error: uploadError } = await supabase.storage
          .from("test-files")
          .upload(fileName, uploadedFile);

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
        questions: questions.length > 0 ? questions : null, // Save questions
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
      setQuestions([]);
      setUploadedFile(null);
    },
    onError: (error: any) => {
      console.error("Error creating test:", error);
      toast.error("Failed to create test");
    },
  });

  // Add test result mutation
  const addResultMutation = useMutation({
    mutationFn: async () => {
      const totalMarksObtainedFromQuestions = questionMarks.reduce((sum, qm) => sum + qm.marksObtained, 0);

      const { data, error } = await supabase.from("test_results").insert({
        test_id: selectedTest,
        student_id: selectedStudentId,
        marks_obtained: totalMarksObtainedFromQuestions, // Use sum of question marks
        date_taken: resultDate,
        notes: resultNotes || null,
        question_marks: questionMarks.length > 0 ? questionMarks : null, // Save question-wise marks
      });
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["test-results"] });
      toast.success("Marks recorded successfully");
      setSelectedStudentId("");
      setMarksObtained("");
      setQuestionMarks([]);
      setStudentAnswer("");
      setResultNotes("");
    },
    onError: (error: any) => {
      if (error.code === "23505") {
        toast.error("Marks already recorded for this student");
      } else {
        toast.error("Failed to record marks");
      }
    },
  });

  // Bulk marks entry mutation
  const bulkMarksMutation = useMutation({
    mutationFn: async (marks: Array<{ studentId: string; marks: number }>) => {
      const records = marks.map((m) => ({
        test_id: selectedTest,
        student_id: m.studentId,
        marks_obtained: m.marks,
        date_taken: format(new Date(), "yyyy-MM-dd"),
        question_marks: null, // Bulk entry doesn't support question-wise for now
      }));

      await supabase
        .from("test_results")
        .delete()
        .eq("test_id", selectedTest)
        .in("student_id", marks.map((m) => m.studentId));

      const { error } = await supabase.from("test_results").insert(records);
      if (error) throw error;
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
      const { error } = await supabase
        .from("test_results")
        .delete()
        .eq("id", resultId);
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
      
      if (user?.role !== 'admin' && test.center_id !== user?.center_id) {
        throw new Error("You don't have permission to delete this test");
      }

      if (test.uploaded_file_url) {
        await supabase.storage
          .from("test-files")
          .remove([test.uploaded_file_url]);
      }

      await supabase
        .from("test_results")
        .delete()
        .eq("test_id", testId);

      const { error } = await supabase
        .from("tests")
        .delete()
        .eq("id", testId);
      
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

  // AI Grade Answer Mutation
  const aiGradeAnswerMutation = useMutation({
    mutationFn: async ({ questionText, correctAnswer, studentAnswer, maxMarks }: { questionText: string, correctAnswer: string, studentAnswer: string, maxMarks: number }) => {
      const { data, error } = await supabase.functions.invoke("ai-grade-answer", {
        body: {
          questionText,
          correctAnswer,
          studentAnswer,
          totalMarks: maxMarks,
        },
      });
      if (error) throw error;
      return data;
    },
    onSuccess: (data, variables) => {
      toast.success("AI graded successfully!");
      setQuestionMarks(prev => prev.map(qm => 
        qm.questionId === variables.questionText // Using questionText as ID for simplicity here, ideally use unique ID
          ? { ...qm, aiSuggestedMarks: data.suggestedMarks, feedback: data.feedback, marksObtained: data.suggestedMarks }
          : qm
      ));
    },
    onError: (error: any) => {
      console.error("AI grading error:", error);
      toast.error(error.message || "Failed to get AI grade");
    },
  });

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setUploadedFile(e.target.files[0]);
    }
  };

  const addQuestion = () => {
    setQuestions(prev => [...prev, { id: crypto.randomUUID(), questionText: '', maxMarks: 0, correctAnswer: '' }]);
  };

  const updateQuestion = (id: string, field: keyof Question, value: any) => {
    setQuestions(prev => prev.map(q => q.id === id ? { ...q, [field]: value } : q));
  };

  const removeQuestion = (id: string) => {
    setQuestions(prev => prev.filter(q => q.id !== id));
  };

  const updateQuestionMark = (questionId: string, field: keyof QuestionMark, value: any) => {
    setQuestionMarks(prev => prev.map(qm => qm.questionId === questionId ? { ...qm, [field]: value } : qm));
  };

  const selectedTestData = tests.find((t) => t.id === selectedTest);
  const testsWithFiles = tests.filter((t) => t.uploaded_file_url);

  const filteredStudents = selectedTestData?.grade
    ? students.filter((s: Student) => s.grade === selectedTestData.grade)
    : students;

  return (
    <div className="space-y-6">
      {testsWithFiles.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5" />
              Available Question Papers
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
              {testsWithFiles.map((test) => (
                <div
                  key={test.id}
                  className="border rounded-lg p-4 hover:bg-muted/50 transition-colors"
                >
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex items-start gap-3 flex-1">
                      <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-100 flex-shrink-0">
                        <FileText className="h-5 w-5 text-blue-600" />
                      </div>
                      <div className="min-w-0">
                        <h3 className="font-semibold text-sm line-clamp-2">{test.name}</h3>
                        <p className="text-xs text-muted-foreground mt-1">
                          {test.subject} • {format(new Date(test.date), "MMM d, yyyy")}
                        </p>
                      </div>
                    </div>
                  </div>
                  <QuestionPaperViewer
                    testId={test.id}
                    testName={test.name}
                    fileName={test.uploaded_file_url}
                  />
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold">Test Management</h1>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => setShowOCRModal(true)}>
            <FileUp className="mr-2 h-4 w-4" />
            Upload Test Paper (OCR)
          </Button>
          <Dialog open={isAddingTest} onOpenChange={setIsAddingTest}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="mr-2 h-4 w-4" />
                Create Test
              </Button>
            </DialogTrigger>
          <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Create New Test</DialogTitle>
              <DialogDescription>
                Define a new test, its details, and optional questions.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <Label>Test Name</Label>
                <Input
                  value={testName}
                  onChange={(e) => setTestName(e.target.value)}
                  placeholder="e.g., Mid-term Math Exam"
                />
              </div>
              <div>
                <Label>Subject</Label>
                <Input
                  value={testSubject}
                  onChange={(e) => setTestSubject(e.target.value)}
                  placeholder="e.g., Mathematics"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Date</Label>
                  <Input
                    type="date"
                    value={testDate}
                    onChange={(e) => setTestDate(e.target.value)}
                  />
                </div>
                <div>
                  <Label>Total Marks (Overall)</Label>
                  <Input
                    type="number"
                    value={totalMarks}
                    onChange={(e) => setTotalMarks(e.target.value)}
                    placeholder="100"
                  />
                </div>
              </div>
              <div>
                <Label>Grade (Optional)</Label>
                <Input
                  value={grade}
                  onChange={(e) => setGrade(e.target.value)}
                  placeholder="e.g., 10th"
                />
              </div>
              <div>
                <Label>Upload Test File (Optional)</Label>
                <Input
                  type="file"
                  accept=".pdf,.jpg,.jpeg,.png"
                  onChange={handleFileUpload}
                />
                {uploadedFile && (
                  <p className="text-sm text-muted-foreground mt-1">
                    Selected: {uploadedFile.name}
                  </p>
                )}
              </div>

              {/* Question-wise Entry Section */}
              <div className="space-y-3 border p-4 rounded-lg">
                <h3 className="font-semibold text-lg flex items-center gap-2">
                  <SquarePen className="h-5 w-5" /> Define Questions (Optional)
                </h3>
                <p className="text-sm text-muted-foreground">
                  Add individual questions for detailed mark entry. Total marks for questions will override overall total marks.
                </p>
                {questions.map((q, index) => (
                  <div key={q.id} className="flex flex-col gap-2 border p-3 rounded-md bg-muted/20">
                    <div className="flex justify-between items-center">
                      <Label>Question {index + 1}</Label>
                      <Button variant="ghost" size="sm" onClick={() => removeQuestion(q.id)}>
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                    <Textarea
                      value={q.questionText}
                      onChange={(e) => updateQuestion(q.id, 'questionText', e.target.value)}
                      placeholder="Question text"
                      rows={2}
                    />
                    <Input
                      type="number"
                      value={q.maxMarks}
                      onChange={(e) => updateQuestion(q.id, 'maxMarks', parseInt(e.target.value) || 0)}
                      placeholder="Max Marks"
                    />
                    <Textarea
                      value={q.correctAnswer}
                      onChange={(e) => updateQuestion(q.id, 'correctAnswer', e.target.value)}
                      placeholder="Correct Answer (for AI grading)"
                      rows={2}
                    />
                  </div>
                ))}
                <Button type="button" variant="outline" onClick={addQuestion} className="w-full">
                  Add Question
                </Button>
              </div>

              <Button
                onClick={() => createTestMutation.mutate()}
                disabled={!testName || !testSubject || (!totalMarks && questions.length === 0) || createTestMutation.isPending}
                className="w-full"
              >
                Create Test
              </Button>
            </div>
          </DialogContent>
          </Dialog>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>All Tests</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {tests.map((test) => (
                <div
                  key={test.id}
                  className={`flex items-center gap-2 ${
                    selectedTest === test.id ? "" : ""
                  }`}
                >
                  <button
                    onClick={() => setSelectedTest(test.id)}
                    className={`flex-1 text-left p-4 border rounded-lg transition-colors ${
                      selectedTest === test.id
                        ? "bg-primary text-primary-foreground"
                        : "hover:bg-accent"
                    }`}
                  >
                    <div className="font-medium">{test.name}</div>
                    <div className="text-sm opacity-80">
                      {test.subject} • {format(new Date(test.date), "PPP")} • {test.total_marks} marks
                      {test.questions && (test.questions as Question[]).length > 0 && (
                        <span className="ml-2 text-xs px-2 py-0.5 rounded-full bg-primary-foreground text-primary">
                          {(test.questions as Question[]).length} Questions
                        </span>
                      )}
                    </div>
                  </button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      if (confirm(`Are you sure you want to delete "${test.name}"? This will also delete all associated student results.`)) {
                        deleteTestMutation.mutate(test.id);
                      }
                    }}
                    title="Delete test"
                  >
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </Button>
                </div>
              ))}
              {tests.length === 0 && (
                <p className="text-muted-foreground text-center py-8">
                  No tests created yet
                </p>
              )}
            </div>
          </CardContent>
        </Card>

        {selectedTest && selectedTestData && (
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle>Enter Marks - {selectedTestData.name}</CardTitle>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setShowBulkEntry(true)}
                  disabled={questions.length > 0} // Disable bulk entry if questions are defined
                >
                  <Users className="mr-2 h-4 w-4" />
                  Bulk Entry
                </Button>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label>Select Student</Label>
                <Select value={selectedStudentId} onValueChange={setSelectedStudentId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Choose student" />
                  </SelectTrigger>
                  <SelectContent>
                    {filteredStudents.map((student) => (
                      <SelectItem key={student.id} value={student.id}>
                        {student.name} - Grade {student.grade}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {questions.length > 0 ? (
                // Question-wise mark entry
                <div className="space-y-4">
                  {questions.map((q, index) => {
                    const currentQuestionMark = questionMarks.find(qm => qm.questionId === q.id);
                    return (
                      <div key={q.id} className="border p-4 rounded-lg space-y-2">
                        <p className="font-semibold">Question {index + 1} (Max: {q.maxMarks} marks)</p>
                        <p className="text-sm text-muted-foreground">{q.questionText}</p>
                        {q.correctAnswer && (
                          <p className="text-xs text-blue-600">Correct Answer: {q.correctAnswer}</p>
                        )}
                        <div>
                          <Label>Student's Answer (Optional)</Label>
                          <Textarea
                            value={currentQuestionMark?.studentAnswer || ''}
                            onChange={(e) => updateQuestionMark(q.id, 'studentAnswer', e.target.value)}
                            placeholder="Student's answer"
                            rows={2}
                          />
                        </div>
                        <div className="flex items-end gap-2">
                          <div className="flex-1">
                            <Label>Marks Obtained</Label>
                            <Input
                              type="number"
                              min="0"
                              max={q.maxMarks}
                              value={currentQuestionMark?.marksObtained || ''}
                              onChange={(e) => updateQuestionMark(q.id, 'marksObtained', parseInt(e.target.value) || 0)}
                              placeholder="0"
                            />
                          </div>
                          {q.correctAnswer && (
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              onClick={() => aiGradeAnswerMutation.mutate({
                                questionText: q.questionText,
                                correctAnswer: q.correctAnswer!,
                                studentAnswer: currentQuestionMark?.studentAnswer || '',
                                maxMarks: q.maxMarks,
                              })}
                              disabled={aiGradeAnswerMutation.isPending || !currentQuestionMark?.studentAnswer}
                            >
                              <Bot className="h-4 w-4 mr-1" /> AI Grade
                            </Button>
                          )}
                        </div>
                        {currentQuestionMark?.feedback && (
                          <p className="text-sm text-muted-foreground mt-2">
                            AI Feedback: {currentQuestionMark.feedback}
                          </p>
                        )}
                      </div>
                    );
                  })}
                </div>
              ) : (
                // Overall mark entry
                <div>
                  <Label>Marks Obtained (out of {selectedTestData.total_marks})</Label>
                  <Input
                    type="number"
                    min="0"
                    max={selectedTestData.total_marks}
                    value={marksObtained}
                    onChange={(e) => setMarksObtained(e.target.value)}
                    placeholder="0"
                  />
                </div>
              )}

              <div>
                <Label>Test Date</Label>
                <Input
                  type="date"
                  value={resultDate}
                  onChange={(e) => setResultDate(e.target.value)}
                />
              </div>
              <div>
                <Label>Notes (Optional)</Label>
                <Textarea
                  value={resultNotes}
                  onChange={(e) => setResultNotes(e.target.value)}
                  placeholder="Any additional notes..."
                  rows={2}
                />
              </div>
              <Button
                onClick={() => addResultMutation.mutate()}
                disabled={!selectedStudentId || (!marksObtained && questions.length === 0) || addResultMutation.isPending}
                className="w-full"
              >
                Save Marks
              </Button>
            </CardContent>
          </Card>
        )}
      </div>

      {selectedTest && selectedTestData && selectedTestData.uploaded_file_url && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5" />
              Question Paper
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="bg-gradient-to-br from-blue-50 to-indigo-50 border border-blue-200 rounded-lg p-6">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-blue-100">
                    <FileText className="h-6 w-6 text-blue-600" />
                  </div>
                  <div>
                    <p className="font-semibold text-gray-900">Question Paper Available</p>
                    <p className="text-sm text-gray-600">
                      Uploaded: {format(new Date(selectedTestData.created_at), "PPP")}
                    </p>
                  </div>
                </div>
                <QuestionPaperViewer
                  testId={selectedTest}
                  testName={selectedTestData.name}
                  fileName={selectedTestData.uploaded_file_url}
                />
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {selectedTest && testResults.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Test Results</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="border rounded-lg overflow-hidden">
              <table className="w-full">
                <thead className="bg-muted">
                  <tr>
                    <th className="px-4 py-2 text-left">Student</th>
                    <th className="px-4 py-2 text-left">Grade</th>
                    <th className="px-4 py-2 text-right">Marks</th>
                    <th className="px-4 py-2 text-right">Percentage</th>
                    <th className="px-4 py-2 text-center">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {testResults.map((result) => (
                    <tr key={result.id} className="border-t">
                      <td className="px-4 py-2">{result.students?.name}</td>
                      <td className="px-4 py-2">{result.students?.grade}</td>
                      <td className="px-4 py-2 text-right">
                        {result.marks_obtained}/{selectedTestData?.total_marks}
                      </td>
                      <td className="px-4 py-2 text-right">
                        {Math.round((result.marks_obtained / (selectedTestData?.total_marks || 1)) * 100)}%
                      </td>
                      <td className="px-4 py-2 text-center">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => deleteResultMutation.mutate(result.id)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}

      <OCRModal
        open={showOCRModal}
        onOpenChange={setShowOCRModal}
        onSave={(text) => {
          setExtractedTestContent(text);
          toast.success("Test content extracted! You can now use this for reference.");
        }}
      />

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