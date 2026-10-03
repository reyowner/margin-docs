import test from 'node:test';
import assert from 'node:assert/strict';
import { initialData } from '../server/store.js';
import { SupabaseStore } from '../server/supabase-store.js';

test('SupabaseStore retries a compare-and-swap conflict without losing the update', async () => {
  const requests = [];
  let revision = 0;
  let state = initialData();
  const fetchImpl = async (url, options = {}) => {
    requests.push({ url: String(url), ...options });
    if (options.method === 'PATCH') {
      if (revision === 0) {
        revision = 1;
        state.documents.push({
          id: 'parallel-write', title: 'Saved elsewhere', ownerId: 'reviewer',
          workspaceId: 'workspace-maya', shares: [], comments: [], suggestions: [], versions: [],
          createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
        });
        return new Response('[]', { status: 200, headers: { 'content-type': 'application/json' } });
      }
      state = JSON.parse(options.body).state;
      revision = Number(JSON.parse(options.body).revision);
      return new Response(JSON.stringify([{ revision }]), { status: 200, headers: { 'content-type': 'application/json' } });
    }
    if (options.method === 'POST') {
      return new Response('', { status: 201 });
    }
    return new Response(JSON.stringify([{ id: 'main', state, revision }]), { status: 200, headers: { 'content-type': 'application/json' } });
  };

  const store = new SupabaseStore({
    url: 'https://margin-test.supabase.co',
    publishableKey: 'public-key',
    apiKey: 'server-only-key',
    fetchImpl,
  });
  const result = await store.update((data) => {
    data.documents[0].title = 'Updated safely';
    return 'done';
  });

  assert.equal(result, 'done');
  assert.equal(revision, 2);
  assert.equal(state.documents[0].title, 'Updated safely');
  assert.equal(state.documents.some((document) => document.id === 'parallel-write'), true);
  assert.equal(requests.filter((request) => request.method === 'PATCH').length, 2);
  assert.equal(requests[0].headers['x-margin-store-api-key'], 'server-only-key');
});
