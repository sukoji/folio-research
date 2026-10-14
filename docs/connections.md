# Connections

## ChatGPT

웹과 데스크톱에서 **ChatGPT · 원고 질문**을 열고 **Continue with ChatGPT**를 선택합니다. 시스템 브라우저에서 로그인과 앱 권한 승인을 마친 뒤 **모델 새로고침**을 누릅니다. Folio는 OpenAI 공식 OAuth authorization-code / PKCE 흐름을 사용합니다.

질문을 보낼 때 선택한 원고 또는 현재 파일이 OpenAI로 전송됩니다. 논문 리더에서 시작한 질문에는 선택한 문장 또는 페이지 텍스트가 포함되며, PDF 모드에서는 페이지 이미지도 포함됩니다. **전송할 원고 확인**에서 확인할 수 있습니다. 계정의 사용 권한·한도가 적용됩니다.

웹에서는 토큰을 서버 메모리에만 보관합니다. 서버를 재시작하면 다시 로그인해야 합니다. 데스크톱에서는 Electron `safeStorage`로 암호화한 토큰을 앱 사용자 데이터 폴더에 저장합니다. 토큰은 원고 DB, 프로젝트 ZIP, 브라우저 저장소에 포함되지 않습니다. 웹과 데스크톱의 로그인은 별도로 관리됩니다.

로그아웃은 원격 세션 해제를 시도한 뒤 로컬 토큰을 지웁니다. 해제를 확인할 수 없으면 앱이 이를 표시합니다. [ChatGPT 사용량 설정](https://chatgpt.com/settings/usage)에서 연결을 관리할 수도 있습니다.

구현 기준: [Sign in](https://developers.openai.com/siwc/token-sharing-open-source/sign-in), [Accounts and sessions](https://developers.openai.com/siwc/token-sharing-open-source/profiles-and-sessions), [Models and inference](https://developers.openai.com/siwc/token-sharing-open-source/models-and-inference).

## Codex and Claude Code

앱의 **Codex · Claude 연결**을 열면 현재 실행 경로와 데이터 폴더에 맞는 설정이 나옵니다. 데스크톱은 함께 배포한 Node를 사용합니다. stdio 설정을 복사하면 앱 창을 닫아도 에이전트가 자체 MCP 서버를 시작할 수 있습니다.

소스 버전에서 등록하려면:

```sh
codex mcp add folio -- node "/absolute/path/to/folio-research/src/server.mjs" --stdio
claude mcp add --scope user --transport stdio folio -- node "/absolute/path/to/folio-research/src/server.mjs" --stdio
```

프로젝트 전용 설정은 `npm run configure`로 생성합니다. Windows용 `connect-codex.cmd`, `connect-claude.cmd`도 있습니다. 클라이언트의 MCP 신뢰·도구 승인 절차를 따르세요.

HTTP 연결은 앱에 표시되는 `/mcp` URL을 사용합니다. 데스크톱은 실행 때 빈 포트를 선택하므로 영구 설정에는 stdio가 편리합니다. 두 전송 방식을 중복 등록할 필요는 없습니다.

예시 요청:

> Folio에서 내 원고를 읽고 Introduction의 논리를 점검해 줘. 수정 전 현재 리비전을 확인하고, 근거가 필요한 문장은 표시해 줘.

> Folio의 대기 질문을 읽고 해당 PDF 페이지와 그림을 확인한 뒤 답변을 저장해 줘. 원문의 주장과 추론을 구분해 줘.

## Data locations

- 소스 웹 버전: 프로젝트 폴더의 `data/`.
- Windows 데스크톱: `%APPDATA%/folio-agent-workspace/workspace/`.
- 사용자 지정: `node src/server.mjs --data-dir /path/to/workspace`.
- 데스크톱의 **브라우저에서 같은 작업 공간 열기**: 같은 서버와 데이터 사용.

백업할 때는 Folio와 연결된 stdio 프로세스를 종료하고 데이터 폴더 전체를 복사하세요. 프로젝트 ZIP에는 원고와 첨부 파일만 들어갑니다. 논문 라이브러리·로그인 정보·수정 기록은 포함되지 않습니다.
