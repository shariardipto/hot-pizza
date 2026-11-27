'use client';

import { EditorContent, useEditor } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import { Bold, Heading2, Heading3, Italic, Link2, List, ListOrdered, Pilcrow, Redo2, Undo2 } from 'lucide-react';
import { useEffect } from 'react';
import { cn } from '@/lib/utils';

/** Rich text (legal pages…) — HTML is sanitized again on the server. */
export function RichText({ value, onChange, placeholder }: { value: string; onChange: (html: string) => void; placeholder?: string }) {
  const editor = useEditor({
    extensions: [StarterKit.configure({ heading: { levels: [2, 3] }, link: { openOnClick: false } })],
    content: value || '',
    immediatelyRender: false,
    onUpdate: ({ editor }) => onChange(editor.isEmpty ? '' : editor.getHTML()),
  });
  useEffect(() => {
    if (editor && value !== editor.getHTML() && !editor.isFocused) editor.commands.setContent(value || '', { emitUpdate: false });
  }, [value, editor]);
  if (!editor) return <div className="input min-h-48" />;
  const btn = (active: boolean, onClick: () => void, Icon: any, title: string) => (
    <button type="button" title={title} onClick={onClick} className={cn('rounded p-1.5 text-zinc-600 hover:bg-zinc-100', active && 'bg-zinc-200 text-zinc-900')}>
      <Icon className="size-4" />
    </button>
  );
  return (
    <div className="overflow-hidden rounded-lg border border-zinc-300 bg-white focus-within:border-brand focus-within:ring-2 focus-within:ring-brand/20">
      <div className="flex flex-wrap gap-0.5 border-b border-zinc-200 bg-zinc-50 p-1">
        {btn(editor.isActive('paragraph'), () => editor.chain().focus().setParagraph().run(), Pilcrow, 'Paragraph')}
        {btn(editor.isActive('heading', { level: 2 }), () => editor.chain().focus().toggleHeading({ level: 2 }).run(), Heading2, 'Heading')}
        {btn(editor.isActive('heading', { level: 3 }), () => editor.chain().focus().toggleHeading({ level: 3 }).run(), Heading3, 'Sub-heading')}
        {btn(editor.isActive('bold'), () => editor.chain().focus().toggleBold().run(), Bold, 'Bold')}
        {btn(editor.isActive('italic'), () => editor.chain().focus().toggleItalic().run(), Italic, 'Italic')}
        {btn(editor.isActive('bulletList'), () => editor.chain().focus().toggleBulletList().run(), List, 'Bullet list')}
        {btn(editor.isActive('orderedList'), () => editor.chain().focus().toggleOrderedList().run(), ListOrdered, 'Numbered list')}
        {btn(editor.isActive('link'), () => {
          const prev = editor.getAttributes('link').href as string | undefined;
          const url = window.prompt('Link URL (https://…, mailto:…)', prev ?? 'https://');
          if (url === null) return;
          if (!url) editor.chain().focus().unsetLink().run();
          else editor.chain().focus().extendMarkRange('link').setLink({ href: url }).run();
        }, Link2, 'Link')}
        <span className="flex-1" />
        {btn(false, () => editor.chain().focus().undo().run(), Undo2, 'Undo')}
        {btn(false, () => editor.chain().focus().redo().run(), Redo2, 'Redo')}
      </div>
      <EditorContent editor={editor} placeholder={placeholder} />
    </div>
  );
}
