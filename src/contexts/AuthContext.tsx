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
      // Hash password using SHA-256 (same method as backend)
      const hashPassword = async (pwd: string): Promise<string> => {
        const encoder = new TextEncoder();
        const data = encoder.encode(pwd);
        const hashBuffer = await crypto.subtle.digest('SHA-256', data);
        const hashArray = Array.from(new Uint8Array(hashBuffer));
        return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
      };

      const passwordHash = await hashPassword(password);

      // Query user from database
      const { data: user, error: userError } = await supabase
        .from('users')
        .select('*, centers(center_name), students(name), teachers(name)')
        .eq('username', email)
        .eq('is_active', true)
        .single();

      if (userError || !user) {
        console.error('User not found:', userError);
        return { success: false, error: 'Invalid credentials' };
      }

      // Check role if expected
      if (expectedRole && user.role !== expectedRole) {
        return { success: false, error: 'Access denied. Incorrect role.' };
      }

      // Verify password
      console.log('Generated hash:', passwordHash);
      console.log('Stored hash:', user.password_hash);
      if (user.password_hash !== passwordHash) {
        console.error('Password mismatch for user:', email);
        return { success: false, error: 'Invalid credentials' };
      }

      // Update last login
      await supabase
        .from('users')
        .update({ last_login: new Date().toISOString() })
        .eq('id', user.id);

      // Fetch permissions if user is a center or teacher
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

      const currentUser: User = {
        id: user.id,
        email: user.username,
        first_name: user.username,
        last_name: '',
        role: user.role,
        tenant_id: user.id,
        center_id: user.center_id,
        center_name: user.centers?.center_name || undefined,
        student_id: user.student_id,
        student_name: user.students?.name || undefined,
        teacher_id: user.teacher_id,
        teacher_name: user.teachers?.name || undefined,
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
