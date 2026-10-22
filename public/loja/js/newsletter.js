/* Neo Store · cadastro de novidades
   Inscrição por e-mail ou WhatsApp. */
/* ================= Newsletter ================= */
let chan='mail';
$('#channel').addEventListener('click',e=>{const b=e.target.closest('button[data-c]');if(!b||b.dataset.c===chan)return;chan=b.dataset.c;
  $('#channel').dataset.c=chan;$$('#channel button').forEach(x=>x.setAttribute('aria-pressed',x===b));
  const i=$('#newsEmail');i.value='';$('#newsHint').textContent='';
  if(chan==='wa'){i.type='tel';i.inputMode='tel';i.placeholder='Seu WhatsApp com DDD';i.autocomplete='tel';$('#newsLabel').textContent='Seu WhatsApp'}
  else{i.type='email';i.inputMode='email';i.placeholder='Seu melhor e-mail';i.autocomplete='email';$('#newsLabel').textContent='Seu e-mail'}
  i.focus()});
$('#newsEmail').addEventListener('input',e=>{if(chan==='wa')e.target.value=masks.tel(e.target.value)});
$('#newsForm').onsubmit=e=>{e.preventDefault();const v=$('#newsEmail').value.trim();const h=$('#newsHint');
  if(chan==='mail'&&!/^\S+@\S+\.\S+$/.test(v)){h.className='hint err';h.textContent='Digite um e-mail válido, como nome@exemplo.com.';return}
  if(chan==='wa'&&onlyD(v).length<10){h.className='hint err';h.textContent='Digite o número com DDD, como (92) 99999-9999.';return}
  h.className='hint';h.textContent='Enviando…';
  fetch('/api/subscribers',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({channel:chan==='wa'?'whatsapp':'email',contact:v})}).then(async r=>{const j=await r.json();if(!r.ok)throw new Error(j.error);
    h.className='hint ok';h.textContent=chan==='wa'?'Pronto! Você vai receber as novidades no WhatsApp. Use o cupom BEMVINDA na primeira compra.':'Inscrição feita. Use o cupom BEMVINDA na sua primeira compra.';$('#newsEmail').value=''})
  .catch(err=>{h.className='hint err';h.textContent=err.message||'Não foi possível concluir a inscrição. Tente de novo.'})};
