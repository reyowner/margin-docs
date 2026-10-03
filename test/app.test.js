import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { createServer as createNetServer } from 'node:net';
import os from 'node:os';
import path from 'node:path';
import { HocuspocusProvider } from '@hocuspocus/provider';
import { getSchema } from '@tiptap/core';
import StarterKit from '@tiptap/starter-kit';
import { generateHTML, generateJSON } from '@tiptap/html';
import pdfMake from 'pdfmake/build/pdfmake.js';
import pdfFonts from 'pdfmake/build/vfs_fonts.js';
import * as Y from 'yjs';
import { yDocToProsemirrorJSON } from 'y-prosemirror';
import { JsonStore } from '../server/store.js';
import { createApp } from '../server/index.js';
import { createCollaborationServer } from '../server/collaboration.js';
import { markdownToHtml } from '../src/lib/markdown.js';
import { CommentAnchor, SuggestionAnchor } from '../src/editor-extensions.js';
import { buildDocumentPdfDefinition } from '../src/lib/pdf-export.js';

async function freePort() {
  const server = createNetServer();
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const { port } = server.address();
  await new Promise((resolve) => server.close(resolve));
  return port;
}

async function fixture(t, collaborative = false) {
  const directory = await mkdtemp(path.join(os.tmpdir(), 'margin-test-'));
  const storePath = path.join(directory, 'store.json');
  const store = new JsonStore(storePath);
  const server = createApp({ store }).listen(0);
  await new Promise((resolve) => server.once('listening', resolve));
  const base = `http://127.0.0.1:${server.address().port}`;
  let collab;
  let wsPort;
  if (collaborative) {
    wsPort = await freePort();
    collab = createCollaborationServer(store, wsPort);
    await collab.listen();
  }
  t.after(async () => {
    await collab?.destroy();
    await new Promise((resolve) => server.close(resolve));
    await rm(directory, { recursive: true, force: true });
  });
  return { base, storePath, store, wsPort };
}

async function login(base, email) {
  const response = await fetch(`${base}/api/auth/login`, {
    method: 'POST', headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ email, password: 'margin2026!' }),
  });
  assert.equal(response.status, 200);
  const cookie = response.headers.get('set-cookie').split(';')[0];
  return { cookie, user: (await response.json()).user };
}

function request(base, cookie, route, options = {}) {
  return fetch(`${base}${route}`, {
    ...options,
    headers: { 'content-type': 'application/json', cookie, ...options.headers },
  });
}

test('sign-in, create, share, reopen, rename, and persist a document', async (t) => {
  const { base, storePath } = await fixture(t);
  const owner = await login(base, 'domasigreoner@gmail.com');
  const guest = await login(base, 'maya@margin.local');
  const createResponse = await request(base, owner.cookie, '/api/documents', {
    method: 'POST', body: JSON.stringify({ title: 'Planning notes', workspaceId: 'workspace-renato', content: '<p>Preserved formatting.</p>' }),
  });
  assert.equal(createResponse.status, 201);
  const created = await createResponse.json();
  assert.equal(created.ownerId, 'renato');
  assert.equal((await request(base, guest.cookie, `/api/documents/${created.id}`)).status, 404);

  const shareResponse = await request(base, owner.cookie, `/api/documents/${created.id}/shares`, {
    method: 'POST', body: JSON.stringify({ email: 'maya@margin.local' }),
  });
  assert.equal(shareResponse.status, 200);
  const reopenedResponse = await request(base, guest.cookie, `/api/documents/${created.id}`);
  assert.equal(reopenedResponse.status, 200);
  assert.equal((await reopenedResponse.json()).content, '<p>Preserved formatting.</p>');
  assert.ok((await request(base, guest.cookie, '/api/documents').then((r) => r.json())).some((doc) => doc.id === created.id && doc.shared));
  assert.equal((await request(base, guest.cookie, `/api/documents/${created.id}`, {
    method: 'PATCH', body: JSON.stringify({ content: '<p>Text is synced live.</p>' }),
  })).status, 400);
  await request(base, owner.cookie, `/api/documents/${created.id}`, {
    method: 'PATCH', body: JSON.stringify({ title: 'Renamed notes' }),
  });
  const stored = JSON.parse(await readFile(storePath, 'utf8'));
  assert.equal(stored.documents.find((doc) => doc.id === created.id).title, 'Renamed notes');
  assert.equal(stored.documents.find((doc) => doc.id === created.id).content, '<p>Preserved formatting.</p>');
});

