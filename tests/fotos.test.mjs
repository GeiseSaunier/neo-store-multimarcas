// Limpeza segura das fotos do Storage (lib/photos.js).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { photoPath, orphanPaths, sweepPhotos } from '../lib/photos.js';

const URL_BASE = 'https://abc.supabase.co/storage/v1/object/public/products/';
const DAY = 24 * 3600e3;
const NOW = Date.parse('2026-10-26T12:00:00Z');
const obj = (name, ageMs = 2 * DAY) => ({ id: name, name, created_at: new Date(NOW - ageMs).toISOString() });

test('photoPath extrai o arquivo só de URLs do bucket de fotos', () => {
  assert.equal(photoPath(URL_BASE + 'a1.jpg'), 'a1.jpg');
  assert.equal(photoPath(URL_BASE + 'a%20b.jpg?v=2'), 'a b.jpg');
  assert.equal(photoPath('/seed/marrom.jpg'), null);
  assert.equal(photoPath(null), null);
});

test('só apaga foto sem uso e com mais de 24 h', () => {
  const objects = [obj('peca.jpg'), obj('pedido.jpg'), obj('sobra.jpg'), obj('recente.jpg', 2 * 3600e3), { id: null, name: 'pasta', created_at: null }];
  const used = [URL_BASE + 'peca.jpg', URL_BASE + 'pedido.jpg', '/seed/preta.jpg'];
  assert.deepEqual(orphanPaths(objects, used, NOW), ['sobra.jpg']);
});

// Supabase de mentira, só com o que sweepPhotos usa.
function fakeDb({ images = [], orderImages = [], files = [], failProducts = false }) {
  const removed = [];
  const db = {
    removed,
    from: (table) => ({
      select: () => {
        if (table === 'products') return Promise.resolve(failProducts ? { error: new Error('falhou') } : { data: images.map((i) => ({ images: i })) });
        return { not: () => Promise.resolve({ data: orderImages.map((image) => ({ image })) }) };
      },
    }),
    storage: {
      from: () => ({
        list: (_p, { offset }) => Promise.resolve({ data: offset ? [] : files }),
        remove: (paths) => { removed.push(...paths); return Promise.resolve({}); },
      }),
    },
  };
  return db;
}

test('sweepPhotos apaga a sobra e mantém fotos de peças e de pedidos', async () => {
  const db = fakeDb({
    images: [[URL_BASE + 'a.jpg', URL_BASE + 'b.jpg']],
    orderImages: [URL_BASE + 'vendida.jpg'],
    files: [obj('a.jpg'), obj('b.jpg'), obj('vendida.jpg'), obj('sobra.jpg')],
  });
  assert.equal(await sweepPhotos(db), 1);
  assert.deepEqual(db.removed, ['sobra.jpg']);
});

test('sweepPhotos não apaga nada se não conseguir ler as peças', async () => {
  const db = fakeDb({ failProducts: true, files: [obj('a.jpg')] });
  await assert.rejects(sweepPhotos(db));
  assert.deepEqual(db.removed, []);
});

test('trava: não apaga se mais da metade das fotos parecer sem uso', async () => {
  const files = Array.from({ length: 30 }, (_, i) => obj(`f${i}.jpg`));
  const db = fakeDb({ images: [[URL_BASE + 'f0.jpg']], files });
  await assert.rejects(sweepPhotos(db), /Limpeza cancelada/);
  assert.deepEqual(db.removed, []);
});
