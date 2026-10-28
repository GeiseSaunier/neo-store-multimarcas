/* Neo Store · vitrine
   Cartões de produto, marcas, filtros, favoritos e janela do produto. */
function pic(p){return p.img?`<img src="${esc(p.img)}" alt="${p.n}" loading="lazy">`:`<span class="mono" style="width:22%;color:var(--stone)"></span>`}
function mapP(x){const cols=(x.colors||[]).filter(Boolean);return{id:x.id,n:esc(x.name),b:x.brand,bl:esc(x.brand_label||''),c:x.category,img:x.images?.[0]||'',imgs:x.images||[],p:x.price,o:x.old_price||0,pr:x.promo||null,
  sizes:(x.sizes?.length?x.sizes:['Único']).map(esc),cols:cols.length?cols.map(esc):[''],d:esc(x.description),det:(x.details||[]).map(esc),out:x.stock===0,st:x.stock,
  ss:x.size_stock?Object.fromEntries(Object.entries(x.size_stock).map(([k,v])=>[esc(k),+v])):null}}
/* estoque: quanto há do tamanho e quanto ainda cabe na sacola */
function avail(p,size){if(p.ss)return p.ss[size]??0;return p.st==null?99:p.st}
function room(p,size){return Math.max(0,avail(p,size)-cart.filter(i=>i.id===p.id&&(!p.ss||i.size===size)).reduce((s,i)=>s+i.q,0))}

/* ================= Categories ================= */
function renderCats(){$('#cats').innerHTML=menuBrands().map(([k,b])=>{const n=countOf(k);const img=(P.find(p=>p.b===k&&p.img)||{}).img;return`<div class="cat ${img?'':'soon'}">
  ${img?`<img src="${esc(img)}" alt="">`:`<div class="soon-art" aria-hidden="true"><span class="mono"></span></div>`}
  <button class="cat-hit" data-go="${k}" aria-label="Ver ${b.n}"></button>
  <h3>${b.n}</h3><span>${n?`${n} ${n===1?'peça':'peças'}`:'Novidades em breve'}</span>
  <div class="subs">${b.subs.map(s=>`<button data-go="${k}:${s}">${SUBS[s]}</button>`).join('')}</div></div>`}).join('')}

/* ================= Grid ================= */
function renderTabs(){const[fb,fs]=filter.split(':');
  let html=`<button class="tab" data-f="todos" aria-pressed="${filter==='todos'}">Tudo</button>`+menuBrands().map(([k,b])=>`<button class="tab" data-f="${k}" aria-pressed="${fb===k}">${b.n}</button>`).join('')+
    SHORTCUTS.map(s=>`<button class="tab" data-f="cat:${s}" aria-pressed="${filter==='cat:'+s}">${SUBS[s]}</button>`).join('');
  if(BRANDS[fb])html+=`<div class="subtabs">${[['',`Tudo em ${BRANDS[fb].n}`],...BRANDS[fb].subs.map(s=>[s,SUBS[s]])].map(([s,n])=>`<button class="subtab" data-f="${fb}${s?':'+s:''}" aria-pressed="${(fs||'')===s}">${n}</button>`).join('')}</div>`;
  $('#tabs').innerHTML=html;window.navSpy&&navSpy()}
