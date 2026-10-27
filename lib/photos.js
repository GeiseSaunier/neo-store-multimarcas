import 'server-only';

// Limpeza das fotos do Storage que ninguém mais usa (peças excluídas, fotos removidas,
// envios de uma peça que nunca foi salva). Uma foto só é apagada se nenhuma peça e
// nenhum pedido a usar e se tiver mais de 24 h (para não apagar um envio em andamento).
const BUCKET = 'products';
const MIN_AGE = 24 * 3600e3;

// Caminho do arquivo dentro do bucket a partir da URL pública (null se não for do bucket).
export function photoPath(url) {
  const m = /\/storage\/v1\/object\/public\/products\/([^?#]+)/.exec(url || '');
  return m ? decodeURIComponent(m[1]) : null;
}

// Arquivos do bucket que podem ser apagados com segurança.
export function orphanPaths(objects, usedUrls, now = Date.now()) {
  const used = new Set(usedUrls.map(photoPath).filter(Boolean));
  return objects
    .filter((o) => o.id && !used.has(o.name)) // id vazio = pasta
    .filter((o) => now - new Date(o.created_at).getTime() > MIN_AGE)
    .map((o) => o.name);
}

export async function sweepPhotos(db) {
  // Tudo o que está em uso. Se algo falhar aqui, não apaga nada.
  const { data: products, error: pe } = await db.from('products').select('images');
  if (pe) throw pe;
  const { data: items, error: ie } = await db.from('order_items').select('image').not('image', 'is', null);
  if (ie) throw ie;
  const used = [...products.flatMap((p) => p.images || []), ...items.map((i) => i.image)];

  const objects = [];
  for (let offset = 0; ; offset += 1000) {
    const { data, error } = await db.storage.from(BUCKET).list('', { limit: 1000, offset });
    if (error) throw error;
    objects.push(...data);
    if (data.length < 1000) break;
  }

  const orphans = orphanPaths(objects, used);
  // Trava: apagar mais da metade das fotos de uma vez indica erro de leitura, não sobra de verdade.
  if (orphans.length > 20 && orphans.length > objects.length / 2) {
    throw new Error(`Limpeza cancelada: ${orphans.length} de ${objects.length} fotos pareciam sem uso. Nada foi apagado; confira antes.`);
  }
  for (let i = 0; i < orphans.length; i += 500) {
    const { error } = await db.storage.from(BUCKET).remove(orphans.slice(i, i + 500));
    if (error) throw error;
  }
  return orphans.length;
}