test('workspace creation is private and API routes require a signed-in account', async (t) => {
  const { base } = await fixture(t);
  assert.equal((await fetch(`${base}/api/documents`)).status, 401);
  const owner = await login(base, 'domasigreoner@gmail.com');
  const guest = await login(base, 'maya@margin.local');
  const created = await request(base, owner.cookie, '/api/workspaces', {
    method: 'POST', body: JSON.stringify({ name: 'Research' }),
  });
  assert.equal(created.status, 201);
  const workspace = await created.json();
  assert.ok((await request(base, owner.cookie, '/api/workspaces').then((r) => r.json())).some((item) => item.id === workspace.id));
  assert.ok(!(await request(base, guest.cookie, '/api/workspaces').then((r) => r.json())).some((item) => item.id === workspace.id));
});

test('two invited accounts receive live edits and collaborator presence', async (t) => {
  const { base, store, wsPort } = await fixture(t, true);
  const owner = await login(base, 'domasigreoner@gmail.com');
  const guest = await login(base, 'maya@margin.local');
  const created = await request(base, owner.cookie, '/api/documents', {
    method: 'POST', body: JSON.stringify({ title: 'Live draft', workspaceId: 'workspace-renato', content: '<p>Before edit</p>' }),
  }).then((response) => response.json());
  await request(base, owner.cookie, `/api/documents/${created.id}/shares`, {
    method: 'POST', body: JSON.stringify({ email: 'maya@margin.local' }),
  });

  const rawToken = (cookie) => decodeURIComponent(cookie.split('=')[1]);
  const connect = (token) => new Promise((resolve, reject) => {
    const provider = new HocuspocusProvider({ url: `ws://127.0.0.1:${wsPort}`, name: created.id, token: rawToken(token), onSynced: ({ state }) => state ? resolve(provider) : reject(new Error('Sync failed')) });
    provider.on('authenticationFailed', reject);
    provider.on('connect', () => setTimeout(() => { if (!provider.synced) reject(new Error('Connection did not sync')); }, 4000));
  });
  const first = await connect(owner.cookie);
  const second = await connect(guest.cookie);
  t.after(() => { first.destroy(); second.destroy(); });

  first.awareness.setLocalStateField('user', { id: owner.user.id, name: owner.user.name, color: owner.user.color, cursor: { anchor: null, head: null } });
  await new Promise((resolve, reject) => {
    const timeout = setTimeout(() => reject(new Error('Collaborator presence did not arrive')), 3000);
    const check = () => {
      if ([...second.awareness.getStates().values()].some((state) => state.user?.id === owner.user.id)) { clearTimeout(timeout); second.awareness.off('change', check); resolve(); }
    };
    second.awareness.on('change', check);
    check();
  });

  const fragment = first.document.getXmlFragment('default');
  first.document.transact(() => {
    fragment.delete(0, fragment.length);
    const paragraph = new Y.XmlElement('paragraph');
    const text = new Y.XmlText();
    text.insert(0, 'Edited live');
    paragraph.insert(0, [text]);
    fragment.insert(0, [paragraph]);
  });
  await new Promise((resolve, reject) => {
    const timeout = setTimeout(() => reject(new Error('Live edit did not reach collaborator')), 3000);
    const check = () => {
      const json = yDocToProsemirrorJSON(second.document, 'default');
      if (JSON.stringify(json).includes('Edited live')) { clearTimeout(timeout); fragment.observe(check); resolve(); }
    };
    fragment.observe(check);
    second.document.getXmlFragment('default').observe(check);
    check();
  });
  await new Promise((resolve) => setTimeout(resolve, 1000));
  const saved = (await store.read()).documents.find((doc) => doc.id === created.id);
  assert.match(saved.content, /Edited live/);
  assert.ok(saved.yState);
});

