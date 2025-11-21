"use client";

import React, { useState } from "react";
import { Link, useLocation } from "react-router-dom";
import {
  Home,
  UserPlus,
  CheckSquare,
  FileText,
  BarChart3,
  BookOpen,
  ClipboardCheck,
  User,
  Brain,
  Calendar,
  DollarSign,
  LayoutList,
  Book,
  Paintbrush,
  AlertTriangle,
  Users,
  UserCheck,
  ChevronLeft,
  ChevronRight,
  Settings,
  KeyRound,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { useAuth } from "@/contexts/AuthContext"; // Import useAuth

interface NavItem {
  to: string;
  label: string;
  icon: React.ElementType;
  role?: 'admin' | 'center' | 'parent' | 'teacher';
  featureName?: string; // New prop for feature name
}

interface SidebarProps {
  navItems: NavItem[];
  headerContent: React.ReactNode;
  footerContent: React.ReactNode;
}

export default function Sidebar({ navItems, headerContent, footerContent }: SidebarProps) {
  const location = useLocation();
  const [isCollapsed, setIsCollapsed] = useState(false);
  const { user } = useAuth(); // Get user from AuthContext

  const filteredNavItems = navItems.filter(item => {
    // Filter by role
    if (item.role && user?.role !== item.role) {
      return false;
    }

    // Filter by feature permissions
    if (item.featureName) {
      if (user?.role === 'center' && user.centerPermissions) {
        return user.centerPermissions[item.featureName];
      }
      // For admin, we'll assume all features are visible in their own dashboard,
      // but the toggle UI will be in AdminDashboard.
      // For teachers, their specific permissions will be checked in their layout.
    }
    return true;
  });

  return (
    <TooltipProvider>
      <div
        className={cn(
          "flex flex-col h-screen border-r bg-card transition-all duration-300",
          isCollapsed ? "w-20" : "w-64"
        )}
      >
        {/* Header */}
        <div className="flex items-center justify-between h-16 px-4 border-b">
          {!isCollapsed && <div className="flex-1">{headerContent}</div>}
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setIsCollapsed(!isCollapsed)}
            className="h-8 w-8"
          >
            {isCollapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
          </Button>
        </div>

        {/* Navigation Links */}
        <nav className="flex-1 overflow-y-auto py-4 space-y-1">
          {filteredNavItems.map((item) => {
            const Icon = item.icon;
            const isActive = location.pathname === item.to;
            return (
              <Tooltip key={item.to}>
                <TooltipTrigger asChild>
                  <Link
                    to={item.to}
                    className={cn(
                      "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
                      isActive
                        ? "bg-primary text-primary-foreground hover:text-primary-foreground"
                        : "text-muted-foreground hover:bg-muted hover:text-primary",
                      isCollapsed ? "justify-center" : ""
                    )}
                  >
                    <Icon className="h-5 w-5" />
                    {!isCollapsed && item.label}
                  </Link>
                </TooltipTrigger>
                {isCollapsed && <TooltipContent side="right">{item.label}</TooltipContent>}
              </Tooltip>
            );
          })}
        </nav>

        {/* Footer */}
        <div className="border-t p-4">
          {!isCollapsed && <div className="text-sm text-muted-foreground">{footerContent}</div>}
          {isCollapsed && (
            <div className="flex justify-center">
              {footerContent} {/* Render only icon or minimal content if collapsed */}
            </div>
          )}
        </div>
      </div>
    </TooltipProvider>
  );
}