# Margin walkthrough script

**Target length:** about 3–4 minutes. Replace “live link” with the deployed URL before recording. Keep the app open in one browser and a second browser profile ready for Maya.

## Script

Hi, this is Margin, a focused writing space for teams. I’ll show the complete path from signing in to collaborating on a document.

I’m signing in as Renato. The home screen brings together my workspaces and recent documents. I can switch between workspaces, create a blank document, or import a small `.txt` or `.md` file. Those are the supported import formats for this version.

I’ll create a new document and give it a name. In the editor, I can write and format text with bold, italic, underline, headings, and lists. Changes save to the app, so I can leave and reopen the document later. The light and dark theme controls are available from the interface as well.

Now I’ll share this document with Maya and choose her role. The role is visible in the sharing panel. I’ll open the same document in a second browser profile as Maya. As she joins, her presence appears here. When I type from her window, the text and her cursor update in Renato’s window without a refresh. I can also change the role to viewer to demonstrate read-only access; I’ll switch it back to commenter for the review flow.

As Maya, I’ll select a sentence and add a comment, then suggest a replacement. Back as Renato, I can review the suggestion and accept it. I can also save a named version in history and restore a previous snapshot. Finally, I can download the document as Markdown or as a PDF file.

For the implementation, the browser editor uses TipTap and Yjs with Hocuspocus for live edits and cursor presence. The local app stores data in a JSON file; the hosted setup uses Supabase Postgres. The server checks document access and sharing roles, while the frontend handles the editing and review experience. The PDF is generated as a download rather than relying on the browser print dialog.

I kept the scope deliberate: this is a demo with seeded accounts, not a production identity system. Imports are limited to text and Markdown, comments and suggestions are lightweight review tools, and version history uses named snapshots. With another few hours, I’d focus on hardening hosted authentication and access controls, then improve conflict recovery and test the deployed multi-user flow more deeply.

I used Codex as a coding partner to speed up implementation and investigate integration issues. I kept the product decisions and reviewed the generated changes, especially around role enforcement, persistence, and the export flow. I verified the main paths with automated tests, a production build, and a two-account collaboration check. The README includes local setup and demo account details.

You can try the app at **[live product URL]**. Thanks for taking a look.

## Recording checklist

- Sign in as Renato; show workspaces, recent docs, theme toggle, and create/import entry points.
- Create a document, format it, and show the saved state.
- Share with Maya; open the document in a second browser profile and show edits, presence, and cursor movement.
- Demonstrate commenter review, suggestion acceptance, version restore, and PDF download.
- Replace the live URL placeholder and confirm all described flows still work before recording.
