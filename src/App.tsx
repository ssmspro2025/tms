import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "./contexts/AuthContext";
import ProtectedRoute from "./components/ProtectedRoute";
import CenterLayout from "./components/CenterLayout";
import AdminLayout from "./components/AdminLayout";
import ParentLayout from "./components/ParentLayout";
import TeacherLayout from "./components/TeacherLayout"; // NEW
import Dashboard from "./pages/Dashboard";
import RegisterStudent from "./pages/RegisterStudent";
import TakeAttendance from "./pages/TakeAttendance";
import AttendanceSummary from "./pages/AttendanceSummary";
import LessonTracking from "./pages/LessonTracking";
import LessonPlans from "./pages/LessonPlans";
import HomeworkManagement from "./pages/HomeworkManagement";
import PreschoolActivities from "./pages/PreschoolActivities";
import DisciplineIssues from "./pages/DisciplineIssues";
import TeacherManagement from "./pages/TeacherManagement";
import TeacherAttendancePage from "./pages/TeacherAttendance";
import Tests from "./pages/Tests";
import StudentReport from "./pages/StudentReport";
import AIInsights from "./pages/AIInsights";
import ViewRecords from "./pages/ViewRecords";
import Summary from "./pages/Summary";
import Login from "./pages/Login";
import AdminLogin from "./pages/AdminLogin";
import ParentLogin from "./pages/ParentLogin";
import AdminDashboard from "./pages/AdminDashboard";
import AdminFinance from "./pages/AdminFinance";
import ParentDashboard from "./pages/ParentDashboard";
import ParentFinanceDashboard from "./pages/ParentFinanceDashboard";
import ParentHomework from "./pages/ParentHomework";
import ParentActivities from "./pages/ParentActivities";
import ParentDiscipline from "./pages/ParentDiscipline";
import TeacherDashboard from "./pages/TeacherDashboard"; // NEW
import InitAdmin from "./pages/InitAdmin";
import NotFound from "./pages/NotFound";
import Settings from "./pages/admin/Settings";
import ChangePassword from "./pages/ChangePassword";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <AuthProvider>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <Routes>
            {/* Authentication Routes */}
            <Route path="/init-admin" element={<InitAdmin />} />
            <Route path="/login" element={<Login />} />
            <Route path="/login-admin" element={<AdminLogin />} />
            <Route path="/login-parent" element={<ParentLogin />} />
            <Route path="/change-password" element={<ProtectedRoute><ChangePassword /></ProtectedRoute>} />

            {/* Parent Routes */}
            <Route path="/parent-dashboard" element={<ProtectedRoute role="parent"><ParentLayout><ParentDashboard /></ParentLayout></ProtectedRoute>} />
            <Route path="/parent-finance" element={<ProtectedRoute role="parent"><ParentLayout><ParentFinanceDashboard /></ParentLayout></ProtectedRoute>} />
            <Route path="/parent-homework" element={<ProtectedRoute role="parent"><ParentLayout><ParentHomework /></ParentLayout></ProtectedRoute>} />
            <Route path="/parent-activities" element={<ProtectedRoute role="parent"><ParentLayout><ParentActivities /></ParentLayout></ProtectedRoute>} />
            <Route path="/parent-discipline" element={<ProtectedRoute role="parent"><ParentLayout><ParentDiscipline /></ParentLayout></ProtectedRoute>} />

            {/* Teacher Routes */}
            <Route path="/teacher-dashboard" element={<ProtectedRoute role="teacher"><TeacherLayout><TeacherDashboard /></TeacherLayout></ProtectedRoute>} />
            <Route path="/teacher/take-attendance" element={<ProtectedRoute role="teacher"><TeacherLayout><TakeAttendance /></TeacherLayout></ProtectedRoute>} />
            <Route path="/teacher/lesson-tracking" element={<ProtectedRoute role="teacher"><TeacherLayout><LessonTracking /></TeacherLayout></ProtectedRoute>} />
            <Route path="/teacher/homework-management" element={<ProtectedRoute role="teacher"><TeacherLayout><HomeworkManagement /></TeacherLayout></ProtectedRoute>} />
            <Route path="/teacher/preschool-activities" element={<ProtectedRoute role="teacher"><TeacherLayout><PreschoolActivities /></TeacherLayout></ProtectedRoute>} />
            <Route path="/teacher/discipline-issues" element={<ProtectedRoute role="teacher"><TeacherLayout><DisciplineIssues /></TeacherLayout></ProtectedRoute>} />
            <Route path="/teacher/test-management" element={<ProtectedRoute role="teacher"><TeacherLayout><Tests /></TeacherLayout></ProtectedRoute>} />
            <Route path="/teacher/student-report" element={<ProtectedRoute role="teacher"><TeacherLayout><StudentReport /></TeacherLayout></ProtectedRoute>} />

            {/* Center Routes */}
            <Route path="/" element={<ProtectedRoute role="center"><CenterLayout><Dashboard /></CenterLayout></ProtectedRoute>} />
            <Route path="/register" element={<ProtectedRoute role="center"><CenterLayout><RegisterStudent /></CenterLayout></ProtectedRoute>} />
            <Route path="/attendance" element={<ProtectedRoute role="center"><CenterLayout><TakeAttendance /></CenterLayout></ProtectedRoute>} />
            <Route path="/attendance-summary" element={<ProtectedRoute role="center"><CenterLayout><AttendanceSummary /></CenterLayout></ProtectedRoute>} />
            <Route path="/lesson-plans" element={<ProtectedRoute role="center"><CenterLayout><LessonPlans /></CenterLayout></ProtectedRoute>} />
            <Route path="/lesson-tracking" element={<ProtectedRoute role="center"><CenterLayout><LessonTracking /></CenterLayout></ProtectedRoute>} />
            <Route path="/homework" element={<ProtectedRoute role="center"><CenterLayout><HomeworkManagement /></CenterLayout></ProtectedRoute>} />
            <Route path="/activities" element={<ProtectedRoute role="center"><CenterLayout><PreschoolActivities /></CenterLayout></ProtectedRoute>} />
            <Route path="/discipline" element={<ProtectedRoute role="center"><CenterLayout><DisciplineIssues /></CenterLayout></ProtectedRoute>} />
            <Route path="/teachers" element={<ProtectedRoute role="center"><CenterLayout><TeacherManagement /></CenterLayout></ProtectedRoute>} />
            <Route path="/teacher-attendance" element={<ProtectedRoute role="center"><CenterLayout><TeacherAttendancePage /></CenterLayout></ProtectedRoute>} />
            <Route path="/tests" element={<ProtectedRoute role="center"><CenterLayout><Tests /></CenterLayout></ProtectedRoute>} />
            <Route path="/student-report" element={<ProtectedRoute role="center"><CenterLayout><StudentReport /></CenterLayout></ProtectedRoute>} />
            <Route path="/ai-insights" element={<ProtectedRoute role="center"><CenterLayout><AIInsights /></CenterLayout></ProtectedRoute>} />
            <Route path="/records" element={<ProtectedRoute role="center"><CenterLayout><ViewRecords /></CenterLayout></ProtectedRoute>} />
            <Route path="/summary" element={<ProtectedRoute role="center"><CenterLayout><Summary /></CenterLayout></ProtectedRoute>} />
            <Route path="/finance" element={<ProtectedRoute role="center"><CenterLayout><AdminFinance /></CenterLayout></ProtectedRoute>} />

            {/* Admin Routes */}
            <Route path="/admin-dashboard" element={<ProtectedRoute role="admin"><AdminLayout><AdminDashboard /></AdminLayout></ProtectedRoute>} />
            <Route path="/admin/finance" element={<ProtectedRoute role="admin"><AdminLayout><AdminFinance /></AdminLayout></ProtectedRoute>} />
            <Route path="/admin/settings" element={<ProtectedRoute role="admin"><AdminLayout><Settings /></AdminLayout></ProtectedRoute>} />

            {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
            <Route path="*" element={<NotFound />} />
          </Routes>
        </BrowserRouter>
      </TooltipProvider>
    </AuthProvider>
  </QueryClientProvider>
);

export default App;