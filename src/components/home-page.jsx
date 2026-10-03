import { useMemo, useState } from 'react';
import { ArrowUpRight, Clock3, FilePlus2, FileText, MoreHorizontal, Search, Share2, Sparkles, Upload } from 'lucide-react';
import { Avatar, AvatarFallback } from './ui/avatar';
import { Badge } from './ui/badge';
import { Button } from './ui/button';
import { Card } from './ui/card';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from './ui/dropdown-menu';
import { Input } from './ui/input';
import { Separator } from './ui/separator';

export const friendlyDate = (date) => {
  if (!date) return 'Just now';
  const value = new Date(date);
  const today = new Date();
  if (value.toDateString() === today.toDateString()) return `Today, ${value.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}`;
  return value.toLocaleDateString([], { month: 'short', day: 'numeric' });
};

function DocumentCard({ document, onOpen, onDuplicate, onDelete }) {
  return <Card className="document-card group">
    <button type="button" className="document-card-open" onClick={() => onOpen(document.id)}>
      <div className="document-card-preview"><div className="preview-glyph"><FileText size={20} /></div><div className="preview-lines"><i /><i /><i /><i /></div><div className="preview-orbit" /></div>
      <div className="document-card-info"><div className="document-title-row"><h3>{document.title || 'Untitled document'}</h3><ArrowUpRight size={14} className="document-open-arrow" /></div><div className="document-card-meta"><span>{document.shared ? `Shared by ${document.ownerName}` : document.workspaceName}</span><span className="meta-dot">·</span><span>{friendlyDate(document.updatedAt)}</span></div></div>
    </button>
    <DropdownMenu><DropdownMenuTrigger asChild><Button variant="ghost" size="icon" aria-label={`More options for ${document.title}`} className="document-card-menu"><MoreHorizontal size={16} /></Button></DropdownMenuTrigger><DropdownMenuContent align="end"><DropdownMenuItem onSelect={() => onOpen(document.id)}>Open document</DropdownMenuItem><DropdownMenuItem onSelect={() => onDuplicate(document.id)}>Make a copy</DropdownMenuItem>{!document.shared && <DropdownMenuItem className="menu-destructive" onSelect={() => onDelete(document.id)}>Move to trash</DropdownMenuItem>}</DropdownMenuContent></DropdownMenu>
  </Card>;
}

export function HomePage({ user, workspace, workspaces, documents, onCreate, onImport, onOpen, onDuplicate, onDelete }) {
  const [query, setQuery] = useState('');
  const filtered = useMemo(() => documents.filter((document) => {
    const inWorkspace = document.shared || document.workspaceId === workspace?.id;
    return inWorkspace && `${document.title} ${document.ownerName} ${document.workspaceName}`.toLowerCase().includes(query.toLowerCase());
  }), [documents, workspace?.id, query]);
  const recent = filtered.slice(0, 8);
  const greeting = new Intl.DateTimeFormat(undefined, { hour: 'numeric' }).format(new Date()).includes('AM') ? 'Good morning' : 'Good to see you';

  return <div className="home-page">
    <section className="home-welcome"><div><Badge variant="outline" className="workspace-pill"><span className="presence-dot" /> {workspace?.name || 'Personal'} workspace</Badge><h1>{greeting}, {user.name.split(' ')[0]}.</h1><p>A clear place for the work you’re thinking through.</p></div><div className="welcome-decoration" aria-hidden="true"><div className="deco-page"><i /><i /><i /><b /></div><div className="deco-star">✳</div><div className="deco-dot" /></div></section>

    <section className="create-section" aria-label="Create a document"><div className="section-heading"><div><h2>Start something new</h2><p>Pick up a thought or bring in a file.</p></div></div><div className="create-options">
      <button type="button" className="create-option blank-option" onClick={onCreate}><span className="create-icon"><FilePlus2 size={18} /></span><span className="create-option-copy"><strong>Blank document</strong><small>A clean page, ready for anything</small></span><ArrowUpRight size={15} className="create-arrow" /></button>
      <button type="button" className="create-option import-option" onClick={onImport}><span className="create-icon"><Upload size={17} /></span><span className="create-option-copy"><strong>Import a file</strong><small>Bring in a .txt or .md draft</small></span><ArrowUpRight size={15} className="create-arrow" /></button>
    </div></section>

    <Separator className="home-divider" />
    <section className="recent-section"><div className="recent-heading"><div><div className="heading-with-icon"><Clock3 size={16} /><h2>Recent documents</h2></div><p>What you and your collaborators opened lately.</p></div><div className="recent-actions"><div className="search-wrap"><Search size={15} /><Input aria-label="Search documents" placeholder="Search documents" value={query} onChange={(event) => setQuery(event.target.value)} /></div><Badge variant="secondary">{recent.length} recent</Badge></div></div>
      {recent.length ? <div className="document-grid">{recent.map((doc) => <DocumentCard key={doc.id} document={doc} onOpen={onOpen} onDuplicate={onDuplicate} onDelete={onDelete} />)}</div> : <div className="empty-documents"><div className="empty-document-icon"><Sparkles size={17} /></div><strong>{query ? 'No matches for that search.' : 'Your next idea starts here.'}</strong><span>{query ? 'Try another title or clear the search.' : 'Create a document or import a text file to see it here.'}</span>{!query && <Button variant="outline" size="sm" onClick={onCreate}><FilePlus2 size={14} /> Create a document</Button>}</div>}
    </section>
    <footer className="home-footer"><span>Writing together, one clear thought at a time.</span><span><Share2 size={13} /> {workspaces.length} workspaces · Private by default</span></footer>
  </div>;
}
