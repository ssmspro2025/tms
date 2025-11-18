import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { toast } from "sonner";
import { Trash2, Plus } from "lucide-react";
import { format } from "date-fns";
import { Textarea } from "@/components/ui/textarea";

export default function ChaptersTracking() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const [selectedStudentIds, setSelectedStudentIds] = useState<string[]>([]);
  const [date, setDate] = useState(format(new Date(), "yyyy-MM-dd"));
  const [subject, setSubject] = useState("");
  const [chapterName, setChapterName] = useState("");
  const [notes, setNotes] = useState("");
  const [filterGrade, setFilterGrade] = useState("all");
  const [selectedChapterId, setSelectedChapterId] = useState("");
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [showPresentOnly, setShowPresentOnly] = useState(true);

  // ----------------------------
  // Fetch students
  // ----------------------------
  const { data: students = [] } = useQuery({
    queryKey: ["students", user?.center_id],
    queryFn: async () => {
      let query = supabase.from("students").select("*").order("name");
      if (user?.role !== "admin" && user?.center_id) query = query.eq("center_id", user.center_id);
      const { data, error } = await query;
      if (error) throw error;
      return data || [];
    },
  });

  const grades = Array.from(new Set(students.map((s: any) => s.grade))).filter(Boolean);

  // ----------------------------
  // Fetch attendance
  // ----------------------------
  const { data: attendance = [] } = useQuery({
    queryKey: ["attendance", user?.center_id],
    queryFn: async () => {
      if (!user?.center_id) return [];
      const { data, error } = await supabase.from("attendance").select("*").eq("center_id", user.center_id);
      if (error) throw error;
      return data || [];
    },
  });

  // ----------------------------
  // Auto-select present students
  // ----------------------------
  useEffect(() => {
    if (!students || students.length === 0) return;

    const filteredStudents = students
      .filter((s: any) => filterGrade === "all" || s.grade === filterGrade)
      .filter((s: any) => {
        if (!showPresentOnly) return false;
        const att = attendance.find(
          (a: any) => a.student_id === s.id && format(new Date(a.date), "yyyy-MM-dd") === date
        );
        return att?.status === "Present";
      })
      .map((s: any) => s.id);

    setSelectedStudentIds(filteredStudents);
  }, [date, attendance, students, filterGrade, showPresentOnly]);

  // ----------------------------
  // Fetch chapters
  // ----------------------------
  const { data: chapters = [] } = useQuery({
    queryKey: ["chapters", user?.center_id, filterGrade],
    queryFn: async () => {
      if (!user?.center_id) return [];

      const { data, error } = await supabase
        .from("chapters")
        .select("*, student_chapters(*, students(name, grade))")
        .eq("center_id", user.center_id)
        .order("date_taught", { ascending: false });

      if (error) throw error;
      return data || [];
    },
  });

  // ----------------------------
  // Fetch unique chapters
  // ----------------------------
  const { data: uniqueChapters = [] } = useQuery({
    queryKey: ["unique-chapters", user?.center_id],
    queryFn: async () => {
      if (!user?.center_id) return [];
      const { data, error } = await supabase.from("chapters").select("id, subject, chapter_name").eq("center_id", user.center_id);
      if (error) throw error;

      const seen = new Set<string>();
      const unique: any[] = [];
      for (const chapter of data || []) {
        const key = `${chapter.subject}|${chapter.chapter_name}`;
        if (!seen.has(key)) {
          seen.add(key);
          unique.push(chapter);
        }
      }
      return unique;
    },
  });

  // ----------------------------
  // Add chapter
  // ----------------------------
  const addChapterMutation = useMutation({
    mutationFn: async () => {
      let chapterId: string;

      if (selectedChapterId) {
        const selected = uniqueChapters.find((c: any) => c.id === selectedChapterId);
        if (!selected) throw new Error("Chapter not found");

        const { data: chapterData, error } = await supabase
          .from("chapters")
          .insert({
            subject: selected.subject,
            chapter_name: selected.chapter_name,
            date_taught: date,
            notes: notes || null,
            center_id: user?.center_id,
          })
          .select()
          .single();
        if (error) throw error;
        chapterId = chapterData.id;
      } else if (subject && chapterName) {
        const { data: chapterData, error } = await supabase
          .from("chapters")
          .insert({
            subject,
            chapter_name,
            date_taught: date,
            notes: notes || null,
            center_id: user?.center_id,
          })
          .select()
          .single();
        if (error) throw error;
        chapterId = chapterData.id;
      } else {
        throw new Error("Select a previous chapter or enter a new one");
      }

      if (selectedStudentIds.length > 0) {
        const studentChapters = selectedStudentIds.map((studentId) => ({
          student_id: studentId,
          chapter_id: chapterId,
          completed: true,
          date_completed: date,
        }));
        const { error: linkError } = await supabase.from("student_chapters").insert(studentChapters);
        if (linkError) throw linkError;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["chapters"] });
      queryClient.invalidateQueries({ queryKey: ["unique-chapters"] });
      toast.success("Chapter recorded for selected students");
      setSelectedStudentIds([]);
      setSubject("");
      setChapterName("");
      setNotes("");
      setSelectedChapterId("");
      setIsDialogOpen(false);
    },
    onError: (error: any) => {
      toast.error(error.message || "Failed to record chapter");
    },
  });

  // ----------------------------
  // Delete chapter
  // ----------------------------
  const deleteChapterMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("chapters").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["chapters"] });
      toast.success("Chapter deleted successfully");
    },
    onError: () => {
      toast.error("Failed to delete chapter");
    },
  });

  // ----------------------------
  // Student selection
  // ----------------------------
  const toggleStudentSelection = (studentId: string) => {
    setSelectedStudentIds((prev) =>
      prev.includes(studentId) ? prev.filter((id) => id !== studentId) : [...prev, studentId]
    );
  };

  const selectAllStudents = () => {
    const filtered = students.filter((s: any) => filterGrade === "all" || s.grade === filterGrade);
    setSelectedStudentIds(filtered.map((s: any) => s.id));
  };

  const deselectAllStudents = () => setSelectedStudentIds([]);

  // ----------------------------
  // Render
  // ----------------------------
  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold">Chapters Tracking</h1>
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button><Plus className="mr-2 h-4 w-4"/>Record Chapter</Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Record Chapter</DialogTitle>
            </DialogHeader>

            <div className="space-y-3">
              <Label>Date</Label>
              <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} />

              <Label>Select Previous Chapter</Label>
              <Select value={selectedChapterId} onValueChange={setSelectedChapterId}>
                <SelectTrigger><SelectValue placeholder="Choose a chapter..." /></SelectTrigger>
                <SelectContent>
                  {uniqueChapters.map(c => (
                    <SelectItem key={c.id} value={c.id}>{c.subject} - {c.chapter_name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Label>Or Create New Chapter</Label>
              <Input placeholder="Subject" value={subject} onChange={(e) => setSubject(e.target.value)} />
              <Input placeholder="Chapter Name" value={chapterName} onChange={(e) => setChapterName(e.target.value)} />
              <Label>Notes (Optional)</Label>
              <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2}/>

              <div className="flex items-center gap-4">
                <Checkbox checked={showPresentOnly} onCheckedChange={() => setShowPresentOnly(!showPresentOnly)} />
                <Label>Present Only</Label>
                <Button size="sm" variant="outline" onClick={selectAllStudents}>Select All</Button>
                <Button size="sm" variant="outline" onClick={deselectAllStudents}>Deselect All</Button>
              </div>

              <div className="border rounded-lg p-3 max-h-48 overflow-y-auto space-y-2">
                {students.filter(s => filterGrade === "all" || s.grade === filterGrade).map(s => {
                  const isPresent = attendance.some(a => a.student_id === s.id && format(new Date(a.date), "yyyy-MM-dd") === date && a.status === "Present");
                  const disabled = showPresentOnly && !isPresent;
                  return (
                    <div key={s.id} className="flex items-center gap-2">
                      <Checkbox id={s.id} disabled={disabled} checked={selectedStudentIds.includes(s.id)} onCheckedChange={() => toggleStudentSelection(s.id)} />
                      <label htmlFor={s.id} className={`${disabled ? "text-muted-foreground" : ""}`}>{s.name} - Grade {s.grade}</label>
                    </div>
                  )
                })}
              </div>

              <Button
                className="w-full mt-3"
                onClick={() => addChapterMutation.mutate()}
                disabled={selectedStudentIds.length === 0 || (!selectedChapterId && (!subject || !chapterName))}
              >
                Record Chapter for {selectedStudentIds.length} Student(s)
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {/* Grade Filter */}
      <Card>
        <CardHeader>
          <CardTitle>Filter by Grade</CardTitle>
        </CardHeader>
        <CardContent>
          <Select value={filterGrade} onValueChange={setFilterGrade}>
            <SelectTrigger className="w-full md:w-[200px]"><SelectValue placeholder="Select grade"/></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Grades</SelectItem>
              {grades.map(g => <SelectItem key={g} value={g}>{g}</SelectItem>)}
            </SelectContent>
          </Select>
        </CardContent>
      </Card>

      {/* Chapters List */}
      <Card>
        <CardHeader>
          <CardTitle>Chapters Taught</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {chapters.length === 0 && <p className="text-center text-muted-foreground">No chapters found</p>}
          {chapters.map(chapter => (
            <div key={chapter.id} className="flex justify-between p-4 border rounded-lg">
              <div>
                <p className="font-medium">{chapter.chapter_name} ({chapter.subject})</p>
                <p className="text-sm text-muted-foreground">Date: {format(new Date(chapter.date_taught), "PPP")}</p>
                <div className="flex flex-wrap gap-2 mt-2">
                  {chapter.student_chapters?.map(sc => (
                    <span key={sc.id} className="text-xs bg-primary/10 px-2 py-1 rounded-full">
                      {sc.students?.name} - Grade {sc.students?.grade}
                    </span>
                  ))}
                </div>
              </div>
              <Button variant="ghost" size="icon" onClick={() => deleteChapterMutation.mutate(chapter.id)}>
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
