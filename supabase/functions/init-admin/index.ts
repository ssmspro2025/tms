import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.80.0';
import * as bcrypt from "https://esm.sh/bcryptjs"; // Import bcryptjs via esm.sh for Deno

const corsHeaders: Record<string,string> = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET,POST,PUT,PATCH,DELETE,OPTIONS',
  'Access-Control-Allow-Headers': 'Authorization,Content-Type,authorization, x-client-info, apikey',
  'Access-Control-Expose-Headers': 'Content-Type'
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Check if admin exists
    const { data: existingAdmin } = await supabase
      .from('users')
      .select('id')
      .eq('username', 'sujan1nepal@gmail.com')
      .eq('role', 'admin')
      .single();

    if (existingAdmin) {
      return new Response(
        JSON.stringify({ success: true, message: 'Admin already exists' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Hash the password "precioussn" using bcryptjs
    const passwordHash = await bcrypt.hash('precioussn', 12);

    // Create admin user
    const { data: admin, error } = await supabase
      .from('users')
      .insert({
        username: 'sujan1nepal@gmail.com',
        password_hash: passwordHash,
        role: 'admin',
        center_id: null,
        is_active: true
      })
      .select()
      .single();

    if (error) throw error;

    console.log('Admin user created successfully');

    return new Response(
      JSON.stringify({ success: true, message: 'Admin user created', admin: { id: admin.id, username: admin.username } }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error: any) {
    console.error('Init admin error:', error);
    return new Response(
      JSON.stringify({ success: false, error: error.message }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
    );
  }
});