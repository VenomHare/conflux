"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { api } from "@/lib/client-api";
import type { Workspace } from "@/components/workspace-types";

export function WorkspaceRouter() {
  const router = useRouter();
  const [error, setError] = useState("");
  useEffect(() => {
    let active = true;
    api<{ workspaces: Workspace[] }>("/workspaces")
      .then(({ workspaces }) => {
        if (!active) return;
        if (!workspaces.length) router.replace("/onboarding");
        else {
          const last = localStorage.getItem("conflux:lastWorkspace");
          router.replace(
            `/w/${workspaces.some((w) => w.id === last) ? last : workspaces[0].id}`,
          );
        }
      })
      .catch(
        (e) =>
          active &&
          setError(
            e instanceof Error ? e.message : "Could not load workspaces",
          ),
      );
    return () => {
      active = false;
    };
  }, [router]);
  return (
    <main className="auth-wrap">
      <div className="status">
        {error || "Opening your workspace…"}
        {error && (
          <button className="secondary" onClick={() => location.reload()}>
            Retry
          </button>
        )}
      </div>
    </main>
  );
}
