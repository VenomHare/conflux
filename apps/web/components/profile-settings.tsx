"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { FormEvent, useRef, useState } from "react";
import { Camera, Check, ImagePlus, Save, UserRound } from "lucide-react";
import { uploadProfileImage } from "@/app/actions/profile";
import { useWorkspaceFrame } from "@/components/workspace-frame";
import { api, send } from "@/lib/client-api";

function initials(name: string) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0])
    .join("")
    .toUpperCase();
}

export function ProfileSettingsPage() {
  const { workspaceId } = useParams<{ workspaceId: string }>();
  const { user, setUser } = useWorkspaceFrame();
  const fileRef = useRef<HTMLInputElement>(null);
  const [name, setName] = useState(user.name);
  const [busy, setBusy] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const dirty = name.trim() !== user.name;

  async function saveProfile(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!dirty) return;
    setBusy(true);
    setError("");
    setNotice("");
    try {
      const result = await api<{ user: typeof user }>(
        "/users/me",
        send("PATCH", { name: name.trim() }),
      );
      setUser(result.user);
      setName(result.user.name);
      setNotice("Profile details saved.");
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Profile could not be saved");
    } finally {
      setBusy(false);
    }
  }

  async function uploadAvatar(file: File) {
    setUploading(true);
    setError("");
    setNotice("");
    try {
      const data = new FormData();
      data.set("avatar", file);
      const uploaded = await uploadProfileImage(data);
      if (!uploaded.url) throw new Error(uploaded.error ?? "Photo upload failed");

      const result = await api<{ user: typeof user }>(
        "/users/me",
        send("PATCH", { avatar_url: uploaded.url }),
      );
      setUser(result.user);
      setNotice("Profile photo updated.");
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Photo upload failed");
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  return (
    <section className="main">
      <header className="topbar">
        <div className="topbar-leading">
          <div className="topbar-sidebar-toggle-slot" />
          <div>
            <Link href={`/w/${workspaceId}`}>{user.name}</Link>{" "}
            <span className="muted">/</span> Profile
          </div>
        </div>
        <div className="top-actions">
          <span className="muted">Account</span>
        </div>
      </header>
      <main className="settings-content profile-content">
        <div className="settings-heading">
          <div className="settings-eyebrow">
            <UserRound size={14} aria-hidden="true" /> Your account
          </div>
          <h1>Your profile.</h1>
          <p>A familiar name and photo help your team recognize you around Conflux.</p>
        </div>

        <section className="settings-panel profile-photo-panel">
          <div className="settings-panel-heading">
            <div>
              <h2>Profile photo</h2>
              <p>Choose a clear square image, up to 5 MB.</p>
            </div>
            <Camera size={18} color="var(--text-faint)" aria-hidden="true" />
          </div>
          <div className="profile-photo-row">
            <div
              className="profile-photo-avatar"
              role={user.avatar_url ? "img" : undefined}
              aria-label={user.avatar_url ? `${user.name} profile photo` : undefined}
              style={{
                backgroundColor: "var(--accent-subtle)",
                backgroundImage: user.avatar_url
                  ? `url("${user.avatar_url.replace(/["\\()]/g, encodeURIComponent)}")`
                  : undefined,
              }}
            >
              {!user.avatar_url && initials(user.name)}
            </div>
            <div className="profile-photo-copy">
              <strong>{user.name}</strong>
              <span className="muted">Shown beside your comments and pages</span>
            </div>
            <input
              ref={fileRef}
              className="sr-only"
              type="file"
              accept="image/png,image/jpeg,image/webp,image/avif"
              aria-label="Choose a profile photo"
              disabled={uploading}
              onChange={(event) => {
                const file = event.currentTarget.files?.[0];
                if (file) void uploadAvatar(file);
              }}
            />
            <button
              className="secondary profile-photo-button"
              type="button"
              disabled={uploading}
              onClick={() => fileRef.current?.click()}
            >
              <ImagePlus size={15} /> {uploading ? "Uploading…" : "Upload photo"}
            </button>
          </div>
        </section>

        <section className="settings-panel profile-details-panel">
          <div className="settings-panel-heading">
            <div>
              <h2>Personal details</h2>
              <p>Your email is used to sign in and receive workspace invitations.</p>
            </div>
          </div>
          <form className="settings-form" onSubmit={(event) => void saveProfile(event)}>
            <div className="field">
              <label htmlFor="profile-name">Name</label>
              <input
                id="profile-name"
                autoComplete="name"
                maxLength={100}
                value={name}
                onChange={(event) => setName(event.target.value)}
              />
            </div>
            <div className="field">
              <label htmlFor="profile-email">Email address</label>
              <input id="profile-email" type="email" value={user.email} readOnly />
              <small className="muted">Email changes aren’t available yet.</small>
            </div>
            <button className="primary" disabled={busy || !dirty}>
              <Save size={15} /> {busy ? "Saving…" : "Save changes"}
            </button>
          </form>
        </section>

        {notice && <p className="settings-notice" role="status"><Check size={14} /> {notice}</p>}
        {error && <p className="form-error settings-error" role="alert">{error}</p>}
      </main>
    </section>
  );
}
