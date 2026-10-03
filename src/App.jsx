import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ArrowLeft, Check, ChevronDown, CircleHelp, FilePlus2, FileText, Home as HomeIcon,
  Layers3, LogOut, MoreHorizontal, Moon, Plus, Settings2,
  Share2, Sun, Users, X,
} from 'lucide-react';
import { CollaborativeEditor } from './components/collaborative-editor';
import { ReviewPanel } from './components/review-panel';
import { markdownToHtml } from './lib/markdown';
import { HomePage } from './components/home-page';
import { LoginPage } from './components/login-page';
import { useTheme } from './components/theme-provider';
import { Avatar, AvatarFallback } from './components/ui/avatar';
import { Badge } from './components/ui/badge';
import { Button } from './components/ui/button';
import { Card, CardContent } from './components/ui/card';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from './components/ui/dialog';
import { DropdownMenu, DropdownMenuCheckboxItem, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from './components/ui/dropdown-menu';
import { Input } from './components/ui/input';
import { Label } from './components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './components/ui/select';
import { Separator } from './components/ui/separator';

const API = '/api';

async function api(route, options = {}) {
  const response = await fetch(`${API}${route}`, {
    credentials: 'same-origin',
    ...options,
    headers: { 'Content-Type': 'application/json', ...options.headers },
  });
  if (response.status === 204) return null;
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error || 'Something went wrong. Try again.');
  return data;
}

const json = (value) => ({ method: 'POST', body: JSON.stringify(value) });
const pickDefaultWorkspace = (workspaces, userId) => workspaces.find((workspace) => workspace.ownerId === userId && workspace.name === 'Personal') || workspaces.find((workspace) => workspace.ownerId === userId) || workspaces[0];

function Logo({ compact = false }) {
  return <div className={`brand-lockup${compact ? ' compact' : ''}`}><span className="brand-icon"><FileText size={17} /></span><span>margin</span></div>;
}

function ProfileMenu({ user, onLogout }) {
  const { theme, setTheme } = useTheme();
  return <DropdownMenu>
    <DropdownMenuTrigger asChild><Button variant="ghost" className="profile-trigger" aria-label="Open account menu"><Avatar className="profile-avatar"><AvatarFallback style={{ backgroundColor: user.color }}>{user.name.split(' ').map((part) => part[0]).join('').slice(0, 2)}</AvatarFallback></Avatar><span className="profile-name">{user.name.split(' ')[0]}</span><ChevronDown size={14} /></Button></DropdownMenuTrigger>
    <DropdownMenuContent align="end" className="profile-menu">
      <DropdownMenuLabel><span className="profile-menu-name">{user.name}</span><span className="profile-menu-email">{user.email}</span></DropdownMenuLabel>
      <DropdownMenuSeparator />
      <DropdownMenuItem onSelect={() => setTheme('light')}><Sun size={15} /> Light theme <span className="menu-check">{theme === 'light' ? <Check size={14} /> : null}</span></DropdownMenuItem>
      <DropdownMenuItem onSelect={() => setTheme('dark')}><Moon size={15} /> Dark theme <span className="menu-check">{theme === 'dark' ? <Check size={14} /> : null}</span></DropdownMenuItem>
      <DropdownMenuSeparator />
      <DropdownMenuItem className="logout-menu-item" onSelect={onLogout}><LogOut size={15} /> Sign out</DropdownMenuItem>
    </DropdownMenuContent>
  </DropdownMenu>;
}

