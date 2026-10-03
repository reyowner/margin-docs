# Margin

Margin is a local-first writing room for creating, importing, and editing shared documents. It includes sign-in, private workspaces, rich text, live collaboration with presence and cursors, role-based sharing, review tools, version restore, Markdown/PDF export, and light/dark themes.

## Run locally

Requires Node.js 20 or newer.

```bash
npm install
npm run dev
```

Open `http://localhost:5173`. The Vite client proxies API requests to the Express server on port 3001; the collaboration WebSocket runs on port 1234. On the first run, the server creates `data/store.json`. Keep that file to retain local documents and sessions.

For a production-mode local run:

```bash
npm run build
npm start
```

Then open `http://localhost:3001`. Set `PORT` to change the HTTP server port and `COLLAB_PORT` to change the collaboration port. During Vite development, `API_PORT` controls the API proxy and `VITE_COLLAB_URL` controls the WebSocket URL. `MARGIN_STORE_PATH` changes the JSON store location. The JSON file is intended for one local Node process on a persistent disk.

## Hosted deployment

The hosted build is configured for Vercel's Node.js runtime and Supabase Postgres. `index.js` exports the Express HTTP server with Hocuspocus' WebSocket upgrade handler attached, and `vercel.json` builds the Vite client and includes `dist/` in the server function. The hosted database adapter uses a single JSONB state row and optimistic revision checks; local runs continue to use `data/store.json`.

The Supabase schema is in `supabase/migrations/`. It enables RLS on the hosted state table and checks a server-only bridge key before the Data API can reach it. The database stores only the SHA-256 hash of that key. The app uses the public legacy anon JWT as the Data API role; no service-role key is required by the Vercel app.

Set these variables in the Vercel project's **server-side** environment (do not prefix them with `VITE_`):

| Variable | Value |
| --- | --- |
| `SUPABASE_URL` | `https://evcfpjqjwlmzrbyeclfc.supabase.co` |
| `SUPABASE_ANON_KEY` | The project's legacy anon JWT from Supabase API settings |
| `MARGIN_STORE_API_KEY` | The generated server-only bridge key; never expose it in client variables or source control |

The Supabase project and schema are ready, and the hosted adapter was exercised locally against Supabase. The Vercel deployment tool returned “Tool deploy_to_vercel not found,” so there is not yet a public deployment URL.

## Demo accounts

Both accounts use the local demo password `margin2026!`.

| Name | Email | Access |
| --- | --- | --- |
| Renato Reoner | `domasigreoner@gmail.com` | Owns the starter document and Renato's workspaces |
| Maya Chen | `maya@margin.local` | Separate account; the hosted starter document is shared with her for review |

Sign in as Renato, open a document, choose **Share**, choose a role, and invite Maya. Then sign out and sign in as Maya; the document appears in **Shared with me**. Try **Editor**, **Commenter**, and **Viewer** roles: commenters can add comments and suggestions, editors can accept suggestions, and viewers have read-only access. Reconnect Maya after changing her role so the live socket uses the new permissions. To try review tools, select text in the editor, choose **Comment** or **Suggest**, enter the note or replacement, and submit. **History** saves a named version and lets an editor restore it. The sign-in cookie is hashed in the local store and passwords are stored as scrypt hashes. These seeded credentials are for this demo only; this is not production identity management.

## What works

- Create, rename, edit, reopen, copy, download as Markdown or PDF, and move owned documents to trash (deletion is permanent in this local demo).
- Rich text: bold, italic, underline, two heading levels, and ordered or bulleted lists.
- Live multi-user editing with Yjs/Hocuspocus, online collaborator indicators, names, colors, and live cursors.
- Private, user-owned workspaces. Owners can invite a seeded account as editor, commenter, or viewer and change or revoke that role later. A viewer cannot edit or comment; a commenter can leave notes and suggestions; editors can update the draft and accept suggestions.
- Review panel for anchored comments and replies, resolve threads, marked text suggestions with accept/dismiss actions, and manually named snapshots with restore. Review lists refresh while open; document edits and cursors use live Yjs sync.
- Local runs persist JSON documents and Yjs collaboration state in `data/store.json`; the hosted adapter persists the same state shape in Supabase Postgres with compare-and-swap writes. Existing saved HTML documents are converted into collaboration state when first opened.
- Import `.txt` and `.md` files as editable documents. Markdown headings and lists are converted to document structure. Files must be under 200 KB; `.docx` and other formats are unsupported.
- Persistent light/dark appearance preference and direct, formatted PDF download.

## Checks

```bash
npm test
npm run build
```

The tests cover authentication, workspace privacy, create/share/reopen/rename, enforced role permissions including read-only WebSocket behavior, review form submit wiring, comment/suggestion/history APIs, anchor serialization, generated PDF bytes and formatting, and two-account WebSocket edits, presence, and persistence.

## Reviewer quick start

The app currently runs locally at `http://localhost:5173`; a public deployment URL is still pending Vercel deployment access. Use the demo accounts above to exercise sharing. The hosted starter document is already shared with Maya as an editor; for a full review pass, also create a draft, invite Maya as a commenter, sign in as Maya to select a sentence and add a comment and suggestion, then sign back in as Renato to accept the suggestion and save/restore a version. Use the document menu to download Markdown or a generated PDF. The PDF is created in the browser from the current editor content and downloads directly; no print dialog is involved.

## Scope and limitations

This is a single-instance local demo. Login uses two seeded accounts, the JSON store is not safe to share across multiple server processes, and role changes apply to newly authenticated live connections (reconnect an already-open editor after changing its role). Version history is manually named rather than automatic; comments and suggestions refresh every five seconds while the review panel is open. PDF export generates and downloads a document directly in the browser. There is no account registration or production identity provider. A Supabase hosted store is prepared, but the public Vercel deployment is still pending. The local WebSocket uses `ws://`; configure TLS and a secure reverse proxy before exposing an internet deployment.
