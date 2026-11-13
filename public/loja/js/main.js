/* Neo Store · inicialização
   Carrega produtos e entregas da API e desenha a página. */
/* init */
$('#grid').innerHTML='<div class="empty">Carregando peças…</div>';
$('#legalLine').textContent=`${LEGAL.company} · CNPJ ${LEGAL.cnpj} · ${LEGAL.cities}`;
$('#igLink').href=LEGAL.instagram;if(LEGAL.email){$('#mailLink').href='mailto:'+LEGAL.email;$('#mailLink').textContent=LEGAL.email}else $('#mailLink').parentElement.remove();
renderTabs();updateBadges();
(async()=>{
  try{const[pr,sr]=await Promise.all([fetch('/api/products'),fetch('/api/shipping')]);const pj=await pr.json();if(!pr.ok)throw new Error(pj.error);P=pj.products.map(mapP);PROMOS=pj.promos||[];if(sr.ok)SHIP=await sr.json()}
  catch(e){$('#grid').innerHTML='<div class="empty">Não foi possível carregar as peças agora. Atualize a página em instantes.</div>';return}
  cart=cart.filter(i=>P.some(p=>p.id===i.id));favs=favs.filter(id=>P.some(p=>p.id===id));store.set('neo-favs',favs);
  const ed=(P.find(p=>/shopper/i.test(p.n))||P[0]||{}).img;if(ed)$('#editImg').src=ed;else $('#editImg').closest('.frame').innerHTML='<span class="mono" style="width:38%"></span>';
  renderCats();renderGrid();save();renderRates();renderPromos();
  checkLastOrder();
})();
/* Recarrega as peças e os preços (ex.: uma promoção terminou enquanto a página estava aberta). */
async function reloadCatalog(){try{const r=await fetch('/api/products');const j=await r.json();if(!r.ok)return;
  P=j.products.map(mapP);PROMOS=j.promos||[];cart=cart.filter(i=>P.some(p=>p.id===i.id));renderCats();renderGrid();renderPromos();save()}catch(e){}}
/* Seção "Entrega": opções regionais do painel + Correios. Cada cidade é uma parada do trajeto,
   com o preço em destaque; mostra só a primeira parte da descrição (antes do " · "). */
// Ilustrações das paradas (traço fino, cor da marca). A escolha é pelo nome/descrição da entrega.
const STOP_ICONS={
  walk:'<circle cx="24" cy="8" r="3.5"/><path d="M24 12.5 22 25M23.5 15.5 18 21M23.5 15.5l5.5 4.5M22 25l5 8 1 8M22 25l-4 8-4 7"/><rect x="27.5" y="20" width="7.5" height="8.5" rx="1"/><path d="M29.5 20v-1.5a1.75 1.75 0 0 1 3.5 0V20"/><path d="M8 44h32" opacity=".45"/>',
  boat:'<path d="M5 30h38l-5 7H10z"/><path d="M10 30v-7h27v7M14 26.5h3M20 26.5h3M26 26.5h3M32 26.5h2"/><path d="M14 23v-5h17v5M12 18h21M22 18v-6l5 2-5 2"/><path d="M3 42c3 0 3-1.5 6-1.5s3 1.5 6 1.5 3-1.5 6-1.5 3 1.5 6 1.5 3-1.5 6-1.5 3 1.5 6 1.5 3-1.5 6-1.5" opacity=".55"/>',
  moto:'<circle cx="10" cy="35" r="5"/><circle cx="38" cy="35" r="5"/><path d="M10 35h7l3-6h10l3 6h5M33 35l-3-12h-4M27 23h5"/><path d="M15 27h9" stroke-width="2.4"/><rect x="19" y="29" width="8" height="4" rx="1"/><rect x="4" y="17" width="10" height="9" rx="1"/><path d="M4 21h10"/><circle cx="22" cy="8.5" r="3"/><path d="M21.5 12l-2 9.5 5 3M21.5 14.5l7 3.5"/>',
  bus:'<rect x="9" y="9" width="30" height="26" rx="3"/><path d="M12 13h24v9H12zM24 13v9M9 27h30"/><circle cx="14.5" cy="31" r="1.4"/><circle cx="33.5" cy="31" r="1.4"/><path d="M13 35v4h5v-4M30 35v4h5v-4"/>',
  box:'<path d="M24 6l16 8v18l-16 8-16-8V14z"/><path d="M8 14l16 8 16-8M24 22v18M16 10l16 8"/>',
};
function stopIcon(name,info){const t=(name+' '+info).normalize('NFD').replace(/[̀-ͯ]/g,'').toLowerCase();
  const k=/brasil|correios/.test(t)?'box':/rodoviaria|taxi|outros/.test(t)?'bus':/manaus|motoboy/.test(t)?'moto':/barco|maues/.test(t)?'boat':'walk';
  return `<svg class="ico" viewBox="0 0 48 48" aria-hidden="true">${STOP_ICONS[k]}</svg>`}
function renderRates(){const short=d=>String(d||'').split(' · ')[0];
  const stops=SHIP.regional.map(o=>({name:o.name,price:shipPrice(o),info:short(o.description)}));
  if(SHIP.correios)stops.push({name:'Todo o Brasil',price:'Pelo CEP',info:'Correios PAC ou SEDEX'});
  $('#rates').innerHTML=stops.map(s=>`<li class="stop">${stopIcon(s.name,s.info)}<span class="dot" aria-hidden="true"></span><h4>${esc(s.name)}</h4><b>${s.price}</b><small>${esc(s.info)}</small></li>`).join('')}
/* Esvazia a sacola se o último pedido já foi pago (ex.: pagou o PIX e fechou a janela). */
function clearPaidCart(){cart=[];coupon=null;store.set('neo-last-order',null);save()}
async function checkLastOrder(){const id=store.get('neo-last-order',null);if(!id)return;
  try{const r=await fetch('/api/orders/'+id);if(r.status===404){store.set('neo-last-order',null);return}const j=await r.json();
    if(['paid','shipped','delivered'].includes(j.status))clearPaidCart();else if(j.status!=='pending')store.set('neo-last-order',null)}catch(e){}}
