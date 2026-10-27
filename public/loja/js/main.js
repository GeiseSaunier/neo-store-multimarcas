/* Neo Store · inicialização
   Carrega produtos e entregas da API e desenha a página. */
/* init */
$('#grid').innerHTML='<div class="empty">Carregando peças…</div>';
$('#legalLine').textContent=`${LEGAL.company} · CNPJ ${LEGAL.cnpj} · ${LEGAL.address}`;
$('#igLink').href=LEGAL.instagram;$('#mailLink').href='mailto:'+LEGAL.email;$('#mailLink').textContent=LEGAL.email;
renderTabs();updateBadges();
(async()=>{
  try{const[pr,sr]=await Promise.all([fetch('/api/products'),fetch('/api/shipping')]);const pj=await pr.json();if(!pr.ok)throw new Error(pj.error);P=pj.products.map(mapP);if(sr.ok)SHIP=await sr.json()}
  catch(e){$('#grid').innerHTML='<div class="empty">Não foi possível carregar as peças agora. Atualize a página em instantes.</div>';return}
  cart=cart.filter(i=>P.some(p=>p.id===i.id));favs=favs.filter(id=>P.some(p=>p.id===id));store.set('neo-favs',favs);
  const ed=(P.find(p=>/shopper/i.test(p.n))||P[0]||{}).img;if(ed)$('#editImg').src=ed;else $('#editImg').closest('.frame').innerHTML='<span class="mono" style="width:38%"></span>';
  renderCats();renderGrid();save();renderRates();
  checkLastOrder();
})();
/* Seção "Entrega": opções regionais do painel + Correios. */
function renderRates(){$('#rates').innerHTML=SHIP.regional.map(o=>`<div class="rate"><div><h4>${esc(o.name)}</h4><small>${esc(o.description)}</small></div><b>${shipPrice(o)}</b></div>`).join('')+
  (SHIP.correios?'<div class="rate"><div><h4>Todo o Brasil</h4><small>Correios PAC ou SEDEX · prazo e valor calculados pelo CEP</small></div><b>Pelo CEP</b></div>':'')}
/* Esvazia a sacola se o último pedido já foi pago (ex.: pagou o PIX e fechou a janela). */
function clearPaidCart(){cart=[];coupon=null;store.set('neo-last-order',null);save()}
async function checkLastOrder(){const id=store.get('neo-last-order',null);if(!id)return;
  try{const r=await fetch('/api/orders/'+id);if(r.status===404){store.set('neo-last-order',null);return}const j=await r.json();
    if(['paid','shipped','delivered'].includes(j.status))clearPaidCart();else if(j.status!=='pending')store.set('neo-last-order',null)}catch(e){}}
