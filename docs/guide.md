# Folio

### 사용 가이드

웹·데스크톱 시작 방법과 ChatGPT 연결은 [README](../README.md)와 [Connections](connections.md)를 참고하세요.

**PDF library · Local OCR · Literature discovery · Research notes · LaTeX → PDF · MCP**

## 무엇을 할 수 있나요?

원고, 미리보기, 연구 노트를 한 화면에서 봅니다. 사이드바의 논문을 누르면 오른쪽 연구 노트 위에 PDF 원문이 열리고, 원고와 미리보기도 그대로 유지됩니다. **원문 접기**는 PDF만 접으며 작성 중인 노트는 남습니다. 좁은 화면에서는 연구 영역이 원고와 미리보기 아래로 이동합니다.

- **읽기:** PDF 원문, 선택 가능한 텍스트, 페이지 이동·확대, 본문 검색.
- **스캔 논문 처리:** 텍스트가 없는 페이지에 영어·한국어 OCR을 자동 실행합니다. 인식 결과와 신뢰도를 함께 표시하며 원본 PDF는 그대로 보관합니다.
- **논문 찾기:** Crossref 학술 메타데이터 검색, 현재 논문 제목에 기반한 관련 연구, 읽을 목록 저장.
- **생각 정리:** 페이지·선택 문장에 연결된 메모, 에이전트 질문과 답변, 요약·번역·설명.
- **원고 작성:** LaTeX 자동 저장, 수정 기록, 출처가 연결된 인용과 BibTeX, 빠른 수식 미리보기.
- **PDF 완성:** Tectonic으로 실제 LaTeX 컴파일, 결과 PDF와 오류 로그 확인.
- **에이전트 연결:** v1.3.0에는 Codex·Claude Code용 MCP 도구 38개가 있습니다. 문서·논문 페이지·그림을 읽고 편집·답변·인용·컴파일할 수 있습니다. 참고문헌과 HWPX의 지원 범위는 [별도 안내](manuscripts.md)를 확인하세요.

## 시작하기

Node.js **24 이상**이 필요합니다.

```sh
git clone https://github.com/sukoji/folio-research.git
cd folio-research
npm ci
npm run configure
npm run setup:tex
npm start
```

