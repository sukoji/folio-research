<p align="center"><img src="web/folio.svg" width="72" height="72" alt="Folio"></p>
<h1 align="center">Folio</h1>
<p align="center"><a href="README.md" lang="ko">한국어</a> · <strong>English</strong> · <a href="README.ja.md" lang="ja">日本語</a></p>
<p align="center">A place for your papers, sources, and manuscript.</p>
<p align="center"><a href="https://github.com/sukoji/folio-research/releases/latest">Download</a> · <a href="#start">Start</a> · <a href="docs/guide.md">Guide (Korean)</a> · <a href="docs/connections.md">ChatGPT & MCP (Korean)</a> · <a href="CHANGELOG.md">Changelog</a></p>
<p align="center"><a href="https://github.com/sukoji/folio-research/actions/workflows/ci.yml"><img src="https://github.com/sukoji/folio-research/actions/workflows/ci.yml/badge.svg" alt="Tests"></a> <a href="LICENSE"><img src="https://img.shields.io/badge/license-MIT-53644A" alt="MIT license"></a></p>

<img src="docs/images/editor.png" alt="Folio's LaTeX editor with syntax highlighting and manuscript preview">

Bring reading notes into your manuscript with their sources attached. Folio combines a LaTeX editor, PDF reader, bibliography tools, and AI connections in one workspace. Documents and revision history stay on your computer.

The interface currently uses Korean. This page translates the documentation; Korean button labels are included below to help you find the controls.

## One workspace, two ways to open it

| Browser | Desktop |
| --- | --- |
| Start a local server and open it in your browser | Open the Windows app |
| Requires Node.js 24 or later | Includes Node and Tectonic |
| Login lasts until the server shuts down | Login tokens are stored with OS encryption |
| ZIP import, editing, reading, OCR, AI, and MCP | The same tools in a dedicated app window |

In the desktop app, **브라우저에서 같은 작업 공간 열기** (Open this workspace in a browser) opens the same data in your browser. Folio is a local application, not a hosted cloud service.

<a id="start"></a>
## Start

### Windows desktop

1. Download **Folio-windows-x64.zip** from the [latest release](https://github.com/sukoji/folio-research/releases/latest).
2. Extract the entire folder and run **Folio.exe**.
3. Create a manuscript or import an existing project ZIP.

The Windows download is an unsigned portable app. The first PDF compilation may need to download TeX packages.

### Web / source

```sh
git clone https://github.com/sukoji/folio-research.git
cd folio-research
npm ci
npm run setup:tex
npm start
```

Open [localhost:4317](http://127.0.0.1:4317). On Windows, you can also use `start.cmd`. To run the desktop app from source, download the Electron runtime with `node node_modules/electron/install.js`, then run `npm run desktop`.

## Bring your manuscript

Export a **LaTeX source ZIP** from Prism or Overleaf, then select it through **가져오기** (Import) in Folio.

- Import `.tex`, `.bib`, style files, figures, and fonts together.
- Keep nested folders. A single outer folder wrapping the entire project is removed.
- Create a new project without overwriting an existing one.
- See a list of unsupported files that were skipped. Export the project as a ZIP when needed.

Folio compiles with Tectonic. Overleaf compiler settings, comments, and collaboration history are not imported. Documents that depend on external programs, certain fonts, or particular packages may need changes. [Supported formats and limits (Korean)](docs/guide.md#import-and-compile)

## Read → annotate → cite

<img src="docs/images/reader.png" alt="A PDF page alongside research notes linked to its source">

Open a PDF in **논문 읽기** (Read papers). Select a passage to request a summary, translation, or explanation, or write a note. You can also send the current page image when asking about figures. After checking a note, use **메모 + 인용을 원고에 추가** (Add note and citation to manuscript). Source links below the manuscript outline take you back to the original page.

| Task | Tools |
| --- | --- |
| Write | LaTeX syntax highlighting, search and replace, completion, bracket matching, folding, document outline |
| Read | Original PDF, text selection, full-text search, zoom, source notes |
| Scan | Local English and Korean OCR for pages without embedded text |
| Find | Crossref search, title-based related papers, reading list |
| Cite | Page citations, BibTeX entries, links between notes and sources |
| Finish | Tectonic PDF compilation, error logs, ZIP export |
| Edit with agents | Codex and Claude Code through MCP, revision history, rejection of stale writes |

## Choose your AI connection

**ChatGPT:** Select **ChatGPT · 원고 질문 → Continue with ChatGPT**. Approve access on the official sign-in page, then load the model list with **모델 새로고침** (Refresh models). Account and model access restrictions and usage limits apply. Review answers before copying them or saving them as research notes.

**Codex / Claude Code:** Connect an existing agent through MCP to read and edit documents or answer questions about papers. Edits include the current revision number. Folio rejects conflicting changes instead of silently overwriting them.

→ [Login, MCP setup, and data locations (Korean)](docs/connections.md)

## Boundaries

The quick preview supports only part of LaTeX. Use **PDF 컴파일** (Compile PDF) to check the PDF you intend to submit. Check OCR output against the original. Related papers are bibliographic search results. Real-time multi-user collaboration, cloud synchronization, and translation that preserves the original PDF layout are not currently available.

The ChatGPT integration uses the official OAuth flow. Authentication callback and response-stream handling tests, along with the login UI, have been checked. Consent and inference with a real account have not yet been verified.

## Development

```sh
npm run build:editor   # CodeMirror browser bundle
npm run check         # Syntax checks
npm test              # Storage, import, OCR, MCP, OAuth and inference handling
npm run build:desktop # Portable app for the current platform
```

Set `FOLIO_TEST_TEX=1` to include actual PDF compilation tests. Tests run on Windows and Linux; desktop distribution has been verified on Windows x64.

Folio's own code is licensed under [MIT](LICENSE). See [Third-party notices](THIRD_PARTY_NOTICES.md) for the included libraries and runtimes. The Folio SVG symbol was created for this repository and is available under the same license.
