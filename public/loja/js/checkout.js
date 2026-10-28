/* Neo Store · checkout
   Dados, entrega (regional e Correios), pagamento pelo Mercado Pago e PIX. */
/* ================= Checkout ================= */
let co;
const MIN_INST=50, MAX_INST=3;
function openCheckout(){co={step:1,data:{},ship:null,pay:'pix',quotes:null,quoting:false,err:''};renderCo();open('#cModal')}
const STEP_N=['Seus dados','Entrega','Pagamento'];
const WD=['domingo','segunda','terça','quarta','quinta','sexta','sábado'];
function addBiz(n){const d=new Date();let k=0;while(k<n){d.setDate(d.getDate()+1);if(d.getDay()%6)k++}return d}
const fd=d=>`${WD[d.getDay()]} ${String(d.getDate()).padStart(2,'0')}/${String(d.getMonth()+1).padStart(2,'0')}`;
const onlyD=v=>String(v||'').replace(/\D/g,'');
function shipOpts(){const out=[];
  if(SHIP.correios){
    if(co.quotes&&co.quotes.length)co.quotes.forEach(q=>out.push({g:'Envio a domicílio',k:q.id,n:esc(q.name),d:`Chega entre ${fd(addBiz(q.min))} e ${fd(addBiz(q.max))}`,v:q.price}));
    else ['PAC','SEDEX'].forEach(n=>out.push({g:'Envio a domicílio',k:n.toLowerCase(),n:`Correios · ${n} (via Melhor Envio)`,d:co.quoting?'Calculando o frete…':co.quotes?'Indisponível para este CEP':'Informe o CEP para calcular',v:0,label:'—',off:1}));
  }
  SHIP.regional.forEach(o=>out.push({g:'Entrega regional',k:o.id,n:esc(o.name),d:esc(o.description),v:o.price,label:o.price_label?esc(o.price_label):null,tbd:o.to_confirm}));
  return out}
function shipListHTML(){let g='';return shipOpts().map(o=>{const head=o.g!==g?`<div class="ship-group">${(g=o.g)==='Envio a domicílio'?'<svg viewBox="0 0 24 24"><path d="M3 7h11v9H3zM14 10h4l3 3v3h-7"/><circle cx="7" cy="17.5" r="1.6"/><circle cx="17" cy="17.5" r="1.6"/></svg>':'<svg viewBox="0 0 24 24"><path d="M3 15h18l-2 4H5z"/><path d="M6 15V9h8l3 6M9 9V5h4v4"/></svg>'}${o.g}</div>`:'';
  return head+`<button class="ship-opt" data-ship="${o.k}" aria-pressed="${co.ship===o.k}" ${o.off?'disabled':''}><span>${o.n}<small>${o.d}</small></span><b>${o.label||(o.tbd?'Consulte':o.v?brl(o.v):'Grátis')}</b></button>`}).join('')+`<p class="hint" style="margin:10px 0 0">O prazo de entrega <b>não contabiliza feriados</b>.</p>`}
function curShip(){return shipOpts().find(o=>o.k===co.ship&&!o.off)}
function coTotals(){const t=totals();const o=curShip();const s=o?o.v:0;const base=t.after+s;const pix=co.pay==='pix'?Math.round(base*5)/100:0;return{...t,ship:s,shipTbd:o&&o.tbd,pix,total:Math.round((base-pix)*100)/100}}
function sideHTML(){const t=coTotals();const o=curShip();return`<h3 style="font-family:var(--serif);font-weight:400;font-size:24px;margin:0 0 14px;color:var(--ink)">Resumo</h3>
  <div class="mini-list">${cart.map(i=>{const p=P.find(x=>x.id===i.id);return`<div class="mini"><div class="thumb">${pic(p)}<i>${i.q}</i></div><div><b>${p.n}</b><span class="hint">${i.size!=='Único'?'Tam. '+i.size:''}</span></div><span>${brl(p.p*i.q)}</span></div>`}).join('')}</div>
  <div style="margin-top:16px"><div class="sumrow"><span>Subtotal</span><span>${brl(t.sub)}</span></div>
  ${t.disc?`<div class="sumrow"><span>Cupom ${coupon.code}</span><span class="disc">− ${brl(t.disc)}</span></div>`:''}
  <div class="sumrow"><span>Frete</span><span>${!o?'—':o.tbd?'A combinar':o.label&&o.label.includes(' a ')?'a partir de '+brl(o.v):o.v?brl(o.v):'Grátis'}</span></div>
  ${t.pix?`<div class="sumrow"><span>Desconto PIX (5%)</span><span class="disc">− ${brl(t.pix)}</span></div>`:''}
  <div class="sumrow total"><span>Total</span><span>${brl(t.total)}</span></div></div>`}
