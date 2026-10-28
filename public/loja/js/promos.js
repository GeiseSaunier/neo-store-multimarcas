/* Neo Store · promoções
   Faixa da página inicial com as peças em promoção (cadastradas em Painel > Promoções).
   O preço com desconto já vem calculado do servidor; aqui só mostramos. */

/* "termina hoje às 23:59", "termina amanhã às 18:00", "termina em 3 dias" ou "até 15/11" */
function promoEnds(iso){const end=new Date(iso),now=new Date();if(end<=now)return'encerrada';
  const hm=`${String(end.getHours()).padStart(2,'0')}:${String(end.getMinutes()).padStart(2,'0')}`;
  const day=d=>new Date(d.getFullYear(),d.getMonth(),d.getDate()).getTime();
  const days=Math.round((day(end)-day(now))/864e5);
  if(days===0)return`termina hoje às ${hm}`;if(days===1)return`termina amanhã às ${hm}`;
  if(days<7)return`termina em ${days} dias`;
  return`até ${String(end.getDate()).padStart(2,'0')}/${String(end.getMonth()+1).padStart(2,'0')}`}

let promoTimer;
function renderPromos(){const sec=$('#promos');if(!sec)return;
  const items=P.filter(p=>p.pr);
  if(!items.length||!PROMOS.length){sec.hidden=true;return}
  const first=[...PROMOS].sort((a,b)=>new Date(a.ends_at)-new Date(b.ends_at))[0];
  const maxPct=Math.max(...PROMOS.map(p=>p.percent));
  $('#promoTitle').textContent=PROMOS.length===1?PROMOS[0].name:'Promoções';
  $('#promoInfo').textContent=PROMOS.length===1
    ?`Até ${Math.round(maxPct)}% de desconto · ${promoEnds(first.ends_at)}.`
    :`${PROMOS.map(p=>p.name).join(' · ')} · até ${Math.round(maxPct)}% de desconto.`;
  $('#promoRow').innerHTML=items.map(p=>`<article class="card promo-card">
    <div class="pic" data-open="${p.id}" role="button" tabindex="0" aria-label="Ver ${p.n}">${pic(p)}<span class="tag">−${Math.round((1-p.p/p.o)*100)}%</span>${p.out?'<span class="tag out">Esgotado</span>':''}</div>
    <div class="meta"><div><h3 data-open="${p.id}">${p.n}</h3><div class="sub">${label(p)}</div></div></div>
    <div class="price"><s>${brl(p.o)}</s>${brl(p.p)}</div><small class="promo-end">${promoEnds(p.pr.ends_at)}</small></article>`).join('');
  sec.hidden=false;
  /* quando a próxima promoção acabar (em até 24 h), recarrega os preços sozinho */
  clearTimeout(promoTimer);const ms=new Date(first.ends_at)-Date.now();if(ms>0&&ms<864e5)promoTimer=setTimeout(reloadCatalog,ms+2000)}

$('#promos').addEventListener('click',e=>{const o=e.target.closest('[data-open]');if(o)openProduct(o.dataset.open)});
$('#promos').addEventListener('keydown',e=>{if(e.key==='Enter'&&e.target.matches('.pic'))openProduct(e.target.dataset.open)});
