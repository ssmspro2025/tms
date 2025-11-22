import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { toast } from "sonner";
import {
  Pencil,
  Trash2,
  Save,
  X,
  UserPlus,
  Upload,
  Download,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

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
  const [selectedStudentForParent, setSelectedStudentForParent] =
    useState<Student | null>(null);
  const [parentUsername, setParentUsername] = useState("");
  const [parentPassword, setParentPassword] = useState("");

  const [csvPreviewRows, setCsvPreviewRows] = useState<StudentInput[]>([]);
  const [csvErrors, setCsvErrors] = useState<string[]>([]);
  const [multilineText, setMultilineText] = useState("");
  const [showPreviewDialog, setShowPreviewDialog] = useState(false);
  const [parsing, setParsing] = useState(false);

  // Fetch students
  const { data: students, isLoading } = useQuery({
    queryKey: ["students", user?.center_id],
    queryFn: async () => {
      let query = supabase.from("students").select("*").order("created_at", {
        ascending: false,
      });

      if (user?.role !== "admin" && user?.center_id) {
        query = query.eq("center_id", user.center_id);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data as Student[];
    },
  });

  // Single student create
  const createMutation = useMutation({
    mutationFn: async (student: typeof formData) => {
      const { error } = await supabase.from("students").insert([
        {
          ...student,
          center_id: user?.center_id,
        },
      ]);
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
      if (!selectedStudentForParent || !user?.center_id) {
        throw new Error("Student or Center ID not found.");
      }

      const { data, error } = await supabase.functions.invoke('create-parent-account', {
        body: {
          username: parentUsername,
          password: parentPassword,
          studentId: selectedStudentForParent.id,
          centerId: user.center_id,
        },
      });

      if (error) throw error;
      if (!data.success) throw new Error(data.error || 'Failed to create parent account via Edge Function');

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
    },
  });

  // Bulk insert
  const bulkInsertMutation = useMutation({
    mutationFn: async (rows: StudentInput[]) => {
      if (!rows.length) return;
      const rowsWithCenter = rows.map((r) => ({
        ...r,
        center_id: user?.center_id || null,
      }));
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

  // CSV Parsing
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
        if (ch === "\r" && csv[i + 1] === "\n") i++;
      } else {
        current += ch;
      }
    }
    if (current !== "" || row.length > 0) {
      row.push(current.trim());
      rows.push(row);
    }
    return rows;
  };

  const mapRowsToStudents = (rows: string[][]) => {
    const errors: string[] = [];
    if (!rows || rows.length === 0) return { rows: [], errors };
    const header = rows[0].map((h) => h.toLowerCase());
    let startIndex = 0;
    let hasHeader = false;
    const expectedFields = [
      "name",
      "grade",
      "school_name",
      "parent_name",
      "contact_number",
    ];
    const matchesHeader = expectedFields.every((f) => header.includes(f));
    if (matchesHeader) {
      hasHeader = true;
      startIndex = 1;
    }

    const output: StudentInput[] = [];
    for (let i = startIndex; i < rows.length; i++) {
      const cols = rows[i];
      let student: StudentInput;
      if (hasHeader) {
        const rowObj: any = {};
        for (let c = 0; c < header.length; c++) {
          const key = header[c];
          const val = cols[c] ?? "";
          rowObj[key] = val;
        }
        student = {
          name: (rowObj["name"] || "").trim(),
          grade: (rowObj["grade"] || "").trim(),
          school_name: (rowObj["school_name"] || rowObj["school"] || "").trim(),
          parent_name: (rowObj["parent_name"] || rowObj["parent"] || "").trim(),
          contact_number: (rowObj["contact_number"] || rowObj["contact"] || "").trim(),
        };
      } else {
        const [name = "", grade = "", school_name = "", parent_name = "", contact_number = ""] =
          cols;
        student = {
          name: name.trim(),
          grade: grade.trim(),
          school_name: school_name.trim(),
          parent_name: parent_name.trim(),
          contact_number: contact_number.trim(),
        };
      }
      const rowNumber = i + 1;
      const rowErrors: string[] = [];
      if (!student.name) rowErrors.push(`Row ${rowNumber}: name required`);
      if (!student.grade) rowErrors.push(`Row ${rowNumber}: grade required`);
      if (!student.contact_number) rowErrors.push(`Row ${rowNumber}: contact required`);
      if (rowErrors.length) errors.push(...rowErrors);
      else output.push(student);
    }

    // Deduplicate
    const unique: StudentInput[] = [];
    const seenContacts = new Set<string>();
    for (const s of output) {
      const key = s.contact_number || `${s.name}|${s.grade}`;
      if (!seenContacts.has(key)) {
        seenContacts.add(key);
        unique.push(s);
      } else {
        errors.push(`Duplicate in batch: ${key}`);
      }
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
      toast.error("Failed to read CSV file");
      setParsing(false);
    };
    reader.readAsText(file);
  };

  const handleParseMultiline = () => {
    if (!multilineText.trim()) {
      toast.error("No text to parse");
      return;
    }
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
      {/* Header */}
      <div>
        <h2 className="text-3xl font-bold tracking-tight">Register Student</h2>
        <p className="text-muted-foreground">Add new students to the attendance system</p>
      </div>

      {/* Single Student Form */}
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
                  onChange={(e) =>
                    setFormData({ ...formData, name: e.target.value })
                  }
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="grade">Grade *</Label>
                <Input
                  id="grade"
                  value={formData.grade}
                  onChange={(e) =>
                    setFormData({ ...formData, grade: e.target.value })
                  }
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="school_name">School Name *</Label>
                <Input
                  id="school_name"
                  value={formData.school_name}
                  onChange={(e) =>
                    setFormData({ ...formData, school_name: e.target.value })
                  }
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="parent_name">Parent Name *</Label>
                <Input
                  id="parent_name"
                  value={formData.parent_name}
                  onChange={(e) =>
                    setFormData({ ...formData, parent_name: e.target.value })
                  }
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="contact_number">Contact Number *</Label>
                <Input
                  id="contact_number"
                  value={formData.contact_number}
                  onChange={(e) =>
                    setFormData({ ...formData, contact_number: e.target.value })
                  }
                  required
                />
              </div>
            </div>

            {/* Actions */}
            <div className="flex flex-wrap gap-2 items-center mt-4">
              <Button type="submit">Register Student</Button>

              <input
                type="file"
                accept=".csv,text/csv"
                id="csv-upload"
                className="hidden"
                onChange={(e) => handleCsvFile(e.target.files?.[0] ?? null)}
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

              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  const el = document.getElementById("multiline-area");
                  if (el)
                    el.style.display =
                      el.style.display === "none" ? "block" : "none";
                }}
              >
                Paste Rows
              </Button>
            </div>

            {/* Multiline paste */}
            <div id="multiline-area" style={{ display: "none" }} className="mt-4">
              <Label>Paste rows: name, grade, school_name, parent_name, contact_number</Label>
              <Textarea
                value={multilineText}
                onChange={(e) => setMultilineText(e.target.value)}
                rows={5}
                placeholder="John Doe,6,ABC School,Robert Doe,9812345678"
              />
              <div className="flex gap-2 mt-2">
                <Button onClick={handleParseMultiline} disabled={parsing}>
                  Parse & Preview
                </Button>
                <Button
                  variant="outline"
                  onClick={() => setMultilineText("")}
                >
                  Clear
                </Button>
              </div>
            </div>
          </form>
        </CardContent>
      </Card>

      {/* CSV Preview Dialog */}
      <Dialog open={showPreviewDialog} onOpenChange={setShowPreviewDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Preview Parsed Rows</DialogTitle>
            <DialogDescription>
              Review parsed rows before inserting. Errors (if any) are below.
            </DialogDescription>
          </DialogHeader>

          {csvErrors.length > 0 && (
            <div className="p-3 bg-red-50 rounded border border-red-100 text-red-700 mb-4">
              {csvErrors.map((err, idx) => (
                <div key={idx}>{err}</div>
              ))}
            </div>
          )}

          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Grade</TableHead>
                <TableHead>School Name</TableHead>
                <TableHead>Parent Name</TableHead>
                <TableHead>Contact</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {csvPreviewRows.map((row, idx) => (
                <TableRow key={idx}>
                  <TableCell>{row.name}</TableCell>
                  <TableCell>{row.grade}</TableCell>
                  <TableCell>{row.school_name}</TableCell>
                  <TableCell>{row.parent_name}</TableCell>
                  <TableCell>{row.contact_number}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>

          <div className="flex justify-end gap-2 mt-4">
            <Button
              variant="outline"
              onClick={() => setShowPreviewDialog(false)}
            >
              Cancel
            </Button>
            <Button onClick={handleBulkInsertConfirm}>Insert All</Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Students Table */}
      <Card>
        <CardHeader>
          <CardTitle>Registered Students</CardTitle>
        </CardHeader>
        <CardContent className="overflow-x-auto">
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
              {isLoading ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center">
                    Loading...
                  </TableCell>
                </TableRow>
              ) : students && students.length > 0 ? (
                students.map((student) => (
                  <TableRow key={student.id}>
                    <TableCell>
                      {editingId === student.id ? (
                        <Input
                          value={editData?.name}
                          onChange={(e) =>
                            setEditData((prev) =>
                              prev ? { ...prev, name: e.target.value } : null
                            )
                          }
                        />
                      ) : (
                        student.name
                      )}
                    </TableCell>
                    <TableCell>
                      {editingId === student.id ? (
                        <Input
                          value={editData?.grade}
                          onChange={(e) =>
                            setEditData((prev) =>
                              prev ? { ...prev, grade: e.target.value } : null
                            )
                          }
                        />
                      ) : (
                        student.grade
                      )}
                    </TableCell>
                    <TableCell>
                      {editingId === student.id ? (
                        <Input
                          value={editData?.school_name}
                          onChange={(e) =>
                            setEditData((prev) =>
                              prev ? { ...prev, school_name: e.target.value } : null
                            )
                          }
                        />
                      ) : (
                        student.school_name
                      )}
                    </TableCell>
                    <TableCell>
                      {editingId === student.id ? (
                        <Input
                          value={editData?.parent_name}
                          onChange={(e) =>
                            setEditData((prev) =>
                              prev ? { ...prev, parent_name: e.target.value } : null
                            )
                          }
                        />
                      ) : (
                        student.parent_name
                      )}
                    </TableCell>
                    <TableCell>
                      {editingId === student.id ? (
                        <Input
                          value={editData?.contact_number}
                          onChange={(e) =>
                            setEditData((prev) =>
                              prev ? { ...prev, contact_number: e.target.value } : null
                            )
                          }
                        />
                      ) : (
                        student.contact_number
                      )}
                    </TableCell>
                    <TableCell className="flex gap-2">
                      {editingId === student.id ? (
                        <>
                          <Button size="icon" onClick={handleSave}>
                            <Save />
                          </Button>
                          <Button size="icon" onClick={handleCancel}>
                            <X />
                          </Button>
                        </>
                      ) : (
                        <>
                          <Button size="icon" onClick={() => handleEdit(student)}>
                            <Pencil />
                          </Button>
                          <Button
                            size="icon"
                            variant="destructive"
                            onClick={() => deleteMutation.mutate(student.id)}
                          >
                            <Trash2 />
                          </Button>
                          <Button
                            size="icon"
                            variant="secondary"
                            onClick={() => handleCreateParentAccount(student)}
                          >
                            <UserPlus />
                          </Button>
                        </>
                      )}
                    </TableCell>
                  </TableRow>
                ))
              ) : (
                <TableRow>
                  <TableCell colSpan={6} className="text-center">
                    No students registered yet
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Create Parent Dialog */}
      <Dialog open={isCreatingParent} onOpenChange={setIsCreatingParent}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create Parent Account</DialogTitle>
            <DialogDescription>
              Set a username and password for the parent of {selectedStudentForParent?.name}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 mt-4">
            <div className="space-y-2">
              <Label>Username</Label>
              <Input
                value={parentUsername}
                onChange={(e) => setParentUsername(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label>Password</Label>
              <Input
                value={parentPassword}
                type="password"
                onChange={(e) => setParentPassword(e.target.value)}
              />
            </div>
            <div className="flex justify-end gap-2 mt-4">
              <Button
                variant="outline"
                onClick={() => setIsCreatingParent(false)}
              >
                Cancel
              </Button>
              <Button onClick={() => createParentMutation.mutate()}>
                Create Account
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}