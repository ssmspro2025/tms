import React, { createContext, useContext, useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Tables } from '@/integrations/supabase/types';

// Define the User interface based on the new ERP schema
interface User {
  id: string;
  email: string;
  first_name: string;
  last_name: string;
  role: Tables<'users'>['role'];
  tenant_id: string;
  center_id: string | null; // Changed from school_id
  center_name?: string; // Changed from school_name
  student_id?: string | null;
  student_name?: string;
  teacher_id?: string | null;
  teacher_name?: string;
  centerPermissions?: Record<string, boolean>; // For center users
  teacherPermissions?: Record<string, boolean>; // For teacher users
}

interface AuthContextType {
  user: User | null;
  loading: boolean;
  login: (email: string, password: string, role?: Tables<'users'>['role']) => Promise<{ success: boolean; error?: string }>;
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
        if (parsedUser.role === 'center' && parsedUser.center_id) { // Changed from school_admin and school_id
          const { data: permissions, error } = await supabase
            .from('center_feature_permissions')
            .select('feature_name, is_enabled')
            .eq('center_id', parsedUser.center_id); // Changed from school_id
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
    email: string,
    password: string,
    expectedRole?: Tables<'users'>['role']
  ) => {
    try {
      // Call the auth-login Edge Function
      const { data, error: invokeError } = await supabase.functions.invoke('auth-login', {
        body: { username: email, password, role: expectedRole },
      });

      if (invokeError) {
        console.error('Edge Function invocation error:', invokeError);
        return { success: false, error: invokeError.message };
      }

      if (!data.success) {
        return { success: false, error: data.error || 'Login failed' };
      }

      const userData = data.user;

      // Fetch permissions if user is a center or teacher
      let centerPermissions: Record<string, boolean> | undefined;
      let teacherPermissions: Record<string, boolean> | undefined;

      if (userData.role === 'center' && userData.center_id) { // Changed from school_admin and school_id
        const { data: permissions, error } = await supabase
          .from('center_feature_permissions')
          .select('feature_name, is_enabled')
          .eq('center_id', userData.center_id); // Changed from school_id
        if (error) console.error('Error fetching center permissions:', error);
        centerPermissions = permissions?.reduce((acc, p) => ({ ...acc, [p.feature_name]: p.is_enabled }), {});
      } else if (userData.role === 'teacher' && userData.teacher_id) {
        const { data: permissions, error } = await supabase
          .from('teacher_feature_permissions')
          .select('feature_name, is_enabled')
          .eq('teacher_id', userData.teacher_id);
        if (error) console.error('Error fetching teacher permissions:', error);
        teacherPermissions = permissions?.reduce((acc, p) => ({ ...acc, [p.feature_name]: p.is_enabled }), {});
      }

      const currentUser: User = {
        id: userData.id,
        email: userData.email,
        first_name: userData.first_name,
        last_name: userData.last_name,
        role: userData.role,
        tenant_id: userData.tenant_id,
        center_id: userData.center_id, // Changed from school_id
        center_name: userData.center_name, // Changed from school_name
        student_id: userData.student_id,
        student_name: userData.student_name,
        teacher_id: userData.teacher_id,
        teacher_name: userData.teacher_name,
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
    await supabase.auth.signOut(); // Use Supabase's built-in sign out
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