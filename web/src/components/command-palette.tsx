"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import {
  Activity, AlertTriangle, Bell, HelpCircle, Layers,
  LayoutDashboard, Plug, Server,
} from "lucide-react";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";

const routes = [
  { label: "Dashboard", href: "/dashboard", icon: LayoutDashboard, shortcut: "G D" },
  { label: "Boards", href: "/dashboard/boards", icon: Layers, shortcut: "G B" },
  { label: "Services", href: "/dashboard/services", icon: Server, shortcut: "G S" },
  { label: "Incidents", href: "/dashboard/incidents", icon: AlertTriangle, shortcut: "G I" },
  { label: "Alerts", href: "/dashboard/alerts", icon: Bell, shortcut: "G A" },
  { label: "Plugins", href: "/dashboard/plugins", icon: Plug, shortcut: "G P" },
];

export function CommandPalette() {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const router = useRouter();

  const navigate = useCallback((href: string) => {
    router.push(href);
    setOpen(false);
    setQuery("");
  }, [router]);

  useEffect(() => {
    let gPressed = false;
    let timer: ReturnType<typeof setTimeout>;

    const handler = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      if (target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.isContentEditable) return;

      // Cmd+K or Ctrl+K opens palette
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        setOpen((v) => !v);
        return;
      }

      // ? opens help
      if (e.key === "?") { setOpen(true); return; }

      // G + letter shortcuts
      if (e.key === "g" || e.key === "G") {
        gPressed = true;
        timer = setTimeout(() => { gPressed = false; }, 500);
        return;
      }

      if (gPressed) {
        gPressed = false;
        clearTimeout(timer);
        const map: Record<string, string> = {
          d: "/dashboard", b: "/dashboard/boards", s: "/dashboard/services",
          i: "/dashboard/incidents", a: "/dashboard/alerts", p: "/dashboard/plugins",
        };
        const href = map[e.key.toLowerCase()];
        if (href) { e.preventDefault(); navigate(href); }
      }
    };

    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [navigate]);

  const filtered = query
    ? routes.filter((r) => r.label.toLowerCase().includes(query.toLowerCase()))
    : routes;

  return (
    <>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-md p-0 overflow-hidden">
          <div className="p-3 border-b">
            <Input
              placeholder="Navigate to..."
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              autoFocus
              className="border-0 shadow-none focus-visible:ring-0"
            />
          </div>
          <div className="max-h-64 overflow-y-auto">
            {filtered.map((r) => (
              <button
                key={r.href}
                onClick={() => navigate(r.href)}
                className="flex items-center gap-3 w-full px-4 py-2.5 text-sm hover:bg-accent text-left"
              >
                <r.icon className="h-4 w-4 text-muted-foreground" />
                <span className="flex-1">{r.label}</span>
                <kbd className="text-xs text-muted-foreground bg-muted px-1.5 py-0.5">{r.shortcut}</kbd>
              </button>
            ))}
          </div>
          <div className="border-t px-4 py-2 text-xs text-muted-foreground flex gap-4">
            <span><kbd className="bg-muted px-1">Cmd+K</kbd> open</span>
            <span><kbd className="bg-muted px-1">?</kbd> help</span>
            <span><kbd className="bg-muted px-1">G</kbd> then letter to navigate</span>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}

/** Small help button for the site header */
export function HelpButton() {
  return (
    <button
      onClick={() => window.dispatchEvent(new KeyboardEvent("keydown", { key: "?", bubbles: true }))}
      className="h-7 w-7 flex items-center justify-center text-muted-foreground hover:text-foreground"
      title="Keyboard shortcuts (?)"
      aria-label="Keyboard shortcuts"
    >
      <HelpCircle className="h-4 w-4" />
    </button>
  );
}
