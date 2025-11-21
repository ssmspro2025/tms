import React, { createContext, useContext, useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import * as bcrypt from 'bcryptjs';
import { Tables } from '@/integrations/supabase/types';

type CenterFeaturePermission = Tables<'center_feature_permissions'>;
type TeacherFeaturePermission = Tables<'teacher_feature_permissions'>;

interface User {
  id: string;
  username: string;
  role: 'admin' | 'center' | 'parent' | 'teacher';
  center_id: string | null;
  center_name?: string;
  student_id?: string | null;
  student_name?: string | null;
  teacher_id?: string | null;
  centerPermissions?: Record<string, boolean>; // Feature permissions for the center
  teacherPermissions?: Record<string, boolean>; // Feature permissions for the teacher
}

interface AuthContextType {
  user: User | null;
  loading: boolean;
  login: (username: string, password: string, role?: 'admin' | 'center' | 'parent' | 'teacher') => Promise<{ success: boolean; error?: string }>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const storedUser = localStorage.getItem('auth_user');
    if (storedUser) {
      setUser(JSON.parse(storedUser));
    }
    setLoading(false);
  }, []);

  const login = async (
    username: string,
    password: string,
    role?: 'admin' | 'center' | 'parent' | 'teacher'
  ) => {
    try {
      const { data: userDataFromDb, error: userError } = await supabase
        .from('users')
        .select('id, username, password_hash, role, center_id, student_id, teacher_id, is_active, centers(center_name), students(name)')
        .eq('username', username)
        .eq('is_active', true)
        .single();

      if (userError || !userDataFromDb) {
        console.error('User not found:', userError);
        return { success: false, error: 'Invalid username or password' };
      }

      if (role && userDataFromDb.role !== role) {
        return { success: false, error: 'Invalid username or password' };
      }

      const passwordMatch = await bcrypt.compare(password, userDataFromDb.password_hash);

      if (!passwordMatch) {
        console.error('Password verification failed for user:', username);
        return { success: false, error: 'Invalid username or password' };
      }

      if (role === 'center' && (userDataFromDb.role === 'parent' || userDataFromDb.role === 'teacher')) {
        return { success: false, error: `${userDataFromDb.role} accounts cannot log in to the center dashboard` };
      }

      await supabase
        .from('users')
        .update({ last_login: new Date().toISOString() })
        .eq('id', userDataFromDb.id);

      const currentUser: User = {
        id: userDataFromDb.id,
        username: userDataFromDb.username,
        role: userDataFromDb.role as 'admin' | 'center' | 'parent' | 'teacher',
        center_id: userDataFromDb.center_id,
        center_name: (userDataFromDb.centers as any)?.center_name || undefined,
        student_id: userDataFromDb.student_id,
        student_name: (userDataFromDb.students as any)?.name || undefined,
        teacher_id: userDataFromDb.teacher_id,
      };

      // Fetch permissions based on role
      if (currentUser.role === 'admin') {
        const { data: centerPermissions, error: permError } = await supabase
          .from('center_feature_permissions')
          .select('*');
        if (permError) console.error('Error fetching center permissions for admin:', permError);
        
        // Admin user will have a map of center_id -> { feature_name: is_enabled }
        const adminCenterPerms: Record<string, Record<string, boolean>> = {};
        centerPermissions?.forEach(perm => {
          if (!adminCenterPerms[perm.center_id]) {
            adminCenterPerms[perm.center_id] = {};
          }
          adminCenterPerms[perm.center_id][perm.feature_name] = perm.is_enabled;
        });
        currentUser.centerPermissions = adminCenterPerms as any; // Store as a nested object
      } else if (currentUser.role === 'center' && currentUser.center_id) {
        const { data: centerPermissions, error: permError } = await supabase
          .from('center_feature_permissions')
          .select('*')
          .eq('center_id', currentUser.center_id);
        if (permError) console.error('Error fetching center permissions:', permError);
        
        const centerPermsMap: Record<string, boolean> = {};
        centerPermissions?.forEach(perm => {
          centerPermsMap[perm.feature_name] = perm.is_enabled;
        });
        currentUser.centerPermissions = centerPermsMap;

        // Also fetch teacher permissions for this center's teachers
        const { data: teacherPermissions, error: teacherPermError } = await supabase
          .from('teacher_feature_permissions')
          .select('*, teachers(center_id)')
          .eq('teachers.center_id', currentUser.center_id);
        if (teacherPermError) console.error('Error fetching teacher permissions for center:', teacherPermError);

        const centerTeacherPerms: Record<string, Record<string, boolean>> = {};
        teacherPermissions?.forEach(perm => {
          if (!centerTeacherPerms[perm.teacher_id]) {
            centerTeacherPerms[perm.teacher_id] = {};
          }
          centerTeacherPerms[perm.teacher_id][perm.feature_name] = perm.is_enabled;
        });
        currentUser.teacherPermissions = centerTeacherPerms as any; // Store as nested object
      } else if (currentUser.role === 'teacher' && currentUser.teacher_id) {
        const { data: teacherPermissions, error: permError } = await supabase
          .from('teacher_feature_permissions')
          .select('*')
          .eq('teacher_id', currentUser.teacher_id);
        if (permError) console.error('Error fetching teacher permissions:', permError);
        
        const teacherPermsMap: Record<string, boolean> = {};
        teacherPermissions?.forEach(perm => {
          teacherPermsMap[perm.feature_name] = perm.is_enabled;
        });
        currentUser.teacherPermissions = teacherPermsMap;
      }

      setUser(currentUser);
      localStorage.setItem('auth_user', JSON.stringify(currentUser));
      return { success: true };
    } catch (error: any) {
      console.error('Login error:', error);
      return { success: false, error: error.message || 'Login failed' };
    }
  };

  const logout = () => {
    setUser(null);
    localStorage.removeItem('auth_user');
  };

  return (
    <AuthContext.Provider value={{ user, loading, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};