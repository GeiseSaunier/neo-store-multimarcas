// Marcas e subcategorias da loja. Para adicionar uma marca ou categoria nova, inclua aqui,
// em public/loja/js/config.js e nas regras products_brand_check/products_category_check
// de supabase/schema.sql.
// "outras" (menu: false) é para peças de marcas avulsas, como as roupas: o nome da marca
// é digitado no cadastro da peça e ela aparece na loja pelos atalhos de categoria.
export const BRANDS = {
  capodarte: { name: 'Capodarte', subs: ['bolsas', 'carteiras'] },
  carmen: { name: 'Carmen Steffens', subs: ['bolsas', 'carteiras', 'calcados'] },
  csclub: { name: 'Cs Club', subs: ['bolsas', 'calcados'] },
  outras: { name: 'Outras marcas', subs: ['roupas'], menu: false },
};
export const SUBS = { bolsas: 'Bolsas', carteiras: 'Carteiras', calcados: 'Calçados', roupas: 'Roupas' };
// Nome da marca de uma peça ou item de pedido (para "outras", o nome digitado no cadastro).
export const brandName = (brand, label) => (brand === 'outras' && label ? label : BRANDS[brand]?.name || brand);

export const STORE = {
  name: 'Neo Store Multimarcas',
  whatsapp: '5592984848096',
  whatsappLabel: '(92) 98484-8096',
  pixDiscount: 0.05,      // 5% de desconto no PIX
  maxInstallments: 3,     // até 3x sem juros
  pixMinutes: 30,         // validade do QR Code PIX
};

// Dados da empresa (obrigatórios no rodapé de loja virtual, Decreto 7.962/2013).
// PREENCHER com os dados reais e manter igual a public/loja/js/config.js.
export const LEGAL = {
  company: '[RAZÃO SOCIAL DA EMPRESA]',
  cnpj: '[00.000.000/0000-00]',
  address: '[Rua, número, bairro, Parintins/AM, CEP]',
  email: 'contato@neostore.com.br',
  instagram: 'https://www.instagram.com/[usuario]',
  hours: 'Seg a sáb, 9h às 19h',
};

export const STATUS = {
  pending: { label: 'Aguardando pagamento', tone: 'wait' },
  paid: { label: 'Pago', tone: 'ok' },
  shipped: { label: 'Enviado', tone: 'info' },
  delivered: { label: 'Entregue', tone: 'done' },
  cancelled: { label: 'Cancelado', tone: 'bad' },
  refunded: { label: 'Reembolsado', tone: 'bad' },
};
export const PAID_STATUSES = ['paid', 'shipped', 'delivered'];
// Para quais status cada pedido pode ir pelo painel.
export const NEXT_STATUS = { pending: ['paid', 'cancelled'], paid: ['shipped', 'cancelled'], shipped: ['delivered'], delivered: [], cancelled: ['pending'], refunded: [] };
export const PAYMENT_LABEL = { pix: 'PIX', card: 'Cartão', boleto: 'Boleto' };
