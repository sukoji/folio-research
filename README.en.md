<p align="center"><img src="web/folio.svg" width="72" height="72" alt="Folio"></p>
<h1 align="center">Folio</h1>
<p align="center"><a href="README.md" lang="ko">한국어</a> · <strong>English</strong> · <a href="README.ja.md" lang="ja">日本語</a></p>
<p align="center"><strong>Read papers. Keep the evidence. Write in LaTeX.</strong></p>
<p align="center"><a href="https://github.com/sukoji/folio-research/releases/latest/download/Folio-windows-x64.zip"><strong>Download for Windows</strong></a> · <a href="#start">Run in your browser</a> · <a href="docs/guide.md">User guide (KO)</a> · <a href="CHANGELOG.md">Changelog</a></p>
<p align="center"><sub>Windows x64 portable · Local web app · MIT</sub></p>
<p align="center"><a href="https://github.com/sukoji/folio-research/actions/workflows/ci.yml"><img src="https://github.com/sukoji/folio-research/actions/workflows/ci.yml/badge.svg" alt="Tests"></a> <a href="LICENSE"><img src="https://img.shields.io/badge/license-MIT-53644A" alt="MIT license"></a></p>

<img src="docs/images/editor.png" alt="Folio's LaTeX editor with syntax highlighting and manuscript preview">
<p align="center"><sub>Actual application · LaTeX editor and manuscript preview</sub></p>

Bring reading notes into your manuscript with their sources attached. Folio combines a LaTeX editor, PDF reader, bibliography tools, and AI connections in one workspace. Documents and revision history stay on your computer.

The interface currently uses Korean. This page translates the documentation; Korean button labels are included below to help you find the controls.

<a id="start"></a>

## Start

<details>
<summary>Compare browser and desktop</summary>

| Browser | Desktop |
| --- | --- |
| Start a local server and open it in your browser | Open the Windows app |
| Requires Node.js 24 or later | Includes Node and Tectonic |
| Login lasts until the server shuts down | Login tokens are stored with OS encryption |
| ZIP import, editing, reading, OCR, AI, and MCP | The same tools in a dedicated app window |

In the desktop app, **브라우저에서 같은 작업 공간 열기** (Open this workspace in a browser) opens the same data in your browser. Folio is a local application, not a hosted cloud service.

</details>

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

## From the first paper to a finished manuscript

| Step | Action | Result |
| --- | --- | --- |
| **01 · Import** | Bring a source ZIP from Prism or Overleaf, or create a project. | Editable source, bibliography, and attachments |
| **02 · Read and note** | Open a PDF and take notes on the pages you need. | Research notes that link back to the original page |
| **03 · Cite and write** | Add a checked note to your manuscript and keep editing. | A draft with source links and BibTeX entries |
| **04 · Export** | Compile the PDF and save a project ZIP. | A PDF to submit and source to keep working on |

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

## Frequently asked questions

<details>
<summary>Do I need an AI account?</summary>

Editing, PDF reading, notes, citations, OCR, and compilation work without an AI login. Connect ChatGPT or an MCP agent when you want AI answers.

</details>

<details>
<summary>Where are my documents stored?</summary>

The source web version uses <code>data/</code> in the project folder. The Windows app uses <code>%APPDATA%/folio-agent-workspace/workspace/</code>. To back up, close Folio and connected agent processes, then copy the entire data folder. A project ZIP does not include your paper library or revision history.

</details>

<details>
<summary>What leaves my computer?</summary>

ChatGPT questions send the selected manuscript or paper context and any included page image to OpenAI. Literature search queries go to Crossref. Data handling by an MCP agent depends on that tool’s settings. Initial installation and TeX package downloads also use the network.

</details>

## Development

```sh
npm run build:editor   # CodeMirror browser bundle
npm run check         # Syntax checks
npm test              # Storage, import, OCR, MCP, OAuth and inference handling
npm run build:desktop # Portable app for the current platform
```

Set `FOLIO_TEST_TEX=1` to include actual PDF compilation tests. Tests run on Windows and Linux; desktop distribution has been verified on Windows x64.

## Documentation and contributing

| Looking for | Read |
| --- | --- |
| Editing, reading, OCR, and compilation | [User guide (Korean)](docs/guide.md) |
| ChatGPT login, MCP setup, and storage | [Connection guide (Korean)](docs/connections.md) |
| Changes by version | [Changelog](CHANGELOG.md) |
| Included libraries and runtimes | [Third-party notices](THIRD_PARTY_NOTICES.md) |

Report bugs in [Issues](https://github.com/sukoji/folio-research/issues) with the app version, operating system, and steps to reproduce. For manuscript issues, use a small example you can share publicly. Documentation and translation fixes are welcome as pull requests. Keep the Korean, English, and Japanese README versions in sync when changing their content.

---

Folio's own code is licensed under [MIT](LICENSE). See [Third-party notices](THIRD_PARTY_NOTICES.md) for the included libraries and runtimes. The Folio SVG symbol was created for this repository and is available under the same license.
