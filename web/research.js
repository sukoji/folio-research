import * as pdfjs from '/vendor/pdfjs/build/pdf.mjs';
import { setupDiscovery } from './discovery.js';
pdfjs.GlobalWorkerOptions.workerSrc = '/vendor/pdfjs/build/pdf.worker.mjs';

export function setupResearch({ api, toast, cite, ask }) {
  const root = document.createElement('section'); root.id = 'research'; root.hidden = true;
  root.innerHTML = `<header class="research-header"><div class="research-brand"><img src="./folio.svg" alt=""><span>folio / 논문 읽기</span></div><div class="research-mode">논문 · 메모 · 인용</div><button id="backToWriting">원고로 돌아가기 ↗</button></header>
    <div class="research-layout"><aside class="library-panel"><div class="research-heading"><h2>내 논문</h2><span id="paperCount">0</span></div><button id="uploadPdf" class="research-primary">＋ PDF 가져오기</button><input id="pdfInput" type="file" accept="application/pdf,.pdf" hidden><input id="librarySearch" placeholder="제목, 저자, 태그 검색" aria-label="라이브러리 검색"><div id="libraryList"></div><p class="research-tip">PDF와 메모는 이 컴퓨터에 저장됩니다.<br>최대 20 MiB · 300페이지</p></aside>
    <main class="reader-panel"><div class="reader-title"><div><small>논문 원문</small><h1 id="paperTitle">논문을 선택하세요</h1><p id="paperMeta">논문을 가져오면 페이지와 출처가 연결된 작업을 시작할 수 있습니다.</p></div><button id="editMetadata" disabled>서지 정보</button></div>
    <div class="reader-controls"><button id="prevPage" aria-label="이전 페이지">←</button><input id="pageNumber" type="number" min="1" value="1" aria-label="PDF 페이지"><span id="pageTotal">/ 0</span><button id="nextPage" aria-label="다음 페이지">→</button><select id="readerMode" aria-label="읽기 모드"><option value="pdf">PDF 원문</option><option value="text">추출 텍스트 · 선택 및 인용</option></select><select id="readerZoom" aria-label="PDF 확대"><option value="1">맞춤</option><option value="1.3">130%</option><option value="1.6">160%</option></select></div>
    <div class="reader-search"><input id="paperSearch" placeholder="논문 안에서 검색하고 Enter" aria-label="논문 본문 검색"><div id="paperSearchResults"></div></div>
    <div id="readerViewport"><div id="readerEmpty"><span>◧</span><h2>PDF를 가져와 시작하세요</h2><p>PDF에서 문장을 선택해 설명·번역을 요청하거나<br>페이지에 연결된 메모를 원고에 인용할 수 있습니다.</p></div><div id="pdfSurface" hidden></div><pre id="pageText" hidden></pre></div>
    <footer class="reader-footer"><span id="readerStatus">논문을 선택하세요</span><button id="citePage" disabled>이 페이지를 원고에 인용 ↗</button></footer></main>
    <aside class="research-notebook"><div class="research-heading"><h2>연구 노트</h2><span class="research-badge">MCP</span></div><p class="research-tip">선택한 문장과 페이지를 함께 보관합니다.</p><blockquote id="selectedQuote">페이지 전체를 대상으로 작업합니다.</blockquote><button id="clearQuote" class="quiet-button">선택 해제</button>
    <div class="research-quick"><button data-question="이 페이지의 핵심 주장, 방법, 한계를 한국어로 요약해 주세요. 근거 페이지를 표시해 주세요.">요약</button><button data-question="선택한 문장(선택이 없으면 이 페이지)을 한국어로 번역해 주세요. 원문과 번역을 구분해 주세요.">번역</button><button data-question="선택한 내용(선택이 없으면 이 페이지)을 논문 문맥에 맞춰 설명해 주세요. 근거와 추론을 구분해 주세요.">설명</button></div>
    <textarea id="researchInput" placeholder="내 메모를 쓰거나, 연결된 에이전트에게 질문하세요." aria-label="연구 메모 또는 질문"></textarea><div class="research-compose"><button id="saveNote">메모 저장</button><button id="askAgent" class="research-primary">질문 저장</button></div><details class="agent-help"><summary>Codex · Claude로 답변 받기</summary><p>질문 저장 후 연결된 에이전트에게 아래 지시를 보내세요. 답변이 오면 자동으로 표시됩니다.</p><code id="agentPrompt">Folio의 folio_pending_requests를 읽고, 해당 논문의 원문 페이지를 확인한 뒤 folio_answer_request로 한국어 답변을 저장해 줘.</code><button id="copyAgentPrompt">지시 복사</button></details><div id="researchEntries"></div></aside></div>
    <dialog id="metadataDialog"><form id="metadataForm"><h2>서지 정보</h2><p>자동 추출된 제목·저자를 확인하세요. DOI와 연도는 확인된 값만 입력합니다.</p><label>제목<input name="title" required maxlength="500"></label><label>저자 (BibTeX: and로 구분)<input name="authors" maxlength="1000"></label><div class="metadata-row"><label>연도<input name="year" pattern="[0-9]{4}" maxlength="4"></label><label>인용 키<input name="citekey" required pattern="[A-Za-z][A-Za-z0-9_:\\-]*" maxlength="80"></label></div><label>DOI<input name="doi" placeholder="10.xxxx/…" maxlength="200"></label><label>태그<input name="tags" placeholder="예: 읽는 중, 관련 연구, 중요" maxlength="500"></label><div class="modal-actions"><button type="button" id="cancelMetadata">취소</button><button class="research-primary">저장</button></div></form></dialog>`;
  document.body.append(root);
  const $ = id => root.querySelector(`#${id}`);
  let paper, page = 1, quote = '', pdf, task, renderTask, version = 0, busy = false, polling = false, metadataRevision;
  const discoverButton = document.createElement('button'); discoverButton.textContent='⌕ 논문 검색 · 관련 연구'; discoverButton.className='discover-button';
  $('librarySearch').before(discoverButton); discoverButton.onclick=setupDiscovery({api,toast,getPaper:()=>paper});
  const ocrButton=document.createElement('button');ocrButton.textContent='OCR 재시도';ocrButton.hidden=true;$('readerStatus').after(ocrButton);
  ocrButton.onclick=async()=>{if(!paper)return;try{await api(`/papers/${paper.id}/ocr`,{method:'POST',body:{}});toast('OCR을 다시 시작했습니다.');}catch(error){toast(error.message);}};
  const guard = fn => async (...args) => { if (busy) return; busy = true; try { await fn(...args); } catch (error) { toast(error.message); $('readerStatus').textContent = error.message; } finally { busy = false; } };
  function node(tag, content, cls) { const el = document.createElement(tag); el.textContent = content; if (cls) el.className = cls; return el; }
  function setQuote(value) { quote = value; $('selectedQuote').textContent = value || '페이지 전체를 대상으로 작업합니다.'; }
  async function refreshList() {
    const { papers } = await api(`/papers?q=${encodeURIComponent($('librarySearch').value)}`);
    $('paperCount').textContent = papers.length; $('libraryList').replaceChildren();
    for (const item of papers) {
      const button = node('button', '', 'library-card' + (item.id === paper?.id ? ' selected' : ''));
      button.append(node('small', item.tags || 'PAPER'), node('strong', item.title), node('span', [item.authors, item.year].filter(Boolean).join(' · ') || '서지 정보를 입력하세요'));
      button.onclick = guard(() => openPaper(item.id)); $('libraryList').append(button);
    }
    if (!papers.length) $('libraryList').append(node('p', '아직 논문이 없습니다. PDF를 가져와 시작하세요.', 'research-tip'));
  }
  async function openPaper(id) {
    version++; renderTask?.cancel(); if (task) await task.destroy(); pdf = null;
    paper = await api(`/papers/${id}`); page = 1; setQuote('');
    $('researchInput').value = localStorage.getItem(`folio-research-draft-${id}`) || '';
    $('paperTitle').textContent = paper.title; $('paperMeta').textContent = [paper.authors, paper.year, paper.doi].filter(Boolean).join(' · ') || '서지 정보에서 제목, 저자, DOI를 확인하세요.';
    $('editMetadata').disabled = false; $('citePage').disabled = false;
    $('pageTotal').textContent = `/ ${paper.page_count}`; $('pageNumber').max = paper.page_count;
    $('readerEmpty').hidden = true; $('paperSearchResults').replaceChildren(); $('paperSearch').value = '';
    entries(); await refreshList();
    task = pdfjs.getDocument({ url: `/api/papers/${id}/pdf`, isEvalSupported: false, cMapUrl: '/vendor/pdfjs/cmaps/', cMapPacked: true, standardFontDataUrl: '/vendor/pdfjs/standard_fonts/', wasmUrl: '/vendor/pdfjs/wasm/' });
    pdf = await task.promise; await showPage();
  }
  async function showPage() {
    if (!paper) return;
    const current = ++version; renderTask?.cancel();
    setQuote(''); $('pageNumber').value = page;
    $('prevPage').disabled = page <= 1; $('nextPage').disabled = page >= paper.page_count;
    const source = await api(`/papers/${paper.id}/pages/${page}`);
    if (current !== version) return;
    $('pageText').textContent = source.text || (source.ocr?.status==='error' ? `OCR 오류: ${source.ocr.error}` : source.ocr?.status==='done' ? 'OCR로 인식된 텍스트가 없습니다. 원문을 확인하세요.' : '로컬 OCR 처리 중입니다. 완료되면 텍스트가 표시됩니다.');
    $('readerStatus').textContent = `${paper.citekey} · p.${page} · ${source.text_source==='ocr' ? `OCR ${Math.round(source.ocr.confidence)}% · 원문 대조 필요` : source.text.trim() ? '출처 연결됨' : `OCR ${source.ocr?.status || '대기'}`}`;
    ocrButton.hidden=source.ocr?.status!=='error';
    const isText = $('readerMode').value === 'text'; $('pageText').hidden = !isText; $('pdfSurface').hidden = isText;
    if (isText || !pdf) return;
    const pdfPage = await pdf.getPage(page); if (current !== version) return;
    const base = pdfPage.getViewport({ scale: 1 });
    const width = Math.max(260, $('readerViewport').clientWidth - 64);
    const scale = Math.min(1.5, width / base.width) * Number($('readerZoom').value);
    const viewport = pdfPage.getViewport({ scale });
    const canvas = document.createElement('canvas'), layer = document.createElement('div'); layer.className = 'textLayer';
    const surface = $('pdfSurface'); surface.replaceChildren(canvas, layer); surface.style.width = `${viewport.width}px`; surface.style.height = `${viewport.height}px`; surface.style.setProperty('--scale-factor', scale);
    const ratio = Math.min(devicePixelRatio, 2); canvas.width = Math.ceil(viewport.width * ratio); canvas.height = Math.ceil(viewport.height * ratio); canvas.style.width = `${viewport.width}px`; canvas.style.height = `${viewport.height}px`;
    renderTask = pdfPage.render({ canvasContext: canvas.getContext('2d'), viewport, transform: [ratio, 0, 0, ratio, 0, 0] });
    await renderTask.promise;
    if (current !== version) return;
    await new pdfjs.TextLayer({ textContentSource: await pdfPage.getTextContent(), container: layer, viewport }).render();
  }
  function entries() {
    $('researchEntries').replaceChildren();
    const items = [...paper.notes.map(n => ({ ...n, type: 'note' })), ...paper.requests.map(r => ({ ...r, type: 'request' }))].sort((a,b) => b.created_at.localeCompare(a.created_at));
    for (const item of items) {
      const card = node('article', '', 'research-entry');
      const head = node('div', '', 'entry-head'); const jump = node('button', `p.${item.page}`); jump.onclick = guard(async () => { page = item.page; await showPage(); });
      head.append(node('small', item.type === 'note' ? ({ note: '메모', summary: '요약', translation: '번역', explanation: '설명' }[item.kind]) : item.status === 'pending' ? '에이전트 답변 대기' : `답변 · ${item.agent}`), jump); card.append(head);
      if (item.quote) card.append(node('blockquote', item.quote));
      if (item.type === 'note') {
        card.append(node('p', item.body)); const button = node('button', '메모 + 인용을 원고에 추가 ↗'); button.onclick = guard(async () => { await cite(paper.id, item.page, item.id); toast('원고 끝에 메모와 인용을 추가했습니다.'); }); card.append(button);
      } else {
        card.append(node('strong', item.question));
        card.append(node('p', item.answer || 'Codex 또는 Claude Code에 “Folio 대기 질문에 답해 줘”라고 요청하세요.'));
        if (item.answer) { const button = node('button', '답변을 연구 메모로 저장'); button.onclick = guard(async () => { await api(`/papers/${paper.id}/notes`, { method: 'POST', body: { page: item.page, quote: item.quote, body: item.answer, kind: 'explanation' } }); await refreshPaper(); toast('답변을 메모로 저장했습니다. 인용 전 원문과 대조하세요.'); }); card.append(button); }
      }
      $('researchEntries').append(card);
    }
  }
  async function refreshPaper() { if (!paper) return; paper = await api(`/papers/${paper.id}`); entries(); }
  async function submit(kind) {
    if (!paper) throw new Error('먼저 논문을 선택하세요.');
    const originalInput = $('researchInput').value;
    const value = originalInput.trim(); if (!value) throw new Error('메모나 질문을 입력하세요.');
    const body = { page, quote, ...(kind === 'notes' ? { body: value } : { question: value }) };
    await api(`/papers/${paper.id}/${kind}`, { method: 'POST', body });
    if ($('researchInput').value === originalInput) { $('researchInput').value = ''; localStorage.removeItem(`folio-research-draft-${paper.id}`); }
    await refreshPaper();
    toast(kind === 'notes' ? '페이지에 메모를 저장했습니다.' : '질문을 저장했습니다. 연결된 에이전트에게 대기 질문 처리를 요청하세요.');
  }
  const direct=document.createElement('button');direct.textContent='ChatGPT로 질문';direct.className='research-primary';$('askAgent').after(direct);
  direct.onclick=guard(async()=>{if(!paper)throw new Error('논문을 선택하세요.');const id=paper.id,p=page,q=quote;const source=await api(`/papers/${id}/pages/${p}`);await ask({context:`${paper.title} · p.${p}\n${q || source.text}`,prompt:$('researchInput').value || '이 페이지의 핵심 주장과 한계를 설명해 주세요.',image:$('pdfSurface').querySelector('canvas')?.toDataURL('image/png'),onNote:async body=>{await api(`/papers/${id}/notes`,{method:'POST',body:{page:p,quote:q,body,kind:'explanation'}});await refreshPaper();}});});
  $('backToWriting').onclick = () => { if (busy) return toast('현재 작업을 마친 뒤 원고로 돌아갈 수 있습니다.'); root.hidden = true; document.querySelector('.app-shell').inert = false; };
  $('uploadPdf').onclick = () => $('pdfInput').click();
  $('pdfInput').onchange = guard(async event => {
    const file = event.target.files[0]; if (!file) return;
    try {
      if (file.size > 20 * 1024 * 1024) throw new Error('PDF는 20 MiB 이하입니다.');
      $('uploadPdf').disabled = true; $('uploadPdf').textContent = 'PDF 분석 중…';
      const data = await new Promise((resolve, reject) => { const reader = new FileReader(); reader.onload = () => resolve(reader.result.split(',')[1]); reader.onerror = () => reject(new Error('파일 읽기 실패')); reader.readAsDataURL(file); });
      const imported = await api('/papers', { method: 'POST', body: { pdf_base64: data } }); await openPaper(imported.id); toast(imported.duplicate ? '이미 가져온 논문을 열었습니다.' : 'PDF를 라이브러리에 저장했습니다.');
    } finally { $('uploadPdf').disabled = false; $('uploadPdf').textContent = '＋ PDF 가져오기'; event.target.value = ''; }
  });
  $('librarySearch').oninput = () => { clearTimeout(refreshList.timer); refreshList.timer = setTimeout(() => refreshList().catch(e => toast(e.message)), 250); };
  $('prevPage').onclick = guard(async () => { if (page > 1) { page--; await showPage(); } });
  $('nextPage').onclick = guard(async () => { if (paper && page < paper.page_count) { page++; await showPage(); } });
  $('pageNumber').onchange = guard(async () => { if (!paper) return; page = Math.max(1, Math.min(paper.page_count, Number($('pageNumber').value) || 1)); await showPage(); });
  $('readerMode').onchange = guard(showPage); $('readerZoom').onchange = guard(showPage);
  $('readerViewport').onmouseup = () => { const selection = window.getSelection(); if (selection && $('readerViewport').contains(selection.anchorNode) && $('readerViewport').contains(selection.focusNode)) { const value = selection.toString().trim(); if (value) setQuote(value.slice(0,10000)); } };
  $('clearQuote').onclick = () => setQuote('');
  $('researchInput').oninput = () => { if (paper) { try { localStorage.setItem(`folio-research-draft-${paper.id}`, $('researchInput').value); } catch { toast('메모 초안 보관 공간이 부족합니다. 메모 저장을 눌러주세요.'); } } };
  $('saveNote').onclick = guard(() => submit('notes')); $('askAgent').onclick = guard(() => submit('requests'));
  root.querySelectorAll('[data-question]').forEach(button => button.onclick = () => { $('researchInput').value = button.dataset.question; $('researchInput').dispatchEvent(new Event('input')); $('researchInput').focus(); });
  $('copyAgentPrompt').onclick = guard(async () => { await navigator.clipboard.writeText($('agentPrompt').textContent); toast('에이전트에게 보낼 지시를 복사했습니다.'); });
  $('citePage').onclick = guard(async () => { if (paper) { await cite(paper.id, page); toast('원고에 페이지 인용과 BibTeX를 추가했습니다.'); } });
  $('paperSearch').onkeydown = guard(async event => {
    if (event.key !== 'Enter' || !paper || !$('paperSearch').value.trim()) return;
    const { results } = await api(`/papers/${paper.id}/search?q=${encodeURIComponent($('paperSearch').value.trim())}`); $('paperSearchResults').replaceChildren();
    for (const result of results) { const button = node('button', `p.${result.page} · ${result.excerpt}`); button.onclick = guard(async () => { page = result.page; await showPage(); }); $('paperSearchResults').append(button); }
    if (!results.length) $('paperSearchResults').append(node('p','검색 결과가 없습니다.'));
  });
  $('editMetadata').onclick = () => { if (!paper) return; metadataRevision = paper.revision; const form = $('metadataForm'); for (const name of ['title','authors','year','doi','citekey','tags']) form.elements[name].value = paper[name] || ''; $('metadataDialog').showModal(); };
  $('cancelMetadata').onclick = () => $('metadataDialog').close();
  $('metadataForm').onsubmit = event => { event.preventDefault(); void guard(async () => { const metadata = Object.fromEntries(new FormData(event.target)); paper = await api(`/papers/${paper.id}`, { method: 'PUT', body: { expected_revision: metadataRevision, metadata } }); $('metadataDialog').close(); $('paperTitle').textContent = paper.title; $('paperMeta').textContent = [paper.authors,paper.year,paper.doi].filter(Boolean).join(' · '); await refreshList(); await showPage(); })(); };
  setInterval(async () => { if (root.hidden || !paper || busy || polling) return; polling = true; const id = paper.id; try { const remote = await api(`/papers/${id}`); if (paper?.id === id && !busy && JSON.stringify(remote) !== JSON.stringify(paper)) { const ocrChanged=JSON.stringify(remote.ocr)!==JSON.stringify(paper.ocr); paper = remote; entries(); if(ocrChanged&&!quote)await showPage(); } } catch {} finally { polling = false; } }, 2500);
  return async (source) => { root.hidden = false; document.querySelector('.app-shell').inert = true; await refreshList(); if(source?.paperId){await openPaper(source.paperId);page=Math.max(1,Math.min(paper.page_count,source.page || 1));await showPage();} };
}
