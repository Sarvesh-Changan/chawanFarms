"use client";

import { Link } from "@tiptap/extension-link";
import { EditorContent, useEditor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import { Bold, Heading2, Italic, Link as LinkIcon, List, ListOrdered, Quote, Redo2, Undo2 } from "lucide-react";
import { useEffect } from "react";

import { Button } from "@/components/ui/button";
import { isAllowedCmsLink } from "@/lib/cms-links";

export function RichTextEditor({ value, onChange, disabled, label }: {
  value: string;
  onChange: (html: string) => void;
  disabled?: boolean;
  label: string;
}) {
  const editor = useEditor({
    immediatelyRender: false,
    editable: !disabled,
    extensions: [StarterKit, Link.configure({ openOnClick: false, isAllowedUri: (href) => isAllowedCmsLink(href) })],
    content: value,
    onUpdate: ({ editor: current }) => onChange(current.getHTML()),
    editorProps: {
      attributes: {
        class: "prose prose-sm min-h-36 max-w-none p-3 outline-none focus-visible:ring-2 focus-visible:ring-ring",
        "aria-label": label,
      },
    },
  });

  useEffect(() => {
    if (!editor || editor.getHTML() === value) return;
    editor.commands.setContent(value, { emitUpdate: false });
  }, [editor, value]);

  useEffect(() => {
    editor?.setEditable(!disabled);
  }, [editor, disabled]);

  function setLink() {
    if (!editor) return;
    const current = editor.getAttributes("link").href as string | undefined;
    const href = window.prompt("Link URL (https, mailto, or tel)", current ?? "");
    if (href === null) return;
    if (!href) {
      editor.chain().focus().unsetLink().run();
      return;
    }
    if (!isAllowedCmsLink(href)) {
      window.alert("Use an https:, mailto:, or tel: URL.");
      return;
    }
    editor.chain().focus().setLink({ href }).run();
  }

  const controls = [
    { label: "Bold", icon: <Bold />, run: () => editor?.chain().focus().toggleBold().run(), active: editor?.isActive("bold") },
    { label: "Italic", icon: <Italic />, run: () => editor?.chain().focus().toggleItalic().run(), active: editor?.isActive("italic") },
    { label: "Heading", icon: <Heading2 />, run: () => editor?.chain().focus().toggleHeading({ level: 2 }).run(), active: editor?.isActive("heading", { level: 2 }) },
    { label: "Bulleted list", icon: <List />, run: () => editor?.chain().focus().toggleBulletList().run(), active: editor?.isActive("bulletList") },
    { label: "Numbered list", icon: <ListOrdered />, run: () => editor?.chain().focus().toggleOrderedList().run(), active: editor?.isActive("orderedList") },
    { label: "Quote", icon: <Quote />, run: () => editor?.chain().focus().toggleBlockquote().run(), active: editor?.isActive("blockquote") },
    { label: "Link", icon: <LinkIcon />, run: setLink, active: editor?.isActive("link") },
    { label: "Undo", icon: <Undo2 />, run: () => editor?.chain().focus().undo().run(), active: false },
    { label: "Redo", icon: <Redo2 />, run: () => editor?.chain().focus().redo().run(), active: false },
  ];

  return <div className="overflow-hidden rounded-lg border border-input bg-background">
    <div role="toolbar" aria-label={`${label} formatting`} className="flex flex-wrap gap-1 border-b bg-muted/50 p-2">
      {controls.map((control) => <Button key={control.label} type="button" variant={control.active ? "secondary" : "ghost"} size="sm" aria-label={control.label} aria-pressed={Boolean(control.active)} disabled={disabled || !editor} onClick={control.run}>{control.icon}</Button>)}
    </div>
    <EditorContent editor={editor} />
  </div>;
}
