# Release notes

## 1.3.1

- Bundle Pretendard Variable for consistent offline Korean and Latin interface typography.
- Normalize control sizes, label spacing, notebook text, and code font fallbacks.

## 1.3.0

- Local reference records, collections, RIS/BibTeX/CSL import, RIS/BibTeX export, and APA/Vancouver/Harvard citations.
- Same-DOI duplicate review and explicit, revision-checked merging with retained database history.
- Experimental HWPX text-run editing, package export, original-file history, and stale-edit protection. Full Hangul layout and binary HWP are not supported.
- Ten additional MCP tools for references and HWPX (38 total).
- Included in the Windows desktop package, with versioned build folders to preserve older installations.
- Manuscript, preview, and research notes remain visible together. Reference PDF can be collapsed without losing notes or replacing the preview.

## 1.2.0

- Windows portable Electron app with bundled Node and Tectonic; browser mode remains available.
- LaTeX ZIP import and export, including nested sources, bibliography, images and fonts.
- CodeMirror editor with syntax highlighting, completion, search, folding and document outline.
- Source-linked reading notes and manuscript navigation in a shared reading/writing workspace.
- ChatGPT OAuth connection, model selection and questions about selected text or a PDF page.
- Shared navigation and theme across writing and reading; custom desktop title bar with window controls.
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
