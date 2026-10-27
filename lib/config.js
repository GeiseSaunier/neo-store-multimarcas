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
  whatsapp: '5592984558425',
  whatsappLabel: '(92) 98455-8425',
  pixDiscount: 0.05,      // 5% de desconto no PIX
  maxInstallments: 3,     // até 3x sem juros
  pixMinutes: 60,         // validade do QR Code PIX
};

// PIX direto na conta da loja: o checkout gera o QR com esta chave e a confirmação é
// manual no painel ("Marcar como pago"). Com direct: false, o PIX volta a ser pelo
// Mercado Pago (confirmação automática). Manter igual a PIX em public/loja/js/config.js.
export const PIX = {
  direct: true,
  key: '32315010000102',            // chave PIX: CNPJ só com números
  keyLabel: '32.315.010/0001-02',
  keyType: 'CNPJ',
  name: 'Vanessa Neo Gomes',        // titular da conta
  bank: 'Nubank',
  city: 'Parintins',
  graceMinutes: 60,                 // depois do vencimento do QR, espera mais isto antes de cancelar
};

// Dados da empresa (obrigatórios no rodapé de loja virtual, Decreto 7.962/2013).
// Manter igual a public/loja/js/config.js.
export const LEGAL = {
  company: 'Neo Store Multimarcas',
  cnpj: '32.315.010/0001-02',
  cities: 'Maués e Parintins - AM',
  email: 'contato@neostore.com.br',
  instagram: 'https://www.instagram.com/_neo_store_/',
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
// Cancelado → pago: PIX direto que caiu depois de o pedido ser cancelado por prazo.
export const NEXT_STATUS = { pending: ['paid', 'cancelled'], paid: ['shipped', 'cancelled'], shipped: ['delivered'], delivered: [], cancelled: ['paid', 'pending'], refunded: [] };
export const PAYMENT_LABEL = { pix: 'PIX', card: 'Cartão', boleto: 'Boleto' };
