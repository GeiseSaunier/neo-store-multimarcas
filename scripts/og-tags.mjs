// Roda antes do build na Vercel: troca os endereços relativos das tags de compartilhamento
// (og:image) da loja pelo endereço completo do site. WhatsApp e Facebook só mostram a
// imagem da prévia com o endereço completo. No computador (fora da Vercel) não faz nada,
// para não alterar o arquivo versionado.
import fs from 'node:fs';

const site = (process.env.NEXT_PUBLIC_SITE_URL || (process.env.VERCEL_PROJECT_PRODUCTION_URL ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}` : '')).replace(/\/$/, '');
if (!process.env.VERCEL || !site) process.exit(0);

const file = new URL('../public/loja.html', import.meta.url);
let html = fs.readFileSync(file, 'utf8');
html = html.replace(/(<meta property="og:image" content=")\/(?!\/)/, `$1${site}/`);
if (!html.includes('property="og:url"')) html = html.replace(/(<meta property="og:type"[^>]*>)/, `$1\n<meta property="og:url" content="${site}/">`);
fs.writeFileSync(file, html);
console.log(`og-tags: prévia de link apontando para ${site}`);
