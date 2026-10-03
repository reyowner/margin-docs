import { initialData, normalizeData } from './store.js';

const MAX_ATTEMPTS = 8;

export class SupabaseStore {
  constructor({
    url = process.env.SUPABASE_URL,
    publishableKey = process.env.SUPABASE_ANON_KEY,
    apiKey = process.env.MARGIN_STORE_API_KEY,
    fetchImpl = fetch,
  } = {}) {
    if (!url || !publishableKey || !apiKey) {
      throw new Error('Supabase storage is missing required server environment variables.');
    }
    this.endpoint = new URL('/rest/v1/margin_app_state', url).toString();
    this.publishableKey = publishableKey;
    this.apiKey = apiKey;
    this.fetchImpl = fetchImpl;
  }

  async request(url, { method = 'GET', body, prefer } = {}) {
    const response = await this.fetchImpl(url, {
      method,
      headers: {
        apikey: this.publishableKey,
        authorization: `Bearer ${this.publishableKey}`,
        'x-margin-store-api-key': this.apiKey,
        ...(body === undefined ? {} : { 'content-type': 'application/json' }),
        ...(prefer ? { prefer } : {}),
      },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    });
    const raw = await response.text();
    let payload = null;
    if (raw) {
      try { payload = JSON.parse(raw); }
      catch { payload = raw; }
    }
    if (!response.ok) {
      const error = new Error(`Supabase storage request failed (${response.status}).`);
      error.status = response.status;
      error.payload = payload;
      throw error;
    }
    return payload;
  }

  async fetchRow() {
    const url = `${this.endpoint}?id=eq.main&select=id,state,revision`;
    const rows = await this.request(url);
    return Array.isArray(rows) ? rows[0] || null : null;
  }

  async read() {
    for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt += 1) {
      const row = await this.fetchRow();
      if (row) return normalizeData(row.state);

      try {
        await this.request(this.endpoint, {
          method: 'POST',
          body: { id: 'main', state: initialData(), revision: 0 },
          prefer: 'return=minimal',
        });
      } catch (error) {
        if (error.status !== 409) throw error;
      }
    }
    throw new Error('Supabase storage could not initialize the document store.');
  }

  async update(mutator) {
    for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt += 1) {
      let row = await this.fetchRow();
      if (!row) {
        await this.read();
        row = await this.fetchRow();
      }
      if (!row) continue;

      const state = normalizeData(row.state);
      const result = await mutator(state);
      const url = `${this.endpoint}?id=eq.main&revision=eq.${encodeURIComponent(row.revision)}&select=revision`;
      const saved = await this.request(url, {
        method: 'PATCH',
        body: { state, revision: Number(row.revision) + 1, updated_at: new Date().toISOString() },
        prefer: 'return=representation',
      });
      if (Array.isArray(saved) && saved.length === 1) return result;
    }
    throw new Error('Supabase storage stayed busy. Please retry the last change.');
  }
}
