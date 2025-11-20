import React, { createContext, useContext, useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import * as bcrypt from 'bcryptjs';

interface User {
  id: string;
  username: string;
  role: 'admin' | 'center' | 'parent';
  center_id: string | null;
  center_name?: string;
  student_id?: string | null;
  student_name?: string | null;
}

interface AuthContextType {
  user: User | null;
  loading: boolean;
  login: (username: string, password: string, role?: 'admin' | 'center' | 'parent') => Promise<{ success: boolean; error?: string }>;
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
    role?: 'admin' | 'center' | 'parent'
  ) => {
    try {
      // Query database directly instead of using Edge Function
      const { data: user, error: userError } = await supabase
        .from('users')
        .select('id, username, password_hash, role, center_id, student_id, is_active, centers(center_name), students(name)')
        .eq('username', username)
        .eq('is_active', true)
        .single();

      if (userError || !user) {
        console.error('User not found:', userError);
        return { success: false, error: 'Invalid username or password' };
      }

      // Check if user role matches required role
      if (role && user.role !== role) {
        return { success: false, error: 'Invalid username or password' };
      }

      // Verify password using bcryptjs
      const passwordMatch = await bcrypt.compare(password, user.password_hash);

      if (!passwordMatch) {
        console.error('Password verification failed for user:', username);
        return { success: false, error: 'Invalid username or password' };
      }

      // Restrict parent accounts from logging in to center dashboard
      if (role === 'center' && user.role === 'parent') {
        return { success: false, error: 'Parent accounts cannot log in to the center dashboard' };
      }

      // Update last login
      await supabase
        .from('users')
        .update({ last_login: new Date().toISOString() })
        .eq('id', user.id);

      // Prepare user data
      const userData: User = {
        id: user.id,
        username: user.username,
        role: user.role as 'admin' | 'center' | 'parent',
        center_id: user.center_id,
        center_name: (user.centers as any)?.center_name || undefined,
        student_id: user.student_id,
        student_name: (user.students as any)?.name || undefined
      };

      setUser(userData);
      localStorage.setItem('auth_user', JSON.stringify(userData));
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
