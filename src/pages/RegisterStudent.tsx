import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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

  // Students query (center-aware)
  const { data: students, isLoading } = useQuery({
    queryKey: ["students", user?.center_id],
    queryFn: async () => {
      let query = supabase
        .from("students")
        .select("*")
        .order("created_at", { ascending: false });

      // Filter by center_id if user is not admin
      if (user?.role !== "admin" && user?.center_id) {
        query = query.eq("center_id", user.center_id);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data as Student[];
    },
  });

  // Single-create
  const createMutation = useMutation({
    mutationFn: async (student: typeof formData) => {
      const { error } = await supabase.from("students").insert([{
        ...student,
        center_id: user?.center_id
      }]);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["students", user?.center_id] });
      setFormData({
        name: "",
        grade: "",
        school_name: "",
        parent_name: "",
        contact_number: "",
      });
      toast.success("Student registered successfully!");
    },
    onError: () => {
      toast.error("Failed to register student");
    },
  });

  // Update
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
    onError: () => {
      toast.error("Failed to update student");
    },
  });

  // Delete
  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("students").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["students", user?.center_id] });
      toast.success("Student deleted successfully!");
    },
    onError: () => {
      toast.error("Failed to delete student");
    },
  });

  // Create parent account
  const createParentMutation = useMutation({
    mutationFn: async () => {
      if (!selectedStudentForParent) return;

      const { data, error } = await supabase.functions.invoke('create-parent-account', {
        body: {
          username: parentUsername,
          password: parentPassword,
          studentId: selectedStudentForParent.id,
          centerId: user?.center_id
        }
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
    onError: (error: any) => {
      toast.error(error.message || "Failed to create parent account");
    }
  });

  // Bulk insert mutation
  const bulkInsertMutation = useMutation({
    mutationFn: async (rows: StudentInput[]) => {
      if (!rows.length) return;
      // Attach center_id to each row
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
    onError: (error: any) => {
      toast.error(error.message || "Bulk insert failed");
    },
  });

  // Helpers: basic CSV parser (handles simple commas and quoted fields)
  const parseCSV = (csv: string): string[][] => {
    const rows: string[][] = [];
    let current = "";
    let row: string[] = [];
    let inQuotes = false;
    for (let i = 0; i < csv.length; i++) {
      const ch = csv[i];
      const nxt = csv[i + 1];
      if (ch === '"' ) {
        if (inQuotes && nxt === '"') {
          current += '"'; // escaped quote
          i++; // skip next
        } else {
          inQuotes = !inQuotes;
        }
      } else if (ch === "," && !inQuotes) {
        row.push(current.trim());
        current = "";
      } else if ((ch === "\n" || ch === "\r") && !inQuotes) {
        if (current !== "" || row.length > 0) {
          row.push(current.trim());
          rows.push(row);
          row = [];
          current = "";
        }
        // handle \r\n by skipping the next char if it's \n
        if (ch === "\r" && csv[i + 1] === "\n") i++;
      } else {
        current += ch;
      }
    }
    // last value
    if (current !== "" || row.length > 0) {
      row.push(current.trim());
      rows.push(row);
    }
    return rows;
  };

  // Map parsed rows to StudentInput with header handling
  const mapRowsToStudents = (rows: string[][]): { rows: StudentInput[]; errors: string[] } => {
    const errors: string[] = [];
    if (!rows || rows.length === 0) return { rows: [], errors };
    // Detect header: look for known header names in first row
    const header = rows[0].map(h => h.toLowerCase());
    let startIndex = 0;
    let hasHeader = false;
    const expectedFields = ["name", "grade", "school_name", "parent_name", "contact_number"];
    const matchesHeader = expectedFields.every(f => header.includes(f));
    if (matchesHeader) {
      hasHeader = true;
      startIndex = 1;
    } else {
      // If first row length equals 5 and none are clearly headers, assume no header
      if (rows[0].length === 5) {
        hasHeader = false;
        startIndex = 0;
      } else {
        // Ambiguous: assume header missing but try to continue and validate below
        startIndex = 0;
      }
    }

    const output: StudentInput[] = [];
    for (let i = startIndex; i < rows.length; i++) {
      const cols = rows[i];
      // if header present, map by header names
      if (hasHeader) {
        const rowObj: any = {};
        for (let c = 0; c < header.length; c++) {
          const key = header[c];
          const val = cols[c] ?? "";
          rowObj[key] = val;
        }
        const student: StudentInput = {
          name: (rowObj["name"] || "").trim(),
          grade: (rowObj["grade"] || "").trim(),
          school_name: (rowObj["school_name"] || rowObj["school"] || "").trim(),
          parent_name: (rowObj["parent_name"] || rowObj["parent"] || "").trim(),
          contact_number: (rowObj["contact_number"] || rowObj["contact"] || "").trim(),
        };
        // validate
        const rowNumber = i + 1;
        const rowErrors: string[] = [];
        if (!student.name) rowErrors.push(`Row ${rowNumber}: name is required`);
        if (!student.grade) rowErrors.push(`Row ${rowNumber}: grade is required`);
        if (!student.contact_number) rowErrors.push(`Row ${rowNumber}: contact_number is required`);
        if (rowErrors.length) errors.push(...rowErrors);
        else output.push(student);
      } else {
        // assume order: name, grade, school_name, parent_name, contact_number
        const [name = "", grade = "", school_name = "", parent_name = "", contact_number = ""] = cols;
        const student: StudentInput = {
          name: name.trim(),
          grade: grade.trim(),
          school_name: school_name.trim(),
          parent_name: parent_name.trim(),
          contact_number: contact_number.trim(),
        };
        const rowNumber = i + 1;
        const rowErrors: string[] = [];
        if (!student.name) rowErrors.push(`Row ${rowNumber}: name is required`);
        if (!student.grade) rowErrors.push(`Row ${rowNumber}: grade is required`);
        if (!student.contact_number) rowErrors.push(`Row ${rowNumber}: contact_number is required`);
        if (rowErrors.length) errors.push(...rowErrors);
        else output.push(student);
      }
    }

    // Deduplicate by contact_number within the batch
    const unique: StudentInput[] = [];
    const seenContacts = new Set<string>();
    for (const s of output) {
      const key = s.contact_number || `${s.name}|${s.grade}`;
      if (seenContacts.has(key)) {
        errors.push(`Duplicate in batch: ${key}`);
      } else {
        seenContacts.add(key);
        unique.push(s);
      }
    }

    return { rows: unique, errors };
  };

  // Handle CSV file input
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
    reader.onerror = (err) => {
      toast.error("Failed to read file");
      setParsing(false);
    };
    reader.readAsText(file);
  };

  // Handle multiline paste (expect rows separated by newline, columns by comma or pipe)
  const handleParseMultiline = () => {
    if (!multilineText.trim()) {
      toast.error("No text to parse");
      return;
    }
    setParsing(true);
    // Normalize pipes to commas, then reuse CSV parser
    const normalized = multilineText.replace(/\|/g, ",");
    const parsed = parseCSV(normalized);
    const { rows, errors } = mapRowsToStudents(parsed);
    setCsvPreviewRows(rows);
    setCsvErrors(errors);
    setShowPreviewDialog(true);
    setParsing(false);
  };

  // Download CSV template
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
    if (!csvPreviewRows.length) {
      toast.error("No rows to insert");
      return;
    }
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
    if (editData) {
      updateMutation.mutate(editData);
    }
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
      <div>
        <h2 className="text-3xl font-bold tracking-tight">Register Student</h2>
        <p className="text-muted-foreground">Add new students to the attendance system</p>
      </div>

      {/* Existing single-student form */}
      <Card>
        <CardHeader>
          <CardTitle>Student Information</CardTitle>
          <CardDescription>Fill in the details to register a new student</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="name">Full Name *</Label>
                <Input
                  id="name"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="grade">Grade *</Label>
                <Input
                  id="grade"
                  value={formData.grade}
                  onChange={(e) => setFormData({ ...formData, grade: e.target.value })}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="school_name">School Name *</Label>
                <Input
                  id="school_name"
                  value={formData.school_name}
                  onChange={(e) => setFormData({ ...formData, school_name: e.target.value })}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="parent_name">Parent's Name *</Label>
                <Input
                  id="parent_name"
                  value={formData.parent_name}
                  onChange={(e) => setFormData({ ...formData, parent_name: e.target.value })}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="contact_number">Contact Number *</Label>
                <Input
                  id="contact_number"
                  value={formData.contact_number}
                  onChange={(e) => setFormData({ ...formData, contact_number: e.target.value })}
                  required
                />
              </div>
            </div>
            <div className="flex flex-wrap gap-2 items-center">
              <Button type="submit" className="w-full md:w-auto">
                Register Student
              </Button>

              {/* CSV & Multiline UI */}
              <div className="flex items-center gap-2">
                <input
                  id="csv-upload"
                  type="file"
                  accept=".csv,text/csv"
                  onChange={(e) => handleCsvFile(e.target.files?.[0] ?? null)}
                  className="hidden"
                />
                <label htmlFor="csv-upload">
                  <Button variant="outline" size="sm" asChild>
                    <span>
                      <Upload className="inline-block mr-2 h-4 w-4" />
                      Upload CSV
                    </span>
                  </Button>
                </label>

                <Button variant="outline" size="sm" onClick={downloadTemplate}>
                  <Download className="inline-block mr-2 h-4 w-4" />
                  CSV Template
                </Button>

                <Button variant="ghost" size="sm" onClick={() => {
                  // toggle a simple textarea area for multiline input
                  const el = document.getElementById("multiline-area");
                  if (el) {
                    (el as HTMLElement).style.display = (el as HTMLElement).style.display === "none" ? "block" : "none";
                  }
                }}>
                  Paste Rows
                </Button>
              </div>
            </div>
          </form>

          {/* Multiline paste area (hidden by default) */}
          <div id="multiline-area" style={{ display: "none" }} className="mt-4">
            <Label>Paste rows (one student per line). Columns: name, grade, school_name, parent_name, contact_number</Label>
            <Textarea
              value={multilineText}
              onChange={(e) => setMultilineText(e.target.value)}
              placeholder="John Doe,6,ABC School,Robert Doe,9812345678"
              rows={5}
            />
            <div className="flex gap-2 mt-2">
              <Button onClick={handleParseMultiline} disabled={parsing}>
                Parse & Preview
              </Button>
              <Button variant="outline" onClick={() => { setMultilineText(""); }}>
                Clear
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Preview dialog (simple inline preview) */}
      <Dialog open={showPreviewDialog} onOpenChange={setShowPreviewDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Preview Parsed Rows</DialogTitle>
            <DialogDescription>Review parsed rows before inserting. Invalid rows (if any) are listed below.</DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            {csvErrors.length > 0 && (
              <div className="p-3 bg-red-50 rounded border border-red-100">
                <p className="font-semibold text-red-700">Errors:</p>
                <ul className="list-disc ml-6 text-sm text-red-700">
                  {csvErrors.map((err, idx) => <li key={idx}>{err}</li>)}
                </ul>
              </div>
            )}

            <div className="overflow-x-auto max-h-64 overflow-y-auto border rounded">
              <table className="min-w-full">
                <thead className="bg-muted">
                  <tr>
                    <th className="px-3 py-2 text-left">Name</th>
                    <th className="px-3 py-2 text-left">Grade</th>
                    <th className="px-3 py-2 text-left">School</th>
                    <th className="px-3 py-2 text-left">Parent</th>
                    <th className="px-3 py-2 text-left">Contact</th>
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

            <div className="flex gap-2 justify-end">
              <Button variant="outline" onClick={() => { setCsvPreviewRows([]); setShowPreviewDialog(false); }}>
                Cancel
              </Button>
              <Button onClick={handleBulkInsertConfirm} disabled={bulkInsertMutation.isLoading || csvPreviewRows.length === 0}>
                {bulkInsertMutation.isLoading ? 'Importing...' : `Import ${csvPreviewRows.length} rows`}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Registered Students Table (unchanged) */}
      <Card>
        <CardHeader>
          <CardTitle>Registered Students</CardTitle>
          <CardDescription>Manage your student records</CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <p>Loading students...</p>
          ) : students && students.length > 0 ? (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>Grade</TableHead>
                    <TableHead>School</TableHead>
                    <TableHead>Parent</TableHead>
                    <TableHead>Contact</TableHead>
                    <TableHead className="text-right" style={{ minWidth: '200px' }}>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {students.map((student) => (
                    <TableRow key={student.id}>
                      {editingId === student.id && editData ? (
                        <>
                          <TableCell>
                            <Input
                              value={editData.name}
                              onChange={(e) => setEditData({ ...editData, name: e.target.value })}
                            />
                          </TableCell>
                          <TableCell>
                            <Input
                              value={editData.grade}
                              onChange={(e) => setEditData({ ...editData, grade: e.target.value })}
                            />
                          </TableCell>
                          <TableCell>
                            <Input
                              value={editData.school_name}
                              onChange={(e) =>
                                setEditData({ ...editData, school_name: e.target.value })
                              }
                            />
                          </TableCell>
                          <TableCell>
                            <Input
                              value={editData.parent_name}
                              onChange={(e) =>
                                setEditData({ ...editData, parent_name: e.target.value })
                              }
                            />
                          </TableCell>
                          <TableCell>
                            <Input
                              value={editData.contact_number}
                              onChange={(e) =>
                                setEditData({ ...editData, contact_number: e.target.value })
                              }
                            />
                          </TableCell>
                          <TableCell className="text-right">
                            <div className="flex justify-end gap-2">
                              <Button size="sm" onClick={handleSave}>
                                <Save className="h-4 w-4" />
                              </Button>
                              <Button size="sm" variant="outline" onClick={handleCancel}>
                                <X className="h-4 w-4" />
                              </Button>
                            </div>
                          </TableCell>
                        </>
                      ) : (
                        <>
                          <TableCell className="font-medium">{student.name}</TableCell>
                          <TableCell>{student.grade}</TableCell>
                          <TableCell>{student.school_name}</TableCell>
                          <TableCell>{student.parent_name}</TableCell>
                          <TableCell>{student.contact_number}</TableCell>
                          <TableCell className="text-right">
                            <div className="flex justify-end gap-2">
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => handleEdit(student)}
                                title="Edit student"
                              >
                                <Pencil className="h-4 w-4" />
                              </Button>
                              <Button
                                size="sm"
                                variant="secondary"
                                onClick={() => handleCreateParentAccount(student)}
                                title="Create parent login"
                              >
                                <UserPlus className="h-4 w-4" />
                              </Button>
                              <Button
                                size="sm"
                                variant="destructive"
                                onClick={() => deleteMutation.mutate(student.id)}
                                title="Delete student"
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </div>
                          </TableCell>
                        </>
                      )}
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          ) : (
            <p className="text-center text-muted-foreground">No students registered yet</p>
          )}
        </CardContent>
      </Card>

      {/* Parent Account Creation Dialog (unchanged) */}
      <Dialog open={isCreatingParent} onOpenChange={setIsCreatingParent}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create Parent Login</DialogTitle>
            <DialogDescription>
              Create login credentials for {selectedStudentForParent?.name}'s parent
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="parent-username">Username (Email or Phone) *</Label>
              <Input
                id="parent-username"
                value={parentUsername}
                onChange={(e) => setParentUsername(e.target.value)}
                placeholder="parent@email.com or 9841234567"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="parent-password">Temporary Password *</Label>
              <Input
                id="parent-password"
                type="password"
                value={parentPassword}
                onChange={(e) => setParentPassword(e.target.value)}
                placeholder="Enter temporary password"
              />
            </div>
            <Button 
              onClick={() => createParentMutation.mutate()} 
              disabled={!parentUsername || !parentPassword || createParentMutation.isPending}
              className="w-full"
            >
              {createParentMutation.isPending ? 'Creating...' : 'Create Parent Account'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
