import { notFound } from "next/navigation";

import { WorkspaceShell } from "@/components/workspace/workspace-shell";
import { WORKSPACE_SECTIONS, type WorkspaceSection } from "@/types/workspace";

export default async function WorkspaceSectionPage({
  params,
}: {
  params: Promise<{ section: string }>;
}) {
  const { section } = await params;

  if (!WORKSPACE_SECTIONS.includes(section as WorkspaceSection)) {
    notFound();
  }

  return <WorkspaceShell section={section as WorkspaceSection} />;
}
