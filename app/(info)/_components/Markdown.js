// Mostra um texto em Markdown (ver lib/markdown.js) com o visual das páginas de informação.
import { parseMarkdown, parseInline } from '@/lib/markdown';

function Inline({ text }) {
  return parseInline(text).map((part, i) => {
    if (part.type === 'bold') return <b key={i}>{part.text}</b>;
    if (part.type === 'link') return <a key={i} href={part.href} {...(part.href.startsWith('http') ? { target: '_blank', rel: 'noopener' } : {})}>{part.text}</a>;
    return part.text;
  });
}

export default function Markdown({ text }) {
  return parseMarkdown(text).map((b, i) => {
    if (b.type === 'ul' || b.type === 'ol') {
      const List = b.type;
      return <List key={i}>{b.items.map((it, j) => <li key={j}><Inline text={it} /></li>)}</List>;
    }
    const Tag = b.type;
    return <Tag key={i}><Inline text={b.text} /></Tag>;
  });
}
