// Leitura e gravação dos dados da página Custo e lucro (Supabase).
// É o ÚNICO lugar da página que fala com o banco: para trocar de banco, mude só este arquivo,
// mantendo as funções e o formato do que elas devolvem.
import { PAID_STATUSES } from './config.js';

// Tudo o que a página precisa: pedidos pagos do site, vendas lançadas, compras, peças e custos.
export async function loadProfitData(sb) {
  const [o, m, pu, p, c] = await Promise.all([
    sb.from('orders').select('id,paid_at,created_at,discount,pix_discount,shipping_cost,order_items(product_id,name,size,qty,unit_price,unit_cost,net_amount)').in('status', PAID_STATUSES),
    sb.from('manual_sales').select('*').order('sold_on', { ascending: false }).order('created_at', { ascending: false }),
    sb.from('purchases').select('*, purchase_items(*)').order('bought_on', { ascending: false }).order('created_at', { ascending: false }),
    sb.from('products').select('id,name,price,sizes,stock,size_stock,active'),
    sb.from('product_costs').select('product_id,cost'),
  ]);
  if (o.error || m.error || pu.error || p.error || c.error) throw new Error('Não foi possível carregar os dados. Confira a internet e tente de novo.');
  return { orders: o.data, manual: m.data, purchases: pu.data, products: p.data, costs: Object.fromEntries(c.data.map((x) => [x.product_id, Number(x.cost)])) };
}

// Venda feita fora do site. Peça do catálogo sai do estoque; devolve quanto saiu de fato.
// sale: { product_id, name, size, qty, unit_price, unit_cost, channel, sold_on, notes }
export async function addSale(sb, sale) {
  const { data, error } = await sb.from('manual_sales').insert(sale).select('stock_taken').single();
  if (error) throw new Error('Não foi possível guardar a venda.');
  return data;
}

// Apaga uma venda lançada (a peça volta para o estoque).
export async function deleteSale(sb, id) {
  const { error } = await sb.from('manual_sales').delete().eq('id', id);
  if (error) throw new Error('Não foi possível apagar a venda.');
}

// Compra de mercadoria: head { supplier, bought_on, notes }, items [{ product_id, name, size, qty, unit_cost }].
export async function addPurchase(sb, head, items) {
  const { data: pu, error } = await sb.from('purchases').insert(head).select('id').single();
  if (error) throw new Error('Não foi possível salvar a compra.');
  const { error: ie } = await sb.from('purchase_items').insert(items.map((it) => ({ ...it, purchase_id: pu.id })));
  if (ie) {
    await sb.from('purchases').delete().eq('id', pu.id);
    throw new Error('Não foi possível salvar as peças da compra.');
  }
}

// Apaga uma compra (o que entrou sai do estoque).
export async function deletePurchase(sb, id) {
  const { error } = await sb.from('purchases').delete().eq('id', id);
  if (error) throw new Error('Não foi possível excluir a compra.');
}

// Quanto paguei por uma peça do catálogo.
export async function saveCost(sb, productId, cost) {
  const { error } = await sb.from('product_costs').upsert({ product_id: productId, cost });
  if (error) throw new Error('Não salvou.');
}
