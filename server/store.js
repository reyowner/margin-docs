import { mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { DEMO_PASSWORD, makePassword } from './auth.js';

const SEEDED_USERS = [
  { id: 'renato', name: 'Renato Reoner', email: 'domasigreoner@gmail.com', color: '#4169d8' },
  { id: 'reviewer', name: 'Maya Chen', email: 'maya@margin.local', color: '#bd7049' },
];

const WELCOME_HTML = '<h1>Make room for the work</h1><p>Margin is a calm place to collect a thought, shape it with someone else, and keep the useful parts easy to find.</p><h2>Start with the next small thing</h2><ul><li>Write down a decision while it is still fresh</li><li>Invite a teammate into an unfinished idea</li><li>Keep moving without losing the thread</li></ul><p><strong>Tip:</strong> open your profile to switch between the two local demo accounts.</p>';

function newUser(seed) {
  return { ...seed, ...makePassword(DEMO_PASSWORD), createdAt: new Date().toISOString() };
}

function initialWorkspaces() {
  return [
    { id: 'workspace-renato', name: 'Personal', ownerId: 'renato', members: [{ userId: 'renato', role: 'owner' }], createdAt: new Date().toISOString() },
    { id: 'workspace-maya', name: 'Personal', ownerId: 'reviewer', members: [{ userId: 'reviewer', role: 'owner' }], createdAt: new Date().toISOString() },
    { id: 'workspace-studio-renato', name: 'Studio', ownerId: 'renato', members: [{ userId: 'renato', role: 'owner' }], createdAt: new Date().toISOString() },
    { id: 'workspace-studio-maya', name: 'Studio', ownerId: 'reviewer', members: [{ userId: 'reviewer', role: 'owner' }], createdAt: new Date().toISOString() },
  ];
}

export function initialData() {
  const now = new Date().toISOString();
  return {
    schemaVersion: 2,
    users: SEEDED_USERS.map(newUser),
    sessions: [],
    workspaces: initialWorkspaces(),
    documents: [{
      id: 'welcome', title: 'Make room for the work', content: WELCOME_HTML,
      ownerId: 'renato', workspaceId: 'workspace-renato', shares: [], createdAt: now, updatedAt: now,
    }],
  };
}

export function normalizeData(data) {
  data.users ||= [];
  for (const seed of SEEDED_USERS) {
    const existing = data.users.find((user) => user.id === seed.id);
    if (!existing) data.users.push(newUser(seed));
    else {
      Object.assign(existing, seed);
      if (!existing.passwordHash || !existing.passwordSalt) Object.assign(existing, makePassword(DEMO_PASSWORD));
      if (!existing.createdAt) existing.createdAt = new Date().toISOString();
    }
  }
  data.sessions ||= [];
  data.documents ||= [];
  data.workspaces ||= [];

  const workspaceSeeds = initialWorkspaces();
  for (const workspace of workspaceSeeds) {
    if (!data.workspaces.some((candidate) => candidate.id === workspace.id)) data.workspaces.push(workspace);
  }
  for (const workspace of data.workspaces) {
    workspace.members ||= [{ userId: workspace.ownerId, role: 'owner' }];
  }
  for (const document of data.documents) {
    document.shares ||= [];
    document.comments ||= [];
    document.suggestions ||= [];
    document.versions ||= [];
    for (const share of document.shares) { if (!['editor', 'commenter', 'viewer'].includes(share.role)) share.role = 'editor'; }
    if (!document.workspaceId || !data.workspaces.some((workspace) => workspace.id === document.workspaceId)) document.workspaceId = document.ownerId === 'reviewer' ? 'workspace-maya' : 'workspace-renato';
    if (!document.createdAt) document.createdAt = document.updatedAt || new Date().toISOString();
    if (!document.updatedAt) document.updatedAt = document.createdAt;
  }
  data.schemaVersion = 2;
  return data;
}

export function publicUser(user) {
  const { passwordHash: _hash, passwordSalt: _salt, ...safe } = user;
  return safe;
}

export function isWorkspaceMember(workspace, userId) {
  return Boolean(workspace?.members?.some((member) => member.userId === userId));
}

export function getDocumentRole(document, userId, workspaces = []) {
  if (!document || !userId) return null;
  if (document.ownerId === userId) return 'owner';
  const share = document.shares?.find((item) => item.userId === userId);
  if (share) return share.role || 'editor';
  const workspace = workspaces.find((candidate) => candidate.id === document.workspaceId);
  return workspace?.members?.find((member) => member.userId === userId)?.role || null;
}

export function canAccessDocument(document, userId, workspaces = []) {
  return Boolean(getDocumentRole(document, userId, workspaces));
}

export function canEditDocument(document, userId, workspaces = []) {
  return ['owner', 'editor'].includes(getDocumentRole(document, userId, workspaces));
}

export function canCommentDocument(document, userId, workspaces = []) {
  return ['owner', 'editor', 'commenter'].includes(getDocumentRole(document, userId, workspaces));
}

export class JsonStore {
  constructor(filePath = process.env.MARGIN_STORE_PATH || path.resolve('data/store.json')) {
    this.filePath = filePath;
    this.pendingWrite = Promise.resolve();
  }

  async write(data) {
    await mkdir(path.dirname(this.filePath), { recursive: true });
    const tempPath = `${this.filePath}.tmp`;
    await writeFile(tempPath, JSON.stringify(data, null, 2), 'utf8');
    await rename(tempPath, this.filePath);
  }

  async read() {
    try {
      const raw = await readFile(this.filePath, 'utf8');
      const data = normalizeData(JSON.parse(raw));
      return data;
    } catch (error) {
      if (error.code !== 'ENOENT') throw error;
      const data = initialData();
      await this.write(data);
      return data;
    }
  }

  async update(mutator) {
    const operation = this.pendingWrite.then(async () => {
      const data = await this.read();
      const result = await mutator(data);
      await this.write(data);
      return result;
    });
    this.pendingWrite = operation.catch(() => {});
    return operation;
  }
}
