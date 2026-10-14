import { EditorView, basicSetup } from 'codemirror';
import { EditorState, Compartment } from '@codemirror/state';
import { keymap } from '@codemirror/view';
import { StreamLanguage } from '@codemirror/language';
import { stex } from '@codemirror/legacy-modes/mode/stex';
import { oneDark } from '@codemirror/theme-one-dark';
import { autocompletion, snippetCompletion } from '@codemirror/autocomplete';
import { indentWithTab } from '@codemirror/commands';

export function createEditor(textarea, onSave) {
  const host = document.createElement('div'); host.id = 'codeEditor'; textarea.after(host);
  textarea.hidden = true; document.getElementById('lineNumbers').hidden = true;
  const editable = new Compartment(); let syncing = false;
  const extensions = [basicSetup, oneDark, StreamLanguage.define(stex),
    EditorView.lineWrapping, editable.of(EditorView.editable.of(true)),
    EditorView.contentAttributes.of({'aria-label':'LaTeX 소스 코드'}),
    keymap.of([indentWithTab, {key:'Mod-s',run:()=>{onSave();return true;}}]),
    autocompletion({override:[context => {
      const word=context.matchBefore(/\\[a-zA-Z]*/); if(!word)return null;
      return {from:word.from,options:[
        snippetCompletion('\\section{${제목}}',{label:'\\section',type:'keyword'}),
        snippetCompletion('\\begin{${equation}}\n  ${}\n\\end{${equation}}',{label:'\\begin',type:'keyword'}),
        snippetCompletion('\\cite{${key}}',{label:'\\cite',type:'keyword'}),
        snippetCompletion('\\ref{${label}}',{label:'\\ref',type:'keyword'}),
        snippetCompletion('\\includegraphics[width=\\linewidth]{${figures/image.png}}',{label:'\\includegraphics',type:'keyword'})]};
    }]}),
    EditorView.updateListener.of(update=>{
      if(syncing)return;
      if(update.docChanged)textarea.dispatchEvent(new Event('input'));
      if(update.selectionSet)textarea.dispatchEvent(new Event('click'));
    }), EditorView.theme({'&':{height:'100%',fontSize:'14px'},'.cm-scroller':{overflow:'auto',fontFamily:'Consolas, monospace'},'.cm-content':{padding:'20px 0'},'.cm-line':{padding:'0 20px'}})
  ];
  const view = new EditorView({parent:host,extensions});
  Object.defineProperties(textarea, {
    selectionStart:{get:()=>view.state.selection.main.from}, selectionEnd:{get:()=>view.state.selection.main.to},
    disabled:{get:()=>!view.editable,set:value=>view.dispatch({effects:editable.reconfigure(EditorView.editable.of(!value))})}
  });
  // Keep the established save/draft pipeline while replacing the editing surface.
  Object.defineProperty(textarea,'value',{configurable:true,get:()=>view.state.doc.toString(),set:value=>{
    syncing=true; view.setState(EditorState.create({doc:value,extensions})); syncing=false;
  }});
  textarea.setSelectionRange=(from,to)=>view.dispatch({selection:{anchor:from,head:to}});
  textarea.setRangeText=(text,from,to)=>view.dispatch({changes:{from,to,insert:text},selection:{anchor:from+text.length}});
  textarea.focus=()=>view.focus();
  return view;
}
