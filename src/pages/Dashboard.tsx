// src/pages/dashboard/dashboard.tsx
import React, { useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableRow, TableCell, TableHead, TableHeader } from "@/components/ui/table";
import { Label } from "@/components/ui/label";
import { Users, CheckCircle2, XCircle, TrendingUp, Calendar as CalendarIcon, Plus, FileText } from "lucide-react";
import { format, startOfMonth, endOfMonth, eachDayOfInterval } from "date-fns";
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  PieChart,
  Pie,
  Cell,
} from "recharts";

/**
 * Center Dashboard
 * - Full feature center dashboard
 * - Uses robust attendance fetching (date eq OR timestamp range)
 * - All queries filter by user's center_id
 *
 * Sections:
 *  1) Header + actions
 *  2) Summary cards (total, present, absent, rate)
 *  3) Today attendance table
 *  4) Monthly chart & class-wise distribution
 *  5) Recent activities
 *  6) Summary stats & center profile
 */

const COLORS = ["#10b981", "#ef4444", "#f3f4f6"]; // present, absent, none

export default function Dashboard() {
  const { user, loading } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  // Access control — center only (admins should use AdminDashboard)
  if (loading) return <p>Loading dashboard...</p>;
  if (!user) return <p>Not authenticated</p>;
  if (user.role === "admin") return <p>Admins should use the Admin Dashboard.</p>;

  const centerId = user.center_id;
  const today = new Date().toISOString().split("T")[0]; // YYYY-MM-DD

  // ---------- Helpers: robust attendance fetcher ----------
  // Returns attendance rows for a given date and centerId.
  // Tries date equality first (works for `date` column). If none, falls back to UTC timestamp range.
  async function fetchAttendanceForDate(dateStr: string, centerId?: string) {
    if (!centerId) return [];
    // parse
    const [y, m, d] = dateStr.split("-").map((v) => parseInt(v, 10));
    const startUtc = new Date(Date.UTC(y, m - 1, d, 0, 0, 0, 0)).toISOString();
    const endUtc = new Date(Date.UTC(y, m - 1, d, 23, 59, 59, 999)).toISOString();

    // try exact date equality first
    try {
      const { data: rowsEq, error: errEq } = await supabase
        .from("attendance")
        .select("id, student_id, status, date, time_in, time_out, center_id, created_at")
        .eq("date", dateStr)
        .eq("center_id", centerId);

      if (!errEq && rowsEq && rowsEq.length > 0) {
        return rowsEq;
      }
    } catch (e) {
      // continue to timestamp fallback
      console.warn("attendance eq(date) failed:", e);
    }

    // fallback: timestamp range
    const { data: rowsRange, error: errRange } = await supabase
      .from("attendance")
      .select("id, student_id, status, date, time_in, time_out, center_id, created_at")
      .gte("date", startUtc)
      .lte("date", endUtc)
      .eq("center_id", centerId);

    if (errRange) throw errRange;
    return rowsRange || [];
  }

  // ---------- Query 1: students for this center ----------
  const { data: students = [], isLoading: studentsLoading } = useQuery({
    queryKey: ["students", centerId],
    queryFn: async () => {
      if (!centerId) return [];
      const { data, error } = await supabase
        .from("students")
        .select("id, name, grade, is_active, created_at")
        .eq("center_id", centerId)
        .order("name", { ascending: true });
      if (error) throw error;
      return data;
    },
    enabled: !!centerId,
  });

  // ---------- Query 2: students count (cached) ----------
  const { data: studentsCount = 0 } = useQuery({
    queryKey: ["students-count", centerId],
    queryFn: async () => {
      if (!centerId) return 0;
      const { count, error } = await supabase
        .from("students")
        .select("*", { count: "exact", head: true })
        .eq("center_id", centerId);
      if (error) throw error;
      return count || 0;
    },
    enabled: !!centerId,
  });

  // ---------- Query 3: today's attendance (robust) ----------
  const { data: todayAttendance = [], isLoading: loadingTodayAttendance } = useQuery({
    queryKey: ["today-attendance", today, centerId],
    queryFn: async () => {
      if (!centerId) return [];
      return await fetchAttendanceForDate(today, centerId);
    },
    enabled: !!centerId,
    staleTime: 1000 * 30,
  });

  // ---------- Query 4: attendance for current month (for chart) ----------
  const currentMonthKey = format(new Date(), "yyyy-MM");
  const { data: monthlyAttendance = [], isLoading: loadingMonthlyAttendance } = useQuery({
    queryKey: ["attendance-month", currentMonthKey, centerId],
    queryFn: async () => {
      if (!centerId) return [];
      const start = format(startOfMonth(new Date()), "yyyy-MM-dd");
      const end = format(endOfMonth(new Date()), "yyyy-MM-dd");

      // get student ids for center
      const studentIds = (students || []).map((s: any) => s.id);
      if (studentIds.length === 0) return [];

      const { data, error } = await supabase
        .from("attendance")
        .select("id, student_id, status, date")
        .in("student_id", studentIds)
        .gte("date", start)
        .lte("date", end)
        .order("date", { ascending: true });

      if (error) throw error;
      return data || [];
    },
    enabled: students.length > 0,
    staleTime: 1000 * 60 * 2,
  });

  // ---------- Query 5: recent activities ----------
  const { data: recentActivities = [], isLoading: loadingRecentActivities } = useQuery({
    queryKey: ["recent-activities", centerId],
    queryFn: async () => {
      if (!centerId) return [];
      const { data, error } = await supabase
        .from("attendance")
        .select("id, student_id, status, date, time_in, time_out, created_at")
        .eq("center_id", centerId)
        .order("created_at", { ascending: false })
        .limit(10);
      if (error) throw error;
      return data || [];
    },
    enabled: !!centerId,
  });

  // ---------- Derived stats ----------
  const presentCount = useMemo(() => {
    return (todayAttendance || []).filter((r: any) => String(r.status).toLowerCase() === "present").length;
  }, [todayAttendance]);

  const absentCount = useMemo(() => {
    return (todayAttendance || []).filter((r: any) => String(r.status).toLowerCase() === "absent").length;
  }, [todayAttendance]);

  const attendanceRate = studentsCount ? Math.round((presentCount / studentsCount) * 100) : 0;

  // Students added this month
  const studentsAddedThisMonth = useMemo(() => {
    const start = startOfMonth(new Date());
    return (students || []).filter((s: any) => new Date(s.created_at) >= start).length;
  }, [students]);

  // Active vs inactive students
  const activeCount = useMemo(() => (students || []).filter((s: any) => s.is_active).length, [students]);
  const inactiveCount = useMemo(() => (students || []).filter((s: any) => !s.is_active).length, [students]);

  // Class-wise distribution from students list
  const classDistribution = useMemo(() => {
    const map = new Map<string, { grade: string; count: number }>();
    (students || []).forEach((s: any) => {
      const g = s.grade || "Unknown";
      const prev = map.get(g);
      map.set(g, { grade: g, count: (prev?.count || 0) + 1 });
    });
    return Array.from(map.values()).sort((a, b) => (a.grade > b.grade ? 1 : -1));
  }, [students]);

  // Prepare monthly chart data: days of current month => number present per day
  const monthlyChartData = useMemo(() => {
    const start = startOfMonth(new Date());
    const end = endOfMonth(new Date());
    const days = eachDayOfInterval({ start, end });
    const data: any[] = days.map((d) => {
      const dateKey = format(d, "yyyy-MM-dd");
      const present = (monthlyAttendance || []).filter((r: any) => {
        // handle record date possibly being timestamp or date string
        const recordDate = format(new Date(r.date), "yyyy-MM-dd");
        return recordDate === dateKey && String(r.status).toLowerCase() === "present";
      }).length;
      return { date: format(d, "d"), present };
    });
    return data;
  }, [monthlyAttendance]);

  // Class-wise pie chart data
  const classPieData = useMemo(() => {
    return classDistribution.map((c) => ({ name: c.grade, value: c.count }));
  }, [classDistribution]);

  // Utility: fetch student name map
  const studentNameMap = useMemo(() => {
    const m = new Map<string, string>();
    (students || []).forEach((s: any) => m.set(s.id, s.name));
    return m;
  }, [students]);

  // ---------- Quick actions handlers ----------
  const handleMarkAttendance = () => {
    navigate("/take-attendance");
  };

  const handleAddStudent = () => {
    navigate("/students/new");
  };

  const handleViewReports = () => {
    navigate("/attendance-report");
  };

  // ---------- Mutations (optional quick actions) ----------
  const refreshAll = async () => {
    queryClient.invalidateQueries();
  };

  // ---------- UI Rendering ----------
  return (
    <div className="min-h-screen bg-background p-6">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header + Actions */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold">Center Dashboard</h1>
            <p className="text-muted-foreground">Overview of your center's attendance & students</p>
          </div>

          <div className="flex items-center gap-3">
            <Button variant="ghost" onClick={refreshAll}>Refresh</Button>
            <Button onClick={handleMarkAttendance}>
              <CalendarIcon className="h-4 w-4 mr-2" /> Mark Attendance
            </Button>
            <Button onClick={handleAddStudent}>
              <Plus className="h-4 w-4 mr-2" /> Add Student
            </Button>
            <Button onClick={handleViewReports}>
              <FileText className="h-4 w-4 mr-2" /> Reports
            </Button>
          </div>
        </div>

        {/* Summary Cards */}
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <Card>
            <CardHeader className="flex items-center justify-between">
              <CardTitle>Total Students</CardTitle>
              <Users className="h-5 w-5" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{studentsCount}</div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex items-center justify-between">
              <CardTitle>Present Today</CardTitle>
              <CheckCircle2 className="h-5 w-5 text-green-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{presentCount}</div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex items-center justify-between">
              <CardTitle>Absent Today</CardTitle>
              <XCircle className="h-5 w-5 text-red-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{absentCount}</div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex items-center justify-between">
              <CardTitle>Attendance Rate</CardTitle>
              <TrendingUp className="h-5 w-5" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{attendanceRate}%</div>
            </CardContent>
          </Card>
        </div>

        {/* Two-column: Today's Attendance table (left) + Charts & class distribution (right) */}
        <div className="grid gap-4 md:grid-cols-3">
          {/* Left: Today's Attendance Table (spans 2 cols) */}
          <div className="md:col-span-2 space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Today's Attendance — {format(new Date(today), "PPP")}</CardTitle>
                <CardDescription>Markings recorded for today</CardDescription>
              </CardHeader>
              <CardContent>
                {loadingTodayAttendance || studentsLoading ? (
                  <p>Loading attendance...</p>
                ) : (students || []).length === 0 ? (
                  <p className="text-center text-muted-foreground">No students registered yet.</p>
                ) : (
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Student</TableHead>
                          <TableHead>Grade</TableHead>
                          <TableHead>Time In</TableHead>
                          <TableHead>Time Out</TableHead>
                          <TableHead>Status</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {students.map((s: any) => {
                          const rec = (todayAttendance || []).find((r: any) => String(r.student_id) === String(s.id));
                          const status = rec ? (String(rec.status).toLowerCase() === "present" ? "Present" : "Absent") : "No record";
                          return (
                            <TableRow key={s.id}>
                              <TableCell className="font-medium">{s.name}</TableCell>
                              <TableCell>{s.grade || "-"}</TableCell>
                              <TableCell>{rec?.time_in || "-"}</TableCell>
                              <TableCell>{rec?.time_out || "-"}</TableCell>
                              <TableCell>
                                <span className={`px-2 py-1 rounded-full text-xs ${status === "Present" ? "bg-green-100 text-green-700" : status === "Absent" ? "bg-red-100 text-red-700" : "bg-gray-100 text-gray-700"}`}>
                                  {status}
                                </span>
                              </TableCell>
                            </TableRow>
                          );
                        })}
                      </TableBody>
                    </Table>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Recent Activities */}
            <Card>
              <CardHeader>
                <CardTitle>Recent Activities</CardTitle>
                <CardDescription>Latest attendance entries</CardDescription>
              </CardHeader>
              <CardContent>
                {loadingRecentActivities ? (
                  <p>Loading activities...</p>
                ) : recentActivities.length === 0 ? (
                  <p className="text-muted-foreground">No recent attendance activity.</p>
                ) : (
                  <div className="space-y-2">
                    {recentActivities.map((a: any) => (
                      <div key={a.id} className="flex items-center justify-between border rounded p-2">
                        <div>
                          <div className="font-medium">{studentNameMap.get(a.student_id) || "Unknown"}</div>
                          <div className="text-xs text-muted-foreground">{format(new Date(a.created_at), "PPP p")}</div>
                        </div>
                        <div className="text-right">
                          <div className={`font-semibold ${String(a.status).toLowerCase() === "present" ? "text-green-600" : "text-red-600"}`}>
                            {a.status}
                          </div>
                          <div className="text-xs text-muted-foreground">{a.time_in ? `In: ${a.time_in}` : ""} {a.time_out ? ` Out: ${a.time_out}` : ""}</div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Right column: Monthly Chart + Class Distribution + Profile */}
          <div className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Monthly Attendance (Present per day)</CardTitle>
                <CardDescription>{format(new Date(), "MMMM yyyy")}</CardDescription>
              </CardHeader>
              <CardContent>
                {loadingMonthlyAttendance ? (
                  <p>Loading chart...</p>
                ) : (
                  <div style={{ width: "100%", height: 220 }}>
                    <ResponsiveContainer>
                      <BarChart data={monthlyChartData}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis dataKey="date" />
                        <YAxis />
                        <Tooltip />
                        <Legend />
                        <Bar dataKey="present" fill="#10b981" name="Present" />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Class-wise Distribution</CardTitle>
                <CardDescription>Students per grade</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="flex gap-4 items-center">
                  <div style={{ width: 160, height: 160 }}>
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie data={classPieData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={60} label>
                          {classPieData.map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                          ))}
                        </Pie>
                        <Tooltip />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>

                  <div className="flex-1">
                    {classDistribution.map((c) => (
                      <div key={c.grade} className="flex items-center justify-between py-1">
                        <div className="text-sm">{c.grade}</div>
                        <div className="text-sm font-semibold">{c.count}</div>
                      </div>
                    ))}
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Center Profile & Summary */}
            <Card>
              <CardHeader>
                <CardTitle>Center Summary</CardTitle>
                <CardDescription>Quick stats & profile</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  <div className="flex justify-between">
                    <div className="text-sm text-muted-foreground">Students added this month</div>
                    <div className="font-semibold">{studentsAddedThisMonth}</div>
                  </div>
                  <div className="flex justify-between">
                    <div className="text-sm text-muted-foreground">Active students</div>
                    <div className="font-semibold text-green-600">{activeCount}</div>
                  </div>
                  <div className="flex justify-between">
                    <div className="text-sm text-muted-foreground">Inactive students</div>
                    <div className="font-semibold text-red-600">{inactiveCount}</div>
                  </div>

                  <hr />

                  <div>
                    <div className="text-xs text-muted-foreground">Center</div>
                    <div className="font-medium">{user.center_name || "Your Center"}</div>
                  </div>
                  <div>
                    <div className="text-xs text-muted-foreground">Contact</div>
                    <div className="font-medium">{user.center_contact || "-"}</div>
                  </div>
                  <div>
                    <div className="text-xs text-muted-foreground">Address</div>
                    <div className="font-medium">{user.center_address || "-"}</div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}
