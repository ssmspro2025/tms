import React, { createContext, useContext, useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Tables } from '@/integrations/supabase/types';
import * as bcrypt from 'bcryptjs';

// Define the User interface based on the new ERP schema
interface User {
  id: string;
  username: string;
  email: string;
  first_name: string;
  last_name: string;
  role: Tables<'users'>['role'];
  tenant_id: string;
  center_id: string | null;
  center_name?: string;
  student_id?: string | null;
  student_name?: string;
  teacher_id?: string | null;
  teacher_name?: string;
  centerPermissions?: Record<string, boolean>;
  teacherPermissions?: Record<string, boolean>;
}

interface AuthContextType {
  user: User | null;
  loading: boolean;
  login: (username: string, password: string, role?: Tables<'users'>['role']) => Promise<{ success: boolean; error?: string }>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadUser = async () => {
      setLoading(true);
      const storedUser = localStorage.getItem('auth_user');
      if (storedUser) {
        const parsedUser: User = JSON.parse(storedUser);
        setUser(parsedUser);
        // Optionally re-fetch permissions to ensure they are up-to-date
        if (parsedUser.role === 'center' && parsedUser.center_id) {
          const { data: permissions, error } = await supabase
            .from('center_feature_permissions')
            .select('feature_name, is_enabled')
            .eq('center_id', parsedUser.center_id);
          if (!error && permissions) {
            const perms = permissions.reduce((acc, p) => ({ ...acc, [p.feature_name]: p.is_enabled }), {});
            setUser(prev => prev ? { ...prev, centerPermissions: perms } : null);
          }
        } else if (parsedUser.role === 'teacher' && parsedUser.teacher_id) {
          const { data: permissions, error } = await supabase
            .from('teacher_feature_permissions')
            .select('feature_name, is_enabled')
            .eq('teacher_id', parsedUser.teacher_id);
          if (!error && permissions) {
            const perms = permissions.reduce((acc, p) => ({ ...acc, [p.feature_name]: p.is_enabled }), {});
            setUser(prev => prev ? { ...prev, teacherPermissions: perms } : null);
          }
        }
      }
      setLoading(false);
    };
    loadUser();
  }, []);

  const login = async (
    username: string,
    password: string,
    expectedRole?: Tables<'users'>['role']
  ) => {
    try {
      // 1. Fetch user by username
      const { data: user, error: userError } = await supabase
        .from('users')
        .select('*, password_hash, centers(center_name), students(name), teachers(name)')
        .eq('username', username)
        .eq('is_active', true)
        .single();

      if (userError || !user) {
        console.error('User not found or inactive:', userError?.message || 'No user data');
        return { success: false, error: 'Invalid credentials' };
      }

      // 2. Role-based access control
      if (expectedRole && user.role !== expectedRole) {
        console.log(`Role mismatch for user: ${username}. Expected ${expectedRole}, but got ${user.role}`);
        return { success: false, error: 'Access denied. Incorrect role.' };
      }

      // 3. Verify password using bcryptjs
      const passwordMatch = await bcrypt.compare(password, user.password_hash);
      
      if (!passwordMatch) {
        console.log('Password verification failed for user:', username);
        return { success: false, error: 'Invalid credentials' };
      }

      // 4. Update last login
      await supabase
        .from('users')
        .update({ last_login: new Date().toISOString() })
        .eq('id', user.id);

      // 5. Fetch permissions if user is a center or teacher
      let centerPermissions: Record<string, boolean> | undefined;
      let teacherPermissions: Record<string, boolean> | undefined;

      if (user.role === 'center' && user.center_id) {
        const { data: permissions, error } = await supabase
          .from('center_feature_permissions')
          .select('feature_name, is_enabled')
          .eq('center_id', user.center_id);
        if (error) console.error('Error fetching center permissions:', error);
        centerPermissions = permissions?.reduce((acc, p) => ({ ...acc, [p.feature_name]: p.is_enabled }), {});
      } else if (user.role === 'teacher' && user.teacher_id) {
        const { data: permissions, error } = await supabase
          .from('teacher_feature_permissions')
          .select('feature_name, is_enabled')
          .eq('teacher_id', user.teacher_id);
        if (error) console.error('Error fetching teacher permissions:', error);
        teacherPermissions = permissions?.reduce((acc, p) => ({ ...acc, [p.feature_name]: p.is_enabled }), {});
      }

      // 6. Construct currentUser object
      const currentUser: User = {
        id: user.id,
        username: user.username,
        email: user.email,
        first_name: user.first_name,
        last_name: user.last_name,
        role: user.role,
        tenant_id: user.tenant_id,
        center_id: user.center_id,
        center_name: user.centers?.center_name || null,
        student_id: user.student_id,
        student_name: user.students?.name || null,
        teacher_id: user.teacher_id,
        teacher_name: user.teachers?.name || null,
        centerPermissions,
        teacherPermissions,
      };

      setUser(currentUser);
      localStorage.setItem('auth_user', JSON.stringify(currentUser));
      return { success: true };
    } catch (error: any) {
      console.error('Login error:', error);
      return { success: false, error: error.message || 'Login failed' };
    }
  };

  const logout = async () => {
    await supabase.auth.signOut();
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