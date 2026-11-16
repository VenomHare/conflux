"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Mail } from "lucide-react";
import { api } from "@/lib/client-api";
import { useWorkspaceFrame } from "@/components/workspace-frame";

type PendingInvitation = {
  id: string;
  token: string;
  role: string;
  expires_at: string;
  workspace: { id: string; name: string };
};

function formatInvitationDate(value: string) {
  return new Date(value).toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

export function PendingInvitationsPage() {
  const { workspace } = useWorkspaceFrame();
  const [invitations, setInvitations] = useState<PendingInvitation[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    api<{ invitations: PendingInvitation[] }>("/invitations")
      .then(({ invitations }) => {
        if (active) setInvitations(invitations);
      })
      .catch((reason) => {
        if (active) setError(reason instanceof Error ? reason.message : "Invitations could not be loaded");
      })
      .finally(() => active && setLoading(false));
    return () => {
      active = false;
    };
  }, []);

  return (
    <section className="main">
      <header className="topbar">
        <div className="topbar-leading">
          <div className="topbar-sidebar-toggle-slot" />
          <div>
            <Link href={`/w/${workspace.id}`}>{workspace.name}</Link>{" "}
            <span className="muted">/</span> Invitations
          </div>
        </div>
        <div className="top-actions"><span className="muted">Account</span></div>
      </header>
      <main className="settings-content">
        <div className="settings-heading">
          <div className="settings-eyebrow">
            <Mail size={14} aria-hidden="true" /> Your account
          </div>
          <h1>Your invitations.</h1>
          <p>Workspace invitations sent to your account.</p>
        </div>
        <section className="settings-panel member-panel">
          <div className="settings-panel-heading">
            <div>
              <h2>Pending invitations</h2>
              <p>Accept an invite to join a workspace.</p>
            </div>
            {!loading && !error && (
              <span className="member-count">
                {invitations.length} {invitations.length === 1 ? "invite" : "invites"}
              </span>
            )}
          </div>
          {loading ? <p className="muted">Loading invitations…</p> : null}
          {error ? <div className="form-error" role="alert">{error}</div> : null}
          {!loading && !error && invitations.length > 0 && (
            <div className="pending-invitation-list">
              {invitations.map((invitation) => (
                <article className="pending-invitation-row" key={invitation.id}>
                  <div className="pending-invitation-icon"><Mail size={17} aria-hidden="true" /></div>
                  <div className="pending-invitation-info">
                    <h3>{invitation.workspace.name}</h3>
                    <p>
                      {invitation.role[0] + invitation.role.slice(1).toLowerCase()} role
                      <span aria-hidden="true"> · </span>
                      Expires {formatInvitationDate(invitation.expires_at)}
                    </p>
                  </div>
                  <Link className="secondary" href={`/invite/${invitation.token}`}>
                    Review invite
                  </Link>
                </article>
              ))}
            </div>
          )}
          {!loading && !error && invitations.length === 0 && (
            <div className="pending-invitation-empty">
              <Mail size={20} aria-hidden="true" />
              <p>You don’t have any pending invitations.</p>
            </div>
          )}
        </section>
      </main>
    </section>
  );
}
