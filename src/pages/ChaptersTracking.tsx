import { useState, useEffect, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { toast } from "sonner";
import { Trash2, Users, Plus, ChevronDown, ChevronUp, BookOpen } from "lucide-react";
import { format } from "date-fns";

export default function ChaptersTracking() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  // State
  const [selectedStudentIds, setSelectedStudentIds] = useState<string[]>([]);
  const [date, setDate] = useState(format(new Date(), "yyyy-MM-dd"));
  const [selectedLessonPlanId, setSelectedLessonPlanId] = useState<string>("");
  const [notes, setNotes] = useState("");
  const [filterSubject, setFilterSubject] = useState("all");
  const [filterStudent, setFilterStudent] = useState("all");
  const [filterGrade, setFilterGrade] = useState("all");
  const [isDialogOpen, setIsDialogOpen] = useState(false);

  // Track which chapters have students shown
  const [showStudentsMap, setShowStudentsMap] = useState<{ [chapterId: string]: boolean }>({});

  // Fetch students
  const { data: students = [] } = useQuery({
    queryKey: ["students", user?.center_id],
    queryFn: async () => {
      let query = supabase.from("students").select("*").order("name");
      if (user?.role !== "admin" && user?.center_id) {
        query = query.eq("center_id", user.center_id);
      }
      const { data, error } = await query;
      if (error) throw error;
      return data || [];
    },
  });

  // Fetch lesson plans for dropdown
  const { data: lessonPlans = [] } = useQuery({
    queryKey: ["lesson-plans-active", user?.center_id],
    queryFn: async () => {
      let query = supabase
        .from("lesson_plans")
        .select("*")
        .eq("is_active", true)
        .order("subject")
        .order("chapter")
        .order("topic");

      if (user?.role !== "admin" && user?.center_id) {
        query = query.eq("center_id", user.center_id);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data || [];
    },
    enabled: !!user,
  });

  // Filter lesson plans by subject if needed
  const filteredLessonPlans = useMemo(() => {
    if (filterSubject === "all") return lessonPlans;
    return lessonPlans.filter((lp: any) => lp.subject === filterSubject);
  }, [lessonPlans, filterSubject]);

  // Fetch chapters for listing (with student_chapters)
  const { data: chapters = [] } = useQuery({
    queryKey: ["chapters", filterSubject, filterStudent, filterGrade, user?.center_id],
    queryFn: async () => {
      let query = supabase
        .from("student_lesson_records")
        .select("*, students(name, grade, center_id), lesson_plans(subject, chapter, topic)")
        .order("taught_date", { ascending: false });

      if (user?.role !== "admin" && user?.center_id) {
        query = query.eq("students.center_id", user.center_id);
      }

      if (filterSubject !== "all") {
        query = query.eq("lesson_plans.subject", filterSubject);
      }

      const { data, error } = await query;
      if (error) throw error;

      return data;
    },
    enabled: !!user,
  });

  // Fetch attendance for auto-selecting present students
  const { data: attendanceForDate = [] } = useQuery({
    queryKey: ["attendance-by-date", date, user?.center_id],
    queryFn: async () => {
      const studentIds = students.map((s: any) => s.id);
      if (!studentIds.length) return [];
      const { data, error } = await supabase
        .from("attendance")
        .select("*")
        .in("student_id", studentIds)
        .eq("date", date);
      if (error) throw error;
      return data || [];
    },
    enabled: students.length > 0 && !!date,
  });

  // Mutations
  const addChapterMutation = useMutation({
    mutationFn: async () => {
      if (!selectedLessonPlanId) {
        throw new Error("Please select a lesson plan");
      }

      // Get the selected lesson plan
      const selectedLessonPlan = lessonPlans.find((lp: any) => lp.id === selectedLessonPlanId);
      if (!selectedLessonPlan) {
        throw new Error("Lesson plan not found");
      }

      // Create student lesson records for selected students
      const studentLessonRecords = selectedStudentIds.map((studentId) => ({
        student_id: studentId,
        lesson_plan_id: selectedLessonPlanId,
        taught_date: date,
        completion_status: "completed",
        teacher_remarks: notes || null,
      }));

      if (studentLessonRecords.length === 0) {
        throw new Error("Please select at least one student");
      }

      const { error } = await supabase.from("student_lesson_records").insert(studentLessonRecords);
      if (error) throw error;

      return true;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["chapters"] });
      toast.success("Lesson plan recorded for selected students");
      setSelectedStudentIds([]);
      setSelectedLessonPlanId("");
      setNotes("");
      setIsDialogOpen(false);
    },
    onError: (error: any) => {
      toast.error(error.message || "Failed to record lesson plan");
    },
  });

  const deleteChapterMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("student_lesson_records").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["chapters"] });
      toast.success("Record deleted successfully");
    },
    onError: () => {
      toast.error("Failed to delete record");
    },
  });

  // Helpers
  const toggleStudentSelection = (studentId: string) => {
    setSelectedStudentIds((prev) =>
      prev.includes(studentId) ? prev.filter((id) => id !== studentId) : [...prev, studentId]
    );
  };

  const filteredStudentsForModal = useMemo(() => {
    return (students || []).filter((s: any) => (filterGrade === "all" ? true : s.grade === filterGrade));
  }, [students, filterGrade]);

  const selectAllStudents = () => {
    setSelectedStudentIds(filteredStudentsForModal.map((s: any) => s.id));
  };

  const presentStudentIdsForDate: string[] = useMemo(() => {
    return (attendanceForDate || [])
      .filter((a: any) => a.status === "Present")
      .map((a: any) => a.student_id);
  }, [attendanceForDate]);

  useEffect(() => {
    if (!students) return;
    const currentFilteredIds = filteredStudentsForModal.map((s: any) => s.id);
    const autoSelect = presentStudentIdsForDate.filter((id) => currentFilteredIds.includes(id));
    setSelectedStudentIds(autoSelect);
  }, [filterGrade, date, attendanceForDate, students, filteredStudentsForModal]);

  const subjects = Array.from(new Set(lessonPlans.map((c: any) => c.subject).filter(Boolean)));

  const toggleShowStudents = (recordId: string) => {
    setShowStudentsMap((prev) => ({ ...prev, [recordId]: !prev[recordId] }));
  };

  return (
    <div className="space-y-6">
      {/* HEADER + MODAL */}
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold">Chapters Studied</h1>
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button><Plus className="h-4 w-4 mr-2" /> Record Chapter</Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Record Chapter Studied</DialogTitle>
              <DialogDescription>Select a lesson plan and students who studied it</DialogDescription>
            </DialogHeader>

            <div className="space-y-4 py-4">
              {/* DATE */}
              <div>
                <Label>Date</Label>
                <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
              </div>

              {/* LESSON PLAN */}
              <div className="space-y-2">
                <Label>Select Lesson Plan *</Label>
                <Select value={selectedLessonPlanId} onValueChange={setSelectedLessonPlanId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Choose a lesson plan..." />
                  </SelectTrigger>
                  <SelectContent>
                    {filteredLessonPlans.map((lesson: any) => (
                      <SelectItem key={lesson.id} value={lesson.id}>
                        <div className="flex flex-col">
                          <span className="font-medium">{lesson.subject} - {lesson.chapter}</span>
                          <span className="text-sm text-muted-foreground">{lesson.topic}</span>
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {selectedLessonPlanId && (
                  <div className="mt-2 p-3 bg-muted rounded-lg">
                    <h4 className="font-medium">
                      {lessonPlans.find((lp: any) => lp.id === selectedLessonPlanId)?.subject} - {
                        lessonPlans.find((lp: any) => lp.id === selectedLessonPlanId)?.chapter
                      }
                    </h4>
                    <p className="text-sm text-muted-foreground">
                      {lessonPlans.find((lp: any) => lp.id === selectedLessonPlanId)?.topic}
                    </p>
                  </div>
                )}
              </div>

              {/* NOTES */}
              <div>
                <Label>Notes (Optional)</Label>
                <Textarea 
                  value={notes} 
                  onChange={(e) => setNotes(e.target.value)} 
                  rows={2} 
                  placeholder="Add any notes about this session..."
                />
              </div>

              {/* STUDENTS */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <Label className="flex items-center gap-2">
                    <Users className="h-4 w-4" /> Students ({selectedStudentIds.length} selected)
                  </Label>
                  <div className="flex gap-2">
                    <Button type="button" variant="outline" size="sm" onClick={selectAllStudents}>
                      Select All
                    </Button>
                    <Button 
                      type="button" 
                      variant="ghost" 
                      size="sm" 
                      onClick={() => setSelectedStudentIds([])}
                    >
                      Clear
                    </Button>
                  </div>
                </div>

                {/* Grade Filter */}
                <div className="mt-2">
                  <Label>Filter by Grade</Label>
                  <Select value={filterGrade} onValueChange={setFilterGrade}>
                    <SelectTrigger>
                      <SelectValue placeholder="All Grades" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Grades</SelectItem>
                      {Array.from(new Set(students.map((s: any) => s.grade))).map((g) => (
                        <SelectItem key={g} value={g}>{g}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* Student List */}
                <div className="border rounded-lg p-3 max-h-48 overflow-y-auto space-y-2">
                  {filteredStudentsForModal.map((student: any) => {
                    const isPresent = presentStudentIdsForDate.includes(student.id);
                    return (
                      <div 
                        key={student.id} 
                        className={`flex items-center space-x-2 p-2 rounded ${isPresent ? "bg-green-50" : ""}`}
                      >
                        <Checkbox
                          id={student.id}
                          checked={selectedStudentIds.includes(student.id)}
                          onCheckedChange={() => toggleStudentSelection(student.id)}
                        />
                        <label htmlFor={student.id} className="text-sm font-medium cursor-pointer">
                          {student.name} - Grade {student.grade}
                        </label>
                        {isPresent && <span className="ml-auto text-xs text-green-700">Present</span>}
                      </div>
                    );
                  })}
                  {filteredStudentsForModal.length === 0 && (
                    <p className="text-sm text-muted-foreground">No students found for selected grade.</p>
                  )}
                </div>
              </div>

              {/* RECORD BUTTON */}
              <Button
                onClick={() => addChapterMutation.mutate()}
                disabled={selectedStudentIds.length === 0 || !selectedLessonPlanId || addChapterMutation.isPending}
                className="w-full"
              >
                {addChapterMutation.isPending ? "Recording..." : `Record for ${selectedStudentIds.length} Student(s)`}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {/* CHAPTERS LIST */}
      <Card>
        <CardHeader>
          <CardTitle>Chapters Taught</CardTitle>
          <div className="flex gap-4 mt-4">
            {/* Filters */}
            <div className="flex-1">
              <Label>Filter by Subject</Label>
              <Select value={filterSubject} onValueChange={setFilterSubject}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Subjects</SelectItem>
                  {subjects.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="flex-1">
              <Label>Filter by Student</Label>
              <Select value={filterStudent} onValueChange={setFilterStudent}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Students</SelectItem>
                  {students.map((s) => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="flex-1">
              <Label>Filter by Grade</Label>
              <Select value={filterGrade} onValueChange={setFilterGrade}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Grades</SelectItem>
                  {Array.from(new Set(students.map((s: any) => s.grade))).map((g) => (
                    <SelectItem key={g} value={g}>{g}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardHeader>

        <CardContent>
          <div className="space-y-4">
            {chapters.map((record: any) => {
              const isShown = showStudentsMap[record.id];
              return (
                <div key={record.id} className="border rounded-lg p-4">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-2">
                        <BookOpen className="h-5 w-5 text-primary" />
                        <h3 className="font-semibold text-lg">
                          {record.lesson_plans?.subject} - {record.lesson_plans?.chapter}
                        </h3>
                      </div>
                      <p className="text-sm text-muted-foreground mb-2">
                        Topic: {record.lesson_plans?.topic}
                      </p>
                      <p className="text-sm text-muted-foreground mb-2">
                        Date Taught: {format(new Date(record.taught_date), "PPP")}
                      </p>
                      {record.teacher_remarks && (
                        <p className="text-sm mb-2">Notes: {record.teacher_remarks}</p>
                      )}

                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => toggleShowStudents(record.id)}
                        className="mb-2"
                      >
                        {isShown ? (
                          <>
                            <ChevronUp className="h-4 w-4 mr-1" /> Hide Students
                          </>
                        ) : (
                          <>
                            <ChevronDown className="h-4 w-4 mr-1" /> Show Students
                          </>
                        )}
                      </Button>

                      {isShown && (
                        <div className="border rounded p-2 max-h-48 overflow-y-auto space-y-1">
                          <div className="flex justify-between items-center text-sm p-1">
                            <span>{record.students?.name || "Unknown Student"}</span>
                            <span className="capitalize">{record.completion_status?.replace("_", " ") || "Completed"}</span>
                          </div>
                        </div>
                      )}
                    </div>

                    <Button 
                      variant="destructive" 
                      size="sm" 
                      onClick={() => deleteChapterMutation.mutate(record.id)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              );
            })}
            {chapters.length === 0 && (
              <p className="text-sm text-muted-foreground">No chapters recorded yet.</p>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}