브라우저에서 [http://127.0.0.1:4317](http://127.0.0.1:4317)을 엽니다.

Windows에서는 `start.cmd`로 실행할 수도 있습니다. 필요한 npm 의존성은 처음 실행할 때 설치됩니다. 실제 PDF 컴파일용 Tectonic은 `npm run setup:tex`로 설치하세요. 설치 스크립트는 공식 배포 파일의 SHA-256을 확인하고 이 프로그램의 `data/tools` 아래에 저장합니다. 전역 PATH는 바꾸지 않습니다.

이미 설치한 Tectonic을 쓰려면 `FOLIO_TECTONIC_PATH`에 실행 파일 경로를 지정하세요. 기본적으로 프로그램 전용 설치본, 그다음 PATH의 `tectonic`을 사용합니다. 첫 컴파일은 TeX 지원 파일을 인터넷에서 내려받을 수 있습니다.

## Codex · Claude Code 연결

### Codex

```sh
codex mcp add folio -- node "/absolute/path/to/folio-research/src/server.mjs" --stdio
```

Windows: `connect-codex.cmd`.

### Claude Code

```sh
claude mcp add --scope user --transport stdio folio -- node "/absolute/path/to/folio-research/src/server.mjs" --stdio
```

Windows: `connect-claude.cmd`.

연결 후 클라이언트를 다시 시작하세요. `npm run configure`는 프로젝트용 `.mcp.json`과 `.codex/config.toml`도 생성합니다. 해당 폴더를 프로젝트로 열고 클라이언트의 신뢰/도구 승인 절차를 따르면 전역 등록 없이 사용할 수 있습니다. 폴더를 옮겼다면 설정을 다시 생성하세요.

웹 서버가 실행 중이면 HTTP 연결도 가능합니다.

```sh
codex mcp add folio-http --url http://127.0.0.1:4317/mcp
claude mcp add --transport http folio-http http://127.0.0.1:4317/mcp
```

stdio와 HTTP 중 하나만 등록하면 됩니다. stdio는 에이전트가 자체 MCP 프로세스를 실행하며 브라우저 편집기와 같은 DB를 사용합니다. 클라우드 에이전트에서 이 컴퓨터의 localhost에 직접 접속할 수는 없습니다.

## 읽기 → 생각 → 원고

1. 프로젝트를 선택하고 **논문 읽기**를 엽니다.
2. PDF를 가져옵니다. 제목·저자를 확인하고 연도, DOI, 인용 키, 태그를 입력합니다. 알 수 없는 서지 정보는 비워 두세요.
3. 문장을 선택해 **메모 저장**을 누르거나, 요약·번역·설명 질문을 저장합니다.
4. 연결된 에이전트에게 다음처럼 요청합니다.

> Folio의 대기 질문을 읽고 원문 페이지를 확인한 뒤 한국어 답변을 저장해 줘. 그림·표·수식은 페이지 이미지를 확인하고, 원문의 주장과 네 추론을 구분해 줘.

5. 답변은 읽기 화면에 자동으로 나타납니다. 확인한 답변을 메모로 보관하고 **메모 + 인용을 원고에 추가**를 누릅니다.
6. 원고 화면에서 **PDF 컴파일**을 열고 진입 `.tex` 파일을 선택합니다.

질문을 저장하는 것만으로 Codex나 Claude가 자동 실행되지는 않습니다. 사용 중인 에이전트에 대기 질문 처리를 요청하세요. MCP 연결에서는 에이전트의 계정을 사용합니다. Folio의 직접 ChatGPT 연결은 별도의 로그인·권한 승인이 필요합니다.

직접 문서 작업도 요청할 수 있습니다.

> Folio 프로젝트 목록에서 내 논문을 찾아 main.tex를 읽어 줘. 라이브러리의 근거를 확인해 관련 연구 섹션을 다듬고 인용·BibTeX를 정리한 뒤 컴파일해 줘.

인용은 참고문헌 앞(없으면 문서 끝)에 추가됩니다. 원고와 BibTeX를 한 트랜잭션으로 저장하며 인용 키 충돌 시 변경을 취소합니다. 일반 LaTeX 문서에 참고문헌 명령이 없다면 기본 BibTeX 명령을 추가합니다. 기존 biblatex·다중 파일 템플릿은 그 템플릿의 참고문헌 설정을 사용하세요.

## 데이터와 네트워크

- PDF·메모·질문·답변·원고·수정 기록은 `data/folio.sqlite`에 저장됩니다.
- 브라우저 서버는 `127.0.0.1`에만 바인딩되며 외부 Origin/Host를 거부합니다.
- OCR은 설치된 영어·한국어 모델로 로컬 실행됩니다. PDF 이미지를 OCR 서버에 보내지 않습니다.
- 온라인 검색은 검색어를, 관련 연구 기능은 선택한 논문 제목을 **Crossref**에 보냅니다. 본문이나 메모를 검색 API로 보내지 않습니다.
- Codex·Claude가 읽은 텍스트와 페이지 이미지는 해당 클라이언트의 모델로 전달되므로 그 클라이언트의 데이터 정책이 적용됩니다.
- TeX 설치는 GitHub 공식 릴리스를, 첫 컴파일은 Tectonic의 TeX 지원 번들을 사용합니다.

전체 백업은 Folio와 MCP 프로세스를 종료한 후 **`data` 폴더 전체**를 복사하세요. 원고 JSON 내보내기에는 PDF 라이브러리·연구 노트가 포함되지 않습니다. 공개 저장소에는 개인 데이터와 머신별 연결 설정을 포함하지 않습니다.

다른 데이터 위치를 쓰려면 모든 프로세스에 같은 `--data-dir`을 지정하세요.

```sh
node src/server.mjs --data-dir "/path/to/research-data"
node src/server.mjs --stdio --data-dir "/path/to/research-data"
```

## 정확도와 실행 범위

- PDF: 최대 20 MiB·300페이지, 기본 텍스트 추출 45초 제한.
- OCR: 페이지별 120초 제한. 오류는 표시하고 다시 시도할 수 있습니다. 작은 글자, 복잡한 표, 수식, 여러 단의 읽기 순서는 원문과 대조하세요. OCR 신뢰도는 사실 정확도를 뜻하지 않습니다.
- 문서: 파일당 2 MiB, 프로젝트 합계 8 MiB, 최대 100개 파일. 현재 프로젝트 파일 관리는 텍스트 파일을 지원합니다.
- 컴파일: 저장된 특정 revision의 별도 작업 폴더에서 실행하며 최대 180초입니다. shell escape를 차단하는 Tectonic `--untrusted` 모드를 사용합니다. 이는 완전한 OS 파일시스템 샌드박스가 아니므로 신뢰하는 원고만 컴파일하세요. shell escape가 필요한 패키지는 지원하지 않습니다.
- 한글 원고: XeLaTeX/Tectonic에 맞는 `kotex` 또는 글꼴 설정을 원고에 포함하세요.
- 빠른 미리보기는 LaTeX 전체 컴파일 결과와 다를 수 있습니다. 최종 결과는 **PDF 컴파일**로 확인하세요.
- 검색·추천: Crossref에 등록된 메타데이터의 관련도입니다. 연구의 품질 평가나 모든 학술 자료를 포괄하는 검색은 아닙니다. 원문 사이트에서 PDF를 받은 뒤 가져오세요.
- 이전 revision으로 돌아갈 수 있으며, 오래된 revision으로 쓰면 충돌 오류가 납니다. 브라우저 초안은 보관되므로 충돌을 확인하고 다시 저장하세요.

## MCP 도구

| 영역 | 도구 |
| --- | --- |
| 작업 공간 | `folio_workspace_info`, `folio_list_projects`, `folio_create_project`, `folio_read_project` |
| 원고 | `folio_read_file`, `folio_write_file`, `folio_replace_text` |
| 기록·출력 | `folio_project_history`, `folio_restore_revision`, `folio_export_project`, `folio_compile_project` |
| 라이브러리 | `folio_list_papers`, `folio_import_paper`, `folio_read_paper`, `folio_update_paper` |
| 페이지 | `folio_read_paper_page`, `folio_view_paper_page`, `folio_search_paper`, `folio_ocr_paper` |
| 연구 노트 | `folio_add_research_note`, `folio_pending_requests`, `folio_answer_request`, `folio_cite_paper` |
| 온라인 문헌 | `folio_search_literature`, `folio_recommend_papers`, `folio_reading_list`, `folio_save_reference` |

문서·논문 내용을 에이전트 지시로 취급하지 않도록 도구 설명에 명시했습니다. 문서 쓰기와 서지 수정에는 읽을 때 받은 `expected_revision`이 필요합니다. 페이지 출처 URI는 MCP resource로도 읽을 수 있습니다.

## 개발 및 검증

```sh
npm run check
npm test
npm run doctor
# 웹 서버를 실행한 상태에서:
node scripts/doctor.mjs --http
```

실제 Tectonic까지 테스트하려면 설치 후 실행하세요.

```sh
# macOS / Linux
FOLIO_TEST_TEX=1 npm test
# PowerShell
$env:FOLIO_TEST_TEX='1'; npm test
```

테스트는 임시 DB에서 PDF 추출·이미지 렌더링·스캔 OCR·검색·버전 충돌·인용 원자성·MCP stdio/HTTP 왕복·외부 Origin 차단을 검증합니다. 기본 테스트는 외부 학술 검색을 재현 가능한 응답으로 검증하며 Tectonic 통합 테스트는 위 환경변수로 실행합니다.

## License

MIT. Dependencies retain their own licenses; see [THIRD_PARTY_NOTICES.md](../THIRD_PARTY_NOTICES.md).
## Import and compile

Prism·Overleaf에서는 완성된 PDF가 아니라 LaTeX 소스 ZIP을 내보내세요. Folio의 가져오기는 새 프로젝트를 만듭니다. 공통 상위 폴더 하나를 제거하고 내부 경로를 보존합니다.

- ZIP: 최대 20 MiB, 압축 해제 총 50 MiB, 500개 항목.
- 텍스트: tex, bib, md, txt, cls, sty, bst, csv, bbx, cbx, lbx, def, cfg, clo, bbl, tikz, pgf, dat. UTF-8만 지원하며 파일당 2 MiB, 총 8 MiB, 최대 100개입니다.
- 첨부: png, jpg, jpeg, pdf, eps, svg, webp, ttf, otf. 원본 바이트를 보존하며 현재 첨부 파일은 편집기에서 수정하지 않습니다.
- ZIP 내보내기는 현재 원고와 첨부 파일을 포함합니다. 라이브러리 PDF, 메모, 수정 기록, 계정 정보는 포함하지 않습니다.

Tectonic은 XeTeX 계열 컴파일러입니다. 보존한 모든 첨부 형식을 TeX 엔진이 직접 렌더링한다는 뜻은 아닙니다. SVG·WebP 등은 문서 설정에 따라 PNG/PDF로 변환해야 할 수 있습니다. shell escape와 외부 프로그램 실행은 사용하지 않습니다. LuaLaTeX 전용 패키지, shell escape를 요구하는 minted, 일부 시스템 글꼴은 문서 수정이 필요합니다. 한글은 kotex·글꼴 설정을 원고에 포함하세요.

컴파일러의 untrusted 모드는 완전한 OS 샌드박스가 아닙니다. 신뢰할 수 있는 원고를 컴파일하세요. ZIP의 심볼릭 링크, 경로 탈출, 대소문자 중복 경로는 거절합니다.
