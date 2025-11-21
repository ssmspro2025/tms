import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.7.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

    if (!LOVABLE_API_KEY || !SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
      throw new Error("Required environment variables not configured");
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // Fetch all students with their data
    const { data: students, error: studentsError } = await supabase
      .from("students")
      .select("*");

    if (studentsError) throw studentsError;

    // Fetch attendance data
    const { data: attendance, error: attendanceError } = await supabase
      .from("attendance")
      .select("*")
      .gte("date", new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()); // Last 30 days

    if (attendanceError) throw attendanceError;

    // Fetch test results
    const { data: testResults, error: testResultsError } = await supabase
      .from("test_results")
      .select("*, tests(*)");

    if (testResultsError) throw testResultsError;

    // Fetch chapter completion
    const { data: chapterProgress, error: chapterError } = await supabase
      .from("student_chapters")
      .select("*, chapters(*)");

    if (chapterError) throw chapterError;

    // Prepare data summary for AI
    const studentsSummary = students.map(student => {
      const studentAttendance = attendance.filter(a => a.student_id === student.id);
      const presentCount = studentAttendance.filter(a => a.status === "Present").length;
      const attendanceRate = studentAttendance.length > 0 
        ? (presentCount / studentAttendance.length * 100).toFixed(1) 
        : 0;

      const studentTests = testResults.filter(tr => tr.student_id === student.id);
      const avgScore = studentTests.length > 0
        ? (studentTests.reduce((sum, tr) => sum + (tr.marks_obtained / (tr.tests?.total_marks || 1) * 100), 0) / studentTests.length).toFixed(1)
        : 0;

      const completedChapters = chapterProgress.filter(
        cp => cp.student_id === student.id && cp.completed
      ).length;

      return {
        name: student.name,
        grade: student.grade,
        attendanceRate: `${attendanceRate}%`,
        averageScore: `${avgScore}%`,
        completedChapters,
        recentTests: studentTests.slice(-3).map(tr => ({
          subject: tr.tests?.subject,
          score: `${tr.marks_obtained}/${tr.tests?.total_marks}`
        }))
      };
    });

    const systemPrompt = `You are an educational AI assistant analyzing student performance data. Generate actionable insights for teachers.

Focus on:
1. Students who need immediate attention (low attendance or poor grades)
2. High-performing students who could be challenged more
3. Common struggling areas across subjects
4. Specific actionable recommendations for each student

Return a JSON object with this structure:
{
  "overallInsights": "<general observations about the class>",
  "studentsNeedingAttention": [
    {
      "name": "<student name>",
      "issues": ["<issue 1>", "<issue 2>"],
      "recommendations": "<specific actions>"
    }
  ],
  "highPerformers": ["<student names>"],
  "commonChallenges": ["<challenge 1>", "<challenge 2>"],
  "actionableRecommendations": ["<recommendation 1>", "<recommendation 2>"]
}`;

    const userPrompt = `Analyze this student performance data and generate insights:

${JSON.stringify(studentsSummary, null, 2)}

Provide comprehensive insights and recommendations.`;

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt }
        ],
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(JSON.stringify({ error: "Rate limit exceeded. Please try again later." }), {
          status: 429,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (response.status === 402) {
        return new Response(JSON.stringify({ error: "AI credits depleted. Please add funds." }), {
          status: 402,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      throw new Error("AI gateway error");
    }

    const data = await response.json();
    const aiResponse = data.choices[0].message.content;
    
    // Parse the JSON response
    let result;
    try {
      result = JSON.parse(aiResponse);
    } catch (e) {
      const jsonMatch = aiResponse.match(/```json\n([\s\S]*?)\n```/);
      if (jsonMatch) {
        result = JSON.parse(jsonMatch[1]);
      } else {
        result = JSON.parse(aiResponse.replace(/```json|```/g, '').trim());
      }
    }

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Error in ai-generate-insights:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});