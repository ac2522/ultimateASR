import { NavLink } from "react-router-dom";
import { cn } from "@/lib/utils";
import { Mic, Settings, Database, BookText, Sparkles } from "lucide-react";

const links = [
  { to: "/", label: "Home", icon: Mic },
  { to: "/settings", label: "Settings", icon: Settings },
  { to: "/models", label: "Models", icon: Database },
  { to: "/dictionary", label: "Dictionary", icon: BookText },
  { to: "/llm", label: "Cloud & LLM", icon: Sparkles },
];

export function AppSidebar() {
  return (
    <nav className="w-56 shrink-0 border-r border-border bg-card/50 p-4 space-y-1">
      <div className="px-2 pb-4">
        <h1 className="text-lg font-semibold tracking-tight">ultimateASR</h1>
        <p className="text-xs text-muted-foreground">Local + cloud dictation</p>
      </div>
      {links.map(({ to, label, icon: Icon }) => (
        <NavLink
          key={to}
          to={to}
          end={to === "/"}
          className={({ isActive }) => cn(
            "flex items-center gap-2 rounded-md px-3 py-2 text-sm transition-colors",
            isActive ? "bg-accent text-accent-foreground" : "text-muted-foreground hover:bg-accent/50",
          )}
        >
          <Icon className="size-4" />
          <span>{label}</span>
        </NavLink>
      ))}
    </nav>
  );
}
