import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { toast } from "sonner";
import { format } from "date-fns";
import { CheckCircle, Clock, XCircle } from "lucide-react";

const StudentLessonRecords = () => {
  const { user } = useAuth();
  const [selectedStudent, setSelectedStudent] = useState<string>("__all__");
  const [selectedLesson, setSelectedLesson] = useState<string>("__all__");

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

  // Fetch lesson plans
  const { data: lessonPlans = [] } = useQuery({
    queryKey: ["lesson-plans-active", user?.center_id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("lesson_plans")
        .select("*")
        .eq("center_id", user?.center_id!)
        .eq("is_active", true)
        .order("lesson_date", { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: !!user?.center_id
  });

  // Fetch student lesson records
  const { data: records = [], refetch } = useQuery({
    queryKey: ["student-lesson-records", selectedStudent, selectedLesson],
    queryFn: async () => {
      // Don't fetch if we're showing "all" for both filters
      if (selectedStudent === "__all__" && selectedLesson === "__all__") return [];
      
      let query = supabase
        .from("student_lesson_records")
        .select("*, students(name), lesson_plans(subject, chapter, topic)")
        .order("taught_date", { ascending: false });

      if (selectedStudent !== "__all__") {
        query = query.eq("student_id", selectedStudent);
      }

      if (selectedLesson !== "__all__") {
        query = query.eq("lesson_plan_id", selectedLesson);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data;
    },
    enabled: !!user?.center_id
  });

  const getCompletionStatusIcon = (status: string) => {
    switch (status) {
      case "completed":
        return <CheckCircle className="h-4 w-4 text-green-600" />;
      case "in_progress":
        return <Clock className="h-4 w-4 text-yellow-600" />;
      case "not_started":
        return <XCircle className="h-4 w-4 text-red-600" />;
      default:
        return <Clock className="h-4 w-4 text-gray-600" />;
    }
  };

  const getCompletionStatusColor = (status: string) => {
    switch (status) {
      case "completed": return "text-green-600";
      case "in_progress": return "text-yellow-600";
      case "not_started": return "text-red-600";
      default: return "text-gray-600";
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Student Lesson Records</h1>
        <p className="text-muted-foreground">Track student progress through lesson plans</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Filters</CardTitle>
        </CardHeader>
        <CardContent className="flex gap-4">
          <div className="flex-1">
            <label className="text-sm font-medium">Student</label>
            <Select value={selectedStudent} onValueChange={setSelectedStudent}>
              <SelectTrigger>
                <SelectValue placeholder="Select student" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__all__">All Students</SelectItem>
                {students.map((student: any) => (
                  <SelectItem key={student.id} value={student.id}>
                    {student.name} - {student.grade}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex-1">
            <label className="text-sm font-medium">Lesson Plan</label>
            <Select value={selectedLesson} onValueChange={setSelectedLesson}>
              <SelectTrigger>
                <SelectValue placeholder="Select lesson plan" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__all__">All Lesson Plans</SelectItem>
                {lessonPlans.map((lesson: any) => (
                  <SelectItem key={lesson.id} value={lesson.id}>
                    {lesson.subject} - {lesson.chapter} - {lesson.topic}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <Button onClick={() => refetch()} className="self-end">
            Apply Filters
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Lesson Records</CardTitle>
        </CardHeader>
        <CardContent>
          {records.length === 0 ? (
            <p className="text-muted-foreground text-center py-8">No lesson records found</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Student</TableHead>
                  <TableHead>Lesson</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Remarks</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {records.map((record: any) => (
                  <TableRow key={record.id}>
                    <TableCell className="font-medium">{record.students?.name || "-"}</TableCell>
                    <TableCell>
                      <div>
                        <div className="font-medium">{record.lesson_plans?.subject || "-"}</div>
                        <div className="text-sm text-muted-foreground">
                          {record.lesson_plans?.chapter || "-"} - {record.lesson_plans?.topic || "-"}
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>{format(new Date(record.taught_date), "PPP")}</TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        {getCompletionStatusIcon(record.completion_status || "not_started")}
                        <span className={getCompletionStatusColor(record.completion_status || "not_started")}>
                          {record.completion_status ? record.completion_status.replace("_", " ").toUpperCase() : "NOT STARTED"}
                        </span>
                      </div>
                    </TableCell>
                    <TableCell>{record.teacher_remarks || "-"}</TableCell>
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

export default StudentLessonRecords;