# Release notes

## 1.2.0

- Windows portable Electron app with bundled Node and Tectonic; browser mode remains available.
- LaTeX ZIP import and export, including nested sources, bibliography, images and fonts.
- CodeMirror editor with syntax highlighting, completion, search, folding and document outline.
- Source-linked reading notes and manuscript navigation in a shared reading/writing workspace.
- ChatGPT OAuth connection, model selection and questions about selected text or a PDF page.
- A new Folio SVG symbol, quieter interface and illustrated documentation.
- 28 MCP tools, including project ZIP import.

ChatGPT account consent and live inference require user login and have not been verified with a real account. Windows builds are unsigned portable apps.

## 1.1.0

Folio brings reading, evidence, and writing into one local research studio.

- PDF library with page-linked notes, source quotes, and image inspection.
- Automatic local English/Korean OCR for image-only PDF pages.
- Crossref literature search, title-based related works, and a saved reading list.
- LaTeX editing, revision history, atomic citations and BibTeX updates.
- Real Tectonic PDF compilation with build logs and downloadable output.
- 27 MCP tools for Codex and Claude Code, over stdio or local HTTP.
- Local SQLite storage, stale-write protection, and Windows launch helpers.
- MIT source license with third-party notices.

Install with Node.js 24+: `npm ci`, `npm run configure`, `npm run setup:tex`, `npm start`.
AI answers are supplied by the connected agent. OCR output needs source verification;
related works are bibliographic matches. Tectonic runs without shell escape and is
intended for trusted local manuscripts.
