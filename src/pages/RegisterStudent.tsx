import { useState, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { toast } from "sonner";
import { Pencil, Trash2, Save, X, UserPlus, Upload, Download } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";

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

  // Single student form
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

  const fileInputRef = useRef<HTMLInputElement>(null);

  // Fetch students
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

  // Single create mutation
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

  // Update student mutation
  const updateMutation = useMutation({
    mutationFn: async (student: Student) => {
      const { error } = await supabase.from("students").update({
        name: student.name,
        grade: student.grade,
        school_name: student.school_name,
        parent_name: student.parent_name,
        contact_number: student.contact_number,
      }).eq("id", student.id);
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

  // Delete student mutation
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

  // Create parent account mutation
  const createParentMutation = useMutation({
    mutationFn: async () => {
      if (!selectedStudentForParent) return;
      const { data, error } = await supabase.functions.invoke("create-parent-account", {
        body: { username: parentUsername, password: parentPassword, studentId: selectedStudentForParent.id, centerId: user?.center_id },
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
    onError: (err: any) => toast.error(err.message || "Failed to create parent account"),
  });

  // Bulk insert mutation
  const bulkInsertMutation = useMutation({
    mutationFn: async (rows: StudentInput[]) => {
      if (!rows.length) return;
      const rowsWithCenter = rows.map(r => ({ ...r, center_id: user?.center_id || null }));
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
    onError: (err: any) => toast.error(err.message || "Bulk insert failed"),
  });

  // CSV parser helpers
  const parseCSV = (csv: string): string[][] => {
    const rows: string[][] = [];
    let current = "", row: string[] = [], inQuotes = false;
    for (let i = 0; i < csv.length; i++) {
      const ch = csv[i], nxt = csv[i + 1];
      if (ch === '"') {
        if (inQuotes && nxt === '"') { current += '"'; i++; } else { inQuotes = !inQuotes; }
      } else if (ch === "," && !inQuotes) { row.push(current.trim()); current = ""; }
      else if ((ch === "\n" || ch === "\r") && !inQuotes) {
        if (current !== "" || row.length > 0) { row.push(current.trim()); rows.push(row); row = []; current = ""; }
        if (ch === "\r" && csv[i + 1] === "\n") i++;
      } else { current += ch; }
    }
    if (current !== "" || row.length > 0) { row.push(current.trim()); rows.push(row); }
    return rows;
  };

  const mapRowsToStudents = (rows: string[][]) => {
    const errors: string[] = [];
    if (!rows || rows.length === 0) return { rows: [], errors };
    const header = rows[0].map(h => h.toLowerCase());
    let startIndex = rows[0].length === 5 ? 0 : 1; // simple header detection
    const output: StudentInput[] = [];
    for (let i = startIndex; i < rows.length; i++) {
      const cols = rows[i];
      const [name = "", grade = "", school_name = "", parent_name = "", contact_number = ""] = cols;
      const student: StudentInput = { name: name.trim(), grade: grade.trim(), school_name: school_name.trim(), parent_name: parent_name.trim(), contact_number: contact_number.trim() };
      const rowNumber = i + 1;
      const rowErrors: string[] = [];
      if (!student.name) rowErrors.push(`Row ${rowNumber}: name is required`);
      if (!student.grade) rowErrors.push(`Row ${rowNumber}: grade is required`);
      if (!student.contact_number) rowErrors.push(`Row ${rowNumber}: contact_number is required`);
      if (rowErrors.length) errors.push(...rowErrors); else output.push(student);
    }
    // Deduplicate
    const unique: StudentInput[] = [];
    const seen = new Set<string>();
    for (const s of output) {
      const key = s.contact_number || `${s.name}|${s.grade}`;
      if (!seen.has(key)) { seen.add(key); unique.push(s); } else { errors.push(`Duplicate in batch: ${key}`); }
    }
    return { rows: unique, errors };
  };

  const handleCsvFile = (file: File | null) => {
    if (!file) return;
    setParsing(true);
    const reader = new FileReader();
    reader.onload = () => {
      const text = String(reader.result || "");
      const { rows, errors } = mapRowsToStudents(parseCSV(text));
      setCsvPreviewRows(rows);
      setCsvErrors(errors);
      setShowPreviewDialog(true);
      setParsing(false);
    };
    reader.onerror = () => { toast.error("Failed to read file"); setParsing(false); };
    reader.readAsText(file);
  };

  const handleParseMultiline = () => {
    if (!multilineText.trim()) { toast.error("No text to parse"); return; }
    setParsing(true);
    const normalized = multilineText.replace(/\|/g, ",");
    const { rows, errors } = mapRowsToStudents(parseCSV(normalized));
    setCsvPreviewRows(rows);
    setCsvErrors(errors);
    setShowPreviewDialog(true);
    setParsing(false);
  };

  const downloadTemplate = () => {
    const csv = ["name,grade,school_name,parent_name,contact_number", "John Doe,6,ABC School,Robert Doe,9812345678"].join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = "students-template.csv"; a.click();
  };

  const handleBulkInsertConfirm = () => {
    if (!csvPreviewRows.length) { toast.error("No rows to insert"); return; }
    bulkInsertMutation.mutate(csvPreviewRows);
  };

  const handleSubmit = (e: React.FormEvent) => { e.preventDefault(); createMutation.mutate(formData); };
  const handleEdit = (student: Student) => { setEditingId(student.id); setEditData({ ...student }); };
  const handleSave = () => { if (editData) updateMutation.mutate(editData); };
  const handleCancel = () => { setEditingId(null); setEditData(null); };
  const handleCreateParentAccount = (student: Student) => { setSelectedStudentForParent(student); setParentUsername(""); setParentPassword(""); setIsCreatingParent(true); };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-3xl font-bold tracking-tight">Register Student</h2>
        <p className="text-muted-foreground">Add new students to the attendance system</p>
      </div>

      {/* Single student form */}
      <Card>
        <CardHeader>
          <CardTitle>Student Information</CardTitle>
          <CardDescription>Fill in the details to register a new student</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid gap-4 md:grid-cols-2">
              {["name","grade","school_name","parent_name","contact_number"].map((field) => (
                <div className="space-y-2" key={field}>
                  <Label htmlFor={field}>{field.replace("_"," ").toUpperCase()} *</Label>
                  <Input
                    id={field}
                    value={(formData as any)[field]}
                    onChange={(e) => setFormData({...formData, [field]: e.target.value})}
                    required
                  />
                </div>
              ))}
            </div>

            <div className="flex flex-wrap gap-2 items-center">
              <Button type="submit">Register Student</Button>
              <Button variant="outline" size="sm" onClick={() => fileInputRef.current?.click()}>
                <Upload className="inline-block mr-2 h-4 w-4" /> Upload CSV
              </Button>
              <Button variant="outline" size="sm" onClick={downloadTemplate}>
                <Download className="inline-block mr-2 h-4 w-4" /> CSV Template
              </Button>
              <Button variant="ghost" size="sm" onClick={() => {
                const el = document.getElementById("multiline-area"); if (el) el.style.display = el.style.display === "none" ? "block" : "none";
              }}>Paste Rows</Button>

              <input ref={fileInputRef} type="file" accept=".csv,text/csv" className="hidden" onChange={e => handleCsvFile(e.target.files?.[0] ?? null)} />
            </div>

            {/* Multiline input */}
            <div id="multiline-area" style={{display:"none"}} className="mt-4">
              <Label>Paste rows (name,grade,school_name,parent_name,contact_number)</Label>
              <Textarea value={multilineText} onChange={e => setMultilineText(e.target.value)} rows={5} placeholder="John Doe,6,ABC School,Robert Doe,9812345678" />
              <div className="flex gap-2 mt-2">
                <Button onClick={handleParseMultiline} disabled={parsing}>Parse & Preview</Button>
                <Button variant="outline" onClick={() => setMultilineText("")}>Clear</Button>
              </div>
            </div>
          </form>
        </CardContent>
      </Card>

      {/* Preview Dialog */}
      <Dialog open={showPreviewDialog} onOpenChange={setShowPreviewDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Preview Parsed Rows</DialogTitle>
            <DialogDescription>Review parsed rows before inserting. Invalid rows (if any) are listed below.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            {csvErrors.length>0 && (
              <div className="p-3 bg-red-50 rounded border border-red-100">
                <p className="font-semibold text-red-700">Errors:</p>
                <ul className="list-disc ml-6 text-sm text-red-700">{csvErrors.map((e,i)=><li key={i}>{e}</li>)}</ul>
              </div>
            )}
            <div className="overflow-x-auto max-h-64 overflow-y-auto border rounded">
              <table className="min-w-full">
                <thead className="bg-muted"><tr>
                  <th className="px-3 py-2 text-left">Name</th>
                  <th className="px-3 py-2 text-left">Grade</th>
                  <th className="px-3 py-2 text-left">School</th>
                  <th className="px-3 py-2 text-left">Parent</th>
                  <th className="px-3 py-2 text-left">Contact</th>
                </tr></thead>
                <tbody>{csvPreviewRows.map((r,i)=><tr key={i} className="border-t">
                  <td className="px-3 py-2">{r.name}</td>
                  <td className="px-3 py-2">{r.grade}</td>
                  <td className="px-3 py-2">{r.school_name}</td>
                  <td className="px-3 py-2">{r.parent_name}</td>
                  <td className="px-3 py-2">{r.contact_number}</td>
                </tr>)}</tbody>
              </table>
            </div>
            <div className="flex gap-2 justify-end">
              <Button variant="outline" onClick={()=>{setCsvPreviewRows([]); setShowPreviewDialog(false)}}>Cancel</Button>
              <Button onClick={handleBulkInsertConfirm} disabled={bulkInsertMutation.isLoading || csvPreviewRows.length===0}>
                {bulkInsertMutation.isLoading ? "Importing..." : `Import ${csvPreviewRows.length} rows`}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Registered Students Table */}
      <Card>
        <CardHeader>
          <CardTitle>Registered Students</CardTitle>
          <CardDescription>Manage your student records</CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? <p>Loading students...</p> :
            students && students.length>0 ? (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>Grade</TableHead>
                    <TableHead>School</TableHead>
                    <TableHead>Parent</TableHead>
                    <TableHead>Contact</TableHead>
                    <TableHead className="text-right" style={{minWidth:"200px"}}>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {students.map((student)=>(
                    <TableRow key={student.id}>
                      {editingId===student.id && editData ? <>
                        <TableCell><Input value={editData.name} onChange={e=>setEditData({...editData,name:e.target.value})} /></TableCell>
                        <TableCell><Input value={editData.grade} onChange={e=>setEditData({...editData,grade:e.target.value})} /></TableCell>
                        <TableCell><Input value={editData.school_name} onChange={e=>setEditData({...editData,school_name:e.target.value})} /></TableCell>
                        <TableCell><Input value={editData.parent_name} onChange={e=>setEditData({...editData,parent_name:e.target.value})} /></TableCell>
                        <TableCell><Input value={editData.contact_number} onChange={e=>setEditData({...editData,contact_number:e.target.value})} /></TableCell>
                        <TableCell className="flex gap-2 justify-end">
                          <Button onClick={handleSave} size="sm"><Save className="h-4 w-4 mr-1"/>Save</Button>
                          <Button variant="outline" onClick={handleCancel} size="sm"><X className="h-4 w-4 mr-1"/>Cancel</Button>
                        </TableCell>
                      </> : <>
                        <TableCell>{student.name}</TableCell>
                        <TableCell>{student.grade}</TableCell>
                        <TableCell>{student.school_name}</TableCell>
                        <TableCell>{student.parent_name}</TableCell>
                        <TableCell>{student.contact_number}</TableCell>
                        <TableCell className="flex gap-2 justify-end">
                          <Button variant="outline" size="sm" onClick={()=>handleEdit(student)}><Pencil className="h-4 w-4"/></Button>
                          <Button variant="destructive" size="sm" onClick={()=>deleteMutation.mutate(student.id)}><Trash2 className="h-4 w-4"/></Button>
                          <Button size="sm" onClick={()=>handleCreateParentAccount(student)}><UserPlus className="h-4 w-4"/></Button>
                        </TableCell>
                      </>}
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>) : <p>No students yet.</p>}
        </CardContent>
      </Card>

      {/* Parent creation dialog */}
      <Dialog open={isCreatingParent} onOpenChange={setIsCreatingParent}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create Parent Account</DialogTitle>
          </DialogHeader>
          <div className="space-y-2">
            <Label>Username</Label>
            <Input value={parentUsername} onChange={e=>setParentUsername(e.target.value)} />
            <Label>Password</Label>
            <Input type="password" value={parentPassword} onChange={e=>setParentPassword(e.target.value)} />
            <div className="flex gap-2 justify-end mt-2">
              <Button onClick={()=>createParentMutation.mutate()} disabled={createParentMutation.isLoading}>Create</Button>
              <Button variant="outline" onClick={()=>setIsCreatingParent(false)}>Cancel</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
