import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogDescription } from '@/components/ui/dialog';
import { toast } from 'sonner';
import { Plus, Edit, Trash2, Check, X, UserPlus, Settings } from 'lucide-react';
import { format } from 'date-fns';
import { Tables } from '@/integrations/supabase/types';
import * as bcrypt from 'bcryptjs';
import TeacherFeaturePermissions from '@/components/center/TeacherFeaturePermissions'; // Import the new component

type Teacher = Tables<'teachers'>;

export default function TeacherManagement() {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingTeacher, setEditingTeacher] = useState<Teacher | null>(null);

  const [name, setName] = useState("");
  const [contactNumber, setContactNumber] = useState("");
  const [email, setEmail] = useState("");
  const [hireDate, setHireDate] = useState(format(new Date(), "yyyy-MM-dd"));

  const [isCreatingTeacherLogin, setIsCreatingTeacherLogin] = useState(false);
  const [selectedTeacherForLogin, setSelectedTeacherForLogin] = useState<Teacher | null>(null);
  const [teacherUsername, setTeacherUsername] = useState("");
  const [teacherPassword, setTeacherPassword] = useState("");

  const [showPermissionsDialog, setShowPermissionsDialog] = useState(false);
  const [selectedTeacherForPermissions, setSelectedTeacherForPermissions] = useState<Teacher | null>(null);


  // Fetch teachers
  const { data: teachers = [], isLoading } = useQuery({
    queryKey: ["teachers", user?.center_id],
    queryFn: async () => {
      if (!user?.center_id) return [];
      const { data, error } = await supabase
        .from("teachers")
        .select("*, users(id, username, is_active)") // Fetch associated user data
        .eq("center_id", user.center_id)
        .order("name");
      if (error) throw error;
      return data;
    },
    enabled: !!user?.center_id,
  });

  const resetForm = () => {
    setName("");
    setContactNumber("");
    setEmail("");
    setHireDate(format(new Date(), "yyyy-MM-dd"));
    setEditingTeacher(null);
  };

  const createTeacherMutation = useMutation({
    mutationFn: async () => {
      if (!user?.center_id) throw new Error("Center ID not found");
      const { error, data: newTeacher } = await supabase.from("teachers").insert({
        center_id: user.center_id,
        name,
        contact_number: contactNumber || null,
        email: email || null,
        hire_date: hireDate,
        is_active: true,
      }).select().single();
      if (error) throw error;

      // Seed initial default permissions for the new teacher
      const defaultTeacherFeatures = [
        'take_attendance', 'lesson_tracking', 'homework_management',
        'preschool_activities', 'discipline_issues', 'test_management',
        'student_report_access'
      ];
      const permissionsToInsert = defaultTeacherFeatures.map(feature => ({
        teacher_id: newTeacher.id,
        feature_name: feature,
        is_enabled: true,
      }));
      const { error: permError } = await supabase.from('teacher_feature_permissions').insert(permissionsToInsert);
      if (permError) console.error('Error seeding default permissions for new teacher:', permError);

      return newTeacher;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["teachers"] });
      toast.success("Teacher added successfully!");
      setIsDialogOpen(false);
      resetForm();
    },
    onError: (error: any) => {
      toast.error(error.message || "Failed to add teacher");
    },
  });

  const updateTeacherMutation = useMutation({
    mutationFn: async () => {
      if (!editingTeacher || !user?.center_id) throw new Error("Teacher or Center ID not found");
      const { error } = await supabase.from("teachers").update({
        name,
        contact_number: contactNumber || null,
        email: email || null,
        hire_date: hireDate,
      }).eq("id", editingTeacher.id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["teachers"] });
      toast.success("Teacher updated successfully!");
      setIsDialogOpen(false);
      resetForm();
    },
    onError: (error: any) => {
      toast.error(error.message || "Failed to update teacher");
    },
  });

  const toggleTeacherStatusMutation = useMutation({
    mutationFn: async (teacher: Teacher) => {
      const { error } = await supabase.from("teachers").update({
        is_active: !teacher.is_active,
      }).eq("id", teacher.id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["teachers"] });
      toast.success("Teacher status updated!");
    },
    onError: (error: any) => {
      toast.error(error.message || "Failed to update teacher status");
    },
  });

  const deleteTeacherMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("teachers").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["teachers"] });
      toast.success("Teacher deleted successfully!");
    },
    onError: (error: any) => {
      toast.error(error.message || "Failed to delete teacher");
    },
  });

  const createTeacherLoginMutation = useMutation({
    mutationFn: async () => {
      if (!selectedTeacherForLogin || !user?.center_id) throw new Error("Teacher or Center ID not found");

      // Check if username already exists
      const { data: existingUser, error: existingUserError } = await supabase
        .from('users')
        .select('id')
        .eq('username', teacherUsername)
        .single();

      if (existingUserError && existingUserError.code !== 'PGRST116') throw existingUserError; // PGRST116 = no rows found
      if (existingUser) {
        throw new Error('Username already exists. Please choose a different one.');
      }

      const hashedPassword = await bcrypt.hash(teacherPassword, 12);

      const { error } = await supabase.from("users").insert({
        username: teacherUsername,
        password_hash: hashedPassword,
        role: 'teacher',
        center_id: user.center_id,
        teacher_id: selectedTeacherForLogin.id,
        is_active: true,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["teachers"] }); // Invalidate to refetch user data
      toast.success("Teacher login created successfully!");
      setIsCreatingTeacherLogin(false);
      setSelectedTeacherForLogin(null);
      setTeacherUsername("");
      setTeacherPassword("");
    },
    onError: (error: any) => {
      toast.error(error.message || "Failed to create teacher login");
    },
  });

  const handleEditClick = (teacher: Teacher) => {
    setEditingTeacher(teacher);
    setName(teacher.name);
    setContactNumber(teacher.contact_number || "");
    setEmail(teacher.email || "");
    setHireDate(teacher.hire_date);
    setIsDialogOpen(true);
  };

  const handleSubmit = () => {
    if (editingTeacher) {
      updateTeacherMutation.mutate();
    } else {
      createTeacherMutation.mutate();
    }
  };

  const handleCreateLoginClick = (teacher: Teacher) => {
    setSelectedTeacherForLogin(teacher);
    setTeacherUsername(teacher.email || ''); // Pre-fill with email if available
    setTeacherPassword('');
    setIsCreatingTeacherLogin(true);
  };

  const handleManagePermissionsClick = (teacher: Teacher) => {
    setSelectedTeacherForPermissions(teacher);
    setShowPermissionsDialog(true);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold">Teacher Management</h1>
        <Dialog open={isDialogOpen} onOpenChange={(open) => {
          setIsDialogOpen(open);
          if (!open) resetForm();
        }}>
          <DialogTrigger asChild>
            <Button><Plus className="h-4 w-4 mr-2" /> Add Teacher</Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>{editingTeacher ? "Edit Teacher" : "Add New Teacher"}</DialogTitle>
              <DialogDescription>
                {editingTeacher ? "Update the details of this teacher." : "Fill in the details to add a new teacher to your center."}
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="name">Full Name *</Label>
                <Input id="name" value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g., Jane Doe" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="contactNumber">Contact Number</Label>
                  <Input id="contactNumber" value={contactNumber} onChange={(e) => setContactNumber(e.target.value)} placeholder="e.g., 9876543210" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="email">Email</Label>
                  <Input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="e.g., jane.doe@example.com" />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="hireDate">Hire Date *</Label>
                <Input id="hireDate" type="date" value={hireDate} onChange={(e) => setHireDate(e.target.value)} />
              </div>
              <Button
                onClick={handleSubmit}
                disabled={!name || !hireDate || createTeacherMutation.isPending || updateTeacherMutation.isPending}
                className="w-full"
              >
                {editingTeacher ? (updateTeacherMutation.isPending ? "Updating..." : "Update Teacher") : (createTeacherMutation.isPending ? "Adding..." : "Add Teacher")}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>All Teachers</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <p>Loading teachers...</p>
          ) : teachers.length === 0 ? (
            <p className="text-muted-foreground text-center py-8">No teachers registered yet.</p>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>Contact</TableHead>
                    <TableHead>Email</TableHead>
                    <TableHead>Hire Date</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Login Account</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {teachers.map((teacher: any) => (
                    <TableRow key={teacher.id}>
                      <TableCell className="font-medium">{teacher.name}</TableCell>
                      <TableCell>{teacher.contact_number || '-'}</TableCell>
                      <TableCell>{teacher.email || '-'}</TableCell>
                      <TableCell>{format(new Date(teacher.hire_date), "PPP")}</TableCell>
                      <TableCell>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => toggleTeacherStatusMutation.mutate(teacher)}
                          className={`flex items-center gap-1 ${teacher.is_active ? 'text-green-600' : 'text-red-600'}`}
                        >
                          {teacher.is_active ? <Check className="h-4 w-4" /> : <X className="h-4 w-4" />}
                          {teacher.is_active ? 'Active' : 'Inactive'}
                        </Button>
                      </TableCell>
                      <TableCell>
                        {teacher.users && teacher.users.length > 0 ? (
                          <span className="text-green-600 flex items-center gap-1">
                            <Check className="h-4 w-4" /> Active ({teacher.users[0].username})
                          </span>
                        ) : (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleCreateLoginClick(teacher)}
                          >
                            <UserPlus className="h-4 w-4 mr-1" /> Create Login
                          </Button>
                        )}
                      </TableCell>
                      <TableCell className="flex gap-2">
                        <Button variant="ghost" size="sm" onClick={() => handleEditClick(teacher)}>
                          <Edit className="h-4 w-4" />
                        </Button>
                        <Button variant="destructive" size="sm" onClick={() => deleteTeacherMutation.mutate(teacher.id)}>
                          <Trash2 className="h-4 w-4" />
                        </Button>
                        {teacher.users && teacher.users.length > 0 && (
                          <Button variant="ghost" size="sm" onClick={() => handleManagePermissionsClick(teacher)}>
                            <Settings className="h-4 w-4" />
                          </Button>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Create Teacher Login Dialog */}
      <Dialog open={isCreatingTeacherLogin} onOpenChange={setIsCreatingTeacherLogin}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create Login for {selectedTeacherForLogin?.name}</DialogTitle>
            <DialogDescription>
              Set a username and password for this teacher to log in.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 mt-4">
            <div className="space-y-2">
              <Label htmlFor="teacherUsername">Username</Label>
              <Input
                id="teacherUsername"
                value={teacherUsername}
                onChange={(e) => setTeacherUsername(e.target.value)}
                placeholder="Enter username"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="teacherPassword">Password</Label>
              <Input
                id="teacherPassword"
                type="password"
                value={teacherPassword}
                onChange={(e) => setTeacherPassword(e.target.value)}
                placeholder="Enter password"
              />
            </div>
            <div className="flex justify-end gap-2 mt-4">
              <Button
                variant="outline"
                onClick={() => setIsCreatingTeacherLogin(false)}
              >
                Cancel
              </Button>
              <Button
                onClick={() => createTeacherLoginMutation.mutate()}
                disabled={!teacherUsername || !teacherPassword || createTeacherLoginMutation.isPending}
              >
                {createTeacherLoginMutation.isPending ? 'Creating...' : 'Create Login'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Manage Teacher Permissions Dialog */}
      <Dialog open={showPermissionsDialog} onOpenChange={setShowPermissionsDialog}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Manage Teacher Permissions</DialogTitle>
            <DialogDescription>
              Enable or disable specific features for {selectedTeacherForPermissions?.name}.
            </DialogDescription>
          </DialogHeader>
          {selectedTeacherForPermissions && (
            <TeacherFeaturePermissions
              teacherId={selectedTeacherForPermissions.id}
              teacherName={selectedTeacherForPermissions.name}
            />
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}