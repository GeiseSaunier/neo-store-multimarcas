'use client';
import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useAdmin } from '../../_ctx';
import { BRANDS, SUBS } from '@/lib/config';
import { shrink } from '@/lib/image';
import Chips from '../../_components/Chips';

const EMPTY = { name: '', brand: 'capodarte', category: 'bolsas', price: '', old_price: '', description: '', details: '', sizes: ['Único'], colors: [], images: [], stock: '', size_stock: {}, brand_label: '', active: true, position: 0 };
const SIZE_PRESETS = [['Único', ['Único']], ['33 ao 39', ['33', '34', '35', '36', '37', '38', '39']], ['PP ao GG', ['PP', 'P', 'M', 'G', 'GG']], ['36 ao 46', ['36', '38', '40', '42', '44', '46']]];

// Linha do banco → campos do formulário.
const toForm = (data) => ({
  ...data, price: String(data.price), old_price: data.old_price ? String(data.old_price) : '', details: (data.details || []).join('\n'),
  stock: data.stock == null ? '' : String(data.stock), sizes: data.sizes?.length ? data.sizes : ['Único'],
  size_stock: Object.fromEntries(Object.entries(data.size_stock || {}).map(([k, v]) => [k, String(v)])),
});
// Resumo do estoque no formulário, para saber se foi editado.
const stockKey = (f) => JSON.stringify([f.sizes, String(f.stock ?? ''), f.size_stock]);

