# Architecture note

## Product slice

Margin centers a tight writing loop: sign in, choose a private workspace, create or import a draft, shape it with familiar formatting, see it save, then invite a teammate into a live editing session. The home screen puts blank creation, `.txt`/`.md` import, and recent documents first. Explicit invitations make shared access easy to understand.

## Implementation

- **Client:** React and Vite provide the app shell. A small set of Radix-based, Tailwind-styled UI primitives keeps dialogs, menus, fields, and controls consistent. TipTap provides the rich-text editor and its collaboration extensions.
- **Identity and API:** Express issues an HttpOnly, same-site session cookie. Seeded passwords are stored as scrypt hashes; session tokens are stored as SHA-256 hashes. API routes check the active user before returning workspace or document data.
- **Data:** Local development keeps users, sessions, workspaces, document grants, HTML snapshots, and base64 Yjs state in `data/store.json`; writes are serialized and atomically renamed. The hosted adapter stores the same state shape in one Supabase JSONB row with optimistic revision checks. RLS is enabled, and a Postgres pre-request hook permits the anon Data API role to reach the row only when the Vercel server supplies a private bridge key. Only the SHA-256 hash is stored in Postgres; the Supabase service-role key is not used by the app. Existing HTML is normalized and converted into Yjs state when first opened collaboratively.
- **Live collaboration:** Hocuspocus authenticates the session against the document owner or explicit share grant. Yjs syncs editor transactions and awareness state; TipTap's collaboration caret displays collaborator names and colored cursors. Debounced Hocuspocus persistence stores the Yjs update and readable HTML snapshot through the same store adapter. The Vercel entry point attaches Hocuspocus' upgrade handler to the exported Node HTTP server; local development still runs its separate WebSocket port.
- **Import:** `.txt` becomes paragraphs; `.md` headings and lists become editor structure. Input is limited to 200 KB and text is escaped before conversion.
- **Review:** comments, replies, suggestions, and up to 50 manual snapshots live beside each document in the JSON store. Comment/suggestion marks are represented as TipTap marks, so anchors travel with Yjs content. Comments and suggestions refresh while the panel is open; accepting a suggestion replaces the anchored selection through the collaboration editor.
- **Access levels:** explicit grants carry `editor`, `commenter`, or `viewer`; the Hocuspocus authentication hook marks viewer/commenter sockets read-only, while API routes independently enforce edit and comment capabilities. The owner can change access levels or revoke a grant.
- **Export:** Markdown is generated from the saved HTML; PDF is generated client-side from the editor's structured document model with pdfmake, then downloaded directly without an intermediate print dialog or paid service. The PDF library and fonts load only when export is requested.

## Decisions and tradeoffs

Authentication is a real local sign-in flow with seeded accounts, but there is no registration or production identity provider. Workspaces are private; document access is granted explicitly so revoking a share does not leave a hidden workspace-level grant. The owner controls role assignments. Local JSON storage makes a no-cost run straightforward. The hosted single-row JSONB adapter supports this low-volume assignment and uses compare-and-swap writes, but a production product should normalize high-write entities and add stronger conflict handling. Version history is manual and bounded to 50 entries; this avoids noisy snapshots on every keystroke. Comment and suggestion metadata refreshes every five seconds while open, while document text and cursors remain live. Active sockets use the role granted at connection time, so a collaborator should reconnect after their role changes.

The Supabase project and RLS schema are provisioned. The app has not yet been published because the connected Vercel deployment action returned “Tool deploy_to_vercel not found,” and no Vercel CLI login is configured locally. The root entry and Vercel config are ready; live verification remains outstanding.

## Next 2-4 hours

1. Restore Vercel deployment access, set the server-only Supabase environment variables, publish, then verify editor WebSockets and a two-account share flow on the live URL.
2. Add real identity provider accounts and immediate revocation for already-open sockets.
3. Add automatic periodic versions, anchor recovery for edits that remove marked text, and push-based comment/suggestion updates.
4. Record the requested walkthrough and package the final folder for external review.
