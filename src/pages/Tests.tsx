import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { FileUp, Plus, Trash2, Edit } from "lucide-react";
import { format } from "date-fns";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";

export default function Tests() {
  const queryClient = useQueryClient();
  const [isAddingTest, setIsAddingTest] = useState(false);
  const [selectedTest, setSelectedTest] = useState<string>("");
  const [uploadedFile, setUploadedFile] = useState<File | null>(null);

  // Form states for new test
  const [testName, setTestName] = useState("");
  const [testSubject, setTestSubject] = useState("");
  const [testDate, setTestDate] = useState(format(new Date(), "yyyy-MM-dd"));
  const [totalMarks, setTotalMarks] = useState("");
  const [grade, setGrade] = useState("");

  // States for entering marks
  const [selectedStudentId, setSelectedStudentId] = useState("");
  const [marksObtained, setMarksObtained] = useState("");
  const [resultDate, setResultDate] = useState(format(new Date(), "yyyy-MM-dd"));
  const [resultNotes, setResultNotes] = useState("");

  // Fetch tests
  const { data: tests = [] } = useQuery({
    queryKey: ["tests"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("tests")
        .select("*")
        .order("date", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  // Fetch students
  const { data: students = [] } = useQuery({
    queryKey: ["students"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("students")
        .select("*")
        .order("name");
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

  // Create test mutation
  const createTestMutation = useMutation({
    mutationFn: async () => {
      let fileUrl = null;
      
      // Upload file if present
      if (uploadedFile) {
        const fileExt = uploadedFile.name.split(".").pop();
        const fileName = `${Date.now()}.${fileExt}`;
        const { error: uploadError } = await supabase.storage
          .from("test-files")
          .upload(fileName, uploadedFile);
        
        if (uploadError) throw uploadError;
        fileUrl = fileName;
      }

      const { data, error } = await supabase.from("tests").insert({
        name: testName,
        subject: testSubject,
        date: testDate,
        total_marks: parseInt(totalMarks),
        grade: grade || null,
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
      setUploadedFile(null);
    },
    onError: () => {
      toast.error("Failed to create test");
    },
  });

  // Add test result mutation
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
      setSelectedStudentId("");
      setMarksObtained("");
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

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setUploadedFile(e.target.files[0]);
    }
  };

  const selectedTestData = tests.find((t) => t.id === selectedTest);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold">Test Management</h1>
        <Dialog open={isAddingTest} onOpenChange={setIsAddingTest}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="mr-2 h-4 w-4" />
              Create Test
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Create New Test</DialogTitle>
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
                  <Label>Total Marks</Label>
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
              <Button
                onClick={() => createTestMutation.mutate()}
                disabled={!testName || !testSubject || !totalMarks || createTestMutation.isPending}
                className="w-full"
              >
                Create Test
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>All Tests</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {tests.map((test) => (
                <button
                  key={test.id}
                  onClick={() => setSelectedTest(test.id)}
                  className={`w-full text-left p-4 border rounded-lg transition-colors ${
                    selectedTest === test.id
                      ? "bg-primary text-primary-foreground"
                      : "hover:bg-accent"
                  }`}
                >
                  <div className="font-medium">{test.name}</div>
                  <div className="text-sm opacity-80">
                    {test.subject} • {format(new Date(test.date), "PPP")} • {test.total_marks} marks
                  </div>
                </button>
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
              <CardTitle>Enter Marks - {selectedTestData.name}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label>Select Student</Label>
                <Select value={selectedStudentId} onValueChange={setSelectedStudentId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Choose student" />
                  </SelectTrigger>
                  <SelectContent>
                    {students.map((student) => (
                      <SelectItem key={student.id} value={student.id}>
                        {student.name} - Grade {student.grade}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Marks Obtained (out of {selectedTestData.total_marks})</Label>
                <Input
                  type="number"
                  value={marksObtained}
                  onChange={(e) => setMarksObtained(e.target.value)}
                  max={selectedTestData.total_marks}
                  placeholder="0"
                />
              </div>
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
                disabled={!selectedStudentId || !marksObtained || addResultMutation.isPending}
                className="w-full"
              >
                Save Marks
              </Button>
            </CardContent>
          </Card>
        )}
      </div>

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
    </div>
  );
}
