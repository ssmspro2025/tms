import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.80.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { teacherId, featureName, isEnabled } = await req.json();

    const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

    if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
      throw new Error("Supabase environment variables not configured");
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // Authenticate the user making the request
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const token = authHeader.split(" ")[1];
    const { data: { user: authUser }, error: authError } = await supabase.auth.getUser(token);

    if (authError || !authUser) {
      console.error("Auth error:", authError);
      return new Response(JSON.stringify({ error: "Authentication failed" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Verify user role and center_id from public.users table
    const { data: dbUser, error: dbUserError } = await supabase
      .from('users')
      .select('role, center_id')
      .eq('id', authUser.id)
      .single();

    if (dbUserError || dbUser?.role !== 'center' || !dbUser.center_id) {
      console.error("User role/center check failed:", dbUserError);
      return new Response(JSON.stringify({ error: "Access denied: Not an authorized center user" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Verify that the teacher belongs to the authenticated center user's center
    const { data: teacherData, error: teacherError } = await supabase
      .from('teachers')
      .select('center_id')
      .eq('id', teacherId)
      .single();

    if (teacherError || teacherData?.center_id !== dbUser.center_id) {
      console.error("Teacher center mismatch:", teacherError);
      return new Response(JSON.stringify({ error: "Access denied: Teacher does not belong to your center" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Perform the upsert using the service role key
    const { data, error } = await supabase
      .from("teacher_feature_permissions")
      .upsert(
        { teacher_id: teacherId, feature_name: featureName, is_enabled: isEnabled },
        { onConflict: "teacher_id, feature_name" }
      )
      .select()
      .single();

    if (error) throw error;

    return new Response(JSON.stringify({ success: true, data }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Error in center-toggle-teacher-feature:", error);
    return new Response(
      JSON.stringify({ success: false, error: error.message || "Unknown error" }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});