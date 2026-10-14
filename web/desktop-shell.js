const desktop=window.folioDesktop;
if(desktop){
  document.body.classList.add('desktop');
  const bar=document.createElement('header');bar.className='window-titlebar';
  bar.innerHTML='<span class="window-title">Folio <span>Research workspace</span></span><div class="window-controls"><button data-action="minimize" aria-label="최소화" title="최소화"><svg viewBox="0 0 12 12"><path d="M1 6h10"/></svg></button><button data-action="maximize" aria-label="최대화" title="최대화"><svg viewBox="0 0 12 12"><rect x="1.5" y="1.5" width="9" height="9"/></svg></button><button data-action="close" aria-label="닫기" title="닫기"><svg viewBox="0 0 12 12"><path d="m2 2 8 8m0-8-8 8"/></svg></button></div>';
  document.body.prepend(bar);
  for(const button of bar.querySelectorAll('button'))button.onclick=()=>desktop[button.dataset.action]();
  const maximize=bar.querySelector('[data-action="maximize"]');
  const update=({maximized})=>{maximize.title=maximized?'이전 크기로 복원':'최대화';maximize.setAttribute('aria-label',maximize.title);maximize.innerHTML=maximized?'<svg viewBox="0 0 12 12"><path d="M4 3V1.5h6.5V8H9"/><rect x="1.5" y="4" width="6.5" height="6.5"/></svg>':'<svg viewBox="0 0 12 12"><rect x="1.5" y="1.5" width="9" height="9"/></svg>';};
  desktop.onWindowState(update);desktop.windowState().then(update);
}
