import './info.css';
import { LEGAL, STORE } from '@/lib/config';

// Páginas de informação da loja: trocas, pagamentos e privacidade.
export default function InfoLayout({ children }) {
  return (
    <main className="info">
      <article>
        <a className="back" href="/"><span className="mono" />Voltar para a loja</a>
        {children}
        <div className="company">
          {LEGAL.company} · CNPJ {LEGAL.cnpj} · {LEGAL.cities}<br />
          WhatsApp {STORE.whatsappLabel} · {LEGAL.email} · {LEGAL.hours}
        </div>
      </article>
    </main>
  );
}
