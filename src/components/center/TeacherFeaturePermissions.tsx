import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext'; // Import useAuth to get the user's access token
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import { Tables } from '@/integrations/supabase/types';
import { DialogDescription } from '@/components/ui/dialog'; // Import DialogDescription

type Teacher = Tables<'teachers'>;
type TeacherFeaturePermission = Tables<'teacher_feature_permissions'>;

const TEACHER_FEATURES = [
  { name: 'take_attendance', label: 'Take Attendance' },
  { name: 'lesson_tracking', label: 'Lesson Tracking' },
  { name: 'homework_management', label: 'Homework Management' },
  { name: 'preschool_activities', label: 'Preschool Activities' },
  { name: 'discipline_issues', label: 'Discipline Issues' },
  { name: 'test_management', label: 'Test Management' },
  { name: 'student_report_access', label: 'Student Report Access' },
];

export default function TeacherFeaturePermissions({ teacherId, teacherName }: { teacherId: string; teacherName: string }) {
  const queryClient = useQueryClient();
  const { user } = useAuth(); // Get the current user to pass the access token

  // Fetch teacher's feature permissions
  const { data: permissions = [], isLoading: permissionsLoading } = useQuery({
    queryKey: ['teacher-feature-permissions', teacherId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('teacher_feature_permissions')
        .select('*')
        .eq('teacher_id', teacherId);
      if (error) throw error;
      return data as TeacherFeaturePermission[];
    },
    enabled: !!teacherId,
  });

  // Group permissions by feature_name for easy lookup
  const permissionsByFeature = permissions.reduce((acc, perm) => {
    acc[perm.feature_name] = perm.is_enabled;
    return acc;
  }, {} as Record<string, boolean>);

  // Mutation to update feature permission via Edge Function
  const updatePermissionMutation = useMutation({
    mutationFn: async ({ featureName, isEnabled }: { featureName: string; isEnabled: boolean }) => {
      const { data, error } = await supabase.functions.invoke('center-toggle-teacher-feature', {
        body: { teacherId, featureName, isEnabled },
        headers: {
          Authorization: `Bearer ${(await supabase.auth.getSession())?.data.session?.access_token}`,
        },
      });

      if (error) throw error;
      if (!data.success) throw new Error(data.error || 'Failed to update permission via Edge Function');
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['teacher-feature-permissions', teacherId] });
      toast.success('Teacher feature permission updated successfully!');
    },
    onError: (error: any) => {
      toast.error(error.message || 'Failed to update teacher feature permission');
    },
  });

  const handleToggle = (featureName: string, currentStatus: boolean) => {
    updatePermissionMutation.mutate({ featureName, isEnabled: !currentStatus });
  };

  if (permissionsLoading) {
    return <p>Loading teacher permissions...</p>;
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Manage Features for {teacherName}</CardTitle>
        <DialogDescription>
          Enable or disable specific features for this teacher.
        </DialogDescription>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Feature</TableHead>
              <TableHead className="text-center">Enabled</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {TEACHER_FEATURES.map(feature => {
              const isEnabled = permissionsByFeature[feature.name] ?? true; // Default to true if no explicit setting
              return (
                <TableRow key={feature.name}>
                  <TableCell className="font-medium">{feature.label}</TableCell>
                  <TableCell className="text-center">
                    <Switch
                      checked={isEnabled}
                      onCheckedChange={() => handleToggle(feature.name, isEnabled)}
                      disabled={updatePermissionMutation.isPending}
                    />
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}