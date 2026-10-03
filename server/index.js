import express from 'express';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { randomUUID } from 'node:crypto';
import { createSessionToken, hashSessionToken, verifyPassword } from './auth.js';
import { canAccessDocument, canCommentDocument, canEditDocument, getDocumentRole, isWorkspaceMember, JsonStore, publicUser } from './store.js';
import { createCollaborationServer } from './collaboration.js';

const here = path.dirname(fileURLToPath(import.meta.url));
const COOKIE_NAME = 'margin_session';
const SESSION_DAYS = 14;

function getCookie(req, name) {
  const raw = req.get('cookie') || '';
  for (const part of raw.split(';')) {
    const [key, ...value] = part.trim().split('=');
    if (key === name) return decodeURIComponent(value.join('='));
  }
  return '';
}

function cookieHeader(token, maxAge = SESSION_DAYS * 24 * 60 * 60) {
  const secure = process.env.VERCEL ? '; Secure' : '';
  return `${COOKIE_NAME}=${encodeURIComponent(token)}; HttpOnly; Path=/; SameSite=Lax${secure}; Max-Age=${maxAge}`;
}

async function currentSession(store, token) {
  if (!token) return null;
  const data = await store.read();
  const hashed = hashSessionToken(token);
  const session = data.sessions.find((item) => item.tokenHash === hashed && Date.parse(item.expiresAt) > Date.now());
  const user = session && data.users.find((item) => item.id === session.userId);
  return user ? { data, session, user } : null;
}

function safeDocument(document, data, userId) {
  const { yState: _yState, comments: _comments, suggestions: _suggestions, versions: _versions, ...visible } = document;
  const workspace = data.workspaces.find((item) => item.id === document.workspaceId);
  return {
    ...visible,
    role: getDocumentRole(document, userId, data.workspaces),
    shared: document.ownerId !== userId,
    workspaceName: workspace?.name || 'Personal',
    owner: publicUser(data.users.find((user) => user.id === document.ownerId) || { id: document.ownerId, name: 'Former member' }),
    collaborators: [
      ...(data.users.find((user) => user.id === document.ownerId) ? [{ ...publicUser(data.users.find((user) => user.id === document.ownerId)), role: 'owner' }] : []),
      ...document.shares.map((share) => {
        const user = data.users.find((item) => item.id === share.userId);
        return user ? { ...publicUser(user), role: share.role || 'editor' } : null;
      }).filter(Boolean),
    ],
  };
}

