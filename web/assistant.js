export const accountBridge = window.folioDesktop || Object.fromEntries(['status','login','cancel','select','logout','models','ask'].map(action=>[action,async argument=>{
  const popup=action==='login'?window.open('about:blank','_blank'):null;
  if(popup)popup.opener=null;
  try{
    const r=await fetch('/api/account/'+action,{method:action==='status'?'GET':'POST',headers:{'Content-Type':'application/json'},...(action==='status'?{}:{body:JSON.stringify({argument})})});
    const data=await r.json();if(!r.ok)throw new Error(data.message||'연결 실패');
    if(data.authorization_url){if(popup)popup.location.href=data.authorization_url;else throw new Error('팝업이 차단되었습니다. 팝업을 허용한 뒤 로그인 취소 후 다시 시도하세요.');}
    return action==='status'?data:data.result;
  }catch(error){popup?.close();throw error;}
}]));
export function setupAssistant({getContext,toast}) {
  const button=document.createElement('button');button.className='side-action writing-only';button.textContent='◎  ChatGPT · 원고 질문';document.querySelector('.sidebar-bottom').prepend(button);
  const dialog=document.createElement('dialog');dialog.className='assistant-dialog';
  dialog.innerHTML=`<header><h2>원고 질문</h2><button id="closeAssistant" aria-label="닫기">✕</button></header><p>선택 영역이 있으면 그 부분을, 없으면 현재 파일을 전송합니다. 답변은 원고에 자동 적용되지 않습니다.</p><section class="account-controls"><select id="aiAccount" aria-label="ChatGPT 계정"></select><button id="aiLogin">Continue with ChatGPT</button><button id="aiLogout">로그아웃</button><button id="aiCancel">로그인 취소</button></section><p id="aiStatus" role="status"></p><a href="https://chatgpt.com/settings/usage" target="_blank" rel="noreferrer">ChatGPT 사용량·앱 권한 관리</a><hr><label>모델 <select id="aiModel" aria-label="AI 모델"></select></label><button id="aiModels">모델 새로고침</button><label for="aiPrompt">질문</label><textarea id="aiPrompt" rows="4" placeholder="이 문단의 논리적 비약을 짚어 줘"></textarea><details><summary>전송할 원고 확인</summary><pre id="aiContext"></pre></details><button id="aiSend" class="primary">질문 보내기</button><pre id="aiAnswer" aria-live="polite"></pre><button id="aiCopy">답변 복사</button>`;
  document.body.append(dialog);const $=id=>dialog.querySelector('#'+id), bridge=accountBridge;let captured='',timer,busy=false,onNote=null,pageImage=null;
  $('closeAssistant').onclick=()=>dialog.close();dialog.onclose=()=>clearInterval(timer);
  async function state(){if(!bridge)return;const s=await bridge.status();$('aiStatus').textContent=s.error || (s.pending?'브라우저에서 로그인을 완료하세요.': (s.sessionOnly?'웹 로그인은 서버 실행 중에만 유지됩니다.':'토큰은 OS 암호화 저장소로 보호됩니다.'));
    $('aiAccount').replaceChildren();for(const a of s.accounts){const o=document.createElement('option');o.value=a.id;o.textContent=`${a.email} · ${a.id.slice(-6)}${a.connected?'':' · 로그아웃'}`;$('aiAccount').append(o);}$('aiAccount').value=s.active || '';
    $('aiLogin').disabled=s.pending;$('aiCancel').disabled=!s.pending;$('aiLogout').disabled=!s.active;
  }
  const run=fn=>async(...args)=>{try{await fn(...args);}catch(e){$('aiStatus').textContent=e.message;}};
  const open=run(async(options={})=>{if(busy)throw new Error('현재 답변을 기다려 주세요.');captured=options.context ?? getContext(); onNote=options.onNote || null; pageImage=options.image || null;$('aiAnswer').textContent='';$('aiAnswer').dataset.complete='false'; noteButton.hidden=!onNote;if(options.prompt)$('aiPrompt').value=options.prompt;$('aiContext').textContent=captured+(pageImage?'\n\n[현재 PDF 페이지 이미지도 함께 전송됩니다.]':'');dialog.showModal();
    if(!bridge){$('aiStatus').textContent='ChatGPT 로그인은 Folio 데스크톱 앱에서 사용할 수 있습니다. 브라우저에서는 Codex · Claude MCP 연결을 사용하세요.';for(const b of dialog.querySelectorAll('.account-controls button,#aiModels,#aiSend'))b.disabled=true;return;}
    await state();timer=setInterval(()=>void state().catch(()=>{}),2000);
  });
  button.onclick=()=>open();
  const noteButton=document.createElement('button');noteButton.textContent='답변을 출처와 함께 연구 노트에 저장';noteButton.hidden=true;noteButton.onclick=run(async()=>{if(onNote && $('aiAnswer').dataset.complete==='true'){await onNote($('aiAnswer').textContent);toast('연구 노트에 저장했습니다.');}});dialog.append(noteButton);
  $('aiLogin').onclick=run(async()=>{await bridge.login($('aiAccount').value || undefined);await state();});
  const add=document.createElement('button');add.textContent='다른 계정 추가';add.onclick=run(async()=>{await bridge.login();await state();});dialog.querySelector('.account-controls').append(add);if(!bridge)add.disabled=true;
  $('aiAccount').onchange=run(async()=>{await bridge.select($('aiAccount').value);$('aiModel').replaceChildren();});
  $('aiCancel').onclick=run(async()=>{await bridge.cancel();await state();});
  $('aiLogout').onclick=run(async()=>{const s=await bridge.logout($('aiAccount').value);await state();if(!s.revoked)toast('로컬 로그아웃 완료. 원격 연결 해제는 확인되지 않았습니다. ChatGPT 설정에서 해제하세요.');$('aiModel').replaceChildren();});
  $('aiModels').onclick=run(async()=>{const models=await bridge.models();$('aiModel').replaceChildren();for(const m of models){const o=document.createElement('option');o.value=m.id;o.textContent=m.name;$('aiModel').append(o);}});
  $('aiSend').onclick=run(async()=>{if(busy)return;if(!$('aiModel').value)throw new Error('모델 새로고침 후 사용할 모델을 선택하세요.');busy=true;$('aiSend').disabled=true;$('aiAnswer').dataset.complete='false';$('aiAnswer').textContent='답변을 기다리는 중…';
    try{const r=await bridge.ask({model:$('aiModel').value,prompt:$('aiPrompt').value,context:captured,image:pageImage});$('aiAnswer').textContent=r.answer;$('aiAnswer').dataset.complete='true';}catch(e){$('aiAnswer').textContent=e.message;}finally{busy=false;$('aiSend').disabled=false;}
  });
  $('aiCopy').onclick=run(async()=>{await navigator.clipboard.writeText($('aiAnswer').textContent);toast('답변을 복사했습니다.');});
  return options=>open(options);
}
