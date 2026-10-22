/* Neo Store · utilitários
   Atalhos de DOM, formatação de moeda, armazenamento local e avisos. */
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const $=s=>document.querySelector(s), $$=s=>[...document.querySelectorAll(s)];
const brl=v=>v.toLocaleString('pt-BR',{style:'currency',currency:'BRL'});
const store={get(k,d){try{const v=localStorage.getItem(k);return v?JSON.parse(v):d}catch(e){return d}},set(k,v){try{localStorage.setItem(k,JSON.stringify(v))}catch(e){}}};
const reduce=matchMedia('(prefers-reduced-motion: reduce)').matches;

/* ================= Toast ================= */
let tT;function toast(msg,action){const t=$('#toast');t.innerHTML=`<span>${msg}</span>`+(action?`<button id="tAct">${action[0]}</button>`:'');t.classList.add('on');if(action)$('#tAct').onclick=()=>{action[1]();t.classList.remove('on')};clearTimeout(tT);tT=setTimeout(()=>t.classList.remove('on'),3200)}
