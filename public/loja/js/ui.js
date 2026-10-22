/* Neo Store · janelas e busca
   Abrir e fechar sacola, janelas, menu do celular e busca. */
/* ================= Overlay control ================= */
let stack=[],lastFocus=null;
function open(sel){lastFocus=document.activeElement;const el=$(sel);el.classList.add('on');el.setAttribute('aria-hidden','false');stack.push(sel);$('#scrim').classList.add('on');document.body.style.overflow='hidden';
  setTimeout(()=>{const f=el.querySelector('input,button:not(.x):not([data-close]),[data-close]');f&&f.focus()},120)}
function close(sel){const el=$(sel);el.classList.remove('on');el.setAttribute('aria-hidden','true');stack=stack.filter(s=>s!==sel);if(!stack.length){$('#scrim').classList.remove('on');document.body.style.overflow='';lastFocus&&lastFocus.focus&&lastFocus.focus()}}
function closeAll(){[...stack].forEach(close)}
function openDrawer(){renderDrawer();open('#drawer')}
$('#cartBtn').onclick=openDrawer;
$('#scrim').onclick=closeAll;
document.addEventListener('click',e=>{const c=e.target.closest('[data-close]');if(c){const host=c.closest('.drawer,.modal,.search,.mnav');host&&close('#'+host.id)}});
$$('.modal').forEach(m=>m.addEventListener('click',e=>{if(e.target===m)close('#'+m.id)}));
document.addEventListener('keydown',e=>{if(e.key==='Escape'&&stack.length)close(stack[stack.length-1])});
$('#menuBtn').onclick=()=>open('#mnav');

/* ================= Search ================= */
$('#searchBtn').onclick=()=>{open('#search');$('#q').value=query};
let qT;$('#q').addEventListener('input',e=>{clearTimeout(qT);qT=setTimeout(()=>{query=e.target.value.trim();filter='todos';renderTabs();renderGrid()},180)});
$('#q').addEventListener('keydown',e=>{if(e.key==='Enter'){close('#search');$('#loja').scrollIntoView({behavior:reduce?'auto':'smooth'})}});
$('#sugg').addEventListener('click',e=>{const b=e.target.closest('button');if(!b)return;$('#q').value=b.textContent;query=b.textContent;filter='todos';renderTabs();renderGrid();close('#search');$('#loja').scrollIntoView({behavior:reduce?'auto':'smooth'})});
