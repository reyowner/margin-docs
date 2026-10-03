# AI workflow note

## Tools used

OpenAI Codex supported product scoping, implementation, debugging, test authoring, and documentation. I used the terminal and local browser to build and inspect the app, plus the connected Supabase integration to provision the free Postgres project and apply its schema. I checked current Supabase and Vercel documentation for RLS and Node WebSocket support. The editor and collaboration choices were checked against the official TipTap/Hocuspocus documentation; the UI setup follows the shadcn Vite and Tailwind pattern.

## Where AI sped up the work

Codex accelerated the React/Express shell, reusable UI primitives, endpoint scaffolding, review panel, export flow, and integration tests. It helped compare persistence and collaboration approaches quickly, then supported adding access roles, review APIs, manual history, and client-side PDF generation while preserving existing local drafts. I checked Hocuspocus's installed hook types and behavior before enforcing read-only connections.

## What I changed or rejected

I rejected the earlier prototype's client-supplied user identity and content-overwrite API. The final version uses a signed-in local session and allows text changes only through the authenticated collaboration socket; the HTTP API handles metadata and explicit share grants. I kept seeded workspaces private rather than making a shared workspace silently grant access. I chose a hash-checked, server-only bridge key instead of putting Supabase's service-role key in Vercel. User feedback caught two issues in the first review/export pass: the review buttons did not submit their forms, and print-to-PDF did not meet the requested download flow. I fixed the form button types and replaced print with direct PDF generation. Imported content remains limited to `.txt` and `.md`.

## Verification

I ran `npm test` (9 passing) and `npm run build` (successful, with the existing PDF/font chunk-size warning). Tests cover authentication and access, two-account local WebSocket presence/edit persistence, review form submit wiring, comment/suggestion/history APIs, anchor serialization, PDF generation, and Supabase compare-and-swap retry behavior. Against hosted Supabase, requests without the bridge key are denied and Renato and Maya can access their expected documents. I deployed the app to Vercel, then checked the public home page, both seeded logins, shared-document access, and the collaboration socket path. The walkthrough recording and Google Drive packaging are not done; `WALKTHROUGH-SCRIPT.md` is ready to read on camera.
