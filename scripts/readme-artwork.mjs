import {writeFileSync} from 'node:fs';
import {createCanvas,loadImage,GlobalFonts} from '@napi-rs/canvas';
GlobalFonts.registerFromPath('web/fonts/PretendardVariable.woff2','Pretendard');
GlobalFonts.registerFromPath('docs/fonts/PretendardJPVariable.woff2','Pretendard JP');
const copies={
ko:{title:'논문 속 근거를 원고의 인용으로.',sub:'원고, 미리보기, 참고 논문과 연구 노트를 한 화면에.',steps:['논문에서 찾기','페이지와 함께 기록','원고에 인용하기'],desc:['PDF 원문 · 본문 검색 · 로컬 OCR','선택한 문장 · 연구 메모 · AI 질문','페이지 인용 · BibTeX · PDF 컴파일'],note:['핵심 주장을 메모하고','근거 페이지를 함께 남깁니다.'],action:'메모 + 인용을 원고에 추가',foot:'작업 흐름을 설명하는 개념도 · 실제 화면은 아래에서 확인',features:[['기존 원고 그대로','Prism / Overleaf 소스 ZIP'],['참고문헌 관리','RIS · BibTeX · CSL · DOI 중복 검토'],['에이전트와 함께','Codex / Claude Code · MCP 도구 38개'],['한글 투고 양식','HWPX 본문 편집 · 실험적 지원']]},
en:{title:'From a source page to a cited draft.',sub:'Manuscript, preview, source PDF, and research notes stay together.',steps:['Find the evidence','Keep its context','Cite it in your draft'],desc:['PDF reading · Search · Local OCR','Selected passages · Notes · AI questions','Page citations · BibTeX · PDF compilation'],note:['Record the claim.','Keep the source page attached.'],action:'Add note and citation to manuscript',foot:'Workflow illustration · See the actual application below',features:[['Bring your manuscript','Prism / Overleaf source ZIP'],['Manage references','RIS · BibTeX · CSL · DOI duplicate review'],['Work with your agent','Codex / Claude Code · 38 MCP tools'],['HWPX submission forms','Text editing · Experimental support']]},
ja:{title:'読んだ根拠を、原稿の引用へ。',sub:'原稿、プレビュー、参考論文、研究メモをひとつの画面に。',steps:['論文から探す','出典と一緒に記録','原稿で引用する'],desc:['PDF原文 · 本文検索 · ローカルOCR','選択した文章 · 研究メモ · AIへの質問','ページ引用 · BibTeX · PDFコンパイル'],note:['主張をメモして、','根拠のページも残します。'],action:'メモと引用を原稿に追加',foot:'作業の流れを示す概念図 · 実際の画面は下に掲載',features:[['原稿を引き継ぐ','Prism / OverleafのソースZIP'],['参考文献を管理','RIS · BibTeX · CSL · DOI重複確認'],['エージェントと編集','Codex / Claude Code · MCPツール38個'],['HWPX投稿書式','本文編集 · 実験的サポート']]}
};
const esc=s=>s.replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;');
const text=(x,y,s,size=22,color='#dce4dc',weight=400)=>`<text x="${x}" y="${y}" fill="${color}" font-size="${size}" font-weight="${weight}">${esc(s)}</text>`;
for(const [lang,c] of Object.entries(copies)){
 const pieces=[`<svg xmlns="http://www.w3.org/2000/svg" width="1440" height="900" viewBox="0 0 1440 900" role="img" aria-labelledby="title desc"><title id="title">${esc(c.title)}</title><desc id="desc">${esc(c.sub)}</desc><rect width="1440" height="900" rx="20" fill="#202522"/><g font-family="${lang==='ja'?'Pretendard JP':'Pretendard'},sans-serif">`,text(64,88,c.title,48,'#f3f5ef',650),text(64,135,c.sub,24,'#b6c3b4')];
 for(let i=0;i<3;i++){
  const x=64+i*448;
  pieces.push(text(x,220,c.steps[i],28,'#f3f5ef',600),text(x,257,c.desc[i],18,'#b6c3b4'),`<rect x="${x}" y="286" width="416" height="310" rx="10" fill="${i===0?'#f6f7f2':'#29312b'}" stroke="#49574b"/>`);
  if(i===0){pieces.push(text(x+28,330,'Evidence study',23,'#27372b',600),text(x+28,362,'Results',17,'#526453'),`<path d="M${x+28} 389h350m-350 27h330m-330 27h350m-350 27h260m-260 52h350m-350 27h290" stroke="#c5cec0" stroke-width="7"/>`,`<rect x="${x+24}" y="430" width="360" height="49" fill="#c5d2b5" opacity=".65"/>`,text(x+28,576,'Source PDF / p. 12',16,'#526453'));}
  if(i===1){pieces.push(text(x+28,330,'Evidence2026 · p.12',18,'#c5d2b5',600),`<path d="M${x+28} 357v86" stroke="#c5d2b5" stroke-width="3"/>`,text(x+46,388,c.note[0],21),text(x+46,423,c.note[1],21),`<path d="M${x+28} 465h350m-350 24h280" stroke="#536150" stroke-width="6"/>`,`<rect x="${x+24}" y="520" width="368" height="48" rx="5" fill="#c5d2b5"/>`,text(x+38,551,c.action,18,'#263124',600));}
  if(i===2){pieces.push(text(x+28,330,'main.tex',19,'#b6c3b4'),`<g font-family="Consolas,monospace">`,text(x+28,383,'\\section{Results}',23,'#d5c692'),text(x+28,425,'\\cite[p.~12]{Evidence2026}',22,'#c5d2b5'),text(x+28,467,'\\bibliography{references}',22,'#b7c8d0'),'</g>',`<path d="M${x+28} 503h360" stroke="#49574b"/>`,text(x+28,552,'PDF + source ZIP',24,'#f3f5ef',600));}
  if(i<2)pieces.push(`<path d="M${x+420} 436h22m-8-7 8 7-8 7" fill="none" stroke="#b8c7a4" stroke-width="2"/>`);
 }
 pieces.push('<path d="M64 645h1312" stroke="#49574b"/>');
 c.features.forEach(([h,d],i)=>{const x=64+(i%2)*672,y=697+Math.floor(i/2)*83;pieces.push(text(x,y,h,23,'#f3f5ef',600),text(x,y+30,d,20,'#b6c3b4'));});
 pieces.push(text(64,863,c.foot,16,'#9cae9b'),'</g></svg>');
 const svg=pieces.join('');writeFileSync(`docs/images/overview-${lang}.svg`,svg);
 const canvas=createCanvas(1440,900);canvas.getContext('2d').drawImage(await loadImage(Buffer.from(svg)),0,0);writeFileSync(`docs/images/overview-${lang}.png`,canvas.toBuffer('image/png'));
}
