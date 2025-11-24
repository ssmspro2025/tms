import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.80.0';
import * as bcrypt from "bcryptjs";

const corsHeaders = {
  'Access-Control-Allow-Origin': 'https://classms.netlify.app', // Changed from '*' to specific origin
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  console.log('--- Auth login function received request ---'); // Added this line to force redeployment
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log('Auth login function started.');
    const { username, password } = await req.json();
    console.log('Received login request for username:', username);

    if (!username || !password) {
      console.error('Missing username or password.');
      return new Response(
        JSON.stringify({ success: false, error: 'Username and password are required' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
      );
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // 1. Fetch user by username
    console.log('Fetching user from database...');
    const { data: user, error: userError } = await supabase
      .from('users')
      .select('*, password_hash, centers(center_name), students(name), teachers(name)')
      .eq('username', username)
      .eq('is_active', true)
      .single();

    if (userError || !user) {
      console.error('User not found or inactive:', userError?.message || 'No user data');
      return new Response(
        JSON.stringify({ success: false, error: 'Invalid credentials' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 401 }
      );
    }
    console.log('User found:', user.id, user.role);

    // 2. Verify password using bcryptjs
    console.log('Verifying password...');
    const passwordMatch = await bcrypt.compare(password, user.password_hash);
    
    if (!passwordMatch) {
      console.log('Password verification failed for user:', username);
      return new Response(
        JSON.stringify({ success: false, error: 'Invalid credentials' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 401 }
      );
    }
    console.log('Password verified.');

    // 3. Update last login
    console.log('Updating last login...');
    const { error: updateLastLoginError } = await supabase
      .from('users')
      .update({ last_login: new Date().toISOString() })
      .eq('id', user.id);
    if (updateLastLoginError) console.error('Error updating last login:', updateLastLoginError);
    console.log('Last login updated (if no error).');

    // 4. Fetch permissions if user is a center or teacher
    let centerPermissions: Record<string, boolean> | undefined;
    let teacherPermissions: Record<string, boolean> | undefined;

    if (user.role === 'center' && user.center_id) {
      console.log('Fetching center permissions...');
      const { data: permissions, error } = await supabase
        .from('center_feature_permissions')
        .select('feature_name, is_enabled')
        .eq('center_id', user.center_id);
      if (error) console.error('Error fetching center permissions:', error);
      centerPermissions = permissions?.reduce((acc, p) => ({ ...acc, [p.feature_name]: p.is_enabled }), {});
      console.log('Center permissions fetched.');
    } else if (user.role === 'teacher' && user.teacher_id) {
      console.log('Fetching teacher permissions...');
      const { data: permissions, error } = await supabase
        .from('teacher_feature_permissions')
        .select('feature_name, is_enabled')
        .eq('teacher_id', user.teacher_id);
      if (error) console.error('Error fetching teacher permissions:', error);
      teacherPermissions = permissions?.reduce((acc, p) => ({ ...acc, [p.feature_name]: p.is_enabled }), {});
      console.log('Teacher permissions fetched.');
    }

    // 5. Construct currentUser object to send back
    console.log('Constructing currentUser object...');
    const currentUser = {
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
    console.log('currentUser object constructed.');

    console.log('Returning successful response.');
    return new Response(
      JSON.stringify({ success: true, user: currentUser }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error: any) {
    console.error('Auth login function caught an unexpected error:', error);
    return new Response(
      JSON.stringify({ success: false, error: error.message || 'Authentication failed' }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
    );
  }
});