"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { FormEvent, useEffect, useMemo, useState } from "react";
import {
  Check,
  Copy,
  Mail,
  Settings as SettingsIcon,
  ShieldCheck,
  UsersRound,
  UserRoundPlus,
} from "lucide-react";
import { useWorkspaceFrame } from "@/components/workspace-frame";
import { api, send } from "@/lib/client-api";

type Member = {
  id: string;
  role: string;
  joined_at: string;
  user: { id: string; name: string; email: string; avatar_url?: string | null };
};
type Invitation = { id: string; token: string; email: string; role: string };

const palette = ["#E11D48", "#EA580C", "#CA8A04", "#16A34A", "#0891B2", "#2563EB", "#7C3AED", "#C026D3"];
const editableRoles = ["ADMIN", "EDITOR", "COMMENTER", "VIEWER"];
const roleLabels: Record<string, string> = {
  OWNER: "Owner",
  ADMIN: "Admin",
  EDITOR: "Editor",
  COMMENTER: "Commenter",
  VIEWER: "Viewer",
};

function colorFor(value: string) {
  let hash = 0;
  for (const char of value) hash = (hash * 31 + char.charCodeAt(0)) | 0;
  return palette[Math.abs(hash) % palette.length];
}

function initials(name: string) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0])
    .join("")
    .toUpperCase();
}

