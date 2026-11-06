"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { ArrowRight, Check, Mail } from "lucide-react";
import { api, send } from "@/lib/client-api";

type InvitationDetails = {
  invitation: { email: string; role: string; expires_at: string };
  workspace: { id: string; name: string };
};

const roleNames: Record<string, string> = {
  ADMIN: "Admin",
  EDITOR: "Editor",
  COMMENTER: "Commenter",
  VIEWER: "Viewer",
};

export function InvitationPage() {
  const { token } = useParams<{ token: string }>();
  const router = useRouter();
  const [details, setDetails] = useState<InvitationDetails | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let active = true;
    api<InvitationDetails>(`/invitations/${token}`)
      .then((result) => active && setDetails(result))
      .catch((reason) => {
        if (active)
          setError(reason instanceof Error ? reason.message : "This invitation is unavailable");
      });
    return () => {
      active = false;
    };
  }, [token]);

  async function accept() {
    if (!details) return;
    setBusy(true);
    setError("");
    try {
      await api(`/invitations/${token}/accept`, send("POST"));
      router.replace(`/w/${details.workspace.id}`);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Invitation could not be accepted");
      setBusy(false);
    }
  }

  return (
    <main className="auth-wrap invitation-wrap">
      <section className="auth-card invitation-card">
        <Link href="/" className="brand">
          Conflux<span className="brand-dot">.</span>
        </Link>
        <div className="invitation-mark"><Mail size={20} /></div>
        {details ? (
          <>
            <h1>You’re invited.</h1>
            <p className="muted">
              Join <strong>{details.workspace.name}</strong> as a {roleNames[details.invitation.role] ?? details.invitation.role}.
            </p>
            <div className="invitation-email">{details.invitation.email}</div>
            <button className="primary invitation-accept" disabled={busy} onClick={() => void accept()}>
              <Check size={16} /> {busy ? "Joining…" : "Accept invitation"}
              {!busy && <ArrowRight size={15} />}
            </button>
            <p className="invitation-foot">This invitation is tied to the email address above.</p>
          </>
        ) : (
          <>
            <h1>{error ? "Invitation unavailable" : "Checking your invitation…"}</h1>
            <p className="muted">{error || "One moment while we look up the workspace."}</p>
            {error && <Link className="invitation-back" href="/">Back to Conflux</Link>}
          </>
        )}
      </section>
    </main>
  );
}
