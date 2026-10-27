// Página de informação lida de um arquivo em content/ (ex.: content/trocas.md).
// Variáveis disponíveis no texto: {{empresa}}, {{cnpj}}, {{cidades}}, {{whatsapp}}, {{email}}, {{banco}}, {{contato}}.
import fs from 'node:fs';
import path from 'node:path';
import { LEGAL, STORE, PIX } from '@/lib/config';
import { fillVars } from '@/lib/markdown';
import Markdown from './Markdown';

export default function InfoText({ file }) {
  const text = fs.readFileSync(path.join(process.cwd(), 'content', file), 'utf8');
  const vars = {
    empresa: LEGAL.company, cnpj: LEGAL.cnpj, cidades: LEGAL.cities, email: LEGAL.email,
    whatsapp: STORE.whatsappLabel, banco: PIX.bank,
    contato: `pelo WhatsApp ${STORE.whatsappLabel}${LEGAL.email ? ` ou pelo e-mail ${LEGAL.email}` : ''}`,
  };
  return <Markdown text={fillVars(text, vars)} />;
}
