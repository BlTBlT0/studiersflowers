import { ReactNode } from "react";
import { Link, useLocation } from "react-router-dom";
import { LayoutDashboard, BookOpen, Calendar, Wand2, GraduationCap, BarChart3, CalendarDays, Menu, X, LogOut, Sun, Moon } from "lucide-react";
import { useState } from "react";
import { useTheme } from "next-themes";
import { cn } from "@/lib/utils";
import { useAuth } from "@/hooks/useAuth";
import logo from "@/assets/logo.png";

const navItems = [
  { to: "/", icon: LayoutDashboard, label: "Dashboard" },
  { to: "/homework", icon: BookOpen, label: "Huiswerk" },
  { to: "/schedule", icon: Calendar, label: "Rooster" },
  { to: "/planner", icon: Wand2, label: "Planner" },
  { to: "/grades", icon: GraduationCap, label: "Cijfers" },
  { to: "/stats", icon: BarChart3, label: "Statistieken" },
  { to: "/week", icon: CalendarDays, label: "Weekkalender" },
];

export function Layout({ children }: { children: ReactNode }) {
  const location = useLocation();
  const [mobileOpen, setMobileOpen] = useState(false);
  const { signOut } = useAuth();
  const { theme, setTheme } = useTheme();

  return (
    <div className="min-h-screen bg-background">
      {/* Mobile header */}
      <header className="sticky top-0 z-50 flex items-center justify-between border-b bg-card px-4 py-3 md:hidden">
        <div className="flex items-center gap-2">
          <img src={logo} alt="StudyFlow" className="h-8 w-8 rounded-lg" />
          <span className="font-display text-lg font-bold text-primary">StudyFlow</span>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
            className="rounded-lg p-2 text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
          >
            {theme === "dark" ? <Sun size={20} /> : <Moon size={20} />}
          </button>
          <button onClick={() => setMobileOpen(!mobileOpen)} className="text-foreground">
            {mobileOpen ? <X size={24} /> : <Menu size={24} />}
          </button>
        </div>
      </header>

      {/* Mobile nav overlay */}
      {mobileOpen && (
        <div className="fixed inset-0 z-40 bg-background/80 backdrop-blur-sm md:hidden" onClick={() => setMobileOpen(false)}>
          <nav className="absolute left-0 top-14 w-64 rounded-r-2xl border-r bg-card p-4 shadow-lg" onClick={(e) => e.stopPropagation()}>
            {navItems.map((item) => (
              <Link
                key={item.to}
                to={item.to}
                onClick={() => setMobileOpen(false)}
                className={cn(
                  "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors",
                  location.pathname === item.to
                    ? "bg-primary/10 text-primary"
                    : "text-muted-foreground hover:bg-muted hover:text-foreground"
                )}
              >
                <item.icon size={18} />
                {item.label}
              </Link>
            ))}
            <button
              onClick={signOut}
              className="mt-4 flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-muted-foreground hover:bg-muted hover:text-foreground"
            >
              <LogOut size={18} />
              Uitloggen
            </button>
          </nav>
        </div>
      )}

      <div className="flex">
        {/* Desktop sidebar */}
        <aside className="hidden w-64 shrink-0 md:block bg-sidebar text-sidebar-foreground">
          <div className="sticky top-0 flex h-screen flex-col p-4">
            <div className="mb-8 flex items-center gap-3">
              <img src={logo} alt="StudyFlow" className="h-10 w-10 rounded-xl" />
              <h1 className="font-display text-xl font-bold text-sidebar-foreground">StudyFlow</h1>
            </div>
            <nav className="flex flex-1 flex-col gap-1">
              {navItems.map((item) => (
                <Link
                  key={item.to}
                  to={item.to}
                  className={cn(
                    "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors",
                    location.pathname === item.to
                      ? "bg-sidebar-accent text-sidebar-accent-foreground"
                      : "text-sidebar-foreground/70 hover:bg-sidebar-accent/50 hover:text-sidebar-foreground"
                  )}
                >
                  <item.icon size={18} />
                  {item.label}
                </Link>
              ))}
            </nav>
            <button
              onClick={signOut}
              className="flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-sidebar-foreground/70 hover:bg-sidebar-accent/50 hover:text-sidebar-foreground"
            >
              <LogOut size={18} />
              Uitloggen
            </button>
          </div>
        </aside>

        {/* Main content */}
        <main className="flex-1 overflow-auto">
          <div className="mx-auto max-w-4xl p-4 md:p-8">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}
