import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input, Textarea } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { toast } from "sonner";
import { Pencil, Trash2, Save, X, UserPlus, Upload, Download } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";

interface Student {
  id: string;
  name: string;
  grade: string;
  school_name: string;
  parent_name: string;
  contact_number: string;
  center_id: string;
}

type StudentInput = {
  name: string;
  grade: string;
  school_name: string;
  parent_name: string;
  contact_number: string;
  center_id?: string | null;
};

export default function RegisterStudent() {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  const [formData, setFormData] = useState({
    name: "",
    grade: "",
    school_name: "",
    parent_name: "",
    contact_number: "",
  });
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editData, setEditData] = useState<Student | null>(null);
  const [isCreatingParent, setIsCreatingParent] = useState(false);
  const [selectedStudentForParent, setSelectedStudentForParent] = useState<Student | null>(null);
  const [parentUsername, setParentUsername] = useState("");
  const [parentPassword, setParentPassword] = useState("");

  // Bulk upload states
  const [csvPreviewRows, setCsvPreviewRows] = useState<StudentInput[]>([]);
  const [csvErrors, setCsvErrors] = useState<string[]>([]);
  const [multilineText, setMultilineText] = useState("");
  const [showPreviewDialog, setShowPreviewDialog] = useState(false);
  const [parsing, setParsing] = useState(false);

  // Fetch students (admin sees all, center users only their center)
  const { data: students, isLoading } = useQuery({
    queryKey: ["students", user?.center_id],
    queryFn: async () => {
      let query = supabase.from("students").select("*").order("created_at", { ascending: false });
      if (user?.role !== "admin" && user?.center_id) query = query.eq("center_id", user.center_id);
      const { data, error } = await query;
      if (error) throw error;
      return data as Student[];
    },
  });

  // ------------------ MUTATIONS ------------------

  // Single create
  const createMutation = useMutation({
    mutationFn: async (student: typeof formData) => {
      const { error } = await supabase.from("students").insert([{ ...student, center_id: user?.center_id }]);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["students", user?.center_id] });
      setFormData({ name: "", grade: "", school_name: "", parent_name: "", contact_number: "" });
      toast.success("Student registered successfully!");
    },
    onError: () => toast.error("Failed to register student"),
  });

  // Update student
  const updateMutation = useMutation({
    mutationFn: async (student: Student) => {
      const { error } = await supabase
        .from("students")
        .update({
          name: student.name,
          grade: student.grade,
          school_name: student.school_name,
          parent_name: student.parent_name,
          contact_number: student.contact_number,
        })
        .eq("id", student.id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["students", user?.center_id] });
      setEditingId(null);
      setEditData(null);
      toast.success("Student updated successfully!");
    },
    onError: () => toast.error("Failed to update student"),
  });

  // Delete student
  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("students").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["students", user?.center_id] });
      toast.success("Student deleted successfully!");
    },
    onError: () => toast.error("Failed to delete student"),
  });

  // Parent account creation
  const createParentMutation = useMutation({
    mutationFn: async () => {
      if (!selectedStudentForParent) return;
      const { data, error } = await supabase.functions.invoke("create-parent-account", {
        body: {
          username: parentUsername,
          password: parentPassword,
          studentId: selectedStudentForParent.id,
          centerId: user?.center_id,
        },
      });
      if (error) throw error;
      if (!data.success) throw new Error(data.error);
      return data;
    },
    onSuccess: () => {
      toast.success("Parent account created successfully");
      setIsCreatingParent(false);
      setSelectedStudentForParent(null);
      setParentUsername("");
      setParentPassword("");
    },
    onError: (error: any) => toast.error(error.message || "Failed to create parent account"),
  });

  // Bulk insert
  const bulkInsertMutation = useMutation({
    mutationFn: async (rows: StudentInput[]) => {
      if (!rows.length) return;
      const rowsWithCenter = rows.map((r) => ({ ...r, center_id: user?.center_id || null }));
      const { error } = await supabase.from("students").insert(rowsWithCenter);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["students", user?.center_id] });
      toast.success("Bulk students added successfully");
      setCsvPreviewRows([]);
      setMultilineText("");
      setShowPreviewDialog(false);
    },
    onError: (error: any) => toast.error(error.message || "Bulk insert failed"),
  });

  // ------------------ CSV / Multiline Parsing ------------------

  const parseCSV = (csv: string): string[][] => {
    const rows: string[][] = [];
    let current = "";
    let row: string[] = [];
    let inQuotes = false;

    for (let i = 0; i < csv.length; i++) {
      const ch = csv[i];
      const nxt = csv[i + 1];
      if (ch === '"') {
        if (inQuotes && nxt === '"') {
          current += '"';
          i++;
        } else inQuotes = !inQuotes;
      } else if (ch === "," && !inQuotes) {
        row.push(current.trim());
        current = "";
      } else if ((ch === "\n" || ch === "\r") && !inQuotes) {
        row.push(current.trim());
        rows.push(row);
        row = [];
        current = "";
        if (ch === "\r" && csv[i + 1] === "\n") i++;
      } else {
        current += ch;
      }
    }
    if (current !== "" || row.length > 0) row.push(current.trim()) && rows.push(row);
    return rows;
  };

  const mapRowsToStudents = (rows: string[][]): { rows: StudentInput[]; errors: string[] } => {
    const errors: string[] = [];
    if (!rows || rows.length === 0) return { rows: [], errors };
    const header = rows[0].map((h) => h.toLowerCase());
    let startIndex = 0;
    let hasHeader = ["name", "grade", "school_name", "parent_name", "contact_number"].every((f) =>
      header.includes(f)
    );
    if (hasHeader) startIndex = 1;

    const output: StudentInput[] = [];

    for (let i = startIndex; i < rows.length; i++) {
      const cols = rows[i];
      const student: StudentInput = hasHeader
        ? {
            name: (cols[header.indexOf("name")] || "").trim(),
            grade: (cols[header.indexOf("grade")] || "").trim(),
            school_name: (cols[header.indexOf("school_name")] || "").trim(),
            parent_name: (cols[header.indexOf("parent_name")] || "").trim(),
            contact_number: (cols[header.indexOf("contact_number")] || "").trim(),
          }
        : {
            name: (cols[0] || "").trim(),
            grade: (cols[1] || "").trim(),
            school_name: (cols[2] || "").trim(),
            parent_name: (cols[3] || "").trim(),
            contact_number: (cols[4] || "").trim(),
          };

      const rowNumber = i + 1;
      const rowErrors: string[] = [];
      if (!student.name) rowErrors.push(`Row ${rowNumber}: name is required`);
      if (!student.grade) rowErrors.push(`Row ${rowNumber}: grade is required`);
      if (!student.contact_number) rowErrors.push(`Row ${rowNumber}: contact_number is required`);
      if (rowErrors.length) errors.push(...rowErrors);
      else output.push(student);
    }

    const unique: StudentInput[] = [];
    const seen = new Set<string>();
    for (const s of output) {
      const key = s.contact_number || `${s.name}|${s.grade}`;
      if (!seen.has(key)) unique.push(s), seen.add(key);
      else errors.push(`Duplicate in batch: ${key}`);
    }
    return { rows: unique, errors };
  };

  const handleCsvFile = (file: File | null) => {
    if (!file) return;
    setParsing(true);
    const reader = new FileReader();
    reader.onload = () => {
      const text = String(reader.result || "");
      const parsed = parseCSV(text);
      const { rows, errors } = mapRowsToStudents(parsed);
      setCsvPreviewRows(rows);
      setCsvErrors(errors);
      setShowPreviewDialog(true);
      setParsing(false);
    };
    reader.onerror = () => {
      toast.error("Failed to read file");
      setParsing(false);
    };
    reader.readAsText(file);
  };

  const handleParseMultiline = () => {
    if (!multilineText.trim()) return toast.error("No text to parse");
    setParsing(true);
    const normalized = multilineText.replace(/\|/g, ",");
    const parsed = parseCSV(normalized);
    const { rows, errors } = mapRowsToStudents(parsed);
    setCsvPreviewRows(rows);
    setCsvErrors(errors);
    setShowPreviewDialog(true);
    setParsing(false);
  };

  const downloadTemplate = () => {
    const header = ["name", "grade", "school_name", "parent_name", "contact_number"];
    const example = ["John Doe", "6", "ABC School", "Robert Doe", "9812345678"];
    const csv = [header.join(","), example.join(",")].join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "students-template.csv";
    a.click();
  };

  const handleBulkInsertConfirm = () => {
    if (!csvPreviewRows.length) return toast.error("No rows to insert");
    bulkInsertMutation.mutate(csvPreviewRows);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    createMutation.mutate(formData);
  };

  const handleEdit = (student: Student) => {
    setEditingId(student.id);
    setEditData({ ...student });
  };

  const handleSave = () => {
    if (editData) updateMutation.mutate(editData);
  };

  const handleCancel = () => {
    setEditingId(null);
    setEditData(null);
  };

  const handleCreateParentAccount = (student: Student) => {
    setSelectedStudentForParent(student);
    setParentUsername("");
    setParentPassword("");
    setIsCreatingParent(true);
  };

  return (
    <div className="space-y-6">
      {/* Student Registration Form */}
      <Card>
        <CardHeader>
          <CardTitle>Register Student</CardTitle>
          <CardDescription>Fill student information</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="name">Full Name *</Label>
                <Input id="name" value={formData.name} onChange={(e) => setFormData({ ...formData, name: e.target.value })} required />
              </div>
              <div className="space-y-2">
                <Label htmlFor="grade">Grade *</Label>
                <Input id="grade" value={formData.grade} onChange={(e) => setFormData({ ...formData, grade: e.target.value })} required />
              </div>
              <div className="space-y-2">
                <Label htmlFor="school_name">School Name *</Label>
                <Input id="school_name" value={formData.school_name} onChange={(e) => setFormData({ ...formData, school_name: e.target.value })} required />
              </div>
              <div className="space-y-2">
                <Label htmlFor="parent_name">Parent Name *</Label>
                <Input id="parent_name" value={formData.parent_name} onChange={(e) => setFormData({ ...formData, parent_name: e.target.value })} required />
              </div>
              <div className="space-y-2">
                <Label htmlFor="contact_number">Contact Number *</Label>
                <Input id="contact_number" value={formData.contact_number} onChange={(e) => setFormData({ ...formData, contact_number: e.target.value })} required />
              </div>
            </div>

            <div className="flex flex-wrap gap-2 items-center">
              <Button type="submit">Register Student</Button>
              <input id="csv-upload" type="file" accept=".csv,text/csv" onChange={(e) => handleCsvFile(e.target.files?.[0] ?? null)} className="hidden" />
              <label htmlFor="csv-upload">
                <Button variant="outline" size="sm" asChild>
                  <span><Upload className="inline-block mr-2 h-4 w-4" /> Upload CSV</span>
                </Button>
              </label>
              <Button variant="outline" size="sm" onClick={downloadTemplate}><Download className="inline-block mr-2 h-4 w-4" /> CSV Template</Button>
              <Button variant="ghost" size="sm" onClick={() => {
                const el = document.getElementById("multiline-area");
                if (el) (el as HTMLElement).style.display = (el as HTMLElement).style.display === "none" ? "block" : "none";
              }}>Paste Rows</Button>
            </div>
          </form>

          <div id="multiline-area" style={{ display: "none" }} className="mt-4">
            <Label>Paste rows (name,grade,school,parent,contact)</Label>
            <Textarea value={multilineText} onChange={(e) => setMultilineText(e.target.value)} rows={5} placeholder="John Doe,6,ABC School,Robert Doe,9812345678" />
            <div className="flex gap-2 mt-2">
              <Button onClick={handleParseMultiline} disabled={parsing}>Parse & Preview</Button>
              <Button variant="outline" onClick={() => setMultilineText("")}>Clear</Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Preview Dialog */}
      <Dialog open={showPreviewDialog} onOpenChange={setShowPreviewDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Preview Parsed Rows</DialogTitle>
            <DialogDescription>Check before importing</DialogDescription>
          </DialogHeader>

          {csvErrors.length > 0 && (
            <div className="p-3 bg-red-50 rounded border border-red-100">
              <p className="font-semibold text-red-700">Errors:</p>
              <ul className="list-disc ml-6 text-sm text-red-700">
                {csvErrors.map((err, i) => <li key={i}>{err}</li>)}
              </ul>
            </div>
          )}

          <div className="overflow-x-auto max-h-64 overflow-y-auto border rounded">
            <table className="min-w-full">
              <thead className="bg-muted">
                <tr>
                  <th className="px-3 py-2">Name</th>
                  <th className="px-3 py-2">Grade</th>
                  <th className="px-3 py-2">School</th>
                  <th className="px-3 py-2">Parent</th>
                  <th className="px-3 py-2">Contact</th>
                </tr>
              </thead>
              <tbody>
                {csvPreviewRows.map((r, i) => (
                  <tr key={i} className="border-t">
                    <td className="px-3 py-2">{r.name}</td>
                    <td className="px-3 py-2">{r.grade}</td>
                    <td className="px-3 py-2">{r.school_name}</td>
                    <td className="px-3 py-2">{r.parent_name}</td>
                    <td className="px-3 py-2">{r.contact_number}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="flex justify-end gap-2 mt-3">
            <Button onClick={() => setShowPreviewDialog(false)} variant="outline">Cancel</Button>
            <Button onClick={handleBulkInsertConfirm} disabled={!csvPreviewRows.length}>Insert All</Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Students Table */}
      <Card>
        <CardHeader>
          <CardTitle>Registered Students</CardTitle>
          <CardDescription>Manage all students</CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? <p>Loading...</p> : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Grade</TableHead>
                  <TableHead>School</TableHead>
                  <TableHead>Parent</TableHead>
                  <TableHead>Contact</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {students?.map((s) => (
                  <TableRow key={s.id}>
                    <TableCell>
                      {editingId === s.id ? (
                        <Input value={editData?.name} onChange={(e) => setEditData({ ...editData!, name: e.target.value })} />
                      ) : s.name}
                    </TableCell>
                    <TableCell>
                      {editingId === s.id ? (
                        <Input value={editData?.grade} onChange={(e) => setEditData({ ...editData!, grade: e.target.value })} />
                      ) : s.grade}
                    </TableCell>
                    <TableCell>
                      {editingId === s.id ? (
                        <Input value={editData?.school_name} onChange={(e) => setEditData({ ...editData!, school_name: e.target.value })} />
                      ) : s.school_name}
                    </TableCell>
                    <TableCell>
                      {editingId === s.id ? (
                        <Input value={editData?.parent_name} onChange={(e) => setEditData({ ...editData!, parent_name: e.target.value })} />
                      ) : s.parent_name}
                    </TableCell>
                    <TableCell>
                      {editingId === s.id ? (
                        <Input value={editData?.contact_number} onChange={(e) => setEditData({ ...editData!, contact_number: e.target.value })} />
                      ) : s.contact_number}
                    </TableCell>
                    <TableCell className="flex gap-1">
                      {editingId === s.id ? (
                        <>
                          <Button size="sm" variant="outline" onClick={handleCancel}><X /></Button>
                          <Button size="sm" onClick={handleSave}><Save /></Button>
                        </>
                      ) : (
                        <>
                          <Button size="sm" variant="outline" onClick={() => handleEdit(s)}><Pencil /></Button>
                          <Button size="sm" variant="destructive" onClick={() => deleteMutation.mutate(s.id)}><Trash2 /></Button>
                          <Button size="sm" variant="secondary" onClick={() => handleCreateParentAccount(s)}><UserPlus /></Button>
                        </>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Parent Account Dialog */}
      <Dialog open={isCreatingParent} onOpenChange={setIsCreatingParent}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create Parent Account</DialogTitle>
            <DialogDescription>Assign credentials for parent</DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label>Username *</Label>
            <Input value={parentUsername} onChange={(e) => setParentUsername(e.target.value)} />
            <Label>Password *</Label>
            <Input value={parentPassword} type="password" onChange={(e) => setParentPassword(e.target.value)} />
            <div className="flex justify-end gap-2 mt-2">
              <Button variant="outline" onClick={() => setIsCreatingParent(false)}>Cancel</Button>
              <Button onClick={() => createParentMutation.mutate()}>Create</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
