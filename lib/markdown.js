// Leitor simples de texto formatado (Markdown) para as páginas de informação,
// como a política de privacidade em content/privacidade.md.
// Entende: "# Título", "## Subtítulo", "### Seção", listas com "- " ou "1. ",
// parágrafos separados por linha em branco, **negrito** e [link](https://...).
// Variáveis como {{whatsapp}} são trocadas pelos dados da loja (ver fillVars).

// Divide o texto em blocos: { type: 'h1'|'h2'|'h3'|'p'|'ul'|'ol', text | items }.
export function parseMarkdown(text) {
  const blocks = [];
  let para = [], list = null;
  const flushPara = () => { if (para.length) blocks.push({ type: 'p', text: para.join(' ') }); para = []; };
  const flushList = () => { if (list) blocks.push(list); list = null; };
  for (const raw of String(text || '').replace(/\r\n?/g, '\n').split('\n')) {
    const line = raw.trim();
    const h = /^(#{1,3})\s+(.*)$/.exec(line);
    const ul = /^[-*•]\s+(.*)$/.exec(line);
    const ol = /^\d+[.)]\s+(.*)$/.exec(line);
    if (!line) { flushPara(); flushList(); }
    else if (h) { flushPara(); flushList(); blocks.push({ type: `h${h[1].length}`, text: h[2] }); }
    else if (ul || ol) {
      flushPara();
      const type = ul ? 'ul' : 'ol';
      if (!list || list.type !== type) { flushList(); list = { type, items: [] }; }
      list.items.push((ul || ol)[1]);
    } else if (list) list.items[list.items.length - 1] += ' ' + line; // continuação do item
    else para.push(line);
  }
  flushPara(); flushList();
  return blocks;
}

// Divide uma linha em pedaços de texto, negrito e link.
export function parseInline(text) {
  const out = [];
  const re = /\*\*(.+?)\*\*|\[([^\]]+)\]\(((?:https?:\/\/|mailto:|\/)[^)\s]+)\)/g;
  let last = 0, m;
  while ((m = re.exec(text))) {
    if (m.index > last) out.push({ type: 'text', text: text.slice(last, m.index) });
    out.push(m[1] != null ? { type: 'bold', text: m[1] } : { type: 'link', text: m[2], href: m[3] });
    last = re.lastIndex;
  }
  if (last < text.length) out.push({ type: 'text', text: text.slice(last) });
  return out;
}

// Troca {{nome}} pelos valores; variável desconhecida fica como está.
export function fillVars(text, vars) {
  return String(text || '').replace(/\{\{\s*(\w+)\s*\}\}/g, (all, k) => (vars[k] != null && vars[k] !== '' ? String(vars[k]) : all));
}
