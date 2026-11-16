"use client";

import type { Editor } from "@tiptap/react";
import { useState } from "react";
import { useEditorState } from "@tiptap/react";
import { AppDialog } from "@/components/app-dialog";

export function EditorToolbar({ editor }: { editor: Editor | null }) {
  const [linkDialogOpen, setLinkDialogOpen] = useState(false);
  const active = useEditorState({
    editor,
    selector: ({ editor: current }) => ({
      bold: current?.isActive("bold") ?? false,
      italic: current?.isActive("italic") ?? false,
      strike: current?.isActive("strike") ?? false,
      code: current?.isActive("code") ?? false,
      heading:
        [1, 2, 3].find((level) => current?.isActive("heading", { level })) ?? 0,
      bulletList: current?.isActive("bulletList") ?? false,
      orderedList: current?.isActive("orderedList") ?? false,
      blockquote: current?.isActive("blockquote") ?? false,
      link: current?.isActive("link") ?? false,
    }),
  });
  if (!editor || !active) return null;
  function saveLink(value?: string) {
    const url = value?.trim();
    if (url) {
      editor
        .chain()
        .focus()
        .extendMarkRange("link")
        .setLink({ href: url })
        .run();
    } else if (active.link) {
      editor.chain().focus().extendMarkRange("link").unsetLink().run();
    }
    setLinkDialogOpen(false);
  }
  const button = (
    label: string,
    title: string,
    selected: boolean,
    action: () => void,
  ) => (
    <button
      type="button"
      className={`editor-tool${selected ? " is-active" : ""}`}
      aria-label={title}
      title={title}
      onMouseDown={(event) => event.preventDefault()}
      onClick={action}
    >
      {label}
    </button>
  );
  return (
    <>
      <div
        className="editor-toolbar-controls"
        role="toolbar"
        aria-label="Text formatting"
      >
        {button("B", "Bold", active.bold, () =>
          editor.chain().focus().toggleBold().run(),
        )}
        {button("I", "Italic", active.italic, () =>
          editor.chain().focus().toggleItalic().run(),
        )}
        {button("S", "Strikethrough", active.strike, () =>
          editor.chain().focus().toggleStrike().run(),
        )}
        {button("</>", "Inline code", active.code, () =>
          editor.chain().focus().toggleCode().run(),
        )}
        <span className="editor-toolbar-divider" />
        {button("H1", "Heading 1", active.heading === 1, () =>
          editor.chain().focus().toggleHeading({ level: 1 }).run(),
        )}
        {button("H2", "Heading 2", active.heading === 2, () =>
          editor.chain().focus().toggleHeading({ level: 2 }).run(),
        )}
        {button("•", "Bulleted list", active.bulletList, () =>
          editor.chain().focus().toggleBulletList().run(),
        )}
        {button("1.", "Numbered list", active.orderedList, () =>
          editor.chain().focus().toggleOrderedList().run(),
        )}
        {button("❝", "Quote", active.blockquote, () =>
          editor.chain().focus().toggleBlockquote().run(),
        )}
        {button("↗", "Add or edit link", active.link, () =>
          setLinkDialogOpen(true),
        )}
      </div>
      <AppDialog
        open={linkDialogOpen}
        mode="input"
        title="Add a link"
        description="Enter the URL to attach to the selected text."
        label="Link URL"
        placeholder="https://example.com"
        initialValue={
          active.link ? String(editor.getAttributes("link").href ?? "") : ""
        }
        confirmLabel="Save link"
        onCancel={() => setLinkDialogOpen(false)}
        onConfirm={saveLink}
      />
    </>
  );
}