test('Markdown imports preserve basic structure and escape embedded HTML', () => {
  const result = markdownToHtml('# Plan\n\n**Focus** on the next step\n\n- Share a draft\n- <script>alert(1)</script>\n\n1. Review\n2. Publish');
  assert.match(result, /<h1>Plan<\/h1>/);
  assert.match(result, /<strong>Focus<\/strong>/);
  assert.match(result, /<ul><li>Share a draft<\/li>/);
  assert.match(result, /<ol><li>Review<\/li><li>Publish<\/li><\/ol>/);
  assert.doesNotMatch(result, /<script>/);
  assert.match(result, /&lt;script&gt;/);
});

test('review anchors survive HTML snapshot serialization', () => {
  const extensions = [StarterKit.configure({ undoRedo: false }), CommentAnchor, SuggestionAnchor];
  const content = '<p><span data-comment-anchor="comment-1">A comment</span> and <span data-suggestion-anchor="suggestion-1">a suggestion</span></p>';
  const document = generateJSON(content, extensions);
  const text = document.content[0].content;
  assert.ok(text[0].marks.some((mark) => mark.type === 'commentAnchor' && mark.attrs.anchorId === 'comment-1'));
  assert.ok(text[2].marks.some((mark) => mark.type === 'suggestionAnchor' && mark.attrs.anchorId === 'suggestion-1'));
  const snapshot = generateHTML(document, extensions);
  assert.match(snapshot, /data-comment-anchor="comment-1"/);
  assert.match(snapshot, /data-suggestion-anchor="suggestion-1"/);
});

test('comment and suggestion actions submit their review forms', async () => {
  const reviewPanel = await readFile(new URL('../src/components/review-panel.jsx', import.meta.url), 'utf8');
  assert.match(reviewPanel, /<form className="review-compose" onSubmit={submitComment}>[\s\S]*?<Button type="submit"[^>]*>[^<]*<Send/);
  assert.match(reviewPanel, /<form className="review-compose suggestion-compose" onSubmit={submitSuggestion}>[\s\S]*?<Button type="submit"[^>]*>[^<]*<PenLine/);
});

