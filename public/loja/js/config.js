/* Neo Store · configuração da loja
   Marcas, subcategorias e WhatsApp. Mantenha igual a lib/config.js. */
/* menu:false = não aparece como marca no menu (peças avulsas; aparecem pelos atalhos de categoria). */
const BRANDS={capodarte:{n:'Capodarte',subs:['bolsas','carteiras']},carmen:{n:'Carmen Steffens',subs:['bolsas','carteiras','calcados']},csclub:{n:'Cs Club',subs:['bolsas','calcados']},outras:{n:'Outras marcas',subs:['roupas'],menu:false}};
const SUBS={bolsas:'Bolsas',carteiras:'Carteiras',calcados:'Calçados',roupas:'Roupas'};
/* Atalhos do menu que juntam uma categoria de todas as marcas. */
const SHORTCUTS=['calcados','roupas'];
const WA='https://wa.me/5592984848096', WA_LABEL='(92) 98484-8096';
/* Cupom citado no cadastro de novidades (só aparece se estiver ativo no painel). */
const WELCOME_COUPON='BEMVINDA';
/* PIX direto na conta da loja (confirmação manual). Manter igual a PIX em lib/config.js. */
const PIX={direct:true,keyLabel:'32.315.010/0001-02',keyType:'CNPJ',name:'Vanessa Neo Gomes',bank:'Nubank'};
/* Dados da empresa no rodapé. Manter igual a LEGAL em lib/config.js. */
const LEGAL={company:'Neo Store Multimarcas',cnpj:'32.315.010/0001-02',address:'[Rua, número, bairro, Parintins/AM, CEP]',email:'contato@neostore.com.br',instagram:'https://www.instagram.com/[usuario]'};
const menuBrands=()=>Object.entries(BRANDS).filter(([,b])=>b.menu!==false);
const brandOf=p=>p.b==='outras'&&p.bl?p.bl:BRANDS[p.b].n;
const label=p=>`${brandOf(p)} · ${SUBS[p.c]}`;
const countOf=(b,s)=>P.filter(p=>p.b===b&&(!s||p.c===s)).length;
/* Filtros: "todos", "marca", "marca:categoria" ou "cat:categoria" (atalho de todas as marcas). */
const validGo=g=>g==='todos'||(()=>{const[b,s]=g.split(':');if(b==='cat')return SHORTCUTS.includes(s);return BRANDS[b]&&BRANDS[b].menu!==false&&(!s||BRANDS[b].subs.includes(s))})();
const goName=g=>{const[b,s]=g.split(':');return b==='cat'?SUBS[s]:BRANDS[b].n+(s?' · '+SUBS[s]:'')};
/* Nome no plural para "… chegam em breve": "Calçados", "Calçados Cs Club", "Novas peças Cs Club". */
const soonName=g=>{const[b,s]=g.split(':');return b==='cat'?SUBS[s]:s?`${SUBS[s]} ${BRANDS[b].n}`:`Novas peças ${BRANDS[b].n}`};
