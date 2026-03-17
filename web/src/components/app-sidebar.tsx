"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Activity, AlertTriangle, Bell, Layers, LayoutDashboard, Plug, Server } from "lucide-react";

import { BoardSwitcher } from "@/components/board-switcher";
import { StatusDot } from "@/components/status-dot";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarRail,
} from "@/components/ui/sidebar";
import { useStatusQuery } from "@/hooks/use-status";

const navItems = [
  { title: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
  { title: "Boards", href: "/dashboard/boards", icon: Layers },
  { title: "Services", href: "/dashboard/services", icon: Server },
  { title: "Incidents", href: "/dashboard/incidents", icon: AlertTriangle },
  { title: "Alerts", href: "/dashboard/alerts", icon: Bell },
  { title: "Plugins", href: "/dashboard/plugins", icon: Plug },
];

export function AppSidebar(props: React.ComponentProps<typeof Sidebar>) {
  const pathname = usePathname();
  const { data } = useStatusQuery();
  const status = data?.status ?? "operational";

  return (
    <Sidebar {...props}>
      <SidebarHeader className="p-4">
        <Link href="/dashboard" className="flex items-center gap-2">
          <Activity className="h-5 w-5" />
          <span className="text-lg font-semibold tracking-tight">StatusPulse</span>
          <StatusDot status={status} className="ml-auto" />
        </Link>
      </SidebarHeader>
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupContent>
            <SidebarMenu>
              {navItems.map((item) => {
                const isActive =
                  item.href === "/dashboard"
                    ? pathname === "/dashboard"
                    : pathname.startsWith(item.href);
                return (
                  <SidebarMenuItem key={item.href}>
                    <SidebarMenuButton isActive={isActive} render={<Link href={item.href} />}>
                      <item.icon className="h-4 w-4" />
                      <span>{item.title}</span>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                );
              })}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
        <SidebarGroup>
          <SidebarGroupContent>
            <BoardSwitcher />
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
      <SidebarFooter className="p-4">
        {data && (
          <div className="flex flex-col gap-1 text-xs text-muted-foreground">
            <span>{data.totalServices} services monitored</span>
            <span>{data.activeIncidents} active incidents</span>
          </div>
        )}
      </SidebarFooter>
      <SidebarRail />
    </Sidebar>
  );
}
