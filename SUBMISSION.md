# Submission contents

## Included

1. App source: `src/` (including `src/lib/pdf-export.js`), `server/` (including the Supabase adapter), `supabase/migrations/`, `test/`, `index.js`, `index.html`, `vite.config.js`, `vercel.json`, `.vercelignore`, `components.json`, `package.json`, `package-lock.json`, and `.gitignore`.
2. `README.md` - setup, local accounts, imports, and run instructions.
3. `ARCHITECTURE.md` - product slice, system design, tradeoffs, and next steps.
4. `AI-WORKFLOW.md` - AI tools, contributions, rejected output, and verification.
5. `test/app.test.js` and `test/supabase-store.test.js` - authentication, sharing, workspace, persistence, realtime, review-action, PDF generation, and hosted-store concurrency tests.
6. `WALKTHROUGH-SCRIPT.md` - a short read-aloud script and recording checklist.
7. `walkthrough-url.txt` - current recording status.

The submission source package should exclude `data/store.json` (private local drafts), `.env` files, `node_modules/`, generated `dist/`, and the ignored `work/` scratch scripts. Keep the local data file in place on this computer; it is created automatically on a fresh install. The setup is simple enough that no extra screenshots or demo GIF are required; none are currently included.

## Current delivery status

- **Source repository:** https://github.com/reyowner/margin-docs (private GitHub repository).
- **Local product:** available at `http://localhost:5173` while the dev server is running; run with `npm install` then `npm run dev`.
- **Supabase:** free project `margin-docs` in `ap-southeast-1`, with the state table, RLS, and backend-key check configured. Hosted database sign-in, sharing, and the storage authorization boundary were exercised from a local server.
- **Live deployment URL:** https://ai-native-full-stack-developer-assi-ten.vercel.app. Public login and shared access were verified. Demo credentials are in `README.md`.
- **Walkthrough video:** not recorded; `walkthrough-url.txt` says so rather than inventing a link.
- **Google Drive folder:** not created; deliverables remain in the local project folder.

## Partial or deferred

Working: local and hosted sign-in with two seeded accounts, private workspaces, create/rename/edit/reopen, `.txt`/`.md` import (200 KB limit), editor/commenter/viewer grants, live edits and cursors, comments/replies, anchored suggestions with accept/dismiss, manual version snapshots and restore, Markdown export, direct formatted PDF downloads, local JSON/Yjs persistence, Supabase-backed hosted persistence, and light/dark mode. The deployed HTTP login and shared-document API work; the collaboration socket is mounted on Vercel's `/api` route.

Incomplete: Google Drive packaging, the walkthrough recording, external identity, account registration, automatic version snapshots, push-based comment/suggestion updates (review data refreshes while open), and support for `.docx`/PDF imports. Collaborators should reconnect after their role changes so an existing live socket picks up the new permissions.

With another 2-4 hours, add immediate active-socket revocation, push-based comment delivery, and production-grade authentication, then record the walkthrough and package the files in Google Drive.