function norm(s){return s.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase()}
function listed(){
  const[fb,fs]=filter.split(':');let l=P.filter(p=>filter==='todos'||(fb==='cat'?p.c===fs:p.b===fb&&(!fs||p.c===fs)));
  if(query){const q=norm(query);l=l.filter(p=>norm(p.n+' '+label(p)+' '+p.d).includes(q))}
  const s=$('#sort').value;
  if(s==='asc')l=[...l].sort((a,b)=>a.p-b.p);if(s==='desc')l=[...l].sort((a,b)=>b.p-a.p);
  return l;
}
const heart='<svg viewBox="0 0 24 24"><path d="M12 20s-7.5-4.6-7.5-10A4.3 4.3 0 0 1 12 7.4 4.3 4.3 0 0 1 19.5 10c0 5.4-7.5 10-7.5 10Z"/></svg>';
function inst(v){const n=Math.min(3,Math.max(1,Math.floor(v/50)));return n>1?`ou ${n}x de ${brl(v/n)} sem juros`:'à vista'}
function renderGrid(){
  const l=listed();
  $('#resultInfo').textContent=query?`${l.length} ${l.length===1?'resultado':'resultados'} para “${query}”.`:filter.startsWith('cat:')?`${goName(filter)} de todas as marcas.`:'Peças selecionadas para esta estação.';
  $('#grid').innerHTML=l.length?l.map((p,i)=>`
   <article class="card" style="animation-delay:${Math.min(i,8)*45}ms">
     <div class="pic" data-open="${p.id}" role="button" tabindex="0" aria-label="Ver ${p.n}">${pic(p)}${p.out?`<span class="tag">Esgotado</span>`:p.o?`<span class="tag">−${Math.round((1-p.p/p.o)*100)}%</span>`:''}
       <button class="fav" data-fav="${p.id}" aria-pressed="${favs.includes(p.id)}" aria-label="Favoritar ${p.n}">${heart}</button>
       <button class="quick" data-quick="${p.id}" ${p.out?'disabled':''}>${p.out?'Esgotado':'Adicionar à sacola'}</button>
     </div>
     <div class="meta"><div><h3 data-open="${p.id}">${p.n}</h3><div class="sub">${label(p)}</div></div>
       <div style="text-align:right"><div class="price">${p.o?`<s>${brl(p.o)}</s>`:''}${brl(p.p)}</div></div></div>
     <div style="display:flex;justify-content:space-between;align-items:center"><span class="inst">${inst(p.p)}</span><span class="swatches">${p.cols.length<2?'':p.cols.map(c=>`<i style="background:${c}"></i>`).join('')}</span></div>
   </article>`).join(''):(()=>{if(!query&&filter!=='todos'){const g=soonName(filter);return`<div class="empty soon-empty"><span class="mono"></span><p class="t">${g} chegam em breve.</p><p>Estamos preparando as próximas peças. Quer ser avisada primeiro?</p><a class="btn solid" href="${WA}?text=${encodeURIComponent('Olá! Quero ser avisada quando chegarem '+g.charAt(0).toLowerCase()+g.slice(1)+'.')}" target="_blank" rel="noopener">Avise-me pelo WhatsApp</a></div>`}
  return`<div class="empty">Nada encontrado. Tente outra palavra ou <button class="tab" data-f="todos" style="text-decoration:underline">veja tudo</button>.</div>`})();
  
}
$('#tabs').addEventListener('click',e=>{const b=e.target.closest('[data-f]');if(!b)return;filter=b.dataset.f;renderTabs();renderGrid()});
$('#grid').addEventListener('click',e=>{const t=e.target;
  const f=t.closest('[data-fav]');if(f){e.stopPropagation();toggleFav(f.dataset.fav,f);return}
  const q=t.closest('[data-quick]');if(q){e.stopPropagation();const p=P.find(x=>x.id===q.dataset.quick);if(p.out)return;
    if(p.sizes.length>1)openProduct(p.id);else addToCart(p.id,p.sizes[0],p.cols[0],1);return}
  const o=t.closest('[data-open]');if(o)openProduct(o.dataset.open);
  const r=t.closest('[data-f]');if(r){filter='todos';query='';renderTabs();renderGrid()}
});
$('#grid').addEventListener('keydown',e=>{if(e.key==='Enter'&&e.target.matches('.pic'))openProduct(e.target.dataset.open)});
$('#sort').onchange=renderGrid;

document.addEventListener('click',e=>{const g=e.target.closest('[data-go]');if(!g)return;
  if(validGo(g.dataset.go)){filter=g.dataset.go;query='';renderTabs();renderGrid()}
  closeAll();if(g.tagName==='BUTTON')$('#loja').scrollIntoView({behavior:reduce?'auto':'smooth'});
});

/* ================= Favorites ================= */
function toggleFav(id,btn){const i=favs.indexOf(id);if(i>-1)favs.splice(i,1);else favs.push(id);store.set('neo-favs',favs);
  $$(`[data-fav="${id}"]`).forEach(b=>b.setAttribute('aria-pressed',favs.includes(id)));
  updateBadges('fav');toast(i>-1?'Removido dos favoritos':'Salvo nos favoritos')}
$('#favBtn').onclick=()=>{if(!favs.length){toast('Você ainda não favoritou nenhuma peça');return}
  filter='todos';query='';renderTabs();
  const l=P.filter(p=>favs.includes(p.id));
  $('#grid').innerHTML='';query='';renderGridList(l);$('#loja').scrollIntoView({behavior:reduce?'auto':'smooth'})};
function renderGridList(l){const keep=P.slice();P.length=0;P.push(...l);renderGrid();$('#resultInfo').textContent=`Seus favoritos (${l.length}).`;P.length=0;P.push(...keep);}

