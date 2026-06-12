import type { NextConfig } from "next";

const securityHeaders = [
  // Impede que o app seja embutido em iframes (clickjacking)
  { key: "X-Frame-Options", value: "DENY" },
  // Impede o browser de "adivinhar" content-type (sniffing)
  { key: "X-Content-Type-Options", value: "nosniff" },
  // Não vaza URL completa em navegação para outros domínios
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  // Desabilita APIs sensíveis do browser que o app não usa
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
  // Força HTTPS por 1 ano (só tem efeito em produção com HTTPS)
  { key: "Strict-Transport-Security", value: "max-age=31536000; includeSubDomains" },
];

const nextConfig: NextConfig = {
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: securityHeaders,
      },
    ];
  },
};

export default nextConfig;
