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
import { Plus, Edit, Trash2, Upload, Image, Video, Star } from "lucide-react";
import { format } from "date-fns";

const Activities = () => {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingActivity, setEditingActivity] = useState<any>(null);
  const [selectedFiles, setSelectedFiles] = useState<FileList | null>(null);
  const [activityForm, setActivityForm] = useState({
    activity_type_id: "",
    title: "",
    description: "",
    activity_date: format(new Date(), "yyyy-MM-dd"),
    duration_minutes: "",
    grade: "",
    notes: ""
  });

  // Fetch activity types
  const { data: activityTypes = [] } = useQuery({
    queryKey: ["activity-types", user?.center_id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("activity_types")
        .select("*")
        .eq("center_id", user?.center_id!)
        .eq("is_active", true);
      if (error) throw error;
      return data;
    },
    enabled: !!user?.center_id
  });

  // Fetch activities
  const { data: activities = [] } = useQuery({
    queryKey: ["activities", user?.center_id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("activities")
        .select("*, activity_types(name), users(username)")
        .eq("center_id", user?.center_id!)
        .eq("is_active", true)
        .order("activity_date", { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: !!user?.center_id
  });

  // Fetch students for activity tracking
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

  // Fetch student activity records
  const { data: studentActivityRecords = [] } = useQuery({
    queryKey: ["student-activity-records", user?.center_id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("student_activity_records")
        .select("*, activities(title), students(name)");
      if (error) throw error;
      return data;
    },
    enabled: !!user?.center_id
  });

  // Create activity mutation
  const createActivityMutation = useMutation({
    mutationFn: async () => {
      // First create activity record
      const { data: activityData, error: activityError } = await supabase
        .from("activities")
        .insert({
          ...activityForm,
          center_id: user?.center_id,
          created_by: user?.id,
          duration_minutes: activityForm.duration_minutes ? parseInt(activityForm.duration_minutes) : null
        })
        .select()
        .single();

      if (activityError) throw activityError;

      // Upload files if selected
      if (selectedFiles && selectedFiles.length > 0) {
        const uploadPromises = [];
        for (let i = 0; i < selectedFiles.length; i++) {
          const file = selectedFiles[i];
          const fileExt = file.name.split(".").pop();
          const fileName = `${Date.now()}-${Math.random().toString(36).substring(7)}-${i}.${fileExt}`;
          
          const uploadPromise = supabase.storage
            .from("activity-media")
            .upload(fileName, file);
          
          uploadPromises.push(uploadPromise);
        }

        const uploadResults = await Promise.all(uploadPromises);
        const mediaUrls = uploadResults.map(result => result.data?.path || "");
        
        // Create student activity records for all students in the grade
        if (activityForm.grade) {
          const gradeStudents = students.filter((s: any) => s.grade === activityForm.grade);
          const studentRecords = gradeStudents.map((student: any) => ({
            activity_id: activityData.id,
            student_id: student.id,
            media_urls: mediaUrls
          }));

          if (studentRecords.length > 0) {
            const { error: recordsError } = await supabase
              .from("student_activity_records")
              .insert(studentRecords);
            
            if (recordsError) throw recordsError;
          }
        }
      }

      return activityData;
    },
    onSuccess: () => {
      toast.success("Activity created successfully");
      queryClient.invalidateQueries({ queryKey: ["activities"] });
      resetForm();
    },
    onError: (error: any) => {
      toast.error(error.message || "Failed to create activity");
    }
  });

  // Update activity mutation
  const updateActivityMutation = useMutation({
    mutationFn: async () => {
      const { error } = await supabase
        .from("activities")
        .update({
          ...activityForm,
          duration_minutes: activityForm.duration_minutes ? parseInt(activityForm.duration_minutes) : null
        })
        .eq("id", editingActivity.id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Activity updated successfully");
      queryClient.invalidateQueries({ queryKey: ["activities"] });
      resetForm();
    },
    onError: (error: any) => {
      toast.error(error.message || "Failed to update activity");
    }
  });

  // Delete activity mutation
  const deleteActivityMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("activities")
        .update({ is_active: false })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Activity deleted successfully");
      queryClient.invalidateQueries({ queryKey: ["activities"] });
    },
    onError: (error: any) => {
      toast.error(error.message || "Failed to delete activity");
    }
  });

  // Update student activity rating
  const updateStudentRatingMutation = useMutation({
    mutationFn: async ({ recordId, rating, notes }: { recordId: string; rating: number; notes?: string }) => {
      const { error } = await supabase
        .from("student_activity_records")
        .update({
          involvement_rating: rating,
          teacher_notes: notes
        })
        .eq("id", recordId);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Rating updated successfully");
      queryClient.invalidateQueries({ queryKey: ["student-activity-records"] });
    },
    onError: (error: any) => {
      toast.error(error.message || "Failed to update rating");
    }
  });

  const resetForm = () => {
    setActivityForm({
      activity_type_id: "",
      title: "",
      description: "",
      activity_date: format(new Date(), "yyyy-MM-dd"),
      duration_minutes: "",
      grade: "",
      notes: ""
    });
    setSelectedFiles(null);
    setEditingActivity(null);
    setIsDialogOpen(false);
  };

  const handleSubmit = () => {
    if (editingActivity) {
      updateActivityMutation.mutate();
    } else {
      createActivityMutation.mutate();
    }
  };

  const handleEdit = (activity: any) => {
    setEditingActivity(activity);
    setActivityForm({
      activity_type_id: activity.activity_type_id || "",
      title: activity.title,
      description: activity.description || "",
      activity_date: activity.activity_date,
      duration_minutes: activity.duration_minutes?.toString() || "",
      grade: activity.grade || "",
      notes: activity.notes || ""
    });
    setSelectedFiles(null);
    setIsDialogOpen(true);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      setSelectedFiles(e.target.files);
    }
  };

  const renderMedia = (mediaUrls: string[]) => {
    if (!mediaUrls || mediaUrls.length === 0) return null;
    
    return (
      <div className="flex flex-wrap gap-2">
        {mediaUrls.map((url, index) => {
          const isImage = /\.(jpg|jpeg|png|gif)$/i.test(url);
          const isVideo = /\.(mp4|webm|ogg)$/i.test(url);
          
          return (
            <div key={index} className="relative">
              {isImage ? (
                <img 
                  src={supabase.storage.from("activity-media").getPublicUrl(url).data.publicUrl} 
                  alt="Activity media" 
                  className="w-16 h-16 object-cover rounded"
                />
              ) : isVideo ? (
                <video 
                  src={supabase.storage.from("activity-media").getPublicUrl(url).data.publicUrl} 
                  className="w-16 h-16 object-cover rounded"
                />
              ) : (
                <div className="w-16 h-16 bg-muted rounded flex items-center justify-center">
                  <Upload className="h-6 w-6 text-muted-foreground" />
                </div>
              )}
            </div>
          );
        })}
      </div>
    );
  };

  const renderRating = (rating: number) => {
    return (
      <div className="flex">
        {[1, 2, 3, 4, 5].map((star) => (
          <Star
            key={star}
            className={`h-4 w-4 ${star <= rating ? "text-yellow-400 fill-current" : "text-gray-300"}`}
          />
        ))}
      </div>
    );
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold">Activities Management</h1>
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button onClick={resetForm}>
              <Plus className="mr-2 h-4 w-4" />
              Add Activity
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>
                {editingActivity ? "Edit Activity" : "Add New Activity"}
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="activity_type">Activity Type *</Label>
                  <Select
                    value={activityForm.activity_type_id || ""}
                    onValueChange={(value) => setActivityForm({ ...activityForm, activity_type_id: value })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select activity type" />
                    </SelectTrigger>
                    <SelectContent>
                      {activityTypes.map((type: any) => (
                        <SelectItem key={type.id} value={type.id}>
                          {type.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="activity_date">Date *</Label>
                  <Input
                    id="activity_date"
                    type="date"
                    value={activityForm.activity_date}
                    onChange={(e) => setActivityForm({ ...activityForm, activity_date: e.target.value })}
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="title">Title *</Label>
                <Input
                  id="title"
                  value={activityForm.title}
                  onChange={(e) => setActivityForm({ ...activityForm, title: e.target.value })}
                  placeholder="Enter activity title"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="description">Description</Label>
                <Textarea
                  id="description"
                  value={activityForm.description}
                  onChange={(e) => setActivityForm({ ...activityForm, description: e.target.value })}
                  placeholder="Enter activity description"
                  rows={3}
                />
              </div>
              <div className="grid grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="duration">Duration (minutes)</Label>
                  <Input
                    id="duration"
                    type="number"
                    value={activityForm.duration_minutes}
                    onChange={(e) => setActivityForm({ ...activityForm, duration_minutes: e.target.value })}
                    placeholder="e.g., 60"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="grade">Grade</Label>
                  <Input
                    id="grade"
                    value={activityForm.grade}
                    onChange={(e) => setActivityForm({ ...activityForm, grade: e.target.value })}
                    placeholder="e.g., Grade 5"
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="notes">Notes</Label>
                <Textarea
                  id="notes"
                  value={activityForm.notes}
                  onChange={(e) => setActivityForm({ ...activityForm, notes: e.target.value })}
                  placeholder="Additional notes"
                  rows={2}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="media">Media (Photos/Videos)</Label>
                <Input
                  id="media"
                  type="file"
                  multiple
                  accept="image/*,video/*"
                  onChange={handleFileChange}
                />
                {selectedFiles && selectedFiles.length > 0 && (
                  <p className="text-sm text-muted-foreground mt-1">
                    Selected: {selectedFiles.length} file(s)
                  </p>
                )}
              </div>
              <Button onClick={handleSubmit} className="w-full">
                {editingActivity ? "Update Activity" : "Create Activity"}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Activities List</CardTitle>
        </CardHeader>
        <CardContent>
          {activities.length === 0 ? (
            <p className="text-muted-foreground text-center py-8">No activities found</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Title</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead>Grade</TableHead>
                  <TableHead>Duration</TableHead>
                  <TableHead>Created By</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {activities.map((activity: any) => (
                  <TableRow key={activity.id}>
                    <TableCell className="font-medium">{activity.title}</TableCell>
                    <TableCell>{activity.activity_types?.name || "-"}</TableCell>
                    <TableCell>{format(new Date(activity.activity_date), "PPP")}</TableCell>
                    <TableCell>{activity.grade || "-"}</TableCell>
                    <TableCell>
                      {activity.duration_minutes ? `${activity.duration_minutes} min` : "-"}
                    </TableCell>
                    <TableCell>{activity.users?.username || "-"}</TableCell>
                    <TableCell>
                      <div className="flex gap-2">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleEdit(activity)}
                        >
                          <Edit className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => deleteActivityMutation.mutate(activity.id)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Student Activity Records */}
      {activities.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Student Activity Records</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-6">
              {activities.map((activity: any) => {
                const activityRecords = studentActivityRecords.filter(
                  (record: any) => record.activity_id === activity.id
                );
                
                if (activityRecords.length === 0) return null;
                
                return (
                  <div key={activity.id} className="border rounded-lg p-4">
                    <h3 className="font-semibold text-lg mb-3">{activity.title}</h3>
                    <div className="overflow-x-auto">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Student</TableHead>
                            <TableHead>Grade</TableHead>
                            <TableHead>Rating</TableHead>
                            <TableHead>Notes</TableHead>
                            <TableHead>Media</TableHead>
                            <TableHead>Actions</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {activityRecords.map((record: any) => {
                            const student = students.find((s: any) => s.id === record.student_id);
                            return (
                              <TableRow key={record.id}>
                                <TableCell className="font-medium">
                                  {student ? student.name : "Unknown Student"}
                                </TableCell>
                                <TableCell>{student ? student.grade : "-"}</TableCell>
                                <TableCell>
                                  <div className="flex items-center gap-2">
                                    {renderRating(record.involvement_rating || 0)}
                                    <span className="text-sm">
                                      {record.involvement_rating || 0}/5
                                    </span>
                                  </div>
                                </TableCell>
                                <TableCell>{record.teacher_notes || "-"}</TableCell>
                                <TableCell>
                                  {record.media_urls && record.media_urls.length > 0 ? (
                                    <div className="flex gap-1">
                                      {record.media_urls.slice(0, 3).map((url: string, index: number) => {
                                        const isImage = /\.(jpg|jpeg|png|gif)$/i.test(url);
                                        const isVideo = /\.(mp4|webm|ogg)$/i.test(url);
                                        return (
                                          <div key={index} className="relative">
                                            {isImage ? (
                                              <img 
                                                src={supabase.storage.from("activity-media").getPublicUrl(url).data.publicUrl} 
                                                alt="Activity" 
                                                className="w-8 h-8 object-cover rounded"
                                              />
                                            ) : isVideo ? (
                                              <Video className="h-8 w-8 text-muted-foreground" />
                                            ) : (
                                              <Upload className="h-8 w-8 text-muted-foreground" />
                                            )}
                                          </div>
                                        );
                                      })}
                                      {record.media_urls.length > 3 && (
                                        <span className="text-xs text-muted-foreground">
                                          +{record.media_urls.length - 3} more
                                        </span>
                                      )}
                                    </div>
                                  ) : (
                                    "-"
                                  )}
                                </TableCell>
                                <TableCell>
                                  <Dialog>
                                    <DialogTrigger asChild>
                                      <Button variant="outline" size="sm">
                                        Rate
                                      </Button>
                                    </DialogTrigger>
                                    <DialogContent>
                                      <DialogHeader>
                                        <DialogTitle>Rate Student Activity</DialogTitle>
                                      </DialogHeader>
                                      <div className="space-y-4 py-4">
                                        <div className="flex items-center gap-2">
                                          <span className="font-medium">
                                            {student ? student.name : "Unknown Student"}
                                          </span>
                                          <span className="text-muted-foreground">
                                            - {activity.title}
                                          </span>
                                        </div>
                                        <div className="space-y-2">
                                          <Label>Rating (1-5 stars)</Label>
                                          <div className="flex gap-1">
                                            {[1, 2, 3, 4, 5].map((star) => (
                                              <Button
                                                key={star}
                                                variant="outline"
                                                size="icon"
                                                onClick={() => 
                                                  updateStudentRatingMutation.mutate({
                                                    recordId: record.id,
                                                    rating: star,
                                                    notes: record.teacher_notes
                                                  })
                                                }
                                              >
                                                <Star
                                                  className={`h-5 w-5 ${
                                                    star <= (record.involvement_rating || 0)
                                                      ? "text-yellow-400 fill-current"
                                                      : "text-gray-300"
                                                  }`}
                                                />
                                              </Button>
                                            ))}
                                          </div>
                                        </div>
                                        <div className="space-y-2">
                                          <Label>Notes</Label>
                                          <Textarea
                                            value={record.teacher_notes || ""}
                                            onChange={(e) => 
                                              updateStudentRatingMutation.mutate({
                                                recordId: record.id,
                                                rating: record.involvement_rating || 0,
                                                notes: e.target.value
                                              })
                                            }
                                            placeholder="Add notes about student's performance..."
                                            rows={3}
                                          />
                                        </div>
                                      </div>
                                    </DialogContent>
                                  </Dialog>
                                </TableCell>
                              </TableRow>
                            );
                          })}
                        </TableBody>
                      </Table>
                    </div>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default Activities;