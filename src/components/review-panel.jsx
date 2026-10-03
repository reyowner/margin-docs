import { useEffect, useState } from 'react';
import { Check, CheckCheck, Clock3, CornerDownRight, History, MessageSquareText, PenLine, Send, Undo2, X } from 'lucide-react';
import { friendlyDate } from './home-page';
import { Avatar, AvatarFallback } from './ui/avatar';
import { Badge } from './ui/badge';
import { Button } from './ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from './ui/dialog';
import { Textarea } from './ui/textarea';

const tabs = [
  { id: 'comments', label: 'Comments', Icon: MessageSquareText },
  { id: 'suggestions', label: 'Suggestions', Icon: PenLine },
  { id: 'history', label: 'History', Icon: History },
];

function Person({ person, fallback }) {
  return <Avatar className="review-avatar"><AvatarFallback style={{ backgroundColor: person?.color || '#4169d8' }}>{person?.name?.[0] || fallback}</AvatarFallback></Avatar>;
}

export function ReviewPanel({ open, onOpenChange, tab, onTabChange, comments, suggestions, versions, currentUser, role, selection, onClearSelection, onAddComment, onReply, onResolve, onAddSuggestion, onReviewSuggestion, onCreateVersion, onRestoreVersion, onJump }) {
  const [commentText, setCommentText] = useState('');
  const [suggestionText, setSuggestionText] = useState('');
  const [replyText, setReplyText] = useState({});
  const canComment = ['owner', 'editor', 'commenter'].includes(role);
  const canEdit = ['owner', 'editor'].includes(role);

  useEffect(() => { if (!open) { setCommentText(''); setSuggestionText(''); setReplyText({}); } }, [open, tab]);

  async function submitComment(event) {
    event.preventDefault();
    if (await onAddComment(commentText)) setCommentText('');
  }
  async function submitSuggestion(event) {
    event.preventDefault();
    if (await onAddSuggestion(suggestionText)) setSuggestionText('');
  }
  async function submitReply(event, id) {
    event.preventDefault();
    if (await onReply(id, replyText[id])) setReplyText((current) => ({ ...current, [id]: '' }));
  }

  return <Dialog open={open} onOpenChange={onOpenChange}>
    <DialogContent className="review-dialog">
      <DialogHeader className="review-header"><div className="review-header-icon"><MessageSquareText size={17} /></div><div><DialogTitle>Review this document</DialogTitle><DialogDescription>Keep the conversation close to the words.</DialogDescription></div></DialogHeader>
      <div className="review-tabs" role="tablist" aria-label="Review tools">{tabs.map(({ id, label, Icon }) => <button key={id} type="button" role="tab" aria-selected={tab === id} className={`review-tab${tab === id ? ' active' : ''}`} onClick={() => onTabChange(id)}><Icon size={14} /><span>{label}</span>{id === 'comments' && comments.filter((item) => item.status === 'open').length > 0 && <b>{comments.filter((item) => item.status === 'open').length}</b>}{id === 'suggestions' && suggestions.filter((item) => item.status === 'pending').length > 0 && <b>{suggestions.filter((item) => item.status === 'pending').length}</b>}</button>)}</div>

      <div className="review-body">
        {tab === 'comments' && <>
          {canComment && <form className="review-compose" onSubmit={submitComment}><div className="review-compose-person"><Person person={currentUser} fallback="Y" /><span>Leave a note</span></div>{selection?.quote && <div className="review-selection"><span>“{selection.quote}”</span><button type="button" aria-label="Remove selected text" onClick={onClearSelection}><X size={13} /></button></div>}<Textarea aria-label="Write a comment" value={commentText} onChange={(event) => setCommentText(event.target.value)} placeholder="Add context or ask a question…" maxLength={2000} rows={3} /><div className="review-compose-actions"><span>Visible to document collaborators</span><Button type="submit" size="sm" disabled={!commentText.trim()}><Send size={13} /> Comment</Button></div></form>}
          <div className="review-list">{comments.length ? comments.slice().reverse().map((comment) => <article className={`review-card${comment.status === 'resolved' ? ' resolved' : ''}`} key={comment.id}>
            <div className="review-card-head"><Person person={comment.author} fallback="?" /><div className="review-author"><strong>{comment.author?.name || 'Collaborator'}</strong><span>{friendlyDate(comment.createdAt)}</span></div><Badge variant={comment.status === 'resolved' ? 'secondary' : 'outline'}>{comment.status === 'resolved' ? 'Resolved' : 'Open'}</Badge></div>
            {comment.quote && <button type="button" className="review-quote" onClick={() => onJump(comment.anchorId, 'commentAnchor')}>“{comment.quote}”</button>}
            <p className="review-card-text">{comment.text}</p>
            {(comment.replies || []).map((reply) => <div className="review-reply" key={reply.id}><CornerDownRight size={13} /><Person person={reply.author} fallback="?" /><div><strong>{reply.author?.name || 'Collaborator'}</strong><p>{reply.text}</p></div></div>)}
            {canComment && comment.status === 'open' && <form className="review-reply-form" onSubmit={(event) => submitReply(event, comment.id)}><Textarea aria-label={`Reply to ${comment.author?.name || 'comment'}`} rows={1} value={replyText[comment.id] || ''} placeholder="Reply…" onChange={(event) => setReplyText((current) => ({ ...current, [comment.id]: event.target.value }))} /><Button type="submit" variant="ghost" size="icon" aria-label="Send reply" disabled={!(replyText[comment.id] || '').trim()}><Send size={14} /></Button></form>}
            {comment.status === 'open' && (comment.authorId === currentUser.id || canEdit) && <button type="button" className="review-resolve" onClick={() => onResolve(comment.id, 'resolved')}><CheckCheck size={13} /> Resolve thread</button>}
          </article>) : <div className="review-empty"><div><MessageSquareText size={19} /></div><strong>No comments yet</strong><span>Select a phrase and leave the first note.</span></div>}</div>
        </>}

        {tab === 'suggestions' && <>
          {canComment && <form className="review-compose suggestion-compose" onSubmit={submitSuggestion}><div className="review-compose-person"><Person person={currentUser} fallback="Y" /><span>Propose an edit</span></div>{selection?.quote ? <div className="suggestion-diff"><span className="suggestion-before">− {selection.quote}</span><span className="suggestion-after">+ {suggestionText || 'Your replacement text'}</span></div> : <p className="selection-hint">Select a phrase in the document first, then choose Suggest.</p>}<Textarea aria-label="Suggested replacement" value={suggestionText} onChange={(event) => setSuggestionText(event.target.value)} placeholder="Replacement text…" maxLength={2000} rows={2} disabled={!selection?.quote} /><div className="review-compose-actions"><span>Editors can accept or dismiss it</span><Button type="submit" size="sm" disabled={!selection?.quote || !suggestionText.trim()}><PenLine size={13} /> Suggest edit</Button></div></form>}
          <div className="review-list">{suggestions.length ? suggestions.slice().reverse().map((suggestion) => <article className={`review-card suggestion-card ${suggestion.status}`} key={suggestion.id}>
            <div className="review-card-head"><Person person={suggestion.author} fallback="?" /><div className="review-author"><strong>{suggestion.author?.name || 'Collaborator'}</strong><span>{friendlyDate(suggestion.createdAt)}</span></div><Badge variant={suggestion.status === 'pending' ? 'outline' : 'secondary'}>{suggestion.status}</Badge></div>
            <button type="button" className="suggestion-diff review-suggestion-diff" onClick={() => onJump(suggestion.anchorId, 'suggestionAnchor')}><span className="suggestion-before">− {suggestion.quote}</span><span className="suggestion-after">+ {suggestion.replacement}</span></button>
            {suggestion.status === 'pending' && canEdit && <div className="suggestion-actions"><Button size="sm" onClick={() => onReviewSuggestion(suggestion, 'accepted')}><Check size={13} /> Accept</Button><Button size="sm" variant="outline" onClick={() => onReviewSuggestion(suggestion, 'rejected')}><X size={13} /> Dismiss</Button></div>}
            {suggestion.status !== 'pending' && <span className="suggestion-reviewer">{suggestion.status === 'accepted' ? 'Applied to the document' : 'Suggestion dismissed'}</span>}
          </article>) : <div className="review-empty"><div><PenLine size={18} /></div><strong>No suggestions yet</strong><span>Suggest a replacement for selected text.</span></div>}</div>
        </>}

        {tab === 'history' && <>
          <section className="history-intro"><span>Document versions</span><p>Save a named point to return to later. Restoring keeps the current draft in history.</p>{canEdit && <Button size="sm" variant="outline" onClick={onCreateVersion}><History size={14} /> Save current version</Button>}</section>
          <div className="version-list">{versions.length ? versions.map((version, index) => <article className="version-item" key={version.id}><div className="version-marker"><Clock3 size={14} /></div><div className="version-copy"><strong>{version.title}</strong><span>{version.author?.name || 'Collaborator'} · {friendlyDate(version.createdAt)}</span></div>{canEdit && <Button variant="ghost" size="sm" onClick={() => onRestoreVersion(version)}><Undo2 size={13} /> Restore</Button>}</article>) : <div className="review-empty"><div><History size={18} /></div><strong>No saved versions</strong><span>Save a point in time before a major rewrite.</span></div>}</div>
        </>}
      </div>
    </DialogContent>
  </Dialog>;
}
