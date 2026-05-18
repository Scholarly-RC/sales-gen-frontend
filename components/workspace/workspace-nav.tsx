import {
  BookOpen,
  FileOutput,
  LayoutDashboard,
  LogOut,
  ReceiptText,
  UserRound,
  Users,
} from "lucide-react";
import Link from "next/link";

import { Button } from "@/components/ui/button";
import type { WorkspaceSection } from "@/types/workspace";

const sidebarItems = [
  {
    label: "Dashboard",
    href: "/workspace/dashboard",
    key: "dashboard" as const,
    icon: LayoutDashboard,
  },
  {
    label: "Clients",
    href: "/workspace/clients",
    key: "clients" as const,
    icon: UserRound,
  },
  {
    label: "Client Sales",
    href: "/workspace/client-sales",
    key: "client-sales" as const,
    icon: FileOutput,
  },
  {
    label: "Client Expenses",
    href: "/workspace/client-expenses",
    key: "client-expenses" as const,
    icon: ReceiptText,
  },
  {
    label: "Catalog",
    href: "/workspace/catalog",
    key: "catalog" as const,
    icon: BookOpen,
  },
  {
    label: "Users",
    href: "/workspace/users",
    key: "users" as const,
    icon: Users,
  },
];

type WorkspaceNavProps = {
  section: WorkspaceSection;
  onSignOut: () => void;
};

export function WorkspaceNav({ section, onSignOut }: WorkspaceNavProps) {
  return (
    <div className="grid gap-4">
      <nav className="grid gap-2" aria-label="Workspace navigation">
        {sidebarItems.map((item) => {
          const Icon = item.icon;

          return (
            <Button
              key={item.label}
              type="button"
              variant={item.key === section ? "secondary" : "ghost"}
              className="w-full justify-start"
              asChild
            >
              <Link href={item.href}>
                <Icon className="size-4" />
                {item.label}
              </Link>
            </Button>
          );
        })}
      </nav>
      <Button type="button" variant="outline" onClick={onSignOut}>
        <LogOut className="size-4" />
        Sign out
      </Button>
    </div>
  );
}
