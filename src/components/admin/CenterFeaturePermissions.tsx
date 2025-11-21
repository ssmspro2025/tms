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

type Center = Tables<'centers'>;
type CenterFeaturePermission = Tables<'center_feature_permissions'>;

const FEATURES = [
  { name: 'register_student', label: 'Register Student' },
  { name: 'take_attendance', label: 'Take Attendance' },
  { name: 'attendance_summary', label: 'Attendance Summary' },
  { name: 'lesson_plans', label: 'Lesson Plans' },
  { name: 'lesson_tracking', label: 'Lesson Tracking' },
  { name: 'homework', label: 'Homework Management' },
  { name: 'activities', label: 'Preschool Activities' },
  { name: 'discipline', label: 'Discipline Issues' },
  { name: 'teachers', label: 'Teacher Management' },
  { name: 'teacher_attendance', label: 'Teacher Attendance' },
  { name: 'tests', label: 'Test Management' },
  { name: 'student_report', label: 'Student Report' },
  { name: 'ai_insights', label: 'AI Insights' },
  { name: 'view_records', label: 'View Records' },
  { name: 'summary', label: 'Summary' },
  { name: 'finance', label: 'Finance Management' },
];

export default function CenterFeaturePermissions() {
  const queryClient = useQueryClient();
  const { user } = useAuth(); // Get the current user to pass the access token

  // Fetch all centers
  const { data: centers = [], isLoading: centersLoading } = useQuery({
    queryKey: ['admin-centers'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('centers')
        .select('*')
        .order('center_name');
      if (error) throw error;
      return data as Center[];
    },
  });

  // Fetch all center feature permissions
  const { data: permissions = [], isLoading: permissionsLoading } = useQuery({
    queryKey: ['center-feature-permissions'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('center_feature_permissions')
        .select('*');
      if (error) throw error;
      return data as CenterFeaturePermission[];
    },
  });

  // Group permissions by center_id for easy lookup
  const permissionsByCenter = permissions.reduce((acc, perm) => {
    if (!acc[perm.center_id]) {
      acc[perm.center_id] = {};
    }
    acc[perm.center_id][perm.feature_name] = perm.is_enabled;
    return acc;
  }, {} as Record<string, Record<string, boolean>>);

  // Mutation to update feature permission via Edge Function
  const updatePermissionMutation = useMutation({
    mutationFn: async ({ centerId, featureName, isEnabled }: { centerId: string; featureName: string; isEnabled: boolean }) => {
      const { data, error } = await supabase.functions.invoke('admin-toggle-center-feature', {
        body: { centerId, featureName, isEnabled },
        headers: {
          Authorization: `Bearer ${(await supabase.auth.getSession())?.data.session?.access_token}`,
        },
      });

      if (error) throw error;
      if (!data.success) throw new Error(data.error || 'Failed to update permission via Edge Function');
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['center-feature-permissions'] });
      toast.success('Feature permission updated successfully!');
    },
    onError: (error: any) => {
      toast.error(error.message || 'Failed to update feature permission');
    },
  });

  const handleToggle = (centerId: string, featureName: string, currentStatus: boolean) => {
    updatePermissionMutation.mutate({ centerId, featureName, isEnabled: !currentStatus });
  };

  if (centersLoading || permissionsLoading) {
    return <p>Loading feature permissions...</p>;
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Manage Center Feature Permissions</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="sticky left-0 bg-background z-10">Center Name</TableHead>
                {FEATURES.map(feature => (
                  <TableHead key={feature.name} className="text-center min-w-[120px]">{feature.label}</TableHead>
                ))}
              </TableRow>
            </TableHeader>
            <TableBody>
              {centers.map(center => (
                <TableRow key={center.id}>
                  <TableCell className="font-medium sticky left-0 bg-card z-10">{center.center_name}</TableCell>
                  {FEATURES.map(feature => {
                    const isEnabled = permissionsByCenter[center.id]?.[feature.name] ?? true; // Default to true if no explicit setting
                    return (
                      <TableCell key={feature.name} className="text-center">
                        <Switch
                          checked={isEnabled}
                          onCheckedChange={() => handleToggle(center.id, feature.name, isEnabled)}
                          disabled={updatePermissionMutation.isPending}
                        />
                      </TableCell>
                    );
                  })}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  );
}