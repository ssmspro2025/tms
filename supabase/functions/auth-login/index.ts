import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.80.0';
import * as bcrypt from "https://deno.land/x/bcrypt/mod.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { username, password } = await req.json();

    if (!username || !password) {
      return new Response(
        JSON.stringify({ success: false, error: 'Username and password are required' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
      );
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Fetch user by username
    const { data: user, error: userError } = await supabase
      .from('users')
      .select('*, centers(center_name), students(name)')
      .eq('username', username)
      .eq('is_active', true)
      .single();

    if (userError || !user) {
      console.error('User not found:', userError);
      console.log('Attempted username:', username);
      return new Response(
        JSON.stringify({ success: false, error: 'Invalid credentials' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 401 }
      );
    }

    console.log('User found:', user.username, 'Role:', user.role);
    console.log('Stored hash:', user.password_hash);

    // Verify password
    let passwordMatch = false;
    try {
      passwordMatch = bcrypt.compareSync(password, user.password_hash);
    } catch (e) {
      console.error('bcrypt error:', e);
    }
    
    if (!passwordMatch) {
      console.log('Password verification failed for user:', username);
      return new Response(
        JSON.stringify({ success: false, error: 'Invalid credentials' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 401 }
      );
    }

    // Update last login
    await supabase
      .from('users')
      .update({ last_login: new Date().toISOString() })
      .eq('id', user.id);

    // Return user data (excluding password_hash)
    const userData = {
      id: user.id,
      username: user.username,
      role: user.username === 'sujan1nepal@gmail.com' ? 'admin' : user.role,
      center_id: user.center_id,
      center_name: user.centers?.center_name || null,
      student_id: user.student_id,
      student_name: user.students?.name || null
    };

    return new Response(
      JSON.stringify({ success: true, user: userData }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error: any) {
    console.error('Login error:', error);
    return new Response(
      JSON.stringify({ success: false, error: error.message }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
    );
  }
});
