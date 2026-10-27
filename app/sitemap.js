const site = (process.env.NEXT_PUBLIC_SITE_URL || '').replace(/\/$/, '');

export default function sitemap() {
  return ['', '/trocas', '/pagamentos', '/privacidade'].map((p) => ({ url: `${site}${p || '/'}`, changeFrequency: p ? 'yearly' : 'weekly' }));
}
