/* Neo Store · combine com
   Sugere calçados que combinam com uma bolsa e permite levar os dois de uma vez:
   na janela da bolsa ("Combine com") e na sacola ("Combina com a sua bolsa").
   A escolha é automática: cor parecida (tons neutros combinam com tudo), mesma marca
   e preço na mesma faixa. Só entram calçados com algum tamanho disponível. */

/* ================= Regra de combinação ================= */
const hexRgb=h=>{const m=/^#?([0-9a-f]{6})$/i.exec(h||'');if(!m)return null;const n=parseInt(m[1],16);return[n>>16,(n>>8)&255,n&255]};
/* distância entre duas cores, de 0 (iguais) a 1 (opostas), na fórmula "redmean" (próxima da percepção humana) */
function colorDist(a,b){const x=hexRgb(a),y=hexRgb(b);if(!x||!y)return null;const r=(x[0]+y[0])/2,dr=x[0]-y[0],dg=x[1]-y[1],db=x[2]-y[2];
  return Math.min(1,Math.sqrt((2+r/256)*dr*dr+4*dg*dg+(2+(255-r)/256)*db*db)/765)}
/* preto, branco, cinza e nude (pouca cor) ou caramelo e marrons (tons terrosos não muito claros): combinam com quase tudo */
function isNeutral(h){const c=hexRgb(h);if(!c)return false;const mx=Math.max(...c),mn=Math.min(...c),sat=mx?(mx-mn)/mx:0;
  return sat<.25||(c[0]>=c[1]&&c[1]>=c[2]&&sat<.8&&mx<210)}
const hasStock=p=>!p.out&&p.sizes.some(s=>room(p,s)>0);
function lookScore(bag,shoe){let best=null;
  bag.cols.forEach(a=>shoe.cols.forEach(b=>{const d=colorDist(a,b);if(d!=null&&(best==null||d<best))best=d}));
  const color=best==null?.35:Math.max(0,1-best*2.2);
  return color*3+(shoe.b===bag.b?1:0)+(shoe.cols.some(isNeutral)?.6:0)-Math.min(1,Math.abs(Math.log((shoe.p||1)/(bag.p||1))))*.4}
/* até n calçados que combinam com a bolsa, do melhor para o pior */
function lookFor(bag,n=2){if(!bag||bag.c!=='bolsas')return[];
  return P.filter(s=>s.c==='calcados'&&hasStock(s)).map(s=>({s,v:lookScore(bag,s)})).sort((a,b)=>b.v-a.v).slice(0,n).map(x=>x.s)}

/* ================= Peças da sugestão ================= */
function lookSizes(s,attr,picked){return s.sizes.length>1?`<div class="chips look-sizes">${s.sizes.map(z=>`<button class="chip" ${attr}="${z}" aria-pressed="${picked===z}" ${room(s,z)>0?'':'disabled title="Esgotado"'}>${z}</button>`).join('')}</div>`:''}
function lookCard(s,on,attr,picked){return`<div class="look-item" data-look="${s.id}" aria-pressed="${on}" role="button" tabindex="0" aria-label="Escolher ${s.n}">
  <button class="look-pic" data-lopen="${s.id}" aria-label="Ver ${s.n}">${pic(s)}</button>
  <div class="look-info"><b>${s.n}</b><small>${label(s)}</small><span class="price">${brl(s.p)}</span>${lookSizes(s,attr,picked)}</div></div>`}

/* ================= Na janela da bolsa ================= */
let look=null; /* {bag, shoes, id, size} */
function lookHTML(bag){look=null;if(bag.out)return'';const shoes=lookFor(bag);if(!shoes.length)return'';
  look={bag,shoes,id:shoes[0].id,size:shoes[0].sizes.length===1?shoes[0].sizes[0]:null};
  return`<div class="look" id="look"><div class="opt-label">Combine com <span id="lookWarn" class="hint err"></span></div>
  ${shoes.map((s,i)=>lookCard(s,i===0,'data-lsize',null)).join('')}
  <button class="btn ghost block" id="lookAdd">Adicionar os dois · <span id="lookTotal"></span></button></div>`}
function lookTotal(){if(!look)return;const s=P.find(x=>x.id===look.id);const el=$('#lookTotal');if(el)el.textContent=brl(look.bag.p*(sel.qty||1)+s.p)}
function lookPick(id,size){look.id=id;look.size=size;const w=$('#lookWarn');if(w)w.textContent='';
  $$('#look [data-look]').forEach(el=>{el.setAttribute('aria-pressed',el.dataset.look===id);
    el.querySelectorAll('[data-lsize]').forEach(b=>b.setAttribute('aria-pressed',el.dataset.look===id&&b.dataset.lsize===size))});lookTotal()}
/* cliques dentro da seção; devolve true se o clique era dela */
function lookClick(t){if(!look||!t.closest('#look'))return false;
  const o=t.closest('[data-lopen]');if(o){openProduct(o.dataset.lopen);return true}
  const z=t.closest('[data-lsize]');if(z){lookPick(z.closest('[data-look]').dataset.look,z.dataset.lsize);return true}
  const it=t.closest('[data-look]');if(it){if(it.dataset.look!==look.id){const s=P.find(x=>x.id===it.dataset.look);lookPick(s.id,s.sizes.length===1?s.sizes[0]:null)}return true}
  if(t.closest('#lookAdd')){
    if(!sel.size){$('#sizeWarn').textContent='· escolha o tamanho';return true}
    if(!look.size){$('#lookWarn').textContent='· escolha o tamanho do calçado';return true}
    const s=P.find(x=>x.id===look.id);
    addToCart(sel.id,sel.size,sel.col,sel.qty,true);addToCart(s.id,look.size,s.cols[0],1,true);
    toast(`${look.bag.n} e ${s.n} na sacola`,['Ver sacola',openDrawer]);close('#pModal');setTimeout(()=>openDrawer(),250);return true}
  return true}

/* teclado: Enter ou Espaço num cartão de calçado equivale a clicar nele */
document.addEventListener('keydown',e=>{if((e.key==='Enter'||e.key===' ')&&e.target.matches?.('.look-item')){e.preventDefault();e.target.click()}});

/* ================= Na sacola ================= */
let dLook=null; /* {id, size} */
function lookDrawerHTML(){
  const items=cart.map(i=>P.find(p=>p.id===i.id)).filter(Boolean);
  if(items.some(p=>p.c==='calcados'))return'';
  const s=lookFor(items.find(p=>p.c==='bolsas'),1)[0];if(!s)return'';
  if(!dLook||dLook.id!==s.id)dLook={id:s.id,size:s.sizes.length===1?s.sizes[0]:null};
  return`<div class="look look-drawer"><div class="opt-label">Combina com a sua bolsa <span id="dLookWarn" class="hint err"></span></div>
  ${lookCard(s,true,'data-dsize',dLook.size)}<button class="btn solid block" data-dadd="${s.id}">Adicionar à sacola</button></div>`}
function lookDrawerClick(t){if(!t.closest('.look-drawer'))return false;
  const o=t.closest('[data-lopen]');if(o){close('#drawer');setTimeout(()=>openProduct(o.dataset.lopen),200);return true}
  const z=t.closest('[data-dsize]');if(z){dLook.size=z.dataset.dsize;$$('.look-drawer [data-dsize]').forEach(b=>b.setAttribute('aria-pressed',b===z));$('#dLookWarn').textContent='';return true}
  if(t.closest('[data-dadd]')){if(!dLook.size){$('#dLookWarn').textContent='· escolha o tamanho';return true}
    const s=P.find(x=>x.id===dLook.id);addToCart(s.id,dLook.size,s.cols[0],1);return true}
  return true}
