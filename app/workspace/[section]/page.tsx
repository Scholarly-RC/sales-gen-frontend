import { notFound } from "next/navigation";

import {
  type WorkspaceSection,
  WorkspaceShell,
} from "@/components/workspace/workspace-shell";

const validSections: WorkspaceSection[] = [
  "dashboard",
  "clients",
  "client-sales",
  "users",
];

export default async function WorkspaceSectionPage({
  params,
}: {
  params: Promise<{ section: string }>;
}) {
  const { section } = await params;

  if (!validSections.includes(section as WorkspaceSection)) {
    notFound();
  }

  return <WorkspaceShell section={section as WorkspaceSection} />;
}
