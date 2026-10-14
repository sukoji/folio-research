export function setupDiscovery({ api, toast, getPaper }) {
  const dialog = document.createElement('dialog'); dialog.id='discoveryDialog';
  dialog.innerHTML = `<div class="discovery-head"><div><small>LITERATURE DISCOVERY</small><h2>다음에 읽을 논문 찾기</h2></div><button id="closeDiscovery">닫기</button></div><p>Crossref 학술 메타데이터를 검색합니다. 입력한 검색어 또는 선택한 논문 제목만 외부로 전송됩니다.</p><form id="discoveryForm"><input id="discoveryQuery" placeholder="연구 주제, 논문 제목, DOI" aria-label="온라인 논문 검색어" required minlength="2" maxlength="300"><button class="research-primary">검색</button></form><div class="discovery-options"><button id="recommendLiterature">현재 논문과 관련된 연구</button><button id="showReadingList">저장한 읽을 목록</button></div><p id="discoveryStatus" role="status"></p><div id="discoveryResults"></div>`;
  document.body.append(dialog);
  const $=id=>dialog.querySelector(`#${id}`); let busy=false;
  function node(tag,text){const el=document.createElement(tag);el.textContent=text;return el;}
  const run=fn=>async event=>{event?.preventDefault();if(busy)return;busy=true;dialog.setAttribute('aria-busy','true');$('discoveryStatus').textContent='학술 메타데이터를 조회하고 있습니다…';try{await fn();}catch(error){$('discoveryStatus').textContent=error.message;}finally{busy=false;dialog.removeAttribute('aria-busy');}};
  function render(items){
    $('discoveryResults').replaceChildren();
    for(const item of items){
      const card=node('article','');card.className='discovery-card';
      card.append(node('small',[item.year,item.venue].filter(Boolean).join(' · ')),node('h3',item.title),node('p',item.authors||'저자 정보 없음'),node('code',item.doi));
      const actions=node('div',''),link=node('a','원문 사이트 ↗');link.href=`https://doi.org/${encodeURIComponent(item.doi)}`;link.target='_blank';link.rel='noopener noreferrer';
      const save=node('button','읽을 목록에 저장');save.onclick=async()=>{save.disabled=true;try{await api('/reading-list',{method:'POST',body:item});save.textContent='저장됨';toast('읽을 목록에 저장했습니다.');}catch(error){save.disabled=false;toast(error.message);}};
      actions.append(link,save);card.append(actions);$('discoveryResults').append(card);
    }
  }
  $('closeDiscovery').onclick=()=>dialog.close();
  $('discoveryForm').onsubmit=run(async()=>{const result=await api(`/discover?q=${encodeURIComponent($('discoveryQuery').value.trim())}`);render(result.items);$('discoveryStatus').textContent=`${result.items.length}개 결과 · Crossref 관련도 순 · 서지 정보와 원문을 확인하세요.`;});
  $('recommendLiterature').onclick=run(async()=>{const paper=getPaper();if(!paper)throw new Error('관련 연구를 찾을 기준 논문을 먼저 여세요.');$('discoveryQuery').value=paper.title.slice(0,300);const result=await api(`/papers/${paper.id}/recommend`,{method:'POST',body:{}});render(result.items);$('discoveryStatus').textContent=`“${paper.title}” 제목 기반 관련 연구 ${result.items.length}개 · 연구 품질 평가가 아닙니다.`;});
  $('showReadingList').onclick=run(async()=>{const {items}=await api('/reading-list');render(items);$('discoveryStatus').textContent=`읽을 목록 ${items.length}개 · 원문 사이트에서 PDF를 받은 뒤 라이브러리로 가져오세요.`;});
  return()=>{ $('recommendLiterature').disabled=!getPaper();dialog.showModal();$('discoveryQuery').focus(); };
}
