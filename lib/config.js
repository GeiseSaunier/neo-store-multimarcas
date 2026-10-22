// Marcas e subcategorias da loja. Para adicionar uma marca nova,
// inclua aqui e também no "check" da coluna brand em supabase/schema.sql.
export const BRANDS = {
  capodarte: { name: 'Capodarte', subs: ['bolsas', 'carteiras'] },
  carmen: { name: 'Carmen Steffens', subs: ['bolsas', 'carteiras', 'calcados'] },
};
export const SUBS = { bolsas: 'Bolsas', carteiras: 'Carteiras', calcados: 'Calçados' };

export const STORE = {
  name: 'Neo Store Multimarcas',
  whatsapp: '5592984848096',
  whatsappLabel: '(92) 98484-8096',
  pixDiscount: 0.05,      // 5% de desconto no PIX
  maxInstallments: 3,     // até 3x sem juros
  pixMinutes: 30,         // validade do QR Code PIX
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
export const PAYMENT_LABEL = { pix: 'PIX', card: 'Cartão', boleto: 'Boleto' };
