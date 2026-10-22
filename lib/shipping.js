import 'server-only';

// Cotação de PAC e SEDEX pelo Melhor Envio (https://melhorenvio.com.br).
// Sem MELHOR_ENVIO_TOKEN, as opções dos Correios simplesmente não aparecem.
const SERVICES = { 1: 'pac', 2: 'sedex' };

export function correiosEnabled() {
  return Boolean(process.env.MELHOR_ENVIO_TOKEN && process.env.STORE_CEP);
}

// Medidas padrão de uma embalagem de bolsa. Ajuste em .env se precisar.
function packageFor(qty) {
  return {
    height: Number(process.env.PKG_HEIGHT_CM || 15) * Math.max(1, Math.ceil(qty / 2)),
    width: Number(process.env.PKG_WIDTH_CM || 35),
    length: Number(process.env.PKG_LENGTH_CM || 40),
    weight: Number(process.env.PKG_WEIGHT_KG || 1) * Math.max(1, qty),
  };
}

export async function quoteCorreios({ cep, qty, insurance }) {
  if (!correiosEnabled()) return [];
  const base = process.env.MELHOR_ENVIO_SANDBOX === 'true' ? 'https://sandbox.melhorenvio.com.br' : 'https://melhorenvio.com.br';
  const res = await fetch(`${base}/api/v2/me/shipment/calculate`, {
    method: 'POST',
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json',
      Authorization: `Bearer ${process.env.MELHOR_ENVIO_TOKEN}`,
      'User-Agent': `Neo Store (${process.env.MELHOR_ENVIO_EMAIL || 'contato@neostore.com.br'})`,
    },
    body: JSON.stringify({
      from: { postal_code: process.env.STORE_CEP },
      to: { postal_code: cep },
      package: packageFor(qty),
      options: { insurance_value: Number(insurance) || 0, receipt: false, own_hand: false },
      services: '1,2',
    }),
    cache: 'no-store',
  });
  if (!res.ok) {
    console.error('Melhor Envio', res.status, await res.text());
    return [];
  }
  const list = await res.json();
  return (Array.isArray(list) ? list : [])
    .filter((s) => !s.error && SERVICES[s.id])
    .map((s) => ({
      id: SERVICES[s.id],
      name: `Correios · ${s.name} (via Melhor Envio)`,
      price: Number(s.custom_price ?? s.price),
      min: s.custom_delivery_range?.min ?? s.delivery_range?.min ?? s.delivery_time,
      max: s.custom_delivery_range?.max ?? s.delivery_range?.max ?? s.delivery_time,
    }));
}
