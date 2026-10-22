/* Neo Store · inicialização
   Carrega produtos e entregas da API e desenha a página. */
/* init */
$('#grid').innerHTML='<div class="empty">Carregando peças…</div>';
renderTabs();updateBadges();
(async()=>{
  try{const[pr,sr]=await Promise.all([fetch('/api/products'),fetch('/api/shipping')]);const pj=await pr.json();if(!pr.ok)throw new Error(pj.error);P=pj.products.map(mapP);if(sr.ok)SHIP=await sr.json()}
  catch(e){$('#grid').innerHTML='<div class="empty">Não foi possível carregar as peças agora. Atualize a página em instantes.</div>';return}
  cart=cart.filter(i=>P.some(p=>p.id===i.id));favs=favs.filter(id=>P.some(p=>p.id===id));store.set('neo-favs',favs);
  const ed=(P.find(p=>/shopper/i.test(p.n))||P[0]||{}).img;if(ed)$('#editImg').src=ed;else $('#editImg').closest('.frame').innerHTML='<span class="mono" style="width:38%"></span>';
  renderCats();renderGrid();save();
})();