export default function ProductForm() {
  const { sb, ask } = useAdmin();
  const { id } = useParams();
  const router = useRouter();
  const isNew = id === 'nova';
  const [f, setF] = useState(isNew ? EMPTY : null);
  const [busy, setBusy] = useState('');
  const [msg, setMsg] = useState({ t: '', ok: false });
  const [drag, setDrag] = useState(false);
  const fileRef = useRef();

  // Estoque como estava ao abrir a tela: serve para saber se ele foi editado aqui.
  const [origStock, setOrigStock] = useState(null);

  useEffect(() => {
    if (isNew) return;
    sb.from('products').select('*').eq('id', id).maybeSingle().then(({ data }) => {
      if (!data) { setMsg({ t: 'Peça não encontrada.' }); return; }
      const form = toForm(data);
      setF(form); setOrigStock(stockKey(form));
    });
  }, [id, isNew, sb]);

  const set = (k) => (e) => setF((s) => ({ ...s, [k]: e?.target ? (e.target.type === 'checkbox' ? e.target.checked : e.target.value) : e }));

  async function upload(files) {
    const list = [...files].filter((x) => x.type.startsWith('image/'));
    if (!list.length) return;
    setBusy('upload'); setMsg({ t: '' });
    const urls = [];
    for (const file of list) {
      const blob = await shrink(file);
      const ext = blob.type === 'image/jpeg' ? 'jpg' : (file.name.split('.').pop() || 'jpg').toLowerCase();
      const path = `${crypto.randomUUID()}.${ext}`;
      const { error } = await sb.storage.from('products').upload(path, blob, { contentType: blob.type || file.type, cacheControl: '31536000' });
      if (error) { setMsg({ t: `Não foi possível enviar ${file.name}.` }); continue; }
      urls.push(sb.storage.from('products').getPublicUrl(path).data.publicUrl);
    }
    setF((s) => ({ ...s, images: [...s.images, ...urls] }));
    setBusy('');
  }
  const move = (i, d) => setF((s) => { const a = [...s.images]; const j = i + d; if (j < 0 || j >= a.length) return s; [a[i], a[j]] = [a[j], a[i]]; return { ...s, images: a }; });
  const removeImg = (i) => setF((s) => ({ ...s, images: s.images.filter((_, k) => k !== i) }));

  async function save(e) {
    e.preventDefault();
    const price = Number(String(f.price).replace(',', '.'));
    const old = f.old_price === '' ? null : Number(String(f.old_price).replace(',', '.'));
    if (!f.name.trim()) return setMsg({ t: 'Dê um nome para a peça.' });
    if (f.brand === 'outras' && !String(f.brand_label || '').trim()) return setMsg({ t: 'Informe o nome da marca da peça.' });
    if (!(price > 0)) return setMsg({ t: 'Informe o preço da peça.' });
    if (old !== null && !(old > price)) return setMsg({ t: 'O preço “de” precisa ser maior que o preço atual. Deixe vazio se a peça não estiver em promoção.' });
    if (!f.images.length) return setMsg({ t: 'Envie pelo menos uma foto.' });
    setBusy('save'); setMsg({ t: '' });
    const sizes = f.sizes.length ? f.sizes : ['Único'];
    // Com mais de um tamanho, o estoque é por tamanho (o banco guarda a soma em "stock").
    const multi = sizes.length > 1;
    const bySize = multi && sizes.some((s) => String(f.size_stock[s] ?? '').trim() !== '');
    const row = {
      name: f.name.trim(), brand: f.brand, brand_label: f.brand === 'outras' ? String(f.brand_label).trim() : null, category: f.category, price, old_price: old,
      description: f.description.trim(), details: f.details.split('\n').map((s) => s.trim()).filter(Boolean),
      sizes, colors: f.colors, images: f.images,
      size_stock: bySize ? Object.fromEntries(sizes.map((s) => [s, Math.max(0, parseInt(f.size_stock[s], 10) || 0)])) : null,
      stock: multi || f.stock === '' ? null : Math.max(0, parseInt(f.stock, 10) || 0), active: f.active, position: Number(f.position) || 0,
    };
    if (isNew) {
      const { data, error } = await sb.from('products').insert(row).select().single();
      setBusy('');
      if (error) return setMsg({ t: 'Não foi possível salvar. Confira os campos e tente de novo.' });
      return router.replace(`/admin/produtos/${data.id}?salvo=1`);
    }
    // Vendas mexem no estoque enquanto a tela está aberta. Se o estoque não foi editado aqui,
    // ele não é enviado (para não gravar um número antigo). Se foi, só salva se ninguém
    // mexeu na peça desde que a tela foi aberta.
    const stockEdited = stockKey(f) !== origStock;
    let q = sb.from('products');
    if (stockEdited) q = q.update(row).eq('id', id).eq('updated_at', f.updated_at);
    else { const { stock, size_stock, ...rest } = row; q = q.update(rest).eq('id', id); }
    const { data, error } = await q.select();
    setBusy('');
    if (error) return setMsg({ t: 'Não foi possível salvar. Confira os campos e tente de novo.' });
    if (!data.length) {
      const { data: fresh } = await sb.from('products').select('*').eq('id', id).maybeSingle();
      if (!fresh) return setMsg({ t: 'Esta peça foi excluída por outra pessoa.' });
      const ff = toForm(fresh);
      setF((s) => ({ ...s, sizes: ff.sizes, stock: ff.stock, size_stock: ff.size_stock, updated_at: ff.updated_at }));
      setOrigStock(stockKey(ff));
      return setMsg({ t: 'O estoque desta peça mudou enquanto você editava (houve uma venda ou outra pessoa salvou). Atualizamos os números na tela: confira o estoque e salve de novo.' });
    }
    const saved = toForm(data[0]);
    setF(saved); setOrigStock(stockKey(saved));
    setMsg({ t: 'Alterações salvas. A loja já mostra a versão nova.', ok: true });
  }
  async function remove() {
    if (!(await ask({ title: `Excluir “${f.name}”?`, message: 'Pedidos antigos continuam guardados. Se quiser só tirar da loja, desligue “Mostrar na loja”.', confirmLabel: 'Excluir peça', danger: true }))) return;
    setBusy('del');
    const { error } = await sb.from('products').delete().eq('id', id);
    if (error) { setBusy(''); return setMsg({ t: 'Não foi possível excluir.' }); }
    router.replace('/admin/produtos');
  }
  useEffect(() => { if (!isNew && typeof location !== 'undefined' && location.search.includes('salvo=1')) setMsg({ t: 'Peça cadastrada. Ela já aparece na loja.', ok: true }); }, [isNew]);

  if (!f) return <div className="empty"><span className="mono" />{msg.t || 'Carregando…'}</div>;
  const subs = BRANDS[f.brand].subs;

  return (
    <form onSubmit={save}>
      <div className="page-head">
        <div><p style={{ margin: '0 0 8px' }}><Link href="/admin/produtos" className="muted">← Produtos</Link></p><h1>{isNew ? 'Nova peça' : f.name || 'Editar peça'}</h1></div>
        <label className="switch"><input type="checkbox" checked={f.active} onChange={set('active')} />Mostrar na loja</label>
      </div>
      <div className="form">
        <div style={{ display: 'grid', gap: 22, alignContent: 'start' }}>
        <div className="card">
          <h2>Fotos</h2>
          <div className="photos">
            {f.images.map((u, i) => (
              <div className="photo" key={u}>
                <img src={u} alt="" />
                {i === 0 && <span className="cover">Capa</span>}
                <div className="tools">
                  <button type="button" aria-label="Mover para a esquerda" onClick={() => move(i, -1)}><svg viewBox="0 0 24 24"><path d="M15 6l-6 6 6 6" /></svg></button>
                  <button type="button" aria-label="Remover foto" onClick={() => removeImg(i)}><svg viewBox="0 0 24 24"><path d="M6 6l12 12M18 6 6 18" /></svg></button>
                  <button type="button" aria-label="Mover para a direita" onClick={() => move(i, 1)}><svg viewBox="0 0 24 24"><path d="M9 6l6 6-6 6" /></svg></button>
                </div>
              </div>
            ))}
            <label className={`upload ${drag ? 'drag' : ''}`} onDragOver={(e) => { e.preventDefault(); setDrag(true); }} onDragLeave={() => setDrag(false)} onDrop={(e) => { e.preventDefault(); setDrag(false); upload(e.dataTransfer.files); }}>
              <span><svg viewBox="0 0 24 24"><path d="M12 16V4M7 9l5-5 5 5" /><path d="M4 16v4h16v-4" /></svg>{busy === 'upload' ? 'Enviando…' : 'Adicionar fotos'}</span>
              <input ref={fileRef} type="file" accept="image/*" multiple hidden onChange={(e) => { upload(e.target.files); e.target.value = ''; }} />
            </label>
          </div>
          <p className="muted" style={{ fontSize: 12, margin: '12px 0 0' }}>A primeira foto é a capa na vitrine. Fotos verticais (4:5) com fundo neutro ficam melhores.</p>
        </div>
        <div className="card" style={{ display: 'grid', gap: 16 }}>
          <h2 style={{ margin: 0 }}>Tamanhos, cores e estoque</h2>
          <div className="field">
            <label>Tamanhos disponíveis</label>
            <Chips value={f.sizes} onChange={set('sizes')} placeholder="Digite e aperte Enter" />
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>{SIZE_PRESETS.map(([l, v]) => <button type="button" key={l} className="btn small ghost" onClick={() => setF((s) => ({ ...s, sizes: v }))}>{l}</button>)}</div>
            <span className="help">Para bolsas e carteiras, deixe “Único”. Para roupas, use PP ao GG ou 36 ao 46.</span>
          </div>
          <div className="field">
            <label>Cores</label>
            <div className="colors">
              {f.colors.map((c, i) => (
                <span className="wrapc" key={i}>
                  <button type="button" className="rm" aria-label="Remover cor" onClick={() => setF((s) => ({ ...s, colors: s.colors.filter((_, k) => k !== i) }))}>×</button>
                  <label style={{ background: c }}><input type="color" value={c} onChange={(e) => setF((s) => ({ ...s, colors: s.colors.map((x, k) => (k === i ? e.target.value : x)) }))} aria-label={`Cor ${i + 1}`} /></label>
                </span>
              ))}
              <button type="button" className="btn small ghost" onClick={() => setF((s) => ({ ...s, colors: [...s.colors, '#73625A'] }))}>Adicionar cor</button>
            </div>
            <span className="help">Com mais de uma cor, a cliente escolhe na página da peça.</span>
          </div>
          {f.sizes.length > 1 && (
            <div className="field">
              <label>Estoque por tamanho (opcional)</label>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                {f.sizes.map((s) => (
                  <label key={s} style={{ display: 'grid', gap: 4, width: 64, fontSize: 12, textAlign: 'center' }}>{s}
                    <input inputMode="numeric" value={f.size_stock[s] ?? ''} placeholder="–" style={{ textAlign: 'center' }} aria-label={`Estoque do tamanho ${s}`}
                      onChange={(e) => setF((st) => ({ ...st, size_stock: { ...st.size_stock, [s]: e.target.value.replace(/\D/g, '') } }))} />
                  </label>
                ))}
              </div>
              <span className="help">Deixe todos vazios para não controlar o estoque. Preenchendo algum, tamanho vazio conta como 0 (esgotado). O estoque baixa sozinho a cada pedido.</span>
            </div>
          )}
          <div className="row">
            {f.sizes.length > 1 ? <div /> : <div className="field"><label htmlFor="st">Estoque (opcional)</label><input id="st" inputMode="numeric" value={f.stock} onChange={set('stock')} placeholder="Sem controle" /><span className="help">Com estoque 0, a peça aparece como esgotada. O estoque baixa sozinho a cada pedido.</span></div>}
            <div className="field"><label htmlFor="po">Ordem na vitrine</label><input id="po" inputMode="numeric" value={f.position} onChange={set('position')} /><span className="help">Números menores aparecem primeiro.</span></div>
          </div>
        </div>
        </div>
        <div className="card" style={{ display: 'grid', gap: 16 }}>
          <h2 style={{ margin: 0 }}>Informações</h2>
          <div className="field"><label htmlFor="nm">Nome da peça</label><input id="nm" value={f.name} onChange={set('name')} placeholder="Ex.: Bolsa Estruturada Marrom" /></div>
          <div className="row">
            <div className="field"><label htmlFor="br">Marca</label>
              <select id="br" value={f.brand} onChange={(e) => { const b = e.target.value; setF((s) => ({ ...s, brand: b, category: BRANDS[b].subs.includes(s.category) ? s.category : BRANDS[b].subs[0] })); }}>
                {Object.entries(BRANDS).map(([k, b]) => <option key={k} value={k}>{b.name}</option>)}
              </select></div>
            <div className="field"><label htmlFor="ct">Categoria</label>
              <select id="ct" value={f.category} onChange={set('category')}>{subs.map((s) => <option key={s} value={s}>{SUBS[s]}</option>)}</select></div>
          </div>
          {f.brand === 'outras' && (
            <div className="field"><label htmlFor="bl">Nome da marca</label><input id="bl" value={f.brand_label || ''} onChange={set('brand_label')} placeholder="Ex.: Lança Perfume" />
              <span className="help">Aparece na loja no lugar de “Outras marcas”. A peça entra na vitrine pelo atalho da categoria (ex.: Roupas).</span></div>
          )}
          <div className="row">
            <div className="field"><label htmlFor="pr">Preço (R$)</label><input id="pr" inputMode="decimal" value={f.price} onChange={set('price')} placeholder="690,00" /></div>
            <div className="field"><label htmlFor="op">Preço “de” (opcional)</label><input id="op" inputMode="decimal" value={f.old_price} onChange={set('old_price')} placeholder="Só se estiver em promoção" /></div>
          </div>
          <div className="field"><label htmlFor="ds">Descrição</label><textarea id="ds" value={f.description} onChange={set('description')} placeholder="Como é a peça, para quem e para quê." /></div>
          <div className="field"><label htmlFor="dt">Detalhes (um por linha)</label><textarea id="dt" value={f.details} onChange={set('details')} style={{ minHeight: 80 }} placeholder={'Alças de ombro\nFechamento com zíper'} /></div>
        </div>
      </div>
      <div className="savebar">
        <div>{!isNew && <button type="button" className="btn danger" onClick={remove} disabled={!!busy}>Excluir peça</button>}</div>
        <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
          {msg.t && <span className={msg.ok ? 'okmsg' : 'err'} role="status">{msg.t}</span>}
          <button className="btn solid" disabled={!!busy}>{busy === 'save' ? 'Salvando…' : isNew ? 'Cadastrar peça' : 'Salvar alterações'}</button>
        </div>
      </div>
    </form>
  );
}
