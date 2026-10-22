/* Neo Store · estado da página
   Produtos e entregas (vindos da API), sacola, favoritos, cupom e filtros. */
let P=[], SHIP={correios:false,regional:[]};
let cart=store.get('neo-cart',[]), favs=store.get('neo-favs',[]), coupon=store.get('neo-coupon',null);
if(typeof coupon==='string')coupon=null;
let filter='todos', query='';
