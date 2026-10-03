import { createServer } from 'node:http';
import { createApp } from './server/index.js';
import { attachCollaborationServer, createCollaborationServer } from './server/collaboration.js';
import { SupabaseStore } from './server/supabase-store.js';

const store = new SupabaseStore();
const app = createApp({ store });
const httpServer = createServer(app);
const collaborationServer = createCollaborationServer(store);
attachCollaborationServer(collaborationServer, httpServer);

export default httpServer;
