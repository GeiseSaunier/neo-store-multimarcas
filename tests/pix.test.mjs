// Código PIX copia e cola (lib/pix.js).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { crc16, pixPayload } from '../lib/pix.js';

// Lê os campos EMV (id + tamanho + valor) de um código.
function parse(code) {
  const out = {};
  for (let i = 0; i < code.length;) {
    const id = code.slice(i, i + 2), len = Number(code.slice(i + 2, i + 4));
    out[id] = code.slice(i + 4, i + 4 + len);
    i += 4 + len;
  }
  return out;
}

test('CRC16 confere com o exemplo do manual do Banco Central', () => {
  const example = '00020126580014br.gov.bcb.pix0136123e4567-e12b-12d1-a456-4266554400005204000053039865802BR5913Fulano de Tal6008BRASILIA62070503***6304';
  assert.equal(crc16(example), '1D3D');
});

test('código da loja: chave CNPJ, valor, recebedor e identificador do pedido', () => {
  const code = pixPayload({ key: '32315010000102', name: 'Vanessa Neo Gomes', city: 'Parintins', amount: 655.5, txid: 'NEO1001' });
  const f = parse(code);
  assert.equal(f['00'], '01');
  assert.deepEqual(parse(f['26']), { '00': 'br.gov.bcb.pix', '01': '32315010000102' });
  assert.equal(f['53'], '986');
  assert.equal(f['54'], '655.50');
  assert.equal(f['58'], 'BR');
  assert.equal(f['59'], 'VANESSA NEO GOMES');
  assert.equal(f['60'], 'PARINTINS');
  assert.deepEqual(parse(f['62']), { '05': 'NEO1001' });
  assert.equal(code.slice(-4), crc16(code.slice(0, -4)));
});

test('acentos e símbolos saem do nome, da cidade e do identificador', () => {
  const f = parse(pixPayload({ key: 'x', name: 'Lojã Ç&ia', city: 'São Paulo', amount: 1, txid: 'NEO-12/3' }));
  assert.equal(f['59'], 'LOJA CIA');
  assert.equal(f['60'], 'SAO PAULO');
  assert.deepEqual(parse(f['62']), { '05': 'NEO123' });
});