function WorkspaceSidebar({ user, workspaces, activeWorkspace, onSelectWorkspace, onNewWorkspace, onRenameWorkspace, selectedNav, onSelectNav, onCreateDocument, onImport, onLogout }) {
  return <aside className="sidebar">
    <div className="sidebar-brand"><Logo /><span className="local-badge">LOCAL</span></div>
    <div className="workspace-block">
      <div className="workspace-select-wrap"><div className="workspace-monogram">{activeWorkspace?.name?.[0] || 'P'}</div><Select value={activeWorkspace?.id || ''} onValueChange={onSelectWorkspace}><SelectTrigger aria-label="Choose workspace" className="workspace-select"><span className="workspace-select-copy"><strong>{activeWorkspace?.name || 'Your workspace'}</strong><small>Workspace</small></span></SelectTrigger><SelectContent align="start" className="workspace-options">{workspaces.map((workspace) => <SelectItem key={workspace.id} value={workspace.id}><span className="workspace-option"><span className="workspace-option-icon"><Layers3 size={14} /></span><span>{workspace.name}</span>{workspace.ownerId !== user.id && <span className="workspace-shared">Shared</span>}</span></SelectItem>)}</SelectContent></Select></div>
      <DropdownMenu><DropdownMenuTrigger asChild><Button variant="ghost" size="icon" aria-label="Workspace options" className="workspace-options-trigger"><MoreHorizontal size={17} /></Button></DropdownMenuTrigger><DropdownMenuContent align="start"><DropdownMenuItem onSelect={onNewWorkspace}><Plus size={14} /> Create workspace</DropdownMenuItem><DropdownMenuItem onSelect={onRenameWorkspace}><Settings2 size={14} /> Rename workspace</DropdownMenuItem></DropdownMenuContent></DropdownMenu>
    </div>
    <Button className="sidebar-create" onClick={onCreateDocument}><Plus size={16} /> New document</Button>
    <Button variant="outline" className="sidebar-import" onClick={onImport}><FilePlus2 size={15} /> Import a file</Button>
    <nav className="side-nav" aria-label="Workspace navigation">
      <span className="side-nav-label">YOUR SPACE</span>
      <button type="button" className={`side-nav-link${selectedNav === 'home' ? ' current' : ''}`} onClick={() => onSelectNav('home')}><HomeIcon size={16} /> Home</button>
      <button type="button" className={`side-nav-link${selectedNav === 'mine' ? ' current' : ''}`} onClick={() => onSelectNav('mine')}><FileText size={16} /> My documents</button>
      <button type="button" className={`side-nav-link${selectedNav === 'shared' ? ' current' : ''}`} onClick={() => onSelectNav('shared')}><Users size={16} /> Shared with me</button>
    </nav>
    <div className="workspace-prompt"><div className="prompt-icon"><Layers3 size={15} /></div><div><strong>Make a little room</strong><span>Separate projects into workspaces.</span></div><button type="button" aria-label="Create a workspace" onClick={onNewWorkspace}><Plus size={15} /></button></div>
    <div className="sidebar-bottom"><Separator /><div className="sidebar-help"><CircleHelp size={14} /><span>Local accounts · no cloud sync</span></div><ProfileMenu user={user} onLogout={onLogout} /></div>
  </aside>;
}

function markdownFromHtml(html) {
  const document = new DOMParser().parseFromString(html || '', 'text/html');
  const render = (node) => {
    if (node.nodeType === Node.TEXT_NODE) return node.textContent;
    if (node.nodeType !== Node.ELEMENT_NODE) return '';
    const inner = [...node.childNodes].map(render).join('');
    if (/^H[1-3]$/.test(node.tagName)) return `${'#'.repeat(Number(node.tagName[1]))} ${inner}\n\n`;
    if (node.tagName === 'LI') return `- ${inner}\n`;
    if (node.tagName === 'STRONG' || node.tagName === 'B') return `**${inner}**`;
    if (node.tagName === 'EM' || node.tagName === 'I') return `_${inner}_`;
    if (node.tagName === 'U') return inner;
    if (node.tagName === 'P' || node.tagName === 'DIV') return `${inner}\n\n`;
    if (node.tagName === 'UL' || node.tagName === 'OL') return `${inner}\n`;
    return inner;
  };
  return [...document.body.childNodes].map(render).join('').trim();
}

