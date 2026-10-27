// Código "PIX copia e cola" (BR Code do Banco Central) com chave, valor e identificador.
// É o mesmo texto que vira o QR Code. Padrão: Manual do BR Code (EMV-QRCPS) do Banco Central.

// Campo EMV: id (2 dígitos) + tamanho (2 dígitos) + valor.
const field = (id, value) => `${id}${String(value.length).padStart(2, '0')}${value}`;

// Nome e cidade do recebedor: só letras sem acento, maiúsculas, com limite de tamanho.
const ascii = (s, max) => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^A-Za-z0-9 ]/g, '').trim().toUpperCase().slice(0, max);

// CRC16-CCITT (polinômio 0x1021, início 0xFFFF), exigido no fim do código.
export function crc16(text) {
  let crc = 0xffff;
  for (const byte of Buffer.from(text, 'utf8')) {
    crc ^= byte << 8;
    for (let i = 0; i < 8; i++) crc = crc & 0x8000 ? ((crc << 1) ^ 0x1021) & 0xffff : (crc << 1) & 0xffff;
  }
  return crc.toString(16).toUpperCase().padStart(4, '0');
}

// key: chave PIX (CNPJ só com números); amount em reais; txid: até 25 letras/números.
export function pixPayload({ key, name, city, amount, txid }) {
  const id = String(txid || '***').replace(/[^A-Za-z0-9]/g, '').slice(0, 25) || '***';
  const body =
    field('00', '01') +
    field('26', field('00', 'br.gov.bcb.pix') + field('01', key)) +
    field('52', '0000') +
    field('53', '986') +
    (amount ? field('54', Number(amount).toFixed(2)) : '') +
    field('58', 'BR') +
    field('59', ascii(name, 25)) +
    field('60', ascii(city, 15)) +
    field('62', field('05', id)) +
    '6304';
  return body + crc16(body);
}
