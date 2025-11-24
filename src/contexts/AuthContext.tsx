import React, { createContext, useContext, useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Tables } from '@/integrations/supabase/types';
// Removed bcrypt import as it's now handled in the Edge Function

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
        // Permissions are now fetched by the Edge Function during login,
        // but we can keep this for initial load if needed, or remove for simplicity.
        // For now, let's assume the stored user has the latest permissions.
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
    console.log('AuthContext: login function called');
    try {
      console.log('AuthContext: Preparing to invoke auth-login Edge Function...'); // Added this line
      const { data, error: invokeError } = await supabase.functions.invoke('auth-login', {
        body: { username, password },
      });
      console.log('AuthContext: Edge Function invocation completed.');

      if (invokeError) {
        console.error('AuthContext: Edge Function invocation error:', invokeError);
        // Log the full error object for more details
        console.error('AuthContext: Full invokeError object:', JSON.stringify(invokeError, null, 2));
        return { success: false, error: invokeError.message || 'Login failed' };
      }

      if (!data.success) {
        console.error('AuthContext: Login failed from Edge Function:', data.error);
        return { success: false, error: data.error || 'Login failed' };
      }

      const loggedInUser: User = data.user;
      console.log('AuthContext: User logged in successfully:', loggedInUser.username);

      // 2. Role-based access control (now done client-side after Edge Function returns user)
      if (expectedRole && loggedInUser.role !== expectedRole) {
        console.log(`AuthContext: Role mismatch for user: ${username}. Expected ${expectedRole}, but got ${loggedInUser.role}`);
        return { success: false, error: 'Access denied. Incorrect role.' };
      }

      setUser(loggedInUser);
      localStorage.setItem('auth_user', JSON.stringify(loggedInUser));
      console.log('AuthContext: User state updated and stored in localStorage.');
      return { success: true };
    } catch (error: any) {
      console.error('AuthContext: Login error caught in client-side:', error);
      // Log the full error object for more details
      console.error('AuthContext: Full client-side error object:', JSON.stringify(error, null, 2));
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