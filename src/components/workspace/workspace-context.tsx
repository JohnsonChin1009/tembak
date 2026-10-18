"use client";

import { createContext, useContext } from "react";
import type { WorkspaceInfo } from "@/lib/types";

type Value = {
  workspace: WorkspaceInfo;
  /** Page path prefix, e.g. /w/acme-x1y2 */
  base: string;
  /** API path prefix, e.g. /api/w/acme-x1y2 */
  api: string;
};

const WorkspaceContext = createContext<Value | null>(null);

export function WorkspaceProvider({ workspace, children }: { workspace: WorkspaceInfo; children: React.ReactNode }) {
  const slug = encodeURIComponent(workspace.slug);
  return (
    <WorkspaceContext.Provider value={{ workspace, base: `/w/${slug}`, api: `/api/w/${slug}` }}>
      {children}
    </WorkspaceContext.Provider>
  );
}

export function useWorkspace(): Value {
  const value = useContext(WorkspaceContext);
  if (!value) throw new Error("useWorkspace must be used inside WorkspaceProvider");
  return value;
}