test('PDF export builds a real PDF with document formatting and list structure', async () => {
  pdfMake.addVirtualFileSystem(pdfFonts);
  const definition = buildDocumentPdfDefinition('Quarterly plan', {
    type: 'doc', content: [
      { type: 'heading', attrs: { level: 1 }, content: [{ type: 'text', text: 'Next steps' }] },
      { type: 'paragraph', content: [{ type: 'text', text: 'Ship the ', marks: [] }, { type: 'text', text: 'review flow', marks: [{ type: 'bold' }] }] },
      { type: 'bulletList', content: [{ type: 'listItem', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Invite the team' }] }] }] },
    ],
  }, new Date('2026-10-04T00:00:00Z'));
  assert.equal(definition.info.title, 'Quarterly plan');
  assert.equal(definition.content[4].text[1].bold, true);
  assert.deepEqual(definition.content[5].ul[0].text[0], { text: 'Invite the team' });
  const bytes = Buffer.from(await pdfMake.createPdf(definition).getBuffer());
  assert.equal(bytes.subarray(0, 5).toString(), '%PDF-');
  assert.ok(bytes.length > 1000);
});


test('viewer, commenter, and editor permissions are enforced across the API and live socket', async (t) => {
  const { base, store, wsPort } = await fixture(t, true);
  const owner = await login(base, 'domasigreoner@gmail.com');
  const maya = await login(base, 'maya@margin.local');
  const doc = await request(base, owner.cookie, '/api/documents', {
    method: 'POST', body: JSON.stringify({ title: 'Role checks', workspaceId: 'workspace-renato', content: '<p>Draft paragraph</p>' }),
  }).then((response) => response.json());
  await request(base, owner.cookie, `/api/documents/${doc.id}/shares`, {
    method: 'POST', body: JSON.stringify({ email: 'maya@margin.local', role: 'viewer' }),
  });
  assert.equal((await request(base, maya.cookie, `/api/documents/${doc.id}`).then((r) => r.json())).role, 'viewer');
  assert.equal((await request(base, maya.cookie, `/api/documents/${doc.id}`, { method: 'PATCH', body: JSON.stringify({ title: 'Blocked' }) })).status, 403);
  assert.equal((await request(base, maya.cookie, `/api/documents/${doc.id}/comments`, { method: 'POST', body: JSON.stringify({ text: 'Note' }) })).status, 403);

  const rawToken = (cookie) => decodeURIComponent(cookie.split('=')[1]);
  const readOnly = await new Promise((resolve, reject) => {
    const provider = new HocuspocusProvider({ url: `ws://127.0.0.1:${wsPort}`, name: doc.id, token: rawToken(maya.cookie), onSynced: ({ state }) => state ? resolve(provider) : reject(new Error('Viewer did not sync')) });
    provider.on('authenticationFailed', reject);
  });
  t.after(() => readOnly.destroy());
  const fragment = readOnly.document.getXmlFragment('default');
  readOnly.document.transact(() => {
    fragment.delete(0, fragment.length);
    const paragraph = new Y.XmlElement('paragraph');
    const text = new Y.XmlText();
    text.insert(0, 'Unauthorized edit');
    paragraph.insert(0, [text]);
    fragment.insert(0, [paragraph]);
  });
  await new Promise((resolve) => setTimeout(resolve, 1100));
  assert.doesNotMatch((await store.read()).documents.find((item) => item.id === doc.id).content, /Unauthorized edit/);
  readOnly.destroy();

  await request(base, owner.cookie, `/api/documents/${doc.id}/shares/reviewer`, { method: 'PATCH', body: JSON.stringify({ role: 'commenter' }) });
  const comment = await request(base, maya.cookie, `/api/documents/${doc.id}/comments`, {
    method: 'POST', body: JSON.stringify({ text: 'Could we clarify this?', quote: 'Draft paragraph', anchorId: 'comment-1' }),
  });
  assert.equal(comment.status, 201);
  const suggestion = await request(base, maya.cookie, `/api/documents/${doc.id}/suggestions`, {
    method: 'POST', body: JSON.stringify({ quote: 'Draft paragraph', replacement: 'A clearer paragraph', anchorId: 'suggestion-1' }),
  });
  assert.equal(suggestion.status, 201);
  const pending = await suggestion.json();
  assert.equal((await request(base, maya.cookie, `/api/documents/${doc.id}/suggestions/${pending.id}`, { method: 'PATCH', body: JSON.stringify({ status: 'accepted' }) })).status, 403);
  assert.equal((await request(base, maya.cookie, `/api/documents/${doc.id}`, { method: 'PATCH', body: JSON.stringify({ title: 'Blocked' }) })).status, 403);

  await request(base, owner.cookie, `/api/documents/${doc.id}/shares/reviewer`, { method: 'PATCH', body: JSON.stringify({ role: 'editor' }) });
  assert.equal((await request(base, maya.cookie, `/api/documents/${doc.id}`, { method: 'PATCH', body: JSON.stringify({ title: 'Editable again' }) })).status, 200);
  assert.equal((await request(base, maya.cookie, `/api/documents/${doc.id}/suggestions/${pending.id}`, { method: 'PATCH', body: JSON.stringify({ status: 'accepted' }) })).status, 200);
  const version = await request(base, owner.cookie, `/api/documents/${doc.id}/versions`, { method: 'POST', body: JSON.stringify({ title: 'First draft', content: '<p>First version</p>' }) });
  assert.equal(version.status, 201);
  const savedVersion = await version.json();
  const restored = await request(base, owner.cookie, `/api/documents/${doc.id}/versions/${savedVersion.id}/restore`, { method: 'POST', body: JSON.stringify({ currentContent: '<p>Current draft</p>' }) });
  assert.equal((await restored.json()).content, '<p>First version</p>');
  assert.equal((await request(base, owner.cookie, `/api/documents/${doc.id}/versions`).then((r) => r.json())).length, 2);
});