/* ================= Product modal ================= */
let sel={};
function openProduct(id){const p=P.find(x=>x.id===id);sel={id,size:p.sizes.length===1?p.sizes[0]:null,col:p.cols[0],qty:1};
  $('#pBox').innerHTML=`<button class="icon-btn x" data-close aria-label="Fechar"><svg viewBox="0 0 24 24"><path d="M6 6l12 12M18 6 6 18"/></svg></button>
  <div class="pv"><div class="pic">${pic(p)}${p.imgs.length>1?`<div class="thumbs">${p.imgs.map((u,i)=>`<button data-img="${esc(u)}" aria-pressed="${i===0}" aria-label="Foto ${i+1}"><img src="${esc(u)}" alt=""></button>`).join('')}</div>`:''}</div><div class="info">
   <div class="sub" style="font-size:12px;color:var(--muted)">${label(p)}</div>
   <h2>${p.n}</h2>
   <div><div class="price">${p.o?`<s>${brl(p.o)}</s>`:''}${brl(p.p)}</div><div class="inst">${inst(p.p)} · ${brl(p.p*.95)} no PIX</div>
     ${p.pr?`<div class="promo-line">${esc(p.pr.name)} · −${Math.round(p.pr.percent)}% · ${promoEnds(p.pr.ends_at)}</div>`:''}</div>
   <p class="desc">${p.d}</p>
   <div ${p.cols.length<2?'hidden':''}><div class="opt-label">Cor</div><div class="chips" id="pCols">${p.cols.map((c,i)=>`<button class="color-chip" style="background:${c}" data-col="${c}" aria-pressed="${i===0}" aria-label="Cor ${i+1}"></button>`).join('')}</div></div>
   ${p.sizes.length>1?`<div><div class="opt-label">Tamanho <span id="sizeWarn" class="hint err"></span></div><div class="chips" id="pSizes">${p.sizes.map(s=>`<button class="chip" data-size="${s}" aria-pressed="false" ${p.ss&&!avail(p,s)?'disabled title="Esgotado"':''}>${s}</button>`).join('')}</div></div>`:''}
   <div style="display:flex;gap:12px;align-items:center;margin-top:6px">
     <div class="qty" style="height:52px"><button id="qm" aria-label="Diminuir">−</button><span id="qv">1</span><button id="qp" aria-label="Aumentar">+</button></div>
     <button class="btn solid" style="flex:1" id="addBtn" ${p.out?'disabled':''}>${p.out?'Esgotado':'Adicionar à sacola'}</button>
     <button class="icon-btn fav" style="position:static;border:1px solid var(--line);width:52px;height:52px" data-fav="${p.id}" aria-pressed="${favs.includes(p.id)}" aria-label="Favoritar">${heart}</button>
   </div>
   ${lookHTML(p)}
   <ul class="det">${p.det.map(d=>`<li>${d}</li>`).join('')}<li>Produto 100% original</li></ul>
  </div></div>`;
  open('#pModal');lookTotal();
  const box=$('#pBox');
  box.onclick=e=>{const t=e.target;
    if(lookClick(t))return;
    const c=t.closest('[data-col]');if(c){sel.col=c.dataset.col;$$('#pCols [data-col]').forEach(b=>b.setAttribute('aria-pressed',b===c))}
    const s=t.closest('[data-size]');if(s){sel.size=s.dataset.size;$$('#pSizes [data-size]').forEach(b=>b.setAttribute('aria-pressed',b===s));const w=$('#sizeWarn');if(w)w.textContent='';sel.qty=Math.max(1,Math.min(sel.qty,room(p,sel.size)));$('#qv').textContent=sel.qty}
    const f=t.closest('[data-fav]');if(f)toggleFav(f.dataset.fav,f);
    const gi=t.closest('[data-img]');if(gi){box.querySelector('.pic > img').src=gi.dataset.img;box.querySelectorAll('[data-img]').forEach(x=>x.setAttribute('aria-pressed',x===gi))}
    if(t.closest('#qm')){sel.qty=Math.max(1,sel.qty-1);$('#qv').textContent=sel.qty;lookTotal()}
    if(t.closest('#qp')){const max=Math.min(9,sel.size?Math.max(1,room(p,sel.size)):9);if(sel.qty>=max&&sel.size)toast('Não há mais unidades disponíveis');sel.qty=Math.min(max,sel.qty+1);$('#qv').textContent=sel.qty;lookTotal()}
    if(t.closest('#addBtn')){if(!sel.size){$('#sizeWarn').textContent='· escolha um tamanho';return}
      addToCart(sel.id,sel.size,sel.col,sel.qty);close('#pModal');setTimeout(()=>openDrawer(),250)}
  };
}