function AppShell({ auth, onLogout }) {
  const [workspaces, setWorkspaces] = useState([]);
  const [users, setUsers] = useState([]);
  const [documents, setDocuments] = useState([]);
  const [activeWorkspaceId, setActiveWorkspaceId] = useState('');
  const [selectedNav, setSelectedNav] = useState('home');
  const [document, setDocument] = useState(null);
  const [title, setTitle] = useState('');
  const [connection, setConnection] = useState('disconnected');
  const [onlineUsers, setOnlineUsers] = useState([]);
  const [shareOpen, setShareOpen] = useState(false);
  const [peopleOpen, setPeopleOpen] = useState(false);
  const [workspaceOpen, setWorkspaceOpen] = useState(false);
  const [renameWorkspaceOpen, setRenameWorkspaceOpen] = useState(false);
  const [deleteId, setDeleteId] = useState('');
  const [workspaceName, setWorkspaceName] = useState('');
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState('editor');
  const [reviewOpen, setReviewOpen] = useState(false);
  const [reviewTab, setReviewTab] = useState('comments');
  const [comments, setComments] = useState([]);
  const [suggestions, setSuggestions] = useState([]);
  const [versions, setVersions] = useState([]);
  const [selection, setSelection] = useState(null);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [savingTitle, setSavingTitle] = useState(false);
  const [exportingPdf, setExportingPdf] = useState(false);
  const fileInput = useRef(null);
  const editorRef = useRef(null);
  const currentUser = auth.user;
  const activeWorkspace = workspaces.find((workspace) => workspace.id === activeWorkspaceId) || null;

  const reloadDocuments = useCallback(async () => {
    const list = await api('/documents');
    setDocuments(list);
    return list;
  }, []);

  const reloadDocument = useCallback(async (id) => {
    const updated = await api(`/documents/${id}`);
    setDocument((current) => current?.id === id ? { ...current, ...updated } : current);
    await reloadDocuments();
    return updated;
  }, [reloadDocuments]);

  const loadReview = useCallback(async (id) => {
    try {
      const [commentData, suggestionData, versionData] = await Promise.all([
        api(`/documents/${id}/comments`), api(`/documents/${id}/suggestions`), api(`/documents/${id}/versions`),
      ]);
      setComments(commentData); setSuggestions(suggestionData); setVersions(versionData);
    } catch (err) { setError(err.message); }
  }, []);

  useEffect(() => {
    if (!reviewOpen || !document) return undefined;
    loadReview(document.id);
    const timer = setInterval(() => loadReview(document.id), 5000);
    return () => clearInterval(timer);
  }, [reviewOpen, document?.id, loadReview]);

  useEffect(() => {
    let active = true;
    Promise.all([api('/workspaces'), api('/users'), api('/documents')]).then(([workspaceList, userList, docList]) => {
      if (!active) return;
      setWorkspaces(workspaceList);
      setUsers(userList);
      setDocuments(docList);
      const storedId = localStorage.getItem(`margin-workspace-${currentUser.id}`);
      const chosen = workspaceList.find((item) => item.id === storedId) || pickDefaultWorkspace(workspaceList, currentUser.id);
      if (chosen) setActiveWorkspaceId(chosen.id);
    }).catch((err) => { if (active) setError(err.message); });
    return () => { active = false; };
  }, [currentUser.id]);

  useEffect(() => {
    if (activeWorkspaceId) localStorage.setItem(`margin-workspace-${currentUser.id}`, activeWorkspaceId);
  }, [activeWorkspaceId, currentUser.id]);

  const openDocument = useCallback(async (id) => {
    try {
      setError('');
      const [loaded, token] = await Promise.all([api(`/documents/${id}`), api(`/documents/${id}/collaboration-token`)]);
      setDocument({ ...loaded, collaborationToken: token.token });
      setTitle(loaded.title);
      setSelectedNav(loaded.shared ? 'shared' : 'mine');
      setConnection('connecting');
    } catch (err) { setError(err.message); }
  }, []);

  useEffect(() => {
    if (!document || title === document.title) return undefined;
    const timer = setTimeout(async () => {
      setSavingTitle(true);
      try {
        const updated = await api(`/documents/${document.id}`, { method: 'PATCH', body: JSON.stringify({ title }) });
        setDocument((current) => current?.id === updated.id ? { ...current, ...updated, collaborationToken: current.collaborationToken } : current);
        await reloadDocuments();
      } catch (err) { setError(err.message); }
      finally { setSavingTitle(false); }
    }, 500);
    return () => clearTimeout(timer);
  }, [title, document?.id, document?.title, reloadDocuments]);

  const createDocument = useCallback(async (newTitle = 'Untitled document', content = '<p></p>') => {
    try {
      if (!activeWorkspace) throw new Error('Choose a workspace before creating a document.');
      const created = await api('/documents', json({ title: newTitle, content, workspaceId: activeWorkspace.id }));
      await reloadDocuments();
      await openDocument(created.id);
    } catch (err) { setError(err.message); }
  }, [activeWorkspace, openDocument, reloadDocuments]);

  async function importFile(event) {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    const extension = file.name.split('.').pop().toLowerCase();
    if (!['txt', 'md'].includes(extension)) { setError('Choose a .txt or .md file.'); return; }
    if (file.size > 200_000) { setError('This file is over 200 KB. Choose a smaller text file.'); return; }
    const raw = await file.text();
    const escape = (value) => value.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;');
    const content = extension === 'md' ? markdownToHtml(raw) : raw.split(/\r?\n/).filter(Boolean).map((line) => `<p>${escape(line)}</p>`).join('') || '<p></p>';
    await createDocument(file.name.replace(/\.(txt|md)$/i, '').slice(0, 120), content);
  }

  async function createWorkspace(event) {
    event.preventDefault();
    try {
      const created = await api('/workspaces', json({ name: workspaceName }));
      setWorkspaces((list) => [created, ...list]);
      setActiveWorkspaceId(created.id);
      setWorkspaceName('');
      setWorkspaceOpen(false);
    } catch (err) { setError(err.message); }
  }

  async function renameWorkspace(event) {
    event.preventDefault();
    if (!activeWorkspace) return;
    try {
      const updated = await api(`/workspaces/${activeWorkspace.id}`, { method: 'PATCH', body: JSON.stringify({ name: workspaceName }) });
      setWorkspaces((list) => list.map((workspace) => workspace.id === updated.id ? updated : workspace));
      setWorkspaceName('');
      setRenameWorkspaceOpen(false);
    } catch (err) { setError(err.message); }
  }

  async function duplicateDocument(id) {
    try {
      const copy = await api(`/documents/${id}/duplicate`, json({ workspaceId: activeWorkspace?.id }));
      await reloadDocuments();
      await openDocument(copy.id);
    } catch (err) { setError(err.message); }
  }

  async function deleteDocument() {
    if (!deleteId) return;
    try {
      await api(`/documents/${deleteId}`, { method: 'DELETE' });
      if (document?.id === deleteId) setDocument(null);
      setDeleteId('');
      await reloadDocuments();
    } catch (err) { setError(err.message); }
  }

  async function downloadDocument() {
    try {
      const latest = await api(`/documents/${document.id}`);
      const fileName = `${(latest.title || 'document').replace(/[\\/:*?"<>|]/g, '-').slice(0, 80)}.md`;
      const url = URL.createObjectURL(new Blob([markdownFromHtml(latest.content)], { type: 'text/markdown;charset=utf-8' }));
      const link = Object.assign(window.document.createElement('a'), { href: url, download: fileName });
      link.click();
      URL.revokeObjectURL(url);
    } catch (err) { setError(err.message); }
  }

  async function exportPdf() {
    if (!editorRef.current) { setError('Wait for the document to finish loading, then try the PDF export again.'); return; }
    setExportingPdf(true);
    try {
      const { downloadDocumentPdf } = await import('./lib/pdf-export');
      const fileName = await downloadDocumentPdf(title, editorRef.current.getJSON());
      setNotice(`${fileName} is ready in your downloads.`);
    } catch (err) { setError(`Could not create the PDF. ${err.message}`); }
    finally { setExportingPdf(false); }
  }

  function openReview(tab) {
    setReviewTab(tab);
    setReviewOpen(true);
  }

  function captureSelection(tab) {
    const editor = editorRef.current;
    const range = editor?.state.selection;
    const quote = range && !range.empty ? editor.state.doc.textBetween(range.from, range.to, ' ').slice(0, 500) : '';
    if (tab === 'suggestions' && !quote) { setError('Select a phrase in the document before suggesting a change.'); return; }
    setSelection(quote ? { quote, from: range.from, to: range.to } : null);
    openReview(tab);
  }

  async function addComment(text) {
    if (!document) return false;
    try {
      const comment = await api(`/documents/${document.id}/comments`, json({ text, quote: selection?.quote || '' }));
      if (selection?.from && editorRef.current) editorRef.current.chain().setTextSelection({ from: selection.from, to: selection.to }).setMark('commentAnchor', { anchorId: comment.id }).run();
      setSelection(null); await loadReview(document.id); return true;
    } catch (err) { setError(err.message); return false; }
  }

  async function addSuggestion(replacement) {
    if (!document || !selection?.quote) return false;
    try {
      const suggestion = await api(`/documents/${document.id}/suggestions`, json({ replacement, quote: selection.quote }));
      if (editorRef.current) editorRef.current.chain().setTextSelection({ from: selection.from, to: selection.to }).setMark('suggestionAnchor', { anchorId: suggestion.id }).run();
      setSelection(null); await loadReview(document.id); return true;
    } catch (err) { setError(err.message); return false; }
  }

  function findAnchorRange(anchorType, anchorId) {
    const editor = editorRef.current;
    let found = null;
    editor?.state.doc.descendants((node, pos) => {
      if (found || !node.isText) return !found;
      const mark = node.marks.find((item) => item.type.name === anchorType && item.attrs.anchorId === anchorId);
      if (mark) found = { from: pos, to: pos + node.nodeSize };
      return !found;
    });
    return found;
  }

  function jumpToAnchor(anchorId, markName) {
    const range = findAnchorRange(markName, anchorId);
    if (range) editorRef.current?.chain().focus().setTextSelection(range).run();
  }

  async function replyToComment(id, text) {
    try { await api(`/documents/${document.id}/comments/${id}/replies`, json({ text })); await loadReview(document.id); return true; }
    catch (err) { setError(err.message); return false; }
  }

  async function resolveComment(id, status) {
    try { await api(`/documents/${document.id}/comments/${id}`, { method: 'PATCH', body: JSON.stringify({ status }) }); await loadReview(document.id); }
    catch (err) { setError(err.message); }
  }

  async function reviewSuggestion(suggestion, status) {
    try {
      const range = findAnchorRange('suggestionAnchor', suggestion.id);
      if (status === 'accepted' && !range) { setError('That text has changed since the suggestion was made. The suggestion was left pending.'); return; }
      if (range) {
        const chain = editorRef.current?.chain().focus().setTextSelection(range).unsetMark('suggestionAnchor');
        if (status === 'accepted') chain?.insertContent(suggestion.replacement);
        chain?.run();
      }
      await api(`/documents/${document.id}/suggestions/${suggestion.id}`, { method: 'PATCH', body: JSON.stringify({ status }) });
      await loadReview(document.id);
    } catch (err) { setError(err.message); }
  }

  async function createVersion() {
    try {
      await api(`/documents/${document.id}/versions`, json({ title: title || 'Untitled document', content: editorRef.current?.getHTML() || '<p></p>' }));
      await loadReview(document.id);
    } catch (err) { setError(err.message); }
  }

  async function restoreVersion(version) {
    try {
      const restored = await api(`/documents/${document.id}/versions/${version.id}/restore`, json({ currentContent: editorRef.current?.getHTML() || '<p></p>' }));
      editorRef.current?.commands.setContent(restored.content);
      setTitle(restored.title);
      await loadReview(document.id);
    } catch (err) { setError(err.message); }
  }

  async function invite(event) {
    event.preventDefault();
    if (!document) return;
    try {
      const updated = await api(`/documents/${document.id}/shares`, json({ email: inviteEmail, role: inviteRole }));
      setDocument((current) => ({ ...current, ...updated, collaborationToken: current.collaborationToken }));
      setInviteEmail('');
      setInviteRole('editor');
      await reloadDocuments();
    } catch (err) { setError(err.message); }
  }

  async function removeAccess(userId) {
    try {
      const updated = await api(`/documents/${document.id}/shares/${userId}`, { method: 'DELETE' });
      setDocument((current) => ({ ...current, ...updated, collaborationToken: current.collaborationToken }));
      await reloadDocuments();
    } catch (err) { setError(err.message); }
  }

  async function changeRole(userId, role) {
    try {
      const updated = await api(`/documents/${document.id}/shares/${userId}`, { method: 'PATCH', body: JSON.stringify({ role }) });
      setDocument((current) => ({ ...current, ...updated, collaborationToken: current.collaborationToken }));
      await reloadDocuments();
    } catch (err) { setError(err.message); }
  }

  const setPresence = useCallback((people) => setOnlineUsers(people), []);
  const setLiveStatus = useCallback((status) => setConnection(status), []);
  const isOwner = document?.ownerId === currentUser.id;
  const canEdit = ['owner', 'editor'].includes(document?.role);
  const canComment = ['owner', 'editor', 'commenter'].includes(document?.role);
  const liveIds = useMemo(() => new Set(onlineUsers.map((person) => person.id).filter(Boolean)), [onlineUsers]);
  const visiblePeople = useMemo(() => {
    const known = new Map((document?.collaborators || []).map((person) => [person.id, person]));
    for (const person of onlineUsers) {
      if (person.id) known.set(person.id, { ...known.get(person.id), ...person });
    }
    return [...known.values()];
  }, [document?.collaborators, onlineUsers]);
  const availableInvitees = users.filter((user) => user.id !== currentUser.id && !document?.shares?.some((share) => share.userId === user.id));
  const filteredDocs = useMemo(() => documents.filter((doc) => {
    if (selectedNav === 'shared') return doc.shared;
    if (selectedNav === 'mine') return !doc.shared && doc.workspaceId === activeWorkspaceId;
    return true;
  }), [documents, selectedNav, activeWorkspaceId]);

  async function logout() {
    try { await api('/auth/logout', { method: 'POST' }); }
    finally { onLogout(); }
  }

  function leaveDocument() {
    setDocument(null);
    setTitle('');
    setConnection('disconnected');
    setOnlineUsers([]);
    setSelectedNav('home');
  }

  return <div className="app-shell">
    <WorkspaceSidebar user={currentUser} workspaces={workspaces} activeWorkspace={activeWorkspace} onSelectWorkspace={setActiveWorkspaceId} onNewWorkspace={() => { setWorkspaceName(''); setWorkspaceOpen(true); }} onRenameWorkspace={() => { setWorkspaceName(activeWorkspace?.name || ''); setRenameWorkspaceOpen(true); }} selectedNav={selectedNav} onSelectNav={(value) => { leaveDocument(); setSelectedNav(value); }} onCreateDocument={() => createDocument()} onImport={() => fileInput.current?.click()} onLogout={logout} />
    <input ref={fileInput} className="sr-only" type="file" accept=".txt,.md,text/plain,text/markdown" onChange={importFile} />

    <main className="main-panel">
      <header className="topbar">
        <div className="topbar-left">{document ? <><Button variant="ghost" size="icon" aria-label="Back to documents" onClick={leaveDocument}><ArrowLeft size={17} /></Button><span className="topbar-crumb">Documents</span><span className="crumb-slash">/</span></> : <><span className="topbar-crumb">Workspace</span><span className="crumb-slash">/</span><span className="topbar-current">{selectedNav === 'shared' ? 'Shared with me' : selectedNav === 'mine' ? 'My documents' : 'Home'}</span></>}{activeWorkspace && <Badge variant="outline" className="topbar-workspace">{activeWorkspace.name}</Badge>}</div>
        <div className="topbar-right">{document && <><span className={`connection-state ${connection === 'connected' ? 'connected' : ''}`}>{connection === 'connected' ? <><span className="presence-dot" /> Live</> : connection === 'connecting' ? 'Connecting…' : 'Offline'}</span><Badge variant="outline" className="role-pill">{document.role}</Badge><Button variant="outline" className="top-share-button" disabled={!isOwner} onClick={() => setShareOpen(true)}><Share2 size={14} /> Share</Button><Button variant="ghost" className="collaborator-stack" aria-label="View collaborators" onClick={() => setPeopleOpen(true)}>{visiblePeople.slice(0, 3).map((person) => <Avatar key={person.id} className="stack-avatar"><AvatarFallback style={{ backgroundColor: person.color || '#6380b9' }}>{person.name?.[0] || '?'}</AvatarFallback></Avatar>)}{visiblePeople.length === 0 && <Users size={15} />}</Button><DropdownMenu><DropdownMenuTrigger asChild><Button variant="ghost" size="icon" aria-label="Document options"><MoreHorizontal size={18} /></Button></DropdownMenuTrigger><DropdownMenuContent align="end"><DropdownMenuItem onSelect={downloadDocument}><FileText size={14} /> Download as Markdown</DropdownMenuItem><DropdownMenuItem disabled={exportingPdf} onSelect={exportPdf}><FileText size={14} /> {exportingPdf ? 'Preparing PDF…' : 'Download as PDF'}</DropdownMenuItem><DropdownMenuItem onSelect={() => duplicateDocument(document.id)}><FilePlus2 size={14} /> Make a copy</DropdownMenuItem><DropdownMenuSeparator />{isOwner && <DropdownMenuItem className="menu-destructive" onSelect={() => setDeleteId(document.id)}>Move to trash</DropdownMenuItem>}</DropdownMenuContent></DropdownMenu></>}
          <ProfileMenu user={currentUser} onLogout={logout} />
        </div>
      </header>

      {error && <div className="toast-error" role="alert"><span>{error}</span><button type="button" aria-label="Dismiss message" onClick={() => setError('')}><X size={15} /></button></div>}
      {notice && <div className="toast-success" role="status"><span>{notice}</span><button type="button" aria-label="Dismiss message" onClick={() => setNotice('')}><X size={15} /></button></div>}
      {!document ? <HomePage user={currentUser} workspace={activeWorkspace} workspaces={workspaces} documents={filteredDocs} view={selectedNav} onCreate={() => createDocument()} onImport={() => fileInput.current?.click()} onOpen={openDocument} onDuplicate={duplicateDocument} onDelete={setDeleteId} /> : <section className="document-stage">
        <div className="document-meta"><div className="doc-type"><FileText size={14} /><span>{document.shared ? 'SHARED DOCUMENT' : 'DOCUMENT'}</span><span className="meta-dot">·</span><span>{document.workspaceName}</span></div><Badge variant={connection === 'connected' ? 'success' : 'outline'}>{connection === 'connected' ? 'Synced live' : 'Connecting'}</Badge></div>
        <div className="title-row"><input className="title-input" aria-label="Document title" value={title} onChange={(event) => setTitle(event.target.value)} placeholder="Untitled document" maxLength={120} disabled={!canEdit} /><span className="title-save" aria-live="polite">{savingTitle ? 'Saving title' : <><Check size={13} /> Saved</>}</span></div>
        <div className="author-line"><Avatar className="author-avatar"><AvatarFallback style={{ backgroundColor: document.owner?.color || '#4169d8' }}>{document.owner?.name?.[0] || '?'}</AvatarFallback></Avatar><span>{document.owner?.name || 'Owner'}</span><span className="meta-dot">·</span><Users size={14} /><span>{visiblePeople.length} {visiblePeople.length === 1 ? 'person' : 'people'}</span></div>
        <CollaborativeEditor key={`${document.id}:${currentUser.id}`} document={document} user={currentUser} token={document.collaborationToken || auth.collaborationToken} role={document.role} canComment={canComment} onPresence={setPresence} onConnection={setLiveStatus} onEditor={(editor) => { editorRef.current = editor; }} onComment={() => captureSelection('comments')} onSuggest={() => captureSelection('suggestions')} onHistory={() => openReview('history')} />
        <div className="page-footer"><span>Changes sync as you write</span><span>Private to your workspace and invited collaborators</span></div>
      </section>}
      <footer className="main-footer"><span>Made for work in progress.</span><span><span className="footer-dot" /> {document ? 'Live sync on' : 'Your space is ready'}</span></footer>
    </main>

    <Dialog open={shareOpen} onOpenChange={setShareOpen}><DialogContent className="share-dialog"><DialogHeader><Badge variant="outline" className="dialog-kicker"><Share2 size={12} /> DOCUMENT ACCESS</Badge><DialogTitle>Share this document</DialogTitle><DialogDescription>Choose what each collaborator can do.</DialogDescription></DialogHeader><form className="invite-form" onSubmit={invite}><div className="field-stack"><Label htmlFor="invite-account">Account</Label><Select value={inviteEmail} onValueChange={setInviteEmail} required><SelectTrigger id="invite-account"><SelectValue placeholder="Choose a person" /></SelectTrigger><SelectContent>{availableInvitees.map((person) => <SelectItem key={person.id} value={person.email}><span className="select-person"><span className="tiny-avatar" style={{ background: person.color }}>{person.name[0]}</span>{person.name}<small>{person.email}</small></span></SelectItem>)}</SelectContent></Select></div><div className="field-stack"><Label htmlFor="invite-role">Access level</Label><Select value={inviteRole} onValueChange={setInviteRole}><SelectTrigger id="invite-role"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="editor">Editor · can edit</SelectItem><SelectItem value="commenter">Commenter · notes & suggestions</SelectItem><SelectItem value="viewer">Viewer · read only</SelectItem></SelectContent></Select></div><Button type="submit" disabled={!inviteEmail || !isOwner}>Invite <Share2 size={14} /></Button></form><Separator /><div className="access-list"><div className="access-list-heading"><strong>People with access</strong><span>{document?.collaborators?.length || 0}</span></div>{document?.collaborators?.map((person) => <div className="access-person" key={person.id}><Avatar className="access-avatar"><AvatarFallback style={{ backgroundColor: person.color || '#6380b9' }}>{person.name[0]}</AvatarFallback></Avatar><div className="access-person-copy"><strong>{person.name}{person.id === currentUser.id && <small> You</small>}</strong><span>{person.email}</span></div>{isOwner && person.role !== 'owner' ? <Select value={person.role} onValueChange={(role) => changeRole(person.id, role)}><SelectTrigger className="access-role-select" aria-label={`Change ${person.name} role`}><SelectValue /></SelectTrigger><SelectContent><SelectItem value="editor">Editor</SelectItem><SelectItem value="commenter">Commenter</SelectItem><SelectItem value="viewer">Viewer</SelectItem></SelectContent></Select> : <Badge variant="secondary">Owner</Badge>}{isOwner && person.role !== 'owner' && <Button variant="ghost" size="icon" aria-label={`Remove ${person.name}`} onClick={() => removeAccess(person.id)}><X size={14} /></Button>}</div>)}</div><p className="dialog-footnote">Local demo accounts only. Changes apply to the next live connection.</p></DialogContent></Dialog>

    <ReviewPanel open={reviewOpen} onOpenChange={setReviewOpen} tab={reviewTab} onTabChange={setReviewTab} comments={comments} suggestions={suggestions} versions={versions} currentUser={currentUser} role={document?.role} selection={selection} onClearSelection={() => setSelection(null)} onAddComment={addComment} onReply={replyToComment} onResolve={resolveComment} onAddSuggestion={addSuggestion} onReviewSuggestion={reviewSuggestion} onCreateVersion={createVersion} onRestoreVersion={restoreVersion} onJump={jumpToAnchor} />

    <Dialog open={peopleOpen} onOpenChange={setPeopleOpen}><DialogContent className="people-dialog"><DialogHeader><Badge variant="outline" className="dialog-kicker"><Users size={12} /> COLLABORATORS</Badge><DialogTitle>Who’s in this document</DialogTitle><DialogDescription>People online appear with a green dot and their live cursor in the page.</DialogDescription></DialogHeader><div className="people-list">{visiblePeople.map((person) => <div className="people-row" key={person.id}><Avatar className="people-avatar"><AvatarFallback style={{ backgroundColor: person.color || '#6380b9' }}>{person.name?.[0] || '?'}</AvatarFallback></Avatar><div className="access-person-copy"><strong>{person.name}{person.id === currentUser.id && <small> You</small>}</strong><span>{person.email || (person.id === currentUser.id ? currentUser.email : '')}</span></div><span className={`online-status${liveIds.has(person.id) ? ' online' : ''}`}><i />{liveIds.has(person.id) ? 'Here now' : person.role === 'owner' ? 'Owner' : 'Invited'}</span></div>)}</div><DialogFooter><Button variant="outline" onClick={() => setPeopleOpen(false)}>Done</Button></DialogFooter></DialogContent></Dialog>

    <Dialog open={workspaceOpen} onOpenChange={setWorkspaceOpen}><DialogContent><form onSubmit={createWorkspace}><DialogHeader><Badge variant="outline" className="dialog-kicker"><Layers3 size={12} /> YOUR WORKSPACES</Badge><DialogTitle>Create a workspace</DialogTitle><DialogDescription>Give a project its own home. You can switch between workspaces from the sidebar.</DialogDescription></DialogHeader><div className="field-stack dialog-field"><Label htmlFor="workspace-name">Workspace name</Label><Input id="workspace-name" value={workspaceName} onChange={(event) => setWorkspaceName(event.target.value)} placeholder="e.g. Product launch" maxLength={60} autoFocus required /></div><DialogFooter><Button type="button" variant="outline" onClick={() => setWorkspaceOpen(false)}>Cancel</Button><Button type="submit">Create workspace <Plus size={15} /></Button></DialogFooter></form></DialogContent></Dialog>

    <Dialog open={renameWorkspaceOpen} onOpenChange={setRenameWorkspaceOpen}><DialogContent><form onSubmit={renameWorkspace}><DialogHeader><Badge variant="outline" className="dialog-kicker"><Settings2 size={12} /> WORKSPACE SETTINGS</Badge><DialogTitle>Rename workspace</DialogTitle><DialogDescription>Choose a name that helps you find this space again.</DialogDescription></DialogHeader><div className="field-stack dialog-field"><Label htmlFor="rename-workspace">Workspace name</Label><Input id="rename-workspace" value={workspaceName} onChange={(event) => setWorkspaceName(event.target.value)} maxLength={60} required /></div><DialogFooter><Button type="button" variant="outline" onClick={() => setRenameWorkspaceOpen(false)}>Cancel</Button><Button type="submit">Save name</Button></DialogFooter></form></DialogContent></Dialog>

    <Dialog open={Boolean(deleteId)} onOpenChange={(open) => { if (!open) setDeleteId(''); }}><DialogContent><DialogHeader><Badge variant="outline" className="dialog-kicker">DOCUMENT</Badge><DialogTitle>Move this draft to trash?</DialogTitle><DialogDescription>It will disappear from your workspace. This local demo does not have a trash folder.</DialogDescription></DialogHeader><DialogFooter><Button variant="outline" onClick={() => setDeleteId('')}>Keep document</Button><Button variant="destructive" onClick={deleteDocument}>Move to trash</Button></DialogFooter></DialogContent></Dialog>
  </div>;
}

export default function App() {
  const [auth, setAuth] = useState(null);
  const [checking, setChecking] = useState(true);
  const [bootError, setBootError] = useState('');

  useEffect(() => {
    let active = true;
    api('/auth/session').then((session) => { if (active) setAuth(session); }).catch((err) => {
      if (active && !err.message.includes('Sign in')) setBootError(err.message);
    }).finally(() => { if (active) setChecking(false); });
    return () => { active = false; };
  }, []);

  if (checking) return <main className="boot-screen"><div className="boot-mark"><FileText size={18} /></div><span>Opening your writing room…</span></main>;
  if (!auth) return <><LoginPage onLogin={setAuth} />{bootError && <div className="toast-error login-toast" role="alert">{bootError}</div>}</>;
  return <AppShell key={auth.user.id} auth={auth} onLogout={() => setAuth(null)} />;
}