export function WorkspaceSettingsPage({
  section,
}: {
  section: "general" | "members";
}) {
  const { workspaceId } = useParams<{ workspaceId: string }>();
  const router = useRouter();
  const { workspace, setWorkspace, user } = useWorkspaceFrame();
  const [members, setMembers] = useState<Member[]>([]);
  const [loading, setLoading] = useState(section === "members");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [name, setName] = useState(workspace.name);
  const [description, setDescription] = useState(workspace.description ?? "");
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState("EDITOR");
  const [sentInvitation, setSentInvitation] = useState<Invitation | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleteName, setDeleteName] = useState("");

  useEffect(() => {
    setName(workspace.name);
    setDescription(workspace.description ?? "");
  }, [workspace.id, workspace.name, workspace.description]);

  useEffect(() => {
    if (section !== "members") return;
    let active = true;
    setLoading(true);
    setError("");
    api<{ members: Member[] }>(`/workspaces/${workspaceId}/members`)
      .then((result) => {
        if (active) setMembers(result.members);
      })
      .catch((reason) => {
        if (active)
          setError(reason instanceof Error ? reason.message : "Members could not be loaded");
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [workspaceId, section]);

  const editable = ["OWNER", "ADMIN"].includes(workspace.myRole);
  const dirty =
    name.trim() !== workspace.name ||
    description.trim() !== (workspace.description ?? "");
  const sortedMembers = useMemo(
    () => [...members].sort((a, b) => a.user.name.localeCompare(b.user.name)),
    [members],
  );

  async function saveSettings(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!dirty) return;
    setBusy(true);
    setError("");
    setNotice("");
    try {
      const result = await api<{ workspace: typeof workspace }>(
        `/workspaces/${workspaceId}`,
        send("PATCH", { name: name.trim(), description: description.trim() || null }),
      );
      setWorkspace({ ...result.workspace, myRole: workspace.myRole });
      setName(result.workspace.name);
      setDescription(result.workspace.description ?? "");
      setNotice("Workspace details saved.");
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Changes could not be saved");
    } finally {
      setBusy(false);
    }
  }

  async function createInvitation(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError("");
    setNotice("");
    try {
      const result = await api<{ invitation: Invitation }>(
        `/workspaces/${workspaceId}/invitations`,
        send("POST", { email: inviteEmail, role: inviteRole }),
      );
      setSentInvitation(result.invitation);
      setInviteEmail("");
      setNotice(`Invitation ready for ${result.invitation.email}.`);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Invitation could not be created");
    } finally {
      setBusy(false);
    }
  }

  async function copyInvitation() {
    if (!sentInvitation) return;
    await navigator.clipboard.writeText(
      `${location.origin}/invite/${sentInvitation.token}`,
    );
    setNotice("Invite link copied.");
  }

  async function changeRole(member: Member, role: string) {
    setError("");
    try {
      await api(
        `/workspaces/${workspaceId}/members/${member.user.id}`,
        send("PATCH", { role }),
      );
      setMembers((current) =>
        current.map((item) =>
          item.user.id === member.user.id ? { ...item, role } : item,
        ),
      );
      setNotice(`${member.user.name} is now a ${roleLabels[role]}.`);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Role could not be updated");
    }
  }

  async function removeMember(member: Member) {
    if (!window.confirm(`Remove ${member.user.name} from this workspace?`)) return;
    setError("");
    try {
      await api(
        `/workspaces/${workspaceId}/members/${member.user.id}`,
        send("DELETE"),
      );
      setMembers((current) => current.filter((item) => item.user.id !== member.user.id));
      setNotice(`${member.user.name} was removed from the workspace.`);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Member could not be removed");
    }
  }

  async function deleteWorkspace() {
    if (deleteName !== workspace.name) return;
    setBusy(true);
    setError("");
    try {
      await api(`/workspaces/${workspaceId}`, send("DELETE"));
      router.replace("/");
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Workspace could not be deleted");
      setBusy(false);
    }
  }

  if (loading) {
    if (error)
      return (
        <main className="auth-wrap">
          <div className="status">{error}</div>
        </main>
      );
    return null;
  }

  const isOwner = workspace.myRole === "OWNER";
  const canManageMember = (member: Member) =>
    editable &&
    member.role !== "OWNER" &&
    member.user.id !== user?.id &&
    !(workspace.myRole === "ADMIN" && member.role === "ADMIN");

  return (
      <section className="main">
        <header className="topbar">
          <div className="topbar-leading">
            <div className="topbar-sidebar-toggle-slot" />
            <div>
              <Link href={`/w/${workspaceId}`}>{workspace.name}</Link>{" "}
              <span className="muted">/</span> {section === "members" ? "Members" : "Settings"}
            </div>
          </div>
          <div className="top-actions">
            <span className="muted">{roleLabels[workspace.myRole]}</span>
          </div>
        </header>
        <main className="settings-content">
          <div className="settings-heading">
            <div className="settings-eyebrow">
              {section === "members" ? <UsersRound size={14} /> : <SettingsIcon size={14} />}
              Workspace
            </div>
            <h1>{section === "members" ? "People, together." : "A home for your team."}</h1>
            <p>
              {section === "members"
                ? `Manage who can access ${workspace.name} and what they can do.`
                : "Keep your workspace details clear and recognizable to everyone."}
            </p>
          </div>
          <nav className="settings-tabs" aria-label="Workspace settings">
            <Link
              href={`/w/${workspaceId}/settings`}
              aria-current={section === "general" ? "page" : undefined}
            >
              <SettingsIcon size={15} /> General
            </Link>
            <Link
              href={`/w/${workspaceId}/settings/members`}
              aria-current={section === "members" ? "page" : undefined}
            >
              <UsersRound size={15} /> Members
            </Link>
          </nav>

          {section === "general" ? (
            <>
              <section className="settings-panel">
                <div className="settings-panel-heading">
                  <div>
                    <h2>Workspace details</h2>
                    <p>Names and descriptions help everyone find the right place.</p>
                  </div>
                  <ShieldCheck size={18} color="var(--text-faint)" aria-hidden="true" />
                </div>
                <form className="settings-form" onSubmit={(event) => void saveSettings(event)}>
                  <div className="field">
                    <label htmlFor="workspace-name">Workspace name</label>
                    <input
                      id="workspace-name"
                      value={name}
                      maxLength={100}
                      readOnly={!editable}
                      onChange={(event) => setName(event.target.value)}
                    />
                  </div>
                  <div className="field">
                    <label htmlFor="workspace-description">Description</label>
                    <textarea
                      id="workspace-description"
                      rows={3}
                      maxLength={1000}
                      placeholder="What does your team work on?"
                      value={description}
                      readOnly={!editable}
                      onChange={(event) => setDescription(event.target.value)}
                    />
                  </div>
                  {editable && (
                    <button className="primary" disabled={!dirty || busy}>
                      {busy ? "Saving…" : "Save changes"}
                    </button>
                  )}
                  {!editable && <p className="muted">Only workspace admins can edit these details.</p>}
                </form>
              </section>
              {isOwner && (
                <section className="settings-panel settings-danger">
                  <div className="settings-panel-heading">
                    <div>
                      <h2>Delete workspace</h2>
                      <p>Remove this workspace and its pages for everyone.</p>
                    </div>
                  </div>
                  {!confirmDelete ? (
                    <div className="settings-danger-actions">
                      <span className="muted">This action cannot be undone.</span>
                      <button className="danger-button" onClick={() => setConfirmDelete(true)}>
                        Delete workspace
                      </button>
                    </div>
                  ) : (
                    <div className="settings-inline-confirm">
                      <p className="muted">Type <strong>{workspace.name}</strong> to confirm.</p>
                      <div className="field">
                        <label htmlFor="confirm-workspace-name">Workspace name</label>
                        <input
                          id="confirm-workspace-name"
                          value={deleteName}
                          onChange={(event) => setDeleteName(event.target.value)}
                        />
                      </div>
                      <div className="settings-actions">
                        <button className="secondary" onClick={() => { setConfirmDelete(false); setDeleteName(""); }}>
                          Cancel
                        </button>
                        <button
                          className="danger-button"
                          disabled={busy || deleteName !== workspace.name}
                          onClick={() => void deleteWorkspace()}
                        >
                          {busy ? "Deleting…" : "Delete workspace"}
                        </button>
                      </div>
                    </div>
                  )}
                </section>
              )}
            </>
          ) : (
            <>
              {editable && (
                <section className="settings-panel">
                  <div className="settings-panel-heading">
                    <div>
                      <h2>Invite someone</h2>
                      <p>They’ll get a personal link to join this workspace.</p>
                    </div>
                    <UserRoundPlus size={18} color="var(--text-faint)" aria-hidden="true" />
                  </div>
                  <form className="invite-form" onSubmit={(event) => void createInvitation(event)}>
                    <div className="field">
                      <label htmlFor="invite-email">Email address</label>
                      <input
                        id="invite-email"
                        type="email"
                        required
                        value={inviteEmail}
                        placeholder="name@example.com"
                        onChange={(event) => setInviteEmail(event.target.value)}
                      />
                    </div>
                    <div className="field">
                      <label htmlFor="invite-role">Role</label>
                      <select
                        id="invite-role"
                        value={inviteRole}
                        onChange={(event) => setInviteRole(event.target.value)}
                      >
                        {editableRoles
                          .filter((role) => role !== "ADMIN" || isOwner)
                          .map((role) => <option key={role} value={role}>{roleLabels[role]}</option>)}
                      </select>
                    </div>
                    <button className="primary" disabled={busy}>
                      <Mail size={15} /> {busy ? "Preparing…" : "Create invite"}
                    </button>
                  </form>
                  {sentInvitation && (
                    <div className="invite-link-card">
                      <span className="invite-link-copy">
                        /invite/{sentInvitation.token}
                      </span>
                      <button onClick={() => void copyInvitation()}>
                        <Copy size={14} /> Copy link
                      </button>
                    </div>
                  )}
                </section>
              )}
              <section className="settings-panel member-panel">
                <div className="settings-panel-heading">
                  <div>
                    <h2>Workspace members</h2>
                    <p>People with access to {workspace.name}.</p>
                  </div>
                  <span className="member-count">{members.length} {members.length === 1 ? "person" : "people"}</span>
                </div>
                <div className="member-list">
                  {sortedMembers.map((member) => {
                    const canEditMember = canManageMember(member);
                    return (
                      <div className="member-row" key={member.id}>
                        <div className="member-identity">
                          <span className="member-avatar" style={{ background: colorFor(member.user.id) }}>
                            {initials(member.user.name)}
                          </span>
                          <div style={{ minWidth: 0 }}>
                            <div className="member-name">
                              {member.user.name}{member.user.id === user?.id ? " · you" : ""}
                            </div>
                            <div className="member-email">{member.user.email}</div>
                          </div>
                        </div>
                        {canEditMember ? (
                          <select
                            className="member-role-select"
                            aria-label={`Role for ${member.user.name}`}
                            value={member.role}
                            onChange={(event) => void changeRole(member, event.target.value)}
                          >
                            {editableRoles
                              .filter((role) => role !== "ADMIN" || isOwner)
                              .map((role) => <option key={role} value={role}>{roleLabels[role]}</option>)}
                          </select>
                        ) : (
                          <span className="member-role-label">{roleLabels[member.role]}</span>
                        )}
                        <div className="member-joined">
                          {member.role === "OWNER" ? "Workspace owner" : new Date(member.joined_at).toLocaleDateString(undefined, { month: "short", year: "numeric" })}
                        </div>
                        {canEditMember && (
                          <button className="member-remove" onClick={() => void removeMember(member)}>
                            Remove
                          </button>
                        )}
                      </div>
                    );
                  })}
                  {!sortedMembers.length && <p className="muted">No members to show yet.</p>}
                </div>
              </section>
            </>
          )}
          {notice && <p className="settings-notice" role="status"><Check size={14} /> {notice}</p>}
          {error && <p className="form-error settings-error" role="alert">{error}</p>}
        </main>
      </section>
  );
}