function field(id,label,cls='',attrs=''){return`<div class="field ${cls}"><label for="${id}">${label}</label><input id="${id}" value="${esc(co.data[id]||'')}" ${attrs}></div>`}
const ICON_X='<button class="icon-btn x" data-close aria-label="Fechar"><svg viewBox="0 0 24 24"><path d="M6 6l12 12M18 6 6 18"/></svg></button>';
function renderCo(){
  if(co.step==='pix')return renderPix();
  if(co.step==='done')return renderDone();
  const steps=`<ol class="steps">${STEP_N.map((s,i)=>`<li class="${i+1===co.step?'on':i+1<co.step?'done':''}"><b>${i+1<co.step?'✓':i+1}</b><span>${s}</span></li>`).join('')}</ol>`;
  let body='';
  if(co.step===1)body=`<div class="fs">${field('nome','Nome completo','','autocomplete="name"')}${field('email','E-mail','h','type="email" autocomplete="email"')}${field('tel','Celular com WhatsApp','h','inputmode="tel" autocomplete="tel" placeholder="(00) 00000-0000"')}${field('cpf','CPF','h','inputmode="numeric" placeholder="000.000.000-00"')}</div>`;
  if(co.step===2)body=`<div class="fs">${field('cep','CEP','t','inputmode="numeric" placeholder="00000-000" autocomplete="postal-code"')}${field('rua','Endereço','q','autocomplete="address-line1"')}${field('num','Número','t')}${field('comp','Complemento (opcional)','q')}${field('bairro','Bairro','h')}${field('cidade','Cidade / UF','h','autocomplete="address-level2"')}</div>
   <div class="ship-alert"><b>Atenção às entregas!</b> Informe um número de WhatsApp para facilitar o contato e a entrega. <b>Retirada por aplicativo:</b> combine antes com a gente pelo WhatsApp ${WA_LABEL}. <b>Entrega por barco:</b> fale com o nosso atendimento para informar os dados do barco. Não realizamos entregas de última hora, então programe-se com antecedência.</div>
   <div style="margin-top:22px"><div class="ship-opts" id="shipList">${shipListHTML()}</div><div class="hint err" id="shipErr"></div></div>`;
  if(co.step===3){const t=coTotals();const n=Math.min(MAX_INST,Math.max(1,Math.floor(t.total/MIN_INST)));
   body=`<div class="pay-tabs">
    <button class="pay-tab" data-pay="pix" aria-pressed="${co.pay==='pix'}"><svg viewBox="0 0 24 24"><path d="M12 3 21 12 12 21 3 12Z"/><path d="M8 12l4-4 4 4-4 4z"/></svg>PIX<small>5% de desconto</small></button>
    <button class="pay-tab" data-pay="card" aria-pressed="${co.pay==='card'}"><svg viewBox="0 0 24 24"><rect x="3" y="6" width="18" height="12" rx="2"/><path d="M3 10h18"/></svg>Cartão<small>até 3x sem juros</small></button>
    <button class="pay-tab" data-pay="boleto" aria-pressed="${co.pay==='boleto'}"><svg viewBox="0 0 24 24"><path d="M4 6v12M7 6v12M9 6v12M12 6v12M15 6v12M17 6v12M20 6v12"/></svg>Boleto<small>compensa em até 2 dias</small></button></div>`;
   if(co.pay==='pix')body+=PIX.direct
     ?`<p style="margin:0">Ao confirmar, geramos o QR Code PIX de <b>${brl(t.total)}</b>, válido por 1 hora, para a conta da loja (${esc(PIX.name)} · ${esc(PIX.bank)}). Depois de pagar, envie o comprovante pelo WhatsApp: confirmamos assim que o pagamento aparecer na nossa conta.</p>`
     :`<p style="margin:0">Ao confirmar, geramos o QR Code PIX de <b>${brl(t.total)}</b>, válido por 1 hora. A confirmação do pagamento é automática.</p>`;
   if(co.pay==='card')body+=`<p style="margin:0">Você vai para o ambiente seguro do <b>Mercado Pago</b> para digitar os dados do cartão${n>1?` e parcelar em até <b>${n}x de ${brl(t.total/n)}</b> sem juros`:''}. Os dados do cartão não passam pelo nosso site.</p>`;
   if(co.pay==='boleto')body+=`<p style="margin:0">Você vai para o ambiente seguro do <b>Mercado Pago</b> para gerar o boleto de <b>${brl(t.total)}</b>. A compensação leva até 2 dias úteis.</p>`;
   if(t.shipTbd)body+=`<p class="hint" style="margin-top:12px">O valor da entrega escolhida é combinado pelo WhatsApp e não está incluído neste total.</p>`;
   body+=`<div class="demo-note"><svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.5" style="flex:none;margin-top:1px"><rect x="5" y="10" width="14" height="10" rx="2"/><path d="M8 10V7a4 4 0 0 1 8 0v3"/></svg><span>Pagamento processado com segurança pelo Mercado Pago.</span></div>`;
  }
  const t=coTotals();
  const next=co.step===3?(co.pay==='pix'?'Gerar PIX de '+brl(t.total):co.pay==='card'?'Pagar com cartão':'Gerar boleto'):'Continuar';
  $('#cBox').innerHTML=`${ICON_X}
  <div class="co"><div class="co-main"><h2>Finalizar compra</h2>${steps}<div id="coBody">${body}</div>
  <p class="hint err" id="coErr" role="alert" style="margin-top:16px">${co.err||''}</p>
  <div class="co-nav">${co.step>1?`<button class="btn ghost" id="coBack">Voltar</button>`:'<span></span>'}<button class="btn solid" id="coNext">${next}</button></div></div>
  <aside class="co-side">${sideHTML()}</aside></div>`;
  bindCo();
}
const masks={
  tel:v=>{v=onlyD(v).slice(0,11);return v.length>6?`(${v.slice(0,2)}) ${v.slice(2,7)}-${v.slice(7)}`:v.length>2?`(${v.slice(0,2)}) ${v.slice(2)}`:v},
  cpf:v=>{v=onlyD(v).slice(0,11);return v.replace(/(\d{3})(\d)/,'$1.$2').replace(/(\d{3})(\d)/,'$1.$2').replace(/(\d{3})(\d{1,2})$/,'$1-$2')},
  cep:v=>{v=onlyD(v).slice(0,8);return v.length>5?v.slice(0,5)+'-'+v.slice(5):v}
};
let quoteT;
function quote(){const cep=onlyD(co.data.cep);if(!SHIP.correios)return;
  if(cep.length!==8){co.quotes=null;co.quoting=false;refreshShip();return}
  co.quoting=true;refreshShip();clearTimeout(quoteT);
  quoteT=setTimeout(async()=>{try{const r=await fetch('/api/shipping/quote',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({cep,items:cart.map(i=>({id:i.id,qty:i.q}))})});const j=await r.json();co.quotes=r.ok?j.options:[]}catch(e){co.quotes=[]}
    co.quoting=false;if(onlyD(co.data.cep)===cep)refreshShip()},350)}
