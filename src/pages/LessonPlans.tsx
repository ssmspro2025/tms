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
import { Plus, Edit, Trash2, FileUp, FileText, Video } from "lucide-react";
import { format } from "date-fns";
import { Tables } from "@/integrations/supabase/types";

type LessonPlan = Tables<'lesson_plans'>;

export default function LessonPlans() {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingLessonPlan, setEditingLessonPlan] = useState<LessonPlan | null>(null);

  const [subject, setSubject] = useState("");
  const [chapter, setChapter] = useState("");
  const [topic, setTopic] = useState("");
  const [lessonDate, setLessonDate] = useState(format(new Date(), "yyyy-MM-dd"));
  const [notes, setNotes] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [media, setMedia] = useState<File | null>(null);

  // Fetch lesson plans
  const { data: lessonPlans = [], isLoading } = useQuery({
    queryKey: ["lesson-plans", user?.center_id],
    queryFn: async () => {
      if (!user?.center_id) return [];
      const { data, error } = await supabase
        .from("lesson_plans")
        .select("*")
        .eq("center_id", user.center_id)
        .order("lesson_date", { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: !!user?.center_id,
  });

  const resetForm = () => {
    setSubject("");
    setChapter("");
    setTopic("");
    setLessonDate(format(new Date(), "yyyy-MM-dd"));
    setNotes("");
    setFile(null);
    setMedia(null);
    setEditingLessonPlan(null);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setFile(e.target.files[0]);
    }
  };

  const handleMediaChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setMedia(e.target.files[0]);
    }
  };

  const uploadFile = async (fileToUpload: File, bucket: string) => {
    const fileExt = fileToUpload.name.split(".").pop();
    const fileName = `${Date.now()}-${Math.random().toString(36).substring(7)}.${fileExt}`;
    const { error: uploadError } = await supabase.storage
      .from(bucket)
      .upload(fileName, fileToUpload);
    if (uploadError) throw uploadError;
    return fileName;
  };

  const createLessonPlanMutation = useMutation({
    mutationFn: async () => {
      if (!user?.center_id) throw new Error("Center ID not found");

      let fileUrl: string | null = null;
      let mediaUrl: string | null = null;

      if (file) fileUrl = await uploadFile(file, "lesson-plan-files");
      if (media) mediaUrl = await uploadFile(media, "lesson-plan-media");

      const { error } = await supabase.from("lesson_plans").insert({
        center_id: user.center_id,
        subject,
        chapter,
        topic,
        lesson_date: lessonDate,
        notes: notes || null,
        file_url: fileUrl,
        media_url: mediaUrl,
        is_active: true,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["lesson-plans"] });
      toast.success("Lesson Plan created successfully!");
      setIsDialogOpen(false);
      resetForm();
    },
    onError: (error: any) => {
      toast.error(error.message || "Failed to create lesson plan");
    },
  });

  const updateLessonPlanMutation = useMutation({
    mutationFn: async () => {
      if (!editingLessonPlan || !user?.center_id) throw new Error("Lesson Plan or Center ID not found");

      let fileUrl: string | null = editingLessonPlan.file_url;
      let mediaUrl: string | null = editingLessonPlan.media_url;

      if (file) fileUrl = await uploadFile(file, "lesson-plan-files");
      if (media) mediaUrl = await uploadFile(media, "lesson-plan-media");

      const { error } = await supabase.from("lesson_plans").update({
        subject,
        chapter,
        topic,
        lesson_date: lessonDate,
        notes: notes || null,
        file_url: fileUrl,
        media_url: mediaUrl,
      }).eq("id", editingLessonPlan.id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["lesson-plans"] });
      toast.success("Lesson Plan updated successfully!");
      setIsDialogOpen(false);
      resetForm();
    },
    onError: (error: any) => {
      toast.error(error.message || "Failed to update lesson plan");
    },
  });

  const deleteLessonPlanMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("lesson_plans").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["lesson-plans"] });
      toast.success("Lesson Plan deleted successfully!");
    },
    onError: (error: any) => {
      toast.error(error.message || "Failed to delete lesson plan");
    },
  });

  const handleEditClick = (lessonPlan: LessonPlan) => {
    setEditingLessonPlan(lessonPlan);
    setSubject(lessonPlan.subject);
    setChapter(lessonPlan.chapter);
    setTopic(lessonPlan.topic);
    setLessonDate(lessonPlan.lesson_date);
    setNotes(lessonPlan.notes || "");
    setFile(null); // Clear file input for edit
    setMedia(null); // Clear media input for edit
    setIsDialogOpen(true);
  };

  const handleSubmit = () => {
    if (editingLessonPlan) {
      updateLessonPlanMutation.mutate();
    } else {
      createLessonPlanMutation.mutate();
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold">Lesson Plans</h1>
        <Dialog open={isDialogOpen} onOpenChange={(open) => {
          setIsDialogOpen(open);
          if (!open) resetForm();
        }}>
          <DialogTrigger asChild>
            <Button><Plus className="h-4 w-4 mr-2" /> Create Lesson Plan</Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>{editingLessonPlan ? "Edit Lesson Plan" : "Create New Lesson Plan"}</DialogTitle>
              <DialogDescription>
                {editingLessonPlan ? "Update the details of this lesson plan." : "Fill in the details to create a new lesson plan."}
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="subject">Subject *</Label>
                  <Input id="subject" value={subject} onChange={(e) => setSubject(e.target.value)} placeholder="e.g., Mathematics" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="chapter">Chapter *</Label>
                  <Input id="chapter" value={chapter} onChange={(e) => setChapter(e.target.value)} placeholder="e.g., Algebra" />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="topic">Topic *</Label>
                <Input id="topic" value={topic} onChange={(e) => setTopic(e.target.value)} placeholder="e.g., Linear Equations" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="lessonDate">Date *</Label>
                <Input id="lessonDate" type="date" value={lessonDate} onChange={(e) => setLessonDate(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="notes">Notes (Optional)</Label>
                <Textarea id="notes" value={notes} onChange={(e) => setNotes(e.target.value)} rows={3} placeholder="Key points, teaching strategies, etc." />
              </div>
              <div className="space-y-2">
                <Label htmlFor="file">Upload Lesson Plan File (PDF, DOCX - Optional)</Label>
                <Input id="file" type="file" accept=".pdf,.doc,.docx" onChange={handleFileChange} />
                {editingLessonPlan?.file_url && !file && (
                  <p className="text-sm text-muted-foreground">Current file: {editingLessonPlan.file_url.split('-').pop()}</p>
                )}
              </div>
              <div className="space-y-2">
                <Label htmlFor="media">Upload Optional Media (Image, Video - Optional)</Label>
                <Input id="media" type="file" accept="image/*,video/*" onChange={handleMediaChange} />
                {editingLessonPlan?.media_url && !media && (
                  <p className="text-sm text-muted-foreground">Current media: {editingLessonPlan.media_url.split('-').pop()}</p>
                )}
              </div>
              <Button
                onClick={handleSubmit}
                disabled={!subject || !chapter || !topic || !lessonDate || createLessonPlanMutation.isPending || updateLessonPlanMutation.isPending}
                className="w-full"
              >
                {editingLessonPlan ? (updateLessonPlanMutation.isPending ? "Updating..." : "Update Lesson Plan") : (createLessonPlanMutation.isPending ? "Creating..." : "Create Lesson Plan")}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>All Lesson Plans</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <p>Loading lesson plans...</p>
          ) : lessonPlans.length === 0 ? (
            <p className="text-muted-foreground text-center py-8">No lesson plans created yet.</p>
          ) : (
            <div className="space-y-4">
              {lessonPlans.map((lp) => (
                <div key={lp.id} className="border rounded-lg p-4 flex items-start justify-between">
                  <div className="flex-1 space-y-1">
                    <h3 className="font-semibold text-lg">{lp.subject}: {lp.chapter} - {lp.topic}</h3>
                    <p className="text-sm text-muted-foreground">Date: {format(new Date(lp.lesson_date), "PPP")}</p>
                    {lp.notes && <p className="text-sm">{lp.notes}</p>}
                    <div className="flex gap-2 mt-2">
                      {lp.file_url && (
                        <Button variant="outline" size="sm" asChild>
                          <a href={supabase.storage.from("lesson-plan-files").getPublicUrl(lp.file_url).data.publicUrl} target="_blank" rel="noopener noreferrer">
                            <FileText className="h-4 w-4 mr-1" /> File
                          </a>
                        </Button>
                      )}
                      {lp.media_url && (
                        <Button variant="outline" size="sm" asChild>
                          <a href={supabase.storage.from("lesson-plan-media").getPublicUrl(lp.media_url).data.publicUrl} target="_blank" rel="noopener noreferrer">
                            <Video className="h-4 w-4 mr-1" /> Media
                          </a>
                        </Button>
                      )}
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <Button variant="ghost" size="sm" onClick={() => handleEditClick(lp)}>
                      <Edit className="h-4 w-4" />
                    </Button>
                    <Button variant="destructive" size="sm" onClick={() => deleteLessonPlanMutation.mutate(lp.id)}>
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