export function createApp({ store = new JsonStore(), staticDir = path.resolve(here, '../dist') } = {}) {
  const app = express();
  app.use(express.json({ limit: '2mb' }));

  app.get('/api/auth/demo-users', async (_req, res, next) => {
    try {
      const { users } = await store.read();
      res.json(users.map((user) => ({ ...publicUser(user), demoPassword: 'margin2026!' })));
    } catch (error) { next(error); }
  });

  app.post('/api/auth/login', async (req, res, next) => {
    try {
      const email = String(req.body.email || '').trim().toLowerCase();
      const password = String(req.body.password || '');
      const data = await store.read();
      const user = data.users.find((candidate) => candidate.email.toLowerCase() === email);
      if (!user || !verifyPassword(password, user.passwordSalt, user.passwordHash)) {
        return res.status(401).json({ error: 'Email or password is incorrect.' });
      }
      const token = createSessionToken();
      const session = {
        id: randomUUID(), tokenHash: hashSessionToken(token), userId: user.id,
        expiresAt: new Date(Date.now() + SESSION_DAYS * 24 * 60 * 60 * 1000).toISOString(),
      };
      await store.update((state) => state.sessions.push(session));
      res.setHeader('Set-Cookie', cookieHeader(token));
      res.json({ user: publicUser(user), collaborationToken: token });
    } catch (error) { next(error); }
  });

  app.post('/api/auth/logout', async (req, res, next) => {
    try {
      const token = getCookie(req, COOKIE_NAME);
      if (token) await store.update((data) => { data.sessions = data.sessions.filter((session) => session.tokenHash !== hashSessionToken(token)); });
      res.setHeader('Set-Cookie', cookieHeader('', 0));
      res.status(204).end();
    } catch (error) { next(error); }
  });

  app.get('/api/auth/session', async (req, res, next) => {
    try {
      const auth = await currentSession(store, getCookie(req, COOKIE_NAME));
      if (!auth) return res.status(401).json({ error: 'Sign in to continue.' });
      res.json({ user: publicUser(auth.user), collaborationToken: getCookie(req, COOKIE_NAME) });
    } catch (error) { next(error); }
  });

  app.use('/api', async (req, res, next) => {
    try {
      const auth = await currentSession(store, getCookie(req, COOKIE_NAME));
      if (!auth) return res.status(401).json({ error: 'Your session expired. Sign in again.' });
      req.user = auth.user;
      req.snapshot = auth.data;
      req.collaborationToken = getCookie(req, COOKIE_NAME);
      next();
    } catch (error) { next(error); }
  });

  app.get('/api/workspaces', async (req, res) => {
    const { workspaces } = await store.read();
    res.json(workspaces.filter((workspace) => isWorkspaceMember(workspace, req.user.id)));
  });

  app.post('/api/workspaces', async (req, res, next) => {
    try {
      const name = String(req.body.name || '').trim().slice(0, 60);
      if (!name) return res.status(400).json({ error: 'Give your workspace a name.' });
      const workspace = { id: randomUUID(), name, ownerId: req.user.id, members: [{ userId: req.user.id, role: 'owner' }], createdAt: new Date().toISOString() };
      await store.update((data) => data.workspaces.unshift(workspace));
      res.status(201).json(workspace);
    } catch (error) { next(error); }
  });

  app.patch('/api/workspaces/:id', async (req, res, next) => {
    try {
      const updated = await store.update((data) => {
        const workspace = data.workspaces.find((item) => item.id === req.params.id && item.ownerId === req.user.id);
        if (!workspace) return { error: 'Workspace not found.', status: 404 };
        const name = String(req.body.name || '').trim().slice(0, 60);
        if (!name) return { error: 'Give your workspace a name.', status: 400 };
        workspace.name = name;
        return { workspace };
      });
      if (updated.error) return res.status(updated.status).json({ error: updated.error });
      res.json(updated.workspace);
    } catch (error) { next(error); }
  });

  app.get('/api/users', async (req, res) => {
    const { users } = await store.read();
    res.json(users.map(publicUser));
  });

  app.get('/api/documents', async (req, res) => {
    const { documents, workspaces, users } = await store.read();
    const visible = documents.filter((doc) => canAccessDocument(doc, req.user.id, workspaces));
    visible.sort((a, b) => Date.parse(b.updatedAt) - Date.parse(a.updatedAt));
    res.json(visible.map((doc) => ({
      id: doc.id, title: doc.title, ownerId: doc.ownerId, workspaceId: doc.workspaceId,
      workspaceName: workspaces.find((item) => item.id === doc.workspaceId)?.name || 'Personal',
      updatedAt: doc.updatedAt, shared: doc.ownerId !== req.user.id,
      ownerName: users.find((user) => user.id === doc.ownerId)?.name || 'Former member',
    })));
  });

  app.post('/api/documents', async (req, res, next) => {
    try {
      const title = String(req.body.title || 'Untitled document').trim().slice(0, 120) || 'Untitled document';
      const content = String(req.body.content || '<p></p>');
      if (content.length > 1_500_000) return res.status(413).json({ error: 'This document is too large to import.' });
      const data = await store.read();
      const workspace = data.workspaces.find((item) => item.id === req.body.workspaceId && isWorkspaceMember(item, req.user.id))
        || data.workspaces.find((item) => item.ownerId === req.user.id && item.name === 'Personal');
      if (!workspace) return res.status(400).json({ error: 'Choose a workspace you belong to.' });
      const now = new Date().toISOString();
      const document = { id: randomUUID(), title, content, ownerId: req.user.id, workspaceId: workspace.id, shares: [], comments: [], suggestions: [], versions: [], createdAt: now, updatedAt: now };
      await store.update((state) => state.documents.unshift(document));
      res.status(201).json(safeDocument(document, data, req.user.id));
    } catch (error) { next(error); }
  });

  app.get('/api/documents/:id', async (req, res, next) => {
    try {
      const data = await store.read();
      const doc = data.documents.find((item) => item.id === req.params.id);
      if (!canAccessDocument(doc, req.user.id, data.workspaces)) return res.status(404).json({ error: 'Document not found.' });
      res.json(safeDocument(doc, data, req.user.id));
    } catch (error) { next(error); }
  });

  app.patch('/api/documents/:id', async (req, res, next) => {
    try {
      const updated = await store.update((data) => {
        const doc = data.documents.find((item) => item.id === req.params.id);
        if (!canAccessDocument(doc, req.user.id, data.workspaces)) return { error: 'Document not found.', status: 404 };
        if (!canEditDocument(doc, req.user.id, data.workspaces)) return { error: 'You need editor access to rename this document.', status: 403 };
        if (req.body.content !== undefined) return { error: 'Document text syncs through live collaboration.', status: 400 };
        if (req.body.title !== undefined) {
          const title = String(req.body.title).trim().slice(0, 120);
          doc.title = title || 'Untitled document';
        }
        doc.updatedAt = new Date().toISOString();
        return { doc: safeDocument(doc, data, req.user.id) };
      });
      if (updated.error) return res.status(updated.status).json({ error: updated.error });
      res.json(updated.doc);
    } catch (error) { next(error); }
  });

  app.post('/api/documents/:id/duplicate', async (req, res, next) => {
    try {
      const created = await store.update((data) => {
        const source = data.documents.find((item) => item.id === req.params.id);
        if (!canAccessDocument(source, req.user.id, data.workspaces)) return { error: 'Document not found.', status: 404 };
        const workspace = data.workspaces.find((item) => item.id === req.body.workspaceId && isWorkspaceMember(item, req.user.id))
          || data.workspaces.find((item) => item.ownerId === req.user.id && item.name === 'Personal');
        const now = new Date().toISOString();
        const copy = { ...source, id: randomUUID(), title: `${source.title} copy`, ownerId: req.user.id, workspaceId: workspace.id, shares: [], comments: [], suggestions: [], versions: [], yState: undefined, createdAt: now, updatedAt: now };
        data.documents.unshift(copy);
        return { document: safeDocument(copy, data, req.user.id) };
      });
      if (created.error) return res.status(created.status).json({ error: created.error });
      res.status(201).json(created.document);
    } catch (error) { next(error); }
  });

  app.delete('/api/documents/:id', async (req, res, next) => {
    try {
      const result = await store.update((data) => {
        const index = data.documents.findIndex((item) => item.id === req.params.id && item.ownerId === req.user.id);
        if (index < 0) return { error: 'Only the owner can delete this document.', status: 403 };
        data.documents.splice(index, 1);
        return { ok: true };
      });
      if (result.error) return res.status(result.status).json({ error: result.error });
      res.status(204).end();
    } catch (error) { next(error); }
  });

  app.post('/api/documents/:id/shares', async (req, res, next) => {
    try {
      const updated = await store.update((data) => {
        const doc = data.documents.find((item) => item.id === req.params.id);
        if (!doc || doc.ownerId !== req.user.id) return { error: 'Only the owner can invite collaborators.', status: 403 };
        const email = String(req.body.email || '').trim().toLowerCase();
        const invitee = data.users.find((candidate) => candidate.email.toLowerCase() === email);
        if (!invitee) return { error: 'No local account uses that email.', status: 400 };
        if (invitee.id === doc.ownerId) return { error: 'Choose another account.', status: 400 };
        const role = String(req.body.role || 'editor');
        if (!['editor', 'commenter', 'viewer'].includes(role)) return { error: 'Choose editor, commenter, or viewer access.', status: 400 };
        const existing = doc.shares.find((share) => share.userId === invitee.id);
        if (existing) existing.role = role;
        else doc.shares.push({ userId: invitee.id, role, addedAt: new Date().toISOString() });
        doc.updatedAt = new Date().toISOString();
        return { doc: safeDocument(doc, data, req.user.id) };
      });
      if (updated.error) return res.status(updated.status).json({ error: updated.error });
      res.json(updated.doc);
    } catch (error) { next(error); }
  });

  app.delete('/api/documents/:id/shares/:userId', async (req, res, next) => {
    try {
      const updated = await store.update((data) => {
        const doc = data.documents.find((item) => item.id === req.params.id);
        if (!doc || doc.ownerId !== req.user.id) return { error: 'Only the owner can change access.', status: 403 };
        doc.shares = doc.shares.filter((share) => share.userId !== req.params.userId);
        doc.updatedAt = new Date().toISOString();
        return { doc: safeDocument(doc, data, req.user.id) };
      });
      if (updated.error) return res.status(updated.status).json({ error: updated.error });
      res.json(updated.doc);
    } catch (error) { next(error); }
  });

  app.patch('/api/documents/:id/shares/:userId', async (req, res, next) => {
    try {
      const updated = await store.update((data) => {
        const doc = data.documents.find((item) => item.id === req.params.id);
        if (!doc || doc.ownerId !== req.user.id) return { error: 'Only the owner can change access.', status: 403 };
        const role = String(req.body.role || '');
        if (!['editor', 'commenter', 'viewer'].includes(role)) return { error: 'Choose editor, commenter, or viewer access.', status: 400 };
        const share = doc.shares.find((item) => item.userId === req.params.userId);
        if (!share) return { error: 'Collaborator not found.', status: 404 };
        share.role = role;
        doc.updatedAt = new Date().toISOString();
        return { doc: safeDocument(doc, data, req.user.id) };
      });
      if (updated.error) return res.status(updated.status).json({ error: updated.error });
      res.json(updated.doc);
    } catch (error) { next(error); }
  });

  function findAccessibleDocument(data, id, userId) {
    const doc = data.documents.find((item) => item.id === id);
    return canAccessDocument(doc, userId, data.workspaces) ? doc : null;
  }

  function safeComment(comment, data) {
    const author = data.users.find((item) => item.id === comment.authorId);
    return { ...comment, author: author ? publicUser(author) : { id: comment.authorId, name: 'Former member' }, replies: (comment.replies || []).map((reply) => {
      const replyAuthor = data.users.find((item) => item.id === reply.authorId);
      return { ...reply, author: replyAuthor ? publicUser(replyAuthor) : { id: reply.authorId, name: 'Former member' } };
    }) };
  }

  app.get('/api/documents/:id/comments', async (req, res) => {
    const data = await store.read();
    const doc = findAccessibleDocument(data, req.params.id, req.user.id);
    if (!doc) return res.status(404).json({ error: 'Document not found.' });
    res.json((doc.comments || []).map((comment) => safeComment(comment, data)));
  });

  app.post('/api/documents/:id/comments', async (req, res, next) => {
    try {
      const result = await store.update((data) => {
        const doc = findAccessibleDocument(data, req.params.id, req.user.id);
        if (!doc) return { error: 'Document not found.', status: 404 };
        if (!canCommentDocument(doc, req.user.id, data.workspaces)) return { error: 'You need commenter access to leave a note.', status: 403 };
        const text = String(req.body.text || '').trim().slice(0, 2000);
        if (!text) return { error: 'Write a comment first.', status: 400 };
        doc.comments ||= [];
        const comment = { id: randomUUID(), authorId: req.user.id, text, quote: String(req.body.quote || '').slice(0, 500), anchorId: String(req.body.anchorId || ''), status: 'open', replies: [], createdAt: new Date().toISOString() };
        doc.comments.push(comment);
        return { comment: safeComment(comment, data) };
      });
      if (result.error) return res.status(result.status).json({ error: result.error });
      res.status(201).json(result.comment);
    } catch (error) { next(error); }
  });

  app.post('/api/documents/:id/comments/:commentId/replies', async (req, res, next) => {
    try {
      const result = await store.update((data) => {
        const doc = findAccessibleDocument(data, req.params.id, req.user.id);
        if (!doc) return { error: 'Document not found.', status: 404 };
        if (!canCommentDocument(doc, req.user.id, data.workspaces)) return { error: 'You need commenter access to reply.', status: 403 };
        const comment = doc.comments.find((item) => item.id === req.params.commentId);
        if (!comment) return { error: 'Comment not found.', status: 404 };
        const text = String(req.body.text || '').trim().slice(0, 2000);
        if (!text) return { error: 'Write a reply first.', status: 400 };
        comment.replies ||= [];
        const reply = { id: randomUUID(), authorId: req.user.id, text, createdAt: new Date().toISOString() };
        comment.replies.push(reply);
        return { comment: safeComment(comment, data) };
      });
      if (result.error) return res.status(result.status).json({ error: result.error });
      res.status(201).json(result.comment);
    } catch (error) { next(error); }
  });

  app.patch('/api/documents/:id/comments/:commentId', async (req, res, next) => {
    try {
      const result = await store.update((data) => {
        const doc = findAccessibleDocument(data, req.params.id, req.user.id);
        if (!doc) return { error: 'Document not found.', status: 404 };
        const comment = doc.comments.find((item) => item.id === req.params.commentId);
        if (!comment) return { error: 'Comment not found.', status: 404 };
        if (comment.authorId !== req.user.id && !canEditDocument(doc, req.user.id, data.workspaces)) return { error: 'Only the author or an editor can resolve this note.', status: 403 };
        comment.status = req.body.status === 'resolved' ? 'resolved' : 'open';
        return { comment: safeComment(comment, data) };
      });
      if (result.error) return res.status(result.status).json({ error: result.error });
      res.json(result.comment);
    } catch (error) { next(error); }
  });

  app.get('/api/documents/:id/suggestions', async (req, res) => {
    const data = await store.read();
    const doc = findAccessibleDocument(data, req.params.id, req.user.id);
    if (!doc) return res.status(404).json({ error: 'Document not found.' });
    res.json((doc.suggestions || []).map((suggestion) => ({ ...suggestion, author: publicUser(data.users.find((item) => item.id === suggestion.authorId) || { id: suggestion.authorId, name: 'Former member' }) })));
  });

  app.post('/api/documents/:id/suggestions', async (req, res, next) => {
    try {
      const result = await store.update((data) => {
        const doc = findAccessibleDocument(data, req.params.id, req.user.id);
        if (!doc) return { error: 'Document not found.', status: 404 };
        if (!canCommentDocument(doc, req.user.id, data.workspaces)) return { error: 'You need commenter access to suggest a change.', status: 403 };
        const replacement = String(req.body.replacement || '').slice(0, 2000);
        const quote = String(req.body.quote || '').slice(0, 500);
        if (!quote || !replacement.trim()) return { error: 'Select text and write a replacement.', status: 400 };
        doc.suggestions ||= [];
        const suggestion = { id: randomUUID(), authorId: req.user.id, quote, replacement, anchorId: String(req.body.anchorId || ''), status: 'pending', createdAt: new Date().toISOString() };
        doc.suggestions.push(suggestion);
        return { suggestion: { ...suggestion, author: publicUser(req.user) } };
      });
      if (result.error) return res.status(result.status).json({ error: result.error });
      res.status(201).json(result.suggestion);
    } catch (error) { next(error); }
  });

  app.patch('/api/documents/:id/suggestions/:suggestionId', async (req, res, next) => {
    try {
      const result = await store.update((data) => {
        const doc = findAccessibleDocument(data, req.params.id, req.user.id);
        if (!doc) return { error: 'Document not found.', status: 404 };
        if (!canEditDocument(doc, req.user.id, data.workspaces)) return { error: 'Editor access is required to review suggestions.', status: 403 };
        const suggestion = doc.suggestions.find((item) => item.id === req.params.suggestionId);
        if (!suggestion) return { error: 'Suggestion not found.', status: 404 };
        if (!['accepted', 'rejected'].includes(req.body.status)) return { error: 'Choose accept or reject.', status: 400 };
        suggestion.status = req.body.status;
        suggestion.reviewedBy = req.user.id;
        suggestion.reviewedAt = new Date().toISOString();
        return { suggestion: { ...suggestion, author: publicUser(data.users.find((item) => item.id === suggestion.authorId)) } };
      });
      if (result.error) return res.status(result.status).json({ error: result.error });
      res.json(result.suggestion);
    } catch (error) { next(error); }
  });

  app.get('/api/documents/:id/versions', async (req, res) => {
    const data = await store.read();
    const doc = findAccessibleDocument(data, req.params.id, req.user.id);
    if (!doc) return res.status(404).json({ error: 'Document not found.' });
    res.json((doc.versions || []).map((version) => ({ id: version.id, title: version.title, createdAt: version.createdAt, author: publicUser(data.users.find((item) => item.id === version.authorId) || { id: version.authorId, name: 'Former member' }) })).reverse());
  });

  app.post('/api/documents/:id/versions', async (req, res, next) => {
    try {
      const result = await store.update((data) => {
        const doc = findAccessibleDocument(data, req.params.id, req.user.id);
        if (!doc) return { error: 'Document not found.', status: 404 };
        if (!canEditDocument(doc, req.user.id, data.workspaces)) return { error: 'Editor access is required to save a version.', status: 403 };
        doc.versions ||= [];
        const content = String(req.body.content ?? doc.content ?? '<p></p>');
        if (content.length > 1_500_000) return { error: 'This version is too large to save.', status: 413 };
        const version = { id: randomUUID(), title: String(req.body.title || '').trim().slice(0, 100) || doc.title || 'Untitled document', content, authorId: req.user.id, createdAt: new Date().toISOString() };
        doc.versions.push(version);
        if (doc.versions.length > 50) doc.versions.splice(0, doc.versions.length - 50);
        return { version: { id: version.id, title: version.title, createdAt: version.createdAt, author: publicUser(req.user) } };
      });
      if (result.error) return res.status(result.status).json({ error: result.error });
      res.status(201).json(result.version);
    } catch (error) { next(error); }
  });

  app.post('/api/documents/:id/versions/:versionId/restore', async (req, res, next) => {
    try {
      const result = await store.update((data) => {
        const doc = findAccessibleDocument(data, req.params.id, req.user.id);
        if (!doc) return { error: 'Document not found.', status: 404 };
        if (!canEditDocument(doc, req.user.id, data.workspaces)) return { error: 'Editor access is required to restore a version.', status: 403 };
        const version = doc.versions.find((item) => item.id === req.params.versionId);
        if (!version) return { error: 'Version not found.', status: 404 };
        if (doc.content !== version.content) {
          doc.versions.push({ id: randomUUID(), title: `Before restore · ${doc.title}`, content: String(req.body.currentContent || doc.content), authorId: req.user.id, createdAt: new Date().toISOString() });
          if (doc.versions.length > 50) doc.versions.splice(0, doc.versions.length - 50);
        }
        return { content: version.content, title: version.title };
      });
      if (result.error) return res.status(result.status).json({ error: result.error });
      res.json(result);
    } catch (error) { next(error); }
  });

  app.get('/api/documents/:id/collaboration-token', async (req, res, next) => {
    try {
      const data = await store.read();
      const doc = data.documents.find((item) => item.id === req.params.id);
      if (!canAccessDocument(doc, req.user.id, data.workspaces)) return res.status(404).json({ error: 'Document not found.' });
      res.json({ token: req.collaborationToken });
    } catch (error) { next(error); }
  });

  app.use('/api', (_req, res) => res.status(404).json({ error: 'Not found.' }));
  app.use((error, _req, res, _next) => {
    console.error(error);
    res.status(500).json({ error: 'Something went wrong. Please try again.' });
  });
  app.use(express.static(staticDir));
  app.get('*path', (_req, res) => res.sendFile(path.join(staticDir, 'index.html')));
  return app;
}

export function startApplication() {
  const store = new JsonStore();
  const port = Number(process.env.PORT || 3001);
  const collabPort = Number(process.env.COLLAB_PORT || 1234);
  const httpServer = createApp({ store }).listen(port, () => console.log(`Margin server listening on http://localhost:${port}`));
  const collaborationServer = createCollaborationServer(store, collabPort);
  collaborationServer.listen();
  console.log(`Live collaboration listening on ws://localhost:${collabPort}`);
  return { httpServer, collaborationServer };
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) startApplication();