function refreshShip(){const o=shipOpts().find(x=>x.k===co.ship);if(co.ship&&(!o||o.off))co.ship=null;const l=$('#shipList');if(l)l.innerHTML=shipListHTML();const s=$('.co-side');if(s)s.innerHTML=sideHTML()}
async function viaCep(cep){try{const r=await fetch(`https://viacep.com.br/ws/${cep}/json/`);const j=await r.json();if(j.erro)return;
  const set=(id,v)=>{if(v&&!co.data[id]){co.data[id]=v;const el=$('#'+id);if(el)el.value=v}};set('rua',j.logradouro);set('bairro',j.bairro);set('cidade',j.localidade&&j.uf?`${j.localidade} / ${j.uf}`:'')}catch(e){}}
function bindCo(){const b=$('#cBox');
  b.querySelectorAll('input').forEach(i=>i.addEventListener('input',()=>{if(masks[i.id])i.value=masks[i.id](i.value);co.data[i.id]=i.value;i.parentElement.classList.remove('bad');
    if(i.id==='cep'){quote();if(onlyD(i.value).length===8)viaCep(onlyD(i.value))}}));
  b.onclick=e=>{const t=e.target;
    const s=t.closest('[data-ship]');if(s&&!s.disabled){co.ship=s.dataset.ship;$$('[data-ship]').forEach(x=>x.setAttribute('aria-pressed',x===s));$('.co-side').innerHTML=sideHTML();$('#shipErr').textContent=''}
    const p=t.closest('[data-pay]');if(p){co.pay=p.dataset.pay;co.err='';renderCo()}
    if(t.closest('#copyPix')){const c=co.order.qr;(navigator.clipboard?navigator.clipboard.writeText(c):Promise.reject()).then(()=>toast('Código PIX copiado')).catch(()=>{const r=document.createRange();r.selectNodeContents($('#pixCode'));getSelection().removeAllRanges();getSelection().addRange(r);toast('Código selecionado, copie com Ctrl+C')})}
    if(t.closest('#coBack')){co.step--;co.err='';renderCo()}
    if(t.closest('#coNext'))nextStep();
  };
  if(co.step===2&&SHIP.correios&&onlyD(co.data.cep).length===8&&!co.quotes&&!co.quoting)quote();
}
function req(ids){let ok=true;ids.forEach(([id,test])=>{const el=$('#'+id);const v=(el.value||'').trim();if(!test(v)){ok=false;el.parentElement.classList.add('bad')}});if(!ok){const f=$('.field.bad input');f&&f.focus();toast('Confira os campos destacados')}return ok}
const has=v=>v.length>1;
function validCpf(v){const c=onlyD(v);if(c.length!==11||/^(\d)\1{10}$/.test(c))return false;const dv=n=>{let s=0;for(let i=0;i<n;i++)s+=+c[i]*(n+1-i);const r=s*10%11;return r===10?0:r};return dv(9)===+c[9]&&dv(10)===+c[10]}
async function nextStep(){
  if(co.step===1&&!req([['nome',v=>v.split(/\s+/).length>1],['email',v=>/^\S+@\S+\.\S+$/.test(v)],['tel',v=>onlyD(v).length>=10],['cpf',validCpf]]))return;
  if(co.step===2){if(!req([['cep',v=>onlyD(v).length===8],['rua',has],['num',v=>v.length>0],['bairro',has],['cidade',has]]))return;if(!co.ship){$('#shipErr').textContent='Escolha uma forma de entrega.';return}}
  if(co.step<3){co.step++;co.err='';renderCo();$('#cBox').scrollTop=0;return}
  const btn=$('#coNext');btn.disabled=true;btn.textContent='Processando…';$('#coErr').textContent='';
  try{
    const r=await fetch('/api/checkout',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({
      customer:{nome:co.data.nome,email:co.data.email,tel:co.data.tel,cpf:co.data.cpf},
      address:{cep:co.data.cep,rua:co.data.rua,num:co.data.num,comp:co.data.comp,bairro:co.data.bairro,cidade:co.data.cidade},
      items:cart.map(i=>({id:i.id,size:i.size,color:i.col,qty:i.q,price:P.find(x=>x.id===i.id).p})),shipping:co.ship,coupon:coupon?coupon.code:null,payment:co.pay})});
    const j=await r.json();if(!r.ok){if(j.coupon===false){coupon=null;save()}if(j.prices_changed)await reloadCatalog();throw new Error(j.error||'Não foi possível finalizar o pedido.')}
    // a sacola só é esvaziada quando o pagamento é confirmado
    store.set('neo-last-order',j.orderId);
    if(j.redirect){location.href=j.redirect;return}
    co.order=j;co.step='pix';renderCo();
  }catch(e){co.err=e.message;btn.disabled=false;renderCo()}
}
let pixI,pollI;
/* PIX direto: para quem a cliente está pagando e o botão do comprovante pelo WhatsApp. */
function pixDirectHTML(o){const msg=`Olá! Fiz o PIX do pedido #${o.code} (${brl(o.total)}). Segue o comprovante.`;
  return`<div class="pix-to"><span class="opt-label">Você está pagando para</span><b>${esc(PIX.name)}</b><small>${esc(PIX.bank)} · chave ${esc(PIX.keyType)} ${esc(PIX.keyLabel)}</small></div>
  <a class="btn solid" style="height:42px;margin-top:10px" href="${WA}?text=${encodeURIComponent(msg)}" target="_blank" rel="noopener">Enviar comprovante pelo WhatsApp</a>`}
