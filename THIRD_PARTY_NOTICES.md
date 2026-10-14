# Third-party software

Folio uses open-source libraries installed through npm. Their copyright and
license terms remain applicable; the MIT license for Folio does not replace them.
The exact dependency versions and transitive dependency graph are recorded in
`package-lock.json`. Installed packages include their original license files.

| Library | License | Use |
| --- | --- | --- |
| [MCP TypeScript SDK](https://github.com/modelcontextprotocol/typescript-sdk) | MIT | Agent protocol |
| [Express](https://github.com/expressjs/express) | MIT | Local HTTP server |
| [MathJax](https://github.com/mathjax/MathJax) | Apache-2.0 | Equation preview |
| [PDF.js](https://github.com/mozilla/pdf.js) | Apache-2.0 | PDF parsing, rendering, text-layer layout |
| [Zod](https://github.com/colinhacks/zod) | MIT | Tool input validation |
| [@napi-rs/canvas](https://github.com/Brooooooklyn/canvas) | MIT | PDF page images on Node.js |
| [Tesseract.js](https://github.com/naptha/tesseract.js) | Apache-2.0 | Local OCR |
| [Tesseract language packages](https://github.com/naptha/tessdata) | MIT (npm packages); underlying traineddata retains its upstream terms | English and Korean models |

The optional [Tectonic](https://github.com/tectonic-typesetting/tectonic) compiler
is installed separately from its official releases. Tectonic and its components
retain the licensing described in their distribution (MIT and the licenses of
the underlying TeX technologies). It is not relicensed as part of Folio.

Folio's PDF text-layer styles follow the layout contract exposed by PDF.js.
PDF.js is Copyright Mozilla Foundation and its contributors. The Apache 2.0
license is available at <https://www.apache.org/licenses/LICENSE-2.0> and in the
installed `pdfjs-dist/LICENSE` file.

Imported research papers belong to their respective authors and publishers.
No user papers, database files, account credentials, or machine-specific MCP
configuration files are distributed in this source repository.

## Desktop and editor additions

- Electron: MIT. Packaged distributions include Electron/Chromium notices.
- Node.js runtime: license and bundled notices in LICENSES/Node.txt.
- Tectonic: MIT, LICENSES/Tectonic.txt.
- CodeMirror: MIT, LICENSES/CodeMirror.txt. The browser bundle is built from CodeMirror packages; their package licenses remain in node_modules.
- jose: MIT, OAuth/OIDC token verification.
- yauzl and yazl: MIT, bounded ZIP import and export.

The Folio SVG, PNG and ICO marks are project artwork under the repository MIT license.

## Bibliography and HWPX

- Citation.js core and BibTeX/RIS/CSL plugins: MIT. Packages include their licenses.
- citeproc-js: CPAL-1.0 OR AGPL-3.0; Folio uses the CPAL option. Citation formatting is powered by citeproc-js, Copyright Frank Bennett. The processor and license are distributed in node_modules/citeproc. See https://github.com/Juris-M/citeproc-js.
- CSL styles and locales bundled by Citation.js retain their upstream attribution and license notices inside the packages.
- @xmldom/xmldom: MIT, XML parsing and serialization.
