import { Link, useLocation, useNavigate } from "react-router-dom";
import { Home, UserPlus, CheckSquare, FileText, BarChart3, BookOpen, ClipboardCheck, User, Brain, LogOut, Shield, Calendar, DollarSign, LayoutList, Book, Paintbrush, AlertTriangle, Users, UserCheck, KeyRound } from "lucide-react";
import { cn } from "@/lib/utils";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import Sidebar from "./Sidebar"; // Import the new Sidebar component

const navItems = [
  { to: "/", label: "Dashboard", icon: Home, role: 'center' },
  { to: "/register", label: "Register Student", icon: UserPlus, role: 'center', featureName: 'register_student' },
  { to: "/attendance", label: "Take Attendance", icon: CheckSquare, role: 'center', featureName: 'take_attendance' },
  { to: "/attendance-summary", label: "Attendance Summary", icon: Calendar, role: 'center', featureName: 'attendance_summary' },
  { to: "/lesson-plans", label: "Lesson Plans", icon: LayoutList, role: 'center', featureName: 'lesson_plans' },
  { to: "/lesson-tracking", label: "Lesson Tracking", icon: BookOpen, role: 'center', featureName: 'lesson_tracking' },
  { to: "/homework", label: "Homework", icon: Book, role: 'center', featureName: 'homework' },
  { to: "/activities", label: "Activities", icon: Paintbrush, role: 'center', featureName: 'activities' },
  { to: "/discipline", label: "Discipline", icon: AlertTriangle, role: 'center', featureName: 'discipline' },
  { to: "/teachers", label: "Teachers", icon: Users, role: 'center', featureName: 'teachers' },
  { to: "/teacher-attendance", label: "Teacher Attendance", icon: UserCheck, role: 'center', featureName: 'teacher_attendance' },
  { to: "/tests", label: "Tests", icon: ClipboardCheck, role: 'center', featureName: 'tests' },
  { to: "/student-report", label: "Student Report", icon: User, role: 'center', featureName: 'student_report' },
  { to: "/ai-insights", label: "AI Insights", icon: Brain, role: 'center', featureName: 'ai_insights' },
  { to: "/records", label: "View Records", icon: FileText, role: 'center', featureName: 'view_records' },
  { to: "/summary", label: "Summary", icon: BarChart3, role: 'center', featureName: 'summary' },
  { to: "/finance", label: "Finance", icon: DollarSign, role: 'center', featureName: 'finance' },
  { to: "/change-password", label: "Change Password", icon: KeyRound, role: 'center' },
];

export default function CenterLayout({ children }: { children: React.ReactNode }) {
  const location = useLocation();
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const headerContent = (
    <div className="flex items-center gap-2">
      <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-gradient-to-br from-primary to-primary/80">
        <CheckSquare className="h-6 w-6 text-primary-foreground" />
      </div>
      <div>
        <h1 className="text-xl font-bold text-foreground">
          {user?.center_name || 'AttendTrack'}
        </h1>
        <p className="text-xs text-muted-foreground">
          {user?.role === 'admin' ? 'Admin Panel' : 'Tuition Center'}
        </p>
      </div>
    </div>
  );

  const footerContent = (
    <div className="flex items-center justify-between">
      <div className="flex items-center gap-2 text-sm">
        <User className="h-4 w-4 text-muted-foreground" />
        <span className="text-muted-foreground">{user?.username}</span>
      </div>
      <Button variant="ghost" size="sm" onClick={handleLogout}>
        <LogOut className="h-4 w-4" />
      </Button>
    </div>
  );

  return (
    <div className="flex min-h-screen bg-background">
      <Sidebar
        navItems={navItems}
        headerContent={headerContent}
        footerContent={footerContent}
      />

      {/* Main Content */}
      <main className="flex-1 p-6 overflow-y-auto">
        {children}
      </main>
    </div>
  );
}