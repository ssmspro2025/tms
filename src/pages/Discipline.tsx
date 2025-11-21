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
import { Plus, Edit, Trash2, Eye, AlertTriangle } from "lucide-react";
import { format } from "date-fns";
import { Switch } from "@/components/ui/switch";

const Discipline = () => {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [viewingIssue, setViewingIssue] = useState<any>(null);
  const [issueForm, setIssueForm] = useState({
    student_id: "",
    discipline_category_id: "",
    issue_date: format(new Date(), "yyyy-MM-dd"),
    description: "",
    severity: "minor",
    incident_location: "",
    witnesses: "",
    action_taken: "",
    action_date: format(new Date(), "yyyy-MM-dd"),
    resolved: false
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

  // Fetch discipline categories
  const { data: categories = [] } = useQuery({
    queryKey: ["discipline-categories", user?.center_id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("discipline_categories")
        .select("*")
        .eq("center_id", user?.center_id!)
        .eq("is_active", true);
      if (error) throw error;
      return data;
    },
    enabled: !!user?.center_id
  });

  // Fetch discipline issues
  const { data: issues = [] } = useQuery({
    queryKey: ["discipline-issues", user?.center_id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("discipline_issues")
        .select("*, students(name), discipline_categories(name), users(username)")
        .eq("center_id", user?.center_id!)
        .order("issue_date", { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: !!user?.center_id
  });

  // Create discipline issue mutation
  const createIssueMutation = useMutation({
    mutationFn: async () => {
      const { error } = await supabase
        .from("discipline_issues")
        .insert({
          ...issueForm,
          center_id: user?.center_id,
          reported_by: user?.id,
          action_date: issueForm.action_date || null,
          resolved: issueForm.resolved || false
        });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Discipline issue reported successfully");
      queryClient.invalidateQueries({ queryKey: ["discipline-issues"] });
      resetForm();
    },
    onError: (error: any) => {
      toast.error(error.message || "Failed to report discipline issue");
    }
  });

  // Update discipline issue mutation
  const updateIssueMutation = useMutation({
    mutationFn: async () => {
      const { error } = await supabase
        .from("discipline_issues")
        .update({
          ...issueForm,
          action_date: issueForm.action_date || null,
          resolved: issueForm.resolved || false
        })
        .eq("id", viewingIssue.id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Discipline issue updated successfully");
      queryClient.invalidateQueries({ queryKey: ["discipline-issues"] });
      setViewingIssue(null);
    },
    onError: (error: any) => {
      toast.error(error.message || "Failed to update discipline issue");
    }
  });

  const resetForm = () => {
    setIssueForm({
      student_id: "",
      discipline_category_id: "",
      issue_date: format(new Date(), "yyyy-MM-dd"),
      description: "",
      severity: "minor",
      incident_location: "",
      witnesses: "",
      action_taken: "",
      action_date: format(new Date(), "yyyy-MM-dd"),
      resolved: false
    });
    setIsDialogOpen(false);
  };

  const handleSubmit = () => {
    createIssueMutation.mutate();
  };

  const handleUpdate = () => {
    updateIssueMutation.mutate();
  };

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case "minor": return "bg-green-100 text-green-800";
      case "moderate": return "bg-yellow-100 text-yellow-800";
      case "major": return "bg-orange-100 text-orange-800";
      case "severe": return "bg-red-100 text-red-800";
      default: return "bg-gray-100 text-gray-800";
    }
  };

  const getStatusColor = (resolved: boolean) => {
    return resolved ? "text-green-600" : "text-red-600";
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold">Discipline Management</h1>
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button onClick={resetForm}>
              <Plus className="mr-2 h-4 w-4" />
              Report Issue
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>Report Discipline Issue</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="student">Student *</Label>
                  <Select
                    value={issueForm.student_id || ""}
                    onValueChange={(value) => setIssueForm({ ...issueForm, student_id: value })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select student" />
                    </SelectTrigger>
                    <SelectContent>
                      {students.map((student: any) => (
                        <SelectItem key={student.id} value={student.id}>
                          {student.name} - {student.grade}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="category">Category *</Label>
                  <Select
                    value={issueForm.discipline_category_id || ""}
                    onValueChange={(value) => setIssueForm({ ...issueForm, discipline_category_id: value })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select category" />
                    </SelectTrigger>
                    <SelectContent>
                      {categories.map((category: any) => (
                        <SelectItem key={category.id} value={category.id}>
                          {category.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="issue_date">Date *</Label>
                  <Input
                    id="issue_date"
                    type="date"
                    value={issueForm.issue_date}
                    onChange={(e) => setIssueForm({ ...issueForm, issue_date: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="severity">Severity *</Label>
                  <Select
                    value={issueForm.severity}
                    onValueChange={(value) => setIssueForm({ ...issueForm, severity: value })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="minor">Minor</SelectItem>
                      <SelectItem value="moderate">Moderate</SelectItem>
                      <SelectItem value="major">Major</SelectItem>
                      <SelectItem value="severe">Severe</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="description">Description *</Label>
                <Textarea
                  id="description"
                  value={issueForm.description}
                  onChange={(e) => setIssueForm({ ...issueForm, description: e.target.value })}
                  placeholder="Describe the incident"
                  rows={3}
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="location">Location</Label>
                  <Input
                    id="location"
                    value={issueForm.incident_location}
                    onChange={(e) => setIssueForm({ ...issueForm, incident_location: e.target.value })}
                    placeholder="Where did it happen?"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="witnesses">Witnesses</Label>
                  <Input
                    id="witnesses"
                    value={issueForm.witnesses}
                    onChange={(e) => setIssueForm({ ...issueForm, witnesses: e.target.value })}
                    placeholder="Names of witnesses"
                  />
                </div>
              </div>
              <Button onClick={handleSubmit} className="w-full">
                Report Issue
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Discipline Issues</CardTitle>
        </CardHeader>
        <CardContent>
          {issues.length === 0 ? (
            <p className="text-muted-foreground text-center py-8">No discipline issues reported</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Student</TableHead>
                  <TableHead>Category</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead>Severity</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Reported By</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {issues.map((issue: any) => (
                  <TableRow key={issue.id}>
                    <TableCell className="font-medium">{issue.students?.name || "-"}</TableCell>
                    <TableCell>{issue.discipline_categories?.name || "-"}</TableCell>
                    <TableCell>{format(new Date(issue.issue_date), "PPP")}</TableCell>
                    <TableCell>
                      <span className={`px-2 py-1 rounded-full text-xs font-semibold ${getSeverityColor(issue.severity)}`}>
                        {issue.severity}
                      </span>
                    </TableCell>
                    <TableCell>
                      <span className={`font-semibold ${getStatusColor(issue.resolved)}`}>
                        {issue.resolved ? "Resolved" : "Open"}
                      </span>
                    </TableCell>
                    <TableCell>{issue.users?.username || "-"}</TableCell>
                    <TableCell>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setViewingIssue(issue)}
                      >
                        <Eye className="h-4 w-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Issue Details Dialog */}
      <Dialog open={!!viewingIssue} onOpenChange={() => setViewingIssue(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Discipline Issue Details</DialogTitle>
          </DialogHeader>
          {viewingIssue && (
            <div className="space-y-4 py-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-sm text-muted-foreground">Student</p>
                  <p className="font-medium">{viewingIssue.students?.name || "-"}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Category</p>
                  <p className="font-medium">{viewingIssue.discipline_categories?.name || "-"}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Date</p>
                  <p className="font-medium">{format(new Date(viewingIssue.issue_date), "PPP")}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Severity</p>
                  <p>
                    <span className={`px-2 py-1 rounded-full text-xs font-semibold ${getSeverityColor(viewingIssue.severity)}`}>
                      {viewingIssue.severity}
                    </span>
                  </p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Status</p>
                  <p className={`font-semibold ${getStatusColor(viewingIssue.resolved)}`}>
                    {viewingIssue.resolved ? "Resolved" : "Open"}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Reported By</p>
                  <p className="font-medium">{viewingIssue.users?.username || "-"}</p>
                </div>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Description</p>
                <p className="mt-1">{viewingIssue.description || "-"}</p>
              </div>
              {viewingIssue.incident_location && (
                <div>
                  <p className="text-sm text-muted-foreground">Location</p>
                  <p className="mt-1">{viewingIssue.incident_location}</p>
                </div>
              )}
              {viewingIssue.witnesses && (
                <div>
                  <p className="text-sm text-muted-foreground">Witnesses</p>
                  <p className="mt-1">{viewingIssue.witnesses}</p>
                </div>
              )}
              
              {/* Action Taken Section */}
              <div className="border-t pt-4">
                <h3 className="font-semibold mb-3 flex items-center gap-2">
                  <AlertTriangle className="h-4 w-4" />
                  Action Taken
                </h3>
                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="action_taken">Action Taken</Label>
                      <Textarea
                        id="action_taken"
                        value={viewingIssue.action_taken || ""}
                        onChange={(e) => setViewingIssue({ ...viewingIssue, action_taken: e.target.value })}
                        placeholder="Describe the action taken..."
                        rows={3}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="action_date">Action Date</Label>
                      <Input
                        id="action_date"
                        type="date"
                        value={viewingIssue.action_date || ""}
                        onChange={(e) => setViewingIssue({ ...viewingIssue, action_date: e.target.value })}
                      />
                    </div>
                  </div>
                  <div className="flex items-center justify-between">
                    <Label htmlFor="resolved">Mark as Resolved</Label>
                    <Switch
                      id="resolved"
                      checked={viewingIssue.resolved || false}
                      onCheckedChange={(checked) => setViewingIssue({ ...viewingIssue, resolved: checked })}
                    />
                  </div>
                  <Button onClick={handleUpdate} className="w-full">
                    Update Issue
                  </Button>
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Discipline;