/* Neo Store · configuração da loja
   Marcas, subcategorias e WhatsApp. Mantenha igual a lib/config.js. */
const BRANDS={capodarte:{n:'Capodarte',subs:['bolsas','carteiras']},carmen:{n:'Carmen Steffens',subs:['bolsas','carteiras','calcados']}};
const SUBS={bolsas:'Bolsas',carteiras:'Carteiras',calcados:'Calçados'};
const WA='https://wa.me/5592984848096', WA_LABEL='(92) 98484-8096';
const label=p=>`${BRANDS[p.b].n} · ${SUBS[p.c]}`;
const countOf=(b,s)=>P.filter(p=>p.b===b&&(!s||p.c===s)).length;
const validGo=g=>g==='todos'||(()=>{const[b,s]=g.split(':');return BRANDS[b]&&(!s||BRANDS[b].subs.includes(s))})();
