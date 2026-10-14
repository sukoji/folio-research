<p align="center"><img src="web/folio.svg" width="72" height="72" alt="Folio"></p>
<h1 align="center">Folio</h1>
<p align="center">A place for your papers, sources, and manuscript.</p>
<p align="center"><a href="https://github.com/sukoji/folio-research/releases/latest">Download</a> · <a href="#start">Start</a> · <a href="docs/guide.md">Guide</a> · <a href="docs/connections.md">ChatGPT & MCP</a> · <a href="CHANGELOG.md">Changelog</a></p>
<p align="center"><a href="https://github.com/sukoji/folio-research/actions/workflows/ci.yml"><img src="https://github.com/sukoji/folio-research/actions/workflows/ci.yml/badge.svg" alt="Tests"></a> <a href="LICENSE"><img src="https://img.shields.io/badge/license-MIT-53644A" alt="MIT license"></a></p>

<img src="docs/images/editor.png" alt="Folio의 구문 강조 LaTeX 편집기와 원고 미리보기">

논문을 읽으며 남긴 메모를 출처와 함께 원고에 옮깁니다. LaTeX 편집기, PDF 리더, 참고문헌, AI 연결을 한 작업 공간에서 사용합니다. 문서와 수정 기록은 내 컴퓨터에 저장됩니다.

## One workspace, two ways to open it

| 웹 | 데스크톱 |
| --- | --- |
| 로컬 서버를 시작하고 브라우저에서 사용 | Windows 앱을 열어 사용 |
| Node.js 24 이상 필요 | Node와 Tectonic 포함 |
| 로그인은 서버를 종료할 때 해제 | 로그인 토큰을 OS 암호화로 보관 |
| ZIP 가져오기, 편집, 읽기, OCR, AI, MCP | 동일한 기능과 전용 앱 창 |

데스크톱의 **브라우저에서 같은 작업 공간 열기**를 누르면 두 화면이 같은 데이터를 사용합니다. 클라우드 호스팅 서비스는 아닙니다.

<a id="start"></a>
## Start

### Windows desktop

1. [최신 릴리스](https://github.com/sukoji/folio-research/releases/latest)에서 **Folio-windows-x64.zip**을 받습니다.
2. 폴더 전체를 압축 해제하고 **Folio.exe**를 실행합니다.
3. 새 원고를 만들거나 기존 프로젝트 ZIP을 가져옵니다.

현재 Windows 배포본은 코드 서명되지 않은 포터블 앱입니다. 첫 PDF 컴파일 때 TeX 패키지 다운로드가 필요할 수 있습니다.

### Web / source

```sh
git clone https://github.com/sukoji/folio-research.git
cd folio-research
npm ci
npm run setup:tex
npm start
```

[localhost:4317](http://127.0.0.1:4317)에서 엽니다. Windows에서는 `start.cmd`로 시작할 수 있습니다. 소스에서 데스크톱을 실행하려면 `node node_modules/electron/install.js`로 Electron 런타임을 받은 뒤 `npm run desktop`을 사용합니다.

## Bring your manuscript

Prism·Overleaf에서 **LaTeX 소스 ZIP**을 내보낸 뒤 Folio의 **가져오기**에서 선택합니다.

- `.tex`, `.bib`, 스타일 파일, 그림과 글꼴을 함께 가져옵니다.
- 하위 폴더를 보존합니다. ZIP 전체를 감싼 공통 폴더 하나는 제거합니다.
- 기존 프로젝트를 덮어쓰지 않고 새 프로젝트를 만듭니다.
- 지원하지 않는 파일은 목록으로 알려줍니다. 다시 내보낼 때도 ZIP을 사용합니다.

컴파일러는 Tectonic입니다. Overleaf의 컴파일러 설정, 댓글, 공동 편집 기록은 이전되지 않습니다. 외부 프로그램이 필요한 문서와 일부 글꼴·패키지는 수정이 필요할 수 있습니다. [지원 형식과 제한](docs/guide.md#import-and-compile)

## Read → annotate → cite

<img src="docs/images/reader.png" alt="페이지 원문과 출처가 연결된 연구 노트">

**논문 읽기**에서 PDF를 엽니다. 문장을 선택하고 요약·번역·설명을 요청하거나 메모를 남깁니다. 그림을 질문할 때는 현재 페이지 이미지도 보낼 수 있습니다. 확인한 메모는 **메모 + 인용을 원고에 추가**로 옮깁니다. 원고 목차 아래의 출처 링크에서 원문 페이지로 돌아갑니다.

| 작업 | 제공하는 기능 |
| --- | --- |
| 쓰기 | LaTeX 구문 강조, 검색·치환, 자동완성, 괄호 짝, 접기, 문서 목차 |
| 읽기 | PDF 원문, 텍스트 선택, 본문 검색, 페이지 확대, 출처 메모 |
| 스캔 | 텍스트 없는 페이지의 영어·한국어 로컬 OCR |
| 찾기 | Crossref 검색, 제목 기반 관련 논문, 읽을 목록 |
| 인용 | 페이지 인용, BibTeX 추가, 메모와 원문의 연결 |
| 완성 | Tectonic PDF 컴파일, 오류 로그, ZIP 내보내기 |
| 함께 편집 | Codex·Claude Code MCP, 수정 기록, 오래된 버전의 덮어쓰기 거절 |

## Choose your AI connection

**ChatGPT:** **ChatGPT · 원고 질문 → Continue with ChatGPT**를 누릅니다. 공식 로그인 화면에서 사용 권한을 승인한 뒤 모델 목록을 불러옵니다. 계정·모델에 따른 접근 권한과 사용량 제한이 적용됩니다. 답변은 먼저 확인한 뒤 복사하거나 연구 노트에 저장합니다.

**Codex / Claude Code:** 기존 에이전트를 MCP로 연결해 문서를 읽고 수정하거나 논문 질문에 답하게 할 수 있습니다. 수정할 때는 현재 리비전을 함께 전달합니다. Folio는 충돌한 변경을 조용히 덮어쓰지 않습니다.

→ [로그인, MCP 설정, 저장 위치](docs/connections.md)

## Boundaries

빠른 미리보기는 LaTeX 일부 문법만 표시합니다. 제출할 PDF는 **PDF 컴파일**로 확인하세요. OCR은 원문 대조가 필요하며, 관련 논문 목록은 서지 검색 결과입니다. 실시간 다중 사용자 협업, 클라우드 동기화, PDF 레이아웃을 그대로 유지하는 번역은 현재 제공하지 않습니다.

ChatGPT 로그인·추론 코드는 공식 OAuth 흐름을 사용합니다. 인증 콜백·스트림 처리 테스트와 로그인 UI를 검증했으며, 실제 계정의 승인·추론 완료는 사용자가 로그인한 뒤 확인해야 합니다.

## Development

```sh
npm run build:editor   # CodeMirror browser bundle
npm run check         # Syntax checks
npm test              # Storage, import, OCR, MCP, OAuth and inference handling
npm run build:desktop # Portable app for the current platform
```

`FOLIO_TEST_TEX=1`을 설정하면 실제 PDF 컴파일 테스트도 실행합니다. Windows와 Linux에서 테스트하며, 데스크톱 배포 검증 대상은 Windows x64입니다.

자체 코드는 [MIT](LICENSE). 포함된 라이브러리와 런타임의 라이선스는 [Third-party notices](THIRD_PARTY_NOTICES.md)에 정리했습니다. Folio SVG 심볼은 이 저장소에서 제작했으며 같은 라이선스로 제공합니다.
