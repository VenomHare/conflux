"use client";

import type { Editor } from "@tiptap/react";
import { useEditorState } from "@tiptap/react";

export function EditorToolbar({ editor }: { editor: Editor | null }) {
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
      {button("↗", "Add or edit link", active.link, () => {
        const url = window.prompt("Paste a link");
        if (url)
          editor
            .chain()
            .focus()
            .extendMarkRange("link")
            .setLink({ href: url })
            .run();
        else if (active.link)
          editor.chain().focus().extendMarkRange("link").unsetLink().run();
      })}
    </div>
  );
}
