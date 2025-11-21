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
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { toast } from "sonner";
import { Plus, Upload, Download, Eye, Edit, Trash2 } from "lucide-react";
import { format } from "date-fns";

const LessonPlans = () => {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingLesson, setEditingLesson] = useState<any>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [lessonForm, setLessonForm] = useState({
    subject: "",
    chapter: "",
    topic: "",
    grade: "",
    lesson_date: format(new Date(), "yyyy-MM-dd"),
    description: "",
    notes: ""
  });

  // Fetch lesson plans
  const { data: lessonPlans = [] } = useQuery({
    queryKey: ["lesson-plans", user?.center_id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("lesson_plans")
        .select("*")
        .eq("center_id", user?.center_id!)
        .order("lesson_date", { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: !!user?.center_id
  });

  // Fetch subjects for dropdown
  const { data: subjects = [] } = useQuery({
    queryKey: ["subjects", user?.center_id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("lesson_plans")
        .select("subject")
        .eq("center_id", user?.center_id!)
        .order("subject");
      if (error) throw error;
      
      // Get unique subjects
      const uniqueSubjects = Array.from(new Set(data.map((item: any) => item.subject)));
      return uniqueSubjects;
    },
    enabled: !!user?.center_id
  });

  // Fetch grades for dropdown
  const { data: grades = [] } = useQuery({
    queryKey: ["grades", user?.center_id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("students")
        .select("grade")
        .eq("center_id", user?.center_id!)
        .order("grade");
      if (error) throw error;
      
      // Get unique grades
      const uniqueGrades = Array.from(new Set(data.map((item: any) => item.grade)));
      return uniqueGrades;
    },
    enabled: !!user?.center_id
  });

  // Create lesson plan mutation
  const createLessonMutation = useMutation({
    mutationFn: async () => {
      // First create lesson plan record
      const { data: lessonData, error: lessonError } = await supabase
        .from("lesson_plans")
        .insert({
          ...lessonForm,
          center_id: user?.center_id,
          created_by: user?.id
        })
        .select()
        .single();

      if (lessonError) throw lessonError;

      // Upload file if selected
      if (selectedFile) {
        const fileExt = selectedFile.name.split(".").pop();
        const fileName = `${Date.now()}-${Math.random().toString(36).substring(7)}.${fileExt}`;
        const fileSize = selectedFile.size;
        
        const { error: uploadError } = await supabase.storage
          .from("lesson-plan-files")
          .upload(fileName, selectedFile);

        if (uploadError) throw uploadError;

        // Update lesson plan with file info
        const { error: updateError } = await supabase
          .from("lesson_plans")
          .update({
            lesson_file_url: fileName,
            file_name: selectedFile.name,
            file_size: fileSize
          })
          .eq("id", lessonData.id);

        if (updateError) throw updateError;
      }

      return lessonData;
    },
    onSuccess: () => {
      toast.success("Lesson plan created successfully");
      queryClient.invalidateQueries({ queryKey: ["lesson-plans"] });
      resetForm();
    },
    onError: (error: any) => {
      toast.error(error.message || "Failed to create lesson plan");
    }
  });

  // Update lesson plan mutation
  const updateLessonMutation = useMutation({
    mutationFn: async () => {
      const updateData: any = {
        ...lessonForm
      };

      // Upload new file if selected
      if (selectedFile) {
        const fileExt = selectedFile.name.split(".").pop();
        const fileName = `${Date.now()}-${Math.random().toString(36).substring(7)}.${fileExt}`;
        const fileSize = selectedFile.size;
        
        const { error: uploadError } = await supabase.storage
          .from("lesson-plan-files")
          .upload(fileName, selectedFile);

        if (uploadError) throw uploadError;

        updateData.lesson_file_url = fileName;
        updateData.file_name = selectedFile.name;
        updateData.file_size = fileSize;
      }

      const { error } = await supabase
        .from("lesson_plans")
        .update(updateData)
        .eq("id", editingLesson.id);

      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Lesson plan updated successfully");
      queryClient.invalidateQueries({ queryKey: ["lesson-plans"] });
      resetForm();
    },
    onError: (error: any) => {
      toast.error(error.message || "Failed to update lesson plan");
    }
  });

  // Delete lesson plan mutation
  const deleteLessonMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("lesson_plans")
        .delete()
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Lesson plan deleted successfully");
      queryClient.invalidateQueries({ queryKey: ["lesson-plans"] });
    },
    onError: (error: any) => {
      toast.error(error.message || "Failed to delete lesson plan");
    }
  });

  const resetForm = () => {
    setLessonForm({
      subject: "",
      chapter: "",
      topic: "",
      grade: "",
      lesson_date: format(new Date(), "yyyy-MM-dd"),
      description: "",
      notes: ""
    });
    setSelectedFile(null);
    setEditingLesson(null);
    setIsDialogOpen(false);
  };

  const handleSubmit = () => {
    if (editingLesson) {
      updateLessonMutation.mutate();
    } else {
      createLessonMutation.mutate();
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setSelectedFile(e.target.files[0]);
    }
  };

  const handleEdit = (lesson: any) => {
    setEditingLesson(lesson);
    setLessonForm({
      subject: lesson.subject,
      chapter: lesson.chapter,
      topic: lesson.topic,
      grade: lesson.grade || "",
      lesson_date: lesson.lesson_date,
      description: lesson.description || "",
      notes: lesson.notes || ""
    });
    setSelectedFile(null);
    setIsDialogOpen(true);
  };

  const downloadLessonFile = async (fileName: string, displayName: string) => {
    try {
      const { data, error } = await supabase.storage
        .from("lesson-plan-files")
        .download(fileName);

      if (error) throw error;

      const url = URL.createObjectURL(data);
      const a = document.createElement("a");
      a.href = url;
      a.download = displayName;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (error: any) {
      toast.error("Failed to download file");
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold">Lesson Plans</h1>
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button onClick={resetForm}>
              <Plus className="mr-2 h-4 w-4" />
              Create Lesson Plan
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>
                {editingLesson ? "Edit Lesson Plan" : "Create New Lesson Plan"}
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="subject">Subject *</Label>
                  <Select
                    value={lessonForm.subject}
                    onValueChange={(value) => setLessonForm({ ...lessonForm, subject: value })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select subject" />
                    </SelectTrigger>
                    <SelectContent>
                      {subjects.map((subject: string) => (
                        <SelectItem key={subject} value={subject}>
                          {subject}
                        </SelectItem>
                      ))}
                      <SelectItem value="__new__">+ Add New Subject</SelectItem>
                    </SelectContent>
                  </Select>
                  {lessonForm.subject === "__new__" && (
                    <Input
                      placeholder="Enter new subject"
                      value={lessonForm.subject === "__new__" ? "" : lessonForm.subject}
                      onChange={(e) => setLessonForm({ ...lessonForm, subject: e.target.value })}
                    />
                  )}
                </div>
                <div className="space-y-2">
                  <Label htmlFor="grade">Grade</Label>
                  <Select
                    value={lessonForm.grade || ""}
                    onValueChange={(value) => setLessonForm({ ...lessonForm, grade: value })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select grade" />
                    </SelectTrigger>
                    <SelectContent>
                      {grades.map((grade: string) => (
                        <SelectItem key={grade} value={grade}>
                          {grade}
                        </SelectItem>
                      ))}
                      <SelectItem value="__new__">+ Add New Grade</SelectItem>
                    </SelectContent>
                  </Select>
                  {lessonForm.grade === "__new__" && (
                    <Input
                      placeholder="Enter new grade"
                      value={lessonForm.grade === "__new__" ? "" : lessonForm.grade}
                      onChange={(e) => setLessonForm({ ...lessonForm, grade: e.target.value })}
                    />
                  )}
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="chapter">Chapter *</Label>
                  <Input
                    id="chapter"
                    value={lessonForm.chapter}
                    onChange={(e) => setLessonForm({ ...lessonForm, chapter: e.target.value })}
                    placeholder="e.g., Algebra"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="topic">Topic *</Label>
                  <Input
                    id="topic"
                    value={lessonForm.topic}
                    onChange={(e) => setLessonForm({ ...lessonForm, topic: e.target.value })}
                    placeholder="e.g., Linear Equations"
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="lesson_date">Lesson Date *</Label>
                <Input
                  id="lesson_date"
                  type="date"
                  value={lessonForm.lesson_date}
                  onChange={(e) => setLessonForm({ ...lessonForm, lesson_date: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="description">Description</Label>
                <Textarea
                  id="description"
                  value={lessonForm.description}
                  onChange={(e) => setLessonForm({ ...lessonForm, description: e.target.value })}
                  placeholder="Enter lesson description"
                  rows={3}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="notes">Notes</Label>
                <Textarea
                  id="notes"
                  value={lessonForm.notes}
                  onChange={(e) => setLessonForm({ ...lessonForm, notes: e.target.value })}
                  placeholder="Additional notes"
                  rows={2}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="lesson_file">Lesson File</Label>
                <Input
                  id="lesson_file"
                  type="file"
                  onChange={handleFileChange}
                />
                {selectedFile && (
                  <p className="text-sm text-muted-foreground mt-1">
                    Selected: {selectedFile.name}
                  </p>
                )}
                {editingLesson && editingLesson.lesson_file_url && !selectedFile && (
                  <p className="text-sm text-muted-foreground mt-1">
                    Current file: {editingLesson.file_name}
                  </p>
                )}
              </div>
              <Button onClick={handleSubmit} className="w-full">
                {editingLesson ? "Update Lesson Plan" : "Create Lesson Plan"}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Lesson Plans</CardTitle>
        </CardHeader>
        <CardContent>
          {lessonPlans.length === 0 ? (
            <p className="text-muted-foreground text-center py-8">No lesson plans found</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Subject</TableHead>
                  <TableHead>Chapter</TableHead>
                  <TableHead>Topic</TableHead>
                  <TableHead>Grade</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead>File</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {lessonPlans.map((lesson: any) => (
                  <TableRow key={lesson.id}>
                    <TableCell className="font-medium">{lesson.subject}</TableCell>
                    <TableCell>{lesson.chapter}</TableCell>
                    <TableCell>{lesson.topic}</TableCell>
                    <TableCell>{lesson.grade || "-"}</TableCell>
                    <TableCell>{format(new Date(lesson.lesson_date), "PPP")}</TableCell>
                    <TableCell>
                      {lesson.lesson_file_url ? (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => downloadLessonFile(lesson.lesson_file_url, lesson.file_name || "lesson")}
                        >
                          <Download className="h-4 w-4" />
                        </Button>
                      ) : (
                        "-"
                      )}
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-2">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleEdit(lesson)}
                        >
                          <Edit className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => deleteLessonMutation.mutate(lesson.id)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default LessonPlans;