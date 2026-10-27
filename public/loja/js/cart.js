/* Neo Store · sacola
   Adicionar, remover, cupom e resumo da sacola. */
/* ================= Cart ================= */
function addToCart(id,size,col,qty){const p=P.find(x=>x.id===id);const r=room(p,size);
  if(r<1){toast(`Não há mais unidades de ${p.n}${size!=='Único'?' no tamanho '+size:''}`);return}
  const cut=qty>r;qty=Math.min(qty,r);const k=`${id}|${size}|${col}`;const ex=cart.find(x=>x.k===k);
  if(ex)ex.q=Math.min(9,ex.q+qty);else cart.push({k,id,size,col,q:qty});save();
  toast(cut?`Só havia ${qty} unidade(s) disponível(is) de ${p.n}`:`${p.n} na sacola`,['Ver sacola',openDrawer]);updateBadges('cart',true)}
/* valor de uma entrega regional como a cliente vê */
function shipPrice(o){return o.price_label?esc(o.price_label):o.to_confirm?'Consulte':o.price?brl(o.price):'Grátis'}
function save(){store.set('neo-cart',cart);store.set('neo-coupon',coupon);renderDrawer();updateBadges()}
function totals(){const sub=cart.reduce((s,i)=>s+P.find(p=>p.id===i.id).p*i.q,0);const disc=coupon?Math.round(sub*coupon.pct)/100:0;return{sub,disc,after:sub-disc}}
function updateBadges(which,bump){const n=cart.reduce((s,i)=>s+i.q,0);const cc=$('#cartCount');cc.textContent=n;cc.classList.toggle('on',n>0);
  const fc=$('#favCount');fc.textContent=favs.length;fc.classList.toggle('on',favs.length>0);
  if(bump){cc.classList.remove('bump');void cc.offsetWidth;cc.classList.add('bump')}}
function renderDrawer(){const b=$('#drawerBody'),f=$('#drawerFoot');const n=cart.reduce((s,i)=>s+i.q,0);
  $('#drawerTitle').textContent=n?`Sua sacola (${n})`:'Sua sacola';
  if(!cart.length){b.innerHTML=`<div class="d-empty"><span class="mono"></span><p style="font-family:var(--serif);font-size:24px;color:var(--ink);margin:0 0 6px">Sua sacola está vazia.</p><p style="margin:0 0 24px">Que tal começar pelas bolsas?</p><button class="btn ghost" data-go="todos">Ver a coleção</button></div>`;f.innerHTML='';return}
  const t=totals();
  b.innerHTML=`<div class="ship-bar">${[...SHIP.regional.map(o=>`${esc(o.name)} <b>${shipPrice(o)}</b>`),...(SHIP.correios?['Correios para todo o Brasil']:[])].join(' · ')}</div>`+
  cart.map(i=>{const p=P.find(x=>x.id===i.id);return`<div class="line"><div class="thumb">${pic(p)}</div><div><h4>${p.n}</h4><small>${i.size!=='Único'?'Tam. '+i.size+' · ':''}<span style="display:inline-block;width:10px;height:10px;border-radius:50%;background:${i.col};vertical-align:-1px;border:1px solid var(--line)"></span></small>
   <div class="qty"><button data-dq="${i.k}" aria-label="Diminuir">−</button><span>${i.q}</span><button data-iq="${i.k}" aria-label="Aumentar">+</button></div><button class="rm" data-rm="${i.k}">Remover</button></div><div class="price">${brl(p.p*i.q)}</div></div>`}).join('');
  f.innerHTML=`<div class="coupon"><input id="cpIn" placeholder="Cupom de desconto" value="${coupon?coupon.code:''}" aria-label="Cupom"><button id="cpBtn">${coupon?'Remover':'Aplicar'}</button></div><div class="hint" id="cpHint">${coupon?`<span class="hint ok">Cupom ${coupon.code} aplicado${coupon.first?' (válido só na primeira compra)':''}.</span>`:'Tem um cupom? Digite aqui.'}</div>
  <div style="margin-top:14px"><div class="sumrow"><span>Subtotal</span><span>${brl(t.sub)}</span></div>${t.disc?`<div class="sumrow"><span>Desconto</span><span class="disc">− ${brl(t.disc)}</span></div>`:''}
  <div class="sumrow total"><span>Total</span><span>${brl(t.after)}</span></div><div class="hint" style="text-align:right">${inst(t.after)} · frete calculado no próximo passo</div></div>
  <button class="btn solid block" style="margin-top:16px" id="goCheckout">Finalizar compra</button>`;
}
$('#drawer').addEventListener('click',e=>{const t=e.target;
  const d=t.closest('[data-dq]'),i=t.closest('[data-iq]'),r=t.closest('[data-rm]');
  if(d){const it=cart.find(x=>x.k===d.dataset.dq);it.q--;if(!it.q)cart=cart.filter(x=>x!==it);save()}
  if(i){const it=cart.find(x=>x.k===i.dataset.iq);if(room(P.find(x=>x.id===it.id),it.size)<1){toast('Não há mais unidades disponíveis');return}it.q=Math.min(9,it.q+1);save()}
  if(r){const it=cart.find(x=>x.k===r.dataset.rm);const idx=cart.indexOf(it);cart=cart.filter(x=>x!==it);save();toast('Item removido',['Desfazer',()=>{cart.splice(idx,0,it);save()}])}
  if(t.closest('#cpBtn')){if(coupon){coupon=null;save();return}const v=$('#cpIn').value.trim().toUpperCase();if(!v)return;
    fetch('/api/coupons?code='+encodeURIComponent(v)).then(r=>r.json()).then(j=>{if(j.valid){coupon={code:j.code,pct:j.percent,first:!!j.firstPurchase};save()}else{$('#cpHint').innerHTML='<span class="hint err">Cupom inválido. Confira o código e tente de novo.</span>'}}).catch(()=>{$('#cpHint').innerHTML='<span class="hint err">Não foi possível validar o cupom agora.</span>'});if(false){$('#cpHint').innerHTML='<span class="hint err">Cupom inválido. Confira o código e tente de novo.</span>'}}
  if(t.closest('#goCheckout')){close('#drawer');setTimeout(openCheckout,200)}
});
