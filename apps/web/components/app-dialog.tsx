"use client";

import { useEffect, useState } from "react";
import type { FormEvent } from "react";

type AppDialogProps = {
  open: boolean;
  title: string;
  description?: string;
  mode?: "confirm" | "input";
  label?: string;
  initialValue?: string;
  placeholder?: string;
  inputType?: "text" | "url";
  multiline?: boolean;
  confirmLabel?: string;
  danger?: boolean;
  busy?: boolean;
  onCancel: () => void;
  onConfirm: (value?: string) => void;
};

export function AppDialog({
  open,
  title,
  description,
  mode = "confirm",
  label,
  initialValue = "",
  placeholder,
  inputType = "text",
  multiline = false,
  confirmLabel = "Confirm",
  danger = false,
  busy = false,
  onCancel,
  onConfirm,
}: AppDialogProps) {
  const [value, setValue] = useState(initialValue);

  useEffect(() => {
    if (open) setValue(initialValue);
  }, [open, initialValue]);

  if (!open) return null;

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    onConfirm(mode === "input" ? value : undefined);
  }

  return (
    <div
      className="modal-backdrop"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget && !busy) onCancel();
      }}
    >
      <section className="modal" role="dialog" aria-modal="true" aria-labelledby="app-dialog-title">
        <h2 id="app-dialog-title">{title}</h2>
        {description && <p className="muted">{description}</p>}
        <form onSubmit={submit}>
          {mode === "input" && (
            <div className="field app-dialog-field">
              {label && <label htmlFor="app-dialog-value">{label}</label>}
              {multiline ? (
                <textarea
                  id="app-dialog-value"
                  autoFocus
                  value={value}
                  placeholder={placeholder}
                  onChange={(event) => setValue(event.target.value)}
                />
              ) : (
                <input
                  id="app-dialog-value"
                  autoFocus
                  type={inputType}
                  value={value}
                  placeholder={placeholder}
                  onChange={(event) => setValue(event.target.value)}
                />
              )}
            </div>
          )}
          <div className="modal-actions">
            <button className="secondary" type="button" disabled={busy} onClick={onCancel}>
              Cancel
            </button>
            <button
              className={danger ? "danger-button" : "primary"}
              type="submit"
              disabled={busy}
              style={{ width: "auto", margin: 0 }}
            >
              {busy ? "Working…" : confirmLabel}
            </button>
          </div>
        </form>
      </section>
    </div>
  );
}
