// Cabeçalhos de segurança para todas as páginas.
const security = [
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'X-Frame-Options', value: 'DENY' },
  { key: 'Content-Security-Policy', value: "frame-ancestors 'none'; base-uri 'self'; form-action 'self'" },
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
  { key: 'Strict-Transport-Security', value: 'max-age=63072000; includeSubDomains' },
];

/** @type {import('next').NextConfig} */
const nextConfig = {
  // O site não usa next/image; desligar o otimizador fecha uma porta de ataque.
  images: { unoptimized: true },
  poweredByHeader: false,
  async rewrites() {
    return [{ source: '/', destination: '/loja.html' }];
  },
  async headers() {
    return [
      { source: '/:path*', headers: security },
      { source: '/admin/:path*', headers: [{ key: 'X-Robots-Tag', value: 'noindex' }] },
    ];
  },
};
export default nextConfig;
