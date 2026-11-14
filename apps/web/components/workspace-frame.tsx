"use client";

import { createContext, useContext, useEffect, useState } from "react";
import type { Dispatch, ReactNode, SetStateAction } from "react";
import { useParams, useRouter } from "next/navigation";
import { Sidebar } from "@/components/sidebar";
import { ErrorState } from "@/components/error-state";
import { api, send } from "@/lib/client-api";

type Workspace = {
  id: string;
  name: string;
  description: string | null;
  myRole: string;
};
type Page = {
  id: string;
  title: string;
  created_at?: string;
  updated_at: string;
};
type User = {
  id: string;
  name: string;
  email: string;
  avatar_url: string | null;
};
type WorkspaceFrameState = {
  workspace: Workspace;
  setWorkspace: Dispatch<SetStateAction<Workspace>>;
  pages: Page[];
  setPages: Dispatch<SetStateAction<Page[]>>;
  user: User;
  setUser: Dispatch<SetStateAction<User>>;
};

const WorkspaceFrameContext = createContext<WorkspaceFrameState | null>(null);

export function useWorkspaceFrame() {
  const value = useContext(WorkspaceFrameContext);
  if (!value)
    throw new Error("useWorkspaceFrame must be used within WorkspaceFrame");
  return value;
}

export function WorkspaceFrame({ children }: { children: ReactNode }) {
  const { workspaceId } = useParams<{ workspaceId: string }>();
  const router = useRouter();
  const [workspace, setWorkspace] = useState<Workspace | null>(null);
  const [pages, setPages] = useState<Page[]>([]);
  const [user, setUser] = useState<User | null>(null);
  const [error, setError] = useState("");
  const [loadedWorkspaceId, setLoadedWorkspaceId] = useState<string | null>(
    null,
  );

  useEffect(() => {
    let active = true;
    setError("");
    Promise.all([
      api<{ workspace: Workspace }>(`/workspaces/${workspaceId}`),
      api<{ pages: Page[] }>(`/workspaces/${workspaceId}/pages`),
      api<{ user: User }>("/auth/me"),
    ])
      .then(([workspaceResult, pagesResult, userResult]) => {
        if (!active) return;
        setWorkspace(workspaceResult.workspace);
        setPages(pagesResult.pages);
        setUser(userResult.user);
        setLoadedWorkspaceId(workspaceId);
        localStorage.setItem("conflux:lastWorkspace", workspaceId);
      })
      .catch((reason) => {
        if (active)
          setError(
            reason instanceof Error
              ? reason.message
              : "Workspace could not be loaded",
          );
      });
    return () => {
      active = false;
    };
  }, [workspaceId]);

  async function logout() {
    await api("/auth/logout", send("POST")).catch(() => {});
    router.replace("/login");
    router.refresh();
  }

  function updateWorkspace(nextWorkspace: SetStateAction<Workspace>) {
    setWorkspace((currentWorkspace) => {
      if (!currentWorkspace) return currentWorkspace;
      if (typeof nextWorkspace === "function") {
        return nextWorkspace(currentWorkspace);
      }
      return nextWorkspace;
    });
  }

  function updateUser(nextUser: SetStateAction<User>) {
    setUser((currentUser) => {
      if (!currentUser) return currentUser;
      if (typeof nextUser === "function") {
        return nextUser(currentUser);
      }
      return nextUser;
    });
  }

  if (!workspace || !user || loadedWorkspaceId !== workspaceId) {
    const workspaceNotFound = error.toLowerCase().includes("not found");
    return error ? (
      <ErrorState
        code={
          workspaceNotFound
            ? "WORKSPACE · NOT FOUND"
            : "WORKSPACE · UNAVAILABLE"
        }
        title={
          workspaceNotFound
            ? "You look misdirected."
            : "We couldn’t open this workspace."
        }
        description={
          workspaceNotFound
            ? "This workspace isn’t here, or you may not have access to it."
            : error
        }
      />
    ) : null;
  }

  return (
    <WorkspaceFrameContext.Provider
      value={{
        workspace,
        setWorkspace: updateWorkspace,
        pages,
        setPages,
        user,
        setUser: updateUser,
      }}
    >
      <div className="app">
        <Sidebar
          workspace={workspace}
          pages={pages}
          user={user}
          onPagesChange={setPages}
          onLogout={() => void logout()}
        />
        {children}
      </div>
    </WorkspaceFrameContext.Provider>
  );
}
