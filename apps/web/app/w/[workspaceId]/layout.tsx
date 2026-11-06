import type { ReactNode } from "react";
import { WorkspaceFrame } from "@/components/workspace-frame";

export default function WorkspaceLayout({ children }: { children: ReactNode }) {
  return <WorkspaceFrame>{children}</WorkspaceFrame>;
}
