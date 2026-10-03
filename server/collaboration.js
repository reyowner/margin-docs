import { Server } from '@hocuspocus/server';
import { getSchema } from '@tiptap/core';
import { CommentAnchor, SuggestionAnchor } from '../src/editor-extensions.js';
import StarterKit from '@tiptap/starter-kit';
import { generateHTML, generateJSON } from '@tiptap/html';
import * as Y from 'yjs';
import { prosemirrorJSONToYDoc, yDocToProsemirrorJSON } from 'y-prosemirror';
import { hashSessionToken } from './auth.js';
import { canAccessDocument, canEditDocument, getDocumentRole } from './store.js';

const editorExtensions = [StarterKit.configure({ undoRedo: false }), CommentAnchor, SuggestionAnchor];
const schema = getSchema(editorExtensions);

function fromHtml(content) {
  return prosemirrorJSONToYDoc(schema, generateJSON(content || '<p></p>', editorExtensions), 'default');
}

export function createCollaborationServer(store, port = Number(process.env.COLLAB_PORT || 1234)) {
  return new Server({
    name: 'margin-local-collaboration',
    port,
    quiet: true,
    debounce: 700,
    maxDebounce: 2500,
    async onAuthenticate({ token, documentName, connectionConfig }) {
      const data = await store.read();
      const session = data.sessions.find((item) => item.tokenHash === hashSessionToken(String(token || '')) && Date.parse(item.expiresAt) > Date.now());
      const user = session && data.users.find((item) => item.id === session.userId);
      const document = data.documents.find((item) => item.id === documentName);
      if (!user || !canAccessDocument(document, user.id, data.workspaces)) throw new Error('You do not have access to this document.');
      const role = getDocumentRole(document, user.id, data.workspaces);
      if (!canEditDocument(document, user.id, data.workspaces)) connectionConfig.readOnly = true;
      return { userId: user.id, role };
    },
    async onLoadDocument({ documentName }) {
      const data = await store.read();
      const document = data.documents.find((item) => item.id === documentName);
      if (!document) throw new Error('Document not found.');
      if (!document.yState) return fromHtml(document.content);
      const ydoc = new Y.Doc();
      Y.applyUpdate(ydoc, Buffer.from(document.yState, 'base64'));
      return ydoc;
    },
    async onStoreDocument({ documentName, document }) {
      const state = Buffer.from(Y.encodeStateAsUpdate(document)).toString('base64');
      const html = generateHTML(yDocToProsemirrorJSON(document, 'default'), editorExtensions);
      await store.update((data) => {
        const saved = data.documents.find((item) => item.id === documentName);
        if (!saved) return;
        saved.yState = state;
        saved.content = html;
        saved.updatedAt = new Date().toISOString();
      });
    },
  });
}

export function attachCollaborationServer(collaborationServer, httpServer) {
  const [upgradeHandler] = collaborationServer.httpServer.listeners('upgrade');
  collaborationServer.httpServer.removeAllListeners('upgrade');
  collaborationServer.httpServer = httpServer;
  if (upgradeHandler) httpServer.on('upgrade', upgradeHandler);
  return collaborationServer;
}
