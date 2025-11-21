import { Link, useLocation, useNavigate } from "react-router-dom";
import { Home, CheckSquare, BookOpen, Book, Paintbrush, AlertTriangle, FileText, ClipboardCheck, User, LogOut, KeyRound } from "lucide-react";
import { cn } from "@/lib/utils";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import Sidebar from "./Sidebar";

const navItems = [
  { to: "/teacher-dashboard", label: "Dashboard", icon: Home, role: 'teacher' },
  { to: "/teacher/take-attendance", label: "Take Attendance", icon: CheckSquare, role: 'teacher', featureName: 'take_attendance' },
  { to: "/teacher/lesson-tracking", label: "Lesson Tracking", icon: BookOpen, role: 'teacher', featureName: 'lesson_tracking' },
  { to: "/teacher/homework-management", label: "Homework Management", icon: Book, role: 'teacher', featureName: 'homework_management' },
  { to: "/teacher/preschool-activities", label: "Preschool Activities", icon: Paintbrush, role: 'teacher', featureName: 'preschool_activities' },
  { to: "/teacher/discipline-issues", label: "Discipline Issues", icon: AlertTriangle, role: 'teacher', featureName: 'discipline_issues' },
  { to: "/teacher/test-management", label: "Test Management", icon: ClipboardCheck, role: 'teacher', featureName: 'test_management' },
  { to: "/teacher/student-report", label: "Student Report", icon: User, role: 'teacher', featureName: 'student_report_access' },
  { to: "/change-password", label: "Change Password", icon: KeyRound, role: 'teacher' },
];

export default function TeacherLayout({ children }: { children: React.ReactNode }) {
  const location = useLocation();
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate('/login'); // Teachers also log in via the main login page
  };

  const headerContent = (
    <div className="flex items-center gap-2">
      <h1 className="text-xl font-bold text-foreground">Teacher Portal</h1>
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

  // Filter nav items based on teacher's specific permissions
  const filteredTeacherNavItems = navItems.filter(item => {
    if (item.featureName && user?.teacherPermissions) {
      return user.teacherPermissions[item.featureName];
    }
    return true; // Always show items without a specific featureName (like Dashboard, Change Password)
  });

  return (
    <div className="flex min-h-screen bg-background">
      <Sidebar
        navItems={filteredTeacherNavItems} // Pass the filtered items
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