function renderPix(){const o=co.order;
  $('#cBox').innerHTML=`${ICON_X}<div class="finish" style="padding-top:50px">
  <h2 style="font-size:38px">Pedido #${o.code} criado</h2><p>Pague <b style="color:var(--ink)">${brl(o.total)}</b> com PIX para confirmar.</p>
  <div class="pix" style="max-width:640px;margin:28px auto 0;text-align:left">
    <div class="qr">${o.qrBase64?`<img src="data:image/png;base64,${o.qrBase64}" alt="QR Code PIX" style="width:100%">`:''}</div>
    <div><div class="opt-label">Pague em até</div><div class="timer" id="pixT">--:--</div>
    <p class="hint" style="margin:10px 0 0">Abra o app do seu banco, escolha pagar com PIX e escaneie o código ou use o copia e cola.</p>
    <div class="code" id="pixCode">${esc(o.qr||'')}</div><button class="btn ghost" id="copyPix" style="height:42px">Copiar código PIX</button>
    ${o.direct?pixDirectHTML(o):''}
    <p class="hint" id="pixWait" style="margin:14px 0 0;max-width:none;text-align:left">${o.direct?'Aguardando o pagamento. Esta tela muda sozinha quando confirmarmos.':'Aguardando a confirmação do pagamento…'}</p></div></div></div>`;
  bindCo();
  clearInterval(pixI);const end=new Date(o.expiresAt).getTime();
  const tick=()=>{const s=Math.max(0,Math.round((end-Date.now())/1000));const el=$('#pixT');if(!el){clearInterval(pixI);return}el.textContent=`${String(Math.floor(s/60)).padStart(2,'0')}:${String(s%60).padStart(2,'0')}`;if(!s){clearInterval(pixI);$('#pixWait').textContent=o.direct?'O prazo do QR Code terminou. Se você já pagou, envie o comprovante pelo WhatsApp que confirmamos o pedido.':'O código expirou. Faça o pedido novamente ou fale com a gente no WhatsApp.'}};tick();pixI=setInterval(tick,1000);
  clearInterval(pollI);pollI=setInterval(async()=>{if(!$('#pixT')){clearInterval(pollI);return}try{const r=await fetch('/api/orders/'+o.orderId);const j=await r.json();if(['paid','shipped','delivered'].includes(j.status)){clearInterval(pollI);co.step='done';renderCo()}}catch(e){}},5000);
}
function renderDone(){clearInterval(pixI);clearInterval(pollI);clearPaidCart();const o=co.order;const first=(co.data.nome||'').split(' ')[0];
  $('#cBox').innerHTML=`${ICON_X}
  <div class="finish"><div class="seal"><svg viewBox="0 0 120 120"><defs><path id="c2" d="M60,60 m-50,0 a50,50 0 1,1 100,0 a50,50 0 1,1 -100,0"/></defs><text font-family="Montserrat,sans-serif" font-size="9" letter-spacing="4.2" fill="currentColor"><textPath href="#c2">VOLTE SEMPRE · NEO STORE · VOLTE SEMPRE · NEO STORE ·</textPath></text></svg><span class="mono"></span></div>
  <h2>Pagamento confirmado${first?', '+esc(first):''}.</h2><p>Pedido <b style="color:var(--ink)">#${o.code}</b> · total ${brl(o.total)}</p><p>Já estamos separando suas peças. Você vai receber as atualizações em ${esc(co.data.email||'seu e-mail')}.</p>
  <button class="btn solid" style="margin-top:26px" data-close>Continuar comprando</button></div>`;
}
