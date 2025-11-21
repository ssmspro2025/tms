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
import { Plus, Upload, Download, CheckCircle, Clock, XCircle, Edit, Trash2 } from "lucide-react";
import { format } from "date-fns";

const Homework = () => {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingHomework, setEditingHomework] = useState<any>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [homeworkForm, setHomeworkForm] = useState({
    subject: "",
    title: "",
    description: "",
    grade: "",
    assignment_date: format(new Date(), "yyyy-MM-dd"),
    due_date: format(new Date(), "yyyy-MM-dd")
  });

  // Fetch homework
  const { data: homework = [] } = useQuery({
    queryKey: ["homework", user?.center_id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("homework")
        .select("*, student_homework_records(id, student_id, status, submission_date, teacher_remarks)")
        .eq("center_id", user?.center_id!)
        .order("assignment_date", { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: !!user?.center_id
  });

  // Fetch students
  const { data: students = [] } = useQuery({
    queryKey: ["students", user?.center_id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("students")
        .select("*")
        .eq("center_id", user?.center_id!);
      if (error) throw error;
      return data;
    },
    enabled: !!user?.center_id
  });

  // Fetch subjects
  const { data: subjects = [] } = useQuery({
    queryKey: ["subjects", user?.center_id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("homework")
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

  // Fetch grades
  const { data: grades = [] } = useQuery({
    queryKey: ["grades", user?.center_id],
    queryFn: async () => {
      const uniqueGrades = Array.from(new Set(students.map((s: any) => s.grade)));
      return uniqueGrades;
    },
    enabled: !!user?.center_id && students.length > 0
  });

  // Create homework mutation
  const createHomeworkMutation = useMutation({
    mutationFn: async () => {
      // First create homework record
      const { data: homeworkData, error: homeworkError } = await supabase
        .from("homework")
        .insert({
          ...homeworkForm,
          center_id: user?.center_id,
          created_by: user?.id
        })
        .select()
        .single();

      if (homeworkError) throw homeworkError;

      // Upload file if selected
      if (selectedFile) {
        const fileExt = selectedFile.name.split(".").pop();
        const fileName = `${Date.now()}-${Math.random().toString(36).substring(7)}.${fileExt}`;
        
        const { error: uploadError } = await supabase.storage
          .from("homework-files")
          .upload(fileName, selectedFile);

        if (uploadError) throw uploadError;

        // Update homework with file info
        const { error: updateError } = await supabase
          .from("homework")
          .update({
            attachment_url: fileName,
            attachment_name: selectedFile.name
          })
          .eq("id", homeworkData.id);

        if (updateError) throw updateError;
      }

      // Create student homework records for all students in the grade
      if (homeworkForm.grade) {
        const gradeStudents = students.filter((s: any) => s.grade === homeworkForm.grade);
        const studentRecords = gradeStudents.map((student: any) => ({
          homework_id: homeworkData.id,
          student_id: student.id,
          status: "assigned"
        }));

        if (studentRecords.length > 0) {
          const { error: recordsError } = await supabase
            .from("student_homework_records")
            .insert(studentRecords);
          
          if (recordsError) throw recordsError;
        }
      }

      return homeworkData;
    },
    onSuccess: () => {
      toast.success("Homework created successfully");
      queryClient.invalidateQueries({ queryKey: ["homework"] });
      resetForm();
    },
    onError: (error: any) => {
      toast.error(error.message || "Failed to create homework");
    }
  });

  // Update homework mutation
  const updateHomeworkMutation = useMutation({
    mutationFn: async () => {
      const updateData: any = {
        ...homeworkForm
      };

      // Upload new file if selected
      if (selectedFile) {
        const fileExt = selectedFile.name.split(".").pop();
        const fileName = `${Date.now()}-${Math.random().toString(36).substring(7)}.${fileExt}`;
        
        const { error: uploadError } = await supabase.storage
          .from("homework-files")
          .upload(fileName, selectedFile);

        if (uploadError) throw uploadError;

        updateData.attachment_url = fileName;
        updateData.attachment_name = selectedFile.name;
      }

      const { error } = await supabase
        .from("homework")
        .update(updateData)
        .eq("id", editingHomework.id);

      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Homework updated successfully");
      queryClient.invalidateQueries({ queryKey: ["homework"] });
      resetForm();
    },
    onError: (error: any) => {
      toast.error(error.message || "Failed to update homework");
    }
  });

  // Delete homework mutation
  const deleteHomeworkMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("homework")
        .delete()
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Homework deleted successfully");
      queryClient.invalidateQueries({ queryKey: ["homework"] });
    },
    onError: (error: any) => {
      toast.error(error.message || "Failed to delete homework");
    }
  });

  // Update student homework status
  const updateStudentHomeworkMutation = useMutation({
    mutationFn: async ({ recordId, status, remarks }: { recordId: string; status: string; remarks?: string }) => {
      const { error } = await supabase
        .from("student_homework_records")
        .update({
          status,
          teacher_remarks: remarks,
          submission_date: status === "completed" ? new Date().toISOString() : null
        })
        .eq("id", recordId);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Homework status updated");
      queryClient.invalidateQueries({ queryKey: ["homework"] });
    },
    onError: (error: any) => {
      toast.error(error.message || "Failed to update homework status");
    }
  });

  const resetForm = () => {
    setHomeworkForm({
      subject: "",
      title: "",
      description: "",
      grade: "",
      assignment_date: format(new Date(), "yyyy-MM-dd"),
      due_date: format(new Date(), "yyyy-MM-dd")
    });
    setSelectedFile(null);
    setEditingHomework(null);
    setIsDialogOpen(false);
  };

  const handleSubmit = () => {
    if (editingHomework) {
      updateHomeworkMutation.mutate();
    } else {
      createHomeworkMutation.mutate();
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setSelectedFile(e.target.files[0]);
    }
  };

  const handleEdit = (hw: any) => {
    setEditingHomework(hw);
    setHomeworkForm({
      subject: hw.subject,
      title: hw.title,
      description: hw.description || "",
      grade: hw.grade || "",
      assignment_date: hw.assignment_date,
      due_date: hw.due_date
    });
    setSelectedFile(null);
    setIsDialogOpen(true);
  };

  const downloadAttachment = async (fileName: string, displayName: string) => {
    try {
      const { data, error } = await supabase.storage
        .from("homework-files")
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

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "assigned": return <Clock className="h-4 w-4 text-blue-500" />;
      case "submitted": return <Clock className="h-4 w-4 text-yellow-500" />;
      case "checked": return <CheckCircle className="h-4 w-4 text-purple-500" />;
      case "completed": return <CheckCircle className="h-4 w-4 text-green-500" />;
      default: return <Clock className="h-4 w-4 text-gray-500" />;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "assigned": return "text-blue-600";
      case "submitted": return "text-yellow-600";
      case "checked": return "text-purple-600";
      case "completed": return "text-green-600";
      default: return "text-gray-600";
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold">Homework Management</h1>
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button onClick={resetForm}>
              <Plus className="mr-2 h-4 w-4" />
              Assign Homework
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>
                {editingHomework ? "Edit Homework" : "Assign New Homework"}
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="subject">Subject *</Label>
                  <Select
                    value={homeworkForm.subject}
                    onValueChange={(value) => setHomeworkForm({ ...homeworkForm, subject: value })}
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
                  {homeworkForm.subject === "__new__" && (
                    <Input
                      placeholder="Enter new subject"
                      value={homeworkForm.subject === "__new__" ? "" : homeworkForm.subject}
                      onChange={(e) => setHomeworkForm({ ...homeworkForm, subject: e.target.value })}
                    />
                  )}
                </div>
                <div className="space-y-2">
                  <Label htmlFor="grade">Grade</Label>
                  <Select
                    value={homeworkForm.grade || ""}
                    onValueChange={(value) => setHomeworkForm({ ...homeworkForm, grade: value })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select grade" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="">All Grades</SelectItem>
                      {grades.map((grade: string) => (
                        <SelectItem key={grade} value={grade}>
                          {grade}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="title">Title *</Label>
                <Input
                  id="title"
                  value={homeworkForm.title}
                  onChange={(e) => setHomeworkForm({ ...homeworkForm, title: e.target.value })}
                  placeholder="Enter homework title"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="description">Description</Label>
                <Textarea
                  id="description"
                  value={homeworkForm.description}
                  onChange={(e) => setHomeworkForm({ ...homeworkForm, description: e.target.value })}
                  placeholder="Enter homework description"
                  rows={3}
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="assignment_date">Assignment Date *</Label>
                  <Input
                    id="assignment_date"
                    type="date"
                    value={homeworkForm.assignment_date}
                    onChange={(e) => setHomeworkForm({ ...homeworkForm, assignment_date: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="due_date">Due Date *</Label>
                  <Input
                    id="due_date"
                    type="date"
                    value={homeworkForm.due_date}
                    onChange={(e) => setHomeworkForm({ ...homeworkForm, due_date: e.target.value })}
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="attachment">Attachment</Label>
                <Input
                  id="attachment"
                  type="file"
                  onChange={handleFileChange}
                />
                {selectedFile && (
                  <p className="text-sm text-muted-foreground mt-1">
                    Selected: {selectedFile.name}
                  </p>
                )}
                {editingHomework && editingHomework.attachment_url && !selectedFile && (
                  <p className="text-sm text-muted-foreground mt-1">
                    Current file: {editingHomework.attachment_name}
                  </p>
                )}
              </div>
              <Button onClick={handleSubmit} className="w-full">
                {editingHomework ? "Update Homework" : "Assign Homework"}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Homework Assignments</CardTitle>
        </CardHeader>
        <CardContent>
          {homework.length === 0 ? (
            <p className="text-muted-foreground text-center py-8">No homework assignments found</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Title</TableHead>
                  <TableHead>Subject</TableHead>
                  <TableHead>Grade</TableHead>
                  <TableHead>Assigned</TableHead>
                  <TableHead>Due Date</TableHead>
                  <TableHead>Attachment</TableHead>
                  <TableHead>Students</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {homework.map((hw: any) => (
                  <TableRow key={hw.id}>
                    <TableCell className="font-medium">{hw.title}</TableCell>
                    <TableCell>{hw.subject}</TableCell>
                    <TableCell>{hw.grade || "All Grades"}</TableCell>
                    <TableCell>{format(new Date(hw.assignment_date), "PPP")}</TableCell>
                    <TableCell>{format(new Date(hw.due_date), "PPP")}</TableCell>
                    <TableCell>
                      {hw.attachment_url ? (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => downloadAttachment(hw.attachment_url, hw.attachment_name || "attachment")}
                        >
                          <Download className="h-4 w-4" />
                        </Button>
                      ) : (
                        "-"
                      )}
                    </TableCell>
                    <TableCell>
                      {hw.student_homework_records?.length > 0 ? (
                        <span>
                          {hw.student_homework_records.filter((r: any) => r.status === "completed").length}/
                          {hw.student_homework_records.length} completed
                        </span>
                      ) : (
                        "0/0"
                      )}
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-2">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleEdit(hw)}
                        >
                          <Edit className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => deleteHomeworkMutation.mutate(hw.id)}
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

      {/* Student Homework Tracking */}
      {homework.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Student Homework Tracking</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-6">
              {homework.map((hw: any) => (
                <div key={hw.id} className="border rounded-lg p-4">
                  <h3 className="font-semibold text-lg mb-3">{hw.title}</h3>
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Student</TableHead>
                          <TableHead>Grade</TableHead>
                          <TableHead>Status</TableHead>
                          <TableHead>Submission Date</TableHead>
                          <TableHead>Teacher Remarks</TableHead>
                          <TableHead>Actions</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {hw.student_homework_records && hw.student_homework_records.length > 0 ? (
                          hw.student_homework_records.map((record: any) => {
                            const student = students.find((s: any) => s.id === record.student_id);
                            return (
                              <TableRow key={record.id}>
                                <TableCell className="font-medium">
                                  {student ? student.name : "Unknown Student"}
                                </TableCell>
                                <TableCell>{student ? student.grade : "-"}</TableCell>
                                <TableCell>
                                  <div className="flex items-center gap-2">
                                    {getStatusIcon(record.status)}
                                    <span className={getStatusColor(record.status)}>
                                      {record.status.charAt(0).toUpperCase() + record.status.slice(1)}
                                    </span>
                                  </div>
                                </TableCell>
                                <TableCell>
                                  {record.submission_date 
                                    ? format(new Date(record.submission_date), "PPP") 
                                    : "-"}
                                </TableCell>
                                <TableCell>{record.teacher_remarks || "-"}</TableCell>
                                <TableCell>
                                  <Select
                                    value={record.status}
                                    onValueChange={(value) => 
                                      updateStudentHomeworkMutation.mutate({
                                        recordId: record.id,
                                        status: value
                                      })
                                    }
                                  >
                                    <SelectTrigger className="w-[120px]">
                                      <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                      <SelectItem value="assigned">Assigned</SelectItem>
                                      <SelectItem value="submitted">Submitted</SelectItem>
                                      <SelectItem value="checked">Checked</SelectItem>
                                      <SelectItem value="completed">Completed</SelectItem>
                                    </SelectContent>
                                  </Select>
                                </TableCell>
                              </TableRow>
                            );
                          })
                        ) : (
                          <TableRow>
                            <TableCell colSpan={6} className="text-center text-muted-foreground">
                              No students assigned to this homework
                            </TableCell>
                          </TableRow>
                        )}
                      </TableBody>
                    </Table>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default Homework;