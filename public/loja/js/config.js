/* Neo Store · configuração da loja
   Marcas, subcategorias e WhatsApp. Mantenha igual a lib/config.js. */
const BRANDS={capodarte:{n:'Capodarte',subs:['bolsas','carteiras']},carmen:{n:'Carmen Steffens',subs:['bolsas','carteiras','calcados']}};
const SUBS={bolsas:'Bolsas',carteiras:'Carteiras',calcados:'Calçados'};
const WA='https://wa.me/5592984848096', WA_LABEL='(92) 98484-8096';
/* Dados da empresa no rodapé. PREENCHER e manter igual a LEGAL em lib/config.js. */
/* Cupom citado no cadastro de novidades (só aparece se estiver ativo no painel). */
const WELCOME_COUPON='BEMVINDA';
const LEGAL={company:'[RAZÃO SOCIAL DA EMPRESA]',cnpj:'[00.000.000/0000-00]',address:'[Rua, número, bairro, Parintins/AM, CEP]',email:'contato@neostore.com.br',instagram:'https://www.instagram.com/[usuario]'};
const label=p=>`${BRANDS[p.b].n} · ${SUBS[p.c]}`;
const countOf=(b,s)=>P.filter(p=>p.b===b&&(!s||p.c===s)).length;
const validGo=g=>g==='todos'||(()=>{const[b,s]=g.split(':');return BRANDS[b]&&(!s||BRANDS[b].subs.includes(s))})();
