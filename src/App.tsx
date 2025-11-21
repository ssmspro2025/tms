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
import Dashboard from "./pages/Dashboard";
import RegisterStudent from "./pages/RegisterStudent";
import TakeAttendance from "./pages/TakeAttendance";
import AttendanceSummary from "./pages/AttendanceSummary";
import ChaptersTracking from "./pages/ChaptersTracking";
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
import InitAdmin from "./pages/InitAdmin";
import NotFound from "./pages/NotFound";
import Settings from "./pages/admin/Settings";

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

            {/* Parent Routes */}
            <Route path="/parent-dashboard" element={<ProtectedRoute role="parent"><ParentLayout><ParentDashboard /></ParentLayout></ProtectedRoute>} />
            <Route path="/parent-finance" element={<ProtectedRoute role="parent"><ParentLayout><ParentFinanceDashboard /></ParentLayout></ProtectedRoute>} />

            {/* Center Routes */}
            <Route path="/" element={<ProtectedRoute role="center"><CenterLayout><Dashboard /></CenterLayout></ProtectedRoute>} />
            <Route path="/register" element={<ProtectedRoute role="center"><CenterLayout><RegisterStudent /></CenterLayout></ProtectedRoute>} />
            <Route path="/attendance" element={<ProtectedRoute role="center"><CenterLayout><TakeAttendance /></CenterLayout></ProtectedRoute>} />
            <Route path="/attendance-summary" element={<ProtectedRoute role="center"><CenterLayout><AttendanceSummary /></CenterLayout></ProtectedRoute>} />
            <Route path="/chapters" element={<ProtectedRoute role="center"><CenterLayout><ChaptersTracking /></CenterLayout></ProtectedRoute>} />
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
