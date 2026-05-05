import { useState } from "react";
import { NavLink, Outlet, useNavigate } from "react-router-dom";
import {
  LayoutDashboard,
  ShoppingBag,
  Bike,
  FileSpreadsheet,
  LogOut,
  Flame,
  Moon,
  Sun,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent } from "@/components/ui/sheet";
import { useAuth } from "@/contexts/AuthContext";
import { useTheme } from "@/hooks/useTheme";

const navItems = [
  { to: "/dashboard", label: "Tableau de bord", icon: LayoutDashboard },
  { to: "/commandes", label: "Commandes", icon: ShoppingBag },
  { to: "/livreurs", label: "Livreurs", icon: Bike },
  { to: "/import-export", label: "Import / Export", icon: FileSpreadsheet },
];

export default function AppLayout() {
  const { user, role, signOut } = useAuth();
  const { theme, toggle } = useTheme();
  const navigate = useNavigate();
  const [mobileOpen, setMobileOpen] = useState(false);

  const handleSignOut = async () => {
    await signOut();
    navigate("/auth");
  };

  const SidebarBody = ({ onNavigate }: { onNavigate?: () => void }) => (
    <div className="h-full flex flex-col bg-sidebar text-sidebar-foreground">
      <button
        type="button"
        onClick={() => {
          // On desktop the logo is decorative; on mobile it closes the drawer
          onNavigate?.();
        }}
        className="p-6 border-b border-sidebar-border text-left"
      >
        <div className="flex items-center gap-2">
          <div className="h-9 w-9 rounded-lg bg-gradient-primary flex items-center justify-center shadow-glow">
            <Flame className="h-5 w-5 text-primary-foreground" />
          </div>
          <div>
            <div className="font-display font-bold text-lg leading-none">Eguette</div>
            <div className="text-xs text-sidebar-foreground/60 mt-0.5">Resto Manager</div>
          </div>
        </div>
      </button>

      <nav className="flex-1 p-3 space-y-1 overflow-y-auto">
        {navItems.map(({ to, label, icon: Icon }) => (
          <NavLink
            key={to}
            to={to}
            onClick={onNavigate}
            className={({ isActive }) =>
              `flex items-center gap-3 px-3 py-2.5 rounded-md text-sm font-medium transition-smooth ${
                isActive
                  ? "bg-primary text-primary-foreground shadow-elegant"
                  : "text-sidebar-foreground/80 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
              }`
            }
          >
            <Icon className="h-4 w-4" />
            {label}
          </NavLink>
        ))}
      </nav>

      <div className="p-3 border-t border-sidebar-border space-y-2">
        <div className="px-3 py-2">
          <div className="text-xs text-sidebar-foreground/60">Connecté</div>
          <div className="text-sm font-medium truncate">{user?.email}</div>
          <div className="text-xs text-primary mt-0.5 capitalize">{role ?? "—"}</div>
        </div>
        <Button
          onClick={toggle}
          variant="ghost"
          size="sm"
          className="w-full justify-start text-sidebar-foreground hover:bg-sidebar-accent"
        >
          {theme === "dark" ? <Sun className="h-4 w-4 mr-2" /> : <Moon className="h-4 w-4 mr-2" />}
          {theme === "dark" ? "Mode clair" : "Mode sombre"}
        </Button>
        <Button
          onClick={handleSignOut}
          variant="ghost"
          size="sm"
          className="w-full justify-start text-sidebar-foreground hover:bg-sidebar-accent"
        >
          <LogOut className="h-4 w-4 mr-2" />
          Déconnexion
        </Button>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen flex bg-background">
      {/* Desktop sidebar (always visible) */}
      <aside className="hidden lg:flex w-64 flex-col border-r border-sidebar-border">
        <SidebarBody />
      </aside>

      {/* Mobile / tablet drawer */}
      <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
        <SheetContent
          side="left"
          className="p-0 w-72 border-r border-sidebar-border bg-sidebar"
        >
          <SidebarBody onNavigate={() => setMobileOpen(false)} />
        </SheetContent>
      </Sheet>

      <div className="flex-1 flex flex-col min-w-0">
        {/* Mobile / tablet top bar with logo trigger */}
        <header className="lg:hidden sticky top-0 z-20 bg-card border-b border-border">
          <div className="px-4 py-3 flex items-center gap-3">
            <button
              type="button"
              onClick={() => setMobileOpen(true)}
              aria-label="Ouvrir le menu"
              className="flex items-center gap-2 group"
            >
              <div className="h-9 w-9 rounded-lg bg-gradient-primary flex items-center justify-center shadow-glow">
                <Flame className="h-5 w-5 text-primary-foreground" />
              </div>
              <div className="text-left">
                <div className="font-display font-bold text-base leading-none">
                  Eguette
                </div>
                <div className="text-[10px] text-muted-foreground mt-0.5">
                  Appuyez pour le menu
                </div>
              </div>
            </button>
          </div>
        </header>

        <main className="flex-1 overflow-auto">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
