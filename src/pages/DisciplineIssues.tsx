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
import { Plus, Edit, Trash2, AlertTriangle } from "lucide-react";
import { format } from "date-fns";
import { Tables } from "@/integrations/supabase/types";

type DisciplineIssue = Tables<'discipline_issues'>;
type Student = Tables<'students'>;

const issueCategories = [
  { value: "behavior", label: "Behavior" },
  { value: "homework", label: "Homework" },
  { value: "respect", label: "Disrespect" },
  { value: "disruption", label: "Disruption" },
  { value: "uniform", label: "Uniform" },
  { value: "other", label: "Other" },
];

const severityLevels = [
  { value: "low", label: "Low" },
  { value: "medium", label: "Medium" },
  { value: "high", label: "High" },
];

export default function DisciplineIssues() {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingIssue, setEditingIssue] = useState<DisciplineIssue | null>(null);

  const [studentId, setStudentId] = useState("");
  const [category, setCategory] = useState<DisciplineIssue['category']>("behavior");
  const [description, setDescription] = useState("");
  const [severity, setSeverity] = useState<DisciplineIssue['severity']>("medium");
  const [actionTaken, setActionTaken] = useState("");
  const [issueDate, setIssueDate] = useState(format(new Date(), "yyyy-MM-dd"));

  // Fetch students
  const { data: students = [] } = useQuery({
    queryKey: ["students-for-discipline", user?.center_id],
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

  // Fetch discipline issues
  const { data: issues = [], isLoading } = useQuery({
    queryKey: ["discipline-issues", user?.center_id],
    queryFn: async () => {
      if (!user?.center_id) return [];
      const { data, error } = await supabase
        .from("discipline_issues")
        .select("*, students(name, grade)")
        .eq("center_id", user.center_id)
        .order("issue_date", { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: !!user?.center_id,
  });

  const resetForm = () => {
    setStudentId("");
    setCategory("behavior");
    setDescription("");
    setSeverity("medium");
    setActionTaken("");
    setIssueDate(format(new Date(), "yyyy-MM-dd"));
    setEditingIssue(null);
  };

  const createIssueMutation = useMutation({
    mutationFn: async () => {
      if (!user?.center_id || !studentId) throw new Error("Center ID or Student not found");

      const { error } = await supabase.from("discipline_issues").insert({
        center_id: user.center_id,
        student_id: studentId,
        category,
        description,
        severity,
        action_taken: actionTaken || null,
        issue_date: issueDate,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["discipline-issues"] });
      toast.success("Discipline issue logged successfully!");
      setIsDialogOpen(false);
      resetForm();
    },
    onError: (error: any) => {
      toast.error(error.message || "Failed to log issue");
    },
  });

  const updateIssueMutation = useMutation({
    mutationFn: async () => {
      if (!editingIssue || !user?.center_id || !studentId) throw new Error("Issue, Center ID or Student not found");

      const { error } = await supabase.from("discipline_issues").update({
        student_id: studentId,
        category,
        description,
        severity,
        action_taken: actionTaken || null,
        issue_date: issueDate,
      }).eq("id", editingIssue.id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["discipline-issues"] });
      toast.success("Discipline issue updated successfully!");
      setIsDialogOpen(false);
      resetForm();
    },
    onError: (error: any) => {
      toast.error(error.message || "Failed to update issue");
    },
  });

  const deleteIssueMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("discipline_issues").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["discipline-issues"] });
      toast.success("Discipline issue deleted successfully!");
    },
    onError: (error: any) => {
      toast.error(error.message || "Failed to delete issue");
    },
  });

  const handleEditClick = (issue: DisciplineIssue) => {
    setEditingIssue(issue);
    setStudentId(issue.student_id);
    setCategory(issue.category);
    setDescription(issue.description);
    setSeverity(issue.severity);
    setActionTaken(issue.action_taken || "");
    setIssueDate(issue.issue_date);
    setIsDialogOpen(true);
  };

  const handleSubmit = () => {
    if (editingIssue) {
      updateIssueMutation.mutate();
    } else {
      createIssueMutation.mutate();
    }
  };

  const getSeverityColor = (severity: DisciplineIssue['severity']) => {
    switch (severity) {
      case "low": return "text-green-600";
      case "medium": return "text-orange-600";
      case "high": return "text-red-600";
      default: return "text-gray-600";
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold">Discipline Issues</h1>
        <Dialog open={isDialogOpen} onOpenChange={(open) => {
          setIsDialogOpen(open);
          if (!open) resetForm();
        }}>
          <DialogTrigger asChild>
            <Button><Plus className="h-4 w-4 mr-2" /> Log Issue</Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>{editingIssue ? "Edit Discipline Issue" : "Log New Discipline Issue"}</DialogTitle>
              <DialogDescription>
                {editingIssue ? "Update the details of this discipline issue." : "Record a new discipline issue for a student."}
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="student">Student *</Label>
                <Select value={studentId} onValueChange={setStudentId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select Student" />
                  </SelectTrigger>
                  <SelectContent>
                    {students.map((s) => (
                      <SelectItem key={s.id} value={s.id}>
                        {s.name} - {s.grade}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="category">Category *</Label>
                <Select value={category} onValueChange={(value: DisciplineIssue['category']) => setCategory(value)}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select Category" />
                  </SelectTrigger>
                  <SelectContent>
                    {issueCategories.map((cat) => (
                      <SelectItem key={cat.value} value={cat.value}>
                        {cat.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="description">Description *</Label>
                <Textarea id="description" value={description} onChange={(e) => setDescription(e.target.value)} rows={3} placeholder="Describe the incident" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="severity">Severity *</Label>
                <Select value={severity} onValueChange={(value: DisciplineIssue['severity']) => setSeverity(value)}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select Severity" />
                  </SelectTrigger>
                  <SelectContent>
                    {severityLevels.map((level) => (
                      <SelectItem key={level.value} value={level.value}>
                        {level.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="actionTaken">Action Taken (Optional)</Label>
                <Textarea id="actionTaken" value={actionTaken} onChange={(e) => setActionTaken(e.target.value)} rows={2} placeholder="e.g., Spoke to student, contacted parents" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="issueDate">Date *</Label>
                <Input id="issueDate" type="date" value={issueDate} onChange={(e) => setIssueDate(e.target.value)} />
              </div>
              <Button
                onClick={handleSubmit}
                disabled={!studentId || !category || !description || !severity || !issueDate || createIssueMutation.isPending || updateIssueMutation.isPending}
                className="w-full"
              >
                {editingIssue ? (updateIssueMutation.isPending ? "Updating..." : "Update Issue") : (createIssueMutation.isPending ? "Logging..." : "Log Issue")}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>All Discipline Issues</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <p>Loading issues...</p>
          ) : issues.length === 0 ? (
            <p className="text-muted-foreground text-center py-8">No discipline issues logged yet.</p>
          ) : (
            <div className="space-y-4">
              {issues.map((issue: any) => (
                <div key={issue.id} className="border rounded-lg p-4 flex items-start justify-between">
                  <div className="flex-1 space-y-1">
                    <h3 className="font-semibold text-lg">{issue.students?.name} - {issueCategories.find(c => c.value === issue.category)?.label}</h3>
                    <p className="text-sm text-muted-foreground">Date: {format(new Date(issue.issue_date), "PPP")}</p>
                    <p className="text-sm">{issue.description}</p>
                    {issue.action_taken && <p className="text-sm font-medium">Action: {issue.action_taken}</p>}
                    <p className={`text-sm font-semibold ${getSeverityColor(issue.severity)}`}>Severity: {issue.severity.toUpperCase()}</p>
                  </div>
                  <div className="flex gap-2">
                    <Button variant="ghost" size="sm" onClick={() => handleEditClick(issue)}>
                      <Edit className="h-4 w-4" />
                    </Button>
                    <Button variant="destructive" size="sm" onClick={() => deleteIssueMutation.mutate(issue.id)}>
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}