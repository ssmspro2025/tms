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
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogDescription } from "@/components/ui/dialog";
import { toast } from "sonner";
import { Plus, Edit, Trash2, FileUp, Image, CheckCircle, XCircle } from "lucide-react";
import { format } from "date-fns";
import { Tables } from "@/integrations/supabase/types";

type Homework = Tables<'homework'>;
type Student = Tables<'students'>;
type StudentHomeworkStatus = Tables<'student_homework_status'>;

export default function HomeworkManagement() {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingHomework, setEditingHomework] = useState<Homework | null>(null);

  const [title, setTitle] = useState("");
  const [subject, setSubject] = useState("");
  const [grade, setGrade] = useState("");
  const [description, setDescription] = useState("");
  const [dueDate, setDueDate] = useState(format(new Date(), "yyyy-MM-dd"));
  const [file, setFile] = useState<File | null>(null);
  const [image, setImage] = useState<File | null>(null);

  const [selectedHomeworkForStatus, setSelectedHomeworkForStatus] = useState<Homework | null>(null);
  const [showStatusDialog, setShowStatusDialog] = useState(false);

  // Fetch homework
  const { data: homeworkList = [], isLoading } = useQuery({
    queryKey: ["homework", user?.center_id],
    queryFn: async () => {
      if (!user?.center_id) return [];
      const { data, error } = await supabase
        .from("homework")
        .select("*")
        .eq("center_id", user.center_id)
        .order("due_date", { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: !!user?.center_id,
  });

  // Fetch students for status tracking
  const { data: students = [] } = useQuery({
    queryKey: ["students-for-homework", user?.center_id],
    queryFn: async () => {
      if (!user?.center_id) return [];
      const { data, error } = await supabase
        .from("students")
        .select("id, name, grade")
        .eq("center_id", user.center_id)
        .order("name");
      if (error) throw error;
      return data;
    },
    enabled: !!user?.center_id,
  });

  // Fetch student homework statuses for a specific homework
  const { data: studentStatuses = [], refetch: refetchStudentStatuses } = useQuery({
    queryKey: ["student-homework-statuses", selectedHomeworkForStatus?.id],
    queryFn: async () => {
      if (!selectedHomeworkForStatus?.id) return [];
      const { data, error } = await supabase
        .from("student_homework_status")
        .select("*, students(name, grade)")
        .eq("homework_id", selectedHomeworkForStatus.id);
      if (error) throw error;
      return data;
    },
    enabled: !!selectedHomeworkForStatus?.id,
  });

  const resetForm = () => {
    setTitle("");
    setSubject("");
    setGrade("");
    setDescription("");
    setDueDate(format(new Date(), "yyyy-MM-dd"));
    setFile(null);
    setImage(null);
    setEditingHomework(null);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setFile(e.target.files[0]);
    }
  };

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setImage(e.target.files[0]);
    }
  };

  const uploadFile = async (fileToUpload: File, bucket: string) => {
    const fileExt = fileToUpload.name.split(".").pop();
    const fileName = `${Date.now()}-${Math.random().toString(36).substring(7)}.${fileExt}`;
    const { error: uploadError } = await supabase.storage
      .from(bucket)
      .upload(fileName, fileToUpload);
    if (uploadError) throw uploadError;
    return fileName;
  };

  const createHomeworkMutation = useMutation({
    mutationFn: async () => {
      if (!user?.center_id) throw new Error("Center ID not found");

      let fileUrl: string | null = null;
      let imageUrl: string | null = null;

      if (file) fileUrl = await uploadFile(file, "homework-files");
      if (image) imageUrl = await uploadFile(image, "homework-images");

      const { data: newHomework, error } = await supabase.from("homework").insert({
        center_id: user.center_id,
        title,
        subject,
        grade,
        description: description || null,
        due_date: dueDate,
        file_url: fileUrl,
        image_url: imageUrl,
      }).select().single();
      if (error) throw error;

      // Assign homework to all students of the specified grade
      const studentsInGrade = students.filter(s => s.grade === grade);
      if (studentsInGrade.length > 0) {
        const studentHomeworkRecords = studentsInGrade.map(s => ({
          student_id: s.id,
          homework_id: newHomework.id,
          status: 'assigned' as const,
        }));
        const { error: assignError } = await supabase.from("student_homework_status").insert(studentHomeworkRecords);
        if (assignError) throw assignError;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["homework"] });
      toast.success("Homework created and assigned successfully!");
      setIsDialogOpen(false);
      resetForm();
    },
    onError: (error: any) => {
      toast.error(error.message || "Failed to create homework");
    },
  });

  const updateHomeworkMutation = useMutation({
    mutationFn: async () => {
      if (!editingHomework || !user?.center_id) throw new Error("Homework or Center ID not found");

      let fileUrl: string | null = editingHomework.file_url;
      let imageUrl: string | null = editingHomework.image_url;

      if (file) fileUrl = await uploadFile(file, "homework-files");
      if (image) imageUrl = await uploadFile(image, "homework-images");

      const { error } = await supabase.from("homework").update({
        title,
        subject,
        grade,
        description: description || null,
        due_date: dueDate,
        file_url: fileUrl,
        image_url: imageUrl,
      }).eq("id", editingHomework.id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["homework"] });
      toast.success("Homework updated successfully!");
      setIsDialogOpen(false);
      resetForm();
    },
    onError: (error: any) => {
      toast.error(error.message || "Failed to update homework");
    },
  });

  const deleteHomeworkMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("homework").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["homework"] });
      toast.success("Homework deleted successfully!");
    },
    onError: (error: any) => {
      toast.error(error.message || "Failed to delete homework");
    },
  });

  const updateStudentHomeworkStatusMutation = useMutation({
    mutationFn: async ({ id, status, teacher_remarks }: { id: string; status: StudentHomeworkStatus['status']; teacher_remarks: string }) => {
      const { error } = await supabase.from("student_homework_status").update({
        status,
        teacher_remarks: teacher_remarks || null,
        submission_date: status === 'completed' || status === 'checked' ? format(new Date(), "yyyy-MM-dd") : null,
      }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      refetchStudentStatuses();
      toast.success("Student homework status updated!");
    },
    onError: (error: any) => {
      toast.error(error.message || "Failed to update status");
    },
  });

  const handleEditClick = (homework: Homework) => {
    setEditingHomework(homework);
    setTitle(homework.title);
    setSubject(homework.subject);
    setGrade(homework.grade);
    setDescription(homework.description || "");
    setDueDate(homework.due_date);
    setFile(null);
    setImage(null);
    setIsDialogOpen(true);
  };

  const handleSubmit = () => {
    if (editingHomework) {
      updateHomeworkMutation.mutate();
    } else {
      createHomeworkMutation.mutate();
    }
  };

  const handleManageStatusClick = (homework: Homework) => {
    setSelectedHomeworkForStatus(homework);
    setShowStatusDialog(true);
  };

  const uniqueGrades = Array.from(new Set(students.map(s => s.grade))).sort();

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold">Homework Management</h1>
        <Dialog open={isDialogOpen} onOpenChange={(open) => {
          setIsDialogOpen(open);
          if (!open) resetForm();
        }}>
          <DialogTrigger asChild>
            <Button><Plus className="h-4 w-4 mr-2" /> Create Homework</Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>{editingHomework ? "Edit Homework" : "Create New Homework"}</DialogTitle>
              <DialogDescription>
                {editingHomework ? "Update the details of this homework assignment." : "Assign new homework to students by filling in the details."}
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="title">Title *</Label>
                <Input id="title" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g., Math Worksheet 1" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="subject">Subject *</Label>
                  <Input id="subject" value={subject} onChange={(e) => setSubject(e.target.value)} placeholder="e.g., Mathematics" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="grade">Grade *</Label>
                  <Select value={grade} onValueChange={setGrade}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select Grade" />
                    </SelectTrigger>
                    <SelectContent>
                      {uniqueGrades.map((g) => (
                        <SelectItem key={g} value={g}>{g}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="description">Description (Optional)</Label>
                <Textarea id="description" value={description} onChange={(e) => setDescription(e.target.value)} rows={3} placeholder="Instructions for homework" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="dueDate">Due Date *</Label>
                <Input id="dueDate" type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="file">Attach File (PDF, DOCX - Optional)</Label>
                <Input id="file" type="file" accept=".pdf,.doc,.docx" onChange={handleFileChange} />
                {editingHomework?.file_url && !file && (
                  <p className="text-sm text-muted-foreground">Current file: {editingHomework.file_url.split('-').pop()}</p>
                )}
              </div>
              <div className="space-y-2">
                <Label htmlFor="image">Attach Image (Optional)</Label>
                <Input id="image" type="file" accept="image/*" onChange={handleImageChange} />
                {editingHomework?.image_url && !image && (
                  <p className="text-sm text-muted-foreground">Current image: {editingHomework.image_url.split('-').pop()}</p>
                )}
              </div>
              <Button
                onClick={handleSubmit}
                disabled={!title || !subject || !grade || !dueDate || createHomeworkMutation.isPending || updateHomeworkMutation.isPending}
                className="w-full"
              >
                {editingHomework ? (updateHomeworkMutation.isPending ? "Updating..." : "Update Homework") : (createHomeworkMutation.isPending ? "Creating..." : "Create Homework")}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>All Homework Assignments</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <p>Loading homework...</p>
          ) : homeworkList.length === 0 ? (
            <p className="text-muted-foreground text-center py-8">No homework assignments created yet.</p>
          ) : (
            <div className="space-y-4">
              {homeworkList.map((hw) => (
                <div key={hw.id} className="border rounded-lg p-4 flex items-start justify-between">
                  <div className="flex-1 space-y-1">
                    <h3 className="font-semibold text-lg">{hw.title} ({hw.subject} - Grade {hw.grade})</h3>
                    <p className="text-sm text-muted-foreground">Due: {format(new Date(hw.due_date), "PPP")}</p>
                    {hw.description && <p className="text-sm">{hw.description}</p>}
                    <div className="flex gap-2 mt-2">
                      {hw.file_url && (
                        <Button variant="outline" size="sm" asChild>
                          <a href={supabase.storage.from("homework-files").getPublicUrl(hw.file_url).data.publicUrl} target="_blank" rel="noopener noreferrer">
                            <FileUp className="h-4 w-4 mr-1" /> File
                          </a>
                        </Button>
                      )}
                      {hw.image_url && (
                        <Button variant="outline" size="sm" asChild>
                          <a href={supabase.storage.from("homework-images").getPublicUrl(hw.image_url).data.publicUrl} target="_blank" rel="noopener noreferrer">
                            <Image className="h-4 w-4 mr-1" /> Image
                          </a>
                        </Button>
                      )}
                      <Button variant="outline" size="sm" onClick={() => handleManageStatusClick(hw)}>
                        <CheckCircle className="h-4 w-4 mr-1" /> Manage Status
                      </Button>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <Button variant="ghost" size="sm" onClick={() => handleEditClick(hw)}>
                      <Edit className="h-4 w-4" />
                    </Button>
                    <Button variant="destructive" size="sm" onClick={() => deleteHomeworkMutation.mutate(hw.id)}>
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Manage Student Homework Status Dialog */}
      <Dialog open={showStatusDialog} onOpenChange={setShowStatusDialog}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Manage Status for: {selectedHomeworkForStatus?.title}</DialogTitle>
            <DialogDescription>
              Update the submission status and add remarks for each student.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            {studentStatuses.length === 0 ? (
              <p className="text-muted-foreground text-center">No students assigned to this homework yet.</p>
            ) : (
              <div className="border rounded-lg overflow-hidden">
                <table className="w-full">
                  <thead className="bg-muted">
                    <tr>
                      <th className="px-4 py-2 text-left">Student Name</th>
                      <th className="px-4 py-2 text-left">Grade</th>
                      <th className="px-4 py-2 text-left">Status</th>
                      <th className="px-4 py-2 text-left">Remarks</th>
                      <th className="px-4 py-2 text-center">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {studentStatuses.map((statusEntry: any) => (
                      <TableRow key={statusEntry.id} className="border-t">
                        <TableCell>{statusEntry.students?.name}</TableCell>
                        <TableCell>{statusEntry.students?.grade}</TableCell>
                        <TableCell>
                          <Select
                            value={statusEntry.status}
                            onValueChange={(newStatus: StudentHomeworkStatus['status']) =>
                              updateStudentHomeworkStatusMutation.mutate({
                                id: statusEntry.id,
                                status: newStatus,
                                teacher_remarks: statusEntry.teacher_remarks,
                              })
                            }
                          >
                            <SelectTrigger className="w-[140px]">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="assigned">Assigned</SelectItem>
                              <SelectItem value="in_progress">In Progress</SelectItem>
                              <SelectItem value="completed">Completed</SelectItem>
                              <SelectItem value="checked">Checked</SelectItem>
                            </SelectContent>
                          </Select>
                        </TableCell>
                        <TableCell>
                          <Input
                            type="text"
                            defaultValue={statusEntry.teacher_remarks || ""}
                            onBlur={(e) =>
                              updateStudentHomeworkStatusMutation.mutate({
                                id: statusEntry.id,
                                status: statusEntry.status,
                                teacher_remarks: e.target.value,
                              })
                            }
                            placeholder="Add remarks"
                          />
                        </TableCell>
                        <TableCell className="text-center">
                          {statusEntry.status === 'completed' || statusEntry.status === 'checked' ? (
                            <CheckCircle className="h-5 w-5 text-green-600 mx-auto" />
                          ) : (
                            <XCircle className="h-5 w-5 text-red-600 mx-auto" />
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}