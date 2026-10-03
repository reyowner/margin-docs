import { useEffect, useState } from 'react';
import { HocuspocusProvider } from '@hocuspocus/provider';
import { EditorContent, useEditor } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Collaboration from '@tiptap/extension-collaboration';
import CollaborationCaret from '@tiptap/extension-collaboration-caret';
import { Bold, Heading1, Heading2, History, Italic, List, ListOrdered, LoaderCircle, MessageSquareText, PenLine, Underline as UnderlineIcon } from 'lucide-react';
import { CommentAnchor, SuggestionAnchor } from '../editor-extensions';
import { Badge } from './ui/badge';
import { Button } from './ui/button';
import { Separator } from './ui/separator';

function Tool({ label, active, disabled, onClick, children }) {
  return <Button type="button" variant="ghost" size="icon" className={`editor-tool${active ? ' active' : ''}`} aria-label={label} title={label} aria-pressed={active || false} disabled={disabled} onClick={onClick}>{children}</Button>;
}

export function CollaborativeEditor({ document, user, token, role, canComment, onPresence, onConnection, onEditor, onComment, onSuggest, onHistory }) {
  const [provider, setProvider] = useState(null);
  const color = user.color || '#4169d8';
  const canEdit = role === 'owner' || role === 'editor';
  useEffect(() => {
    const defaultCollabUrl = window.location.hostname === 'localhost'
      ? 'ws://localhost:1234'
      : `${window.location.protocol === 'https:' ? 'wss:' : 'ws:'}//${window.location.host}/api`;
    const instance = new HocuspocusProvider({ url: import.meta.env.VITE_COLLAB_URL || defaultCollabUrl, name: document.id, token, onSynced: ({ state }) => onConnection(state ? 'connected' : 'connecting'), onStatus: ({ status }) => onConnection(status) });
    const updatePresence = () => onPresence([...instance.awareness.getStates().values()].map((state) => state.user).filter(Boolean));
    instance.on('awarenessUpdate', updatePresence);
    setProvider(instance);
    return () => { instance.off('awarenessUpdate', updatePresence); instance.destroy(); setProvider(null); onPresence([]); onConnection('disconnected'); };
  }, [document.id, token, onPresence, onConnection]);

  const editor = useEditor({
    extensions: provider ? [StarterKit.configure({ undoRedo: false }), CommentAnchor, SuggestionAnchor, Collaboration.configure({ document: provider.document }), CollaborationCaret.configure({ provider, user: { id: user.id, name: user.name, color } })] : [StarterKit.configure({ undoRedo: false }), CommentAnchor, SuggestionAnchor],
    editable: Boolean(provider && canEdit),
    editorProps: { attributes: { class: 'document-editor', 'aria-label': 'Document content', spellcheck: 'true' } },
  }, [provider, canEdit]);
  useEffect(() => { onEditor?.(editor); return () => onEditor?.(null); }, [editor, onEditor]);

  const toggle = (name) => editor?.chain().focus()[name]().run();
  const preserveSelection = (event) => event.preventDefault();
  const editDisabled = !editor || !canEdit;
  return <>
    <div className="editor-toolbar">
      <div className="tool-group"><Tool label="Bold" active={editor?.isActive('bold')} disabled={editDisabled} onClick={() => toggle('toggleBold')}><Bold size={16} /></Tool><Tool label="Italic" active={editor?.isActive('italic')} disabled={editDisabled} onClick={() => toggle('toggleItalic')}><Italic size={16} /></Tool><Tool label="Underline" active={editor?.isActive('underline')} disabled={editDisabled} onClick={() => toggle('toggleUnderline')}><UnderlineIcon size={16} /></Tool></div>
      <Separator orientation="vertical" className="toolbar-separator" />
      <div className="tool-group"><Tool label="Heading 1" active={editor?.isActive('heading', { level: 1 })} disabled={editDisabled} onClick={() => editor?.chain().focus().toggleHeading({ level: 1 }).run()}><Heading1 size={17} /></Tool><Tool label="Heading 2" active={editor?.isActive('heading', { level: 2 })} disabled={editDisabled} onClick={() => editor?.chain().focus().toggleHeading({ level: 2 }).run()}><Heading2 size={17} /></Tool></div>
      <Separator orientation="vertical" className="toolbar-separator" />
      <div className="tool-group"><Tool label="Bulleted list" active={editor?.isActive('bulletList')} disabled={editDisabled} onClick={() => toggle('toggleBulletList')}><List size={17} /></Tool><Tool label="Numbered list" active={editor?.isActive('orderedList')} disabled={editDisabled} onClick={() => toggle('toggleOrderedList')}><ListOrdered size={17} /></Tool></div>
      <Separator orientation="vertical" className="toolbar-separator review-toolbar-separator" />
      <div className="editor-review-actions"><Button type="button" variant="ghost" size="sm" disabled={!editor || !canComment} onMouseDown={preserveSelection} onClick={onComment}><MessageSquareText size={14} /> Comment</Button><Button type="button" variant="ghost" size="sm" disabled={!editor || !canComment} onMouseDown={preserveSelection} onClick={onSuggest}><PenLine size={14} /> Suggest</Button><Button type="button" variant="ghost" size="sm" onMouseDown={preserveSelection} onClick={onHistory}><History size={14} /> History</Button></div>
      <div className="toolbar-status">{provider && editor ? <Badge variant="success"><span className="presence-dot" /> {canEdit ? 'Live editing' : 'Live view'}</Badge> : <Badge variant="outline"><LoaderCircle size={12} className="spin" /> Connecting</Badge>}</div>
    </div>
    {!canEdit && <div className="role-notice">{role === 'commenter' ? 'Comment access · editing is off' : 'View only · editing is off'}</div>}
    <div className="editor-sheet"><EditorContent editor={editor} /></div>
  </>;
}
