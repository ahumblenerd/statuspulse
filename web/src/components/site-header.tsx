"use client";

import Link from "next/link";
import { ChevronRight } from "lucide-react";

import { HelpButton } from "@/components/command-palette";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { Separator } from "@/components/ui/separator";

interface Crumb {
  label: string;
  href?: string;
}

export function SiteHeader({ title, breadcrumbs }: { title?: string; breadcrumbs?: Crumb[] }) {
  return (
    <header className="flex h-14 items-center gap-3 border-b px-4">
      <SidebarTrigger />
      <Separator orientation="vertical" className="h-5" />
      {breadcrumbs && breadcrumbs.length > 0 && (
        <nav className="flex items-center gap-1 text-sm text-muted-foreground">
          {breadcrumbs.map((crumb, i) => (
            <span key={i} className="flex items-center gap-1">
              {crumb.href ? (
                <Link href={crumb.href} className="hover:text-foreground">{crumb.label}</Link>
              ) : (
                <span>{crumb.label}</span>
              )}
              {i < breadcrumbs.length - 1 && <ChevronRight className="h-3 w-3" />}
            </span>
          ))}
        </nav>
      )}
      {!breadcrumbs && title && <h1 className="text-sm font-medium">{title}</h1>}
      <div className="flex-1" />
      <HelpButton />
    </header>
  );
}
