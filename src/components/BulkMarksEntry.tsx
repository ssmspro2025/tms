import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Upload, Download } from "lucide-react";
import Papa from "papaparse";

interface Student {
  id: string;
  name: string;
  grade: string;
}

interface BulkMarks {
  studentId: string;
  studentName: string;
  marks: string;
}

interface BulkMarksEntryProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  students: Student[];
  testId: string;
  totalMarks: number;
  onSave: (marks: Array<{ studentId: string; marks: number }>) => void;
}

export default function BulkMarksEntry({
  open,
  onOpenChange,
  students,
  testId,
  totalMarks,
  onSave,
}: BulkMarksEntryProps) {
  const [bulkMarks, setBulkMarks] = useState<BulkMarks[]>(
    students.map((s) => ({
      studentId: s.id,
      studentName: s.name,
      marks: "",
    }))
  );

  const handleMarksChange = (studentId: string, value: string) => {
    setBulkMarks((prev) =>
      prev.map((m) =>
        m.studentId === studentId ? { ...m, marks: value } : m
      )
    );
  };

  const handleCSVUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    Papa.parse(file, {
      header: true,
      complete: (results) => {
        const data = results.data as Array<{ student_id?: string; student_name?: string; marks?: string }>;
        const updatedMarks = [...bulkMarks];

        data.forEach((row) => {
          const studentId = row.student_id;
          const marks = row.marks;

          if (studentId && marks) {
            const index = updatedMarks.findIndex((m) => m.studentId === studentId);
            if (index !== -1) {
              updatedMarks[index].marks = marks;
            }
          }
        });

        setBulkMarks(updatedMarks);
        toast.success("CSV imported successfully");
      },
      error: () => {
        toast.error("Failed to parse CSV");
      },
    });
  };

  const downloadTemplate = () => {
    const csv = Papa.unparse(
      students.map((s) => ({
        student_id: s.id,
        student_name: s.name,
        marks: "",
      }))
    );

    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "marks_template.csv";
    a.click();
  };

  const handleSave = () => {
    const marksData: Array<{ studentId: string; marks: number }> = [];
    let hasError = false;

    bulkMarks.forEach((m) => {
      if (m.marks.trim()) {
        const marks = parseInt(m.marks);
        if (isNaN(marks) || marks < 0 || marks > totalMarks) {
          toast.error(`Invalid marks for ${m.studentName}: must be between 0 and ${totalMarks}`);
          hasError = true;
        } else {
          marksData.push({ studentId: m.studentId, marks });
        }
      }
    });

    if (hasError) return;

    if (marksData.length === 0) {
      toast.error("Please enter marks for at least one student");
      return;
    }

    onSave(marksData);
    setBulkMarks(students.map((s) => ({ studentId: s.id, studentName: s.name, marks: "" })));
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Bulk Marks Entry</DialogTitle>
          <DialogDescription>
            Enter marks for multiple students or upload a CSV.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="flex gap-2">
            <Button onClick={downloadTemplate} variant="outline" size="sm">
              <Download className="mr-2 h-4 w-4" />
              Download CSV Template
            </Button>
            <Label htmlFor="csv-upload" className="cursor-pointer">
              <Button variant="outline" size="sm" asChild>
                <span>
                  <Upload className="mr-2 h-4 w-4" />
                  Upload CSV
                </span>
              </Button>
            </Label>
            <Input
              id="csv-upload"
              type="file"
              accept=".csv"
              onChange={handleCSVUpload}
              className="hidden"
            />
          </div>

          <div className="border rounded-lg overflow-hidden">
            <table className="w-full">
              <thead className="bg-muted">
                <tr>
                  <th className="px-4 py-2 text-left">Student Name</th>
                  <th className="px-4 py-2 text-left">Grade</th>
                  <th className="px-4 py-2 text-right">Marks (out of {totalMarks})</th>
                </tr>
              </thead>
              <tbody>
                {bulkMarks.map((m, idx) => {
                  const student = students.find((s) => s.id === m.studentId);
                  return (
                    <tr key={m.studentId} className="border-t">
                      <td className="px-4 py-2">{m.studentName}</td>
                      <td className="px-4 py-2">{student?.grade}</td>
                      <td className="px-4 py-2">
                        <Input
                          type="number"
                          min="0"
                          max={totalMarks}
                          value={m.marks}
                          onChange={(e) => handleMarksChange(m.studentId, e.target.value)}
                          placeholder="0"
                          className="text-right"
                        />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <Button onClick={handleSave} className="w-full">
            Save Marks for {bulkMarks.filter((m) => m.marks.trim()).length} Students
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}