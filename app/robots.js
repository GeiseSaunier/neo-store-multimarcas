const site = (process.env.NEXT_PUBLIC_SITE_URL || '').replace(/\/$/, '');

export default function robots() {
  return {
    rules: { userAgent: '*', allow: '/', disallow: ['/admin', '/api', '/pedido'] },
    sitemap: site ? `${site}/sitemap.xml` : undefined,
  };
}
