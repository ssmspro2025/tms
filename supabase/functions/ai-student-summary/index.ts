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
    const { studentId } = await req.json();

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

    if (!LOVABLE_API_KEY || !SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
      throw new Error("Required environment variables not configured");
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // Fetch student info
    const { data: student, error: studentError } = await supabase
      .from("students")
      .select("*")
      .eq("id", studentId)
      .single();

    if (studentError) throw studentError;

    // Fetch attendance (last 30 days)
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
    const { data: attendance, error: attendanceError } = await supabase
      .from("attendance")
      .select("*")
      .eq("student_id", studentId)
      .gte("date", thirtyDaysAgo);

    if (attendanceError) throw attendanceError;

    // Calculate attendance rate
    const presentCount = attendance.filter(a => a.status === "Present").length;
    const attendanceRate = attendance.length > 0 
      ? (presentCount / attendance.length * 100).toFixed(1)
      : 0;

    // Fetch test results
    const { data: testResults, error: testResultsError } = await supabase
      .from("test_results")
      .select("*, tests(*)")
      .eq("student_id", studentId)
      .order("date_taken", { ascending: false });

    if (testResultsError) throw testResultsError;

    // Calculate test statistics
    const testsBySubject = testResults.reduce((acc, tr) => {
      const subject = tr.tests?.subject || "Unknown";
      if (!acc[subject]) acc[subject] = [];
      acc[subject].push({
        marks: tr.marks_obtained,
        total: tr.tests?.total_marks || 0,
        percentage: (tr.marks_obtained / (tr.tests?.total_marks || 1) * 100).toFixed(1)
      });
      return acc;
    }, {} as Record<string, any[]>);

    const avgScore = testResults.length > 0
      ? (testResults.reduce((sum, tr) => sum + (tr.marks_obtained / (tr.tests?.total_marks || 1) * 100), 0) / testResults.length).toFixed(1)
      : 0;

    // Fetch chapter completion
    const { data: chapterProgress, error: chapterError } = await supabase
      .from("student_chapters")
      .select("*, chapters(*)")
      .eq("student_id", studentId);

    if (chapterError) throw chapterError;

    const completedChapters = chapterProgress.filter(cp => cp.completed).length;
    const totalChapters = chapterProgress.length;

    const systemPrompt = `You are an educational AI assistant generating comprehensive student performance summaries.

Create a natural, professional summary that includes:
1. Overall performance assessment
2. Attendance pattern analysis
3. Academic strengths and weaknesses by subject
4. Specific areas needing improvement
5. Personalized recommendations for the student

Write in a clear, encouraging tone that's suitable for parent-teacher discussions.`;

    const userPrompt = `Generate a performance summary for:

Student: ${student.name} (Grade ${student.grade})

Attendance (Last 30 days):
- Rate: ${attendanceRate}%
- Present: ${presentCount} days
- Total: ${attendance.length} days

Test Performance:
- Average Score: ${avgScore}%
- Tests Taken: ${testResults.length}
- Performance by Subject:
${Object.entries(testsBySubject).map(([subject, tests]) => {
  const testsArray = tests as any[];
  const subjectAvg = (testsArray.reduce((sum: number, t: any) => sum + parseFloat(t.percentage), 0) / testsArray.length).toFixed(1);
  return `  ${subject}: ${subjectAvg}% (${testsArray.length} tests)`;
}).join('\n')}

Chapter Progress:
- Completed: ${completedChapters}/${totalChapters} chapters
- Completion Rate: ${totalChapters > 0 ? (completedChapters / totalChapters * 100).toFixed(1) : 0}%

Recent Test Results:
${testResults.slice(0, 5).map(tr => 
  `- ${tr.tests?.name} (${tr.tests?.subject}): ${tr.marks_obtained}/${tr.tests?.total_marks}`
).join('\n')}

Generate a comprehensive performance summary.`;

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
    const summary = data.choices[0].message.content;

    // Save summary to database
    await supabase.from("ai_summaries").insert({
      student_id: studentId,
      summary_text: summary,
      summary_type: "performance",
    });

    return new Response(JSON.stringify({ summary }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Error in ai-student-summary:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});