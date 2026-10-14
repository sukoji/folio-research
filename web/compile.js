export function setupCompile({api,save,getProject,toast}) {
  const dialog=document.createElement('dialog');dialog.id='compileDialog';
  dialog.innerHTML=`<h2>LaTeX → PDF</h2><p>저장된 원고를 Tectonic으로 컴파일합니다. 첫 실행에는 TeX 패키지 다운로드가 필요할 수 있습니다.</p><label>진입 파일 <select id="compileEntry" aria-label="컴파일 진입 파일"></select></label><div class="compile-actions"><button id="runCompile">PDF 컴파일</button><button id="closeCompile">닫기</button></div><p id="buildStatus" role="status"></p><a id="buildPdf" target="_blank" rel="noopener" hidden>완성된 PDF 열기 ↗</a><pre id="buildLog"></pre>`;
  document.body.append(dialog);const $=id=>dialog.querySelector(`#${id}`);let busy=false;
  $('closeCompile').onclick=()=>dialog.close();
  $('runCompile').onclick=async()=>{if(busy)return;busy=true;$('runCompile').disabled=true;$('buildPdf').hidden=true;$('buildLog').textContent='';$('buildStatus').textContent='컴파일 중… 최대 180초';
    try{if(!(await save()))throw new Error('원고 저장 충돌을 먼저 해결하세요.');const project=getProject();const result=await api(`/projects/${project.id}/compile`,{method:'POST',body:{filename:$('compileEntry').value,expected_revision:project.revision}});$('buildLog').textContent=result.log;$('buildStatus').textContent=result.status==='success'?`r${result.revision} PDF 완성`:`r${result.revision} 컴파일 실패 · 아래 오류를 확인하세요.`;if(result.pdf_url){$('buildPdf').href=result.pdf_url;$('buildPdf').hidden=false;}}
    catch(error){$('buildStatus').textContent=error.message;toast(error.message);}finally{busy=false;$('runCompile').disabled=false;}
  };
  return()=>{if(!busy){const project=getProject();$('compileEntry').replaceChildren();for(const name of Object.keys(project.files).filter(n=>n.endsWith('.tex'))){const option=document.createElement('option');option.value=name;option.textContent=name;$('compileEntry').append(option);}if(Object.hasOwn(project.files,'main.tex'))$('compileEntry').value='main.tex';}dialog.showModal();};
}
